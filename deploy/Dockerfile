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

RUN apk add --no-cache vim git

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

# tsconfig files (needed by tsx for path alias resolution)
COPY --chown=app:app tsconfig.json ./
COPY --chown=app:app server/tsconfig.json ./server/

USER app

ENV NODE_ENV=production

EXPOSE 3001

# CMD ["sh"]
CMD ["npx", "tsx", "server/src/index.ts"]
