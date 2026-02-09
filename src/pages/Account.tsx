import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Copy, Check, KeyRound, AlertTriangle, Info } from "lucide-react";
import { RasterIcon } from "@/components/RasterIcon";
import { CreateAccountOrLogin } from "@/components/CreateAccountOrLogin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSession } from "@/contexts/SessionContext";
import { useLLMStatus, type LLMTarget } from "@/contexts/LLMStatusContext";
import { MODELS } from "@shared/llm/model-info";
import { ApiKeyInput } from "@/components/ApiKeyInput";
import { LMStudioInput } from "@/components/LMStudioInput";
import { CollapsibleSection } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { storage } from "@/lib/storage";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-cyan-medium hover:text-foreground transition-colors cursor-pointer"
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
    </button>
  );
}

export default function Account() {
  const {
    isAuthenticated,
    isLoading: sessionLoading,
    checkSession,
    setAuthenticated,
  } = useSession();
  const { activeTarget, setActiveTarget, availableTargets, getTargetInfo } =
    useLLMStatus();
  const [accountData, setAccountData] = useState<Record<string, string> | null>(
    null,
  );
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInfo, setApiKeyInfo] = useState<
    Record<string, { configured: boolean; model?: string }>
  >({});
  const [hasIntegrationApiKey, setHasIntegrationApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [isGeneratingApiKey, setIsGeneratingApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    message?: string;
  } | null>(null);
  const [vertexApiKey, setVertexApiKey] = useState("");
  const [vertexModel, setVertexModel] = useState(Object.keys(MODELS.vertex)[0]);
  const [customModel, setCustomModel] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState(Object.keys(MODELS.openai)[0]);
  const [openaiCustomModel, setOpenaiCustomModel] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState(
    Object.keys(MODELS.anthropic)[0],
  );
  const [anthropicCustomModel, setAnthropicCustomModel] = useState("");
  const [grokApiKey, setGrokApiKey] = useState("");
  const [grokModel, setGrokModel] = useState(Object.keys(MODELS.grok)[0]);
  const [grokCustomModel, setGrokCustomModel] = useState("");
  const [activeLLMPlatform, setActiveLLMPlatform] = useState<string>("");
  const [thinkingEnabled, setThinkingEnabled] = useState(() => {
    const saved = localStorage.getItem("thinking-enabled");
    return saved === "true";
  });
  const [thinkingLevel, setThinkingLevel] = useState<"low" | "medium" | "high">(
    () => {
      const saved = localStorage.getItem("thinking-level");
      return (saved as "low" | "medium" | "high") || "low";
    },
  );

  useEffect(() => {
    if (isAuthenticated && !accountData) {
      fetchAccountData();
    }
  }, [isAuthenticated, accountData]);

  useEffect(() => {
    localStorage.setItem("thinking-enabled", String(thinkingEnabled));
  }, [thinkingEnabled]);

  useEffect(() => {
    localStorage.setItem("thinking-level", thinkingLevel);
  }, [thinkingLevel]);

  const fetchAccountData = async (silent = false) => {
    if (!silent) setIsLoadingAccount(true);
    try {
      const response = await fetch("/api/auth/account", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch account data");
      }

      const data = await response.json();
      setAccountData(data.accountData);
      setApiKeyInfo(data.apiKeys || {});
      setActiveLLMPlatform(data.accountData?.activeLLMPlatform || "");
      setHasIntegrationApiKey(data.hasIntegrationApiKey ?? false);

      // Pre-populate the model dropdown if a model is configured
      if (data.apiKeys?.vertex?.model) {
        const savedModel = data.apiKeys.vertex.model;
        // Check if it's one of our predefined models
        if (savedModel in MODELS.vertex) {
          setVertexModel(savedModel);
        } else {
          // It's a custom model
          setVertexModel("custom");
          setCustomModel(savedModel);
        }
      }

      if (data.apiKeys?.openai?.model) {
        const savedModel = data.apiKeys.openai.model;
        // Check if it's one of our predefined models
        if (savedModel in MODELS.openai) {
          setOpenaiModel(savedModel);
        } else {
          // It's a custom model
          setOpenaiModel("custom");
          setOpenaiCustomModel(savedModel);
        }
      }

      if (data.apiKeys?.anthropic?.model) {
        const savedModel = data.apiKeys.anthropic.model;
        // Check if it's one of our predefined models
        if (savedModel in MODELS.anthropic) {
          setAnthropicModel(savedModel);
        } else {
          // It's a custom model
          setAnthropicModel("custom");
          setAnthropicCustomModel(savedModel);
        }
      }

      if (data.apiKeys?.grok?.model) {
        const savedModel = data.apiKeys.grok.model;
        // Check if it's one of our predefined models
        if (savedModel in MODELS.grok) {
          setGrokModel(savedModel);
        } else {
          // It's a custom model
          setGrokModel("custom");
          setGrokCustomModel(savedModel);
        }
      }
    } catch (err) {
      console.error("Error fetching account data:", err);
      setError("Failed to load account data");
    } finally {
      if (!silent) setIsLoadingAccount(false);
    }
  };

  const handleSaveApiKey = async (
    provider: string,
    apiKey: string,
    model?: string,
  ) => {
    setIsSavingApiKey(true);
    try {
      const response = await fetch("/api/auth/api-keys", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, apiKey, model }),
      });

      if (!response.ok) {
        throw new Error("Failed to save API key");
      }

      // Refresh account data to get updated flags (silent to avoid scroll jump)
      await fetchAccountData(true);
      // Clear the input fields after successful save
      if (provider === "vertex") {
        setVertexApiKey("");
        setCustomModel("");
      } else if (provider === "openai") {
        setOpenaiApiKey("");
        setOpenaiCustomModel("");
      } else if (provider === "anthropic") {
        setAnthropicApiKey("");
        setAnthropicCustomModel("");
      } else if (provider === "grok") {
        setGrokApiKey("");
        setGrokCustomModel("");
      }
    } catch (err) {
      console.error("Error saving API key:", err);
      setError("Failed to save API key");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleSaveModel = async (provider: string, model: string) => {
    setIsSavingApiKey(true);
    try {
      const response = await fetch("/api/auth/api-keys", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, model }),
      });

      if (!response.ok) {
        throw new Error("Failed to save model");
      }

      // Update apiKeyInfo locally to reflect the saved model
      setApiKeyInfo((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          model,
        },
      }));

      if (provider === "vertex") {
        setCustomModel("");
      } else if (provider === "openai") {
        setOpenaiCustomModel("");
      } else if (provider === "anthropic") {
        setAnthropicCustomModel("");
      } else if (provider === "grok") {
        setGrokCustomModel("");
      }
    } catch (err) {
      console.error("Error saving model:", err);
      setError("Failed to save model");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleTestApiKey = async (provider: string) => {
    setIsTestingApiKey(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/auth/api-keys/test", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({ provider, success: true, message: data.message });
      } else {
        setTestResult({
          provider,
          success: false,
          message: data.message || data.error,
        });
      }
    } catch (err) {
      console.error("Error testing API key:", err);
      setTestResult({
        provider,
        success: false,
        message: "Failed to test API key",
      });
    } finally {
      setIsTestingApiKey(false);
    }
  };

  const handleSetActivePlatform = async (platform: string) => {
    try {
      const response = await fetch("/api/auth/active-platform", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platform }),
      });

      if (!response.ok) {
        throw new Error("Failed to set active platform");
      }

      setActiveLLMPlatform(platform);
      setActiveTarget(platform as LLMTarget);
    } catch (err) {
      console.error("Error setting active platform:", err);
      setError("Failed to set active platform");
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        setAuthenticated(false);
        setAccountData(null);
        storage.clearActiveStackId();
        await checkSession();
      }
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const handleGenerateIntegrationKey = async () => {
    setIsGeneratingApiKey(true);
    try {
      const response = await fetch("/api/auth/integration-api-key", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to generate API key");
      }

      const data = await response.json();
      setNewApiKey(data.apiKey);
      setHasIntegrationApiKey(true);
    } catch (err) {
      console.error("Error generating integration API key:", err);
      setError("Failed to generate API key");
    } finally {
      setIsGeneratingApiKey(false);
    }
  };

  const handleRevokeIntegrationKey = async () => {
    if (
      !confirm(
        "Are you sure you want to revoke your integration API key? Any integrations using it will stop working.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/auth/integration-api-key", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke API key");
      }

      setHasIntegrationApiKey(false);
      setNewApiKey(null);
    } catch (err) {
      console.error("Error revoking integration API key:", err);
      setError("Failed to revoke API key");
    }
  };

  const isLoading = sessionLoading || isLoadingAccount;

  return (
    <main className="standard-page-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="user" size={36} />
          Account
        </h1>
        <p className="text-cyan-medium mb-8">
          <mark className="highlighted-text">Manage your account settings</mark>
        </p>
      </motion.div>

      <div className="mt-12">
        {isLoading ? (
          <p className="text-cyan-medium">Loading...</p>
        ) : isAuthenticated && accountData ? (
          <div className="space-y-6">
            <Card className="accent-border-gradient">
              <CardHeader>
                <CardTitle>Your Account ID</CardTitle>
                <CardDescription>
                  This is your unique Account ID. Jot it down in permanent ink
                  somewhere because if you lose it, it cannot be found again.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 font-mono text-2xl font-bold tracking-wider p-4 bg-cyan-dark/20 rounded-lg border-2 border-cyan-dark">
                  <span className="flex-1">{accountData.token}</span>
                  <CopyButton text={accountData.token} />
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={handleLogout} variant="outline">
                    Log Out
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  ComfyUI API Key
                </CardTitle>
                <CardDescription>
                  Generate an API key for external integrations like ComfyUI.
                  This key allows external tools to access your prompts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {newApiKey ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                      <p className="text-sm text-yellow-500">
                        Save this key now — you won't be able to see it again.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-sm p-4 bg-cyan-dark/20 rounded-lg border-2 border-cyan-dark break-all">
                      <span className="flex-1">{newApiKey}</span>
                      <CopyButton text={newApiKey} />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setNewApiKey(null)}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                ) : hasIntegrationApiKey ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">API key is active</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleGenerateIntegrationKey}
                        disabled={isGeneratingApiKey}
                      >
                        {isGeneratingApiKey ? "Generating\u2026" : "Regenerate"}
                      </Button>
                      <Button
                        variant="outline-magenta"
                        onClick={handleRevokeIntegrationKey}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleGenerateIntegrationKey}
                    disabled={isGeneratingApiKey}
                  >
                    {isGeneratingApiKey
                      ? "Generating\u2026"
                      : "Generate API Key"}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>LLM Settings</CardTitle>
                <CardDescription>
                  Configure API keys for LLM-powered features. Your keys are
                  encrypted and never stored in plaintext.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <label className="text-lg font-medium mb-3 block">
                      Active Platform
                    </label>
                    <RadioGroup
                      value={activeLLMPlatform || activeTarget || ""}
                      onValueChange={handleSetActivePlatform}
                    >
                      {availableTargets.map((target) => {
                        const info = getTargetInfo(target);
                        const isServerTarget = info.type === "server";
                        const isConfigured =
                          !isServerTarget || apiKeyInfo[target]?.configured;

                        return (
                          <div
                            key={target}
                            className="flex items-center space-x-2"
                          >
                            <RadioGroupItem
                              value={target}
                              id={`platform-${target}`}
                              disabled={isServerTarget && !isConfigured}
                            />
                            <label
                              htmlFor={`platform-${target}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {info.name}
                              {isServerTarget && !isConfigured && (
                                <span className="text-cyan-medium ml-2">
                                  (no API key)
                                </span>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </RadioGroup>

                    <hr className="mt-6" />
                  </div>

                  <CollapsibleSection title="API Keys/Model Selection">
                    <div className="space-y-6">
                      <LMStudioInput
                        enabled={activeLLMPlatform === "lm-studio"}
                      />

                      <ApiKeyInput
                        displayName="Google Vertex"
                        apiKey={vertexApiKey}
                        onApiKeyChange={setVertexApiKey}
                        configured={apiKeyInfo.vertex?.configured || false}
                        onSave={() => {
                          const modelToSave =
                            vertexModel === "custom"
                              ? customModel
                              : vertexModel;
                          handleSaveApiKey("vertex", vertexApiKey, modelToSave);
                        }}
                        onTest={() => handleTestApiKey("vertex")}
                        isSaving={isSavingApiKey}
                        isTesting={isTestingApiKey}
                        testResult={
                          testResult?.provider === "vertex" ? testResult : null
                        }
                        modelConfig={{
                          availableModels: MODELS.vertex,
                          selectedModel: vertexModel,
                          onModelChange: (model) => {
                            setVertexModel(model);
                            if (model !== "custom") {
                              setCustomModel("");
                              // Save immediately for predefined models
                              handleSaveModel("vertex", model);
                            }
                          },
                          customModel,
                          onCustomModelChange: setCustomModel,
                          onCustomModelBlur: () => {
                            // Save when custom input loses focus
                            if (
                              vertexModel === "custom" &&
                              customModel.trim()
                            ) {
                              handleSaveModel("vertex", customModel);
                            }
                          },
                        }}
                        enabled={activeLLMPlatform === "vertex"}
                      />

                      <ApiKeyInput
                        displayName="OpenAI"
                        apiKey={openaiApiKey}
                        onApiKeyChange={setOpenaiApiKey}
                        configured={apiKeyInfo.openai?.configured || false}
                        onSave={() => {
                          const modelToSave =
                            openaiModel === "custom"
                              ? openaiCustomModel
                              : openaiModel;
                          handleSaveApiKey("openai", openaiApiKey, modelToSave);
                        }}
                        onTest={() => handleTestApiKey("openai")}
                        isSaving={isSavingApiKey}
                        isTesting={isTestingApiKey}
                        testResult={
                          testResult?.provider === "openai" ? testResult : null
                        }
                        modelConfig={{
                          availableModels: MODELS.openai,
                          selectedModel: openaiModel,
                          onModelChange: (model) => {
                            setOpenaiModel(model);
                            if (model !== "custom") {
                              setOpenaiCustomModel("");
                              // Save immediately for predefined models
                              handleSaveModel("openai", model);
                            }
                          },
                          customModel: openaiCustomModel,
                          onCustomModelChange: setOpenaiCustomModel,
                          onCustomModelBlur: () => {
                            // Save when custom input loses focus
                            if (
                              openaiModel === "custom" &&
                              openaiCustomModel.trim()
                            ) {
                              handleSaveModel("openai", openaiCustomModel);
                            }
                          },
                        }}
                        enabled={activeLLMPlatform === "openai"}
                      />

                      <ApiKeyInput
                        displayName="Anthropic"
                        apiKey={anthropicApiKey}
                        onApiKeyChange={setAnthropicApiKey}
                        configured={apiKeyInfo.anthropic?.configured || false}
                        onSave={() => {
                          const modelToSave =
                            anthropicModel === "custom"
                              ? anthropicCustomModel
                              : anthropicModel;
                          handleSaveApiKey(
                            "anthropic",
                            anthropicApiKey,
                            modelToSave,
                          );
                        }}
                        onTest={() => handleTestApiKey("anthropic")}
                        isSaving={isSavingApiKey}
                        isTesting={isTestingApiKey}
                        testResult={
                          testResult?.provider === "anthropic"
                            ? testResult
                            : null
                        }
                        modelConfig={{
                          availableModels: MODELS.anthropic,
                          selectedModel: anthropicModel,
                          onModelChange: (model) => {
                            setAnthropicModel(model);
                            if (model !== "custom") {
                              setAnthropicCustomModel("");
                              // Save immediately for predefined models
                              handleSaveModel("anthropic", model);
                            }
                          },
                          customModel: anthropicCustomModel,
                          onCustomModelChange: setAnthropicCustomModel,
                          onCustomModelBlur: () => {
                            // Save when custom input loses focus
                            if (
                              anthropicModel === "custom" &&
                              anthropicCustomModel.trim()
                            ) {
                              handleSaveModel(
                                "anthropic",
                                anthropicCustomModel,
                              );
                            }
                          },
                        }}
                        enabled={activeLLMPlatform === "anthropic"}
                      />

                      <ApiKeyInput
                        displayName="Grok"
                        apiKey={grokApiKey}
                        onApiKeyChange={setGrokApiKey}
                        configured={apiKeyInfo.grok?.configured || false}
                        onSave={() => {
                          const modelToSave =
                            grokModel === "custom"
                              ? grokCustomModel
                              : grokModel;
                          handleSaveApiKey("grok", grokApiKey, modelToSave);
                        }}
                        onTest={() => handleTestApiKey("grok")}
                        isSaving={isSavingApiKey}
                        isTesting={isTestingApiKey}
                        testResult={
                          testResult?.provider === "grok" ? testResult : null
                        }
                        modelConfig={{
                          availableModels: MODELS.grok,
                          selectedModel: grokModel,
                          onModelChange: (model) => {
                            setGrokModel(model);
                            if (model !== "custom") {
                              setGrokCustomModel("");
                              // Save immediately for predefined models
                              handleSaveModel("grok", model);
                            }
                          },
                          customModel: grokCustomModel,
                          onCustomModelChange: setGrokCustomModel,
                          onCustomModelBlur: () => {
                            // Save when custom input loses focus
                            if (
                              grokModel === "custom" &&
                              grokCustomModel.trim()
                            ) {
                              handleSaveModel("grok", grokCustomModel);
                            }
                          },
                        }}
                        enabled={activeLLMPlatform === "grok"}
                      />
                    </div>
                  </CollapsibleSection>

                  <hr />

                  <CollapsibleSection title="Thinking Settings">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <label
                            htmlFor="thinking-toggle"
                            className="text-sm font-medium"
                          >
                            Enable Thinking
                          </label>
                          <p className="text-sm text-cyan-medium">
                            Allow models to reason before responding
                          </p>
                        </div>
                        <Switch
                          id="thinking-toggle"
                          checked={thinkingEnabled}
                          onCheckedChange={setThinkingEnabled}
                        />
                      </div>

                      <div
                        className={
                          thinkingEnabled
                            ? ""
                            : "opacity-50 pointer-events-none"
                        }
                      >
                        <label className="text-sm font-medium mb-2 block">
                          Thinking Level
                        </label>
                        <Select
                          value={thinkingLevel}
                          onValueChange={(value) =>
                            setThinkingLevel(value as "low" | "medium" | "high")
                          }
                          disabled={!thinkingEnabled}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <p className="text-sm text-cyan-medium flex items-start gap-2">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          Not all models and providers support thinking
                          settings. The system will do its best to adapt these
                          settings to what each model supports.
                        </span>
                      </p>
                    </div>
                  </CollapsibleSection>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <CreateAccountOrLogin />
        )}

        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    </main>
  );
}
