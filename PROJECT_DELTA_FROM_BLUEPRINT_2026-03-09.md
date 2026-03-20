# Ndovera Project Delta From Original Blueprint

Last updated: 2026-03-09
Reference source: `NDOVERA.txt`
Purpose: Track what has actually been built, what changed from the original idea, and what is still missing.

---

## 1. Current active project shape

The active workspace is now a monorepo, not a single React app.

### Active packages
- `packages/web` — main school web application
- `packages/server` — school backend API using Express + SQLite
- `packages/super-admin` — separate global admin frontend
- `packages/super-admin-server` — separate global admin backend

### Important note
The root `README.md` still says the repo has only two packages (`web` and `server`), but the active workspace now has four active packages. This is one of the first documentation mismatches from the original/current reality.

---

## 2. What has been built so far

## 2.1 Main school web app
The main school web app currently includes these major top-level areas:
- Dashboard
- Academics
- Attendance
- Finance
- Library
- Clinic
- Hostel
- ICT
- Tuckshop
- Farming
- Communication
- Aptitude Tests
- Reports
- Settings
- Notifications
- Tutorials
- Management
- Website Builder
- Opportunities
- Growth Partners
- Landing page and Auth page

### Teacher feature modules currently present
Inside `packages/web/src/features`, the active teacher-oriented feature modules currently include:
- `attendance`
- `cbt`
- `farming`
- `messaging`
- `notes`
- `plans`
- `results`
- `scores`
- `teacher`

### What this means
The current product already moved beyond the original simple idea into a broader school operating system prototype with both school-facing and global-admin-facing surfaces.

---

## 2.2 Role-based UI exists in a simplified form
The active frontend already supports multiple role labels such as:
- Super Admin
- School Admin
- Ami
- Owner
- HOS
- Teacher
- Student
- Parent
- Finance Officer
- Librarian
- Clinic Manager
- Hostel Manager
- ICT Manager
- Tuckshop Manager

### Current behavior
- The web app stores a mock/simulated logged-in user in local storage.
- The UI changes based on the active role.
- Global roles (`Ami`, `Super Admin`, `Owner`) are redirected away from the school dashboard into a separate super-admin experience.

### Change from original idea
The original vision described a richer ID Manager with a digital card, role responsibility view, secure switching, and stronger identity semantics. The current implementation uses a lighter local-storage role-switch model instead of the full Smart ID Card engine.

---

## 2.3 Separate Super Admin product now exists
This is a major evolution from the original concept.

### Current state
Instead of keeping super powers inside the normal school app, the project now has:
- a separate `super-admin` frontend
- a separate `super-admin-server`
- an internal developer note warning that the super-admin UI must not be publicly exposed

### Change from original idea
This is a good structural security improvement because global administration is being separated from tenant/school operations.

### Current limitation
The super-admin app is still minimal and not yet a full implementation of the original global control vision.

---

## 2.4 Backend API exists and is broader than the original prototype
The current backend already includes routes for:
- health
- schools
- users
- students
- teachers
- classes
- announcements
- contact messages
- notes
- CBT exams and attempts
- messaging
- farms
- attendance
- grades
- finance stats
- notifications
- logo/media uploads
- website config
- website pages
- events
- FAQs
- FAQ chat
- testimonials

### What has changed
The project is no longer just an idea/specification. It already has a functional backend surface with a monolithic Express server and SQLite storage.

---

## 2.5 Website builder is already active
The original blueprint included strong website and school branding ideas.

### What exists now
The current backend and frontend already support parts of that direction:
- school website configuration storage
- page creation
- media upload
- school events
- FAQs
- testimonials

### Change from original idea
This area is actively implemented earlier than many of the deeper academic/AI/offline features.

---

## 3. Major differences from the original blueprint

## 3.1 Architecture does not fully follow the strict file/folder rules in `NDOVERA.txt`
The reference file says:
- no file should exceed about 200 lines
- one feature = one folder
- each feature owns UI, logic, styles, and API calls
- shared things go only into `shared/`
- avoid cross-feature coupling
- use app bootstrap folders like `app/`, `shared/`, `store/`, `config/`

### Current reality
The active project only partially follows that pattern.

#### What is aligned
- there is a `features/` folder
- several features have their own subfolders
- some domain separation is already present

