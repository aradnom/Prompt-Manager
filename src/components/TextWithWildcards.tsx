import { useMemo, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { parseWildcards } from "@/lib/wildcard-parser";
import { parseModifiers, type ModifierMatch } from "@/lib/modifier-parser";
import { WildcardString } from "@/components/WildcardString";
import { ModifierString } from "@/components/ModifierString";
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

  // Memoize parsing only - returns structured data, not React elements
  const parsedSegments = useMemo(() => {
    // 1. Parse standard wildcards
    const wildcardMatches = parseWildcards(text).map((m) => ({
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
    while ((match = valuePattern.exec(text)) !== null) {
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
      const parsedModifiers = parseModifiers(text);
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
      return [{ matchType: "text" as const, index: 0, content: text }];
    }

    const result: ParsedMatch[] = [];
    let lastIndex = 0;

    allMatches.forEach((match) => {
      // Add text before match
      if (match.index > lastIndex) {
        result.push({
          matchType: "text",
          index: lastIndex,
          content: text.substring(lastIndex, match.index),
        });
      }

      result.push(match as ParsedMatch);
      lastIndex = match.index + match.fullMatch.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push({
        matchType: "text",
        index: lastIndex,
        content: text.substring(lastIndex),
      });
    }

    return result;
  }, [text, enableModifierHighlighting]);

  // Build wildcard map
  const wildcardMap = useMemo(() => {
    const map = new Map<string, Wildcard>();
    wildcards?.forEach((w) => map.set(w.displayId, w));
    return map;
  }, [wildcards]);

  // Render elements - not memoized so it can react to activeModifierId changes
  const elements = parsedSegments.map((segment, idx) => {
    if (segment.matchType === "text") {
      return segment.content;
    }

    if (segment.matchType === "wildcard") {
      const wildcard = wildcardMap.get(segment.displayId) || null;
      return (
        <WildcardString
          key={`wildcard-${idx}-${segment.displayId}-${segment.path}`}
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
          key={`val-${idx}`}
          data-interactive-text
          className="inline-block px-2 py-0.5 bg-magenta-medium/60 text-foreground font-mono"
        >
          {segment.content}
        </span>
      );
    }

    if (segment.matchType === "modifier" && onModifierChange) {
      const modifierId = `mod-${idx}-${segment.modifierMatch.index}`;
      return (
        <ModifierString
          key={modifierId}
          match={segment.modifierMatch}
          onModify={onModifierChange}
          textOffset={0}
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
          key={`mod-${idx}`}
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

  return <span className={className}>{elements}</span>;
}
