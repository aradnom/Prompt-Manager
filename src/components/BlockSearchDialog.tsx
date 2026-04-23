import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSync } from "@/contexts/SyncContext";
import { LENGTH_LIMITS } from "@shared/limits";
import type { Block } from "@/types/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BlockSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (blockId: number) => void;
  typeId?: number;
  labels?: string[];
}

/**
 * Picker dialog for existing blocks. Runs entirely against the sync worker:
 * the server can't match encrypted `name`/`text` or per-element encrypted
 * `labels`, so both text search and structured filters (typeId, labels) are
 * narrowed client-side against the worker's decrypted in-memory cache.
 */
export function BlockSearchDialog({
  open,
  onOpenChange,
  onSelect,
  typeId,
  labels,
}: BlockSearchDialogProps) {
  const { search, list } = useSync();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [allBlocks, setAllBlocks] = useState<Block[]>([]);
  const [queryHits, setQueryHits] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const hasStructuredFilter =
    typeId !== undefined || (labels !== undefined && labels.length > 0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setAllBlocks([]);
      setQueryHits([]);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Load every block into memory when the dialog opens with a structured
  // filter (typeId or labels). The set is bounded per-user, so this is cheap.
  useEffect(() => {
    if (!open || !hasStructuredFilter) return;
    let cancelled = false;
    setIsLoading(true);
    list<Block>("blocks")
      .then((items) => {
        if (cancelled) return;
        setAllBlocks(items);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAllBlocks([]);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, hasStructuredFilter, list]);

  // Text-search path: ask the worker for ranked hits.
  useEffect(() => {
    if (!open || hasStructuredFilter) return;
    if (!debouncedQuery) {
      setQueryHits([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    search<Block>("blocks", debouncedQuery)
      .then((hits) => {
        if (cancelled) return;
        setQueryHits(hits.map((h) => h.item));
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setQueryHits([]);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, hasStructuredFilter, debouncedQuery, search]);

  const filteredBlocks = useMemo<Block[]>(() => {
    if (hasStructuredFilter) {
      return allBlocks.filter((b) => {
        if (typeId !== undefined && b.typeId !== typeId) return false;
        if (labels && labels.length > 0) {
          const blockLabels = b.labels ?? [];
          const hit = labels.some((l) => blockLabels.includes(l));
          if (!hit) return false;
        }
        if (debouncedQuery) {
          const q = debouncedQuery.toLowerCase();
          const haystack = [b.name, b.displayId, b.text]
            .filter((v): v is string => typeof v === "string")
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
    }
    return queryHits;
  }, [
    hasStructuredFilter,
    allBlocks,
    typeId,
    labels,
    debouncedQuery,
    queryHits,
  ]);

  const typeName = filteredBlocks[0]?.type?.name;
  const getTitle = () => {
    if (typeId && typeName) return `Blocks: ${typeName}`;
    if (labels && labels.length > 0) return `Blocks: ${labels.join(", ")}`;
    return "Add Block";
  };

  const hasAnyFilter =
    debouncedQuery.length > 0 ||
    typeId !== undefined ||
    (labels !== undefined && labels.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25 p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        {!typeId && !labels && (
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-cyan-medium disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search blocks..."
              value={query}
              maxLength={LENGTH_LIMITS.searchQuery}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <div className="max-h-75 overflow-y-auto p-2">
          {isLoading ? (
            <div className="text-center py-6 text-sm text-cyan-medium">
              Searching...
            </div>
          ) : filteredBlocks.length > 0 ? (
            filteredBlocks.map((block) => (
              <div
                key={block.id}
                className="flex flex-col p-2 rounded-md hover:bg-cyan-dark cursor-pointer group"
                onClick={() => {
                  onSelect(block.id);
                  onOpenChange(false);
                }}
              >
                <span className="font-medium">{block.displayId}</span>
                <span className="text-xs text-cyan-medium truncate group-hover:text-foreground">
                  {block.text}
                </span>
              </div>
            ))
          ) : hasAnyFilter ? (
            <div className="text-center py-6 text-sm text-cyan-medium">
              No blocks found.
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-cyan-medium">
              Start typing to search blocks...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
