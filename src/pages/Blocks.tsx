import { useState, useEffect } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { motion } from "motion/react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { generateUUID } from "@/lib/uuid";
import { useSync } from "@/contexts/SyncContext";
import { useWorkerSearch } from "@/hooks/useWorkerSearch";
import { useWorkerLabel } from "@/hooks/useWorkerLabel";
import type { Block } from "@/types/schema";

import { TextBlock } from "@/components/TextBlock";
import { DraggableItem } from "@/components/DraggableItem";
import { BlockForm, BlockFormValues } from "@/components/BlockForm";
import { RasterIcon } from "@/components/RasterIcon";
import { FolderRow } from "@/components/FolderRow";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GenerateBlockDialog } from "@/components/GenerateBlockDialog";
import { LLMGuard } from "@/components/LLMGuard";
import { useLLMStatus } from "@/contexts/LLMStatusContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DotDivider } from "@/components/ui/dot-divider";
import { LENGTH_LIMITS } from "@shared/limits";

const PAGE_SIZE = 50;

function BlockFolderContent({
  folderId,
  editingId,
  setEditingId,
  handleUpdate,
  handleDelete,
  handleRemoveFromFolder,
  updateMutation,
  deleteMutation,
  refetch,
  onLabelClick,
}: {
  folderId: number;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  handleUpdate: (id: number, values: BlockFormValues) => void;
  handleDelete: (id: number) => void;
  handleRemoveFromFolder: (id: number) => void;
  updateMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean };
  refetch: () => void;
  onLabelClick?: (label: string) => void;
}) {
  const { data: folderBlocks, isLoading } = api.blockFolders.getBlocks.useQuery(
    { folderId },
  );

  if (isLoading) {
    return (
      <div className="text-center py-4 text-cyan-medium">Loading blocks...</div>
    );
  }

  if (!folderBlocks || folderBlocks.length === 0) {
    return (
      <div className="text-center py-4 text-cyan-medium">
        No blocks in this folder
      </div>
    );
  }

  return (
    <>
      {folderBlocks.map((block) => (
        <DraggableItem
          key={block.id}
          id={`block:${block.id}`}
          inFolder
          currentFolderId={block.folderId}
        >
          <div className="border-standard-dark-cyan">
            {editingId === block.id ? (
              <BlockForm
                mode="edit"
                initialValues={{
                  name: block.name ?? undefined,
                  displayId: block.displayId,
                  text: block.text,
                  labels: block.labels,
                  typeId: block.typeId ?? undefined,
                  folderId: block.folderId ?? undefined,
                  notes: block.notes ?? undefined,
                }}
                onSubmit={(values) => {
                  handleUpdate(block.id, values);
                  refetch();
                }}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(block.id)}
                isSubmitting={updateMutation.isPending}
              />
            ) : (
              <TextBlock
                block={block}
                onEdit={() => setEditingId(block.id)}
                onDelete={() => handleDelete(block.id)}
                onRemoveFromFolder={() => handleRemoveFromFolder(block.id)}
                onTransform={(blockId, transformedText) => {
                  handleUpdate(blockId, {
                    name: block.name ?? undefined,
                    displayId: block.displayId,
                    text: transformedText,
                    labels: block.labels,
                    typeId: block.typeId ?? undefined,
                    folderId: block.folderId ?? undefined,
                    notes: block.notes ?? undefined,
                  });
                  refetch();
                }}
                isDeleting={deleteMutation.isPending}
                onLabelClick={onLabelClick}
              />
            )}
          </div>
        </DraggableItem>
      ))}
    </>
  );
}

