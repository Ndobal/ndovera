# Ndovera API Worker

This package contains the Cloudflare Worker backend for the main Ndovera frontend.

## What It Handles

- `/api/login` and settings-based authentication
- library, attendance, classroom, conversation, tuck-shop, purchase, and exam endpoints
- payroll endpoints for monthly sheets, staff account details, and saved payroll-note snapshots
- R2-backed classroom file uploads
- D1-backed application data for future remote usage
- tenant subdomain website rendering, including hero media galleries, admissions content, and public news pages
- tenant social-link previews using Open Graph and Twitter metadata with the school branding logo or public media fallback
- school newsroom APIs for drafting, reviewing, publishing, and uploading blog media
- AI billing and access rules for staff, students, and parents, including parent-specific daily free-request overrides
- Question-bank APIs that retain submitted assignment and CBT questions as individual records, apply AI-generated topic labels, provide topic-filtered practice questions, and let school owners allow or block teacher bank reuse.
- AMI growth-partner APIs provide portfolio analytics and activities, individual profile review, manual paid-payout recording, and state, regional, national, or global representative appointments. Partner-only verification APIs save an 11-digit NIN and securely serve uploaded utility bills to the partner or AMI.
- Growth partner activation and dashboard APIs provision a unique registration discount code. Public registration validates that the code in a partner link is that partner's assigned code before creating the school and referral relationship.

## Worker Bindings

The worker is configured in [wrangler.toml](./wrangler.toml) with:

- `APP_DB` bound to the D1 database `ndovera-db`
- `SESSIONS` bound to Workers KV
- `UPLOADS` bound to the `dovera-files` R2 bucket
- `AI` bound to Cloudflare Workers AI for authenticated staff and teacher chat responses
- optional `NVIDIA_API_KEY` secret for student Ndovera AI chat and Practice assistance through NVIDIA's OpenAI-compatible DeepSeek endpoint
- routes for `ndovera.com/api/*` and `www.ndovera.com/api/*`

## Academic Sessions, Promotion and the Term Fee Cycle

[academicSessions.ts](./src/academicSessions.ts) owns the academic calendar and the money that
follows it. The rules it enforces:

- exactly one active session per tenant, and one active term inside it, held by partial unique
  indexes (`idx_academic_sessions_one_active`, `idx_academic_terms_one_active`) rather than by
  application logic alone;
- a student's class placement belongs to a session. `session_enrollments` carries one row per
  student per session, so promoting a student writes a new row and never edits last session's
  record. `settings.classId` / `users.className` remain as a derived mirror of the active session;
- every term opens its own `fee_assessments` row. Money owed at the end of a term stays on that
  term's assessment and keeps counting towards what the student currently owes, so a debt is
  recorded once and paid once;
- `fee_payments` records the transaction and `fee_payment_allocations` records what it settled.
  Unallocated payments are applied oldest debt first.

Term and session transitions run from the Worker cron (`scheduled`) in `Africa/Lagos`, not from a
page being open. A session with no enrolments is deliberately skipped rather than opening to an
empty register.

Multi-step writes go through `db.batch()`, which is all-or-nothing.

### Migrating a school that predates this

`fees_ledger` holds a single running total per student — a lifetime paid figure against a
current-term charge — which cannot be split back into per-term history. `backfillOpeningBalances`
carries only the arrears those two numbers imply, as one `opening_balance` assessment, and leaves
`fees_ledger` untouched. Preview it first with `dryRun`; running it twice is a no-op.

While the rollout is in progress both fee paths dual-write: a payment taken through the legacy
`/api/school/fees/:studentId/pay` route also allocates against assessments, and a payment taken
through `/api/school/fees/students/:studentId/payments` also advances the legacy running total, so
the existing fees board never goes stale.

## Tests

```powershell
cd frontend/backend
npm test
```

Runs the workflow tests in [test/academic.test.mjs](./test/academic.test.mjs) against SQLite through
a D1 shim built on `node:sqlite`, so the invariants under test are the ones the database actually
enforces. No new dependencies; `npm test` bundles the module with esbuild first.

## Remote Schema Bootstrap

Apply the Worker schema to the remote D1 database:

```powershell
cd frontend/backend
npm run schema:remote
```

The schema file lives at [d1/schema.sql](./d1/schema.sql).

## Secure Superadmin Provisioning

To provision the two superadmin accounts with masked password prompts directly into remote D1:

```powershell
cd frontend/backend
npm run provision:superadmins
```

This command:

- ensures the remote D1 schema exists
- prompts for the two passwords without echoing them to the terminal
- stores PBKDF2-SHA256 password hashes, not plaintext passwords
- upserts these two superadmin accounts:
	- `ndobalamwilliams@ndovera.com`
	- `ndobal.will@gmail.com`

## Deployment

Deploy the Worker after changes:

```powershell
cd frontend/backend
npm run deploy
```

The Worker now serves the authenticated `/api/ai/tutor/ask` chat endpoint with the Cloudflare Workers AI binding, so redeploy the Worker whenever you change AI prompts, models, or access logic. Parent AI access currently uses the teacher-side Worker path with `5` free requests per day before wallet credits are consumed.

To enable NVIDIA DeepSeek for student Ndovera AI chat and Practice assistance, set the Worker secret before deploying:

```powershell
cd frontend/backend
wrangler secret put NVIDIA_API_KEY
```

The student path defaults to `https://integrate.api.nvidia.com/v1` with model `deepseek-ai/deepseek-v4-flash`, and falls back to the current Workers AI path if the NVIDIA secret is not configured.

## Notes

- The older `set_superadmin_password.js` flow is deprecated because it targeted local SQLite and plaintext password storage.
- The committed [migration_data.sql](./migration_data.sql) contains sanitized account placeholders only and does not contain live passwords.
- Published newsroom stories now feed the tenant public `/events` page, while legacy school events remain as a fallback when no story has been published yet.
