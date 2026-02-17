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
  StackFolder,
  CreateStackFolderInput,
  UpdateStackFolderInput,
  Wildcard,
  CreateWildcardInput,
  UpdateWildcardInput,
} from "@/types/schema";

export interface User {
  id: number;
  tokenHash: string | null;
  accountData: Record<string, string> | null;
  apiKey: string | null;
  adminUser: boolean;
  scratchpad: string | null;
}

export interface CreateUserInput {
  tokenHash: string;
  accountData: Record<string, string>;
}

export interface IStorageAdapter {
  initialize(): Promise<void>;

  createUser(input: CreateUserInput): Promise<User>;
  getUserById(id: number): Promise<User | null>;
  getUserByTokenHash(tokenHash: string): Promise<User | null>;
  getUserIdByApiKey(apiKey: string): Promise<number | null>;
  updateUserAccountData(
    userId: number,
    accountData: Record<string, string>,
  ): Promise<void>;
  setUserApiKey(userId: number, apiKey: string): Promise<void>;
  clearUserApiKey(userId: number): Promise<void>;
  getUserScratchpad(userId: number): Promise<string | null>;
  setUserScratchpad(userId: number, content: string): Promise<void>;

  createBlock(input: CreateBlockInput): Promise<Block>;
  getBlock(id: number): Promise<Block | null>;
  getBlocksByIds(ids: number[]): Promise<Block[]>;
  getBlockByUuid(uuid: string): Promise<Block | null>;
  updateBlock(id: number, updates: UpdateBlockInput): Promise<Block>;
  deleteBlock(id: number): Promise<void>;
  listBlocks(
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Block>>;
  countBlocks(userId?: number): Promise<number>;
  searchBlocks(
    options: SearchBlocksOptions,
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Block>>;
  listBlocksWithFolders(
    userId: number,
    pagination: PaginationOptions,
  ): Promise<BlocksWithFoldersResult>;
  getFolderBlocks(folderId: number): Promise<Block[]>;

  createBlockFolder(input: CreateBlockFolderInput): Promise<BlockFolder>;
  getBlockFolder(id: number): Promise<BlockFolder | null>;
  updateBlockFolder(
    id: number,
    updates: UpdateBlockFolderInput,
  ): Promise<BlockFolder>;
  deleteBlockFolder(id: number): Promise<void>;
  listBlockFolders(userId: number): Promise<BlockFolder[]>;

  createStackFolder(input: CreateStackFolderInput): Promise<StackFolder>;
  getStackFolder(id: number): Promise<StackFolder | null>;
  updateStackFolder(
    id: number,
    updates: UpdateStackFolderInput,
  ): Promise<StackFolder>;
  deleteStackFolder(id: number): Promise<void>;
  listStackFolders(userId: number): Promise<StackFolder[]>;
  getFolderStacks(folderId: number): Promise<BlockStack[]>;
  listStacksWithFolders(
    userId: number,
    pagination: PaginationOptions,
  ): Promise<StacksWithFoldersResult>;

  createRevision(input: CreateRevisionInput): Promise<BlockRevision>;
  getRevisions(blockId: number): Promise<BlockRevision[]>;
  getRevisionsOldestFirst(blockId: number): Promise<BlockRevision[]>;
  getBlockWithRevisions(blockId: number): Promise<BlockWithRevisions | null>;
  setActiveRevision(blockId: number, revisionId: number): Promise<Block>;

  createStack(input: CreateStackInput): Promise<BlockStack>;
  getStack(
    id: number,
    options?: GetStackOptions,
  ): Promise<BlockStack | StackWithBlocks | null>;
  getStackByUuid(
    uuid: string,
    options?: GetStackOptions,
  ): Promise<BlockStack | StackWithBlocks | null>;
  updateStack(id: number, updates: UpdateStackInput): Promise<BlockStack>;
  duplicateStack(id: number): Promise<BlockStack>;
  setActiveStackRevision(
    stackId: number,
    revisionId: number,
  ): Promise<BlockStack>;
  getStackRevisions(stackId: number): Promise<StackRevision[]>;
  getCompiledPrompt(displayId: string, userId: number): Promise<string | null>;
  getRenderedPrompt(displayId: string, userId: number): Promise<string | null>;
  deleteStack(id: number): Promise<void>;
  listStacks(
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<BlockStack>>;
  countStacks(userId?: number): Promise<number>;
  searchStacks(
    options: SearchStacksOptions,
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<BlockStack>>;

  addBlockToStack(
    stackId: number,
    blockId: number,
    order?: number,
    renderedContent?: string,
  ): Promise<void>;
  removeBlockFromStack(
    stackId: number,
    blockId: number,
    renderedContent?: string,
  ): Promise<void>;
  reorderStackBlocks(
    stackId: number,
    blockIds: number[],
    renderedContent?: string,
  ): Promise<void>;
  updateStackRevisionContent(
    stackId: number,
    renderedContent: string,
  ): Promise<void>;
  toggleBlockDisabledInStack(stackId: number, blockId: number): Promise<void>;

  createStackSnapshot(input: CreateStackSnapshotInput): Promise<StackSnapshot>;
  listStackSnapshots(stackId: number): Promise<StackSnapshot[]>;
  deleteStackSnapshot(id: number): Promise<void>;

  createType(name: string, description?: string): Promise<Type>;
  getType(id: number): Promise<Type | null>;
  listTypes(): Promise<Type[]>;

  createWildcard(input: CreateWildcardInput): Promise<Wildcard>;
  getWildcard(id: number): Promise<Wildcard | null>;
  getWildcardByUuid(uuid: string): Promise<Wildcard | null>;
  updateWildcard(id: number, updates: UpdateWildcardInput): Promise<Wildcard>;
  deleteWildcard(id: number): Promise<void>;
  listWildcards(
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Wildcard>>;
  searchWildcards(
    options: SearchWildcardsOptions,
    userId?: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Wildcard>>;
}

export interface GetStackOptions {
  includeBlocks?: boolean;
  includeRevisions?: boolean;
}

export interface SearchBlocksOptions {
  query?: string;
  typeId?: number;
  labels?: string[];
}

export interface SearchStacksOptions {
  query?: string;
}

export interface SearchWildcardsOptions {
  query?: string;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface BlocksWithFoldersResult {
  folders: BlockFolder[];
  looseBlocks: Block[];
  totalFolders: number;
  totalLooseBlocks: number;
}

export interface StacksWithFoldersResult {
  folders: StackFolder[];
  looseStacks: BlockStack[];
  totalFolders: number;
  totalLooseStacks: number;
}

export interface CreateStackSnapshotInput {
  displayId: string;
  name?: string;
  notes?: string;
  renderedContent: string;
  blockIds: number[];
  disabledBlockIds: number[];
  stackId: number;
  userId?: number;
}
