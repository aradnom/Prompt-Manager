import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { api } from "@/lib/api";
import { useSession } from "@/contexts/SessionContext";

interface UserStateContextType {
  stackCount: number;
  blockCount: number;
  activeLLMPlatform: string | null;
  setActiveLLMPlatform: (platform: string | null) => void;
  accountToken: string | null;
  isLoading: boolean;
  accountDataLoaded: boolean;
  refetch: () => void;
  refetchAccountData: () => Promise<void>;
}

const UserStateContext = createContext<UserStateContextType | undefined>(
  undefined,
);

export function UserStateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSession();
  const [stackCount, setStackCount] = useState(0);
  const [blockCount, setBlockCount] = useState(0);
  const [activeLLMPlatform, setActiveLLMPlatform] = useState<string | null>(
    null,
  );
  const [accountToken, setAccountToken] = useState<string | null>(null);
  const [accountDataLoaded, setAccountDataLoaded] = useState(false);
  const [isLoading] = useState(false);

  const { data: stackData, refetch: refetchStacks } = api.stacks.count.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );

  const { data: blockData, refetch: refetchBlocks } = api.blocks.count.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );

  const refetchAccountData = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/account", {
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Failed to fetch account data");
        setAccountDataLoaded(true); // Mark as loaded even on error
        return;
      }

      const data = await response.json();
      setActiveLLMPlatform(data.accountData?.activeLLMPlatform || null);
      setAccountToken(data.accountData?.token ?? null);
      setAccountDataLoaded(true);
    } catch (error) {
      console.error("Error fetching account data:", error);
      setAccountDataLoaded(true); // Mark as loaded even on error
    }
  }, []);

  // Fetch user account data including active LLM platform
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveLLMPlatform(null);
      setAccountToken(null);
      setAccountDataLoaded(true); // No account data needed when not authenticated
      return;
    }

    setAccountDataLoaded(false); // Reset when authentication changes
    refetchAccountData();
  }, [isAuthenticated, refetchAccountData]);

  useEffect(() => {
    setStackCount(stackData?.count ?? 0);
  }, [stackData]);

  useEffect(() => {
    setBlockCount(blockData?.count ?? 0);
  }, [blockData]);

  useEffect(() => {
    if (!isAuthenticated) {
      setStackCount(0);
      setBlockCount(0);
      setActiveLLMPlatform(null);
      setAccountToken(null);
      setAccountDataLoaded(true);
    }
  }, [isAuthenticated]);

  const refetch = () => {
    refetchStacks();
    refetchBlocks();
  };

  return (
    <UserStateContext.Provider
      value={{
        stackCount,
        blockCount,
        activeLLMPlatform,
        setActiveLLMPlatform,
        accountToken,
        accountDataLoaded,
        isLoading,
        refetch,
        refetchAccountData,
      }}
    >
      {children}
    </UserStateContext.Provider>
  );
}

export function useUserState() {
  const context = useContext(UserStateContext);
  if (context === undefined) {
    throw new Error("useUserState must be used within a UserStateProvider");
  }
  return context;
}
