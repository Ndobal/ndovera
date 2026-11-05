# Ndovera Reach

Ndovera Reach is a separate marketing and contact-management application inside the Ndovera repository. It is isolated under `ndovera_reach/` and must not alter the existing Ndovera application.

## Current scope
- Contact database with CSV import/export and consent records.
- Audience segmentation by tags, organisation, state, country and source.
- Campaign drafts and scheduling.
- WhatsApp Business Cloud API integration through server-side credentials.
- Transactional/marketing email provider adapter (Resend-ready).
- Delivery events, suppression lists and unsubscribe handling.
- Admin dashboard with campaign and contact metrics.

## Architecture
- React + Vite frontend.
- Cloudflare Worker API using Hono.
- Cloudflare D1 for contacts, consent, audiences, campaigns, message jobs and audit events.
- Cloudflare Queues for controlled asynchronous dispatch.
- Cloudflare R2 for imports and campaign assets.
- Meta WhatsApp Cloud API and an email provider adapter.

## Local development
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.dev.vars.example` to `.dev.vars` and provide local test credentials.
4. Run `npm run dev`.

Never commit real API keys, phone-number IDs, access tokens or email provider secrets.

## Deploying
Configure a dedicated Cloudflare Pages project and Worker for Reach. Do not reuse or change the existing Ndovera production deployment. Provision D1, Queues and R2 separately. Set secrets with `wrangler secret put`.

## Safety defaults
- No contact may receive marketing until the relevant channel has recorded opt-in.
- WhatsApp sends use approved templates outside the customer-service window.
- Respect WhatsApp opt-out replies and email unsubscribe events immediately.
- Enforce per-channel rate limits, idempotency and retry ceilings.
- Test mode is enabled until credentials and compliance settings are verified.
