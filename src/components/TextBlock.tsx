import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Info,
  Clock,
  Copy,
  Folder,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  StickyNote,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { api, RouterOutput } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnimatedButton } from "@/components/ui/animated-button";
import { LoadingAnimatedButton } from "@/components/ui/loading-animated-button";
import { ExpandingIcon } from "@/components/ui/expanding-icon";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { TEXT_BLOCK_ANIMATION } from "@/lib/text-block-animation-settings";
import { calculateNonOverlappingPositions } from "@/lib/layout-utils";
import { resolveWildcardsInText } from "@/lib/wildcard-resolver";
import { insertWildcard, parseWildcards } from "@/lib/wildcard-parser";
import { WildcardBrowser } from "@/components/WildcardBrowser";
import { DiffText } from "@/components/DiffText";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { BlockSearchDialog } from "@/components/BlockSearchDialog";
import { NotesDialog } from "@/components/NotesDialog";
import { LLMGuard } from "@/components/LLMGuard";
import { InlineIconBadge } from "@/components/ui/inline-icon-badge";
import { TextWithWildcards } from "@/components/TextWithWildcards";
import {
  TextSelectionMenu,
  normalizeToWordBoundaries,
} from "@/components/TextSelectionMenu";

import { useTransform } from "@/hooks/useTransform";
import { useLLMStatus } from "@/contexts/LLMStatusContext";
import { useSync } from "@/contexts/SyncContext";
import type { OutputStyle } from "@/types/schema";
import { LENGTH_LIMITS } from "@shared/limits";

/**
 * Get the approximate pixel position of a text offset within a textarea
 * Uses a mirror div technique to measure text position
 */
function getTextareaCaretPosition(
  textarea: HTMLTextAreaElement,
  offset: number,
): { top: number; left: number } {
  // Create a mirror div with the same styling
  const mirror = document.createElement("div");
  const style = window.getComputedStyle(textarea);

  // Copy relevant styles - position at top-left for easy measurement
  mirror.style.position = "fixed";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.width = style.width;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.letterSpacing = style.letterSpacing;

  // Create text node for content before the offset
  const textBefore = textarea.value.substring(0, offset);
  const textNode = document.createTextNode(textBefore);
  mirror.appendChild(textNode);

  // Add a marker span to measure position
  const marker = document.createElement("span");
  marker.textContent = "\u200b"; // Zero-width space
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();

  document.body.removeChild(mirror);

  // markerRect.top is the offset from viewport top (which equals offset within mirror since mirror is at top:0)
  // Add that to the textarea's position, accounting for scroll
  return {
    top: textareaRect.top + markerRect.top - textarea.scrollTop,
    left: textareaRect.left + markerRect.left - textarea.scrollLeft,
  };
}

/**
 * Check if a selection range overlaps with any wildcard marker in the text
 */
function selectionOverlapsWildcard(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  const wildcards = parseWildcards(text);
  return wildcards.some((w) => {
    const wildcardEnd = w.index + w.fullMatch.length;
    // Check if ranges overlap
    return selectionStart < wildcardEnd && selectionEnd > w.index;
  });
}

type Block = RouterOutput["blocks"]["list"]["items"][number];

interface TextBlockProps {
  block: Block;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onTransform?: (blockId: number, transformedText: string) => void;
  onSelectBlock?: (blockId: number) => void;
  isDeleting?: boolean;
  isDisabled?: boolean;
  onToggleDisable?: () => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  defaultActive?: boolean;
  alwaysActive?: boolean;
  style?: OutputStyle;
}

