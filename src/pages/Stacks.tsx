import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { api, RouterOutput } from "@/lib/api";
import {
  generateDisplayId,
  normalizeDisplayId,
} from "@/lib/generate-display-id";
import { generateUUID } from "@/lib/uuid";
import { useActiveStack } from "@/contexts/ActiveStackContext";
import { StackEditForm } from "@/components/StackEditForm";
import { RasterIcon } from "@/components/RasterIcon";
import { SearchInput } from "@/components/ui/search-input";
import { DotDivider } from "@/components/ui/dot-divider";
import { X, Clock, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

type Stack = RouterOutput["stacks"]["list"]["items"][number];
import { Button } from "@/components/ui/button";
import { DisplayIdInput } from "@/components/ui/display-id-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ButtonGroup } from "@/components/ui/button-group";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const PAGE_SIZE = 20;

export default function Stacks() {
  const [isCreating, setIsCreating] = useState(false);
  const [displayId, setDisplayId] = useState("");
  const [name, setName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stackToDelete, setStackToDelete] = useState<number | null>(null);
  const [activeStackId, setActiveStackId] = useState<number | null>(null);
  const [showRevisionsForStack, setShowRevisionsForStack] = useState<
    number | null
  >(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const { displayId: urlDisplayId } = useParams<{ displayId: string }>();
  const { setActiveStack } = useActiveStack();

  const offset = page * PAGE_SIZE;

  const {
    data: stacksData,
    isLoading,
    refetch,
  } = api.stacks.list.useQuery({
    limit: PAGE_SIZE,
    offset,
  });
  const stacks = stacksData?.items;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch search results when there's a search query
  const { data: searchData, isLoading: isSearching } =
    api.stacks.search.useQuery(
      {
        query: debouncedSearch.length > 0 ? debouncedSearch : undefined,
        limit: PAGE_SIZE,
        offset,
      },
      { enabled: debouncedSearch.length > 0 },
    );

  // Use search results if searching, otherwise use all stacks
  const currentData = debouncedSearch.length > 0 ? searchData : stacksData;
  const displayStacks = currentData?.items;
  const total = currentData?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const showLoading = debouncedSearch.length > 0 ? isSearching : isLoading;
  const { data: activeStackDetails } = api.stacks.get.useQuery(
    { id: activeStackId!, includeBlocks: true, includeRevisions: false },
    { enabled: activeStackId !== null },
  );
  const { data: blocksData } = api.blocks.list.useQuery();
  const blocks = blocksData?.items;
  const revisionsQuery = api.stacks.getRevisions.useQuery(
    { stackId: showRevisionsForStack! },
    { enabled: showRevisionsForStack !== null },
  );
  const utils = api.useUtils();
  const createMutation = api.stacks.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreating(false);
      setDisplayId("");
      setName("");
    },
  });
  const deleteMutation = api.stacks.delete.useMutation({
    onSuccess: () => {
      refetch();
      setActiveStackId(null);
      navigate("/prompts");
    },
  });
  const duplicateMutation = api.stacks.duplicate.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  const setActiveRevisionMutation = api.stacks.setActiveRevision.useMutation({
    onSuccess: () => {
      utils.stacks.list.invalidate();
      utils.stacks.get.invalidate();
    },
  });

  const handleCreate = () => {
    if (!displayId.trim()) return;

    createMutation.mutate({
      uuid: generateUUID(),
      displayId: displayId.trim(),
      name: name.trim() || undefined,
    });
  };

  const handleDelete = (id: number) => {
    setStackToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (stackToDelete !== null) {
      deleteMutation.mutate({ id: stackToDelete });
      setStackToDelete(null);
    }
  };

  const handleMakeActive = (stack: Stack) => {
    setActiveStack(stack);
    navigate("/");
  };

  const handleDuplicate = (id: number) => {
    duplicateMutation.mutate({ id });
  };

  const handleStackClick = (stackId: number, stack: Stack) => {
    if (activeStackId === stackId) {
      setActiveStackId(null);
      navigate("/prompts");
    } else {
      setActiveStackId(stackId);
      navigate(`/prompts/${stack.displayId}`);
    }
  };

  // Sort revisions to put active one first
  const sortedRevisions = useMemo(() => {
    if (!revisionsQuery.data || !showRevisionsForStack) return [];

    const stack = stacks?.find((s) => s.id === showRevisionsForStack);
    const revisions = [...revisionsQuery.data];
    const activeRevisionId = stack?.activeRevisionId;

    if (activeRevisionId) {
      revisions.sort((a, b) => {
        if (a.id === activeRevisionId) return -1;
        if (b.id === activeRevisionId) return 1;
        return 0;
      });
    }

    return revisions;
  }, [revisionsQuery.data, showRevisionsForStack, stacks]);

  // Helper to get block display name
  const getBlockDisplayName = (blockId: number) => {
    const block = blocks?.find((b) => b.id === blockId);
    return block ? block.name || block.displayId : `Block ${blockId}`;
  };

  // Open stack from URL parameter
  useEffect(() => {
    if (urlDisplayId && stacks) {
      const matchingStack = stacks.find((s) => s.displayId === urlDisplayId);
      if (matchingStack) {
        setActiveStackId(matchingStack.id);
      }
    } else if (!urlDisplayId) {
      setActiveStackId(null);
    }
  }, [urlDisplayId, stacks]);

  // Close active state and revisions when clicking outside
  useEffect(() => {
    if (!activeStackId && !showRevisionsForStack) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't close if clicking inside the stack card
      if (target.closest("[data-stack-card]")) return;

      // Don't close if clicking inside a dropdown menu
      if (target.closest('[role="menu"]')) return;

      // Don't close if there's an open dropdown (let the dropdown handle the click first)
      // Check for Radix UI dropdown portal
      const hasOpenDropdown = document.querySelector(
        "[data-radix-popper-content-wrapper]",
      );
      if (hasOpenDropdown) return;

      setActiveStackId(null);
      setShowRevisionsForStack(null);
      navigate("/prompts");
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeStackId, showRevisionsForStack]);

  return (
    <main className="standard-page-container">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="chat" size={36} />
          Prompts
        </h1>
        <p className="text-cyan-medium">
          <mark className="highlighted-text">Manage your prompts</mark>
        </p>
      </div>

      {isCreating ? (
        <Card className="mb-8 bg-cyan-dark">
          <CardHeader>
            <CardTitle>Create New Prompt</CardTitle>
            <CardDescription>
              Enter a memorable ID for your new prompt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Summer Landscape"
                  className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDisplayId(normalizeDisplayId(e.target.value));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setDisplayId("");
                      setName("");
                    }
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Display ID
                </label>
                <div className="flex gap-2">
                  <DisplayIdInput
                    placeholder="e.g., summer-landscape-v1"
                    className="flex-1"
                    value={displayId}
                    onChange={setDisplayId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") {
                        setIsCreating(false);
                        setDisplayId("");
                        setName("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setDisplayId(generateDisplayId())}
                    type="button"
                  >
                    Regenerate
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setDisplayId("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mb-8 flex justify-end">
          <Button
            onClick={() => {
              setIsCreating(true);
              setDisplayId(generateDisplayId());
            }}
          >
            Create New Prompt
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="mb-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search prompts by name, display ID, UUID, or content..."
        />
      </div>

      <DotDivider className="mb-2" />

      {showLoading ? (
        <div className="text-center py-12 text-cyan-medium">
          {debouncedSearch.length > 0 ? "Searching..." : "Loading prompts..."}
        </div>
      ) : displayStacks && displayStacks.length > 0 ? (
        <>
          <div className="space-y-4">
            {displayStacks.map((stack, index) => {
              const isActive = activeStackId === stack.id;
              return (
                <motion.div
                  key={stack.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  data-stack-card
                  className={cn(
                    "relative border-standard-dark-cyan",
                    index === 0 && page === 0 && "accent-border-gradient",
                  )}
                >
                  <Card
                    className={`transition-all ${isActive ? "ring-2 ring-magenta-dark" : ""}`}
                  >
                    <CardHeader
                      className="cursor-pointer"
                      onClick={(e) => {
                        // Don't toggle if clicking on buttons
                        if (!(e.target as HTMLElement).closest("button")) {
                          handleStackClick(stack.id, stack);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-xl">
                              {stack.name || stack.displayId}
                            </CardTitle>
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowRevisionsForStack(stack.id);
                                    }}
                                    className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
                                    aria-label="Show revisions"
                                  >
                                    <Clock className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  View prompt history
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <CardDescription className="text-xs mt-2">
                            {stack.blockIds.length} block
                            {stack.blockIds.length !== 1 ? "s" : ""}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStackClick(stack.id, stack);
                            }}
                            className="cursor-pointer"
                          >
                            Edit Prompt
                          </Button>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(stack.id);
                                  }}
                                  disabled={duplicateMutation.isPending}
                                  className="cursor-pointer"
                                >
                                  Duplicate Prompt
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Creates a shallow copy (references same blocks)
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMakeActive(stack);
                            }}
                            className="cursor-pointer"
                          >
                            Make Active
                          </Button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(stack.id);
                            }}
                            className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
                            aria-label="Delete stack"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <AnimatePresence>
                      {isActive && activeStackDetails && (
                        <StackEditForm
                          stack={stack}
                          stackDetails={activeStackDetails}
                          onClose={() => setActiveStackId(null)}
                        />
                      )}
                    </AnimatePresence>
                  </Card>

                  {/* Revisions overlay */}
                  <AnimatePresence>
                    {showRevisionsForStack === stack.id && (
                      <motion.div
                        className="absolute inset-0 bg-background z-20 rounded-lg overflow-hidden border"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowRevisionsForStack(null);
                          }}
                          className="absolute right-2 top-2 z-30 text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
                          aria-label="Close revisions"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="flex gap-4 overflow-x-auto h-full p-4 ml mr-8">
                          {revisionsQuery.isLoading ? (
                            <div className="flex items-center justify-center w-full">
                              <p className="text-sm text-cyan-medium">
                                Loading revisions...
                              </p>
                            </div>
                          ) : sortedRevisions.length > 0 ? (
                            sortedRevisions.map((revision) => {
                              const isActiveRevision =
                                revision.id === stack.activeRevisionId;
                              return (
                                <div
                                  key={revision.id}
                                  className="shrink-0 w-100 h-full border rounded-md p-4 bg-cyan-dark flex flex-col cursor-pointer hover:bg-cyan-dark/80 transition-colors relative"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await setActiveRevisionMutation.mutateAsync(
                                        {
                                          stackId: stack.id,
                                          revisionId: revision.id,
                                        },
                                      );
                                      setShowRevisionsForStack(null);
                                    } catch (error) {
                                      console.error(
                                        "Failed to set active revision:",
                                        error,
                                      );
                                    }
                                  }}
                                >
                                  {isActiveRevision && (
                                    <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-md bg-magenta-dark text-foreground">
                                      Active
                                    </div>
                                  )}
                                  <div className="space-y-1 mb-3">
                                    <p className="text-xs text-cyan-medium">
                                      <span className="font-medium">
                                        Created:
                                      </span>{" "}
                                      {new Date(
                                        revision.createdAt,
                                      ).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-cyan-medium">
                                      <span className="font-medium">
                                        Updated:
                                      </span>{" "}
                                      {new Date(
                                        revision.updatedAt,
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex-1 overflow-auto">
                                    <p className="text-xs font-medium mb-2">
                                      Blocks ({revision.blockIds.length}):
                                    </p>
                                    {revision.blockIds.length > 0 ? (
                                      <ol className="space-y-1 text-sm list-decimal list-inside">
                                        {revision.blockIds.map(
                                          (blockId: number) => (
                                            <li
                                              key={blockId}
                                              className="text-foreground"
                                            >
                                              {getBlockDisplayName(blockId)}
                                            </li>
                                          ),
                                        )}
                                      </ol>
                                    ) : (
                                      <p className="text-xs text-cyan-medium italic">
                                        No blocks
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex items-center justify-center w-full">
                              <p className="text-sm text-cyan-medium">
                                No revisions found
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-cyan-medium">
                Showing {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)}{" "}
                of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                >
                  First
                </Button>
                <ButtonGroup>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-28"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-28"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage(lastPage)}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </>
      ) : debouncedSearch.length > 0 ? (
        <Card>
          <CardContent className="py-12 border-standard-dark-cyan">
            <div className="text-center text-cyan-medium">
              <p className="mb-4">
                No prompts found matching "{debouncedSearch}"
              </p>
              <Button onClick={() => setSearch("")} variant="outline">
                Clear Search
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-cyan-medium">
              <p className="mb-4">No prompts yet</p>
              <Button
                onClick={() => {
                  setIsCreating(true);
                  setDisplayId(generateDisplayId());
                }}
              >
                Create Your First Prompt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Prompt"
        description="Are you sure you want to delete this prompt? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </main>
  );
}
