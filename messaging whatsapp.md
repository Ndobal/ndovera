Ndovera Parent Notifications: Developer Specification
1. Product purpose and definitive rules
Build a tenant-isolated communication service that automatically informs authorised parents about published school fees, outstanding fees, verified payment receipts, published results, assignments and school notices. Notifications integrate with existing Ndovera business records; do not create a separate source of truth for balances, results or assignments.
This specification replaces the previous 100-unit allowance and ₦15 WhatsApp price.
Channel	School selling price	Complimentary allocation	Initial behaviour
WhatsApp	₦15.20 per message unit	10 units per school per academic session/term	Requires available WhatsApp units
SMS	₦8.00 per SMS segment unit	10 units per school per academic session/term	Requires available SMS units
Email	₦0 initially	No purchased units required while free	Continues when paid channels are paused
In-app	Free	No paid wallet	Continues independently


Implementation assumption: the 10-unit allowance is applied separately to WhatsApp and SMS because SMS follows the same rules as WhatsApp. Keep each allowance independently configurable by Super Admin; never silently combine the two wallets.
Prices above are Ndovera retail prices, not verified provider quotations. Provider bills, funding and school credit balances are separate. Use current contractual provider costs to monitor margins before production. SMS price is per billable segment, not an unlimited-length message. Show the segment count before dispatch.
Purchased units carry forward. Complimentary term units expire at term end. Super Admin gifts use a separately recorded expiry selected at allocation time. Consume eligible units in this order: expiring term allowance, expiring gifts, non-expiring gifts, purchased units. Use earliest expiry within each class. Never deduct expired or already reserved credits.
2. Events and authorised recipients
Event	Notification trigger	Required validation
Term fees	Bills officially published	Published charges and authorised guardians
Fee reminder	Eligible unpaid account every 14 days	Latest authoritative outstanding balance
Receipt	Payment verified, posted and receipt stored	Approved payment; never an unverified claim
Fee clearance	Account reaches zero after approved posting	Recalculate before sending
Results	Approved results officially published	Publication version and guardian access
Assignment	Teacher publishes to authorised class	Student enrolment and guardian relationship
Assignment digest	School-selected daily sending time	Current published assignments
Deadline reminder	Configured deadline interval	Still actionable; omit completed work where applicable
School notice	Authorised publication	Approved recipient scope


“Entire parents” means the complete eligible recipient set for that event: all eligible school parents for a school-wide notice, affected class parents for a class notice, and the relevant guardian for an individual receipt. Exclude withdrawn consent, invalid contacts and unauthorised guardian relationships. Show excluded counts and reasons; never report them as notified.
Default to one designated notification guardian per student, configurable by the school. Deduplicate by authorised guardian and channel address. Combine siblings only when the guardian can access every included child. Do not deduplicate different parents merely because they share a surname. A combined WhatsApp message costs one unit when it fits one approved template; SMS may cost several segments.
3. Two selectable insufficient-credit policies
School setting: insufficient_whatsapp_policy = PAUSE_BATCH | SMS_FOR_REMAINDER. Default: PAUSE_BATCH. Owner or authorised Head of School selects the policy. SMS fallback must be explicitly enabled with a visible cost explanation.
A. Pause the whole WhatsApp batch
1. Build the complete eligible WhatsApp recipient set and calculate required units.
2. Compare with spendable WhatsApp units after reservations and expiry.
3. If enough, atomically reserve the whole batch before enqueueing any sends.
4. If insufficient, send no WhatsApp messages from that batch. Mark it awaiting_credits and pause new automatic WhatsApp admission for the school.
5. Display available, required, shortfall and exact top-up price; notify the owner in-app and by available free email.
6. Continue independent email and in-app delivery.
7. After a verified purchase or authorised free allocation, revalidate the blocked batch and reserve it only if fully fundable. Restore automatic admission when blocking credit requirements are resolved.
The pause is for automatic WhatsApp sending. It does not stop fee posting, result publication, receipt creation, assignments or the school's access to Ndovera. Previously funded batches continue. Manual sending cannot bypass wallet checks or split a blocked audience to defeat the pause.
B. WhatsApp first, SMS for remaining parents
1. Build a stable, deduplicated recipient snapshot with channel consent and contact eligibility.
2. Allocate available WhatsApp units to a deterministic recipient subset; record that routing before sending.
3. Route the remaining recipients to SMS if they have a valid, consented SMS contact. Parents without a WhatsApp contact can also enter this SMS group when fallback is enabled.
4. Render each SMS, calculate actual billable segments, and total the SMS units needed.
5. Reserve all required SMS units for the remainder and all selected WhatsApp units atomically before starting the batch.
6. If SMS credits cannot cover the complete remainder, hold the whole new batch: do not start a knowingly underfunded partial campaign. Show both channel shortfalls and pause relevant automatic admission.
7. If the plan is funded, send the WhatsApp subset and SMS remainder. Pause future automatic WhatsApp admission when its spendable balance reaches zero; funded SMS routing, free email and in-app delivery remain available.
This planned SMS fallback covers credit shortage. Fallback after a confirmed WhatsApp failure is a separate optional setting requiring SMS consent, funds and duplicate protection. Never fall back merely because a WhatsApp delivery acknowledgement is delayed or unknown.
Do not send both WhatsApp and SMS to the same guardian for the same event unless the school explicitly enables a separately priced multi-channel policy. Email/in-app may accompany either channel according to preferences.
Example
A batch has 100 eligible parents, 10 WhatsApp units and SMS text that fits one segment per recipient.
Policy	Outcome
Pause batch	No WhatsApp sent; 90-unit shortfall costs ₦1,368
SMS remainder, 90 SMS units available	10 WhatsApp messages plus 90 SMS messages; SMS units have retail value ₦720
SMS remainder, only 10 SMS units available	Batch held; 80-SMS-unit shortfall costs ₦640


