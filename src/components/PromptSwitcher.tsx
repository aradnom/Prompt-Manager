import { useState, useEffect, useRef } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { useActiveStack } from "@/contexts/ActiveStackContext";
import { useWorkerSearch } from "@/hooks/useWorkerSearch";
import type { BlockStack } from "@/types/schema";

export function PromptSwitcher() {
  const { activeStack, setActiveStack } = useActiveStack();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { items: searchResults } = useWorkerSearch<BlockStack>(
    "stacks",
    debouncedSearch,
    { pageSize: 50, page: 0 },
  );

  // Open dropdown when there are results
  useEffect(() => {
    if (
      debouncedSearch.length > 0 &&
      searchResults &&
      searchResults.length > 0
    ) {
      setIsOpen(true);
    } else if (debouncedSearch.length === 0) {
      setIsOpen(false);
    }
  }, [debouncedSearch, searchResults]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (stack: BlockStack) => {
    setActiveStack(stack);
    setSearch("");
    setDebouncedSearch("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative mb-4">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Switch prompt..."
      />

      {isOpen && searchResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto bg-background border border-cyan-medium rounded-lg shadow-xl">
          {searchResults.map((stack) => {
            const isActive = activeStack?.id === stack.id;
            return (
              <button
                key={stack.id}
                onClick={() => !isActive && handleSelect(stack)}
                disabled={isActive}
                className={`w-full text-left px-4 py-2 flex items-baseline gap-2 transition-colors ${
                  isActive
                    ? "opacity-40 cursor-default"
                    : "hover:bg-cyan-dark/50 cursor-pointer"
                }`}
              >
                <span className="font-medium truncate">
                  {stack.name || stack.displayId}
                </span>
                {stack.name && (
                  <span className="text-xs text-cyan-medium font-mono shrink-0">
                    {stack.displayId}
                  </span>
                )}
                {isActive && (
                  <span className="text-xs text-cyan-medium shrink-0">
                    (active)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {isOpen && debouncedSearch.length > 0 && searchResults?.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-cyan-medium rounded-lg shadow-xl px-4 py-3 text-sm text-cyan-medium">
          No prompts found
        </div>
      )}
    </div>
  );
}
