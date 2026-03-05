import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useActiveStack } from "@/contexts/ActiveStackContext";
import { useSession } from "@/contexts/SessionContext";
import { useUserState } from "@/contexts/UserStateContext";
import { StackContentProvider } from "@/contexts/StackContentContext";
import {
  StackOutputProvider,
  useStackOutput,
} from "@/contexts/StackOutputContext";
import { StackEditor } from "@/components/StackEditor";
import { StackOutputBlock } from "@/components/StackOutputBlock";
import { RasterIcon } from "@/components/RasterIcon";
import { CreateAccountOrLogin } from "@/components/CreateAccountOrLogin";
import { AccountTokenModal } from "@/components/AccountTokenModal";
import { PromptSwitcher } from "@/components/PromptSwitcher";
import { CreatePromptForm } from "@/components/CreatePromptForm";
import { Button } from "@/components/ui/button";
import { DotDivider } from "@/components/ui/dot-divider";
import { VideoClip } from "@/components/VideoClip";
import { FeatureShowcase } from "@/components/FeatureShowcase";
import { CTALink } from "@/components/CTALink";

function HomeContent() {
  const { activeStack, setActiveStack } = useActiveStack();
  const { isMinimized } = useStackOutput();
  const { isAuthenticated, isLoading } = useSession();
  const { stackCount } = useUserState();
  const [newAccountToken, setNewAccountToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);

  const handleAccountCreated = (token: string) => {
    setNewAccountToken(token);
    setShowTokenModal(true);
  };

  const handleCloseModal = () => {
    setShowTokenModal(false);
    setNewAccountToken(null);
  };

  return (
    <main className="standard-page-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex mb-8"
      >
        <RasterIcon name="logo1" width={90} height={100} className="mr-5" />
        <div>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            Prompt Manager
          </h1>
          <p className="text-magenta-dark mb-8">
            <mark className="highlighted-text">
              Manage your diffusion model prompts with ease
            </mark>
          </p>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="mt-12">
          <p className="text-cyan-medium">Loading...</p>
        </div>
      ) : !isAuthenticated ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-12 w-full"
        >
          <div className="standard-content accent-border-gradient">
            <div className="space-y-4 text-foreground">
              <p>
                <strong className="text-magenta-light">Prompt Manager</strong>{" "}
                is a tool for organizing and managing your text-to-image
                diffusion model prompts. Create reusable prompt blocks, combine
                them into stacks, fine-tune your output with advanced
                styling/transformation options and{" "}
                <a
                  href="https://github.com/aradnom/Prompt-Manager-ComfyUI"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  pipe the finished output directly into ComfyUI.
                </a>
              </p>
              <p>
                Whether you're working with Stable Diffusion, Flux, or other
                diffusion models, Prompt Manager helps you maintain consistency
                across your generations while making it easy to experiment with
                variations.
              </p>
              <div className="h3">Features include:</div>
              <ul className="list-disc pl-10 pr-5 py-5 border-2 border-cyan-medium/50 rounded-lg accent-border-gradient">
                <li>
                  <strong>Basic organization:</strong> Compose prompts from text
                  blocks and organize with folders, types and custom labels.
                  Fully searchable across everything.
                </li>
                <li>
                  <strong>Blocks:</strong> Build prompts from small text blocks
                  that can be easily added/deleted/rearranged/disabled.
                </li>
                <li>
                  <strong>Transformations:</strong> Easily generate new block
                  content via LLMs, transform existing content in various ways,
                  explore text variations, etc.
                </li>
                <li>
                  <strong>Wildcards:</strong> Import/generate wildcards and
                  inject into block content with a nice interface for
                  randomizing/selecting specific options/freezing specific
                  wildcards, etc.
                </li>
                <li>
                  <strong>Revisions:</strong> Supports full revision history for
                  text blocks and prompts. Easily tell what changed between
                  versions and roll back to a previous version.
                </li>
                <li>
                  <strong>Templates:</strong> Have a particular block
                  arrangement you tend to use a lot? Create a template from it
                  and use that combination as a starting point with a single
                  click.
                </li>
                <li>
                  <strong>Snapshots:</strong> Create a named, static snapshot of
                  a prompt for moments when you stumble across a prompt that
                  really nails what you were going for. Won't change if the
                  parent prompt it came from does later.
                </li>
                <li>
                  <strong>ComfyUI support:</strong> Pipe prompts directly into
                  ComfyUI via{" "}
                  <a
                    href="https://github.com/aradnom/Prompt-Manager-ComfyUI"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    a custom node
                  </a>{" "}
                  that automatically syncs whatever you're currently working on.
                </li>
              </ul>
            </div>

            <CTALink
              to="/features"
              className="max-w-3xl mx-auto block mt-8"
              theme="magenta"
            >
              Explore All Features
            </CTALink>
          </div>

          <DotDivider className="py-8" />

          <div className="standard-content">
            <CreateAccountOrLogin onAccountCreated={handleAccountCreated} />
          </div>
        </motion.div>
      ) : activeStack ? (
        <StackContentProvider>
          <PromptSwitcher />
          <DotDivider className="mb-3" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 rounded accent-border-gradient"
          >
            <StackEditor stack={activeStack} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`sticky bottom-0 left-0 right-0 z-40 pb-8 ${
              isMinimized ? "float-right" : ""
            }`}
          >
            <div className="container mx-auto">
              <StackOutputBlock />
            </div>
          </motion.div>
        </StackContentProvider>
      ) : stackCount === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-12 w-full"
        >
          <div className="standard-content accent-border-gradient">
            <div className="mb-8 space-y-4 text-md text-foreground">
              <p>
                Welcome! You don't have any prompts yet. To get started, you'll
                need to create some prompt blocks and organize them into a
                prompt.
              </p>
              <p>
                Blocks are reusable pieces of text that can be combined in
                different ways. Prompts let you arrange blocks in a specific
                order to create complete prompts for your diffusion models.
              </p>
            </div>

            {isCreatingPrompt ? (
              <CreatePromptForm
                onCreated={(newStack) => {
                  setIsCreatingPrompt(false);
                  setActiveStack(newStack);
                }}
                onCancel={() => setIsCreatingPrompt(false)}
              />
            ) : (
              <div className="space-y-3">
                <Button size="lg" onClick={() => setIsCreatingPrompt(true)}>
                  Create Your First Prompt
                </Button>
                <div className="space-y-4 mt-6">
                  <div>
                    <Link
                      to="/blocks"
                      className="text-magenta-medium hover:text-magenta-light font-semibold text-lg underline"
                    >
                      Create Blocks
                    </Link>
                    <p className="text-sm text-cyan-medium mt-1">
                      Start by creating reusable prompt blocks with your
                      favorite subjects, styles, and modifiers.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-12 w-full"
        >
          <div className="standard-content accent-border-gradient">
            <FeatureShowcase
              title="Create a New Prompt"
              description="Start building prompts from scratch"
            >
              <VideoClip name="create-new-prompt" />
              <p>
                Create a new prompt by going to Prompts, then clicking on Create
                New Prompt, then set the prompt as active so you can add content
                to it by clicking Make Active.
              </p>
            </FeatureShowcase>

            <div className="mb-6 space-y-4 text-md text-foreground">
              <p>You don't currently have an active prompt selected.</p>
            </div>

            <PromptSwitcher />

            <div className="mt-4">
              <Link
                to="/prompts"
                className="text-magenta-medium hover:text-magenta-light font-semibold text-lg underline"
              >
                Go to Prompts
              </Link>
              <p className="text-sm text-cyan-medium mt-1">
                View your prompts and select one to work with.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Account Token Modal */}
      {newAccountToken && (
        <AccountTokenModal
          isOpen={showTokenModal}
          onClose={handleCloseModal}
          token={newAccountToken}
        />
      )}
    </main>
  );
}

export default function Home() {
  return (
    <StackOutputProvider>
      <HomeContent />
    </StackOutputProvider>
  );
}
