# Prompt Manager Features

A comprehensive list of features in the Prompt Manager application.

## Pages

### Home (`/`)

- Welcome screen with application introduction and feature overview
- Active prompt editor with real-time editing
- Output panel showing compiled/rendered prompt
- Prompt switcher for quickly changing active prompt
- Account creation/login for unauthenticated users

### Prompts (`/prompts`, `/prompts/:displayId`)

- List all prompts with search
- Create new prompts with auto-generated or custom display IDs
- Edit prompt names and settings inline
- Duplicate prompts (shallow copy, references same blocks)
- Delete prompts
- Set a prompt as "active" (shown on home page)
- View and restore previous prompt revisions
- See block count per prompt
- Folder organization for prompts

### Blocks (`/blocks`, `/blocks/new`)

- Create, edit, and delete reusable text blocks
- Search blocks by name, display ID, or content
- Assign types and labels to blocks
- View block revision history and restore previous versions
- Folder organization for blocks
- Inline text editing (click to edit)
- Wildcard browser for inserting wildcards into block text
- Text selection menu for quick LLM transforms on selected text

### Wildcards (`/wildcards`)

- Create and manage wildcard templates
- Support for 4 formats: JSON, YAML, Lines, Plain Text
- CodeMirror editor for JSON/YAML editing
- AI-powered wildcard generation (describe a concept, get 20 values)
- Auto-label generated wildcards
- Search by name, display ID, or content

### Snapshots (`/snapshots`)

- Save named snapshots of prompt state
- Browse and restore previous snapshots
- Compare snapshot contents

### Templates (`/templates`, `/templates/:id`)

- Create reusable prompt templates from existing prompts
- Browse and apply templates
- Template editor with block management

### Account (`/account`)

- View unique account token
- Generate/revoke ComfyUI integration API keys
- Configure API keys for LLM providers:
  - Google Vertex AI
  - OpenAI
  - Anthropic
  - Grok
  - LM Studio (local)
- Select model variants per provider
- Test API keys before saving
- User scratchpad for notes
- Logout

### Developer Settings (`/developer-settings`)

- Admin-only access
- Switch active LLM target platform

### Features (`/features`)

- Public feature showcase page

### LM Studio CORS (`/lm-studio-cors`)

- Instructions for configuring LM Studio CORS settings for local LLM use

## Core Data Models

### Blocks

- Reusable text fragments
- Display ID, name, type, labels, metadata
- Full revision history with rollback
- Folder organization

### Prompts (Stacks)

- Ordered collections of blocks
- Comma-separated or space-separated output toggle
- T5 (FLUX) or CLIP (Stable Diffusion) output style
- Full revision history with rollback
- Folder organization

### Wildcards

- Random value templates
- Multiple format support (JSON, YAML, Lines, Text)
- Insertable into blocks with `{{wildcard:id}}` syntax

### Snapshots

- Named point-in-time captures of prompt state
- Browsable and restorable

### Templates

- Reusable prompt blueprints with associated blocks

## LLM-Powered Features

### Text Transforms

- **More Descriptive** - Expand text to ~2x length with more detail
- **Less Descriptive** - Condense to ~half length while preserving core subject
- **Variation (Slight)** - Minor word changes, same length/meaning
- **Variation (Fair)** - Moderate rephrasing with different vocabulary
- **Variation (Very)** - Significant reinterpretation of the same theme

### Generation

- **Explore** - Generate 5 variations at progressive difference levels
- **Generate** - Generate 5 suggestions based on a concept description
- **Generate Wildcard** - Generate 20 wildcard values for a category
- **Auto-Label** - Generate title and code-friendly identifier from text
- **Enrich** - Enhance and expand on existing content

### Output Formatting

- **T5 Style** (FLUX): Natural language prose, complete sentences, inverted pyramid
- **CLIP Style** (Stable Diffusion): Comma-separated tokens, keyword-efficient

### Provider Support

