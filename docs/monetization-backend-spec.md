# NDOVERA Monetization Backend Spec

## Purpose

This document is the repo-specific backend specification for pricing, invoicing, AI credits, and compliant ad tracking.

Implementation status as of 2026-03-23:

- Billing foundations are now implemented in `packages/server/src/modules/finance/billing.store.ts` and `billing.routes.ts`.
- AI credit foundations are now implemented in `packages/server/src/modules/finance/credits.store.ts` and `credits.routes.ts`.
- Ad compliance foundations are now implemented in `packages/server/src/modules/finance/adCompliance.store.ts` and `adCompliance.routes.ts`.
- Super-admin route exposure for those foundations is now mounted from `packages/super-admin-server/server.ts`.

It is grounded in the current implementation, not a greenfield design:

- Active school-facing backend: `packages/server`
- Active super-admin backend: `packages/super-admin-server`
- Target long-term backend home: `services/api/src/modules`

The goal is to make the existing monetization foundation explicit, identify what is already live, and define the minimum backend work needed to complete the monetization stack without drifting away from the current repo structure.

## Repo Placement

### Current source of truth

- School API routing lives in `packages/server/server.ts`.
- School finance routing lives in `packages/server/src/modules/finance/finance.routes.ts`.
- Monetization schema and business logic live in `packages/server/src/modules/finance/monetization.store.ts`.
- School-facing monetization routes live in `packages/server/src/modules/finance/monetization.routes.ts`.
- Super-admin monetization routes live in `packages/super-admin-server/src/monetization.routes.ts`.
- Super-admin monetization base mount is `/api/super/monetization` in `packages/super-admin-server/server.ts`.

### Target module ownership in `services/api`

When the legacy backend is migrated into the unified architecture, ownership should split like this:

- `finance-billing`: pricing rules, invoices, invoice items, payments, billing snapshots
- `rewards-auras`: AI credit wallets, ledgers, package purchases, consumption events
- `ads`: impression tracking, consent, attribution, compliance audit data
- `ai-tutor`: AI usage metering and credit consumption hooks
- `schools-tenancy`: tenant-scoped pricing assignment and school billing lifecycle

The current repo already has empty target folders for these modules under `services/api/src/modules`, so this spec aligns to the intended architecture instead of inventing a new package layout.

## Current Runtime Storage Model

### Storage backend

The active monetization implementation uses the runtime SQL abstraction in `packages/server/src/common/runtimeSqlStore.ts`.

- SQLite is used when `DATABASE_URL` and `POSTGRES_URL` are absent.
- PostgreSQL is used when either variable is present.
- The same SQL DDL is executed against either backend.

This means all monetization tables below are part of the runtime app database, not the document store.

### Existing monetization tables

The following tables are created by `ensureSqlSchema('monetization-foundations-v1', ...)` in `packages/server/src/modules/finance/monetization.store.ts`.

#### `monetization_settings`

Purpose: global pricing, AI economy, ad revenue, and focus mode configuration.

| Column | Type | Notes |
| --- | --- | --- |
| `scope_key` | TEXT PK | Currently only `global` is used |
| `settings_json` | TEXT NOT NULL | Serialized `MonetizationSettings` |
| `updated_at` | TEXT NOT NULL | ISO timestamp |
| `updated_by` | TEXT | Super-admin user id |

#### `monetization_user_controls`

Purpose: per-user monetization eligibility overrides.

| Column | Type | Notes |
| --- | --- | --- |
| `school_id` | TEXT NOT NULL | Tenant scope |
| `user_id` | TEXT NOT NULL | User scope |
| `hidden_ad_incentive_enabled` | BOOLEAN NOT NULL DEFAULT TRUE | Enables hidden ad incentive accrual |
| `focus_mode_payout_enabled` | BOOLEAN NOT NULL DEFAULT TRUE | Enables focus-mode payouts |
| `hold_reason` | TEXT | Compliance or admin hold reason |
| `updated_at` | TEXT NOT NULL | ISO timestamp |
| `updated_by` | TEXT | Super-admin id |

Primary key: `school_id, user_id`

#### `school_term_snapshots`

