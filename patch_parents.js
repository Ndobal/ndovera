const fs = require('fs');

let content = fs.readFileSync('packages/server/server.ts', 'utf8');

// 1. Schema change
content = content.replace('parent_id TEXT,\n    FOREIGN KEY', 'parent_id TEXT,\n    secondary_parent_id TEXT,\n    FOREIGN KEY');

// Queries
content = content.replace(
  "db.prepare('SELECT user_id FROM students WHERE parent_id = ? ORDER BY id').all(viewerUserId)",
  "db.prepare('SELECT user_id FROM students WHERE parent_id = ? OR secondary_parent_id = ? ORDER BY id').all(viewerUserId, viewerUserId)"
);
content = content.replace(
  "db.prepare('SELECT user_id FROM students WHERE parent_id = ? ORDER BY id').all(viewerUserId)",
  "db.prepare('SELECT user_id FROM students WHERE parent_id = ? OR secondary_parent_id = ? ORDER BY id').all(viewerUserId, viewerUserId)"
);
content = content.replace(
  "db.prepare('SELECT user_id FROM students WHERE parent_id = ? ORDER BY id').all(viewerUserId)",
  "db.prepare('SELECT user_id FROM students WHERE parent_id = ? OR secondary_parent_id = ? ORDER BY id').all(viewerUserId, viewerUserId)"
);

content = content.replace(
  "WHERE s.parent_id = ?\").all(user.id);",
  "WHERE s.parent_id = ? OR s.secondary_parent_id = ?\").all(user.id, user.id);"
);

content = content.replace(
  "LEFT JOIN students s ON s.parent_id = u.id",
  "LEFT JOIN students s ON s.parent_id = u.id OR s.secondary_parent_id = u.id"
);

content = content.replace(
  "AND parent_id = ?').all(schoolId, actor.id)",
  "AND (parent_id = ? OR secondary_parent_id = ?)').all(schoolId, actor.id, actor.id)"
);

// We have lines like:
// 7760       db.prepare('INSERT INTO students (id, school_id, user_id, class_id, parent_id) VALUES (?, ?, ?, ?, ?)')
content = content.replace(
  "db.prepare('INSERT INTO students (id, school_id, user_id, class_id, parent_id) VALUES (?, ?, ?, ?, ?)')",
  "db.prepare('INSERT INTO students (id, school_id, user_id, class_id, parent_id, secondary_parent_id) VALUES (?, ?, ?, ?, ?, ?)')"
);

// Fix the array of params where that was called. That is line 7761. Let's see what it is.
fs.writeFileSync('packages/server/server.ts', content);
console.log("Patched server.ts basic replacements");
