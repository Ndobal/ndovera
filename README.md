<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ndovera Monorepo

This repository has been reorganized into a **monorepo** containing four packages:

- `packages/web` – the React/Vite frontend application (School Portal)
- `packages/server` – the Express/SQLite backend API (School API)
- `packages/super-admin` – the React/Vite admin dashboard for global system ops
- `packages/super-admin-server` – the backend API for system-wide operations

## Getting Started

From the root directory run:

```sh
npm install
npm run dev      # starts both server and web in parallel
```

You can also run individual workspaces:

```sh
npm run dev:web
npm run dev:server
```

---

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8c11f1f7-5713-43ed-a136-6040414a923f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Production environment

Set these variables before deploying the frontend:

- `GEMINI_API_KEY` - Gemini API key for AI features in the web app
- `VITE_API_URL` - optional base URL for the main web API; leave empty if served from the same origin
- `VITE_SUPER_ADMIN_API_URL` - base URL of the AMI/global-role API used by the unified frontend
- `VITE_SIGNALING_WS_URL` - optional WebSocket signaling endpoint for WebRTC features
- `VITE_PUBLIC_ASSET_BASE_URL` - optional asset host for uploaded proofs and public files

## Cloudflare Pages

For the main web frontend, use the repository root in Cloudflare Pages and configure:

- Framework preset: `Vite`
- Root directory: leave blank
- Build command: `npm run build:cloudflare`
- Build output directory: `packages/web/dist`

This avoids monorepo root-directory mismatches and builds the public frontend directly from the repo root.

## Cloudflare Workers backends

This repo now includes two Cloudflare-native backend workers:

- `packages/ndovera-api-worker` (`ndovera-api`) for school APIs
- `packages/ndovera-ami-api-worker` (`ndovera-ami-api`) for AMI/global-role APIs

### First-time setup

1. Create Cloudflare resources:
   - D1 database for school API
   - D1 database for AMI API
   - KV namespace for each worker session store
   - R2 bucket for uploads (can be shared)
   - Optional Hyperdrive config for external Postgres
2. Paste resource IDs into:
   - `packages/ndovera-api-worker/wrangler.toml`
   - `packages/ndovera-ami-api-worker/wrangler.toml`
3. Set worker secrets:
   - `wrangler secret put SUPER_ADMIN_EMAIL --config packages/ndovera-ami-api-worker/wrangler.toml`
   - `wrangler secret put SUPER_ADMIN_PASSWORD_HASH --config packages/ndovera-ami-api-worker/wrangler.toml`

### Deploy

```sh
npm install
npm run check:cf-workers
npm run deploy:cf-backends
```

### Bind Pages frontend to worker URLs

Set these in Cloudflare Pages production environment variables:

- `VITE_API_URL=https://ndovera-api.<your-subdomain>.workers.dev`
- `VITE_SUPER_ADMIN_API_URL=https://ndovera-ami-api.<your-subdomain>.workers.dev`
