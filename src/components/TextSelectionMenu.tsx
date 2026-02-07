import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

interface TextSelectionMenuProps {
  selection: {
    text: string;
    range: Range;
    startOffset: number;
    endOffset: number;
  } | null;
  onApply: (newText: string, startOffset: number, endOffset: number) => void;
  onClose: () => void;
  /** Called when mouse enters the menu (for hover mode) */
  onMouseEnter?: () => void;
  /** Called when mouse leaves the menu (for hover mode) */
  onMouseLeave?: () => void;
  /** Controls visibility for exit animation (defaults to true when selection exists) */
  isVisible?: boolean;
}

/**
 * Parse existing modifiers from text
 * Returns: { innerText, parenCount, bracketCount, weight }
 */
function parseModifiers(text: string): {
  innerText: string;
  parenCount: number;
  bracketCount: number;
  weight: number | null;
} {
  let current = text;
  let parenCount = 0;
  let bracketCount = 0;
  let weight: number | null = null;

  // Count and strip outer parentheses
  while (current.startsWith("(") && current.endsWith(")")) {
    // Check for weight syntax: (text:1.2)
    const weightMatch = current.match(/^\((.+):(-?\d+\.?\d*)\)$/);
    if (weightMatch) {
      weight = parseFloat(weightMatch[2]);
      current = weightMatch[1];
      parenCount++;
      break;
    }
    current = current.slice(1, -1);
    parenCount++;
  }

  // Count and strip outer brackets
  while (current.startsWith("[") && current.endsWith("]")) {
    current = current.slice(1, -1);
    bracketCount++;
  }

  return { innerText: current, parenCount, bracketCount, weight };
}

/**
 * Build text with modifiers
 */
function buildWithModifiers(
  innerText: string,
  parenCount: number,
  bracketCount: number,
  weight: number | null,
): string {
  let result = innerText;

  // Apply brackets first (innermost)
  for (let i = 0; i < bracketCount; i++) {
    result = `[${result}]`;
  }

  // Apply parentheses, with weight on the innermost paren if present
  if (weight !== null && weight !== 0) {
    if (parenCount > 0) {
      // First paren gets the weight
      result = `(${result}:${weight})`;
      // Remaining parens wrap around
      for (let i = 1; i < parenCount; i++) {
        result = `(${result})`;
      }
    } else {
      // No parens requested, but we have weight - need to add parens for weight
      result = `(${result}:${weight})`;
    }
  } else {
    // No weight, just add parens normally
    for (let i = 0; i < parenCount; i++) {
      result = `(${result})`;
    }
  }

  return result;
}

/**
 * Check if char is whitespace
 */
function isWhitespace(char: string | undefined): boolean {
  if (!char) return false;
  return /\s/.test(char);
}

/**
 * Check if char is punctuation or special syntax chars (not modifier brackets)
 * Includes {} and <> for wildcard and lora syntax
 */
function isPunctuation(char: string | undefined): boolean {
  if (!char) return false;
  return /[.,!?;:{}<>]/.test(char);
}

/**
 * Check if char is a modifier bracket
 */
function isModifierChar(char: string | undefined): boolean {
  if (!char) return false;
  return /[()[\]]/.test(char);
}

/**
 * Expand selection to include matching modifier brackets and weight syntax
 */
function expandToIncludeModifiers(
  fullText: string,
  start: number,
  end: number,
): { start: number; end: number } {
  // Keep expanding outward while we find matching pairs or weight syntax
  let changed = true;
  while (changed) {
    changed = false;

    // Check for weight syntax before closing paren: `:1.2)`
    // If we're at the end and there's a weight pattern after us, include it
    if (end < fullText.length && fullText[end] === ":") {
      const remaining = fullText.slice(end);
      const weightMatch = remaining.match(/^:-?\d+\.?\d*\)/);
      if (weightMatch) {
        end += weightMatch[0].length;
        // Weight syntax includes the closing ), so look for matching (
        if (start > 0 && fullText[start - 1] === "(") {
          start--;
        }
        changed = true;
        continue;
      }
    }

    // Check for matching parens
    if (
      start > 0 &&
      end < fullText.length &&
      fullText[start - 1] === "(" &&
      fullText[end] === ")"
    ) {
      start--;
      end++;
      changed = true;
    }

    // Check for matching brackets
    if (
      start > 0 &&
      end < fullText.length &&
      fullText[start - 1] === "[" &&
      fullText[end] === "]"
    ) {
      start--;
      end++;
      changed = true;
    }
  }

  return { start, end };
}

