const { websiteDB } = require('../config/sqlite');
const pool = require('../config/postgres');
const { queueEvent } = require('../utils/offlineQueue');

/**
 * Helper: upsert a website page into central PostgreSQL.
 *
 * Assumes a central table `nsms_pages` with columns:
 *   (id, school_id, template, page_name, content, created_at, updated_at)
 */
async function upsertPageToPostgres(page, client) {
  const pg = client || pool;
  const { id, school_id, template, page_name, content, created_at, updated_at } = page;

  const query = `
    INSERT INTO nsms_pages (id, school_id, template, page_name, content, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      school_id = EXCLUDED.school_id,
      template = EXCLUDED.template,
      page_name = EXCLUDED.page_name,
      content = EXCLUDED.content,
      updated_at = EXCLUDED.updated_at;
  `;

  await pg.query(query, [id, school_id, template, page_name, content, created_at, updated_at]);
}

/**
 * GET /api/website/pages/:schoolId
 */
exports.getPagesForSchool = (req, res) => {
  const { schoolId } = req.params;
  websiteDB.all('SELECT * FROM pages WHERE school_id = ?', [schoolId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * POST /api/website/pages
 * Upsert page content for a school website.
 *
 * Template switching: the `template` field can be changed at any time; the
 * frontend will re-render using the new template while keeping `content`.
 */
exports.upsertPage = (req, res) => {
  const { id, school_id, template, page_name, content } = req.body;
  const created_at = req.body.created_at || new Date().toISOString();
  const updated_at = req.body.updated_at || created_at;

  websiteDB.run(
    `INSERT INTO pages (id, school_id, template, page_name, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       school_id = excluded.school_id,
       template = excluded.template,
       page_name = excluded.page_name,
       content = excluded.content,
       updated_at = excluded.updated_at`,
    [id, school_id, template, page_name, content, created_at, updated_at],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const payload = { id, school_id, template, page_name, content, created_at, updated_at };
      queueEvent('website_page_upsert', payload);

      try {
        await upsertPageToPostgres(payload);
      } catch (syncErr) {
        console.error('Deferred page upsert sync to PostgreSQL:', syncErr.message);
      }

      res.status(201).json({ message: 'Page upserted successfully' });
    },
  );
};

exports.upsertPageToPostgres = upsertPageToPostgres;
