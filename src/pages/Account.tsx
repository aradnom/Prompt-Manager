import { useState, useEffect } from "react";
import { motion } from "motion/react";
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
import { PREDEFINED_MODELS } from "@/lib/llm-model-names";
import { ApiKeyInput } from "@/components/ApiKeyInput";
import { LMStudioInput } from "@/components/LMStudioInput";
import { storage } from "@/lib/storage";

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
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    message?: string;
  } | null>(null);
  const [vertexApiKey, setVertexApiKey] = useState("");
  const [vertexModel, setVertexModel] = useState(
    Object.keys(PREDEFINED_MODELS.vertex)[0],
  );
  const [customModel, setCustomModel] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState(
    Object.keys(PREDEFINED_MODELS.openai)[0],
  );
  const [openaiCustomModel, setOpenaiCustomModel] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState(
    Object.keys(PREDEFINED_MODELS.anthropic)[0],
  );
  const [anthropicCustomModel, setAnthropicCustomModel] = useState("");
  const [grokApiKey, setGrokApiKey] = useState("");
  const [grokModel, setGrokModel] = useState(
    Object.keys(PREDEFINED_MODELS.grok)[0],
  );
  const [grokCustomModel, setGrokCustomModel] = useState("");
  const [activeLLMPlatform, setActiveLLMPlatform] = useState<string>("");

  useEffect(() => {
    if (isAuthenticated && !accountData) {
      fetchAccountData();
    }
  }, [isAuthenticated, accountData]);

  const fetchAccountData = async () => {
    setIsLoadingAccount(true);
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

      // Pre-populate the model dropdown if a model is configured
      if (data.apiKeys?.vertex?.model) {
        const savedModel = data.apiKeys.vertex.model;
        // Check if it's one of our predefined models
        if (savedModel in PREDEFINED_MODELS.vertex) {
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
        if (savedModel in PREDEFINED_MODELS.openai) {
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
        if (savedModel in PREDEFINED_MODELS.anthropic) {
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
        if (savedModel in PREDEFINED_MODELS.grok) {
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
      setIsLoadingAccount(false);
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

      // Refresh account data to get updated flags
      await fetchAccountData();
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
      // We need to send a placeholder key since the backend requires it
      // The backend will preserve the existing key
      const response = await fetch("/api/auth/api-keys", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, apiKey: "__PRESERVE__", model }),
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
                <div className="font-mono text-2xl font-bold tracking-wider p-4 bg-cyan-dark/20 rounded-lg border-2 border-cyan-dark">
                  {accountData.token}
                </div>
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

                  <LMStudioInput enabled={activeLLMPlatform === "lm-studio"} />

                  <ApiKeyInput
                    displayName="Google Vertex"
                    apiKey={vertexApiKey}
                    onApiKeyChange={setVertexApiKey}
                    configured={apiKeyInfo.vertex?.configured || false}
                    onSave={() => {
                      const modelToSave =
                        vertexModel === "custom" ? customModel : vertexModel;
                      handleSaveApiKey("vertex", vertexApiKey, modelToSave);
                    }}
                    onTest={() => handleTestApiKey("vertex")}
                    isSaving={isSavingApiKey}
                    isTesting={isTestingApiKey}
                    testResult={
                      testResult?.provider === "vertex" ? testResult : null
                    }
                    modelConfig={{
                      availableModels: PREDEFINED_MODELS.vertex,
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
                        if (vertexModel === "custom" && customModel.trim()) {
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
                      availableModels: PREDEFINED_MODELS.openai,
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
                      testResult?.provider === "anthropic" ? testResult : null
                    }
                    modelConfig={{
                      availableModels: PREDEFINED_MODELS.anthropic,
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
                          handleSaveModel("anthropic", anthropicCustomModel);
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
                        grokModel === "custom" ? grokCustomModel : grokModel;
                      handleSaveApiKey("grok", grokApiKey, modelToSave);
                    }}
                    onTest={() => handleTestApiKey("grok")}
                    isSaving={isSavingApiKey}
                    isTesting={isTestingApiKey}
                    testResult={
                      testResult?.provider === "grok" ? testResult : null
                    }
                    modelConfig={{
                      availableModels: PREDEFINED_MODELS.grok,
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
                        if (grokModel === "custom" && grokCustomModel.trim()) {
                          handleSaveModel("grok", grokCustomModel);
                        }
                      },
                    }}
                    enabled={activeLLMPlatform === "grok"}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleLogout} variant="outline">
                Log Out
              </Button>
            </div>
          </div>
        ) : (
          <CreateAccountOrLogin />
        )}

        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    </main>
  );
}