function NewBlockView() {
  const navigate = useNavigate();
  const utils = api.useUtils();
  const { notifyUpsert } = useSync();

  const createMutation = api.blocks.create.useMutation({
    onSuccess: (data) => {
      notifyUpsert("blocks", data as unknown as { id: number });
      utils.blocks.listWithFolders.invalidate();
      utils.blockFolders.getBlocks.invalidate();
      navigate("/blocks");
    },
  });

  const handleCreate = (values: BlockFormValues) => {
    createMutation.mutate({
      uuid: generateUUID(),
      name: values.name,
      displayId: values.displayId,
      text: values.text,
      labels: values.labels,
      typeId: values.typeId,
      folderId: values.folderId,
    });
  };

  return (
    <main className="standard-page-container">
      <div className="mb-8">
        <Link
          to="/blocks"
          className="inline-flex items-center gap-1.5 text-sm text-cyan-medium hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Blocks
        </Link>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <RasterIcon name="blocks" size={36} />
          Create New Block
        </h1>
      </div>

      <BlockForm
        mode="create"
        onSubmit={handleCreate}
        onCancel={() => navigate("/blocks")}
        isSubmitting={createMutation.isPending}
      />
    </main>
  );
}

function BlockList() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<number | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<number | null>(null);
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
    new Set(),
  );
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const { isLLMConfigured } = useLLMStatus();

  const offset = page * PAGE_SIZE;
  const utils = api.useUtils();
  const { notifyUpsert, notifyDelete } = useSync();

  const [searchParams, setSearchParams] = useSearchParams();
  const labelFilter = searchParams.get("label") ?? "";
  const isLabelMode = labelFilter.length > 0;

  const setLabelFilter = (label: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (label) next.set("label", label);
        else next.delete("label");
        return next;
      },
      { replace: false },
    );
    setPage(0);
  };

  useEffect(() => {
    setPage(0);
  }, [labelFilter]);

  // Use listWithFolders when neither searching nor filtering by label.
  const {
    data: foldersData,
    isLoading,
    refetch,
  } = api.blocks.listWithFolders.useQuery(
    {
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: debouncedSearch.length === 0 && !isLabelMode },
  );

  // Debounce search input. Typing clears any active label filter.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
      if (search && labelFilter) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("label");
            return next;
          },
          { replace: true },
        );
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, labelFilter, setSearchParams]);

  // Client-side worker search when a query is active. Server-side `blocks.search`
  // can't match ciphertext columns; the worker holds decrypted rows in memory.
  const searchData = useWorkerSearch<Block>("blocks", debouncedSearch, {
    pageSize: PAGE_SIZE,
    page,
  });

  const labelData = useWorkerLabel<Block>("blocks", labelFilter, {
    pageSize: PAGE_SIZE,
    page,
  });

  // Calculate totals for pagination
  const isSearchMode = !isLabelMode && debouncedSearch.length > 0;
  const total = isLabelMode
    ? labelData.total
    : isSearchMode
      ? searchData.total
      : (foldersData?.totalFolders ?? 0) + (foldersData?.totalLooseBlocks ?? 0);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const showLoading = isLabelMode
    ? labelData.isLoading
    : isSearchMode
      ? searchData.isLoading
      : isLoading;

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

  const updateMutation = api.blocks.update.useMutation({
    onSuccess: (data) => {
      notifyUpsert("blocks", data as unknown as { id: number });
      refetch();
      utils.blockFolders.getBlocks.invalidate();
    },
  });

  const deleteMutation = api.blocks.delete.useMutation({
    onSuccess: (_data, variables) => {
      notifyDelete("blocks", variables.id);
      refetch();
      utils.blockFolders.getBlocks.invalidate();
    },
  });

  const createFolderMutation = api.blockFolders.create.useMutation({
    onSuccess: () => {
      refetch();
      setNewFolderDialogOpen(false);
      setNewFolderName("");
    },
  });

  const deleteFolderMutation = api.blockFolders.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const renameFolderMutation = api.blockFolders.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleUpdate = (id: number, values: BlockFormValues) => {
    updateMutation.mutate({
      id,
      name: values.name,
      displayId: values.displayId,
      text: values.text,
      labels: values.labels,
      typeId: values.typeId,
      folderId: values.folderId,
      notes: values.notes,
    });
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

  const handleDelete = (id: number) => {
    setBlockToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (blockToDelete !== null) {
      deleteMutation.mutate({ id: blockToDelete });
      setBlockToDelete(null);
    }
  };

  const moveBlockToFolder = (blockId: number, folderId: number | null) => {
    updateMutation.mutate({ id: blockId, folderId });
    utils.blockFolders.getBlocks.invalidate();
  };

  const handleRemoveFromFolder = (blockId: number) => {
    moveBlockToFolder(blockId, null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith("block:") || !overId.startsWith("folder:")) return;
    const blockId = Number(activeId.slice("block:".length));
    const folderId = Number(overId.slice("folder:".length));
    if (active.data.current?.currentFolderId === folderId) return;
    moveBlockToFolder(blockId, folderId);
  };

  return (
    <main className="standard-page-container">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="blocks" size={36} />
          Blocks
        </h1>
        <p className="text-cyan-medium">
          <mark className="highlighted-text">Manage your text blocks</mark>
        </p>
      </div>

      <div className="mb-8 flex justify-end gap-2">
        <Button variant="outline" onClick={() => setNewFolderDialogOpen(true)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
        <LLMGuard>
          <Button
            onClick={() => setIsGenerateOpen(true)}
            variant="outline"
            disabled={!isLLMConfigured}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Block
          </Button>
        </LLMGuard>
        <Link to="/blocks/new">
          <Button>Create New Block</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search blocks by name, display ID, or text content..."
        />
      </div>

      {isLabelMode && (
        <div className="mb-2 flex items-center gap-2 text-sm text-cyan-medium">
          <span>Filtered by label:</span>
          <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-dark text-cyan-medium">
            {labelFilter}
          </span>
          <button
            onClick={() => setLabelFilter(null)}
            className="text-xs underline hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <DotDivider className="mb-2" />

      {showLoading ? (
        <div className="text-center py-12 text-cyan-medium">
          {isLabelMode
            ? "Filtering..."
            : isSearchMode
              ? "Searching..."
              : "Loading blocks..."}
        </div>
      ) : isLabelMode ? (
        labelData.items.length > 0 ? (
          <>
            <div className="space-y-4">
              {labelData.items.map((block, index) => (
                <motion.div
                  className="border-standard-dark-cyan"
                  key={block.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  {editingId === block.id ? (
                    <BlockForm
                      mode="edit"
                      initialValues={{
                        name: block.name ?? undefined,
                        displayId: block.displayId,
                        text: block.text,
                        labels: block.labels,
                        typeId: block.typeId ?? undefined,
                        folderId: block.folderId ?? undefined,
                        notes: block.notes ?? undefined,
                      }}
                      onSubmit={(values) => handleUpdate(block.id, values)}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => handleDelete(block.id)}
                      isSubmitting={updateMutation.isPending}
                    />
                  ) : (
                    <TextBlock
                      block={block}
                      onEdit={() => setEditingId(block.id)}
                      onDelete={() => handleDelete(block.id)}
                      onTransform={(blockId, transformedText) =>
                        handleUpdate(blockId, {
                          name: block.name ?? undefined,
                          displayId: block.displayId,
                          text: transformedText,
                          labels: block.labels,
                          typeId: block.typeId ?? undefined,
                          folderId: block.folderId ?? undefined,
                          notes: block.notes ?? undefined,
                        })
                      }
                      isDeleting={deleteMutation.isPending}
                      alwaysActive={true}
                      onLabelClick={setLabelFilter}
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {labelData.total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-6">
                <span className="text-sm text-cyan-medium">
                  Showing {offset + 1}&ndash;
                  {Math.min(offset + PAGE_SIZE, labelData.total)} of{" "}
                  {labelData.total}
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
                  No blocks found with label "{labelFilter}"
                </p>
                <Button onClick={() => setLabelFilter(null)} variant="outline">
                  Clear Filter
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      ) : isSearchMode ? (
        // Search mode: flat list of blocks
        searchData && searchData.items.length > 0 ? (
          <>
            <div className="space-y-4">
              {searchData.items.map((block, index) => (
                <motion.div
                  className="border-standard-dark-cyan"
                  key={block.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  {editingId === block.id ? (
                    <BlockForm
                      mode="edit"
                      initialValues={{
                        name: block.name ?? undefined,
                        displayId: block.displayId,
                        text: block.text,
                        labels: block.labels,
                        typeId: block.typeId ?? undefined,
                        folderId: block.folderId ?? undefined,
                        notes: block.notes ?? undefined,
                      }}
                      onSubmit={(values) => handleUpdate(block.id, values)}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => handleDelete(block.id)}
                      isSubmitting={updateMutation.isPending}
                    />
                  ) : (
                    <TextBlock
                      block={block}
                      onEdit={() => setEditingId(block.id)}
                      onDelete={() => handleDelete(block.id)}
                      onTransform={(blockId, transformedText) =>
                        handleUpdate(blockId, {
                          name: block.name ?? undefined,
                          displayId: block.displayId,
                          text: transformedText,
                          labels: block.labels,
                          typeId: block.typeId ?? undefined,
                          folderId: block.folderId ?? undefined,
                          notes: block.notes ?? undefined,
                        })
                      }
                      isDeleting={deleteMutation.isPending}
                      alwaysActive={true}
                      onLabelClick={setLabelFilter}
                    />
                  )}
                </motion.div>
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
                  No blocks found matching "{debouncedSearch}"
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
          foldersData.looseBlocks.length > 0) ? (
        // Folder mode: folders first, then loose blocks
        <>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
                  deleteTooltip="Delete folder. Will not delete blocks in the folder."
                  droppableId={`folder:${folder.id}`}
                >
                  <BlockFolderContent
                    folderId={folder.id}
                    editingId={editingId}
                    setEditingId={setEditingId}
                    handleUpdate={handleUpdate}
                    handleDelete={handleDelete}
                    handleRemoveFromFolder={handleRemoveFromFolder}
                    updateMutation={updateMutation}
                    deleteMutation={deleteMutation}
                    refetch={refetch}
                    onLabelClick={setLabelFilter}
                  />
                </FolderRow>
              ))}

              {/* Loose blocks */}
              {foldersData.looseBlocks.map((block, index) => (
                <DraggableItem key={block.id} id={`block:${block.id}`}>
                  <motion.div
                    className={cn(
                      "rounded",
                      index === 0 &&
                        page === 0 &&
                        foldersData.folders.length === 0 &&
                        "accent-border-gradient",
                    )}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: (foldersData.folders.length + index) * 0.05,
                    }}
                  >
                    {editingId === block.id ? (
                      <BlockForm
                        mode="edit"
                        initialValues={{
                          name: block.name ?? undefined,
                          displayId: block.displayId,
                          text: block.text,
                          labels: block.labels,
                          typeId: block.typeId ?? undefined,
                          folderId: block.folderId ?? undefined,
                          notes: block.notes ?? undefined,
                        }}
                        onSubmit={(values) => handleUpdate(block.id, values)}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => handleDelete(block.id)}
                        isSubmitting={updateMutation.isPending}
                      />
                    ) : (
                      <TextBlock
                        block={block}
                        onEdit={() => setEditingId(block.id)}
                        onDelete={() => handleDelete(block.id)}
                        onTransform={(blockId, transformedText) =>
                          handleUpdate(blockId, {
                            name: block.name ?? undefined,
                            displayId: block.displayId,
                            text: transformedText,
                            labels: block.labels,
                            typeId: block.typeId ?? undefined,
                            folderId: block.folderId ?? undefined,
                            notes: block.notes ?? undefined,
                          })
                        }
                        isDeleting={deleteMutation.isPending}
                        alwaysActive={true}
                        onLabelClick={setLabelFilter}
                      />
                    )}
                  </motion.div>
                </DraggableItem>
              ))}
            </div>
          </DndContext>

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
              <p className="mb-4">No blocks yet</p>
              <Link to="/blocks/new">
                <Button>Create Your First Block</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Block"
        description="Are you sure you want to delete this block? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />

      <ConfirmDialog
        open={deleteFolderDialogOpen}
        onOpenChange={setDeleteFolderDialogOpen}
        onConfirm={confirmDeleteFolder}
        title="Delete Folder"
        description="Are you sure you want to delete this folder? Blocks in the folder will not be deleted."
        confirmText="Delete"
        variant="destructive"
      />

      <GenerateBlockDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onGenerated={() => refetch()}
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
                placeholder="e.g., Character Descriptions"
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

export default function Blocks() {
  const location = useLocation();

  if (location.pathname === "/blocks/new") {
    return <NewBlockView />;
  }

  return <BlockList />;
}
