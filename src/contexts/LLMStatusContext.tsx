import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useServerConfig } from "./ServerConfigContext";
import { useUserState } from "./UserStateContext";
import type { LLMTarget as ServerLLMTarget } from "@server/config";

// Extend server targets with client-only targets
export type LLMTarget = ServerLLMTarget | "transformers-js";

export type LLMTargetType = "server" | "client";

interface LLMTargetInfo {
  id: LLMTarget;
  name: string;
  type: LLMTargetType;
  requiresConfig: boolean; // Does it need API keys or other config?
}

const LLM_TARGET_INFO: Record<LLMTarget, LLMTargetInfo> = {
  "lm-studio": {
    id: "lm-studio",
    name: "LM Studio",
    type: "client",
    requiresConfig: false, // User configures locally
  },
  vertex: {
    id: "vertex",
    name: "Google Vertex AI",
    type: "server",
    requiresConfig: true,
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    type: "server",
    requiresConfig: true,
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    type: "server",
    requiresConfig: true,
  },
  grok: {
    id: "grok",
    name: "Grok",
    type: "server",
    requiresConfig: true,
  },
  "transformers-js": {
    id: "transformers-js",
    name: "Transformers.js (Local)",
    type: "client",
    requiresConfig: false,
  },
};

interface LLMStatusContextType {
  // All targets that exist
  allTargets: LLMTarget[];

  // Targets that are configured and available to use
  availableTargets: LLMTarget[];

  // Currently active target (null until initialized)
  activeTarget: LLMTarget | null;

  // Set the active target
  setActiveTarget: (target: LLMTarget) => void;

  // Check if a specific target is configured/available
  isAvailable: (target: LLMTarget) => boolean;

  // Get info about a target
  getTargetInfo: (target: LLMTarget) => LLMTargetInfo;

  // Check if target runs on server or client
  isServerTarget: (target: LLMTarget) => boolean;
  isClientTarget: (target: LLMTarget) => boolean;
}

const LLMStatusContext = createContext<LLMStatusContextType | null>(null);

interface LLMStatusProviderProps {
  children: ReactNode;
}

export function LLMStatusProvider({ children }: LLMStatusProviderProps) {
  const { config: serverConfig } = useServerConfig();
  const { activeLLMPlatform, accountDataLoaded } = useUserState();
  const [activeTarget, setActiveTargetState] = useState<LLMTarget | null>(null);
  const [initialized, setInitialized] = useState(false);

  // All possible targets = server targets + client-only targets
  const allTargets: LLMTarget[] = useMemo(
    () => [
      "transformers-js", // Client-only, always available
      ...(serverConfig?.llm?.allTargets || []), // Server-provided list
    ],
    [serverConfig?.llm?.allTargets],
  );

  // Determine which targets are available
  const availableTargets: LLMTarget[] = useMemo(() => {
    return allTargets.filter((target) => {
      const info = LLM_TARGET_INFO[target];

      // Client-side targets are always available
      if (info.type === "client") {
        return true;
      }

      // Server-side targets need to be in the server's allowed list
      if (info.type === "server") {
        return serverConfig?.llm?.allowedTargets.includes(target) ?? false;
      }

      return false;
    });
  }, [allTargets, serverConfig?.llm?.allowedTargets]);

  // Initialize active target from user account data or first available (only once)
  useEffect(() => {
    // Wait for both server config and account data to be loaded
    if (!serverConfig || !accountDataLoaded || initialized) return;

    // Priority order:
    // 1. User's active LLM platform from account_data (if available)
    // 2. First available server target
    // 3. transformers-js as fallback

    let target: LLMTarget;

    if (activeLLMPlatform && availableTargets.includes(activeLLMPlatform)) {
      target = activeLLMPlatform as LLMTarget;
    } else {
      // Find first server target if any
      const firstServerTarget = availableTargets.find(
        (t) => LLM_TARGET_INFO[t].type === "server",
      );
      target = firstServerTarget || "transformers-js";
    }

    console.log(target);

    setActiveTargetState(target);
    setInitialized(true);
  }, [
    serverConfig,
    accountDataLoaded,
    activeLLMPlatform,
    availableTargets,
    initialized,
  ]);

  const setActiveTarget = (target: LLMTarget) => {
    if (!availableTargets.includes(target)) {
      console.warn(`Target ${target} is not available`);
      return;
    }
    setActiveTargetState(target);

    // Update the user's account data if it's a server target
    // (client targets like transformers-js and lm-studio aren't stored server-side)
    if (LLM_TARGET_INFO[target].type === "server") {
      // This will be handled by the Account page's setActivePlatform endpoint
      // For now, just update local state - the Account page will sync it to server
      console.log(`Active target changed to: ${target}`);
    }
  };

  const isAvailable = (target: LLMTarget): boolean => {
    return availableTargets.includes(target);
  };

  const getTargetInfo = (target: LLMTarget): LLMTargetInfo => {
    return LLM_TARGET_INFO[target];
  };

  const isServerTarget = (target: LLMTarget): boolean => {
    return LLM_TARGET_INFO[target].type === "server";
  };

  const isClientTarget = (target: LLMTarget): boolean => {
    return LLM_TARGET_INFO[target].type === "client";
  };

  return (
    <LLMStatusContext.Provider
      value={{
        allTargets,
        availableTargets,
        activeTarget,
        setActiveTarget,
        isAvailable,
        getTargetInfo,
        isServerTarget,
        isClientTarget,
      }}
    >
      {children}
    </LLMStatusContext.Provider>
  );
}

export function useLLMStatus() {
  const context = useContext(LLMStatusContext);
  if (!context) {
    throw new Error("useLLMStatus must be used within LLMStatusProvider");
  }
  return context;
}
