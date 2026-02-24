import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { generateDisplayId } from "@/lib/generate-display-id";
import { generateUUID } from "@/lib/uuid";
import { calculateNonOverlappingPositions } from "@/lib/layout-utils";
import { useTransform } from "@/hooks/useTransform";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OutputStyle } from "@/types/schema";

interface GenerateBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (block: { id: number }) => void;
  style?: OutputStyle;
}

export function GenerateBlockDialog({
  open,
  onOpenChange,
  onGenerated,
  style = null,
}: GenerateBlockDialogProps) {
  const [generateConcept, setGenerateConcept] = useState("");
  const [generateResults, setGenerateResults] = useState<string[]>([]);
  const [isEditingConcept, setIsEditingConcept] = useState(false);

  const generateMutation = useTransform();

  const createBlockMutation = api.blocks.create.useMutation();

  const generatePositions = useMemo(() => {
    if (generateResults.length === 0) return [];

    return calculateNonOverlappingPositions({
      count: generateResults.length,
      centerX: 0,
      centerY: 0,
      centerWidth: 500,
      centerHeight: 100,
      itemWidth: 450,
      itemHeight: 100,
      radius: 300,
      margin: 40,
    });
  }, [generateResults.length]);

  const handleGenerateSubmit = async () => {
    if (!generateConcept.trim()) return;

    try {
      const result = await generateMutation.mutateAsync({
        text: generateConcept,
        operation: "generate",
        style,
      });

      if (Array.isArray(result.result)) {
        setGenerateResults(result.result);
      }
      setIsEditingConcept(false);
    } catch (error) {
      console.error("Generate failed:", error);
    }
  };

  const handleConceptClick = () => {
    setIsEditingConcept(true);
  };

  const handleSelectGenerated = async (text: string) => {
    try {
      const newBlock = await createBlockMutation.mutateAsync({
        uuid: generateUUID(),
        displayId: generateDisplayId(),
        text: text,
        labels: [],
        typeId: undefined,
      });

      onGenerated(newBlock);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create generated block:", error);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setGenerateConcept("");
      setGenerateResults([]);
      setIsEditingConcept(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] h-full w-full flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate New Block</DialogTitle>
          <DialogDescription>
            {generateResults.length === 0
              ? "Enter a concept or idea to generate suggestions"
              : `${generateResults.length} suggestions generated`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex items-center justify-center p-8">
          {generateResults.length === 0 ? (
            <div className="w-full max-w-md space-y-4">
              <input
                type="text"
                value={generateConcept}
                onChange={(e) =>
                  setGenerateConcept(e.target.value.slice(0, 140))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !generateMutation.isPending) {
                    handleGenerateSubmit();
                  }
                }}
                placeholder="Enter a concept (e.g., 'landscape', 'action scenes')"
                className="w-full px-4 py-2 border-2 border-inline-input"
                maxLength={140}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-cyan-medium">
                  {generateConcept.length}/140 characters
                </span>
                <Button
                  onClick={handleGenerateSubmit}
                  disabled={
                    !generateConcept.trim() || generateMutation.isPending
                  }
                >
                  {generateMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            </div>
          ) : generateMutation.isPending ? (
            <LoadingSpinner />
          ) : (
            <div className="relative w-full h-full">
              {/* Spokes from center to suggestions */}
              {generateResults.map((_, index) => {
                const position = generatePositions[index];
                if (!position) return null;

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

              {/* Concept in center */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-25 flex items-center justify-center"
                style={{ zIndex: 10 }}
              >
                <div className="p-4 border-2 border-magenta-medium rounded-md bg-background w-full h-full flex items-center justify-center relative">
                  <button
                    onClick={handleGenerateSubmit}
                    disabled={generateMutation.isPending}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-magenta-dark text-foreground hover:bg-magenta-dark/90 transition-colors disabled:opacity-50"
                    title="Regenerate suggestions"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  {isEditingConcept ? (
                    <input
                      type="text"
                      value={generateConcept}
                      onChange={(e) =>
                        setGenerateConcept(e.target.value.slice(0, 140))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !generateMutation.isPending) {
                          handleGenerateSubmit();
                        }
                      }}
                      onBlur={() => setIsEditingConcept(false)}
                      className="w-full text-sm text-center font-semibold bg-transparent border-none focus:outline-none"
                      maxLength={140}
                      autoFocus
                    />
                  ) : (
                    <p
                      className="text-sm font-semibold text-center line-clamp-3 cursor-pointer hover:text-foreground/80 transition-colors"
                      onClick={handleConceptClick}
                    >
                      {generateConcept}
                    </p>
                  )}
                </div>
              </div>

              {/* Suggestions shooting out in a star pattern */}
              {generateResults.map((suggestion, index) => {
                const position = generatePositions[index];
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
                    onClick={() => handleSelectGenerated(suggestion)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="p-4 border rounded-md bg-cyan-dark w-full h-full flex items-center justify-center hover:bg-cyan-dark/80 transition-colors">
                      <p className="text-sm text-center line-clamp-3">
                        {suggestion}
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
  );
}
