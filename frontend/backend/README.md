# Ndovera API Worker

This package contains the Cloudflare Worker backend for the main Ndovera frontend.

## What It Handles

- `/api/login` and settings-based authentication
- library, attendance, classroom, conversation, tuck-shop, purchase, and exam endpoints
- R2-backed classroom file uploads
- D1-backed application data for future remote usage

## Worker Bindings

The worker is configured in [wrangler.toml](./wrangler.toml) with:

- `APP_DB` bound to the D1 database `ndovera-db`
- `SESSIONS` bound to Workers KV
- `UPLOADS` bound to the `dovera-files` R2 bucket
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

## Notes

- The older `set_superadmin_password.js` flow is deprecated because it targeted local SQLite and plaintext password storage.
- The committed [migration_data.sql](./migration_data.sql) contains sanitized account placeholders only and does not contain live passwords.
