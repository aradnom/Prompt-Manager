import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { generateUUID } from "@/lib/uuid";

import { TextBlock } from "@/components/TextBlock";
import { BlockForm, BlockFormValues } from "@/components/BlockForm";
import { RasterIcon } from "@/components/RasterIcon";
import { FolderRow } from "@/components/FolderRow";
import { ChevronLeft, ChevronRight, FolderPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GenerateBlockDialog } from "@/components/GenerateBlockDialog";
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
  updateMutation,
  deleteMutation,
  refetch,
}: {
  folderId: number;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  handleUpdate: (id: number, values: BlockFormValues) => void;
  handleDelete: (id: number) => void;
  updateMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean };
  refetch: () => void;
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
        <div key={block.id} className="border-standard-dark-cyan">
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
            />
          )}
        </div>
      ))}
    </>
  );
}

export default function Blocks() {
  const [isCreating, setIsCreating] = useState(false);
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

  const offset = page * PAGE_SIZE;
  const utils = api.useUtils();

  // Use listWithFolders when not searching
  const {
    data: foldersData,
    isLoading,
    refetch,
  } = api.blocks.listWithFolders.useQuery(
    {
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: debouncedSearch.length === 0 },
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
    api.blocks.search.useQuery(
      {
        query: debouncedSearch.length > 0 ? debouncedSearch : undefined,
        limit: PAGE_SIZE,
        offset,
      },
      { enabled: debouncedSearch.length > 0 },
    );

  // Calculate totals for pagination
  const isSearchMode = debouncedSearch.length > 0;
  const total = isSearchMode
    ? (searchData?.total ?? 0)
    : (foldersData?.totalFolders ?? 0) + (foldersData?.totalLooseBlocks ?? 0);
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const showLoading = isSearchMode ? isSearching : isLoading;

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

  const createMutation = api.blocks.create.useMutation({
    onSuccess: () => {
      refetch();
      utils.blockFolders.getBlocks.invalidate();
      setIsCreating(false);
    },
  });

  const updateMutation = api.blocks.update.useMutation({
    onSuccess: () => {
      refetch();
      utils.blockFolders.getBlocks.invalidate();
    },
  });

  const deleteMutation = api.blocks.delete.useMutation({
    onSuccess: () => {
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

      {isCreating ? (
        <div className="mb-8">
          <BlockForm
            mode="create"
            onSubmit={handleCreate}
            onCancel={() => setIsCreating(false)}
            isSubmitting={createMutation.isPending}
          />
        </div>
      ) : (
        <div className="mb-8 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setNewFolderDialogOpen(true)}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button onClick={() => setIsGenerateOpen(true)} variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Block
          </Button>
          <Button onClick={() => setIsCreating(true)}>Create New Block</Button>
        </div>
      )}

      {/* Search */}
      <div className="mb-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search blocks by name, display ID, or text content..."
        />
      </div>

      <DotDivider className="mb-2" />

      {showLoading ? (
        <div className="text-center py-12 text-cyan-medium">
          {isSearchMode ? "Searching..." : "Loading blocks..."}
        </div>
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
              >
                <BlockFolderContent
                  folderId={folder.id}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  handleUpdate={handleUpdate}
                  handleDelete={handleDelete}
                  updateMutation={updateMutation}
                  deleteMutation={deleteMutation}
                  refetch={refetch}
                />
              </FolderRow>
            ))}

            {/* Loose blocks */}
            {foldersData.looseBlocks.map((block, index) => (
              <motion.div
                className={cn(
                  "rounded",
                  index === 0 &&
                    page === 0 &&
                    foldersData.folders.length === 0 &&
                    "accent-border-gradient",
                )}
                key={block.id}
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
                  />
                )}
              </motion.div>
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
              <p className="mb-4">No blocks yet</p>
              <Button onClick={() => setIsCreating(true)}>
                Create Your First Block
              </Button>
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
