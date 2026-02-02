/**
 * Apply comma separation to block content. Ensures each block section
 * (separated by double newlines) ends with a trailing comma.
 */
export function applyCommaSeparation(content: string): string {
  return content
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trimEnd();
      if (trimmed.length === 0) return block;
      if (trimmed.endsWith(",")) return block;
      if (trimmed.endsWith(".")) return trimmed.slice(0, -1) + ",";
      return trimmed + ",";
    })
    .join("\n\n");
}
