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
  | {
      // Derived AES-256-GCM key, base64-encoded. Worker holds it in module
      // scope and uses it to decrypt envelope fields before indexing.
      type: "setKey";
      key: string;
    }
  | ({ type: "applySync"; entityType: SyncEntityType } & ApplySyncPayload)
  | {
      // Apply a locally-initiated mutation to the worker's cache without
      // touching the lastSync cursor. The next delta sync will re-pull these
      // rows (idempotent) but the cache + index reflect the change immediately.
      type: "pushChange";
      entityType: SyncEntityType;
      upserts: Array<{ id: number; [key: string]: unknown }>;
      deletedIds: number[];
    }
  | {
      type: "search";
      requestId: string;
      entityType: SyncEntityType;
      query: string;
      options?: SearchOptions;
    }
  | {
      // Return every cached row for an entity, decrypted. Used by UI surfaces
      // that filter by structured fields (e.g. labels, typeId) rather than by
      // text — server-side filtering on encrypted columns isn't possible, so
      // the worker ships the whole decrypted set and the caller narrows it.
      type: "list";
      requestId: string;
      entityType: SyncEntityType;
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
  | {
      type: "listResult";
      requestId: string;
      items: Array<Record<string, unknown>>;
    }
  | { type: "error"; message: string; context?: string };
