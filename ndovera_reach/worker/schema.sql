PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  organisation TEXT,
  phone_e164 TEXT,
  email TEXT,
  country TEXT,
  state TEXT,
  source TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  whatsapp_consent_status TEXT NOT NULL DEFAULT 'unknown' CHECK (whatsapp_consent_status IN ('unknown','opted_in','opted_out')),
  whatsapp_consent_at TEXT,
  whatsapp_consent_source TEXT,
  email_consent_status TEXT NOT NULL DEFAULT 'unknown' CHECK (email_consent_status IN ('unknown','opted_in','opted_out')),
  email_consent_at TEXT,
  email_consent_source TEXT,
  suppressed_at TEXT,
  suppression_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_phone_unique ON contacts(phone_e164) WHERE phone_e164 IS NOT NULL AND phone_e164 <> '';
CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_unique ON contacts(lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS contacts_org_idx ON contacts(organisation);
CREATE INDEX IF NOT EXISTS contacts_state_idx ON contacts(state);
CREATE INDEX IF NOT EXISTS contacts_whatsapp_consent_idx ON contacts(whatsapp_consent_status);
CREATE INDEX IF NOT EXISTS contacts_email_consent_idx ON contacts(email_consent_status);

CREATE TABLE IF NOT EXISTS audiences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  filter_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','queued','sending','paused','completed','cancelled','failed')),
  audience_id TEXT REFERENCES audiences(id),
  template_name TEXT,
  subject TEXT,
  content_json TEXT NOT NULL DEFAULT '{}',
  scheduled_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_jobs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','accepted','delivered','read','failed','cancelled','suppressed')),
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  destination_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel, destination_hash)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
