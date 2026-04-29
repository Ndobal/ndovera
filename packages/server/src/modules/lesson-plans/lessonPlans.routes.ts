import { Router } from 'express';
import { z } from 'zod';

import { hasPermission, type User } from '../../../rbac.js';
import { getLessonPlanForUser, listLessonPlansForUser, saveLessonPlanForUser } from './lessonPlans.store.js';

export const lessonPlansRouter = Router();

const CREATE_ROLES = new Set(['Teacher', 'Ami', 'Super Admin']);
const SECTIONAL_REVIEW_ROLES = new Set(['Head Teacher', 'Nursery Head', 'HOD', 'HoS', 'Principal', 'Ami', 'Super Admin']);
const HOS_REVIEW_ROLES = new Set(['HoS', 'Principal', 'Owner', 'Ami', 'Super Admin']);

const saveLessonPlanSchema = z.object({
  id: z.string().trim().optional(),
  week: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  class: z.string().trim().optional(),
  className: z.string().trim().optional(),
  date: z.string().trim().optional(),
  status: z.string().trim().optional(),
  submittedAt: z.string().trim().nullable().optional(),
  payload: z.record(z.unknown()).optional(),
});

const reviewLessonPlanSchema = z.object({
  sectionalHead: z.string().trim().optional(),
  hos: z.string().trim().optional(),
  status: z.string().trim().optional(),
});

function getActiveRole(user: User) {
  const active = String(user.activeRole || user.roles?.[0] || '').trim();
  return active || 'Unknown';
}

function canCreateLessonPlan(user: User) {
  const role = getActiveRole(user);
  return CREATE_ROLES.has(role) || hasPermission(user, 'lessons.create');
}

function canReviewSectional(user: User) {
  const role = getActiveRole(user);
  return SECTIONAL_REVIEW_ROLES.has(role) || hasPermission(user, 'section.manage') || hasPermission(user, 'department.manage');
}

function canReviewHos(user: User) {
  const role = getActiveRole(user);
  return HOS_REVIEW_ROLES.has(role) || hasPermission(user, 'school.manage');
}

function canDownloadLessonPlan(user: User, plan: { createdByUserId: string }) {
  const userId = String(user.id || '').trim();
  if (plan.createdByUserId === userId) return true;
  if (canCreateLessonPlan(user)) return true;
  if (canReviewSectional(user)) return true;
  if (canReviewHos(user)) return true;
  return false;
}

lessonPlansRouter.get('/', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });
  return res.json(await listLessonPlansForUser(user));
});

lessonPlansRouter.post('/', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });
  if (!canCreateLessonPlan(user)) return res.status(403).json({ error: 'Forbidden - create/update requires lesson author permission.' });
  const parsed = saveLessonPlanSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid lesson plan payload.' });

  const reviews = parsed.data?.payload && typeof parsed.data.payload === 'object' ? (parsed.data.payload as Record<string, unknown>).reviews : undefined;
  if (reviews && typeof reviews === 'object') {
    return res.status(400).json({ error: 'Review comments must be submitted via /api/lesson-plans/:lessonPlanId/review.' });
  }

  const requestedId = String(parsed.data.id || '').trim();
  if (requestedId) {
    const existing = await getLessonPlanForUser(user, requestedId);
    if (!existing) return res.status(404).json({ error: 'Lesson plan not found.' });
    const actorId = String(user.id || '').trim();
    if (existing.createdByUserId !== actorId && !canReviewHos(user)) {
      return res.status(403).json({ error: 'Forbidden - only the author can edit this lesson plan.' });
    }
  }

  return res.json(await saveLessonPlanForUser(user, parsed.data));
});

lessonPlansRouter.post('/:lessonPlanId/review', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });
  const lessonPlanId = String(req.params.lessonPlanId || '').trim();
  if (!lessonPlanId) return res.status(400).json({ error: 'Lesson plan id is required.' });

  const parsed = reviewLessonPlanSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid review payload.' });

  const existing = await getLessonPlanForUser(user, lessonPlanId);
  if (!existing) return res.status(404).json({ error: 'Lesson plan not found.' });

  const hasSectional = typeof parsed.data.sectionalHead === 'string';
  const hasHos = typeof parsed.data.hos === 'string';
  const hasStatus = typeof parsed.data.status === 'string' && parsed.data.status.trim().length > 0;

  if (!hasSectional && !hasHos && !hasStatus) {
    return res.status(400).json({ error: 'At least one review field or status is required.' });
  }

  if ((hasSectional || hasStatus) && !canReviewSectional(user) && !canReviewHos(user)) {
    return res.status(403).json({ error: 'Forbidden - sectional review permission required.' });
  }
  if ((hasHos || hasStatus) && !canReviewHos(user)) {
    return res.status(403).json({ error: 'Forbidden - HoS review permission required.' });
  }

  const currentPayload = existing.payload && typeof existing.payload === 'object' ? existing.payload : {};
  const currentReviews = currentPayload.reviews && typeof currentPayload.reviews === 'object'
    ? currentPayload.reviews as Record<string, unknown>
    : {};

  const nextReviews = {
    ...currentReviews,
    ...(hasSectional ? { sectionalHead: parsed.data.sectionalHead || '' } : {}),
    ...(hasHos ? { hos: parsed.data.hos || '' } : {}),
  };

  const updated = await saveLessonPlanForUser(user, {
    id: existing.id,
    week: existing.week,
    subject: existing.subject,
    topic: existing.topic,
    className: existing.className,
    date: existing.date,
    status: hasStatus ? parsed.data.status : existing.status,
    submittedAt: existing.submittedAt,
    payload: {
      ...currentPayload,
      reviews: nextReviews,
    },
  });

  return res.json(updated);
});

lessonPlansRouter.get('/:lessonPlanId/download', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });
  const lessonPlanId = String(req.params.lessonPlanId || '').trim();
  if (!lessonPlanId) return res.status(400).json({ error: 'Lesson plan id is required.' });
  const plan = await getLessonPlanForUser(user, lessonPlanId);
  if (!plan) return res.status(404).json({ error: 'Lesson plan not found.' });
  if (!canDownloadLessonPlan(user, plan)) return res.status(403).json({ error: 'Forbidden - download permission required.' });

  const lines = [
    'Lesson Plan',
    '',
    `Week: ${plan.week || 'Week 1'}`,
    `Date: ${plan.date || 'Not set'}`,
    `Subject: ${plan.subject || 'Not set'}`,
    `Topic: ${plan.topic || 'Not set'}`,
    `Class: ${plan.className || 'Not set'}`,
    `Status: ${plan.status || 'Draft'}`,
    '',
    JSON.stringify(plan.payload || {}, null, 2),
  ];

  const safeName = `${plan.topic || plan.subject || 'lesson-plan'}`.replace(/[^a-z0-9-_]+/gi, '_');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.txt"`);
  return res.send(lines.join('\n'));
});
