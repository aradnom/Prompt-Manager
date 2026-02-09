export type OutputStyle = "t5" | "clip" | null;

export type ThinkingLevel = "low" | "medium" | "high";

export interface ThinkingConfig {
  /** Whether thinking/reasoning is enabled */
  enabled: boolean;
  /** Thinking level - defaults to 'low' if enabled but not specified */
  level?: ThinkingLevel;
}

export type LLMOperation =
  | "more-descriptive"
  | "less-descriptive"
  | "variation-slight"
  | "variation-fair"
  | "variation-very"
  | "explore"
  | "generate"
  | "generate-wildcard"
  | "auto-label"
  | "enrich";
