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
 * Stored settings (from the Settings screen) take precedence once the user saves
 * them, so a pasted token actually replaces the app-level placeholder. Before
 * that, the values from App.tsx are used.
 */
export function mergeSettings(seed?: Partial<GithubSettings>): GithubSettings {
  const raw = (() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  })();

  if (raw) {
    try {
      const stored = JSON.parse(raw) as Partial<GithubSettings>;
      return { ...DEFAULT_GITHUB, ...seed, ...stored, maxAssets: stored.maxAssets || 1000 };
    } catch {
      /* fall through to defaults */
    }
  }

  return {
    ...DEFAULT_GITHUB,
    ...seed,
    token: seed?.token || DEFAULT_GITHUB.token,
    maxAssets: seed?.maxAssets || 1000,
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