Purpose: billing snapshot of student counts per school per term.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | Snapshot id |
| `school_id` | TEXT NOT NULL | Tenant scope |
| `academic_year` | TEXT NOT NULL | Example `2025/2026` |
| `term_key` | TEXT NOT NULL | Example `term-1` |
| `student_count` | INTEGER NOT NULL | Count used for billing |
| `billing_tier_key` | TEXT NOT NULL | Matches `schoolPricing.tiers[].key` |
| `captured_at` | TEXT NOT NULL | ISO timestamp |
| `captured_by` | TEXT | Actor id |

#### `school_invoices`

Purpose: invoice header records.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | Invoice id |
| `school_id` | TEXT NOT NULL | Tenant scope |
| `invoice_type` | TEXT NOT NULL | Setup, term billing, credits, adjustment |
| `academic_year` | TEXT | Optional |
| `term_key` | TEXT | Optional |
| `status` | TEXT NOT NULL | Draft, issued, paid, overdue, void |
| `currency_code` | TEXT NOT NULL | Currently NGN by default |
| `subtotal_naira` | REAL NOT NULL DEFAULT 0 | Before adjustments |
| `total_naira` | REAL NOT NULL DEFAULT 0 | Invoice total |
| `paid_naira` | REAL NOT NULL DEFAULT 0 | Applied payments |
| `balance_naira` | REAL NOT NULL DEFAULT 0 | Remaining amount |
| `metadata_json` | TEXT | Freeform metadata |
| `created_at` | TEXT NOT NULL | ISO timestamp |
| `updated_at` | TEXT NOT NULL | ISO timestamp |
| `due_at` | TEXT | ISO timestamp |

#### `school_invoice_items`

Purpose: invoice line items.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | Item id |
| `invoice_id` | TEXT NOT NULL | Parent invoice |
| `item_type` | TEXT NOT NULL | Setup fee, per-student fee, credit pack, adjustment |
| `label` | TEXT NOT NULL | User-facing line label |
| `quantity` | REAL NOT NULL DEFAULT 1 | Decimal allowed |
| `unit_amount_naira` | REAL NOT NULL DEFAULT 0 | Unit amount |
| `total_amount_naira` | REAL NOT NULL DEFAULT 0 | Extended total |
| `metadata_json` | TEXT | Freeform metadata |

#### `ad_impression_events`

Purpose: ad-impression revenue monitoring and hidden teacher incentive accrual.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | Impression event id |
| `school_id` | TEXT NOT NULL | Tenant scope |
| `user_id` | TEXT NOT NULL | Actor |
| `role_name` | TEXT NOT NULL | Role used for eligibility |
| `focus_session_id` | TEXT | Optional focus-mode session linkage |
| `page_key` | TEXT NOT NULL | App page identifier |
| `placement_key` | TEXT NOT NULL | Placement slot identifier |
| `network_name` | TEXT NOT NULL | Defaults to `adsense` |
| `impression_status` | TEXT NOT NULL | `successful` or `failed` |
| `system_revenue_naira` | REAL NOT NULL DEFAULT 0 | Accrued platform revenue |
| `hidden_teacher_incentive_naira` | REAL NOT NULL DEFAULT 0 | Teacher incentive amount |
| `created_at` | TEXT NOT NULL | ISO timestamp |
| `metadata_json` | TEXT | Extra payload |

#### `focus_mode_sessions`

Purpose: track teacher/staff productivity sessions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | Session id |
| `school_id` | TEXT NOT NULL | Tenant scope |
| `user_id` | TEXT NOT NULL | Actor |
| `role_name` | TEXT NOT NULL | Eligibility role |
| `source_page` | TEXT NOT NULL | Start origin |
| `started_at` | TEXT NOT NULL | ISO timestamp |
| `last_activity_at` | TEXT NOT NULL | ISO timestamp |
| `ended_at` | TEXT | Nullable until stop |
| `status` | TEXT NOT NULL | `active` or `ended` |
| `active_seconds` | INTEGER NOT NULL DEFAULT 0 | Billable active time |
| `idle_seconds` | INTEGER NOT NULL DEFAULT 0 | Idle time |

#### `focus_mode_activity_events`

