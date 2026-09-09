# syntax=docker/dockerfile:1
#
# Build context is the repo root (see local/build.sh / deploy.sh):
#   docker build -f deploy/Dockerfile .
#
# What lands in the context is controlled by deploy/Dockerfile.dockerignore,
# which BuildKit picks up automatically for this Dockerfile (and which takes
# precedence over the .dockerignore at the repo root).

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM node:24.13-alpine3.23 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Production stage
# ---------------------------------------------------------------------------
FROM node:24.13-alpine3.23

# Useful for debugging inside the container, uncomment if needed
# RUN apk add --no-cache vim git

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Install production dependencies + tsx (needed to run the TS server)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install tsx && npm cache clean --force && chown -R app:app /app

# Built frontend
COPY --from=build --chown=app:app /app/dist ./dist

# Server and shared source (executed directly via tsx)
COPY --chown=app:app server ./server
COPY --chown=app:app shared ./shared

# Baseline schema, needed by `npm run init-schema` to bootstrap a fresh database
COPY --chown=app:app local-dev/init ./local-dev/init

# tsconfig files (needed by tsx for path alias resolution)
COPY --chown=app:app tsconfig.json ./
COPY --chown=app:app server/tsconfig.json ./server/

USER app

ENV NODE_ENV=production

# The box's convention is that every app listens on 8080 inside its container;
# Caddy proxies to <container-name>:8080. compose.yaml sets PORT too — this
# keeps a bare `docker run` of the image consistent with it.
ENV PORT=8080
EXPOSE 8080

# CMD ["sh"]
CMD ["npx", "tsx", "server/src/index.ts"]
