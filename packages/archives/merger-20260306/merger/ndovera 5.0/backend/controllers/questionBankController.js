const { questionBankDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ entity_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `qba_${Date.now()}`,
    entity_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  questionBankDB.run(
    `INSERT INTO question_bank_audit (id, entity_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.entity_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

exports.getQuestions = (req, res) => {
  const { school_id, subject, class_level, difficulty, question_type, status } = req.query;
  let sql = 'SELECT * FROM question_bank_questions';
  const params = [];

  const filters = [
    { key: 'school_id', value: school_id },
    { key: 'subject', value: subject },
    { key: 'class_level', value: class_level },
    { key: 'difficulty', value: difficulty },
    { key: 'question_type', value: question_type },
    { key: 'status', value: status },
  ];

  filters.forEach(({ key, value }) => {
    if (value) {
      sql += params.length ? ` AND ${key} = ?` : ` WHERE ${key} = ?`;
      params.push(value);
    }
  });

  questionBankDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createQuestion = (req, res) => {
  const {
    id,
    school_id,
    subject,
    class_level,
    topic,
    subtopic,
    difficulty,
    term,
    year,
    question_type,
    content,
    answer,
    tags,
    created_by,
  } = req.body;

  const created_at = now();
  const updated_at = created_at;
  const questionId = id || `q_${Date.now()}`;

  questionBankDB.run(
    `INSERT INTO question_bank_questions (id, school_id, subject, class_level, topic, subtopic, difficulty, term, year, question_type, content, answer, tags, created_by, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      questionId,
      school_id,
      subject,
      class_level,
      topic || null,
      subtopic || null,
      difficulty || null,
      term || null,
      year || null,
      question_type,
      content,
      answer || null,
      tags || null,
      created_by || null,
      'draft',
      created_at,
      updated_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ entity_id: questionId, action: 'created', actor_id: created_by, actor_role: 'teacher' });
      logLedgerEvent('question_bank_created', { question_id: questionId, school_id });
      queueEvent('question_bank_created', { question_id: questionId, school_id });
      res.status(201).json({ id: questionId, status: 'draft' });
    },
  );
};

exports.getBlueprints = (req, res) => {
  const { school_id } = req.query;
  let sql = 'SELECT * FROM question_bank_blueprints';
  const params = [];
  if (school_id) {
    sql += ' WHERE school_id = ?';
    params.push(school_id);
  }
  questionBankDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createBlueprint = (req, res) => {
  const { id, school_id, name, description, template, created_by } = req.body;
  const created_at = now();
  const updated_at = created_at;
  const blueprintId = id || `bp_${Date.now()}`;

  questionBankDB.run(
    `INSERT INTO question_bank_blueprints (id, school_id, name, description, template, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      blueprintId,
      school_id,
      name,
      description || null,
      template || null,
      created_by || null,
      created_at,
      updated_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ entity_id: blueprintId, action: 'blueprint_created', actor_id: created_by, actor_role: 'hos' });
      queueEvent('question_bank_blueprint_created', { blueprint_id: blueprintId, school_id });
      res.status(201).json({ id: blueprintId });
    },
  );
};

exports.getPapers = (req, res) => {
  const { school_id, subject, class_level, status } = req.query;
  let sql = 'SELECT * FROM question_bank_papers';
  const params = [];

  const filters = [
    { key: 'school_id', value: school_id },
    { key: 'subject', value: subject },
    { key: 'class_level', value: class_level },
    { key: 'status', value: status },
  ];

  filters.forEach(({ key, value }) => {
    if (value) {
      sql += params.length ? ` AND ${key} = ?` : ` WHERE ${key} = ?`;
      params.push(value);
    }
  });

  questionBankDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createPaper = (req, res) => {
  const { id, school_id, name, subject, class_level, term, year, generated_by } = req.body;
  const created_at = now();
  const updated_at = created_at;
  const paperId = id || `paper_${Date.now()}`;

  questionBankDB.run(
    `INSERT INTO question_bank_papers (id, school_id, name, subject, class_level, term, year, status, generated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      paperId,
      school_id,
      name,
      subject,
      class_level,
      term || null,
      year || null,
      'draft',
      generated_by || null,
      created_at,
      updated_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ entity_id: paperId, action: 'paper_created', actor_id: generated_by, actor_role: 'hos' });
      queueEvent('question_bank_paper_created', { paper_id: paperId, school_id });
      res.status(201).json({ id: paperId });
    },
  );
};

exports.getDashboardStats = (req, res) => {
  res.json({
    total_questions: 420,
    drafts: 18,
    approved: 112,
    blueprints: 6,
    papers_ready: 4,
    pending_review: 9,
  });
};

exports.getAudit = (req, res) => {
  questionBankDB.all('SELECT * FROM question_bank_audit ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
