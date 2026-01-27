import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RasterIcon } from "@/components/RasterIcon";

export default function WhatIsThis() {
  return (
    <main className="standard-page-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="question-mark" size={36} />
          What is This Thing?
        </h1>
        <p className="text-cyan-medium mb-8">
          <mark className="highlighted-text">
            A brief guide to Prompt Manager
          </mark>
        </p>
      </motion.div>

      <div className="space-y-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-magenta-light">
                Why This Exists
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-foreground">
              <p>
                Working with diffusion models often means juggling dozens of
                similar-but-different prompts. You might have a core prompt that
                you tweak for different styles, or reusable fragments that you
                combine in various ways.
              </p>
              <p>
                Prompt Manager gives you a structured way to organize these
                pieces. Instead of managing walls of text or keeping track of
                variations in scattered files, you can build a library of
                reusable components and combine them however you need.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-magenta-light">
                Prompts, Blocks, and Output
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-foreground">
              <div>
                <h3 className="font-semibold text-cyan-light mb-2">Blocks</h3>
                <p>
                  Blocks are reusable chunks of text. They could be subjects ("a
                  cyberpunk cityscape"), styles ("vibrant colors, high
                  contrast"), technical parameters ("4k, detailed"), or anything
                  else you use regularly. Each block maintains its own revision
                  history, so you can experiment and roll back changes.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-light mb-2">Prompts</h3>
                <p>
                  Prompts are collections of blocks arranged in a specific
                  order. You can add or remove blocks, reorder them, and choose
                  whether they're comma-separated or space-separated. Each
                  prompt also tracks its revisions, letting you save different
                  versions as you iterate.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-light mb-2">Output</h3>
                <p>
                  The Output panel shows your compiled prompt text ready to copy
                  and use. It combines all your blocks according to your
                  prompt's settings and displays the final result. You can
                  toggle between T5 and CLIP formatting depending on your
                  model's needs.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-magenta-light">Wildcards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-foreground">
              <p>
                Wildcards let you inject randomness into your prompts. Define a
                wildcard with multiple options, and the system will randomly
                choose one when you compile your prompt.
              </p>
              <p>
                For example, you might create a "weather" wildcard with options
                like "sunny", "rainy", "foggy", and "stormy". Reference it in
                your blocks using the wildcard syntax, and each generation can
                use a different weather condition.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-magenta-light">
                LLM Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-foreground">
              <p>
                Prompt Manager includes LLM-powered tools to help you work with
                your prompts. These operations can help you refine, expand, or
                transform your text.
              </p>
              <div>
                <h3 className="font-semibold text-cyan-light mb-2">
                  Available Operations
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Expand terse notes into detailed descriptions</li>
                  <li>Condense verbose text into concise prompts</li>
                  <li>Rewrite prompts in different styles or perspectives</li>
                  <li>Generate variations on existing prompts</li>
                </ul>
              </div>
              <p className="text-sm text-cyan-medium">
                Note: LLM operations require an API key to be configured in your
                Developer Settings.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
