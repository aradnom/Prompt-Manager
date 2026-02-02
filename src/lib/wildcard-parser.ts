export interface WildcardMatch {
  displayId: string;
  path: string;
  frozen: boolean;
  fullMatch: string;
  index: number;
}

// Pattern: {{wildcard:displayId:path}} or {{wildcard:displayId}}
// The path capture group also picks up |key:value flags, which are parsed separately.
const WILDCARD_PATTERN = /\{\{wildcard:([a-zA-Z0-9\-_]+)(?::([^}]+))?\}\}/g;

export function parseWildcards(text: string): WildcardMatch[] {
  const matches: WildcardMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = WILDCARD_PATTERN.exec(text)) !== null) {
    const rawPath = match[2] || "";
    const pipeIndex = rawPath.indexOf("|");
    let path = rawPath;
    let frozen = false;

    if (pipeIndex !== -1) {
      path = rawPath.substring(0, pipeIndex);
      const flags = rawPath.substring(pipeIndex + 1).split("|");
      for (const flag of flags) {
        const [key, value] = flag.split(":");
        if (key === "frozen" && value === "1") frozen = true;
      }
    }

    matches.push({
      displayId: match[1],
      path,
      frozen,
      fullMatch: match[0],
      index: match.index,
    });
  }

  return matches;
}

export function buildWildcardMarker(
  displayId: string,
  path: string,
  frozen?: boolean,
): string {
  let marker = path
    ? `{{wildcard:${displayId}:${path}`
    : `{{wildcard:${displayId}`;
  if (frozen) marker += "|frozen:1";
  marker += "}}";
  return marker;
}

export function insertWildcard(
  text: string,
  cursorPosition: number,
  displayId: string,
  path?: string,
): { text: string; newCursorPosition: number } {
  const wildcardSyntax = buildWildcardMarker(displayId, path || "");

  const before = text.substring(0, cursorPosition);
  const after = text.substring(cursorPosition);

  // Add space before if there's content before and it doesn't already end with whitespace
  const needsSpaceBefore =
    before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n");
  const prefix = needsSpaceBefore ? " " : "";

  // Always add comma after
  const suffix = ",";

  const insertedText = prefix + wildcardSyntax + suffix;

  return {
    text: before + insertedText + after,
    newCursorPosition: cursorPosition + insertedText.length,
  };
}
