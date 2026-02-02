import yaml from "js-yaml";
import type { Wildcard } from "@/types/schema";

/**
 * Convert path segments to a dotted/bracketed path string.
 * e.g. ["colors", "[0]", "name"] -> "colors[0].name"
 */
export function buildWildcardPath(segments: string[]): string {
  let result = "";
  segments.forEach((seg, idx) => {
    if (seg.startsWith("[")) result += seg;
    else if (idx === 0) result += seg;
    else result += `.${seg}`;
  });
  return result;
}

/**
 * Collect all leaf paths from a parsed wildcard data structure.
 */
export function collectLeafPaths(
  obj: unknown,
  parentPath: string[] = [],
): string[] {
  const paths: string[] = [];
  const traverse = (data: unknown, pathSoFar: string[]) => {
    if (Array.isArray(data)) {
      data.forEach((item, idx) => {
        const cur = [...pathSoFar, `[${idx}]`];
        if (
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean"
        )
          paths.push(buildWildcardPath(cur));
        else traverse(item, cur);
      });
    } else if (typeof data === "object" && data !== null) {
      const record = data as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const cur = [...pathSoFar, key];
        const val = record[key];
        if (
          typeof val === "string" ||
          typeof val === "number" ||
          typeof val === "boolean"
        )
          paths.push(buildWildcardPath(cur));
        else traverse(val, cur);
      }
    }
  };
  traverse(obj, parentPath);
  return paths;
}

/**
 * Get a random leaf path from a wildcard's content.
 * Returns null if the wildcard has no selectable paths.
 */
export function getRandomWildcardPath(wildcard: Wildcard): string | null {
  try {
    if (wildcard.format === "json") {
      const paths = collectLeafPaths(JSON.parse(wildcard.content));
      if (paths.length > 0)
        return paths[Math.floor(Math.random() * paths.length)];
    } else if (wildcard.format === "yaml") {
      const paths = collectLeafPaths(yaml.load(wildcard.content));
      if (paths.length > 0)
        return paths[Math.floor(Math.random() * paths.length)];
    } else if (wildcard.format === "lines") {
      const lines = wildcard.content.split("\n").filter((l) => l.trim());
      if (lines.length > 0)
        return `[${Math.floor(Math.random() * lines.length)}]`;
    } else if (wildcard.format === "text") {
      return "";
    }
  } catch (error) {
    console.error(
      "Failed to get random path for wildcard:",
      wildcard.displayId,
      error,
    );
  }
  return null;
}
