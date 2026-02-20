# Suggested Rate Limits & Content Length Limits

Surveyed 2026-02-19. Reference: `backend-security-review.md` findings #2, #3, #4.

---

## Rate Limits

Already rate-limited: `POST /api/auth/login`, `POST /api/auth/register` (10 req/min via Redis sliding window).

Everything else is wide open. Grouped by severity:

### Tier 1 — Expensive / cost-bearing operations (strictest limits)

| Endpoint                       | Why                                                      |
| ------------------------------ | -------------------------------------------------------- |
| `llm.transform`                | Every call hits an external LLM API and costs real money |
| `POST /api/auth/api-keys/test` | Makes external API calls to OpenAI/Anthropic/Vertex/Grok |

### Tier 2 — Write operations (moderate limits)

| Endpoint                                      | Why                        |
| --------------------------------------------- | -------------------------- |
| `blocks.create`                               | Creates DB rows + revision |
| `stacks.create`                               | Creates DB rows + revision |
| `stacks.duplicate`                            | Creates full stack copy    |
| `stacks.createSnapshot`                       | Creates snapshot row       |
| `wildcards.create`                            | Creates DB rows            |
| `stackTemplates.create` / `createFromStack`   | Creates template rows      |
| `stackFolders.create` / `blockFolders.create` | Creates folder rows        |
| `revisions.create`                            | Creates revision rows      |
| `POST /api/auth/integration-api-key`          | Generates API key          |

### Tier 3 — Bulk reads / search (generous limits)

| Endpoint                                                                                                | Why                                                 |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `blocks.search`, `stacks.search`, `stacks.searchSnapshots`, `wildcards.search`, `stackTemplates.search` | ILIKE queries can be expensive                      |
| `blocks.list`, `stacks.list`, `stacks.listWithFolders`, etc.                                            | Paginated reads                                     |
| Integration endpoints (`/api/integrations/comfyui/*`)                                                   | Already authed with API key but unthrottled         |
| SSE endpoint (`/api/integrations/comfyui/events`)                                                       | Long-lived connection, no connection limit per user |

### Tier 4 — Updates/deletes (moderate, same as writes)

| Endpoint                                                           | Why                       |
| ------------------------------------------------------------------ | ------------------------- |
| All `.update` / `.delete` mutations                                | Standard write protection |
| `stacks.addBlock`, `removeBlock`, `reorderBlocks`, `updateContent` | Frequent but still writes |

---

## Content Length Limits

Fields that currently have limits (good): `stacks.update.notes` (4000), `stacks.createSnapshot.name` (255), `stacks.createSnapshot.notes` (4000), `stackTemplates.create.name` (255), `stackTemplates.create.notes` (4000), `blocks.getByIds.ids` (array max 100).

Everything else is unbounded.

### String fields → matching DB varchar columns

| Router                       | Field         | DB column type | Suggested limit |
| ---------------------------- | ------------- | -------------- | --------------- |
| `blocks.create/update`       | `uuid`        | varchar(255)   | 255             |
| `blocks.create/update`       | `displayId`   | varchar(255)   | 255             |
| `blocks.create/update`       | `name`        | varchar(255)   | 255             |
| `blocks.create/update`       | `notes`       | varchar(4000)  | 4000            |
| `stacks.create/update`       | `uuid`        | varchar(255)   | 255             |
| `stacks.create/update`       | `displayId`   | varchar(255)   | 255             |
| `stacks.create/update`       | `name`        | varchar(255)   | 255             |
| `wildcards.create/update`    | `uuid`        | varchar(255)   | 255             |
| `wildcards.create/update`    | `displayId`   | varchar(255)   | 255             |
| `wildcards.create/update`    | `name`        | varchar(255)   | 255             |
| `wildcards.create/update`    | `format`      | varchar(50)    | 50              |
| `stackFolders.create/update` | `name`        | varchar(255)   | 255             |
| `stackFolders.create/update` | `description` | varchar(512)   | 512             |
| `blockFolders.create/update` | `name`        | varchar(255)   | 255             |
| `blockFolders.create/update` | `description` | varchar(512)   | 512             |

### String fields → lookup params (not stored but should still be bounded)

| Router                   | Field                    | Suggested limit |
| ------------------------ | ------------------------ | --------------- |
| `stacks.getByUuid`       | `uuid`                   | 255             |
| `stacks.getByDisplayId`  | `displayId`              | 255             |
| `blocks.getByUuid`       | `uuid`                   | 255             |
| `wildcards.getByUuid`    | `uuid`                   | 255             |
| All `.search` procedures | `query`                  | 500             |
| Integration routes       | `display_id` query param | 255             |
| `POST /api/auth/login`   | `token` body field       | 255             |

### TEXT fields → no DB limit, need application limit

| Router                                                                        | Field            | Suggested limit                         |
| ----------------------------------------------------------------------------- | ---------------- | --------------------------------------- |
| `blocks.create/update` → `text` (stored as revision)                          | Block content    | 100,000                                 |
| `revisions.create` → `text`                                                   | Revision content | 100,000                                 |
| `wildcards.create/update` → `content`                                         | Wildcard content | 1,000,000 (wildcard files can be large) |
| `stacks.addBlock/removeBlock/reorderBlocks/updateContent` → `renderedContent` | Rendered prompt  | 500,000                                 |
| `stacks.createSnapshot` → `renderedContent`                                   | Snapshot content | 500,000                                 |
| `users.setScratchpad` → `content`                                             | Scratchpad       | 100,000                                 |
| `llm.transform` → `text`                                                      | LLM input        | 50,000                                  |

### Array fields → no size limits

| Router                                   | Field                          | Suggested limit                   |
| ---------------------------------------- | ------------------------------ | --------------------------------- |
| `stacks.create`                          | `blockIds`                     | 500                               |
| `stacks.reorderBlocks`                   | `blockIds`                     | 500                               |
| `stackTemplates.create/update`           | `blockIds`, `disabledBlockIds` | 500                               |
| `blocks.create/update` / `blocks.search` | `labels`                       | 50 (+ individual label max 255)   |
| `llm.transform`                          | `wildcards`                    | 100 (+ individual string max 255) |

### JSON/meta fields → no size limits

| Router                    | Field  | Suggested limit                                                              |
| ------------------------- | ------ | ---------------------------------------------------------------------------- |
| `blocks.create/update`    | `meta` | Validate with `z.string().max(10000)` on serialized size, or just limit keys |
| `wildcards.create/update` | `meta` | Same                                                                         |
| `revisions.create`        | `meta` | Same                                                                         |
