import { LLMConfig, type LLMTarget } from '@server/config'
import { VertexServiceGenAI } from './vertex-service-genai'
import { OpenAIService } from './openai-service'
import { AnthropicService } from './anthropic-service'
import { LMStudioService } from './lm-studio-service'
import { GrokService } from './grok-service'

export type { LLMTarget } from '@server/config'
export type OutputStyle = 't5' | 'clip' | null

export interface TransformRequest {
  text: string
  operation: string
  target: LLMTarget
  style?: OutputStyle
}

export interface TransformResponse {
  result: string | string[]
  target: LLMTarget
}

export class LLMService {
  private vertexService: VertexServiceGenAI
  private openaiService: OpenAIService
  private anthropicService: AnthropicService
  private lmStudioService: LMStudioService
  private grokService: GrokService

  constructor(private config: LLMConfig) {
    this.vertexService = new VertexServiceGenAI(config)
    this.openaiService = new OpenAIService(config)
    this.anthropicService = new AnthropicService(config)
    this.lmStudioService = new LMStudioService(config)
    this.grokService = new GrokService(config)
  }

  async transform(request: TransformRequest, userApiKey?: string, userModel?: string): Promise<TransformResponse> {
    // Validate target is allowed
    if (!this.config.allowedTargets.has(request.target)) {
      throw new Error(`LLM target '${request.target}' is not enabled`)
    }

    // Route to appropriate handler
    switch (request.target) {
      case 'lm-studio':
        return this.lmStudioService.transform(request, this.buildSystemPrompt(request.operation, request.text, request.style))
      case 'vertex':
        return this.vertexService.transform(request, this.buildSystemPrompt(request.operation, request.text, request.style), userApiKey, userModel)
      case 'openai':
        return this.openaiService.transform(request, this.buildSystemPrompt(request.operation, request.text, request.style), userApiKey, userModel)
      case 'anthropic':
        return this.anthropicService.transform(request, this.buildSystemPrompt(request.operation, request.text, request.style), userApiKey, userModel)
      case 'grok':
        return this.grokService.transform(request, this.buildSystemPrompt(request.operation, request.text, request.style), userApiKey, userModel)
      default:
        throw new Error(`Unknown LLM target: ${request.target}`)
    }
  }

