import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModelInfo } from "@shared/llm/model-info";

interface ModelConfig {
  availableModels: Record<string, ModelInfo>;
  selectedModel: string;
  onModelChange: (model: string) => void;
  customModel?: string;
  onCustomModelChange?: (model: string) => void;
  onCustomModelBlur?: () => void;
}

interface ApiKeyInputProps {
  displayName: string;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  configured: boolean;
  onSave: () => void;
  onTest: () => void;
  isSaving: boolean;
  isTesting: boolean;
  testResult?: { success: boolean; message?: string } | null;
  modelConfig?: ModelConfig;
  enabled: boolean;
}

export function ApiKeyInput({
  displayName,
  apiKey,
  onApiKeyChange,
  configured,
  onSave,
  onTest,
  isSaving,
  isTesting,
  testResult,
  modelConfig,
  enabled = false,
}: ApiKeyInputProps) {
  return (
    <div
      className={cn(
        "space-y-4 border border-cyan-medium/50 rounded-lg p-4 transition-colors focus-within:opacity-100 focus-within:bg-cyan-dark",
        {
          "opacity-50": !enabled,
          "bg-cyan-dark": enabled,
        },
      )}
    >
      <div>
        <label className="text-sm font-medium mb-2 block">
          {displayName} API Key
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder={`Enter your ${displayName} API key`}
            className="flex-1 px-3 py-2 rounded-md border border-cyan-medium bg-background"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            disabled={isSaving}
          />
          <ButtonGroup className={`*:flex-1 ${configured ? "min-w-40" : ""}`}>
            <Button onClick={onSave} disabled={isSaving || !apiKey.trim()}>
              {isSaving ? "Saving..." : configured ? "Update" : "Save"}
            </Button>
            {configured && (
              <Button onClick={onTest} disabled={isTesting} variant="outline">
                {isTesting ? "Testing..." : "Test"}
              </Button>
            )}
          </ButtonGroup>
        </div>
        {configured && (
          <p className="text-sm text-cyan-medium mt-1">✓ API key configured</p>
        )}
        {testResult && (
          <p
            className={`text-sm mt-1 ${testResult.success ? "text-green-500" : "text-red-500"}`}
          >
            {testResult.success ? "✓ " : "✗ "}
            {testResult.message}
          </p>
        )}
      </div>

      {modelConfig && configured && (
        <div>
          <label className="text-sm font-medium mb-2 block">Model</label>
          <Select
            value={modelConfig.selectedModel}
            onValueChange={modelConfig.onModelChange}
            disabled={isSaving}
          >
            <SelectTrigger className="w-full mb-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(modelConfig.availableModels).map(
                ([modelId, modelInfo]) => (
                  <SelectItem key={modelId} value={modelId}>
                    {modelInfo.name}
                  </SelectItem>
                ),
              )}
              <SelectItem value="custom">Custom Model</SelectItem>
            </SelectContent>
          </Select>

          {modelConfig.selectedModel === "custom" &&
            modelConfig.onCustomModelChange && (
              <input
                type="text"
                placeholder="Enter custom model ID (e.g., gemini-pro)"
                className="w-full px-3 py-2 rounded-md border border-cyan-medium bg-background"
                value={modelConfig.customModel || ""}
                onChange={(e) =>
                  modelConfig.onCustomModelChange!(e.target.value)
                }
                onBlur={modelConfig.onCustomModelBlur}
                disabled={isSaving}
              />
            )}
        </div>
      )}
    </div>
  );
}
