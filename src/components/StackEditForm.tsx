import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { api, RouterOutput } from "@/lib/api";
import { applyCommaSeparation } from "@/lib/comma-separation";
import {
  resolveWildcardsInText,
  resolveWildcardsWithMarkers,
} from "@/lib/wildcard-resolver";
import { TextWithWildcards } from "@/components/TextWithWildcards";
import { DisplayIdInput } from "@/components/ui/display-id-input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import type { OutputStyle } from "@/types/schema";

type Stack = RouterOutput["stacks"]["list"]["items"][number];
type StackWithBlocks = RouterOutput["stacks"]["get"];

interface StackEditFormProps {
  stack: Stack;
  stackDetails: StackWithBlocks;
  onClose: () => void;
}

export function StackEditForm({ stack, stackDetails }: StackEditFormProps) {
  const [editName, setEditName] = useState(stack.name || "");
  const [editDisplayId, setEditDisplayId] = useState(stack.displayId);
  const [commaSeparated, setCommaSeparated] = useState(stack.commaSeparated);
  const [negative, setNegative] = useState(stack.negative);
  const [style, setStyle] = useState<OutputStyle>(stack.style);
  const [notes, setNotes] = useState(stack.notes || "");

  const { data: wildcardsData } = api.wildcards.list.useQuery();
  const wildcards = wildcardsData?.items;
  const utils = api.useUtils();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasPendingSave = useRef(false);

  // Keep a ref to the latest form values for the cleanup effect
  const formValuesRef = useRef({
    editName,
    editDisplayId,
    commaSeparated,
    negative,
    style,
    notes,
  });
  formValuesRef.current = {
    editName,
    editDisplayId,
    commaSeparated,
    negative,
    style,
    notes,
  };

  const updateMutation = api.stacks.update.useMutation({
    onSuccess: () => {
      utils.stacks.list.invalidate();
      utils.stacks.get.invalidate();
    },
  });

  const saveChanges = () => {
    const vals = formValuesRef.current;
    if (!vals.editDisplayId.trim()) return;
    hasPendingSave.current = false;

    updateMutation.mutate({
      id: stack.id,
      name: vals.editName.trim() || undefined,
      displayId: vals.editDisplayId.trim(),
      commaSeparated: vals.commaSeparated,
      negative: vals.negative,
      style: vals.style,
      notes: vals.notes.trim() || null,
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
    const stackId = stack.id;

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (hasPendingSave.current) {
        const vals = formValuesRef.current;
        if (vals.editDisplayId.trim()) {
          mutate({
            id: stackId,
            name: vals.editName.trim() || undefined,
            displayId: vals.editDisplayId.trim(),
            commaSeparated: vals.commaSeparated,
            negative: vals.negative,
            style: vals.style,
            notes: vals.notes.trim() || null,
          });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getProcessedContent = (content: string): string => {
    if (!commaSeparated) return content;
    return applyCommaSeparation(content);
  };

  // Compile stack content
  const stackContent = useMemo(() => {
    if (!stackDetails || !("blocks" in stackDetails)) {
      return { rendered: "", withMarkers: "" };
    }

    const rawText = stackDetails.blocks.map((b) => b.text).join("\n\n");

    if (!wildcards) {
      return { rendered: rawText, withMarkers: rawText };
    }

    const rendered = resolveWildcardsInText(rawText, wildcards);
    const withMarkers = resolveWildcardsWithMarkers(rawText, wildcards);

    return { rendered, withMarkers };
  }, [stackDetails, wildcards]);

  const processedContent = getProcessedContent(stackContent.withMarkers);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <CardContent className="space-y-4 pt-0">
        <div className="text-xs text-cyan-medium">
          Created {formatDate(stack.createdAt)}, last updated{" "}
          {formatDate(stack.updatedAt)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Name (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Summer Landscapes"
              className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                debouncedSave();
              }}
              onBlur={saveChanges}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Display ID</label>
            <DisplayIdInput
              placeholder="e.g., summer-landscape-v1"
              className="w-full"
              value={editDisplayId}
              onChange={(value) => {
                setEditDisplayId(value);
                debouncedSave();
              }}
              onBlur={saveChanges}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Settings</label>
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <label
                className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={commaSeparated}
                  onCheckedChange={(checked) => {
                    setCommaSeparated(checked as boolean);
                    // Save immediately on checkbox change
                    if (saveTimeoutRef.current) {
                      clearTimeout(saveTimeoutRef.current);
                    }
                    setTimeout(() => {
                      updateMutation.mutate({
                        id: stack.id,
                        name: editName.trim() || undefined,
                        displayId: editDisplayId.trim(),
                        commaSeparated: checked as boolean,
                        style,
                      });
                    }, 0);
                  }}
                  className="cursor-pointer"
                />
                Comma Separated
              </label>
            </div>

            <div className="flex-1">
              <label
                className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={negative}
                  onCheckedChange={(checked) => {
                    setNegative(checked as boolean);
                    if (saveTimeoutRef.current) {
                      clearTimeout(saveTimeoutRef.current);
                    }
                    setTimeout(() => {
                      updateMutation.mutate({
                        id: stack.id,
                        name: editName.trim() || undefined,
                        displayId: editDisplayId.trim(),
                        commaSeparated,
                        negative: checked as boolean,
                        style,
                      });
                    }, 0);
                  }}
                  className="cursor-pointer"
                />
                Negative Prompt
              </label>
            </div>

            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
              <label className="text-sm mb-2 block">LLM Output Style</label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-cyan-medium bg-background hover:bg-cyan-dark/20 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-sm">
                    {style === "t5"
                      ? "T5 (Natural Language)"
                      : style === "clip"
                        ? "CLIP (Keywords)"
                        : "None"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-cyan-medium" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-75"
                  align="start"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuRadioGroup
                    value={style || "none"}
                    onValueChange={(value) => {
                      const newStyle =
                        value === "none" ? null : (value as OutputStyle);
                      setStyle(newStyle);
                      // Save immediately on style change
                      if (saveTimeoutRef.current) {
                        clearTimeout(saveTimeoutRef.current);
                      }
                      setTimeout(() => {
                        updateMutation.mutate({
                          id: stack.id,
                          name: editName.trim() || undefined,
                          displayId: editDisplayId.trim(),
                          commaSeparated,
                          style: newStyle,
                        });
                      }, 0);
                    }}
                  >
                    <DropdownMenuRadioItem
                      value="none"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium">None</div>
                        <div className="text-xs text-cyan-medium">
                          No special formatting
                        </div>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="t5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium">T5 (Natural Language)</div>
                        <div className="text-xs text-cyan-medium">
                          Complete sentences for FLUX-style models
                        </div>
                      </div>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="clip"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium">CLIP (Keywords)</div>
                        <div className="text-xs text-cyan-medium">
                          Comma-separated tags for Stable Diffusion
                        </div>
                      </div>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Prompt Output
          </label>
          <Card className="border-2 border-magenta-medium shadow-lg bg-background">
            <CardContent className="pt-6 max-h-48 overflow-y-auto">
              {stackContent.rendered ? (
                <TextWithWildcards
                  text={processedContent}
                  className="text-base whitespace-pre-wrap font-mono"
                  valueOnly={true}
                />
              ) : (
                <p className="text-cyan-medium text-sm">
                  No blocks in this prompt
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Notes</label>
          <textarea
            placeholder="Add notes about this prompt..."
            className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background resize-none h-24 font-mono text-sm"
            value={notes}
            maxLength={4000}
            onChange={(e) => {
              setNotes(e.target.value);
              debouncedSave();
            }}
            onBlur={saveChanges}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="text-xs text-cyan-medium mt-1 text-right">
            {notes.length}/4000
          </div>
        </div>
      </CardContent>
    </motion.div>
  );
}
