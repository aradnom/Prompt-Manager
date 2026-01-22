import type { ColumnType } from 'kysely'

export interface UsersTable {
  id: ColumnType<number, never, never>
  api_key: ColumnType<string | null, string | null, string | null>
}

export interface TypesTable {
  id: ColumnType<number, never, never>
  name: string
  description: string | null
}

export interface BlocksTable {
  id: ColumnType<number, never, never>
  uuid: string
  display_id: string
  name: string | null
  created_at: ColumnType<Date, Date | undefined, Date | undefined>
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>
  type_id: number | null
  labels: string[]
  user_id: number | null
  meta: ColumnType<Record<string, unknown> | null, string | null, string | null>
  active_revision_id: number | null
}

export interface BlockRevisionsTable {
  id: ColumnType<number, never, never>
  text: string
  created_at: ColumnType<Date, Date | undefined, Date | undefined>
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>
  meta: ColumnType<Record<string, unknown> | null, string | null, string | null>
  user_id: number | null
  block_id: number | null
}

export interface BlockStacksTable {
  id: ColumnType<number, never, never>
  uuid: string
  display_id: string
  name: string | null
  comma_separated: boolean
  style: ColumnType<'t5' | 'clip' | null, 't5' | 'clip' | null, 't5' | 'clip' | null>
  created_at: ColumnType<Date, Date | undefined, Date | undefined>
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>
  user_id: number | null
  active_revision_id: number | null
}

export interface StackRevisionsTable {
  id: ColumnType<number, never, never>
  stack_id: number
  block_ids: number[]
  rendered_content: ColumnType<string | null, string | null, string | null>
  created_at: ColumnType<Date, Date | undefined, Date | undefined>
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>
  user_id: number | null
}

export interface WildcardsTable {
  id: ColumnType<number, never, never>
  uuid: string
  display_id: string
  name: string
  format: string
  content: string
  created_at: ColumnType<Date, Date | undefined, Date | undefined>
  updated_at: ColumnType<Date, Date | undefined, Date | undefined>
  user_id: number | null
  meta: ColumnType<Record<string, unknown> | null, string | null, string | null>
}

export interface Database {
  users: UsersTable
  types: TypesTable
  blocks: BlocksTable
  block_revisions: BlockRevisionsTable
  stacks: BlockStacksTable
  stack_revisions: StackRevisionsTable
  wildcards: WildcardsTable
}