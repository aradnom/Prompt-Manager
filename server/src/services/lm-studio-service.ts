import { LLMConfig } from '@server/config'
import { TransformRequest, TransformResponse } from './llm-service'

export class LMStudioService {
  constructor(private config: LLMConfig) {
    console.debug('✓ LM Studio service initialized')
    console.debug(`  URL: ${this.config.lmStudioUrl}`)
  }

  async transform(request: TransformRequest, systemPrompt: string): Promise<TransformResponse> {
    try {
      const response = await fetch(`${this.config.lmStudioUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: request.text,
            },
          ],
          temperature: 0.7,
          max_tokens: this.config.maxTokens,
        }),
      })

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
      let result = data.choices?.[0]?.message?.content

      if (!result) {
        throw new Error('No response from LM Studio')
      }

      // Strip out <think></think> tags and their contents (reasoning model artifacts)
      result = result.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

      // For explore and generate operations, parse the numbered list into an array
      if (request.operation === 'explore' || request.operation === 'generate' || request.operation === 'generate-wildcard') {
        const lines = result.trim().split('\n')
        const variations = lines
          .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
          .filter((line: string) => line.length > 0)

        return {
          result: variations,
          target: 'lm-studio',
        }
      }

      return {
        result: result.trim(),
        target: 'lm-studio',
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`LM Studio request failed: ${error.message}`)
      }
      throw error
    }
  }
}
