import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { api, RouterOutput } from "@/lib/api";
import { RasterIcon } from "@/components/RasterIcon";
import { SearchInput } from "@/components/ui/search-input";
import { DotDivider } from "@/components/ui/dot-divider";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  StickyNote,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NotesDialog } from "@/components/NotesDialog";
import { LENGTH_LIMITS } from "@shared/limits";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Snapshot = RouterOutput["stacks"]["listAllSnapshots"]["items"][number];

const PAGE_SIZE = 20;

interface SnapshotCardProps {
  snapshot: Snapshot;
  index: number;
  isFirst: boolean;
  onUpdate: () => void;
}

function SnapshotCard({
  snapshot,
  index,
  isFirst,
  onUpdate,
}: SnapshotCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(snapshot.name ?? "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const utils = api.useUtils();

  const updateMutation = api.stacks.updateSnapshot.useMutation({
    onSuccess: () => {
      utils.stacks.listAllSnapshots.invalidate();
      utils.stacks.searchSnapshots.invalidate();
      onUpdate();
    },
  });

  const deleteMutation = api.stacks.deleteSnapshot.useMutation({
    onSuccess: () => {
      utils.stacks.listAllSnapshots.invalidate();
      utils.stacks.searchSnapshots.invalidate();
      onUpdate();
    },
  });

  const saveName = () => {
    const trimmed = editValue.trim();
    const newName = trimmed || null;
    if (newName !== (snapshot.name ?? null)) {
      updateMutation.mutate({
        id: snapshot.id,
        stackId: snapshot.stackId,
        name: newName,
      });
    }
    setIsEditing(false);
  };

  const parentLabel =
    snapshot.stackName ||
    snapshot.stackDisplayId ||
    `Stack #${snapshot.stackId}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn("rounded", isFirst && "accent-border-gradient")}
    >
      <Card>
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-cyan-dark/30 transition-colors"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 text-cyan-medium transition-transform shrink-0",
              !isExpanded && "-rotate-90",
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
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
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Enter snapshot name..."
                  className="text-sm font-medium font-mono px-2 py-0.5 "
                  maxLength={LENGTH_LIMITS.name}
                  autoFocus
                />
              ) : (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-sm font-medium font-mono cursor-pointer hover:text-magenta-light transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditValue(snapshot.name ?? "");
                          setIsEditing(true);
                        }}
                      >
                        {snapshot.name || snapshot.displayId}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Click to set name</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {snapshot.name && (
                <span className="text-xs text-cyan-medium font-mono">
                  {snapshot.displayId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-cyan-medium">
                from <span className="font-mono">{parentLabel}</span>
              </span>
              <span className="text-xs text-cyan-medium">
                {new Date(snapshot.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
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
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="p-4">
                <p className="text-sm whitespace-pre-wrap font-mono text-foreground/80">
                  {snapshot.renderedContent}
                </p>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <NotesDialog
        title="Snapshot Notes"
        placeholder="Add notes about this snapshot..."
        initialNotes={snapshot.notes}
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        onSave={(notes) => {
          updateMutation.mutate({
            id: snapshot.id,
            stackId: snapshot.stackId,
            notes,
          });
        }}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          deleteMutation.mutate({ id: snapshot.id, stackId: snapshot.stackId });
        }}
        title="Delete Snapshot"
        description="Are you sure you want to delete this snapshot? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </motion.div>
  );
}

export default function Snapshots() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const isSearchMode = debouncedSearch.length > 0;

  const {
    data: listData,
    isLoading: isListLoading,
    refetch: refetchList,
  } = api.stacks.listAllSnapshots.useQuery(
    { limit: PAGE_SIZE, offset },
    { enabled: !isSearchMode },
  );

  const {
    data: searchData,
    isLoading: isSearchLoading,
    refetch: refetchSearch,
  } = api.stacks.searchSnapshots.useQuery(
    {
      query: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: isSearchMode },
  );

  const data = isSearchMode ? searchData : listData;
  const showLoading = isSearchMode ? isSearchLoading : isListLoading;
  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const refetch = isSearchMode ? refetchSearch : refetchList;

  return (
    <main className="standard-page-container">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="camera" size={36} />
          Snapshots
        </h1>
        <p className="text-cyan-medium">
          <mark className="highlighted-text">
            Browse saved prompt snapshots
          </mark>
        </p>
      </div>

      <div className="mb-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search snapshots by name, content, or parent prompt..."
        />
      </div>

      <DotDivider className="mb-2" />

      {showLoading ? (
        <div className="text-center py-12 text-cyan-medium">
          {isSearchMode ? "Searching..." : "Loading snapshots..."}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="space-y-4">
            {data.items.map((snapshot, index) => (
              <SnapshotCard
                key={snapshot.id}
                snapshot={snapshot}
                index={index}
                isFirst={index === 0 && page === 0}
                onUpdate={() => refetch()}
              />
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-cyan-medium">
                Showing {offset + 1}&ndash;
                {Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                >
                  First
                </Button>
                <ButtonGroup>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-28"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-28"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </ButtonGroup>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage(lastPage)}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 border-standard-dark-cyan">
            <div className="text-center text-cyan-medium">
              {isSearchMode ? (
                <>
                  <p className="mb-4">
                    No snapshots found matching "{debouncedSearch}"
                  </p>
                  <Button onClick={() => setSearch("")} variant="outline">
                    Clear Search
                  </Button>
                </>
              ) : (
                <p>No snapshots yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
