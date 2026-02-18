import { useState, useRef, useEffect } from "react";
import { api, RouterOutput } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { NotesDialog } from "@/components/NotesDialog";
import { ChevronDown, StickyNote } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OutputStyle } from "@/types/schema";

type Template = RouterOutput["stackTemplates"]["get"];

interface TemplateEditorProps {
  template: Template;
  onUpdate?: () => void;
}

function TemplateBlocks({ blockIds }: { blockIds: number[] }) {
  const { data: blocks, isLoading } = api.blocks.getByIds.useQuery(
    { ids: blockIds },
    { enabled: blockIds.length > 0 },
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
  const ordered = blockIds
    .map((id) => blockMap.get(id))
    .filter((b): b is NonNullable<typeof b> => b != null);

  return (
    <div className="space-y-2">
      {ordered.map((block) => (
        <div
          key={block.id}
          className="border border-cyan-medium/30 rounded p-3 bg-cyan-dark/30"
        >
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
      ))}
    </div>
  );
}

export function TemplateEditor({ template, onUpdate }: TemplateEditorProps) {
  const [editName, setEditName] = useState(template.name ?? "");
  const [commaSeparated, setCommaSeparated] = useState(template.commaSeparated);
  const [negative, setNegative] = useState(template.negative);
  const [style, setStyle] = useState<OutputStyle>(template.style);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);

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
        <label className="text-sm font-medium mb-2 block">
          Name
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setNotesDialogOpen(true)}
                  className={`ml-2 align-middle text-cyan-medium hover:text-foreground transition-colors cursor-pointer ${template.notes ? "text-foreground" : ""}`}
                  aria-label="Edit notes"
                >
                  <StickyNote className="inline h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {template.notes ? "Edit notes" : "Add notes"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </label>
        <input
          type="text"
          placeholder="e.g., Portrait Base Template"
          className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
          value={editName}
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
          Blocks ({template.blockIds.length})
        </label>
        <TemplateBlocks blockIds={template.blockIds} />
      </div>

      <NotesDialog
        title="Template Notes"
        placeholder="Add notes about this template..."
        initialNotes={template.notes}
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        onSave={(notes) => {
          updateMutation.mutate({ id: template.id, notes });
        }}
      />
    </div>
  );
}
