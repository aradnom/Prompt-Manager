# Prompt Manager

A prompt management tool for diffusion models, built with modern web technologies.

## Tech Stack

### Frontend
- **Vite** - Fast build tool and dev server
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible UI components
- **Motion** - Production-ready animation library for React
- **tRPC Client** - Type-safe API calls

### Backend
- **Express** - Web server
- **tRPC** - End-to-end type-safe API
- **Kysely** - Type-safe SQL query builder
- **PostgreSQL** - Database
- **Docker** - Containerized local development database

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the Database

```bash
cd local-dev
docker compose up -d
cd ..
```

The Postgres database will be available at `localhost:5432`.

### 3. Start the Backend Server

```bash
npm run server
```

The API server will start at `http://localhost:3001`.

### 4. Start the Frontend Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Using the API

The tRPC client is configured and ready to use:

```tsx
import { api } from '@/lib/api'

// Create a text block
const block = await api.blocks.create.mutate({
  uuid: 'abc-123',
  displayId: 'happy-purple-cat',
  text: 'A serene mountain landscape at sunset',
  labels: ['scene', 'landscape']
})

// Get a stack with all blocks and revisions
const stack = await api.stacks.get.query({
  id: 1,
  includeBlocks: true,
  includeRevisions: true
})
```
