import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

type NurseryProgressSection = {
  id: string;
  title: string;
  items: Array<{ no: string; text: string; status: 'not_yet' | 'progressing' | 'yes' }>;
};

type GradeCognitiveSection = {
  id: string;
  title: string;
  items?: Array<{ label: string; rating: number }>;
  content?: Array<{ sub: string; items: Array<{ label: string; rating: number }> }>;
};

type ResultPageTwo = {
  variant: 'none' | 'nursery-progress' | 'grade-cognitive';
  affectiveTraits: string[];
  physical?: {
    height?: number | null;
    weight?: number | null;
  };
  nurseryProgressSections?: NurseryProgressSection[];
  gradeCognitiveSections?: GradeCognitiveSection[];
};

type ResultSubject = {
  subject: string;
  ca: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
};

type ResultSummary = {
  average: string;
  grade: string;
  position: string;
  attendance: string;
  teacherRemark: string;
  principalRemark: string;
  promotion: string;
  teacherSignature?: string;
  sectionalRemark?: string;
  sectionalSignature?: string;
  principalSignature?: string;
};

type ResultApproval = {
  teacherSavedAt?: string;
  sectionalHeadApprovedAt?: string;
  sectionalHeadApprovedBy?: string;
  hosApprovedAt?: string;
  hosApprovedBy?: string;
};

type ResultTerm = {
  name: string;
  summary: ResultSummary;
  subjects: ResultSubject[];
  trend: string[];
  pageTwo?: ResultPageTwo;
  approvals?: ResultApproval;
};

type ResultSession = {
  session: string;
  feeStatus: string;
  outstanding: string;
  terms: ResultTerm[];
};

export type StudentResultRecord = {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  className: string;
  classSection?: string;
  sessions: ResultSession[];
  updatedAt: string;
};

type ResultsState = {
  students: StudentResultRecord[];
};

export type UpsertStudentResultInput = {
  studentId: string;
  studentName: string;
  className?: string;
  classSection?: string;
  session: string;
  term: string;
  feeStatus?: string;
  outstanding?: string;
  subject: {
    subject: string;
    ca: number;
    exam: number;
    total: number;
    grade?: string;
    remark?: string;
  };
  summary?: Partial<ResultSummary>;
  trend?: string[];
  pageTwo?: ResultPageTwo;
};

function defaultState(): ResultsState {
  return { students: [] };
}
async function readState() { return readDocument<ResultsState>('classroom-results', GLOBAL_SCOPE, defaultState); }
async function writeState(state: ResultsState) { return writeDocument('classroom-results', GLOBAL_SCOPE, state); }

function nowIso() {
  return new Date().toISOString();
}

function normalizeRole(value?: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSection(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'preschool' || normalized === 'nursery' || normalized === 'pre school' || normalized === 'pre-school') return 'pre-school';
  if (normalized === 'grade' || normalized === 'primary') return 'primary';
  if (normalized === 'junior secondary' || normalized === 'junior-secondary' || normalized === 'jss') return 'junior-secondary';
  if (normalized === 'senior secondary' || normalized === 'senior-secondary' || normalized === 'sss') return 'senior-secondary';
  return normalized;
}

function inferSectionFromClassName(className?: string) {
  const normalized = String(className || '').trim().toLowerCase();
  if (!normalized) return '';
  if (/(early explorers|reception|pre[- ]school|preschool|nursery)/.test(normalized)) return 'pre-school';
  if (/(grade|primary|basic [1-6])/.test(normalized)) return 'primary';
  if (/(jss|junior secondary)/.test(normalized)) return 'junior-secondary';
  if (/(sss|senior secondary)/.test(normalized)) return 'senior-secondary';
  return '';
}

function ensureSchoolId(user: User) {
  return String(user.school_id || 'school-1').trim();
}

function getUserName(user: User) {
  return String(user.name || user.email || user.activeRole || user.roles?.[0] || 'Staff').trim();
}

function getUserRole(user: User) {
  return normalizeRole(user.activeRole || user.roles?.[0]);
}

function getAllowedSectionRoles(classSection?: string) {
  const normalized = normalizeSection(classSection);
  const generic = ['head of section', 'sectional head'];
  if (normalized === 'pre-school') return ['nursery head', ...generic];
  if (normalized === 'primary') return ['head teacher', ...generic];
  if (normalized === 'junior-secondary') return ['junior school principal', 'principal', ...generic];
  if (normalized === 'senior-secondary') return ['principal', ...generic];
  return generic;
}

function calculateAverage(subjects: ResultSubject[]) {
  if (!subjects.length) return 0;
  const total = subjects.reduce((sum, subject) => sum + Number(subject.total || 0), 0);
  return Number((total / subjects.length).toFixed(1));
}

