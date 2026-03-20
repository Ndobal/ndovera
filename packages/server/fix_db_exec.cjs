const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = "  db.exec(`\n    CREATE TABLE IF NOT EXISTS evaluations (";
const target2 = "  db.exec(\n    CREATE TABLE IF NOT EXISTS evaluations (";

let changed = false;
if (code.includes(target1)) {
  code = code.replace(target1, "\n    CREATE TABLE IF NOT EXISTS evaluations (");
  changed = true;
}
if (code.includes(target2)) {
  code = code.replace(target2, "\n    CREATE TABLE IF NOT EXISTS evaluations (");
  changed = true;
}

fs.writeFileSync('server.ts', code);
if (changed) console.log("Removed extraneous db.exec");
else console.log("No extraneous db.exec found");
