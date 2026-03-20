const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/staff: results\.find\(r => r\.evaluator_role ===/g, 'staff: results.find((r: any) => r.evaluator_role ===');
code = code.replace(/students: results\.find\(r => r\.evaluator_role ===/g, 'students: results.find((r: any) => r.evaluator_role ===');
code = code.replace(/parents: results\.find\(r => r\.evaluator_role ===/g, 'parents: results.find((r: any) => r.evaluator_role ===');

code = code.replace(/const managementRoles = \['HoS', 'Owner', 'ICT Manager'\];/g, '');
const mrDecl = "const managementRoles = ['HoS', 'Owner', 'ICT Manager'];\n";
const firstImport = code.indexOf('import');
code = code.slice(0, firstImport) + mrDecl + code.slice(firstImport);

code = code.replace(/requireAuth,/g, "requireRoles('HoS', 'Admin', 'Teacher', 'Owner', 'Staff'),");
code = code.replace(/req\.user\.id/g, '(req as any).user.id');
code = code.replace(/req\.user\.role/g, '(req as any).user.role');
code = code.replace(/const user = req\.user;/g, 'const user = (req as any).user;');
code = code.replace(/error: err\.message/g, 'error: (err as Error).message');
code = code.replace(/reports\.map\(r =>/g, 'reports.map((r: any) =>');
code = code.replace(/reports\.filter\(r =>/g, 'reports.filter((r: any) =>');

fs.writeFileSync('server.ts', code);
console.log('patched TS errors');
