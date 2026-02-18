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
import { HorizontalRule } from "@/components/ui/horizontal-rule";
import { CreateAccountOrLogin } from "@/components/CreateAccountOrLogin";
import { AccountTokenModal } from "@/components/AccountTokenModal";
import { PromptSwitcher } from "@/components/PromptSwitcher";
import { DotDivider } from "@/components/ui/dot-divider";

function HomeContent() {
  const { activeStack } = useActiveStack();
  const { isMinimized } = useStackOutput();
  const { isAuthenticated, isLoading } = useSession();
  const { stackCount } = useUserState();
  const [newAccountToken, setNewAccountToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

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

      {!activeStack && <HorizontalRule parallax />}

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
            <div className="mb-12 space-y-4 text-md text-foreground">
              <p>
                Prompt Manager is a powerful tool for organizing and managing
                your text-to-image diffusion model prompts. Create reusable
                prompt blocks, combine them into stacks, and fine-tune your
                output with advanced styling options.
              </p>
              <p>
                Whether you're working with Stable Diffusion, Flux, or other
                diffusion models, Prompt Manager helps you maintain consistency
                across your generations while making it easy to experiment with
                variations.
              </p>
            </div>

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

            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-cyan-light mb-4">
                Get Started:
              </h3>
              <div className="space-y-4">
                <div>
                  <Link
                    to="/prompts"
                    className="text-magenta-medium hover:text-magenta-light font-semibold text-lg underline"
                  >
                    Build Prompts
                  </Link>
                  <p className="text-sm text-cyan-medium mt-1">
                    Combine your blocks into prompts and set one as active to
                    start working with it here.
                  </p>
                </div>
                <div>
                  <Link
                    to="/blocks"
                    className="text-magenta-medium hover:text-magenta-light font-semibold text-lg underline"
                  >
                    Create Blocks
                  </Link>
                  <p className="text-sm text-cyan-medium mt-1">
                    Start by creating reusable prompt blocks with your favorite
                    subjects, styles, and modifiers.
                  </p>
                </div>
              </div>
            </div>
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
