export interface User {
  id: number;
}

export interface Type {
  id: number;
  name: string;
  description: string | null;
}

export interface BlockFolder {
  id: number;
  name: string;
  description: string | null;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Block {
  id: number;
  uuid: string;
  displayId: string;
  name: string | null;
  notes: string | null;
  text: string; // Derived from latest revision
  createdAt: Date;
  updatedAt: Date;
  typeId: number | null;
  type: Type | null;
  folderId: number | null;
  folderName: string | null;
  labels: string[];
  userId: number | null;
  meta: Record<string, unknown> | null;
  activeRevisionId: number | null;
}

export interface BlockRevision {
  id: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  meta: Record<string, unknown> | null;
  userId: number | null;
  blockId: number | null;
}

export interface StackFolder {
  id: number;
  name: string;
  description: string | null;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStackFolderInput {
  name: string;
  description?: string;
  userId?: number;
}

export interface UpdateStackFolderInput {
  name?: string;
  description?: string;
}

export type OutputStyle = "t5" | "clip" | null;

export interface BlockStack {
  id: number;
  uuid: string;
  displayId: string;
  name: string | null;
  commaSeparated: boolean;
  negative: boolean;
  style: OutputStyle;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number | null;
  folderId: number | null;
  folderName: string | null;
  activeRevisionId: number | null;
  blockIds: number[];
  disabledBlockIds: number[];
}

export interface StackRevision {
  id: number;
  stackId: number;
  blockIds: number[];
  disabledBlockIds: number[];
  renderedContent?: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number | null;
}

export interface StackSnapshot {
  id: number;
  displayId: string;
  name: string | null;
  notes: string | null;
  renderedContent: string;
  blockIds: number[];
  disabledBlockIds: number[];
  stackId: number;
  stackDisplayId?: string;
  stackName?: string | null;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockWithRevisions extends Block {
  revisions: BlockRevision[];
}

export interface StackWithBlocks extends BlockStack {
  blocks: BlockWithRevisions[];
  revisions: StackRevision[];
}

export interface CreateBlockInput {
  uuid: string;
  displayId: string;
  name?: string;
  text: string;
  typeId?: number | null;
  folderId?: number | null;
  labels?: string[];
  notes?: string | null;
  userId?: number;
  meta?: Record<string, unknown>;
}

export interface UpdateBlockInput {
  name?: string;
  displayId?: string;
  text?: string;
  typeId?: number | null;
  folderId?: number | null;
  labels?: string[];
  notes?: string | null;
  meta?: Record<string, unknown>;
}

export interface CreateBlockFolderInput {
  name: string;
  description?: string;
  userId?: number;
}

export interface UpdateBlockFolderInput {
  name?: string;
  description?: string;
}

export interface CreateStackInput {
  uuid: string;
  name?: string;
  displayId: string;
  commaSeparated?: boolean;
  negative?: boolean;
  style?: OutputStyle;
  userId?: number;
  blockIds?: number[];
  folderId?: number | null;
}

export interface UpdateStackInput {
  name?: string;
  displayId?: string;
  commaSeparated?: boolean;
  negative?: boolean;
  style?: OutputStyle;
  notes?: string | null;
  folderId?: number | null;
}

export interface CreateRevisionInput {
  blockId: number;
  text: string;
  userId?: number;
  meta?: Record<string, unknown>;
}

export interface Wildcard {
  id: number;
  uuid: string;
  displayId: string;
  name: string;
  format: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId: number | null;
  meta: Record<string, unknown> | null;
}

export interface CreateWildcardInput {
  uuid: string;
  displayId: string;
  name: string;
  format: string;
  content: string;
  userId?: number;
  meta?: Record<string, unknown>;
}

export interface UpdateWildcardInput {
  name?: string;
  format?: string;
  content?: string;
  meta?: Record<string, unknown>;
}
