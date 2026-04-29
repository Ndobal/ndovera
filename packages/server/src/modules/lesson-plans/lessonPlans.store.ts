import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type LessonPlanRecord = {
  id: string;
  schoolId: string;
  week: string;
  subject: string;
  topic: string;
  className: string;
  date: string;
  status: string;
  payload: Record<string, unknown>;
  submittedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

type LessonPlanState = {
  plans: LessonPlanRecord[];
};

type SaveLessonPlanInput = {
  id?: string;
  week?: string;
  subject?: string;
  topic?: string;
  class?: string;
  className?: string;
  date?: string;
  status?: string;
  submittedAt?: string | null;
  payload?: Record<string, unknown>;
};

function defaultState(): LessonPlanState {
  return { plans: [] };
}

async function readState() {
  return readDocument<LessonPlanState>('lesson-plans', GLOBAL_SCOPE, defaultState);
}

async function writeState(state: LessonPlanState) {
  return writeDocument('lesson-plans', GLOBAL_SCOPE, state);
}

function nowIso() {
  return new Date().toISOString();
}

function resolveSchoolId(user: User) {
  const schoolId = String(user.effective_school_id || user.school_id || '').trim();
  if (!schoolId) throw new Error('School context is required.');
  return schoolId;
}

function cleanString(value: unknown) {
  return String(value || '').trim();
}

function sanitizePayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function listLessonPlansForUser(user: User) {
  const schoolId = resolveSchoolId(user);
  const state = await readState();
  return state.plans
    .filter((plan) => plan.schoolId === schoolId)
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt);
      const bTime = Date.parse(b.updatedAt);
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return bTime - aTime;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export async function saveLessonPlanForUser(user: User, input: SaveLessonPlanInput) {
  const schoolId = resolveSchoolId(user);
  const state = await readState();
  const timestamp = nowIso();
  const requestedId = cleanString(input.id);
  const nextId = requestedId || `lp_${crypto.randomUUID()}`;
  const existingIndex = state.plans.findIndex((plan) => plan.id === nextId && plan.schoolId === schoolId);
  const subject = cleanString(input.subject);
  const topic = cleanString(input.topic);
  const className = cleanString(input.className || input.class);
  const week = cleanString(input.week) || 'Week 1';
  const status = cleanString(input.status) || 'Draft';
  const submittedAt = input.submittedAt ? cleanString(input.submittedAt) : null;
  const payload = sanitizePayload(input.payload);

  const base: LessonPlanRecord = {
    id: nextId,
    schoolId,
    week,
    subject,
    topic,
    className,
    date: cleanString(input.date),
    status,
    payload,
    submittedAt,
    createdByUserId: String(user.id || '').trim() || 'unknown',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (existingIndex >= 0) {
    const current = state.plans[existingIndex];
    const merged: LessonPlanRecord = {
      ...current,
      ...base,
      createdByUserId: current.createdByUserId,
      createdAt: current.createdAt,
      updatedAt: timestamp,
      payload: {
        ...current.payload,
        ...payload,
      },
    };
    state.plans[existingIndex] = merged;
    await writeState(state);
    return merged;
  }

  state.plans.unshift(base);
  await writeState(state);
  return base;
}

export async function getLessonPlanForUser(user: User, lessonPlanId: string) {
  const schoolId = resolveSchoolId(user);
  const state = await readState();
  const match = state.plans.find((plan) => plan.schoolId === schoolId && plan.id === lessonPlanId);
  return match || null;
}
