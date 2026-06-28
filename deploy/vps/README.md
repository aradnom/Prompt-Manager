# VPS deployment

Standalone single-box deployment for a Hetzner (or any) VPS with Docker.
Runs the app, Postgres, and Redis as containers. Cloudflare Tunnel runs on the
**host** (a `cloudflared` systemd service), not in compose. The app image is
**built on the VPS** from the repo's `deploy/Dockerfile`; deploys pull the
latest code and swap the app container in place.

```
                                  host
                          ┌─────────────────────┐
Cloudflare edge ─(tunnel)─┼─> cloudflared        │
                          │      │ http://localhost:3001
                          │      v                │
                          │   app:3001 ─> postgres / redis  (compose network)
                          └─────────────────────┘
```

SSL is handled by Cloudflare (the tunnel terminates TLS at the edge), so **no
ports are exposed to the public internet**. The app is published on the host
loopback (`127.0.0.1:3001`) so the host's cloudflared can reach it; Postgres is
likewise loopback-only and reached from your laptop over SSH.

## Files

| File                 | Runs on | Purpose                                        |
| -------------------- | ------- | ---------------------------------------------- |
| `docker-compose.yml` | VPS     | the stack: app + postgres + redis              |
| `deploy.sh`          | VPS     | pull → build → migrate → swap app              |
| `remote-deploy.sh`   | laptop  | `npm run deploy:vps` → SSH-trigger `deploy.sh` |
| `db-tunnel.sh`       | laptop  | SSH tunnel to the VPS Postgres                 |
| `.env`               | VPS     | infra config (Postgres creds) — gitignored     |
| `app.env`            | VPS     | app runtime secrets — gitignored               |

## First-time setup (on the VPS)

1. **Clone the repo** to the path the deploy scripts expect:

   ```bash
   sudo git clone <repo-url> /opt/app
   cd /opt/app/deploy/vps
   ```

2. **Create the env files** from the templates and fill them in:

   ```bash
   cp .env.example .env && cp app.env.example app.env
   # edit both: set POSTGRES_PASSWORD and the app secrets
   ```

3. **Start the stack:**

   ```bash
   docker compose up -d
   ```

4. **Bootstrap the database** (one time, against the fresh empty Postgres). This
   applies the baseline schema and marks existing migrations as already applied:

   ```bash
   docker compose run --rm app npm run init-schema
   ```

5. **Install the Cloudflare Tunnel on the host** and route it to the app. Create
   a tunnel in the dashboard (Networking → Tunnels), then follow the
   instructions on the page to install the service on the host. Create a new
   Route for the Tunnel with a blank Path and a Service URL of
   `http://localhost:3001`.

The app is now live at your Cloudflare hostname.

## Deploying updates

Commit and push your changes to origin first, then from your laptop:

```bash
npm run deploy:vps
```

That SSHes into the box and runs `deploy.sh` (pull → rebuild app image → run
`npm run migrate` → swap the app container). Postgres and Redis are left
running, and the host's cloudflared is untouched.

The scripts pass `VPS_HOST` straight to `ssh`, so the user/key/port all come
from your `~/.ssh/config`. Define the alias (Hetzner connects as `root` by
default):

```
Host prompt-manager-vps
  HostName <vps-ip>
  User root
  IdentityFile ~/.ssh/id_ed25519   # optional; omit to use agent/default keys
```

Prefer not to add an alias? Point `VPS_HOST` at a `user@host` instead:
`VPS_HOST=root@<vps-ip> npm run deploy:vps` (same for `db-tunnel.sh`).

You can also run `./deploy.sh` directly on the box.

## Connecting to Postgres from your laptop

Postgres is bound to the VPS loopback only, so open an SSH tunnel:

```bash
./deploy/vps/db-tunnel.sh        # forwards localhost:5432 -> VPS Postgres
```

Then, while it's open:

```bash
psql "postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:5432/<POSTGRES_DB>"
```

No public Postgres port and no IP allowlist to maintain — access rides on your
existing SSH key.
