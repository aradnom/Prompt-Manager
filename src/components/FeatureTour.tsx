import { FeatureShowcase } from "@/components/FeatureShowcase";
import { VideoClip } from "@/components/VideoClip";

export function FeatureTour() {
  return (
    <div>
      <FeatureShowcase
        title="Create a New Prompt"
        description="Set up a prompt and make it active to start building"
      >
        <p className="text-foreground">
          Prompts are collections of blocks arranged in a specific order. You
          can add or remove blocks, reorder them, and choose whether they're
          comma-separated or space-separated. Each prompt also tracks its
          revisions, letting you save different versions as you iterate.
        </p>
        <VideoClip name="create-new-prompt" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Create a New Block"
        description="Add reusable text blocks that can be mixed and matched across prompts"
      >
        <p className="text-foreground">
          Blocks are reusable chunks of text. They could be subjects ("a
          cyberpunk cityscape"), styles ("vibrant colors, high contrast"),
          technical parameters ("4k, detailed"), or anything else you use
          regularly. Each block maintains its own revision history, so you can
          experiment and roll back changes.
        </p>
        <VideoClip name="create-new-block" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Reorder & Disable Blocks"
        description="Drag blocks to rearrange them or toggle them off without removing"
      >
        <p className="text-foreground">
          Drag and drop blocks to change the order they appear in your compiled
          prompt. You can also toggle individual blocks off to temporarily
          exclude them from the output without losing your arrangement — useful
          for A/B testing different combinations.
        </p>
        <VideoClip name="reorder-and-disable-blocks" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Add Emphasis"
        description="Boost or reduce the weight of specific words and phrases"
      >
        <p className="text-foreground">
          Select text within a block and increase or decrease its emphasis
          weight. This translates to the weighting syntax used by diffusion
          models, letting you fine-tune how strongly the model responds to
          specific parts of your prompt.
        </p>
        <VideoClip name="add-emphasis" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Generate Block Content"
        description="Use an LLM to generate new block text from a description"
      >
        <p className="text-foreground">
          Describe what you want in plain language and let an LLM generate
          polished prompt text for you. The generated text is formatted for your
          chosen output style — natural language for T5/FLUX or comma-separated
          tokens for CLIP/Stable Diffusion.
        </p>
        <VideoClip name="generate-block" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Make It More Descriptive"
        description="Transform existing block text into richer, more detailed descriptions"
      >
        <p className="text-foreground">
          Take existing block text and expand it to roughly double its length
          with additional detail and specificity. The transform preserves your
          core subject matter while adding texture — useful when a prompt idea
          is right but needs more depth to guide the model.
        </p>
        <VideoClip name="more-descriptive" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Explore Variations"
        description="Generate and compare alternative phrasings of your block text"
      >
        <p className="text-foreground">
          Generate five variations of your block text at progressively different
          levels — from minor word swaps to full reinterpretations of the same
          theme. Browse the results side by side and pick the one that best
          fits, or use them as inspiration for further editing.
        </p>
        <VideoClip name="explore-variations" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Use a Wildcard"
        description="Insert wildcards into blocks for randomized or selectable options"
      >
        <p className="text-foreground">
          Wildcards let you inject randomness into your prompts. Define a
          wildcard with multiple options, and the system will randomly choose
          one when you compile your prompt. For example, you might create a
          "weather" wildcard with options like "sunny", "rainy", "foggy", and
          "stormy". Reference it in your blocks using the wildcard syntax, and
          each generation can use a different weather condition.
        </p>
        <VideoClip name="use-wildcard" />
      </FeatureShowcase>
    </div>
  );
}