/**
 * Normalize selection to word boundaries
 * - Trims whitespace
 * - Expands partial words to full words
 * - Treats punctuation (.,!?;:) as word boundaries
 * - Expands to include matching modifier brackets (), [] and weight syntax
 */
export function normalizeToWordBoundaries(
  fullText: string,
  selectionStart: number,
  selectionEnd: number,
): { start: number; end: number; text: string } {
  let start = selectionStart;
  let end = selectionEnd;

  // First, trim whitespace only
  while (start < end && isWhitespace(fullText[start])) {
    start++;
  }
  while (end > start && isWhitespace(fullText[end - 1])) {
    end--;
  }

  if (start >= end) {
    return { start: selectionStart, end: selectionEnd, text: "" };
  }

  // Skip any modifier chars at the start/end to find the inner content
  let innerStart = start;
  let innerEnd = end;
  while (innerStart < innerEnd && isModifierChar(fullText[innerStart])) {
    innerStart++;
  }
  while (innerEnd > innerStart && isModifierChar(fullText[innerEnd - 1])) {
    innerEnd--;
  }

  if (innerStart >= innerEnd) {
    return { start: selectionStart, end: selectionEnd, text: "" };
  }

  // Always expand to full words, stopping at whitespace, punctuation, or modifier chars
  while (
    innerStart > 0 &&
    !isWhitespace(fullText[innerStart - 1]) &&
    !isPunctuation(fullText[innerStart - 1]) &&
    !isModifierChar(fullText[innerStart - 1])
  ) {
    innerStart--;
  }
  while (
    innerEnd < fullText.length &&
    !isWhitespace(fullText[innerEnd]) &&
    !isPunctuation(fullText[innerEnd]) &&
    !isModifierChar(fullText[innerEnd])
  ) {
    innerEnd++;
  }

  if (innerStart >= innerEnd) {
    return { start: selectionStart, end: selectionEnd, text: "" };
  }

  // Now expand outward to include any matching modifier pairs
  const expanded = expandToIncludeModifiers(fullText, innerStart, innerEnd);

  return {
    start: expanded.start,
    end: expanded.end,
    text: fullText.slice(expanded.start, expanded.end),
  };
}

