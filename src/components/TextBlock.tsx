import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Info, Clock, Save, RefreshCw } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { api, RouterOutput } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AnimatedButton } from "@/components/ui/animated-button";
import { ExpandingIcon } from "@/components/ui/expanding-icon";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { TEXT_BLOCK_ANIMATION } from "@/lib/text-block-animation-settings";
import { calculateNonOverlappingPositions } from "@/lib/layout-utils";
import { resolveWildcardsInText } from "@/lib/wildcard-resolver";
import { insertWildcard } from "@/lib/wildcard-parser";
import { WildcardBrowser } from "@/components/WildcardBrowser";
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
import { TextWithWildcards } from "@/components/TextWithWildcards";

import { useSettings } from "@/contexts/SettingsContext";
import type { OutputStyle } from "@/types/schema";

type Block = RouterOutput["blocks"]["list"][number];

interface TextBlockProps {
  block: Block;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onTransform?: (blockId: number, transformedText: string) => void;
  onSelectBlock?: (blockId: number) => void;
  isDeleting?: boolean;
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
  isDeleting,
  isSelectMode,
  isSelected,
  onToggleSelect,
  defaultActive = false,
  alwaysActive = false,
  style,
}: TextBlockProps) {
  const [isActive, setIsActive] = useState(defaultActive || alwaysActive);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineText, setInlineText] = useState(block.text);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [exploreVariations, setExploreVariations] = useState<string[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [isTypeSearchOpen, setIsTypeSearchOpen] = useState(false);
  const [isLabelSearchOpen, setIsLabelSearchOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [isWildcardBrowserOpen, setIsWildcardBrowserOpen] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = api.useUtils();
  const transformMutation = api.llm.transform.useMutation();
  const exploreMutation = api.llm.transform.useMutation();
  const { data: wildcards } = api.wildcards.list.useQuery();
  const setActiveRevisionMutation = api.blocks.setActiveRevision.useMutation({
    onSuccess: () => {
      // Refetch blocks list and stacks to show updated text
      utils.blocks.list.invalidate();
      utils.stacks.invalidate();
    },
  });
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

  const handleTextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInlineEditing(true);
    setInlineText(block.text);
    // Focus textarea after state update
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSaveInlineEdit = () => {
    if (inlineText !== block.text && onTransform) {
      onTransform(block.id, inlineText);
    }
    setIsInlineEditing(false);
  };

  // Close active state when clicking outside
  useEffect(() => {
    if (!isActive || alwaysActive) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (blockRef.current && !blockRef.current.contains(e.target as Node)) {
        setIsActive(false);
        setShowRevisions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActive, alwaysActive]);

  // Update inline text when block text changes
  useEffect(() => {
    setInlineText(block.text);
  }, [block.text]);

  const { data: serverConfig } = api.config.getSettings.useQuery();
  const { preferredLLMTarget } = useSettings();

  const llmTarget = useMemo(() => {
    const targets = serverConfig?.llm?.allowedTargets;
    if (!targets || targets.length === 0) return "lm-studio";

    // Use preference if valid, otherwise fallback to first available
    if (preferredLLMTarget && targets.includes(preferredLLMTarget)) {
      return preferredLLMTarget as
        | "lm-studio"
        | "vertex"
        | "openai"
        | "anthropic";
    }

    // Default fallback: Prefer vertex if available, otherwise first allowed
    return (targets.includes("vertex") ? "vertex" : targets[0]) as
      | "lm-studio"
      | "vertex"
      | "openai"
      | "anthropic";
  }, [serverConfig, preferredLLMTarget]);

  const handleMoreDescriptive = async () => {
    try {
      const result = await transformMutation.mutateAsync({
        text: getResolvedText(block.text),
        operation: "more-descriptive",
        target: llmTarget,
        style,
      });

      if (onTransform) {
        onTransform(block.id, result.result as string);
      }
    } catch (error) {
      console.error("Transform failed:", error);
    }
  };

  const handleLessDescriptive = async () => {
    try {
      const result = await transformMutation.mutateAsync({
        text: getResolvedText(block.text),
        operation: "less-descriptive",
        target: llmTarget,
        style,
      });

      if (onTransform) {
        onTransform(block.id, result.result as string);
      }
    } catch (error) {
      console.error("Transform failed:", error);
    }
  };

  const handleVariation = async (
    operation: "variation-slight" | "variation-fair" | "variation-very",
  ) => {
    try {
      const result = await transformMutation.mutateAsync({
        text: getResolvedText(block.text),
        operation,
        target: llmTarget,
        style,
      });

      if (onTransform) {
        onTransform(block.id, result.result as string);
      }
    } catch (error) {
      console.error("Transform failed:", error);
    }
  };

  const handleExplore = async () => {
    setIsExploreOpen(true);

    try {
      const result = await exploreMutation.mutateAsync({
        text: getResolvedText(block.text),
        operation: "explore",
        target: llmTarget,
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
        !alwaysActive && "border",
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
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isActive && (
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  {block.name ? (
                    <>
                      <span className="font-semibold text-foreground">
                        {block.name}
                      </span>
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
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">
                        {block.displayId}
                      </span>
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
          <div className="flex items-center gap-2">
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
                  <button
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="text-cyan-medium hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    aria-label="Delete block"
                  >
                    <X className="h-4 w-4" />
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
            <div className="relative">
              <TextareaAutosize
                ref={textareaRef}
                value={inlineText}
                onChange={(e) => setInlineText(e.target.value)}
                onBlur={handleSaveInlineEdit}
                className="w-full text-sm whitespace-pre-wrap bg-cyan-dark/50 border border-cyan-medium rounded p-2 focus:outline-none focus:ring-2 focus:ring-magenta-medium resize-none"
                minRows={1}
              />
              <button
                onClick={handleSaveInlineEdit}
                className="absolute top-2 right-2 p-1 rounded bg-magenta-dark text-foreground hover:bg-magenta-dark/90 transition-colors"
                aria-label="Save"
              >
                <Save className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div
              className="cursor-pointer hover:bg-cyan-dark/50 rounded p-2 -m-2 transition-colors"
              onClick={handleTextClick}
            >
              <TextWithWildcards
                text={block.text}
                className="text-sm whitespace-pre-wrap cursor-text"
                enableTooltips={true}
                onWildcardPathChange={(displayId, oldPath, newPath) => {
                  // Replace the wildcard marker in the text
                  const oldMarker = `{{wildcard:${displayId}:${oldPath}}}`;
                  const newMarker = `{{wildcard:${displayId}:${newPath}}}`;
                  const updatedText = block.text.replace(oldMarker, newMarker);

                  // Trigger transform to create a new revision
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
            <ButtonGroup>
              <AnimatedButton
                variant="secondary"
                size="sm"
                active={isActive}
                onClick={handleMoreDescriptive}
                disabled={transformMutation.isPending}
              >
                {transformMutation.isPending
                  ? "Transforming..."
                  : "More Descriptive"}
              </AnimatedButton>
              <ButtonGroupSeparator />
              <AnimatedButton
                variant="secondary"
                size="sm"
                active={isActive}
                onClick={handleLessDescriptive}
                disabled={transformMutation.isPending}
              >
                {transformMutation.isPending
                  ? "Transforming..."
                  : "Less Descriptive"}
              </AnimatedButton>
            </ButtonGroup>
            <ButtonGroup>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <AnimatedButton
                    variant="secondary"
                    size="sm"
                    active={isActive}
                    disabled={transformMutation.isPending}
                  >
                    {transformMutation.isPending
                      ? "Transforming..."
                      : "Variation"}
                  </AnimatedButton>
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
              <AnimatedButton
                variant="secondary"
                size="sm"
                active={isActive}
                onClick={handleExplore}
                disabled={exploreMutation.isPending}
              >
                {exploreMutation.isPending
                  ? "Exploring..."
                  : "Explore Variations"}
              </AnimatedButton>
            </ButtonGroup>
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
            <button
              onClick={() => setShowRevisions(false)}
              className="absolute right-2 top-2 z-30 text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close revisions"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex gap-4 overflow-x-auto h-full p-4 ml mr-8">
              {revisionsQuery.isLoading ? (
                <div className="flex items-center justify-center w-full">
                  <p className="text-sm text-cyan-medium">
                    Loading revisions...
                  </p>
                </div>
              ) : sortedRevisions.length > 0 ? (
                sortedRevisions.map((revision) => {
                  const isActive = revision.id === block.activeRevisionId;
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
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-md bg-magenta-dark text-foreground">
                          Active
                        </div>
                      )}
                      <p className="text-xs text-cyan-medium mb-2">
                        {new Date(revision.createdAt).toLocaleString()}
                      </p>
                      <div className="flex-1 overflow-auto">
                        <TextWithWildcards
                          text={revision.text}
                          className="text-sm whitespace-pre-wrap"
                        />
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
    </motion.div>
  );
}