Purpose: granular activity telemetry attached to focus-mode sessions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | Activity event id |
| `school_id` | TEXT NOT NULL | Tenant scope |
| `user_id` | TEXT NOT NULL | Actor |
| `session_id` | TEXT NOT NULL | Parent focus session |
| `event_type` | TEXT NOT NULL | `heartbeat`, `lesson_monitor`, `assessment_review`, etc. |
| `source_page` | TEXT | Optional |
| `lesson_id` | TEXT | Optional |
| `assessment_id` | TEXT | Optional |
| `student_id` | TEXT | Optional |
| `created_at` | TEXT NOT NULL | ISO timestamp |
| `metadata_json` | TEXT | Extra payload |

#### `focus_mode_period_summaries`

Purpose: computed monthly or quarterly monetization eligibility snapshots.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | Summary id |
| `school_id` | TEXT NOT NULL | Tenant scope |
| `user_id` | TEXT NOT NULL | Actor |
| `role_name` | TEXT NOT NULL | Eligibility role |
| `period_type` | TEXT NOT NULL | `monthly` or `quarterly` |
| `period_key` | TEXT NOT NULL | Example `2026-03` or `2026-Q1` |
| `active_seconds` | INTEGER NOT NULL DEFAULT 0 | Aggregated active time |
| `teaching_sessions_count` | INTEGER NOT NULL DEFAULT 0 | Count of sessions |
| `lessons_monitored_count` | INTEGER NOT NULL DEFAULT 0 | Count of lesson events |
| `assessments_checked_count` | INTEGER NOT NULL DEFAULT 0 | Count of assessment events |
| `hidden_ad_incentive_naira` | REAL NOT NULL DEFAULT 0 | Aggregated incentive |
| `payout_base_naira` | REAL NOT NULL DEFAULT 0 | Base payout |
| `payout_bonus_naira` | REAL NOT NULL DEFAULT 0 | Bonus payout |
| `payout_total_naira` | REAL NOT NULL DEFAULT 0 | Total payout |
| `eligibility_status` | TEXT NOT NULL | `eligible`, `held`, `not-eligible` |
| `computed_at` | TEXT NOT NULL | ISO timestamp |
| `computed_by` | TEXT | Super-admin id |
| `metadata_json` | TEXT | Computation metadata |

Unique key: `school_id, user_id, period_type, period_key`

## Existing Live API Endpoints

### School-facing monetization API

Base path: `/api/finance/monetization`

Mounted in `packages/server/src/modules/finance/finance.routes.ts`.

#### `GET /api/finance/monetization/pricing`

Returns school pricing settings plus AI credit package pricing.

#### `GET /api/finance/monetization/invoices`

Lists invoices for the authenticated user's school.

#### `GET /api/finance/monetization/invoices/:invoiceId`

Returns invoice header, line items, and recorded payments for a school-scoped invoice.

#### `POST /api/finance/monetization/invoices/:invoiceId/payments/proof`

Creates a pending payment record backed by a manually uploaded or externally hosted payment proof URL.

#### `GET /api/finance/monetization/ai-credits/balance`

Returns both the school AI-credit wallet and the current user's wallet.

#### `GET /api/finance/monetization/ai-credits/ledger`

Returns AI-credit ledger entries for the authenticated school scope, optionally filtered by `ownerType`.

#### `POST /api/finance/monetization/ai-credits/purchase-intents`

Creates an AI-credit purchase order plus backing invoice.

#### `POST /api/finance/monetization/ai-credits/consume`

Debits AI credits from the requested wallet owner scope.

#### `POST /api/finance/monetization/ads/consent`

Creates an ad-consent audit record for the authenticated user.

#### `GET /api/finance/monetization/ads/consent`

Lists ad-consent audit records for the authenticated user.

#### `GET /api/finance/monetization/focus-mode/status`

Returns the current user focus-mode status and month-to-date progress.

Auth:

- Requires authenticated user

#### `POST /api/finance/monetization/focus-mode/session/start`

Starts focus mode for teaching/staff roles.

Request body:

```json
{
  "sourcePage": "dashboard"
}
```

Auth:

- Requires one of: `Teacher`, `Staff`, `Educator`, `HoS`, `School Admin`, `Principal`, `Head Teacher`, `Nursery Head`

#### `POST /api/finance/monetization/focus-mode/session/ping`

Records focus-mode activity and updates active or idle time.

Request body:

