import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type ClassroomSubjectRecord = {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  section?: string;
  classId?: string;
  className?: string;
  teacherId?: string;
  teacherName?: string;
  room?: string;
  accent: string;
  summary: string;
  studentCount: number;
  noteCount: number;
  assignmentCount: number;
  curriculum?: {
    term1: Array<{ id: string; title: string; isTreated: boolean }>;
    term2: Array<{ id: string; title: string; isTreated: boolean }>;
    term3: Array<{ id: string; title: string; isTreated: boolean }>;
  };
  createdAt: string;
  updatedAt: string;
};

type SubjectsState = {
  subjects: ClassroomSubjectRecord[];
};

export type CreateClassroomSubjectInput = {
  name: string;
  code?: string;
  section?: string;
  classId?: string;
  className?: string;
  accent?: string;
  summary?: string;
  room?: string;
  curriculum?: ClassroomSubjectRecord['curriculum'];
};

export type UpdateClassroomSubjectInput = Partial<CreateClassroomSubjectInput>;

const SUBJECT_ACCENTS = ['#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#ef4444'];
function defaultState(): SubjectsState { return { subjects: [] }; }
async function readState() { return readDocument<SubjectsState>('classroom-subjects', GLOBAL_SCOPE, defaultState); }
async function writeState(state: SubjectsState) { return writeDocument('classroom-subjects', GLOBAL_SCOPE, state); }
function nowIso() { return new Date().toISOString(); }
function ensureSchoolId(user: User) { return String(user.school_id || 'school-1').trim(); }
function normalizeSection(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'preschool' || normalized === 'nursery' || normalized === 'pre school') return 'pre-school';
  if (normalized === 'grade') return 'primary';
  if (normalized === 'jss' || normalized === 'junior secondary') return 'junior-secondary';
  if (normalized === 'sss' || normalized === 'senior secondary') return 'senior-secondary';
  return normalized;
}
function createCode(name: string) {
  return name.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).slice(0, 3).map((part) => part.slice(0, 3).toUpperCase()).join('') || 'SUB';
}
function defaultCurriculum() {
  return { term1: [], term2: [], term3: [] };
}

export async function listClassroomSubjectsForUser(user: User, filters?: { classId?: string }) {
  const schoolId = ensureSchoolId(user);
  const classId = String(filters?.classId || '').trim();
  const state = await readState();
  return state.subjects
    .filter((item) => item.schoolId === schoolId)
    .filter((item) => !classId || item.classId === classId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function createClassroomSubjectForUser(user: User, input: CreateClassroomSubjectInput) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const name = String(input.name || '').trim();
  const classId = String(input.classId || '').trim() || undefined;
  const duplicate = state.subjects.find((item) => item.schoolId === schoolId && item.name.trim().toLowerCase() === name.toLowerCase() && String(item.classId || '') === String(classId || ''));
  if (duplicate) {
    const error = new Error('That subject already exists for the selected class.') as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  const createdAt = nowIso();
  const subjectCount = state.subjects.filter((item) => item.schoolId === schoolId).length;
  const nextSubject: ClassroomSubjectRecord = {
    id: `subject_${crypto.randomUUID()}`,
    schoolId,
    name,
    code: String(input.code || '').trim() || createCode(name),
    section: normalizeSection(input.section),
    classId,
    className: String(input.className || '').trim() || undefined,
    room: String(input.room || '').trim() || undefined,
    accent: String(input.accent || '').trim() || SUBJECT_ACCENTS[subjectCount % SUBJECT_ACCENTS.length],
    summary: String(input.summary || '').trim() || `${name} learning space`,
    studentCount: 0,
    noteCount: 0,
    assignmentCount: 0,
    curriculum: input.curriculum || defaultCurriculum(),
    createdAt,
    updatedAt: createdAt,
  };
  state.subjects.push(nextSubject);
  await writeState(state);
  return nextSubject;
}

export async function updateClassroomSubjectForUser(user: User, subjectId: string, input: UpdateClassroomSubjectInput) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const subjectIndex = state.subjects.findIndex((item) => item.id === subjectId && item.schoolId === schoolId);
  if (subjectIndex < 0) {
    const error = new Error('Subject not found.') as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  const current = state.subjects[subjectIndex];
  const nextName = input.name !== undefined ? String(input.name || '').trim() : current.name;
  const nextClassId = input.classId !== undefined ? String(input.classId || '').trim() || undefined : current.classId;
  const duplicate = state.subjects.find((item) => item.schoolId === schoolId && item.id !== subjectId && item.name.trim().toLowerCase() === nextName.toLowerCase() && String(item.classId || '') === String(nextClassId || ''));
  if (duplicate) {
    const error = new Error('Another subject already uses that name for this class.') as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  const nextSubject: ClassroomSubjectRecord = {
    ...current,
    name: nextName,
    code: input.code !== undefined ? (String(input.code || '').trim() || createCode(nextName)) : current.code,
    section: input.section !== undefined ? normalizeSection(input.section) : current.section,
    classId: nextClassId,
    className: input.className !== undefined ? String(input.className || '').trim() || undefined : current.className,
    room: input.room !== undefined ? String(input.room || '').trim() || undefined : current.room,
    accent: input.accent !== undefined ? String(input.accent || '').trim() || current.accent : current.accent,
    summary: input.summary !== undefined ? String(input.summary || '').trim() || `${nextName} learning space` : current.summary,
    curriculum: input.curriculum !== undefined ? input.curriculum : current.curriculum,
    updatedAt: nowIso(),
  };
  state.subjects[subjectIndex] = nextSubject;
  await writeState(state);
  return nextSubject;
}

export async function deleteClassroomSubjectForUser(user: User, subjectId: string) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const subjectIndex = state.subjects.findIndex((item) => item.id === subjectId && item.schoolId === schoolId);
  if (subjectIndex < 0) {
    const error = new Error('Subject not found.') as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  const [removed] = state.subjects.splice(subjectIndex, 1);
  await writeState(state);
  return removed;
}

export async function syncSubjectsForClass(user: User, classId: string, updates: { className?: string; section?: string }) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  let changed = false;
  state.subjects = state.subjects.map((subject) => {
    if (subject.schoolId !== schoolId || subject.classId !== classId) return subject;
    changed = true;
    return {
      ...subject,
      className: updates.className !== undefined ? updates.className : subject.className,
      section: updates.section !== undefined ? normalizeSection(updates.section) : subject.section,
      updatedAt: nowIso(),
    };
  });
  if (changed) await writeState(state);
}

export async function removeSubjectsForClass(user: User, classId: string) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const nextSubjects = state.subjects.filter((subject) => !(subject.schoolId === schoolId && subject.classId === classId));
  if (nextSubjects.length !== state.subjects.length) {
    state.subjects = nextSubjects;
    await writeState(state);
  }
}