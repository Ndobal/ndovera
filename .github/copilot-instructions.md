# Ndovera Repository Instructions

## Current Workspace Status

- [x] `.github/copilot-instructions.md` exists and is maintained.
- [x] The project is already scaffolded as a React frontend in `frontend/` plus a Cloudflare Worker backend in `frontend/backend/`.
- [x] No extra VS Code extensions are required by repository setup.
- [x] Build validation commands are known and should be used before closing work.
- [x] Workspace documentation must stay current in `README.md`, `frontend/README.md`, and `frontend/backend/README.md`.
- [ ] Launch or debug sessions should only be started after explicit user confirmation.

## Build And Validation

- Frontend build: run `npm run build` in `frontend/` or use the `frontend-build-validation` task.
- Backend build validation: run `npm run build` in `frontend/backend/` or use the `backend-build-public-onboarding` task.
- Frontend deploy task: `pages-deploy-frontend`.

## Codebase Shape

- Keep app bootstrapping and role-entry routing in `frontend/src/app/`.
- Keep feature-owned UI, state, and service code inside `frontend/src/features/`.
- Put reusable cross-feature code in `frontend/src/shared/` only.
- Keep project-wide rules aligned with `NDOVERA.txt`.

## Working Rules

- Prefer focused, minimal edits instead of broad rewrites.
- Keep files small when practical and split new logic into feature-local modules.
- Preserve existing role-dashboard routing patterns when adding new sections.
- Update the relevant README files whenever commands, bindings, or major feature surfaces change.
