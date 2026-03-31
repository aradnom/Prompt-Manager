# Prompt Manager

A web-based tool for building, organizing, and managing prompts for image generation models like FLUX and Stable Diffusion. It treats prompts as composable structures — reusable text blocks that can be assembled, reordered, and transformed with AI assistance — rather than as flat strings you have to edit by hand. The result is a prompt workflow that scales with complexity: wildcards for randomization, snapshots for versioning, templates for reuse, and LLM-powered transforms for iteration.

The live instance is at [prompts.rodeo](https://www.prompts.rodeo/).

## Features

### Prompt Composition

- Build prompts from reusable, ordered text blocks that can be toggled on/off, reordered via drag-and-drop, and merged
- Two output styles: **T5** (FLUX-optimized natural language) and **CLIP** (Stable Diffusion comma-separated tokens)
- Live rendered output panel with copy-to-clipboard and wildcard randomization
- Organize prompts and blocks into folders

### Wildcards

- Define wildcard templates in JSON, YAML, line-separated, or plain text formats
- Insert wildcards into blocks with `{{wildcard:id}}` syntax — resolved at render time with random selection
- AI-powered wildcard generation: describe a category and get 20 values with auto-labeling

### LLM Text Transforms

- **5 transform operations**: expand, condense, and three levels of variation (slight, fair, very)
- **Generation tools**: explore (5 progressive variations), generate from concept, auto-label, enrich
- Works with Google Vertex AI (Gemini), OpenAI, Anthropic (Claude), Grok (xAI), and LM Studio (local)
- Users can configure their own API keys per provider, or fall back to server-configured defaults
- Text selection menu for in-place transforms on highlighted text

### Versioning

- Full revision history on blocks and prompts with one-click restore
- Named snapshots for capturing prompt state at a point in time
- Reusable templates created from existing prompts

### Account & Security

- Token-based authentication (no passwords) with encrypted session storage
- Per-provider API key storage, encrypted at rest (AES-256-GCM)
- Rate limiting on auth and mutation endpoints
- Cloudflare Turnstile bot protection

### Client-Side ML

- Optional client-side inference via Transformers.js for Hugging Face models
- No server round-trip needed for supported operations

## ComfyUI Integration

Prompt Manager integrates with ComfyUI through a [custom node package](https://github.com/aradnom/Prompt-Manager-ComfyUI) that pulls your active prompt directly into ComfyUI workflows. The integration uses API key authentication with real-time updates via Server-Sent Events, so changes in Prompt Manager are immediately available in ComfyUI. See the custom node repo for installation and usage details.

## Running Locally

### Prerequisites

- Node.js 24+
- Docker (for PostgreSQL and Redis)

### Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file and fill in the required secrets:

```bash
cp .env.example .env
```

You'll need to set at minimum:

- `SESSION_SECRET` — random string, 32+ characters
- `ENCRYPTION_SALT` — exactly 32 characters
- `TOKEN_SECRET` — random string, 32+ characters
- `API_KEY_SECRET` — exactly 32 characters

LLM provider keys are optional — the app works without them, but LLM features will be unavailable.

3. Start PostgreSQL and Redis:

```bash
cd local-dev && docker compose up -d && cd ..
```

This starts PostgreSQL 16 on port 5432 and Redis 7 on port 6379. The database is created automatically.

4. Start the backend:

```bash
npm run server
```

The API server runs at `http://localhost:3001`. Database migrations run automatically on first start.

5. Start the frontend (in a separate terminal):

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Other Commands

| Command                 | Description                                  |
| ----------------------- | -------------------------------------------- |
| `npm run build`         | Build frontend and server for production     |
| `npm run lint`          | Run ESLint                                   |
| `npm run tslint`        | TypeScript type checking (frontend + server) |
| `npm run test:llm`      | Run LLM service tests                        |
| `npm run migrate`       | Run pending database migrations              |
| `npm run migrate:down`  | Roll back last migration                     |
| `npm run migrate:check` | Check migration status                       |
