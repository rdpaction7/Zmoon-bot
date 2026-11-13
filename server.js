import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.PORT || 10000);
const OWNER = process.env.GITHUB_OWNER || "rdpaction7";
const REPO = process.env.GITHUB_REPO || "Skillswpa";
const BASE_TAG = "skillswap-public-uploads";
const MAX_ASSET_BYTES = 2 * 1024 * 1024 * 1024;

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

function json(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function authToken(req) {
  const value = req.headers.authorization || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function githubApi(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `GitHub API returned HTTP ${response.status}`);
  }
  return payload;
}

async function listAllReleases(token) {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await githubApi(
      `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/releases?per_page=100&page=${page}`,
      token,
    );
    all.push(...batch);
    if (batch.length < 100) return all;
  }
  throw new Error("Too many releases to scan safely (over 2,000).");
}

function releaseSequence(tag) {
  if (tag === BASE_TAG) return 1;
  const match = tag.match(new RegExp(`^${BASE_TAG}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
}

async function countAssets(releaseId, token) {
  let count = 0;
  for (let page = 1; page <= 20; page += 1) {
    const batch = await githubApi(
      `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/releases/${releaseId}/assets?per_page=100&page=${page}`,
      token,
    );
    count += batch.length;
    if (batch.length < 100) return count;
  }
  throw new Error("Release contains too many assets to count safely.");
}

async function createRelease(sequence, token) {
  const tag = `${BASE_TAG}-${String(sequence).padStart(3, "0")}`;
  return await githubApi(
    `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/releases`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag_name: tag,
        name: `SkillSwap public uploads ${String(sequence).padStart(3, "0")}`,
        body: "Public course resources uploaded from the SkillSwap school project.",
        draft: false,
        prerelease: true,
      }),
    },
  );
}

async function chooseRelease(token) {
  const releases = await listAllReleases(token);
  const candidates = releases
    .map((release) => ({ ...release, sequence: releaseSequence(release.tag_name) }))
    .filter((release) => release.sequence > 0)
    .sort((a, b) => b.sequence - a.sequence);

  if (candidates.length === 0) return await createRelease(1, token);

  const latest = candidates[0];
  const assetCount = await countAssets(latest.id, token);
  if (assetCount < 1000) return latest;

  return await createRelease(latest.sequence + 1, token);
}

function uploadToGitHub(incoming, release, token, filename, contentType, contentLength, res) {
  const uploadUrl = new URL(release.upload_url.replace(/\{\?.*$/, ""));
  if (uploadUrl.hostname !== "uploads.github.com" || uploadUrl.protocol !== "https:") {
    json(res, 502, { error: "GitHub returned an unexpected release upload URL." });
    incoming.resume();
    return;
  }
  uploadUrl.searchParams.set("name", filename);

  const upstream = https.request(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": contentType || "application/octet-stream",
      "Content-Length": contentLength,
    },
  }, (githubResponse) => {
    const chunks = [];
    let received = 0;
    githubResponse.on("data", (chunk) => {
      received += chunk.length;
      if (received <= 1024 * 1024) chunks.push(chunk);
    });
    githubResponse.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      let payload = {};
      try { payload = JSON.parse(text || "{}"); } catch {}
      if (githubResponse.statusCode === 201) {
        json(res, 201, {
          name: payload.name || filename,
          browser_download_url: payload.browser_download_url,
          release_tag: release.tag_name,
          release_id: release.id,
          size: payload.size || Number(contentLength),
        });
      } else {
        json(res, 502, {
          error: payload.message || `GitHub asset upload failed (HTTP ${githubResponse.statusCode || "unknown"}).`,
          github_status: githubResponse.statusCode || null,
        });
      }
    });
  });

  upstream.setTimeout(95 * 60 * 1000, () => {
    upstream.destroy(new Error("GitHub upload timed out."));
  });
  upstream.on("error", (error) => {
    json(res, 502, { error: error.message || "Could not forward the file to GitHub." });
  });
  incoming.on("aborted", () => upstream.destroy(new Error("Browser upload was interrupted.")));
  incoming.on("error", (error) => upstream.destroy(error));
  incoming.pipe(upstream);
}

async function handleUpload(req, res, requestUrl) {
  const token = authToken(req);
  if (!token) {
    json(res, 401, { error: "Missing bearer token." });
    req.resume();
    return;
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    json(res, 411, { error: "A valid Content-Length header is required for GitHub asset uploads." });
    req.resume();
    return;
  }
  if (contentLength >= MAX_ASSET_BYTES) {
    json(res, 413, { error: "GitHub release assets must be smaller than 2 GiB." });
    req.resume();
    return;
  }

  const rawName = requestUrl.searchParams.get("filename") || "upload.bin";
  const safeName = rawName.normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 100) || "upload.bin";
  const uniqueName = `${Date.now()}-${safeName}`;
  const contentType = req.headers["content-type"] || "application/octet-stream";

  try {
    const user = await githubApi("/user", token);
    if (String(user.login || "").toLowerCase() !== OWNER.toLowerCase()) {
      json(res, 403, { error: `The supplied GitHub token belongs to ${user.login || "an unknown account"}, not ${OWNER}.` });
      req.resume();
      return;
    }
    const release = await chooseRelease(token);
    uploadToGitHub(req, release, token, uniqueName, contentType, contentLength, res);
  } catch (error) {
    json(res, 502, { error: error instanceof Error ? error.message : "Could not prepare the GitHub release." });
    req.resume();
  }
}

const server = http.createServer((req, res) => {
  cors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    json(res, 200, { ok: true, service: "skillswap-github-release-uploader", repository: `${OWNER}/${REPO}` });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/upload") {
    handleUpload(req, res, requestUrl);
    return;
  }

  json(res, 404, { error: "Not found. Use GET /health or POST /upload." });
});

server.requestTimeout = 0;
server.timeout = 0;
server.headersTimeout = 120_000;
server.keepAliveTimeout = 65_000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SkillSwap upload server listening on port ${PORT}`);
});
