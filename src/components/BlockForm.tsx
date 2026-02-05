import { useState, useRef, useEffect } from "react";
import {
  generateDisplayId,
  normalizeDisplayId,
} from "@/lib/generate-display-id";
import { useTypes } from "@/contexts/TypesContext";
import { insertWildcard } from "@/lib/wildcard-parser";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayIdInput } from "@/components/ui/display-id-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WildcardBrowser } from "@/components/WildcardBrowser";

export interface BlockFormValues {
  name?: string;
  displayId: string;
  text: string;
  labels: string[];
  typeId?: number | null;
}

interface BlockFormProps {
  initialValues?: Partial<BlockFormValues>;
  onSubmit: (values: BlockFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
}

export function BlockForm({
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false,
  mode = "create",
}: BlockFormProps) {
  const { types } = useTypes();
  const [name, setName] = useState(initialValues?.name || "");
  const [displayId, setDisplayId] = useState(
    initialValues?.displayId || generateDisplayId(),
  );
  const [text, setText] = useState(initialValues?.text || "");
  const [labels, setLabels] = useState(initialValues?.labels?.join(", ") || "");
  const [typeId, setTypeId] = useState<number | undefined>(
    initialValues?.typeId ?? undefined,
  );
  const [wildcardBrowserOpen, setWildcardBrowserOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasPendingSave = useRef(false);

  // Keep a ref to the latest form values for autosave
  const formValuesRef = useRef({
    name,
    displayId,
    text,
    labels,
    typeId,
  });
  formValuesRef.current = {
    name,
    displayId,
    text,
    labels,
    typeId,
  };

  const getFormValues = (): BlockFormValues | null => {
    const vals = formValuesRef.current;
    if (!vals.displayId.trim() || !vals.text.trim()) return null;

    return {
      name: vals.name.trim() || undefined,
      displayId: vals.displayId.trim(),
      text: vals.text.trim(),
      labels: vals.labels.trim()
        ? vals.labels.split(",").map((l) => l.trim())
        : [],
      typeId: vals.typeId ?? null,
    };
  };

  const handleSubmit = () => {
    const values = getFormValues();
    if (!values) return;
    hasPendingSave.current = false;
    onSubmit(values);
  };

  const debouncedSave = () => {
    if (mode !== "edit") return;

    hasPendingSave.current = true;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSubmit();
    }, 500);
  };

  // Save pending changes on unmount (edit mode only)
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (mode === "edit" && hasPendingSave.current) {
        const values = getFormValues();
        if (values) {
          onSubmit(values);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWildcardSelect = (wildcardDisplayId: string, path?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart || text.length;
    const result = insertWildcard(
      text,
      cursorPosition,
      wildcardDisplayId,
      path,
    );

    setText(result.text);
    debouncedSave();

    // Set cursor position after the inserted wildcard
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        result.newCursorPosition,
        result.newCursorPosition,
      );
    }, 0);
  };

  const handleTypeChange = (value: string) => {
    setTypeId(value === "none" ? undefined : Number(value));
    debouncedSave();
  };

  return (
    <Card className="bg-cyan-dark">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>
              {mode === "create" ? "Create New Block" : "Edit Block"}
            </CardTitle>
            <CardDescription>
              {mode === "create"
                ? "Enter details for your new text block"
                : "Update block details"}
            </CardDescription>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
              aria-label="Delete block"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Name (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Mountain Landscape"
              className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (mode === "create") {
                  setDisplayId(normalizeDisplayId(e.target.value));
                } else {
                  debouncedSave();
                }
              }}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Display ID</label>
            <div className="flex gap-2">
              <DisplayIdInput
                placeholder="e.g., mountain-scene-v1"
                className="flex-1"
                value={displayId}
                onChange={(value) => {
                  setDisplayId(value);
                  debouncedSave();
                }}
                disabled={isSubmitting}
              />
              <Button
                variant="outline"
                onClick={() => {
                  setDisplayId(generateDisplayId());
                  debouncedSave();
                }}
                type="button"
                disabled={isSubmitting}
              >
                Regenerate
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Type</label>
            <Select
              value={typeId?.toString() || "none"}
              onValueChange={handleTypeChange}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Text</label>
            <textarea
              ref={textareaRef}
              placeholder="Enter your prompt text..."
              className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background min-h-30"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                debouncedSave();
              }}
              disabled={isSubmitting}
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setWildcardBrowserOpen(true)}
              disabled={isSubmitting}
            >
              Insert Wildcard
            </Button>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Labels (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g., scene, landscape, outdoor"
              className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
              value={labels}
              onChange={(e) => {
                setLabels(e.target.value);
                debouncedSave();
              }}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex gap-4">
            {mode === "create" && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !displayId.trim() || !text.trim()}
              >
                {isSubmitting ? "Creating..." : "Create"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {mode === "create" ? "Cancel" : "Done"}
            </Button>
          </div>
        </div>
      </CardContent>

      <WildcardBrowser
        open={wildcardBrowserOpen}
        onOpenChange={setWildcardBrowserOpen}
        onSelect={handleWildcardSelect}
      />
    </Card>
  );
}
