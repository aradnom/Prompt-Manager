import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Sparkles,
  Wand2,
  Clock,
  Camera,
  Folder,
  LayoutTemplate,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { BlockStack, StackWithBlocks } from "@/types/schema";
import { useActiveStack } from "@/contexts/ActiveStackContext";
import { useStackContent } from "@/contexts/StackContentContext";
import {
  resolveWildcardsInText,
  resolveWildcardsWithMarkers,
} from "@/lib/wildcard-resolver";
import { api } from "@/lib/api";
import { applyCommaSeparation } from "@/lib/comma-separation";
import { generateDisplayId } from "@/lib/generate-display-id";
import { generateUUID } from "@/lib/uuid";
import { TextBlock } from "@/components/TextBlock";
import { BlockForm, BlockFormValues } from "@/components/BlockForm";
import { BlockSearchDialog } from "@/components/BlockSearchDialog";
import { GenerateBlockDialog } from "@/components/GenerateBlockDialog";
import { LLMGuard } from "@/components/LLMGuard";
import { InlineIconBadge } from "@/components/ui/inline-icon-badge";
import { useLLMStatus } from "@/contexts/LLMStatusContext";
import { NotesDialog } from "@/components/NotesDialog";
import { SortableBlock } from "@/components/SortableBlock";
import { StackRevisionsOverlay } from "@/components/StackRevisionsOverlay";
import { StackSnapshotsOverlay } from "@/components/StackSnapshotsOverlay";
import { CameraFlash } from "@/components/CameraFlash";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DefragLoader } from "@/components/ui/defrag-loader";
import { useTransform } from "@/hooks/useTransform";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LENGTH_LIMITS } from "@shared/limits";

interface StackEditorProps {
  stack: BlockStack;
}

