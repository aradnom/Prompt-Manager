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
  // TODO
} as const;
