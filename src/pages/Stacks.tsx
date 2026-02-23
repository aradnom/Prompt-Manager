import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { api, RouterOutput } from "@/lib/api";
import {
  generateDisplayId,
  normalizeDisplayIdWithSuffix,
} from "@/lib/generate-display-id";
import { generateUUID } from "@/lib/uuid";
import { useActiveStack } from "@/contexts/ActiveStackContext";
import { StackEditForm } from "@/components/StackEditForm";
import { RasterIcon } from "@/components/RasterIcon";
import { FolderRow } from "@/components/FolderRow";
import { SearchInput } from "@/components/ui/search-input";
import { DotDivider } from "@/components/ui/dot-divider";
import {
  ArrowLeft,
  Clock,
  Folder,
  Trash2,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Camera,
  LayoutTemplate,
} from "lucide-react";

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
import { NotesDialog } from "@/components/NotesDialog";
import { StackRevisionsOverlay } from "@/components/StackRevisionsOverlay";
import { LENGTH_LIMITS } from "@shared/limits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 20;

interface StackCardProps {
  stack: Stack;
  showRevisionsForStack: number | null;
  onStackClick: (stackId: number, stack: Stack) => void;
  onMakeActive: (stack: Stack) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
  onShowRevisions: (stackId: number) => void;
  onCloseRevisions: () => void;
  duplicateIsPending: boolean;
  index: number;
  isFirst: boolean;
}

