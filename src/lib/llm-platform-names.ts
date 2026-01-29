// Maps LLM platform IDs to display names
export const LLM_PLATFORM_NAMES: Record<string, string> = {
  "transformers-js": "Transformers.js (Local)",
  "lm-studio": "LM Studio (Local)",
  vertex: "Google Vertex AI",
  openai: "OpenAI",
  anthropic: "Anthropic",
  grok: "Grok",
} as const;

export function getPlatformDisplayName(platformId: string): string {
  return LLM_PLATFORM_NAMES[platformId] || platformId;
}
