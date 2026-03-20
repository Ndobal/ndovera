const { usersDB } = require('../config/sqlite');

usersDB.run(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  roles TEXT,
  school_id TEXT,
  language_pref TEXT
)
`);

module.exports = usersDB;
