const STORAGE_KEY = 'ndovera.resultEngine.v1';

const seedState = {
  term: '2025/2026 • Term 2',
  published: false,
  publishedAt: null,
  hosApproved: false,
  hosApprovedAt: null,
  hosApprovedBy: null,
  examWindow: {
    armed: true,
    active: false,
    incidents: 2,
    autoSubmits: 1,
  },
  students: [
    { id: 'stu-001', name: 'David N.', className: 'SS2 Gold', feeCleared: true },
    { id: 'stu-002', name: 'Ada P.', className: 'SS2 Gold', feeCleared: true },
    { id: 'stu-003', name: 'Musa K.', className: 'SS2 Gold', feeCleared: false },
  ],
  attendanceByStudent: {
    'stu-001': 96,
    'stu-002': 94,
    'stu-003': 88,
  },
  scoreRows: [
    { studentId: 'stu-001', subject: 'Mathematics', ca: 34, exam: 52 },
    { studentId: 'stu-001', subject: 'English Language', ca: 31, exam: 50 },
    { studentId: 'stu-001', subject: 'Biology', ca: 29, exam: 46 },
    { studentId: 'stu-002', subject: 'Mathematics', ca: 36, exam: 55 },
    { studentId: 'stu-002', subject: 'English Language', ca: 33, exam: 54 },
    { studentId: 'stu-002', subject: 'Biology', ca: 31, exam: 48 },
    { studentId: 'stu-003', subject: 'Mathematics', ca: 28, exam: 40 },
    { studentId: 'stu-003', subject: 'English Language', ca: 26, exam: 42 },
    { studentId: 'stu-003', subject: 'Biology', ca: 27, exam: 44 },
  ],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeGrade(total) {
  if (total >= 85) return 'A';
  if (total >= 75) return 'B+';
  if (total >= 65) return 'B';
  if (total >= 55) return 'C+';
  if (total >= 45) return 'C';
  return 'D';
}

function withComputedRows(rows, attendanceByStudent = {}) {
  return rows.map(row => {
    const ca = clamp(Number(row.ca) || 0, 0, 40);
    const exam = clamp(Number(row.exam) || 0, 0, 60);
    const rawTotal = ca + exam;
    const attendanceRate = clamp(Number(attendanceByStudent[row.studentId]) || 0, 0, 100);
    const total = clamp(Math.round(rawTotal * 0.9 + attendanceRate * 0.1), 0, 100);
    return { ...row, ca, exam, rawTotal, attendanceRate, total, grade: computeGrade(total) };
  });
}

function buildBroadsheet(state) {
  const computedRows = withComputedRows(state.scoreRows, state.attendanceByStudent);
  const summaryByStudent = state.students.map(student => {
    const rows = computedRows.filter(row => row.studentId === student.id);
    const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.total, 0) / rows.length) : 0;
    const attendance = clamp(Number(state.attendanceByStudent[student.id]) || 0, 0, 100);
    return {
      studentId: student.id,
      studentName: student.name,
      className: student.className,
      feeCleared: student.feeCleared,
      attendance,
      average,
      grade: computeGrade(average),
      rows,
    };
  }).sort((a, b) => b.average - a.average);

  return summaryByStudent.map((item, index) => ({ ...item, rank: index + 1 }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState;
    const parsed = JSON.parse(raw);
    return {
      ...seedState,
      ...parsed,
      scoreRows: Array.isArray(parsed.scoreRows) ? parsed.scoreRows : seedState.scoreRows,
      students: Array.isArray(parsed.students) ? parsed.students : seedState.students,
      attendanceByStudent: parsed.attendanceByStudent || seedState.attendanceByStudent,
      examWindow: parsed.examWindow || seedState.examWindow,
    };
  } catch {
    return seedState;
  }
}

function saveState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export function getResultEngineState() {
  const state = loadState();
  return { ...state, scoreRows: withComputedRows(state.scoreRows, state.attendanceByStudent) };
}

export function getTeacherScoreSheet() {
  const state = getResultEngineState();
  return {
    term: state.term,
    published: state.published,
    publishedAt: state.publishedAt,
    hosApproved: state.hosApproved,
    hosApprovedAt: state.hosApprovedAt,
    hosApprovedBy: state.hosApprovedBy,
    students: state.students,
    rows: state.scoreRows,
    attendanceByStudent: state.attendanceByStudent,
    examWindow: state.examWindow,
  };
}

export function upsertCAScore({ studentId, subject, ca, exam }) {
  const state = loadState();
  const existingIndex = state.scoreRows.findIndex(row => row.studentId === studentId && row.subject === subject);
  const nextRow = { studentId, subject, ca: clamp(Number(ca) || 0, 0, 40), exam: clamp(Number(exam) || 0, 0, 60) };

  if (existingIndex === -1) {
    state.scoreRows.push(nextRow);
  } else {
    state.scoreRows[existingIndex] = nextRow;
  }

  saveState(state);
  return getTeacherScoreSheet();
}

export function upsertAttendance({ studentId, attendanceRate }) {
  const state = loadState();
  state.attendanceByStudent = {
    ...state.attendanceByStudent,
    [studentId]: clamp(Number(attendanceRate) || 0, 0, 100),
  };
  saveState(state);
  return getTeacherScoreSheet();
}

