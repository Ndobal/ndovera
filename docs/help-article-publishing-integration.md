# Help article editorial publishing — integration contract

Implemented on the feature branch:
- `frontend/backend/src/helpArticleWorkflow.ts`: tenant-scoped revisions, drafts, review/approval, publication, archiving and listing.
- `frontend/src/features/help/HelpArticleAdmin.jsx`: role-aware article editor and editorial queue.
- `/roles/:role/help/articles`: owner/HOS-only frontend route.

## Required authenticated API wiring (NOT YET IMPLEMENTED)
The editor currently requests these endpoints, which must be mounted in the real Cloudflare Worker router:
- `GET /api/help/articles/editor` → `{ articles: rows }` from `listEditorialHelpArticles`.
- `POST /api/help/articles/editor` → `createHelpArticleDraft(db, verifiedActor, body, body.articleId)`. **Only** pass a validated article ID; if missing, let the data layer generate it.
- `PATCH /api/help/articles/editor/:revisionId/state` → `transitionHelpArticle(db, verifiedActor, revisionId, body.state)`.
- `GET /api/help/articles/published` → `listPublishedHelpArticles(db, verifiedTenantId, verifiedActiveRole)`; the browser must not choose another tenant or audience.

Use the existing authentication and tenant resolver, never a role or tenant supplied in the JSON body. Confirm actual platform permissions before enabling. Public article listing must exclude drafts, in-review, approved-but-unpublished and archived revisions.

## Required production hardening
- Investigate the empty contents returned by the GitHub fetch of the configured `frontend/backend/src/index.ts` entrypoint before mounting endpoints.
- Fix revision-number concurrency for two simultaneous drafts of the same article. Handle unique-constraint collisions with a bounded retry or transactional allocator.
- Make article state changes and their audit event atomic; currently they are separate statements.
- Ensure a previously approved article cannot be changed without creating a new revision.
- Add a server-side policy for independent approval and permission changes. The author cannot approve their own revision.
- Test tenant isolation, state transitions, published visibility, stale approvals, double publication and failure recovery.
- Wire the published article endpoint into the Help Centre with clear precedence over the bundled static guides. The static catalogue is still the only live frontend source.
- Review all instructional content before publishing. The static guides have not been individually approved.
- Do not merge or deploy until the above release gates pass.
