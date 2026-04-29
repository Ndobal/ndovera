# Ndovera Plans vs Current Repo Gap Analysis

Date: 2026-04-25

This document compares the planning notes in `plans_purposes/` with the current repo. It is meant to help decide:

1. what is already present,
2. what still needs more work,
3. where the repo and the plan are pulling in different directions and you should choose what to keep.

## Sources reviewed

- `plans_purposes/NDOVERA.txt`
- `plans_purposes/NDOVERA2.txt`
- `plans_purposes/NDOVERA ADDINAL.txt`
- `plans_purposes/schoolregisrationflow.md`
- `plans_purposes/how.md`
- `plans_purposes/meeting.md`
- `plans_purposes/documents.md`
- `plans_purposes/rules.md`
- `plans_purposes/clasroom.md`
- `plans_purposes/championsip arena.txt`
- `docs/ndovera-architecture.md`
- current code in `packages/web` and `packages/server`

## Quick read

The repo is not empty or off-track. A lot of the public-site, onboarding, pricing, tutor, classroom, lesson-note, payroll/payslip, and championship groundwork already exists.

The main issue is not "nothing is built". The real issue is:

- some planned features are only partially implemented,
- some old planning text still assumes architecture and product choices that the repo has already moved away from,
- a few areas are directly conflicting and need a product decision before more coding.

## A. Areas that already exist in the repo

### 1. Public website and landing flows are already substantial

Current evidence:

- `packages/web/src/pages/LandingPage.tsx`
- `packages/web/src/components/landing/LandingHomeSections.tsx`
- `packages/web/src/components/landing/BrightFutureHomeSections.tsx`

Already present:

- pricing page logic,
- school registration modal and payment-reference flow,
- contact form UI,
- events gallery page,
- opportunities page on the public site,
- tutor registration page,
- chatbot flow,
- growth partner application flow,
- branding/template variant handling.

This means the planning notes asking for pricing, contact, events gallery, tutors, and public opportunities are not starting from zero.

### 2. School onboarding flow exists end to end, but is incomplete in places

Current evidence:

- `packages/server/src/modules/onboarding/onboarding.routes.ts`
- `packages/server/src/modules/onboarding/onboarding.store.ts`
- `plans_purposes/schoolregisrationflow.md`

Already present:

- `/register-school`,
- discount code validation,
- payment reference submission,
- onboarding wait token flow,
- payment state storage,
- approval/review foundations.

The repo already matches the planning intent much more than the notes may suggest.

### 3. Classroom foundations already exist

Current evidence:

- `packages/web/src/pages/Academics.tsx`
- `packages/web/src/features/classroom/services/classroomApi.ts`
- `packages/web/src/features/classroom/components/ClassroomStream.tsx`
- `packages/web/src/features/classroom/components/LessonNotesWorkspace.tsx`
- `packages/web/src/features/classroom/components/ClassroomMaterialViewer.tsx`
- `packages/web/src/features/classroom/components/ClassroomMaterialComposer.tsx`
- `packages/web/src/features/classroom/components/AssignmentStudio.tsx`
- `packages/web/src/features/classroom/components/LiveClassStudio.tsx`

Already present:

- classroom tabs,
- subject APIs,
- stream/feed support,
- assignments support,
- lesson notes/materials support,
- live classroom studio,
- media upload/chunk upload paths,
- comments and reactions,
- subject-level feed endpoints.

So the classroom spec is partially implemented already, even if the student experience is not yet finished to your standard.

### 4. Lesson plans, results, payslips, payroll, and championship are not blank areas

Current evidence:

- `packages/web/src/features/plans/components/*`
- `packages/web/src/pages/Payslips.tsx`
- `packages/server/src/modules/finance/payroll.store.ts`
- `packages/web/src/pages/ScoreSheet.tsx`
- `packages/web/src/features/results/components/*`
- `packages/web/src/pages/Championships.tsx`
- `packages/server/src/modules/championship/championship.routes.ts`

This is important because `plans_purposes/documents.md` asks for redesigns of receipts, payslips, results, lesson plans, and championship arena. In the repo these areas already have code, so this is now a refinement/redesign task, not a greenfield build.

## B. Areas that need more work

### 1. The biggest code-quality gap: architecture standard is not yet applied

Planned direction:

- `apps/web` frontend shell,
- `services/api` single backend API,
- module mirroring,
- file-size limits,
- shared packages discipline.

Current repo reality:

