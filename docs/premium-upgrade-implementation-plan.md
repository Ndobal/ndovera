# Ndovera Premium Upgrade — implementation contract

Branch: `feature/ndovera-premium-upgrade-2026`. Do not merge into main without explicit owner approval.

## Core rules
- No page builder. All tenant website templates consume the **existing** website section text fields, section metadata, branding and uploaded media. Do not duplicate content per template or replace the current editing workflow.
- Preserve existing templates and public URLs. New template selection is tenant-scoped and must not alter other schools.
- Administrative surfaces use established Ndovera colours, with WCAG AA text contrast in both light and dark modes. Public template palettes may differ. Check hover, disabled, focus, loading and error states.
- Do not invent verified school facts, navigation routes, subscriptions, payment status or completion statuses.
- Use the current authorization model, session lifecycle, audit logs and tenant boundaries.

## 1. Premium public school templates
Add four visually distinct responsive templates:
1. Aurora Academy: navy/gold/ivory; elegant editorial layout.
2. Bloom Campus: teal/coral/yellow; welcoming, energetic layout.
3. Evergreen Scholars: forest green/copper/cream; refined organic layout.
4. Royal Crest Academy: burgundy/champagne gold/ivory; timeless luxury layout.

Provide Website > Templates page with visual cards, preview with actual tenant content, explicit publish action, safe rollback and saved tenant template choice. Ensure no data loss on switch, consistent content sections, accessible navigation, responsive images, performance and SEO. Reuse existing public Worker renderer; locate its actual implementation before editing.

## 2. Gallery
Current editor: `frontend/src/app/roles/owner/tabs/WebsiteTab.jsx`; gallery metadata uses `mediaUrls` and `image_url`; `uploadSectionImage` and `saveWebsiteSection` are existing APIs.
- Inspect actual public renderer, upload endpoint, media persistence, deletion semantics and permissions first.
- Fix multi-file upload state consistency: gather successful uploaded URLs then commit one functional state update; do not overwrite concurrent updates; report partial failures.
- Preserve old media URL metadata compatibility. Never silently discard uploaded media.
- Add responsive gallery grid/masonry, full-screen accessible lightbox, keyboard and touch navigation, lazy loading, video thumbnails and playback, captions, album filters, ordering, bulk upload and unpublish controls. New album metadata requires backward-compatible migration and per-tenant authorization.
- Add public homepage gallery preview using the same collection.

## 3. Help Centre
- Persistent help icon immediately beside Messages in desktop/mobile header; full help screen and return-to-origin navigation.
- Natural-language task search, approved versioned help articles, contextual role/page guidance, verified deep links, troubleshooting, feedback, support escalation and knowledge gaps.
- Permission-aware navigation; never expose another tenant's records or private student details. Cache only safe approved public instructions.

## 4. Smart Setup Centre
- Initial onboarding, new-session readiness and ongoing configuration health.
- Backend-verified statuses: complete, incomplete, blocked, not started, not applicable, unable to verify. No user-only checkbox pretending setup is complete.
- Cover branding, session, terms calendar, sections/classes, subjects, people, parent relationships, roles, class/subject teachers, fees, grading, website, communications, attendance, timetable and final readiness.
- Each task includes exact existing route and role permission; Fix Now deep link; return to centre and reverify. Progress and critical readiness distinct.
- New session MUST preserve teacher assignments and historical records.

## 5. Terms Calendar
- Session-scoped term dates, resumption, breaks, public holidays, exams, events, open days, result publication and fee deadlines.
- Detect conflicts, maintain revision history, allow authorised draft/approval, safe reminders and approved public website event display.
- Never overwrite prior session calendar.

## 6. Growth Centre
- Superadmin prospect sales and tenant school admissions use shared infrastructure with strict separate scopes.
- Approved knowledge pool, versioned factual answers, safe Q&A cache, gaps inbox and human handover.
- Virtual consultants Rex, Zico, Vera and Nora must identify themselves as virtual consultants, not humans.
- Contact-first chat may save original question, then ask name, email, phone before responding. Marketing consent is separate and optional.
- Prospect marketing cadence: day 1, day 15, then every two months; stop on reply, chat start, demo, opt-out or conversion. Enforce opt-out and lawful contact rules.
- In-chat registration reuses the exact existing website registration/billing/provisioning backend, server-side pricing, secure hosted payment, idempotent verification, safe recovery; never collect payment card credentials in chat.
- Conversation history, analytics, staff takeover and permissioned access.

## Quality gates
- Tests for tenant isolation, roles, existing website content compatibility, template switching, gallery ordering and upload failures, media safety, calendar conflicts, session preservation, setup verification, AI grounding, consent, payment idempotency and accessibility.
- Inspect existing route registry and API before choosing endpoint names. No mock production data.
- Implement in reviewable commits on this branch; do not merge main. This document is an implementation plan, NOT evidence of feature completion.
