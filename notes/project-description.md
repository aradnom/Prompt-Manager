What we're building here is a prompt manager, initially for diffusion models. If you write a lot of prompts, string management actually becomes _kind of a thing_, particularly with diffusion models. You blend stuff, you reorder bits, there's standard bits and other bits that change, etc. So I'm making something that's meant to help manage "bits of text" for this purpose.

Now obviously the most basic feature here is "simple text storage," but I want this thing to do a lot more than just store text strings. Long term I want it to act as part of the creative process, which means providing tools for creatively merging/splitting/blending text and a bunch of other things. So (eventually) you could for example reorder two blocks, then click on the revisions of one block and zip back two versions, grab a wildcard from a toolbar and drop that on to a third block, then "render" that into 3 tonally different final prompts, then simplify that to a target word length, rinse and repeat. So this would act as both a prompt archiver as well as a tool for rapid prompt variations.

## Core Features

- Basic text storage/retrieval (duh)
- The Text Block: this will likely be the most signifcant component in this app. I want to think of each "unit" of text as something that has the same feature set, no matter if we're talking about a small chunk of input text or the final merged prompt. The idea is that no matter what kind of text you're looking at, it can be used and transformed in the same way as any other block of text. So with that said, most of the features to follow here will either apply specifically to the basic TextBlock component or will involve it.
- Save (or maybe "commit"?) button that will generate a UUID for the text, a memorable ID (`pink-jumping-llama`) and make the block officially a “persistent thing”
- "More descriptive/less descriptive" functionality: increase the length and richness of the text or decrease those things (there's many ways to do this and "richness" is a bit vague, but we'll talk about that)
- "Variation" functionality: transform existing text into something adjacent to the current text, with controls over just how aggressively to deviate from the original
- "Merge/unmerge" functionality: merge or split text with functionality more nuanced than a simple string concat/split
- Types and labels for each text block to account for the fact that complex prompts have different major areas (types), precondition/theme/modifier, etc., and also to account for the fact that we can't necessarily predict what all of those are, so custom labels are also a good idea
- Full revision history for each text block and elegant interface functionality for quickly browsing through revisions and comparing them
- "Creative Toolbox" functionality to quickly add new text based on concepts. What I'm picturing here is a series of hub and spoke screens--first you're presented with a bunch of generic stuff, setting, theme, character, building, etc., then if you click on say Building that concept will move to the center and a cloud of nodes will pop out around it with more specific ideas, Townhouse, Mansion, Storefront, Skyscraper, etc., and you can keep drilling down this way until you arrive at the specific variation you're looking for.
- Wildcard support. And not just support for expanding wildcards, but a whole Wildcard Management area that will let you upload wildcards (JSON, YAML) but that will also let you create your own wildcard lists and also an important interface feature: a special Wildcard component that will live inside the main Text Block that will make it clear a bit of text is a wildcard, and when hovered over, will let you quickly see the available options, let you select specific ones to rotate between or immediately spit out a random choice (or go back to the default behavior, will will be to generate a random choice when the final prompt is compiled).
- Context-aware text generation support. I want this to be kind of a "flesh this area out more" button. So say you have a stack of text blocks containing different content and there's a block describing the scene. I want some kind of button right after that block that will recognize what the previous block has (something about the scene) and intelligently add a new block that builds on top of that one ("add a description of scene lighting perhaps").
- "Text Exploration": This will work in a somewhat similar fashion to the Creative Toolbox above, but for existing text. You click on a chunk of text or a finished prompt and it gives you an interface with the existing text in the middle and say 4 or 5 variations around it. You click on one of them, it gives you 4 or 5 variations of those. You find one you like, you select it, it gets a new ID and that's now the prompt canvas you're working with (and of course the original text you started with isn't dead because everything has revisions).

And more to come I'm sure, this is already a pretty lengthy list to bang out.

## Interface

The interface here is really key, because while all this is doing is "managing bits of text," something longtime developer experience has taught me is that there's a million ways to do a bad job of managing very basic things. It's very easy to do a thoughtless job that technically meets the requirement, but is a thoroughly unpleasant experience for the user. This thing is all about managing strings and nothing else so the basic tools for doing that had better be pretty good. Which is to say:

- Careful prioritization of what you need to see, when you need to see it. Prompts are all about combining bits of input into a single output then iterating, so that's the paradigm I want to use: one string of input blocks (the "current prompt canvas") that result in one output with the ability to quickly iterate on the individual pieces or branch off in a new direction (which then becomes the new "prompt canvas")
- Focused design: the top-to-bottom start-of-input to end-of-input and output are what matters most here.
- Pleasant to use: this means more than just "it looks better than the early versions of Excel." I want this to be _fun_ to interact with. That means good organization, but also judicious use of animation elements (but not _too much_) so that it feels "zippy" and dynamic instead of just feeling like a bunch of dead textareas stacked on top of each other.

## Architecture

- Node/Vite/React/TypeScript
- There's an argument to be made for making this both a web app and a standalone app, so Electron support is something I'm thinking about. Also online vs. online support, in the sense that everything could be stored locally or remotely, local browser ONNX models could be used for the text transformations vs. much more capable (but costly) LLMs via API, etc. Ideally I'd even like to support "bring your own LLM" by enabling the ability to talk with LMStudio or Ollama. Lot to consider there.

## Things we need to be careful about

- Preserving prompt syntax such as `(green:1.2)` when transforming text.
- Keeping the limitations of different models in mind (particularly diffusion CLIP input vs. LLM input). You can dump a whole damn novel into modern LLMs as a prompt and that's fine, but that won't yield great results from say Stable Diffusion (which works better with certain kinds of prompts compared to say FLUX).