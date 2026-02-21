import { useState, useCallback, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { useLLMStatus } from "@/contexts/LLMStatusContext";
import { useClientLLM } from "@/contexts/ClientLLMContext";
import type { LLMTarget as ServerLLMTarget } from "@server/config";
import type {
  LLMOperation,
  OutputStyle,
  ThinkingConfig,
} from "@shared/llm/types";
import { LENGTH_LIMITS } from "@shared/limits";

// Read thinking settings from localStorage
function getThinkingConfig(): ThinkingConfig | undefined {
  const enabled = localStorage.getItem("thinking-enabled") === "true";
  if (!enabled) return undefined;

  const level = localStorage.getItem("thinking-level") as
    | "low"
    | "medium"
    | "high"
    | null;
  return {
    enabled: true,
    level: level || "low",
  };
}

// Subscribe to storage events for cross-tab sync
function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStorageSnapshot() {
  return `${localStorage.getItem("thinking-enabled")}-${localStorage.getItem("thinking-level")}`;
}

interface TransformInput {
  text: string;
  operation: LLMOperation;
  target?: string;
  style?: OutputStyle;
  wildcards?: string[];
}

interface TransformResult {
  result: string | string[];
  target: string;
}

/**
 * Unified transform hook that routes to either client-side or server-side
 * LLM processing based on the active target.
 *
 * Returns an interface matching tRPC's useMutation so components can swap
 * in with minimal changes.
 */
export function useTransform() {
  const { activeTarget, isClientTarget } = useLLMStatus();
  const clientLLM = useClientLLM();
  const serverMutation = api.llm.transform.useMutation();
  const [isClientPending, setIsClientPending] = useState(false);

  // Subscribe to localStorage changes for thinking settings
  useSyncExternalStore(subscribeToStorage, getStorageSnapshot);

  const mutateAsync = useCallback(
    async (input: TransformInput): Promise<TransformResult> => {
      if (input.text.length > LENGTH_LIMITS.llmText) {
        throw new Error(
          `Text exceeds the ${LENGTH_LIMITS.llmText.toLocaleString()} character limit for LLM transforms.`,
        );
      }

      const target = activeTarget;
      const thinking = getThinkingConfig();

      if (target && isClientTarget(target)) {
        // Client-side transform (Transformers.js, LM Studio)
        setIsClientPending(true);
        try {
          const result = await clientLLM.transform({
            text: input.text,
            operation: input.operation as LLMOperation,
            style: input.style,
            wildcards: input.wildcards,
          });
          return result;
        } finally {
          setIsClientPending(false);
        }
      } else {
        // Server-side transform (OpenAI, Anthropic, Vertex, Grok)
        return serverMutation.mutateAsync({
          ...input,
          target: target as ServerLLMTarget,
          thinking,
        });
      }
    },
    [activeTarget, isClientTarget, clientLLM, serverMutation],
  );

  const isPending = isClientPending || serverMutation.isPending;

  return { mutateAsync, isPending };
}
