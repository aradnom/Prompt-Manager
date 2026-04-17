import { motion } from "motion/react";
import { RasterIcon } from "@/components/RasterIcon";
import { FeatureTour } from "@/components/FeatureTour";

export default function Features() {
  return (
    <main className="standard-page-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="lightning" size={36} />
          Features
        </h1>
        <p className="text-cyan-medium mb-8">
          <mark className="highlighted-text">
            See what Diffusion Prompt Manager can do
          </mark>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="max-w-4xl mb-8 space-y-3 text-foreground"
      >
        <p>
          Working with diffusion models often means juggling dozens of
          similar-but-different prompts. You might have a core prompt that you
          tweak for different styles, or reusable fragments that you combine in
          various ways.
        </p>
        <p>
          Diffusion Prompt Manager gives you a structured way to organize these
          pieces. Instead of managing walls of text or keeping track of
          variations in scattered files, you can build a library of reusable
          components and combine them however you need.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="standard-content accent-border-gradient"
      >
        <FeatureTour />
      </motion.div>
    </main>
  );
}
