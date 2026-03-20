const fs = require('fs');

let code = fs.readFileSync('packages/server/server.ts', 'utf8');

// 1. ADD COLUMNS (tags, class_group, subject)
const initQuery = `CREATE TABLE IF NOT EXISTS shared_files`;
if (code.includes(initQuery)) {
   code = code.replace(
       /CREATE TABLE IF NOT EXISTS shared_files \([\s\S]*?\);/,
       `CREATE TABLE IF NOT EXISTS shared_files (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        resource_url TEXT,
        scope TEXT DEFAULT 'school',
        source_type TEXT DEFAULT 'tenant',
        file_type TEXT DEFAULT 'Link',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        tags TEXT DEFAULT 'General',
        class_group TEXT,
        subject TEXT
      );`
   );
}

// 2. PATCH DB UPGRADE
if (!code.includes('ALTER TABLE shared_files ADD COLUMN tags')) {
    const upgradePoint = code.indexOf(`console.log('Database init complete');`);
    const schemaUpgrades = `
      try { db.exec("ALTER TABLE shared_files ADD COLUMN tags TEXT DEFAULT 'General'"); } catch(e){}
      try { db.exec("ALTER TABLE shared_files ADD COLUMN class_group TEXT"); } catch(e){}
      try { db.exec("ALTER TABLE shared_files ADD COLUMN subject TEXT"); } catch(e){}
`;
    code = code.slice(0, upgradePoint) + schemaUpgrades + code.slice(upgradePoint);
}

// 3. EDIT POST /api/shared-files
code = code.replace(
  /const fileType = typeof req\.body\?\.fileType === 'string' \? req\.body\.fileType\.trim\(\) : 'Link';/,
  `const fileType = typeof req.body?.fileType === 'string' ? req.body.fileType.trim() : 'Link';
        const tags = req.body?.tags || 'General';
        const classGroup = req.body?.classGroup || null;
        const subject = req.body?.subject || null;`
);

code = code.replace(
  /INSERT INTO shared_files \(id, school_id, title, description, resource_url, scope, source_type, file_type, created_by\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?\)'/,
  `INSERT INTO shared_files (id, school_id, title, description, resource_url, scope, source_type, file_type, created_by, tags, class_group, subject) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'`
);

code = code.replace(
  /\.run\(id, scope === 'ndovera' \? null : schoolId, title, description \|\| null, resourceUrl \|\| null, scope, sourceType, fileType \|\| 'Link', actor\.id\);/,
  `.run(id, scope === 'ndovera' ? null : schoolId, title, description || null, resourceUrl || null, scope, sourceType, fileType || 'Link', actor.id, tags, classGroup, subject);`
);

// 4. EDIT GET /api/shared-files
code = code.replace(
  /createdBy: file\.created_by_name \|\| 'System',/,
  `createdBy: file.created_by_name || 'System',
            tags: file.tags || 'General',
            classGroup: file.class_group,
            subject: file.subject,`
);

fs.writeFileSync('packages/server/server.ts', code);
console.log('Patched API shared-files');
