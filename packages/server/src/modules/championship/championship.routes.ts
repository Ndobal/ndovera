import { Router } from 'express';
import { z } from 'zod';
import { createCompetition, getCompetitionDetail, joinCompetition, listCompetitions, recordViolation, submitCompetitionAnswer } from '../../../../../championship-state.js';
import { requireRoles } from '../../../rbac.js';

export const championshipRouter = Router();

const questionSchema = z.object({
	type: z.string().trim().min(1),
	prompt: z.string().trim().min(3),
	options: z.array(z.string().trim()).optional(),
	correctAnswer: z.string().trim().min(1),
	explanation: z.string().trim().optional(),
	extraData: z.record(z.any()).optional(),
	points: z.number().int().min(1).max(100).optional(),
});

const createSchema = z.object({
	title: z.string().trim().min(3),
	description: z.string().trim().optional(),
	type: z.enum(['quiz', 'spelling', 'essay', 'math', 'live', 'exam']),
	scope: z.enum(['school', 'global', 'hosted']).default('school'),
	mode: z.enum(['single', 'stage']).default('single'),
	entryFee: z.number().min(0).optional(),
	status: z.enum(['draft', 'scheduled', 'active', 'completed']).optional(),
	startTime: z.string().trim().optional(),
	endTime: z.string().trim().optional(),
	hostOrganization: z.string().trim().optional(),
	hostedByNdovera: z.boolean().optional(),
	isLive: z.boolean().optional(),
	liveRoomUrl: z.string().trim().url().optional().or(z.literal('')),
	questions: z.array(questionSchema).min(1),
});

const answerSchema = z.object({
	questionId: z.string().trim().min(1),
	answer: z.string().trim().min(1),
	timeTaken: z.number().int().min(0).max(60 * 60 * 1000).optional(),
});

const violationSchema = z.object({
	type: z.string().trim().min(2),
	metadata: z.record(z.any()).optional(),
});

championshipRouter.get('/portal', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		const competitions = await listCompetitions({ schoolId: user.school_id, userId: user.id, includeGlobal: true });
		return res.json({ competitions, currentRole: user.activeRole || user.roles?.[0] || null, canManage: ['Scholarships Admin', 'School Admin', 'HoS', 'HOS', 'Super Admin'].includes(user.activeRole || user.roles?.[0]) });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load championships.' });
	}
});

championshipRouter.get('/:competitionId', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		const role = user.activeRole || user.roles?.[0] || '';
		const detail = await getCompetitionDetail({ competitionId: String(req.params.competitionId || '').trim(), viewerUserId: user.id, schoolId: user.school_id, includeAnswers: ['Scholarships Admin', 'School Admin', 'HoS', 'HOS', 'Super Admin'].includes(role) });
		return res.json(detail);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load competition.' });
	}
});

championshipRouter.post('/', requireRoles('Scholarships Admin', 'School Admin', 'HoS', 'HOS', 'Super Admin'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = createSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid championship payload.' });
	try {
		const result = await createCompetition({ ...parsed.data, scope: 'school', schoolId: user.school_id || null, hostOrganization: parsed.data.hostOrganization || null, hostedByNdovera: false, liveRoomUrl: parsed.data.liveRoomUrl || null, createdBy: user.id });
		return res.status(201).json(result);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create championship.' });
	}
});

championshipRouter.post('/:competitionId/join', requireRoles('Student'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		const detail = await joinCompetition({ competitionId: String(req.params.competitionId || '').trim(), userId: user.id, schoolId: user.school_id || null });
		return res.status(201).json(detail);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to join championship.' });
	}
});

championshipRouter.post('/:competitionId/answers', requireRoles('Student'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = answerSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid answer payload.' });
	try {
		const detail = await submitCompetitionAnswer({ competitionId: String(req.params.competitionId || '').trim(), userId: user.id, schoolId: user.school_id || null, ...parsed.data });
		return res.json(detail);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to submit answer.' });
	}
});

championshipRouter.post('/:competitionId/violations', requireRoles('Student'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = violationSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid violation payload.' });
	try {
		const detail = await recordViolation({ competitionId: String(req.params.competitionId || '').trim(), userId: user.id, schoolId: user.school_id || null, type: parsed.data.type, metadata: parsed.data.metadata || null });
		return res.json(detail);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to record violation.' });
	}
});