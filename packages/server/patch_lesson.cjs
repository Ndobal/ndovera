const fs = require('fs');
let code = fs.readFileSync('c:/Users/HP/Desktop/Projects/ndovera/packages/server/server.ts', 'utf8');

const patch = `
// Lesson Notes Deep Management Endpoint Additions
app.patch('/api/lesson-notes/:id/status', requireAuth, requireGlobalPerm('manage_academics'), (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  if (!['Draft', 'Submitted', 'Needs Revision', 'Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    db.prepare('ALTER TABLE lesson_notes ADD COLUMN status TEXT DEFAULT \\'Draft\\'').run();
    db.prepare('ALTER TABLE lesson_notes ADD COLUMN reviewer_remarks TEXT').run();
  } catch(e) {} // Ignore if already exists

  const stmt = db.prepare('UPDATE lesson_notes SET status = ?, reviewer_remarks = ? WHERE id = ? AND school_id = ?');
  const info = stmt.run(status, remarks || null, id, req.user.school_id);
  
  if (info.changes > 0) {
    res.json({ success: true, status, remarks });
  } else {
    res.status(404).json({ error: 'Lesson note not found' });
  }
});
`;

if (!code.includes('/api/lesson-notes/:id/status')) {
  code = code.replace('// --- Lesson Notes ---', '// --- Lesson Notes ---\n' + patch);
  fs.writeFileSync('c:/Users/HP/Desktop/Projects/ndovera/packages/server/server.ts', code);
}
console.log('done lesson note patch.');