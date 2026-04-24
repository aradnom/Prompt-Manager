import { LLMConfig } from "@server/config";
import { TransformRequest, TransformResponse } from "./llm-service";
import { processLLMResponse } from "@shared/llm/response-parser";
import { getModelInfo, getClosestThinkingLevel } from "@shared/llm/model-info";
import type { ThinkingLevel } from "@shared/llm/types";
import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageCreateParamsNonStreaming,
  ThinkingConfigParam,
} from "@anthropic-ai/sdk/resources/messages";

// Map our thinking levels to Anthropic budget_tokens
// Anthropic minimum is 1024
const THINKING_BUDGETS: Record<ThinkingLevel, number> = {
  low: 1024,
  medium: 8192,
  high: 32768,
};

export class AnthropicService {
  private client: Anthropic | null = null;

  constructor(private config: LLMConfig) {
    if (this.config.anthropic.apiKey) {
      console.debug("Initializing Anthropic client with API Key");
      try {
        this.client = new Anthropic({
          apiKey: this.config.anthropic.apiKey,
        });
        console.debug("✓ Anthropic client initialized");
      } catch (e) {
        console.error("Failed to initialize Anthropic client:", e);
      }
    } else {
      console.warn("Anthropic API key is missing. SDK initialization skipped.");
    }
  }

  async transform(
    request: TransformRequest,
    systemPrompt: string,
    userApiKey?: string,
    userModel?: string,
  ): Promise<TransformResponse> {
    // Use user's API key if provided, otherwise use server client
    let clientToUse: Anthropic | null = this.client;

    if (userApiKey) {
      console.debug("Using user-provided Anthropic API key");
      try {
        clientToUse = new Anthropic({
          apiKey: userApiKey,
        });
      } catch (error) {
        console.error(
          "Failed to initialize Anthropic client with user API key:",
          error,
        );
        throw new Error("Failed to initialize with user API key");
      }
    }

    if (!clientToUse) {
      throw new Error("Anthropic is not configured");
    }

    // Use user's model if provided, otherwise use server config model
    const modelId = userModel || this.config.anthropic.model;
    const modelInfo = getModelInfo("anthropic", modelId);

    // Build thinking config for Anthropic (only if enabled and model supports it)
    // Anthropic uses: thinking: { type: "enabled", budget_tokens: number }
    let thinkingConfig: ThinkingConfigParam | undefined;
    if (request.thinking?.enabled && modelInfo?.hasThinking) {
      const level = request.thinking.level || "low";
      const effectiveLevel = getClosestThinkingLevel(
        "anthropic",
        modelId,
        level,
      );
      thinkingConfig = {
        type: "enabled",
        budget_tokens: THINKING_BUDGETS[effectiveLevel || "low"],
      };
    }

    try {
      console.debug(
        `Anthropic: Generating content with model: ${modelId}, thinking: ${thinkingConfig ? `enabled (${request.thinking?.level || "low"})` : "off"}`,
      );

      // Build request params
      const requestParams: MessageCreateParamsNonStreaming = {
        model: modelId,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: request.text }],
        ...(thinkingConfig && { thinking: thinkingConfig }),
      };

      const response = await clientToUse.messages.create(requestParams);

      // Filter out thinking blocks from response, only get text content
      const textContent = response.content.find(
        (block) => block.type === "text",
      );
      const text = textContent?.type === "text" ? textContent.text : undefined;

      if (!text) {
        throw new Error("No response from Anthropic");
      }

      return {
        result: processLLMResponse(text, request.operation),
        target: "anthropic",
      };
    } catch (error: unknown) {
      // Log only diagnostic fields — SDK errors embed the full request body
      // (including user prompt text) and must not be serialized wholesale.
      if (error && typeof error === "object") {
        const e = error as Record<string, unknown>;
        console.error("Anthropic Error:", {
          name: e.name,
          status: e.status,
          type: e.type,
          message: e.message,
        });
      }

      if (error instanceof Error) {
        throw new Error(`Anthropic request failed: ${error.message}`);
      }
      throw new Error("Anthropic request failed with unknown error");
    }
  }
}
