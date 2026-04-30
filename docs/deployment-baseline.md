## Deployment baseline

This baseline assumes:

- `packages/web` is deployed to Cloudflare Pages as the unified frontend.
- `packages/ndovera-api-worker` is deployed as the main school API on Cloudflare Workers.
- `packages/ndovera-ami-api-worker` is deployed as the AMI/global-role API on Cloudflare Workers.

## Cloudflare Workers backends

Worker services:

- `packages/ndovera-api-worker` -> `ndovera-api`
- `packages/ndovera-ami-api-worker` -> `ndovera-ami-api`

Each worker includes:

- Hono runtime (Express replacement)
- D1 document persistence
- Optional Hyperdrive/Postgres persistence via `HYPERDRIVE_CONNECTION_STRING` or `HYPERDRIVE` binding
- KV-backed session store
- R2-backed multipart upload handlers

Worker deploy configs are in:

- `packages/ndovera-api-worker/wrangler.toml`
- `packages/ndovera-ami-api-worker/wrangler.toml`

Deploy commands from repo root:

```bash
npm run check:cf-workers
npm run deploy:cf-backends
```

Set AMI bootstrap secrets before deploy:

```bash
wrangler secret put SUPER_ADMIN_EMAIL --config packages/ndovera-ami-api-worker/wrangler.toml
wrangler secret put SUPER_ADMIN_PASSWORD_HASH --config packages/ndovera-ami-api-worker/wrangler.toml
```

## Backend containers

Local baseline:

```bash
copy .env.docker.example .env.docker
docker compose up --build ndovera-server ndovera-super-admin-server
```

What is included:

- Root `.dockerignore`
- `packages/server/Dockerfile`
- `packages/super-admin-server/Dockerfile`
- Root `docker-compose.yml`
- `.env.docker.example`

Stateful mounts:

- `packages/server/src/data` is a named volume so classroom notes, results, classes, and subjects persist.
- `packages/server/uploads` is a named volume for uploaded assets.
- `/app/storage` is a named volume so SQLite fallback databases persist if `DATABASE_URL` is not set.
- The legacy `identity-state.json` file is mounted read-only only as a seed/migration source.

Required backend environment variables:

- `NDOVERA_AUTH_SECRET`
- `NDOVERA_SUPER_ADMIN_AUTH_SECRET`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD_HASH`
- `CORS_ORIGIN`
- `TRUST_PROXY=1` behind Cloudflare or another reverse proxy
- `SESSION_COOKIE_SECURE=true` in production

Optional persistence environment variables:

- `DATABASE_URL` or `POSTGRES_URL` for DigitalOcean Managed PostgreSQL
- `NDOVERA_IDENTITY_DB_PATH` for SQLite fallback storage
- `NDOVERA_CHAMPIONSHIP_DB_PATH` for championship SQLite fallback storage
- `NDOVERA_APP_DB_PATH` for the shared onboarding, finance, messaging, notification, library, and classroom document store fallback database
- `NDOVERA_LEGACY_STATE_PATH` for a read-only seed JSON file

Required external integration variables when enabling production uploads:

- `CF_R2_ENDPOINT`
- `CF_R2_BUCKET`
- `CF_R2_ACCESS_KEY_ID`
- `CF_R2_SECRET_ACCESS_KEY`
- `CF_R2_PUBLIC_BASE_URL`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `YOUTUBE_REDIRECT_URI`

## Cloudflare Pages

### Unified web app

- Project root: `packages/web`
- Build command: `npm --workspace=packages/web run build`
- Build output directory: `packages/web/dist`
- Production variables:
  - `VITE_API_URL=https://api.your-domain.com`
  - `VITE_SUPER_ADMIN_API_URL=https://ami-api.your-domain.com`
  - `VITE_PUBLIC_ASSET_BASE_URL=https://assets.your-domain.com`

## Cross-origin requirements

The unified frontend can target both backend origins through environment variables, and both backends should honor the frontend origin in `CORS_ORIGIN` with credentials enabled.

Set `CORS_ORIGIN` to the exact Pages origin you deploy, for example:

```text
https://www.ndovera.com
```

## Recommended production topology

- `www.ndovera.com` -> Cloudflare Pages for `packages/web`
- `api.your-domain.com` -> `ndovera-api` Cloudflare Worker
- `ami-api.your-domain.com` -> `ndovera-ami-api` Cloudflare Worker
- `db.your-domain.internal` -> optional Hyperdrive target Postgres
- `assets.your-domain.com` -> Cloudflare-backed public asset host for uploaded files

### Target split aligned to current rollout

- Frontends: Cloudflare Pages
- Backends: Cloudflare Workers (`ndovera-api`, `ndovera-ami-api`)
- Structured operational data: D1 or Hyperdrive-backed Postgres
- Session and cache data: KV
- File uploads: R2
- Long-form video uploads and recordings: YouTube-hosted workflow

## Health and container runtime

- Both backend images now run as the non-root `node` user.
- Both backend images expose Docker `HEALTHCHECK`s against `/health`.
- `docker-compose.yml` enables `init: true` and `no-new-privileges` for both backends.
- Production containers now run the TypeScript source through `tsx` so deployment behavior stays aligned with the maintained source of truth.

## Launch checklist

### P0 before go-live

- Use `DATABASE_URL` with DigitalOcean Managed PostgreSQL for identity and championship state instead of relying on SQLite fallback.
- Populate the R2 and YouTube environment variables with real production credentials before enabling file and recording uploads.
- Verify every remaining approval path outside the classroom/result flow uses the same authenticated, persisted server authority.
- Stand up production monitoring and backups for `/app/storage`, `packages/server/src/data`, and `packages/server/uploads` if any file-backed persistence remains temporarily.
- Configure HTTPS custom domains and set real production secrets in both backend hosts.
- Rotate any secrets that have ever been committed locally, including root `.env` values.

### P1 immediately after

- Reduce the largest web chunks called out by the production build, especially `Academics`, `Library`, and `App`.
- Add deployment health checks in CI for both backends and both Pages apps.
- Replace any remaining raw websocket host assumptions in the messaging module with environment-driven endpoints.
- Validate uploads and public asset URLs when the API origin differs from the Pages origin.

### P2 still open

- Ads stack is present in code, but AdMob/Facebook Audience Network production integration remains unverified.
- AI usage/persistence and billing enforcement remain incomplete for a real production rollout.
- Multi-instance coordination is not ready while classroom state is still file-backed.

## What this pass completed

- Real persisted class CRUD
- Real persisted subject CRUD
- Real persisted classroom notes and student results
- Real persisted school profile, onboarding, finance, messaging, notification, library, and live-class state
- Subject curriculum updates now persist through the backend
- Deployment-ready API base configuration for the web app
- Credentialed CORS support for split frontend/backend hosting
- Container baseline for both backend services
- Persistent SQLite fallback paths for containers
- Shared `/app/storage/ndovera-app.db` fallback path for the new document-store-backed modules
- Non-root backend images with health checks
- Reverse-proxy-aware backend baseline for Cloudflare in front of DigitalOcean