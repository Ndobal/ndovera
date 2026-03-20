const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { usersDB } = require('../config/sqlite');
const pool = require('../config/postgres');
const { queueEvent } = require('../utils/offlineQueue');

dotenv.config();

const SALT_ROUNDS = 10;

/**
 * Helper: hash a clear-text password using bcrypt.
 * This is used before storing the password in the local SQLite users table
 * and before syncing users into central PostgreSQL.
 */
async function hashPassword(password) {
  if (!password) return null;
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Helper: upsert a user into the central PostgreSQL multi-tenant users table.
 *
 * NOTE: This assumes a central table `nsms_users` exists with columns:
 *   (id, name, email, password_hash, roles, school_id, language_pref, updated_at)
 * Schema creation/migrations are intentionally kept outside of controllers.
 */
async function upsertUserToPostgres(user, client) {
  const pg = client || pool;
  const {
    id,
    name,
    email,
    password_hash,
    roles,
    school_id,
    language_pref,
    updated_at,
  } = user;

  const query = `
    INSERT INTO nsms_users (id, name, email, password_hash, roles, school_id, language_pref, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      password_hash = COALESCE(EXCLUDED.password_hash, nsms_users.password_hash),
      roles = EXCLUDED.roles,
      school_id = EXCLUDED.school_id,
      language_pref = EXCLUDED.language_pref,
      updated_at = EXCLUDED.updated_at;
  `;

  await pg.query(query, [
    id,
    name,
    email,
    password_hash,
    roles,
    school_id,
    language_pref,
    updated_at,
  ]);
}

/**
 * POST /api/users/login
 * Basic email/password login that issues a JWT for frontend use.
 */
exports.loginUser = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  usersDB.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    try {
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      const payload = {
        id: user.id,
        roles: user.roles,
        school_id: user.school_id,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-ndovera-secret', {
        expiresIn: '8h',
      });

      return res.json({ token });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
};

/**
 * GET /api/users
 * Optionally filter by school_id to respect multi-tenant isolation.
 */
exports.getUsers = (req, res) => {
  const { school_id } = req.query;

  const sql = school_id
    ? 'SELECT * FROM users WHERE school_id = ?'
    : 'SELECT * FROM users';
  const params = school_id ? [school_id] : [];

  usersDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * GET /api/users/:id
 * Retrieve a single user by id (within a given school if provided).
 */
exports.getUserById = (req, res) => {
  const { id } = req.params;
  const { school_id } = req.query;

  const sql = school_id
    ? 'SELECT * FROM users WHERE id = ? AND school_id = ?'
    : 'SELECT * FROM users WHERE id = ?';
  const params = school_id ? [id, school_id] : [id];

  usersDB.get(sql, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
};

/**
 * POST /api/users/create
 * Create a new user locally (SQLite), queue an offline event, and attempt
 * to sync into central PostgreSQL when online.
 */
exports.createUser = async (req, res) => {
  try {
    const { id, name, email, password, roles, school_id, language_pref } = req.body;

    const password_hash = await hashPassword(password);
    const now = new Date().toISOString();

    usersDB.run(
      `INSERT INTO users (id, name, email, password, roles, school_id, language_pref)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, password_hash, roles, school_id, language_pref],
      async (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const userPayload = {
          id,
          name,
          email,
          password_hash,
          roles,
          school_id,
          language_pref,
          updated_at: now,
          op: 'create',
        };

        // Queue encrypted, signed offline event for later sync.
        queueEvent('user_upsert', userPayload);

        // Best-effort immediate sync to PostgreSQL (if reachable).
        try {
          await upsertUserToPostgres(userPayload);
        } catch (syncErr) {
          // Swallow sync errors here; they will be retried via the sync controller.
          console.error('Deferred user sync to PostgreSQL:', syncErr.message);
        }

        res.status(201).json({ message: 'User created successfully' });
      },
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * PUT /api/users/:id
 * Update an existing user locally and propagate to offline queue + PostgreSQL.
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, roles, school_id, language_pref } = req.body;

    const password_hash = password ? await hashPassword(password) : null;
    const now = new Date().toISOString();

    const sql = `
      UPDATE users
      SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        password = COALESCE(?, password),
        roles = COALESCE(?, roles),
        school_id = COALESCE(?, school_id),
        language_pref = COALESCE(?, language_pref)
      WHERE id = ?
    `;

    usersDB.run(
      sql,
      [name, email, password_hash, roles, school_id, language_pref, id],
      async function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found' });

        const userPayload = {
          id,
          name,
          email,
          password_hash,
          roles,
          school_id,
          language_pref,
          updated_at: now,
          op: 'update',
        };

        queueEvent('user_upsert', userPayload);

        try {
          await upsertUserToPostgres(userPayload);
        } catch (syncErr) {
          console.error('Deferred user update sync to PostgreSQL:', syncErr.message);
        }

        res.json({ message: 'User updated successfully' });
      },
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * DELETE /api/users/:id
 * Soft-delete: remove from local SQLite and queue a delete event
 * so central PostgreSQL stays in sync.
 */
exports.deleteUser = (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();

  usersDB.run(
    'DELETE FROM users WHERE id = ?',
    [id],
    async function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found' });

      const deletePayload = { id, updated_at: now, op: 'delete' };
      queueEvent('user_delete', deletePayload);

      try {
        await pool.query('DELETE FROM nsms_users WHERE id = $1', [id]);
      } catch (syncErr) {
        console.error('Deferred user delete sync to PostgreSQL:', syncErr.message);
      }

      res.json({ message: 'User deleted successfully' });
    },
  );
};

// Export sync helper for the SyncController to reuse when replaying events.
exports.upsertUserToPostgres = upsertUserToPostgres;
