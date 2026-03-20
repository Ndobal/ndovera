import express from 'express'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function databaseHasSchoolsTable(candidatePath: string) {
  if (!fs.existsSync(candidatePath)) return false
  try {
    const probe = new Database(candidatePath, { readonly: true })
    const table = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schools'").get() as { name?: string } | undefined
    probe.close()
    return Boolean(table?.name)
  } catch {
    return false
  }
}

function resolveDatabasePath() {
  const workspaceDbPath = path.resolve(__dirname, '..', '..', 'ndovera.db')
  const localDbPath = path.resolve(process.cwd(), 'ndovera.db')
  const envDbPath = process.env.DB_PATH
    ? path.isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : path.resolve(process.cwd(), process.env.DB_PATH)
    : null

  const preferredPaths = [envDbPath, workspaceDbPath, localDbPath].filter((value): value is string => Boolean(value))
  const validPath = preferredPaths.find(databaseHasSchoolsTable)

  if (validPath) return validPath
  return preferredPaths.find((candidatePath) => fs.existsSync(candidatePath)) || workspaceDbPath
}

const app = express()
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-super-user-id, x-super-user-roles, x-super-active-role')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json())

import { attachSuperUserFromHeaders, requireSuperRole } from './rbac'
app.use(attachSuperUserFromHeaders)

// Example protected super-admin route
app.post('/super/events', requireSuperRole('super_admin', 'sub_admin'), (req, res) => {
  const { title, body } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })
  // In real code persist to global_events table
  return res.json({ ok: true, title })
})

