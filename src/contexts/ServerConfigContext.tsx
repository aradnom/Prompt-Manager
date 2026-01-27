import React, { createContext, useContext, useState } from "react";
import { api } from "@/lib/api";

interface ServerConfig {
  devSettingsEnabled: boolean;
  llm: {
    allowedTargets: string[];
    allTargets: string[];
  };
}

interface ServerConfigContextType {
  config: ServerConfig | null;
  isLoading: boolean;
  preferredLLMTarget: string | null;
  setPreferredLLMTarget: (target: string) => void;
}

const ServerConfigContext = createContext<ServerConfigContextType | undefined>(
  undefined,
);

export function ServerConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: config, isLoading } = api.config.getSettings.useQuery();
  const [preferredLLMTarget, setPreferredLLMTargetState] = useState<
    string | null
  >(() => {
    return localStorage.getItem("preferred-llm-target");
  });

  const setPreferredLLMTarget = (target: string) => {
    setPreferredLLMTargetState(target);
    localStorage.setItem("preferred-llm-target", target);
  };

  return (
    <ServerConfigContext.Provider
      value={{
        config: config || null,
        isLoading,
        preferredLLMTarget,
        setPreferredLLMTarget,
      }}
    >
      {children}
    </ServerConfigContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useServerConfig() {
  const context = useContext(ServerConfigContext);
  if (context === undefined) {
    throw new Error(
      "useServerConfig must be used within a ServerConfigProvider",
    );
  }
  return context;
}
