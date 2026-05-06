import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Dices, Lock, LockOpen, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
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
    if (spanRef.current) setAnchorRect(spanRef.current.getBoundingClientRect());
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

  const getTooltipFixedStyle = (): React.CSSProperties => {
    if (!anchorRect) return {};
    const gap = 8;
    switch (tooltipPosition) {
      case "top":
        return {
          left: anchorRect.left + anchorRect.width / 2,
          top: anchorRect.top - gap,
          transform: "translate(-50%, -100%)",
        };
      case "bottom":
        return {
          left: anchorRect.left + anchorRect.width / 2,
          top: anchorRect.bottom + gap,
          transform: "translate(-50%, 0)",
        };
      case "left":
        return {
          left: anchorRect.left - gap,
          top: anchorRect.top + anchorRect.height / 2,
          transform: "translate(-100%, -50%)",
        };
      case "right":
        return {
          left: anchorRect.right + gap,
          top: anchorRect.top + anchorRect.height / 2,
          transform: "translate(0, -50%)",
        };
    }
  };

  const getBridgeFixedStyle = (): React.CSSProperties => {
    if (!anchorRect) return {};
    switch (tooltipPosition) {
      case "top":
        return {
          left: anchorRect.left,
          width: anchorRect.width,
          top: anchorRect.top - 8,
          height: 8,
        };
      case "bottom":
        return {
          left: anchorRect.left,
          width: anchorRect.width,
          top: anchorRect.bottom,
          height: 8,
        };
      case "left":
        return {
          top: anchorRect.top,
          height: anchorRect.height,
          left: anchorRect.left - 8,
          width: 8,
        };
      case "right":
        return {
          top: anchorRect.top,
          height: anchorRect.height,
          left: anchorRect.right,
          width: 8,
        };
    }
  };

  if (!wildcard) {
    return (
      <span
        ref={spanRef}
        data-interactive-text
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

  const highlightStyle = frozen
    ? "border-magenta-medium/60"
    : "border-transparent bg-magenta-medium/60";

  return (
    <span
      ref={spanRef}
      data-interactive-text
      className={`relative inline-block px-1.5 py-0.5 ${highlightStyle} border text-foreground ${textSizeClass} font-mono ${enableTooltip ? "cursor-pointer" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {valueOnly ? value : `${displayId}: ${value}`}

      {createPortal(
        <AnimatePresence>
          {enableTooltip && showTooltip && anchorRect && (
            <>
              {/* Invisible bridge to prevent tooltip from closing */}
              <motion.div
                className="fixed z-100"
                style={getBridgeFixedStyle()}
                onMouseEnter={handleMouseEnter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />

              <motion.div
                className="fixed z-100 w-125 max-h-100 overflow-y-auto bg-background border border-cyan-medium rounded-lg shadow-xl p-4"
                style={getTooltipFixedStyle()}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
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
                    <TooltipProvider delayDuration={0}>
                      <div className="flex gap-1">
                        {onMarkerChange && fullMatch && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={handleToggleFrozen}
                                onMouseUp={(e) => e.stopPropagation()}
                                className={`p-2 rounded border transition-colors cursor-pointer ${
                                  frozen
                                    ? "border-cyan-medium bg-cyan-dark/50 hover:bg-cyan-dark/80"
                                    : "border-cyan-medium hover:bg-cyan-dark/80"
                                }`}
                                aria-label="Lock current value"
                              >
                                {frozen ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <LockOpen className="h-4 w-4" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Lock current value</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleRandomSelection}
                              onMouseUp={(e) => e.stopPropagation()}
                              className="p-2 rounded border border-cyan-medium hover:bg-cyan-dark/80 transition-colors cursor-pointer"
                              aria-label="Pick new value randomly"
                            >
                              <Dices className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Pick new value randomly
                          </TooltipContent>
                        </Tooltip>
                        {onMarkerChange && fullMatch && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  onMarkerChange(fullMatch, "");
                                  setShowTooltip(false);
                                }}
                                onMouseUp={(e) => e.stopPropagation()}
                                className="p-2 rounded border border-cyan-medium hover:bg-cyan-dark/80 transition-colors cursor-pointer"
                                aria-label="Remove wildcard"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Remove wildcard</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
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
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}
