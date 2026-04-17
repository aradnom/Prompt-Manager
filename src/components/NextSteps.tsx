import { Link } from "react-router-dom";
import { Plus, Settings, KeyRound, Sparkles } from "lucide-react";
import { DismissableContainer } from "@/components/ui/dismissable-container";
import { cn } from "@/lib/utils";

function triggerAddNewBlock() {
  const btn = document.querySelector<HTMLButtonElement>(
    '[data-action="add-new-block"]',
  );
  if (btn) {
    btn.scrollIntoView({ behavior: "smooth", block: "center" });
    // Small delay so the scroll finishes before the form opens
    setTimeout(() => btn.click(), 300);
  }
}

export function NextSteps({
  onVisibilityChange,
  className,
}: {
  onVisibilityChange?: (visible: boolean) => void;
  className?: string;
}) {
  return (
    <DismissableContainer
      id="home-next-steps"
      className={cn("accent-border-gradient", className)}
      onVisibilityChange={onVisibilityChange}
    >
      <h2 className="h2-alt mb-4 border-b-2">Next Steps</h2>
      <ul className="space-y-4">
        <li className="flex items-start gap-3">
          <Plus className="h-5 w-5 text-cyan-light shrink-0 mt-0.5" />
          <div>
            <button
              onClick={triggerAddNewBlock}
              className="text-cyan-light hover:text-cyan-light font-semibold underline cursor-pointer"
            >
              Add blocks to your prompt
            </button>
            <p className="text-sm text-cyan-medium mt-0.5">
              Blocks are reusable chunks of text—subjects, styles,
              modifiers—that you combine to build prompts.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-cyan-light shrink-0 mt-0.5" />
          <div>
            <Link
              to="/account#llm-settings"
              className="text-cyan-light hover:text-cyan-light font-semibold underline"
            >
              Set up LLM settings
            </Link>
            <p className="text-sm text-cyan-medium mt-0.5">
              Configure an API key so you can generate block content, transform
              text, and explore variations.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-cyan-light shrink-0 mt-0.5" />
          <div>
            <Link
              to="/account#comfyui-api-key"
              className="text-cyan-light hover:text-cyan-light font-semibold underline"
            >
              Generate a ComfyUI API key
            </Link>
            <p className="text-sm text-cyan-medium mt-0.5">
              Then install the{" "}
              <a
                href="https://github.com/aradnom/Prompt-Manager-ComfyUI"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-light hover:text-cyan-light underline"
              >
                ComfyUI custom node
              </a>{" "}
              to pipe prompts directly into your workflow.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-cyan-light shrink-0 mt-0.5" />
          <div>
            <Link
              to="/features"
              className="text-cyan-light hover:text-cyan-light font-semibold underline"
            >
              Explore all features
            </Link>
            <p className="text-sm text-cyan-medium mt-0.5">
              Video walkthroughs of everything Diffusion Prompt Manager can do.
            </p>
          </div>
        </li>
      </ul>
    </DismissableContainer>
  );
}
