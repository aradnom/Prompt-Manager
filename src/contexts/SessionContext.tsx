import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface SessionContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: number | null;
  isAdmin: boolean;
  checkSession: () => Promise<void>;
  setAuthenticated: (authenticated: boolean, userId?: number) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.authenticated) {
        setIsAuthenticated(true);
        setUserId(data.userId);
        setIsAdmin(data.adminUser ?? false);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
        setIsAdmin(false);
      }
    } catch (err) {
      console.error("Error checking session:", err);
      setIsAuthenticated(false);
      setUserId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setAuthenticated = (authenticated: boolean, userIdValue?: number) => {
    setIsAuthenticated(authenticated);
    setUserId(userIdValue ?? null);
    if (!authenticated) setIsAdmin(false);
  };

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <SessionContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        userId,
        isAdmin,
        checkSession,
        setAuthenticated,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
