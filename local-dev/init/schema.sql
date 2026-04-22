-- users

CREATE TABLE users (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username character varying(255),
    email character varying(255),
    token_hash character varying(255) UNIQUE,
    account_data jsonb,
    api_key character varying(255),
    scratchpad text,
    active_stack_id integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
);

-- types

CREATE TABLE types (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    description character varying(512)
);

-- block_folders

CREATE TABLE block_folders (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text,
    description text,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

-- blocks

CREATE TABLE blocks (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid character varying(255) UNIQUE,
    display_id character varying(255) UNIQUE,
    name text,
    notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    type_id integer REFERENCES types(id) ON DELETE SET NULL ON UPDATE CASCADE,
    folder_id integer REFERENCES block_folders(id) ON DELETE SET NULL ON UPDATE CASCADE,
    labels character varying(255)[],
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    meta json,
    active_revision_id integer REFERENCES block_revisions(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- block_revisions

CREATE TABLE block_revisions (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    text text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    meta json,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    block_id integer REFERENCES blocks(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- stack_folders

CREATE TABLE stack_folders (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text,
    description text,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

-- stacks

CREATE TABLE stacks (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid character varying(255) UNIQUE,
    display_id character varying(255) UNIQUE,
    name text,
    comma_separated boolean DEFAULT true,
    negative boolean DEFAULT false,
    style character varying(32),
    notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    folder_id integer REFERENCES stack_folders(id) ON DELETE SET NULL ON UPDATE CASCADE,
    active_revision_id integer REFERENCES stack_revisions(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- stack_revisions

CREATE TABLE stack_revisions (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stack_id integer REFERENCES stacks(id) ON DELETE SET NULL ON UPDATE CASCADE,
    block_ids integer[] DEFAULT '{}'::integer[],
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    rendered_content text,
    meta json,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

-- stack_snapshots

CREATE TABLE stack_snapshots (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    display_id character varying(255) NOT NULL,
    name text,
    notes text,
    rendered_content text NOT NULL,
    block_ids integer[] DEFAULT '{}'::integer[],
    disabled_block_ids integer[] DEFAULT '{}'::integer[],
    stack_id integer REFERENCES stacks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

-- stack_templates

CREATE TABLE stack_templates (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    display_id character varying(255) NOT NULL,
    name text,
    block_ids integer[] DEFAULT '{}'::integer[],
    disabled_block_ids integer[] DEFAULT '{}'::integer[],
    comma_separated boolean DEFAULT true,
    negative boolean DEFAULT false,
    style character varying(32),
    notes text,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);

-- wildcards

CREATE TABLE wildcards (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid character varying(255) UNIQUE,
    display_id character varying(255) UNIQUE,
    name text,
    format text,
    content text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    meta json
);

-- deferred foreign keys (circular references)

ALTER TABLE users
    ADD CONSTRAINT fk_users_active_stack
    FOREIGN KEY (active_stack_id) REFERENCES stacks(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