#### What is not aligned
- many app-level pages still sit in `src/pages`
- reusable items are in `src/components`, `src/services`, and `src/hooks`, not in a dedicated `shared/` structure
- there is no clear `app/`, `store/`, or `config/` structure matching the blueprint
- many modules are still large and not split to the target size/style
- imports are not consistently using feature barrel exports

### Summary
The project adopted a partial feature-based structure, but not the full strict architecture defined in the reference.

---

## 3.2 Frontend navigation is tab-state driven, not route-driven
### Current reality
The main web app uses a central `App.tsx` with `activeTab` and `activeSubView` state to switch views.

### Difference from blueprint
The reference architecture preferred a cleaner app bootstrap and route-oriented organization.

### Impact
- fast for prototyping
- harder to scale cleanly as modules grow
- more coupling in the main app shell

---

## 3.3 Current backend is a single Express + SQLite service, not a deeper production-style platform
### Current reality
The main school backend is a single Express server using SQLite.

### Difference from original vision
The blueprint describes a much larger school operating system with stronger multi-tenant identity, auditability, offline-first sync behavior, AI monetization controls, and security structure.

### Current implementation level
The backend is a strong prototype/early product backend, but not yet the final enterprise architecture implied by the full document.

---

## 3.4 Multi-tenant support is partial, not complete
### What exists now
- many records include `school_id`
- schools table exists
- seed data creates a sample school
- role-based restrictions exist in some routes

### What is still simplified
- active seed/setup centers around a single school
- no full tenant provisioning workflow is visible yet
- no complete cross-school role-switching engine is visible yet
- parent-many-children-many-schools flow is not fully realized in active code

---

## 3.5 Offline-first vision is not yet fully implemented
The reference emphasizes offline-first behavior for:
- attendance
- CA score entry
- messaging drafts
- tuck shop sales
- sync when internet returns

### Current reality
The active code shows normal request/response web app behavior.
There is no clear offline queue, local sync engine, or conflict-resolution layer visible in the active packages scanned.

---

## 3.6 AI + Aura monetization vision is mostly not active yet
The reference file includes:
- paid AI tutoring
- teacher AI assistance
- aura pricing and tracking
- aura consumption auditing
- monetized reports and insights

### Current reality
- the teacher dashboard still contains an AI placeholder entry
- no active full Aura ledger or pricing flow was found in the main active packages scanned
- no complete teacher AI workflow was found in current active app code

### Summary
AI monetization is still mostly blueprint-level or placeholder-level, not fully implemented in the active app.

---

## 3.7 Lesson notes and lesson plans are simplified compared to the blueprint
### What exists now
- lesson notes module exists
- lesson plans module exists
- lesson plan API exists
- notes API exists

### Missing compared with blueprint
The blueprint describes much deeper lesson-management behavior such as:
- version history
- restore functionality
- material-type filters
- student completion tracking
- AI summaries
- engagement analytics
- Auras rewards/cashout connection
- live class linkage
- special codename table design

### Current state
The active implementation is a simpler operational prototype, not the full blueprint version.

---

## 3.8 Role model naming is inconsistent in places
### Examples of drift
The reference includes names like:
- HoS
- Class Teacher
- HOD
- HOD Assistant
- Head Teacher
- Nursery Head

### Current code uses a narrower or inconsistent subset such as:
- `HOS`
- `School Admin`
- `Teacher`
- `Finance Officer`
- `Clinic Manager`
- `Hostel Manager`
- `ICT Manager`
- `Tuckshop Manager`

### Impact
Role naming and permission naming will need normalization before the identity engine can match the full blueprint cleanly.

---

## 3.9 Documentation is behind implementation
### Current mismatch examples
- Root README describes two packages, but there are four active packages.
- The original blueprint describes more advanced identity/offline/AI systems than the active implementation currently exposes.

### Meaning
The codebase has evolved, but the product documentation trail has not been updated consistently.

---

## 4. What appears implemented only as prototype, placeholder, or mock
These areas appear present but still lightweight, mocked, or incomplete:
- auth/login flow
- role switching
- teacher dashboard dashboard-home content
- AI lesson assistant
- some lesson note and lesson plan flows
- parts of attendance, messaging, CBT, results, and farming UI
- super-admin UI depth

This means the project has broad coverage already, but some parts are still showcase/demo level rather than fully operational production flows.

---

