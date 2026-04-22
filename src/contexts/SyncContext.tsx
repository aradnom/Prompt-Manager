import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/contexts/SessionContext";
import { trpcClient } from "@/lib/trpc";
import {
  ENTITY_TYPES,
  getMeta,
  openSyncDB,
  type SyncEntityType,
} from "@/lib/sync-idb";
import type {
  MainToWorkerMessage,
  SearchHit,
  SearchOptions,
  WorkerToMainMessage,
} from "@/workers/sync-worker-protocol";

/**
 * Sync context.
 *
 * Spawns the sync worker on login, drives bulk-export fetches via tRPC, hands
 * the raw rows to the worker, and exposes a search API to the rest of the
 * app. Terminates the worker on logout.
 *
 * The worker owns IDB and the MiniSearch indexes. The context owns the HTTP
 * path (so tRPC auth and the cookie jar stay on the main thread) and the
 * request/response bookkeeping for in-flight search queries.
 */

interface SyncEntityStatus {
  lastSync: string | null;
  itemCount: number;
}

interface SyncContextValue {
  ready: boolean;
  status: Record<SyncEntityType, SyncEntityStatus>;
  search: <T = unknown>(
    entityType: SyncEntityType,
    query: string,
    options?: SearchOptions,
  ) => Promise<SearchHit<T>[]>;
  resync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

const emptyStatus = (): Record<SyncEntityType, SyncEntityStatus> => ({
  blocks: { lastSync: null, itemCount: 0 },
  stacks: { lastSync: null, itemCount: 0 },
  snapshots: { lastSync: null, itemCount: 0 },
  wildcards: { lastSync: null, itemCount: 0 },
});

async function fetchEntityExport(
  entityType: SyncEntityType,
  since: string | undefined,
) {
  switch (entityType) {
    case "blocks":
      return trpcClient.sync.exportBlocks.query({ since });
    case "stacks":
      return trpcClient.sync.exportStacks.query({ since });
    case "snapshots":
      return trpcClient.sync.exportSnapshots.query({ since });
    case "wildcards":
      return trpcClient.sync.exportWildcards.query({ since });
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSession();
  const [ready, setReady] = useState(false);
  const [status, setStatus] =
    useState<Record<SyncEntityType, SyncEntityStatus>>(emptyStatus);

  const workerRef = useRef<Worker | null>(null);
  const pendingSearchesRef = useRef(
    new Map<string, (hits: SearchHit[]) => void>(),
  );
  const searchIdRef = useRef(0);
  // Per-entity retry counter so a pathological server state (or a worker bug)
  // can't ping-pong resyncNeeded → refetch → resyncNeeded forever.
  const resyncRetriesRef = useRef<Record<SyncEntityType, number>>({
    blocks: 0,
    stacks: 0,
    snapshots: 0,
    wildcards: 0,
  });
  const MAX_RESYNC_RETRIES = 1;

  const postToWorker = useCallback((msg: MainToWorkerMessage) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const syncEntity = useCallback(
    async (entityType: SyncEntityType, forceFull = false) => {
      const db = await openSyncDB();
      try {
        const meta = forceFull ? undefined : await getMeta(db, entityType);
        const result = await fetchEntityExport(entityType, meta?.lastSync);
        postToWorker({
          type: "applySync",
          entityType,
          items: result.items as unknown as Array<{
            id: number;
            [key: string]: unknown;
          }>,
          existingIds: result.existingIds,
          serverTime: result.serverTime,
        });
      } finally {
        db.close();
      }
    },
    [postToWorker],
  );

  const runSync = useCallback(async () => {
    await Promise.all(ENTITY_TYPES.map((entityType) => syncEntity(entityType)));
  }, [syncEntity]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const worker = new Worker(
      new URL("../workers/sync-worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    const handleMessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case "ready":
          setReady(true);
          // Worker has loaded whatever was in IDB from a previous session;
          // now pull deltas from the server.
          runSync().catch((err) =>
            console.error("[sync] initial sync failed:", err),
          );
          break;
        case "synced":
          resyncRetriesRef.current[msg.entityType] = 0;
          setStatus((prev) => ({
            ...prev,
            [msg.entityType]: {
              lastSync: msg.lastSync,
              itemCount: msg.itemCount,
            },
          }));
          break;
        case "resyncNeeded": {
          const retries = resyncRetriesRef.current[msg.entityType];
          if (retries >= MAX_RESYNC_RETRIES) {
            console.error(
              `[sync] ${msg.entityType}: resyncNeeded after ${retries} retries, giving up (missing ${msg.missingCount} ids)`,
            );
            break;
          }
          resyncRetriesRef.current[msg.entityType] = retries + 1;
          console.warn(
            `[sync] ${msg.entityType}: missing ${msg.missingCount} ids, forcing full resync`,
          );
          syncEntity(msg.entityType, true).catch((err) =>
            console.error(`[sync] forced resync failed: ${err}`),
          );
          break;
        }
        case "searchResult": {
          const resolver = pendingSearchesRef.current.get(msg.requestId);
          if (resolver) {
            pendingSearchesRef.current.delete(msg.requestId);
            resolver(msg.hits);
          }
          break;
        }
        case "error":
          console.error(
            `[sync worker] ${msg.context ?? "error"}: ${msg.message}`,
          );
          break;
      }
    };

    worker.addEventListener("message", handleMessage);
    resyncRetriesRef.current = {
      blocks: 0,
      stacks: 0,
      snapshots: 0,
      wildcards: 0,
    };
    worker.postMessage({ type: "init" } satisfies MainToWorkerMessage);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.terminate();
      workerRef.current = null;
      setReady(false);
      setStatus(emptyStatus());
      // Reject any in-flight searches to avoid leaks.
      for (const [, resolver] of pendingSearchesRef.current) {
        resolver([]);
      }
      pendingSearchesRef.current.clear();
    };
  }, [isAuthenticated, runSync]);

  const search = useCallback(
    <T,>(
      entityType: SyncEntityType,
      query: string,
      options?: SearchOptions,
    ): Promise<SearchHit<T>[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve([]);
          return;
        }
        const requestId = String(++searchIdRef.current);
        pendingSearchesRef.current.set(
          requestId,
          resolve as (hits: SearchHit[]) => void,
        );
        postToWorker({
          type: "search",
          requestId,
          entityType,
          query,
          options,
        });
      });
    },
    [postToWorker],
  );

  return (
    <SyncContext.Provider value={{ ready, status, search, resync: runSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