function StackCard({
  stack,
  showRevisionsForStack,
  onStackClick,
  onMakeActive,
  onDuplicate,
  onDelete,
  onShowRevisions,
  onCloseRevisions,
  duplicateIsPending,
  index,
  isFirst,
}: StackCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(stack.name ?? "");
  const utils = api.useUtils();

  const renameMutation = api.stacks.update.useMutation({
    onSuccess: () => {
      utils.stacks.list.invalidate();
      utils.stacks.listWithFolders.invalidate();
      utils.stacks.search.invalidate();
    },
  });

  const saveName = () => {
    const trimmed = editNameValue.trim();
    const newName = trimmed || undefined;
    if ((newName ?? null) !== (stack.name ?? null)) {
      renameMutation.mutate({ id: stack.id, name: newName });
    }
    setIsEditingName(false);
  };

  return (
    <motion.div
      key={stack.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      data-stack-card
      className={cn("relative rounded", isFirst && "accent-border-gradient")}
    >
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button")) {
              onStackClick(stack.id, stack);
            }
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <input
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") {
                        setEditNameValue(stack.name ?? "");
                        setIsEditingName(false);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Enter prompt name..."
                    className="text-lg font-semibold px-2 py-0.5 border-inline-input"
                    maxLength={LENGTH_LIMITS.name}
                    autoFocus
                  />
                ) : (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CardTitle
                          className="text-xl cursor-pointer hover:text-magenta-light transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditNameValue(stack.name ?? "");
                            setIsEditingName(true);
                          }}
                        >
                          {stack.name || stack.displayId}
                        </CardTitle>
                      </TooltipTrigger>
                      <TooltipContent>Click to rename</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowRevisions(stack.id);
                        }}
                        className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Show revisions"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>View prompt history</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription className="text-xs mt-2">
                {stack.blockIds.length} block
                {stack.blockIds.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStackClick(stack.id, stack);
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
                          onDuplicate(stack.id);
                        }}
                        disabled={duplicateIsPending}
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
              </ButtonGroup>

              <Button
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMakeActive(stack);
                }}
                className="cursor-pointer"
              >
                Make Active
              </Button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(stack.id);
                }}
                className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
                aria-label="Delete stack"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Revisions overlay */}
      <AnimatePresence>
        {showRevisionsForStack === stack.id && (
          <StackRevisionsOverlay
            stackId={stack.id}
            activeRevisionId={stack.activeRevisionId}
            onClose={onCloseRevisions}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StackFolderContent({
  folderId,
  showRevisionsForStack,
  onStackClick,
  onMakeActive,
  onDuplicate,
  onDeleteStack,
  onShowRevisions,
  onCloseRevisions,
  duplicateIsPending,
}: {
  folderId: number;
  showRevisionsForStack: number | null;
  onStackClick: (stackId: number, stack: Stack) => void;
  onMakeActive: (stack: Stack) => void;
  onDuplicate: (id: number) => void;
  onDeleteStack: (id: number) => void;
  onShowRevisions: (stackId: number) => void;
  onCloseRevisions: () => void;
  duplicateIsPending: boolean;
}) {
  const { data: folderStacks, isLoading } = api.stackFolders.getStacks.useQuery(
    { folderId },
  );

  if (isLoading) {
    return (
      <div className="text-center py-4 text-cyan-medium">
        Loading prompts...
      </div>
    );
  }

  if (!folderStacks || folderStacks.length === 0) {
    return (
      <div className="text-center py-4 text-cyan-medium">
        No prompts in this folder
      </div>
    );
  }

  return (
    <>
      {folderStacks.map((stack, stackIndex) => (
        <StackCard
          key={stack.id}
          stack={stack}
          showRevisionsForStack={showRevisionsForStack}
          onStackClick={onStackClick}
          onMakeActive={onMakeActive}
          onDuplicate={onDuplicate}
          onDelete={onDeleteStack}
          onShowRevisions={onShowRevisions}
          onCloseRevisions={onCloseRevisions}
          duplicateIsPending={duplicateIsPending}
          index={stackIndex}
          isFirst={false}
        />
      ))}
    </>
  );
}

function StackList() {
  const [isCreating, setIsCreating] = useState(false);
  const [displayId, setDisplayId] = useState("");
  const [name, setName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stackToDelete, setStackToDelete] = useState<number | null>(null);
  const [showRevisionsForStack, setShowRevisionsForStack] = useState<
    number | null
  >(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set(),
  );
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<number | null>(null);
  const navigate = useNavigate();
  const { setActiveStack } = useActiveStack();
  const utils = api.useUtils();

  const offset = page * PAGE_SIZE;

  const isSearchMode = debouncedSearch.length > 0;

  // Use listWithFolders when not searching
  const {
    data: foldersData,
    isLoading,
    refetch,
  } = api.stacks.listWithFolders.useQuery(
    {
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: !isSearchMode },
  );

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
      { enabled: isSearchMode },
    );

  // Calculate totals for pagination
  const total = isSearchMode
    ? (searchData?.total ?? 0)
    : (foldersData?.totalFolders ?? 0) + (foldersData?.totalLooseStacks ?? 0);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const showLoading = isSearchMode ? isSearching : isLoading;

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
      utils.stackFolders.getStacks.invalidate();
      navigate("/prompts");
    },
  });
  const duplicateMutation = api.stacks.duplicate.useMutation({
    onSuccess: () => {
      refetch();
      utils.stackFolders.getStacks.invalidate();
    },
  });

  const createFolderMutation = api.stackFolders.create.useMutation({
    onSuccess: () => {
      refetch();
      setNewFolderDialogOpen(false);
      setNewFolderName("");
    },
  });

  const deleteFolderMutation = api.stackFolders.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const renameFolderMutation = api.stackFolders.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const toggleFolder = (folderId: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

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

  const handleDeleteFolder = (folderId: number) => {
    setFolderToDelete(folderId);
    setDeleteFolderDialogOpen(true);
  };

  const confirmDeleteFolder = () => {
    if (folderToDelete !== null) {
      deleteFolderMutation.mutate({ id: folderToDelete });
      setFolderToDelete(null);
    }
  };

  const handleMakeActive = (stack: Stack) => {
    setActiveStack(stack);
    navigate("/");
  };

  const handleDuplicate = (id: number) => {
    duplicateMutation.mutate({ id });
  };

  const handleStackClick = (_stackId: number, stack: Stack) => {
    navigate(`/prompts/${stack.displayId}`);
  };

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
                  maxLength={LENGTH_LIMITS.name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDisplayId(normalizeDisplayIdWithSuffix(e.target.value));
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
                    maxLength={LENGTH_LIMITS.displayId}
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
        <div className="mb-8 flex justify-end gap-2">
          <Link to="/snapshots">
            <Button variant="outline">
              <Camera className="h-4 w-4 mr-2" />
              Prompt Snapshots
            </Button>
          </Link>
          <Link to="/templates">
            <Button variant="outline">
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Prompt Templates
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => setNewFolderDialogOpen(true)}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
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
          {isSearchMode ? "Searching..." : "Loading prompts..."}
        </div>
      ) : isSearchMode ? (
        // Search mode: flat list of stacks
        searchData && searchData.items.length > 0 ? (
          <>
            <div className="space-y-4">
              {searchData.items.map((stack, index) => (
                <StackCard
                  key={stack.id}
                  stack={stack}
                  showRevisionsForStack={showRevisionsForStack}
                  onStackClick={handleStackClick}
                  onMakeActive={handleMakeActive}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onShowRevisions={setShowRevisionsForStack}
                  onCloseRevisions={() => setShowRevisionsForStack(null)}
                  duplicateIsPending={duplicateMutation.isPending}
                  index={index}
                  isFirst={index === 0 && page === 0}
                />
              ))}
            </div>

            {searchData.total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-6">
                <span className="text-sm text-cyan-medium">
                  Showing {offset + 1}&ndash;
                  {Math.min(offset + PAGE_SIZE, searchData.total)} of{" "}
                  {searchData.total}
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
        ) : (
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
        )
      ) : foldersData &&
        (foldersData.folders.length > 0 ||
          foldersData.looseStacks.length > 0) ? (
        // Folder mode: folders first, then loose stacks
        <>
          <div className="space-y-4">
            {/* Folders */}
            {foldersData.folders.map((folder, index) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                index={index}
                isExpanded={expandedFolders.has(folder.id)}
                onToggle={() => toggleFolder(folder.id)}
                onDelete={() => handleDeleteFolder(folder.id)}
                onRename={(id, name) =>
                  renameFolderMutation.mutate({ id, name })
                }
                deleteTooltip="Delete folder. Will not delete prompts in the folder."
              >
                <StackFolderContent
                  folderId={folder.id}
                  showRevisionsForStack={showRevisionsForStack}
                  onStackClick={handleStackClick}
                  onMakeActive={handleMakeActive}
                  onDuplicate={handleDuplicate}
                  onDeleteStack={handleDelete}
                  onShowRevisions={setShowRevisionsForStack}
                  onCloseRevisions={() => setShowRevisionsForStack(null)}
                  duplicateIsPending={duplicateMutation.isPending}
                />
              </FolderRow>
            ))}

            {/* Loose stacks */}
            {foldersData.looseStacks.map((stack, index) => (
              <StackCard
                key={stack.id}
                stack={stack}
                showRevisionsForStack={showRevisionsForStack}
                onStackClick={handleStackClick}
                onMakeActive={handleMakeActive}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onShowRevisions={setShowRevisionsForStack}
                onCloseRevisions={() => setShowRevisionsForStack(null)}
                duplicateIsPending={duplicateMutation.isPending}
                index={foldersData.folders.length + index}
                isFirst={
                  index === 0 && page === 0 && foldersData.folders.length === 0
                }
              />
            ))}
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

      <ConfirmDialog
        open={deleteFolderDialogOpen}
        onOpenChange={setDeleteFolderDialogOpen}
        onConfirm={confirmDeleteFolder}
        title="Delete Folder"
        description="Are you sure you want to delete this folder? Prompts in the folder will not be deleted."
        confirmText="Delete"
        variant="destructive"
      />

      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Folder Name
              </label>
              <input
                type="text"
                placeholder="e.g., Portrait Prompts"
                className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
                value={newFolderName}
                maxLength={LENGTH_LIMITS.name}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim()) {
                    createFolderMutation.mutate({ name: newFolderName.trim() });
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setNewFolderDialogOpen(false);
                  setNewFolderName("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createFolderMutation.mutate({ name: newFolderName.trim() })
                }
                disabled={
                  !newFolderName.trim() || createFolderMutation.isPending
                }
              >
                {createFolderMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SinglePromptView({ displayId }: { displayId: string }) {
  const navigate = useNavigate();
  const { setActiveStack } = useActiveStack();
  const utils = api.useUtils();

  const {
    data: stack,
    isLoading,
    refetch,
  } = api.stacks.getByDisplayId.useQuery({
    displayId,
    includeBlocks: true,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);

  const updateMutation = api.stacks.update.useMutation({
    onSuccess: () => {
      utils.stacks.list.invalidate();
      utils.stacks.listWithFolders.invalidate();
      utils.stacks.getByDisplayId.invalidate();
      refetch();
    },
  });

  const deleteMutation = api.stacks.delete.useMutation({
    onSuccess: () => {
      utils.stacks.list.invalidate();
      utils.stacks.listWithFolders.invalidate();
      navigate("/prompts");
    },
  });

  if (isLoading) {
    return (
      <main className="standard-page-container">
        <div className="text-center py-12 text-cyan-medium">
          Loading prompt...
        </div>
      </main>
    );
  }

  if (!stack) {
    return (
      <main className="standard-page-container">
        <div className="text-center py-12 text-cyan-medium">
          <p className="mb-4">Prompt not found</p>
          <Link to="/prompts">
            <Button variant="outline">Back to Prompts</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="standard-page-container">
      <div className="mb-8">
        <Link
          to="/prompts"
          className="inline-flex items-center gap-1.5 text-sm text-cyan-medium hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Prompts
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <RasterIcon name="chat" size={36} />
            {stack.name || stack.displayId}
          </h1>
          <div className="flex items-center gap-2">
            {stack.folderName && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-dark rounded text-xs text-cyan-medium">
                <Folder className="h-3 w-3" />
                {stack.folderName}
              </span>
            )}
            {stack.negative && (
              <span className="px-2 py-1 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-400">
                Negative
              </span>
            )}
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setNotesDialogOpen(true)}
                    className={`text-cyan-medium hover:text-foreground transition-colors cursor-pointer ${stack.notes ? "text-foreground" : ""}`}
                    aria-label="Edit notes"
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {stack.notes ? "Edit notes" : "Add notes"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="text-cyan-medium hover:text-destructive transition-colors cursor-pointer"
              aria-label="Delete prompt"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {stack.name && (
          <p className="text-cyan-medium font-mono text-sm mt-2 bg-background/60 inline-block px-2 py-1">
            {stack.displayId}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <StackEditForm
            stack={stack}
            stackDetails={stack}
            onClose={() => navigate("/prompts")}
          />
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={() => {
            setActiveStack(stack);
            navigate("/");
          }}
        >
          Make Active
        </Button>
      </div>

      <NotesDialog
        title="Prompt Notes"
        placeholder="Add notes about this prompt..."
        initialNotes={stack.notes}
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        onSave={(notes) => {
          updateMutation.mutate({ id: stack.id, notes });
        }}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          deleteMutation.mutate({ id: stack.id });
        }}
        title="Delete Prompt"
        description="Are you sure you want to delete this prompt? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </main>
  );
}

export default function Stacks() {
  const { displayId } = useParams<{ displayId: string }>();

  if (displayId) {
    return <SinglePromptView displayId={displayId} />;
  }

  return <StackList />;
}
