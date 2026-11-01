# deploy/

Deploy bundle for prompt-manager on the shared Hetzner/Caddy box.
Same shape as the standard bundle in the `vps-admin` repo
(`app-deploy-template/`), with one app-specific addition: `deploy.sh` runs
`npm run migrate` before swapping the container.

The app runs as a single container. Postgres and Valkey are **shared services**
owned by the `vps-admin` repo (`services/compose.yml`) and reached over the
`services` Docker network as hosts `postgres` and `valkey`. TLS and routing are
Caddy's job — no Cloudflare Tunnel, no `cloudflared` on the host.

```
                     box
            ┌────────────────────────────────────────┐
Internet ─> │ caddy:443 ──(web network)──> prompt-manager:8080
            │                                   │
            │                        (services network)
            │                                   ├──> postgres:5432
            │                                   └──> valkey:6379
            └────────────────────────────────────────┘
```

## Files

| File                      | Runs on | Purpose                                     |
| ------------------------- | ------- | ------------------------------------------- |
| `app.env`                 | both    | `APP_NAME` — the only place the name is set |
| `compose.yaml`            | both    | the app container                           |
| `Dockerfile`              | both    | two-stage build (vite build → tsx runtime)  |
| `Dockerfile.dockerignore` | both    | what enters the build context               |
| `deploy.sh`               | box     | pull → build → migrate → swap               |
| `remote-deploy.sh`        | laptop  | SSH-trigger `deploy.sh`                     |
| `local/*.sh`              | laptop  | build / start / stop the same compose file  |

Secrets are **not** in this folder. They live in `.env` at the repo root — the
same filename local dev uses; on the box that's
`/root/apps/prompt-manager/.env`. This replaces the old `deploy/vps/app.env`.

## First-time setup on the box

1. **Create the app's Postgres database and user** in the shared Postgres. The
   old dedicated box had its own `promptuser` / `prompt_manager`; recreate them
   inside the shared instance:

   ```bash
   docker exec -it postgres psql -U postgres -c \
     "CREATE USER promptuser WITH PASSWORD '<pick-a-strong-one>';"
   docker exec -it postgres psql -U postgres -c \
     "CREATE DATABASE prompt_manager OWNER promptuser;"
   ```

2. **Move the data across** from the old VPS (skip if starting fresh — see the
   `init-schema` note below). On the old box:

   ```bash
   docker compose -f deploy/vps/docker-compose.yml exec -T postgres \
     pg_dump -U promptuser -d prompt_manager | gzip > pm.sql.gz
   ```

   Then on the new box:

   ```bash
   gunzip -c pm.sql.gz | docker exec -i postgres psql -U promptuser -d prompt_manager
   ```

   Starting fresh instead? Bring the app up first, then bootstrap the baseline
   schema once:
   `docker compose -f deploy/compose.yaml --project-directory . run --rm --no-deps app npm run init-schema`

3. **Clone the repo** to the path the deploy scripts expect:

   ```bash
   git clone <repo-url> /root/apps/prompt-manager
   ```

4. **Write `/root/apps/prompt-manager/.env`.** Start from the old
   `deploy/vps/app.env` and repoint the four connection URLs at the shared
   services (note the Valkey password comes from `services/.env` in the
   `vps-admin` repo):

   ```
   NODE_ENV=production
   CORS_ORIGINS=https://www.prompts.rodeo

   DATABASE_URL=postgresql://promptuser:<pg-pass>@postgres:5432/prompt_manager
   SESSION_DATABASE_URL=redis://:<valkey-pass>@valkey:6379/0
   RATE_LIMIT_DATABASE_URL=redis://:<valkey-pass>@valkey:6379/1
   NOTIFICATION_DATABASE_URL=redis://:<valkey-pass>@valkey:6379/2

   # ...plus SESSION_SECRET, ENCRYPTION_SALT, TOKEN_SECRET, API_KEY_SECRET,
   # API_KEY_HEADER, the rate-limit knobs, and the LLM / Resend / Turnstile
   # keys, all carried over unchanged. See ../.env.example for the full list.
   ```

   Two variables that look like they belong here but don't:
   - `PORT` — `compose.yaml` pins it to 8080 and overrides anything in `.env`.
   - `SERVER_URL` — dev-only. It's read by `vite.config.ts` to point the dev
     server's proxy at the API; nothing reads it at runtime, and `.env` never
     reaches the image anyway.

