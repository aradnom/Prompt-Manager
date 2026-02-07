import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Dices, Lock, LockOpen } from "lucide-react";
import { Wildcard } from "@/types/schema";
import { resolveWildcardPath } from "@/lib/wildcard-value-extractor";
import { getRandomWildcardPath } from "@/lib/wildcard-random";
import { buildWildcardMarker } from "@/lib/wildcard-parser";
import { WildcardBrowserLists } from "@/components/WildcardBrowserLists";

interface WildcardStringProps {
  wildcard: Wildcard | null;
  displayId: string;
  path: string;
  frozen?: boolean;
  fullMatch?: string;
  valueOnly?: boolean;
  enableTooltip?: boolean;
  onMarkerChange?: (oldMarker: string, newMarker: string) => void;
}

type TooltipPosition = "top" | "bottom" | "left" | "right";

export function WildcardString({
  wildcard,
  displayId,
  path,
  frozen = false,
  fullMatch,
  valueOnly = false,
  enableTooltip = false,
  onMarkerChange,
}: WildcardStringProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] =
    useState<TooltipPosition>("top");
  const spanRef = useRef<HTMLSpanElement>(null);

  const calculateTooltipPosition = (): TooltipPosition => {
    if (!spanRef.current) return "top";

    const rect = spanRef.current.getBoundingClientRect();
    const tooltipHeight = 300; // Expected tooltip height
    const tooltipWidth = 400; // Expected tooltip width
    const padding = 20;

    // Check top
    if (rect.top - tooltipHeight - padding >= 0) {
      return "top";
    }

    // Check bottom
    if (rect.bottom + tooltipHeight + padding <= window.innerHeight) {
      return "bottom";
    }

    // Check left
    if (rect.left - tooltipWidth - padding >= 0) {
      return "left";
    }

    // Check right
    if (rect.right + tooltipWidth + padding <= window.innerWidth) {
      return "right";
    }

    // Default to top if no good position
    return "top";
  };

  const handleMouseEnter = () => {
    if (!enableTooltip) return;
    const position = calculateTooltipPosition();
    setTooltipPosition(position);
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const getCurrentValue = (wildcard: Wildcard, path: string): string => {
    const maxLength = 40;

    if (path) {
      const resolved = resolveWildcardPath(
        wildcard.content,
        wildcard.format,
        path,
      );
      if (resolved) {
        return resolved.length > maxLength
          ? resolved.substring(0, maxLength) + "..."
          : resolved;
      }
    }

    // Fallback to old behavior if no path or resolution fails
    switch (wildcard.format) {
      case "json": {
        try {
          const parsed = JSON.parse(wildcard.content);
          const preview = JSON.stringify(parsed);
          return preview.length > maxLength
            ? preview.substring(0, maxLength) + "..."
            : preview;
        } catch {
          return wildcard.content.substring(0, maxLength) + "...";
        }
      }
      case "yaml":
      case "text": {
        const firstLine = wildcard.content.split("\n")[0];
        return firstLine.length > maxLength
          ? firstLine.substring(0, maxLength) + "..."
          : firstLine;
      }
      case "lines": {
        const lines = wildcard.content.split("\n").filter((l) => l.trim());
        return lines.length > 0
          ? lines[0]
          : wildcard.content.substring(0, maxLength);
      }
      default:
        return wildcard.content.substring(0, maxLength);
    }
  };

  const textSizeClass = valueOnly ? "" : "text-sm";

  const getTooltipPositionClasses = (): string => {
    switch (tooltipPosition) {
      case "top":
        return "bottom-full left-1/2 -translate-x-1/2 mb-2";
      case "bottom":
        return "top-full left-1/2 -translate-x-1/2 mt-2";
      case "left":
        return "right-full top-1/2 -translate-y-1/2 mr-2";
      case "right":
        return "left-full top-1/2 -translate-y-1/2 ml-2";
    }
  };

  const getBridgeClasses = (): string => {
    // Invisible bridge to prevent tooltip from closing when moving mouse to it
    switch (tooltipPosition) {
      case "top":
        return "bottom-full left-0 right-0 h-2 mb-0";
      case "bottom":
        return "top-full left-0 right-0 h-2 mt-0";
      case "left":
        return "right-full top-0 bottom-0 w-2 mr-0";
      case "right":
        return "left-full top-0 bottom-0 w-2 ml-0";
    }
  };

  if (!wildcard) {
    return (
      <span
        ref={spanRef}
        className={`inline-block px-2 py-0.5 rounded bg-magenta-medium/20 text-foreground ${textSizeClass} font-mono`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {valueOnly ? "[not found]" : `${displayId}: [not found]`}
      </span>
    );
  }

  const value = getCurrentValue(wildcard, path);

  const handleRandomSelection = () => {
    if (!onMarkerChange || !fullMatch) return;
    const randomPath = getRandomWildcardPath(wildcard);
    if (randomPath !== null) {
      onMarkerChange(
        fullMatch,
        buildWildcardMarker(displayId, randomPath, frozen),
      );
    }
    setShowTooltip(false);
  };

  const handleToggleFrozen = () => {
    if (!onMarkerChange || !fullMatch) return;
    onMarkerChange(fullMatch, buildWildcardMarker(displayId, path, !frozen));
  };

  const bgClass = frozen ? "bg-cyan-medium/30" : "bg-magenta-medium/70";

  return (
    <span
      ref={spanRef}
      className={`relative inline-block px-2 py-0.5 rounded-sm ${bgClass} text-foreground ${textSizeClass} font-mono ${enableTooltip ? "cursor-pointer" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {valueOnly ? value : `${displayId}: ${value}`}

      <AnimatePresence>
        {enableTooltip && showTooltip && (
          <>
            {/* Invisible bridge to prevent tooltip from closing */}
            <motion.div
              className={`absolute ${getBridgeClasses()} z-50`}
              onMouseEnter={handleMouseEnter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />

            <motion.div
              className={`absolute ${getTooltipPositionClasses()} z-50 w-125 max-h-100 overflow-y-auto bg-background border border-cyan-medium rounded-lg shadow-xl p-4`}
              onMouseEnter={handleMouseEnter}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-sm text-foreground">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-semibold">{wildcard.name}</div>
                    <div className="text-xs text-cyan-medium font-mono">
                      {displayId}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {onMarkerChange && fullMatch && (
                      <button
                        onClick={handleToggleFrozen}
                        onMouseUp={(e) => e.stopPropagation()}
                        className={`p-2 rounded border transition-colors ${
                          frozen
                            ? "border-cyan-medium bg-cyan-dark/50 hover:bg-cyan-dark/80"
                            : "border-cyan-medium hover:bg-cyan-dark/80"
                        }`}
                        title={frozen ? "Unlock wildcard" : "Lock wildcard"}
                      >
                        {frozen ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <LockOpen className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleRandomSelection}
                      onMouseUp={(e) => e.stopPropagation()}
                      className="p-2 rounded border border-cyan-medium hover:bg-cyan-dark/80 transition-colors"
                      title="Random selection"
                    >
                      <Dices className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-4" />

                <WildcardBrowserLists
                  wildcard={wildcard}
                  currentPath={path}
                  onSelectValue={(newPath) => {
                    if (onMarkerChange && fullMatch) {
                      onMarkerChange(
                        fullMatch,
                        buildWildcardMarker(displayId, newPath, frozen),
                      );
                    }
                    setShowTooltip(false);
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}
