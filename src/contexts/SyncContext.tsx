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
import { useUserState } from "@/contexts/UserStateContext";
import { trpcClient } from "@/lib/trpc";
import { deriveEncryptionKey } from "@/lib/derive-key";
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
  notifyUpsert: (
    entityType: SyncEntityType,
    row: { id: number; [key: string]: unknown },
  ) => void;
  notifyDelete: (entityType: SyncEntityType, id: number) => void;
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
  const { accountToken } = useUserState();
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
    // Defer worker creation until both auth and the account token are in hand
    // so we can deliver the derived key before `init` triggers the IDB cache
    // load. Otherwise returning sessions would index pre-existing ciphertext
    // rows as opaque blobs.
    if (!isAuthenticated || !accountToken) return;

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

    // Derive the key, push it to the worker, then post `init`. Messages are
    // delivered in order, and `setKey` is a sync handler in the worker, so by
    // the time `init`'s async loadFromCache runs, the key is in place.
    (async () => {
      try {
        const { encryptionSalt } = await trpcClient.config.getSettings.query();
        const key = await deriveEncryptionKey(accountToken, encryptionSalt);
        let bin = "";
        for (let i = 0; i < key.length; i++) bin += String.fromCharCode(key[i]);
        worker.postMessage({
          type: "setKey",
          key: btoa(bin),
        } satisfies MainToWorkerMessage);
      } catch (err) {
        console.error("[sync] failed to derive/deliver encryption key:", err);
      }
      worker.postMessage({ type: "init" } satisfies MainToWorkerMessage);
    })();

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
  }, [isAuthenticated, accountToken, runSync]);

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

  const notifyUpsert = useCallback(
    (
      entityType: SyncEntityType,
      row: { id: number; [key: string]: unknown },
    ) => {
      postToWorker({
        type: "pushChange",
        entityType,
        upserts: [row],
        deletedIds: [],
      });
    },
    [postToWorker],
  );

  const notifyDelete = useCallback(
    (entityType: SyncEntityType, id: number) => {
      postToWorker({
        type: "pushChange",
        entityType,
        upserts: [],
        deletedIds: [id],
      });
    },
    [postToWorker],
  );

  return (
    <SyncContext.Provider
      value={{
        ready,
        status,
        search,
        resync: runSync,
        notifyUpsert,
        notifyDelete,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
