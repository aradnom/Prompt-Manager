/// <reference lib="webworker" />

import MiniSearch from "minisearch";
import type { IDBPDatabase } from "idb";
import {
  ENTITY_TYPES,
  clearMeta,
  diffExistingIds,
  openSyncDB,
  readAll,
  setMeta,
  writeBatch,
  type SyncEntityType,
} from "@/lib/sync-idb";
import {
  decryptEnvelope,
  isEnvelope,
  isEnvelopeObj,
  unwrapValue,
} from "@/lib/envelope";
import type {
  MainToWorkerMessage,
  SearchHit,
  SearchOptions,
  WorkerToMainMessage,
} from "./sync-worker-protocol";

/**
 * Sync worker.
 *
 * Owns the on-disk cache (IndexedDB) and the in-memory MiniSearch indexes.
 * The main thread fetches sync data via tRPC and ships raw rows here; the
 * worker decides what goes to disk, what goes into the index, and answers
 * search queries without ever blocking the UI thread.
 *
 * Envelope handling: rows may contain ciphertext strings for some fields
 * (name, notes, rendered_content, etc.) once content encryption is enabled.
 * The worker strips those through `unwrapValue` before feeding them to
 * MiniSearch — today that's a passthrough for plaintext and a `null` for
 * envelopes (no key path yet); when the key-delivery path lands, the worker
 * will decrypt in-place.
 */

declare const self: DedicatedWorkerGlobalScope;

const post = (msg: WorkerToMainMessage): void => self.postMessage(msg);

interface EntityConfig {
  fields: string[];
  storeFields: string[];
}

const ENTITY_CONFIG: Record<SyncEntityType, EntityConfig> = {
  blocks: {
    fields: ["name", "notes", "text", "labels"],
    storeFields: ["id"],
  },
  stacks: {
    fields: ["name", "notes", "renderedContent"],
    storeFields: ["id"],
  },
  snapshots: {
    fields: ["name", "notes", "renderedContent"],
    storeFields: ["id"],
  },
  wildcards: {
    fields: ["name", "content"],
    storeFields: ["id"],
  },
  templates: {
    fields: ["name", "notes"],
    storeFields: ["id"],
  },
};

interface IndexedDoc {
  id: number;
  name?: string;
  notes?: string;
  text?: string;
  labels?: string;
  renderedContent?: string;
  content?: string;
}

/**
 * Decrypt any envelope fields in a row using the module-scope derived key.
 * Plaintext and non-string fields pass through. Without a key, envelope fields
 * remain as ciphertext (they'll show up as opaque JSON to the indexer — that
 * only happens in the degenerate case where encrypted data arrives before the
 * key; the context is structured to send setKey first).
 */
async function decryptRow(
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...row };
  if (!derivedKey) return out;
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && isEnvelope(v)) {
      out[k] = await decryptEnvelope(v, derivedKey);
    } else if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      isEnvelopeObj(v)
    ) {
      // Object-shaped envelope (e.g. `meta` — the storage adapter JSON.parses
      // the column before it gets here, so the envelope arrives unwrapped).
      const plaintext = await decryptEnvelope(JSON.stringify(v), derivedKey);
      out[k] = plaintext != null ? JSON.parse(plaintext) : null;
    } else if (Array.isArray(v)) {
      out[k] = await Promise.all(
        v.map(async (item) => {
          if (typeof item === "string" && isEnvelope(item)) {
            return await decryptEnvelope(item, derivedKey!);
          }
          return item;
        }),
      );
    }
  }
  return out;
}

/**
 * Flatten a (decrypted) row into the shape MiniSearch expects. Pure shape
 * mapping — any envelope unwrapping is already handled by `decryptRow`.
 */
function toIndexedDoc(
  entityType: SyncEntityType,
  row: Record<string, unknown>,
): IndexedDoc {
  const doc: IndexedDoc = { id: row.id as number };
  const fields = ENTITY_CONFIG[entityType].fields;
  for (const field of fields) {
    const raw = row[field];
    if (field === "labels" && Array.isArray(raw)) {
      doc.labels = raw
        .filter((v): v is string => typeof v === "string")
        .join(" ");
      continue;
    }
    const passed = unwrapValue(typeof raw === "string" ? raw : null);
    if (passed != null) {
      (doc as unknown as Record<string, unknown>)[field] = passed;
    }
  }
  return doc;
}

class EntityStore {
  // Raw rows as-stored (possibly with encrypted fields). Kept so we can return
  // the full item in search hits and re-index on change without re-fetching.
  private rows = new Map<number, Record<string, unknown>>();
  private index: MiniSearch<IndexedDoc>;

  constructor(private readonly entityType: SyncEntityType) {
    const cfg = ENTITY_CONFIG[entityType];
    this.index = new MiniSearch<IndexedDoc>({
      fields: cfg.fields,
      storeFields: cfg.storeFields,
      idField: "id",
    });
  }

