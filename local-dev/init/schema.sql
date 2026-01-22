-- users

CREATE TABLE users (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username character varying(255),
    email character varying(255),
    api_key character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
);

-- types

CREATE TABLE types (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name character varying(255),
    description character varying(512)
);

-- blocks

CREATE TABLE blocks (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid character varying(255) UNIQUE,
    display_id character varying(255) UNIQUE,
    name character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    type_id integer REFERENCES types(id) ON DELETE SET NULL ON UPDATE CASCADE,
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

-- stacks

CREATE TABLE stacks (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid character varying(255) UNIQUE,
    display_id character varying(255) UNIQUE,
    name character varying(255),
    comma_separated boolean DEFAULT true,
    style character varying(32),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
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

-- wildcards

CREATE TABLE wildcards (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid character varying(255) UNIQUE,
    display_id character varying(255) UNIQUE,
    name character varying(255),
    format character varying(50),
    content text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id integer REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    meta json
);
