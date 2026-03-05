import { FeatureShowcase } from "@/components/FeatureShowcase";
import { VideoClip } from "@/components/VideoClip";

export function FeatureTour() {
  return (
    <div>
      <FeatureShowcase
        title="Create a New Prompt"
        description="Set up a prompt and make it active to start building"
      >
        <VideoClip name="create-new-prompt" />
        <p className="text-foreground">
          Prompts are collections of blocks arranged in a specific order. You
          can add or remove blocks, reorder them, and choose whether they're
          comma-separated or space-separated. Each prompt also tracks its
          revisions, letting you save different versions as you iterate.
        </p>
      </FeatureShowcase>

      <FeatureShowcase
        title="Create a New Block"
        description="Add reusable text blocks that can be mixed and matched across prompts"
      >
        <VideoClip name="create-new-block" />
        <p className="text-foreground">
          Blocks are reusable chunks of text. They could be subjects ("a
          cyberpunk cityscape"), styles ("vibrant colors, high contrast"),
          technical parameters ("4k, detailed"), or anything else you use
          regularly. Each block maintains its own revision history, so you can
          experiment and roll back changes.
        </p>
      </FeatureShowcase>

      <FeatureShowcase
        title="Reorder & Disable Blocks"
        description="Drag blocks to rearrange them or toggle them off without removing"
      >
        <VideoClip name="reorder-and-disable-blocks" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Add Emphasis"
        description="Boost or reduce the weight of specific words and phrases"
      >
        <VideoClip name="add-emphasis" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Generate Block Content"
        description="Use an LLM to generate new block text from a description"
      >
        <VideoClip name="generate-block" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Make It More Descriptive"
        description="Transform existing block text into richer, more detailed descriptions"
      >
        <VideoClip name="more-descriptive" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Explore Variations"
        description="Generate and compare alternative phrasings of your block text"
      >
        <VideoClip name="explore-variations" />
      </FeatureShowcase>

      <FeatureShowcase
        title="Use a Wildcard"
        description="Insert wildcards into blocks for randomized or selectable options"
      >
        <VideoClip name="use-wildcard" />
        <p className="text-foreground">
          Wildcards let you inject randomness into your prompts. Define a
          wildcard with multiple options, and the system will randomly choose
          one when you compile your prompt. For example, you might create a
          "weather" wildcard with options like "sunny", "rainy", "foggy", and
          "stormy". Reference it in your blocks using the wildcard syntax, and
          each generation can use a different weather condition.
        </p>
      </FeatureShowcase>
    </div>
  );
}
