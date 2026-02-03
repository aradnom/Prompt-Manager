import type { LLMOperation } from "./types";

/**
 * Parses a numbered list response from an LLM into an array of strings.
 * Used for explore, generate, and generate-wildcard operations.
 *
 * Example input:
 * "1. First item\n2. Second item\n3. Third item"
 *
 * Example output:
 * ["First item", "Second item", "Third item"]
 */
export function parseNumberedList(text: string): string[] {
  const lines = text.trim().split("\n");
  const items = lines
    .map((line: string) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line: string) => line.length > 0);

  return items;
}

/**
 * Determines if an operation should return a parsed numbered list.
 */
export function shouldParseNumberedList(operation: string): boolean {
  return (
    operation === "explore" ||
    operation === "generate" ||
    operation === "generate-wildcard"
  );
}

/**
 * Processes LLM response text based on the operation type.
 * Returns either the raw text or a parsed array.
 */
export function processLLMResponse(
  text: string,
  operation: LLMOperation,
): string | string[] {
  if (shouldParseNumberedList(operation)) {
    return parseNumberedList(text);
  }
  return text.trim();
}

/** Operations where wildcards should be preserved and appended to the result */
const WILDCARD_PRESERVE_OPERATIONS: LLMOperation[] = [
  "more-descriptive",
  "less-descriptive",
  "variation-slight",
  "variation-fair",
  "variation-very",
];

/** Append wildcards to a transform result if the operation preserves them */
export function appendWildcardsToResult(
  result: string | string[],
  operation: LLMOperation,
  wildcards?: string[],
): string | string[] {
  if (!wildcards || wildcards.length === 0) return result;
  if (!WILDCARD_PRESERVE_OPERATIONS.includes(operation)) return result;
  if (typeof result !== "string") return result;

  return result + " " + wildcards.join(" ");
}