export function StackEditor({ stack }: StackEditorProps) {
  const navigate = useNavigate();
  const { isLLMConfigured } = useLLMStatus();
  const { setActiveStack, setActiveStackBlocks } = useActiveStack();
  const { renderedContent, setRenderedContent, setRenderedContentWithMarkers } =
    useStackContent();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBlockIndices, setSelectedBlockIndices] = useState<Set<number>>(
    new Set(),
  );
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isRenamingStack, setIsRenamingStack] = useState(false);
  const [stackRenameValue, setStackRenameValue] = useState("");
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const snapshotDoneRef = useRef({ flash: false, mutation: false });
  const enrichMutation = useTransform();
  const contentOverLimit =
    renderedContent.length > LENGTH_LIMITS.renderedContent;

  const {
    data: fullStack,
    isLoading,
    refetch,
  } = api.stacks.get.useQuery({
    id: stack.id,
    includeBlocks: true,
  });

  const { data: wildcardsData } = api.wildcards.list.useQuery();
  const wildcards = wildcardsData?.items;

  const saveStackName = () => {
    const trimmed = stackRenameValue.trim();
    const newName = trimmed || undefined;
    if ((newName ?? null) !== (stack.name ?? null)) {
      updateStackMutation.mutate({ id: stack.id, name: newName });
    }
    setIsRenamingStack(false);
  };

  const updateContentMutation = api.stacks.updateContent.useMutation();
  const utils = api.useUtils();
  const updateStackMutation = api.stacks.update.useMutation({
    onSuccess: () => {
      utils.stacks.invalidate();
    },
  });

  const createTemplateMutation = api.stackTemplates.createFromStack.useMutation(
    {
      onSuccess: (template) => {
        navigate(`/templates/${template.id}`);
      },
    },
  );

  const createSnapshotMutation = api.stacks.createSnapshot.useMutation({
    onSuccess: () => {
      snapshotDoneRef.current.mutation = true;
      if (snapshotDoneRef.current.flash) {
        setShowSnapshots(true);
      }
    },
  });

  const saveContent = useCallback((stackId: number, content: string) => {
    updateContentMutation.mutate({
      stackId,
      renderedContent: content,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We cast here because we know we requested includeBlocks: true
  const stackWithBlocks = fullStack as StackWithBlocks;
  const blocksAtLimit =
    (stackWithBlocks?.blocks?.length ?? 0) >= LENGTH_LIMITS.blockIds;

  // Apply comma separation to content if enabled
  const processCommas = useCallback(
    (content: string): string => {
      if (!stackWithBlocks?.commaSeparated) return content;
      return applyCommaSeparation(content);
    },
    [stackWithBlocks?.commaSeparated],
  );

  // Update context whenever blocks change
  useEffect(() => {
    if (stackWithBlocks?.blocks) {
      setActiveStackBlocks(stackWithBlocks.blocks);

      // Compute rendered content (excluding disabled blocks)
      const disabledIds = stackWithBlocks.disabledBlockIds || [];
      const rawText = stackWithBlocks.blocks
        .filter((b) => !disabledIds.includes(b.id))
        .map((b) => b.text.trim())
        .filter((t) => t.length > 0)
        .join("\n\n");

      const resolvedContent = wildcards
        ? resolveWildcardsInText(rawText, wildcards)
        : rawText;

      const resolvedContentWithMarkers = wildcards
        ? resolveWildcardsWithMarkers(rawText, wildcards)
        : rawText;

      // Apply comma separation before setting context and saving
      const finalContent = processCommas(resolvedContent);
      const finalContentWithMarkers = processCommas(resolvedContentWithMarkers);

      setRenderedContent(finalContent);
      setRenderedContentWithMarkers(finalContentWithMarkers);

      // Save the rendered content to the revision (debounced), skip if over limit
      const timeoutId = setTimeout(() => {
        if (finalContent.length <= LENGTH_LIMITS.renderedContent) {
          saveContent(stack.id, finalContent);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [
    stackWithBlocks?.blocks,
    stackWithBlocks?.disabledBlockIds,
    setActiveStackBlocks,
    wildcards,
    setRenderedContent,
    setRenderedContentWithMarkers,
    stack.id,
    saveContent,
    processCommas,
  ]);

  const addBlockMutation = api.stacks.addBlock.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const createBlockMutation = api.blocks.create.useMutation();

  const updateBlockMutation = api.blocks.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const removeBlockMutation = api.stacks.removeBlock.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const reorderBlocksMutation = api.stacks.reorderBlocks.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const toggleBlockDisabledMutation =
    api.stacks.toggleBlockDisabled.useMutation({
      onSuccess: () => {
        refetch();
      },
    });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !stackWithBlocks?.blocks) {
      return;
    }

    const oldIndex = active.id as number;
    const newIndex = over.id as number;

    const reorderedBlocks = arrayMove(
      stackWithBlocks.blocks,
      oldIndex,
      newIndex,
    );
    const blockIds = reorderedBlocks.map((block) => block.id);

    reorderBlocksMutation.mutate({
      stackId: stack.id,
      blockIds,
    });
  };

  const handleAddExistingBlock = (blockId: number) => {
    addBlockMutation.mutate({
      stackId: stack.id,
      blockId,
    });
  };

  const handleCreateNewBlock = async (values: BlockFormValues) => {
    try {
      // 1. Create the block
      const newBlock = await createBlockMutation.mutateAsync({
        uuid: generateUUID(),
        name: values.name,
        displayId: values.displayId,
        text: values.text,
        labels: values.labels,
        typeId: values.typeId,
        notes: values.notes,
      });

      // 2. Add to stack
      await addBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId: newBlock.id,
      });

      setIsCreatingNew(false);
    } catch (error) {
      console.error("Failed to create and add block:", error);
    }
  };

  const handleUpdateBlock = async (
    blockId: number,
    values: BlockFormValues,
  ) => {
    try {
      await updateBlockMutation.mutateAsync({
        id: blockId,
        name: values.name,
        displayId: values.displayId,
        text: values.text,
        labels: values.labels,
        typeId: values.typeId,
        notes: values.notes,
      });
    } catch (error) {
      console.error("Failed to update block:", error);
    }
  };

  const handleRemoveBlock = (blockId: number) => {
    removeBlockMutation.mutate({
      stackId: stack.id,
      blockId,
    });
  };

  const handleToggleBlockDisabled = (blockId: number) => {
    toggleBlockDisabledMutation.mutate({
      stackId: stack.id,
      blockId,
    });
  };

  const handleDuplicateBlock = async (blockIndex: number) => {
    if (!stackWithBlocks?.blocks) return;

    const originalBlock = stackWithBlocks.blocks[blockIndex];

    try {
      // Generate random suffix for display_id (6 character hex string)
      const randomSuffix = Array.from(crypto.getRandomValues(new Uint8Array(3)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const newDisplayId = `${originalBlock.displayId}-${randomSuffix}`;

      // 1. Create the new block with same properties but new UUID and displayId
      const newBlock = await createBlockMutation.mutateAsync({
        uuid: generateUUID(),
        name: originalBlock.name ?? undefined,
        displayId: newDisplayId,
        text: originalBlock.text,
        labels: originalBlock.labels,
        typeId: originalBlock.typeId ?? undefined,
      });

      // 2. Add to stack right after the original block
      await addBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId: newBlock.id,
        order: blockIndex + 1,
      });
    } catch (error) {
      console.error("Failed to duplicate block:", error);
    }
  };

  const handleToggleBlockSelection = (index: number) => {
    setSelectedBlockIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleRemoveSelectedBlocks = async () => {
    if (!stackWithBlocks?.blocks) return;

    // Get block IDs from selected indices
    const blockIdsToRemove = Array.from(selectedBlockIndices).map(
      (index) => stackWithBlocks.blocks[index].id,
    );

    // Remove each block
    for (const blockId of blockIdsToRemove) {
      await removeBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId,
      });
    }

    // Clear selection
    setSelectedBlockIndices(new Set());
  };

  const handleMergeBlocks = async () => {
    if (!stackWithBlocks?.blocks || selectedBlockIndices.size < 2) return;

    // Get sorted indices to maintain stack order
    const sortedIndices = Array.from(selectedBlockIndices).sort(
      (a, b) => a - b,
    );

    // Get the blocks in order
    const blocksToMerge = sortedIndices.map(
      (index) => stackWithBlocks.blocks[index],
    );

    // Merge the text content with smart comma joining
    const mergedText = blocksToMerge.reduce((acc, block, index) => {
      if (index === 0) return block.text;

      // Check if previous text ends with comma or period
      const needsComma = !/[,.]$/.test(acc);
      return needsComma ? `${acc}, ${block.text}` : `${acc} ${block.text}`;
    }, "");

    // Get type from first block that has one
    const mergedTypeId = blocksToMerge.find(
      (block) => block.typeId !== null,
    )?.typeId;

    // Collect all unique labels from all blocks
    const allLabels = blocksToMerge.flatMap((block) => block.labels);
    const uniqueLabels = Array.from(new Set(allLabels));

    // Create new block with merged content
    const newBlock = await createBlockMutation.mutateAsync({
      uuid: generateUUID(),
      displayId: generateDisplayId(),
      text: mergedText,
      labels: uniqueLabels,
      typeId: mergedTypeId ?? undefined,
    });

    // Get the position of the first selected block
    const firstPosition = sortedIndices[0];

    // Add the new block at that position
    await addBlockMutation.mutateAsync({
      stackId: stack.id,
      blockId: newBlock.id,
      order: firstPosition,
    });

    // Remove all the merged blocks from the stack
    for (const index of sortedIndices) {
      const blockId = stackWithBlocks.blocks[index].id;
      await removeBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId,
      });
    }

    // Clear selection and exit select mode
    setSelectedBlockIndices(new Set());
    setIsSelectMode(false);
  };

  const handleGenerateBlockCreated = async (newBlock: { id: number }) => {
    try {
      await addBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId: newBlock.id,
      });
    } catch (error) {
      console.error("Failed to add generated block to stack:", error);
    }
  };

  const handleEnrichPrompt = async () => {
    if (!renderedContent.trim()) return;

    setIsEnriching(true);
    try {
      const result = await enrichMutation.mutateAsync({
        text: renderedContent,
        operation: "enrich",
        style: stack.style,
      });

      if (typeof result.result === "string") {
        // Create a new block with the enrichment
        const newBlock = await createBlockMutation.mutateAsync({
          uuid: generateUUID(),
          displayId: generateDisplayId(),
          text: result.result,
          labels: [],
          typeId: undefined,
        });

        // Add to stack
        await addBlockMutation.mutateAsync({
          stackId: stack.id,
          blockId: newBlock.id,
        });
      }
    } catch (error) {
      console.error("Failed to enrich prompt:", error);
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <>
      <Card className="relative h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">
                Active Prompt:{" "}
                {isRenamingStack ? (
                  <input
                    type="text"
                    value={stackRenameValue}
                    onChange={(e) => setStackRenameValue(e.target.value)}
                    onBlur={saveStackName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveStackName();
                      if (e.key === "Escape") {
                        setStackRenameValue(stack.name ?? "");
                        setIsRenamingStack(false);
                      }
                    }}
                    placeholder="Enter prompt name..."
                    className="text-2xl font-semibold px-2 py-0.5 border-inline-input"
                    maxLength={LENGTH_LIMITS.name}
                    autoFocus
                  />
                ) : (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="cursor-pointer hover:text-magenta-light transition-colors"
                          onClick={() => {
                            setStackRenameValue(stack.name ?? "");
                            setIsRenamingStack(true);
                          }}
                        >
                          {stack.name || stack.displayId}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Click to rename</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowRevisions(true)}
                        className="ml-3 text-cyan-medium hover:text-foreground transition-colors cursor-pointer relative align-top"
                        aria-label="Show revisions"
                      >
                        <Clock className="inline h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>View prompt history</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowSnapshots(true)}
                        className="ml-3 text-cyan-medium hover:text-foreground transition-colors cursor-pointer relative align-top"
                        aria-label="Show snapshots"
                      >
                        <Camera className="inline h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>View snapshots</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {stack.negative && (
                  <span className="ml-3 align-middle text-xs px-2 py-0.5 rounded bg-magenta-dark/30 border border-magenta-medium text-magenta-light">
                    Negative
                  </span>
                )}
              </CardTitle>
              {(stack.name || stack.folderName) && (
                <CardDescription className="font-mono text-xs mt-1 flex items-center gap-1.5">
                  {stack.name && <span>{stack.displayId}</span>}
                  {stack.name && stack.folderName && (
                    <span className="text-cyan-medium">&bull;</span>
                  )}
                  {stack.folderName && (
                    <InlineIconBadge icon={Folder}>
                      {stack.folderName}
                    </InlineIconBadge>
                  )}
                </CardDescription>
              )}
            </div>
            <ButtonGroup>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedBlockIndices(new Set());
                }}
              >
                {isSelectMode ? "Cancel Select" : "Select Blocks"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNotesOpen(true)}
              >
                Notes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/prompts/${stack.displayId}`)}
              >
                Prompt Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveStack(null)}
              >
                Close Prompt
              </Button>
            </ButtonGroup>
          </div>
        </CardHeader>
        <AnimatePresence>
          {isSelectMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-b overflow-hidden mb-4"
            >
              <div className="px-6 py-3 bg-cyan-dark/30">
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveSelectedBlocks}
                    disabled={selectedBlockIndices.size === 0}
                  >
                    Remove Blocks
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleMergeBlocks}
                    disabled={selectedBlockIndices.size < 2}
                  >
                    Merge Blocks
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <CardContent className="flex-1">
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 text-cyan-medium">
                Loading blocks...
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="flex flex-col gap-4">
                  {stackWithBlocks?.blocks &&
                  stackWithBlocks.blocks.length > 0 ? (
                    <SortableContext
                      items={stackWithBlocks.blocks.map((_, i) => i)}
                      strategy={verticalListSortingStrategy}
                    >
                      {stackWithBlocks.blocks.map((block, index) => (
                        <SortableBlock key={index} id={index}>
                          {editingBlockId === block.id ? (
                            <motion.div
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 16 }}
                              transition={{ duration: 0.2 }}
                            >
                              <BlockForm
                                mode="edit"
                                initialValues={{
                                  name: block.name ?? undefined,
                                  displayId: block.displayId,
                                  text: block.text,
                                  labels: block.labels,
                                  typeId: block.typeId ?? undefined,
                                  notes: block.notes ?? undefined,
                                }}
                                onSubmit={(values) =>
                                  handleUpdateBlock(block.id, values)
                                }
                                onCancel={() => setEditingBlockId(null)}
                                isSubmitting={updateBlockMutation.isPending}
                              />
                            </motion.div>
                          ) : (
                            <div>
                              <TextBlock
                                block={block}
                                isDisabled={
                                  stackWithBlocks?.disabledBlockIds?.includes(
                                    block.id,
                                  ) ?? false
                                }
                                onToggleDisable={() =>
                                  handleToggleBlockDisabled(block.id)
                                }
                                onEdit={() => setEditingBlockId(block.id)}
                                onDelete={() => handleRemoveBlock(block.id)}
                                onDuplicate={() => handleDuplicateBlock(index)}
                                onTransform={(blockId, transformedText) =>
                                  handleUpdateBlock(blockId, {
                                    name: block.name ?? undefined,
                                    displayId: block.displayId,
                                    text: transformedText,
                                    labels: block.labels,
                                    typeId: block.typeId ?? undefined,
                                    notes: block.notes ?? undefined,
                                  })
                                }
                                onSelectBlock={handleAddExistingBlock}
                                isDeleting={removeBlockMutation.isPending}
                                isSelectMode={isSelectMode}
                                isSelected={selectedBlockIndices.has(index)}
                                onToggleSelect={() =>
                                  handleToggleBlockSelection(index)
                                }
                                style={stack.style}
                              />
                            </div>
                          )}
                        </SortableBlock>
                      ))}
                    </SortableContext>
                  ) : (
                    !isCreatingNew && (
                      <div className="text-center py-12 text-cyan-medium border-2 border-dashed rounded-lg">
                        <p>No blocks in this prompt yet.</p>
                        <p className="text-xs mt-2">
                          Add blocks using the toolbar below.
                        </p>
                      </div>
                    )
                  )}

                  {isCreatingNew && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.2 }}
                    >
                      <BlockForm
                        onSubmit={handleCreateNewBlock}
                        onCancel={() => setIsCreatingNew(false)}
                        isSubmitting={
                          createBlockMutation.isPending ||
                          addBlockMutation.isPending
                        }
                      />
                    </motion.div>
                  )}
                </div>
              </DndContext>
            )}
          </div>
        </CardContent>
        {contentOverLimit && (
          <div className="px-6 py-2 text-sm text-magenta-light bg-magenta-dark/20 border-t border-magenta-medium/40">
            Prompt content exceeds the{" "}
            {(LENGTH_LIMITS.renderedContent / 1_000_000).toFixed(0)}M character
            limit ({renderedContent.length.toLocaleString()} /{" "}
            {LENGTH_LIMITS.renderedContent.toLocaleString()}). Auto-save and
            snapshots are disabled until the content is reduced.
          </div>
        )}
        <CardFooter className="border-t p-4 bg-cyan-dark/20">
          {!isCreatingNew && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 w-full lg:[&>button]:min-w-48">
              <Button
                onClick={() => setIsSearchOpen(true)}
                variant="default"
                disabled={blocksAtLimit}
              >
                <Search className="mr-2 h-4 w-4" />
                Add Existing Block
              </Button>
              <Button
                onClick={() => setIsCreatingNew(true)}
                variant="tertiary"
                disabled={blocksAtLimit}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Block
              </Button>
              <LLMGuard>
                <Button
                  onClick={() => setIsGenerateOpen(true)}
                  variant="tertiary"
                  disabled={!isLLMConfigured || blocksAtLimit}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate New Block
                </Button>
                <TooltipProvider delayDuration={0}>
                  <Tooltip open={!isLLMConfigured ? false : undefined}>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleEnrichPrompt}
                        variant="tertiary"
                        disabled={
                          !isLLMConfigured ||
                          !renderedContent.trim() ||
                          isEnriching ||
                          blocksAtLimit
                        }
                      >
                        {isEnriching ? (
                          <DefragLoader size={16} className="mr-2" />
                        ) : (
                          <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Enrich Prompt
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Automatically generate a new block that fleshes out the
                      current prompt contents
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </LLMGuard>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => {
                        snapshotDoneRef.current = {
                          flash: false,
                          mutation: false,
                        };
                        setShowFlash(true);
                        createSnapshotMutation.mutate({
                          stackId: stack.id,
                          renderedContent,
                        });
                      }}
                      variant="tertiary"
                      disabled={
                        !renderedContent.trim() ||
                        createSnapshotMutation.isPending ||
                        contentOverLimit
                      }
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {createSnapshotMutation.isPending
                        ? "Saving..."
                        : "Create Snapshot"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Save the current prompt contents as static text
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => {
                        createTemplateMutation.mutate({ stackId: stack.id });
                      }}
                      variant="tertiary"
                      disabled={
                        createTemplateMutation.isPending ||
                        !stackWithBlocks?.blocks?.length
                      }
                    >
                      <LayoutTemplate className="mr-2 h-4 w-4" />
                      {createTemplateMutation.isPending
                        ? "Creating..."
                        : "Create Template"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Create reusable template from current contents of this
                    prompt
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </CardFooter>

        {/* Camera flash */}
        <AnimatePresence>
          {showFlash && (
            <CameraFlash
              onComplete={() => {
                setShowFlash(false);
                snapshotDoneRef.current.flash = true;
                if (snapshotDoneRef.current.mutation) {
                  setShowSnapshots(true);
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* Revisions overlay */}
        <AnimatePresence>
          {showRevisions && (
            <StackRevisionsOverlay
              stackId={stack.id}
              activeRevisionId={stack.activeRevisionId}
              onClose={() => setShowRevisions(false)}
            />
          )}
        </AnimatePresence>

        {/* Snapshots overlay */}
        <AnimatePresence>
          {showSnapshots && (
            <StackSnapshotsOverlay
              stackId={stack.id}
              onClose={() => setShowSnapshots(false)}
            />
          )}
        </AnimatePresence>
      </Card>

      <BlockSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={handleAddExistingBlock}
      />

      <GenerateBlockDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        style={stack.style}
        onGenerated={handleGenerateBlockCreated}
      />

      <NotesDialog
        title="Prompt Notes"
        placeholder="Add notes about this prompt..."
        initialNotes={stackWithBlocks?.notes ?? null}
        open={isNotesOpen}
        onOpenChange={setIsNotesOpen}
        onSave={(notes) => {
          updateStackMutation.mutate({ id: stack.id, notes });
        }}
      />
    </>
  );
}
