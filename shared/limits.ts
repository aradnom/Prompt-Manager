// ---------------------------------------------------------------------------
// Rate limits (requests per window)
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  /** LLM transform — each call hits an external API and costs money */
  llmTransform: { windowMs: 60_000, maxRequests: 20 },

  /** General write operations (create, duplicate, etc.) */
  mutation: { windowMs: 60_000, maxRequests: 30 },
} as const;

// ---------------------------------------------------------------------------
// Content length limits
// ---------------------------------------------------------------------------

export const LENGTH_LIMITS = {
  /** varchar(255) fields: entity names, displayIds, uuids */
  name: 255,
  displayId: 255,

  /** varchar(512) fields: folder descriptions */
  folderDescription: 512,

  /** varchar(4000) fields: notes */
  notes: 4000,

  /** varchar(50) fields: wildcard format */
  wildcardFormat: 50,

  /** Search query strings */
  searchQuery: 500,

  /** Single block text content */
  blockText: 250_000,

  /** Total prompt rendered content / snapshot content */
  renderedContent: 1_000_000,

  /** Wildcard file content */
  wildcardContent: 1_000_000,

  /** Scratchpad content */
  scratchpad: 250_000,

  /** Text sent to LLM transform */
  llmText: 25_000,

  /** Max block IDs in a stack or template */
  blockIds: 500,

  /** Max labels on a block */
  labels: 100,

  /** Max wildcard entries passed to LLM transform */
  llmWildcards: 200,
} as const;
