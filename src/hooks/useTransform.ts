import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useLLMStatus } from "@/contexts/LLMStatusContext";
import { useClientLLM } from "@/contexts/ClientLLMContext";
import type { LLMOperation, OutputStyle } from "@shared/llm/types";

interface TransformInput {
  text: string;
  operation: LLMOperation;
  target?: string;
  style?: OutputStyle;
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

  const mutateAsync = useCallback(
    async (input: TransformInput): Promise<TransformResult> => {
      const target = activeTarget;

      if (target && isClientTarget(target)) {
        // Client-side transform (Transformers.js, LM Studio)
        setIsClientPending(true);
        try {
          const result = await clientLLM.transform({
            text: input.text,
            operation: input.operation as LLMOperation,
            style: input.style,
          });
          return result;
        } finally {
          setIsClientPending(false);
        }
      } else {
        // Server-side transform (OpenAI, Anthropic, Vertex, Grok)
        return serverMutation.mutateAsync({
          ...input,
          target: target as any,
        });
      }
    },
    [activeTarget, isClientTarget, clientLLM, serverMutation],
  );

  const isPending = isClientPending || serverMutation.isPending;

  return { mutateAsync, isPending };
}
