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
import { SortableBlock } from "@/components/SortableBlock";
import { ChevronDown, Search, X } from "lucide-react";
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
  onRemoveBlock,
  onReorder,
}: {
  blockIds: number[];
  onRemoveBlock?: (index: number) => void;
  onReorder?: (newBlockIds: number[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
      return block ? { block, sortId: index } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = active.id as number;
    const newIndex = over.id as number;

    onReorder(arrayMove(blockIds, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ordered.map((item) => item.sortId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {ordered.map(({ block, sortId }) => (
            <SortableBlock key={sortId} id={sortId}>
              <div className="relative border border-cyan-medium/30 rounded p-3 bg-cyan-dark/30 group">
                {onRemoveBlock && (
                  <button
                    onClick={() => onRemoveBlock(sortId)}
                    className="absolute top-2 right-2 text-cyan-medium hover:text-destructive transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                    aria-label="Remove block from template"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
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
            </SortableBlock>
          ))}
        </div>
      </SortableContext>
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

  const updateMutation = api.stackTemplates.update.useMutation({
    onSuccess: () => {
      utils.stackTemplates.list.invalidate();
      utils.stackTemplates.search.invalidate();
      utils.stackTemplates.get.invalidate();
      onUpdate?.();
    },
  });

  const { notifyUpsert } = useSync();
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
          onRemoveBlock={(index) => {
            const newIds = blockIds.filter((_, i) => i !== index);
            setBlockIds(newIds);
            updateMutation.mutate({
              id: template.id,
              blockIds: newIds,
            });
          }}
          onReorder={(newBlockIds) => {
            setBlockIds(newBlockIds);
            updateMutation.mutate({
              id: template.id,
              blockIds: newBlockIds,
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