function gradeFromAverage(total: number) {
  if (total >= 70) return 'A';
  if (total >= 60) return 'B';
  if (total >= 50) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

function remarkFromAverage(total: number) {
  if (total >= 70) return 'Excellent';
  if (total >= 60) return 'Very Good';
  if (total >= 50) return 'Credit';
  if (total >= 40) return 'Pass';
  return 'Fail';
}

function defaultTrend(average: number) {
  return [String(Math.max(Math.round(average) - 8, 0)), String(Math.max(Math.round(average) - 4, 0)), String(Math.round(average))];
}

function createDefaultSummary(): ResultSummary {
  return {
    average: '0%',
    grade: 'F',
    position: 'Pending',
    attendance: 'Pending',
    teacherRemark: '',
    principalRemark: '',
    promotion: 'Pending review',
  };
}

function createDefaultTerm(name: string): ResultTerm {
  return {
    name,
    summary: createDefaultSummary(),
    subjects: [],
    trend: ['0', '0', '0'],
    approvals: {},
  };
}

function createDefaultSession(session: string, feeStatus?: string, outstanding?: string): ResultSession {
  return {
    session,
    feeStatus: feeStatus || 'Paid',
    outstanding: outstanding || 'N0',
    terms: [],
  };
}

function ensureStudentRecord(state: ResultsState, user: User, input: UpsertStudentResultInput) {
  const schoolId = ensureSchoolId(user);
  const className = String(input.className || '').trim() || 'Unassigned class';
  const classSection = normalizeSection(input.classSection) || inferSectionFromClassName(className) || undefined;
  let record = state.students.find((entry) => entry.schoolId === schoolId && entry.studentId === input.studentId);
  if (!record) {
    record = {
      id: `result_${crypto.randomUUID()}`,
      schoolId,
      studentId: input.studentId,
      studentName: input.studentName,
      className,
      classSection,
      sessions: [],
      updatedAt: nowIso(),
    };
    state.students.push(record);
  } else {
    record.studentName = input.studentName || record.studentName;
    record.className = className || record.className;
    record.classSection = classSection || record.classSection;
    record.updatedAt = nowIso();
  }
  return record;
}

function sanitizePageTwo(input?: ResultPageTwo) {
  if (!input) return undefined;
  return {
    variant: input.variant || 'none',
    affectiveTraits: Array.isArray(input.affectiveTraits) ? input.affectiveTraits.map((item) => String(item || '').trim()).filter(Boolean) : [],
    physical: input.physical ? {
      height: typeof input.physical.height === 'number' ? input.physical.height : null,
      weight: typeof input.physical.weight === 'number' ? input.physical.weight : null,
    } : undefined,
    nurseryProgressSections: Array.isArray(input.nurseryProgressSections) ? input.nurseryProgressSections : undefined,
    gradeCognitiveSections: Array.isArray(input.gradeCognitiveSections) ? input.gradeCognitiveSections : undefined,
  } satisfies ResultPageTwo;
}

function recomputeTerm(term: ResultTerm, updatedSummary?: Partial<ResultSummary>) {
  const average = calculateAverage(term.subjects);
  const grade = gradeFromAverage(average);
  term.summary = {
    ...term.summary,
    ...updatedSummary,
    average: `${average}%`,
    grade,
    promotion: average >= 40 ? 'Promoted' : 'Pending review',
  };
  term.trend = term.trend?.length ? term.trend : defaultTrend(average);
}

export async function upsertStudentResultForUser(user: User, input: UpsertStudentResultInput) {
  const state = await readState();
  const record = ensureStudentRecord(state, user, input);
  const role = getUserRole(user);

  let session = record.sessions.find((entry) => entry.session === input.session);
  if (!session) {
    session = createDefaultSession(input.session, input.feeStatus, input.outstanding);
    record.sessions.push(session);
  } else {
    session.feeStatus = input.feeStatus || session.feeStatus;
    session.outstanding = input.outstanding || session.outstanding;
  }

  let term = session.terms.find((entry) => entry.name === input.term);
  if (!term) {
    term = createDefaultTerm(input.term);
    session.terms.push(term);
  }

  const subjectName = String(input.subject.subject || '').trim();
  const existingSubjectIndex = term.subjects.findIndex((entry) => entry.subject.toLowerCase() === subjectName.toLowerCase());
  const nextSubject: ResultSubject = {
    subject: subjectName,
    ca: Number(input.subject.ca || 0),
    exam: Number(input.subject.exam || 0),
    total: Number(input.subject.total || 0),
    grade: input.subject.grade || gradeFromAverage(Number(input.subject.total || 0)),
    remark: input.subject.remark || remarkFromAverage(Number(input.subject.total || 0)),
  };

  if (existingSubjectIndex >= 0) {
    term.subjects[existingSubjectIndex] = nextSubject;
  } else {
    term.subjects.push(nextSubject);
  }

  term.summary.teacherRemark = typeof input.summary?.teacherRemark === 'string' ? input.summary.teacherRemark : term.summary.teacherRemark;
  term.summary.position = input.summary?.position || term.summary.position || 'Pending';
  term.summary.attendance = input.summary?.attendance || term.summary.attendance || 'Pending';
  term.summary.teacherSignature = getUserName(user);
  term.approvals = {
    ...term.approvals,
    teacherSavedAt: nowIso(),
  };

  if (role === 'hos' && typeof input.summary?.principalRemark === 'string') {
    term.summary.principalRemark = input.summary.principalRemark;
  }

  term.pageTwo = sanitizePageTwo(input.pageTwo) || term.pageTwo;
  term.trend = Array.isArray(input.trend) && input.trend.length ? input.trend.map((item) => String(item)) : term.trend;
  recomputeTerm(term, input.summary);

  session.terms.sort((left, right) => right.name.localeCompare(left.name));
  record.sessions.sort((left, right) => right.session.localeCompare(left.session));
  record.updatedAt = nowIso();
  await writeState(state);
  return record;
}

export async function approveStudentResultForUser(user: User, studentId: string, sessionName: string, termName: string, remark?: string) {
  const state = await readState();
  const schoolId = ensureSchoolId(user);
  const record = state.students.find((entry) => entry.schoolId === schoolId && entry.studentId === studentId);
  if (!record) {
    const error = new Error('Result record not found.') as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const session = record.sessions.find((entry) => entry.session === sessionName);
  const term = session?.terms.find((entry) => entry.name === termName);
  if (!session || !term) {
    const error = new Error('Requested session/term result was not found.') as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const role = getUserRole(user);
  const signer = getUserName(user);
  const classSection = normalizeSection(record.classSection) || inferSectionFromClassName(record.className);
  const allowedSectionRoles = getAllowedSectionRoles(classSection);

  term.approvals = term.approvals || {};

  if (role === 'hos') {
    if (!term.approvals.sectionalHeadApprovedAt || !term.summary.sectionalSignature) {
      const error = new Error('The sectional head must approve CA scores before HoS approval.') as Error & { status?: number };
      error.status = 400;
      throw error;
    }
    if (term.approvals.hosApprovedAt || term.summary.principalSignature) {
      const error = new Error('The HoS signature has already been applied.') as Error & { status?: number };
      error.status = 400;
      throw error;
    }
    term.summary.principalSignature = signer;
    if (typeof remark === 'string' && remark.trim()) term.summary.principalRemark = remark.trim();
    term.approvals.hosApprovedAt = nowIso();
    term.approvals.hosApprovedBy = signer;
  } else if (allowedSectionRoles.includes(role)) {
    if (term.approvals.sectionalHeadApprovedAt || term.summary.sectionalSignature) {
      const error = new Error('The sectional head signature has already been applied.') as Error & { status?: number };
      error.status = 400;
      throw error;
    }
    term.summary.sectionalSignature = signer;
    if (typeof remark === 'string' && remark.trim()) term.summary.sectionalRemark = remark.trim();
    term.approvals.sectionalHeadApprovedAt = nowIso();
    term.approvals.sectionalHeadApprovedBy = signer;
  } else {
    const error = new Error('Your current role cannot approve CA scores for this section.') as Error & { status?: number };
    error.status = 403;
    throw error;
  }

  record.updatedAt = nowIso();
  await writeState(state);
  return record;
}

export async function listStudentResultsForUser(user: User, filters?: { className?: string; classSection?: string; studentId?: string }) {
  const schoolId = ensureSchoolId(user);
  const role = getUserRole(user);
  const state = await readState();
  const identity = await loadIdentityState();
  const classNameFilter = String(filters?.className || '').trim().toLowerCase();
  const classSectionFilter = normalizeSection(filters?.classSection);
  const studentIdFilter = String(filters?.studentId || '').trim();

  let studentResults = state.students.filter((entry) => entry.schoolId === schoolId);
  if (studentIdFilter) studentResults = studentResults.filter((entry) => entry.studentId === studentIdFilter);
  if (classNameFilter) studentResults = studentResults.filter((entry) => entry.className.toLowerCase() === classNameFilter);
  if (classSectionFilter) studentResults = studentResults.filter((entry) => normalizeSection(entry.classSection) === classSectionFilter);
  studentResults = [...studentResults].sort((left, right) => left.studentName.localeCompare(right.studentName));

  if (['teacher', 'school admin', 'hos', 'owner', 'ict', 'ict manager', 'admin', 'super admin', 'tenant school owner', 'head of section', 'sectional head', 'nursery head', 'head teacher', 'junior school principal', 'principal'].includes(role)) {
    return {
      studentResults,
      sessions: studentIdFilter ? studentResults[0]?.sessions || [] : [],
    };
  }

  if (role === 'student' || role === 'alumni') {
    const linkedStudent = identity.students.find((student) => student.schoolId === schoolId && student.userId === user.id);
    const resultRecord = linkedStudent ? studentResults.find((entry) => entry.studentId === linkedStudent.id) : undefined;
    return {
      studentResults: [],
      sessions: resultRecord?.sessions || [],
    };
  }

  if (role === 'parent') {
    const childStudentIds = identity.students.filter((student) => student.schoolId === schoolId && student.parentUserIds.includes(user.id)).map((student) => student.id);
    const resultRecord = childStudentIds.length ? studentResults.find((entry) => childStudentIds.includes(entry.studentId)) : undefined;
    return {
      studentResults: [],
      sessions: resultRecord?.sessions || [],
    };
  }

  return {
    studentResults: [],
    sessions: studentIdFilter ? studentResults[0]?.sessions || [] : [],
  };
}