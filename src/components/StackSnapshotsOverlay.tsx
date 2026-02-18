import { useState } from "react";
import { motion } from "motion/react";
import { X, Trash2, StickyNote, Copy } from "lucide-react";
import { api, RouterOutput } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NotesDialog } from "@/components/NotesDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Snapshot = RouterOutput["stacks"]["listSnapshots"][number];

interface SnapshotCardProps {
  snapshot: Snapshot;
  stackId: number;
}

function SnapshotCard({ snapshot, stackId }: SnapshotCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(snapshot.name ?? "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const utils = api.useUtils();

  const updateMutation = api.stacks.updateSnapshot.useMutation({
    onSuccess: () => {
      utils.stacks.listSnapshots.invalidate({ stackId });
    },
  });

  const deleteMutation = api.stacks.deleteSnapshot.useMutation({
    onSuccess: () => {
      utils.stacks.listSnapshots.invalidate({ stackId });
    },
  });

  const saveName = () => {
    const trimmed = editValue.trim();
    const newName = trimmed || null;
    if (newName !== (snapshot.name ?? null)) {
      updateMutation.mutate({
        id: snapshot.id,
        stackId,
        name: newName,
      });
    }
    setIsEditing(false);
  };

  return (
    <div className="shrink-0 w-100 h-full border rounded-md p-4 bg-cyan-dark flex flex-col relative">
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <TooltipProvider delayDuration={0}>
          <Tooltip open={showCopied || undefined}>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(snapshot.renderedContent);
                  setShowCopied(true);
                  setTimeout(() => setShowCopied(false), 1500);
                }}
                className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
                aria-label="Copy contents"
              >
                <Copy className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {showCopied ? "Copied!" : "Copy contents"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setNotesDialogOpen(true)}
                className={`text-cyan-medium hover:text-foreground transition-colors cursor-pointer ${snapshot.notes ? "text-foreground" : ""}`}
                aria-label="Edit notes"
              >
                <StickyNote className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {snapshot.notes ? "Edit notes" : "Add notes"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button
          onClick={() => setDeleteDialogOpen(true)}
          className="text-cyan-medium hover:text-destructive transition-colors cursor-pointer"
          aria-label="Delete snapshot"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1 mb-3 pr-6">
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setEditValue(snapshot.name ?? "");
                setIsEditing(false);
              }
            }}
            placeholder="Enter snapshot name..."
            className="w-full text-sm font-medium font-mono px-2 py-1 rounded border border-cyan-medium bg-background focus:outline-none focus:ring-1 focus:ring-magenta-medium"
            maxLength={255}
            autoFocus
          />
        ) : (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  className="text-sm font-medium font-mono cursor-pointer hover:text-magenta-light transition-colors"
                  onClick={() => {
                    setEditValue(snapshot.name ?? "");
                    setIsEditing(true);
                  }}
                >
                  {snapshot.name || snapshot.displayId}
                </p>
              </TooltipTrigger>
              <TooltipContent>Click to set name for snapshot</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {snapshot.name && (
          <p className="text-xs text-cyan-medium font-mono">
            {snapshot.displayId}
          </p>
        )}
        <p className="text-xs text-cyan-medium">
          {new Date(snapshot.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <p className="text-sm whitespace-pre-wrap font-mono text-foreground/80">
          {snapshot.renderedContent}
        </p>
      </div>
      <NotesDialog
        title="Snapshot Notes"
        placeholder="Add notes about this snapshot..."
        initialNotes={snapshot.notes}
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        onSave={(notes) => {
          updateMutation.mutate({
            id: snapshot.id,
            stackId,
            notes,
          });
        }}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          deleteMutation.mutate({ id: snapshot.id, stackId });
        }}
        title="Delete Snapshot"
        description="Are you sure you want to delete this snapshot? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}

interface StackSnapshotsOverlayProps {
  stackId: number;
  onClose: () => void;
}

export function StackSnapshotsOverlay({
  stackId,
  onClose,
}: StackSnapshotsOverlayProps) {
  const snapshotsQuery = api.stacks.listSnapshots.useQuery({ stackId });

  return (
    <motion.div
      className="absolute inset-0 bg-background z-20 rounded-lg overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-2 top-2 z-30 text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
        aria-label="Close snapshots"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-4 overflow-x-auto h-full p-4 mr-8">
        {snapshotsQuery.isLoading ? (
          <div className="flex items-center justify-center w-full">
            <p className="text-sm text-cyan-medium">Loading snapshots...</p>
          </div>
        ) : snapshotsQuery.data && snapshotsQuery.data.length > 0 ? (
          snapshotsQuery.data.map((snapshot) => (
            <SnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              stackId={stackId}
            />
          ))
        ) : (
          <div className="flex items-center justify-center w-full">
            <p className="text-sm text-cyan-medium">No snapshots yet</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
