const fs = require('fs');
const path = 'packages/server/server.ts';
let code = fs.readFileSync(path, 'utf8');

const anchor = `app.post('/api/attendance/mark', requireRoles('Teacher', 'Class Teacher', 'HoS'), (req, res) => {`;
const insertBlock = `

// --- STAFF ATTENDANCE ---
app.post('/api/attendance/staff/mark', requireRoles('HoS', 'Admin', 'Super Admin'), (req, res) => {
  const { staff_id, status, date } = req.body;
  if (!staff_id || !status || !date) return res.status(400).json({ error: 'Missing fields' });
  const user = (req as any).user;
  try {
    const stmt = db.prepare(\`
      INSERT INTO staff_attendance (staff_id, status, date, marked_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        status = excluded.status,
        marked_by = excluded.marked_by
    \`);
    stmt.run(staff_id, status, date, user.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/staff', requireRoles('HoS', 'Admin', 'Super Admin'), (req, res) => {
  const { date } = req.query;
  try {
    let records = [];
    if (date) {
      records = db.prepare('SELECT a.*, u.first_name, u.last_name FROM staff_attendance a JOIN users u ON a.staff_id = u.id WHERE a.date = ?').all(date);
    } else {
      records = db.prepare('SELECT a.*, u.first_name, u.last_name FROM staff_attendance a JOIN users u ON a.staff_id = u.id').all();
    }
    const staff = db.prepare('SELECT id, first_name, last_name, role FROM users WHERE role IN ("Teacher", "Class Teacher", "HoS", "Admin", "Super Admin")').all();
    res.json({ records, staff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PARENT ATTENDANCE ---
app.post('/api/attendance/parent/mark', requireRoles('HoS', 'Admin', 'Teacher', 'Class Teacher', 'Super Admin'), (req, res) => {
  const { parent_id, status, date, notes } = req.body;
  if (!parent_id || !status || !date) return res.status(400).json({ error: 'Missing fields' });
  const user = (req as any).user;
  try {
    const stmt = db.prepare(\`
      INSERT INTO parent_attendance (parent_id, status, date, marked_by, notes)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(parent_id, date) DO UPDATE SET
        status = excluded.status,
        marked_by = excluded.marked_by,
        notes = excluded.notes
    \`);
    stmt.run(parent_id, status, date, user.userId, notes || null);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/parent', requireRoles('HoS', 'Admin', 'Teacher', 'Class Teacher', 'Super Admin'), (req, res) => {
  const { date } = req.query;
  try {
    let records = [];
    if (date) {
      records = db.prepare('SELECT a.*, u.first_name, u.last_name FROM parent_attendance a JOIN users u ON a.parent_id = u.id WHERE a.date = ?').all(date);
    } else {
      records = db.prepare('SELECT a.*, u.first_name, u.last_name FROM parent_attendance a JOIN users u ON a.parent_id = u.id').all();
    }
    const parents = db.prepare('SELECT id, first_name, last_name, role FROM users WHERE role = "Parent"').all();
    res.json({ records, parents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
`;

if (code.includes('app.post(\'/api/attendance/staff/mark\'')) {
  console.log('Already patched');
} else {
  code = code.replace(anchor, insertBlock + '\\n' + anchor);
  fs.writeFileSync(path, code);
  console.log('Patched API endpoints for Staff and Parent attendance.');
}
