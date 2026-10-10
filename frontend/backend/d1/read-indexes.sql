-- Indexes for the queries that read the most rows (D1 insights, 10 Oct 2026).
-- Without them each school's fee and chat look-ups scanned every school's rows,
-- which pushed the database past the daily rows-read limit.
-- The Worker also creates these from its minute cron (ensureReadIndexes in src/index.ts).
--   npx wrangler d1 execute ndovera-db --remote --file d1/read-indexes.sql
CREATE INDEX IF NOT EXISTS idx_fees_config_tenant ON fees_config(tenant_id, session, term);
CREATE INDEX IF NOT EXISTS idx_fees_ledger_tenant_student ON fees_ledger(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_fees_receipts_tenant_student ON fees_payment_receipts(tenant_id, student_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_conversation_reads_user ON conversation_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_school_sessions_tenant_created ON school_sessions(tenantId, createdAt);
CREATE INDEX IF NOT EXISTS idx_settings_lower_key ON settings(lower(studentId));
