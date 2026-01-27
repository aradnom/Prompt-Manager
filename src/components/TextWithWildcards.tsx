import { useMemo } from "react";
import { api } from "@/lib/api";
import { parseWildcards } from "@/lib/wildcard-parser";
import { WildcardString } from "@/components/WildcardString";
import { Wildcard } from "@/types/schema";

interface TextWithWildcardsProps {
  text: string;
  className?: string;
  valueOnly?: boolean;
  enableTooltips?: boolean;
  onWildcardPathChange?: (
    displayId: string,
    oldPath: string,
    newPath: string,
  ) => void;
}

export function TextWithWildcards({
  text,
  className,
  valueOnly = false,
  enableTooltips = false,
  onWildcardPathChange,
}: TextWithWildcardsProps) {
  const { data: wildcards } = api.wildcards.list.useQuery();

  const elements = useMemo(() => {
    // 1. Parse standard wildcards
    const wildcardMatches = parseWildcards(text).map((m) => ({
      ...m,
      type: "wildcard" as const,
    }));

    // 2. Parse value markers {{val:...}}
    const valueMatches = [];
    const valuePattern = /\{\{val:(.*?)\}\}/g;
    let match;
    while ((match = valuePattern.exec(text)) !== null) {
      valueMatches.push({
        type: "value" as const,
        content: match[1],
        fullMatch: match[0],
        index: match.index,
        displayId: "", // placeholder
        path: "", // placeholder
      });
    }

    const allMatches = [...wildcardMatches, ...valueMatches].sort(
      (a, b) => a.index - b.index,
    );

    if (allMatches.length === 0) {
      return [text];
    }

    const wildcardMap = new Map<string, Wildcard>();
    wildcards?.forEach((w) => wildcardMap.set(w.displayId, w));

    const result: React.ReactNode[] = [];
    let lastIndex = 0;

    allMatches.forEach((match, idx) => {
      // Add text before match
      if (match.index > lastIndex) {
        result.push(text.substring(lastIndex, match.index));
      }

      if (match.type === "wildcard") {
        // Add wildcard component
        const wildcard = wildcardMap.get(match.displayId) || null;
        result.push(
          <WildcardString
            key={`wildcard-${idx}-${match.displayId}-${match.path}`}
            wildcard={wildcard}
            displayId={match.displayId}
            path={match.path}
            valueOnly={valueOnly}
            enableTooltip={enableTooltips}
            onPathChange={onWildcardPathChange}
          />,
        );
      } else {
        // Render resolved value with highlighting
        // Mimicking WildcardString style but for simple text value
        result.push(
          <span
            key={`val-${idx}`}
            className="inline-block px-2 py-0.5 rounded bg-magenta-dark/20 text-foreground font-mono"
          >
            {match.content}
          </span>,
        );
      }

      lastIndex = match.index + match.fullMatch.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return result;
  }, [text, wildcards, valueOnly, enableTooltips, onWildcardPathChange]);

  return <span className={className}>{elements}</span>;
}
