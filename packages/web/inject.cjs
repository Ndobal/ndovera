const fs = require('fs');
let content = fs.readFileSync('../server/server.ts', 'utf8');

const injection = `
app.post('/api/users', requireRoles('Super Admin', 'HOS', 'School Admin', 'Owner'), (req, res) => {
  try {
    const { id, name, email, roles, password, class: className, contact_info } = req.body;
    if (!name || !roles) return res.status(400).json({ error: 'Name and roles required' });
    
    const newId = id || ('usr_' + Date.now());
    const schoolId = req.headers['x-school-id'] || 'school_1';

    db.prepare('INSERT INTO users (id, school_id, name, email, roles, password, class, contact_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
       .run(newId, schoolId, name, email || '', JSON.stringify(roles), password || 'password123', className || null, JSON.stringify(contact_info || {}));
    
    res.json({ id: newId, name, roles });
  } catch (err) {
    console.error('Add user error', err);
    res.status(500).json({ error: String(err) });
  }
});
`;

if (!content.includes("app.post('/api/users'")) {
  content = content.replace('app.get("/api/users",', injection + '\napp.get("/api/users",');
  fs.writeFileSync('../server/server.ts', content);
  console.log('Injected POST /api/users');
} else {
  console.log('POST /api/users already exists');
}
