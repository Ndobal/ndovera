const Database = require('better-sqlite3');
const db = new Database('C:/Users/HP/Desktop/Projects/ndovera/packages/server/ndovera.db');

try {
  db.exec("ALTER TABLE users ADD COLUMN qr_token TEXT;");
  console.log("Added qr_token to users");
} catch (e) {
  console.log("users qr_token probably already exists", e.message);
}
try {
  db.exec("ALTER TABLE users ADD COLUMN face_descriptor TEXT;");
  console.log("Added face_descriptor to users");
} catch (e) {
  console.log("users face_descriptor probably already exists", e.message);
}
try {
  db.exec("ALTER TABLE students ADD COLUMN qr_token TEXT;");
  console.log("Added qr_token to students");
} catch (e) {
  console.log("students qr_token probably already exists", e.message);
}
try {
  db.exec("ALTER TABLE students ADD COLUMN face_descriptor TEXT;");
  console.log("Added face_descriptor to students");
} catch (e) {
  console.log("students face_descriptor probably already exists", e.message);
}