import { VertexAI } from '@google-cloud/vertexai'
import { LLMConfig } from '@server/config'
import fs from 'fs'
import path from 'path'
import { TransformRequest, TransformResponse } from './llm-service'

export class VertexService {
  private vertexAI: VertexAI | null = null

  constructor(private config: LLMConfig) {
    if (this.config.vertex.projectId) {
      console.debug('Initializing Vertex AI with config:', {
        project: this.config.vertex.projectId,
        location: this.config.vertex.location,
        keyFile: this.config.vertex.serviceAccountJson || 'undefined'
      })
      
      let authOptions: unknown = undefined

      if (this.config.vertex.serviceAccountJson) {
        const resolvedPath = path.resolve(process.cwd(), this.config.vertex.serviceAccountJson)
        console.debug(`Debug: CWD is ${process.cwd()}`)
        console.debug(`Checking key file at: ${resolvedPath}`)
        if (fs.existsSync(resolvedPath)) {
          console.debug('✓ Key file found')
          // Read the file content directly to pass as object, avoiding potential path resolution issues in SDK
          try {
            const keyFileContent = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
            authOptions = {
              credentials: {
                client_email: keyFileContent.client_email,
                private_key: keyFileContent.private_key,
              },
              scopes: ['https://www.googleapis.com/auth/cloud-platform']
            }
            console.debug('✓ Credentials loaded from file')
          } catch (e) {
            console.error('✗ Failed to read key file:', e)
          }
        } else {
          console.error('✗ Key file NOT found at path')
        }
      }

      this.vertexAI = new VertexAI({
        project: this.config.vertex.projectId,
        location: this.config.vertex.location,
        apiEndpoint: this.config.vertex.apiEndpoint,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        googleAuthOptions: authOptions as any
      })
    }
  }

  async transform(request: TransformRequest, systemPrompt: string): Promise<TransformResponse> {
    if (!this.vertexAI) {
      throw new Error('Vertex AI is not configured (missing project ID)')
    }

    const model = this.vertexAI.getGenerativeModel({
      model: this.config.vertex.model,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        thinking_level: 'MINIMAL',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      systemInstruction: systemPrompt,
    })

    try {
      console.debug(`Attempting to generate content with model: ${this.config.vertex.model} in project: ${this.config.vertex.projectId}, location: ${this.config.vertex.location}`)
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: request.text }] }],
      })

      const response = result.response
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text

      if (!text) {
        throw new Error('No response from Vertex AI')
      }

      // For explore operation, parse the numbered list into an array
      if (request.operation === 'explore') {
        const lines = text.trim().split('\n')
        const variations = lines
          .map(line => line.replace(/^\d+\.\s*/, '').trim())
          .filter(line => line.length > 0)

        return {
          result: variations,
          target: 'vertex',
        }
      }

      return {
        result: text.trim(),
        target: 'vertex',
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Vertex AI request failed: ${error.message}`)
      }
      throw error
    }
  }
}
