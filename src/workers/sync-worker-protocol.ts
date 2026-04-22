import type { SyncEntityType } from "@/lib/sync-idb";

/**
 * Shared message protocol for the sync worker. Kept in its own module so the
 * main thread can import the types without pulling in the worker body.
 */

export interface SearchOptions {
  /**
   * Maximum edit distance as a fraction of the query length. 0 disables fuzzy
   * matching entirely; MiniSearch's default (~0.2) is reasonable for short
   * queries. Prefix matching is always on.
   */
  fuzzy?: number;
  prefix?: boolean;
  limit?: number;
}

export interface SearchHit<T = unknown> {
  id: number;
  score: number;
  item: T;
}

export interface ApplySyncPayload {
  items: Array<{ id: number; [key: string]: unknown }>;
  existingIds: number[];
  serverTime: string;
}

export type MainToWorkerMessage =
  | { type: "init" }
  | ({ type: "applySync"; entityType: SyncEntityType } & ApplySyncPayload)
  | {
      type: "search";
      requestId: string;
      entityType: SyncEntityType;
      query: string;
      options?: SearchOptions;
    };

export type WorkerToMainMessage =
  | { type: "ready" }
  | {
      type: "synced";
      entityType: SyncEntityType;
      lastSync: string;
      itemCount: number;
    }
  | {
      // The delta returned by applySync referenced ids the client doesn't
      // have and that weren't included as upserts — local state is torn.
      // Main thread should drop lastSync and refetch without `since`.
      type: "resyncNeeded";
      entityType: SyncEntityType;
      missingCount: number;
    }
  | {
      type: "searchResult";
      requestId: string;
      hits: SearchHit[];
    }
  | { type: "error"; message: string; context?: string };
