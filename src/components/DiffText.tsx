import { useMemo } from "react";
import { diffWords } from "diff";
import { cn } from "@/lib/utils";

interface DiffTextProps {
  /** The "before" text (usually the active/current revision) */
  oldText: string;
  /** The "after" text (usually the hovered revision) */
  newText: string;
  className?: string;
}

/**
 * Renders a word-by-word diff between two texts.
 * - Added words (in newText but not oldText): green background
 * - Removed words (in oldText but not newText): red background with strikethrough
 * - Unchanged text: normal rendering
 */
export function DiffText({ oldText, newText, className }: DiffTextProps) {
  const diffResult = useMemo(() => {
    return diffWords(oldText, newText);
  }, [oldText, newText]);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {diffResult.map((part, index) => {
        // Each part.value may contain multiple lines (including trailing newlines)
        // We render them as-is but apply styling based on added/removed status
        if (part.added) {
          return (
            <span key={index} className="bg-green-500/30 text-green-200">
              {part.value}
            </span>
          );
        }

        if (part.removed) {
          return (
            <span
              key={index}
              className="bg-red-500/30 text-red-200 line-through opacity-70"
            >
              {part.value}
            </span>
          );
        }

        // Unchanged
        return <span key={index}>{part.value}</span>;
      })}
    </span>
  );
}