## 5. Features from the original blueprint that still look incomplete or missing
Based on the active packages scanned, these original ideas are not yet fully visible as complete systems:
- full Smart ID Card / ID Manager
- one-login multi-role multi-school switching engine
- responsibility mapping per role
- strong inactive/locked state lifecycle for staff, students, and parents
- full offline-first sync engine
- CA score sheet as strict single source of truth
- fee ledger as strict single source of truth
- attendance engine as strict single source of truth across full flows
- advanced audit workflows
- advanced AI + Auras pricing/consumption backend
- production-grade parent portal depth
- complete student dashboard depth from the blueprint
- live class integration
- lesson plan version system
- richer analytics and monetized insights
- transport-depth operations
- deeper RBAC granularity and responsibility modeling

---

## 6. Important practical correction to the original idea
The original idea reads like a final product blueprint.
The current project is better described as this:

> Ndovera is now an evolving monorepo prototype/platform with separate school and super-admin surfaces, a live Express/SQLite backend, feature-based UI modules, and partial implementation of the larger blueprint.

That is the clearest correction to the original idea.

---

## 7. Recommended canonical status statement for the team
Use this when explaining the current state internally:

> The original `NDOVERA.txt` remains the long-term product blueprint, but the current implementation has evolved into a 4-package monorepo. Several major domains are already built in prototype or partial-production form, including role-based school dashboards, backend APIs, website builder capabilities, teacher modules, and a separate super-admin surface. However, the active code still diverges from the strict architecture rules and does not yet fully implement the offline-first, AI/Aura, identity-engine, and full multi-tenant lifecycle features described in the blueprint.

---

## 8. Update rules for this file going forward
Each time the project changes, update this file using this format:

### Added
- new modules or packages created
- new backend routes
- new database tables
- new role flows

### Changed
- architectural decisions changed from blueprint
- renamed roles
- new navigation behavior
- moved features between packages

### Missing / Still Pending
- blueprint items still not active
- placeholder features still not production-ready
- documentation mismatches still unresolved

---

## 9. Immediate cleanup priorities suggested by this scan
1. Update root README to reflect all active packages.
2. Create a proper architecture map for the active monorepo.
3. Normalize role names and RBAC vocabulary.
4. Split oversized modules and reduce `App.tsx` orchestration weight.
5. Decide whether the app should remain tab-driven or move to route-driven feature shells.
6. Convert prototype modules into real feature-owned services/state/components.
7. Add a formal changelog or product-status document beside this file.

---

## 10. Bottom line
The original file is still valuable as the master vision.
But the codebase has already changed in major ways:
- it is now a monorepo
- it has separate super-admin surfaces
- it has a working backend API
- it has many active school modules
- it only partially follows the strict architecture rules
- several deep blueprint features are still pending

This file should now be treated as the reality-check companion to `NDOVERA.txt`.

---

## 11. Update log — 2026-03-10 classroom and attendance refactor

### Added
- Student and teacher classroom stream was refactored into a social-style class discussion feed.
- New classroom UI modules were added for:
	- social feed / class discussion
	- mixed-question assignment studio
	- secure lesson notes workspace
	- adaptive practice arena
	- official-style results center
	- live class studio
- New classroom experience fixture data was added to support:
	- class feed posts and emoji meanings
	- assignment question mixes and teacher/student discussion threads
	- lesson note analytics and version tracking preview
	- live class sessions with 300-attendee rules
	- result release rules and fee-lock examples
	- attendance engine settings and watchlist indicators

### Changed
- The student dashboard now absorbs the classroom-intelligence cards that previously lived in the older classroom stream concept.
- `Academics` has been reshaped further into `Classroom` behavior rather than a generic academics page.
- Student classroom tabs now expose `Live Class` instead of `Lesson Plans`.
- Teacher classroom tabs now include both `Stream` and `Live Class` in addition to assignments, results, curriculum, and lesson plans.
- Assignment UX now reflects the blueprint direction more closely by showing:
	- multiple question types
	- shuffled learner order notice
	- public assignment comments
	- private student-teacher clarification thread
	- return-for-correction flow
- Results UI now better reflects the blueprint direction by showing:
	- term and session structure
	- teacher/principal remarks
	- promotion decisions
	- fee-lock examples
