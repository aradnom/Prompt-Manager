import { motion } from "motion/react";
import { RasterIcon } from "@/components/RasterIcon";
import { IntroContent } from "@/components/IntroContent";
import { VideoClip } from "@/components/VideoClip";
import { DotDivider } from "@/components/ui/dot-divider";

export default function ComfyUI() {
  return (
    <main className="standard-page-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="comfyui" size={36} />
          ComfyUI Integration
        </h1>
        <p className="text-cyan-medium mb-8">
          <mark className="highlighted-text">
            Pipe your prompts straight into ComfyUI with live syncing
          </mark>
        </p>
      </motion.div>

      <IntroContent accent>
        <p>
          Diffusion Prompt Manager pairs with a small ComfyUI extension that
          adds two custom nodes for loading prompt content directly into your
          ComfyUI graph. Once it's wired up, edits made on the Prompt Manager
          side stream into ComfyUI automatically — no copy-pasting, no manual
          refreshes.
        </p>
        <p>
          The extension lives in its own repository at{" "}
          <a
            href="https://github.com/aradnom/Prompt-Manager-ComfyUI"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-light underline hover:text-foreground transition-colors"
          >
            github.com/aradnom/Prompt-Manager-ComfyUI
          </a>
          .
        </p>
      </IntroContent>

      <DotDivider className="mb-4" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="standard-content accent-border-gradient space-y-12"
      >
        <section>
          <h2 className="text-2xl font-bold gradient-heading mb-3 rounded-[1px]">
            What You Get
          </h2>
          <div className="space-y-3 text-foreground">
            <p>The extension provides two new nodes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Prompt Selector</strong> — pick an individual prompt and
                load its compiled text. A toggle on the node keeps it in sync
                with whichever prompt is currently active in Prompt Manager, so
                you can flip between prompts in the app without touching the
                ComfyUI graph.
              </li>
              <li>
                <strong>Snapshot Selector</strong> — pick a prompt snapshot and
                load its frozen text. Useful when you want a prompt to stay
                exactly as it was when you took the snapshot, regardless of what
                happens to the parent prompt later.
              </li>
            </ul>
            <p>
              Both nodes output a string, so they connect to anything that takes
              a string input — CLIP Text Encode, T5, or any custom node that
              accepts text.
            </p>
            <img
              src="/images/comfyui-usage.png"
              alt="Prompt Manager nodes connected to a CLIP Text Encode node in ComfyUI"
              className="w-full rounded-md border border-cyan-dark"
            />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold gradient-heading mb-3">
            Prompt Manager Setup
          </h2>
          <div className="space-y-3 text-foreground">
            <ul className="list-disc pl-6 space-y-2">
              <li>Make a free account if you don't already have one.</li>
              <li>
                Head to the{" "}
                <a
                  href="/account"
                  className="text-cyan-light underline hover:text-foreground transition-colors"
                >
                  Account page
                </a>
                .
              </li>
              <li>
                Under <strong>ComfyUI API Key</strong>, click{" "}
                <strong>Generate API Key</strong> and copy the value.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold gradient-heading mb-3">
            ComfyUI Setup
          </h2>
          <div className="space-y-3 text-foreground">
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Install the{" "}
                <a
                  href="https://github.com/aradnom/Prompt-Manager-ComfyUI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-light underline hover:text-foreground transition-colors"
                >
                  Prompt-Manager-ComfyUI
                </a>{" "}
                extension into your <code>ComfyUI/custom_nodes</code> directory
                and restart ComfyUI.
              </li>
              <li>
                Make sure Prompt Manager is open in a browser tab and you're
                logged in — the pairing step below needs an active session to
                complete.
              </li>
              <li>
                In ComfyUI, open <strong>Settings → Prompt Manager</strong> and
                paste in the API key from above.
              </li>
              <li>
                A popup should appear on the Prompt Manager side asking you to
                confirm the pairing with ComfyUI. This is what hands the ComfyUI
                extension the key it needs to decrypt your prompts on its end.
                Accept the request, and you should get a confirmation on the
                ComfyUI side with the node connection status showing as{" "}
                <strong>Connected</strong>.
              </li>
              <li>
                Two new nodes will appear under{" "}
                <strong>Add Node → PromptManager</strong>:{" "}
                <em>Prompt Selector</em> and <em>Snapshot Selector</em>. Start
                with Prompt Selector if this is your first time.
              </li>
              <li>
                Click <strong>List All Prompts</strong> to load your prompts,
                then pick one from the dropdown to populate the node.
              </li>
              <li>
                Connect the node's <code>text</code> output to the{" "}
                <code>text</code> input on your CLIP Text Encode node (or
                whatever text encoder you're using).
              </li>
              <li>
                Generate. Any changes you make in Prompt Manager will sync
                automatically. Toggle <code>use_active_prompt</code> on the node
                to have it always follow whichever prompt is currently active in
                Prompt Manager.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold gradient-heading mb-3">
            Manual Dependency Install
          </h2>
          <div className="space-y-3 text-foreground">
            <p>
              The extension's Python dependencies (<code>requests</code>,{" "}
              <code>python-dotenv</code>) install automatically the first time
              ComfyUI loads it. If that fails for some reason, you can install
              them manually:
            </p>
            <pre className="bg-cyan-dark border border-cyan-medium rounded-md p-3 text-sm overflow-x-auto">
              <code>{`cd ComfyUI/custom_nodes/Prompt-Manager-ComfyUI
pip install -r requirements.txt`}</code>
            </pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold gradient-heading mb-3">
            See It In Action
          </h2>
          <VideoClip name="comfyui" />
        </section>
      </motion.div>
    </main>
  );
}
