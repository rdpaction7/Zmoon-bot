/**
 * Small text helpers.
 *
 * Documents can be incomplete: a course created by an older build may have no
 * creatorName, a profile imported from elsewhere may have no username, and
 * Firestore returns whatever was written. Every display or lookup path goes
 * through these so a missing field can never crash a render.
 */

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** Username-ish slug used for /u/:username links. */
export function slug(value: unknown, fallback = "member"): string {
  return str(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 24) || fallback;
}

export function titleOf(value: unknown, fallback = "Untitled"): string {
  return str(value, fallback);
}

export function initialsOf(value: unknown): string {
  return str(value, "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export function firstName(value: unknown, fallback = "there"): string {
  return str(value, fallback).split(/\s+/)[0] || fallback;
}

export function firstTwo(value: unknown): string {
  return str(value, "?").slice(0, 2).toUpperCase();
}

export function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
