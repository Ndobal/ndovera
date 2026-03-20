const fs = require('fs');
let content = fs.readFileSync('../server/server.ts', 'utf8');

if (!content.includes('/api/users/:id/status')) {
  const injection = `
app.patch('/api/users/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});
`;
  content = content.replace('app.get("/api/users"', injection + '\napp.get("/api/users"');
  fs.writeFileSync('../server/server.ts', content);
  console.log('Injected status toggle endpoint.');
} else {
  console.log('Already exists');
}