import React, { createContext, useContext } from "react";
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

  return (
    <ServerConfigContext.Provider
      value={{
        config: config || null,
        isLoading,
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
