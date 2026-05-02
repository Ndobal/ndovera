const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development);

async function list() {
  try {
    const rows = await knex.raw("SELECT name, sql FROM sqlite_master WHERE type='table'");
    console.log(rows);
    process.exit(0);
  } catch (err) {
    console.error('List tables failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

list();
