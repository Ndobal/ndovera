import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { loadIdentityState } from '../../../../../identity-state.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type HistoryKind = 'old-results' | 'alumni' | 'admission-register' | 'legacy-directory' | 'staff-history' | 'parent-history' | 'general-history';

export type HistoryMappedUser = {
  ref: string;
  matchedUserId?: string;
  matchedStudentId?: string;
  matchedBy?: 'student-id' | 'user-id' | 'email' | 'alias' | 'name';
  targetCategory?: 'student' | 'staff' | 'parent' | 'admin' | 'alumni' | 'unknown';
  status: 'mapped' | 'unmatched';
  rowNumber?: number;
  payload?: Record<string, string>;
};

export type HistoryAssetRecord = {
  id: string;
  schoolId: string;
  uploadedBy: string;
  uploadedByName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  sourceType: 'csv' | 'xlsx' | 'pdf' | 'doc' | 'docx';
  historyKind: HistoryKind;
  status: 'processed' | 'manual-review';
  mappedUsers: HistoryMappedUser[];
  createdAt: string;
};

type HistoryState = {
  assets: HistoryAssetRecord[];
};

export type CreateHistoryAssetInput = {
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  sourceType: HistoryAssetRecord['sourceType'];
  historyKind?: HistoryKind;
  mappedUsers: HistoryMappedUser[];
  status: HistoryAssetRecord['status'];
};

const NAMESPACE = 'school-migration-assets';

function defaultState(): HistoryState {
  return { assets: [] };
}

async function readState() {
  return readDocument<HistoryState>(NAMESPACE, GLOBAL_SCOPE, defaultState);
}

async function writeState(state: HistoryState) {
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

function normalizeText(value?: string) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value?: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickReference(row: Record<string, string>) {
  const entries = Object.entries(row);
  const byName = (names: string[]) => entries.find(([key, value]) => names.includes(normalizeText(key)) && normalizeText(value));
  const exact = byName(['studentid', 'student_id', 'ndoveraid', 'ndovera_id', 'userid', 'user_id', 'email', 'name', 'studentname', 'student_name', 'fullname', 'full_name']);
  if (exact) return String(exact[1] || '').trim();
  return String(entries.find(([, value]) => normalizeText(value))?.[1] || '').trim();
}

function inferTargetCategory(historyKind: HistoryKind): HistoryMappedUser['targetCategory'] {
  if (historyKind === 'alumni') return 'alumni';
  if (historyKind === 'staff-history') return 'staff';
  if (historyKind === 'parent-history') return 'parent';
  if (historyKind === 'old-results' || historyKind === 'admission-register') return 'student';
  return 'unknown';
}

export async function mapHistoryRowsForUser(user: User, rows: Record<string, string>[], historyKind: HistoryKind = 'general-history') {
  const schoolId = ensureSchoolId(user);
  const state = await loadIdentityState();
  const schoolStudents = state.students.filter((student) => student.schoolId === schoolId);
  const schoolUsers = state.users.filter((entry) => entry.schoolId === schoolId);
  const targetCategory = inferTargetCategory(historyKind);

  return rows.map((row, index) => {
    const reference = pickReference(row);
    const normalizedRef = normalizeText(reference);
    const normalizedName = normalizeName(reference);
    const student = schoolStudents.find((entry) => normalizeText(entry.id) === normalizedRef || normalizeText(entry.userId) === normalizedRef);
    if (student) {
      return { ref: reference, matchedStudentId: student.id, matchedUserId: student.userId, matchedBy: 'student-id' as const, targetCategory: 'student' as const, status: 'mapped' as const, rowNumber: index + 1, payload: row };
    }
    if (normalizedName) {
      const namedStudent = schoolStudents.find((entry) => normalizeName(entry.name) === normalizedName);
      if (namedStudent) {
        return { ref: reference, matchedStudentId: namedStudent.id, matchedUserId: namedStudent.userId, matchedBy: 'name' as const, targetCategory: 'student' as const, status: 'mapped' as const, rowNumber: index + 1, payload: row };
      }
    }
    const userMatch = schoolUsers.find((entry) => normalizeText(entry.id) === normalizedRef || normalizeText(entry.email || '') === normalizedRef || entry.aliases.some((alias) => normalizeText(alias) === normalizedRef));
    if (userMatch) {
      const linkedStudent = schoolStudents.find((entry) => entry.userId === userMatch.id);
      return {
        ref: reference,
        matchedUserId: userMatch.id,
        matchedStudentId: linkedStudent?.id,
        matchedBy: normalizeText(userMatch.email || '') === normalizedRef ? 'email' : userMatch.aliases.some((alias) => normalizeText(alias) === normalizedRef) ? 'alias' : 'user-id',
        targetCategory: userMatch.category === 'alumni' ? 'alumni' : userMatch.category,
        status: 'mapped' as const,
        rowNumber: index + 1,
        payload: row,
      };
    }
    if (normalizedName) {
      const namedUser = schoolUsers.find((entry) => normalizeName(entry.name) === normalizedName);
      if (namedUser) {
        const linkedStudent = schoolStudents.find((entry) => entry.userId === namedUser.id);
        return {
          ref: reference,
          matchedUserId: namedUser.id,
          matchedStudentId: linkedStudent?.id,
          matchedBy: 'name' as const,
          targetCategory: namedUser.category === 'alumni' ? 'alumni' : namedUser.category,
          status: 'mapped' as const,
          rowNumber: index + 1,
          payload: row,
        };
      }
    }
    return { ref: reference, targetCategory, status: 'unmatched' as const, rowNumber: index + 1, payload: row };
  });
}

export async function createHistoryAssetForUser(user: User, input: CreateHistoryAssetInput) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const asset: HistoryAssetRecord = {
    id: `history_${crypto.randomUUID()}`,
    schoolId,
    uploadedBy: user.id,
    uploadedByName: getUserName(user),
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    url: input.url,
    sourceType: input.sourceType,
    historyKind: input.historyKind || 'general-history',
    status: input.status,
    mappedUsers: input.mappedUsers,
    createdAt: nowIso(),
  };
  state.assets.unshift(asset);
  await writeState(state);
  return asset;
}

