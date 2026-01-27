import { createContext, useContext, useState, ReactNode } from "react";

interface StackOutputContextType {
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
}

const StackOutputContext = createContext<StackOutputContextType | undefined>(
  undefined,
);

export function StackOutputProvider({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <StackOutputContext.Provider value={{ isMinimized, setIsMinimized }}>
      {children}
    </StackOutputContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStackOutput() {
  const context = useContext(StackOutputContext);
  if (context === undefined) {
    throw new Error("useStackOutput must be used within a StackOutputProvider");
  }
  return context;
}
