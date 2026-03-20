const { onlineExamDB, hosDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ exam_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `oex_a_${Date.now()}`,
    exam_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  onlineExamDB.run(
    `INSERT INTO online_exam_audit (id, exam_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.exam_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

const computeScore = (question, answer) => {
  if (!answer) return { score: 0, isCorrect: 0, notes: 'no_answer' };
  const normalizedAnswer = String(answer).trim().toLowerCase();
  const correct = String(question.correct_answer || '').trim().toLowerCase();

  if (question.question_type === 'mcq' || question.question_type === 'short') {
    const isCorrect = normalizedAnswer === correct;
    return { score: isCorrect ? question.marks : 0, isCorrect: isCorrect ? 1 : 0 };
  }

  return { score: 0, isCorrect: 0, notes: 'manual_review' };
};

exports.listExams = (req, res) => {
  const { school_id, class_id, subject, status } = req.query;
  let sql = 'SELECT * FROM online_exams';
  const params = [];
  const filters = [];

  if (school_id) {
    filters.push('school_id = ?');
    params.push(school_id);
  }
  if (class_id) {
    filters.push('class_id = ?');
    params.push(class_id);
  }
  if (subject) {
    filters.push('subject = ?');
    params.push(subject);
  }
  if (status) {
    filters.push('status = ?');
    params.push(status);
  }

  if (filters.length) {
    sql += ` WHERE ${filters.join(' AND ')}`;
  }

  onlineExamDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createExam = (req, res) => {
  const { id, school_id, class_id, subject, term, title, created_by } = req.body;
  const examId = id || `oex_${Date.now()}`;
  const created_at = now();
  const updated_at = created_at;

  onlineExamDB.run(
    `INSERT INTO online_exams (id, school_id, class_id, subject, term, title, status, total_marks, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [examId, school_id, class_id, subject, term || null, title, 'draft', 0, created_by || null, created_at, updated_at],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ exam_id: examId, action: 'created', actor_id: created_by, actor_role: 'teacher' });
      logLedgerEvent('online_exam_created', { exam_id: examId, school_id });
      queueEvent('online_exam_created', { exam_id: examId, school_id });
      res.status(201).json({ id: examId, status: 'draft' });
    },
  );
};

exports.addQuestion = (req, res) => {
  const { exam_id, question_type, prompt, options, correct_answer, marks } = req.body;
  const questionId = `oex_q_${Date.now()}`;
  const created_at = now();

  onlineExamDB.run(
    `INSERT INTO online_exam_questions (id, exam_id, question_type, prompt, options, correct_answer, marks, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    , [questionId, exam_id, question_type, prompt, options ? JSON.stringify(options) : null, correct_answer || null, marks || 1, created_at],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      onlineExamDB.get('SELECT SUM(marks) AS total_marks FROM online_exam_questions WHERE exam_id = ?', [exam_id], (sumErr, row) => {
        if (sumErr) return res.status(500).json({ error: sumErr.message });
        onlineExamDB.run(
          'UPDATE online_exams SET total_marks = ?, updated_at = ? WHERE id = ?',
          [row?.total_marks || 0, now(), exam_id],
        );
        logAudit({ exam_id, action: 'question_added', actor_id: null, actor_role: 'teacher' });
        res.status(201).json({ id: questionId, total_marks: row?.total_marks || 0 });
      });
    },
  );
};

exports.getExamQuestions = (req, res) => {
  const { exam_id } = req.params;
  onlineExamDB.all('SELECT * FROM online_exam_questions WHERE exam_id = ?', [exam_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map((row) => ({
      ...row,
      options: row.options ? JSON.parse(row.options) : null,
    })));
  });
};

exports.updateExamStatus = (req, res) => {
  const { exam_id } = req.params;
  const { status } = req.body;
  const updated_at = now();
  onlineExamDB.run(
    'UPDATE online_exams SET status = ?, updated_at = ? WHERE id = ?',
    [status, updated_at, exam_id],
    function updateCallback(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Exam not found' });
      logAudit({ exam_id, action: 'status_updated', actor_id: null, actor_role: 'teacher', notes: status });
      res.json({ id: exam_id, status });
    },
  );
};

exports.submitAttempt = (req, res) => {
  const { exam_id, student_id, answers, school_id } = req.body;
  const attemptId = `oex_a_${Date.now()}`;
  const created_at = now();

  onlineExamDB.get('SELECT * FROM online_exams WHERE id = ?', [exam_id], (examErr, exam) => {
    if (examErr || !exam) return res.status(404).json({ error: 'Exam not found' });

    onlineExamDB.all('SELECT * FROM online_exam_questions WHERE exam_id = ?', [exam_id], (err, questions) => {
      if (err) return res.status(500).json({ error: err.message });

      const answerMap = Array.isArray(answers)
        ? answers.reduce((acc, item) => ({ ...acc, [item.question_id]: item.answer }), {})
        : {};

      let totalScore = 0;
      const responseRows = questions.map((question) => {
        const response = computeScore(question, answerMap[question.id]);
        totalScore += response.score;
        return {
          id: `oex_r_${Date.now()}_${question.id}`,
          attempt_id: attemptId,
          question_id: question.id,
          answer: answerMap[question.id] ?? null,
          score: response.score,
          is_correct: response.isCorrect,
          created_at,
        };
      });

      onlineExamDB.run(
        `INSERT INTO online_exam_attempts (id, exam_id, student_id, status, total_score, submitted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
        , [attemptId, exam_id, student_id, 'submitted', totalScore, created_at, created_at],
        (attemptErr) => {
          if (attemptErr) return res.status(500).json({ error: attemptErr.message });

          const insertResponses = responseRows.map((row) => new Promise((resolve) => {
            onlineExamDB.run(
              `INSERT INTO online_exam_responses (id, attempt_id, question_id, answer, score, is_correct, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
              , [row.id, row.attempt_id, row.question_id, row.answer, row.score, row.is_correct, row.created_at],
              () => resolve(),
            );
          }));

          Promise.all(insertResponses).then(() => {
            const caId = `ca_${Date.now()}`;
            hosDB.run(
              `INSERT INTO ca_scores (id, student_id, class_id, subject, term, school_id, score, max_score, source, reference_id, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              , [
                caId,
                student_id,
                exam.class_id,
                exam.subject,
                exam.term,
                school_id || exam.school_id,
                totalScore,
                exam.total_marks || 0,
                'online_exam',
                attemptId,
                'pending',
                created_at,
              ],
            );

            logAudit({ exam_id, action: 'attempt_submitted', actor_id: student_id, actor_role: 'student' });
            logLedgerEvent('online_exam_attempt_submitted', { exam_id, attempt_id: attemptId, student_id });
            queueEvent('online_exam_attempt_submitted', { exam_id, attempt_id: attemptId, student_id });
            res.status(201).json({ attempt_id: attemptId, total_score: totalScore });
          });
        },
      );
    });
  });
};
