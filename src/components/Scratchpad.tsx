import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { RasterIcon } from "@/components/RasterIcon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Scratchpad() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading } = api.users.getScratchpad.useQuery(undefined, {
    enabled: isOpen,
  });

  const saveMutation = api.users.setScratchpad.useMutation();

  // Sync content when data changes (e.g. on open/refetch)
  useEffect(() => {
    if (data !== undefined) {
      setContent(data.content ?? "");
    }
  }, [data]);

  // Debounced save
  const handleChange = (newContent: string) => {
    setContent(newContent);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveMutation.mutate({ content: newContent });
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-8 left-8 z-50 opacity-75 transition-opacity hover:opacity-100 cursor-pointer"
            >
              <RasterIcon name="note" size={20} opacity={0.8} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Scratchpad</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] h-full w-full flex flex-col">
          <DialogHeader>
            <DialogTitle>Scratchpad</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-cyan-medium">
                Loading...
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Jot down your ideas..."
                className="w-full h-full resize-none bg-transparent border border-cyan-medium rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-magenta-medium font-mono text-sm"
                autoFocus
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
