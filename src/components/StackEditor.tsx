import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  StickyNote,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { BlockStack, StackWithBlocks, TextBlockGroup } from "@/types/schema";
import { resolveBlockGroups } from "@shared/block-groups";
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
import { useSync } from "@/contexts/SyncContext";
import { NotesDialog } from "@/components/NotesDialog";
import { SortableBlock } from "@/components/SortableBlock";
import {
  BlockGroupContainer,
  groupColorHex,
} from "@/components/BlockGroupContainer";
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
import { cn } from "@/lib/utils";

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

  const utils = api.useUtils();
  const { notifyUpsert } = useSync();
  const updateContentMutation = api.stacks.updateContent.useMutation();
  const updateStackMutation = api.stacks.update.useMutation({
    onSuccess: (data) => {
      notifyUpsert("stacks", data as unknown as { id: number });
      utils.stacks.invalidate();
    },
  });

  const createTemplateMutation = api.stackTemplates.createFromStack.useMutation(
    {
      onSuccess: (template) => {
        notifyUpsert("templates", template as unknown as { id: number });
        navigate(`/templates/${template.id}`);
      },
    },
  );

  const createSnapshotMutation = api.stacks.createSnapshot.useMutation({
    onSuccess: (data) => {
      notifyUpsert("snapshots", data as unknown as { id: number });
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

  const createBlockMutation = api.blocks.create.useMutation({
    onSuccess: (data) =>
      notifyUpsert("blocks", data as unknown as { id: number }),
  });

  const updateBlockMutation = api.blocks.update.useMutation({
    onSuccess: (data) => {
      notifyUpsert("blocks", data as unknown as { id: number });
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

  const setBlockGroupsMutation = api.stacks.setBlockGroups.useMutation({
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

  // Sortable ids: blocks use `b-${index}`, groups use `g-${groupId}`.
  const blockSortId = (i: number) => `b-${i}`;
  const groupSortId = (id: string) => `g-${id}`;
  const parseSortId = (
    id: string,
  ):
    | { kind: "block"; index: number }
    | { kind: "group"; groupId: string }
    | null => {
    if (id.startsWith("b-")) {
      const n = parseInt(id.slice(2), 10);
      return Number.isFinite(n) ? { kind: "block", index: n } : null;
    }
    if (id.startsWith("g-")) return { kind: "group", groupId: id.slice(2) };
    return null;
  };

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);

  // When dragging a block, exclude group containers (g-*) from collision
  // candidates. Group rects roughly center on their single child block,
  // creating ties with closestCenter that flip the over target erratically
  // mid-drag. Letting the inner block always be the over target keeps the
  // visual stable; the cross-container drop logic still appends to the group.
  const collisionDetection: CollisionDetection = (args) => {
    const isBlock = String(args.active.id).startsWith("b-");
    if (!isBlock) return closestCenter(args);
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => !String(c.id).startsWith("g-"),
      ),
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverDragId(over ? String(over.id) : null);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setOverDragId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setOverDragId(null);
    const { active, over } = event;

    if (!over || active.id === over.id || !stackWithBlocks?.blocks) {
      return;
    }

    const activeParsed = parseSortId(String(active.id));
    const overParsed = parseSortId(String(over.id));
    if (!activeParsed || !overParsed) return;

    const blocks = stackWithBlocks.blocks;
    const groups = stackWithBlocks.blockGroups ?? [];

    // Helper: resync a group's blockIds order against a flat block id list.
    const resyncGroupOrder = (
      g: TextBlockGroup,
      flat: number[],
      mutated: { changed: boolean },
    ) => {
      const positionOf = new Map(flat.map((id, i) => [id, i]));
      const sorted = g.blockIds
        .slice()
        .sort((a, b) => (positionOf.get(a) ?? 0) - (positionOf.get(b) ?? 0));
      if (
        sorted.length !== g.blockIds.length ||
        sorted.some((id, i) => id !== g.blockIds[i])
      ) {
        mutated.changed = true;
      }
      return { ...g, blockIds: sorted };
    };

    // Group drag: move the active group's whole block range to a new spot.
    if (activeParsed.kind === "group") {
      const sourceGroup = groups.find((g) => g.id === activeParsed.groupId);
      if (!sourceGroup) return;
      const groupIdSet = new Set(sourceGroup.blockIds);
      const groupBlocksInOrder = blocks.filter((b) => groupIdSet.has(b.id));
      const sourceFirstIdx = blocks.findIndex((b) => groupIdSet.has(b.id));

      let targetBlockId: number | undefined;
      let side: "above" | "below" = "below";
      if (overParsed.kind === "block") {
        targetBlockId = blocks[overParsed.index]?.id;
        side = sourceFirstIdx < overParsed.index ? "below" : "above";
      } else {
        const targetGroup = groups.find((g) => g.id === overParsed.groupId);
        if (!targetGroup) return;
        const targetIds = new Set(targetGroup.blockIds);
        const inOrder = blocks.filter((b) => targetIds.has(b.id));
        const targetFirstIdx = blocks.findIndex((b) => targetIds.has(b.id));
        side = sourceFirstIdx < targetFirstIdx ? "below" : "above";
        targetBlockId =
          side === "below" ? inOrder[inOrder.length - 1]?.id : inOrder[0]?.id;
      }
      if (targetBlockId === undefined) return;

      const without = blocks.filter((b) => !groupIdSet.has(b.id));
      const targetIdx = without.findIndex((b) => b.id === targetBlockId);
      if (targetIdx === -1) return;
      const insertAt = side === "below" ? targetIdx + 1 : targetIdx;
      const reordered = [
        ...without.slice(0, insertAt),
        ...groupBlocksInOrder,
        ...without.slice(insertAt),
      ];
      reorderBlocksMutation.mutate({
        stackId: stack.id,
        blockIds: reordered.map((b) => b.id),
      });
      return;
    }

    // active is a block. Determine over-block + target group.
    const oldIndex = activeParsed.index;
    const oldGroupId = indexToGroupId.get(oldIndex) ?? null;
    let overIndex: number;
    let overGroupId: string | null;
    let effectiveSide: "above" | "below" = "below";

    const lastIdxOfGroup = (groupId: string): number => {
      const target = groups.find((g) => g.id === groupId);
      if (!target) return -1;
      const targetIds = new Set(target.blockIds);
      const inOrder = blocks.filter((b) => targetIds.has(b.id));
      const lastId = inOrder[inOrder.length - 1]?.id;
      return lastId !== undefined
        ? blocks.findIndex((b) => b.id === lastId)
        : -1;
    };

    if (overParsed.kind === "group") {
      // Dropped on a group's chrome — append to end of that group.
      const lastIdx = lastIdxOfGroup(overParsed.groupId);
      if (lastIdx === -1) return;
      overIndex = lastIdx;
      overGroupId = overParsed.groupId;
      effectiveSide = "below";
    } else {
      overIndex = overParsed.index;
      overGroupId = indexToGroupId.get(overIndex) ?? null;
      effectiveSide = oldIndex < overIndex ? "below" : "above";
      // Cross-container drop INTO a group always lands at the group's end —
      // ordering within the group is done with a follow-up reorder.
      if (overGroupId !== null && overGroupId !== oldGroupId) {
        const lastIdx = lastIdxOfGroup(overGroupId);
        if (lastIdx !== -1) {
          overIndex = lastIdx;
          effectiveSide = "below";
        }
      } else if (oldGroupId !== null && overGroupId === null) {
        // Crossing OUT of a group into loose territory: the over target is
        // the nearest loose block on whichever side. The default direction
        // rule lands the dragged block on the far side of that block, which
        // leaves no landing slot directly adjacent to the group. Invert so
        // the block lands between the group and the over block.
        effectiveSide = effectiveSide === "above" ? "below" : "above";
      }
    }

    if (oldIndex === overIndex && oldGroupId === overGroupId) return;

    const isCross = oldGroupId !== overGroupId;
    let newIndex = overIndex;
    if (isCross || overParsed.kind === "group") {
      const targetLogical =
        effectiveSide === "below" ? overIndex + 1 : overIndex;
      newIndex = oldIndex < targetLogical ? targetLogical - 1 : targetLogical;
    }

    const reorderedBlocks = arrayMove(blocks, oldIndex, newIndex);
    const blockIds = reorderedBlocks.map((b) => b.id);
    const activeBlockId = blocks[oldIndex].id;

    reorderBlocksMutation.mutate({ stackId: stack.id, blockIds });

    // Membership: dragged block now belongs to overGroupId (or stays if same).
    const newGroupId = isCross ? overGroupId : oldGroupId;
    const mutated = { changed: false };
    const updatedGroups = groups.map((g) => {
      const wasMember = g.blockIds.includes(activeBlockId);
      const shouldBeMember = g.id === newGroupId;
      let ids = g.blockIds;
      if (wasMember && !shouldBeMember) {
        ids = ids.filter((id) => id !== activeBlockId);
        mutated.changed = true;
      } else if (!wasMember && shouldBeMember) {
        ids = [...ids, activeBlockId];
        mutated.changed = true;
      }
      return resyncGroupOrder({ ...g, blockIds: ids }, blockIds, mutated);
    });
    if (mutated.changed) {
      setBlockGroupsMutation.mutate({
        stackId: stack.id,
        blockGroups: updatedGroups,
      });
    }
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

  const handleRemoveBlock = (blockId: number, position: number) => {
    removeBlockMutation.mutate({
      stackId: stack.id,
      blockId,
      position,
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

    // Remove from highest index downwards so each splice on the server
    // doesn't shift the positions of the not-yet-removed entries.
    const sortedDescending = Array.from(selectedBlockIndices).sort(
      (a, b) => b - a,
    );

    for (const index of sortedDescending) {
      const block = stackWithBlocks.blocks[index];
      if (!block) continue;
      await removeBlockMutation.mutateAsync({
        stackId: stack.id,
        blockId: block.id,
        position: index,
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

  const handleGroupSelectedBlocks = async () => {
    if (!stackWithBlocks?.blocks || selectedBlockIndices.size === 0) return;

    const blocks = stackWithBlocks.blocks;
    const sortedIndices = Array.from(selectedBlockIndices).sort(
      (a, b) => a - b,
    );
    const selectedIds = sortedIndices.map((i) => blocks[i].id);
    const selectedSet = new Set(selectedIds);

    // If selected blocks are non-contiguous, pull them together at the position
    // of the lowest selected index. The first selected block stays put;
    // anything between gets pushed below the run.
    const isContiguous = sortedIndices.every(
      (idx, i) => i === 0 || idx === sortedIndices[i - 1] + 1,
    );

    const currentBlockIds = blocks.map((b) => b.id);
    if (!isContiguous) {
      const targetStart = sortedIndices[0];
      const others = currentBlockIds.filter((id) => !selectedSet.has(id));
      const reordered = [
        ...others.slice(0, targetStart),
        ...selectedIds,
        ...others.slice(targetStart),
      ];
      await reorderBlocksMutation.mutateAsync({
        stackId: stack.id,
        blockIds: reordered,
      });
    }

    // Strip the selected ids out of any existing groups, then append the new
    // group. Empty groups left behind are fine — server-side normalize keeps
    // them as drop-targets.
    const existingGroups = stackWithBlocks.blockGroups ?? [];
    const filteredGroups = existingGroups.map((g) => ({
      ...g,
      blockIds: g.blockIds.filter((id) => !selectedSet.has(id)),
    }));
    const newGroup: TextBlockGroup = {
      id: generateUUID(),
      name: "New Group",
      color: null,
      blockIds: selectedIds,
      collapsed: false,
    };
    setBlockGroupsMutation.mutate({
      stackId: stack.id,
      blockGroups: [...filteredGroups, newGroup],
    });

    setSelectedBlockIndices(new Set());
    setIsSelectMode(false);
  };

  const handleUpdateGroup = (
    groupId: string,
    patch: Partial<TextBlockGroup>,
  ) => {
    const existing = stackWithBlocks?.blockGroups ?? [];
    const next = existing.map((g) =>
      g.id === groupId ? { ...g, ...patch } : g,
    );
    setBlockGroupsMutation.mutate({
      stackId: stack.id,
      blockGroups: next,
    });
  };

  const handleDeleteGroup = (groupId: string) => {
    const existing = stackWithBlocks?.blockGroups ?? [];
    const next = existing.filter((g) => g.id !== groupId);
    setBlockGroupsMutation.mutate({
      stackId: stack.id,
      blockGroups: next,
    });
  };

  const handleRemoveBlockFromGroup = (groupId: string, blockId: number) => {
    const existing = stackWithBlocks?.blockGroups ?? [];
    const next = existing
      .map((g) =>
        g.id === groupId
          ? { ...g, blockIds: g.blockIds.filter((id) => id !== blockId) }
          : g,
      )
      // Drop the group entirely once its last member leaves so we don't
      // leave a stale empty group lingering in storage.
      .filter((g) => g.blockIds.length > 0);
    setBlockGroupsMutation.mutate({
      stackId: stack.id,
      blockGroups: next,
    });
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

  // Pre-resolve groups against the current block order so the renderer can
  // emit either a standalone block or a contiguous run wrapped in a group.
  // Anything that isn't part of a resolved (contiguous) group renders loose.
  type RenderItem =
    | { kind: "block"; index: number }
    | { kind: "group"; group: TextBlockGroup; indices: number[] };
  const renderItems = useMemo<RenderItem[]>(() => {
    if (!stackWithBlocks?.blocks) return [];
    const blocks = stackWithBlocks.blocks;
    const groups = stackWithBlocks.blockGroups ?? [];
    const blockIds = blocks.map((b) => b.id);
    const { resolved } = resolveBlockGroups(groups, blockIds);
    const startToGroup = new Map<number, (typeof resolved)[number]>();
    resolved.forEach((r) => startToGroup.set(r.startIndex, r));

    const items: RenderItem[] = [];
    let i = 0;
    while (i < blocks.length) {
      const hit = startToGroup.get(i);
      if (hit) {
        const indices: number[] = [];
        for (let j = 0; j < hit.contiguousBlockIds.length; j++) {
          indices.push(i + j);
        }
        items.push({ kind: "group", group: hit.group, indices });
        i += hit.contiguousBlockIds.length;
      } else {
        items.push({ kind: "block", index: i });
        i++;
      }
    }
    return items;
  }, [stackWithBlocks?.blocks, stackWithBlocks?.blockGroups]);

  // Map every block index to the id of the group it belongs to (or null if
  // loose). Used by drag handling to detect cross-container drags.
  const indexToGroupId = useMemo(() => {
    const map = new Map<number, string | null>();
    renderItems.forEach((item) => {
      if (item.kind === "block") {
        map.set(item.index, null);
      } else {
        item.indices.forEach((i) => map.set(i, item.group.id));
      }
    });
    return map;
  }, [renderItems]);

  const activeParsedDrag = activeDragId ? parseSortId(activeDragId) : null;
  const overParsedDrag = overDragId ? parseSortId(overDragId) : null;
  const activeBlockIndex =
    activeParsedDrag?.kind === "block" ? activeParsedDrag.index : null;
  const overBlockIndex =
    overParsedDrag?.kind === "block" ? overParsedDrag.index : null;
  const activeBlockGroupId =
    activeBlockIndex !== null
      ? (indexToGroupId.get(activeBlockIndex) ?? null)
      : null;
  const overBlockGroupId =
    overBlockIndex !== null
      ? (indexToGroupId.get(overBlockIndex) ?? null)
      : null;
  const isCrossContainerDrag =
    activeBlockIndex !== null &&
    overBlockIndex !== null &&
    activeBlockIndex !== overBlockIndex &&
    activeBlockGroupId !== overBlockGroupId;
  // Drop line only when crossing INTO loose territory. Crossing into a group
  // is communicated via group highlight + always-append-to-end on drop.
  const dropIndicatorSide: "above" | "below" | null = (() => {
    if (!isCrossContainerDrag) return null;
    if (overBlockGroupId !== null) return null;
    if (activeBlockIndex === null || overBlockIndex === null) return null;
    const natural: "above" | "below" =
      activeBlockIndex < overBlockIndex ? "below" : "above";
    if (activeBlockGroupId !== null) {
      return natural === "above" ? "below" : "above";
    }
    return natural;
  })();
  // Which group (if any) is the highlighted drop target. Active must be a
  // block from outside the target group (or active over the group itself).
  const dropTargetGroupId: string | null = (() => {
    if (!activeParsedDrag || activeParsedDrag.kind !== "block") return null;
    if (!overParsedDrag) return null;
    if (overParsedDrag.kind === "group") {
      return activeBlockGroupId === overParsedDrag.groupId
        ? null
        : overParsedDrag.groupId;
    }
    if (overBlockGroupId !== null && overBlockGroupId !== activeBlockGroupId) {
      return overBlockGroupId;
    }
    return null;
  })();

  // The active block being dragged — used to render a DragOverlay so the
  // visual stays under the cursor across nested SortableContexts.
  const activeBlock =
    activeBlockIndex !== null && stackWithBlocks?.blocks
      ? stackWithBlocks.blocks[activeBlockIndex]
      : null;
  const activeBlockBorderColor = (() => {
    if (!activeBlock || !activeBlockGroupId) return null;
    const g = (stackWithBlocks?.blockGroups ?? []).find(
      (g) => g.id === activeBlockGroupId,
    );
    return g ? groupColorHex(g.color) : null;
  })();

  // Top-level sortable items: a string id per renderItem.
  const topLevelSortableIds = useMemo(
    () =>
      renderItems.map((item) =>
        item.kind === "block"
          ? blockSortId(item.index)
          : groupSortId(item.group.id),
      ),
    [renderItems],
  );

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
                {stack.labels && stack.labels.length > 0 && (
                  <span className="ml-3 inline-flex gap-1 flex-wrap align-middle">
                    {stack.labels.map((label) => (
                      <button
                        key={label}
                        onClick={() =>
                          navigate(
                            `/prompts?label=${encodeURIComponent(label)}`,
                          )
                        }
                        className="text-xs px-2 py-0.5 rounded-md bg-cyan-dark text-cyan-medium hover:bg-cyan-dark/80 transition-colors cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
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
            <div className="flex items-center gap-3">
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
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsNotesOpen(true)}
                      className={cn(
                        "text-cyan-medium hover:text-foreground transition-colors cursor-pointer",
                        stackWithBlocks?.notes && "text-foreground",
                      )}
                      aria-label="Prompt notes"
                    >
                      <StickyNote className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {stackWithBlocks?.notes ? "Edit notes" : "Add notes"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleGroupSelectedBlocks}
                    disabled={selectedBlockIndices.size === 0}
                  >
                    Group Blocks
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
                collisionDetection={collisionDetection}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
              >
                <div className="flex flex-col gap-4">
                  {stackWithBlocks?.blocks &&
                  stackWithBlocks.blocks.length > 0 ? (
                    <SortableContext
                      items={topLevelSortableIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {(() => {
                        const blocks = stackWithBlocks.blocks;
                        const renderBlockAt = (
                          index: number,
                          borderColor?: string | null,
                          inGroup?: boolean,
                          groupId?: string,
                        ) => {
                          const block = blocks[index];
                          const suppress =
                            isCrossContainerDrag && index !== activeBlockIndex;
                          const indicator =
                            isCrossContainerDrag && index === overBlockIndex
                              ? dropIndicatorSide
                              : null;
                          return (
                            <SortableBlock
                              key={index}
                              id={blockSortId(index)}
                              suppressTransform={suppress}
                              dropIndicator={indicator}
                              indicatorColor={borderColor ?? undefined}
                              compactHandle={inGroup}
                            >
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
                                    onDelete={() =>
                                      handleRemoveBlock(block.id, index)
                                    }
                                    onDuplicate={() =>
                                      handleDuplicateBlock(index)
                                    }
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
                                    borderColorOverride={borderColor ?? null}
                                    onRemoveFromGroup={
                                      groupId
                                        ? () =>
                                            handleRemoveBlockFromGroup(
                                              groupId,
                                              block.id,
                                            )
                                        : undefined
                                    }
                                  />
                                </div>
                              )}
                            </SortableBlock>
                          );
                        };
                        return renderItems.map((item) => {
                          if (item.kind === "block") {
                            return renderBlockAt(item.index);
                          }
                          const groupBorder = groupColorHex(item.group.color);
                          const innerIds = item.indices.map(blockSortId);
                          const groupBlockIds = item.indices
                            .map((i) => stackWithBlocks?.blocks?.[i]?.id)
                            .filter(
                              (id): id is number => typeof id === "number",
                            );
                          const currentDisabled =
                            stackWithBlocks?.disabledBlockIds ?? [];
                          const disabledCount = groupBlockIds.filter((id) =>
                            currentDisabled.includes(id),
                          ).length;
                          const groupDisabledState: "all" | "none" | "mixed" =
                            groupBlockIds.length === 0 || disabledCount === 0
                              ? "none"
                              : disabledCount === groupBlockIds.length
                                ? "all"
                                : "mixed";
                          return (
                            <BlockGroupContainer
                              key={item.group.id}
                              group={item.group}
                              blockCount={item.indices.length}
                              onUpdate={(patch) =>
                                handleUpdateGroup(item.group.id, patch)
                              }
                              onDelete={() => handleDeleteGroup(item.group.id)}
                              sortableId={groupSortId(item.group.id)}
                              isDropTarget={dropTargetGroupId === item.group.id}
                              disabledState={groupDisabledState}
                              onToggleDisable={async () => {
                                // mixed/none → disable-all; all → enable-all.
                                // toggleBlockDisabledInStack does a read-
                                // modify-write on the revision's disabled_
                                // block_ids array, so concurrent calls race
                                // and clobber each other. Await sequentially.
                                const targetDisabled =
                                  groupDisabledState !== "all";
                                for (const id of groupBlockIds) {
                                  const isDisabled =
                                    currentDisabled.includes(id);
                                  if (isDisabled !== targetDisabled) {
                                    await toggleBlockDisabledMutation.mutateAsync(
                                      { stackId: stack.id, blockId: id },
                                    );
                                  }
                                }
                              }}
                              onRandomize={
                                groupBlockIds.length < 2
                                  ? undefined
                                  : async () => {
                                      const enabledIds = groupBlockIds.filter(
                                        (id) => !currentDisabled.includes(id),
                                      );
                                      // Exclude the sole currently-enabled
                                      // block so randomize always changes
                                      // something. With 0 or 2+ enabled,
                                      // pick from the full set.
                                      const candidates =
                                        enabledIds.length === 1
                                          ? groupBlockIds.filter(
                                              (id) => id !== enabledIds[0],
                                            )
                                          : groupBlockIds;
                                      const winner =
                                        candidates[
                                          Math.floor(
                                            Math.random() * candidates.length,
                                          )
                                        ];
                                      for (const id of groupBlockIds) {
                                        const shouldBeDisabled = id !== winner;
                                        const isDisabled =
                                          currentDisabled.includes(id);
                                        if (isDisabled !== shouldBeDisabled) {
                                          await toggleBlockDisabledMutation.mutateAsync(
                                            { stackId: stack.id, blockId: id },
                                          );
                                        }
                                      }
                                    }
                              }
                            >
                              <SortableContext
                                items={innerIds}
                                strategy={verticalListSortingStrategy}
                              >
                                {item.indices.map((idx) =>
                                  renderBlockAt(
                                    idx,
                                    groupBorder,
                                    true,
                                    item.group.id,
                                  ),
                                )}
                              </SortableContext>
                            </BlockGroupContainer>
                          );
                        });
                      })()}
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

                  <DragOverlay dropAnimation={null}>
                    {activeBlock ? (
                      <div style={{ pointerEvents: "none" }}>
                        <TextBlock
                          block={activeBlock}
                          isDisabled={
                            stackWithBlocks?.disabledBlockIds?.includes(
                              activeBlock.id,
                            ) ?? false
                          }
                          onEdit={() => {}}
                          onDelete={() => {}}
                          style={stack.style}
                          borderColorOverride={activeBlockBorderColor}
                        />
                      </div>
                    ) : null}
                  </DragOverlay>

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
                data-action="add-new-block"
                onClick={() => setIsCreatingNew(true)}
                variant="default"
                disabled={blocksAtLimit}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New Block
              </Button>
              <Button
                onClick={() => setIsSearchOpen(true)}
                variant="tertiary"
                disabled={blocksAtLimit}
              >
                <Search className="mr-2 h-4 w-4" />
                Add Existing Block
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
