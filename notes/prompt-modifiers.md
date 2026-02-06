# Diffusion Model Prompt Modifiers

Common inline text modifiers used with diffusion models (Stable Diffusion, etc.)

## Weight/Emphasis

| Syntax       | Description                                                  |
| ------------ | ------------------------------------------------------------ |
| `(term)`     | Increases emphasis (1.1x in SD/A1111)                        |
| `((term))`   | Stacked emphasis (1.21x)                                     |
| `[term]`     | Decreases emphasis (0.9x in A1111, varies by implementation) |
| `(term:1.2)` | Explicit weight (SD/A1111/ComfyUI)                           |
| `term:1.2`   | Weight without parens (some implementations)                 |

## Blending/Interpolation

| Syntax              | Description                                    |
| ------------------- | ---------------------------------------------- |
| `[term1\|term2]`    | Alternating (flips between terms each step)    |
| `[term1:term2:0.5]` | Prompt scheduling/switching at step percentage |
| `[term1:0.5]`       | Start term at 50% of steps                     |
| `[:term1:0.5]`      | Stop term at 50% of steps                      |
| `(term1:term2:0.5)` | Blend/interpolate between terms (some UIs)     |

## BREAK/Separation

| Syntax  | Description                                               |
| ------- | --------------------------------------------------------- |
| `BREAK` | Forces a new chunk in the 77-token CLIP limit (A1111)     |
| `AND`   | Compositional prompting, processes as separate conditions |

## LoRA/Embedding Invocation

| Syntax                   | Description  |
| ------------------------ | ------------ |
| `<lora:name:weight>`     | LoRA loading |
| `<hypernet:name:weight>` | Hypernetwork |
| `<lyco:name:weight>`     | LyCORIS      |

Textual inversion embeddings are usually just the filename or wrapped in angle brackets.

## Less Common

| Syntax          | Description                                 |
| --------------- | ------------------------------------------- |
| `term::2`       | Repeat weight syntax (some implementations) |
| `from:to:steps` | Prompt editing over specific step ranges    |

## Notes

- The exact syntax varies between UIs (A1111, ComfyUI, InvokeAI, etc.)
- A1111's syntax is the most widely adopted