An eligible recipient without any permitted paid-channel contact cannot be promised coverage through those channels. Mark it unreachable_paid_channels, continue permitted email/in-app, and flag contact correction separately from credit shortage.
4. Wallets, purchases and allowances
Maintain separate WhatsApp and SMS wallets. An email wallet becomes necessary only if paid email is activated. Units cannot transfer between channels. Display term allowance, gifts, purchased units, reserved units, spendable balance, used units and expiry dates.
Store NGN money as integer kobo: WhatsApp 1520, SMS 800, email initially 0. Store units as integers. Never use floating point for checkout totals.
Units	WhatsApp purchase	SMS purchase
10	₦152	₦80
50	₦760	₦400
100	₦1,520	₦800
500	₦7,600	₦4,000
1,000	₦15,200	₦8,000


Allow any positive permitted quantity or admin-configured package sizes. Do not introduce undisclosed discounts or surcharges. Minimum checkout sizes may be configured and displayed.
Purchase workflow: server generates a quote with channel, quantity, unit price version, currency, total and expiry; creates a unique purchase reference; opens Flutterwave checkout; verifies payment server-side; confirms successful status, expected reference, NGN amount and school association; credits once; records ledger entries and receipt; re-evaluates pending batches. Browser redirects and client claims must never credit units. Duplicate webhooks and replayed verification must return the original outcome.
Allocate complimentary units once using a unique key (school_id, academic_session_id, term_id, channel, grant_type=term_allowance). Changing the active term back and forth must not allocate twice. Grant only to an eligible active school term. Existing purchased units remain usable across term transitions. Reserved allowance units are earmarked only for a defined dispatch period; cancel and release stale reservations, then expire the released credits when appropriate.
5. Super Admin free allocation
Provide Super Admin → Communications → Allocate Free Units.
Fields: target school or reviewed school selection, channel, positive integer units, reason, optional expiry, internal note and idempotency key. Show a review containing school names and quantities before submission. No payment is required.
Persist a separate immutable grant with administrator identity, school, channel, quantity, reason, timestamp, expiry and ledger transaction. Gifts supplement the 10-unit term allowance and do not reset it. A sufficiently large gift may resume blocked automation through the same revalidation process as a purchase. A small gift must not incorrectly unpause an underfunded batch.
Only Super Admins with the allocation permission can perform this action. School staff cannot allocate units to themselves. Provide grant history and exports. Correct mistakes through audited reversals of unspent grant balances; never delete the original entry or revoke units already consumed. Bulk grants return per-school results with idempotent retry protection.
6. Free email and later pricing
Set email_billing_mode=FREE and email_price_kobo=0 initially. Schools require no email credits or checkout while this mode applies. Email is free to schools; provider operating costs remain Ndovera's expense.
Super Admin may introduce a non-negative email price with an effective date, price version and clear school notice. Keep historical free sends free. Do not silently auto-charge schools. When the price becomes effective, schools must purchase email units or explicitly authorise the supported payment model; otherwise paid email pauses with a warning. Queued but unreserved email is evaluated under the effective policy at admission, with its proposed charge visible. Already reserved free dispatches remain free within their defined reservation expiry.
Use the same full-batch check, reservations, ledger and manual gift framework for paid email. Keep channels independently configurable so an SMS shortage does not block a free email batch. Free email still requires applicable consent/preferences, valid addresses, unsubscribe handling, bounce suppression and fair-use controls. Configure authenticated sending domains and verify delivery events. An accepted provider request is not proof of inbox arrival.
7. Fee reminder rules
Run a daily scheduler in the school timezone, default Africa/Lagos; persist timestamps in UTC. A daily scheduler checks eligibility, not daily sending.
Use the same outstanding balance as the fee account: carried-forward arrears plus current charges minus verified payments and approved adjustments. Do not independently recompute a contradictory balance from notification data.
First reminder is eligible 14 days after the initial fee-notification submission or the school's configured initial reminder date. Following reminders are eligible 14 days after the previous qualifying submission. Treat provider-accepted submission as the cooldown anchor to prevent repeated reminders; track actual delivery separately. Confirmed failures retry under the same reminder identity and bounded retry policy, not as a newly chargeable reminder. Unknown outcomes remain under reconciliation.
Exclude fully settled accounts, disputes, approved pauses, exemptions and unauthorised recipients. Partial payments reduce the next message balance. Recheck immediately before dispatch. Do not replay multiple missed reminders after top-up: collapse to one current reminder per guardian and applicable account scope. Expire reminders at term end unless arrears reminders are explicitly configured for the next term. Email and WhatsApp attempts share one logical reminder event but maintain independent channel states and cadence.
8. Architecture and durable workflow
Flutter administration/parent interfaces; Cloudflare Workers APIs and consumers; D1 business state, grants and ledger; Cloudflare Queues dispatch; Cron scheduling/reconciliation; R2 private receipts; official WhatsApp API adapter; contracted Nigerian SMS adapter; email provider adapter; Flutterwave purchases; managed secrets; existing authentication and RBAC.
For WhatsApp, use consented contacts and approved templates where required. Do not promise universal delivery. Provider acceptance, delivery and read are distinct states. Cloudflare Queues has at-least-once delivery: consumers must deduplicate processing. References: https://www.twilio.com/docs/whatsapp/api and https://developers.cloudflare.com/queues/reference/delivery-guarantees/ .
Workflow:
1. Commit business record and notification outbox event in the same supported database transaction/batch.
2. Dispatcher reads outbox, creates a logical batch and resolves permitted recipients.
3. Admission service performs routing, current eligibility checks, segment estimation, budget check and whole-plan reservations.
4. On shortage, persist blocked state, warning and free-channel work; perform no paid provider submission.
5. On success, atomically persist funded plan, per-delivery reservations and dispatch outbox.
6. Dispatcher queues delivery IDs. Queue payloads contain identifiers rather than sensitive message bodies.
7. Consumer loads trusted tenant context, checks cancellation, consent, content version, reservation and expiry, then submits through the chosen adapter.
8. Persist attempt identity and provider response. Webhooks update status and settle/release reservations according to billing policy.
9. Scheduler reconciles stuck reservations, unknown submissions, failed outbox dispatch and pending batches.
Reserve before calling providers. A whole plan reservation must either succeed completely or leave balances unchanged. Serialize admission per school with a suitable coordinator such as a Durable Object, and enforce persistent conditional updates and unique constraints as the durable authority. Do not rely on an in-memory lock or a read-balance-then-decrement sequence across Workers. Use supported D1 transactional operations; do not invent a generic interactive transaction API. Keep large recipient plans staged in bounded chunks; do not expose dispatch until the complete funding reservation commits.
9. Suggested data model
All school-owned rows include school_id; every query enforces trusted tenant scope.
Table	Purpose and essential fields
communication_settings	Channel enablement, shortage policy, digest time, timezone, reminder rules, pause reasons
channel_price_versions	Channel, unit price kobo, billing mode, effective dates, changed-by
credit_grants	School, channel, source, initial/remaining units, expiry, term key, reason, actor
channel_wallets	Transactionally maintained available/reserved/consumed projections and version
credit_ledger	Immutable allocation, purchase, reservation, settlement, release, expiry and reversal entries
credit_reservations	Batch/delivery identity, grant allocations, quantity, status, expires-at
message_purchases	Quote, channel, units, amount, price version, payment reference/status
guardian_channel_consents	Guardian, channel, scope, timestamp, source, withdrawal
notification_events	Business event identity, scope, publication version, payload reference
notification_batches	Event, routing policy, counts, channel requirements, status, freshness/expiry
notification_deliveries	Guardian, channel, content version, segments, reservation, provider ID, status
delivery_attempts	Submission identity, attempt state, redacted error and retry time
notification_outbox	Durable dispatch work, attempts and next processing time
provider_webhook_events	Provider event identity, signature validation and deduplication
fee_reminder_state	Account/guardian scope, cooldown, next due time and pause
communication_audit	Configuration, allocation, suspension and privileged-action history


