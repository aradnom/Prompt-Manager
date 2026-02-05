import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { generateUUID } from "@/lib/uuid";

import { TextBlock } from "@/components/TextBlock";
import { BlockForm, BlockFormValues } from "@/components/BlockForm";
import { RasterIcon } from "@/components/RasterIcon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const PAGE_SIZE = 50;

export default function Blocks() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  const offset = page * PAGE_SIZE;

  const {
    data: blocksData,
    isLoading,
    refetch,
  } = api.blocks.list.useQuery({
    limit: PAGE_SIZE,
    offset,
  });

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

  // Use search results if searching, otherwise use all blocks
  const currentData = debouncedSearch.length > 0 ? searchData : blocksData;
  const displayBlocks = currentData?.items;
  const total = currentData?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const showLoading = debouncedSearch.length > 0 ? isSearching : isLoading;

  const createMutation = api.blocks.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreating(false);
    },
  });

  const updateMutation = api.blocks.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
    },
  });

  const deleteMutation = api.blocks.delete.useMutation({
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
    });
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
        <div className="mb-8 flex justify-end">
          <Button onClick={() => setIsCreating(true)}>Create New Block</Button>
        </div>
      )}

      {/* Search */}
      <div className="mb-8">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search blocks by name, display ID, or text content..."
        />
      </div>

      {showLoading ? (
        <div className="text-center py-12 text-cyan-medium">
          {debouncedSearch.length > 0 ? "Searching..." : "Loading blocks..."}
        </div>
      ) : displayBlocks && displayBlocks.length > 0 ? (
        <>
          <div className="space-y-4">
            {displayBlocks.map((block, index) => (
              <motion.div
                className={cn(
                  "border-standard-dark-cyan",
                  index === 0 && page === 0 && "accent-border-gradient",
                )}
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
      ) : debouncedSearch.length > 0 ? (
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
    </main>
  );
}
