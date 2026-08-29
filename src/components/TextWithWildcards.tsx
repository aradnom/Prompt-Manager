import { useMemo, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { parseWildcards } from "@/lib/wildcard-parser";
import { parseModifiers, type ModifierMatch } from "@/lib/modifier-parser";
import { WildcardString } from "@/components/WildcardString";
import { ModifierString } from "@/components/ModifierString";
import { isCommentedLine } from "@shared/comments";
import { Wildcard } from "@/types/schema";

interface TextWithWildcardsProps {
  text: string;
  className?: string;
  valueOnly?: boolean;
  enableTooltips?: boolean;
  enableModifierHighlighting?: boolean;
  onMarkerChange?: (oldMarker: string, newMarker: string) => void;
  onModifierChange?: (
    oldText: string,
    newText: string,
    startIndex: number,
    endIndex: number,
  ) => void;
}

type ParsedMatch =
  | {
      matchType: "wildcard";
      index: number;
      fullMatch: string;
      displayId: string;
      path: string;
      frozen: boolean;
    }
  | {
      matchType: "value";
      index: number;
      fullMatch: string;
      content: string;
    }
  | {
      matchType: "modifier";
      index: number;
      fullMatch: string;
      modifierMatch: ModifierMatch;
    }
  | {
      matchType: "text";
      index: number;
      content: string;
    };

/** One source line, with its offset into the full text. */
interface ParsedLine {
  content: string;
  /** Character offset of this line's first character within the full text. */
  start: number;
  /** `//`-prefixed: greyed out here, dropped from rendered output. */
  commented: boolean;
  /** Empty for commented lines — they render as flat text. */
  segments: ParsedMatch[];
}

/**
 * Tokenize one line into wildcard / value / modifier / plain-text segments.
 * Indices are relative to `line`; callers add the line's own offset when they
 * need a position within the full text.
 */
function parseSegments(
  line: string,
  enableModifierHighlighting: boolean,
): ParsedMatch[] {
  // 1. Parse standard wildcards
  const wildcardMatches = parseWildcards(line).map((m) => ({
    ...m,
    matchType: "wildcard" as const,
  }));

  // 2. Parse value markers {{val:...}}
  const valueMatches: Array<{
    matchType: "value";
    content: string;
    fullMatch: string;
    index: number;
  }> = [];
  const valuePattern = /\{\{val:(.*?)\}\}/g;
  let match;
  while ((match = valuePattern.exec(line)) !== null) {
    valueMatches.push({
      matchType: "value" as const,
      content: match[1],
      fullMatch: match[0],
      index: match.index,
    });
  }

  // 3. Parse modifiers if enabled
  const modifierMatches: Array<{
    matchType: "modifier";
    index: number;
    fullMatch: string;
    modifierMatch: ModifierMatch;
  }> = [];
  if (enableModifierHighlighting) {
    const parsedModifiers = parseModifiers(line);
    parsedModifiers.forEach((m) => {
      modifierMatches.push({
        matchType: "modifier" as const,
        index: m.index,
        fullMatch: m.fullMatch,
        modifierMatch: m,
      });
    });
  }

  // Combine all matches - need to handle potential overlaps
  // Wildcards and values should take precedence over modifiers
  const priorityMatches = [...wildcardMatches, ...valueMatches].sort(
    (a, b) => a.index - b.index,
  );

  // Filter modifiers that don't overlap with wildcards/values
  const filteredModifiers = modifierMatches.filter((mod) => {
    const modStart = mod.index;
    const modEnd = modStart + mod.fullMatch.length;

    return !priorityMatches.some((pm) => {
      const pmEnd = pm.index + pm.fullMatch.length;
      // Check if ranges overlap
      return modStart < pmEnd && modEnd > pm.index;
    });
  });

  const allMatches = [...priorityMatches, ...filteredModifiers].sort(
    (a, b) => a.index - b.index,
  );

  if (allMatches.length === 0) {
    return [{ matchType: "text" as const, index: 0, content: line }];
  }

  const result: ParsedMatch[] = [];
  let lastIndex = 0;

  allMatches.forEach((m) => {
    // Add text before match
    if (m.index > lastIndex) {
      result.push({
        matchType: "text",
        index: lastIndex,
        content: line.substring(lastIndex, m.index),
      });
    }

    result.push(m as ParsedMatch);
    lastIndex = m.index + m.fullMatch.length;
  });

  // Add remaining text
  if (lastIndex < line.length) {
    result.push({
      matchType: "text",
      index: lastIndex,
      content: line.substring(lastIndex),
    });
  }

  return result;
}

export function TextWithWildcards({
  text,
  className,
  valueOnly = false,
  enableTooltips = false,
  enableModifierHighlighting = false,
  onMarkerChange,
  onModifierChange,
}: TextWithWildcardsProps) {
  const { data: wildcardsData } = api.wildcards.list.useQuery();
  const wildcards = wildcardsData?.items;
  const [activeModifierId, setActiveModifierId] = useState<string | null>(null);

  const handleSetActiveModifier = useCallback((id: string | null) => {
    setActiveModifierId(id);
  }, []);

  // Parsing is per line so `//` comments can be greyed out as whole lines.
  // Memoize parsing only - returns structured data, not React elements
  const parsedLines = useMemo(() => {
    const lines: ParsedLine[] = [];
    let start = 0;

    for (const content of text.split("\n")) {
      const commented = isCommentedLine(content);
      lines.push({
        content,
        start,
        commented,
        segments: commented
          ? []
          : parseSegments(content, enableModifierHighlighting),
      });
      start += content.length + 1; // + 1 for the newline itself
    }

    return lines;
  }, [text, enableModifierHighlighting]);

  // Build wildcard map
  const wildcardMap = useMemo(() => {
    const map = new Map<string, Wildcard>();
    wildcards?.forEach((w) => map.set(w.displayId, w));
    return map;
  }, [wildcards]);

  // Render elements - not memoized so it can react to activeModifierId changes
  const renderLine = (line: ParsedLine, lineIdx: number) =>
    line.segments.map((segment, idx) => {
      if (segment.matchType === "text") {
        return segment.content;
      }

      if (segment.matchType === "wildcard") {
        const wildcard = wildcardMap.get(segment.displayId) || null;
        return (
          <WildcardString
            key={`wildcard-${lineIdx}-${idx}-${segment.displayId}-${segment.path}`}
            wildcard={wildcard}
            displayId={segment.displayId}
            path={segment.path}
            frozen={segment.frozen}
            fullMatch={segment.fullMatch}
            valueOnly={valueOnly}
            enableTooltip={enableTooltips}
            onMarkerChange={onMarkerChange}
          />
        );
      }

      if (segment.matchType === "value") {
        return (
          <span
            key={`val-${lineIdx}-${idx}`}
            data-interactive-text
            className="inline-block px-2 py-0.5 bg-magenta-medium/60 text-foreground font-mono"
          >
            {segment.content}
          </span>
        );
      }

      if (segment.matchType === "modifier" && onModifierChange) {
        const modifierId = `mod-${lineIdx}-${idx}-${segment.modifierMatch.index}`;
        return (
          <ModifierString
            key={modifierId}
            match={segment.modifierMatch}
            onModify={onModifierChange}
            textOffset={line.start}
            modifierId={modifierId}
            activeModifierId={activeModifierId}
            onSetActive={handleSetActiveModifier}
          />
        );
      }

      // Static modifier styling (no menu) when highlighting is enabled but no change handler
      if (segment.matchType === "modifier" && enableModifierHighlighting) {
        const m = segment.modifierMatch;
        const hasEmphasis = m.type === "emphasis";
        const hasDeemphasis = m.type === "deemphasis";
        const hasPositiveWeight = m.weight && m.weight > 1;
        const hasNegativeWeight = m.weight && m.weight < 1;

        return (
          <span
            key={`mod-${lineIdx}-${idx}`}
            className={cn(
              "px-1 py-0.5 bg-cyan-medium/40",
              hasPositiveWeight && "font-bold",
              hasNegativeWeight && "font-light",
              hasEmphasis && "bg-cyan-medium/60",
              hasDeemphasis && "opacity-70",
            )}
          >
            {m.fullMatch}
          </span>
        );
      }

      return null;
    });

  // The newline between lines is emitted as its own text node so the total
  // character count still matches `text` — callers walk these text nodes to
  // map a DOM selection back to an offset in the source string.
  return (
    <span className={className}>
      {parsedLines.map((line, lineIdx) => (
        <span key={`line-${lineIdx}`}>
          {lineIdx > 0 && "\n"}
          {line.commented ? (
            <span className="text-foreground/40 italic">{line.content}</span>
          ) : (
            renderLine(line, lineIdx)
          )}
        </span>
      ))}
    </span>
  );
}
