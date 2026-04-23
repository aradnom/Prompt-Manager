import { useEffect, useState } from "react";
import { useSync } from "@/contexts/SyncContext";
import type { SyncEntityType } from "@/lib/sync-idb";
import type { SearchHit } from "@/workers/sync-worker-protocol";

/**
 * Generic paginated wrapper around the sync worker's search API.
 *
 * Returns a `{ items, total, isLoading }` shape compatible with the
 * server-side paginated endpoints, so pages can swap a `useQuery` call for
 * `useWorkerSearch` without reshaping the render code.
 *
 * The worker returns all matches ranked by score — this hook holds the full
 * list and slices locally for the current page. With per-user row counts
 * bounded in the hundreds to low thousands for any entity, the slice cost is
 * negligible and the UX wins (instant page changes, no round-trip) are worth
 * skipping server-side pagination.
 */
export interface WorkerSearchResult<T> {
  items: T[];
  total: number;
  isLoading: boolean;
}

export function useWorkerSearch<T>(
  entityType: SyncEntityType,
  query: string,
  options: { pageSize: number; page: number },
): WorkerSearchResult<T> {
  const { search } = useSync();
  const [hits, setHits] = useState<SearchHit<T>[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setHits([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    search<T>(entityType, query)
      .then((results) => {
        if (cancelled) return;
        setHits(results);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHits([]);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, query, search]);

  const offset = options.page * options.pageSize;
  const items = hits
    .slice(offset, offset + options.pageSize)
    .map((h) => h.item);
  return { items, total: hits.length, isLoading };
}