```json
{
  "sessionId": "focus_xxx",
  "eventType": "heartbeat",
  "sourcePage": "lesson-board",
  "lessonId": "lesson_123",
  "assessmentId": "assessment_123",
  "studentId": "student_123",
  "metadata": {}
}
```

#### `POST /api/finance/monetization/focus-mode/session/stop`

Stops the active focus-mode session.

Request body:

```json
{
  "sessionId": "focus_xxx"
}
```

#### `POST /api/finance/monetization/ads/impressions`

Records ad impression telemetry and, when eligible, accrues hidden teacher incentive plus platform ad revenue.

Request body:

```json
{
  "pageKey": "dashboard",
  "placementKey": "right-rail-1",
  "focusSessionId": "focus_xxx",
  "networkName": "adsense",
  "providerImpressionId": "network_evt_123",
  "requestFingerprint": "sha256:abc123",
  "consentRecordId": "consent_xxx",
  "retentionUntil": "2026-12-31T00:00:00.000Z",
  "successful": true,
  "metadata": {}
}
```

Response body:

```json
{
  "ok": true,
  "impressionId": "impression_xxx",
  "receiptId": "receipt_xxx"
}
```

### Super-admin monetization API

Base path: `/api/super/monetization`

Mounted in `packages/super-admin-server/server.ts`.

#### `GET /api/super/monetization/settings`

Returns the global monetization settings object.

#### `POST /api/super/monetization/school-term-snapshots`

Creates a billing snapshot for a school, academic year, and term.

#### `POST /api/super/monetization/invoices/generate`

Generates a term invoice from school size and pricing-tier rules.

#### `GET /api/super/monetization/invoices`

Lists invoices, optionally filtered by `schoolId` and `status`.

#### `GET /api/super/monetization/invoices/:invoiceId`

Returns a full invoice with items and payments.

#### `POST /api/super/monetization/invoices/:invoiceId/issue`

Marks an invoice as issued and optionally overrides `dueAt`.

#### `POST /api/super/monetization/invoices/:invoiceId/record-payment`

Creates or reuses an invoice payment and recomputes invoice balances.

#### `POST /api/super/monetization/payments/webhooks/:providerName`

Stores a billing provider event and, when applicable, applies a received payment to the referenced invoice.

#### `PUT /api/super/monetization/settings`

Updates pricing, AI economy, ad revenue, and focus mode settings.

#### `GET /api/super/monetization/overview`

Returns aggregated overview data for a monthly or quarterly period.

Query params:

- `periodType=monthly|quarterly`
- `periodKey=<optional>`
- `schoolId=<optional>`

#### `POST /api/super/monetization/focus-mode/compute`

Computes and upserts focus mode eligibility summaries.

Request body:

```json
{
  "periodType": "monthly",
  "periodKey": "2026-03",
  "schoolId": "school-1"
}
```

#### `GET /api/super/monetization/focus-mode/eligibility`

Lists computed eligibility summaries.

#### `GET /api/super/monetization/user-controls`

Query params:

- `schoolId=<required>`
- `userId=<required>`

#### `PUT /api/super/monetization/user-controls`

Upserts per-user payout and incentive controls.

#### `POST /api/super/monetization/ai-credits/adjust`

Creates a manual AI-credit adjustment against a school or user wallet.

#### `GET /api/super/monetization/ai-credits/ledger`

Lists AI-credit ledger entries for a school, optionally filtered by owner.

#### `POST /api/super/monetization/ai-credits/fulfill-purchase/:purchaseId`

Credits a fulfilled AI-credit purchase order and records its invoice payment.

#### `GET /api/super/monetization/ads/events`

Lists ad impression events together with stored compliance receipt data.

#### `GET /api/super/monetization/ads/consent-audit`

Lists ad-consent audit records by school or user.

#### `POST /api/super/monetization/ads/reprocess`

Creates compliance receipts for previously recorded impression events.

## Current Gaps

Billing is live, but provider-specific webhook verification, scheduled invoice generation, refund handling, and stronger duplicate-invoice safeguards still need follow-up work.

AI credits are now wallet-backed and ledger-first, but the remaining work is direct integration from AI feature handlers, provider-driven purchase fulfilment, and reservation or release flows for long-running AI jobs. The historical `packages/server/patch_auras.cjs` script remains legacy and should stay out of the active routed backend.

