import { LLMConfig } from "@server/config";
import { TransformRequest, TransformResponse } from "./llm-service";
import { processLLMResponse } from "@shared/llm/response-parser";
import { getModelInfo, getClosestThinkingLevel } from "@shared/llm/model-info";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";

export class GrokService {
  private client: OpenAI | null = null;

  constructor(private config: LLMConfig) {
    if (this.config.grok.apiKey) {
      console.debug("Initializing Grok client with API Key");
      try {
        this.client = new OpenAI({
          apiKey: this.config.grok.apiKey,
          baseURL: "https://api.x.ai/v1",
        });
        console.debug("✓ Grok client initialized");
      } catch (e) {
        console.error("Failed to initialize Grok client:", e);
      }
    } else {
      console.warn("Grok API key is missing. SDK initialization skipped.");
    }
  }

  async transform(
    request: TransformRequest,
    systemPrompt: string,
    userApiKey?: string,
    userModel?: string,
  ): Promise<TransformResponse> {
    // Use user's API key if provided, otherwise use server client
    let clientToUse: OpenAI | null = this.client;

    if (userApiKey) {
      console.debug("Using user-provided Grok API key");
      try {
        clientToUse = new OpenAI({
          apiKey: userApiKey,
          baseURL: "https://api.x.ai/v1",
        });
      } catch (error) {
        console.error(
          "Failed to initialize Grok client with user API key:",
          error,
        );
        throw new Error("Failed to initialize with user API key");
      }
    }

    if (!clientToUse) {
      throw new Error("Grok is not configured");
    }

    // Use user's model if provided, otherwise use server config model
    const modelId = userModel || this.config.grok.model;
    const modelInfo = getModelInfo("grok", modelId);

    // Determine reasoning effort based on thinking config (only if enabled and model supports it)
    // Grok uses reasoning_effort like OpenAI: "low", "high"
    let reasoningEffort: ReasoningEffort | undefined;
    if (request.thinking?.enabled && modelInfo?.hasThinking) {
      const level = request.thinking.level || "low";
      const effectiveLevel = getClosestThinkingLevel("grok", modelId, level);
      reasoningEffort = (effectiveLevel || "low") as ReasoningEffort;
    }

    try {
      console.debug(
        `Grok: Generating content with model: ${modelId}, reasoning: ${reasoningEffort || "off"}`,
      );

      // Build request params
      const requestParams: ChatCompletionCreateParamsNonStreaming = {
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.text },
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.7,
        ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
      };

      const response = await clientToUse.chat.completions.create(requestParams);

      const text = response.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("No response from Grok");
      }

      return {
        result: processLLMResponse(text, request.operation),
        target: "grok",
      };
    } catch (error: unknown) {
      // Log only diagnostic fields — SDK errors embed the full request body
      // (including user prompt text) and must not be serialized wholesale.
      if (error && typeof error === "object") {
        const e = error as Record<string, unknown>;
        console.error("Grok Error:", {
          name: e.name,
          status: e.status,
          type: e.type,
          code: e.code,
          message: e.message,
        });
      }

      if (error instanceof Error) {
        throw new Error(`Grok request failed: ${error.message}`);
      }
      throw new Error("Grok request failed with unknown error");
    }
  }
}
