require('dotenv').config();

module.exports = {
  development: {
    client: process.env.DB_CLIENT || 'sqlite3',
    connection: process.env.DB_CLIENT === 'pg' ? (process.env.DATABASE_URL) : {
      filename: process.env.SQLITE_FILE || __dirname + '/dev.sqlite3'
    },
    useNullAsDefault: true,
    migrations: {
      directory: __dirname + '/migrations'
    }
  }
};
