import { useCallback, useEffect, useState } from "react";
import type { GithubSettings } from "./types";

const KEY = "skillswap.github.settings.v2";

export const DEFAULT_GITHUB: GithubSettings = {
  token: "",
  owner: "rdpaction7",
  repo: "Skillswpa",
  prefix: "skillswap-media",
  maxAssets: 1000,
  uploadUrl: "https://zmoon-bot.onrender.com",
};

export function readGithubSettings(): GithubSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_GITHUB };
    return { ...DEFAULT_GITHUB, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GITHUB };
  }
}

export function writeGithubSettings(settings: GithubSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

/**
 * App-level values (the placeholders in App.tsx) win when they are filled in;
 * otherwise anything saved from the Settings screen is used.
 */
export function mergeSettings(seed?: Partial<GithubSettings>): GithubSettings {
  const stored = readGithubSettings();
  const pick = <K extends keyof GithubSettings>(key: K): GithubSettings[K] =>
    (seed && (seed as GithubSettings)[key]) || stored[key];
  return {
    token: pick("token"),
    owner: pick("owner"),
    repo: pick("repo"),
    prefix: pick("prefix"),
    maxAssets: pick("maxAssets") || 1000,
    uploadUrl: pick("uploadUrl"),
  };
}

export function useGithubSettings(seed?: Partial<GithubSettings>) {
  const [settings, setSettings] = useState<GithubSettings>(() => mergeSettings(seed));

  useEffect(() => {
    const sync = () => setSettings(mergeSettings(seed));
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(
    (next: GithubSettings) => {
      writeGithubSettings(next);
      setSettings(next);
    },
    [],
  );

  return { settings, save };
}
