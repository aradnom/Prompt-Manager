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
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableBlock } from "@/components/SortableBlock";
import { groupColorHex } from "@/components/BlockGroupContainer";
import { ChevronDown, Eye, EyeOff, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TextBlockGroup } from "@/types/schema";
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
  onReorder,
  onToggleDisable,
}: {
  blockIds: number[];
  disabledBlockIds: number[];
  blockGroups: TextBlockGroup[] | null;
  onRemoveBlock?: (index: number) => void;
  onReorder?: (newBlockIds: number[]) => void;
  onToggleDisable?: (blockId: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [activeSortId, setActiveSortId] = useState<string | null>(null);

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
  // Build ordered list with index-based unique keys for duplicate support
  const ordered = blockIds
    .map((id, index) => {
      const block = blockMap.get(id);
      return block ? { block, sortId: `t-${index}` } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  // Read-only group annotation: for each position in `blockIds`, decide which
  // group owns it. We mirror the renderer's advisory rule — walk a group's
  // blockIds in order, anchor at the first match in the array, and stop at
  // the first non-contiguous member. The first position in a run gets a
  // header; all positions in the run get a left-border tint.
  type GroupRun = {
    groupId: string;
    name: string;
    color: string | null;
    /** position indices in `blockIds` that belong to this run */
    positions: number[];
  };
  const runs: GroupRun[] = [];
  const positionToRun = new Map<number, GroupRun>();
  if (blockGroups && blockGroups.length > 0) {
    const claimed = new Set<number>();
    for (const group of blockGroups) {
      const positions: number[] = [];
      let cursor = 0;
      for (const memberId of group.blockIds) {
        let found = -1;
        for (let i = cursor; i < blockIds.length; i++) {
          if (claimed.has(i)) continue;
          if (blockIds[i] === memberId) {
            found = i;
            break;
          }
        }
        if (found === -1) break;
        if (
          positions.length > 0 &&
          found !== positions[positions.length - 1] + 1
        ) {
          break;
        }
        positions.push(found);
        cursor = found + 1;
      }
      if (positions.length > 0) {
        const run: GroupRun = {
          groupId: group.id,
          name: group.name,
          color: group.color,
          positions,
        };
        runs.push(run);
        for (const p of positions) {
          claimed.add(p);
          positionToRun.set(p, run);
        }
      }
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveSortId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveSortId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = parseInt(String(active.id).slice(2), 10);
    const newIndex = parseInt(String(over.id).slice(2), 10);
    if (!Number.isFinite(oldIndex) || !Number.isFinite(newIndex)) return;

    onReorder(arrayMove(blockIds, oldIndex, newIndex));
  };

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

  const activeItem = activeSortId
    ? ordered.find((item) => item.sortId === activeSortId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveSortId(null)}
    >
      <SortableContext
        items={ordered.map((item) => item.sortId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {ordered.map(({ block, sortId }) => {
            const isDisabled = disabledBlockIds.includes(block.id);
            const positionIndex = parseInt(sortId.slice(2), 10);
            const run = positionToRun.get(positionIndex);
            const isRunStart =
              run !== undefined && run.positions[0] === positionIndex;
            const colorHex = run ? groupColorHex(run.color) : null;
            return (
              <div key={sortId}>
                {isRunStart && (
                  <div
                    className="flex items-center gap-2 px-2 py-1 rounded text-xs font-mono mb-1"
                    style={{
                      backgroundColor: colorHex
                        ? `color-mix(in srgb, ${colorHex} 18%, transparent)`
                        : "color-mix(in srgb, var(--color-cyan-medium) 18%, transparent)",
                      color: colorHex ?? "var(--color-cyan-medium)",
                    }}
                  >
                    <span className="font-semibold">
                      {run!.name || "Group"}
                    </span>
                  </div>
                )}
                <div
                  style={
                    run
                      ? {
                          borderLeft: `2px solid ${
                            colorHex ?? "var(--color-cyan-medium)"
                          }`,
                          paddingLeft: 8,
                        }
                      : undefined
                  }
                >
                  <SortableBlock id={sortId}>
                    {renderTile(block, sortId, isDisabled)}
                  </SortableBlock>
                </div>
              </div>
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeItem
          ? renderTile(
              activeItem.block,
              activeItem.sortId,
              disabledBlockIds.includes(activeItem.block.id),
            )
          : null}
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
          blockGroups={template.blockGroups ?? null}
          onRemoveBlock={(index) => {
            const newIds = blockIds.filter((_, i) => i !== index);
            setBlockIds(newIds);
            // If the removed id no longer appears anywhere in the template,
            // drop it from the disabled list too — same shape rule the stack
            // editor enforces.
            const stillPresent = newIds.includes(blockIds[index]);
            const newDisabled = stillPresent
              ? disabledBlockIds
              : disabledBlockIds.filter((id) => id !== blockIds[index]);
            if (newDisabled !== disabledBlockIds) {
              setDisabledBlockIds(newDisabled);
            }
            updateMutation.mutate({
              id: template.id,
              blockIds: newIds,
              ...(newDisabled !== disabledBlockIds && {
                disabledBlockIds: newDisabled,
              }),
            });
          }}
          onReorder={(newBlockIds) => {
            setBlockIds(newBlockIds);
            updateMutation.mutate({
              id: template.id,
              blockIds: newBlockIds,
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
              blockGroups: template.blockGroups ?? null,
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