export async function listHistoryAssetsForUser(user: User) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  return state.assets
    .filter((asset) => asset.schoolId === schoolId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listOldResultAssetsForUser(user: User, filters?: { studentId?: string }) {
  const schoolId = ensureSchoolId(user);
  const state = await readState();
  const identity = await loadIdentityState();
  const role = normalizeText(user.activeRole || user.roles?.[0]);
  const schoolStudents = identity.students.filter((student) => student.schoolId === schoolId);
  const requestedStudentId = String(filters?.studentId || '').trim();

  let allowedStudentIds: string[] | null = null;
  if (role === 'student' || role === 'alumni') {
    allowedStudentIds = schoolStudents.filter((student) => student.userId === user.id).map((student) => student.id);
  } else if (role === 'parent') {
    allowedStudentIds = schoolStudents.filter((student) => student.parentUserIds.includes(user.id)).map((student) => student.id);
  } else if (!['teacher', 'school admin', 'hos', 'owner', 'tenant school owner', 'ict', 'ict manager', 'admin', 'principal', 'head teacher', 'sectional head', 'head of section'].includes(role)) {
    allowedStudentIds = [];
  }

  const scopedStudentIds = requestedStudentId ? [requestedStudentId] : allowedStudentIds;
  return state.assets
    .filter((asset) => asset.schoolId === schoolId && asset.historyKind === 'old-results')
    .filter((asset) => {
      if (!scopedStudentIds) return true;
      return asset.mappedUsers.some((entry) => entry.status === 'mapped' && !!entry.matchedStudentId && scopedStudentIds.includes(entry.matchedStudentId));
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export type MigrationMappedUser = HistoryMappedUser;
export type MigrationAssetRecord = HistoryAssetRecord;
export type CreateMigrationAssetInput = CreateHistoryAssetInput;
export async function mapMigrationRowsForUser(user: User, rows: Record<string, string>[], historyKind?: HistoryKind) {
  return mapHistoryRowsForUser(user, rows, historyKind);
}
export async function createMigrationAssetForUser(user: User, input: CreateMigrationAssetInput) {
  return createHistoryAssetForUser(user, input);
}
export async function listMigrationAssetsForUser(user: User) {
  return listHistoryAssetsForUser(user);
}
