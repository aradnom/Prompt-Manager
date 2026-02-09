import { describe, it, expect, beforeAll } from "vitest";
import { config as dotenvConfig } from "dotenv";
import { MODELS } from "../../shared/llm/model-info";
import { OpenAIService } from "../src/services/openai-service";
import { AnthropicService } from "../src/services/anthropic-service";
import { VertexServiceGenAI } from "../src/services/vertex-service-genai";
import { GrokService } from "../src/services/grok-service";
import type { LLMConfig } from "../src/config";
import type { TransformRequest } from "../src/services/llm-service";

// Load environment variables
dotenvConfig();

// Filter options from environment
// TEST_PROVIDER: only test this provider (vertex, openai, anthropic, grok)
// TEST_MODEL: only test this specific model ID
// TEST_THINKING: set to "true" to enable thinking/reasoning
// TEST_THINKING_LEVEL: "low", "medium", or "high" (defaults to "low")
const TEST_PROVIDER = process.env.TEST_PROVIDER?.toLowerCase();
const TEST_MODEL = process.env.TEST_MODEL;
const TEST_THINKING = process.env.TEST_THINKING?.toLowerCase() === "true";
const TEST_THINKING_LEVEL = (process.env.TEST_THINKING_LEVEL?.toLowerCase() ||
  "low") as "low" | "medium" | "high";

// Simple test prompt - just needs to return something
const TEST_PROMPT = "Say hello in exactly 3 words.";
const SYSTEM_PROMPT = "You are a helpful assistant. Respond concisely.";

// Timeout for API calls
const API_TIMEOUT = 60000;

// Helper to check if a provider should be tested
function shouldTestProvider(provider: string): boolean {
  if (!TEST_PROVIDER) return true;
  return TEST_PROVIDER === provider.toLowerCase();
}

// Helper to check if a model should be tested
function shouldTestModel(modelId: string): boolean {
  if (!TEST_MODEL) return true;
  return TEST_MODEL === modelId;
}

// Create a minimal config for testing
function createTestConfig(): LLMConfig {
  return {
    allowedTargets: new Set(["openai", "anthropic", "vertex", "grok"]),
    lmStudioUrl: "",
    // When thinking is enabled, need more tokens (Anthropic requires max_tokens > budget_tokens)
    maxTokens: TEST_THINKING ? 2048 : 100,
    vertex: {
      projectId: process.env.VERTEX_PROJECT_ID || "",
      location: process.env.VERTEX_LOCATION || "us-central1",
      model: "gemini-2.5-flash",
      apiKey: process.env.VERTEX_API_KEY,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-5-nano",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-haiku-4-5",
    },
    grok: {
      apiKey: process.env.GROK_API_KEY,
      model: "grok-3-mini",
    },
  };
}

// Services will be initialized before tests
let openaiService: OpenAIService;
let anthropicService: AnthropicService;
let vertexService: VertexServiceGenAI;
let grokService: GrokService;
let config: LLMConfig;

beforeAll(() => {
  config = createTestConfig();
  openaiService = new OpenAIService(config);
  anthropicService = new AnthropicService(config);
  vertexService = new VertexServiceGenAI(config);
  grokService = new GrokService(config);

  // Log thinking config
  if (TEST_THINKING) {
    console.log(`\n  Thinking: enabled (level: ${TEST_THINKING_LEVEL})\n`);
  }
});

// Helper to create a test request
function createTestRequest(
  operation: string = "variation-slight",
): TransformRequest {
  return {
    text: TEST_PROMPT,
    operation: operation as TransformRequest["operation"],
    target: "openai", // This is just for the type, actual target is determined by service
    ...(TEST_THINKING && {
      thinking: {
        enabled: true,
        level: TEST_THINKING_LEVEL,
      },
    }),
  };
}