  private buildSystemPrompt(operation: string, requestText: string, style?: OutputStyle): string {
    let basePrompt = ''

    switch (operation) {
      case 'more-descriptive':
        basePrompt = `Make the passed text approximately ${requestText.length * 2} characters in length while also making it more descriptive and nuanced. Return only the transformed text without any preamble or explanation. The result text should be the same type of text as the input text (e.g. if the input text is a descriptive noun, the result should be as well, if the input text is describing an action, the result text should as well, etc.)`
        break

      case 'less-descriptive':
        basePrompt = `Make the passed text approximately ${Math.floor(requestText.length / 2)} characters in length while also making it more concise and less descriptive. Return only the transformed text without any preamble or explanation. The result text should be the same type of text as the input text (i.e. if the input text is a descriptive noun, the result should be as well, if the input text is describing an action, the result text should as well, etc.). Make sure to focus on retaining the original subject of the input text (e.g. if the input text is mainly describing an apple as the primary focus of the text, the result text should still retain the apple as the primary focus)`
        break

      case 'variation-slight':
        basePrompt = `Create a slightly different variation of the passed text. Keep the same length (approximately ${requestText.length} characters), meaning, and core message, but rephrase it with minor word changes and slight structural adjustments. Return only the transformed text without any preamble or explanation. The result text should be the same type of text as the input text.`
        break

      case 'variation-fair':
        basePrompt = `Create a fairly different variation of the passed text. Keep a similar length (approximately ${requestText.length} characters) and the same general meaning, but use different vocabulary, sentence structures, and phrasing approaches while maintaining the core concept. Return only the transformed text without any preamble or explanation. The result text should be the same type of text as the input text.`
        break

      case 'variation-very':
        basePrompt = `Create a very different variation of the passed text. Keep a similar length (approximately ${requestText.length} characters) and the same general theme or subject matter, but express it in a significantly different way with different vocabulary, structure, perspective, or framing. Be creative while still addressing the same underlying topic. Return only the transformed text without any preamble or explanation. The result text should be the same type of text as the input text.`
        break

      case 'explore':
        basePrompt = `Generate exactly 5 variations of the passed text. Each variation should be approximately ${requestText.length} characters in length and should be the same type of text as the input. The variations should be progressively more different:
- Variation 1: Very similar to the original, with only minor word changes
- Variation 2: Somewhat different, with moderate vocabulary and structural changes
- Variation 3: Fairly different, with significant rephrasing while maintaining the core concept
- Variation 4: Very different, exploring alternative perspectives or framings
- Variation 5: Extremely different, creative reinterpretation while still addressing the same underlying theme

Format your response as exactly 5 lines, with each variation on its own line, numbered 1-5. Do not include any preamble, explanation, or additional text. Example format:
1. [first variation]
2. [second variation]
3. [third variation]
4. [fourth variation]
5. [fifth variation]`
        break

      case 'generate':
        basePrompt = `The user will provide a concept or idea. Generate exactly 5 different, descriptive suggestions based on that concept. Each suggestion should be a specific example or instance of the concept provided.

Guidelines:
- For simple concrete concepts (like "landscape", "clothing", "colors"), provide short, specific examples (e.g., "mountains", "sweater", "crimson")
- For complex or abstract concepts (like "action movie scenarios", "philosophical ideas"), provide more detailed descriptions
- Each suggestion should be appropriately detailed for the concept type, but never exceed 500 characters for each suggestion
- Make the suggestions diverse and interesting, particularly if the concept is very general
- Return only concrete, usable suggestions without explanations or meta-commentary

Format your response as exactly 5 lines, with each suggestion on its own line, numbered 1-5. Do not include any preamble, explanation, or additional text. Example format:
1. [first suggestion]
2. [second suggestion]
3. [third suggestion]
4. [fourth suggestion]
5. [fifth suggestion]`
        break

      case 'generate-wildcard':
        basePrompt = `The user will provide a concept or category. Generate exactly 20 different values that would be appropriate for interpolation as wildcard values in that category. Each value should be a specific, concrete example or instance.

Guidelines:
- These are intended as interpolated values in text, so keep them relatively short and focused
- For simple concrete concepts (like "colors", "emotions", "weather"), provide brief, specific values (e.g., "crimson", "melancholic", "overcast")
- For more complex concepts (like "fantasy locations", "character motivations"), provide appropriately detailed descriptions
- Each value should be appropriately detailed for the concept type, but NEVER exceed 250 characters
- Make the values diverse and interesting to provide good variety
- Return only concrete, usable values without explanations or meta-commentary
- Think of each value as something that could be dropped into a sentence or prompt

Format your response as exactly 20 lines, with each value on its own line, numbered 1-20. Do not include any preamble, explanation, or additional text. Example format:
1. [first value]
2. [second value]
3. [third value]
...
20. [twentieth value]`
        break

      case 'auto-label':
        basePrompt = `The user will provide some text content. Analyze the text and generate both a descriptive title and a code-friendly identifier.

Return your response as valid JSON with this exact structure:
{
  "title": "Your Descriptive Title Here",
  "code": "your-code-identifier"
}

Guidelines for title:
- Concise and descriptive
- Maximum 100 characters
- Use title case (capitalize major words)
- Focus on the main subject or theme

Guidelines for code:
- Lowercase only
- Use hyphens to separate words
- Maximum 5 words
- No special characters except hyphens
- Should be a shortened, code-friendly version of the title

Examples:
Input: "a serene mountain landscape at dawn with mist rolling through the valleys"
Output: {"title": "Mountain Landscape at Dawn with Valley Mist", "code": "mountain-landscape-dawn"}

Input: "character with dark intentions seeking revenge against those who wronged them"
Output: {"title": "Vengeful Character with Dark Intentions", "code": "vengeful-character"}

Input: "emotions"
Output: {"title": "Emotions", "code": "emotions"}`
        break

      default:
        throw new Error(`Unknown operation: ${operation}`)
    }

    // Append style-specific instructions if a style is provided
    if (style === 't5') {
      console.debug('T5 style used in LLM transform')
      basePrompt += '\n\n**Output Formatting:**\nFormat your output for **T5-encoded diffusion models** such as FLUX. Your output should consist of **descriptive, natural language prose**.\n\n**Core Constraints:**\n1. **Format:** Use **complete, grammatically correct sentences**. Use prepositions (on, under, next to) to explicitly define relationships.\n2. **Ordering Strategy:** Use a **Context-Adaptive Inverted Pyramid**.\n* **The "First Sentence" Rule:** The most critical visual information must appear in the first sentence.\n* **Partial Prompt Handling:** You will often be asked to generate only a *segment* of a full prompt (e.g., just the lighting, just a texture, or just a character). **Do not invent missing elements** (like a background) to fill a template.\n* **Priority:** If generating a partial chunk, stack the most defining adjectives and nouns of that specific concept at the start, followed by finer details.\n3. **Strict Visual Adherence:** Describe **only observable physical attributes**.\n* *Negative Example:* "An eerie atmosphere." (Too abstract).\n* *Positive Correction:* "Dim, desaturated blue lighting with thick, low-hanging fog."\n4. **Tone:** Use **objective, descriptive prose**. Describe the scene (or element) as if writing a literal caption for a photograph.'
    } else if (style === 'clip') {
      basePrompt += '\n\n**Output Formatting:**\nFormat your output for **CLIP-encoded diffusion models** such as Stable Diffusion. Your goal is to convert concepts into **token-efficient, comma-separated keyword lists**.\n\n**Core Constraints:**\n1. **Format:** Output strictly as a comma-separated list of tags. Remove all linguistic "glue" (articles, prepositions, conjunctions) unless essential for composition.\n2. **Ordering Strategy:** Utilize **Weighted Ordering**. Place the most semantically significant keywords at the start of the string. Do not enforce a fixed category template (e.g., do not force "Subject first" if the input is purely about lighting); simply prioritize the most defining aspects of the specific request.\n3. **Economy of Tokens:** Be concise. Maximize information density per token. Avoid flowery prose or redundant synonyms.\n4. **Strict Visual Adherence:** Describe **only observable physical attributes**.\n* *Negative Example:* "Anxious personality," "Ancient history," "Evil aura."\n* *Positive Correction:* "Sweating brow, wide eyes, trembling hands," "Cracked stone, moss overgrowth," "Sharp angular shadows, red rim lighting."\n* *Rule:* If it cannot be captured by a camera lens, do not include it.'
      console.debug('CLIP style used in LLM transform')
    } else {
      console.debug('No style used in LLM transform')
    }

    return basePrompt
  }
}