- Attendance is now presented according to the new instruction:
	- class-wide by default
	- subject-level only when the school chooses it
	- school policy can allow all teachers to mark attendance
	- at-risk attendance watch is visible in the teacher flow
- The new classroom UI is no longer frontend-only for the main interactive flows:
	- class discussion feed now persists posts, comments, and reactions in SQLite
	- assignment studio now persists assignment records, public comments, private support threads, and student draft/submitted responses
	- lesson notes workspace now persists teacher-created notes in dedicated classroom tables
	- live class studio now persists scheduled sessions and attendee joins

### Still pending / not yet final
- The social feed now persists core discussion activity, but deeper moderation, reporting, and attachment workflows are still pending.
- The assignment experience is now much closer to the desired direction, but final submission, grading, and anti-copy logic are still frontend-modeled rather than fully enforced by backend services.
- Live class is currently represented as a strong product-facing interface, not a finished real-time meeting engine.
- Results and attendance still need deeper backend single-source-of-truth behavior to fully match the blueprint.
- The broader strict architecture rules from `NDOVERA.txt` are still only partially followed.

---

## 12. Update log — 2026-03-10 classroom design-system correction and academic wiring

### Added
- A real app-level light/dark mode state was added to the active school shell and restored to the main top bar.
- A new classroom `Subjects` flow was added in the active school app:
	- subject tab in classroom
	- subject cards and subject detail view
	- backend subject persistence table
	- subject enrollment table for offering subjects to students
- New backend classroom persistence was added for:
	- classroom subjects
	- subject enrollments
	- practice pools / school question banks
	- result record payload storage
- Practice is no longer only fixture-described in the latest classroom flow:
	- global practice pool records now exist
	- CBT global practice records now exist
	- school-based question bank / exam-prep records now exist
- Live class join now returns room metadata and opens an in-app meeting overlay instead of only increasing attendance.

### Changed
- The active school shell now uses a more glassmorphism-style visual system in dark mode and a cleaner light mode fallback.
- `TopBar`, `Sidebar`, `Layout`, and global `index.css` styling were updated to support the requested day/night separation.
- Classroom header and tabs are now sticky so stream content scrolls under them.
- Classroom stream was redesigned to better match the requested behavior:
	- grouped emoji guide popup instead of always-on emoji panel
	- single emoji entry action
	- auto-growing text areas
	- cleaner stream-first composition flow
- Assignment flow was redesigned from one long stacked page into:
	- assignment cards list
	- single-assignment focus view
	- collapsible instruction bar
	- independent assignment-detail and feedback/thread scroll areas
	- next-assignment prompt after submit
- Lesson notes were reshaped into note cards that open into focused subject-linked detail with back navigation.
- Results were reshaped into session and term accordions with:
	- separate session download
	- separate term download
	- contact-school wording instead of fee-lock instruction copy
	- conditional class position visibility
	- improved official-record presentation direction
- Live class guide content is now shown as a pre-join popup rather than permanent inline explanation.

### Still pending / not yet final
- The live class overlay is a stronger functional entry point, but it is still not a full real-time video engine.
- Subject flow now exists end to end at the CRUD/display level, but deeper per-subject cross-linking into every classroom child module can still be expanded.
- Results persistence is now seeded and served, but final print-grade branded PDF generation is not yet implemented.
- Practice now has backend-backed categories, but full answer submission, scoring, and longitudinal mastery tracking are still pending.

---

## 13. Update log — 2026-03-10 classroom stream media + glassmorphism refinement

### Added
- Classroom stream composer now behaves as a real bottom bar fixed to the stream panel.
- Classroom stream now supports richer post attachments for:
	- media/image sharing
	- voice notes
	- short video messages up to 1 minute
- Backend upload support for classroom stream assets is now actively used by the classroom feed workflow.
- Scrollable emoji selection was added so learners and teachers can choose from a broader emoji variety.
- Feed posts now render attachments inline inside the conversation flow.

### Changed
- Classroom stream visual behavior was shifted again to a more chat-native layout.
- Dark mode stream surfaces were refined toward a more complete glassmorphism treatment using dedicated stream styling classes.
- Teacher posts now read more like assistant responses, while student posts read more like user prompts.
- Pinned posts continue to surface at the top, now as lightweight pinned banner chips.

### Still pending / not yet final
- Voice notes and short video messages currently support file-based sharing and preview, not browser-native recording controls.
- Stream moderation/reporting/attachment governance can still be expanded further.

