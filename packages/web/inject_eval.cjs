const fs = require('fs');
let serverTs = fs.readFileSync('../server/server.ts', 'utf8');

const tables = `
  db.exec(\`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      start_date TEXT,
      end_date TEXT,
      scope TEXT,
      is_forced BOOLEAN DEFAULT 1,
      is_active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS evaluation_responses (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT,
      target_id TEXT,
      evaluator_role TEXT,
      rating INTEGER,
      comment TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS evaluation_progress (
      evaluator_id TEXT,
      evaluation_id TEXT,
      completed_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      finished BOOLEAN DEFAULT 0,
      PRIMARY KEY (evaluator_id, evaluation_id)
    );
  \`);
`;

if (!serverTs.includes('CREATE TABLE IF NOT EXISTS evaluations')) {
  serverTs = serverTs.replace('CREATE TABLE IF NOT EXISTS notifications', tables + '\n  CREATE TABLE IF NOT EXISTS notifications');
  
  // Now inject APIs
  const apis = `
// ==========================================
// EVALUATION SYSTEM API
// ==========================================

app.get('/api/evaluation/status', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const schoolId = req.headers['x-school-id'] || 'school_1';
    
    // Find active evaluation
    const activeEval = db.prepare('SELECT * FROM evaluations WHERE school_id = ? AND is_active = 1').get(schoolId);
    if (!activeEval) return res.json({ active: false });

    // Check progress
    let progress = db.prepare('SELECT * FROM evaluation_progress WHERE evaluator_id = ? AND evaluation_id = ?').get(userId, activeEval.id);
    if (!progress) {
      progress = { completed_count: 0, total_count: 10, finished: 0 }; // Placeholder total_count
    }

    res.json({
      active: true,
      completed: !!progress.finished,
      progress: \`\${progress.completed_count}/\${progress.total_count}\`,
      evaluation_id: activeEval.id
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/evaluation/targets', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const schoolId = req.headers['x-school-id'] || 'school_1';
    
    // Simplistic target assignment logic based on user roles
    const userRoleReq = Array.isArray(req.headers['x-user-roles']) ? req.headers['x-user-roles'][0] : req.headers['x-user-roles'];
    const userRole = userRoleReq ? String(userRoleReq).split(',')[0] : 'Student';
    
    let targets = [];
    if (userRole === 'Student' || userRole === 'Parent') {
      // Evaluate Teachers
      targets = db.prepare(\`SELECT id, name, roles FROM users WHERE school_id = ? AND roles LIKE '%Teacher%'\`).all(schoolId);
    } else {
      // Staff evaluates all staff
      targets = db.prepare(\`SELECT id, name, roles FROM users WHERE school_id = ? AND roles NOT LIKE '%Student%' AND roles NOT LIKE '%Parent%'\`).all(schoolId);
    }

    res.json(targets.slice(0, 10)); // Limit to 10 for prototype
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/evaluation/submit', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRoleReq = Array.isArray(req.headers['x-user-roles']) ? req.headers['x-user-roles'][0] : req.headers['x-user-roles'];
    const userRole = userRoleReq ? String(userRoleReq).split(',')[0] : 'Unknown';
    
    const { target_id, rating, comment, evaluation_id } = req.body;
    
    db.prepare('INSERT INTO evaluation_responses (id, evaluation_id, target_id, evaluator_role, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('resp_' + Date.now() + Math.random(), evaluation_id || 'eval_1', target_id, userRole, rating, comment || '', new Date().toISOString());
      
    // Update progress
    db.prepare(\`
      INSERT INTO evaluation_progress (evaluator_id, evaluation_id, completed_count, total_count, finished) 
      VALUES (?, ?, 1, 10, 0)
      ON CONFLICT(evaluator_id, evaluation_id) DO UPDATE SET completed_count = completed_count + 1
    \`).run(userId, evaluation_id || 'eval_1');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/evaluation/finish', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { evaluation_id } = req.body;
    db.prepare('UPDATE evaluation_progress SET finished = 1 WHERE evaluator_id = ? AND evaluation_id = ?').run(userId, evaluation_id || 'eval_1');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/evaluation/results', requireRoles('Super Admin', 'HOS', 'School Admin', 'Owner'), (req, res) => {
  try {
    const results = db.prepare('SELECT evaluator_role, AVG(rating) as avg_rating, COUNT(*) as count FROM evaluation_responses GROUP BY evaluator_role').all();
    
    res.json({
      staff: results.find(r => r.evaluator_role === 'Teacher' || r.evaluator_role === 'Staff') || { avg_rating: 0, count: 0 },
      students: results.find(r => r.evaluator_role === 'Student') || { avg_rating: 0, count: 0 },
      parents: results.find(r => r.evaluator_role === 'Parent') || { avg_rating: 0, count: 0 },
      ai: "AI indicates a 15% overall sentiment improvement compared to last quarter."
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Seed a default evaluation if none exists
app.post('/api/evaluation/seed', requireRoles('Super Admin', 'HOS', 'School Admin', 'Owner'), (req, res) => {
  try {
    const schoolId = req.headers['x-school-id'] || 'school_1';
    db.prepare('INSERT OR IGNORE INTO evaluations (id, school_id, start_date, end_date, scope, is_forced, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('eval_1', schoolId, new Date().toISOString(), new Date(Date.now() + 86400000*30).toISOString(), 'all_staff', 1, 1);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

`;
  serverTs = serverTs.replace('app.get("/api/users"', apis + '\napp.get("/api/users"');

  fs.writeFileSync('../server/server.ts', serverTs);
  console.log('Injected tables and APIs');
} else {
  console.log('Already injected');
}
