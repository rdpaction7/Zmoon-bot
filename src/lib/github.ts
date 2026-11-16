import type { GithubSettings } from "./types";

/**
 * GitHub Releases storage — frontend implementation.
 *
 * Listing releases, counting assets and creating the next numbered release go
 * straight to api.github.com (GitHub sends `Access-Control-Allow-Origin: *`
 * there). The asset upload itself is POSTed to the upload service, because
 * uploads.github.com sends no CORS headers and browsers block that request
 * outright.
 *
 * The service streams the file into the newest release and creates a new release
 * automatically once one has 1000 assets.
 */

const API = "https://api.github.com";

export function isGithubConfigured(settings: GithubSettings | null): boolean {
  return Boolean(settings?.token && settings?.owner && settings?.repo && settings?.uploadUrl);
}

function apiHeaders(settings: GithubSettings): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${settings.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh<T>(settings: GithubSettings, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...apiHeaders(settings), ...(init.headers || {}) },
  });
  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const error: any = new Error(payload.message || `GitHub returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

const repoPath = (settings: GithubSettings) =>
  `/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`;

export async function verifyConnection(settings: GithubSettings) {
  const user = await gh<any>(settings, "/user");
  const repo = await gh<any>(settings, repoPath(settings));
  return {
    login: user.login as string,
    repo: repo.full_name as string,
    canPush: Boolean(repo.permissions?.push),
    private: Boolean(repo.private),
  };
}

function sequenceFromTag(settings: GithubSettings, tag: string): number {
  if (tag === settings.prefix) return 1;
  const match = String(tag).match(new RegExp(`^${settings.prefix}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
}

async function listReleases(settings: GithubSettings) {
  const releases: any[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await gh<any[]>(settings, `${repoPath(settings)}/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return releases
    .map((release) => ({ ...release, sequence: sequenceFromTag(settings, release.tag_name) }))
    .filter((release) => release.sequence > 0)
    .sort((a, b) => b.sequence - a.sequence);
}

async function countAssets(settings: GithubSettings, releaseId: number) {
  let count = 0;
  for (let page = 1; page <= 10; page += 1) {
    const batch = await gh<any[]>(
      settings,
      `${repoPath(settings)}/releases/${releaseId}/assets?per_page=100&page=${page}`,
    );
    count += batch.length;
    if (batch.length < 100) return count;
  }
  return count;
}

export interface StorageStats {
  latestRelease: string | null;
  assetCount: number;
  maxAssets: number;
  releases: number;
}

export async function storageStats(settings: GithubSettings): Promise<StorageStats> {
  const releases = await listReleases(settings);
  if (releases.length === 0) {
    return { latestRelease: null, assetCount: 0, maxAssets: settings.maxAssets, releases: 0 };
  }
  const assetCount = await countAssets(settings, releases[0].id);
  return {
    latestRelease: releases[0].tag_name,
    assetCount,
    maxAssets: settings.maxAssets,
    releases: releases.length,
  };
}

export function safeFileName(rawName: string): string {
  const cleaned = String(rawName || "file")
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(-120);
  return cleaned || "file";
}

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  releaseTag: string;
}

/**
 * Uploads one file through the upload service. XHR is used (not fetch) so real
 * upload progress can be shown for large videos.
 */
export function uploadFile(
  settings: GithubSettings,
  file: File,
  kind: string,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  const endpoint = `${settings.uploadUrl.replace(/\/$/, "")}/upload?filename=${encodeURIComponent(
    `${kind}-${safeFileName(file.name)}`,
  )}`;

  return new Promise<UploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.setRequestHeader("Authorization", `Bearer ${settings.token}`);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () =>
      reject(
        new Error(
          "The network dropped during upload. Check your connection and try again.",
        ),
      );
    request.ontimeout = () => reject(new Error("The upload timed out before GitHub finished."));
    request.onload = () => {
      let payload: any = {};
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        payload = {};
      }
      if (request.status === 200 || request.status === 201) {
        if (!payload.browser_download_url) {
          reject(new Error("The upload service did not return a file URL."));
          return;
        }
        onProgress(100);
        resolve({
          url: payload.browser_download_url,
          name: payload.name || file.name,
          size: payload.size || file.size,
          releaseTag: payload.release_tag || "",
        });
      } else {
        reject(
          new Error(
            payload.error ||
              payload.message ||
              `Upload failed (HTTP ${request.status}). The upload service may be waking up — try again.`,
          ),
        );
      }
    };
    request.send(file);
  });
}

export interface MediaAsset {
  name: string;
  size: number;
  url: string;
  releaseTag: string;
  createdAt: string;
}

export async function listMedia(settings: GithubSettings, limit = 24): Promise<MediaAsset[]> {
  const releases = await listReleases(settings);
  const assets: MediaAsset[] = [];
  for (const release of releases.slice(0, 2)) {
    const batch = await gh<any[]>(
      settings,
      `${repoPath(settings)}/releases/${release.id}/assets?per_page=100`,
    );
    for (const asset of batch) {
      assets.push({
        name: asset.name,
        size: asset.size,
        url: asset.browser_download_url,
        releaseTag: release.tag_name,
        createdAt: asset.created_at,
      });
    }
  }
  return assets
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export async function uploadServiceHealth(settings: GithubSettings) {
  const response = await fetch(`${settings.uploadUrl.replace(/\/$/, "")}/health`);
  if (!response.ok) throw new Error(`Upload service responded HTTP ${response.status}.`);
  return (await response.json()) as { ok: boolean; repository?: string; service?: string };
}
