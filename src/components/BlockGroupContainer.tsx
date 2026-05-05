import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Dices,
  Eye,
  EyeOff,
  Group,
  GripVertical,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { LENGTH_LIMITS } from "@shared/limits";
import type { TextBlockGroup } from "@/types/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Eight preset color keys mapping to hex values that mirror the
 * `--color-groups-N` CSS variables in `src/index.css`. We hold the hex
 * values directly here so styling is independent of whether Tailwind
 * decided to keep the matching theme tokens in the final stylesheet.
 */
export const GROUP_COLOR_PRESETS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
] as const;

const GROUP_COLOR_HEX: Record<string, string> = {
  "1": "#c94657",
  "2": "#c84d29",
  "3": "#748400",
  "4": "#009161",
  "5": "#0087ab",
  "6": "#147bd8",
  "7": "#7b64d4",
  "8": "#bf4884",
};

/** Return the hex for a stored color key, or null when the group uses defaults. */
export function groupColorHex(color: string | null): string | null {
  if (color === null) return null;
  return GROUP_COLOR_HEX[color] ?? null;
}

const DEFAULT_BORDER = "var(--color-cyan-medium)";
// Tweak this 0–1 to adjust the group border/menu chrome opacity.
const BORDER_OPACITY = 0.7;
const withOpacity = (color: string, opacity: number): string =>
  `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;
// Solid app background — used inline so the menu can never bleed through to
// blocks underneath, regardless of which Tailwind classes survive purge.
const SOLID_BG = "#0f0535";

interface BlockGroupContainerProps {
  group: TextBlockGroup;
  blockCount: number;
  onUpdate: (patch: Partial<TextBlockGroup>) => void;
  onDelete: () => void;
  children: React.ReactNode;
  /** Sortable id for the group itself. Required so groups can be dragged. */
  sortableId: string;
  /** True when an external block is being dragged onto this group; brightens
   *  the panel so the user can see they're about to drop into it. */
  isDropTarget?: boolean;
  /** Aggregate disabled state of the group's blocks: "all" disabled,
   *  "none" disabled, or a "mixed" set. Drives the toggle button's icon
   *  and the click semantics (mixed → disable-all). */
  disabledState?: "all" | "none" | "mixed";
  /** Toggle disabled state for every block in the group. */
  onToggleDisable?: () => void;
  /** Pick one random block in the group to leave enabled and disable the
   *  rest. Hidden when the group has fewer than 2 blocks. */
  onRandomize?: () => void;
}

export function BlockGroupContainer({
  group,
  blockCount,
  onUpdate,
  onDelete,
  children,
  sortableId,
  isDropTarget,
  disabledState,
  onToggleDisable,
  onRandomize,
}: BlockGroupContainerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });
  const sortableStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsMounted, setActionsMounted] = useState(false);
  const [actionsClip, setActionsClip] = useState(true);
  const [colorOpen, setColorOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const closeTimer = useRef<number | null>(null);
  const colorCloseTimer = useRef<number | null>(null);
  const exitDelayTimer = useRef<number | null>(null);

  // Drive overflow clipping + lag the actions unmount behind menuOpen so the
  // exit animation has overflow-hidden applied before width starts shrinking.
  useEffect(() => {
    if (menuOpen) {
      if (exitDelayTimer.current !== null) {
        window.clearTimeout(exitDelayTimer.current);
        exitDelayTimer.current = null;
      }
      setActionsClip(true);
      setActionsMounted(true);
    } else {
      setActionsClip(true);
      setColorOpen(false);
      exitDelayTimer.current = window.setTimeout(() => {
        setActionsMounted(false);
        exitDelayTimer.current = null;
      }, 40);
    }
  }, [menuOpen]);

  // After releasing a drag, close the menu — the cursor likely isn't over
  // the chip anymore and no mouseleave fired while isDragging suppressed it.
  const prevDraggingRef = useRef(isDragging);
  useEffect(() => {
    if (prevDraggingRef.current && !isDragging) {
      scheduleClose();
    }
    prevDraggingRef.current = isDragging;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  // Keep name draft in sync with prop changes from outside (server refetch),
  // but don't clobber an in-progress edit.
  useEffect(() => {
    if (!menuOpen) setNameDraft(group.name);
  }, [group.name, menuOpen]);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setMenuOpen(false);
      setColorOpen(false);
    }, 120);
  };

  const cancelColorClose = () => {
    if (colorCloseTimer.current !== null) {
      window.clearTimeout(colorCloseTimer.current);
      colorCloseTimer.current = null;
    }
  };
  const scheduleColorClose = () => {
    cancelColorClose();
    colorCloseTimer.current = window.setTimeout(() => {
      setColorOpen(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      cancelClose();
      cancelColorClose();
      if (exitDelayTimer.current !== null) {
        window.clearTimeout(exitDelayTimer.current);
      }
    };
  }, []);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== group.name) {
      onUpdate({ name: trimmed });
    } else if (!trimmed && group.name) {
      setNameDraft(group.name);
    }
  };

  const colorHex = groupColorHex(group.color);
  const borderColorWithOpacity = withOpacity(
    colorHex ?? DEFAULT_BORDER,
    BORDER_OPACITY,
  );
  const borderColor = colorHex ?? DEFAULT_BORDER;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={cn("relative", "rounded-lg")}
      style={{
        ...sortableStyle,
        marginTop: 2,
        marginBottom: 2,
        borderStyle: "solid",
        borderColor: borderColorWithOpacity,
        borderWidth: 2,
        backgroundColor: isDropTarget
          ? withOpacity(colorHex ?? DEFAULT_BORDER, 0.18)
          : undefined,
        transition: "background-color 0.15s ease-out",
      }}
    >
      {/* Group icon + hover-expanded menu, mirroring StackOutputBlock's
          -right-2 -top-3 placement onto the upper-left. */}
      <motion.div
        className="absolute -left-3 -top-3 z-20 flex items-center gap-1 px-1.5 py-1.5 pl-2 rounded-md border shadow-md"
        style={{
          borderColor,
          backgroundColor: SOLID_BG,
        }}
        onMouseEnter={() => {
          cancelClose();
          setMenuOpen(true);
        }}
        onMouseLeave={() => {
          if (!isDragging) scheduleClose();
        }}
      >
        <AnimatePresence initial={false}>
          {menuOpen && (
            <motion.button
              key="group-drag-handle"
              type="button"
              {...listeners}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={cn(
                "flex items-center overflow-hidden cursor-grab active:cursor-grabbing hover:text-foreground",
                !colorHex && "text-cyan-medium",
              )}
              style={colorHex ? { color: colorHex } : undefined}
              aria-label="Drag group"
            >
              <GripVertical className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <motion.div className="flex items-center">
          <Group
            className="h-3.5 w-3.5"
            style={{ color: colorHex ?? undefined }}
          />
        </motion.div>
        {isRenaming ? (
          <motion.input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              commitName();
              setIsRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitName();
                setIsRenaming(false);
              } else if (e.key === "Escape") {
                setNameDraft(group.name);
                setIsRenaming(false);
              }
            }}
            maxLength={LENGTH_LIMITS.blockGroupName}
            placeholder="Group name"
            autoFocus
            className="px-2 py-0.5 text-xs bg-cyan-dark/30 border border-cyan-medium/40 rounded-sm outline-none focus:border-cyan-light w-32"
          />
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  onClick={() => {
                    if (!menuOpen) return;
                    setNameDraft(group.name);
                    setIsRenaming(true);
                  }}
                  className={cn(
                    "px-1 py-0.5 text-xs text-left truncate transition-colors",
                    menuOpen
                      ? "w-32 hover:text-foreground cursor-pointer"
                      : "w-auto cursor-default",
                  )}
                  style={{ color: colorHex ?? undefined }}
                  tabIndex={menuOpen ? 0 : -1}
                >
                  {group.name || (
                    <span className="text-cyan-medium italic">Unnamed</span>
                  )}
                </motion.button>
              </TooltipTrigger>
              {menuOpen && <TooltipContent>Click to rename</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        )}

        <AnimatePresence initial={false}>
          {actionsMounted && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              onAnimationComplete={() => {
                if (menuOpen) setActionsClip(false);
              }}
              className="flex items-center gap-1"
              style={{ overflow: actionsClip ? "hidden" : "visible" }}
            >
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onUpdate({ collapsed: !group.collapsed })}
                      className="px-1.5 rounded hover:bg-cyan-dark/40 transition-colors cursor-pointer text-cyan-medium hover:text-foreground"
                      aria-label={
                        group.collapsed ? "Expand blocks" : "Collapse blocks"
                      }
                    >
                      {group.collapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {group.collapsed ? "Expand blocks" : "Collapse blocks"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {onToggleDisable && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onToggleDisable}
                        className="px-1.5 rounded hover:bg-cyan-dark/40 transition-colors cursor-pointer text-cyan-medium hover:text-foreground"
                        aria-label={
                          disabledState === "all"
                            ? "Enable all blocks in group"
                            : "Disable all blocks in group"
                        }
                      >
                        {disabledState === "all" ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {disabledState === "all"
                        ? "Enable all blocks in group"
                        : "Disable all blocks in group"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {onRandomize && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onRandomize}
                        className="px-1.5 rounded hover:bg-cyan-dark/40 transition-colors cursor-pointer text-cyan-medium hover:text-foreground"
                        aria-label="Randomly enable one block in group"
                      >
                        <Dices className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Randomly enable one block in group
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Current-color swatch with hover-revealed vertical palette. */}
              <div
                className="relative flex items-center"
                onMouseEnter={() => {
                  cancelColorClose();
                  setColorOpen(true);
                }}
                onMouseLeave={scheduleColorClose}
              >
                <button
                  type="button"
                  className="h-5 w-5 rounded-full border-2 cursor-pointer"
                  style={{
                    borderColor,
                    backgroundColor: colorHex ?? "transparent",
                  }}
                  aria-label="Pick group color"
                  title="Color"
                />
                <AnimatePresence>
                  {colorOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 flex flex-col gap-1 p-1.5 rounded-md border-2 shadow-lg z-30"
                      style={{
                        borderColor: DEFAULT_BORDER,
                        backgroundColor: SOLID_BG,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onUpdate({ color: null })}
                        className={cn(
                          "h-4 w-4 rounded-full border-2 cursor-pointer transition-transform hover:scale-110",
                          group.color === null && "ring-1 ring-foreground",
                        )}
                        style={{ borderColor: DEFAULT_BORDER }}
                        aria-label="Default color"
                        title="Default"
                      />
                      {GROUP_COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => onUpdate({ color: c })}
                          className={cn(
                            "h-4 w-4 rounded-full cursor-pointer transition-transform hover:scale-110",
                            group.color === c && "ring-1 ring-foreground",
                          )}
                          style={{ backgroundColor: GROUP_COLOR_HEX[c] }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="h-3.5 w-3.5 ml-2 rounded hover:bg-magenta-dark/40 transition-colors cursor-pointer text-cyan-medium hover:text-magenta-light"
                      aria-label="Dissolve group"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Dissolve group</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence initial={false} mode="wait">
        {group.collapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-4 text-xs font-mono text-center"
            style={{ color: colorHex ?? undefined }}
          >
            {blockCount} block{blockCount === 1 ? "" : "s"} hidden
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="px-4 py-4 flex flex-col gap-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
