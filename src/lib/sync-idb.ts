import { openDB, type IDBPDatabase } from "idb";

/**
 * IndexedDB schema for the client-side search cache.
 *
 * Rows are stored exactly as received from the sync endpoints — envelopes
 * stay encrypted on disk, so the browser profile never holds plaintext user
 * content. Decryption happens in-memory inside the worker.
 *
 * When we make a breaking shape change (envelope format, new indexed field,
 * etc.) bump SCHEMA_VERSION and the onupgradeneeded handler wipes the stores.
 * Next open triggers a full resync, which is the same code path as a cold
 * start — no migration logic needed.
 */

export const SYNC_DB_NAME = "pm-sync";
export const SCHEMA_VERSION = 2;

export type SyncEntityType =
  | "blocks"
  | "stacks"
  | "snapshots"
  | "wildcards"
  | "templates";

export const ENTITY_TYPES: readonly SyncEntityType[] = [
  "blocks",
  "stacks",
  "snapshots",
  "wildcards",
  "templates",
] as const;

const META_STORE = "meta";

function metaKey(entityType: SyncEntityType): string {
  return `sync:${entityType}`;
}

export interface SyncMeta {
  lastSync: string;
}

export async function openSyncDB(): Promise<IDBPDatabase> {
  return openDB(SYNC_DB_NAME, SCHEMA_VERSION, {
    upgrade(db, oldVersion) {
      // Any version bump is a full reset — easier than migrating when the
      // reason for the bump is usually "the envelope shape changed".
      if (oldVersion > 0) {
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
      }
      for (const entityType of ENTITY_TYPES) {
        db.createObjectStore(entityType, { keyPath: "id" });
      }
      db.createObjectStore(META_STORE);
    },
  });
}

export async function readAll<T>(
  db: IDBPDatabase,
  entityType: SyncEntityType,
): Promise<T[]> {
  return db.getAll(entityType) as Promise<T[]>;
}

export async function writeBatch<T extends { id: number }>(
  db: IDBPDatabase,
  entityType: SyncEntityType,
  items: T[],
  deletedIds: number[],
): Promise<void> {
  const tx = db.transaction(entityType, "readwrite");
  const store = tx.objectStore(entityType);
  await Promise.all([
    ...items.map((item) => store.put(item)),
    ...deletedIds.map((id) => store.delete(id)),
  ]);
  await tx.done;
}

export async function getMeta(
  db: IDBPDatabase,
  entityType: SyncEntityType,
): Promise<SyncMeta | undefined> {
  return db.get(META_STORE, metaKey(entityType)) as Promise<
    SyncMeta | undefined
  >;
}

export async function setMeta(
  db: IDBPDatabase,
  entityType: SyncEntityType,
  meta: SyncMeta,
): Promise<void> {
  await db.put(META_STORE, meta, metaKey(entityType));
}

/**
 * Diff the client's current id set against the server's authoritative set.
 *
 * - `deletedIds`: the client has these, the server says they're gone.
 * - `missingIds`: the server has these and the client does not — usually means
 *   local state got wiped (cleared storage, schema bump mid-flight, etc.) but
 *   `meta.lastSync` survived, so a delta pull won't recover. The caller
 *   should drop lastSync and do a full resync.
 */
export function diffExistingIds(
  localIds: number[],
  serverIds: number[],
): { deletedIds: number[]; missingIds: number[] } {
  const serverSet = new Set(serverIds);
  const localSet = new Set(localIds);
  return {
    deletedIds: localIds.filter((id) => !serverSet.has(id)),
    missingIds: serverIds.filter((id) => !localSet.has(id)),
  };
}

export async function clearMeta(
  db: IDBPDatabase,
  entityType: SyncEntityType,
): Promise<void> {
  await db.delete(META_STORE, metaKey(entityType));
}