export function TextBlock({
  block,
  onEdit,
  onDelete,
  onDuplicate,
  onTransform,
  onSelectBlock,
  isDisabled,
  onToggleDisable,
  isDeleting,
  isSelectMode,
  isSelected,
  onToggleSelect,
  defaultActive = false,
  alwaysActive = false,
  style,
}: TextBlockProps) {
  const [isActive, setIsActive] = useState(defaultActive || alwaysActive);
  const [isRenamingBlock, setIsRenamingBlock] = useState(false);
  const [renameValue, setRenameValue] = useState(block.name ?? "");
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineText, setInlineText] = useState(block.text);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [exploreVariations, setExploreVariations] = useState<string[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [hoveredRevisionId, setHoveredRevisionId] = useState<number | null>(
    null,
  );
  const [isTypeSearchOpen, setIsTypeSearchOpen] = useState(false);
  const [isLabelSearchOpen, setIsLabelSearchOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [isWildcardBrowserOpen, setIsWildcardBrowserOpen] = useState(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [activeTransform, setActiveTransform] = useState<
    "more" | "less" | "variation" | null
  >(null);
  const [textSelection, setTextSelection] = useState<{
    text: string;
    range: Range;
    startOffset: number;
    endOffset: number;
  } | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasPendingInlineSave = useRef(false);
  const inlineTextRef = useRef(block.text);
  const utils = api.useUtils();
  const { isLLMConfigured } = useLLMStatus();
  const { notifyUpsert } = useSync();
  const transformMutation = useTransform();
  const exploreMutation = useTransform();
  const { data: wildcardsData } = api.wildcards.list.useQuery();
  const wildcards = wildcardsData?.items;
  const invalidateBlocks = () => {
    utils.blocks.invalidate();
    utils.blockFolders.invalidate();
    utils.stacks.invalidate();
  };
  const onBlockMutated = (data: { id: number }) => {
    notifyUpsert("blocks", data);
    invalidateBlocks();
  };
  const setActiveRevisionMutation = api.blocks.setActiveRevision.useMutation({
    onSuccess: onBlockMutated,
  });
  const updateNotesMutation = api.blocks.update.useMutation({
    onSuccess: onBlockMutated,
  });
  const renameMutation = api.blocks.update.useMutation({
    onSuccess: onBlockMutated,
  });

  const saveBlockName = () => {
    const trimmed = renameValue.trim();
    const newName = trimmed || undefined;
    if ((newName ?? null) !== (block.name ?? null)) {
      renameMutation.mutate({ id: block.id, name: newName });
    }
    setIsRenamingBlock(false);
  };
  const revisionsQuery = api.blocks.getRevisions.useQuery(
    { id: block.id },
    { enabled: showRevisions },
  );

  // Get resolved text (wildcards replaced with actual values)
  const getResolvedText = (text: string) => {
    return wildcards ? resolveWildcardsInText(text, wildcards) : text;
  };

  // Sort revisions to put active one first
  const sortedRevisions = useMemo(() => {
    if (!revisionsQuery.data) return [];

    const revisions = [...revisionsQuery.data];
    const activeRevisionId = block.activeRevisionId;

    if (activeRevisionId) {
      revisions.sort((a, b) => {
        if (a.id === activeRevisionId) return -1;
        if (b.id === activeRevisionId) return 1;
        return 0;
      });
    }

    return revisions;
  }, [revisionsQuery.data, block]);

  const variationPositions = useMemo(() => {
    if (exploreVariations.length === 0) return [];

    return calculateNonOverlappingPositions({
      count: exploreVariations.length,
      centerX: 0,
      centerY: 0,
      centerWidth: 500,
      centerHeight: 100,
      itemWidth: 450,
      itemHeight: 100,
      radius: 300,
      margin: 40,
    });
  }, [exploreVariations.length]);

  const handleBlockClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on interactive elements
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("input") ||
      (e.target as HTMLElement).closest("textarea") ||
      (e.target as HTMLElement).closest('[role="menu"]') ||
      isSelectMode ||
      alwaysActive
    ) {
      return;
    }
    setIsActive(!isActive);
  };

  const handleTextMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if user has selected text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const range = selection.getRangeAt(0);

      // Don't show modifier menu if selection is inside an interactive element (wildcards, modifiers, values)
      const ancestor = range.commonAncestorContainer;
      const parentElement =
        ancestor.nodeType === Node.TEXT_NODE
          ? ancestor.parentElement
          : (ancestor as Element);
      if (parentElement?.closest("[data-interactive-text]")) {
        return;
      }

      // Find the offsets in the block text
      // We need to figure out where in block.text this selection is
      const textContainer = e.currentTarget;
      const treeWalker = document.createTreeWalker(
        textContainer,
        NodeFilter.SHOW_TEXT,
      );

      let charCount = 0;
      let startOffset = 0;
      let endOffset = 0;
      let foundStart = false;
      let foundEnd = false;

      while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const nodeLength = node.textContent?.length || 0;

        if (!foundStart && node === range.startContainer) {
          startOffset = charCount + range.startOffset;
          foundStart = true;
        }

        if (!foundEnd && node === range.endContainer) {
          endOffset = charCount + range.endOffset;
          foundEnd = true;
        }

        charCount += nodeLength;
      }

      if (foundStart && foundEnd) {
        // Normalize to word boundaries
        const normalized = normalizeToWordBoundaries(
          block.text,
          startOffset,
          endOffset,
        );

        // Don't show modifier menu for wildcard content
        if (
          normalized.text &&
          !selectionOverlapsWildcard(
            block.text,
            normalized.start,
            normalized.end,
          )
        ) {
          setTextSelection({
            text: normalized.text,
            range,
            startOffset: normalized.start,
            endOffset: normalized.end,
          });
          setIsMenuVisible(true);
          return;
        }
      }
    }

    // No valid selection = simple click, enter edit mode
    setTextSelection(null);
    setIsMenuVisible(false);
    setIsInlineEditing(true);
    setInlineText(block.text);
    // Focus textarea after state update
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleTextClick = (e: React.MouseEvent) => {
    // Prevent click from bubbling when text is selected
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      e.stopPropagation();
    }
  };

  const handleSelectionApply = (
    newText: string,
    startOffset: number,
    endOffset: number,
  ) => {
    if (isInlineEditing) {
      // Update inline text
      const updatedText =
        inlineText.slice(0, startOffset) +
        newText +
        inlineText.slice(endOffset);
      setInlineText(updatedText);
      inlineTextRef.current = updatedText;
      debouncedInlineSave();

      // Update textarea selection
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            startOffset,
            startOffset + newText.length,
          );
        }
      }, 0);
    } else {
      // Update via transform
      const updatedText =
        block.text.slice(0, startOffset) +
        newText +
        block.text.slice(endOffset);

      if (onTransform) {
        onTransform(block.id, updatedText);
      }
    }

    // Update selection to reflect new text
    setTextSelection((prev) =>
      prev
        ? {
            ...prev,
            text: newText,
            endOffset: startOffset + newText.length,
          }
        : null,
    );
  };

  const handleSelectionClose = () => {
    setIsMenuVisible(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleSaveInlineEdit = (closeEditor = true) => {
    if (inlineSaveTimeoutRef.current) {
      clearTimeout(inlineSaveTimeoutRef.current);
    }
    hasPendingInlineSave.current = false;
    const textToSave = inlineTextRef.current;
    if (textToSave !== block.text && onTransform) {
      onTransform(block.id, textToSave);
    }
    if (closeEditor) {
      setIsInlineEditing(false);
    }
  };

  const debouncedInlineSave = () => {
    hasPendingInlineSave.current = true;
    if (inlineSaveTimeoutRef.current) {
      clearTimeout(inlineSaveTimeoutRef.current);
    }
    inlineSaveTimeoutRef.current = setTimeout(() => {
      handleSaveInlineEdit(false);
    }, 500);
  };

  // Close active state when clicking outside
  useEffect(() => {
    if (!isActive || alwaysActive) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't deactivate if clicking inside the block
      if (blockRef.current && blockRef.current.contains(target)) {
        return;
      }
      // Don't deactivate if clicking on a dropdown menu (portaled outside the block)
      if (target.closest("[data-radix-popper-content-wrapper]")) {
        return;
      }
      setIsActive(false);
      setShowRevisions(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActive, alwaysActive]);

  // Update inline text when block text changes (but not while actively editing)
  useEffect(() => {
    if (!isInlineEditing) {
      setInlineText(block.text);
      inlineTextRef.current = block.text;
    }
  }, [block.text, isInlineEditing]);

  // Save pending inline edits on unmount
  useEffect(() => {
    return () => {
      if (inlineSaveTimeoutRef.current) {
        clearTimeout(inlineSaveTimeoutRef.current);
      }
      if (hasPendingInlineSave.current && onTransform) {
        const textToSave = inlineTextRef.current;
        if (textToSave !== block.text) {
          onTransform(block.id, textToSave);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extract wildcard markers from text for preservation during transforms
  const getWildcardMarkers = (text: string): string[] => {
    return parseWildcards(text).map((match) => match.fullMatch);
  };

  const handleMoreDescriptive = async () => {
    setActiveTransform("more");
    try {
      const result = await transformMutation.mutateAsync({
        text: getResolvedText(block.text),
        operation: "more-descriptive",
        style,
        wildcards: getWildcardMarkers(block.text),
      });

      if (onTransform) {
        onTransform(block.id, result.result as string);
      }
    } catch (error) {
      console.error("Transform failed:", error);
    } finally {
      setActiveTransform(null);
    }
  };

  const handleLessDescriptive = async () => {
    setActiveTransform("less");
    try {
      const result = await transformMutation.mutateAsync({
        text: getResolvedText(block.text),
        operation: "less-descriptive",
        style,
        wildcards: getWildcardMarkers(block.text),
      });

      if (onTransform) {
        onTransform(block.id, result.result as string);
      }
    } catch (error) {
      console.error("Transform failed:", error);
    } finally {
      setActiveTransform(null);
    }
  };

  const handleVariation = async (
    operation: "variation-slight" | "variation-fair" | "variation-very",
  ) => {
    setActiveTransform("variation");
    try {
      const result = await transformMutation.mutateAsync({
        text: getResolvedText(block.text),
        operation,
        style,
        wildcards: getWildcardMarkers(block.text),
      });

      if (onTransform) {
        onTransform(block.id, result.result as string);
      }
    } catch (error) {
      console.error("Transform failed:", error);
    } finally {
      setActiveTransform(null);
    }
  };

  const handleExplore = async () => {
    setIsExploreOpen(true);

    try {
      const result = await exploreMutation.mutateAsync({
        text: getResolvedText(block.text),
        operation: "explore",
        style,
      });

      if (Array.isArray(result.result)) {
        setExploreVariations(result.result);
      }
    } catch (error) {
      console.error("Explore failed:", error);
    }
  };

  const handleSelectVariation = (variation: string) => {
    if (onTransform) {
      onTransform(block.id, variation);
    }
    setIsExploreOpen(false);
  };

  const handleWildcardSelect = (displayId: string, path?: string) => {
    // Insert wildcard at the end of the current text
    const result = insertWildcard(
      block.text,
      block.text.length,
      displayId,
      path,
    );

    if (onTransform) {
      onTransform(block.id, result.text);
    }
  };

  return (
    <motion.div
      ref={blockRef}
      className={cn(
        "relative rounded-lg bg-background text-foreground shadow-sm cursor-pointer",
        alwaysActive && "border-standard-dark-cyan",
        !alwaysActive && "border",
        isDisabled && "opacity-40 grayscale contrast-75",
      )}
      onClick={handleBlockClick}
      animate={{
        padding: isActive ? "8px" : "0px",
        backgroundColor:
          isActive && !alwaysActive
            ? "var(--color-cyan-dark)"
            : "var(--color-background)",
        boxShadow: isActive
          ? "0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)"
          : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      }}
      transition={TEXT_BLOCK_ANIMATION}
    >
      <CardHeader
        className="px-6 py-3"
        onDoubleClick={(e) => {
          if (
            (e.target as HTMLElement).closest("button") ||
            (e.target as HTMLElement).closest("input") ||
            (e.target as HTMLElement).closest('[role="menu"]')
          )
            return;
          onEdit();
        }}
      >
        <div
          className={cn("flex items-start justify-between", {
            "cursor-pointer": alwaysActive && onEdit,
          })}
          onClick={(e) => {
            if (
              !alwaysActive ||
              !onEdit ||
              (e.target as HTMLElement).closest("button") ||
              (e.target as HTMLElement).closest("input") ||
              (e.target as HTMLElement).closest('[role="menu"]')
            )
              return;
            onEdit();
          }}
        >
          <div className="flex-1">
            {isActive && (
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  {isRenamingBlock ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={saveBlockName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveBlockName();
                        if (e.key === "Escape") {
                          setRenameValue(block.name ?? "");
                          setIsRenamingBlock(false);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Enter block name..."
                      className="font-semibold px-2 py-0.5 border-inline-input"
                      maxLength={LENGTH_LIMITS.name}
                      autoFocus
                    />
                  ) : (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="font-semibold text-foreground cursor-pointer hover:text-magenta-light transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameValue(block.name ?? "");
                              setIsRenamingBlock(true);
                            }}
                          >
                            {block.name || block.displayId}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Click to rename</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <ExpandingIcon active={isActive} origin="left">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-cyan-medium hover:text-foreground transition-colors">
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="font-medium">ID:</span>{" "}
                              {block.displayId}
                            </div>
                            <div>
                              <span className="font-medium">Created:</span>{" "}
                              {new Date(block.createdAt).toLocaleString()}
                            </div>
                            <div>
                              <span className="font-medium">Updated:</span>{" "}
                              {new Date(block.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </ExpandingIcon>
                  <ExpandingIcon active={isActive} origin="left">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild className="cursor-pointer">
                          <button
                            onClick={() => setShowRevisions(!showRevisions)}
                            className="text-cyan-medium hover:text-foreground transition-colors"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>View block history</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </ExpandingIcon>
                  {isActive && (
                    <>
                      <span className="text-xs text-cyan-medium">
                        {block.text.length.toLocaleString()} chars &middot; ~
                        {Math.ceil(block.text.length / 4).toLocaleString()}{" "}
                        tokens
                      </span>
                      {block.folderName && (
                        <InlineIconBadge icon={Folder}>
                          {block.folderName}
                        </InlineIconBadge>
                      )}
                    </>
                  )}
                </div>
                {block.name && (
                  <div className="text-xs text-cyan-medium font-mono mt-0.5">
                    {block.displayId}
                  </div>
                )}
              </div>
            )}
            {block.labels.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {block.labels.map((label) => (
                  <button
                    key={label}
                    onClick={() => {
                      setSelectedLabel(label);
                      setIsLabelSearchOpen(true);
                    }}
                    className={cn(
                      "px-2 py-1 text-xs rounded-md bg-cyan-dark text-cyan-medium hover:bg-cyan-dark/80 transition-colors cursor-pointer",
                      {
                        "bg-cyan-medium text-cyan-light": isActive,
                      },
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={cn("flex items-center", isActive && "gap-2")}>
            {isSelectMode ? (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="cursor-pointer"
              />
            ) : (
              <>
                {block.type && (
                  <button
                    onClick={() => setIsTypeSearchOpen(true)}
                    className="px-2 py-1 text-xs font-medium rounded-md bg-magenta-dark text-foreground hover:bg-magenta-dark/90 transition-colors cursor-pointer"
                  >
                    {block.type.name}
                  </button>
                )}
                <ExpandingIcon active={isActive} origin="right">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsNotesDialogOpen(true);
                          }}
                          className={cn(
                            "text-cyan-medium hover:text-foreground transition-colors cursor-pointer",
                            block.notes && "text-foreground",
                          )}
                          aria-label="Edit notes"
                        >
                          <StickyNote className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {block.notes ? "Edit notes" : "Add notes"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </ExpandingIcon>
                {onToggleDisable && (
                  <ExpandingIcon active={isActive} origin="right">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleDisable();
                            }}
                            className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
                            aria-label={
                              isDisabled
                                ? "Enable block in this prompt"
                                : "Disable block in this prompt"
                            }
                          >
                            {isDisabled ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isDisabled
                            ? "Enable block in this prompt"
                            : "Disable block in this prompt"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </ExpandingIcon>
                )}
                <ExpandingIcon active={isActive} origin="right">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(block.text);
                          }}
                          className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
                          aria-label="Copy block text"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Copy block text</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </ExpandingIcon>
                <ExpandingIcon active={isActive} origin="right">
                  <button
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="text-cyan-medium hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    aria-label="Delete block"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </ExpandingIcon>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="group relative mb-4">
          {isInlineEditing ? (
            <TextareaAutosize
              ref={textareaRef}
              value={inlineText}
              onChange={(e) => {
                setInlineText(e.target.value);
                inlineTextRef.current = e.target.value;
                debouncedInlineSave();
              }}
              onBlur={(e) => {
                // Don't close if clicking on the selection menu
                const relatedTarget = e.relatedTarget as HTMLElement;
                if (relatedTarget?.closest("[data-selection-menu]")) {
                  return;
                }
                handleSaveInlineEdit(true);
              }}
              onMouseUp={(e) => {
                const textarea = e.currentTarget;
                const { selectionStart, selectionEnd } = textarea;

                if (selectionStart !== selectionEnd) {
                  // Normalize to word boundaries
                  const normalized = normalizeToWordBoundaries(
                    inlineText,
                    selectionStart,
                    selectionEnd,
                  );

                  // Don't show modifier menu for wildcard content
                  if (
                    normalized.text &&
                    !selectionOverlapsWildcard(
                      inlineText,
                      normalized.start,
                      normalized.end,
                    )
                  ) {
                    // Get approximate position of selected text within textarea
                    const startPos = getTextareaCaretPosition(
                      textarea,
                      normalized.start,
                    );
                    const endPos = getTextareaCaretPosition(
                      textarea,
                      normalized.end,
                    );
                    const lineHeight =
                      parseFloat(
                        window.getComputedStyle(textarea).lineHeight,
                      ) || 24;

                    const fakeRange = {
                      getBoundingClientRect: () => ({
                        top: startPos.top,
                        bottom: startPos.top + lineHeight,
                        left: startPos.left,
                        right: endPos.left,
                        width: Math.max(endPos.left - startPos.left, 50),
                        height: lineHeight,
                        x: startPos.left,
                        y: startPos.top,
                        toJSON: () => ({}),
                      }),
                    } as Range;

                    setTextSelection({
                      text: normalized.text,
                      range: fakeRange,
                      startOffset: normalized.start,
                      endOffset: normalized.end,
                    });
                    setIsMenuVisible(true);

                    // Update textarea selection to match normalized
                    textarea.setSelectionRange(
                      normalized.start,
                      normalized.end,
                    );
                  }
                } else {
                  setTextSelection(null);
                  setIsMenuVisible(false);
                }
              }}
              className="box-content w-full text-sm leading-6 whitespace-pre-wrap p-2 -m-2 resize-none border-inline-input"
              maxLength={LENGTH_LIMITS.blockText}
              minRows={1}
            />
          ) : (
            <div
              className="cursor-pointer hover:bg-cyan-dark/50 rounded p-2 -m-2 border-transparent transition-colors"
              onMouseUp={handleTextMouseUp}
              onClick={handleTextClick}
            >
              <TextWithWildcards
                text={block.text}
                className="text-sm whitespace-pre-wrap cursor-text"
                enableTooltips={true}
                enableModifierHighlighting={true}
                onMarkerChange={(oldMarker, newMarker) => {
                  const updatedText = block.text.replace(oldMarker, newMarker);
                  if (onTransform) {
                    onTransform(block.id, updatedText);
                  }
                }}
                onModifierChange={(_oldText, newText, startIndex, endIndex) => {
                  const updatedText =
                    block.text.slice(0, startIndex) +
                    newText +
                    block.text.slice(endIndex);
                  if (onTransform) {
                    onTransform(block.id, updatedText);
                  }
                }}
              />
            </div>
          )}
        </div>
        <div className="border-t pt-4">
          <div className="flex gap-2 flex-wrap">
            <LLMGuard>
              <ButtonGroup>
                <LoadingAnimatedButton
                  variant="secondary"
                  size="sm"
                  active={isActive}
                  onClick={handleMoreDescriptive}
                  loading={activeTransform === "more"}
                  disabled={
                    !isLLMConfigured ||
                    activeTransform !== null ||
                    exploreMutation.isPending
                  }
                >
                  More Descriptive
                </LoadingAnimatedButton>
                <ButtonGroupSeparator />
                <LoadingAnimatedButton
                  variant="secondary"
                  size="sm"
                  active={isActive}
                  onClick={handleLessDescriptive}
                  loading={activeTransform === "less"}
                  disabled={
                    !isLLMConfigured ||
                    activeTransform !== null ||
                    exploreMutation.isPending
                  }
                >
                  Less Descriptive
                </LoadingAnimatedButton>
              </ButtonGroup>
              <ButtonGroup>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <LoadingAnimatedButton
                      variant="secondary"
                      size="sm"
                      active={isActive}
                      loading={activeTransform === "variation"}
                      disabled={
                        !isLLMConfigured ||
                        activeTransform !== null ||
                        exploreMutation.isPending
                      }
                    >
                      Variation
                    </LoadingAnimatedButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => handleVariation("variation-slight")}
                    >
                      Slightly Different
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleVariation("variation-fair")}
                    >
                      Fairly Different
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleVariation("variation-very")}
                    >
                      Very Different
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ButtonGroupSeparator />
                <LoadingAnimatedButton
                  variant="secondary"
                  size="sm"
                  active={isActive}
                  onClick={handleExplore}
                  loading={exploreMutation.isPending}
                  disabled={
                    !isLLMConfigured ||
                    activeTransform !== null ||
                    exploreMutation.isPending
                  }
                >
                  Explore Variations
                </LoadingAnimatedButton>
              </ButtonGroup>
            </LLMGuard>
            <AnimatedButton
              variant="secondary"
              size="sm"
              active={isActive}
              onClick={() => setIsWildcardBrowserOpen(true)}
            >
              Insert Wildcard
            </AnimatedButton>
            <ButtonGroup className="ml-auto">
              {onDuplicate && (
                <>
                  <AnimatedButton
                    variant="secondary"
                    size="sm"
                    active={isActive}
                    onClick={onDuplicate}
                  >
                    Duplicate Block
                  </AnimatedButton>
                  <ButtonGroupSeparator />
                </>
              )}
              <AnimatedButton
                variant="secondary"
                size="sm"
                active={isActive}
                onClick={onEdit}
              >
                Edit Block
              </AnimatedButton>
            </ButtonGroup>
          </div>
        </div>
      </CardContent>

      {/* Revisions overlay */}
      <AnimatePresence>
        {showRevisions && (
          <motion.div
            className="absolute inset-0 bg-background z-20 rounded-lg overflow-hidden border"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="absolute left-4 top-2 z-30 text-xs text-cyan-medium">
              Hover over revisions to see differences.
            </p>
            <button
              onClick={() => setShowRevisions(false)}
              className="absolute right-2 top-2 z-30 text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close revisions"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex gap-4 overflow-x-auto h-full p-4 pt-8 mr-8">
              {revisionsQuery.isLoading ? (
                <div className="flex items-center justify-center w-full">
                  <p className="text-sm text-cyan-medium">
                    Loading revisions...
                  </p>
                </div>
              ) : sortedRevisions.length > 0 ? (
                sortedRevisions.map((revision) => {
                  const isActiveRevision =
                    revision.id === block.activeRevisionId;
                  const isHovered = hoveredRevisionId === revision.id;
                  const showDiff = isHovered && !isActiveRevision;
                  return (
                    <div
                      key={revision.id}
                      className="shrink-0 w-100 h-full border rounded-md p-4 bg-cyan-dark flex flex-col cursor-pointer hover:bg-cyan-dark/80 transition-colors relative"
                      onClick={async () => {
                        try {
                          await setActiveRevisionMutation.mutateAsync({
                            blockId: block.id,
                            revisionId: revision.id,
                          });
                          setShowRevisions(false);
                        } catch (error) {
                          console.error(
                            "Failed to set active revision:",
                            error,
                          );
                        }
                      }}
                      onMouseEnter={() => setHoveredRevisionId(revision.id)}
                      onMouseLeave={() => setHoveredRevisionId(null)}
                    >
                      {isActiveRevision && (
                        <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-md bg-magenta-dark text-foreground">
                          Active
                        </div>
                      )}
                      <p className="text-xs text-cyan-medium mb-2">
                        {new Date(revision.createdAt).toLocaleString()}
                      </p>
                      <div className="flex-1 overflow-auto">
                        {showDiff ? (
                          <DiffText
                            oldText={block.text}
                            newText={revision.text}
                            className="text-sm"
                          />
                        ) : (
                          <TextWithWildcards
                            text={revision.text}
                            className="text-sm whitespace-pre-wrap"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center w-full">
                  <p className="text-sm text-cyan-medium">No revisions found</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isExploreOpen} onOpenChange={setIsExploreOpen}>
        <DialogContent className="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] h-full w-full flex flex-col">
          <DialogHeader>
            <DialogTitle>Explore Variations</DialogTitle>
            <DialogDescription>
              {exploreMutation.isPending
                ? "Generating variations..."
                : `${exploreVariations.length} variations generated`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center p-8">
            {exploreMutation.isPending ? (
              <LoadingSpinner />
            ) : (
              <div className="relative w-full h-full">
                {/* Spokes from center to variations */}
                {exploreVariations.map((_, index) => {
                  const position = variationPositions[index];
                  if (!position) return null;

                  // Calculate angle and length for the line
                  const angle =
                    (Math.atan2(position.y, position.x) * 180) / Math.PI;
                  const length = Math.sqrt(
                    position.x * position.x + position.y * position.y,
                  );

                  return (
                    <motion.div
                      key={`spoke-${index}`}
                      className="absolute origin-left pointer-events-none border-t-2 border-dashed border-cyan-medium"
                      style={{
                        top: "50%",
                        left: "50%",
                        zIndex: 5,
                      }}
                      initial={{ width: 0, opacity: 0, rotate: angle }}
                      animate={{ width: length, opacity: 0.5, rotate: angle }}
                      transition={{
                        delay: index * 0.1,
                        duration: 0.4,
                        ease: "easeOut",
                      }}
                    />
                  );
                })}

                {/* Original text in center */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-25 flex items-center justify-center"
                  style={{ zIndex: 10 }}
                >
                  <div className="p-4 border-2 border-magenta-medium rounded-md bg-background w-full h-full flex items-center justify-center relative">
                    <button
                      onClick={handleExplore}
                      disabled={exploreMutation.isPending}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-magenta-dark text-foreground hover:bg-magenta-dark/90 transition-colors disabled:opacity-50"
                      title="Regenerate variations"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <p className="text-sm font-semibold text-center line-clamp-3">
                      {block.text}
                    </p>
                  </div>
                </div>

                {/* Variations shooting out in a star pattern */}
                {exploreVariations.map((variation, index) => {
                  const position = variationPositions[index];
                  if (!position) return null;

                  return (
                    <motion.div
                      key={index}
                      className="absolute top-1/2 left-1/2 w-112.5 h-25 cursor-pointer"
                      style={{ zIndex: 10 }}
                      initial={{ x: -225, y: -50, scale: 0, opacity: 0 }}
                      animate={{
                        x: position.x - 225,
                        y: position.y - 50,
                        scale: 1,
                        opacity: 1,
                      }}
                      transition={{
                        delay: index * 0.1,
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                      }}
                      onClick={() => handleSelectVariation(variation)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="p-4 border rounded-md bg-cyan-dark w-full h-full flex items-center justify-center hover:bg-cyan-dark/80 transition-colors">
                        <p className="text-sm text-center line-clamp-3">
                          {variation}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BlockSearchDialog
        open={isTypeSearchOpen}
        onOpenChange={setIsTypeSearchOpen}
        onSelect={onSelectBlock || (() => {})}
        typeId={block.type?.id}
      />

      <BlockSearchDialog
        open={isLabelSearchOpen}
        onOpenChange={setIsLabelSearchOpen}
        onSelect={onSelectBlock || (() => {})}
        labels={selectedLabel ? [selectedLabel] : undefined}
      />

      <WildcardBrowser
        open={isWildcardBrowserOpen}
        onOpenChange={setIsWildcardBrowserOpen}
        onSelect={handleWildcardSelect}
      />

      <NotesDialog
        title="Block Notes"
        placeholder="Add notes about this block..."
        initialNotes={block.notes}
        open={isNotesDialogOpen}
        onOpenChange={setIsNotesDialogOpen}
        onSave={(notes) => {
          updateNotesMutation.mutate({
            id: block.id,
            notes,
          });
        }}
      />

      <TextSelectionMenu
        selection={textSelection}
        onApply={handleSelectionApply}
        onClose={handleSelectionClose}
        onMouseLeave={handleSelectionClose}
        isVisible={isMenuVisible}
      />
    </motion.div>
  );
}
