# Ndovera Monetization And Focus Mode Technical Spec

## Purpose

This spec turns the requested monetization model into a concrete implementation plan for the current Ndovera repo.

The implementation is split into three controlled layers:

- school pricing and billing
- AI credit economy
- passive ad revenue and Focus Mode incentive monitoring

## Compliance Position

To keep the product aligned with the stated AdSense-safe direction:

- no user-facing workflow may tell staff or students to click ads, watch ads, or unlock rewards through ads
- ad impressions may be tracked internally for platform accounting and hidden funding allocation only
- any hidden N0.02 teaching incentive accrual must remain invisible in user-facing interfaces and must not be presented as a user action reward
- user-facing Focus Mode incentives remain productivity-based, using active sessions and teaching activity metrics

This means the backend may record hidden ad-share funding, but user-facing copy and flows must continue to describe Focus Mode incentives as productivity incentives.

## Pricing Model

### School pricing

- Tier 1: 1 to 150 students
- One-time setup: N40,000
- Per student per term: N500
- Annual effective rate: N1,500 per student

- Tier 2: 151 plus students
- One-time setup: N70,000
- Per student per term: N500
- Annual effective rate: N1,500 per student

### AI economy

- 5 free queries every 3 days
- 100 Keyu = 1 AI credit
- Base package: N100 = 5 AI credits
- Bundle package: N500 = 30 AI credits
- Bundle package: N1000 = 70 AI credits

### Passive ad accounting

- successful ad impression system revenue: N0.10
- hidden teaching incentive accrual: N0.02
- hidden teaching incentive is super-admin visible only
- no user-facing mention of ad-linked earnings

### Focus Mode incentive program

- feature label in app: Focus Mode
- base productivity incentive: N2,000 monthly or quarterly, controlled by policy
- quarterly bonus range: N500 to N1,000
- default monthly eligibility threshold: 50 percent of target monthly working hours
- default quarterly eligibility threshold: 30 teaching sessions

## Database Tables

The new backend foundation uses normalized SQL tables instead of document blobs for monetization-critical data.

### 1. monetization_settings

Stores the active platform-wide pricing, AI, ad, and Focus Mode policy configuration.

Columns:

- scope_key
- settings_json
- updated_at
- updated_by

### 2. monetization_user_controls

Allows super-admin to stop hidden ad accrual or Focus Mode payout eligibility per user.

Columns:

- school_id
- user_id
- hidden_ad_incentive_enabled
- focus_mode_payout_enabled
- hold_reason
- updated_at
- updated_by

### 3. school_term_snapshots

Captures student-count snapshots used for tiered school billing.

Columns:

- id
- school_id
- academic_year
- term_key
- student_count
- billing_tier_key
- captured_at
- captured_by

### 4. school_invoices

Master invoice table for setup fees, term billing, AI credit purchases, and future adjustments.

Columns:

- id
- school_id
- invoice_type
- academic_year
- term_key
- status
- currency_code
- subtotal_naira
- total_naira
- paid_naira
- balance_naira
- metadata_json
- created_at
- updated_at
- due_at

### 5. school_invoice_items

Line items for invoices.

Columns:

- id
- invoice_id
- item_type
- label
- quantity
- unit_amount_naira
- total_amount_naira
- metadata_json

### 6. ad_impression_events

Immutable ledger of successful or failed impressions used for monitoring and hidden funding allocation.

Columns:

- id
- school_id
- user_id
- role_name
- focus_session_id
- page_key
- placement_key
- network_name
- impression_status
- system_revenue_naira
- hidden_teacher_incentive_naira
- created_at
- metadata_json

### 7. focus_mode_sessions

Tracks start, stop, active time, and idle time for productivity sessions.

Columns:

- id
- school_id
- user_id
- role_name
- source_page
- started_at
- last_activity_at
- ended_at
- status
- active_seconds
- idle_seconds

### 8. focus_mode_activity_events

Tracks meaningful productivity activity inside Focus Mode.

Columns:

- id
- school_id
- user_id
- session_id
- event_type
- source_page
- lesson_id
- assessment_id
- student_id
- created_at
- metadata_json

### 9. focus_mode_period_summaries

Stores computed monthly or quarterly eligibility results.

Columns:

- id
- school_id
- user_id
- role_name
- period_type
- period_key
- active_seconds
- teaching_sessions_count
- lessons_monitored_count
- assessments_checked_count
- hidden_ad_incentive_naira
- payout_base_naira
- payout_bonus_naira
- payout_total_naira
- eligibility_status
- computed_at
- computed_by
- metadata_json

## API Endpoints

### Main server endpoints

Mounted under /api/finance.

#### GET /api/finance/monetization/focus-mode/status

Returns current user productivity-only Focus Mode status.

Visible fields:

- active session
- month-to-date active seconds
- teaching sessions count
- lessons monitored count
- assessments checked count
- eligibility progress ratio

Does not return any ad-linked hidden accrual values.

#### POST /api/finance/monetization/focus-mode/session/start

Starts a Focus Mode session for staff roles.

Payload:

- sourcePage

#### POST /api/finance/monetization/focus-mode/session/ping

Records meaningful productivity activity.

Payload:

- sessionId
- eventType
- sourcePage
- lessonId
- assessmentId
- studentId
- metadata

#### POST /api/finance/monetization/focus-mode/session/stop

Stops an active Focus Mode session.

Payload:

- sessionId

#### POST /api/finance/monetization/ads/impressions

Internal monitoring endpoint for successful ad impressions.

Payload:

- pageKey
- placementKey
- focusSessionId
- networkName
- successful
- metadata

Response does not expose revenue or hidden incentive values.

### Super-admin endpoints

Mounted under /api/super/monetization.

#### GET /api/super/monetization/settings

Returns the full monetization settings object.

#### PUT /api/super/monetization/settings

Updates pricing, AI economy, ad monitoring policy, and Focus Mode policy.

#### GET /api/super/monetization/overview

Query params:

- periodType = monthly or quarterly
- periodKey
- schoolId optional

Returns:

- system revenue totals
- hidden teacher incentive totals
- successful impression count
- focus eligible staff count
- staff on hold count
- school breakdown
- teacher summary rows

#### POST /api/super/monetization/focus-mode/compute

Triggers eligibility calculation for a period.

Payload:

- periodType
- periodKey optional
- schoolId optional

#### GET /api/super/monetization/focus-mode/eligibility

Lists stored eligibility summaries for a period.

#### GET /api/super/monetization/user-controls

Query params:

- schoolId
- userId

Returns current hidden-accrual and Focus Mode payout control state.

#### PUT /api/super/monetization/user-controls

Allows super-admin to stop or resume hidden accrual and Focus Mode payouts per user.

Payload:

- schoolId
- userId
- hiddenAdIncentiveEnabled
- focusModePayoutEnabled
- holdReason

## What Was Implemented In This Pass

- SQL-backed monetization tables wired to PostgreSQL or SQLite through the existing runtime environment
- main-server Focus Mode session endpoints
- main-server ad impression monitoring endpoint with hidden funding accrual
- super-admin settings, overview, compute, eligibility, and user-control endpoints

## What Still Needs To Be Added Next

- invoice generation from school_term_snapshots into school_invoices and school_invoice_items
- AI wallet ledger and credit consumption enforcement
- school billing payment verification and settlement workflow
- frontend integration for Focus Mode productivity-only status
- frontend super-admin dashboard integration for the new monetization endpoints