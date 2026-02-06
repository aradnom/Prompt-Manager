import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NotesDialogProps {
  title?: string;
  placeholder?: string;
  maxLength?: number;
  initialNotes: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (notes: string | null) => void;
}

export function NotesDialog({
  title = "Notes",
  placeholder = "Add notes...",
  maxLength = 4000,
  initialNotes,
  open,
  onOpenChange,
  onSave,
}: NotesDialogProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync notes when initialNotes changes
  useEffect(() => {
    setNotes(initialNotes || "");
  }, [initialNotes]);

  const handleChange = (newNotes: string) => {
    setNotes(newNotes);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      onSave(newNotes.trim() || null);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col">
          <textarea
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="flex-1 min-h-75 resize-none bg-transparent border border-cyan-medium rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-magenta-medium font-mono text-sm"
            autoFocus
          />
          <div className="text-xs text-cyan-medium mt-2 text-right">
            {notes.length}/{maxLength}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
