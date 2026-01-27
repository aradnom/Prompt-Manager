import { LLMConfig } from "@server/config";
import { TransformRequest, TransformResponse } from "./llm-service";
import Anthropic from "@anthropic-ai/sdk";

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

    try {
      console.debug(`Anthropic: Generating content with model: ${modelId}`);

      const response = await clientToUse.messages.create({
        model: modelId,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: request.text }],
      });

      const text =
        response.content[0]?.type === "text"
          ? response.content[0].text
          : undefined;

      if (!text) {
        throw new Error("No response from Anthropic");
      }

      // For explore and generate operations, parse the numbered list into an array
      if (
        request.operation === "explore" ||
        request.operation === "generate" ||
        request.operation === "generate-wildcard"
      ) {
        const lines = text.trim().split("\n");
        const variations = lines
          .map((line: string) => line.replace(/^\d+\.\s*/, "").trim())
          .filter((line: string) => line.length > 0);

        return {
          result: variations,
          target: "anthropic",
        };
      }

      return {
        result: text.trim(),
        target: "anthropic",
      };
    } catch (error: unknown) {
      if (error && typeof error === "object" && "message" in error) {
        console.error("Anthropic Error:", JSON.stringify(error, null, 2));
      }

      if (error instanceof Error) {
        throw new Error(`Anthropic request failed: ${error.message}`);
      }
      throw new Error("Anthropic request failed with unknown error");
    }
  }
}
