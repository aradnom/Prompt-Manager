import { LLMConfig } from "@server/config";
import { TransformRequest, TransformResponse } from "./llm-service";
import { processLLMResponse } from "@shared/llm/response-parser";
import { getModelInfo, getClosestThinkingLevel } from "@shared/llm/model-info";
import type { ThinkingLevel as AppThinkingLevel } from "@shared/llm/types";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// Map our thinking levels to Google's ThinkingLevel for Gemini 3 Flash
const FLASH_THINKING_LEVELS: Record<AppThinkingLevel, ThinkingLevel> = {
  low: ThinkingLevel.MINIMAL,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

// Map our thinking levels to Google's ThinkingLevel for Gemini 3 Pro
const PRO_THINKING_LEVELS: Record<AppThinkingLevel, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.LOW, // Pro doesn't have medium, fall back to low
  high: ThinkingLevel.HIGH,
};

// Map our thinking levels to budget tokens for Gemini 2.5 models
const THINKING_BUDGETS: Record<AppThinkingLevel, number> = {
  low: 1024,
  medium: 8192,
  high: 32768,
};

export class VertexServiceGenAI {
  private client: GoogleGenAI | null = null;

  constructor(private config: LLMConfig) {
    if (this.config.vertex.apiKey) {
      console.debug("Initializing Vertex AI (GenAI SDK) with API Key");
      try {
        // Casting to any because 'vertexai' and 'apiVersion' might not be in the public types yet
        // but are required for this specific auth flow to work.
        this.client = new GoogleGenAI({
          apiKey: this.config.vertex.apiKey,
          // This HAS TO BE lowercase 'vertexai', 'vertexAI' or anything else
          // will not work, I don't care what the package types or the docs say
          vertexai: true,
          apiVersion: "v1",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        console.debug("✓ GoogleGenAI client initialized");
      } catch (e) {
        console.error("Failed to initialize GenAI client:", e);
      }
    } else {
      console.warn("Vertex AI API key is missing. SDK initialization skipped.");
    }
  }

  async transform(
    request: TransformRequest,
    systemPrompt: string,
    userApiKey?: string,
    userModel?: string,
  ): Promise<TransformResponse> {
    // Use user's API key if provided, otherwise use server client
    let clientToUse: GoogleGenAI | null = this.client;

    if (userApiKey) {
      console.debug("Using user-provided Vertex AI API key");
      try {
        clientToUse = new GoogleGenAI({
          apiKey: userApiKey,
          vertexai: true,
          apiVersion: "v1",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      } catch (error) {
        console.error(
          "Failed to initialize GenAI client with user API key:",
          error,
        );
        throw new Error("Failed to initialize with user API key");
      }
    }

    if (!clientToUse) {
      throw new Error("Vertex AI (GenAI SDK) is not configured");
    }

    // Use user's model if provided, otherwise use server config model
    const modelId = userModel || this.config.vertex.model;
    const modelInfo = getModelInfo("vertex", modelId);

    // Build thinking config (only if enabled and model supports it)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thinkingConfig: any = { includeThoughts: false };
    let thinkingDescription = "off";

    if (request.thinking?.enabled && modelInfo?.hasThinking) {
      const level = request.thinking.level || "low";
      const effectiveLevel = getClosestThinkingLevel("vertex", modelId, level);

      if (modelId.includes("3-flash")) {
        // Gemini 3 Flash uses MINIMAL, MEDIUM, HIGH
        thinkingConfig.thinkingLevel =
          FLASH_THINKING_LEVELS[effectiveLevel || "low"];
        thinkingDescription = `level=${effectiveLevel}`;
      } else if (modelId.includes("3-pro")) {
        // Gemini 3 Pro uses LOW, HIGH
        thinkingConfig.thinkingLevel =
          PRO_THINKING_LEVELS[effectiveLevel || "low"];
        thinkingDescription = `level=${effectiveLevel}`;
      } else if (modelId.includes("2.5")) {
        // Gemini 2.5 uses budget_tokens
        thinkingConfig.thinkingBudget =
          THINKING_BUDGETS[effectiveLevel || "low"];
        thinkingDescription = `budget=${thinkingConfig.thinkingBudget}`;
      }
    }

    try {
      console.debug(
        `GenAI SDK: Generating content with model: ${modelId}, thinking: ${thinkingDescription}`,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestParams: any = {
        model: modelId,
        contents: [{ role: "user", parts: [{ text: request.text }] }],
        config: {
          systemInstruction: systemPrompt,
          generationConfig: {
            maxOutputTokens: this.config.maxTokens,
            temperature: 0.7,
          },
          thinkingConfig,
        },
      };

      const response = await clientToUse.models.generateContent(requestParams);

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("No response from Vertex AI (GenAI SDK)");
      }

      return {
        result: processLLMResponse(text, request.operation),
        target: "vertex",
      };
    } catch (error: unknown) {
      // Log only diagnostic fields — SDK errors embed the full request body
      // (including user prompt text) and must not be serialized wholesale.
      if (error && typeof error === "object") {
        const e = error as Record<string, unknown>;
        console.error("GenAI SDK Error:", {
          name: e.name,
          status: e.status,
          code: e.code,
          message: e.message,
        });
      }

      if (error instanceof Error) {
        throw new Error(
          `Vertex AI (GenAI SDK) request failed: ${error.message}`,
        );
      }
      throw new Error(
        "Vertex AI (GenAI SDK) request failed with unknown error",
      );
    }
  }
}
