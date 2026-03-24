import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

type LessonNoteApprovalStatus = 'Draft' | 'Submitted' | 'Head of Section signed' | 'HOS signed' | 'Approved';
type LessonNoteSignatureRoleLabel = 'Head of Section' | 'HOS';
type LessonNoteSignatureKey = 'headOfSection' | 'hos';

type LessonNoteSignature = {
  signedBy: string;
  signedAt: string;
  roleLabel: LessonNoteSignatureRoleLabel;
};

type LessonNoteApproval = {
  status: LessonNoteApprovalStatus;
  submittedAt?: string;
  submittedBy?: string;
  className?: string;
  classSection?: string;
  headOfSection?: LessonNoteSignature | null;
  hos?: LessonNoteSignature | null;
};

type ClassroomNoteRecord = {
  id: string;
  schoolId: string;
  createdByUserId: string;
  title: string;
  subject: string;
  topic: string;
  className?: string;
  classSection?: string;
  week: number;
  format: string;
  visibility: string;
  duration: string;
  summary: string;
  access: string;
  analytics: {
    views: number;
    downloads: number;
    completion: string;
  };
  versions: string[];
  viewerType?: string;
  materials?: unknown[];
  ndoveraDocument?: unknown | null;
  approval?: LessonNoteApproval;
};

type ClassroomNotesState = {
  notes: ClassroomNoteRecord[];
};

type CreateClassroomNoteInput = {
  title: string;
  subject: string;
  topic: string;
  className?: string;
  classSection?: string;
  week: number;
  summary: string;
  visibility: string;
  format?: string;
  duration?: string;
  access?: string;
  viewerType?: string;
  materials?: unknown[];
  ndoveraDocument?: unknown | null;
};

function defaultState(): ClassroomNotesState {
  return { notes: [] };
}
async function readState() { return readDocument<ClassroomNotesState>('classroom-notes', GLOBAL_SCOPE, defaultState); }
async function writeState(state: ClassroomNotesState) { return writeDocument('classroom-notes', GLOBAL_SCOPE, state); }

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

function formatRoleLabel(role?: string): LessonNoteSignatureRoleLabel {
  const normalized = normalizeRole(role);
  if (!normalized || normalized === 'hos') return 'HOS';
  return String(role || '')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') as LessonNoteSignatureRoleLabel;
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

function resolveSignatureSlot(user: User, classSection?: string): { key: LessonNoteSignatureKey; roleLabel: LessonNoteSignatureRoleLabel } | null {
  const activeRole = normalizeRole(user.activeRole || user.roles?.[0]);
  if (!activeRole) return null;

  if (activeRole === 'hos') {
    return { key: 'hos', roleLabel: 'HOS' };
  }

  if (getAllowedSectionRoles(classSection).includes(activeRole)) {
    return { key: 'headOfSection', roleLabel: formatRoleLabel(user.activeRole || user.roles?.[0] || 'Head of Section') };
  }

  return null;
}

function deriveStatus(approval: LessonNoteApproval): LessonNoteApprovalStatus {
  if (approval.headOfSection && approval.hos) return 'Approved';
  if (approval.hos) return 'HOS signed';
  if (approval.headOfSection) return 'Head of Section signed';
  if (approval.submittedAt) return 'Submitted';
  return 'Draft';
}

function getSignerName(user: User) {
  return String(user.name || user.email || user.activeRole || user.roles?.[0] || 'Staff').trim();
}

function sortNotes(notes: ClassroomNoteRecord[]) {
  return [...notes].sort((left, right) => {
    const leftDate = left.approval?.submittedAt ? new Date(left.approval.submittedAt).getTime() : 0;
    const rightDate = right.approval?.submittedAt ? new Date(right.approval.submittedAt).getTime() : 0;
    return rightDate - leftDate || right.week - left.week || left.subject.localeCompare(right.subject);
  });
}

function ensureAuthenticatedSchool(user: User) {
  return String(user.school_id || 'school-1').trim();
}

function createNoteRecord(user: User, input: CreateClassroomNoteInput): ClassroomNoteRecord {
  const submittedAt = nowIso();
  const className = String(input.className || '').trim() || 'Unassigned class';
  const classSection = normalizeSection(input.classSection) || inferSectionFromClassName(className) || undefined;
  const approval: LessonNoteApproval = {
    status: 'Submitted',
    submittedAt,
    submittedBy: getSignerName(user),
    className,
    classSection,
    headOfSection: null,
    hos: null,
  };

  return {
    id: `lesson_note_${crypto.randomUUID()}`,
    schoolId: ensureAuthenticatedSchool(user),
    createdByUserId: user.id,
    title: input.title,
    subject: input.subject,
    topic: input.topic,
    className,
    classSection,
    week: input.week,
    format: input.format || 'Ndovera document',
    visibility: input.visibility,
    duration: input.duration || 'Flexible',
    summary: input.summary,
    access: input.access || 'Secure in-app viewer only',
    analytics: { views: 0, downloads: 0, completion: '0%' },
    versions: ['v1 current'],
    viewerType: input.viewerType,
    materials: input.materials || [],
    ndoveraDocument: input.ndoveraDocument ?? null,
    approval,
  };
}

export async function listClassroomNotesForUser(user: User) {
  const schoolId = ensureAuthenticatedSchool(user);
  const state = await readState();
  return sortNotes(state.notes.filter((note) => note.schoolId === schoolId));
}

export async function createClassroomNoteForUser(user: User, input: CreateClassroomNoteInput) {
  const state = await readState();
  const note = createNoteRecord(user, input);
  state.notes.unshift(note);
  await writeState(state);
  return note;
}

export async function applyClassroomNoteSignatureForUser(user: User, noteId: string) {
  const schoolId = ensureAuthenticatedSchool(user);

  const state = await readState();
  const noteIndex = state.notes.findIndex((note) => note.id === noteId && note.schoolId === schoolId);
  if (noteIndex < 0) {
    const error = new Error('Lesson note not found.') as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const note = state.notes[noteIndex];
  const approval: LessonNoteApproval = {
    status: note.approval?.status || 'Draft',
    submittedAt: note.approval?.submittedAt,
    submittedBy: note.approval?.submittedBy,
    className: note.approval?.className || note.className,
    classSection: normalizeSection(note.approval?.classSection || note.classSection) || inferSectionFromClassName(note.approval?.className || note.className),
    headOfSection: note.approval?.headOfSection || null,
    hos: note.approval?.hos || null,
  };

  const signatureSlot = resolveSignatureSlot(user, approval.classSection);
  if (!signatureSlot) {
    const error = new Error('Your active role cannot sign this lesson note for this class section.') as Error & { status?: number };
    error.status = 403;
    throw error;
  }

  if (signatureSlot.key === 'hos' && !approval.headOfSection) {
    const error = new Error('The sectional head must sign this lesson note before HOS approval.') as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  if (approval[signatureSlot.key]) {
    const error = new Error(`${signatureSlot.roleLabel} signature has already been applied to this lesson note.`) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  approval[signatureSlot.key] = {
    signedBy: getSignerName(user),
    signedAt: nowIso(),
    roleLabel: signatureSlot.roleLabel,
  };
  approval.status = deriveStatus(approval);

  const updatedNote: ClassroomNoteRecord = {
    ...note,
    approval,
    className: approval.className,
  };

  state.notes[noteIndex] = updatedNote;
  await writeState(state);

  return {
    note: updatedNote,
    appliedSignature: signatureSlot.key,
    signerRoleLabel: signatureSlot.roleLabel,
  };
}