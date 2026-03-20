const { onboardingDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const normalizePart = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32);

const buildSchoolDomain = (schoolName, schoolDomain) => {
  if (schoolDomain) return normalizePart(schoolDomain);
  return normalizePart(schoolName) || 'school';
};

const buildEmail = (name, surname, domain) => {
  const first = normalizePart(name) || 'user';
  const last = normalizePart(surname) || 'member';
  return `${first}.${last}@${domain}.com`;
};

const ensureUniqueEmail = (baseEmail, schoolId, callback) => {
  let counter = 0;

  const tryEmail = () => {
    const candidate = counter === 0
      ? baseEmail
      : baseEmail.replace('@', `${counter}@`);

    onboardingDB.get(
      'SELECT id FROM email_aliases WHERE email = ? AND school_id = ?',
      [candidate, schoolId],
      (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(null, candidate);
        counter += 1;
        return tryEmail();
      },
    );
  };

  tryEmail();
};

const upsertAlias = ({ user_id, type, email, school_id }) => {
  const created_at = now();
  const aliasId = `alias_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  onboardingDB.run(
    'UPDATE email_aliases SET active = 0 WHERE user_id = ? AND type = ? AND school_id = ?',
    [user_id, type, school_id],
  );

  onboardingDB.run(
    `INSERT INTO email_aliases (id, user_id, type, email, school_id, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [aliasId, user_id, type, email, school_id, 1, created_at],
  );
};

exports.createStaffPreprofile = (req, res) => {
  const {
    school_id,
    school_name,
    school_domain,
    name,
    surname,
    role,
    responsibilities,
    class_id,
    department,
  } = req.body;

  if (!school_id || !name || !surname) {
    return res.status(400).json({ error: 'school_id, name, and surname are required' });
  }

  const domain = buildSchoolDomain(school_name, school_domain);
  const baseEmail = buildEmail(name, surname, domain);
  const staffId = `staff_${Date.now()}`;
  const created_at = now();

  ensureUniqueEmail(baseEmail, school_id, (err, email) => {
    if (err) return res.status(500).json({ error: err.message });

    onboardingDB.run(
      `INSERT INTO staff_profiles (id, school_id, name, surname, email, role, responsibilities, class_id, department, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        staffId,
        school_id,
        name,
        surname,
        email,
        role || null,
        responsibilities || null,
        class_id || null,
        department || null,
        'pending',
        created_at,
        created_at,
      ],
      (insertErr) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });

        upsertAlias({ user_id: staffId, type: 'staff', email, school_id });
        logLedgerEvent('staff_preprofile_created', { staff_id: staffId, school_id });
        queueEvent('staff_preprofile_created', { staff_id: staffId, school_id });
        return res.status(201).json({ id: staffId, email, status: 'pending' });
      },
    );
  });
};

exports.completeStaffProfile = (req, res) => {
  const { id } = req.params;
  const {
    dob,
    state_of_origin,
    lga,
    gender,
    profile_photo,
    documents,
  } = req.body;

  const updated_at = now();

  onboardingDB.run(
    `UPDATE staff_profiles
     SET
      dob = COALESCE(?, dob),
      state_of_origin = COALESCE(?, state_of_origin),
      lga = COALESCE(?, lga),
      gender = COALESCE(?, gender),
      profile_photo = COALESCE(?, profile_photo),
      documents = COALESCE(?, documents),
      status = 'active',
      updated_at = ?
     WHERE id = ?`,
    [
      dob || null,
      state_of_origin || null,
      lga || null,
      gender || null,
      profile_photo || null,
      documents ? JSON.stringify(documents) : null,
      updated_at,
      id,
    ],
    function updateCallback(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Staff not found' });
      logLedgerEvent('staff_profile_completed', { staff_id: id });
      queueEvent('staff_profile_completed', { staff_id: id });
      return res.json({ id, status: 'active' });
    },
  );
};

exports.verifyStaffCashout = (req, res) => {
  const { id } = req.params;
  const updated_at = now();

  onboardingDB.run(
    `UPDATE staff_profiles
     SET cashout_verified = 1, status = 'verified', updated_at = ?
     WHERE id = ?`,
    [updated_at, id],
    function updateCallback(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: 'Staff not found' });
      logLedgerEvent('staff_cashout_verified', { staff_id: id });
      queueEvent('staff_cashout_verified', { staff_id: id });
      return res.json({ id, cashout_verified: 1 });
    },
  );
};

exports.createStudentPreprofile = (req, res) => {
  const {
    school_id,
    school_name,
    school_domain,
    name,
    surname,
    class_id,
    section_id,
    privileges,
    access_level,
  } = req.body;

  if (!school_id || !name || !surname || !class_id) {
    return res.status(400).json({ error: 'school_id, name, surname, and class_id are required' });
  }

  const domain = buildSchoolDomain(school_name, school_domain);
  const baseEmail = buildEmail(name, surname, domain);
  const studentId = `student_${Date.now()}`;
  const created_at = now();

  ensureUniqueEmail(baseEmail, school_id, (err, email) => {
    if (err) return res.status(500).json({ error: err.message });

    onboardingDB.run(
      `INSERT INTO students (id, school_id, name, surname, email, class_id, section_id, status, privileges, access_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        studentId,
        school_id,
        name,
        surname,
        email,
        class_id,
        section_id || null,
        'active',
        privileges ? JSON.stringify(privileges) : null,
        access_level || null,
        created_at,
        created_at,
      ],
      (insertErr) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });

        upsertAlias({ user_id: studentId, type: 'student', email, school_id });
        logLedgerEvent('student_preprofile_created', { student_id: studentId, school_id });
        queueEvent('student_preprofile_created', { student_id: studentId, school_id });
        return res.status(201).json({ id: studentId, email, status: 'active' });
      },
    );
  });
};

