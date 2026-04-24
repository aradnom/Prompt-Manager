import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { generateUUID } from "@/lib/uuid";
import {
  setGlobalErrorHandler,
  clearGlobalErrorHandler,
} from "@/lib/global-error";

interface ErrorLink {
  label: string;
  href: string;
}

type NoticeVariant = "error" | "success";

interface ErrorMessage {
  id: string;
  message: string;
  link?: ErrorLink;
  timestamp: number;
  variant: NoticeVariant;
}

interface ProgressMessage {
  id: string;
  message: string;
  progress: number; // 0-100
}

interface ErrorContextType {
  errors: ErrorMessage[];
  addError: (message: string, link?: ErrorLink) => void;
  addNotice: (message: string, link?: ErrorLink) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  progressMessages: ProgressMessage[];
  setProgress: (id: string, message: string, progress: number) => void;
  removeProgress: (id: string) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>(
    [],
  );

  const pushMessage = useCallback(
    (variant: NoticeVariant, message: string, link?: ErrorLink) => {
      const id = generateUUID();
      const timestamp = Date.now();
      setErrors((prev) => [...prev, { id, message, link, timestamp, variant }]);

      // Auto-remove after 8 seconds
      setTimeout(() => {
        setErrors((prev) => prev.filter((e) => e.id !== id));
      }, 8000);
    },
    [],
  );

  const addError = useCallback(
    (message: string, link?: ErrorLink) => {
      pushMessage("error", message, link);
    },
    [pushMessage],
  );

  const addNotice = useCallback(
    (message: string, link?: ErrorLink) => {
      pushMessage("success", message, link);
    },
    [pushMessage],
  );

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const setProgress = useCallback(
    (id: string, message: string, progress: number) => {
      setProgressMessages((prev) => {
        const existing = prev.find((p) => p.id === id);
        if (existing) {
          return prev.map((p) =>
            p.id === id ? { ...p, message, progress } : p,
          );
        }
        return [...prev, { id, message, progress }];
      });
    },
    [],
  );

  const removeProgress = useCallback((id: string) => {
    setProgressMessages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Register as the global error handler so non-React code (e.g. MutationCache)
  // can surface errors through the ErrorContext.
  useEffect(() => {
    setGlobalErrorHandler(addError);
    return () => clearGlobalErrorHandler();
  }, [addError]);

  return (
    <ErrorContext.Provider
      value={{
        errors,
        addError,
        addNotice,
        removeError,
        clearErrors,
        progressMessages,
        setProgress,
        removeProgress,
      }}
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
