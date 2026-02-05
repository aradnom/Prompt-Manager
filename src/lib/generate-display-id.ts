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