const dbPath = resolveDatabasePath()
const db = new Database(dbPath)

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// Create super-admin-specific tables (separate from school tables)
db.exec(`
  CREATE TABLE IF NOT EXISTS super_admins (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT NOT NULL,
    needs_password_change BOOLEAN DEFAULT 1,
    secret_login_path TEXT UNIQUE,
    role TEXT DEFAULT 'super_admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS global_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    permissions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pricing_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    billing_interval TEXT,
    features_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS opportunities_global (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS growth_partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_info TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS school_verifications (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    status TEXT NOT NULL,
    verified_by TEXT,
    verified_at DATETIME,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS super_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// Ensure schema changes are applied even if table existed previously
try {
  db.exec("ALTER TABLE super_admins ADD COLUMN role TEXT DEFAULT 'super_admin';")
} catch (err) {
  // ignore if column already exists or ALTER not supported for other reasons
}

// Ensure new columns exist
try {
  db.exec("ALTER TABLE super_admins ADD COLUMN needs_password_change BOOLEAN DEFAULT 1;");
  db.exec("ALTER TABLE super_admins ADD COLUMN secret_login_path TEXT;");
} catch (err) {}

try {
  db.exec("ALTER TABLE pricing_plans ADD COLUMN features_json TEXT;")
} catch (err) {}

try {
  db.exec('ALTER TABLE schools ADD COLUMN live_class_quota INTEGER DEFAULT 5;')
} catch (err) {}
db.exec('UPDATE schools SET live_class_quota = 5 WHERE live_class_quota IS NULL OR live_class_quota < 1')

// Insert Scholarship and Feature Suggestion tables
db.exec(`
  CREATE TABLE IF NOT EXISTS scholarship_awards (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    category TEXT NOT NULL,
    reward_type TEXT NOT NULL,
    description TEXT,
    published_to_global BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS feature_suggestions (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    user_id TEXT,
    user_type TEXT,
    suggestion TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  
  INSERT OR IGNORE INTO global_settings (key, value) VALUES ('feature_suggestions_enabled', 'false');
`);

import crypto from 'crypto';

// Simple seed for super admin user (if none exists)
function seed() {
  const count = db.prepare('SELECT COUNT(*) as c FROM super_admins').get().c as number
  if (count === 0) {
    const roles = [
      'System Infrastructure Monitor',
      'Database Reliability Engineer',
      'Security & Compliance Auditor',
      'Global Finance Controller',
      'Growth & Partnership Director',
      'Global Support Escalation Lead',
      'School Onboarding Verifier',
      'Public Relations & Event Broadcaster',
      'Platform QA Overseer',
      'Data Privacy Officer',
      'Scholarship Programme Director',
      'Super Admin'
    ];

    const insert = db.prepare('INSERT INTO super_admins (id,email,name,password_hash,role,secret_login_path,needs_password_change) VALUES (?,?,?,?,?,?,1)');
    roles.forEach((r, i) => {
      const secretUrl = 'sa-portal-' + crypto.randomBytes(4).toString('hex');
      insert.run(
        'sa_' + (i+1),
        'admin' + (i+1) + '@ndovera.com',
        r,
        crypto.createHash('sha256').update('tempPass123!').digest('hex'),
        r,
        secretUrl
      );
      console.log(`Created ${r}\n  Email: admin${i+1}@ndovera.com\n  Login URL: /${secretUrl}/login\n`);
    });
  }
}

seed()

const pricingPlanCount = db.prepare('SELECT COUNT(*) as c FROM pricing_plans').get() as { c: number }
if (pricingPlanCount.c === 0) {
  const insertPlan = db.prepare('INSERT INTO pricing_plans (id, name, description, price_cents, billing_interval, features_json) VALUES (?, ?, ?, ?, ?, ?)')
  insertPlan.run('plan_foundation', 'Foundation', 'Starter plan for small schools onboarding onto Ndovera.', 990000, 'monthly', JSON.stringify(['5 live classrooms per school', 'Website builder access', 'Core school operations']))
  insertPlan.run('plan_growth', 'Growth', 'Scaling plan for multi-campus or rapidly growing schools.', 2490000, 'monthly', JSON.stringify(['10 live classrooms per school', 'Priority support', 'Expanded website assets']))
}

app.post('/api/super/auth/login', (req, res) => {
  const { __hiddenPath, email, password } = req.body;
  if (!__hiddenPath || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  
  const admin = db.prepare('SELECT * FROM super_admins WHERE email = ? AND secret_login_path = ?').get(email, __hiddenPath) as any;
  if (!admin) return res.status(401).json({ error: 'Invalid credentials or wrong portal URL' });
  
  const passHash = crypto.createHash('sha256').update(password).digest('hex');
  if (admin.password_hash !== passHash) return res.status(401).json({ error: 'Invalid credentials' });
  
  if (admin.needs_password_change) {
    return res.json({ requirePasswordChange: true, adminId: admin.id });
  }
  
  res.json({ ok: true, adminId: admin.id, role: admin.role, token: 'dummy_token_' + admin.id });
});

app.post('/api/super/auth/change-password', (req, res) => {
  const { adminId, oldPassword, newPassword } = req.body;
  
  // Validate password policy: at least 12 chars, capital, small, number, symbol
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
  if (!strongPasswordRegex.test(newPassword)) {
    return res.status(400).json({ 
      error: 'Password must have at least 12 characters, including Capital, small, number and symbol.' 
    });
  }

  const admin = db.prepare('SELECT * FROM super_admins WHERE id = ?').get(adminId) as any;
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  
  const oldHash = crypto.createHash('sha256').update(oldPassword).digest('hex');
  if (admin.password_hash !== oldHash) return res.status(401).json({ error: 'Invalid old password' });
  
  const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
  db.prepare('UPDATE super_admins SET password_hash = ?, needs_password_change = 0 WHERE id = ?').run(newHash, adminId);
  
  res.json({ ok: true, message: 'Password updated successfully' });
});

app.get('/api/super/schools', requireSuperRole('Super Admin', 'School Onboarding Verifier', 'Growth & Partnership Director', 'Public Relations & Event Broadcaster'), (req, res) => {
  const schools = db.prepare('SELECT id, name, subdomain, logo_url, primary_color, live_class_quota, website_config, created_at FROM schools ORDER BY created_at DESC').all() as any[]
  res.json({
    ok: true,
    schools: schools.map((school) => {
      const website = parseJson<any>(school.website_config, null)
      return {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        logoUrl: school.logo_url,
        primaryColor: school.primary_color,
        liveClassQuota: school.live_class_quota || 5,
        pageCount: Array.isArray(website?.pages) ? website.pages.length : 0,
        website,
        createdAt: school.created_at,
      }
    })
  })
})

app.get('/api/super/schools/:id', requireSuperRole('Super Admin', 'School Onboarding Verifier', 'Growth & Partnership Director', 'Public Relations & Event Broadcaster'), (req, res) => {
  const row = db.prepare('SELECT id, name, subdomain, logo_url, primary_color, live_class_quota, website_config, created_at FROM schools WHERE id = ?').get(req.params.id) as any
  if (!row) return res.status(404).json({ error: 'School not found' })
  res.json({
    ok: true,
    school: {
      id: row.id,
      name: row.name,
      subdomain: row.subdomain,
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      liveClassQuota: row.live_class_quota || 5,
      website: parseJson<any>(row.website_config, null),
      createdAt: row.created_at,
    }
  })
})

app.patch('/api/super/schools/:id/live-settings', requireSuperRole('Super Admin', 'School Onboarding Verifier', 'Growth & Partnership Director'), (req, res) => {
  const liveClassQuota = Number(req.body?.liveClassQuota)
  if (!Number.isInteger(liveClassQuota) || liveClassQuota < 1 || liveClassQuota > 100) {
    return res.status(400).json({ error: 'liveClassQuota must be an integer between 1 and 100' })
  }
  const result = db.prepare('UPDATE schools SET live_class_quota = ? WHERE id = ?').run(liveClassQuota, req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'School not found' })
  res.json({ ok: true, liveClassQuota })
})

app.put('/api/super/schools/:id/website', requireSuperRole('Super Admin', 'Public Relations & Event Broadcaster', 'Growth & Partnership Director'), (req, res) => {
  const { website, primaryColor, logoUrl } = req.body || {}
  if (!website || typeof website !== 'object') return res.status(400).json({ error: 'website object required' })
  const payload = JSON.stringify(website)
  const result = db.prepare('UPDATE schools SET website_config = ?, primary_color = COALESCE(?, primary_color), logo_url = COALESCE(?, logo_url) WHERE id = ?').run(payload, primaryColor || null, logoUrl || null, req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'School not found' })
  res.json({ ok: true })
})

app.get('/api/super/pricing-plans', requireSuperRole('Super Admin', 'Global Finance Controller'), (req, res) => {
  const plans = db.prepare('SELECT * FROM pricing_plans ORDER BY created_at DESC').all() as any[]
  res.json({
    ok: true,
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceCents: plan.price_cents,
      billingInterval: plan.billing_interval,
      features: parseJson<string[]>(plan.features_json, []),
      createdAt: plan.created_at,
    }))
  })
})

app.post('/api/super/pricing-plans', requireSuperRole('Super Admin', 'Global Finance Controller'), (req, res) => {
  const { name, description, priceCents, billingInterval, features } = req.body || {}
  const numericPrice = Number(priceCents)
  if (!name || !Number.isFinite(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ error: 'name and valid priceCents are required' })
  }
  const id = crypto.randomUUID()
  db.prepare('INSERT INTO pricing_plans (id, name, description, price_cents, billing_interval, features_json) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, String(name), description || '', Math.round(numericPrice), billingInterval || 'monthly', JSON.stringify(Array.isArray(features) ? features : []))
  res.json({ ok: true, id })
})

app.patch('/api/super/pricing-plans/:id', requireSuperRole('Super Admin', 'Global Finance Controller'), (req, res) => {
  const existing = db.prepare('SELECT id FROM pricing_plans WHERE id = ?').get(req.params.id) as { id?: string } | undefined
  if (!existing) return res.status(404).json({ error: 'Pricing plan not found' })
  const { name, description, priceCents, billingInterval, features } = req.body || {}
  db.prepare('UPDATE pricing_plans SET name = COALESCE(?, name), description = COALESCE(?, description), price_cents = COALESCE(?, price_cents), billing_interval = COALESCE(?, billing_interval), features_json = COALESCE(?, features_json) WHERE id = ?')
    .run(name || null, description || null, Number.isFinite(Number(priceCents)) ? Math.round(Number(priceCents)) : null, billingInterval || null, Array.isArray(features) ? JSON.stringify(features) : null, req.params.id)
  res.json({ ok: true })
})

app.get('/health', (req, res) => res.json({ok:true, db: dbPath}))

// Feature suggestions
app.post('/api/super/settings/feature-suggestions', requireSuperRole('Super Admin', 'Platform QA Overseer'), (req, res) => {
   const { enabled } = req.body;
   db.prepare('INSERT INTO global_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').run('feature_suggestions_enabled', enabled ? 'true' : 'false', enabled ? 'true' : 'false');
   res.json({ ok: true, enabled });
});

app.get('/api/super/settings/feature-suggestions', (req, res) => {
   const row = db.prepare('SELECT value FROM global_settings WHERE key = ?').get('feature_suggestions_enabled') as any;
   res.json({ ok: true, enabled: row ? row.value === 'true' : false });
});

app.post('/api/public/feature-suggestions', (req, res) => {
   const row = db.prepare('SELECT value FROM global_settings WHERE key = ?').get('feature_suggestions_enabled') as any;
   if (!row || row.value !== 'true') return res.status(403).json({ error: 'Feature suggestions are currently disabled.' });
   
   const { school_id, user_id, user_type, suggestion } = req.body;
   db.prepare('INSERT INTO feature_suggestions (id, school_id, user_id, user_type, suggestion) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), school_id, user_id, user_type, suggestion);
   res.json({ ok: true });
});

// Scholarship logic
app.get('/api/super/scholarships/candidates', requireSuperRole('Super Admin', 'Scholarship Programme Director'), (req, res) => {
  // Mock AI check logic that checks class, question_difficulty, and class average for all tenants
  const candidates = {
    primary: [
      { student_id: 'stu_p1', school_id: 'sch_1', name: 'Aliko Dangote', rank: 1, type: 'primary', average: 98.4 },
      { student_id: 'stu_p2', school_id: 'sch_1', name: 'Ngozi Okonjo-Iweala', rank: 2, type: 'primary', average: 97.1 },
      { student_id: 'stu_p3', school_id: 'sch_2', name: 'Wole Soyinka', rank: 3, type: 'primary', average: 96.8 }
    ],
    jss: [
      { student_id: 'stu_j1', school_id: 'sch_3', name: 'Chinua Achebe', rank: 1, type: 'jss', average: 94.2 },
      { student_id: 'stu_j2', school_id: 'sch_1', name: 'Funmilayo Ransome-Kuti', rank: 2, type: 'jss', average: 93.9 },
      { student_id: 'stu_j3', school_id: 'sch_2', name: 'Fela Kuti', rank: 3, type: 'jss', average: 91.5 }
    ],
    sss: [
      { student_id: 'stu_s1', school_id: 'sch_1', name: 'John Boyega', rank: 1, type: 'sss', average: 99.1 },
      { student_id: 'stu_s2', school_id: 'sch_2', name: 'Burna Boy', rank: 2, type: 'sss', average: 96.4 },
      { student_id: 'stu_s3', school_id: 'sch_3', name: 'King Sunny Ade', rank: 3, type: 'sss', average: 95.2 }
    ],
    most_active: [
      { student_id: 'stu_a1', school_id: 'sch_1', name: 'Davido', score: 1540 },
      { student_id: 'stu_a2', school_id: 'sch_2', name: 'Wizkid', score: 1420 },
      { student_id: 'stu_a3', school_id: 'sch_3', name: 'Tiwa Savage', score: 1390 }
    ]
  };
  res.json({ ok: true, candidates });
});

app.post('/api/super/scholarships/award', requireSuperRole('Super Admin', 'Scholarship Programme Director'), (req, res) => {
  const { student_id, school_id, category, reward_type, description, picture_url } = req.body;
  if (!['physical_visit', 'aura', 'cash'].includes(reward_type)) {
     return res.status(400).json({ error: 'Invalid reward type' });
  }
  
  db.prepare('INSERT INTO scholarship_awards (id, student_id, school_id, category, reward_type, description, published_to_global) VALUES (?, ?, ?, ?, ?, ?, 1)').run(crypto.randomUUID(), student_id, school_id, category, reward_type, description);
  
  // also push event globally, with picture
  const eventId = crypto.randomUUID();
  const eventBody = `A student from school \${school_id} was awarded \${reward_type} in category \${category}!\n\n` + (picture_url ? `![Award](\${picture_url})` : '');
  db.prepare('INSERT INTO global_events (id, title, body, created_by) VALUES (?, ?, ?, ?)').run(eventId, 'Ndovera Scholarship Awarded!', eventBody, 'Scholarship Programme Director');
  
  res.json({ ok: true, eventId });
});

const port = process.env.SUPER_ADMIN_PORT ? Number(process.env.SUPER_ADMIN_PORT) : 5001
app.listen(port, () => {
  console.log(`Super-admin server running on http://localhost:${port}`)
})
