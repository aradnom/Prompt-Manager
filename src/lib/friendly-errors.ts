// Map internal table names to user-facing resource names.
const RESOURCE_NAMES: Record<string, string> = {
  stacks: "prompt",
  blocks: "block",
  wildcards: "wildcard",
  templates: "template",
};

// Map constraint column suffixes to user-facing field names.
const FIELD_NAMES: Record<string, string> = {
  display_id: "Display ID",
  uuid: "UUID",
  name: "name",
};

/**
 * Attempt to rewrite a raw Postgres unique-constraint error into something
 * a user can act on.  Returns null if the error doesn't match.
 */
function friendlyUniqueConstraintMessage(message: string): string | null {
  if (!message.includes("violates unique constraint")) return null;

  // Constraint names follow the pattern: <table>_<column>_key
  const match = message.match(/"(\w+?)_([\w]+?)_key"/);
  if (!match) return null;

  const [, table, column] = match;
  const resource = RESOURCE_NAMES[table] ?? table;
  const field = FIELD_NAMES[column] ?? column;

  return `A ${resource} with that ${field} already exists.`;
}

/**
 * Transform a raw error message into a user-friendly string.
 * Returns the original message if no transformation applies.
 */
export function toFriendlyError(message: string): string {
  return (
    friendlyUniqueConstraintMessage(message) ||
    message ||
    "An unexpected error occurred."
  );
}
