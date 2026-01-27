import { useState } from "react";
import { api } from "@/lib/api";
import { extractWildcardValues } from "@/lib/wildcard-value-extractor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ChevronRight, ChevronDown } from "lucide-react";

interface WildcardBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (displayId: string, path?: string) => void;
}

export function WildcardBrowser({
  open,
  onOpenChange,
  onSelect,
}: WildcardBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedWildcards, setExpandedWildcards] = useState<Set<number>>(
    new Set(),
  );
  const { data: wildcards, isLoading } = api.wildcards.list.useQuery();

  const filteredWildcards = wildcards?.filter((wildcard) => {
    const query = searchQuery.toLowerCase();
    return (
      wildcard.displayId.toLowerCase().includes(query) ||
      wildcard.name.toLowerCase().includes(query) ||
      wildcard.content.toLowerCase().includes(query)
    );
  });

  const handleSelect = (displayId: string, path?: string) => {
    onSelect(displayId, path);
    onOpenChange(false);
    setSearchQuery("");
    setExpandedWildcards(new Set());
  };

  const toggleExpanded = (wildcardId: number) => {
    setExpandedWildcards((prev) => {
      const next = new Set(prev);
      if (next.has(wildcardId)) {
        next.delete(wildcardId);
      } else {
        next.add(wildcardId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Insert Wildcard</DialogTitle>
          <DialogDescription>
            Search and select a wildcard to insert
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <input
            type="text"
            placeholder="Search wildcards..."
            className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />

          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : filteredWildcards && filteredWildcards.length > 0 ? (
              filteredWildcards.map((wildcard) => {
                const isExpanded = expandedWildcards.has(wildcard.id);
                const values = extractWildcardValues(
                  wildcard.content,
                  wildcard.format,
                );

                return (
                  <div
                    key={wildcard.id}
                    className="border border-cyan-medium rounded-md"
                  >
                    <div className="flex items-start justify-between gap-2 p-3">
                      <button
                        onClick={() => toggleExpanded(wildcard.id)}
                        className="flex items-start gap-2 flex-1 min-w-0 text-left hover:bg-cyan-dark/50 -m-1 p-1 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{wildcard.name}</div>
                          <div className="text-sm text-cyan-medium font-mono">
                            {wildcard.displayId}
                          </div>
                          {!isExpanded && (
                            <div className="text-sm text-cyan-medium mt-1">
                              {values.length} value
                              {values.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      </button>
                      <div className="text-xs text-cyan-medium capitalize px-2 py-1 bg-cyan-dark rounded">
                        {wildcard.format}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-cyan-medium px-3 py-2 space-y-1 bg-cyan-dark/30">
                        {values.length > 0 ? (
                          values.map((value, idx) => (
                            <button
                              key={idx}
                              onClick={() =>
                                handleSelect(wildcard.displayId, value.path)
                              }
                              className="w-full text-left p-2 rounded hover:bg-cyan-dark transition-colors text-sm"
                            >
                              <div className="font-mono text-xs text-cyan-medium mb-1">
                                {value.displayPath}
                              </div>
                              <div className="truncate">{value.value}</div>
                            </button>
                          ))
                        ) : (
                          <div className="text-sm text-cyan-medium italic p-2">
                            No values found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-cyan-medium">
                {searchQuery ? "No wildcards found" : "No wildcards available"}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