Unique constraints cover term grants, provider payment references, school/event/version/guardian/channel deliveries, webhook events and ledger operation IDs. Store source content references where possible; minimise sensitive payload persistence.
10. Submission, charging and failures
Delivery states: planned, awaiting_credits, reserved, queued, submitting, accepted, sent, delivered, read, failed, unknown, cancelled, expired. Keep financial state separate: unreserved, reserved, consumed, released, reconciliation_required.
Define the billing policy per provider contract. Recommended school policy: reserve at admission; consume on provider-confirmed billable acceptance; release confirmed unbillable rejection. A billable message can fail to reach the handset and still consume a unit. Explain this in the purchase terms. Never charge more than once for a delivery retry. If an explicitly approved resend creates another billable message, show its additional unit requirement.
Timeout after submission means unknown, not confirmed failure. Do not blindly retry non-idempotent provider requests; reconcile by provider ID, webhook or supported lookup. Where reconciliation cannot establish the outcome, escalate for review. Do not claim exactly-once delivery where the provider does not support it.
SMS adapter calculates encoding, multipart segments and provider-specific accounting before reservation. Keep default messages short, avoid emojis and special characters that increase segment counts, and include a short authenticated portal link. Provider segmentation must agree with the estimator; quarantine mismatches for investigation rather than overdrawing school credits. Reject or re-plan content edits that increase units after reservation.
Retry transient confirmed failures with bounded backoff; dead-letter exhausted work. Suppress repeated identical owner warnings. Watch provider outages separately from school credit shortage. Retain blocked receipts/results only for a defined configurable period; revalidate publication, access and expiry before sending. Cancel obsolete assignments and settled fee reminders. Show cancelled/expired counts.
11. School and Super Admin interfaces
School navigation: Communication → Notifications with Overview, Settings, Wallets, Buy Units, Pending Batches, Delivery History, Contacts/Consent and Purchase History.
Overview shows channel balances, expiring gifts, automation states, blocked batches, required shortfalls and delivered/failed/unknown counts. A warning must be specific: “WhatsApp sending paused. This notice needs 120 units; 10 are available. Buy 110 units for ₦1,672, or enable SMS fallback if sufficient SMS credits are available. Email and in-app notifications remain active.”
In fallback mode, show the planned WhatsApp count, SMS recipient count, SMS segments, excluded recipients and both wallet impacts before dispatch. Never label provider-accepted sends as delivered. Teachers can see assignment notification outcomes within their scope but cannot buy units, allocate gifts or send arbitrary school-wide messages without permission.
Super Admin navigation includes Pricing, Providers, Template Status, School Wallets, Free Allocation, Allocation History, Provider Cost Reports, Reconciliation and Suspensions. Separate platform/provider outage, insufficient credits, user-disabled channel and policy suspension. A purchase clears only a credit-related pause when sufficient; it must not override other pause reasons.
12. API outline
Endpoint	Purpose
GET /communications/overview	Balances, statuses and pending requirements
PATCH /communications/settings	Authorised channel/fallback/digest configuration
POST /communications/batches/preview	Server-calculated recipient plan and units
POST /communications/batches/{id}/admit	Revalidate and reserve funded plan
POST /communications/purchases/quote	Server-owned quantity and price quote
POST /communications/purchases	Initiate payment from valid quote
GET /communications/purchases/{id}	Verified status and receipt
GET /communications/deliveries	Tenant-scoped delivery history
POST /super-admin/communications/grants	Audited free channel-unit grant
POST /super-admin/communications/grants/{id}/reverse	Reverse remaining eligible units
POST /super-admin/communications/prices	Future-effective pricing change
POST /webhooks/payments/flutterwave	Authenticated, deduplicated payment handling
POST /webhooks/communications/{provider}	Validated delivery/bounce/opt-out handling


