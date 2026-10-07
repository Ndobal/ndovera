# Ndovera API Worker

This package contains the Cloudflare Worker backend for the main Ndovera frontend.

## Teaching materials, academic history and supervision

Ndovera separates academic history from current operation. A new term or session changes which context is current; it never deletes or rewrites records.

- **Context.** Every material carries a server-assigned `academicSessionId` and `academicTermId` in its metadata ([materialSessions.ts](./src/materialSessions.ts)). Current lists show the active session's running term (between terms, the term that ran last). Anything else is Academic History (`GET /api/learning/materials/archive`). Schools without an active session move on each September through a provisional `period-YYYY-YYYY` year, re-stamped to the real session once one covering the date is active.
- **Cutoff.** Materials uploaded before `MATERIAL_ARCHIVE_CUTOFF` (2026-09-01) are always history, for new and existing schools alike. Existing rows are classified on first read; nothing is deleted and no manual migration is needed.
- **Lifecycle** ([materialLifecycle.ts](./src/materialLifecycle.ts)): `draft → published ⇄ hidden`, with `deleted` terminal. Audience is separate: `visibility = 'teacher'` is a teacher-only resource. Students see only published, released materials addressed to them. Edits write `material_versions`; every significant action writes the append-only `material_audit` (nothing updates or deletes its rows). Delete is a soft delete whose audit record is written first. Endpoints: `POST …/materials/:id/status`, `GET …/materials/:id/history`, `GET /api/learning/materials/audit` (leadership; `?supervisory=1` for Owner/HOS interventions).
- **Reuse** (`POST /api/learning/materials/:id/reuse`, `status` draft or published) creates a new row that references the original (`reusedFromId`, `originalMaterialId`) and the same stored file — R2 objects are never duplicated.
- **Structured notes.** The composer stores the teacher's raw text as `description` and optional formatting as `blocks` (topic, subtopic, heading, subheading, paragraph, definition, example, note, list, exercise, assignment). Formatting never alters the words.
- **Teacher assignments are per session** ([teachingAssignments.ts](./src/teachingAssignments.ts)). `teaching_assignments` records who taught which class and subject in each session. When one session hands over to the next, the outgoing assignments are recorded and the live ones (`subjects.teacherId`, `classes.classTeacherId`, teacher `class_memberships`, staff settings' class) are released; administrators assign the new session's teachers, optionally confirming chosen rows from last session (`…/sessions/:id/teaching-assignments/carry-forward`, empty slots only). A school's first session keeps its existing assignments, and schools already mid-session on deployment are not cleared.
- **Supervision** ([classSupervision.ts](./src/classSupervision.ts)). Owner and HOS join and exit classes (`POST /api/supervision/classes/:classId/join|exit`) without ever creating a teacher assignment. The Owner may always intervene; HOS intervention follows `PUT /api/supervision/policy` (`hosMode`: `intervene`, the default, or `view`). Content a supervisor posts carries `postedByRole`/`postedByLabel`, and their material actions are marked `supervisory` in the audit trail. All access is confined to the user's own school.

- **Class stream.** Posting and commenting (`POST /api/classrooms/:id/stream`, `/posts`, `/posts/:postId/comments`) take the author from the signed-in identity — a body `authorId` is ignored. The class must belong to the writer's school; its own teachers (class, co- or subject teacher) and enrolled students may write; school leadership writes as a labelled supervisor (`authorRole`, `postedByLabel` on the post) unless HOS is view-only; parents read only. A comment's post must belong to the class in the URL.

- **Acting role.** A person holding several roles acts as the one chosen in the role switcher (`X-Selected-Role`), but only while their current stored roles include it (`resolveEffectiveRole`). A header never grants a role, and a removed role stops working at once.
- **HOS and Owner.** HOS can do everything the Owner can except close the school or appoint (or change) a Head of School. `assertHosAppointmentAllowed` makes giving or changing the HOS role Owner-only across create, bulk create, bulk upload and role change; ICT cannot either. Approving Ndovera support access stays Owner-only because it grants Owner-level sign-in.
- **Subject rename** (`PUT /api/school/subjects/:id` with `name`, see [subjectRename.ts](./src/subjectRename.ts)) keeps the subject id and every link to it, refreshes the name copies kept beside that id (results, assignments, live classes, materials, lesson plans, timetable, question bank, CBT, teaching ledger) and records the change in append-only `subject_rename_audit` (`GET /api/school/subjects/:id/renames`). Audit trails keep the name they recorded.
- **Results period by id.** Results routes accept `sessionId` / `termId` (resolved within the school; unknown or foreign ids are rejected). Names still work, and batches are still stored by name.

Run `npm test` for academic, material, assignment-ledger, supervision, stream-security, role-permission and subject-rename coverage (the last runs requests through the bundled Worker against the D1 shim).

## What It Handles

- `/api/login` and settings-based authentication
- library, attendance, classroom, conversation, tuck-shop, purchase, and exam endpoints
- payroll endpoints for monthly sheets, staff account details, and saved payroll-note snapshots
- R2-backed classroom file uploads
- D1-backed application data for future remote usage
- tenant subdomain website rendering, including hero media galleries, admissions content, and public news pages
- tenant social-link previews using Open Graph and Twitter metadata with the school branding logo or public media fallback
- school newsroom APIs for drafting, reviewing, publishing, and uploading blog media
- AI billing and access rules for staff, students, and parents, including parent-specific daily free-request overrides
- Question-bank APIs that retain submitted assignment and CBT questions as individual records, apply AI-generated topic labels, provide topic-filtered practice questions, and let school owners allow or block teacher bank reuse.
- AMI growth-partner APIs provide portfolio analytics and activities, individual profile review, manual paid-payout recording, and state, regional, national, or global representative appointments. Partner-only verification APIs save an 11-digit NIN and securely serve uploaded utility bills to the partner or AMI.
- Growth partner activation and dashboard APIs provision a unique registration discount code. Public registration validates that the code in a partner link is that partner's assigned code before creating the school and referral relationship.

## Worker Bindings

The worker is configured in [wrangler.toml](./wrangler.toml) with:

- `APP_DB` bound to the D1 database `ndovera-db`
- `SESSIONS` bound to Workers KV
- `UPLOADS` bound to the `dovera-files` R2 bucket
- `AI` bound to Cloudflare Workers AI for authenticated staff and teacher chat responses
- optional `NVIDIA_API_KEY` secret for student Ndovera AI chat and Practice assistance through NVIDIA's OpenAI-compatible DeepSeek endpoint
- routes for `ndovera.com/api/*` and `www.ndovera.com/api/*`

## School closure

[schoolClosure.ts](./src/schoolClosure.ts) owns the closure workflow. Routes are `/api/school/closure` (GET status, POST request) and `/api/school/closure/revoke`, plus `/api/ami/school-closures` for Ndovera admins.

- **Who:** only the Owner can request or revoke a closure; the HOS gets 403. A request needs a category, a reason of at least 20 characters, and the school's name typed exactly.
- **Timing:** `effective_at` is 72 hours after the request. The cron handler (`runDueSchoolClosures`, every minute) closes due schools with tenant `status = 'closed'`, `website_status = 'inactive'` and `suspended_at` set.
- **Alerts:** Ndovera admins see pending closures as header notifications; the school's Owner and HOS see their own.
- **Email:** each step (requested, revoked, executed, reopened) is emailed through Zoho Mail (`sendZohoEmail`) to every active Ami account, any address in `NDOVERA_ALERT_EMAIL` (comma-separated, optional) and the school owner. Sending happens in the background and never blocks the closure. Results go to the audit trail as `schoolClosureEmailed` / `schoolClosureEmailFailed`.
- **Blocking a closed school:** `authenticate` refuses every request from a member of a closed school with `403 { code: 'SCHOOL_CLOSED' }`, except `/api/users/me`, `/api/school/closure` and logout.
  - The check also looks for an executed closure record, so a status recomputed elsewhere (payments, approvals) cannot reopen the school by accident.
  - Results are cached per instance for 60 seconds.
  - The school's website returns a "this school has closed" page (HTTP 410).
- **Reopening:** `POST /api/ami/tenants/:id/restore` reopens the school and marks the closure `reopened`. Nothing is deleted at any point.

Tests: `test/school-closure.test.mjs`.

## Timed assessments

An assignment with `metadata.durationMinutes > 0` is timed. `POST /api/assignments/:id/start` records the attempt (`assignment_attempts`) and returns the server's deadline; opening it again resumes the same clock. Submissions require a started attempt. After the deadline plus a 2-minute grace, work is refused under `latePolicy: 'reject'` and otherwise accepted and flagged `overtime`. The student page counts down against the server clock and submits automatically at zero.

## Ndovera AI assessments

[assessmentEngine.ts](./src/assessmentEngine.ts) handles the logic and [aiAssessments.ts](./src/aiAssessments.ts) handles storage and workflow. Routes are under `/api/ai-assessments/*`, plus `/api/school/exam-letterhead`.

- **Code plans, the model writes:** code decides the type, Bloom level, topic and marks of every question slot. The model, Llama 3.3 70B (falling back to the default model), writes only the content. Every reply is validated, and invalid output is retried once, then left as a failed slot for the teacher.
- **Batched generation:** the browser calls `generate-next` until `done`, so long papers never hit request limits.
- **Computed checks:** constrained A–D answer randomisation (balanced, never three in a row, no A-B-C-D runs) and the quality audit (marks, Bloom coverage, duplicates, MCQ validity, answer pattern, mark scheme, command words) are computed in code. The AI review only adds warnings.
- **Exams:** the teacher approves a blueprint before any question is written. "Answer 3 of 5" counts once towards the total. Finished papers are submitted through the existing `exam_questions` teacher-submission path. Its review outcome (returned or approved) shows in the assessment's version history.
- **Versions:** every save is a version in `ai_assessment_versions`, recording who, what and when. Nothing is overwritten.
- **Posting:** quizzes, assignments and tests become ordinary classroom assignments, with `metadata.opensAt`, `closesAt`, `attempts`, `latePolicy` and `autoMark`.
- **Student protections in the class assignments list, applied to every assignment, not only AI ones:**
  - students and parents never receive `answer`, `acceptedAnswers`, `markingGuide` or `explanation` until `metadata.answersReleased`;
  - work scheduled to open later stays hidden;
  - other schools get 404;
  - the submit route enforces open and close times, attempts and the late policy, and auto-marks MCQ and fill-in questions from the hidden key.

Tests: `test/ai-assessments.test.mjs`, which uses a stand-in model.

## Simple fees (feeEngine.ts)

[feeEngine.ts](./src/feeEngine.ts) and `/api/school/finance/simple/*` are the everyday fee screens. They sit on top of finance.ts (below), whose ledger they read and write.

- **Term table:** `getTermGrid` and `saveTermGrid` handle a whole term as classes × fee items. An empty or 0 cell leaves the item out for that class.
  - Saving a term with billed students returns `409 { needsDecision, affectedStudents, changes }` until the caller sends `changeMode`.
  - `adjust_existing` turns every difference into an audited debit or credit adjustment, bills new items, and cancels or credits removed ones.
  - `future_only` changes the structure only.
- **Lock:** `lockTerm` publishes every class's structure, bills every enrolled student and records `fee_term_locks`. A locked term refuses edits (423) until `unlockTerm`, which is audited.
- **Permissions:** `finance_settings.fee_edit_mode` is one of owner_only, owner_hos, owner_accountant or all. It gates fee-table changes and lock/unlock; the Owner always has access. Payments and adjustments keep their own role checks.
- **Accounts:** `accountSummaries` computes Term Fee + Outstanding + Other Charges − Discounts = Total Payable, then Balance = Total Payable − Paid.
  - Outstanding is earlier charges' net minus what was paid before the term's start date. Payments since then count as paid this term, so Balance always equals the sum of open balances.
  - The term start comes from `academic_terms.start_date`.
- **Payments:** `recordPayment({ payOldestFirst: true })` (`allocateOldestFirst`) pays earlier balances first. Any extra is credit on the newest charge, which shows as overpaid.
- **Per student:** `addStudentCharge` creates an obligation with no structure. `adjustStudent` spreads a discount, scholarship, waiver or credit over this term's charges, largest first; a credit may exceed what is owed. `resolveClassMove` handles keep, difference or custom.

Tests: `test/simple-fees.test.mjs`.

## Fees & Billing (fee structures and the student ledger)

[finance.ts](./src/finance.ts), with routes under `/api/school/finance/*`, is the fee system for new
billing. Bills already raised through Term Fees (`fee_assessments`) are not migrated. They stay where
they are and appear on the same ledger as "earlier records", which can be paid and reversed from it.

- **Fee structures** (`fee_structures`, `fee_structure_items`): one per class per term (by id), with
  status Draft → Published → Closed. Items can be required or optional, charged every term, once a
  session or once. Copying a previous structure gives an editable preview, and the source never
  changes. Editing a structure never reprices bills already issued. A structure with bills cannot go
  back to Draft.
- **Obligations** (`fee_obligations`): one charge per item per student, unique by `bill_key`, so issuing
  twice never double-bills. An annual item is billed once per session. Optional items are billed only to
  students in `fee_item_optins`. Each charge has its own status: `not_paid`, `partially_paid`, `paid`,
  `overpaid`, `waived` or `cancelled`. Unpaid charges from earlier terms stay separate obligations and
  follow the student.
- **Never billed twice:** issuing from a structure skips students that Term Fees already billed for that
  term, and `generateTermAssessments` skips students already billed by a structure.
- **Adjustments** (`fee_adjustments`): discount, scholarship, waiver, credit or debit, each with a
  reason and who authorised it. The original amount is kept. Only Owner/HOS can cancel a charge, and
  only one with nothing paid.
- **Payments** reuse `fee_payments`, which gains `status`, `payer_name`, `paid_on` and the `reversal_*`
  columns. Allocations must add up to the amount and may not exceed what each charge owes.
  Without explicit allocations, `selectedObligationIds` spreads the amount oldest-first over the
  selected bills (used for claims and online payments). Each payment writes an immutable receipt
  snapshot (`finance_receipts`).
- **Reversals** keep the payment and add a negative reversal entry with negative allocations. The
  balances are restored and the receipt is marked reversed.
- **Concurrency:** each balance UPDATE is conditioned on the `amount_paid` it read, and is followed
  by `INSERT OR REPLACE INTO finance_write_guard ... VALUES (1, changes())`. That table's CHECK
  (changed > 0) aborts the whole batch if the bill moved underneath, so a payment never half-lands.
- **Claims** (`finance_claims`) go submitted → under_review → resolved / rejected (a rejection needs a
  reason). A claim auto-resolves when its charges are settled, either at submission or when a payment
  lands.
- **Archives, dashboard and audit:** the archives filter by session, term, class, student, fee type,
  status and date, and also find payments against earlier debts within a date range. The dashboard
  covers the active term: Expected, Collected, Outstanding, Previous-Term Arrears (including Term Fees
  arrears), Collection Rate, Students Owing, Unresolved Claims and Recent Payments.
  `finance_audit` records actor, student, session, term, obligation, payment, action, old/new value,
  reason and time.
- **Who:** Owner, HOS and Accountant manage it. An accountant inside the merged Admin role acts as
  accountant here. Parents see only linked children and students only themselves. Every query is
  scoped to the caller's school.

Tests: `test/finance.test.mjs`.

## Academic Sessions, Promotion and the Term Fee Cycle

[academicSessions.ts](./src/academicSessions.ts) owns the academic calendar and the money that
follows it. The rules it enforces:

- exactly one active session per tenant, and one active term inside it, held by partial unique
  indexes (`idx_academic_sessions_one_active`, `idx_academic_terms_one_active`) rather than by
  application logic alone;
- a student's class placement belongs to a session. `session_enrollments` carries one row per
  student per session, so promoting a student writes a new row and never edits last session's
  record. `settings.classId` / `users.className` remain as a derived mirror of the active session;
- every term opens its own `fee_assessments` row. Money owed at the end of a term stays on that
  term's assessment and keeps counting towards what the student currently owes, so a debt is
  recorded once and paid once;
- `fee_payments` records the transaction and `fee_payment_allocations` records what it settled.
  Unallocated payments are applied oldest debt first.

Term and session transitions run from the Worker cron (`scheduled`) in `Africa/Lagos`, not from a
page being open. A session with no enrolments is deliberately skipped rather than opening to an
empty register.

Multi-step writes go through `db.batch()`, which is all-or-nothing.

### Migrating a school that predates this

`fees_ledger` holds a single running total per student — a lifetime paid figure against a
current-term charge — which cannot be split back into per-term history. `backfillOpeningBalances`
carries only the arrears those two numbers imply, as one `opening_balance` assessment, and leaves
`fees_ledger` untouched. Preview it first with `dryRun`; running it twice is a no-op.

While the rollout is in progress both fee paths dual-write: a payment taken through the legacy
`/api/school/fees/:studentId/pay` route also allocates against assessments, and a payment taken
through `/api/school/fees/students/:studentId/payments` also advances the legacy running total, so
the existing fees board never goes stale.

## Tests

```powershell
cd frontend/backend
npm test
```

Runs the workflow tests in [test/academic.test.mjs](./test/academic.test.mjs) against SQLite through
a D1 shim built on `node:sqlite`, so the invariants under test are the ones the database actually
enforces. No new dependencies; `npm test` bundles the module with esbuild first.

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