- main active app is still in `packages/web`
- main active backend is still in `packages/server`
- many large files exist, especially `packages/web/src/pages/LandingPage.tsx`

Needs more work:

- move real production code into the target architecture,
- split oversized pages/modules,
- reduce cross-cutting logic living inside giant page files,
- make the new `apps/web` and `services/api` more than scaffolds.

### 2. Student classroom experience is still only partly aligned with the spec

Planned direction from `plans_purposes/clasroom.md` and your latest notes:

- strong subject workspace,
- student-first assignments flow,
- materials as the main note/video surface,
- live class with low-data internal system,
- no placeholders or mock data.

Current repo reality:

- the classroom APIs and components exist,
- but the student flow is not yet cleanly finished end to end,
- fixture/mock classroom data still exists in `packages/web/src/features/classroom/data/classroomFixtures.ts`,
- the exact student dashboard flow you described is not yet fully realised.

Needs more work:

- student classroom tabs and subject workspace polish,
- assignment review/resubmission flow,
- materials unification,
- live state/locked state handling,
- replacement of remaining fixture-driven flows with real data.

### 3. Public opportunities are inconsistent

Current evidence:

- `packages/web/src/pages/Opportunities.tsx`
- `packages/web/src/pages/LandingPage.tsx`

What is happening now:

- the public landing page has real application submission logic through `/api/opportunities/apply`,
- but `Opportunities.tsx` still contains an `Apply Now` button that is not clearly wired to the same real flow.

Needs more work:

- unify the public vacancy application journey,
- remove dead-end buttons,
- decide whether the canonical apply flow lives in the landing page modal, a dedicated page, or both.

### 4. Live agent support is not implemented as described

Current evidence:

- `packages/web/src/pages/LandingPage.tsx`
- `packages/server/src/modules/faq/*`

Current state:

- chatbot exists,
- verification/public modes exist,
- FAQ answer flow exists.

Missing compared with plan:

- live agent presence,
- routing to online support staff,
- queue/hand-off model,
- staff conversation interface.

### 5. Meetings/Ndovera Meet is still a major unfinished product area

Planning asks for:

- meetings page,
- free/pro/business tiers,
- scheduling,
- controls,
- recording/storage rules,
- separate product identity.

Current repo reality:

- there are live-class and WebRTC-related components,
- but no clearly finished `Ndovera Meet` product surface matching the plan.

Needs more work:

- product definition,
- billing model,
- app surface,
- permissions,
- backend/session lifecycle,
- recording/storage policy.

### 6. Some completed items in notes still need verification against code

Examples:

- strict tenancy isolation,
- strict RBAC,
- no mock data,
- no technical/internal terms in user-facing areas,
- no role leakage in navigation.

These are not safe to assume as fully complete just because they appear marked `[completed]` in `plans_purposes/how.md`.

## C. Clear conflicts where you should choose what to keep

These are the highest-value decision points.

### Conflict 1: Architecture plan vs actual production repo

Plan says:

- active frontend should be `apps/web`
- active backend should be `services/api`

Repo reality:

- active frontend is `packages/web`
- active backend is `packages/server`

What to choose:

#### Option A: Keep the current production path

Keep `packages/web` and `packages/server` as the real app, and treat `apps/web` and `services/api` as future migration work.

Good if:

- you want delivery speed now,
- you do not want a risky restructure immediately.

#### Option B: Commit to the target architecture now

Make `apps/web` and `services/api` the real execution path and start migrating module by module.

Good if:

- you want long-term maintainability,
- you are ready for refactor cost now.

Recommendation:

- Keep current production paths for now.
- Create a controlled migration plan instead of forcing architecture migration during feature delivery.

### Conflict 2: "No UI change without permission" vs multiple planning docs asking for redesigns

Plan/rules say:

- no altering UI without permission.

Other planning docs say:

- redesign receipts,
- redesign payslips,
- redesign results,
- redesign lesson plans,
- redesign championship arena,
- remove/change templates,
- rework classroom/student experience.

What to choose:

#### Option A: Conservative UI policy

Only change UI when a document explicitly names the surface and desired outcome.

#### Option B: Ongoing redesign policy

Treat all named surfaces in `plans_purposes/` as approved redesign candidates.

Recommendation:

- Use Option A, but treat the currently listed named surfaces as pre-approved redesign areas.

### Conflict 3: "No mock data anywhere" vs current classroom/dashboard fixture usage

Plan says:

- no mock data anywhere,
- no placeholders.

Repo reality:

