import { parseWildcards } from './wildcard-parser'
import { resolveWildcardPath } from './wildcard-value-extractor'
import { Wildcard } from '@/types/schema'

export function resolveWildcardsInText(text: string, wildcards: Wildcard[]): string {
  const matches = parseWildcards(text)

  if (matches.length === 0) {
    return text
  }

  const wildcardMap = new Map<string, Wildcard>()
  wildcards.forEach((w) => wildcardMap.set(w.displayId, w))

  let result = text
  // Process matches in reverse order to maintain string positions
  const sortedMatches = [...matches].sort((a, b) => b.index - a.index)

  sortedMatches.forEach((match) => {
    const wildcard = wildcardMap.get(match.displayId)
    let replacement = '[not found]'

    if (wildcard) {
      const resolved = resolveWildcardPath(wildcard.content, wildcard.format, match.path)
      if (resolved !== null) {
        replacement = resolved
      }
    }

    result =
      result.substring(0, match.index) +
      replacement +
      result.substring(match.index + match.fullMatch.length)
  })

  return result
}

export function resolveWildcardsWithMarkers(text: string, wildcards: Wildcard[]): string {
  const matches = parseWildcards(text)

  if (matches.length === 0) {
    return text
  }

  const wildcardMap = new Map<string, Wildcard>()
  wildcards.forEach((w) => wildcardMap.set(w.displayId, w))

  let result = text
  // Process matches in reverse order to maintain string positions
  const sortedMatches = [...matches].sort((a, b) => b.index - a.index)

  sortedMatches.forEach((match) => {
    const wildcard = wildcardMap.get(match.displayId)
    let replacement = '[not found]'

    if (wildcard) {
      const resolved = resolveWildcardPath(wildcard.content, wildcard.format, match.path)
      if (resolved !== null) {
        replacement = resolved
      }
    }

    // Wrap the replacement in the marker syntax
    const markedReplacement = `{{val:${replacement}}}`

    result =
      result.substring(0, match.index) +
      markedReplacement +
      result.substring(match.index + match.fullMatch.length)
  })

  return result
}