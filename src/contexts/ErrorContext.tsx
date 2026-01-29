import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { generateUUID } from "@/lib/uuid";

interface ErrorMessage {
  id: string;
  message: string;
  timestamp: number;
}

interface ErrorContextType {
  errors: ErrorMessage[];
  addError: (message: string) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);

  const addError = useCallback((message: string) => {
    const id = generateUUID();
    const timestamp = Date.now();
    setErrors((prev) => [...prev, { id, message, timestamp }]);

    // Auto-remove after 8 seconds
    setTimeout(() => {
      setErrors((prev) => prev.filter((e) => e.id !== id));
    }, 8000);
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <ErrorContext.Provider
      value={{ errors, addError, removeError, clearErrors }}
    >
      {children}
    </ErrorContext.Provider>
  );
}

export function useErrors() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error("useErrors must be used within an ErrorProvider");
  }
  return context;
}
