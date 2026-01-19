export interface WildcardMatch {
  displayId: string
  path: string
  fullMatch: string
  index: number
}

// Pattern: {{wildcard:displayId:path}} or {{wildcard:displayId}}
const WILDCARD_PATTERN = /\{\{wildcard:([a-zA-Z0-9\-_]+)(?::([^}]+))?\}\}/g

export function parseWildcards(text: string): WildcardMatch[] {
  const matches: WildcardMatch[] = []
  let match: RegExpExecArray | null

  while ((match = WILDCARD_PATTERN.exec(text)) !== null) {
    matches.push({
      displayId: match[1],
      path: match[2] || '',
      fullMatch: match[0],
      index: match.index,
    })
  }

  return matches
}

export function insertWildcard(
  text: string,
  cursorPosition: number,
  displayId: string,
  path?: string
): { text: string; newCursorPosition: number } {
  const wildcardSyntax = path
    ? `{{wildcard:${displayId}:${path}}}`
    : `{{wildcard:${displayId}}}`

  const before = text.substring(0, cursorPosition)
  const after = text.substring(cursorPosition)

  // Add space before if there's content before and it doesn't already end with whitespace
  const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')
  const prefix = needsSpaceBefore ? ' ' : ''

  // Always add comma after
  const suffix = ','

  const insertedText = prefix + wildcardSyntax + suffix

  return {
    text: before + insertedText + after,
    newCursorPosition: cursorPosition + insertedText.length,
  }
}
