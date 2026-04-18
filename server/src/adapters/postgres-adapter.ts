import { Kysely, PostgresDialect, Selectable, Updateable, sql } from "kysely";
import { Pool } from "pg";
import crypto from "crypto";
import type { Database } from "@/types/database";
import type {
  Block,
  BlockFolder,
  BlockRevision,
  BlockStack,
  BlockWithRevisions,
  StackWithBlocks,
  CreateBlockInput,
  CreateBlockFolderInput,
  UpdateBlockInput,
  UpdateBlockFolderInput,
  CreateStackInput,
  UpdateStackInput,
  CreateRevisionInput,
  Type,
  StackRevision,
  StackSnapshot,
  StackTemplate,
  CreateStackTemplateInput,
  UpdateStackTemplateInput,
  StackFolder,
  CreateStackFolderInput,
  UpdateStackFolderInput,
  Wildcard,
  CreateWildcardInput,
  UpdateWildcardInput,
} from "@/types/schema";
import type {
  IStorageAdapter,
  GetStackOptions,
  SearchBlocksOptions,
  SearchStacksOptions,
  SearchWildcardsOptions,
  SearchSnapshotsOptions,
  SearchStackTemplatesOptions,
  PaginationOptions,
  PaginatedResult,
  BlocksWithFoldersResult,
  StacksWithFoldersResult,
  CreateStackSnapshotInput,
  UpdateStackSnapshotInput,
  User,
  CreateUserInput,
} from "@server/adapters/storage-adapter.interface";

export class PostgresStorageAdapter implements IStorageAdapter {
  private db: Kysely<Database>;

