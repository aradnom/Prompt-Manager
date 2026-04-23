import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { api, RouterOutput } from "@/lib/api";
import { generateDisplayId } from "@/lib/generate-display-id";
import { generateUUID } from "@/lib/uuid";
import { useActiveStack } from "@/contexts/ActiveStackContext";
import { useSync } from "@/contexts/SyncContext";
import { RasterIcon } from "@/components/RasterIcon";
import { TemplateEditor } from "@/components/TemplateEditor";
import { SearchInput } from "@/components/ui/search-input";
import { DotDivider } from "@/components/ui/dot-divider";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  StickyNote,
  ArrowLeft,
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

type Template = RouterOutput["stackTemplates"]["list"]["items"][number];

const PAGE_SIZE = 20;

interface TemplateCardProps {
  template: Template;
  index: number;
  isFirst: boolean;
  onUpdate: () => void;
}

function TemplateCard({
  template,
  index,
  isFirst,
  onUpdate,
}: TemplateCardProps) {
  const navigate = useNavigate();
  const { setActiveStack } = useActiveStack();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(template.name ?? "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const utils = api.useUtils();

  const updateMutation = api.stackTemplates.update.useMutation({
    onSuccess: () => {
      utils.stackTemplates.list.invalidate();
      utils.stackTemplates.search.invalidate();
      onUpdate();
    },
  });

  const deleteMutation = api.stackTemplates.delete.useMutation({
    onSuccess: () => {
      utils.stackTemplates.list.invalidate();
      utils.stackTemplates.search.invalidate();
      onUpdate();
    },
  });

  const { notifyUpsert } = useSync();
  const createStackMutation = api.stacks.create.useMutation({
    onSuccess: (newStack) => {
      notifyUpsert("stacks", newStack as unknown as { id: number });
      utils.stacks.list.invalidate();
      setActiveStack(newStack);
      navigate("/");
    },
  });

  const handleUseTemplate = () => {
    const name = template.name?.replace(/ Template$/, "") || undefined;
    createStackMutation.mutate({
      uuid: generateUUID(),
      displayId: generateDisplayId(),
      name,
      commaSeparated: template.commaSeparated,
      negative: template.negative,
      style: template.style,
      blockIds: template.blockIds,
    });
  };

  const saveName = () => {
    const trimmed = editValue.trim();
    const newName = trimmed || null;
    if (newName !== (template.name ?? null)) {
      updateMutation.mutate({ id: template.id, name: newName });
    }
    setIsEditing(false);
  };

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
          onClick={() => navigate(`/templates/${template.id}`)}
        >
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
                      setEditValue(template.name ?? "");
                      setIsEditing(false);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Enter template name..."
                  className="text-sm font-medium font-mono px-2 py-0.5 border-inline-input"
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
                          setEditValue(template.name ?? "");
                          setIsEditing(true);
                        }}
                      >
                        {template.name || template.displayId}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Click to set name</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {template.name && (
                <span className="text-xs text-cyan-medium font-mono">
                  {template.displayId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-cyan-medium">
                {template.blockIds.length} block
                {template.blockIds.length !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-cyan-medium">
                {new Date(template.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/templates/${template.id}`)}
              className="cursor-pointer"
            >
              Edit Template
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleUseTemplate}
              disabled={createStackMutation.isPending}
              className="cursor-pointer"
            >
              {createStackMutation.isPending ? "Creating..." : "Use Template"}
            </Button>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setNotesDialogOpen(true)}
                    className={`text-cyan-medium hover:text-foreground transition-colors cursor-pointer ${template.notes ? "text-foreground" : ""}`}
                    aria-label="Edit notes"
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {template.notes ? "Edit notes" : "Add notes"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="text-cyan-medium hover:text-destructive transition-colors cursor-pointer"
              aria-label="Delete template"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      <NotesDialog
        title="Template Notes"
        placeholder="Add notes about this template..."
        initialNotes={template.notes}
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        onSave={(notes) => {
          updateMutation.mutate({ id: template.id, notes });
        }}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          deleteMutation.mutate({ id: template.id });
        }}
        title="Delete Template"
        description="Are you sure you want to delete this template? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </motion.div>
  );
}

function SingleTemplateView({ templateId }: { templateId: number }) {
  const navigate = useNavigate();
  const utils = api.useUtils();

  const {
    data: template,
    isLoading,
    refetch,
  } = api.stackTemplates.get.useQuery({ id: templateId });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);

  const updateMutation = api.stackTemplates.update.useMutation({
    onSuccess: () => {
      utils.stackTemplates.list.invalidate();
      utils.stackTemplates.get.invalidate();
      refetch();
    },
  });

  const deleteMutation = api.stackTemplates.delete.useMutation({
    onSuccess: () => {
      utils.stackTemplates.list.invalidate();
      navigate("/templates");
    },
  });

  if (isLoading) {
    return (
      <main className="standard-page-container">
        <div className="text-center py-12 text-cyan-medium">
          Loading template...
        </div>
      </main>
    );
  }

  if (!template) {
    return (
      <main className="standard-page-container">
        <div className="text-center py-12 text-cyan-medium">
          <p className="mb-4">Template not found</p>
          <Link to="/templates">
            <Button variant="outline">Back to Templates</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="standard-page-container">
      <div className="mb-8">
        <Link
          to="/templates"
          className="inline-flex items-center gap-1.5 text-sm text-cyan-medium hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <RasterIcon name="templates" size={36} />
            {template.name || template.displayId}
          </h1>
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setNotesDialogOpen(true)}
                    className={`text-cyan-medium hover:text-foreground transition-colors cursor-pointer ${template.notes ? "text-foreground" : ""}`}
                    aria-label="Edit notes"
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {template.notes ? "Edit notes" : "Add notes"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="text-cyan-medium hover:text-destructive transition-colors cursor-pointer"
              aria-label="Delete template"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {template.name && (
          <p className="text-cyan-medium font-mono text-sm mt-2 bg-background/60 inline-block px-2 py-1">
            {template.displayId}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <TemplateEditor template={template} onUpdate={() => refetch()} />
        </CardContent>
      </Card>

      <NotesDialog
        title="Template Notes"
        placeholder="Add notes about this template..."
        initialNotes={template.notes}
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        onSave={(notes) => {
          updateMutation.mutate({ id: template.id, notes });
        }}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          deleteMutation.mutate({ id: template.id });
        }}
        title="Delete Template"
        description="Are you sure you want to delete this template? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </main>
  );
}

function TemplateList() {
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
  } = api.stackTemplates.list.useQuery(
    { limit: PAGE_SIZE, offset },
    { enabled: !isSearchMode },
  );

  const {
    data: searchData,
    isLoading: isSearchLoading,
    refetch: refetchSearch,
  } = api.stackTemplates.search.useQuery(
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
          <RasterIcon name="templates" size={36} />
          Templates
        </h1>
        <p className="text-cyan-medium">
          <mark className="highlighted-text">
            Reusable prompt starting points
          </mark>
        </p>
      </div>

      <div className="mb-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search templates by name or notes..."
        />
      </div>

      <DotDivider className="mb-2" />

      {showLoading ? (
        <div className="text-center py-12 text-cyan-medium">
          {isSearchMode ? "Searching..." : "Loading templates..."}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="space-y-4">
            {data.items.map((template, index) => (
              <TemplateCard
                key={template.id}
                template={template}
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
          <CardContent className="py-12">
            <div className="text-center text-cyan-medium">
              {isSearchMode ? (
                <>
                  <p className="mb-4">
                    No templates found matching "{debouncedSearch}"
                  </p>
                  <Button onClick={() => setSearch("")} variant="outline">
                    Clear Search
                  </Button>
                </>
              ) : (
                <p>No templates yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

export default function Templates() {
  const { id } = useParams<{ id: string }>();

  if (id) {
    const templateId = parseInt(id, 10);
    if (!isNaN(templateId)) {
      return <SingleTemplateView templateId={templateId} />;
    }
  }

  return <TemplateList />;
}
