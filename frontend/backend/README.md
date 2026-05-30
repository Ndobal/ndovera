# Ndovera API Worker

This package contains the Cloudflare Worker backend for the main Ndovera frontend.

## What It Handles

- `/api/login` and settings-based authentication
- library, attendance, classroom, conversation, tuck-shop, purchase, and exam endpoints
- payroll endpoints for monthly sheets, staff account details, and saved payroll-note snapshots
- R2-backed classroom file uploads
- D1-backed application data for future remote usage
- tenant subdomain website rendering, including hero media galleries, admissions content, and public news pages
- school newsroom APIs for drafting, reviewing, publishing, and uploading blog media
- AI billing and access rules for staff, students, and parents, including parent-specific daily free-request overrides

## Worker Bindings

The worker is configured in [wrangler.toml](./wrangler.toml) with:

- `APP_DB` bound to the D1 database `ndovera-db`
- `SESSIONS` bound to Workers KV
- `UPLOADS` bound to the `dovera-files` R2 bucket
- `AI` bound to Cloudflare Workers AI for authenticated staff and teacher chat responses
- optional `NVIDIA_API_KEY` secret for student Ndovera AI chat and Practice assistance through NVIDIA's OpenAI-compatible DeepSeek endpoint
- routes for `ndovera.com/api/*` and `www.ndovera.com/api/*`

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
