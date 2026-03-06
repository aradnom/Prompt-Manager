import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useActiveStack } from "@/contexts/ActiveStackContext";
import { useSession } from "@/contexts/SessionContext";
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
import { DotDivider } from "@/components/ui/dot-divider";
import { CTALink } from "@/components/CTALink";
import { DismissableContainer } from "@/components/ui/dismissable-container";
import { NextSteps } from "@/components/NextSteps";

function HomeContent() {
  const { activeStack } = useActiveStack();
  const { isMinimized } = useStackOutput();
  const { isAuthenticated, isLoading } = useSession();
  const [newAccountToken, setNewAccountToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  const [nextStepsVisible, setNextStepsVisible] = useState(true);

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
          <DismissableContainer
            id="home-intro-content"
            className="accent-border-gradient"
            onVisibilityChange={setIntroVisible}
          >
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
                  content via LLMs (supports BYOK with
                  OpenAI/Anthropic/Gemini/Grok, or LM Studio, or local model
                  in-browser), transform existing content in various ways,
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
          </DismissableContainer>

          {introVisible && <DotDivider className="py-8" />}

          <section className="standard-content">
            <CreateAccountOrLogin onAccountCreated={handleAccountCreated} />
          </section>
        </motion.div>
      ) : activeStack ? (
        <StackContentProvider>
          <PromptSwitcher />
          <DotDivider className="mb-4" />
          <NextSteps
            className="mb-4"
            onVisibilityChange={setNextStepsVisible}
          />
          {nextStepsVisible && <DotDivider className="mb-4" />}
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
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-12 w-full"
        >
          <section className="standard-content accent-border-gradient">
            <div className="mb-6 space-y-4 text-md text-foreground">
              <p>You don't currently have an active prompt selected.</p>
            </div>

            <PromptSwitcher />

            <div className="mt-4 flex gap-6">
              <div>
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
              <div>
                <Link
                  to="/prompts/new"
                  className="text-magenta-medium hover:text-magenta-light font-semibold text-lg underline"
                >
                  Create a New Prompt
                </Link>
                <p className="text-sm text-cyan-medium mt-1">
                  Start a new prompt from scratch.
                </p>
              </div>
            </div>
          </section>
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
