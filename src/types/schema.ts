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
  /**
   * Decrypted, parsed group list from the active revision. `null` when the
   * stack has never had groups; `[]` when groups were created and then all
   * removed. Mirrors the active revision's `blockGroups` so callers don't
   * need to load the revision separately.
   *
   * NOTE: at the storage-adapter boundary this field temporarily holds the
   * raw cipher string (or null) and is replaced by the decrypted structure
   * inside the tRPC router's `decryptStack`. Same pattern as `name`/`notes`.
   */
  blockGroups: TextBlockGroup[] | null;
  labels: string[];
}

/**
 * A purely organizational grouping of blocks within a single stack revision.
 * Groups do NOT affect rendered prompt content — they're a UI concern only.
 *
 * Membership semantics: `blockIds` is treated as advisory. The renderer walks
 * these in order, skips ids that aren't in the revision's `blockIds`, and
 * stops the run at the first non-contiguous existing member. Anything from
 * that point onward in the group is silently dropped from the rendered
 * group. This keeps the feature bolt-on: a corrupt group never blocks a
 * stack from loading or saving.
 */
export interface TextBlockGroup {
  /** Stable client-generated identifier; persists across revisions. */
  id: string;
  name: string;
  /** Optional preset color key. Null means "use default styling". */
  color: string | null;
  /** Block ids in intended group order. Treated as advisory at render time. */
  blockIds: number[];
  /**
   * Persistent collapsed-state flag. Lives on the group so it survives
   * reloads and prompt switches without round-tripping through localStorage.
   */
  collapsed: boolean;
}

export interface StackRevision {
  id: number;
  stackId: number;
  blockIds: number[];
  disabledBlockIds: number[];
  /**
   * Decrypted, parsed group list. `null` when the stack has never had
   * groups; `[]` when groups were created and then all removed.
   */
  blockGroups?: TextBlockGroup[] | null;
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

export interface StackTemplate {
  id: number;
  displayId: string;
  name: string | null;
  blockIds: number[];
  disabledBlockIds: number[];
  commaSeparated: boolean;
  negative: boolean;
  style: OutputStyle;
  notes: string | null;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStackTemplateInput {
  displayId: string;
  name?: string;
  blockIds?: number[];
  disabledBlockIds?: number[];
  commaSeparated?: boolean;
  negative?: boolean;
  style?: OutputStyle;
  notes?: string;
  userId?: number;
}

export interface UpdateStackTemplateInput {
  name?: string | null;
  blockIds?: number[];
  disabledBlockIds?: number[];
  commaSeparated?: boolean;
  negative?: boolean;
  style?: OutputStyle;
  notes?: string | null;
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
  disabledBlockIds?: number[];
  folderId?: number | null;
  labels?: string[];
}

export interface UpdateStackInput {
  name?: string;
  displayId?: string;
  commaSeparated?: boolean;
  negative?: boolean;
  style?: OutputStyle;
  notes?: string | null;
  folderId?: number | null;
  labels?: string[];
}

export interface CreateRevisionInput {
  blockId: number;
  text: string;
  userId?: number;
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