---

## 14. Update log — 2026-03-10 classroom stream ordering + assignment page flow

### Added
- Classroom stream now keeps the newest posts at the bottom of the scroll area, with the scroll position pushed to the latest item on refresh/new-post updates.
- Stream reactions now support:
	- likes (`👍`)
	- dislikes (`👎`)
	- broader emoji reactions through the picker
- Teacher assignment view now receives learner submission visibility end to end through backend assignment payloads that include a submission roster.
- Student assignment work now opens into a dedicated assignment page-like view from the assignment list.
- After a student submits an assignment, the UI now:
	- stores the submission in backend persistence
	- closes the active assignment work page
	- opens a next-assignment modal
	- lets the learner choose between doing the next assignment now or later

### Changed
- Classroom stream header text was reduced and the previous top titles were removed.
- Stream comments were removed from the active stream UI, leaving like/dislike reactions and emoji reactions as the primary interaction tools.
- The detached stream composer now measures the real classroom stream column width and fixes itself to the bottom edge without a viewport gap.
- Stream text styling was shifted toward a lemon/yellow tone in the active classroom surface.
- Assignment intro/explainer copy was removed from the top of the assignment workspace.
- The previous assignment instruction-bar copy was removed from the focused assignment view.
- Assignment cards now show student-specific submission state instead of only generic assignment status when a learner is viewing them.

### How it was done
- `packages/server/server.ts`
	- classroom feed query ordering changed from newest-first to oldest-first inside the live scroll area so the newest content sits at the bottom
	- reaction aggregation was split into separate like and dislike counts
	- assignment payloads were extended with teacher-visible submission roster data
- `packages/web/src/features/classroom/components/ClassroomSocialFeed.tsx`
	- fixed-composer width is now aligned to the actual stream shell using runtime DOM measurement
	- auto-scroll behavior was added for latest-post visibility
	- comment UI was removed from the active stream surface
	- like/dislike chip logic was added and connected to the backend reaction endpoint
- `packages/web/src/features/classroom/components/AssignmentStudio.tsx`
	- student assignment selection now opens a dedicated work screen
	- submission flow now returns the learner to the assignment list and launches the next-assignment modal
	- teacher side now shows learner submission visibility in the assignment details panel
- `packages/web/src/features/classroom/services/classroomApi.ts`
	- stream and assignment types were extended to match the new backend payload structure

### Important current note
- Classroom media sharing is still implemented through the active backend upload flow in the current codebase. It is not yet a true device-to-device-only media delivery architecture.
- New code added in this update was annotated with section comments where new logic blocks were introduced.

---

## 15. Update log — 2026-03-10 private backend classroom media delivery

### Added
- Classroom media now uses backend-protected asset delivery instead of direct public classroom file URLs.
- A signed classroom asset URL flow now exists for browser-rendered image/audio/video attachments.
- Uploaded classroom attachments now persist an internal `storageKey` so delivery can be controlled separately from storage.

### Changed
- Direct public static access to `/uploads/.../classroom/...` is now blocked on the backend.
- Classroom feed responses now rewrite stored attachment references into temporary backend-signed asset URLs.
- The frontend classroom composer now preserves the backend `storageKey` returned during upload.

### How it was done
- `packages/server/server.ts`
	- added token signing helpers for private classroom assets
	- added attachment normalization for legacy public paths and new internal storage keys
	- blocked public static classroom upload access while leaving non-classroom uploads unchanged
	- added a protected `GET /api/classroom/assets/:storageKey` route for signed media delivery
	- rewrote classroom feed attachment URLs on response so the UI consumes protected links
- `packages/web/src/features/classroom/services/classroomApi.ts`
	- extended classroom attachment typing to include `storageKey`
	- updated the classroom asset upload response typing
- `packages/web/src/features/classroom/components/ClassroomSocialFeed.tsx`
	- stores the backend `storageKey` on attachment records before post creation

### Cloudflare storage direction
- The current implementation still stores classroom media on backend-managed storage, which keeps async history, old-post visibility, and cross-device access intact.
- This update prepares the app for a later Cloudflare-backed storage migration by separating:
	- where files are stored (`storageKey`)
	- how files are delivered (signed backend URL)
