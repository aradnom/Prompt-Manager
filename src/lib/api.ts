import { trpc } from './trpc'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@server/routers'

export const api = trpc

export type RouterOutput = inferRouterOutputs<AppRouter>

export default api