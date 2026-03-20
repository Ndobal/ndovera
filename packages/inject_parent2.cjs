const fs = require('fs');
let code = fs.readFileSync('../../packages/server/server.ts', 'utf8');

const api = 
// ==========================================
// PARENTS MANAGEMENT API
// ==========================================
app.get('/api/parents', requireRoles('Super Admin', 'HOS', 'School Admin', 'Owner'), (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const parents = db.prepare(\
      SELECT u.id, u.name, u.email, u.role, u.created_at, u.status,
             COUNT(s.id) as children_count,
             GROUP_CONCAT(u_s.name) as children_names
      FROM users u
      LEFT JOIN students s ON s.parent_id = u.id
      LEFT JOIN users u_s ON s.user_id = u_s.id
      WHERE u.school_id = ? AND u.role = 'Parent'
      GROUP BY u.id
    \).all(schoolId);
    res.json(parents);
  } catch (err: any) {
    res.status(500).json({ error: err.toString() });
  }
});
;

if (!code.includes("app.get('/api/parents'")) {
  code = code.replace('app.get("/api/students"', api + '\napp.get("/api/students"');
  fs.writeFileSync('../../packages/server/server.ts', code);
  console.log('API injected');
} else {
  console.log('API already exists');
}
