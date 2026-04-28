import { useEffect, useState } from "react";
import { useSync } from "@/contexts/SyncContext";
import type { SyncEntityType } from "@/lib/sync-idb";

/**
 * Paginated wrapper around the worker's exact label-filter API. Mirrors the
 * shape of `useWorkerSearch` so pages can swap between text-search mode and
 * label-filter mode without reshaping render code.
 *
 * Unlike search, this does not run the MiniSearch index — it returns rows
 * whose `labels` array contains an exact match for `label`.
 */
export interface WorkerLabelResult<T> {
  items: T[];
  total: number;
  isLoading: boolean;
}

export function useWorkerLabel<T>(
  entityType: SyncEntityType,
  label: string,
  options: { pageSize: number; page: number },
): WorkerLabelResult<T> {
  const { listByLabel, ready, status } = useSync();
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Re-query when the entity's lastSync advances — covers the refresh case
  // where the page lands with `?label=...` in the URL before the worker has
  // finished loading IDB / running the initial sync. Without this, the first
  // listByLabel call returns [] from an empty in-memory store and the UI
  // sticks on the empty state even after data arrives.
  const lastSync = status[entityType].lastSync;

  useEffect(() => {
    if (!label) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    if (!ready || !lastSync) {
      // Worker not yet warmed up; show loading so the empty state doesn't
      // flash, and let the next effect run (triggered by lastSync) fetch.
      setIsLoading(true);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listByLabel<T>(entityType, label)
      .then((results) => {
        if (cancelled) return;
        setItems(results);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, label, listByLabel, ready, lastSync]);

  const offset = options.page * options.pageSize;
  const paged = items.slice(offset, offset + options.pageSize);
  return { items: paged, total: items.length, isLoading };
}
