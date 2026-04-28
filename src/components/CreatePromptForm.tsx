import { useState } from "react";
import {
  generateDisplayId,
  normalizeDisplayIdWithSuffix,
} from "@/lib/generate-display-id";
import { generateUUID } from "@/lib/uuid";
import { api, RouterOutput } from "@/lib/api";
import { useSync } from "@/contexts/SyncContext";
import { LENGTH_LIMITS } from "@shared/limits";
import { Button } from "@/components/ui/button";
import { DisplayIdInput } from "@/components/ui/display-id-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Stack = RouterOutput["stacks"]["create"];

interface CreatePromptFormProps {
  onCreated: (stack: Stack) => void;
  onCancel: () => void;
}

export function CreatePromptForm({
  onCreated,
  onCancel,
}: CreatePromptFormProps) {
  const [name, setName] = useState("");
  const [displayId, setDisplayId] = useState(generateDisplayId());

  const { notifyUpsert } = useSync();
  const createMutation = api.stacks.create.useMutation({
    onSuccess: (newStack) => {
      notifyUpsert("stacks", newStack as unknown as { id: number });
      onCreated(newStack);
    },
  });

  const handleCreate = () => {
    if (!displayId.trim()) return;

    createMutation.mutate({
      uuid: generateUUID(),
      displayId: displayId.trim(),
      name: name.trim() || undefined,
    });
  };

  const handleCancel = () => {
    setName("");
    setDisplayId("");
    onCancel();
  };

  return (
    <Card className="bg-cyan-dark">
      <CardHeader>
        <CardTitle>Create New Prompt</CardTitle>
        <CardDescription>
          Enter a memorable ID for your new prompt
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Name (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Summer Landscape"
              className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
              value={name}
              maxLength={LENGTH_LIMITS.name}
              onChange={(e) => {
                setName(e.target.value);
                setDisplayId(normalizeDisplayIdWithSuffix(e.target.value));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") handleCancel();
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Display ID</label>
            <div className="flex gap-2">
              <DisplayIdInput
                placeholder="e.g., summer-landscape-v1"
                className="flex-1"
                maxLength={LENGTH_LIMITS.displayId}
                value={displayId}
                onChange={setDisplayId}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <Button
                variant="outline"
                onClick={() => setDisplayId(generateDisplayId())}
                type="button"
              >
                Regenerate
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
