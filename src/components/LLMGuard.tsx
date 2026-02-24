import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLLMStatus } from "@/contexts/LLMStatusContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LLMGuardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps children with a tooltip prompting the user to configure an LLM
 * platform when none is active. Consumers should also check `isLLMConfigured`
 * from `useLLMStatus()` to disable their buttons.
 */
export function LLMGuard({ children, className }: LLMGuardProps) {
  const { isLLMConfigured } = useLLMStatus();

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isLLMConfigured ? false : undefined}>
        <TooltipTrigger asChild>
          <span className={className ?? "inline-flex gap-2 flex-wrap"}>
            {children}
          </span>
        </TooltipTrigger>
        {!isLLMConfigured && (
          <TooltipContent>
            <Link
              to="/account#llm-settings"
              className="underline hover:text-foreground"
            >
              Configure an LLM platform
            </Link>{" "}
            to use this
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
