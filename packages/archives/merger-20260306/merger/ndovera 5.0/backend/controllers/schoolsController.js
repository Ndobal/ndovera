const { schoolsDB } = require('../config/sqlite');
const pool = require('../config/postgres');
const { queueEvent } = require('../utils/offlineQueue');

/**
 * Helper: upsert a school into the central PostgreSQL multi-tenant schools table.
 *
 * Assumes a central table `nsms_schools` with columns:
 *   (id, name, level, owner_id, hos_id, template, language, is_active, updated_at)
 */
async function upsertSchoolToPostgres(school, client) {
  const pg = client || pool;
  const { id, name, level, owner_id, hos_id, template, language, is_active, updated_at } = school;

  const query = `
    INSERT INTO nsms_schools (id, name, level, owner_id, hos_id, template, language, is_active, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), $9)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      level = EXCLUDED.level,
      owner_id = EXCLUDED.owner_id,
      hos_id = EXCLUDED.hos_id,
      template = EXCLUDED.template,
      language = EXCLUDED.language,
      is_active = EXCLUDED.is_active,
      updated_at = EXCLUDED.updated_at;
  `;

  await pg.query(query, [
    id,
    name,
    level,
    owner_id,
    hos_id,
    template,
    language,
    is_active,
    updated_at,
  ]);
}

/**
 * GET /api/schools
 * List schools; optionally filter by owner or HOS for multi-tenant dashboards.
 */
exports.getSchools = (req, res) => {
  const { owner_id, hos_id } = req.query;

  let sql = 'SELECT * FROM schools';
  const params = [];
  if (owner_id) {
    sql += ' WHERE owner_id = ?';
    params.push(owner_id);
  } else if (hos_id) {
    sql += ' WHERE hos_id = ?';
    params.push(hos_id);
  }

  schoolsDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * GET /api/schools/:id
 */
exports.getSchoolById = (req, res) => {
  const { id } = req.params;
  schoolsDB.get('SELECT * FROM schools WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'School not found' });
    res.json(row);
  });
};

/**
 * POST /api/schools/create
 * Create a new school tenant, queue an event, and sync to PostgreSQL.
 */
exports.createSchool = (req, res) => {
  const { id, name, level, owner_id, hos_id, template, language, is_active } = req.body;
  const now = new Date().toISOString();

  schoolsDB.run(
    `INSERT INTO schools (id, name, level, owner_id, hos_id, template, language, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0))`,
    [id, name, level, owner_id, hos_id, template, language, is_active],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const payload = {
        id,
        name,
        level,
        owner_id,
        hos_id,
        template,
        language,
        is_active: is_active ?? 0,
        updated_at: now,
        op: 'create',
      };

      queueEvent('school_upsert', payload);

      try {
        await upsertSchoolToPostgres(payload);
      } catch (syncErr) {
        console.error('Deferred school sync to PostgreSQL:', syncErr.message);
      }

      res.status(201).json({ message: 'School created successfully' });
    },
  );
};

/**
 * PUT /api/schools/:id
 */
exports.updateSchool = (req, res) => {
  const { id } = req.params;
  const { name, level, owner_id, hos_id, template, language, is_active } = req.body;
  const now = new Date().toISOString();

  const sql = `
    UPDATE schools
    SET
      name = COALESCE(?, name),
      level = COALESCE(?, level),
      owner_id = COALESCE(?, owner_id),
      hos_id = COALESCE(?, hos_id),
      template = COALESCE(?, template),
      language = COALESCE(?, language),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `;

  schoolsDB.run(
    sql,
    [name, level, owner_id, hos_id, template, language, is_active, id],
    async function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'School not found' });

      const payload = {
        id,
        name,
        level,
        owner_id,
        hos_id,
        template,
        language,
        is_active,
        updated_at: now,
        op: 'update',
      };

      queueEvent('school_upsert', payload);

      try {
        await upsertSchoolToPostgres(payload);
      } catch (syncErr) {
        console.error('Deferred school update sync to PostgreSQL:', syncErr.message);
      }

      res.json({ message: 'School updated successfully' });
    },
  );
};

/**
 * DELETE /api/schools/:id
 */
exports.deleteSchool = (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();

  schoolsDB.run(
    'DELETE FROM schools WHERE id = ?',
    [id],
    async function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'School not found' });

      const payload = { id, updated_at: now, op: 'delete' };
      queueEvent('school_delete', payload);

      try {
        await pool.query('DELETE FROM nsms_schools WHERE id = $1', [id]);
      } catch (syncErr) {
        console.error('Deferred school delete sync to PostgreSQL:', syncErr.message);
      }

      res.json({ message: 'School deleted successfully' });
    },
  );
};

exports.upsertSchoolToPostgres = upsertSchoolToPostgres;
