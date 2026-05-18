function clampNumber(value, min, max) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function sortedGradingScale(gradingScale = []) {
  return [...(Array.isArray(gradingScale) ? gradingScale : [])]
    .map(entry => ({
      minScore: Number(entry?.minScore || 0),
      grade: String(entry?.grade || '').trim(),
      remark: String(entry?.remark || '').trim(),
    }))
    .filter(entry => entry.grade)
    .sort((left, right) => right.minScore - left.minScore);
}

export function computeGrade(total, gradingScale = []) {
  const orderedScale = sortedGradingScale(gradingScale);
  const match = orderedScale.find(entry => Number(total || 0) >= entry.minScore);
  return match?.grade || '';
}

export function computeRemark(total, gradingScale = []) {
  const orderedScale = sortedGradingScale(gradingScale);
  const match = orderedScale.find(entry => Number(total || 0) >= entry.minScore);
  return match?.remark || '';
}

function normalizeStudentProfile(profile = {}) {
  return {
    attendanceRate: clampNumber(profile?.attendanceRate, 0, 100),
    affective: profile?.affective && typeof profile.affective === 'object' ? profile.affective : {},
    ratings: profile?.ratings && typeof profile.ratings === 'object' ? profile.ratings : {},
    teacherRemark: String(profile?.teacherRemark || ''),
    principalRemark: String(profile?.principalRemark || ''),
    promotionStatus: String(profile?.promotionStatus || ''),
  };
}

function buildTeacherBroadsheet(students = []) {
  return [...students]
    .sort((left, right) => right.average - left.average || left.name.localeCompare(right.name))
    .map((student, index) => ({
      rank: index + 1,
      studentId: student.id,
      studentName: student.name,
      className: student.className,
      attendance: clampNumber(student.profile?.attendanceRate, 0, 100),
      average: student.average,
      grade: student.grade,
    }));
}

export function recomputeTeacherSheet(sheet = {}) {
  const gradingScale = Array.isArray(sheet?.settings?.gradingScale) ? sheet.settings.gradingScale : [];
  const students = (Array.isArray(sheet?.students) ? sheet.students : []).map(student => {
    const rows = (Array.isArray(student?.rows) ? student.rows : [])
      .map(row => {
        const ca = clampNumber(row?.ca, 0, 40);
        const exam = clampNumber(row?.exam, 0, 60);
        const total = clampNumber(ca + exam, 0, 100);
        return {
          ...row,
          ca,
          exam,
          rawTotal: total,
          total,
          grade: computeGrade(total, gradingScale),
          remark: computeRemark(total, gradingScale),
        };
      })
      .sort((left, right) => String(left?.subjectName || '').localeCompare(String(right?.subjectName || '')));

    const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.total, 0) / rows.length) : 0;

    return {
      ...student,
      average,
      grade: computeGrade(average, gradingScale),
      rows,
      profile: normalizeStudentProfile(student?.profile),
    };
  });

  return {
    ...sheet,
    students,
    broadsheet: buildTeacherBroadsheet(students),
  };
}

function normalizePublication(publication) {
  const payload = publication?.payload && typeof publication.payload === 'object' ? publication.payload : null;
  const summary = payload?.summary && typeof payload.summary === 'object' ? payload.summary : {};
  return {
    id: String(publication?.id || `${publication?.sessionName || 'session'}_${publication?.termName || 'term'}`),
    sessionName: String(publication?.sessionName || payload?.sessionName || ''),
    termName: String(publication?.termName || payload?.termName || ''),
    label: `${payload?.termName || publication?.termName || 'Term'} • ${payload?.sessionName || publication?.sessionName || 'Session'}`,
    publishedAt: publication?.publishedAt || publication?.updatedAt || '',
    payload,
    student: payload?.student || null,
    summary,
    subjects: Array.isArray(payload?.subjects) ? payload.subjects : [],
    affective: Array.isArray(payload?.affective) ? payload.affective : [],
    ratings: Array.isArray(payload?.ratings) ? payload.ratings : [],
  };
}

function buildSubjectRows(entries = [], gradingScale = []) {
  return entries
    .map(entry => {
      const ca = clampNumber(entry?.caScore, 0, 40);
      const exam = clampNumber(entry?.examScore, 0, 60);
      const total = clampNumber(ca + exam, 0, 100);
      return {
        subjectId: String(entry?.subjectId || ''),
        subjectName: String(entry?.subjectName || ''),
        ca,
        exam,
        rawTotal: total,
        total,
        grade: computeGrade(total, gradingScale),
        remark: computeRemark(total, gradingScale),
      };
    })
    .sort((left, right) => left.subjectName.localeCompare(right.subjectName));
}

