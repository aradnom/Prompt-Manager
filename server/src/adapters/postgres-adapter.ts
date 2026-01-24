import { Kysely, PostgresDialect, Selectable, Updateable, sql } from 'kysely'
import { Pool } from 'pg'
import crypto from 'crypto'
import type { Database } from '@/types/database'
import type {
  Block,
  BlockRevision,
  BlockStack,
  BlockWithRevisions,
  StackWithBlocks,
  CreateBlockInput,
  UpdateBlockInput,
  CreateStackInput,
  UpdateStackInput,
  CreateRevisionInput,
  Type,
  StackRevision,
  Wildcard,
  CreateWildcardInput,
  UpdateWildcardInput,
} from '@/types/schema'
import type { IStorageAdapter, GetStackOptions, SearchBlocksOptions, SearchStacksOptions, SearchWildcardsOptions, User, CreateUserInput } from '@server/adapters/storage-adapter.interface'

export class PostgresStorageAdapter implements IStorageAdapter {
  private db: Kysely<Database>

  constructor(connectionString: string) {
    const pool = new Pool({
      connectionString,
    })

    this.db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    })
  }

  async initialize(): Promise<void> {
    await this.db.selectFrom('users').selectAll().limit(1).execute()
  }

  async getUserIdByApiKey(apiKey: string): Promise<number | null> {
    const result = await this.db
      .selectFrom('users')
      .select('id')
      .where('api_key', '=', apiKey)
      .executeTakeFirst()

    return result?.id ?? null
  }

  async getUserById(id: number): Promise<User | null> {
    const result = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      tokenHash: result.token_hash,
      accountData: result.account_data as Record<string, string> | null,
      apiKey: result.api_key,
    }
  }

  async getUserByTokenHash(tokenHash: string): Promise<User | null> {
    const result = await this.db
      .selectFrom('users')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst()

    if (!result) {
      return null
    }

    return {
      id: result.id,
      tokenHash: result.token_hash,
      accountData: result.account_data as Record<string, string> | null,
      apiKey: result.api_key,
    }
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const now = new Date()

    const result = await this.db
      .insertInto('users')
      .values({
        token_hash: input.tokenHash,
        account_data: JSON.stringify(input.accountData),
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return {
      id: result.id,
      tokenHash: result.token_hash,
      accountData: result.account_data as Record<string, string> | null,
      apiKey: result.api_key,
    }
  }

  async createBlock(input: CreateBlockInput): Promise<Block> {
    const now = new Date()
    
    return await this.db.transaction().execute(async (trx) => {
      // 1. Create the block entity
      const blockResult = await trx
        .insertInto('blocks')
        .values({
          uuid: input.uuid,
          name: input.name ?? null,
          display_id: input.displayId,
          type_id: input.typeId ?? null,
          labels: input.labels ?? [],
          user_id: input.userId ?? null,
          meta: input.meta ? JSON.stringify(input.meta) : null,
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // 2. Create the initial revision
      const revisionResult = await trx
        .insertInto('block_revisions')
        .values({
          block_id: blockResult.id,
          text: input.text,
          user_id: input.userId ?? null,
          meta: input.meta ? JSON.stringify(input.meta) : null,
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // 3. Set the active_revision_id
      const updatedBlockResult = await trx
        .updateTable('blocks')
        .set({
          active_revision_id: revisionResult.id,
          updated_at: now,
        })
        .where('id', '=', blockResult.id)
        .returningAll()
        .executeTakeFirstOrThrow()

      // Fetch type if needed
      let type: Type | null = null
      if (updatedBlockResult.type_id) {
        const typeResult = await trx
            .selectFrom('types')
            .selectAll()
            .where('id', '=', updatedBlockResult.type_id)
            .executeTakeFirst()
        if (typeResult) {
            type = this.mapType(typeResult)
        }
      }

      // Return combined result
      const block = this.mapBlock(updatedBlockResult, type)
      block.text = revisionResult.text
      return block
    })
  }

  async getBlock(id: number): Promise<Block | null> {
    const result = await this.db
      .selectFrom('blocks')
      .leftJoin('types', 'blocks.type_id', 'types.id')
      .selectAll('blocks')
      .select((eb) => [
        // First try to get text from active_revision_id if set, otherwise get latest revision
        eb.fn.coalesce(
          eb
            .selectFrom('block_revisions as active_rev')
            .select('active_rev.text')
            .whereRef('active_rev.id', '=', 'blocks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('block_revisions')
            .select('text')
            .whereRef('block_revisions.block_id', '=', 'blocks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('text'),
      ])
      .select([
        'types.id as type_id_joined',
        'types.name as type_name',
        'types.description as type_description',
      ])
      .where('blocks.id', '=', id)
      .executeTakeFirst()

    if (!result || result.text === null) return null

    const type = result.type_id_joined ? {
      id: result.type_id_joined,
      name: result.type_name!,
      description: result.type_description,
    } : null

    const block = this.mapBlock(result, type)
    block.text = result.text!
    return block
  }

  async getBlockByUuid(uuid: string): Promise<Block | null> {
    const result = await this.db
      .selectFrom('blocks')
      .leftJoin('types', 'blocks.type_id', 'types.id')
      .selectAll('blocks')
      .select((eb) => [
        // First try to get text from active_revision_id if set, otherwise get latest revision
        eb.fn.coalesce(
          eb
            .selectFrom('block_revisions as active_rev')
            .select('active_rev.text')
            .whereRef('active_rev.id', '=', 'blocks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('block_revisions')
            .select('text')
            .whereRef('block_revisions.block_id', '=', 'blocks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('text'),
      ])
      .select([
        'types.id as type_id_joined',
        'types.name as type_name',
        'types.description as type_description',
      ])
      .where('blocks.uuid', '=', uuid)
      .executeTakeFirst()

    if (!result || result.text === null) return null

    const type = result.type_id_joined ? {
      id: result.type_id_joined,
      name: result.type_name!,
      description: result.type_description,
    } : null

    const block = this.mapBlock(result, type)
    block.text = result.text!
    return block
  }

  async updateBlock(id: number, updates: UpdateBlockInput): Promise<Block> {
    return await this.db.transaction().execute(async (trx) => {
      const updateData: Updateable<Database['blocks']> = {
        updated_at: new Date(),
      }

      if (updates.name !== undefined) updateData.name = updates.name ?? null
      if (updates.displayId !== undefined) updateData.display_id = updates.displayId
      if (updates.typeId !== undefined) updateData.type_id = updates.typeId
      if (updates.labels !== undefined) updateData.labels = updates.labels
      if (updates.meta !== undefined) {
        updateData.meta = updates.meta ? JSON.stringify(updates.meta) : null
      }

      // Update block metadata first (without touching active_revision_id yet)
      let blockResult = await trx
        .updateTable('blocks')
        .set(updateData)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow()

      let text = ''

      // If text is updated, create new revision and set it as active
      if (updates.text !== undefined) {
        const now = new Date()
        const revisionResult = await trx
          .insertInto('block_revisions')
          .values({
            block_id: id,
            text: updates.text,
            user_id: blockResult.user_id,
            meta: updates.meta ? JSON.stringify(updates.meta) : null,
            created_at: now,
            updated_at: now,
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        // Explicitly set the new revision as active
        blockResult = await trx
          .updateTable('blocks')
          .set({
            active_revision_id: revisionResult.id,
            updated_at: now,
          })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()

        text = revisionResult.text
      } else {
        // Fetch current text
        const latestRev = await trx
          .selectFrom('block_revisions')
          .select('text')
          .where('block_id', '=', id)
          .orderBy('created_at', 'desc')
          .limit(1)
          .executeTakeFirstOrThrow()
        text = latestRev.text
      }

      // Fetch type
      let type: Type | null = null
      if (blockResult.type_id) {
          const typeResult = await trx.selectFrom('types').selectAll().where('id', '=', blockResult.type_id).executeTakeFirst()
          if (typeResult) {
              type = this.mapType(typeResult)
          }
      }

      const block = this.mapBlock(blockResult, type)
      block.text = text
      return block
    })
  }

  async deleteBlock(id: number): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date()

      // Get stack IDs that are affected by this block deletion
      const affectedStackRevisions = await trx
        .selectFrom('stack_revisions')
        .select('stack_id')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(sql`${id} = ANY(block_ids)` as any)
        .execute()

      const affectedStackIds = [...new Set(affectedStackRevisions.map(r => r.stack_id))]

      // Remove block from any stack revisions
      await trx
        .updateTable('stack_revisions')
        .set({
          block_ids: sql`array_remove(block_ids, ${id})`,
          updated_at: now,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(sql`${id} = ANY(block_ids)` as any)
        .execute()

      // Update the affected stacks' updated_at timestamps
      if (affectedStackIds.length > 0) {
        await trx
          .updateTable('stacks')
          .set({ updated_at: now })
          .where('id', 'in', affectedStackIds)
          .execute()
      }

      // Delete block revisions
      await trx.deleteFrom('block_revisions').where('block_id', '=', id).execute()

      // Delete the block
      await trx.deleteFrom('blocks').where('id', '=', id).execute()
    })
  }

  async listBlocks(userId?: number): Promise<Block[]> {
    let query = this.db
      .selectFrom('blocks')
      .leftJoin('types', 'blocks.type_id', 'types.id')
      .selectAll('blocks')
      .select((eb) => [
        // First try to get text from active_revision_id if set, otherwise get latest revision
        eb.fn.coalesce(
          eb
            .selectFrom('block_revisions as active_rev')
            .select('active_rev.text')
            .whereRef('active_rev.id', '=', 'blocks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('block_revisions')
            .select('text')
            .whereRef('block_revisions.block_id', '=', 'blocks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('text'),
      ])
      .select([
        'types.id as type_id_joined',
        'types.name as type_name',
        'types.description as type_description',
      ])

    if (userId !== undefined) {
      query = query.where('blocks.user_id', '=', userId)
    }

    query = query.orderBy('blocks.updated_at', 'desc')

    const results = await query.execute()

    return results.map((r) => {
      const type = r.type_id_joined ? {
          id: r.type_id_joined,
          name: r.type_name!,
          description: r.type_description
      } : null

      const block = this.mapBlock(r, type)
      block.text = r.text || ''
      return block
    })
  }

  async searchBlocks(options: SearchBlocksOptions, userId?: number): Promise<Block[]> {
    let qb = this.db
      .selectFrom('blocks')
      .leftJoin('types', 'blocks.type_id', 'types.id')
      .selectAll('blocks')
      .select((eb) => [
        // First try to get text from active_revision_id if set, otherwise get latest revision
        eb.fn.coalesce(
          eb
            .selectFrom('block_revisions as active_rev')
            .select('active_rev.text')
            .whereRef('active_rev.id', '=', 'blocks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('block_revisions')
            .select('text')
            .whereRef('block_revisions.block_id', '=', 'blocks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('text'),
      ])
      .select([
        'types.id as type_id_joined',
        'types.name as type_name',
        'types.description as type_description',
      ])

    // Text search filter
    if (options.query) {
      const searchPattern = `%${options.query}%`
      qb = qb.where((eb) =>
        eb.or([
          eb('blocks.display_id', 'ilike', searchPattern),
          eb(
            eb.fn.coalesce(
              eb
                .selectFrom('block_revisions as active_rev')
                .select('active_rev.text')
                .whereRef('active_rev.id', '=', 'blocks.active_revision_id')
                .limit(1),
              eb
                .selectFrom('block_revisions')
                .select('text')
                .whereRef('block_revisions.block_id', '=', 'blocks.id')
                .orderBy('created_at', 'desc')
                .limit(1)
            ),
            'ilike',
            searchPattern
          ),
        ])
      )
    }

    // Type filter
    if (options.typeId !== undefined) {
      qb = qb.where('blocks.type_id', '=', options.typeId)
    }

    // Label filter - match any of the provided labels
    if (options.labels && options.labels.length > 0) {
      qb = qb.where((eb) =>
        eb.or(
          options.labels!.map((label) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eb('blocks.labels', '@>', sql`ARRAY[${label}]::varchar[]` as any)
          )
        )
      )
    }

    // User filter
    if (userId !== undefined) {
      qb = qb.where('blocks.user_id', '=', userId)
    }

    qb = qb.orderBy('blocks.updated_at', 'desc')

    const results = await qb.execute()

    return results.map((r) => {
      const type = r.type_id_joined
        ? {
            id: r.type_id_joined,
            name: r.type_name!,
            description: r.type_description,
          }
        : null

      const block = this.mapBlock(r, type)
      block.text = r.text || ''
      return block
    })
  }

  async createRevision(input: CreateRevisionInput): Promise<BlockRevision> {
    return await this.db.transaction().execute(async (trx) => {
      const now = new Date()
      const result = await trx
        .insertInto('block_revisions')
        .values({
          block_id: input.blockId,
          text: input.text,
          user_id: input.userId ?? null,
          meta: input.meta ? JSON.stringify(input.meta) : null,
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // Set the new revision as active
      await trx
        .updateTable('blocks')
        .set({
          active_revision_id: result.id,
          updated_at: now,
        })
        .where('id', '=', input.blockId)
        .execute()

      return this.mapRevision(result)
    })
  }

  async getRevisions(blockId: number): Promise<BlockRevision[]> {
    const results = await this.db
      .selectFrom('block_revisions')
      .selectAll()
      .where('block_id', '=', blockId)
      .orderBy('created_at', 'desc')
      .execute()

    return results.map((r) => this.mapRevision(r))
  }

  async getRevisionsOldestFirst(blockId: number): Promise<BlockRevision[]> {
    const results = await this.db
      .selectFrom('block_revisions')
      .selectAll()
      .where('block_id', '=', blockId)
      .orderBy('created_at', 'asc')
      .execute()

    return results.map((r) => this.mapRevision(r))
  }

  async getBlockWithRevisions(blockId: number): Promise<BlockWithRevisions | null> {
    const block = await this.getBlock(blockId)
    if (!block) return null

    const revisions = await this.getRevisions(blockId)

    return {
      ...block,
      revisions,
    }
  }

  async setActiveRevision(blockId: number, revisionId: number): Promise<Block> {
    return await this.db.transaction().execute(async (trx) => {
      // Verify the revision belongs to this block
      const revision = await trx
        .selectFrom('block_revisions')
        .selectAll()
        .where('id', '=', revisionId)
        .where('block_id', '=', blockId)
        .executeTakeFirstOrThrow()

      // Update the block's active_revision_id
      const blockResult = await trx
        .updateTable('blocks')
        .set({
          updated_at: new Date(),
          active_revision_id: revisionId,
        })
        .where('id', '=', blockId)
        .returningAll()
        .executeTakeFirstOrThrow()

      const blockData = this.mapBlock(blockResult)

      // Return the block with the active revision's text
      return {
        ...blockData,
        text: revision.text,
      }
    })
  }

  async createStack(input: CreateStackInput): Promise<BlockStack> {
    return await this.db.transaction().execute(async (trx) => {
      const now = new Date()
      // 1. Create Stack
      const stackResult = await trx
        .insertInto('stacks')
        .values({
          uuid: input.uuid,
          name: input.name ?? null,
          display_id: input.displayId,
          comma_separated: input.commaSeparated ?? false,
          style: input.style ?? null,
          created_at: now,
          updated_at: now,
          user_id: input.userId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // 2. Create Initial Revision
      const revisionResult = await trx
        .insertInto('stack_revisions')
        .values({
          stack_id: stackResult.id,
          block_ids: input.blockIds ?? [],
          created_at: now,
          updated_at: now,
          user_id: input.userId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // 3. Set the active_revision_id
      const updatedStackResult = await trx
        .updateTable('stacks')
        .set({
          active_revision_id: revisionResult.id,
          updated_at: now,
        })
        .where('id', '=', stackResult.id)
        .returningAll()
        .executeTakeFirstOrThrow()

      const stack = this.mapStack(updatedStackResult)
      stack.blockIds = input.blockIds ?? []
      return stack
    })
  }

  async updateStack(id: number, updates: UpdateStackInput): Promise<BlockStack> {
    const updateData: Updateable<Database['stacks']> = {
      updated_at: new Date(),
    }

    if (updates.name !== undefined) updateData.name = updates.name ?? null
    if (updates.displayId !== undefined) updateData.display_id = updates.displayId
    if (updates.commaSeparated !== undefined) updateData.comma_separated = updates.commaSeparated
    if (updates.style !== undefined) updateData.style = updates.style

    const stackResult = await this.db
      .updateTable('stacks')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    // Get current block_ids using coalesce pattern
    const revQuery = await this.db
      .selectFrom('stacks')
      .select((eb) => [
        eb.fn.coalesce(
          eb
            .selectFrom('stack_revisions as active_rev')
            .select('active_rev.block_ids')
            .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('stack_revisions')
            .select('block_ids')
            .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('block_ids')
      ])
      .where('stacks.id', '=', id)
      .executeTakeFirst()

    const stack = this.mapStack(stackResult)
    stack.blockIds = revQuery?.block_ids || []
    return stack
  }

  async duplicateStack(id: number): Promise<BlockStack> {
    return await this.db.transaction().execute(async (trx) => {
      const now = new Date()

      // 1. Get the original stack with its active revision
      const originalStack = await trx
        .selectFrom('stacks')
        .selectAll()
        .select((eb) => [
          eb.fn.coalesce(
            eb
              .selectFrom('stack_revisions as active_rev')
              .select('active_rev.block_ids')
              .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
              .limit(1),
            eb
              .selectFrom('stack_revisions')
              .select('block_ids')
              .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
              .orderBy('created_at', 'desc')
              .limit(1)
          ).as('block_ids'),
          eb.fn.coalesce(
            eb
              .selectFrom('stack_revisions as active_rev')
              .select('active_rev.rendered_content')
              .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
              .limit(1),
            eb
              .selectFrom('stack_revisions')
              .select('rendered_content')
              .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
              .orderBy('created_at', 'desc')
              .limit(1)
          ).as('rendered_content')
        ])
        .where('stacks.id', '=', id)
        .executeTakeFirstOrThrow()

      // 2. Generate new UUID and display_id with random suffix
      const newUuid = crypto.randomUUID()
      const randomSuffix = crypto.randomBytes(3).toString('hex') // 6 character hex string
      const newDisplayId = `${originalStack.display_id}-${randomSuffix}`

      // 3. Create the new stack
      const newStackResult = await trx
        .insertInto('stacks')
        .values({
          uuid: newUuid,
          name: originalStack.name,
          display_id: newDisplayId,
          comma_separated: originalStack.comma_separated,
          style: originalStack.style,
          created_at: now,
          updated_at: now,
          user_id: originalStack.user_id,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // 4. Create initial revision with same block_ids and rendered_content
      const newRevisionResult = await trx
        .insertInto('stack_revisions')
        .values({
          stack_id: newStackResult.id,
          block_ids: originalStack.block_ids || [],
          rendered_content: originalStack.rendered_content || null,
          created_at: now,
          updated_at: now,
          user_id: originalStack.user_id,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // 5. Set the active_revision_id
      const updatedStackResult = await trx
        .updateTable('stacks')
        .set({
          active_revision_id: newRevisionResult.id,
          updated_at: now,
        })
        .where('id', '=', newStackResult.id)
        .returningAll()
        .executeTakeFirstOrThrow()

      const stack = this.mapStack(updatedStackResult)
      stack.blockIds = originalStack.block_ids || []
      return stack
    })
  }

  async setActiveStackRevision(stackId: number, revisionId: number): Promise<BlockStack> {
    return await this.db.transaction().execute(async (trx) => {
      // Verify the revision belongs to this stack
      const revision = await trx
        .selectFrom('stack_revisions')
        .selectAll()
        .where('id', '=', revisionId)
        .where('stack_id', '=', stackId)
        .executeTakeFirstOrThrow()

      // Update the stack's active_revision_id
      const stackResult = await trx
        .updateTable('stacks')
        .set({
          updated_at: new Date(),
          active_revision_id: revisionId,
        })
        .where('id', '=', stackId)
        .returningAll()
        .executeTakeFirstOrThrow()

      const stack = this.mapStack(stackResult)
      stack.blockIds = revision.block_ids
      return stack
    })
  }

  async getStackRevisions(stackId: number): Promise<StackRevision[]> {
    const results = await this.db
      .selectFrom('stack_revisions')
      .selectAll()
      .where('stack_id', '=', stackId)
      .orderBy('created_at', 'desc')
      .execute()

    return results.map((r) => this.mapStackRevision(r))
  }

  async getStack(
    id: number,
    options?: GetStackOptions
  ): Promise<BlockStack | StackWithBlocks | null> {
    const result = await this.db
      .selectFrom('stacks')
      .selectAll('stacks')
      .select((eb) => [
        // First try to get block_ids from active_revision_id if set, otherwise get latest revision
        eb.fn.coalesce(
          eb
            .selectFrom('stack_revisions as active_rev')
            .select('active_rev.block_ids')
            .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('stack_revisions')
            .select('block_ids')
            .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('block_ids'),
      ])
      .where('stacks.id', '=', id)
      .executeTakeFirst()

    if (!result) return null

    const stack = this.mapStack(result)
    stack.blockIds = result.block_ids || []

    if (options?.includeBlocks) {
      return this.expandStack(stack, options.includeRevisions ?? false)
    }

    return stack
  }

  async getStackByUuid(
    uuid: string,
    options?: GetStackOptions
  ): Promise<BlockStack | StackWithBlocks | null> {
    const result = await this.db
      .selectFrom('stacks')
      .selectAll('stacks')
      .select((eb) => [
        // First try to get block_ids from active_revision_id if set, otherwise get latest revision
        eb.fn.coalesce(
          eb
            .selectFrom('stack_revisions as active_rev')
            .select('active_rev.block_ids')
            .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('stack_revisions')
            .select('block_ids')
            .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('block_ids'),
      ])
      .where('stacks.uuid', '=', uuid)
      .executeTakeFirst()

    if (!result) return null

    const stack = this.mapStack(result)
    stack.blockIds = result.block_ids || []

    if (options?.includeBlocks) {
      return this.expandStack(stack, options.includeRevisions ?? false)
    }

    return stack
  }

  async deleteStack(id: number): Promise<void> {
    await this.db.deleteFrom('stack_revisions').where('stack_id', '=', id).execute()
    await this.db.deleteFrom('stacks').where('id', '=', id).execute()
  }

  async listStacks(userId?: number): Promise<BlockStack[]> {
    let query = this.db
      .selectFrom('stacks')
      .selectAll('stacks')
      .select((eb) => [
        // First try to get block_ids from active_revision_id if set, otherwise get latest revision
        eb.fn.coalesce(
          eb
            .selectFrom('stack_revisions as active_rev')
            .select('active_rev.block_ids')
            .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('stack_revisions')
            .select('block_ids')
            .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('block_ids'),
      ])

    if (userId !== undefined) {
      query = query.where('user_id', '=', userId)
    }

    query = query.orderBy('stacks.updated_at', 'desc')

    const results = await query.execute()
    return results.map((r) => {
        const stack = this.mapStack(r)
        stack.blockIds = r.block_ids || []
        return stack
    })
  }

  async searchStacks(options: SearchStacksOptions, userId?: number): Promise<BlockStack[]> {
    let query = this.db
      .selectFrom('stacks')
      .leftJoin('stack_revisions', 'stacks.active_revision_id', 'stack_revisions.id')
      .selectAll('stacks')
      .select((eb) => [
        // First try to get block_ids from active_revision_id if set, otherwise get latest revision
        eb.fn.coalesce(
          eb
            .selectFrom('stack_revisions as active_rev')
            .select('active_rev.block_ids')
            .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('stack_revisions')
            .select('block_ids')
            .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('block_ids'),
      ])

    // Text search filter
    if (options.query) {
      const searchPattern = `%${options.query}%`
      query = query.where((eb) =>
        eb.or([
          eb('stacks.uuid', 'ilike', searchPattern),
          eb('stacks.display_id', 'ilike', searchPattern),
          eb('stacks.name', 'ilike', searchPattern),
          eb('stack_revisions.rendered_content', 'ilike', searchPattern),
        ])
      )
    }

    // User filter
    if (userId !== undefined) {
      query = query.where('stacks.user_id', '=', userId)
    }

    query = query.orderBy('stacks.updated_at', 'desc')

    const results = await query.execute()
    return results.map((r) => {
        const stack = this.mapStack(r)
        stack.blockIds = r.block_ids || []
        return stack
    })
  }

  async getCompiledPrompt(displayId: string, userId: number): Promise<string | null> {
    // 1. Get Stack by displayId and userId with block_ids from active or latest revision
    const result = await this.db
      .selectFrom('stacks')
      .select((eb) => [
        'stacks.id',
        eb.fn.coalesce(
          eb
            .selectFrom('stack_revisions as active_rev')
            .select('active_rev.block_ids')
            .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('stack_revisions')
            .select('block_ids')
            .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('block_ids')
      ])
      .where('display_id', '=', displayId)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    if (!result || !result.block_ids || result.block_ids.length === 0) {
      return ''
    }

    // 2. Get active revision text for each block in order
    // We fetch all blocks involved, then map them back to the order
    const blockIds = result.block_ids

    const blocksData = await this.db
      .selectFrom('blocks')
      .select(['id', 'active_revision_id'])
      .where('id', 'in', blockIds)
      .execute()

    // Map blockId -> activeRevisionId (or query latest if null)
    const activeRevisionIds: number[] = []
    const blocksNeedingLatest: number[] = []

    const blockMap = new Map(blocksData.map(b => [b.id, b]))

    for (const id of blockIds) {
      const block = blockMap.get(id)
      if (block) {
        if (block.active_revision_id) {
          activeRevisionIds.push(block.active_revision_id)
        } else {
          blocksNeedingLatest.push(block.id)
        }
      }
    }

    const textsMap = new Map<number, string>() // blockId -> text

    // Fetch texts for blocks with active_revision_id
    if (activeRevisionIds.length > 0) {
      const activeRevisions = await this.db
        .selectFrom('block_revisions')
        .select(['block_id', 'text'])
        .where('id', 'in', activeRevisionIds)
        .execute()
      
      activeRevisions.forEach(rev => {
        if (rev.block_id !== null) {
          textsMap.set(rev.block_id, rev.text)
        }
      })
    }

    // Fetch latest texts for blocks without active_revision_id
    if (blocksNeedingLatest.length > 0) {
      // This is slightly more complex in one query, so we'll do a simple loop or a lateral join if supported
      // For simplicity/readability, let's just fetch latest for these blocks
      // A window function would be better but keeping it simple for now
      const latestRevisions = await this.db
        .selectFrom('block_revisions')
        .select(['block_id', 'text'])
        .where('block_id', 'in', blocksNeedingLatest)
        .orderBy('block_id') // Required for distinctOn
        .orderBy('created_at', 'desc')
        .distinctOn('block_id') // Kysely supports distinctOn for PG
        .execute()

      latestRevisions.forEach(rev => {
        if (rev.block_id !== null) {
          textsMap.set(rev.block_id, rev.text)
        }
      })
    }

    // 3. Compile the prompt in the correct order
    const compiledParts = blockIds
      .map(id => textsMap.get(id))
      .filter(text => text !== undefined && text !== null)

    return compiledParts.join('\n\n')
  }

  async getRenderedPrompt(displayId: string, userId: number): Promise<string | null> {
    // 1. Get Stack by displayId and userId with rendered content from active or latest revision
    const result = await this.db
      .selectFrom('stacks')
      .select((eb) => [
        eb.fn.coalesce(
          eb
            .selectFrom('stack_revisions as active_rev')
            .select('active_rev.rendered_content')
            .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
            .limit(1),
          eb
            .selectFrom('stack_revisions')
            .select('rendered_content')
            .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
            .orderBy('created_at', 'desc')
            .limit(1)
        ).as('rendered_content')
      ])
      .where('display_id', '=', displayId)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    return result?.rendered_content || null
  }

  async addBlockToStack(stackId: number, blockId: number, order?: number, renderedContent?: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date()

      // Get current block_ids (from active revision if set, otherwise latest)
      const currentRev = await trx
        .selectFrom('stacks')
        .select((eb) => [
          eb.fn.coalesce(
            eb
              .selectFrom('stack_revisions as active_rev')
              .select('active_rev.block_ids')
              .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
              .limit(1),
            eb
              .selectFrom('stack_revisions')
              .select('block_ids')
              .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
              .orderBy('created_at', 'desc')
              .limit(1)
          ).as('block_ids')
        ])
        .where('stacks.id', '=', stackId)
        .executeTakeFirst()

      let newBlockIds: number[]
      if (!currentRev?.block_ids) {
        newBlockIds = [blockId]
      } else if (order !== undefined && order >= 0 && order <= currentRev.block_ids.length) {
        // Insert at specific position
        newBlockIds = [
          ...currentRev.block_ids.slice(0, order),
          blockId,
          ...currentRev.block_ids.slice(order)
        ]
      } else {
        // Append to end if order not specified or out of bounds
        newBlockIds = [...currentRev.block_ids, blockId]
      }

      // Create new revision
      const newRevision = await trx
        .insertInto('stack_revisions')
        .values({
          stack_id: stackId,
          block_ids: newBlockIds,
          rendered_content: renderedContent || null,
          created_at: now,
          updated_at: now,
          user_id: null
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // Set as active revision
      await trx
        .updateTable('stacks')
        .set({
          active_revision_id: newRevision.id,
          updated_at: now,
        })
        .where('id', '=', stackId)
        .execute()
    })
  }

  async removeBlockFromStack(stackId: number, blockId: number, renderedContent?: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date()

      // Get current block_ids (from active revision if set, otherwise latest)
      const currentRev = await trx
        .selectFrom('stacks')
        .select((eb) => [
          eb.fn.coalesce(
            eb
              .selectFrom('stack_revisions as active_rev')
              .select('active_rev.block_ids')
              .whereRef('active_rev.id', '=', 'stacks.active_revision_id')
              .limit(1),
            eb
              .selectFrom('stack_revisions')
              .select('block_ids')
              .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
              .orderBy('created_at', 'desc')
              .limit(1)
          ).as('block_ids')
        ])
        .where('stacks.id', '=', stackId)
        .executeTakeFirst()

      if (!currentRev?.block_ids) return

      const newBlockIds = currentRev.block_ids.filter(id => id !== blockId)

      // Create new revision
      const newRevision = await trx
        .insertInto('stack_revisions')
        .values({
          stack_id: stackId,
          block_ids: newBlockIds,
          rendered_content: renderedContent || null,
          created_at: now,
          updated_at: now,
          user_id: null
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // Set as active revision
      await trx
        .updateTable('stacks')
        .set({
          active_revision_id: newRevision.id,
          updated_at: now,
        })
        .where('id', '=', stackId)
        .execute()
    })
  }

  async reorderStackBlocks(stackId: number, blockIds: number[], renderedContent?: string): Promise<void> {
     await this.db.transaction().execute(async (trx) => {
      const now = new Date()

      // Get the active revision ID (or fall back to latest)
      const stackInfo = await trx
        .selectFrom('stacks')
        .select(['active_revision_id'])
        .where('id', '=', stackId)
        .executeTakeFirst()

      let revisionIdToUpdate: number | null = null

      if (stackInfo?.active_revision_id) {
        revisionIdToUpdate = stackInfo.active_revision_id
      } else {
        // No active revision set, get latest by created_at
        const latestRev = await trx
          .selectFrom('stack_revisions')
          .select('id')
          .where('stack_id', '=', stackId)
          .orderBy('created_at', 'desc')
          .limit(1)
          .executeTakeFirst()

        revisionIdToUpdate = latestRev?.id ?? null
      }

      if (!revisionIdToUpdate) return

      // Update the revision in place (no new revision created)
      await trx
        .updateTable('stack_revisions')
        .set({
            block_ids: blockIds,
            rendered_content: renderedContent || null,
            updated_at: now,
        })
        .where('id', '=', revisionIdToUpdate)
        .execute()

      // Update the stack's updated_at timestamp
      await trx
        .updateTable('stacks')
        .set({ updated_at: now })
        .where('id', '=', stackId)
        .execute()
    })
  }

  async updateStackRevisionContent(stackId: number, renderedContent: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date()

      // Get the active revision ID (or fall back to latest)
      const stackInfo = await trx
        .selectFrom('stacks')
        .select(['active_revision_id'])
        .where('id', '=', stackId)
        .executeTakeFirst()

      let revisionIdToUpdate: number | null = null

      if (stackInfo?.active_revision_id) {
        revisionIdToUpdate = stackInfo.active_revision_id
      } else {
        // No active revision set, get latest by created_at
        const latestRev = await trx
          .selectFrom('stack_revisions')
          .select('id')
          .where('stack_id', '=', stackId)
          .orderBy('created_at', 'desc')
          .limit(1)
          .executeTakeFirst()

        revisionIdToUpdate = latestRev?.id ?? null
      }

      if (!revisionIdToUpdate) return

      // Update the revision in place
      await trx
        .updateTable('stack_revisions')
        .set({
            rendered_content: renderedContent,
            updated_at: now,
        })
        .where('id', '=', revisionIdToUpdate)
        .execute()

      // Update the stack's updated_at timestamp
      await trx
        .updateTable('stacks')
        .set({ updated_at: now })
        .where('id', '=', stackId)
        .execute()
    })
  }

  async createType(name: string, description?: string): Promise<Type> {
    const result = await this.db
      .insertInto('types')
      .values({
        name,
        description: description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.mapType(result)
  }

  async getType(id: number): Promise<Type | null> {
    const result = await this.db
      .selectFrom('types')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return result ? this.mapType(result) : null
  }

  async listTypes(): Promise<Type[]> {
    const results = await this.db.selectFrom('types').selectAll().execute()
    return results.map((r) => this.mapType(r))
  }

  async createWildcard(input: CreateWildcardInput): Promise<Wildcard> {
    const now = new Date()
    const result = await this.db
      .insertInto('wildcards')
      .values({
        uuid: input.uuid,
        display_id: input.displayId,
        name: input.name,
        format: input.format,
        content: input.content,
        user_id: input.userId ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.mapWildcard(result)
  }

  async getWildcard(id: number): Promise<Wildcard | null> {
    const result = await this.db
      .selectFrom('wildcards')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return result ? this.mapWildcard(result) : null
  }

  async getWildcardByUuid(uuid: string): Promise<Wildcard | null> {
    const result = await this.db
      .selectFrom('wildcards')
      .selectAll()
      .where('uuid', '=', uuid)
      .executeTakeFirst()

    return result ? this.mapWildcard(result) : null
  }

  async updateWildcard(id: number, updates: UpdateWildcardInput): Promise<Wildcard> {
    const updateData: Updateable<Database['wildcards']> = {
      updated_at: new Date(),
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.format !== undefined) updateData.format = updates.format
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.meta !== undefined) {
      updateData.meta = updates.meta ? JSON.stringify(updates.meta) : null
    }

    const result = await this.db
      .updateTable('wildcards')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.mapWildcard(result)
  }

  async deleteWildcard(id: number): Promise<void> {
    await this.db.deleteFrom('wildcards').where('id', '=', id).execute()
  }

  async listWildcards(userId?: number): Promise<Wildcard[]> {
    let query = this.db
      .selectFrom('wildcards')
      .selectAll()
      .orderBy('updated_at', 'desc')

    if (userId !== undefined) {
      query = query.where('user_id', '=', userId)
    }

    const results = await query.execute()
    return results.map((r) => this.mapWildcard(r))
  }

  async searchWildcards(options: SearchWildcardsOptions, userId?: number): Promise<Wildcard[]> {
    let query = this.db
      .selectFrom('wildcards')
      .selectAll()

    // Text search filter
    if (options.query) {
      const searchPattern = `%${options.query}%`
      query = query.where((eb) =>
        eb.or([
          eb('wildcards.uuid', 'ilike', searchPattern),
          eb('wildcards.display_id', 'ilike', searchPattern),
          eb('wildcards.name', 'ilike', searchPattern),
          eb('wildcards.content', 'ilike', searchPattern),
        ])
      )
    }

    // User filter
    if (userId !== undefined) {
      query = query.where('wildcards.user_id', '=', userId)
    }

    query = query.orderBy('wildcards.updated_at', 'desc')

    const results = await query.execute()
    return results.map((r) => this.mapWildcard(r))
  }

  private async expandStack(
    stack: BlockStack,
    includeRevisions: boolean
  ): Promise<StackWithBlocks> {
    const blockIds = stack.blockIds

    const blocks: BlockWithRevisions[] = []

    if (blockIds.length > 0) {
        // Fetch blocks with types and text
        const blockResults = await this.db
            .selectFrom('blocks')
            .leftJoin('types', 'blocks.type_id', 'types.id')
            .selectAll('blocks')
            .select((eb) => [
                // First try to get text from active_revision_id if set, otherwise get latest revision
                eb.fn.coalesce(
                  eb
                    .selectFrom('block_revisions as active_rev')
                    .select('active_rev.text')
                    .whereRef('active_rev.id', '=', 'blocks.active_revision_id')
                    .limit(1),
                  eb
                    .selectFrom('block_revisions')
                    .select('text')
                    .whereRef('block_revisions.block_id', '=', 'blocks.id')
                    .orderBy('created_at', 'desc')
                    .limit(1)
                ).as('text'),
            ])
            .select([
                'types.id as type_id_joined',
                'types.name as type_name',
                'types.description as type_description',
            ])
            .where('blocks.id', 'in', blockIds)
            .execute()

        const blocksMap = new Map<number, Block>()
        for (const r of blockResults) {
            const type = r.type_id_joined ? {
                id: r.type_id_joined,
                name: r.type_name!,
                description: r.type_description
            } : null

            const b = this.mapBlock(r, type)
            b.text = r.text || ''
            blocksMap.set(b.id, b)
        }
        
        for (const id of blockIds) {
            const block = blocksMap.get(id)
            if (block) {
                let revisions: BlockRevision[] = []
                if (includeRevisions) {
                    revisions = await this.getRevisions(id)
                }
                blocks.push({ ...block, revisions })
            }
        }
    }
    
    let stackRevisions: StackRevision[] = []
    if (includeRevisions) {
         const revRows = await this.db
            .selectFrom('stack_revisions')
            .selectAll()
            .where('stack_id', '=', stack.id)
            .orderBy('created_at', 'desc')
            .execute()
         stackRevisions = revRows.map(r => this.mapStackRevision(r))
    }

    return {
      ...stack,
      blocks,
      revisions: stackRevisions,
    }
  }

  private mapBlock(row: Selectable<Database['blocks']>, type: Type | null = null): Block {
    return {
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      displayId: row.display_id,
      text: '', // To be filled by revision
      activeRevisionId: row.active_revision_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      typeId: row.type_id,
      type: type,
      labels: row.labels,
      userId: row.user_id,
      meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
    }
  }

  private mapRevision(row: Selectable<Database['block_revisions']>): BlockRevision {
    return {
      id: row.id,
      text: row.text,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
      userId: row.user_id,
      blockId: row.block_id,
    }
  }

  private mapStack(row: Selectable<Database['stacks']>): BlockStack {
    return {
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      displayId: row.display_id,
      commaSeparated: row.comma_separated,
      style: row.style,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      userId: row.user_id,
      activeRevisionId: row.active_revision_id,
      blockIds: [], // To be filled by subquery
    }
  }
  
  private mapStackRevision(row: Selectable<Database['stack_revisions']>): StackRevision {
      return {
          id: row.id,
          stackId: row.stack_id,
          blockIds: row.block_ids,
          renderedContent: row.rendered_content,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          userId: row.user_id
      }
  }

  private mapType(row: Selectable<Database['types']>): Type {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
    }
  }

  private mapWildcard(row: Selectable<Database['wildcards']>): Wildcard {
    return {
      id: row.id,
      uuid: row.uuid,
      displayId: row.display_id,
      name: row.name,
      format: row.format,
      content: row.content,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      userId: row.user_id,
      meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
    }
  }
}