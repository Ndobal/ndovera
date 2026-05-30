# Ndovera Workspace

Ndovera is a role-based school operating system with a React frontend and a Cloudflare Worker backend.

## Workspace Layout

- `frontend/` contains the React application, public assets, and production build output.
- `frontend/backend/` contains the Worker API, D1 schema, provisioning scripts, and Wrangler config.
- `NDOVERA.txt` captures the project structure rules used for ongoing feature work.

## Common Commands

Frontend:

```powershell
cd frontend
npm start
npm run build
```

Backend worker:

```powershell
cd frontend/backend
npm run dev
npm run build
```

## VS Code Tasks

This workspace already includes build and deploy tasks:

- `frontend-build-validation`
- `frontend-build-from-root`
- `backend-build-public-onboarding`
- `frontend-dev-server`
- `pages-deploy-frontend`

## Current Product Surfaces

- Role-based dashboards for owner, AMI, HoS, teachers, parents, accountants, and operational staff.
- Classroom, assignments, materials, live learning, lesson plans, and parent learning views.
- Fees, receipts, claims, and finance management.
- Results engine, attendance, library, messaging, AI tutor, staff and teacher Workers AI chat assistants, and Auras.
- Parent dashboards now surface linked-child analytics, classroom visibility, live lesson notices, attendance, results, newsroom, collapsible fee sessions, and student-style messaging with teacher access.
- Tenant public school websites rendered from the Worker, including full-screen hero media, auto-linked CTAs, gallery sections, and public news pages.
- Tenant newsroom workflow where students, parents, teachers, and staff draft blog stories, reviewers clear them, and HoS or Owner publishes them.

## Documentation Notes

- Use `frontend/README.md` for frontend-specific commands and structure notes.
- Use `frontend/backend/README.md` for Worker bindings, provisioning, and deployment details.
- Update these docs whenever commands, bindings, or major feature surfaces change.