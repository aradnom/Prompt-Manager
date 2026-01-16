import { Kysely, PostgresDialect, Selectable, Updateable, sql } from 'kysely'
import { Pool } from 'pg'
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
  CreateRevisionInput,
  Type,
  StackRevision,
  Wildcard,
  CreateWildcardInput,
  UpdateWildcardInput,
} from '@/types/schema'
import type { IStorageAdapter, GetStackOptions, SearchBlocksOptions } from '@server/adapters/storage-adapter.interface'

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

  async createBlock(input: CreateBlockInput): Promise<Block> {
    const now = new Date()
    
    return await this.db.transaction().execute(async (trx) => {
      // 1. Create the block entity
      const blockResult = await trx
        .insertInto('blocks')
        .values({
          uuid: input.uuid,
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
        
      // Fetch type if needed
      let type: Type | null = null
      if (blockResult.type_id) {
        const typeResult = await trx
            .selectFrom('types')
            .selectAll()
            .where('id', '=', blockResult.type_id)
            .executeTakeFirst()
        if (typeResult) {
            type = this.mapType(typeResult)
        }
      }

      // Return combined result
      const block = this.mapBlock(blockResult, type)
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

      if (updates.typeId !== undefined) updateData.type_id = updates.typeId
      if (updates.labels !== undefined) updateData.labels = updates.labels
      if (updates.meta !== undefined) {
        updateData.meta = updates.meta ? JSON.stringify(updates.meta) : null
      }

      // If text is being updated, clear the active_revision_id
      // so the new revision becomes the active one
      if (updates.text !== undefined) {
        updateData.active_revision_id = null
      }

      // Update block metadata
      const blockResult = await trx
        .updateTable('blocks')
        .set(updateData)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow()

      let text = ''

      // If text is updated, create new revision
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
    await this.db.deleteFrom('block_revisions').where('block_id', '=', id).execute()
    await this.db.deleteFrom('blocks').where('id', '=', id).execute()
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
    const now = new Date()
    const result = await this.db
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

    return this.mapRevision(result)
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
          display_id: input.displayId,
          user_id: input.userId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // 2. Create Initial Revision
      await trx
        .insertInto('stack_revisions')
        .values({
          stack_id: stackResult.id,
          block_ids: input.blockIds ?? [],
          created_at: now,
          user_id: input.userId ?? null,
        })
        .execute()

      const stack = this.mapStack(stackResult)
      stack.blockIds = input.blockIds ?? []
      return stack
    })
  }

  async getStack(
    id: number,
    options?: GetStackOptions
  ): Promise<BlockStack | StackWithBlocks | null> {
    const result = await this.db
      .selectFrom('stacks')
      .selectAll('stacks')
      .select((eb) => [
        eb
          .selectFrom('stack_revisions')
          .select('block_ids')
          .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
          .orderBy('created_at', 'desc')
          .limit(1)
          .as('block_ids'),
      ])
      .where('stacks.id', '=', id)
      .executeTakeFirst()

    if (!result) return null

    const stack = this.mapStack(result)
    // block_ids from subquery, defaulting to [] if null (though createStack ensures one)
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
        eb
          .selectFrom('stack_revisions')
          .select('block_ids')
          .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
          .orderBy('created_at', 'desc')
          .limit(1)
          .as('block_ids'),
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
        eb
          .selectFrom('stack_revisions')
          .select('block_ids')
          .whereRef('stack_revisions.stack_id', '=', 'stacks.id')
          .orderBy('created_at', 'desc')
          .limit(1)
          .as('block_ids'),
      ])

    if (userId !== undefined) {
      query = query.where('user_id', '=', userId)
    }

    const results = await query.execute()
    return results.map((r) => {
        const stack = this.mapStack(r)
        stack.blockIds = r.block_ids || []
        return stack
    })
  }

  async getCompiledPrompt(displayId: string, userId: number): Promise<string | null> {
    // 1. Get Stack by displayId and userId
    const stack = await this.db
      .selectFrom('stacks')
      .select('id')
      .where('display_id', '=', displayId)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    if (!stack) return null

    // 2. Get latest Stack Revision
    const stackRevision = await this.db
      .selectFrom('stack_revisions')
      .select('block_ids')
      .where('stack_id', '=', stack.id)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!stackRevision || !stackRevision.block_ids || stackRevision.block_ids.length === 0) {
      return ''
    }

    // 3. Get active revision text for each block in order
    // We fetch all blocks involved, then map them back to the order
    const blockIds = stackRevision.block_ids

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

    // 4. Compile the prompt in the correct order
    const compiledParts = blockIds
      .map(id => textsMap.get(id))
      .filter(text => text !== undefined && text !== null)

    return compiledParts.join('\n\n')
  }

  async getRenderedPrompt(displayId: string, userId: number): Promise<string | null> {
    // 1. Get Stack by displayId and userId
    const stack = await this.db
      .selectFrom('stacks')
      .select('id')
      .where('display_id', '=', displayId)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    if (!stack) return null

    // 2. Get latest Stack Revision content
    const stackRevision = await this.db
      .selectFrom('stack_revisions')
      .select('rendered_content')
      .where('stack_id', '=', stack.id)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst()

    return stackRevision?.rendered_content || null
  }

  async addBlockToStack(stackId: number, blockId: number, _order?: number, renderedContent?: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      // Get latest revision
      const latestRev = await trx
        .selectFrom('stack_revisions')
        .selectAll()
        .where('stack_id', '=', stackId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst()

      if (!latestRev) {
         const now = new Date()
         await trx.insertInto('stack_revisions')
           .values({
             stack_id: stackId,
             block_ids: [blockId],
             rendered_content: renderedContent || null,
             created_at: now,
             user_id: null
           }).execute()
         return
      }

      const newBlockIds = [...latestRev.block_ids, blockId]
      
      await trx
        .updateTable('stack_revisions')
        .set({
            block_ids: newBlockIds,
            rendered_content: renderedContent || null
        })
        .where('id', '=', latestRev.id)
        .execute()
    })
  }

  async removeBlockFromStack(stackId: number, blockId: number, renderedContent?: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const latestRev = await trx
        .selectFrom('stack_revisions')
        .selectAll()
        .where('stack_id', '=', stackId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst()

      if (!latestRev) return

      const newBlockIds = latestRev.block_ids.filter(id => id !== blockId)

      await trx
        .updateTable('stack_revisions')
        .set({
            block_ids: newBlockIds,
            rendered_content: renderedContent || null
        })
        .where('id', '=', latestRev.id)
        .execute()
    })
  }

  async reorderStackBlocks(stackId: number, blockIds: number[], renderedContent?: string): Promise<void> {
     await this.db.transaction().execute(async (trx) => {
      const latestRev = await trx
        .selectFrom('stack_revisions')
        .selectAll()
        .where('stack_id', '=', stackId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst()

      if (!latestRev) return

      await trx
        .updateTable('stack_revisions')
        .set({
            block_ids: blockIds,
            rendered_content: renderedContent || null
        })
        .where('id', '=', latestRev.id)
        .execute()
    })
  }

  async updateStackRevisionContent(stackId: number, renderedContent: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const latestRev = await trx
        .selectFrom('stack_revisions')
        .selectAll()
        .where('stack_id', '=', stackId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst()

      if (!latestRev) return

      await trx
        .updateTable('stack_revisions')
        .set({
            rendered_content: renderedContent
        })
        .where('id', '=', latestRev.id)
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
      displayId: row.display_id,
      userId: row.user_id,
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