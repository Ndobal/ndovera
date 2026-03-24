import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { loadIdentityState } from '../../../../../identity-state.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type ResultDocumentRecord = {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  sourceName: string;
  session?: string;
  term?: string;
  mimeType: string;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  matchedBy: 'student-id' | 'email' | 'ndovera-id' | 'filename' | 'name';
};

type ResultsDocumentsState = {
  records: ResultDocumentRecord[];
};

export type LinkResultDocumentInput = {
  studentRef?: string;
  sourceName: string;
  session?: string;
  term?: string;
  mimeType: string;
  url: string;
};

const NAMESPACE = 'classroom-result-documents';

function defaultState(): ResultsDocumentsState {
  return { records: [] };
}

async function readState() {
  return readDocument<ResultsDocumentsState>(NAMESPACE, GLOBAL_SCOPE, defaultState);
}

async function writeState(state: ResultsDocumentsState) {
  return writeDocument(NAMESPACE, GLOBAL_SCOPE, state);
}

function nowIso() {
  return new Date().toISOString();
}

function ensureSchoolId(user: User) {
  return String(user.school_id || 'school-1').trim();
}

function getUserName(user: User) {
  return String(user.name || user.email || user.activeRole || user.roles?.[0] || 'Staff').trim();
}

function getUserRole(user: User) {
  return String(user.activeRole || user.roles?.[0] || '').trim().toLowerCase();
}

function normalizeText(value?: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value?: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractCandidateTokens(sourceName: string) {
  const normalized = String(sourceName || '').replace(/\.[A-Za-z0-9]+$/, '');
  return normalized
    .split(/[^A-Za-z0-9@._-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

async function resolveStudentForReference(schoolId: string, studentRef: string | undefined, sourceName: string) {
  const state = await loadIdentityState();
  const normalizedRef = normalizeText(studentRef);
  const normalizedNameRef = normalizeName(studentRef);
  const schoolStudents = state.students.filter((student) => student.schoolId === schoolId);
  const schoolUsers = state.users.filter((user) => user.schoolId === schoolId);

  if (normalizedRef) {
    const directStudent = schoolStudents.find((student) => normalizeText(student.id) === normalizedRef || normalizeText(student.userId) === normalizedRef);
    if (directStudent) return { student: directStudent, matchedBy: 'student-id' as const };
    const userByEmail = schoolUsers.find((user) => normalizeText(user.email || '') === normalizedRef || normalizeText(user.id) === normalizedRef || normalizeText(user.aliases.join(' ')) === normalizedRef);
    if (userByEmail) {
      const linkedStudent = schoolStudents.find((student) => student.userId === userByEmail.id);
      if (linkedStudent) return { student: linkedStudent, matchedBy: normalizedRef.includes('@') ? 'email' as const : 'ndovera-id' as const };
    }

    if (normalizedNameRef) {
      const namedStudent = schoolStudents.find((student) => normalizeName(student.name) === normalizedNameRef);
      if (namedStudent) return { student: namedStudent, matchedBy: 'name' as const };
      const namedUser = schoolUsers.find((entry) => normalizeName(entry.name) === normalizedNameRef);
      if (namedUser) {
        const linkedStudent = schoolStudents.find((student) => student.userId === namedUser.id);
        if (linkedStudent) return { student: linkedStudent, matchedBy: 'name' as const };
      }
    }
  }

  const normalizedSourceName = normalizeName(String(sourceName || '').replace(/\.[A-Za-z0-9]+$/, ''));
  if (normalizedSourceName) {
    const namedStudent = schoolStudents.find((student) => normalizedSourceName.includes(normalizeName(student.name)));
    if (namedStudent) return { student: namedStudent, matchedBy: 'name' as const };
    const namedUser = schoolUsers.find((entry) => normalizedSourceName.includes(normalizeName(entry.name)));
    if (namedUser) {
      const linkedStudent = schoolStudents.find((student) => student.userId === namedUser.id);
      if (linkedStudent) return { student: linkedStudent, matchedBy: 'name' as const };
    }
  }

  const filenameTokens = extractCandidateTokens(sourceName);
  for (const token of filenameTokens) {
    const normalizedToken = normalizeText(token);
    const directStudent = schoolStudents.find((student) => normalizeText(student.id) === normalizedToken || normalizeText(student.userId) === normalizedToken);
    if (directStudent) return { student: directStudent, matchedBy: 'filename' as const };
    const userByEmail = schoolUsers.find((user) => normalizeText(user.email || '') === normalizedToken || normalizeText(user.id) === normalizedToken || user.aliases.some((alias) => normalizeText(alias) === normalizedToken));
    if (userByEmail) {
      const linkedStudent = schoolStudents.find((student) => student.userId === userByEmail.id);
      if (linkedStudent) return { student: linkedStudent, matchedBy: 'filename' as const };
    }
  }

  const error = new Error('Could not match this result file to a student. Provide a student ID, NDOvera ID, or email.') as Error & { status?: number };
  error.status = 400;
  throw error;
}

export async function linkResultDocumentForUser(user: User, input: LinkResultDocumentInput) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const { student, matchedBy } = await resolveStudentForReference(schoolId, input.studentRef, input.sourceName);
  const record: ResultDocumentRecord = {
    id: `result_doc_${crypto.randomUUID()}`,
    schoolId,
    studentId: student.id,
    studentName: student.name,
    sourceName: input.sourceName,
    session: String(input.session || '').trim() || undefined,
    term: String(input.term || '').trim() || undefined,
    mimeType: input.mimeType,
    url: input.url,
    uploadedBy: user.id,
    uploadedByName: getUserName(user),
    createdAt: nowIso(),
    matchedBy,
  };
  state.records.unshift(record);
  await writeState(state);
  return record;
}

export async function listResultDocumentsForUser(user: User, filters?: { studentId?: string }) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const studentId = String(filters?.studentId || '').trim();
  const identity = await loadIdentityState();
  const role = getUserRole(user);
  const schoolStudents = identity.students.filter((student) => student.schoolId === schoolId);
  let allowedStudentIds: string[] | null = null;

  if (role === 'student') {
    allowedStudentIds = schoolStudents.filter((student) => student.userId === user.id).map((student) => student.id);
  } else if (role === 'alumni') {
    allowedStudentIds = schoolStudents.filter((student) => student.userId === user.id).map((student) => student.id);
  } else if (role === 'parent') {
    allowedStudentIds = schoolStudents.filter((student) => student.parentUserIds.includes(user.id)).map((student) => student.id);
  }

  return state.records
    .filter((record) => record.schoolId === schoolId)
    .filter((record) => !studentId || record.studentId === studentId)
    .filter((record) => !allowedStudentIds || allowedStudentIds.includes(record.studentId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
