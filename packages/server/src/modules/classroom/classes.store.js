import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_PATH = path.resolve(__dirname, '../../../data/school-classes.json');

function ensureStateDir() { fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true }); }
function defaultState() { return { classes: [] }; }
function readState() {
  ensureStateDir();
  if (!fs.existsSync(STATE_PATH)) return defaultState();
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { classes: Array.isArray(parsed.classes) ? parsed.classes : [] };
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
function normalizedKey(level, name) { return `${String(level || '').trim().toLowerCase()}__${String(name || '').trim().toLowerCase()}`; }
export function listSchoolClassesForUser(user) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  return state.classes.filter((item) => item.schoolId === schoolId).sort((left, right) => `${left.level || ''} ${left.name}`.localeCompare(`${right.level || ''} ${right.name}`));
}
export function createSchoolClassForUser(user, input) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  const name = String(input.name || '').trim();
  const level = String(input.level || '').trim() || undefined;
  const duplicate = state.classes.find((item) => item.schoolId === schoolId && normalizedKey(item.level, item.name) === normalizedKey(level, name));
  if (duplicate) {
    const error = new Error('That class already exists for this school.');
    error.status = 400;
    throw error;
  }
  const createdAt = nowIso();
  const nextClass = {
    id: `class_${crypto.randomUUID()}`,
    schoolId,
    name,
    level,
    section: normalizeSection(input.section),
    teacherId: input.teacher_id,
    teacherName: input.teacherName,
    teacher_name: input.teacherName,
    createdAt,
    updatedAt: createdAt,
  };
  state.classes.push(nextClass);
  writeState(state);
  return nextClass;
}
export function updateSchoolClassForUser(user, classId, input) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  const classIndex = state.classes.findIndex((item) => item.id === classId && item.schoolId === schoolId);
  if (classIndex < 0) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }
  const current = state.classes[classIndex];
  const nextName = input.name !== undefined ? String(input.name || '').trim() : current.name;
  const nextLevel = input.level !== undefined ? String(input.level || '').trim() || undefined : current.level;
  const duplicate = state.classes.find((item) => item.schoolId === schoolId && item.id !== classId && normalizedKey(item.level, item.name) === normalizedKey(nextLevel, nextName));
  if (duplicate) {
    const error = new Error('Another class already uses that level and name.');
    error.status = 400;
    throw error;
  }
  const nextClass = {
    ...current,
    name: nextName,
    level: nextLevel,
    section: input.section !== undefined ? normalizeSection(input.section) : current.section,
    teacherId: input.teacher_id !== undefined ? input.teacher_id : current.teacherId,
    teacherName: input.teacherName !== undefined ? input.teacherName : current.teacherName,
    teacher_name: input.teacherName !== undefined ? input.teacherName : current.teacher_name,
    updatedAt: nowIso(),
  };
  state.classes[classIndex] = nextClass;
  writeState(state);
  return nextClass;
}
export function deleteSchoolClassForUser(user, classId) {
  const schoolId = ensureSchoolId(user);
  const state = readState();
  const classIndex = state.classes.findIndex((item) => item.id === classId && item.schoolId === schoolId);
  if (classIndex < 0) {
    const error = new Error('Class not found.');
    error.status = 404;
    throw error;
  }
  const [removed] = state.classes.splice(classIndex, 1);
  writeState(state);
  return removed;
}