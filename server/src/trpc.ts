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
    // Get userId from session (established via login/register)
    const userId = req.session?.userId

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

// Middleware to check if user is authenticated
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new Error('Not authenticated')
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // Now guaranteed to be defined
    },
  })
})

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(isAuthed)
