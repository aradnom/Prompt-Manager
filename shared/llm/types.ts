export type OutputStyle = "t5" | "clip" | null;

export type LLMOperation =
  | "more-descriptive"
  | "less-descriptive"
  | "variation-slight"
  | "variation-fair"
  | "variation-very"
  | "explore"
  | "generate"
  | "generate-wildcard"
  | "auto-label";
