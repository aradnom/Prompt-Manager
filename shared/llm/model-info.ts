export type ThinkingLevel = "low" | "medium" | "high";

export interface ModelInfo {
  /** Display name for the model */
  name: string;
  /** Whether this model supports thinking/reasoning */
  hasThinking?: boolean;
  /** Supported thinking levels for this model */
  thinkingLevels?: ThinkingLevel[];
}

export type ModelRegistry = Record<string, ModelInfo>;

export const MODELS: Record<string, ModelRegistry> = {
  vertex: {
    "gemini-3.1-flash-lite-preview": {
      name: "Gemini 3.1 Flash Lite Preview",
      hasThinking: true,
      // MINIMAL and MEDIUM only for Flash, mapping: low->MINIMAL, medium->MEDIUM, high->HIGH
      thinkingLevels: ["low", "medium", "high"],
    },
    "gemini-3.1-pro-preview": {
      name: "Gemini 3.1 Pro Preview",
      hasThinking: true,
      thinkingLevels: ["low", "high"],
    },
    "gemini-3-flash-preview": {
      name: "Gemini 3 Flash Preview",
      hasThinking: true,
      // MINIMAL and MEDIUM only for Flash, mapping: low->MINIMAL, medium->MEDIUM, high->HIGH
      thinkingLevels: ["low", "medium", "high"],
    },
    "gemini-3-pro-preview": {
      name: "Gemini 3 Pro Preview",
      hasThinking: true,
      thinkingLevels: ["low", "high"],
    },
    "gemini-2.5-flash": {
      name: "Gemini 2.5 Flash",
      hasThinking: true,
      // 2.5 models only support budget, not levels - we'll map to budget internally
      thinkingLevels: ["low", "medium", "high"],
    },
    "gemini-2.5-flash-lite": {
      name: "Gemini 2.5 Flash Lite",
      // Lite model likely doesn't support thinking
      hasThinking: false,
    },
    "gemini-2.5-pro": {
      name: "Gemini 2.5 Pro",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
  },
  openai: {
    "gpt-5.4-nano": {
      name: "GPT 5.4 Nano",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "gpt-5.4-mini": {
      name: "GPT 5.4 Mini",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "gpt-5.4": {
      name: "GPT 5.4",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "gpt-5.2": {
      name: "GPT 5.2",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "gpt-5-nano": {
      name: "GPT 5 Nano",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "gpt-5-mini": {
      name: "GPT 5 Mini",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "gpt-4.1": {
      name: "GPT 4.1",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
  },
  anthropic: {
    "claude-opus-4-7": {
      name: "Claude 4.7 Opus",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "claude-sonnet-4-6": {
      name: "Claude 4.6 Sonnet",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "claude-opus-4-6": {
      name: "Claude 4.6 Opus",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "claude-haiku-4-5": {
      name: "Claude 4.5 Haiku",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "claude-sonnet-4-5": {
      name: "Claude 4.5 Sonnet",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "claude-opus-4-5": {
      name: "Claude 4.5 Opus",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "claude-opus-4-1": {
      name: "Claude 4.1 Opus",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
    "claude-sonnet-4-0": {
      name: "Claude 4 Sonnet",
      hasThinking: true,
      thinkingLevels: ["low", "medium", "high"],
    },
  },
  grok: {
    "grok-4.20-0309-non-reasoning": {
      name: "Grok 4.2 Non-Reasoning",
      hasThinking: false,
    },
    "grok-4.20-0309-reasoning": {
      name: "Grok 4.2",
      hasThinking: false,
    },
    "grok-4-1-fast-non-reasoning": {
      name: "Grok 4.1 Fast Non-Reasoning",
      hasThinking: false,
    },
    "grok-4-1-fast-reasoning": {
      name: "Grok 4.1 Fast",
      hasThinking: false,
    },
    "grok-4-fast-non-reasoning": {
      name: "Grok 4 Fast Non-Reasoning",
      hasThinking: false,
    },
    "grok-4-fast-reasoning": {
      name: "Grok 4 Fast",
      hasThinking: false,
    },
    "grok-3-mini": {
      name: "Grok 3 Mini",
      hasThinking: true,
      thinkingLevels: ["low", "high"],
    },
    "grok-3": {
      name: "Grok 3",
      hasThinking: false,
    },
  },
} as const;

// Helper to get model info
export function getModelInfo(
  provider: string,
  modelId: string,
): ModelInfo | undefined {
  return MODELS[provider]?.[modelId];
}

// Helper to check if a model supports a specific thinking level
export function supportsThinkingLevel(
  provider: string,
  modelId: string,
  level: ThinkingLevel,
): boolean {
  const info = getModelInfo(provider, modelId);
  if (!info?.hasThinking || !info.thinkingLevels) return false;
  return info.thinkingLevels.includes(level);
}

// Helper to get the closest supported thinking level
export function getClosestThinkingLevel(
  provider: string,
  modelId: string,
  requestedLevel: ThinkingLevel,
): ThinkingLevel | undefined {
  const info = getModelInfo(provider, modelId);
  if (!info?.hasThinking || !info.thinkingLevels) return undefined;

  if (info.thinkingLevels.includes(requestedLevel)) {
    return requestedLevel;
  }

  // Fall back to closest level
  const levelOrder: ThinkingLevel[] = ["low", "medium", "high"];
  const requestedIndex = levelOrder.indexOf(requestedLevel);

  // Try lower levels first, then higher
  for (let i = requestedIndex - 1; i >= 0; i--) {
    if (info.thinkingLevels.includes(levelOrder[i])) {
      return levelOrder[i];
    }
  }
  for (let i = requestedIndex + 1; i < levelOrder.length; i++) {
    if (info.thinkingLevels.includes(levelOrder[i])) {
      return levelOrder[i];
    }
  }

  return info.thinkingLevels[0];
}
