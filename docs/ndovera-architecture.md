# NDOVERA Unified Architecture

## Target structure
- apps/web: frontend app shell
- services/api: single backend API
- packages/*: shared libraries
- infrastructure/: deployment/runtime assets
- docs/: architecture and migration notes

## Module standard
Each domain module should own:
- UI / pages / hooks / state on the frontend
- controller / service / routes / model / repository / validation on the backend

## File size rule
- No file should exceed 500 lines.
- Split large files before they grow beyond the limit.

## Shared code
Reusable logic belongs in:
- shared-ui
- shared-hooks
- shared-services
- shared-types

## Current implementation mapping
- Legacy frontend currently lives in packages/web
- Legacy backend currently lives in packages/server
- The new architecture scaffold now exists under apps/web and services/api

## Domain list
attendance, exams, grading, timetable, library, hostel, transport, hr, payroll, finance-billing, reports, analytics, messaging, forums, notifications, assignments, courses, live-classes, youtube-integration, ai-tutor, ai-teacher-assistant, ai-school-health, auth, users, roles-rbac, schools-tenancy, dashboard, settings, onboarding, audit-logs, ads, rewards-auras, website-builder, integrations, files-storage

## Migration rule
No unrelated module should import another module directly.
Cross-domain communication must happen through services or APIs.
