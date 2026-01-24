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

export interface User {
  id: number
  tokenHash: string | null
  accountData: Record<string, string> | null
  apiKey: string | null
}

export interface CreateUserInput {
  tokenHash: string
  accountData: Record<string, string>
}

export interface IStorageAdapter {
  initialize(): Promise<void>

  createUser(input: CreateUserInput): Promise<User>
  getUserById(id: number): Promise<User | null>
  getUserByTokenHash(tokenHash: string): Promise<User | null>
  getUserIdByApiKey(apiKey: string): Promise<number | null>

  createBlock(input: CreateBlockInput): Promise<Block>
  getBlock(id: number): Promise<Block | null>
  getBlockByUuid(uuid: string): Promise<Block | null>
  updateBlock(id: number, updates: UpdateBlockInput): Promise<Block>
  deleteBlock(id: number): Promise<void>
  listBlocks(userId?: number): Promise<Block[]>
  searchBlocks(options: SearchBlocksOptions, userId?: number): Promise<Block[]>

  createRevision(input: CreateRevisionInput): Promise<BlockRevision>
  getRevisions(blockId: number): Promise<BlockRevision[]>
  getRevisionsOldestFirst(blockId: number): Promise<BlockRevision[]>
  getBlockWithRevisions(blockId: number): Promise<BlockWithRevisions | null>
  setActiveRevision(blockId: number, revisionId: number): Promise<Block>

  createStack(input: CreateStackInput): Promise<BlockStack>
  getStack(id: number, options?: GetStackOptions): Promise<BlockStack | StackWithBlocks | null>
  getStackByUuid(uuid: string, options?: GetStackOptions): Promise<BlockStack | StackWithBlocks | null>
  updateStack(id: number, updates: UpdateStackInput): Promise<BlockStack>
  duplicateStack(id: number): Promise<BlockStack>
  setActiveStackRevision(stackId: number, revisionId: number): Promise<BlockStack>
  getStackRevisions(stackId: number): Promise<StackRevision[]>
  getCompiledPrompt(displayId: string, userId: number): Promise<string | null>
  getRenderedPrompt(displayId: string, userId: number): Promise<string | null>
  deleteStack(id: number): Promise<void>
  listStacks(userId?: number): Promise<BlockStack[]>
  searchStacks(options: SearchStacksOptions, userId?: number): Promise<BlockStack[]>

  addBlockToStack(stackId: number, blockId: number, order?: number, renderedContent?: string): Promise<void>
  removeBlockFromStack(stackId: number, blockId: number, renderedContent?: string): Promise<void>
  reorderStackBlocks(stackId: number, blockIds: number[], renderedContent?: string): Promise<void>
  updateStackRevisionContent(stackId: number, renderedContent: string): Promise<void>

  createType(name: string, description?: string): Promise<Type>
  getType(id: number): Promise<Type | null>
  listTypes(): Promise<Type[]>

  createWildcard(input: CreateWildcardInput): Promise<Wildcard>
  getWildcard(id: number): Promise<Wildcard | null>
  getWildcardByUuid(uuid: string): Promise<Wildcard | null>
  updateWildcard(id: number, updates: UpdateWildcardInput): Promise<Wildcard>
  deleteWildcard(id: number): Promise<void>
  listWildcards(userId?: number): Promise<Wildcard[]>
  searchWildcards(options: SearchWildcardsOptions, userId?: number): Promise<Wildcard[]>
}

export interface GetStackOptions {
  includeBlocks?: boolean
  includeRevisions?: boolean
}

export interface SearchBlocksOptions {
  query?: string
  typeId?: number
  labels?: string[]
}

export interface SearchStacksOptions {
  query?: string
}

export interface SearchWildcardsOptions {
  query?: string
}
