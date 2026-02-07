import { useRef, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TextSelectionMenu } from "@/components/TextSelectionMenu";
import type { ModifierMatch } from "@/lib/modifier-parser";

interface ModifierStringProps {
  match: ModifierMatch;
  onModify: (
    oldText: string,
    newText: string,
    startIndex: number,
    endIndex: number,
  ) => void;
  /** Offset of this match within the full block text */
  textOffset: number;
  /** Unique identifier for this modifier */
  modifierId: string;
  /** Currently active modifier ID (only one menu open at a time) */
  activeModifierId: string | null;
  /** Callback to set the active modifier */
  onSetActive: (id: string | null) => void;
}

export function ModifierString({
  match,
  onModify,
  textOffset,
  modifierId,
  activeModifierId,
  onSetActive,
}: ModifierStringProps) {
  const isActive = activeModifierId === modifierId;
  const spanRef = useRef<HTMLSpanElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    // Defer to next tick to give the bridge/menu a chance to catch the mouse
    closeTimeoutRef.current = setTimeout(() => {
      onSetActive(null);
    }, 0);
  }, [cancelClose, onSetActive]);

  const handleMouseEnter = useCallback(() => {
    cancelClose();
    onSetActive(modifierId);
  }, [modifierId, onSetActive, cancelClose]);

  const handleMouseLeave = useCallback(() => {
    // Schedule close - will be cancelled if mouse enters the menu
    scheduleClose();
  }, [scheduleClose]);

  // Compute the absolute indices for this modifier in the block text
  const startIndex = textOffset + match.index;
  const endIndex = startIndex + match.fullMatch.length;

  const handleApply = useCallback(
    (newText: string) => {
      // Use the pre-computed indices
      onModify(match.fullMatch, newText, startIndex, endIndex);
    },
    [match.fullMatch, startIndex, endIndex, onModify],
  );

  const handleClose = useCallback(() => {
    onSetActive(null);
  }, [onSetActive]);

  // Create selection object for the menu
  // isActive is in deps to trigger recomputation when hovering (spanRef needs to be mounted)
  // But we don't gate on isActive so selection stays valid during exit animation
  const selection = useMemo(() => {
    if (!spanRef.current) return null;

    const rect = spanRef.current.getBoundingClientRect();
    const fakeRange = {
      getBoundingClientRect: () => rect,
    } as Range;

    return {
      text: match.fullMatch,
      range: fakeRange,
      startOffset: 0,
      endOffset: match.fullMatch.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.fullMatch, isActive]);

  // Determine styling based on modifier type
  const hasEmphasis = match.type === "emphasis";
  const hasDeemphasis = match.type === "deemphasis";
  const hasPositiveWeight = match.weight && match.weight > 1;
  const hasNegativeWeight = match.weight && match.weight < 1;

  return (
    <>
      <span
        ref={spanRef}
        data-interactive-text
        className={cn(
          "px-1 py-1 -mx-0.5 transition-colors cursor-pointer bg-cyan-medium/40",
          hasPositiveWeight && "font-bold",
          hasNegativeWeight && "font-light",
          hasEmphasis && "bg-cyan-medium/60",
          hasDeemphasis && "opacity-70",
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {match.fullMatch}
      </span>

      {selection && (
        <TextSelectionMenu
          selection={selection}
          onApply={handleApply}
          onClose={handleClose}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          isVisible={isActive}
        />
      )}
    </>
  );
}
