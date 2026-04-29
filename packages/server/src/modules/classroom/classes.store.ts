import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';
import { getAssignmentForUser, syncAssignmentClassName, upsertAssignmentForUser } from '../users/userAssignments.store.js';

export type SchoolClassRecord = {
  id: string;
  schoolId: string;
  name: string;
  level?: string;
  section?: string;
  hierarchyTag?: string;
  hierarchyIndex?: number;
  nextHierarchyTag?: string;
  aliasNames?: string[];
  isDefault?: boolean;
  isOptional?: boolean;
  graduatesToAlumniWhenFinal?: boolean;
  teacherId?: string;
  teacherName?: string;
  teacher_name?: string;
  youtube_playlist_id?: string;
  youtube_playlist_url?: string;
  youtube_playlist_synced_at?: string;
  youtubePlaylistId?: string;
  youtubePlaylistUrl?: string;
  youtubePlaylistSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type ClassesState = {
  classes: SchoolClassRecord[];
};

export type CreateSchoolClassInput = {
  name: string;
  level?: string;
  section?: string;
  aliasNames?: string[];
  teacher_id?: string;
  teacherName?: string;
};

export type UpdateSchoolClassInput = Partial<CreateSchoolClassInput>;

function defaultState(): ClassesState {
  return { classes: [] };
}

async function readState() { return readDocument<ClassesState>('school-classes', GLOBAL_SCOPE, defaultState); }
async function writeState(state: ClassesState) { return writeDocument('school-classes', GLOBAL_SCOPE, state); }

function nowIso() {
  return new Date().toISOString();
}

type DefaultClassBlueprint = {
  key: string;
  section: string;
  level: string;
  name: string;
  aliases: string[];
  nextKey?: string;
  optional?: boolean;
  graduatesToAlumniWhenFinal?: boolean;
};

const DEFAULT_CLASS_BLUEPRINTS: DefaultClassBlueprint[] = [
  { key: 'creche', section: 'pre-school', level: 'Creche', name: 'Creche', aliases: ['Daycare', 'Early Years'], nextKey: 'explorers' },
  { key: 'explorers', section: 'pre-school', level: 'Explorers', name: 'Explorers', aliases: ['Early Explorers'], nextKey: 'reception' },
  { key: 'reception', section: 'pre-school', level: 'Reception', name: 'Reception', aliases: ['Wright Brothers'], nextKey: 'pre-school-1' },
  { key: 'pre-school-1', section: 'pre-school', level: 'Pre-School 1', name: 'Pre-School 1', aliases: ['Nursery 1'], nextKey: 'pre-school-2' },
  { key: 'pre-school-2', section: 'pre-school', level: 'Pre-School 2', name: 'Pre-School 2', aliases: ['Nursery 2'], nextKey: 'grade-1' },
  { key: 'grade-1', section: 'primary', level: 'Grade 1', name: 'Grade 1', aliases: ['Primary 1'], nextKey: 'grade-2' },
  { key: 'grade-2', section: 'primary', level: 'Grade 2', name: 'Grade 2', aliases: ['Primary 2'], nextKey: 'grade-3' },
  { key: 'grade-3', section: 'primary', level: 'Grade 3', name: 'Grade 3', aliases: ['Primary 3'], nextKey: 'grade-4' },
  { key: 'grade-4', section: 'primary', level: 'Grade 4', name: 'Grade 4', aliases: ['Primary 4'], nextKey: 'grade-5' },
  { key: 'grade-5', section: 'primary', level: 'Grade 5', name: 'Grade 5', aliases: ['Primary 5', 'Apollos'], nextKey: 'grade-6', graduatesToAlumniWhenFinal: true },
  { key: 'grade-6', section: 'primary', level: 'Grade 6', name: 'Grade 6', aliases: ['Primary 6'], optional: true, nextKey: 'jhs-1', graduatesToAlumniWhenFinal: true },
  { key: 'jhs-1', section: 'junior-secondary', level: 'JHS 1', name: 'JHS 1', aliases: ['JSS 1', 'Junior Secondary School 1'], nextKey: 'jhs-2' },
  { key: 'jhs-2', section: 'junior-secondary', level: 'JHS 2', name: 'JHS 2', aliases: ['JSS 2', 'Junior Secondary School 2'], nextKey: 'jhs-3' },
  { key: 'jhs-3', section: 'junior-secondary', level: 'JHS 3', name: 'JHS 3', aliases: ['JSS 3', 'Junior Secondary School 3'], nextKey: 'shs-1', graduatesToAlumniWhenFinal: true },
  { key: 'shs-1', section: 'senior-secondary', level: 'SHS 1', name: 'SHS 1', aliases: ['SS 1', 'SSS 1', 'Senior Secondary School 1'], nextKey: 'shs-2' },
  { key: 'shs-2', section: 'senior-secondary', level: 'SHS 2', name: 'SHS 2', aliases: ['SS 2', 'SSS 2', 'Senior Secondary School 2'], nextKey: 'shs-3' },
  { key: 'shs-3', section: 'senior-secondary', level: 'SHS 3', name: 'SHS 3', aliases: ['SS 3', 'SSS 3', 'Senior Secondary School 3'], graduatesToAlumniWhenFinal: true },
];

const blueprintByKey = new Map(DEFAULT_CLASS_BLUEPRINTS.map((blueprint, index) => [blueprint.key, { ...blueprint, hierarchyIndex: index + 1 }]));

function ensureSchoolId(user: User) {
  return String(user.school_id || 'school-1').trim();
}

function normalizeSection(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'preschool' || normalized === 'nursery' || normalized === 'pre school') return 'pre-school';
  if (normalized === 'grade') return 'primary';
  if (normalized === 'jss' || normalized === 'junior secondary') return 'junior-secondary';
  if (normalized === 'sss' || normalized === 'senior secondary') return 'senior-secondary';
  return normalized;
}