describe("LLM Model Connectivity Tests", () => {
  describe.skipIf(!shouldTestProvider("vertex"))(
    "Vertex (Google) Models",
    () => {
      const models = MODELS.vertex;

      it.skipIf(!process.env.VERTEX_API_KEY)(
        "should have VERTEX_API_KEY configured",
        () => {
          expect(process.env.VERTEX_API_KEY).toBeDefined();
        },
      );

      for (const [modelId, modelInfo] of Object.entries(models)) {
        it.skipIf(!process.env.VERTEX_API_KEY || !shouldTestModel(modelId))(
          `${modelInfo.name} (${modelId}) - accepts request and returns output`,
          { timeout: API_TIMEOUT },
          async () => {
            const request = createTestRequest();
            const response = await vertexService.transform(
              request,
              SYSTEM_PROMPT,
              undefined,
              modelId,
            );

            expect(response).toBeDefined();
            expect(response.result).toBeDefined();
            expect(response.target).toBe("vertex");

            if (typeof response.result === "string") {
              expect(response.result.length).toBeGreaterThan(0);
            } else {
              expect(response.result.length).toBeGreaterThan(0);
            }

            console.log(
              `  ✓ ${modelInfo.name}: "${String(response.result).substring(0, 50)}..."`,
            );
          },
        );
      }
    },
  );

  describe.skipIf(!shouldTestProvider("openai"))("OpenAI Models", () => {
    const models = MODELS.openai;

    it.skipIf(!process.env.OPENAI_API_KEY)(
      "should have OPENAI_API_KEY configured",
      () => {
        expect(process.env.OPENAI_API_KEY).toBeDefined();
      },
    );

    for (const [modelId, modelInfo] of Object.entries(models)) {
      it.skipIf(!process.env.OPENAI_API_KEY || !shouldTestModel(modelId))(
        `${modelInfo.name} (${modelId}) - accepts request and returns output`,
        { timeout: API_TIMEOUT },
        async () => {
          const request = createTestRequest();
          const response = await openaiService.transform(
            request,
            SYSTEM_PROMPT,
            undefined,
            modelId,
          );

          expect(response).toBeDefined();
          expect(response.result).toBeDefined();
          expect(response.target).toBe("openai");

          if (typeof response.result === "string") {
            expect(response.result.length).toBeGreaterThan(0);
          } else {
            expect(response.result.length).toBeGreaterThan(0);
          }

          console.log(
            `  ✓ ${modelInfo.name}: "${String(response.result).substring(0, 50)}..."`,
          );
        },
      );
    }
  });

  describe.skipIf(!shouldTestProvider("anthropic"))("Anthropic Models", () => {
    const models = MODELS.anthropic;

    it.skipIf(!process.env.ANTHROPIC_API_KEY)(
      "should have ANTHROPIC_API_KEY configured",
      () => {
        expect(process.env.ANTHROPIC_API_KEY).toBeDefined();
      },
    );

    for (const [modelId, modelInfo] of Object.entries(models)) {
      it.skipIf(!process.env.ANTHROPIC_API_KEY || !shouldTestModel(modelId))(
        `${modelInfo.name} (${modelId}) - accepts request and returns output`,
        { timeout: API_TIMEOUT },
        async () => {
          const request = createTestRequest();
          const response = await anthropicService.transform(
            request,
            SYSTEM_PROMPT,
            undefined,
            modelId,
          );

          expect(response).toBeDefined();
          expect(response.result).toBeDefined();
          expect(response.target).toBe("anthropic");

          if (typeof response.result === "string") {
            expect(response.result.length).toBeGreaterThan(0);
          } else {
            expect(response.result.length).toBeGreaterThan(0);
          }

          console.log(
            `  ✓ ${modelInfo.name}: "${String(response.result).substring(0, 50)}..."`,
          );
        },
      );
    }
  });

  describe.skipIf(!shouldTestProvider("grok"))("Grok Models", () => {
    const models = MODELS.grok;

    it.skipIf(!process.env.GROK_API_KEY)(
      "should have GROK_API_KEY configured",
      () => {
        expect(process.env.GROK_API_KEY).toBeDefined();
      },
    );

    for (const [modelId, modelInfo] of Object.entries(models)) {
      it.skipIf(!process.env.GROK_API_KEY || !shouldTestModel(modelId))(
        `${modelInfo.name} (${modelId}) - accepts request and returns output`,
        { timeout: API_TIMEOUT },
        async () => {
          const request = createTestRequest();
          const response = await grokService.transform(
            request,
            SYSTEM_PROMPT,
            undefined,
            modelId,
          );

          expect(response).toBeDefined();
          expect(response.result).toBeDefined();
          expect(response.target).toBe("grok");

          if (typeof response.result === "string") {
            expect(response.result.length).toBeGreaterThan(0);
          } else {
            expect(response.result.length).toBeGreaterThan(0);
          }

          console.log(
            `  ✓ ${modelInfo.name}: "${String(response.result).substring(0, 50)}..."`,
          );
        },
      );
    }
  });
});
