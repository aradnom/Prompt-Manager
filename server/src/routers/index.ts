import { router } from "@server/trpc";
import { blocksRouter } from "@server/routers/blocks";
import { revisionsRouter } from "@server/routers/revisions";
import { stacksRouter } from "@server/routers/stacks";
import { typesRouter } from "@server/routers/types";
import { llmRouter } from "@server/routers/llm";
import { configRouter } from "@server/routers/config";
import { wildcardsRouter } from "@server/routers/wildcards";

export const appRouter = router({
  blocks: blocksRouter,
  revisions: revisionsRouter,
  stacks: stacksRouter,
  types: typesRouter,
  llm: llmRouter,
  config: configRouter,
  wildcards: wildcardsRouter,
});

export type AppRouter = typeof appRouter;
