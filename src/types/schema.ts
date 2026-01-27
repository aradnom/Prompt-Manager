export interface User {
  id: number;
}

export interface Type {
  id: number;
  name: string;
  description: string | null;
}

export interface Block {
  id: number;
  uuid: string;
  displayId: string;
  name: string | null;
  text: string; // Derived from latest revision
  createdAt: Date;
  updatedAt: Date;
  typeId: number | null;
  type: Type | null;
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

export type OutputStyle = "t5" | "clip" | null;

export interface BlockStack {
  id: number;
  uuid: string;
  displayId: string;
  name: string | null;
  commaSeparated: boolean;
  style: OutputStyle;
  createdAt: Date;
  updatedAt: Date;
  userId: number | null;
  activeRevisionId: number | null;
  blockIds: number[];
}

export interface StackRevision {
  id: number;
  stackId: number;
  blockIds: number[];
  renderedContent?: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number | null;
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
  typeId?: number;
  labels?: string[];
  userId?: number;
  meta?: Record<string, unknown>;
}

export interface UpdateBlockInput {
  name?: string;
  displayId?: string;
  text?: string;
  typeId?: number;
  labels?: string[];
  meta?: Record<string, unknown>;
}

export interface CreateStackInput {
  uuid: string;
  name?: string;
  displayId: string;
  commaSeparated?: boolean;
  style?: OutputStyle;
  userId?: number;
  blockIds?: number[];
}

export interface UpdateStackInput {
  name?: string;
  displayId?: string;
  commaSeparated?: boolean;
  style?: OutputStyle;
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
