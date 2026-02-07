/**
 * Parser for prompt modifier syntax: (), [], and weight (text:1.2)
 */

export interface ModifierMatch {
  type: "emphasis" | "deemphasis";
  fullMatch: string;
  innerText: string;
  index: number;
  parenCount: number;
  bracketCount: number;
  weight: number | null;
}

/**
 * Parse text to find modifier groups (parentheses and brackets)
 * Only finds top-level modifiers - nested ones are part of the outer match
 */
export function parseModifiers(text: string): ModifierMatch[] {
  const matches: ModifierMatch[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === "(" || char === "[") {
      const result = parseModifierAt(text, i);
      if (result) {
        matches.push(result);
        i = result.index + result.fullMatch.length;
        continue;
      }
    }

    i++;
  }

  return matches;
}

/**
 * Try to parse a complete modifier starting at the given index
 * Returns null if no valid modifier found
 */
function parseModifierAt(
  text: string,
  startIndex: number,
): ModifierMatch | null {
  const startChar = text[startIndex];
  const isOpenParen = startChar === "(";
  const isOpenBracket = startChar === "[";

  if (!isOpenParen && !isOpenBracket) {
    return null;
  }

  // Track depth for both types
  let parenDepth = 0;
  let bracketDepth = 0;
  let i = startIndex;

  // Scan forward to find the matching close
  while (i < text.length) {
    const char = text[i];

    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    else if (char === "[") bracketDepth++;
    else if (char === "]") bracketDepth--;

    // Check if we've closed back to zero for the starting type
    if (isOpenParen && parenDepth === 0 && bracketDepth === 0) {
      // Found matching close
      const fullMatch = text.slice(startIndex, i + 1);
      const parsed = analyzeModifier(fullMatch);
      return {
        ...parsed,
        fullMatch,
        index: startIndex,
      };
    }

    if (isOpenBracket && bracketDepth === 0 && parenDepth === 0) {
      // Found matching close
      const fullMatch = text.slice(startIndex, i + 1);
      const parsed = analyzeModifier(fullMatch);
      return {
        ...parsed,
        fullMatch,
        index: startIndex,
      };
    }

    // If we've gone negative on either, this is unbalanced
    if (parenDepth < 0 || bracketDepth < 0) {
      return null;
    }

    i++;
  }

  // Never found matching close
  return null;
}

/**
 * Analyze a complete modifier string to extract its properties
 */
function analyzeModifier(
  text: string,
): Omit<ModifierMatch, "fullMatch" | "index"> {
  let current = text;
  let parenCount = 0;
  let bracketCount = 0;
  let weight: number | null = null;

  // Count and strip outer parentheses
  while (current.startsWith("(") && current.endsWith(")")) {
    // Check for weight syntax: (text:1.2)
    const weightMatch = current.match(/^\((.+):(-?\d+\.?\d*)\)$/);
    if (weightMatch) {
      weight = parseFloat(weightMatch[2]);
      current = weightMatch[1];
      parenCount++;
      break;
    }
    current = current.slice(1, -1);
    parenCount++;
  }

  // Count and strip outer brackets
  while (current.startsWith("[") && current.endsWith("]")) {
    current = current.slice(1, -1);
    bracketCount++;
  }

  // Determine type based on outermost wrapper
  const type: "emphasis" | "deemphasis" = text.startsWith("(")
    ? "emphasis"
    : "deemphasis";

  return {
    type,
    innerText: current,
    parenCount,
    bracketCount,
    weight,
  };
}

/**
 * Check if text contains any modifiers
 */
export function hasModifiers(text: string): boolean {
  return /[()[\]]/.test(text);
}
