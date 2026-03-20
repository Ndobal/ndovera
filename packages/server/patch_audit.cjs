const fs = require('fs');
let code = fs.readFileSync('c:/Users/HP/Desktop/Projects/ndovera/packages/server/server.ts', 'utf8');

const patch = `
// System Audit Logging Helper
const logAudit = (req, action, details) => {
  try {
    const schoolId = req?.user?.school_id || null;
    const userId = req?.user?.id || null;
    const ip = req?.ip || req?.socket?.remoteAddress || null;
    db.prepare('INSERT INTO audit_logs (school_id, user_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)').run(
      schoolId, userId, action, typeof details === 'string' ? details : JSON.stringify(details), ip
    );
  } catch(e) {
    console.error('Audit log failed:', e);
  }
};
`;

if (!code.includes('const logAudit = (req, action, details) => {')) {
  code = code.replace('// --- Helpers ---', '// --- Helpers ---\n' + patch);
  fs.writeFileSync('c:/Users/HP/Desktop/Projects/ndovera/packages/server/server.ts', code);
}
console.log('done audit patch.');