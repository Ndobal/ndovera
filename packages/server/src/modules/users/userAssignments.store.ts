import type { User } from '../../../rbac.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type UserAssignmentRecord = {
  userId: string;
  schoolId: string;
  classId?: string;
  className?: string;
  subjectIds: string[];
  updatedAt: string;
};

type UserAssignmentsState = {
  assignments: UserAssignmentRecord[];
};

function defaultState(): UserAssignmentsState {
  return { assignments: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSubjectIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

async function readState() {
  return readDocument<UserAssignmentsState>('user-assignments', GLOBAL_SCOPE, defaultState);
}

async function writeState(state: UserAssignmentsState) {
  return writeDocument('user-assignments', GLOBAL_SCOPE, state);
}

export async function getAssignmentForUser(userId: string, schoolId?: string) {
  const state = await readState();
  return state.assignments.find((entry) => entry.userId === userId && (!schoolId || entry.schoolId === schoolId)) || null;
}

export async function listAssignmentsForSchool(schoolId: string) {
  const state = await readState();
  return state.assignments.filter((entry) => entry.schoolId === schoolId);
}

export async function upsertAssignmentForUser(input: {
  userId: string;
  schoolId: string;
  classId?: string | null;
  className?: string | null;
  subjectIds?: string[];
}) {
  const state = await readState();
  const index = state.assignments.findIndex((entry) => entry.userId === input.userId && entry.schoolId === input.schoolId);
  const nextRecord: UserAssignmentRecord = {
    userId: input.userId,
    schoolId: input.schoolId,
    classId: String(input.classId || '').trim() || undefined,
    className: String(input.className || '').trim() || undefined,
    subjectIds: normalizeSubjectIds(input.subjectIds),
    updatedAt: nowIso(),
  };
  if (index >= 0) state.assignments[index] = nextRecord;
  else state.assignments.push(nextRecord);
  await writeState(state);
  return nextRecord;
}

export async function removeAssignmentForUser(userId: string, schoolId: string) {
  const state = await readState();
  const nextAssignments = state.assignments.filter((entry) => !(entry.userId === userId && entry.schoolId === schoolId));
  if (nextAssignments.length !== state.assignments.length) {
    state.assignments = nextAssignments;
    await writeState(state);
  }
}

export async function syncAssignmentClassName(schoolId: string, classId: string, className: string) {
  const state = await readState();
  let changed = false;
  state.assignments = state.assignments.map((entry) => {
    if (entry.schoolId !== schoolId || entry.classId !== classId) return entry;
    changed = true;
    return { ...entry, className, updatedAt: nowIso() };
  });
  if (changed) await writeState(state);
}

export async function userCanAccessClass(user: User, classId?: string | null) {
  const normalizedClassId = String(classId || '').trim();
  if (!normalizedClassId) return true;
  const role = String(user.activeRole || user.roles?.[0] || '').trim().toLowerCase();
  if (['owner', 'tenant school owner', 'hos', 'head of school', 'admin', 'super admin', 'ict manager', 'ict'].includes(role)) return true;
  const assignment = await getAssignmentForUser(String(user.id || '').trim(), String(user.school_id || '').trim());
  if (!assignment) return false;
  return assignment.classId === normalizedClassId || assignment.subjectIds.length > 0;
}
