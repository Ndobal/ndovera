# Reach API — implementation contract

This folder defines the Worker API boundary. The UI is intentionally in demo mode until the production backend and credentials are configured.

## Planned endpoints
- `GET /api/health`
- `GET /api/contacts`
- `POST /api/contacts`
- `POST /api/contacts/import`
- `GET /api/audiences`
- `POST /api/audiences`
- `POST /api/campaigns` (draft only)
- `POST /api/campaigns/:id/preview`
- `POST /api/campaigns/:id/schedule`
- `POST /api/campaigns/:id/dispatch` (requires owner/admin confirmation and provider health checks)
- `POST /api/webhooks/whatsapp`
- `POST /api/webhooks/email`
- `POST /api/unsubscribe/:token`

Every write route must authenticate, validate input, enforce role permissions and write an audit event. Provider webhook signatures must be verified before events are accepted.
