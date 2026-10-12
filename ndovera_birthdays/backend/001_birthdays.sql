PRAGMA foreign_keys = ON;
-- Adapt school/user foreign keys to existing Ndovera identifiers before rollout.
CREATE TABLE birthday_settings (
 school_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0,
 students INTEGER NOT NULL DEFAULT 0, staff INTEGER NOT NULL DEFAULT 1,
 wishes INTEGER NOT NULL DEFAULT 1, ai_cards INTEGER NOT NULL DEFAULT 1,
 moderate_student_wishes INTEGER NOT NULL DEFAULT 1,
 timezone TEXT NOT NULL DEFAULT 'Africa/Lagos', announcement_time TEXT NOT NULL DEFAULT '07:00',
 leap_day_policy TEXT NOT NULL DEFAULT 'feb28' CHECK(leap_day_policy IN ('feb28','mar01')),
 version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE birthday_celebrations (
 school_id TEXT NOT NULL, id TEXT NOT NULL, user_id TEXT NOT NULL,
 celebration_year INTEGER NOT NULL, local_date TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','generating','ready','published','paused','failed')),
 card_object_key TEXT, message TEXT, design_family TEXT, visual_fingerprint TEXT,
 consent_version TEXT NOT NULL, published_at TEXT,
 PRIMARY KEY(school_id,id), UNIQUE(school_id,user_id,celebration_year)
);
CREATE INDEX birthday_feed ON birthday_celebrations(school_id,local_date,state);
CREATE TABLE birthday_design_history (
 school_id TEXT NOT NULL, user_id TEXT NOT NULL, celebration_id TEXT NOT NULL,
 celebration_year INTEGER NOT NULL, design_family TEXT NOT NULL,
 visual_fingerprint TEXT NOT NULL, message_hash TEXT NOT NULL,
 PRIMARY KEY(school_id,user_id,celebration_year),
 FOREIGN KEY(school_id,celebration_id) REFERENCES birthday_celebrations(school_id,id)
);
CREATE TABLE birthday_wishes (
 school_id TEXT NOT NULL, id TEXT NOT NULL, celebration_id TEXT NOT NULL,
 sender_id TEXT NOT NULL, request_id TEXT NOT NULL,
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 1000),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL, PRIMARY KEY(school_id,id),
 UNIQUE(school_id,sender_id,request_id),
 FOREIGN KEY(school_id,celebration_id) REFERENCES birthday_celebrations(school_id,id)
);
CREATE INDEX birthday_wish_feed ON birthday_wishes(school_id,celebration_id,state,created_at);
CREATE TABLE birthday_reports (
 school_id TEXT NOT NULL, id TEXT NOT NULL, wish_id TEXT NOT NULL,
 reporter_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(school_id,id), UNIQUE(school_id,wish_id,reporter_id),
 FOREIGN KEY(school_id,wish_id) REFERENCES birthday_wishes(school_id,id)
);