export function normalizeTeacherSheetResponse(data = {}) {
  const gradingScale = Array.isArray(data?.settings?.gradingScale) ? data.settings.gradingScale : [];
  const profileMap = new Map((Array.isArray(data?.profiles) ? data.profiles : []).map(profile => [String(profile?.studentId || ''), profile]));
  const entryMap = new Map();

  (Array.isArray(data?.entries) ? data.entries : []).forEach(entry => {
    const studentId = String(entry?.studentId || '');
    if (!entryMap.has(studentId)) entryMap.set(studentId, []);
    entryMap.get(studentId).push(entry);
  });

  const students = (Array.isArray(data?.students) ? data.students : []).map(student => {
    const studentId = String(student?.id || '');
    const rows = buildSubjectRows(entryMap.get(studentId) || [], gradingScale);
    const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.total, 0) / rows.length) : 0;
    const profile = profileMap.get(studentId) || {};
    return {
      id: studentId,
      name: String(student?.name || ''),
      email: String(student?.email || ''),
      displayId: String(student?.displayId || ''),
      classId: String(student?.classId || data?.classroom?.id || ''),
      className: String(student?.className || data?.classroom?.className || ''),
      status: String(student?.status || 'active'),
      average,
      grade: computeGrade(average, gradingScale),
      rows,
      profile: normalizeStudentProfile(profile),
    };
  });

  const batchStatus = String(data?.batch?.status || 'draft');
  return recomputeTeacherSheet({
    classId: String(data?.classroom?.id || ''),
    classroom: data?.classroom || {},
    period: data?.period || {},
    settings: data?.settings || {},
    templates: Array.isArray(data?.templates) ? data.templates : [],
    configurationReady: Boolean(data?.configurationReady),
    configurationError: String(data?.configurationError || ''),
    permissions: data?.permissions || {},
    subjects: Array.isArray(data?.subjects) ? data.subjects : [],
    batch: data?.batch || {},
    status: batchStatus,
    published: batchStatus === 'published',
    publishedAt: data?.batch?.publishedAt || '',
    hosApproved: batchStatus === 'published',
    hosApprovedAt: data?.batch?.approvedAt || data?.batch?.publishedAt || '',
    hosApprovedBy: String(data?.batch?.approvedBy || ''),
    submitted: batchStatus === 'submitted',
    students,
    broadsheet: [],
  });
}

export function buildEntryPayload(sheet = {}) {
  return (Array.isArray(sheet?.students) ? sheet.students : []).flatMap(student =>
    (Array.isArray(student?.rows) ? student.rows : []).map(row => ({
      studentId: student.id,
      subjectId: row.subjectId,
      caScore: clampNumber(row.ca, 0, 40),
      examScore: clampNumber(row.exam, 0, 60),
    }))
  );
}

export function buildProfilePayload(sheet = {}) {
  return (Array.isArray(sheet?.students) ? sheet.students : []).map(student => ({
    studentId: student.id,
    attendanceRate: clampNumber(student?.profile?.attendanceRate, 0, 100),
    affective: student?.profile?.affective || {},
    ratings: student?.profile?.ratings || {},
    teacherRemark: String(student?.profile?.teacherRemark || ''),
    principalRemark: String(student?.profile?.principalRemark || ''),
    promotionStatus: String(student?.profile?.promotionStatus || ''),
  }));
}

export function normalizeResultRecordsResponse(data = {}) {
  const publications = (Array.isArray(data?.publications) ? data.publications : []).map(normalizePublication);
  return {
    role: String(data?.role || ''),
    students: Array.isArray(data?.students) ? data.students : [],
    activeStudentId: String(data?.activeStudentId || publications[0]?.student?.id || ''),
    lockedByFees: Boolean(data?.lockedByFees),
    feeStatus: String(data?.feeStatus || ''),
    publications,
    documents: Array.isArray(data?.documents) ? data.documents : [],
    activeRecord: publications[0] || null,
  };
}

export function buildSheetAnalytics(sheet = {}) {
  const broadsheet = Array.isArray(sheet?.broadsheet) ? sheet.broadsheet : [];
  const rows = (Array.isArray(sheet?.students) ? sheet.students : []).flatMap(student => student.rows || []);
  const subjectTotals = new Map();

  rows.forEach(row => {
    if (!subjectTotals.has(row.subjectName)) subjectTotals.set(row.subjectName, []);
    subjectTotals.get(row.subjectName).push(Number(row.total || 0));
  });

  return {
    classAverage: broadsheet.length ? Math.round(broadsheet.reduce((sum, row) => sum + Number(row.average || 0), 0) / broadsheet.length) : 0,
    passRate: rows.length ? Math.round((rows.filter(row => Number(row.total || 0) >= 50).length / rows.length) * 100) : 0,
    atRiskCount: broadsheet.filter(row => Number(row.average || 0) < 50).length,
    attendanceAverage: broadsheet.length ? Math.round(broadsheet.reduce((sum, row) => sum + Number(row.attendance || 0), 0) / broadsheet.length) : 0,
    subjectPerformance: [...subjectTotals.entries()]
      .map(([subject, totals]) => ({
        subject,
        average: totals.length ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length) : 0,
      }))
      .sort((left, right) => right.average - left.average),
  };
}

export function normalizeOverviewResponse(data = {}, classMap = {}) {
  const batches = (Array.isArray(data?.batches) ? data.batches : []).map(batch => ({
    ...batch,
    className: classMap[String(batch?.classId || '')] || String(batch?.classId || ''),
    label: `${classMap[String(batch?.classId || '')] || String(batch?.classId || 'Class')} • ${batch?.sessionName || 'Session'} • ${batch?.termName || 'Term'}`,
  }));

  return {
    settings: data?.settings || {},
    templates: Array.isArray(data?.templates) ? data.templates : [],
    suggestedSettings: data?.suggestedSettings || {},
    configurationReady: Boolean(data?.configurationReady),
    configurationError: String(data?.configurationError || ''),
    batches,
    recentDocuments: Array.isArray(data?.recentDocuments) ? data.recentDocuments : [],
    canManageSettings: Boolean(data?.canManageSettings),
    canPublish: Boolean(data?.canPublish),
    canUploadDocuments: Boolean(data?.canUploadDocuments),
  };
}