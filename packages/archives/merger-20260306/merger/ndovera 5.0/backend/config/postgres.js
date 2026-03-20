const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PGUSER || 'ndo_user',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'ndo_central',
  password: process.env.PGPASSWORD || 'your_password',
  port: Number(process.env.PGPORT) || 5432,
});

module.exports = pool;