  constructor(connectionString: string) {
    const pool = new Pool({
      connectionString,
    });

    this.db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });
  }

  async initialize(): Promise<void> {
    await this.db.selectFrom("users").selectAll().limit(1).execute();
  }

  async getUserIdByApiKey(apiKey: string): Promise<number | null> {
    const result = await this.db
      .selectFrom("users")
      .select("id")
      .where("api_key", "=", apiKey)
      .executeTakeFirst();

    return result?.id ?? null;
  }

  async getUserById(id: number): Promise<User | null> {
    const result = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      tokenHash: result.token_hash,
      accountData: result.account_data as Record<string, string> | null,
      apiKey: result.api_key,
      adminUser: result.admin_user ?? false,
      scratchpad: result.scratchpad,
      activeStackId: result.active_stack_id ?? null,
    };
  }

  async getUserByTokenHash(tokenHash: string): Promise<User | null> {
    const result = await this.db
      .selectFrom("users")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      tokenHash: result.token_hash,
      accountData: result.account_data as Record<string, string> | null,
      apiKey: result.api_key,
      adminUser: result.admin_user ?? false,
      scratchpad: result.scratchpad,
      activeStackId: result.active_stack_id ?? null,
    };
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const now = new Date();

    const result = await this.db
      .insertInto("users")
      .values({
        token_hash: input.tokenHash,
        account_data: JSON.stringify(input.accountData),
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: result.id,
      tokenHash: result.token_hash,
      accountData: result.account_data as Record<string, string> | null,
      apiKey: result.api_key,
      adminUser: result.admin_user ?? false,
      scratchpad: result.scratchpad,
      activeStackId: result.active_stack_id ?? null,
    };
  }

  async countUsers(): Promise<number> {
    const result = await this.db
      .selectFrom("users")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async updateUserAccountData(
    userId: number,
    accountData: Record<string, string>,
  ): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        account_data: JSON.stringify(accountData),
        updated_at: new Date(),
      })
      .where("id", "=", userId)
      .execute();
  }

  async setUserApiKey(userId: number, apiKey: string): Promise<void> {
    await this.db
      .updateTable("users")
      .set({ api_key: apiKey, updated_at: new Date() })
      .where("id", "=", userId)
      .execute();
  }

  async clearUserApiKey(userId: number): Promise<void> {
    await this.db
      .updateTable("users")
      .set({ api_key: null, updated_at: new Date() })
      .where("id", "=", userId)
      .execute();
  }

  async getUserScratchpad(userId: number): Promise<string | null> {
    const result = await this.db
      .selectFrom("users")
      .select("scratchpad")
      .where("id", "=", userId)
      .executeTakeFirst();
    return result?.scratchpad ?? null;
  }

  async setUserScratchpad(userId: number, content: string): Promise<void> {
    await this.db
      .updateTable("users")
      .set({ scratchpad: content, updated_at: new Date() })
      .where("id", "=", userId)
      .execute();
  }

  async setUserActiveStackId(
    userId: number,
    stackId: number | null,
  ): Promise<void> {
    await this.db
      .updateTable("users")
      .set({ active_stack_id: stackId, updated_at: new Date() })
      .where("id", "=", userId)
      .execute();
  }

  async createBlock(input: CreateBlockInput): Promise<Block> {
    const now = new Date();

    return await this.db.transaction().execute(async (trx) => {
      // 1. Create the block entity
      const blockResult = await trx
        .insertInto("blocks")
        .values({
          uuid: input.uuid,
          name: input.name ?? null,
          display_id: input.displayId,
          type_id: input.typeId ?? null,
          folder_id: input.folderId ?? null,
          labels: input.labels ?? [],
          notes: input.notes ?? null,
          user_id: input.userId ?? null,
          meta: input.meta ? JSON.stringify(input.meta) : null,
          include_in_caption: input.includeInCaption ?? false,
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 2. Create the initial revision
      const revisionResult = await trx
        .insertInto("block_revisions")
        .values({
          block_id: blockResult.id,
          text: input.text,
          user_id: input.userId ?? null,
          meta: input.meta ? JSON.stringify(input.meta) : null,
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 3. Set the active_revision_id
      const updatedBlockResult = await trx
        .updateTable("blocks")
        .set({
          active_revision_id: revisionResult.id,
          updated_at: now,
        })
        .where("id", "=", blockResult.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // Fetch type if needed
      let type: Type | null = null;
      if (updatedBlockResult.type_id) {
        const typeResult = await trx
          .selectFrom("types")
          .selectAll()
          .where("id", "=", updatedBlockResult.type_id)
          .executeTakeFirst();
        if (typeResult) {
          type = this.mapType(typeResult);
        }
      }

      // Return combined result
      const block = this.mapBlock(updatedBlockResult, type);
      block.text = revisionResult.text;
      return block;
    });
  }

  async getBlock(id: number): Promise<Block | null> {
    const result = await this.db
      .selectFrom("blocks")
      .leftJoin("types", "blocks.type_id", "types.id")
      .leftJoin("block_folders", "blocks.folder_id", "block_folders.id")
      .selectAll("blocks")
      .select((eb) => [
        // First try to get text from active_revision_id if set, otherwise get latest revision
        eb.fn
          .coalesce(
            eb
              .selectFrom("block_revisions as active_rev")
              .select("active_rev.text")
              .whereRef("active_rev.id", "=", "blocks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("block_revisions")
              .select("text")
              .whereRef("block_revisions.block_id", "=", "blocks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("text"),
      ])
      .select([
        "types.id as type_id_joined",
        "types.name as type_name",
        "types.description as type_description",
        "block_folders.name as folder_name",
      ])
      .where("blocks.id", "=", id)
      .executeTakeFirst();

    if (!result || result.text === null) return null;

    const type = result.type_id_joined
      ? {
          id: result.type_id_joined,
          name: result.type_name!,
          description: result.type_description,
        }
      : null;

    const block = this.mapBlock(result, type, result.folder_name ?? null);
    block.text = result.text!;
    return block;
  }

  async getBlocksByIds(ids: number[]): Promise<Block[]> {
    if (ids.length === 0) return [];

    const results = await this.db
      .selectFrom("blocks")
      .leftJoin("types", "blocks.type_id", "types.id")
      .leftJoin("block_folders", "blocks.folder_id", "block_folders.id")
      .selectAll("blocks")
      .select((eb) => [
        eb.fn
          .coalesce(
            eb
              .selectFrom("block_revisions as active_rev")
              .select("active_rev.text")
              .whereRef("active_rev.id", "=", "blocks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("block_revisions")
              .select("text")
              .whereRef("block_revisions.block_id", "=", "blocks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("text"),
      ])
      .select([
        "types.id as type_id_joined",
        "types.name as type_name",
        "types.description as type_description",
        "block_folders.name as folder_name",
      ])
      .where("blocks.id", "in", ids)
      .execute();

    return results
      .filter((r) => r.text !== null)
      .map((result) => {
        const type = result.type_id_joined
          ? {
              id: result.type_id_joined,
              name: result.type_name!,
              description: result.type_description,
            }
          : null;
        const block = this.mapBlock(result, type, result.folder_name ?? null);
        block.text = result.text!;
        return block;
      });
  }

  async getBlockByUuid(uuid: string): Promise<Block | null> {
    const result = await this.db
      .selectFrom("blocks")
      .leftJoin("types", "blocks.type_id", "types.id")
      .leftJoin("block_folders", "blocks.folder_id", "block_folders.id")
      .selectAll("blocks")
      .select((eb) => [
        // First try to get text from active_revision_id if set, otherwise get latest revision
        eb.fn
          .coalesce(
            eb
              .selectFrom("block_revisions as active_rev")
              .select("active_rev.text")
              .whereRef("active_rev.id", "=", "blocks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("block_revisions")
              .select("text")
              .whereRef("block_revisions.block_id", "=", "blocks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("text"),
      ])
      .select([
        "types.id as type_id_joined",
        "types.name as type_name",
        "types.description as type_description",
        "block_folders.name as folder_name",
      ])
      .where("blocks.uuid", "=", uuid)
      .executeTakeFirst();

    if (!result || result.text === null) return null;

    const type = result.type_id_joined
      ? {
          id: result.type_id_joined,
          name: result.type_name!,
          description: result.type_description,
        }
      : null;

    const block = this.mapBlock(result, type, result.folder_name ?? null);
    block.text = result.text!;
    return block;
  }

  async updateBlock(id: number, updates: UpdateBlockInput): Promise<Block> {
    return await this.db.transaction().execute(async (trx) => {
      const updateData: Updateable<Database["blocks"]> = {
        updated_at: new Date(),
      };

      if (updates.name !== undefined) updateData.name = updates.name ?? null;
      if (updates.displayId !== undefined)
        updateData.display_id = updates.displayId;
      if (updates.typeId !== undefined)
        updateData.type_id = updates.typeId ?? null;
      if (updates.folderId !== undefined)
        updateData.folder_id = updates.folderId ?? null;
      if (updates.labels !== undefined) updateData.labels = updates.labels;
      if (updates.notes !== undefined) updateData.notes = updates.notes ?? null;
      if (updates.meta !== undefined) {
        updateData.meta = updates.meta ? JSON.stringify(updates.meta) : null;
      }
      if (updates.includeInCaption !== undefined) {
        updateData.include_in_caption = updates.includeInCaption;
      }

      // Update block metadata first (without touching active_revision_id yet)
      let blockResult = await trx
        .updateTable("blocks")
        .set(updateData)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      let text = "";

      // If text is updated, create new revision and set it as active
      if (updates.text !== undefined) {
        const now = new Date();
        const revisionResult = await trx
          .insertInto("block_revisions")
          .values({
            block_id: id,
            text: updates.text,
            user_id: blockResult.user_id,
            meta: updates.meta ? JSON.stringify(updates.meta) : null,
            created_at: now,
            updated_at: now,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // Explicitly set the new revision as active
        blockResult = await trx
          .updateTable("blocks")
          .set({
            active_revision_id: revisionResult.id,
            updated_at: now,
          })
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirstOrThrow();

        text = revisionResult.text;
      } else {
        // Fetch current text
        const latestRev = await trx
          .selectFrom("block_revisions")
          .select("text")
          .where("block_id", "=", id)
          .orderBy("created_at", "desc")
          .limit(1)
          .executeTakeFirstOrThrow();
        text = latestRev.text;
      }

      // Fetch type
      let type: Type | null = null;
      if (blockResult.type_id) {
        const typeResult = await trx
          .selectFrom("types")
          .selectAll()
          .where("id", "=", blockResult.type_id)
          .executeTakeFirst();
        if (typeResult) {
          type = this.mapType(typeResult);
        }
      }

      // Fetch folder name
      let folderName: string | null = null;
      if (blockResult.folder_id) {
        const folderResult = await trx
          .selectFrom("block_folders")
          .select("name")
          .where("id", "=", blockResult.folder_id)
          .executeTakeFirst();
        if (folderResult) {
          folderName = folderResult.name;
        }
      }

      const block = this.mapBlock(blockResult, type, folderName);
      block.text = text;
      return block;
    });
  }

  async deleteBlock(id: number): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date();

      // Get stack IDs that are affected by this block deletion
      const affectedStackRevisions = await trx
        .selectFrom("stack_revisions")
        .select("stack_id")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(sql`${id} = ANY(block_ids)` as any)
        .execute();

      const affectedStackIds = [
        ...new Set(affectedStackRevisions.map((r) => r.stack_id)),
      ];

      // Remove block from any stack revisions (both block_ids and disabled_block_ids)
      await trx
        .updateTable("stack_revisions")
        .set({
          block_ids: sql`array_remove(block_ids, ${id})`,
          disabled_block_ids: sql`array_remove(disabled_block_ids, ${id})`,
          updated_at: now,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(sql`${id} = ANY(block_ids)` as any)
        .execute();

      // Update the affected stacks' updated_at timestamps
      if (affectedStackIds.length > 0) {
        await trx
          .updateTable("stacks")
          .set({ updated_at: now })
          .where("id", "in", affectedStackIds)
          .execute();
      }

      // Delete block revisions
      await trx
        .deleteFrom("block_revisions")
        .where("block_id", "=", id)
        .execute();

      // Delete the block
      await trx.deleteFrom("blocks").where("id", "=", id).execute();
    });
  }

  async listBlocks(
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Block>> {
    let query = this.db
      .selectFrom("blocks")
      .leftJoin("types", "blocks.type_id", "types.id")
      .leftJoin("block_folders", "blocks.folder_id", "block_folders.id")
      .selectAll("blocks")
      .select((eb) => [
        // First try to get text from active_revision_id if set, otherwise get latest revision
        eb.fn
          .coalesce(
            eb
              .selectFrom("block_revisions as active_rev")
              .select("active_rev.text")
              .whereRef("active_rev.id", "=", "blocks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("block_revisions")
              .select("text")
              .whereRef("block_revisions.block_id", "=", "blocks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("text"),
      ])
      .select([
        "types.id as type_id_joined",
        "types.name as type_name",
        "types.description as type_description",
        "block_folders.name as folder_name",
      ]);

    if (userId !== undefined) {
      query = query.where("blocks.user_id", "=", userId);
    }

    query = query.orderBy("blocks.updated_at", "desc");

    // Count query
    let countQuery = this.db
      .selectFrom("blocks")
      .select((eb) => eb.fn.countAll<number>().as("count"));
    if (userId !== undefined) {
      countQuery = countQuery.where("blocks.user_id", "=", userId);
    }

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const [results, countResult] = await Promise.all([
      query.execute(),
      countQuery.executeTakeFirst(),
    ]);

    const items = results.map((r) => {
      const type = r.type_id_joined
        ? {
            id: r.type_id_joined,
            name: r.type_name!,
            description: r.type_description,
          }
        : null;

      const block = this.mapBlock(r, type, r.folder_name ?? null);
      block.text = r.text || "";
      return block;
    });

    return { items, total: Number(countResult?.count ?? 0) };
  }

  async countBlocks(userId?: number): Promise<number> {
    let query = this.db
      .selectFrom("blocks")
      .select((eb) => eb.fn.countAll<number>().as("count"));

    if (userId !== undefined) {
      query = query.where("blocks.user_id", "=", userId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async searchBlocks(
    options: SearchBlocksOptions,
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Block>> {
    let qb = this.db
      .selectFrom("blocks")
      .leftJoin("types", "blocks.type_id", "types.id")
      .leftJoin("block_folders", "blocks.folder_id", "block_folders.id")
      .selectAll("blocks")
      .select((eb) => [
        // First try to get text from active_revision_id if set, otherwise get latest revision
        eb.fn
          .coalesce(
            eb
              .selectFrom("block_revisions as active_rev")
              .select("active_rev.text")
              .whereRef("active_rev.id", "=", "blocks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("block_revisions")
              .select("text")
              .whereRef("block_revisions.block_id", "=", "blocks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("text"),
      ])
      .select([
        "types.id as type_id_joined",
        "types.name as type_name",
        "types.description as type_description",
        "block_folders.name as folder_name",
      ]);

    // Build a parallel count query with the same filters
    let countQb = this.db
      .selectFrom("blocks")
      .select((eb) => eb.fn.countAll<number>().as("count"));

    // Text search filter
    if (options.query) {
      const searchPattern = `%${options.query}%`;
      qb = qb.where((eb) =>
        eb.or([
          eb("blocks.display_id", "ilike", searchPattern),
          eb(
            eb.fn.coalesce(
              eb
                .selectFrom("block_revisions as active_rev")
                .select("active_rev.text")
                .whereRef("active_rev.id", "=", "blocks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("block_revisions")
                .select("text")
                .whereRef("block_revisions.block_id", "=", "blocks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            ),
            "ilike",
            searchPattern,
          ),
        ]),
      );
      countQb = countQb.where((eb) =>
        eb.or([
          eb("blocks.display_id", "ilike", searchPattern),
          eb(
            eb.fn.coalesce(
              eb
                .selectFrom("block_revisions as active_rev")
                .select("active_rev.text")
                .whereRef("active_rev.id", "=", "blocks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("block_revisions")
                .select("text")
                .whereRef("block_revisions.block_id", "=", "blocks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            ),
            "ilike",
            searchPattern,
          ),
        ]),
      );
    }

    // Type filter
    if (options.typeId !== undefined) {
      qb = qb.where("blocks.type_id", "=", options.typeId);
      countQb = countQb.where("blocks.type_id", "=", options.typeId);
    }

    // Label filter - match any of the provided labels
    if (options.labels && options.labels.length > 0) {
      qb = qb.where((eb) =>
        eb.or(
          options.labels!.map((label) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eb("blocks.labels", "@>", sql`ARRAY[${label}]::varchar[]` as any),
          ),
        ),
      );
      countQb = countQb.where((eb) =>
        eb.or(
          options.labels!.map((label) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eb("blocks.labels", "@>", sql`ARRAY[${label}]::varchar[]` as any),
          ),
        ),
      );
    }

    // User filter
    if (userId !== undefined) {
      qb = qb.where("blocks.user_id", "=", userId);
      countQb = countQb.where("blocks.user_id", "=", userId);
    }

    qb = qb.orderBy("blocks.updated_at", "desc");

    if (pagination) {
      qb = qb.limit(pagination.limit).offset(pagination.offset);
    }

    const [results, countResult] = await Promise.all([
      qb.execute(),
      countQb.executeTakeFirst(),
    ]);

    const items = results.map((r) => {
      const type = r.type_id_joined
        ? {
            id: r.type_id_joined,
            name: r.type_name!,
            description: r.type_description,
          }
        : null;

      const block = this.mapBlock(r, type, r.folder_name ?? null);
      block.text = r.text || "";
      return block;
    });

    return { items, total: Number(countResult?.count ?? 0) };
  }

  async listBlocksWithFolders(
    userId: number,
    pagination: PaginationOptions,
  ): Promise<BlocksWithFoldersResult> {
    // Get total counts
    const [folderCountResult, looseBlockCountResult] = await Promise.all([
      this.db
        .selectFrom("block_folders")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .executeTakeFirst(),
      this.db
        .selectFrom("blocks")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .where("folder_id", "is", null)
        .executeTakeFirst(),
    ]);

    const totalFolders = Number(folderCountResult?.count ?? 0);
    const totalLooseBlocks = Number(looseBlockCountResult?.count ?? 0);

    const { limit, offset } = pagination;
    let folders: BlockFolder[] = [];
    let looseBlocks: Block[] = [];

    // Determine how many folders and loose blocks to fetch for this page
    if (offset < totalFolders) {
      // We need some folders
      const foldersToFetch = Math.min(limit, totalFolders - offset);
      const folderResults = await this.db
        .selectFrom("block_folders")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("name", "asc")
        .limit(foldersToFetch)
        .offset(offset)
        .execute();

      folders = folderResults.map((r) => this.mapBlockFolder(r));

      // If we didn't fill the page with folders, get loose blocks
      const remainingSlots = limit - folders.length;
      if (remainingSlots > 0) {
        looseBlocks = await this.fetchLooseBlocks(userId, remainingSlots, 0);
      }
    } else {
      // All folders are before this page, only fetch loose blocks
      const looseBlockOffset = offset - totalFolders;
      looseBlocks = await this.fetchLooseBlocks(
        userId,
        limit,
        looseBlockOffset,
      );
    }

    return {
      folders,
      looseBlocks,
      totalFolders,
      totalLooseBlocks,
    };
  }

  private async fetchLooseBlocks(
    userId: number,
    limit: number,
    offset: number,
  ): Promise<Block[]> {
    const results = await this.db
      .selectFrom("blocks")
      .leftJoin("types", "blocks.type_id", "types.id")
      .selectAll("blocks")
      .select((eb) => [
        eb.fn
          .coalesce(
            eb
              .selectFrom("block_revisions as active_rev")
              .select("active_rev.text")
              .whereRef("active_rev.id", "=", "blocks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("block_revisions")
              .select("text")
              .whereRef("block_revisions.block_id", "=", "blocks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("text"),
      ])
      .select([
        "types.id as type_id_joined",
        "types.name as type_name",
        "types.description as type_description",
      ])
      .where("blocks.user_id", "=", userId)
      .where("blocks.folder_id", "is", null)
      .orderBy("blocks.updated_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return results.map((r) => {
      const type = r.type_id_joined
        ? {
            id: r.type_id_joined,
            name: r.type_name!,
            description: r.type_description,
          }
        : null;

      const block = this.mapBlock(r, type, null);
      block.text = r.text || "";
      return block;
    });
  }

  async getFolderBlocks(folderId: number): Promise<Block[]> {
    const results = await this.db
      .selectFrom("blocks")
      .leftJoin("types", "blocks.type_id", "types.id")
      .leftJoin("block_folders", "blocks.folder_id", "block_folders.id")
      .selectAll("blocks")
      .select((eb) => [
        eb.fn
          .coalesce(
            eb
              .selectFrom("block_revisions as active_rev")
              .select("active_rev.text")
              .whereRef("active_rev.id", "=", "blocks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("block_revisions")
              .select("text")
              .whereRef("block_revisions.block_id", "=", "blocks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("text"),
      ])
      .select([
        "types.id as type_id_joined",
        "types.name as type_name",
        "types.description as type_description",
        "block_folders.name as folder_name",
      ])
      .where("blocks.folder_id", "=", folderId)
      .orderBy("blocks.updated_at", "desc")
      .execute();

    return results.map((r) => {
      const type = r.type_id_joined
        ? {
            id: r.type_id_joined,
            name: r.type_name!,
            description: r.type_description,
          }
        : null;

      const block = this.mapBlock(r, type, r.folder_name ?? null);
      block.text = r.text || "";
      return block;
    });
  }

  async createBlockFolder(input: CreateBlockFolderInput): Promise<BlockFolder> {
    const now = new Date();
    const result = await this.db
      .insertInto("block_folders")
      .values({
        name: input.name,
        description: input.description ?? null,
        user_id: input.userId ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapBlockFolder(result);
  }

  async getBlockFolder(id: number): Promise<BlockFolder | null> {
    const result = await this.db
      .selectFrom("block_folders")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return result ? this.mapBlockFolder(result) : null;
  }

  async updateBlockFolder(
    id: number,
    updates: UpdateBlockFolderInput,
  ): Promise<BlockFolder> {
    const updateData: Updateable<Database["block_folders"]> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description ?? null;

    const result = await this.db
      .updateTable("block_folders")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapBlockFolder(result);
  }

  async deleteBlockFolder(id: number): Promise<void> {
    // Set folder_id to NULL for all blocks in this folder
    await this.db
      .updateTable("blocks")
      .set({ folder_id: null, updated_at: new Date() })
      .where("folder_id", "=", id)
      .execute();

    // Delete the folder
    await this.db.deleteFrom("block_folders").where("id", "=", id).execute();
  }

  async listBlockFolders(userId: number): Promise<BlockFolder[]> {
    const results = await this.db
      .selectFrom("block_folders")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("name", "asc")
      .execute();

    return results.map((r) => this.mapBlockFolder(r));
  }

  async createStackFolder(input: CreateStackFolderInput): Promise<StackFolder> {
    const now = new Date();
    const result = await this.db
      .insertInto("stack_folders")
      .values({
        name: input.name,
        description: input.description ?? null,
        user_id: input.userId ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapStackFolder(result);
  }

  async getStackFolder(id: number): Promise<StackFolder | null> {
    const result = await this.db
      .selectFrom("stack_folders")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return result ? this.mapStackFolder(result) : null;
  }

  async updateStackFolder(
    id: number,
    updates: UpdateStackFolderInput,
  ): Promise<StackFolder> {
    const updateData: Updateable<Database["stack_folders"]> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description ?? null;

    const result = await this.db
      .updateTable("stack_folders")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapStackFolder(result);
  }

  async deleteStackFolder(id: number): Promise<void> {
    // Set folder_id to NULL for all stacks in this folder
    await this.db
      .updateTable("stacks")
      .set({ folder_id: null, updated_at: new Date() })
      .where("folder_id", "=", id)
      .execute();

    // Delete the folder
    await this.db.deleteFrom("stack_folders").where("id", "=", id).execute();
  }

  async listStackFolders(userId: number): Promise<StackFolder[]> {
    const results = await this.db
      .selectFrom("stack_folders")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("name", "asc")
      .execute();

    return results.map((r) => this.mapStackFolder(r));
  }

  async getFolderStacks(folderId: number): Promise<BlockStack[]> {
    const results = await this.db
      .selectFrom("stacks")
      .leftJoin("stack_folders", "stacks.folder_id", "stack_folders.id")
      .selectAll("stacks")
      .select((eb) => [
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .select(["stack_folders.name as folder_name"])
      .where("stacks.folder_id", "=", folderId)
      .orderBy("stacks.updated_at", "desc")
      .execute();

    return results.map((r) => {
      const stack = this.mapStack(r, r.folder_name ?? null);
      stack.blockIds = r.block_ids || [];
      stack.disabledBlockIds = r.disabled_block_ids || [];
      return stack;
    });
  }

  async listStacksWithFolders(
    userId: number,
    pagination: PaginationOptions,
  ): Promise<StacksWithFoldersResult> {
    // Get total counts
    const [folderCountResult, looseStackCountResult] = await Promise.all([
      this.db
        .selectFrom("stack_folders")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .executeTakeFirst(),
      this.db
        .selectFrom("stacks")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .where("folder_id", "is", null)
        .executeTakeFirst(),
    ]);

    const totalFolders = Number(folderCountResult?.count ?? 0);
    const totalLooseStacks = Number(looseStackCountResult?.count ?? 0);

    const { limit, offset } = pagination;
    let folders: StackFolder[] = [];
    let looseStacks: BlockStack[] = [];

    // Determine how many folders and loose stacks to fetch for this page
    if (offset < totalFolders) {
      // We need some folders
      const foldersToFetch = Math.min(limit, totalFolders - offset);
      const folderResults = await this.db
        .selectFrom("stack_folders")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("name", "asc")
        .limit(foldersToFetch)
        .offset(offset)
        .execute();

      folders = folderResults.map((r) => this.mapStackFolder(r));

      // If we didn't fill the page with folders, get loose stacks
      const remainingSlots = limit - folders.length;
      if (remainingSlots > 0) {
        looseStacks = await this.fetchLooseStacks(userId, remainingSlots, 0);
      }
    } else {
      // All folders are before this page, only fetch loose stacks
      const looseStackOffset = offset - totalFolders;
      looseStacks = await this.fetchLooseStacks(
        userId,
        limit,
        looseStackOffset,
      );
    }

    return {
      folders,
      looseStacks,
      totalFolders,
      totalLooseStacks,
    };
  }

  private async fetchLooseStacks(
    userId: number,
    limit: number,
    offset: number,
  ): Promise<BlockStack[]> {
    const results = await this.db
      .selectFrom("stacks")
      .selectAll("stacks")
      .select((eb) => [
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .where("stacks.user_id", "=", userId)
      .where("stacks.folder_id", "is", null)
      .orderBy("stacks.updated_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return results.map((r) => {
      const stack = this.mapStack(r, null);
      stack.blockIds = r.block_ids || [];
      stack.disabledBlockIds = r.disabled_block_ids || [];
      return stack;
    });
  }

  async createRevision(input: CreateRevisionInput): Promise<BlockRevision> {
    return await this.db.transaction().execute(async (trx) => {
      const now = new Date();
      const result = await trx
        .insertInto("block_revisions")
        .values({
          block_id: input.blockId,
          text: input.text,
          user_id: input.userId ?? null,
          meta: input.meta ? JSON.stringify(input.meta) : null,
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Set the new revision as active
      await trx
        .updateTable("blocks")
        .set({
          active_revision_id: result.id,
          updated_at: now,
        })
        .where("id", "=", input.blockId)
        .execute();

      return this.mapRevision(result);
    });
  }

  async getRevisions(blockId: number): Promise<BlockRevision[]> {
    const results = await this.db
      .selectFrom("block_revisions")
      .selectAll()
      .where("block_id", "=", blockId)
      .orderBy("created_at", "desc")
      .execute();

    return results.map((r) => this.mapRevision(r));
  }

  async getRevisionsOldestFirst(blockId: number): Promise<BlockRevision[]> {
    const results = await this.db
      .selectFrom("block_revisions")
      .selectAll()
      .where("block_id", "=", blockId)
      .orderBy("created_at", "asc")
      .execute();

    return results.map((r) => this.mapRevision(r));
  }

  async getBlockWithRevisions(
    blockId: number,
  ): Promise<BlockWithRevisions | null> {
    const block = await this.getBlock(blockId);
    if (!block) return null;

    const revisions = await this.getRevisions(blockId);

    return {
      ...block,
      revisions,
    };
  }

  async setActiveRevision(blockId: number, revisionId: number): Promise<Block> {
    return await this.db.transaction().execute(async (trx) => {
      // Verify the revision belongs to this block
      const revision = await trx
        .selectFrom("block_revisions")
        .selectAll()
        .where("id", "=", revisionId)
        .where("block_id", "=", blockId)
        .executeTakeFirstOrThrow();

      // Update the block's active_revision_id
      const blockResult = await trx
        .updateTable("blocks")
        .set({
          updated_at: new Date(),
          active_revision_id: revisionId,
        })
        .where("id", "=", blockId)
        .returningAll()
        .executeTakeFirstOrThrow();

      const blockData = this.mapBlock(blockResult);

      // Return the block with the active revision's text
      return {
        ...blockData,
        text: revision.text,
      };
    });
  }

  async createStack(input: CreateStackInput): Promise<BlockStack> {
    return await this.db.transaction().execute(async (trx) => {
      const now = new Date();
      // 1. Create Stack
      const stackResult = await trx
        .insertInto("stacks")
        .values({
          uuid: input.uuid,
          name: input.name ?? null,
          display_id: input.displayId,
          comma_separated: input.commaSeparated ?? false,
          negative: input.negative ?? false,
          style: input.style ?? null,
          created_at: now,
          updated_at: now,
          user_id: input.userId ?? null,
          folder_id: input.folderId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 2. Create Initial Revision
      const revisionResult = await trx
        .insertInto("stack_revisions")
        .values({
          stack_id: stackResult.id,
          block_ids: input.blockIds ?? [],
          created_at: now,
          updated_at: now,
          user_id: input.userId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 3. Set the active_revision_id
      const updatedStackResult = await trx
        .updateTable("stacks")
        .set({
          active_revision_id: revisionResult.id,
          updated_at: now,
        })
        .where("id", "=", stackResult.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      const stack = this.mapStack(updatedStackResult);
      stack.blockIds = input.blockIds ?? [];
      stack.disabledBlockIds = [];
      return stack;
    });
  }

  async updateStack(
    id: number,
    updates: UpdateStackInput,
  ): Promise<BlockStack> {
    const updateData: Updateable<Database["stacks"]> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name ?? null;
    if (updates.displayId !== undefined)
      updateData.display_id = updates.displayId;
    if (updates.commaSeparated !== undefined)
      updateData.comma_separated = updates.commaSeparated;
    if (updates.negative !== undefined) updateData.negative = updates.negative;
    if (updates.style !== undefined) updateData.style = updates.style;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.folderId !== undefined)
      updateData.folder_id = updates.folderId ?? null;

    const stackResult = await this.db
      .updateTable("stacks")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Fetch folder name if needed
    let folderName: string | null = null;
    if (stackResult.folder_id) {
      const folderResult = await this.db
        .selectFrom("stack_folders")
        .select("name")
        .where("id", "=", stackResult.folder_id)
        .executeTakeFirst();
      if (folderResult) {
        folderName = folderResult.name;
      }
    }

    // Get current block_ids and disabled_block_ids using coalesce pattern
    const revQuery = await this.db
      .selectFrom("stacks")
      .select((eb) => [
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .where("stacks.id", "=", id)
      .executeTakeFirst();

    const stack = this.mapStack(stackResult, folderName);
    stack.blockIds = revQuery?.block_ids || [];
    stack.disabledBlockIds = revQuery?.disabled_block_ids || [];
    return stack;
  }

  async duplicateStack(id: number): Promise<BlockStack> {
    return await this.db.transaction().execute(async (trx) => {
      const now = new Date();

      // 1. Get the original stack with its active revision
      const originalStack = await trx
        .selectFrom("stacks")
        .selectAll()
        .select((eb) => [
          eb.fn
            .coalesce(
              eb
                .selectFrom("stack_revisions as active_rev")
                .select("active_rev.block_ids")
                .whereRef("active_rev.id", "=", "stacks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("stack_revisions")
                .select("block_ids")
                .whereRef("stack_revisions.stack_id", "=", "stacks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            )
            .as("block_ids"),
          eb.fn
            .coalesce(
              eb
                .selectFrom("stack_revisions as active_rev")
                .select("active_rev.disabled_block_ids")
                .whereRef("active_rev.id", "=", "stacks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("stack_revisions")
                .select("disabled_block_ids")
                .whereRef("stack_revisions.stack_id", "=", "stacks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            )
            .as("disabled_block_ids"),
          eb.fn
            .coalesce(
              eb
                .selectFrom("stack_revisions as active_rev")
                .select("active_rev.rendered_content")
                .whereRef("active_rev.id", "=", "stacks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("stack_revisions")
                .select("rendered_content")
                .whereRef("stack_revisions.stack_id", "=", "stacks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            )
            .as("rendered_content"),
        ])
        .where("stacks.id", "=", id)
        .executeTakeFirstOrThrow();

      // 2. Generate new UUID and display_id with random suffix
      const newUuid = crypto.randomUUID();
      const randomSuffix = crypto.randomBytes(3).toString("hex"); // 6 character hex string
      const newDisplayId = `${originalStack.display_id}-${randomSuffix}`;

      // 3. Create the new stack
      const newStackResult = await trx
        .insertInto("stacks")
        .values({
          uuid: newUuid,
          name: originalStack.name,
          display_id: newDisplayId,
          comma_separated: originalStack.comma_separated,
          negative: originalStack.negative,
          style: originalStack.style,
          created_at: now,
          updated_at: now,
          user_id: originalStack.user_id,
          folder_id: originalStack.folder_id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 4. Create initial revision with same block_ids, disabled_block_ids, and rendered_content
      const newRevisionResult = await trx
        .insertInto("stack_revisions")
        .values({
          stack_id: newStackResult.id,
          block_ids: originalStack.block_ids || [],
          disabled_block_ids: originalStack.disabled_block_ids || [],
          rendered_content: originalStack.rendered_content || null,
          created_at: now,
          updated_at: now,
          user_id: originalStack.user_id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 5. Set the active_revision_id
      const updatedStackResult = await trx
        .updateTable("stacks")
        .set({
          active_revision_id: newRevisionResult.id,
          updated_at: now,
        })
        .where("id", "=", newStackResult.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      const stack = this.mapStack(updatedStackResult);
      stack.blockIds = originalStack.block_ids || [];
      stack.disabledBlockIds = originalStack.disabled_block_ids || [];
      return stack;
    });
  }

  async setActiveStackRevision(
    stackId: number,
    revisionId: number,
  ): Promise<BlockStack> {
    return await this.db.transaction().execute(async (trx) => {
      // Verify the revision belongs to this stack
      const revision = await trx
        .selectFrom("stack_revisions")
        .selectAll()
        .where("id", "=", revisionId)
        .where("stack_id", "=", stackId)
        .executeTakeFirstOrThrow();

      // Update the stack's active_revision_id
      const stackResult = await trx
        .updateTable("stacks")
        .set({
          updated_at: new Date(),
          active_revision_id: revisionId,
        })
        .where("id", "=", stackId)
        .returningAll()
        .executeTakeFirstOrThrow();

      const stack = this.mapStack(stackResult);
      stack.blockIds = revision.block_ids;
      stack.disabledBlockIds = revision.disabled_block_ids;
      return stack;
    });
  }

  async getStackRevisions(stackId: number): Promise<StackRevision[]> {
    const results = await this.db
      .selectFrom("stack_revisions")
      .selectAll()
      .where("stack_id", "=", stackId)
      .orderBy("created_at", "desc")
      .execute();

    return results.map((r) => this.mapStackRevision(r));
  }

  async getStack(
    id: number,
    options?: GetStackOptions,
  ): Promise<BlockStack | StackWithBlocks | null> {
    const result = await this.db
      .selectFrom("stacks")
      .leftJoin("stack_folders", "stacks.folder_id", "stack_folders.id")
      .selectAll("stacks")
      .select((eb) => [
        // First try to get block_ids from active_revision_id if set, otherwise get latest revision
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .select(["stack_folders.name as folder_name"])
      .where("stacks.id", "=", id)
      .executeTakeFirst();

    if (!result) return null;

    const stack = this.mapStack(result, result.folder_name ?? null);
    stack.blockIds = result.block_ids || [];
    stack.disabledBlockIds = result.disabled_block_ids || [];

    if (options?.includeBlocks) {
      return this.expandStack(stack, options.includeRevisions ?? false);
    }

    return stack;
  }

  async getStackByUuid(
    uuid: string,
    options?: GetStackOptions,
  ): Promise<BlockStack | StackWithBlocks | null> {
    const result = await this.db
      .selectFrom("stacks")
      .leftJoin("stack_folders", "stacks.folder_id", "stack_folders.id")
      .selectAll("stacks")
      .select((eb) => [
        // First try to get block_ids from active_revision_id if set, otherwise get latest revision
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .select(["stack_folders.name as folder_name"])
      .where("stacks.uuid", "=", uuid)
      .executeTakeFirst();

    if (!result) return null;

    const stack = this.mapStack(result, result.folder_name ?? null);
    stack.blockIds = result.block_ids || [];
    stack.disabledBlockIds = result.disabled_block_ids || [];

    if (options?.includeBlocks) {
      return this.expandStack(stack, options.includeRevisions ?? false);
    }

    return stack;
  }

  async getStackByDisplayId(
    displayId: string,
    userId: number,
    options?: GetStackOptions,
  ): Promise<BlockStack | StackWithBlocks | null> {
    const result = await this.db
      .selectFrom("stacks")
      .leftJoin("stack_folders", "stacks.folder_id", "stack_folders.id")
      .selectAll("stacks")
      .select((eb) => [
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .select(["stack_folders.name as folder_name"])
      .where("stacks.display_id", "=", displayId)
      .where("stacks.user_id", "=", userId)
      .executeTakeFirst();

    if (!result) return null;

    const stack = this.mapStack(result, result.folder_name ?? null);
    stack.blockIds = result.block_ids || [];
    stack.disabledBlockIds = result.disabled_block_ids || [];

    if (options?.includeBlocks) {
      return this.expandStack(stack, options.includeRevisions ?? false);
    }

    return stack;
  }

  async deleteStack(id: number): Promise<void> {
    await this.db
      .deleteFrom("stack_snapshots")
      .where("stack_id", "=", id)
      .execute();
    await this.db
      .deleteFrom("stack_revisions")
      .where("stack_id", "=", id)
      .execute();
    await this.db.deleteFrom("stacks").where("id", "=", id).execute();
  }

  async createStackSnapshot(
    input: CreateStackSnapshotInput,
  ): Promise<StackSnapshot> {
    const now = new Date();
    const result = await this.db
      .insertInto("stack_snapshots")
      .values({
        display_id: input.displayId,
        name: input.name ?? null,
        notes: input.notes ?? null,
        rendered_content: input.renderedContent,
        block_ids: input.blockIds,
        disabled_block_ids: input.disabledBlockIds,
        stack_id: input.stackId,
        user_id: input.userId ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapStackSnapshot(result);
  }

  async updateStackSnapshot(
    id: number,
    updates: UpdateStackSnapshotInput,
  ): Promise<StackSnapshot> {
    const updateData: Updateable<Database["stack_snapshots"]> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name ?? null;
    if (updates.notes !== undefined) updateData.notes = updates.notes ?? null;

    const result = await this.db
      .updateTable("stack_snapshots")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapStackSnapshot(result);
  }

  async listStackSnapshots(stackId: number): Promise<StackSnapshot[]> {
    const results = await this.db
      .selectFrom("stack_snapshots")
      .selectAll()
      .where("stack_id", "=", stackId)
      .orderBy("created_at", "desc")
      .execute();

    return results.map((r) => this.mapStackSnapshot(r));
  }

  async deleteStackSnapshot(id: number): Promise<void> {
    await this.db.deleteFrom("stack_snapshots").where("id", "=", id).execute();
  }

  async getSnapshotByDisplayId(
    displayId: string,
    userId: number,
  ): Promise<StackSnapshot | null> {
    const result = await this.db
      .selectFrom("stack_snapshots")
      .selectAll()
      .where("display_id", "=", displayId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!result) return null;
    return this.mapStackSnapshot(result);
  }

  async listAllSnapshots(
    userId: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<StackSnapshot>> {
    let query = this.db
      .selectFrom("stack_snapshots")
      .leftJoin("stacks", "stack_snapshots.stack_id", "stacks.id")
      .selectAll("stack_snapshots")
      .select([
        "stacks.display_id as stack_display_id",
        "stacks.name as stack_name",
      ])
      .where("stack_snapshots.user_id", "=", userId);

    const countResult = await this.db
      .selectFrom("stack_snapshots")
      .select(this.db.fn.countAll<number>().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow();

    query = query.orderBy("stack_snapshots.created_at", "desc");

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const results = await query.execute();
    return {
      items: results.map((r) => ({
        ...this.mapStackSnapshot(r),
        stackDisplayId: r.stack_display_id ?? undefined,
        stackName: r.stack_name ?? undefined,
      })),
      total: Number(countResult.count),
    };
  }

  async searchSnapshots(
    options: SearchSnapshotsOptions,
    userId: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<StackSnapshot>> {
    let query = this.db
      .selectFrom("stack_snapshots")
      .leftJoin("stacks", "stack_snapshots.stack_id", "stacks.id")
      .selectAll("stack_snapshots")
      .select([
        "stacks.display_id as stack_display_id",
        "stacks.name as stack_name",
      ])
      .where("stack_snapshots.user_id", "=", userId);

    let countQuery = this.db
      .selectFrom("stack_snapshots")
      .leftJoin("stacks", "stack_snapshots.stack_id", "stacks.id")
      .select(this.db.fn.countAll<number>().as("count"))
      .where("stack_snapshots.user_id", "=", userId);

    if (options.query) {
      const searchTerm = `%${options.query}%`;
      const condition = (eb: any) =>
        eb.or([
          eb("stack_snapshots.name", "ilike", searchTerm),
          eb("stack_snapshots.display_id", "ilike", searchTerm),
          eb("stack_snapshots.rendered_content", "ilike", searchTerm),
          eb("stacks.name", "ilike", searchTerm),
          eb("stacks.display_id", "ilike", searchTerm),
        ]);
      query = query.where(condition);
      countQuery = countQuery.where(condition);
    }

    const countResult = await countQuery.executeTakeFirstOrThrow();

    query = query.orderBy("stack_snapshots.created_at", "desc");

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const results = await query.execute();
    return {
      items: results.map((r) => ({
        ...this.mapStackSnapshot(r),
        stackDisplayId: r.stack_display_id ?? undefined,
        stackName: r.stack_name ?? undefined,
      })),
      total: Number(countResult.count),
    };
  }

  async listStacks(
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<BlockStack>> {
    let query = this.db
      .selectFrom("stacks")
      .leftJoin("stack_folders", "stacks.folder_id", "stack_folders.id")
      .selectAll("stacks")
      .select((eb) => [
        // First try to get block_ids from active_revision_id if set, otherwise get latest revision
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .select(["stack_folders.name as folder_name"]);

    if (userId !== undefined) {
      query = query.where("stacks.user_id", "=", userId);
    }

    query = query.orderBy("stacks.updated_at", "desc");

    // Count query
    let countQuery = this.db
      .selectFrom("stacks")
      .select((eb) => eb.fn.countAll<number>().as("count"));
    if (userId !== undefined) {
      countQuery = countQuery.where("stacks.user_id", "=", userId);
    }

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const [results, countResult] = await Promise.all([
      query.execute(),
      countQuery.executeTakeFirst(),
    ]);

    const items = results.map((r) => {
      const stack = this.mapStack(r, r.folder_name ?? null);
      stack.blockIds = r.block_ids || [];
      stack.disabledBlockIds = r.disabled_block_ids || [];
      return stack;
    });

    return { items, total: Number(countResult?.count ?? 0) };
  }

  async countStacks(userId?: number): Promise<number> {
    let query = this.db
      .selectFrom("stacks")
      .select((eb) => eb.fn.countAll<number>().as("count"));

    if (userId !== undefined) {
      query = query.where("stacks.user_id", "=", userId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async searchStacks(
    options: SearchStacksOptions,
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<BlockStack>> {
    let query = this.db
      .selectFrom("stacks")
      .leftJoin(
        "stack_revisions",
        "stacks.active_revision_id",
        "stack_revisions.id",
      )
      .leftJoin("stack_folders", "stacks.folder_id", "stack_folders.id")
      .selectAll("stacks")
      .select((eb) => [
        // First try to get block_ids from active_revision_id if set, otherwise get latest revision
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .select(["stack_folders.name as folder_name"]);

    // Build a parallel count query with the same filters
    let countQuery = this.db
      .selectFrom("stacks")
      .leftJoin(
        "stack_revisions",
        "stacks.active_revision_id",
        "stack_revisions.id",
      )
      .select((eb) => eb.fn.countAll<number>().as("count"));

    // Text search filter
    if (options.query) {
      const searchPattern = `%${options.query}%`;
      query = query.where((eb) =>
        eb.or([
          eb("stacks.uuid", "ilike", searchPattern),
          eb("stacks.display_id", "ilike", searchPattern),
          eb("stacks.name", "ilike", searchPattern),
          eb("stack_revisions.rendered_content", "ilike", searchPattern),
        ]),
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("stacks.uuid", "ilike", searchPattern),
          eb("stacks.display_id", "ilike", searchPattern),
          eb("stacks.name", "ilike", searchPattern),
          eb("stack_revisions.rendered_content", "ilike", searchPattern),
        ]),
      );
    }

    // User filter
    if (userId !== undefined) {
      query = query.where("stacks.user_id", "=", userId);
      countQuery = countQuery.where("stacks.user_id", "=", userId);
    }

    query = query.orderBy("stacks.updated_at", "desc");

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const [results, countResult] = await Promise.all([
      query.execute(),
      countQuery.executeTakeFirst(),
    ]);

    const items = results.map((r) => {
      const stack = this.mapStack(r, r.folder_name ?? null);
      stack.blockIds = r.block_ids || [];
      stack.disabledBlockIds = r.disabled_block_ids || [];
      return stack;
    });

    return { items, total: Number(countResult?.count ?? 0) };
  }

  async getCompiledPrompt(
    displayId: string,
    userId: number,
  ): Promise<string | null> {
    // 1. Get Stack by displayId and userId with block_ids from active or latest revision
    const result = await this.db
      .selectFrom("stacks")
      .select((eb) => [
        "stacks.id",
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("block_ids"),
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.disabled_block_ids")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("disabled_block_ids")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("disabled_block_ids"),
      ])
      .where("display_id", "=", displayId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!result || !result.block_ids || result.block_ids.length === 0) {
      return "";
    }

    // 2. Get active revision text for each block in order
    // We fetch all blocks involved, then map them back to the order
    const blockIds = result.block_ids;
    const disabledBlockIds = result.disabled_block_ids || [];

    const blocksData = await this.db
      .selectFrom("blocks")
      .select(["id", "active_revision_id"])
      .where("id", "in", blockIds)
      .execute();

    // Map blockId -> activeRevisionId (or query latest if null)
    const activeRevisionIds: number[] = [];
    const blocksNeedingLatest: number[] = [];

    const blockMap = new Map(blocksData.map((b) => [b.id, b]));

    for (const id of blockIds) {
      const block = blockMap.get(id);
      if (block) {
        if (block.active_revision_id) {
          activeRevisionIds.push(block.active_revision_id);
        } else {
          blocksNeedingLatest.push(block.id);
        }
      }
    }

    const textsMap = new Map<number, string>(); // blockId -> text

    // Fetch texts for blocks with active_revision_id
    if (activeRevisionIds.length > 0) {
      const activeRevisions = await this.db
        .selectFrom("block_revisions")
        .select(["block_id", "text"])
        .where("id", "in", activeRevisionIds)
        .execute();

      activeRevisions.forEach((rev) => {
        if (rev.block_id !== null) {
          textsMap.set(rev.block_id, rev.text);
        }
      });
    }

    // Fetch latest texts for blocks without active_revision_id
    if (blocksNeedingLatest.length > 0) {
      // This is slightly more complex in one query, so we'll do a simple loop or a lateral join if supported
      // For simplicity/readability, let's just fetch latest for these blocks
      // A window function would be better but keeping it simple for now
      const latestRevisions = await this.db
        .selectFrom("block_revisions")
        .select(["block_id", "text"])
        .where("block_id", "in", blocksNeedingLatest)
        .orderBy("block_id") // Required for distinctOn
        .orderBy("created_at", "desc")
        .distinctOn("block_id") // Kysely supports distinctOn for PG
        .execute();

      latestRevisions.forEach((rev) => {
        if (rev.block_id !== null) {
          textsMap.set(rev.block_id, rev.text);
        }
      });
    }

    // 3. Compile the prompt in the correct order, excluding disabled blocks
    const compiledParts = blockIds
      .filter((id) => !disabledBlockIds.includes(id))
      .map((id) => textsMap.get(id))
      .filter((text) => text !== undefined && text !== null);

    return compiledParts.join("\n\n");
  }

  async getRenderedPrompt(
    displayId: string,
    userId: number,
  ): Promise<string | null> {
    // 1. Get Stack by displayId and userId with rendered content from active or latest revision
    const result = await this.db
      .selectFrom("stacks")
      .select((eb) => [
        eb.fn
          .coalesce(
            eb
              .selectFrom("stack_revisions as active_rev")
              .select("active_rev.rendered_content")
              .whereRef("active_rev.id", "=", "stacks.active_revision_id")
              .limit(1),
            eb
              .selectFrom("stack_revisions")
              .select("rendered_content")
              .whereRef("stack_revisions.stack_id", "=", "stacks.id")
              .orderBy("created_at", "desc")
              .limit(1),
          )
          .as("rendered_content"),
      ])
      .where("display_id", "=", displayId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    return result?.rendered_content || null;
  }

  async addBlockToStack(
    stackId: number,
    blockId: number,
    order?: number,
    renderedContent?: string,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date();

      // Get current block_ids and user_id (from active revision if set, otherwise latest)
      const currentRev = await trx
        .selectFrom("stacks")
        .select((eb) => [
          "stacks.user_id",
          eb.fn
            .coalesce(
              eb
                .selectFrom("stack_revisions as active_rev")
                .select("active_rev.block_ids")
                .whereRef("active_rev.id", "=", "stacks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("stack_revisions")
                .select("block_ids")
                .whereRef("stack_revisions.stack_id", "=", "stacks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            )
            .as("block_ids"),
          eb.fn
            .coalesce(
              eb
                .selectFrom("stack_revisions as active_rev")
                .select("active_rev.disabled_block_ids")
                .whereRef("active_rev.id", "=", "stacks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("stack_revisions")
                .select("disabled_block_ids")
                .whereRef("stack_revisions.stack_id", "=", "stacks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            )
            .as("disabled_block_ids"),
        ])
        .where("stacks.id", "=", stackId)
        .executeTakeFirst();

      let newBlockIds: number[];
      if (!currentRev?.block_ids) {
        newBlockIds = [blockId];
      } else if (
        order !== undefined &&
        order >= 0 &&
        order <= currentRev.block_ids.length
      ) {
        // Insert at specific position
        newBlockIds = [
          ...currentRev.block_ids.slice(0, order),
          blockId,
          ...currentRev.block_ids.slice(order),
        ];
      } else {
        // Append to end if order not specified or out of bounds
        newBlockIds = [...currentRev.block_ids, blockId];
      }

      // Create new revision
      const newRevision = await trx
        .insertInto("stack_revisions")
        .values({
          stack_id: stackId,
          block_ids: newBlockIds,
          disabled_block_ids: currentRev?.disabled_block_ids || [],
          rendered_content: renderedContent || null,
          created_at: now,
          updated_at: now,
          user_id: currentRev?.user_id ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Set as active revision
      await trx
        .updateTable("stacks")
        .set({
          active_revision_id: newRevision.id,
          updated_at: now,
        })
        .where("id", "=", stackId)
        .execute();
    });
  }

  async removeBlockFromStack(
    stackId: number,
    blockId: number,
    renderedContent?: string,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date();

      // Get current block_ids, disabled_block_ids, and user_id (from active revision if set, otherwise latest)
      const currentRev = await trx
        .selectFrom("stacks")
        .select((eb) => [
          "stacks.user_id",
          eb.fn
            .coalesce(
              eb
                .selectFrom("stack_revisions as active_rev")
                .select("active_rev.block_ids")
                .whereRef("active_rev.id", "=", "stacks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("stack_revisions")
                .select("block_ids")
                .whereRef("stack_revisions.stack_id", "=", "stacks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            )
            .as("block_ids"),
          eb.fn
            .coalesce(
              eb
                .selectFrom("stack_revisions as active_rev")
                .select("active_rev.disabled_block_ids")
                .whereRef("active_rev.id", "=", "stacks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("stack_revisions")
                .select("disabled_block_ids")
                .whereRef("stack_revisions.stack_id", "=", "stacks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            )
            .as("disabled_block_ids"),
        ])
        .where("stacks.id", "=", stackId)
        .executeTakeFirst();

      if (!currentRev?.block_ids) return;

      const newBlockIds = currentRev.block_ids.filter((id) => id !== blockId);
      const newDisabledBlockIds = (currentRev.disabled_block_ids || []).filter(
        (id) => id !== blockId,
      );

      // Create new revision
      const newRevision = await trx
        .insertInto("stack_revisions")
        .values({
          stack_id: stackId,
          block_ids: newBlockIds,
          disabled_block_ids: newDisabledBlockIds,
          rendered_content: renderedContent || null,
          created_at: now,
          updated_at: now,
          user_id: currentRev?.user_id ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Set as active revision
      await trx
        .updateTable("stacks")
        .set({
          active_revision_id: newRevision.id,
          updated_at: now,
        })
        .where("id", "=", stackId)
        .execute();
    });
  }

  async reorderStackBlocks(
    stackId: number,
    blockIds: number[],
    renderedContent?: string,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date();

      // Get the active revision ID (or fall back to latest)
      const stackInfo = await trx
        .selectFrom("stacks")
        .select(["active_revision_id"])
        .where("id", "=", stackId)
        .executeTakeFirst();

      let revisionIdToUpdate: number | null = null;

      if (stackInfo?.active_revision_id) {
        revisionIdToUpdate = stackInfo.active_revision_id;
      } else {
        // No active revision set, get latest by created_at
        const latestRev = await trx
          .selectFrom("stack_revisions")
          .select("id")
          .where("stack_id", "=", stackId)
          .orderBy("created_at", "desc")
          .limit(1)
          .executeTakeFirst();

        revisionIdToUpdate = latestRev?.id ?? null;
      }

      if (!revisionIdToUpdate) return;

      // Update the revision in place (no new revision created)
      await trx
        .updateTable("stack_revisions")
        .set({
          block_ids: blockIds,
          rendered_content: renderedContent || null,
          updated_at: now,
        })
        .where("id", "=", revisionIdToUpdate)
        .execute();

      // Update the stack's updated_at timestamp
      await trx
        .updateTable("stacks")
        .set({ updated_at: now })
        .where("id", "=", stackId)
        .execute();
    });
  }

  async updateStackRevisionContent(
    stackId: number,
    renderedContent: string,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date();

      // Get the active revision ID (or fall back to latest)
      const stackInfo = await trx
        .selectFrom("stacks")
        .select(["active_revision_id"])
        .where("id", "=", stackId)
        .executeTakeFirst();

      let revisionIdToUpdate: number | null = null;

      if (stackInfo?.active_revision_id) {
        revisionIdToUpdate = stackInfo.active_revision_id;
      } else {
        // No active revision set, get latest by created_at
        const latestRev = await trx
          .selectFrom("stack_revisions")
          .select("id")
          .where("stack_id", "=", stackId)
          .orderBy("created_at", "desc")
          .limit(1)
          .executeTakeFirst();

        revisionIdToUpdate = latestRev?.id ?? null;
      }

      if (!revisionIdToUpdate) return;

      // Update the revision in place
      await trx
        .updateTable("stack_revisions")
        .set({
          rendered_content: renderedContent,
          updated_at: now,
        })
        .where("id", "=", revisionIdToUpdate)
        .execute();

      // Update the stack's updated_at timestamp
      await trx
        .updateTable("stacks")
        .set({ updated_at: now })
        .where("id", "=", stackId)
        .execute();
    });
  }

  async toggleBlockDisabledInStack(
    stackId: number,
    blockId: number,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const now = new Date();

      // Get the active revision ID (or fall back to latest)
      const stackInfo = await trx
        .selectFrom("stacks")
        .select(["active_revision_id"])
        .where("id", "=", stackId)
        .executeTakeFirst();

      let revisionIdToUpdate: number | null = null;

      if (stackInfo?.active_revision_id) {
        revisionIdToUpdate = stackInfo.active_revision_id;
      } else {
        const latestRev = await trx
          .selectFrom("stack_revisions")
          .select("id")
          .where("stack_id", "=", stackId)
          .orderBy("created_at", "desc")
          .limit(1)
          .executeTakeFirst();

        revisionIdToUpdate = latestRev?.id ?? null;
      }

      if (!revisionIdToUpdate) return;

      // Get current disabled_block_ids
      const currentRev = await trx
        .selectFrom("stack_revisions")
        .select("disabled_block_ids")
        .where("id", "=", revisionIdToUpdate)
        .executeTakeFirst();

      const currentDisabled = currentRev?.disabled_block_ids || [];
      const newDisabled = currentDisabled.includes(blockId)
        ? currentDisabled.filter((id) => id !== blockId)
        : [...currentDisabled, blockId];

      // Update in place
      await trx
        .updateTable("stack_revisions")
        .set({
          disabled_block_ids: newDisabled,
          updated_at: now,
        })
        .where("id", "=", revisionIdToUpdate)
        .execute();

      // Update stack's updated_at
      await trx
        .updateTable("stacks")
        .set({ updated_at: now })
        .where("id", "=", stackId)
        .execute();
    });
  }

  async createStackTemplate(
    input: CreateStackTemplateInput,
  ): Promise<StackTemplate> {
    const now = new Date();
    const result = await this.db
      .insertInto("stack_templates")
      .values({
        display_id: input.displayId,
        name: input.name ?? null,
        block_ids: input.blockIds ?? [],
        disabled_block_ids: input.disabledBlockIds ?? [],
        comma_separated: input.commaSeparated ?? true,
        negative: input.negative ?? false,
        style: input.style ?? null,
        notes: input.notes ?? null,
        user_id: input.userId ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapStackTemplate(result);
  }

  async getStackTemplate(id: number): Promise<StackTemplate | null> {
    const result = await this.db
      .selectFrom("stack_templates")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return result ? this.mapStackTemplate(result) : null;
  }

  async updateStackTemplate(
    id: number,
    updates: UpdateStackTemplateInput,
  ): Promise<StackTemplate> {
    const updateData: Updateable<Database["stack_templates"]> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name ?? null;
    if (updates.blockIds !== undefined) updateData.block_ids = updates.blockIds;
    if (updates.disabledBlockIds !== undefined)
      updateData.disabled_block_ids = updates.disabledBlockIds;
    if (updates.commaSeparated !== undefined)
      updateData.comma_separated = updates.commaSeparated;
    if (updates.negative !== undefined) updateData.negative = updates.negative;
    if (updates.style !== undefined) updateData.style = updates.style ?? null;
    if (updates.notes !== undefined) updateData.notes = updates.notes ?? null;

    const result = await this.db
      .updateTable("stack_templates")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapStackTemplate(result);
  }

  async deleteStackTemplate(id: number): Promise<void> {
    await this.db.deleteFrom("stack_templates").where("id", "=", id).execute();
  }

  async listStackTemplates(
    userId: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<StackTemplate>> {
    const countResult = await this.db
      .selectFrom("stack_templates")
      .select(this.db.fn.countAll<number>().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow();

    let query = this.db
      .selectFrom("stack_templates")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("updated_at", "desc");

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const results = await query.execute();
    return {
      items: results.map((r) => this.mapStackTemplate(r)),
      total: Number(countResult.count),
    };
  }

  async searchStackTemplates(
    options: SearchStackTemplatesOptions,
    userId: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<StackTemplate>> {
    let query = this.db
      .selectFrom("stack_templates")
      .selectAll()
      .where("user_id", "=", userId);

    let countQuery = this.db
      .selectFrom("stack_templates")
      .select(this.db.fn.countAll<number>().as("count"))
      .where("user_id", "=", userId);

    if (options.query) {
      const searchTerm = `%${options.query}%`;
      const condition = (eb: any) =>
        eb.or([
          eb("name", "ilike", searchTerm),
          eb("display_id", "ilike", searchTerm),
          eb("notes", "ilike", searchTerm),
        ]);
      query = query.where(condition);
      countQuery = countQuery.where(condition);
    }

    const countResult = await countQuery.executeTakeFirstOrThrow();

    query = query.orderBy("updated_at", "desc");

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const results = await query.execute();
    return {
      items: results.map((r) => this.mapStackTemplate(r)),
      total: Number(countResult.count),
    };
  }

  async createType(name: string, description?: string): Promise<Type> {
    const result = await this.db
      .insertInto("types")
      .values({
        name,
        description: description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapType(result);
  }

  async getType(id: number): Promise<Type | null> {
    const result = await this.db
      .selectFrom("types")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return result ? this.mapType(result) : null;
  }

  async listTypes(): Promise<Type[]> {
    const results = await this.db.selectFrom("types").selectAll().execute();
    return results.map((r) => this.mapType(r));
  }

  async createWildcard(input: CreateWildcardInput): Promise<Wildcard> {
    const now = new Date();
    const result = await this.db
      .insertInto("wildcards")
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
      .executeTakeFirstOrThrow();

    return this.mapWildcard(result);
  }

  async getWildcard(id: number): Promise<Wildcard | null> {
    const result = await this.db
      .selectFrom("wildcards")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return result ? this.mapWildcard(result) : null;
  }

  async getWildcardByUuid(uuid: string): Promise<Wildcard | null> {
    const result = await this.db
      .selectFrom("wildcards")
      .selectAll()
      .where("uuid", "=", uuid)
      .executeTakeFirst();

    return result ? this.mapWildcard(result) : null;
  }

  async updateWildcard(
    id: number,
    updates: UpdateWildcardInput,
  ): Promise<Wildcard> {
    const updateData: Updateable<Database["wildcards"]> = {
      updated_at: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.format !== undefined) updateData.format = updates.format;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.meta !== undefined) {
      updateData.meta = updates.meta ? JSON.stringify(updates.meta) : null;
    }

    const result = await this.db
      .updateTable("wildcards")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapWildcard(result);
  }

  async deleteWildcard(id: number): Promise<void> {
    await this.db.deleteFrom("wildcards").where("id", "=", id).execute();
  }

  async listWildcards(
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Wildcard>> {
    let query = this.db
      .selectFrom("wildcards")
      .selectAll()
      .orderBy("updated_at", "desc");

    let countQuery = this.db
      .selectFrom("wildcards")
      .select((eb) => eb.fn.countAll<number>().as("count"));

    if (userId !== undefined) {
      query = query.where("user_id", "=", userId);
      countQuery = countQuery.where("user_id", "=", userId);
    }

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const [results, countResult] = await Promise.all([
      query.execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      items: results.map((r) => this.mapWildcard(r)),
      total: Number(countResult?.count ?? 0),
    };
  }

  async searchWildcards(
    options: SearchWildcardsOptions,
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Wildcard>> {
    let query = this.db.selectFrom("wildcards").selectAll();
    let countQuery = this.db
      .selectFrom("wildcards")
      .select((eb) => eb.fn.countAll<number>().as("count"));

    // Text search filter
    if (options.query) {
      const searchPattern = `%${options.query}%`;
      const searchFilter = (eb: any) =>
        eb.or([
          eb("wildcards.uuid", "ilike", searchPattern),
          eb("wildcards.display_id", "ilike", searchPattern),
          eb("wildcards.name", "ilike", searchPattern),
          eb("wildcards.content", "ilike", searchPattern),
        ]);
      query = query.where(searchFilter);
      countQuery = countQuery.where(searchFilter);
    }

    // User filter
    if (userId !== undefined) {
      query = query.where("wildcards.user_id", "=", userId);
      countQuery = countQuery.where("wildcards.user_id", "=", userId);
    }

    query = query.orderBy("wildcards.updated_at", "desc");

    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset);
    }

    const [results, countResult] = await Promise.all([
      query.execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      items: results.map((r) => this.mapWildcard(r)),
      total: Number(countResult?.count ?? 0),
    };
  }

  async countWildcards(): Promise<number> {
    const result = await this.db
      .selectFrom("wildcards")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  private async expandStack(
    stack: BlockStack,
    includeRevisions: boolean,
  ): Promise<StackWithBlocks> {
    const blockIds = stack.blockIds;

    const blocks: BlockWithRevisions[] = [];

    if (blockIds.length > 0) {
      // Fetch blocks with types and text
      const blockResults = await this.db
        .selectFrom("blocks")
        .leftJoin("types", "blocks.type_id", "types.id")
        .leftJoin("block_folders", "blocks.folder_id", "block_folders.id")
        .selectAll("blocks")
        .select((eb) => [
          // First try to get text from active_revision_id if set, otherwise get latest revision
          eb.fn
            .coalesce(
              eb
                .selectFrom("block_revisions as active_rev")
                .select("active_rev.text")
                .whereRef("active_rev.id", "=", "blocks.active_revision_id")
                .limit(1),
              eb
                .selectFrom("block_revisions")
                .select("text")
                .whereRef("block_revisions.block_id", "=", "blocks.id")
                .orderBy("created_at", "desc")
                .limit(1),
            )
            .as("text"),
        ])
        .select([
          "types.id as type_id_joined",
          "types.name as type_name",
          "types.description as type_description",
          "block_folders.name as folder_name",
        ])
        .where("blocks.id", "in", blockIds)
        .execute();

      const blocksMap = new Map<number, Block>();
      for (const r of blockResults) {
        const type = r.type_id_joined
          ? {
              id: r.type_id_joined,
              name: r.type_name!,
              description: r.type_description,
            }
          : null;

        const b = this.mapBlock(r, type, r.folder_name ?? null);
        b.text = r.text || "";
        blocksMap.set(b.id, b);
      }

      for (const id of blockIds) {
        const block = blocksMap.get(id);
        if (block) {
          let revisions: BlockRevision[] = [];
          if (includeRevisions) {
            revisions = await this.getRevisions(id);
          }
          blocks.push({ ...block, revisions });
        }
      }
    }

    let stackRevisions: StackRevision[] = [];
    if (includeRevisions) {
      const revRows = await this.db
        .selectFrom("stack_revisions")
        .selectAll()
        .where("stack_id", "=", stack.id)
        .orderBy("created_at", "desc")
        .execute();
      stackRevisions = revRows.map((r) => this.mapStackRevision(r));
    }

    return {
      ...stack,
      blocks,
      revisions: stackRevisions,
    };
  }

  private mapBlock(
    row: Selectable<Database["blocks"]>,
    type: Type | null = null,
    folderName: string | null = null,
  ): Block {
    return {
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      notes: row.notes,
      displayId: row.display_id,
      text: "", // To be filled by revision
      activeRevisionId: row.active_revision_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      typeId: row.type_id,
      type: type,
      folderId: row.folder_id,
      folderName: folderName,
      labels: row.labels,
      userId: row.user_id,
      meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
      includeInCaption: row.include_in_caption ?? false,
    };
  }

  private mapBlockFolder(
    row: Selectable<Database["block_folders"]>,
  ): BlockFolder {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapStackFolder(
    row: Selectable<Database["stack_folders"]>,
  ): StackFolder {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRevision(
    row: Selectable<Database["block_revisions"]>,
  ): BlockRevision {
    return {
      id: row.id,
      text: row.text,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
      userId: row.user_id,
      blockId: row.block_id,
    };
  }

  private mapStack(
    row: Selectable<Database["stacks"]>,
    folderName: string | null = null,
  ): BlockStack {
    return {
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      displayId: row.display_id,
      commaSeparated: row.comma_separated,
      negative: row.negative ?? false,
      style: row.style,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      userId: row.user_id,
      folderId: row.folder_id,
      folderName: folderName,
      activeRevisionId: row.active_revision_id,
      blockIds: [], // To be filled by subquery
      disabledBlockIds: [], // To be filled by subquery
    };
  }

  private mapStackRevision(
    row: Selectable<Database["stack_revisions"]>,
  ): StackRevision {
    return {
      id: row.id,
      stackId: row.stack_id,
      blockIds: row.block_ids,
      disabledBlockIds: row.disabled_block_ids,
      renderedContent: row.rendered_content,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      userId: row.user_id,
    };
  }

  private mapType(row: Selectable<Database["types"]>): Type {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
    };
  }

  private mapWildcard(row: Selectable<Database["wildcards"]>): Wildcard {
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
      meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
    };
  }

  private mapStackSnapshot(
    row: Selectable<Database["stack_snapshots"]>,
  ): StackSnapshot {
    return {
      id: row.id,
      displayId: row.display_id,
      name: row.name,
      notes: row.notes,
      renderedContent: row.rendered_content,
      blockIds: row.block_ids || [],
      disabledBlockIds: row.disabled_block_ids || [],
      stackId: row.stack_id!,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapStackTemplate(
    row: Selectable<Database["stack_templates"]>,
  ): StackTemplate {
    return {
      id: row.id,
      displayId: row.display_id,
      name: row.name,
      blockIds: row.block_ids || [],
      disabledBlockIds: row.disabled_block_ids || [],
      commaSeparated: row.comma_separated,
      negative: row.negative,
      style: row.style ?? null,
      notes: row.notes,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
