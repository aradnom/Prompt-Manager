import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useSession } from "@/contexts/SessionContext";

/**
 * Typed server→browser event union. Keep in sync with
 * server/src/lib/user-event-bus.ts.
 */
export type UserEvent = {
  type: "cui-pair-request";
  requestId: string;
  fingerprint: string;
};

type Handler = (event: UserEvent) => void;

interface UserEventsContextType {
  connected: boolean;
  subscribe: (handler: Handler) => () => void;
}

const UserEventsContext = createContext<UserEventsContextType | undefined>(
  undefined,
);

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function UserEventsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSession();
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef<Set<Handler>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_MIN_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teardownRef = useRef(false);

  useEffect(() => {
    teardownRef.current = false;

    if (!isAuthenticated) {
      return () => {
        teardownRef.current = true;
      };
    }

    const connect = () => {
      if (teardownRef.current) return;

      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${scheme}//${window.location.host}/api/events`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        setConnected(true);
        reconnectDelayRef.current = RECONNECT_MIN_MS;
      });

      ws.addEventListener("message", (e) => {
        let event: UserEvent;
        try {
          event = JSON.parse(e.data);
        } catch {
          console.warn("UserEvents: non-JSON message", e.data);
          return;
        }
        console.debug("UserEvents: received", event);
        for (const h of handlersRef.current) {
          try {
            h(event);
          } catch (err) {
            console.error("UserEvents handler threw:", err);
          }
        }
      });

      ws.addEventListener("close", () => {
        setConnected(false);
        wsRef.current = null;
        if (teardownRef.current) return;
        // Jittered exponential backoff so multiple tabs don't reconnect in lockstep
        const base = reconnectDelayRef.current;
        const jitter = Math.random() * base * 0.3;
        reconnectTimerRef.current = setTimeout(connect, base + jitter);
        reconnectDelayRef.current = Math.min(base * 2, RECONNECT_MAX_MS);
      });

      ws.addEventListener("error", () => {
        // Let 'close' handle reconnection; error fires before close on failure
        ws.close();
      });
    };

    connect();

    return () => {
      teardownRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [isAuthenticated]);

  const subscribe = (handler: Handler): (() => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  };

  return (
    <UserEventsContext.Provider value={{ connected, subscribe }}>
      {children}
    </UserEventsContext.Provider>
  );
}

export function useUserEvents() {
  const ctx = useContext(UserEventsContext);
  if (!ctx) {
    throw new Error("useUserEvents must be used within a UserEventsProvider");
  }
  return ctx;
}

/**
 * Convenience hook: subscribe to events of a specific type for the lifetime
 * of the calling component.
 */
export function useUserEvent<T extends UserEvent["type"]>(
  type: T,
  handler: (event: Extract<UserEvent, { type: T }>) => void,
) {
  const { subscribe } = useUserEvents();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === type) {
        handlerRef.current(event as Extract<UserEvent, { type: T }>);
      }
    });
  }, [subscribe, type]);
}
