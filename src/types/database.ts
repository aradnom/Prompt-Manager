import type { ColumnType } from "kysely";

export interface UsersTable {
  id: ColumnType<number, never, never>;
  token_hash: ColumnType<string | null, string | null, string | null>;
  account_data: ColumnType<
    Record<string, string> | null,
    string | null,
    string | null
  >;
  api_key: ColumnType<string | null, string | null, string | null>;
  admin_user: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  scratchpad: ColumnType<string | null, string | null, string | null>;
  active_stack_id: number | null;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
}

export interface TypesTable {
  id: ColumnType<number, never, never>;
  name: string;
  description: string | null;
}

export interface BlockFoldersTable {
  id: ColumnType<number, never, never>;
  name: string;
  description: string | null;
  user_id: number | null;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
}

export interface BlocksTable {
  id: ColumnType<number, never, never>;
  uuid: string;
  display_id: string;
  name: string | null;
  notes: ColumnType<string | null, string | null, string | null>;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
  type_id: number | null;
  folder_id: number | null;
  labels: string[];
  user_id: number | null;
  meta: ColumnType<
    Record<string, unknown> | null,
    string | null,
    string | null
  >;
  active_revision_id: number | null;
  include_in_caption: ColumnType<
    boolean,
    boolean | undefined,
    boolean | undefined
  >;
}

export interface BlockRevisionsTable {
  id: ColumnType<number, never, never>;
  text: string;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
  meta: ColumnType<
    Record<string, unknown> | null,
    string | null,
    string | null
  >;
  user_id: number | null;
  block_id: number | null;
}

export interface StackFoldersTable {
  id: ColumnType<number, never, never>;
  name: string;
  description: string | null;
  user_id: number | null;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
}

export interface BlockStacksTable {
  id: ColumnType<number, never, never>;
  uuid: string;
  display_id: string;
  name: string | null;
  comma_separated: boolean;
  negative: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  style: ColumnType<
    "t5" | "clip" | null,
    "t5" | "clip" | null,
    "t5" | "clip" | null
  >;
  notes: ColumnType<string | null, string | null, string | null>;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
  user_id: number | null;
  folder_id: number | null;
  active_revision_id: number | null;
}

export interface StackRevisionsTable {
  id: ColumnType<number, never, never>;
  stack_id: number;
  block_ids: number[];
  disabled_block_ids: ColumnType<
    number[],
    number[] | undefined,
    number[] | undefined
  >;
  rendered_content: ColumnType<string | null, string | null, string | null>;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
  user_id: number | null;
}

export interface StackSnapshotsTable {
  id: ColumnType<number, never, never>;
  display_id: string;
  name: string | null;
  notes: ColumnType<string | null, string | null, string | null>;
  rendered_content: string;
  block_ids: number[];
  disabled_block_ids: ColumnType<
    number[],
    number[] | undefined,
    number[] | undefined
  >;
  stack_id: number | null;
  user_id: number | null;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
}

export interface StackTemplatesTable {
  id: ColumnType<number, never, never>;
  display_id: string;
  name: string | null;
  block_ids: number[];
  disabled_block_ids: ColumnType<
    number[],
    number[] | undefined,
    number[] | undefined
  >;
  comma_separated: boolean;
  negative: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  style: ColumnType<
    "t5" | "clip" | null,
    "t5" | "clip" | null,
    "t5" | "clip" | null
  >;
  notes: ColumnType<string | null, string | null, string | null>;
  user_id: number | null;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
}

export interface WildcardsTable {
  id: ColumnType<number, never, never>;
  uuid: string;
  display_id: string;
  name: string;
  format: string;
  content: string;
  created_at: ColumnType<Date, Date | undefined, Date | undefined>;
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>;
  user_id: number | null;
  meta: ColumnType<
    Record<string, unknown> | null,
    string | null,
    string | null
  >;
}

export interface Database {
  users: UsersTable;
  types: TypesTable;
  block_folders: BlockFoldersTable;
  blocks: BlocksTable;
  block_revisions: BlockRevisionsTable;
  stack_folders: StackFoldersTable;
  stacks: BlockStacksTable;
  stack_revisions: StackRevisionsTable;
  stack_snapshots: StackSnapshotsTable;
  stack_templates: StackTemplatesTable;
  wildcards: WildcardsTable;
}