  async loadFromCache(rows: Record<string, unknown>[]): Promise<void> {
    this.rows.clear();
    this.index.removeAll();
    const docs: IndexedDoc[] = [];
    for (const row of rows) {
      const id = row.id as number;
      const decrypted = await decryptRow(row);
      this.rows.set(id, decrypted);
      docs.push(toIndexedDoc(this.entityType, decrypted));
    }
    this.index.addAll(docs);
  }

  async applyDelta(
    upserts: Array<Record<string, unknown>>,
    deletedIds: number[],
  ): Promise<void> {
    for (const id of deletedIds) {
      if (this.rows.has(id)) {
        this.rows.delete(id);
        this.index.discard(id);
      }
    }
    for (const row of upserts) {
      const id = row.id as number;
      if (this.rows.has(id)) {
        this.index.discard(id);
      }
      const decrypted = await decryptRow(row);
      this.rows.set(id, decrypted);
      this.index.add(toIndexedDoc(this.entityType, decrypted));
    }
  }

  search(query: string, options?: SearchOptions): SearchHit[] {
    if (!query.trim()) return [];
    const results = this.index.search(query, {
      prefix: options?.prefix ?? true,
      fuzzy: options?.fuzzy ?? 0.2,
    });
    const limited = options?.limit ? results.slice(0, options.limit) : results;
    return limited
      .map((r): SearchHit | null => {
        const item = this.rows.get(r.id as number);
        if (!item) return null;
        return { id: r.id as number, score: r.score, item };
      })
      .filter((h): h is SearchHit => h !== null);
  }

  count(): number {
    return this.rows.size;
  }
}

const stores: Record<SyncEntityType, EntityStore> = {
  blocks: new EntityStore("blocks"),
  stacks: new EntityStore("stacks"),
  snapshots: new EntityStore("snapshots"),
  wildcards: new EntityStore("wildcards"),
  templates: new EntityStore("templates"),
};

let db: IDBPDatabase | null = null;
// Derived key lives only in worker memory for the session. Used to decrypt
// envelope fields before they reach MiniSearch — not yet wired into the
// indexing path (will swap in once write-side encryption lands).
let derivedKey: Uint8Array | null = null;

async function init(): Promise<void> {
  db = await openSyncDB();
  for (const entityType of ENTITY_TYPES) {
    const rows = await readAll<Record<string, unknown>>(db, entityType);
    await stores[entityType].loadFromCache(rows);
  }
  post({ type: "ready" });
}

async function applySync(
  entityType: SyncEntityType,
  items: Array<Record<string, unknown> & { id: number }>,
  existingIds: number[],
  serverTime: string,
): Promise<void> {
  if (!db) throw new Error("Worker not initialized");

  const localRows = await readAll<{ id: number }>(db, entityType);
  // Check after accounting for this batch — a missing id that's in `items`
  // isn't actually missing, it's being filled in right now.
  const postApplyLocalIds = [
    ...localRows.map((r) => r.id),
    ...items.map((i) => i.id),
  ];
  const { deletedIds, missingIds } = diffExistingIds(
    postApplyLocalIds,
    existingIds,
  );

  await writeBatch(db, entityType, items, deletedIds);

  if (missingIds.length > 0) {
    // Drop lastSync so the next full fetch (driven by the main thread) can't
    // be short-circuited into another torn delta. The in-memory index is
    // about to be rebuilt by the incoming full resync, so don't bother
    // partially updating it here.
    await clearMeta(db, entityType);
    post({
      type: "resyncNeeded",
      entityType,
      missingCount: missingIds.length,
    });
    return;
  }

  await setMeta(db, entityType, { lastSync: serverTime });
  await stores[entityType].applyDelta(items, deletedIds);

  post({
    type: "synced",
    entityType,
    lastSync: serverTime,
    itemCount: stores[entityType].count(),
  });
}

self.addEventListener("message", (event: MessageEvent<MainToWorkerMessage>) => {
  const msg = event.data;
  (async () => {
    try {
      switch (msg.type) {
        case "init":
          await init();
          break;
        case "setKey": {
          const bin = atob(msg.key);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          derivedKey = bytes;
          console.log(
            `[sync worker] derived key delivered (${derivedKey.length} bytes)`,
          );
          break;
        }
        case "applySync":
          await applySync(
            msg.entityType,
            msg.items,
            msg.existingIds,
            msg.serverTime,
          );
          break;
        case "pushChange": {
          if (!db) throw new Error("Worker not initialized");
          await writeBatch(db, msg.entityType, msg.upserts, msg.deletedIds);
          await stores[msg.entityType].applyDelta(msg.upserts, msg.deletedIds);
          break;
        }
        case "search": {
          const hits = stores[msg.entityType].search(msg.query, msg.options);
          post({
            type: "searchResult",
            requestId: msg.requestId,
            hits,
          });
          break;
        }
      }
    } catch (err) {
      post({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
        context: msg.type,
      });
    }
  })();
});

/**
 * Expose the lastSync cursors to the main thread via IDB directly — the
 * context opens the same DB to read `sync:<entityType>` meta entries before
 * deciding what `since` value to send on each export call. That keeps the
 * fetch logic (tRPC, auth) on the main thread and the worker focused on
 * indexing.
 */
export type { SyncMeta } from "@/lib/sync-idb";
