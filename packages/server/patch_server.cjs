const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const patch = `
// Add user status endpoint
app.patch('/api/users/:id/status', requireAuth, requireGlobalPerm('manage_users'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['active', 'locked', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Ensure DB has a status column if it doesn't already
  try {
    db.prepare('ALTER TABLE users ADD COLUMN status TEXT DEFAULT \\'active\\'').run();
  } catch(e) {} // Ignore if already exists

  const stmt = db.prepare('UPDATE users SET status = ? WHERE id = ? AND school_id = ?');
  const info = stmt.run(status, id, req.user.school_id);
  
  if (info.changes > 0) {
    res.json({ success: true, status });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});
`;

if (!code.includes('/api/users/:id/status')) {
  code = code.replace('// --- Users & Students ---', '// --- Users & Students ---\n' + patch);
  fs.writeFileSync('server.ts', code);
}
console.log('done.');