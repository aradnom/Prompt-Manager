import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useClientLLM } from "@/contexts/ClientLLMContext";

interface LMStudioInputProps {
  enabled: boolean;
}

export function LMStudioInput({ enabled }: LMStudioInputProps) {
  const { lmStudioUrl, setLMStudioUrl } = useClientLLM();
  const [urlDraft, setUrlDraft] = useState(lmStudioUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    setUrlDraft(lmStudioUrl);
  }, [lmStudioUrl]);

  const commitUrl = () => {
    const trimmed = urlDraft.trim();
    if (trimmed && trimmed !== lmStudioUrl) {
      setLMStudioUrl(trimmed);
      setTestResult(null);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${lmStudioUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Say OK" }],
          max_tokens: 4,
        }),
      });

      if (!response.ok) {
        setTestResult({
          success: false,
          message: `Server returned ${response.status} ${response.statusText}`,
        });
        return;
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = data.choices?.[0]?.message?.content;

      setTestResult({
        success: true,
        message: reply
          ? `Connected — model replied: "${reply.trim().slice(0, 60)}"`
          : "Connected, but got an empty response. Is a model loaded?",
      });
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setTestResult({
          success: false,
          message:
            "Could not reach LM Studio. Check that the server is running and CORS is enabled.",
        });
      } else {
        setTestResult({
          success: false,
          message:
            err instanceof Error ? err.message : "Connection test failed",
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

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
          LM Studio API URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="http://localhost:11434/v1"
            className="flex-1 px-3 py-2 rounded-md border border-cyan-medium bg-background font-mono text-sm"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onBlur={commitUrl}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <ButtonGroup>
            <Button onClick={handleTest} disabled={isTesting} variant="outline">
              {isTesting ? "Testing\u2026" : "Test"}
            </Button>
          </ButtonGroup>
        </div>
        {testResult && (
          <p
            className={`text-sm mt-1 ${testResult.success ? "text-green-500" : "text-red-500"}`}
          >
            {testResult.success ? "\u2713 " : "\u2717 "}
            {testResult.message}
          </p>
        )}
        <p className="text-sm text-cyan-medium mt-4">
          Connects directly from your browser to LM Studio.{" "}
          <strong>
            Make sure you have{" "}
            <Link
              to="/lm-studio-cors"
              className="underline hover:text-cyan-light"
            >
              CORS support enabled
            </Link>{" "}
            in LM Studio.
          </strong>
        </p>
      </div>
    </div>
  );
}
