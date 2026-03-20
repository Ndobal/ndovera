`
  -- Schools (Tenants)
  CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#10b981',
    live_class_quota INTEGER DEFAULT 5,
    website_config TEXT, -- JSON string for website builder
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
