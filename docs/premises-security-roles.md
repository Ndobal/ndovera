# School premises security — implementation and release checklist

## New school roles
- `chiefsecurityofficer` — Chief Security Officer (CSO): all officer logging tools, status escalation and resolution.
- `securityofficer` — Security Officer: creates and reads school-specific activity records but cannot resolve investigations.
- Existing `owner` and `hos` can access `/roles/owner/premises-security` and `/roles/hos/premises-security`.

Roles can be assigned from the Owner People staff-role list and selected from the role switcher.

## Dashboard features
Incident and hazard reports; visitor purpose logs; gate activity; patrol activity; shift handover logs; severity labels; open/investigating/resolved counts; recent records and filtering; supervisor-only status updates.

These are **manual activity logs**. They are not CCTV, GPS tracking, biometric visitor identification, emergency dispatch or automatic alerts. Do not record unnecessary student details or sensitive identity documents in free-text notes.

## Server protection
`/api/premises-security/*` is mounted behind Ndovera's existing `authenticate` middleware. Tenant ID is obtained from stored account settings, matched against the verified token and never accepted from the request. Support impersonation is excluded. A security officer cannot update investigation status. Inserts and audit events use D1 transactional batches.

## Release steps
1. Apply `frontend/backend/d1/premises_security_migration.sql` to an isolated test D1 database through the controlled migration process.
2. Fix CI failures and run Worker dry-run build, frontend build and `node --test test/premises-security.test.mjs` after compiling `src/premisesSecurity.ts`.
3. Test account creation and login for both new roles; verify role switching and access to the correct dashboard.
4. Test CSO and security officer on two separate schools; confirm that no records can cross school boundaries.
5. Test concurrent supervisor updates, audit consistency and database failure rollback.
6. Test small-screen usability and real school incident/handover scenarios.
7. Review privacy and retention policy for visitor logs; define emergency notification procedures before operational use.

No D1 migration or production deployment was performed as part of these commits. GitHub Actions security check run 40866020006 reported failure, with root cause not yet verified.
