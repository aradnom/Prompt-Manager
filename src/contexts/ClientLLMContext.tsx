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
import { storage } from "@/lib/storage";

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

interface ProgressEvent {
  status: "initiate" | "download" | "progress" | "done" | "ready";
  file?: string;
  progress?: number;
}

interface PipelineOptions {
  dtype?: string;
  device?: string;
  progress_callback?: (event: ProgressEvent) => void;
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

  // LM Studio URL config
  lmStudioUrl: string;
  setLMStudioUrl: (url: string) => Promise<void>;

  // LM Studio CORS error state
  lmStudioCorsError: boolean;
  clearLmStudioCorsError: () => void;

  // Status
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  loadProgress: number | null; // 0-100 during model load, null otherwise
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
  const [lmStudioUrl, setLmStudioUrlState] = useState(
    storage.DEFAULT_LM_STUDIO_URL,
  );
  const [lmStudioCorsError, setLmStudioCorsError] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);

  const pipelineRef = useRef<Pipeline | null>(null);
  const transformersRef = useRef<TransformersModule | null>(null);
  const fileProgressRef = useRef<Record<string, number>>({});

  // Load LM Studio URL from storage on mount
  useEffect(() => {
    storage.getLMStudioUrl().then(setLmStudioUrlState);
  }, []);

  const setLMStudioUrl = async (url: string) => {
    setLmStudioUrlState(url);
    await storage.setLMStudioUrl(url);
  };

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
      setLoadProgress(0);
      fileProgressRef.current = {};

      try {
        console.debug("Loading Transformers.js...");

        // Dynamically import transformers.js
        const { pipeline, env } =
          (await import("@huggingface/transformers")) as TransformersModule;

        transformersRef.current = { pipeline, env };

        // Allow both local and remote models
        env.allowLocalModels = false;
        env.allowRemoteModels = true;

        // Use WebGPU if available (requires secure context), fall back to WASM
        const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
        const device = gpu ? "webgpu" : "wasm";
        const dtype = gpu ? "q4f16" : "q4";
        console.debug(`Using device: ${device}`);

        // Load the text-generation pipeline with the specific model
        const textGenerator = await pipeline(
          "text-generation",
          "onnx-community/Llama-3.2-1B-Instruct-ONNX",
          // "onnx-community/Qwen3-0.6B-ONNX",
          // "HuggingFaceTB/SmolLM2-360M-Instruct",
          {
            dtype,
            device,
            progress_callback: (event: ProgressEvent) => {
              if (event.status === "progress" && event.file != null) {
                fileProgressRef.current[event.file] = event.progress ?? 0;
                const files = Object.values(fileProgressRef.current);
                const overall = files.reduce((a, b) => a + b, 0) / files.length;
                setLoadProgress(overall);
              }
            },
          },
        );

        pipelineRef.current = textGenerator;
        setIsReady(true);
        setLoadProgress(null);

        console.debug("✓ Transformers.js model loaded and ready");
      } catch (err) {
        console.error("Failed to initialize Transformers.js:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to initialize Transformers.js",
        );
        setIsReady(false);
        setLoadProgress(null);
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
    request: TransformRequest,
  ): Promise<TransformResponse> => {
    try {
      const systemPrompt = buildSystemPrompt(
        request.operation,
        request.text,
        request.style,
      );

      const response = await fetch(`${lmStudioUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: request.text },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `LM Studio API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      let result = data.choices?.[0]?.message?.content;

      if (!result) {
        throw new Error("No response from LM Studio");
      }

      // Strip <think>...</think> tags (reasoning model artifacts)
      result = result.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      return {
        result: processLLMResponse(result, request.operation),
        target: "lm-studio",
      };
    } catch (err) {
      console.error("LM Studio generation failed:", err);

      // A TypeError with "Failed to fetch" is the browser's way of saying
      // the request was blocked — almost always CORS when targeting a local server.
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setLmStudioCorsError(true);
        throw new Error(
          "Could not reach LM Studio. This is likely a CORS issue — see the help page for how to fix it.",
        );
      }

      throw new Error(
        `LM Studio request failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  return (
    <ClientLLMContext.Provider
      value={{
        transform,
        lmStudioUrl,
        setLMStudioUrl,
        lmStudioCorsError,
        clearLmStudioCorsError: () => setLmStudioCorsError(false),
        isLoading,
        isReady,
        error,
        loadProgress,
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