- classroom fixtures and demo-oriented data still exist in several places,
- some fallback arrays still drive public pages and dashboard experiences.

What to choose:

#### Option A: Remove all mock/fallback data now

Everything becomes real-data only.

Risk:

- blank experiences where backend coverage is incomplete,
- slower delivery because backend must land first.

#### Option B: Keep temporary fallback data behind strict empty states

Use real data first, but allow temporary demo/fallback content only where the backend is still incomplete.

Risk:

- drift if not tracked tightly.

Recommendation:

- Choose Option B briefly, but track every fallback and remove them in phases.

### Conflict 4: YouTube references vs newer storage direction

Planning says:

- remove YouTube hosting completely and use your own storage path,
- documents also say remove all mention of R2/Cloudflare/internal infra from user-facing language.

Repo reality:

- `WebsiteBuilder.tsx` still mentions YouTube-based publishing,
- `classroomApi.ts` still has `externalProvider?: 'youtube'` and YouTube embed handling,
- `ClassroomMaterialViewer.tsx` resolves YouTube embed URLs.

What to choose:

#### Option A: Keep YouTube support as a transitional path

Useful if old data or previous uploads still depend on it.

#### Option B: Remove YouTube completely

Align everything with the current storage strategy and clean up user-facing wording.

Recommendation:

- Choose Option B if the product decision is final.
- If any legacy content depends on YouTube, do a staged removal with migration.

### Conflict 5: Website templates

Planning says:

- remove templates from the public selection flow,
- control preview/template choice from school settings,
- some notes also still talk about template variants and preview behaviour.

Repo reality:

- template variants are still a live concept in `LandingPage.tsx` and branding services.

What to choose:

#### Option A: Keep template variants as an admin-only implementation detail

Users do not choose them publicly.

#### Option B: Remove template variants entirely

One public-site system only.

Recommendation:

- Option A is the better transition path.
- Keep variant support in code for now, but move control fully to school settings and remove public-facing template selection language.

### Conflict 6: Ndovera Meet vs classroom live classes

Planning mixes two live products:

- school/tutor live classes,
- general meetings product.

Repo reality:

- live-class tools exist inside classroom/tutor-related areas,
- no clearly separated Meet product is finished yet.

What to choose:

#### Option A: One unified real-time engine, two products

- same backend/media engine,
- different product surfaces: Classroom Live and Ndovera Meet.

#### Option B: Keep everything inside classroom/tutor only for now

- postpone separate Meet product.

Recommendation:

- Option A at the architecture level, Option B at the delivery level.
- In plain terms: build one reusable engine, but do not launch two half-finished products at once.

## D. Highest-priority areas that need more work next

If the goal is to move cleanly without reopening settled work, these are the best next steps:

1. Finalise product decisions on the six conflicts above.
2. Remove or phase out YouTube support and related wording if that decision is settled.
3. Finish the student classroom experience end to end with real data only.
4. Unify the opportunities application flow so every Apply button goes somewhere real.
5. Add the live-agent support layer or explicitly defer it.
6. Start a controlled architecture migration plan for `packages/*` to `apps/web` and `services/api`.

## E. Suggested keep/replace matrix

### Keep as-is or mostly keep

- current landing/onboarding public flow,
- current onboarding backend foundation,
- tutor pricing/workspace foundation,
- classroom API foundations,
- lesson note/material tooling foundation,
- payroll/payslip/result/championship foundations.

### Keep but refactor

- `packages/web/src/pages/LandingPage.tsx`
- classroom student experience,
- template handling,
- opportunities flows,
- architecture layout over time.

### Replace or remove

- lingering YouTube-specific behaviour if you want the new storage direction only,
- remaining fixture/mock classroom data,
- public dead-end action buttons,
- user-facing technical/internal wording.

## F. Decision prompts for you

These are the choices I recommend you make explicitly before the next implementation pass:

1. Should `packages/web` and `packages/server` remain the live app for now, or do you want migration to `apps/web` and `services/api` to start immediately?
2. Should YouTube support be removed completely now, or phased out gradually?
3. Should template variants remain hidden admin-only options, or be removed entirely?
4. Should we build `Ndovera Meet` now as a separate product, or finish classroom/tutor live first and reuse that engine later?
5. Do you want strict real-data-only mode now, even if some screens go empty until backend work catches up?

## Final assessment

The repo is already carrying a lot of the product. The next win is not another broad brainstorm. The next win is choosing which product and architecture decisions are now final, then tightening the code around those decisions.
