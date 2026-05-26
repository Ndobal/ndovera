# Ndovera Frontend

This package contains the React application for Ndovera's role-based dashboards and public onboarding flows.

## Structure

- `src/app/` holds app bootstrapping and role dashboard entry points.
- `src/features/` contains feature-owned UI, logic, and API helpers.
- `src/shared/` contains reusable components, hooks, and styles used across features.
- `public/` contains static assets and Cloudflare Pages routing support.

## Development

```powershell
cd frontend
npm start
```

The frontend build is validated with:

```powershell
cd frontend
npm run build
```

The build now also writes `build/404.html` from the generated app shell, and Cloudflare Pages ships `public/_worker.js` so direct dashboard routes such as `/login` and `/roles/teacher` are rewritten to the React app shell with an HTTP `200` instead of falling back as a `404` page.

If you are running the API locally, the frontend uses the proxy configured in `package.json` for `/api` requests.

## Main Feature Areas

- Role dashboards for school leadership, staff, parents, and students.
- Classroom materials, assignments, parent learning views, and lesson plans.
- Fees, receipts, finance controls, and claims review.
- Results, attendance, library, messaging, AI tutor, staff and teacher AI chat assistants, and Auras.
- Staff-facing dashboards now expose a ChatGPT-style AI Assistant page that talks to the authenticated Worker API, so teachers, HoS, accountants, and operational staff can keep a running chat in-role.
- Tenant website editing for owner and ICT surfaces, including hero media galleries, CTA routing, and section content management.
- Shared newsroom dashboard pages for student, parent, teacher, owner, HoS, accountant, and operational staff authoring and review flows.

## Working Rules

- Keep feature logic inside `src/features/`.
- Move shared utilities and reusable UI into `src/shared/`.
- Follow the structure rules in `../NDOVERA.txt` when adding or reshaping features.
- Update this README when frontend commands or major user-facing surfaces change.