- A future Cloudflare migration can swap the underlying storage layer while preserving the same private delivery contract.

---

## 16. Update log — 2026-03-10 stream recording reliability + session media reset

### Added
- Classroom media retention now has a backend cleanup path so older classroom media files are removed after the configured retention window.
- Signed classroom media access now uses a query-string key flow instead of a path-segment key so audio and video playback works reliably for nested storage keys.
- API failures now surface readable backend error messages to the frontend instead of only generic upload errors.

### Changed
- Classroom upload size limit was increased so recorded voice notes and short video messages can actually upload.
- In-browser video recording now uses lower capture resolution and controlled bitrates to reduce upload failure risk.
- Live video preview now stays visible during recording with autoplay/muted preview behavior.
- Expired or missing classroom media attachments are filtered out of feed responses instead of returning broken links.

### How it was done
- `packages/server/server.ts`
	- added classroom media retention cleanup helpers
	- switched signed classroom media delivery from route-param storage keys to query-param storage keys
	- increased classroom upload capacity to support recorded media sending
	- filtered expired attachment files out of classroom feed responses
- `packages/web/src/services/apiClient.ts`
	- upgraded request failure handling so real backend error messages are shown to the UI
- `packages/web/src/features/classroom/components/ClassroomSocialFeed.tsx`
	- reduced video recording resolution/bitrate
	- added more reliable live preview playback for video recording
	- preserved recording upload flow while surfacing better error messages

### Further recording correction
- Voice note capture was further corrected by:
	- disabling aggressive browser audio processing for recording input
	- choosing recorder MIME types that the current browser can also preview back
	- fixing recorded file extensions to match the captured MIME type
	- flushing recorder data before stop so audio chunks are not dropped
	- adding adjustable microphone gain with local persistence so weak microphones can be amplified more strongly in later sessions
	- broadening backend recorded-media type detection so browser-specific video MIME/container variations are accepted during upload

---

## 17. Update log — 2026-03-10 classroom media engine upgrade pass 1

### Added
- Classroom stream attachments now support richer media metadata fields for future-first rendering, including optional video thumbnails and transcript-ready attachment typing.
- Video attachments now generate a client-side thumbnail during upload preparation when the browser can decode the captured file.
- Expanded video-note viewing now exists, so a short classroom video can open in a focused modal instead of staying constrained to the inline stream bubble.
- Circular video-note styling was added so short videos read more like messaging-native notes than generic rectangular uploads.

### Changed
- Media recorder settings are now selected through an adaptive capture profile that responds to browser connection hints such as reduced-data mode and weaker network profiles.
- Video recording constraints now scale width, height, and bitrate more carefully to reduce failed uploads on weaker connections.
- Classroom asset upload now retries transient failures up to three times before surfacing an error to the user.
- Inline video attachments now render as more premium “video note” cards with a compact circular presentation and expand affordance.

### How it was done
- `packages/web/src/features/classroom/services/classroomApi.ts`
	- extended `ClassroomFeedAttachment` with optional `thumbnailUrl` and `transcript` fields
- `packages/web/src/features/classroom/components/ClassroomSocialFeed.tsx`
	- added adaptive media profile selection for recording
	- added client-side video thumbnail generation
	- added upload retry handling for classroom assets
	- added expandable video-note modal behavior and updated inline video-note rendering
- `packages/web/src/index.css`
	- added circular video-note presentation styles for the upgraded renderer

### Still pending / not yet final
- Transcript generation is typed for future use but is not yet connected to a real AI transcription service.
- Upload resilience is improved, but true chunked/streaming upload is not yet implemented.
- Hold-to-record gestures, Telegram-style send locking, and deeper media post-processing are still future enhancement work.

### Further recording pipeline correction
- Classroom audio recording now resumes the browser `AudioContext` before the processed stream is used, which prevents the suspended-audio white-noise/silence issue seen on some browsers.
- The processed microphone path now flows as `source -> gain -> analyser -> destination`, so the analyser stays in the real recording chain instead of only observing it.
- Video recording now stays on the raw capture stream while audio-only recording keeps the processed gain/waveform path, improving video timing stability.
- Camera preview playback is now forced more explicitly with `muted` and `playsInline` before `play()`, reducing delayed live preview startup.
- Browser microphone cleanup features (`echoCancellation`, `noiseSuppression`, `autoGainControl`) were re-enabled for both audio and video capture.
- Media recorder chunk cadence was relaxed from 250ms to 1000ms to reduce CPU churn and improve recording stability.

