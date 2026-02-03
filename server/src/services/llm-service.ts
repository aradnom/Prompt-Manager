import { LLMConfig, type LLMTarget } from "@server/config";
import { VertexServiceGenAI } from "./vertex-service-genai";
import { OpenAIService } from "./openai-service";
import { AnthropicService } from "./anthropic-service";
import { LMStudioService } from "./lm-studio-service";
import { GrokService } from "./grok-service";
import { buildSystemPrompt } from "@shared/llm/prompts";
import type { OutputStyle, LLMOperation } from "@shared/llm/types";
import { appendWildcardsToResult } from "@shared/llm/response-parser";

export type { LLMTarget } from "@server/config";
export type { OutputStyle, LLMOperation } from "@shared/llm/types";

export interface TransformRequest {
  text: string;
  operation: LLMOperation;
  target: LLMTarget;
  style?: OutputStyle;
  wildcards?: string[];
}

export interface TransformResponse {
  result: string | string[];
  target: LLMTarget;
}

export class LLMService {
  private vertexService: VertexServiceGenAI;
  private openaiService: OpenAIService;
  private anthropicService: AnthropicService;
  private lmStudioService: LMStudioService;
  private grokService: GrokService;

  constructor(private config: LLMConfig) {
    this.vertexService = new VertexServiceGenAI(config);
    this.openaiService = new OpenAIService(config);
    this.anthropicService = new AnthropicService(config);
    this.lmStudioService = new LMStudioService(config);
    this.grokService = new GrokService(config);
  }

  async transform(
    request: TransformRequest,
    userApiKey?: string,
    userModel?: string,
  ): Promise<TransformResponse> {
    // Validate target is allowed
    if (!this.config.allowedTargets.has(request.target)) {
      throw new Error(`LLM target '${request.target}' is not enabled`);
    }

    const handlers = {
      "lm-studio": this.lmStudioService,
      vertex: this.vertexService,
      openai: this.openaiService,
      anthropic: this.anthropicService,
      grok: this.grokService,
    };

    // Route to appropriate handler
    let response: TransformResponse;
    if (request.target === "lm-studio") {
      response = await this.lmStudioService.transform(
        request,
        buildSystemPrompt(request.operation, request.text, request.style),
      );
    } else {
      response = await handlers[request.target].transform(
        request,
        buildSystemPrompt(request.operation, request.text, request.style),
        userApiKey,
        userModel,
      );
    }

    // Append wildcards for operations that preserve them
    response.result = appendWildcardsToResult(
      response.result,
      request.operation,
      request.wildcards,
    );

    return response;
  }
}
