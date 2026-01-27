import { LLMConfig } from '@server/config'
import { TransformRequest, TransformResponse } from './llm-service'
import OpenAI from 'openai'

export class GrokService {
  private client: OpenAI | null = null

  constructor(private config: LLMConfig) {
    if (this.config.grok.apiKey) {
      console.debug('Initializing Grok client with API Key')
      try {
        this.client = new OpenAI({
          apiKey: this.config.grok.apiKey,
          baseURL: 'https://api.x.ai/v1',
        })
        console.debug('✓ Grok client initialized')
      } catch (e) {
        console.error('Failed to initialize Grok client:', e)
      }
    } else {
      console.warn('Grok API key is missing. SDK initialization skipped.')
    }
  }

  async transform(request: TransformRequest, systemPrompt: string, userApiKey?: string, userModel?: string): Promise<TransformResponse> {
    // Use user's API key if provided, otherwise use server client
    let clientToUse: OpenAI | null = this.client

    if (userApiKey) {
      console.debug('Using user-provided Grok API key')
      try {
        clientToUse = new OpenAI({
          apiKey: userApiKey,
          baseURL: 'https://api.x.ai/v1',
        })
      } catch (error) {
        console.error('Failed to initialize Grok client with user API key:', error)
        throw new Error('Failed to initialize with user API key')
      }
    }

    if (!clientToUse) {
      throw new Error('Grok is not configured')
    }

    // Use user's model if provided, otherwise use server config model
    const modelId = userModel || this.config.grok.model

    try {
      console.debug(`Grok: Generating content with model: ${modelId}`)

      const response = await clientToUse.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.text }
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.7,
      })

      const text = response.choices?.[0]?.message?.content

      if (!text) {
        throw new Error('No response from Grok')
      }

      // For explore and generate operations, parse the numbered list into an array
      if (request.operation === 'explore' || request.operation === 'generate' || request.operation === 'generate-wildcard') {
        const lines = text.trim().split('\n')
        const variations = lines
          .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
          .filter((line: string) => line.length > 0)

        return {
          result: variations,
          target: 'grok',
        }
      }

      return {
        result: text.trim(),
        target: 'grok',
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'message' in error) {
         console.error('Grok Error:', JSON.stringify(error, null, 2))
      }

      if (error instanceof Error) {
        throw new Error(`Grok request failed: ${error.message}`)
      }
      throw new Error('Grok request failed with unknown error')
    }
  }
}