### Reusable recorder extraction
- Classroom media capture logic is now being separated into a reusable frontend recorder component so the classroom feed does not directly own camera/microphone transport details.
- A dedicated reusable recorder now encapsulates:
	- unified media capture
	- separate live preview branching
	- stable `MediaRecorder` setup
	- audio waveform/meter monitoring
	- one-second chunk emission for future streaming upload work
- `ClassroomSocialFeed` is now wired to consume recorder output as files/capture payloads rather than embedding the whole recording engine inline.

### Chunk upload + server assembly now wired
- Recorded classroom voice notes and video notes now stream chunks through a real `POST /api/upload-chunk` path while recording is active.
- The reusable recorder now emits chunk payloads with session-aware metadata (`sessionId`, `index`, `mimeType`, `fileName`) so uploads can be resumed and assembled outside the UI layer.
- `ClassroomSocialFeed` now queues chunk uploads per recording session and calls a finalize endpoint when recording ends instead of uploading the full recorded file in one request.
- The server now assembles stored chunks into one final private classroom media file through `POST /api/upload-chunk/complete`, then returns the same signed classroom asset contract used by the rest of the feed.

---

## 18. Update log — 2026-03-10 Ndovera messaging integration inside classroom

### Added
- A reusable Ndovera messaging panel now exists inside the classroom stream side rail so users can chat without leaving the learning surface.
- Ndovera Helpdesk is now exposed as a built-in chat contact from the classroom messaging panel.
- School-level messaging policy now includes a dedicated `allow_student_peer_messaging` flag.

### Changed
- Student-to-student direct messaging is now gated by HOS approval instead of being implicitly open.
- The classroom messaging panel and the broader web messaging module now share one Ndovera chat UI instead of a classroom-only stub.

### How it was done
- `packages/server/server.ts`
	- added `messaging_settings` storage
	- added approval-aware messaging routes for settings, contacts, thread retrieval, and message sending
	- added helpdesk-aware thread handling so `Ndovera Helpdesk` can be reached from the same chat surface
- `packages/web/src/features/classroom/services/ndoveraMessagingApi.ts`
	- added a dedicated frontend API layer for Ndovera chat settings, contacts, threads, and send actions
- `packages/web/src/features/classroom/components/NdoveraMessagingPanel.tsx`
	- added the reusable classroom-side messaging UI with HOS approval controls and Helpdesk access
- `packages/web/src/features/classroom/components/ClassroomSocialFeed.tsx`
	- embedded the reusable messaging panel into the classroom side rail
- `packages/web/src/features/messaging/components/MessagingModule.tsx`
	- switched the web messaging module to reuse the same Ndovera messaging panel

### Important current note
- Student-to-student chat now depends on the HOS-managed school policy, but students can still message staff/helpdesk while peer chat is disabled.
- The main school sidebar now exposes this messaging experience as `Chat` for roles that currently have messaging permission (`School Admin`, `HOS`, `Teacher`, `Student`, `Parent`).
- The shared Ndovera chat surface now has stronger light-mode readability, heavier dark-mode glass treatment, and `Enter`-to-send behavior (`Shift` + `Enter` keeps multiline input).
- The web dev proxy now reads the backend bound-port file so the frontend can follow the current school server even when the backend falls back from `3001` to another local port during development.
- The chat contact rail now includes a dedicated recipient finder so users can start chats by selecting classmates, teachers, Helpdesk, or searching with known student identifiers, and the contact rail scrolls independently from the active conversation.

## 19. Update log — 2026-03-11 assignment workspace and messaging contact fix

### Changed
- The classroom assignment tab now behaves more like a focused assignment workspace for students: clicking an assignment card opens a fuller task page with progress, question navigation, and clearer draft/submit flow.
- Assignment cards now communicate whether a learner is starting fresh, continuing a draft, or reviewing an already submitted assignment.
- The school messaging contacts query no longer fails on SQLite due to the ambiguous `name` column in the multi-table contact lookup.

### How it was done
- `packages/web/src/features/classroom/components/AssignmentStudio.tsx`
	- added assignment progress summaries for students
	- added a question navigator so learners can jump between sections inside the assignment workspace
	- strengthened assignment card action cues (`Open assignment page`, `Continue assignment`, `Review submission`)