Ad compliance data is now persisted, but provider-side callback reconciliation, consent-expiry and retention cleanup jobs, and deletion or anonymisation workflows are still missing.

## Implemented Foundation Additions

The active backend now also persists the following exact tables:

- `invoice_payments`: `id`, `invoice_id`, `school_id`, `provider_name`, `provider_reference`, `status`, `amount_naira`, `received_at`, `metadata_json`, `created_at`, `updated_at`. Unique index: `provider_name, provider_reference`.
- `billing_provider_events`: `id`, `provider_name`, `provider_event_id`, `event_type`, `event_status`, `payload_json`, `processed_at`, `created_at`. Unique index: `provider_name, provider_event_id`.
- `ai_credit_wallets`: `id`, `owner_type`, `owner_id`, `school_id`, `balance_credits`, `reserved_credits`, `updated_at`. Unique index: `owner_type, owner_id`.
- `ai_credit_ledger`: `id`, `wallet_id`, `school_id`, `user_id`, `direction`, `entry_type`, `credits_delta`, `balance_after`, `reference_type`, `reference_id`, `metadata_json`, `created_at`, `created_by`.
- `ai_credit_purchase_orders`: `id`, `school_id`, `wallet_id`, `package_id`, `invoice_id`, `payment_id`, `credits_purchased`, `naira_amount`, `status`, `created_at`, `fulfilled_at`.
- `ad_consent_records`: `id`, `school_id`, `user_id`, `consent_scope`, `consent_status`, `policy_version`, `lawful_basis`, `recorded_at`, `expires_at`, `metadata_json`.
- `ad_event_receipts`: `id`, `impression_event_id`, `provider_name`, `provider_impression_id`, `request_fingerprint`, `consent_record_id`, `retention_until`, `created_at`. Unique index: `provider_name, request_fingerprint`.

Primary implementation files:

- `packages/server/src/modules/finance/billing.store.ts`
- `packages/server/src/modules/finance/credits.store.ts`
- `packages/server/src/modules/finance/adCompliance.store.ts`

## Implemented API Extensions

The active backend now also exposes these exact routes:

- School pricing and invoices: `GET /api/finance/monetization/pricing`, `GET /api/finance/monetization/invoices`, `GET /api/finance/monetization/invoices/:invoiceId`, `POST /api/finance/monetization/invoices/:invoiceId/payments/proof`
- School AI credits: `GET /api/finance/monetization/ai-credits/balance`, `GET /api/finance/monetization/ai-credits/ledger`, `POST /api/finance/monetization/ai-credits/purchase-intents`, `POST /api/finance/monetization/ai-credits/consume`
- School ad compliance: `POST /api/finance/monetization/ads/consent`, `GET /api/finance/monetization/ads/consent`, `POST /api/finance/monetization/ads/impressions`
- Super-admin billing: `POST /api/super/monetization/school-term-snapshots`, `POST /api/super/monetization/invoices/generate`, `GET /api/super/monetization/invoices`, `GET /api/super/monetization/invoices/:invoiceId`, `POST /api/super/monetization/invoices/:invoiceId/issue`, `POST /api/super/monetization/invoices/:invoiceId/record-payment`, `POST /api/super/monetization/payments/webhooks/:providerName`
- Super-admin AI credits: `POST /api/super/monetization/ai-credits/adjust`, `GET /api/super/monetization/ai-credits/ledger`, `POST /api/super/monetization/ai-credits/fulfill-purchase/:purchaseId`
- Super-admin ad compliance: `GET /api/super/monetization/ads/events`, `GET /api/super/monetization/ads/consent-audit`, `POST /api/super/monetization/ads/reprocess`

## Implementation and Migration Rules

Keep the existing SQL runtime abstraction and tenant scoping model. Treat AI credits as ledger-first, payments as idempotent, and ad tracking as consent-aware. Keep the public route contract under `/api/finance/monetization` and `/api/super/monetization` stable while adding provider-specific webhook verification and automated jobs, then move the implementation into `services/api/src/modules/finance-billing`, `rewards-auras`, `ads`, `ai-tutor`, and `schools-tenancy` only after the live contract is stable.