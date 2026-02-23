import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";

export function generateDisplayId(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: "-",
    length: 3,
    style: "lowerCase",
  });
}

export function normalizeDisplayId(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");
}

/**
 * Normalize a display ID from a name and append a short random suffix
 * to reduce the chance of uniqueness collisions.
 * e.g. "Mountain Landscape" → "mountain-landscape-a3f9k2"
 */
export function normalizeDisplayIdWithSuffix(value: string): string {
  const base = normalizeDisplayId(value);
  if (!base) return "";
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => b.toString(36).padStart(2, "0").slice(-2))
    .join("");
  return `${base}-${suffix}`;
}