5. **Add the Caddy route** in the `vps-admin` repo's `caddy/Caddyfile`. Deploy
   behind the test subdomain first, so a broken deploy never touches the live
   domain:

   ```
   pm.grouch.gripe {
       reverse_proxy prompt-manager:8080
   }
   ```

   Commit, push, then `./commands/reload-caddy.sh` from that repo. Point
   `pm.grouch.gripe` at the box in DNS and deploy (step 6). Caddy gets its certs
   over the Cloudflare DNS challenge, so the name resolving to the box is all
   it needs.

6. **Deploy:** `./deploy/remote-deploy.sh` from your laptop.

7. **Cut the real domain over** once the test subdomain looks right: point
   `prompts.rodeo` and `www.prompts.rodeo` at the box, swap the Caddyfile block
   for

   ```
   prompts.rodeo, www.prompts.rodeo {
       reverse_proxy prompt-manager:8080
   }
   ```

   and reload Caddy. Nothing in this repo changes — the app doesn't know its own
   hostname. Then decommission the old box: stop its `cloudflared` service so
   the Cloudflare Tunnel stops answering for the domain, and take a final
   `pg_dump` if the cutover window let any writes land there.

   Worth knowing while both are up: sessions live in Valkey on the new box and
   in Redis on the old one, so anyone logged in against the old deployment gets
   signed out at the cutover.

## Deploying updates

Push to master first, then from your laptop:

```
./deploy/remote-deploy.sh          # or: npm run deploy
```

That SSHes to the box (`DEPLOY_HOST`) and runs
`deploy/deploy.sh` there: pull master → build an image tagged with the git SHA →
`npm run migrate` in a one-off container → `compose up -d` to swap. Migrations
run _before_ the swap, so a failing migration leaves the old container serving.

## Local testing

```
./deploy/local/build.sh    # build prompt-manager:latest
./deploy/local/start.sh    # up -d, on http://127.0.0.1:3002
./deploy/local/stop.sh     # down
```

`HOST_PORT=9000 ./deploy/local/start.sh` to move it. The default is 3002 rather
than the app's usual 3001 because another app on the box already publishes
3001 — and it keeps this out of the way of `npm run dev`, which uses 3001.

Two things to know when running the container locally:

- It reads the repo-root `.env`, so it talks to whatever Postgres/Redis your dev
  setup points at (`local-dev/docker-compose.yml`). It does **not** start them.
- The image sets `NODE_ENV=production`, which makes session cookies `secure`,
  so login won't work over plain `http://127.0.0.1`. Put `NODE_ENV=development`
  in your local `.env` if you need to exercise auth in the container.

## Reaching the shared services from your laptop

The old `deploy/vps/db-tunnel.sh` is gone; the tunnels now live in the
`vps-admin` repo and point at the shared containers:

```
./commands/pg-tunnel.sh       # Postgres     -> localhost:5433
./commands/valkey-tunnel.sh   # Valkey       -> localhost:6380
./commands/log-tunnel.sh      # Dozzle logs  -> localhost:8088
```

## Notes

- The scripts source `app.env` and **export** `APP_NAME` so `compose.yaml` can
  interpolate it. A bare `docker compose -f deploy/compose.yaml` won't work
  without it — compose fails with a message pointing here.
- The compose service key is the literal `app` (compose can't interpolate keys);
  `container_name: prompt-manager` is the name Caddy actually resolves.
- `Dockerfile.dockerignore` is a BuildKit feature — an ignore-file named after
  its Dockerfile, sitting next to it, taking precedence over any `.dockerignore`
  at the context root. That makes the repo-root `.dockerignore` dead weight for
  this build; its rules were folded into `Dockerfile.dockerignore`.
- Valkey is shared, and this app uses **logical DBs 0, 1 and 2** on it. Any
  other app on the box needs different numbers. See `services/setup.md` in the
  `vps-admin` repo for the allocation table.
