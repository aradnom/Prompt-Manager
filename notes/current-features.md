# Prompt Manager Features

A comprehensive list of features in the Prompt Manager application.

## Pages

### Home (`/`)

- Welcome screen with application introduction
- Active prompt editor with real-time editing
- Output panel showing compiled prompt
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

### Blocks (`/blocks`)

- Create, edit, and delete reusable text blocks
- Search blocks by name, display ID, or content
- Assign types and labels to blocks
- View block revision history
- Restore previous block versions

### Wildcards (`/wildcards`)

- Create and manage wildcard templates
- Support for 4 formats: JSON, YAML, Lines, Plain Text
- AI-powered wildcard generation (describe a concept, get 20 values)
- Auto-label generated wildcards
- Search by name, display ID, or content

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
- Logout

### Developer Settings (`/developer-settings`)

- Admin-only access
- Switch active LLM target platform

### What Is This (`/what-is-this`)

- Educational content explaining blocks, prompts, wildcards, and LLM operations

### LM Studio CORS (`/lm-studio-cors`)

- Instructions for configuring LM Studio CORS settings

## Core Data Models

### Blocks

- Reusable text fragments
- Display ID, name, type, labels, metadata
- Full revision history with rollback

### Prompts (Stacks)

- Ordered collections of blocks
- Comma-separated or space-separated output toggle
- T5 (FLUX) or CLIP (Stable Diffusion) output style
- Full revision history with rollback

### Wildcards

- Random value templates
- Multiple format support (JSON, YAML, Lines, Text)
- Insertable into blocks with `{{wildcard:id}}` syntax

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

### Output Formatting

- **T5 Style** (FLUX): Natural language prose, complete sentences, inverted pyramid
- **CLIP Style** (Stable Diffusion): Comma-separated tokens, keyword-efficient

### Provider Support

- Google Vertex AI
- OpenAI
- Anthropic
- Grok
- LM Studio (local)
- Per-provider model selection
- Falls back to server keys if user hasn't configured

## UI Features

### Block Editing

- Inline text editing (click to edit)
- Transform buttons with loading indicators
- Revision viewer with horizontal scroll
- Wildcard browser for inserting wildcards

### Prompt Editor

- Drag-and-drop block reordering
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

- Framer Motion animations throughout
- Custom loading animation (DefragLoader)
- Loading button states for async operations
- Tooltips and metadata display
- Responsive layout

## Authentication

- Token-based authentication (no passwords)
- Unique 128-bit account tokens with rejection sampling
- Tokens hashed with HMAC-SHA256 for storage
- Session-based with encrypted derived keys
- HttpOnly, Secure, SameSite cookies
- Session regeneration to prevent fixation attacks
- 30-day session duration
- Admin roles for developer features
- ComfyUI API key generation for integrations
- Per-provider encrypted API key storage

## API

### Blocks

- Create, read, update, delete
- List with search and filtering
- Revision management

### Prompts (Stacks)

- Create, read, update, delete, duplicate
- Add/remove/reorder blocks
- Toggle block disabled state
- Revision management

### Wildcards

- Create, read, update, delete
- List with search

### LLM

- Transform text with operation and style parameters
- User API key override support

### Auth

- Register, login, logout
- Session management
- API key management (LLM providers and integration keys)
- Platform selection
