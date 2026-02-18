import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { ChevronDown, Folder, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FolderRowProps {
  folder: { id: number; name: string; description: string | null };
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (id: number, name: string) => void;
  deleteTooltip?: string;
  children: React.ReactNode;
}

export function FolderRow({
  folder,
  index,
  isExpanded,
  onToggle,
  onDelete,
  onRename,
  deleteTooltip = "Delete folder.",
  children,
}: FolderRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [folderName, setFolderName] = useState(folder.name);

  const handleSaveFolderName = () => {
    const trimmed = folderName.trim();
    if (trimmed && trimmed !== folder.name) {
      onRename(folder.id, trimmed);
    } else {
      setFolderName(folder.name);
    }
    setIsEditingName(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <div
        className={cn(
          "border-2 border-cyan-medium/30 rounded-lg overflow-hidden",
          index === 0 && "accent-border-gradient",
        )}
      >
        {/* Folder header */}
        <div
          className="flex items-center gap-3 px-4 py-3 bg-cyan-dark/50 cursor-pointer hover:bg-cyan-dark/70 transition-colors"
          onClick={onToggle}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 text-cyan-medium transition-transform",
              !isExpanded && "-rotate-90",
            )}
          />
          <Folder className="h-5 w-5 text-cyan-medium" />
          <div className="flex-1">
            {isEditingName ? (
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onBlur={handleSaveFolderName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveFolderName();
                  } else if (e.key === "Escape") {
                    setFolderName(folder.name);
                    setIsEditingName(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="font-medium bg-background rounded-md px-2 py-0.5 focus:outline-none focus:border-2 focus:border-magenta-medium"
                autoFocus
              />
            ) : (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="font-medium cursor-pointer hover:text-magenta-light transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderName(folder.name);
                        setIsEditingName(true);
                      }}
                    >
                      {folder.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Click to rename</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-cyan-medium hover:text-destructive transition-colors p-1 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{deleteTooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Folder contents */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4 bg-background/50">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
