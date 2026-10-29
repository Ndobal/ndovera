# Help Centre API integration checklist

The Help Centre frontend is available under authenticated `/roles/:role/help`. The D1 data-access layer in `frontend/backend/src/helpRequests.ts` is **not yet mounted on the Worker router**.

## Required authenticated routes
- `POST /api/help/requests`: obtain actor userId, tenantId and active role from **verified server authentication**, never from the submitted JSON. Call `ensureHelpRequestTables` and `createHelpRequest`.
- `GET /api/help/requests`: call `listOwnHelpRequests`. Do not return another requester's records.
- `GET /api/help/requests/:id`: call `getOwnHelpRequest` for the requester.
- `GET /api/help/staff/requests`: require an authorised, tenant-scoped staff role and call `listTenantHelpRequests`.
- `PATCH /api/help/staff/requests/:id/status`: require authorised staff; validate status, call `updateHelpRequestStatus`.
- `GET /api/help/requests/:id/events`: call `listHelpRequestEvents`; owner or authorised staff only.

## Release gates
1. Locate the actual Worker router and its authentication/tenant resolution middleware before adding endpoints. Do not trust the browser's `role`, `tenantId` or `userId`.
2. Apply explicit staff permissions (owner/HOS/AMI are placeholders pending verification of the actual platform support-role policy). Avoid cross-school visibility for platform staff.
3. Use the existing migration system or idempotent `ensureHelpRequestTables` at startup. Confirm the D1 binding.
4. Add rate limits, content privacy warnings, idempotent ticket creation and error status mapping.
5. Build staff assignment, responses and escalation with a fully tenant-scoped audit trail.
6. Connect frontend submission and feedback only after routes exist. Never label draft generation as a submitted ticket.
7. Run build, typecheck and integration tests for tenant isolation, requester visibility, staff permissions, audit records and failure paths.
8. No merge or deployment without owner approval.
