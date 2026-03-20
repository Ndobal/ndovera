const fs = require('fs');
let c = fs.readFileSync('packages/server/server.ts', 'utf8');

c = c.replace(
  'const { userId, classId, parentId } = req.body || {};',
  'const { userId, classId, parentId, secondaryParentId } = req.body || {};'
);

c = c.replace(
  "db.prepare('INSERT INTO students (id, school_id, user_id, class_id, parent_id) VALUES (?, ?, ?, ?, ?)')\n        .run(studentId, schoolId, userId, classId || null, parentId || null);",
  "db.prepare('INSERT INTO students (id, school_id, user_id, class_id, parent_id, secondary_parent_id) VALUES (?, ?, ?, ?, ?, ?)')\n        .run(studentId, schoolId, userId, classId || null, parentId || null, secondaryParentId || null);"
);

c = c.replace(
  "db.prepare(`\n      SELECT s.*, u.name, u.email, c.name as class_name",
  "db.prepare(`\n      SELECT s.*, u.name, u.email, c.name as class_name, p1.name as parent_name, p2.name as secondary_parent_name"
);

// We need to also patch the `SELECT u.id, u.name ... FROM users u LEFT JOIN students s ON s.parent_id = u.id` 
// to `s.parent_id = u.id OR s.secondary_parent_id = u.id`

c = c.replace(
  'LEFT JOIN students s ON s.parent_id = u.id',
  'LEFT JOIN students s ON s.parent_id = u.id OR s.secondary_parent_id = u.id'
);

fs.writeFileSync('packages/server/server.ts', c);
