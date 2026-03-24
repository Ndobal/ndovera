import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SUBJECT_ACCENTS = ['#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#ef4444'];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_PATH = path.resolve(__dirname, '../../../data/classroom-subjects.json');
function ensureStateDir() { fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true }); }
function defaultState() { return { subjects: [] }; }
function readState() {
  ensureStateDir();
  if (!fs.existsSync(STATE_PATH)) return defaultState();
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [] };
  } catch { return defaultState(); }
}
function writeState(state) { ensureStateDir(); fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2)); }
function nowIso() { return new Date().toISOString(); }
function ensureSchoolId(user) { return String(user.school_id || 'school-1').trim(); }
function normalizeSection(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'preschool' || normalized === 'nursery' || normalized === 'pre school') return 'pre-school';
  if (normalized === 'grade') return 'primary';
  if (normalized === 'jss' || normalized === 'junior secondary') return 'junior-secondary';
  if (normalized === 'sss' || normalized === 'senior secondary') return 'senior-secondary';
  return normalized;
}
function createCode(name) {
  return name.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).slice(0, 3).map((part) => part.slice(0, 3).toUpperCase()).join('') || 'SUB';
}
function defaultCurriculum() { return { term1: [], term2: [], term3: [] }; }
export function listClassroomSubjectsForUser(user, filters) {
  const schoolId = ensureSchoolId(user);
  const classId = String(filters?.classId || '').trim();
  const state = readState();
  return state.subjects.filter((item) => item.schoolId === schoolId).filter((item) => !classId || item.classId === classId).sort((left, right) => left.name.localeCompare(right.name));
}
export function createClassroomSubjectForUser(user, input) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  const name = String(input.name || '').trim();
  const classId = String(input.classId || '').trim() || undefined;
  const duplicate = state.subjects.find((item) => item.schoolId === schoolId && item.name.trim().toLowerCase() === name.toLowerCase() && String(item.classId || '') === String(classId || ''));
  if (duplicate) {
    const error = new Error('That subject already exists for the selected class.');
    error.status = 400;
    throw error;
  }
  const createdAt = nowIso();
  const subjectCount = state.subjects.filter((item) => item.schoolId === schoolId).length;
  const nextSubject = {
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
  writeState(state);
  return nextSubject;
}
export function updateClassroomSubjectForUser(user, subjectId, input) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  const subjectIndex = state.subjects.findIndex((item) => item.id === subjectId && item.schoolId === schoolId);
  if (subjectIndex < 0) {
    const error = new Error('Subject not found.');
    error.status = 404;
    throw error;
  }
  const current = state.subjects[subjectIndex];
  const nextName = input.name !== undefined ? String(input.name || '').trim() : current.name;
  const nextClassId = input.classId !== undefined ? String(input.classId || '').trim() || undefined : current.classId;
  const duplicate = state.subjects.find((item) => item.schoolId === schoolId && item.id !== subjectId && item.name.trim().toLowerCase() === nextName.toLowerCase() && String(item.classId || '') === String(nextClassId || ''));
  if (duplicate) {
    const error = new Error('Another subject already uses that name for this class.');
    error.status = 400;
    throw error;
  }
  const nextSubject = {
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
  writeState(state);
  return nextSubject;
}
export function deleteClassroomSubjectForUser(user, subjectId) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  const subjectIndex = state.subjects.findIndex((item) => item.id === subjectId && item.schoolId === schoolId);
  if (subjectIndex < 0) {
    const error = new Error('Subject not found.');
    error.status = 404;
    throw error;
  }
  const [removed] = state.subjects.splice(subjectIndex, 1);
  writeState(state);
  return removed;
}
export function syncSubjectsForClass(user, classId, updates) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  let changed = false;
  state.subjects = state.subjects.map((subject) => {
    if (subject.schoolId !== schoolId || subject.classId !== classId) return subject;
    changed = true;
    return { ...subject, className: updates.className !== undefined ? updates.className : subject.className, section: updates.section !== undefined ? normalizeSection(updates.section) : subject.section, updatedAt: nowIso() };
  });
  if (changed) writeState(state);
}
export function removeSubjectsForClass(user, classId) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  const nextSubjects = state.subjects.filter((subject) => !(subject.schoolId === schoolId && subject.classId === classId));
  if (nextSubjects.length !== state.subjects.length) {
    state.subjects = nextSubjects;
    writeState(state);
  }
}