exports.migrateStudent = (req, res) => {
  const { id } = req.params;
  const { new_school_id, new_school_name, new_school_domain } = req.body;

  if (!new_school_id) {
    return res.status(400).json({ error: 'new_school_id is required' });
  }

  onboardingDB.get('SELECT * FROM students WHERE id = ?', [id], (err, student) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const domain = buildSchoolDomain(new_school_name, new_school_domain);
    const baseEmail = buildEmail(student.name, student.surname, domain);
    const updated_at = now();

    ensureUniqueEmail(baseEmail, new_school_id, (uniqueErr, email) => {
      if (uniqueErr) return res.status(500).json({ error: uniqueErr.message });

      onboardingDB.run(
        `UPDATE students
         SET school_id = ?, email = ?, status = 'migrated', updated_at = ?
         WHERE id = ?`,
        [new_school_id, email, updated_at, id],
        function updateCallback(updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          if (!this.changes) return res.status(404).json({ error: 'Student not found' });

          upsertAlias({ user_id: id, type: 'student', email, school_id: new_school_id });
          logLedgerEvent('student_migrated', { student_id: id, new_school_id });
          queueEvent('student_migrated', { student_id: id, new_school_id });
          return res.json({ id, email, status: 'migrated' });
        },
      );
    });
  });
};

exports.listStaffProfiles = (req, res) => {
  const { school_id, status } = req.query;
  let sql = 'SELECT * FROM staff_profiles';
  const params = [];
  const filters = [];

  if (school_id) {
    filters.push('school_id = ?');
    params.push(school_id);
  }
  if (status) {
    filters.push('status = ?');
    params.push(status);
  }

  if (filters.length) {
    sql += ` WHERE ${filters.join(' AND ')}`;
  }

  onboardingDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.listStudents = (req, res) => {
  const { school_id, status } = req.query;
  let sql = 'SELECT * FROM students';
  const params = [];
  const filters = [];

  if (school_id) {
    filters.push('school_id = ?');
    params.push(school_id);
  }
  if (status) {
    filters.push('status = ?');
    params.push(status);
  }

  if (filters.length) {
    sql += ` WHERE ${filters.join(' AND ')}`;
  }

  onboardingDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