export function TextSelectionMenu({
  selection,
  onApply,
  onClose,
  onMouseEnter,
  onMouseLeave,
  isVisible = true,
}: TextSelectionMenuProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const initialRectRef = useRef<DOMRect | null>(null);
  const lastRangeRef = useRef<Range | null>(null);

  const updatePositionFromRect = useCallback((rect: DOMRect) => {
    const menuWidth = 280;
    const menuHeight = 44;
    const padding = 8;

    let x = rect.left + rect.width / 2 - menuWidth / 2;
    let y = rect.top - menuHeight - padding;

    // Check if menu would go off screen
    if (y < padding) {
      // Try bottom
      y = rect.bottom + padding;

      if (y + menuHeight > window.innerHeight - padding) {
        // Try right
        x = rect.right + padding;
        y = rect.top + rect.height / 2 - menuHeight / 2;

        if (x + menuWidth > window.innerWidth - padding) {
          // Try left
          x = rect.left - menuWidth - padding;
        }
      }
    }

    // Clamp x to viewport
    x = Math.max(padding, Math.min(x, window.innerWidth - menuWidth - padding));
    // Clamp y to viewport
    y = Math.max(
      padding,
      Math.min(y, window.innerHeight - menuHeight - padding),
    );

    setPosition({ x, y });
  }, []);

  // Calculate position when the Range object changes (not just text/offsets)
  useEffect(() => {
    if (!selection) {
      setPosition(null);
      initialRectRef.current = null;
      lastRangeRef.current = null;
      return;
    }

    // Only recalculate position if the Range object itself changed
    // This prevents recalculating when we just update text/offsets after applying changes
    if (selection.range === lastRangeRef.current && position !== null) {
      return;
    }

    try {
      const rect = selection.range.getBoundingClientRect();
      // Check if rect is valid (not collapsed to 0,0)
      if (rect.width === 0 && rect.height === 0) {
        setPosition(null);
        initialRectRef.current = null;
        lastRangeRef.current = null;
        return;
      }

      initialRectRef.current = rect;
      lastRangeRef.current = selection.range;
      updatePositionFromRect(rect);
    } catch {
      // Range may be invalid
      setPosition(null);
      initialRectRef.current = null;
      lastRangeRef.current = null;
    }
  }, [selection, updatePositionFromRect, position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-selection-menu]")) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleEmphasize = () => {
    if (!selection) return;
    const parsed = parseModifiers(selection.text);

    if (parsed.bracketCount > 0) {
      // Remove one bracket level
      const newText = buildWithModifiers(
        parsed.innerText,
        parsed.parenCount,
        parsed.bracketCount - 1,
        parsed.weight,
      );
      onApply(newText, selection.startOffset, selection.endOffset);
    } else {
      // Add one paren level
      const newText = buildWithModifiers(
        parsed.innerText,
        parsed.parenCount + 1,
        0,
        parsed.weight,
      );
      onApply(newText, selection.startOffset, selection.endOffset);
    }
  };

  const handleDeemphasize = () => {
    if (!selection) return;
    const parsed = parseModifiers(selection.text);

    if (parsed.parenCount > 0) {
      // Remove one paren level
      // Discard weight when removing the last paren level (weight requires parens)
      const newText = buildWithModifiers(
        parsed.innerText,
        parsed.parenCount - 1,
        parsed.bracketCount,
        parsed.parenCount > 1 ? parsed.weight : null,
      );
      onApply(newText, selection.startOffset, selection.endOffset);
    } else {
      // Add one bracket level
      const newText = buildWithModifiers(
        parsed.innerText,
        0,
        parsed.bracketCount + 1,
        null, // Brackets don't support weight syntax
      );
      onApply(newText, selection.startOffset, selection.endOffset);
    }
  };

  const handleWeightChange = (delta: number) => {
    if (!selection) return;
    const parsed = parseModifiers(selection.text);

    const currentWeight = parsed.weight ?? 1;
    let newWeight = Math.round((currentWeight + delta) * 10) / 10;

    // If weight is effectively 1 (neutral), remove it
    if (Math.abs(newWeight - 1) < 0.01) {
      newWeight = 1;
    }

    // Build new text - if weight is 1, don't include it
    // When applying weight, remove brackets (weight requires parens, not brackets)
    const newText = buildWithModifiers(
      parsed.innerText,
      newWeight === 1 ? parsed.parenCount : Math.max(1, parsed.parenCount),
      newWeight === 1 ? parsed.bracketCount : 0,
      newWeight === 1 ? null : newWeight,
    );
    onApply(newText, selection.startOffset, selection.endOffset);
  };

  const handleClear = () => {
    if (!selection) return;
    const parsed = parseModifiers(selection.text);
    // Remove all modifiers, just keep the inner text
    onApply(parsed.innerText, selection.startOffset, selection.endOffset);
  };

  if (!selection || !selection.text || !position) return null;

  const parsed = parseModifiers(selection.text);
  const currentWeight = parsed.weight ?? 1;

  // Check if menu is in hover mode (has mouse handlers)
  const isHoverMode = onMouseEnter !== undefined;
  const shouldShow = isVisible;

  return (
    <AnimatePresence>
      {/* Invisible bridge to prevent menu from closing when moving mouse to it */}
      {shouldShow && isHoverMode && initialRectRef.current && (
        <div
          key="bridge"
          data-selection-menu
          className="fixed z-99"
          style={{
            left: position.x,
            top: position.y + 44, // menuHeight
            width: 280, // menuWidth
            height: Math.max(
              0,
              initialRectRef.current.top - position.y - 44 + 4,
            ),
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      )}
      {shouldShow && (
        <motion.div
          key="menu"
          data-selection-menu
          className="fixed z-100 bg-background border border-cyan-medium rounded-lg shadow-xl p-1.5 flex gap-1.5"
          style={{ left: position.x, top: position.y }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={handleEmphasize}
            className="text-xs px-2"
          >
            Emphasize
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeemphasize}
            className="text-xs px-2"
          >
            Deemphasize
          </Button>
          <ButtonGroup>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleWeightChange(-0.2)}
              className="px-1.5"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <div className="flex items-center px-2 text-xs font-mono bg-secondary border-y border-input">
              {currentWeight.toFixed(1)}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleWeightChange(0.2)}
              className="px-1.5"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </ButtonGroup>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClear}
            className="px-1.5"
          >
            <X className="h-3 w-3" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
