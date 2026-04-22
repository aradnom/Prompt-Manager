import { router } from "@server/trpc";
import { blocksRouter } from "@server/routers/blocks";
import { blockFoldersRouter } from "@server/routers/block-folders";
import { stackFoldersRouter } from "@server/routers/stack-folders";
import { revisionsRouter } from "@server/routers/revisions";
import { stacksRouter } from "@server/routers/stacks";
import { stackTemplatesRouter } from "@server/routers/stack-templates";
import { typesRouter } from "@server/routers/types";
import { llmRouter } from "@server/routers/llm";
import { configRouter } from "@server/routers/config";
import { wildcardsRouter } from "@server/routers/wildcards";
import { usersRouter } from "@server/routers/users";
import { integrationsRouter } from "@server/routers/integrations";
import { syncRouter } from "@server/routers/sync";

export const appRouter = router({
  blocks: blocksRouter,
  blockFolders: blockFoldersRouter,
  stackFolders: stackFoldersRouter,
  revisions: revisionsRouter,
  stacks: stacksRouter,
  stackTemplates: stackTemplatesRouter,
  types: typesRouter,
  llm: llmRouter,
  config: configRouter,
  wildcards: wildcardsRouter,
  users: usersRouter,
  integrations: integrationsRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
