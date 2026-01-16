import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import type { IStorageAdapter } from '@server/adapters/storage-adapter.interface'
import type { LLMService } from '@server/services/llm-service'

import type { ServerConfig } from '@server/config'

export interface Context {
  storage: IStorageAdapter
  llmService: LLMService
  config: ServerConfig
  userId?: number
}

export const createContext = (storage: IStorageAdapter, llmService: LLMService, config: ServerConfig) => {
  return ({ req }: CreateExpressContextOptions): Context => {
    const userId = req.headers['x-user-id']
      ? parseInt(req.headers['x-user-id'] as string, 10)
      : 1

    return {
      storage,
      llmService,
      config,
      userId,
    }
  }
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure
