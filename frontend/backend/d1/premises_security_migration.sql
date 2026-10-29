-- Apply to test D1 before deploying security routes.
CREATE TABLE IF NOT EXISTS premises_security_records (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('incident','visitor','patrol','handover','gate','hazard')),
 title TEXT NOT NULL,
 location TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '',
 severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','investigating','resolved')),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 checked_out_at TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_premises_security_tenant_date ON premises_security_records(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS premises_security_events (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 record_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 action TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(record_id) REFERENCES premises_security_records(id)
);
CREATE INDEX IF NOT EXISTS idx_premises_security_events_tenant ON premises_security_events(tenant_id, record_id, created_at DESC);
