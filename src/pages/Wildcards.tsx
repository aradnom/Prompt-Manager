import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import yaml from "js-yaml";
import { Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { generateUUID } from "@/lib/uuid";
import { cn } from "@/lib/utils";
import { generateDisplayId } from "@/lib/generate-display-id";
import { useErrors } from "@/contexts/ErrorContext";
import { validateWildcardContent } from "@/lib/wildcard-validation";
import { useTransform } from "@/hooks/useTransform";
import { RasterIcon } from "@/components/RasterIcon";
import { Button } from "@/components/ui/button";
import { DisplayIdInput } from "@/components/ui/display-id-input";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WildcardContentEditor } from "@/components/WildcardContentEditor";

interface WildcardFormValues {
  displayId: string;
  name: string;
  format: string;
  content: string;
}

interface WildcardFormProps {
  mode: "create" | "edit";
  initialValues?: WildcardFormValues;
  onSubmit: (values: WildcardFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isSubmitting: boolean;
}

function WildcardForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting,
}: WildcardFormProps) {
  const { addError } = useErrors();
  const [displayId, setDisplayId] = useState(
    initialValues?.displayId || generateDisplayId(),
  );
  const [name, setName] = useState(initialValues?.name || "");
  const [format, setFormat] = useState(initialValues?.format || "json");
  const [content, setContent] = useState(initialValues?.content || "");

  const validateContent = (): boolean => {
    // First run global validation
    const globalValidation = validateWildcardContent(content);
    if (!globalValidation.valid) {
      addError(globalValidation.error!);
      return false;
    }

    // Then run format-specific validation
    try {
      switch (format) {
        case "json":
          JSON.parse(content);
          break;
        case "yaml":
          yaml.load(content);
          break;
        // 'lines' and 'text' don't need format-specific validation
      }
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addError(`Invalid ${format.toUpperCase()}: ${errorMessage}`);
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateContent()) {
      return;
    }

    onSubmit({ displayId, name, format, content });
  };

  return (
    <Card className="bg-cyan-dark">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle>
            {mode === "create" ? "Create Wildcard" : "Edit Wildcard"}
          </CardTitle>
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
              aria-label="Delete wildcard"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Wildcard"
              className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
              required
              disabled={isSubmitting}
            />
          </div>
          {mode === "create" && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Display ID
              </label>
              <div className="flex gap-2">
                <DisplayIdInput
                  value={displayId}
                  onChange={setDisplayId}
                  placeholder="unique-id"
                  className="flex-1"
                  required
                  disabled={isSubmitting}
                />
                <Button
                  variant="outline"
                  onClick={() => setDisplayId(generateDisplayId())}
                  type="button"
                  disabled={isSubmitting}
                >
                  Regenerate
                </Button>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-2 block">Format</label>
            <Select
              value={format}
              onValueChange={setFormat}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="yaml">YAML</SelectItem>
                <SelectItem value="lines">Lines</SelectItem>
                <SelectItem value="text">Plain Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Content</label>
            <WildcardContentEditor
              value={content}
              onChange={setContent}
              format={format}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                  ? "Create"
                  : "Update"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Wildcards() {
  const { addError } = useErrors();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wildcardToDelete, setWildcardToDelete] = useState<number | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateConcept, setGenerateConcept] = useState("");
  const [generatedName, setGeneratedName] = useState("");
  const [generatedDisplayId, setGeneratedDisplayId] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: wildcards, isLoading, refetch } = api.wildcards.list.useQuery();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch search results when there's a search query
  const { data: searchResults, isLoading: isSearching } =
    api.wildcards.search.useQuery(
      {
        query: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      },
      { enabled: debouncedSearch.length > 0 },
    );

  // Use search results if searching, otherwise use all wildcards
  const displayWildcards =
    debouncedSearch.length > 0 ? searchResults : wildcards;
  const showLoading = debouncedSearch.length > 0 ? isSearching : isLoading;

  const createMutation = api.wildcards.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreating(false);
    },
    onError: (error) => {
      addError(`Failed to create wildcard: ${error.message}`);
    },
  });

  const updateMutation = api.wildcards.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
    },
    onError: (error) => {
      addError(`Failed to update wildcard: ${error.message}`);
    },
  });

  const deleteMutation = api.wildcards.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      addError(`Failed to delete wildcard: ${error.message}`);
    },
  });

  const generateWildcardMutation = useTransform();
  const autoLabelMutation = useTransform();

  const handleGenerateSubmit = async () => {
    if (!generateConcept.trim()) return;

    try {
      // Fire both requests in parallel
      const [wildcardResult, labelResult] = await Promise.all([
        generateWildcardMutation.mutateAsync({
          text: generateConcept,
          operation: "generate-wildcard",
        }),
        autoLabelMutation.mutateAsync({
          text: generateConcept,
          operation: "auto-label",
        }),
      ]);

      // Parse the label result
      let labelTitle = "Generated Wildcard";
      let labelCode = generateDisplayId();

      if (typeof labelResult.result === "string") {
        try {
          const parsed = JSON.parse(labelResult.result);
          if (parsed.title) labelTitle = parsed.title;
          if (parsed.code) labelCode = parsed.code;
        } catch {
          // If parsing fails, use the result as-is for title
          labelTitle = labelResult.result;
        }
      }

      // Format as YAML with the code-friendly key name
      if (Array.isArray(wildcardResult.result)) {
        const yamlContent = yaml.dump({ [labelCode]: wildcardResult.result });
        setGeneratedContent(yamlContent);
      }

      // Set the name and display ID
      setGeneratedName(labelTitle);
      setGeneratedDisplayId(labelCode);

      // Show the form
      setShowGenerateForm(true);
    } catch (error) {
      console.error("Generate failed:", error);
      addError("Failed to generate wildcard");
    }
  };

  const handleGenerateCreate = (values: WildcardFormValues) => {
    createMutation.mutate({
      uuid: generateUUID(),
      displayId: values.displayId,
      name: values.name,
      format: values.format,
      content: values.content,
    });
    // Reset generate state
    setIsGenerateOpen(false);
    setGenerateConcept("");
    setGeneratedName("");
    setGeneratedDisplayId("");
    setGeneratedContent("");
    setShowGenerateForm(false);
  };

  const handleCreate = (values: WildcardFormValues) => {
    createMutation.mutate({
      uuid: generateUUID(),
      displayId: values.displayId,
      name: values.name,
      format: values.format,
      content: values.content,
    });
  };

  const handleUpdate = (id: number, values: WildcardFormValues) => {
    updateMutation.mutate({
      id,
      name: values.name,
      format: values.format,
      content: values.content,
    });
  };

  const handleDelete = (id: number) => {
    setWildcardToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (wildcardToDelete !== null) {
      deleteMutation.mutate({ id: wildcardToDelete });
      setWildcardToDelete(null);
    }
  };

  return (
    <main className="standard-page-container">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="dice" size={36} />
          Wildcards
        </h1>
        <p className="text-cyan-medium">
          <mark className="highlighted-text">
            Manage your wildcard templates
          </mark>
        </p>
      </div>

      {isCreating ? (
        <div className="mb-8">
          <WildcardForm
            mode="create"
            onSubmit={handleCreate}
            onCancel={() => setIsCreating(false)}
            isSubmitting={createMutation.isPending}
          />
        </div>
      ) : (
        <div className="mb-8 flex gap-2 justify-end">
          <Button onClick={() => setIsCreating(true)}>
            Create New Wildcard
          </Button>
          <Button onClick={() => setIsGenerateOpen(true)} variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate New Wildcard
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="mb-8">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search wildcards by name, display ID, UUID, or content..."
        />
      </div>

      {showLoading ? (
        <div className="text-center py-12 text-cyan-medium">
          {debouncedSearch.length > 0 ? "Searching..." : "Loading wildcards..."}
        </div>
      ) : displayWildcards && displayWildcards.length > 0 ? (
        <div className="space-y-4">
          {displayWildcards.map((wildcard, index) => (
            <motion.div
              key={wildcard.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={cn(
                "relative border-standard-dark-cyan",
                index === 0 && "accent-border-gradient",
              )}
            >
              {editingId === wildcard.id ? (
                <WildcardForm
                  mode="edit"
                  initialValues={{
                    displayId: wildcard.displayId,
                    name: wildcard.name,
                    format: wildcard.format,
                    content: wildcard.content,
                  }}
                  onSubmit={(values) => handleUpdate(wildcard.id, values)}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => handleDelete(wildcard.id)}
                  isSubmitting={updateMutation.isPending}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <div
                      className="flex items-start justify-between cursor-pointer"
                      onClick={(e) => {
                        if (!(e.target as HTMLElement).closest("button")) {
                          setEditingId(wildcard.id);
                        }
                      }}
                    >
                      <div>
                        <CardTitle className="text-xl">
                          {wildcard.name}
                        </CardTitle>
                        <div className="flex gap-2 mt-2 text-sm text-cyan-medium">
                          <span className="font-mono">
                            {wildcard.displayId}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{wildcard.format}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(wildcard.id)}
                        >
                          Edit Wildcard
                        </Button>
                        <button
                          onClick={() => handleDelete(wildcard.id)}
                          disabled={deleteMutation.isPending}
                          className="text-cyan-medium hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                          aria-label="Delete wildcard"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-cyan-dark p-4 rounded-md text-sm font-mono overflow-x-auto whitespace-pre-wrap wrap-break-word">
                      {wildcard.content}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          ))}
        </div>
      ) : debouncedSearch.length > 0 ? (
        <Card>
          <CardContent className="py-12 border-standard-dark-cyan">
            <div className="text-center text-cyan-medium">
              <p className="mb-4">
                No wildcards found matching "{debouncedSearch}"
              </p>
              <Button onClick={() => setSearch("")} variant="outline">
                Clear Search
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-cyan-medium">
              <p className="mb-4">No wildcards yet</p>
              <Button onClick={() => setIsCreating(true)}>
                Create Your First Wildcard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent className="max-w-[calc(100vw-4rem)] max-h-[calc(100vh-4rem)] h-full w-full flex flex-col">
          <DialogHeader>
            <DialogTitle>Generate New Wildcard</DialogTitle>
            <DialogDescription>
              {!showGenerateForm
                ? "Enter a concept or category to generate wildcard values"
                : "Review and customize your generated wildcard"}
            </DialogDescription>
          </DialogHeader>

          {!showGenerateForm ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-md space-y-4">
                <input
                  type="text"
                  value={generateConcept}
                  onChange={(e) =>
                    setGenerateConcept(e.target.value.slice(0, 140))
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !generateWildcardMutation.isPending &&
                      !autoLabelMutation.isPending
                    ) {
                      handleGenerateSubmit();
                    }
                  }}
                  placeholder="Enter a category (e.g., 'emotions', 'fantasy locations')"
                  className="w-full px-4 py-2 border border-cyan-medium rounded-md focus:outline-none focus:ring-2 focus:ring-magenta-medium bg-background"
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
                      !generateConcept.trim() ||
                      generateWildcardMutation.isPending ||
                      autoLabelMutation.isPending
                    }
                  >
                    {generateWildcardMutation.isPending ||
                    autoLabelMutation.isPending
                      ? "Generating..."
                      : "Generate"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 overflow-y-auto p-6 space-y-6"
              >
                {/* Input moved to top */}
                <div className="border-b pb-4">
                  <label className="text-sm font-medium mb-2 block">
                    Concept
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={generateConcept}
                      onChange={(e) =>
                        setGenerateConcept(e.target.value.slice(0, 140))
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !generateWildcardMutation.isPending &&
                          !autoLabelMutation.isPending
                        ) {
                          handleGenerateSubmit();
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-md border border-cyan-medium bg-background"
                      maxLength={140}
                    />
                    <Button
                      onClick={handleGenerateSubmit}
                      disabled={
                        !generateConcept.trim() ||
                        generateWildcardMutation.isPending ||
                        autoLabelMutation.isPending
                      }
                      variant="outline"
                    >
                      {generateWildcardMutation.isPending ||
                      autoLabelMutation.isPending
                        ? "Generating..."
                        : "Regenerate"}
                    </Button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Name</label>
                  <input
                    type="text"
                    value={generatedName}
                    onChange={(e) => setGeneratedName(e.target.value)}
                    placeholder="My Wildcard"
                    className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
                  />
                </div>

                {/* Display ID */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Display ID
                  </label>
                  <div className="flex gap-2">
                    <DisplayIdInput
                      value={generatedDisplayId}
                      onChange={setGeneratedDisplayId}
                      placeholder="unique-id"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setGeneratedDisplayId(generateDisplayId())}
                      type="button"
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Content (YAML)
                  </label>
                  <WildcardContentEditor
                    value={generatedContent}
                    onChange={setGeneratedContent}
                    format="yaml"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t pt-4">
                  <Button
                    onClick={() =>
                      handleGenerateCreate({
                        displayId: generatedDisplayId,
                        name: generatedName,
                        format: "yaml",
                        content: generatedContent,
                      })
                    }
                    disabled={
                      !generatedDisplayId.trim() ||
                      !generatedName.trim() ||
                      !generatedContent.trim() ||
                      createMutation.isPending
                    }
                  >
                    {createMutation.isPending
                      ? "Creating..."
                      : "Create Wildcard"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsGenerateOpen(false);
                      setGenerateConcept("");
                      setGeneratedName("");
                      setGeneratedDisplayId("");
                      setGeneratedContent("");
                      setShowGenerateForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Wildcard"
        description="Are you sure you want to delete this wildcard? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </main>
  );
}
