import { LLMConfig } from '@server/config'
import { TransformRequest, TransformResponse } from './llm-service'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'

export class VertexServiceGenAI {
  private client: GoogleGenAI | null = null

  constructor(private config: LLMConfig) {
    if (this.config.vertex.apiKey) {
      console.debug('Initializing Vertex AI (GenAI SDK) with API Key')
      try {
        // Casting to any because 'vertexai' and 'apiVersion' might not be in the public types yet
        // but are required for this specific auth flow to work.
        this.client = new GoogleGenAI({
          apiKey: this.config.vertex.apiKey,
          // This HAS TO BE lowercase 'vertexai', 'vertexAI' or anything else
          // will not work, I don't care what the package types or the docs say
          vertexai: true, 
          apiVersion: 'v1'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        console.debug('✓ GoogleGenAI client initialized')
      } catch (e) {
        console.error('Failed to initialize GenAI client:', e)
      }
    } else {
      console.warn('Vertex AI API key is missing. SDK initialization skipped.')
    }
  }

  async transform(request: TransformRequest, systemPrompt: string, userApiKey?: string, userModel?: string): Promise<TransformResponse> {
    // Use user's API key if provided, otherwise use server client
    let clientToUse: GoogleGenAI | null = this.client

    if (userApiKey) {
      console.debug('Using user-provided Vertex AI API key')
      try {
        clientToUse = new GoogleGenAI({
          apiKey: userApiKey,
          vertexai: true,
          apiVersion: 'v1'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      } catch (error) {
        console.error('Failed to initialize GenAI client with user API key:', error)
        throw new Error('Failed to initialize with user API key')
      }
    }

    if (!clientToUse) {
      throw new Error('Vertex AI (GenAI SDK) is not configured')
    }

    // Use user's model if provided, otherwise use server config model
    const modelId = userModel || this.config.vertex.model

    // Args that only work with specific models
    let modelSpecificArgs = {};

    // thinkingLevel only applies to Gemini 3 models currently
    // MINIMAL and MEDIUM only apply to Flash, so in theory LOW and HIGH apply
    // to Pro...?
    // Also, you can't turn thinking off in Pro
    if (modelId.includes('3-flash')) {
      modelSpecificArgs = {
        thinkingConfig: {
          includeThoughts: false,
          thinkingLevel: ThinkingLevel.MINIMAL
        }
      }
    }

    try {
      console.debug(`GenAI SDK: Generating content with model: ${modelId}`)

      const response = await clientToUse.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: request.text }] }],
        config: {
          systemInstruction: systemPrompt,
          generationConfig: {
            maxOutputTokens: this.config.maxTokens,
            temperature: 0.7,
          },
          thinkingConfig: {
            includeThoughts: false,
          },
          ...modelSpecificArgs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      })

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        throw new Error('No response from Vertex AI (GenAI SDK)')
      }

      // For explore and generate operations, parse the numbered list into an array
      if (request.operation === 'explore' || request.operation === 'generate' || request.operation === 'generate-wildcard') {
        const lines = text.trim().split('\n')
        const variations = lines
          .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
          .filter((line: string) => line.length > 0)

        return {
          result: variations,
          target: 'vertex',
        }
      }

      return {
        result: text.trim(),
        target: 'vertex',
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'message' in error) {
         console.error('GenAI SDK Error:', JSON.stringify(error, null, 2))
      }
      
      if (error instanceof Error) {
        throw new Error(`Vertex AI (GenAI SDK) request failed: ${error.message}`)
      }
      throw new Error('Vertex AI (GenAI SDK) request failed with unknown error')
    }
  }
}
