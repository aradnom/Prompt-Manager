import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

const STORAGE_KEY = "stackOutputMinimized";

interface StackOutputContextType {
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
}

const StackOutputContext = createContext<StackOutputContextType | undefined>(
  undefined,
);

export function StackOutputProvider({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isMinimized));
  }, [isMinimized]);

  return (
    <StackOutputContext.Provider value={{ isMinimized, setIsMinimized }}>
      {children}
    </StackOutputContext.Provider>
  );
}

export function useStackOutput() {
  const context = useContext(StackOutputContext);
  if (context === undefined) {
    throw new Error("useStackOutput must be used within a StackOutputProvider");
  }
  return context;
}
