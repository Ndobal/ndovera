# Article publishing integration status (2026-10-29)

The article endpoints are now mounted in `frontend/backend/src/index.ts` under `/api/help/articles/*` using Ndovera's existing `authenticate` middleware. The resolver checks the signed-in account against stored settings and requires its tenant ID to match the authenticated token. Impersonated support sessions are not allowed to edit or read tenant-published articles through this adapter.

**Migration not applied:** run `frontend/backend/d1/help_articles_migration.sql` through the project's controlled D1 migration process before testing or deploying. No production migration has been run.

**CI not passing:** GitHub Actions runs 40844551320, 40844450385, 40843769071 and 40843762505 all report failure. The job details currently contain no step summaries and logs were unavailable, so the root cause is unverified. Do not claim tests passed.

**Required release checks:** run the Node article workflow/route tests, run the Worker dry-run build, test two separate school tenants and two editors, verify draft/review/publish/archive and audit rollback, and confirm published articles appear in the Help Centre. Do not merge or deploy until these checks pass.

---

# Help article editorial publishing — integration contract

Implemented on the feature branch:
- `frontend/backend/src/helpArticleWorkflow.ts`: tenant-scoped revisions, drafts, review/approval, publication, archiving and listing.
- `frontend/src/features/help/HelpArticleAdmin.jsx`: role-aware article editor and editorial queue.
- `/roles/:role/help/articles`: owner/HOS-only frontend route.

## Authenticated API wiring (MOUNTED, NOT DEPLOYED)
The editor currently requests these endpoints, which must be mounted in the real Cloudflare Worker router:
- `GET /api/help/articles/editor` → `{ articles: rows }` from `listEditorialHelpArticles`.
- `POST /api/help/articles/editor` → `createHelpArticleDraft(db, verifiedActor, body, body.articleId)`. **Only** pass a validated article ID; if missing, let the data layer generate it.
- `PATCH /api/help/articles/editor/:revisionId/state` → `transitionHelpArticle(db, verifiedActor, revisionId, body.state)`.
- `GET /api/help/articles/published` → `listPublishedHelpArticles(db, verifiedTenantId, verifiedActiveRole)`; the browser must not choose another tenant or audience.

Use the existing authentication and tenant resolver, never a role or tenant supplied in the JSON body. Confirm actual platform permissions before enabling. Public article listing must exclude drafts, in-review, approved-but-unpublished and archived revisions.

## Required production hardening
- The large Worker entrypoint was retrieved through the GitHub blob API and updated on the feature branch.
- Fix revision-number concurrency for two simultaneous drafts of the same article. Handle unique-constraint collisions with a bounded retry or transactional allocator.
- Make article state changes and their audit event atomic; currently they are separate statements.
- Ensure a previously approved article cannot be changed without creating a new revision.
- Add a server-side policy for independent approval and permission changes. The author cannot approve their own revision.
- Test tenant isolation, state transitions, published visibility, stale approvals, double publication and failure recovery.
- Wire the published article endpoint into the Help Centre with clear precedence over the bundled static guides. The static catalogue is still the only live frontend source.
- Review all instructional content before publishing. The static guides have not been individually approved.
- Do not merge or deploy until the above release gates pass.
