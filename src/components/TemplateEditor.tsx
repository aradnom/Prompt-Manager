import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData } from "@tanstack/react-query";
import { api, RouterOutput } from "@/lib/api";
import { useActiveStack } from "@/contexts/ActiveStackContext";
import { useSync } from "@/contexts/SyncContext";
import { generateDisplayId } from "@/lib/generate-display-id";
import { generateUUID } from "@/lib/uuid";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { BlockSearchDialog } from "@/components/BlockSearchDialog";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableBlock } from "@/components/SortableBlock";
import { BlockGroupContainer } from "@/components/BlockGroupContainer";
import { ChevronDown, Eye, EyeOff, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TextBlockGroup } from "@/types/schema";
import { resolveBlockGroups } from "@shared/block-groups";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OutputStyle } from "@/types/schema";
import { LENGTH_LIMITS } from "@shared/limits";

type Template = RouterOutput["stackTemplates"]["get"];

interface TemplateEditorProps {
  template: Template;
  onUpdate?: () => void;
}

function TemplateBlocks({
  blockIds,
  disabledBlockIds,
  blockGroups,
  onRemoveBlock,
  onApplyDragChange,
  onUpdateGroup,
  onDeleteGroup,
  onToggleDisable,
}: {
  blockIds: number[];
  disabledBlockIds: number[];
  blockGroups: TextBlockGroup[] | null;
  onRemoveBlock?: (index: number) => void;
  /** Single-shot drag-end handler — applies new block order and (optionally)
   *  updated group membership in one mutation. */
  onApplyDragChange?: (
    newBlockIds: number[],
    newBlockGroups: TextBlockGroup[] | null,
  ) => void;
  onUpdateGroup?: (groupId: string, patch: Partial<TextBlockGroup>) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleDisable?: (blockId: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [activeSortId, setActiveSortId] = useState<string | null>(null);
  const [overSortId, setOverSortId] = useState<string | null>(null);

  const { data: blocks, isLoading } = api.blocks.getByIds.useQuery(
    { ids: blockIds },
    { enabled: blockIds.length > 0, placeholderData: keepPreviousData },
  );

  if (blockIds.length === 0) {
    return (
      <p className="text-sm text-cyan-medium italic">No blocks in template</p>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-cyan-medium">Loading blocks...</p>;
  }

  if (!blocks || blocks.length === 0) {
    return (
      <p className="text-sm text-cyan-medium italic">
        Blocks not found (may have been deleted)
      </p>
    );
  }

  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  // Sortable id helpers — `b-${index}` for blocks (index into `blockIds`),
  // `g-${groupId}` for groups.
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

  // Resolve groups against the current canonical blockIds order so we can emit
  // standalone blocks vs contiguous group runs.
  type RenderItem =
    | { kind: "block"; index: number }
    | { kind: "group"; group: TextBlockGroup; indices: number[] };
  const renderItems: RenderItem[] = (() => {
    const groups = blockGroups ?? [];
    const { resolved } = resolveBlockGroups(groups, blockIds);
    const startToGroup = new Map<number, (typeof resolved)[number]>();
    resolved.forEach((r) => startToGroup.set(r.startIndex, r));
    const items: RenderItem[] = [];
    let i = 0;
    while (i < blockIds.length) {
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
  })();

  const indexToGroupId = new Map<number, string | null>();
  renderItems.forEach((item) => {
    if (item.kind === "block") indexToGroupId.set(item.index, null);
    else item.indices.forEach((i) => indexToGroupId.set(i, item.group.id));
  });

  const topLevelSortableIds = renderItems.map((item) =>
    item.kind === "block"
      ? blockSortId(item.index)
      : groupSortId(item.group.id),
  );

  // Filter group containers out of collision candidates while a block is
  // being dragged — same trick StackEditor uses to avoid mid-drag flips when
  // group rect roughly centers on its child block.
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
    setActiveSortId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverSortId(over ? String(over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSortId(null);
    setOverSortId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !onApplyDragChange) return;

    const activeParsed = parseSortId(String(active.id));
    const overParsed = parseSortId(String(over.id));
    if (!activeParsed || !overParsed) return;

    const groups = blockGroups ?? [];

    const resyncGroupOrder = (
      g: TextBlockGroup,
      flat: number[],
      mutated: { changed: boolean },
    ): TextBlockGroup => {
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

    // Group dragging: move the active group's contiguous range as a unit.
    if (activeParsed.kind === "group") {
      const sourceGroup = groups.find((g) => g.id === activeParsed.groupId);
      if (!sourceGroup) return;
      const groupIdSet = new Set(sourceGroup.blockIds);
      const groupBlocksInOrder = blockIds.filter((id) => groupIdSet.has(id));
      const sourceFirstIdx = blockIds.findIndex((id) => groupIdSet.has(id));

      let targetBlockId: number | undefined;
      let side: "above" | "below" = "below";
      if (overParsed.kind === "block") {
        targetBlockId = blockIds[overParsed.index];
        side = sourceFirstIdx < overParsed.index ? "below" : "above";
      } else {
        const targetGroup = groups.find((g) => g.id === overParsed.groupId);
        if (!targetGroup) return;
        const targetIds = new Set(targetGroup.blockIds);
        const inOrder = blockIds.filter((id) => targetIds.has(id));
        const targetFirstIdx = blockIds.findIndex((id) => targetIds.has(id));
        side = sourceFirstIdx < targetFirstIdx ? "below" : "above";
        targetBlockId =
          side === "below" ? inOrder[inOrder.length - 1] : inOrder[0];
      }
      if (targetBlockId === undefined) return;

      const without = blockIds.filter((id) => !groupIdSet.has(id));
      const targetIdx = without.findIndex((id) => id === targetBlockId);
      if (targetIdx === -1) return;
      const insertAt = side === "below" ? targetIdx + 1 : targetIdx;
      const reordered = [
        ...without.slice(0, insertAt),
        ...groupBlocksInOrder,
        ...without.slice(insertAt),
      ];
      const mutated = { changed: false };
      const resynced = groups.map((g) =>
        resyncGroupOrder(g, reordered, mutated),
      );
      onApplyDragChange(reordered, resynced);
      return;
    }

    // Active is a block.
    const oldIndex = activeParsed.index;
    const oldGroupId = indexToGroupId.get(oldIndex) ?? null;
    let overIndex: number;
    let overGroupId: string | null;
    let effectiveSide: "above" | "below" = "below";

    const lastIdxOfGroup = (groupId: string): number => {
      const target = groups.find((g) => g.id === groupId);
      if (!target) return -1;
      const targetIds = new Set(target.blockIds);
      let lastIdx = -1;
      for (let i = 0; i < blockIds.length; i++) {
        if (targetIds.has(blockIds[i])) lastIdx = i;
      }
      return lastIdx;
    };

    if (overParsed.kind === "group") {
      const lastIdx = lastIdxOfGroup(overParsed.groupId);
      if (lastIdx === -1) return;
      overIndex = lastIdx;
      overGroupId = overParsed.groupId;
      effectiveSide = "below";
    } else {
      overIndex = overParsed.index;
      overGroupId = indexToGroupId.get(overIndex) ?? null;
      effectiveSide = oldIndex < overIndex ? "below" : "above";
      if (overGroupId !== null && overGroupId !== oldGroupId) {
        const lastIdx = lastIdxOfGroup(overGroupId);
        if (lastIdx !== -1) {
          overIndex = lastIdx;
          effectiveSide = "below";
        }
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

    const reordered = arrayMove(blockIds, oldIndex, newIndex);
    const activeBlockId = blockIds[oldIndex];
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
      return resyncGroupOrder({ ...g, blockIds: ids }, reordered, mutated);
    });

    onApplyDragChange(reordered, mutated.changed ? updatedGroups : groups);
  };

  // Compute drop highlight + drag-overlay state from active/over.
  const activeParsed = activeSortId ? parseSortId(activeSortId) : null;
  const overParsed = overSortId ? parseSortId(overSortId) : null;
  const activeBlockIndex =
    activeParsed?.kind === "block" ? activeParsed.index : null;
  const overBlockIndex = overParsed?.kind === "block" ? overParsed.index : null;
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
  const dropIndicatorSide: "above" | "below" | null =
    isCrossContainerDrag &&
    overBlockGroupId === null &&
    activeBlockIndex !== null &&
    overBlockIndex !== null
      ? activeBlockIndex < overBlockIndex
        ? "below"
        : "above"
      : null;
  const dropTargetGroupId: string | null = (() => {
    if (!activeParsed || activeParsed.kind !== "block") return null;
    if (!overParsed) return null;
    if (overParsed.kind === "group") {
      return activeBlockGroupId === overParsed.groupId
        ? null
        : overParsed.groupId;
    }
    if (overBlockGroupId !== null && overBlockGroupId !== activeBlockGroupId) {
      return overBlockGroupId;
    }
    return null;
  })();

  const activeBlock = (() => {
    if (activeBlockIndex === null) return null;
    const id = blockIds[activeBlockIndex];
    return id !== undefined ? (blockMap.get(id) ?? null) : null;
  })();
  const renderTile = (
    block: NonNullable<ReturnType<typeof blockMap.get>>,
    sortId: string,
    isDisabled: boolean,
  ) => (
    <div
      className={cn(
        "relative border border-cyan-medium/30 rounded p-3 bg-cyan-dark/30 group",
        isDisabled && "opacity-40 grayscale contrast-75",
      )}
    >
      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100">
        {onToggleDisable && (
          <button
            onClick={() => onToggleDisable(block.id)}
            className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
            aria-label={
              isDisabled
                ? "Enable block in this template"
                : "Disable block in this template"
            }
          >
            {isDisabled ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
        {onRemoveBlock && (
          <button
            onClick={() => onRemoveBlock(parseInt(sortId.slice(2), 10))}
            className="text-cyan-medium hover:text-destructive transition-colors cursor-pointer"
            aria-label="Remove block from template"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono text-cyan-medium">
          {block.name || block.displayId}
        </span>
        {block.name && (
          <span className="text-xs font-mono text-cyan-medium/60">
            {block.displayId}
          </span>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap font-mono text-foreground/80">
        {block.text}
      </p>
    </div>
  );

  const renderBlockAt = (index: number, inGroup?: boolean) => {
    const id = blockIds[index];
    const block = blockMap.get(id);
    if (!block) return null;
    const sortId = blockSortId(index);
    const isDisabled = disabledBlockIds.includes(block.id);
    const suppress = isCrossContainerDrag && index !== activeBlockIndex;
    const indicator =
      isCrossContainerDrag && index === overBlockIndex
        ? dropIndicatorSide
        : null;
    return (
      <SortableBlock
        key={sortId}
        id={sortId}
        suppressTransform={suppress}
        dropIndicator={indicator}
        compactHandle={inGroup}
      >
        {renderTile(block, sortId, isDisabled)}
      </SortableBlock>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveSortId(null);
        setOverSortId(null);
      }}
    >
      <SortableContext
        items={topLevelSortableIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {renderItems.map((item) => {
            if (item.kind === "block") {
              return renderBlockAt(item.index);
            }
            const innerIds = item.indices.map(blockSortId);
            return (
              <BlockGroupContainer
                key={item.group.id}
                group={item.group}
                blockCount={item.indices.length}
                onUpdate={(patch) => onUpdateGroup?.(item.group.id, patch)}
                onDelete={() => onDeleteGroup?.(item.group.id)}
                sortableId={groupSortId(item.group.id)}
                isDropTarget={dropTargetGroupId === item.group.id}
              >
                <SortableContext
                  items={innerIds}
                  strategy={verticalListSortingStrategy}
                >
                  {item.indices.map((idx) => renderBlockAt(idx, true))}
                </SortableContext>
              </BlockGroupContainer>
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeBlock ? (
          <div style={{ pointerEvents: "none" }}>
            {renderTile(
              activeBlock,
              blockSortId(activeBlockIndex ?? 0),
              disabledBlockIds.includes(activeBlock.id),
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function TemplateEditor({ template, onUpdate }: TemplateEditorProps) {
  const navigate = useNavigate();
  const { setActiveStack } = useActiveStack();
  const [editName, setEditName] = useState(template.name ?? "");
  const [commaSeparated, setCommaSeparated] = useState(template.commaSeparated);
  const [negative, setNegative] = useState(template.negative);
  const [style, setStyle] = useState<OutputStyle>(template.style);
  const [blockIds, setBlockIds] = useState(template.blockIds);
  const [disabledBlockIds, setDisabledBlockIds] = useState(
    template.disabledBlockIds ?? [],
  );
  const [localBlockGroups, setLocalBlockGroups] = useState<
    TextBlockGroup[] | null
  >(template.blockGroups ?? null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Reset local state when switching to a different template
  const prevTemplateId = useRef(template.id);
  if (prevTemplateId.current !== template.id) {
    prevTemplateId.current = template.id;
    setEditName(template.name ?? "");
    setCommaSeparated(template.commaSeparated);
    setNegative(template.negative);
    setStyle(template.style);
    setBlockIds(template.blockIds);
    setDisabledBlockIds(template.disabledBlockIds ?? []);
    setLocalBlockGroups(template.blockGroups ?? null);
  }

  const utils = api.useUtils();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasPendingSave = useRef(false);

  const formValuesRef = useRef({
    editName,
    commaSeparated,
    negative,
    style,
  });
  formValuesRef.current = { editName, commaSeparated, negative, style };

  const { notifyUpsert } = useSync();
  const updateMutation = api.stackTemplates.update.useMutation({
    onSuccess: (data) => {
      notifyUpsert("templates", data as unknown as { id: number });
      utils.stackTemplates.list.invalidate();
      utils.stackTemplates.get.invalidate();
      onUpdate?.();
    },
  });

  const createStackMutation = api.stacks.create.useMutation({
    onSuccess: (newStack) => {
      notifyUpsert("stacks", newStack as unknown as { id: number });
      utils.stacks.list.invalidate();
      setActiveStack(newStack);
      navigate("/");
    },
  });

  const saveChanges = () => {
    const vals = formValuesRef.current;
    hasPendingSave.current = false;
    updateMutation.mutate({
      id: template.id,
      name: vals.editName.trim() || null,
      commaSeparated: vals.commaSeparated,
      negative: vals.negative,
      style: vals.style,
    });
  };

  const debouncedSave = () => {
    hasPendingSave.current = true;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges();
    }, 500);
  };

  // Save pending changes on unmount
  useEffect(() => {
    const mutate = updateMutation.mutate;
    const templateId = template.id;

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (hasPendingSave.current) {
        const vals = formValuesRef.current;
        mutate({
          id: templateId,
          name: vals.editName.trim() || null,
          commaSeparated: vals.commaSeparated,
          negative: vals.negative,
          style: vals.style,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveImmediate = (overrides: Partial<typeof formValuesRef.current>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    const vals = { ...formValuesRef.current, ...overrides };
    setTimeout(() => {
      updateMutation.mutate({
        id: template.id,
        name: vals.editName.trim() || null,
        commaSeparated: vals.commaSeparated,
        negative: vals.negative,
        style: vals.style,
      });
    }, 0);
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-sm font-medium mb-2 block">Name</label>
        <input
          type="text"
          placeholder="e.g., Portrait Base Template"
          className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
          value={editName}
          maxLength={LENGTH_LIMITS.name}
          onChange={(e) => {
            setEditName(e.target.value);
            debouncedSave();
          }}
          onBlur={saveChanges}
        />
      </div>

      {/* Settings */}
      <div>
        <label className="text-sm font-medium mb-2 block">Settings</label>
        <hr className="mb-4" />
        <div className="flex flex-col md:flex-row md:gap-4">
          <div className="flex flex-1 gap-4 mb-4">
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <Checkbox
                  checked={commaSeparated}
                  onCheckedChange={(checked) => {
                    setCommaSeparated(checked as boolean);
                    saveImmediate({ commaSeparated: checked as boolean });
                  }}
                  className="cursor-pointer"
                />
                Comma Separated
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <Checkbox
                  checked={negative}
                  onCheckedChange={(checked) => {
                    setNegative(checked as boolean);
                    saveImmediate({ negative: checked as boolean });
                  }}
                  className="cursor-pointer"
                />
                Negative Prompt
              </label>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-sm mb-2 block">LLM Output Style</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-cyan-medium bg-background hover:bg-cyan-dark/20 transition-colors">
                <span className="text-sm">
                  {style === "t5"
                    ? "T5 (Natural Language)"
                    : style === "clip"
                      ? "CLIP (Keywords)"
                      : "None"}
                </span>
                <ChevronDown className="h-4 w-4 text-cyan-medium" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-75" align="start">
                <DropdownMenuRadioGroup
                  value={style || "none"}
                  onValueChange={(value) => {
                    const newStyle =
                      value === "none" ? null : (value as OutputStyle);
                    setStyle(newStyle);
                    saveImmediate({ style: newStyle });
                  }}
                >
                  <DropdownMenuRadioItem value="none">
                    <div className="flex flex-col gap-0.5">
                      <div className="font-medium">None</div>
                      <div className="text-xs text-cyan-medium">
                        No special formatting
                      </div>
                    </div>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="t5">
                    <div className="flex flex-col gap-0.5">
                      <div className="font-medium">T5 (Natural Language)</div>
                      <div className="text-xs text-cyan-medium">
                        Descriptive sentences and phrases
                      </div>
                    </div>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="clip">
                    <div className="flex flex-col gap-0.5">
                      <div className="font-medium">CLIP (Keywords)</div>
                      <div className="text-xs text-cyan-medium">
                        Comma-separated keywords and tags
                      </div>
                    </div>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Blocks ({blockIds.length})
        </label>
        <TemplateBlocks
          blockIds={blockIds}
          disabledBlockIds={disabledBlockIds}
          blockGroups={localBlockGroups}
          onRemoveBlock={(index) => {
            const removedId = blockIds[index];
            const newIds = blockIds.filter((_, i) => i !== index);
            setBlockIds(newIds);
            const stillPresent = newIds.includes(removedId);
            const newDisabled = stillPresent
              ? disabledBlockIds
              : disabledBlockIds.filter((id) => id !== removedId);
            if (newDisabled !== disabledBlockIds) {
              setDisabledBlockIds(newDisabled);
            }
            // Drop the removed block from any group memberships, too — purely
            // local; persisted via the same update call.
            const newGroups = localBlockGroups
              ? localBlockGroups.map((g) => ({
                  ...g,
                  blockIds: g.blockIds.filter((id) => id !== removedId),
                }))
              : null;
            const groupsChanged =
              !!localBlockGroups &&
              localBlockGroups.some(
                (g, i) =>
                  g.blockIds.length !== (newGroups?.[i].blockIds.length ?? 0),
              );
            if (groupsChanged) setLocalBlockGroups(newGroups);
            updateMutation.mutate({
              id: template.id,
              blockIds: newIds,
              ...(newDisabled !== disabledBlockIds && {
                disabledBlockIds: newDisabled,
              }),
              ...(groupsChanged && { blockGroups: newGroups }),
            });
          }}
          onApplyDragChange={(newBlockIds, newBlockGroups) => {
            setBlockIds(newBlockIds);
            setLocalBlockGroups(newBlockGroups);
            updateMutation.mutate({
              id: template.id,
              blockIds: newBlockIds,
              blockGroups: newBlockGroups,
            });
          }}
          onUpdateGroup={(groupId, patch) => {
            const next =
              localBlockGroups?.map((g) =>
                g.id === groupId ? { ...g, ...patch } : g,
              ) ?? null;
            setLocalBlockGroups(next);
            updateMutation.mutate({
              id: template.id,
              blockGroups: next,
            });
          }}
          onDeleteGroup={(groupId) => {
            const next =
              localBlockGroups?.filter((g) => g.id !== groupId) ?? null;
            setLocalBlockGroups(next);
            updateMutation.mutate({
              id: template.id,
              blockGroups: next,
            });
          }}
          onToggleDisable={(blockId) => {
            const newDisabled = disabledBlockIds.includes(blockId)
              ? disabledBlockIds.filter((id) => id !== blockId)
              : [...disabledBlockIds, blockId];
            setDisabledBlockIds(newDisabled);
            updateMutation.mutate({
              id: template.id,
              disabledBlockIds: newDisabled,
            });
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => setIsSearchOpen(true)}
          disabled={blockIds.length >= LENGTH_LIMITS.blockIds}
        >
          <Search className="mr-2 h-4 w-4" />
          Add Existing Block
        </Button>
        <Button
          onClick={() => {
            const name = template.name?.replace(/ Template$/, "") || undefined;
            createStackMutation.mutate({
              uuid: generateUUID(),
              displayId: generateDisplayId(),
              name,
              commaSeparated,
              negative,
              style,
              blockIds,
              disabledBlockIds,
              blockGroups: localBlockGroups,
            });
          }}
          disabled={createStackMutation.isPending}
        >
          {createStackMutation.isPending ? "Creating..." : "Use Template"}
        </Button>
      </div>

      <BlockSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={(blockId) => {
          const newIds = [...blockIds, blockId];
          setBlockIds(newIds);
          updateMutation.mutate({
            id: template.id,
            blockIds: newIds,
          });
          setIsSearchOpen(false);
        }}
      />
    </div>
  );
}