Use idempotency keys for mutations. Do not trust school IDs, quantities already purchased, role names, checkout totals or available balances supplied by clients. Preview results are advisory; admission recalculates under concurrency control.
13. Security, operations and resource control
Reuse server-verified authentication and least-privilege roles. Validate every guardian relationship and tenant query. Validate webhook signatures with current provider documentation. Keep API keys in secrets, redact logs, protect contacts at rest and private documents behind authenticated access. Links do not bypass parent authorisation. Default notification content says information is available; detailed fees or student names require the school's approved disclosure configuration. Avoid result scores in message bodies.
Use provider-approved sender registration and routing suitable for school traffic; verify Nigerian SMS route/network limitations and current quotations before committing production service levels. Never promise that paying for units guarantees handset delivery. Maintain platform funding reserves for purchased but unused credits and estimated free-message liabilities. Provider cost changes do not silently reduce purchased unit counts.
Index scheduler queries by school, next due time, status and expiry. Process bounded pages, use outbox cursors, reuse templates and rate-limit both schools and providers. Apply safe retention policies and aggregate operational reports. No fabricated production data: dashboards read actual balances and delivery events. Use isolated fixtures only for tests.
14. Implementation phases and acceptance criteria
Phase 1: versioned retail prices, three channel modes, credit grants/ledger, term allowance, purchases and Super Admin gifting.
Phase 2: recipient resolution, previews, atomic batch admission, pause warnings, SMS remainder planning and automatic re-evaluation after funding.
Phase 3: WhatsApp/SMS/email adapters, approved templates, consent, outbox/queue, signed webhooks, failure handling and reconciliation.
Phase 4: fee/receipt/result/assignment hooks, 14-day reminder scheduler, assignment digests and parent portal links.
Phase 5: UI, observability, security/concurrency tests, operational billing verification and production rollout.
Required acceptance tests:
- New term grants exactly 10 WhatsApp and 10 SMS units once; switching terms cannot duplicate grants.
- Ten WhatsApp units plus a 100-parent pause-policy batch sends zero WhatsApp messages and shows a 90-unit shortfall.
- A funded 10-WhatsApp/90-SMS remainder plan reaches provider submission through the assigned channel once per recipient; actual delivery remains provider-reported.
- Insufficient SMS segments hold the new fallback plan before any paid send.
- Two concurrent batches cannot overdraw or double-reserve the last credits.
- SMS multipart/Unicode calculations consume the correct segment units.
- Duplicate successful payment webhooks credit only once; wrong amount/currency/reference credits nothing.
- A small top-up or gift does not unpause an underfunded batch; a sufficient one revalidates and resumes eligible work.
- Free email sends without units while WhatsApp/SMS are blocked.
- A future email-price change leaves historical/free-reserved work unchanged and never auto-charges an unauthorised school.
- Fully paid fees, unpublished results, revoked consent and obsolete assignments cancel pending sends.
- Duplicate queue deliveries and webhook events do not cause repeated charges; unknown submissions reconcile without blind resend.
- An SMS shortage does not block independently funded WhatsApp work outside the same whole-plan reservation, free email or in-app.
- Non-Super Admin users cannot allocate gifts or alter prices, and cross-school reads/writes fail.
- Expired free credits cannot fund new sends; purchased credits survive term changes.
Deliver database migrations, typed APIs, Flutter screens, provider adapters, scheduled jobs, payment verification, deployment configuration, acceptance-test evidence and an operations guide. Real provider credentials and approved sender/template configuration are production prerequisites; do not substitute mock integrations in production.