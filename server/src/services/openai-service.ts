import { LLMConfig } from "@server/config";
import { TransformRequest, TransformResponse } from "./llm-service";
import { processLLMResponse } from "@shared/llm/response-parser";
import OpenAI from "openai";

export class OpenAIService {
  private client: OpenAI | null = null;

  constructor(private config: LLMConfig) {
    if (this.config.openai.apiKey) {
      console.debug("Initializing OpenAI client with API Key");
      try {
        this.client = new OpenAI({
          apiKey: this.config.openai.apiKey,
        });
        console.debug("✓ OpenAI client initialized");
      } catch (e) {
        console.error("Failed to initialize OpenAI client:", e);
      }
    } else {
      console.warn("OpenAI API key is missing. SDK initialization skipped.");
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
      console.debug("Using user-provided OpenAI API key");
      try {
        clientToUse = new OpenAI({
          apiKey: userApiKey,
        });
      } catch (error) {
        console.error(
          "Failed to initialize OpenAI client with user API key:",
          error,
        );
        throw new Error("Failed to initialize with user API key");
      }
    }

    if (!clientToUse) {
      throw new Error("OpenAI is not configured");
    }

    // Use user's model if provided, otherwise use server config model
    const modelId = userModel || this.config.openai.model;

    // Args that only work with specific models
    let modelSpecificArgs = {};

    if (modelId.startsWith("gpt-5.2")) {
      modelSpecificArgs = {
        temperature: 1,
        reasoning_effort: "none",
      };
    }

    try {
      console.debug(`OpenAI: Generating content with model: ${modelId}`);

      // Build request parameters
      const requestParams: any = {
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.text },
        ],
        max_completion_tokens: this.config.maxTokens,
        reasoning_effort: "minimal",
        ...modelSpecificArgs,
      };

      if (modelId.startsWith("gpt-4")) {
        delete requestParams.reasoning_effort;
      }

      // Only set temperature for models that support it (GPT-5 models don't support custom temperature)
      if (!modelId.startsWith("gpt-5")) {
        requestParams.temperature = 0.7;
      }

      const response = await clientToUse.chat.completions.create(requestParams);

      const text = response.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("No response from OpenAI");
      }

      return {
        result: processLLMResponse(text, request.operation),
        target: "openai",
      };
    } catch (error: unknown) {
      if (error && typeof error === "object" && "message" in error) {
        console.error("OpenAI Error:", JSON.stringify(error, null, 2));
      }

      if (error instanceof Error) {
        throw new Error(`OpenAI request failed: ${error.message}`);
      }
      throw new Error("OpenAI request failed with unknown error");
    }
  }
}