- Google Vertex AI (Gemini)
- OpenAI
- Anthropic (Claude)
- Grok (xAI)
- LM Studio (local)
- Per-provider model selection
- Falls back to server-configured keys if user hasn't configured their own
- Extended thinking support (Claude, Vertex)
- Client-side LLM inference via Transformers.js (Hugging Face models)

## UI Features

### Block Editing

- Inline text editing (click to edit)
- Transform buttons with loading indicators
- Revision viewer with horizontal scroll
- Wildcard browser for inserting wildcards
- Text selection menu for in-place LLM transforms

### Prompt Editor

- Drag-and-drop block reordering (dnd-kit)
- Selection mode for batch operations
- Merge multiple blocks into one
- Remove multiple blocks at once
- Toggle individual blocks on/off

### Output Panel

- Live compiled prompt display
- Copy to clipboard
- Randomize all wildcards
- Convert output to new block
- Comma/space separator toggle
- Minimizable/expandable

### Search & Navigation

- Full-text search on blocks, prompts, wildcards
- Type and label filtering for blocks
- Prompt switcher dropdown on home page

### Visual Polish

- Motion (Framer Motion) animations throughout
- Custom loading animation (DefragLoader)
- Loading button states for async operations
- Tooltips and metadata display
- Responsive layout
- Parallax decorative elements

## Authentication

- Token-based authentication (no passwords)
- Unique 128-bit account tokens with rejection sampling
- Tokens hashed with HMAC-SHA256 for storage
- Session-based with encrypted derived keys (AES-256-GCM)
- HttpOnly, Secure, SameSite cookies
- Session regeneration to prevent fixation attacks
- 30-day session duration
- Admin roles for developer features
- ComfyUI API key generation for integrations
- Per-provider encrypted API key storage

## Integrations

### ComfyUI

- Custom node integration via API key authentication
- REST endpoint for fetching active prompt (`/api/integrations/comfyui/prompts`)
- Server-Sent Events (SSE) for real-time prompt updates
- Snapshot access endpoint

## Anti-Abuse

- Per-IP rate limiting on auth endpoints (configurable window/max)
- Per-user rate limiting on tRPC mutations (LLM transforms, feedback)
- Cloudflare Turnstile bot protection on feedback form
- Content size limits on all user inputs

## Notifications

- Email notifications via Resend (admin emails)
- Watchdog service for milestone monitoring (production only)
- Redis-backed notification deduplication

## API (tRPC)

### Blocks

- Create, read, update, delete
- List with search and filtering
- Revision management
- Folder management

### Prompts (Stacks)

- Create, read, update, delete, duplicate
- Add/remove/reorder blocks
- Toggle block disabled state
- Revision management
- Folder management

### Wildcards

- Create, read, update, delete
- List with search

### LLM

- Transform text with operation and style parameters
- User API key override support
- 9 operation types

### Snapshots

- Create, list, get, delete snapshots

### Templates

- Create, list, get, update, delete templates

### Users

- Scratchpad read/write
- Feedback submission (with Turnstile verification)

### Config

- Public settings endpoint (allowed LLM targets, Turnstile site key)

### Auth (Express)

- Register, login, logout
- Session management
- API key management (LLM providers and integration keys)
- Encrypted account data storage

## Tech Stack

### Frontend

- React 18, TypeScript, Vite
- Tailwind CSS 4, Motion (animations)
- Radix UI / shadcn/ui components
- React Router 7, tRPC Client, React Query
- CodeMirror 6 (JSON/YAML editing)
- Transformers.js (client-side ML)
- dnd-kit (drag-and-drop)

### Backend

- Node.js, Express 5, TypeScript
- tRPC 11 (type-safe API)
- Kysely (type-safe SQL query builder)
- PostgreSQL 16 (primary database)
- Redis 7 (sessions, rate limiting, notifications)
- Resend (email)

### Infrastructure

- Docker (containerization)
- Kubernetes on GCP (production)
