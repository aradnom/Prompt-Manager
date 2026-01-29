import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { generateUUID } from "@/lib/uuid";

interface ErrorLink {
  label: string;
  href: string;
}

interface ErrorMessage {
  id: string;
  message: string;
  link?: ErrorLink;
  timestamp: number;
}

interface ErrorContextType {
  errors: ErrorMessage[];
  addError: (message: string, link?: ErrorLink) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);

  const addError = useCallback((message: string, link?: ErrorLink) => {
    const id = generateUUID();
    const timestamp = Date.now();
    setErrors((prev) => [...prev, { id, message, link, timestamp }]);

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
