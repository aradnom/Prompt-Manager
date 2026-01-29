import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useRef,
} from "react";
import { useLLMStatus } from "./LLMStatusContext";
import { buildSystemPrompt } from "@shared/llm/prompts";
import { processLLMResponse } from "@shared/llm/response-parser";
import type { LLMOperation, OutputStyle } from "@shared/llm/types";

// Transformers.js types
interface ChatMessage {
  role: string;
  content: string;
}

interface GenerationOptions {
  max_new_tokens?: number;
  temperature?: number;
  do_sample?: boolean;
}

interface GenerationOutput {
  generated_text: string | ChatMessage[];
}

interface PipelineOptions {
  dtype?: string;
  device?: string;
}

interface Pipeline {
  (
    input: string | string[] | ChatMessage[],
    options?: GenerationOptions,
  ): Promise<GenerationOutput[]>;
  dispose?: () => Promise<void>;
}

interface TransformersModule {
  pipeline: (
    task: string,
    model: string,
    options?: PipelineOptions,
  ) => Promise<Pipeline>;
  env: {
    allowLocalModels: boolean;
    allowRemoteModels: boolean;
  };
}

interface TransformRequest {
  text: string;
  operation: LLMOperation;
  style?: OutputStyle;
}

interface TransformResponse {
  result: string | string[];
  target: string;
}

interface ClientLLMContextType {
  // Transform text using client-side LLM
  transform: (request: TransformRequest) => Promise<TransformResponse>;

  // Status
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
}

const ClientLLMContext = createContext<ClientLLMContextType | null>(null);

interface ClientLLMProviderProps {
  children: ReactNode;
}

export function ClientLLMProvider({ children }: ClientLLMProviderProps) {
  const { activeTarget } = useLLMStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pipelineRef = useRef<Pipeline | null>(null);
  const transformersRef = useRef<TransformersModule | null>(null);

  // Initialize Transformers.js when it becomes the active target
  useEffect(() => {
    // Don't do anything if activeTarget is not yet initialized
    if (!activeTarget || activeTarget !== "transformers-js") {
      // Clean up if switching away from transformers-js
      if (pipelineRef.current?.dispose) {
        pipelineRef.current.dispose();
        pipelineRef.current = null;
      }
      setIsReady(false);
      return;
    }

    // Don't initialize if already ready
    if (isReady && pipelineRef.current) {
      return;
    }

    const initTransformers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log("Loading Transformers.js...");

        // Dynamically import transformers.js
        const { pipeline, env } =
          (await import("@huggingface/transformers")) as TransformersModule;

        transformersRef.current = { pipeline, env };

        // Allow both local and remote models
        env.allowLocalModels = false;
        env.allowRemoteModels = true;

        // console.log("Loading model: onnx-community/Qwen3-0.6B-ONNX (int8)...");

        // Load the text-generation pipeline with the specific model
        const textGenerator = await pipeline(
          "text-generation",
          "onnx-community/Llama-3.2-1B-Instruct-ONNX",
          // "onnx-community/Qwen3-0.6B-ONNX",
          {
            dtype: "q4f16",
            // dtype: "int8",
            device: "webgpu",
          },
        );

        pipelineRef.current = textGenerator;
        setIsReady(true);

        console.log("✓ Transformers.js model loaded and ready");
      } catch (err) {
        console.error("Failed to initialize Transformers.js:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to initialize Transformers.js",
        );
        setIsReady(false);
      } finally {
        setIsLoading(false);
      }
    };

    initTransformers();
  }, [activeTarget, isReady]);

  const transform = async (
    request: TransformRequest,
  ): Promise<TransformResponse> => {
    // Route to appropriate handler based on active target
    if (activeTarget === "transformers-js") {
      return transformWithTransformersJS(request);
    } else if (activeTarget === "lm-studio") {
      return transformWithLMStudio(request);
    }

    throw new Error(
      `Client-side transform not supported for target: ${activeTarget}`,
    );
  };

  const transformWithTransformersJS = async (
    request: TransformRequest,
  ): Promise<TransformResponse> => {
    if (!pipelineRef.current) {
      throw new Error("Transformers.js is not initialized");
    }

    if (!isReady) {
      throw new Error("Transformers.js is still loading");
    }

    try {
      const systemPrompt = buildSystemPrompt(
        request.operation,
        request.text,
        request.style,
      );

      // Use chat message format for proper instruction-following
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: request.text },
      ];

      // Generate text using chat template
      const result = await pipelineRef.current(messages, {
        max_new_tokens: 512,
        temperature: 0.7,
        do_sample: true,
      });

      // Extract the assistant's response from the chat output
      let generatedText = "";
      const output = result[0]?.generated_text;
      if (!output) {
        throw new Error("Unexpected response format from Transformers.js");
      }

      if (Array.isArray(output)) {
        // The output is an array of messages; grab the last assistant message
        const assistantMsg = output.findLast((msg) => msg.role === "assistant");
        generatedText = assistantMsg?.content || "";
      } else {
        generatedText = output;
      }

      // Strip <think>...</think> tags (reasoning model artifacts)
      generatedText = generatedText
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .trim();

      return {
        result: processLLMResponse(generatedText, request.operation),
        target: "transformers-js",
      };
    } catch (err) {
      console.error("Transformers.js generation failed:", err);
      throw new Error(
        `Transformers.js generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const transformWithLMStudio = async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: TransformRequest,
  ): Promise<TransformResponse> => {
    // TODO: Implement LM Studio client-side fetch
    // Will need to get the LM Studio URL from user settings
    throw new Error("LM Studio client-side transform not yet implemented");
  };

  return (
    <ClientLLMContext.Provider
      value={{
        transform,
        isLoading,
        isReady,
        error,
      }}
    >
      {children}
    </ClientLLMContext.Provider>
  );
}

export function useClientLLM() {
  const context = useContext(ClientLLMContext);
  if (!context) {
    throw new Error("useClientLLM must be used within ClientLLMProvider");
  }
  return context;
}
