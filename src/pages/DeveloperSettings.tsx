import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useSession } from "@/contexts/SessionContext";
import { useLLMStatus } from "@/contexts/LLMStatusContext";
import { getPlatformDisplayName } from "@/lib/llm-platform-names";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DeveloperSettings() {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useSession();
  const { activeTarget, setActiveTarget, availableTargets } = useLLMStatus();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <main className="standard-page-container">
        <div className="text-center py-12 text-cyan-medium">Loading...</div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="standard-page-container">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Developer Settings</h1>
        <p className="text-cyan-medium">
          <mark className="highlighted-text">
            Advanced settings and tools for development
          </mark>
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>LLM Configuration</CardTitle>
            <CardDescription>
              Configure how the application interacts with Language Models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Active LLM Target</label>
              <div className="w-75">
                <Select
                  value={activeTarget || ""}
                  onValueChange={setActiveTarget}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a target" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargets.map((target) => (
                      <SelectItem key={target} value={target}>
                        {getPlatformDisplayName(target)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-cyan-medium">
                Select which service to use for text transformations and
                variations.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Development Tools</CardTitle>
            <CardDescription>
              This page contains developer-only settings and utilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-cyan-medium">
              This page is only visible to admin users.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