- `packages/server/server.ts`
	- fixed the messaging contact query by qualifying the contact ordering column as `u.name`

---

## 20. Update log — 2026-03-11 default student peer chat + local-only chat media

### Changed
- New or auto-created school messaging policy rows now default to student-to-student chat being enabled, so schools can later tighten it instead of needing to unlock it first.
- Ndovera chat now supports device-local media attachments for images, audio, video, and general files up to 1GB without storing those media files on the server.
- Existing server-backed text chat remains cross-device, while chat media intentionally stays only on the device that created or received it.
- The chat composer now includes stream-style emoji picking plus reusable voice-note and short video-note capture controls.

### How it was done
- `packages/server/server.ts`
	- changed the default `messaging_settings.allow_student_peer_messaging` path to enabled for seed/default policy creation
- `packages/web/src/features/classroom/services/localMessagingMedia.ts`
	- added an IndexedDB-backed local media store for chat blobs scoped by current user and selected peer
- `packages/web/src/features/classroom/components/NdoveraMessagingPanel.tsx`
	- merged server text messages with device-local media entries in the visible thread
	- added local file attachment handling with a 1GB cap
	- added device-only media rendering for image, audio, video, and generic files
	- added emoji picker behavior aligned with the classroom stream experience
	- wired reusable recorder capture into chat for local voice/video notes
- `packages/web/src/features/classroom/components/ClassroomMediaRecorder.tsx`
	- added a compact mode so the shared recorder fits inside the chat composer without expanding the thread layout too much

### Important current note
- This is a deliberate privacy/storage divergence from classroom feed media: classroom feed media can still use server-backed upload flows, but direct-chat media is now explicitly device-local only.
- When a user signs into a different device, old text chats still appear from the server, but previously attached chat media does not follow them.

---

## 21. Update log — 2026-03-11 section-based school subject catalog

### Changed
- The classroom subject setup flow now starts from a curated section-based subject list covering pre-school, primary, junior secondary, and senior secondary offerings.
- Schools can choose a subject from the standard list, customize its name/code/summary, or type their own subject before creating a subject space.
- The subject picker now filters out subjects that already exist in the same school section so schools do not keep re-adding the same subject option there.

### How it was done
- `packages/web/src/features/classroom/data/subjectCatalog.ts`
	- added the built-in section subject catalog with deduplicated subject entries from the requested nursery, primary, junior secondary, and senior secondary lists
	- added helper utilities for section labels and quick subject code generation
- `packages/web/src/features/classroom/components/SubjectHub.tsx`
	- added section selection and standard-subject selection to the teacher subject creation flow
	- filtered out already-created section subjects from the catalog dropdown
	- surfaced the chosen section on subject cards and in subject detail
- `packages/web/src/features/classroom/services/classroomApi.ts`
	- extended classroom subject payloads to carry `section`
- `packages/server/server.ts`
	- added `section` storage/migration support for classroom subjects
	- seeded existing sample subjects with section tags
	- added server-side duplicate protection so the same subject name cannot be created twice in the same school section

---

## 22. Update log — 2026-03-11 section-based school class catalog

### Changed
- The classroom `My Classes` / `All Classes` area now starts from a built-in section-based class list for preschool, primary, junior high, and senior high.
- Schools can choose from the standard class list, customize the level or class name, and add their own class naming structure.
- Class creation now blocks duplicates inside the same school section when both the class level and class name match an existing entry.

### How it was done
- `packages/web/src/features/classroom/data/classCatalog.ts`
	- added the built-in class catalog covering the requested preschool, primary, junior high, and senior high lists
- `packages/web/src/features/classroom/components/ClassRegistry.tsx`
	- added a section-based class creation and listing UI for the classroom classes tab
	- filtered the class catalog dropdown so already-created section classes do not keep appearing as reusable options
- `packages/web/src/pages/Academics.tsx`
	- replaced the old mock `teacherClasses` cards with the new class registry UI
- `packages/web/src/features/classroom/services/classroomApi.ts`
	- added typed class fetch/create helpers
- `packages/server/server.ts`
	- added `section` support to `classes`
	- migrated existing rows to inferred sections
	- updated class seeding to section-aware sample names
	- enforced school-aware duplicate checking for class creation
