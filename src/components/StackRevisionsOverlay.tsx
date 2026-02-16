import { useMemo } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

interface StackRevisionsOverlayProps {
  stackId: number;
  activeRevisionId: number | null;
  onClose: () => void;
}

export function StackRevisionsOverlay({
  stackId,
  activeRevisionId,
  onClose,
}: StackRevisionsOverlayProps) {
  const { data: blocksData } = api.blocks.list.useQuery();
  const blocks = blocksData?.items;
  const utils = api.useUtils();

  const revisionsQuery = api.stacks.getRevisions.useQuery({ stackId });

  const setActiveRevisionMutation = api.stacks.setActiveRevision.useMutation({
    onSuccess: () => {
      utils.stacks.list.invalidate();
      utils.stacks.get.invalidate();
    },
  });

  const sortedRevisions = useMemo(() => {
    if (!revisionsQuery.data) return [];

    const revisions = [...revisionsQuery.data];

    if (activeRevisionId) {
      revisions.sort((a, b) => {
        if (a.id === activeRevisionId) return -1;
        if (b.id === activeRevisionId) return 1;
        return 0;
      });
    }

    return revisions;
  }, [revisionsQuery.data, activeRevisionId]);

  const getBlockDisplayName = (blockId: number) => {
    const block = blocks?.find((b) => b.id === blockId);
    return block ? block.name || block.displayId : `Block ${blockId}`;
  };

  return (
    <motion.div
      className="absolute inset-0 bg-background z-20 rounded-lg overflow-hidden border"
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
        aria-label="Close revisions"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-4 overflow-x-auto h-full p-4 ml mr-8">
        {revisionsQuery.isLoading ? (
          <div className="flex items-center justify-center w-full">
            <p className="text-sm text-cyan-medium">Loading revisions...</p>
          </div>
        ) : sortedRevisions.length > 0 ? (
          sortedRevisions.map((revision) => {
            const isActiveRevision = revision.id === activeRevisionId;
            return (
              <div
                key={revision.id}
                className="shrink-0 w-100 h-full border rounded-md p-4 bg-cyan-dark flex flex-col cursor-pointer hover:bg-cyan-dark/80 transition-colors relative"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await setActiveRevisionMutation.mutateAsync({
                      stackId,
                      revisionId: revision.id,
                    });
                    onClose();
                  } catch (error) {
                    console.error("Failed to set active revision:", error);
                  }
                }}
              >
                {isActiveRevision && (
                  <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-md bg-magenta-dark text-foreground">
                    Active
                  </div>
                )}
                <div className="space-y-1 mb-3">
                  <p className="text-xs text-cyan-medium">
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(revision.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-cyan-medium">
                    <span className="font-medium">Updated:</span>{" "}
                    {new Date(revision.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex-1 overflow-auto">
                  <p className="text-xs font-medium mb-2">
                    Blocks ({revision.blockIds.length}):
                  </p>
                  {revision.blockIds.length > 0 ? (
                    <ol className="space-y-1 text-sm list-decimal list-inside">
                      {revision.blockIds.map((blockId: number) => (
                        <li key={blockId} className="text-foreground">
                          {getBlockDisplayName(blockId)}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-cyan-medium italic">No blocks</p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center w-full">
            <p className="text-sm text-cyan-medium">No revisions found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
