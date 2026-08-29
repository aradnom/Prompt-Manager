/**
 * Line comments inside block text.
 *
 * A line whose first non-whitespace characters are `//` is commented out.
 * Commented lines are stored verbatim — this only affects *output*: they're
 * greyed out in the UI and dropped from the rendered prompt (and therefore
 * from the clipboard copy, the persisted `rendered_content`, and everything
 * the ComfyUI routes derive from it).
 */
export const LINE_COMMENT_PREFIX = "//";

/** True when `line` is commented out. Leading whitespace is ignored. */
export function isCommentedLine(line: string): boolean {
  return line.trimStart().startsWith(LINE_COMMENT_PREFIX);
}

/**
 * Drop commented lines from a block's text. Returns "" when every line is
 * commented out, which callers treat the same as an empty block.
 */
export function stripCommentedLines(text: string): string {
  if (!text.includes(LINE_COMMENT_PREFIX)) return text;
  return text
    .split("\n")
    .filter((line) => !isCommentedLine(line))
    .join("\n");
}