function normalizedKey(level?: string, name?: string) {
  return `${String(level || '').trim().toLowerCase()}__${String(name || '').trim().toLowerCase()}`;
}

function normalizeAliasNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function buildBlueprintMatchTokens(blueprint: DefaultClassBlueprint) {
  return [blueprint.key, blueprint.level, blueprint.name, ...blueprint.aliases].map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
}

function resolveBlueprint(level?: string, name?: string, section?: string) {
  const normalizedSection = normalizeSection(section);
  const wanted = [String(level || '').trim().toLowerCase(), String(name || '').trim().toLowerCase()].filter(Boolean);
  for (const blueprint of DEFAULT_CLASS_BLUEPRINTS) {
    if (normalizedSection && normalizedSection !== blueprint.section) continue;
    const tokens = buildBlueprintMatchTokens(blueprint);
    if (!wanted.length) continue;
    if (wanted.some((entry) => tokens.includes(entry))) return blueprintByKey.get(blueprint.key);
  }
  return null;
}

function applyHierarchyMetadata(input: { level?: string; name?: string; section?: string; aliasNames?: string[] }, current?: SchoolClassRecord | null) {
  const blueprint = resolveBlueprint(input.level, input.name, input.section) || (current?.hierarchyTag ? blueprintByKey.get(String(current.hierarchyTag)) : null);
  const aliasNames = normalizeAliasNames(input.aliasNames).length
    ? normalizeAliasNames(input.aliasNames)
    : blueprint?.aliases || current?.aliasNames || [];
  if (!blueprint) {
    return {
      hierarchyTag: current?.hierarchyTag || String(input.level || input.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      hierarchyIndex: current?.hierarchyIndex || 1000,
      nextHierarchyTag: current?.nextHierarchyTag,
      aliasNames,
      isDefault: current?.isDefault || false,
      isOptional: current?.isOptional || false,
      graduatesToAlumniWhenFinal: current?.graduatesToAlumniWhenFinal || false,
    };
  }
  return {
    hierarchyTag: blueprint.key,
    hierarchyIndex: blueprint.hierarchyIndex,
    nextHierarchyTag: blueprint.nextKey,
    aliasNames,
    isDefault: true,
    isOptional: Boolean(blueprint.optional),
    graduatesToAlumniWhenFinal: Boolean(blueprint.graduatesToAlumniWhenFinal),
  };
}

function seedDefaultClassesForSchool(state: ClassesState, schoolId: string) {
  if (state.classes.some((item) => item.schoolId === schoolId)) return state;
  const createdAt = nowIso();
  state.classes.push(...DEFAULT_CLASS_BLUEPRINTS.map((blueprint, index) => ({
    id: `class_${crypto.randomUUID()}`,
    schoolId,
    name: blueprint.name,
    level: blueprint.level,
    section: blueprint.section,
    hierarchyTag: blueprint.key,
    hierarchyIndex: index + 1,
    nextHierarchyTag: blueprint.nextKey,
    aliasNames: blueprint.aliases,
    isDefault: true,
    isOptional: Boolean(blueprint.optional),
    graduatesToAlumniWhenFinal: Boolean(blueprint.graduatesToAlumniWhenFinal),
    createdAt,
    updatedAt: createdAt,
  })));
  return state;
}

export async function listSchoolClassesForUser(user: User) {
  const schoolId = ensureSchoolId(user);
  const role = String(user.activeRole || user.roles?.[0] || '').trim().toLowerCase();
  const state = seedDefaultClassesForSchool(await readState(), schoolId);
  await writeState(state);
  let visibleClasses = state.classes
    .filter((item) => item.schoolId === schoolId)
    .sort((left, right) => {
      const indexDelta = Number(left.hierarchyIndex || 1000) - Number(right.hierarchyIndex || 1000);
      if (indexDelta !== 0) return indexDelta;
      return `${left.level || ''} ${left.name}`.localeCompare(`${right.level || ''} ${right.name}`);
    });
  if (['owner', 'tenant school owner', 'hos', 'head of school', 'admin', 'super admin', 'ict manager', 'ict'].includes(role)) return visibleClasses;
  if (role === 'teacher' || role === 'staff') {
    visibleClasses = visibleClasses.filter((item) => item.teacherId === user.id);
    if (visibleClasses.length) return visibleClasses;
  }
  const assignment = await getAssignmentForUser(String(user.id || '').trim(), schoolId);
  if (assignment?.classId) return visibleClasses.filter((item) => item.id === assignment.classId);
  return [];
}

export async function createSchoolClassForUser(user: User, input: CreateSchoolClassInput) {
  const schoolId = ensureSchoolId(user);
  const state = seedDefaultClassesForSchool(await readState(), schoolId);
  const name = String(input.name || '').trim();
  const level = String(input.level || '').trim() || undefined;
  const duplicate = state.classes.find((item) => item.schoolId === schoolId && normalizedKey(item.level, item.name) === normalizedKey(level, name));
  if (duplicate) {
    const error = new Error('That class already exists for this school.') as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  const createdAt = nowIso();
  const nextClass: SchoolClassRecord = {
    id: `class_${crypto.randomUUID()}`,
    schoolId,
    name,
    level,
    section: normalizeSection(input.section),
    ...applyHierarchyMetadata({ level, name, section: input.section, aliasNames: input.aliasNames }),
    teacherId: input.teacher_id,
    teacherName: input.teacherName,
    teacher_name: input.teacherName,
    createdAt,
    updatedAt: createdAt,
  };
  state.classes.push(nextClass);
  await writeState(state);
  const className = [nextClass.level, nextClass.name].filter(Boolean).join(' ').trim() || nextClass.name;
  if (nextClass.teacherId) {
    const existing = await getAssignmentForUser(nextClass.teacherId, schoolId);
    await upsertAssignmentForUser({
      userId: nextClass.teacherId,
      schoolId,
      classId: nextClass.id,
      className,
      subjectIds: existing?.subjectIds || [],
    });
  }
  return nextClass;
}

export async function updateSchoolClassForUser(user: User, classId: string, input: UpdateSchoolClassInput) {
  const schoolId = ensureSchoolId(user);
  const state = seedDefaultClassesForSchool(await readState(), schoolId);
  const classIndex = state.classes.findIndex((item) => item.id === classId && item.schoolId === schoolId);
  if (classIndex < 0) {
    const error = new Error('Class not found.') as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  const current = state.classes[classIndex];
  const nextName = input.name !== undefined ? String(input.name || '').trim() : current.name;
  const nextLevel = input.level !== undefined ? String(input.level || '').trim() || undefined : current.level;
  const duplicate = state.classes.find((item) => item.schoolId === schoolId && item.id !== classId && normalizedKey(item.level, item.name) === normalizedKey(nextLevel, nextName));
  if (duplicate) {
    const error = new Error('Another class already uses that level and name.') as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  const nextClass: SchoolClassRecord = {
    ...current,
    name: nextName,
    level: nextLevel,
    section: input.section !== undefined ? normalizeSection(input.section) : current.section,
    ...applyHierarchyMetadata({
      level: nextLevel,
      name: nextName,
      section: input.section !== undefined ? input.section : current.section,
      aliasNames: input.aliasNames,
    }, current),
    teacherId: input.teacher_id !== undefined ? input.teacher_id : current.teacherId,
    teacherName: input.teacherName !== undefined ? input.teacherName : current.teacherName,
    teacher_name: input.teacherName !== undefined ? input.teacherName : current.teacher_name,
    updatedAt: nowIso(),
  };
  state.classes[classIndex] = nextClass;
  await writeState(state);
  const className = [nextClass.level, nextClass.name].filter(Boolean).join(' ').trim() || nextClass.name;
  await syncAssignmentClassName(schoolId, nextClass.id, className);
  if (nextClass.teacherId) {
    const existing = await getAssignmentForUser(nextClass.teacherId, schoolId);
    await upsertAssignmentForUser({
      userId: nextClass.teacherId,
      schoolId,
      classId: nextClass.id,
      className,
      subjectIds: existing?.subjectIds || [],
    });
  }
  return nextClass;
}

export async function deleteSchoolClassForUser(user: User, classId: string) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const classIndex = state.classes.findIndex((item) => item.id === classId && item.schoolId === schoolId);
  if (classIndex < 0) {
    const error = new Error('Class not found.') as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  const [removed] = state.classes.splice(classIndex, 1);
  await writeState(state);
  return removed;
}