export function publishResults() {
  const state = loadState();
  state.published = true;
  state.publishedAt = new Date().toISOString();
  state.hosApproved = false;
  state.hosApprovedAt = null;
  state.hosApprovedBy = null;
  saveState(state);
  return getTeacherScoreSheet();
}

export function unpublishResults() {
  const state = loadState();
  state.published = false;
  state.publishedAt = null;
  state.hosApproved = false;
  state.hosApprovedAt = null;
  state.hosApprovedBy = null;
  saveState(state);
  return getTeacherScoreSheet();
}

export function approveResultsByHoS(approverName = 'Head of School') {
  const state = loadState();
  if (!state.published) {
    return getResultEngineState();
  }
  state.hosApproved = true;
  state.hosApprovedAt = new Date().toISOString();
  state.hosApprovedBy = approverName;
  saveState(state);
  return getResultEngineState();
}

export function revokeHoSApproval() {
  const state = loadState();
  state.hosApproved = false;
  state.hosApprovedAt = null;
  state.hosApprovedBy = null;
  saveState(state);
  return getResultEngineState();
}

export function getStudentResult(studentId = 'stu-001') {
  const state = getResultEngineState();
  const student = state.students.find(item => item.id === studentId) || state.students[0];
  const rows = state.scoreRows.filter(row => row.studentId === student.id);
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.total, 0) / rows.length) : 0;

  return {
    student,
    term: state.term,
    published: state.published,
    publishedAt: state.publishedAt,
    hosApproved: state.hosApproved,
    hosApprovedAt: state.hosApprovedAt,
    hosApprovedBy: state.hosApprovedBy,
    rows,
    average,
    attendanceRate: clamp(Number(state.attendanceByStudent[student.id]) || 0, 0, 100),
    feeCleared: Boolean(student.feeCleared),
    visibleToStudent: state.published && state.hosApproved,
    lockedByFees: !student.feeCleared,
  };
}

export function getParentResult(activeChildId = 'stu-001') {
  return getStudentResult(activeChildId);
}

export function getResultSummary() {
  const state = getResultEngineState();
  const totals = state.scoreRows.map(row => row.total);
  const average = totals.length ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length) : 0;
  const highest = totals.length ? Math.max(...totals) : 0;
  const lowest = totals.length ? Math.min(...totals) : 0;

  return {
    term: state.term,
    published: state.published,
    hosApproved: state.hosApproved,
    hosApprovedAt: state.hosApprovedAt,
    hosApprovedBy: state.hosApprovedBy,
    studentsCount: state.students.length,
    entriesCount: state.scoreRows.length,
    average,
    highest,
    lowest,
    examWindow: state.examWindow,
  };
}

export function getBroadsheetRanking() {
  const state = loadState();
  return {
    term: state.term,
    published: state.published,
    hosApproved: state.hosApproved,
    rows: buildBroadsheet(state),
  };
}

export function getHoSResultAnalytics() {
  const state = loadState();
  const broadsheet = buildBroadsheet(state);
  const allRows = withComputedRows(state.scoreRows, state.attendanceByStudent);
  const passRate = allRows.length
    ? Math.round((allRows.filter(row => row.total >= 50).length / allRows.length) * 100)
    : 0;
  const atRiskCount = broadsheet.filter(row => row.average < 50).length;

  const subjectMap = new Map();
  allRows.forEach(row => {
    if (!subjectMap.has(row.subject)) subjectMap.set(row.subject, []);
    subjectMap.get(row.subject).push(row.total);
  });

  const subjects = [...subjectMap.entries()].map(([subject, totals]) => ({
    subject,
    average: Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length),
  })).sort((a, b) => b.average - a.average);

  const attendanceAverage = broadsheet.length
    ? Math.round(broadsheet.reduce((sum, row) => sum + row.attendance, 0) / broadsheet.length)
    : 0;

  return {
    term: state.term,
    published: state.published,
    hosApproved: state.hosApproved,
    hosApprovedAt: state.hosApprovedAt,
    hosApprovedBy: state.hosApprovedBy,
    classAverage: broadsheet.length
      ? Math.round(broadsheet.reduce((sum, row) => sum + row.average, 0) / broadsheet.length)
      : 0,
    passRate,
    atRiskCount,
    attendanceAverage,
    examIntegrity: state.examWindow,
    subjectPerformance: subjects,
    broadsheet,
  };
}

export function getOwnerResultAnalytics() {
  const hos = getHoSResultAnalytics();
  const campuses = [
    { name: 'Main Campus', average: hos.classAverage, passRate: hos.passRate, attendance: hos.attendanceAverage },
    { name: 'Annex Campus', average: Math.max(hos.classAverage - 3, 0), passRate: Math.max(hos.passRate - 4, 0), attendance: Math.max(hos.attendanceAverage - 2, 0) },
    { name: 'Junior Campus', average: Math.max(hos.classAverage - 1, 0), passRate: Math.max(hos.passRate - 2, 0), attendance: Math.max(hos.attendanceAverage - 1, 0) },
  ];

  return {
    ...hos,
    campuses,
    globalAverage: Math.round(campuses.reduce((sum, campus) => sum + campus.average, 0) / campuses.length),
    globalPassRate: Math.round(campuses.reduce((sum, campus) => sum + campus.passRate, 0) / campuses.length),
  };
}
