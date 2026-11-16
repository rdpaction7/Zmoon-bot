import http from "node:http";
import https from "node:https";

/**
 * SkillSwap media upload service (deployed at https://zmoon-bot.onrender.com).
 *
 * The frontend owns all upload logic; this service exists only because browsers
 * cannot POST asset bytes to uploads.github.com (GitHub sends no CORS headers on
 * that host). It streams the incoming request straight into a GitHub release.
 *
 * Contract:
 *   GET  /health                 → { ok, service, repository }
 *   POST /upload?filename=name   → streams the body to the newest release
 *                                  Authorization: Bearer <github token>
 *                                  → 201 { name, browser_download_url, size, release_tag }
 *
 * When a release reaches 1000 assets the next numbered release is created
 * automatically, so uploads never stop at GitHub's per-release limit.
 *
 * Nothing is written to disk and the body is never buffered in memory.
 */

const PORT = Number(process.env.PORT || 10000);
const OWNER = process.env.GITHUB_OWNER || "rdpaction7";
const REPO = process.env.GITHUB_REPO || "Skillswpa";
const PREFIX = process.env.GITHUB_RELEASE_PREFIX || "skillswap-media";
const MAX_ASSETS = Math.min(Number(process.env.GITHUB_MAX_ASSETS_PER_RELEASE || 1000), 1000);
const ENV_TOKEN = process.env.GITHUB_TOKEN || "";
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

function json(res, status, body) {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

async function github(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const error = new Error(payload.message || `GitHub API returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

const repoPath = () => `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}`;

function sequenceFromTag(tag) {
  if (tag === PREFIX) return 1;
  const match = String(tag || "").match(new RegExp(`^${PREFIX}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
}

async function listReleases(token) {
  const releases = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await github(token, `${repoPath()}/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return releases
    .map((release) => ({ ...release, sequence: sequenceFromTag(release.tag_name) }))
    .filter((release) => release.sequence > 0)
    .sort((a, b) => b.sequence - a.sequence);
}

async function countAssets(token, releaseId) {
  let count = 0;
  for (let page = 1; page <= 20; page += 1) {
    const batch = await github(
      token,
      `${repoPath()}/releases/${releaseId}/assets?per_page=100&page=${page}`,
    );
    count += batch.length;
    if (batch.length < 100) return count;
  }
  return count;
}

async function createRelease(token, sequence) {
  const tag = `${PREFIX}-${String(sequence).padStart(3, "0")}`;
  return github(token, `${repoPath()}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: `SkillSwap media ${String(sequence).padStart(3, "0")}`,
      body: "Course videos, PDFs, images and banners uploaded from SkillSwap.",
      draft: false,
      prerelease: true,
    }),
  });
}

async function ensureRelease(token) {
  const releases = await listReleases(token);
  if (releases.length === 0) {
    const created = await createRelease(token, 1);
    return { ...created, sequence: 1, assetCount: 0 };
  }
  const latest = releases[0];
  const assetCount = await countAssets(token, latest.id);
  if (assetCount < MAX_ASSETS) return { ...latest, assetCount };
  const created = await createRelease(token, latest.sequence + 1);
  return { ...created, sequence: latest.sequence + 1, assetCount: 0 };
}

function cleanName(raw) {
  const cleaned = String(raw || "upload.bin")
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(-120);
  return cleaned || "upload.bin";
}

function streamToRelease({ incoming, release, token, filename, contentType, contentLength }) {
  return new Promise((resolve, reject) => {
    const uploadUrl = new URL(String(release.upload_url).replace(/\{.*$/, ""));
    if (uploadUrl.protocol !== "https:" || uploadUrl.hostname !== "uploads.github.com") {
      reject(new Error("GitHub returned an unexpected release upload URL."));
      return;
    }
    const name = `${Date.now()}-${cleanName(filename)}`;
    uploadUrl.searchParams.set("name", name);

    const upstream = https.request(
      uploadUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": contentType || "application/octet-stream",
          "Content-Length": contentLength,
        },
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size <= 1024 * 1024) chunks.push(chunk);
        });
        response.on("end", () => {
          let payload = {};
          try {
            payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          } catch {
            payload = {};
          }
          if (response.statusCode === 201) {
            resolve({
              name: payload.name || name,
              browser_download_url: payload.browser_download_url,
              size: payload.size || Number(contentLength),
              release_tag: release.tag_name,
              release_id: release.id,
            });
          } else {
            reject(new Error(payload.message || `GitHub asset upload failed (HTTP ${response.statusCode}).`));
          }
        });
      },
    );

    upstream.setTimeout(95 * 60 * 1000, () => upstream.destroy(new Error("GitHub upload timed out.")));
    upstream.on("error", reject);
    incoming.on("aborted", () => upstream.destroy(new Error("The browser upload was interrupted.")));
    incoming.on("error", (error) => upstream.destroy(error));
    incoming.pipe(upstream);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    json(res, 200, {
      ok: true,
      service: "skillswap-media-uploader",
      repository: `${OWNER}/${REPO}`,
      releasePrefix: PREFIX,
      maxAssetsPerRelease: MAX_ASSETS,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/upload") {
    const token = bearer(req) || ENV_TOKEN;
    if (!token) {
      json(res, 401, { error: "Missing GitHub token." });
      req.resume();
      return;
    }

    const contentLength = Number(req.headers["content-length"] || 0);
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
      json(res, 411, { error: "A valid Content-Length header is required for GitHub asset uploads." });
      req.resume();
      return;
    }
    if (contentLength >= MAX_BYTES) {
      json(res, 413, { error: "GitHub release assets must be smaller than 2 GiB." });
      req.resume();
      return;
    }

    try {
      const release = await ensureRelease(token);
      const result = await streamToRelease({
        incoming: req,
        release,
        token,
        filename: url.searchParams.get("filename") || "upload.bin",
        contentType: req.headers["content-type"],
        contentLength,
      });
      console.log(`[upload] ${result.release_tag}/${result.name} (${result.size} bytes)`);
      json(res, 201, result);
    } catch (error) {
      const status = error.status === 401 || error.status === 404 ? 502 : 502;
      console.error("[upload] failed:", error.message);
      json(res, status, {
        error: error.message || "Could not forward the file to GitHub.",
        github_status: error.status || null,
      });
      req.resume();
    }
    return;
  }

  json(res, 404, { error: "Not found. Use GET /health or POST /upload." });
});

server.requestTimeout = 0;
server.timeout = 0;
server.headersTimeout = 120_000;
server.keepAliveTimeout = 65_000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SkillSwap uploader listening on ${PORT} → ${OWNER}/${REPO} (${PREFIX})`);
});
