import { Router } from 'express';
import { z } from 'zod';
import { createCompetition, listCompetitions, listFeatureFlags, setFeatureFlag } from '../../../championship-state.js';
import { listPracticeSetsForAdmin, parseBulkPracticeQuestions, upsertPracticeSetForAdmin } from '../../../packages/server/src/modules/classroom/practiceBank.store.js';

export const championshipSuperRouter = Router();

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
	schoolId: z.string().trim().optional(),
	title: z.string().trim().min(3),
	description: z.string().trim().optional(),
	type: z.enum(['quiz', 'spelling', 'essay', 'math', 'live', 'exam']),
	scope: z.enum(['school', 'global', 'hosted']).default('global'),
	mode: z.enum(['single', 'stage']).default('single'),
	entryFee: z.number().min(0).optional(),
	status: z.enum(['draft', 'scheduled', 'active', 'completed']).optional(),
	startTime: z.string().trim().optional(),
	endTime: z.string().trim().optional(),
	hostOrganization: z.string().trim().optional(),
	hostedByNdovera: z.boolean().optional(),
	isLive: z.boolean().optional(),
	liveRoomUrl: z.string().trim().url().optional().or(z.literal('')),
	practiceSyncEnabled: z.boolean().optional(),
	examFamily: z.enum(['JAMB', 'WAEC', 'NECO', 'IGCSE', 'GCE', 'NABTEB', 'NECO BECE', 'Junior WAEC', 'NCEE', 'School Practice', 'Scholarship']).optional(),
	classBand: z.enum(['Grade 3-6', 'JSS 1-3', 'SS 1-3', 'Mixed']).optional(),
	practiceSubject: z.string().trim().optional(),
	practiceNote: z.string().trim().optional(),
	questions: z.array(questionSchema).min(1),
});

const flagSchema = z.object({ enabled: z.boolean() });
const importSchema = z.object({
	title: z.string().trim().min(3),
	subject: z.string().trim().min(1),
	rawText: z.string().trim().min(10),
	scope: z.enum(['practice', 'exam', 'cbt', 'mid-term']).default('cbt'),
	visibility: z.enum(['global', 'school']).default('global'),
	level: z.string().trim().optional(),
	mode: z.string().trim().optional(),
	note: z.string().trim().optional(),
	examFamily: z.enum(['JAMB', 'WAEC', 'NECO', 'IGCSE', 'GCE', 'NABTEB', 'NECO BECE', 'Junior WAEC', 'NCEE', 'School Practice', 'Scholarship']).optional(),
	classBand: z.enum(['Grade 3-6', 'JSS 1-3', 'SS 1-3', 'Mixed']).optional(),
	tags: z.array(z.string().trim().min(1)).optional(),
});

async function syncCompetitionIntoPracticeBank(payload: {
	competition: { id: string; title: string; type: string; scope: string };
	questions: Array<{ id: string; prompt: string; options: string[]; correctAnswer: string; explanation?: string | null }>;
	examFamily?: 'JAMB' | 'WAEC' | 'NECO' | 'IGCSE' | 'GCE' | 'NABTEB' | 'NECO BECE' | 'Junior WAEC' | 'NCEE' | 'School Practice' | 'Scholarship';
	classBand?: 'Grade 3-6' | 'JSS 1-3' | 'SS 1-3' | 'Mixed';
	subject?: string;
	note?: string;
}) {
	if (payload.competition.type !== 'exam') return null;
	if (payload.examFamily === 'JAMB') return null;
	return upsertPracticeSetForAdmin({
		title: payload.competition.title,
		subject: String(payload.subject || '').trim() || 'General Studies',
		source: payload.competition.scope === 'hosted' ? 'Hosted exam sync' : 'Examination sync',
		scope: 'exam',
		visibility: 'global',
		mode: 'Exam Review',
		note: String(payload.note || '').trim() || 'Automatically synced from examinations for guided practice and review.',
		examFamily: payload.examFamily || 'School Practice',
		classBand: payload.classBand || 'Mixed',
		importedFromCompetitionId: payload.competition.id,
		questions: payload.questions.map((question) => ({
			id: question.id,
			stem: question.prompt,
			options: question.options,
			answer: question.correctAnswer,
			explanation: question.explanation || undefined,
		})),
	});
}

championshipSuperRouter.get('/dashboard', async (_req, res) => {
	try {
		const [featureFlags, competitions] = await Promise.all([
			listFeatureFlags(),
			listCompetitions({ includeGlobal: true }),
		]);
		return res.json({ featureFlags, competitions });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load championship controls.' });
	}
});

championshipSuperRouter.post('/', async (req, res) => {
	const user = (req as any).superUser;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = createSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid championship payload.' });
	try {
		const { practiceSyncEnabled, examFamily, classBand, practiceSubject, practiceNote, ...competitionInput } = parsed.data;
		const result = await createCompetition({ ...competitionInput, schoolId: competitionInput.scope === 'school' ? competitionInput.schoolId || null : null, hostOrganization: competitionInput.hostOrganization || null, hostedByNdovera: competitionInput.scope === 'hosted' ? true : Boolean(competitionInput.hostedByNdovera), liveRoomUrl: competitionInput.liveRoomUrl || null, createdBy: user.id });
		if (practiceSyncEnabled !== false) {
			await syncCompetitionIntoPracticeBank({
				competition: result.competition,
				questions: result.questions,
				examFamily,
				classBand,
				subject: practiceSubject,
				note: practiceNote,
			});
		}
		return res.status(201).json(result);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create championship.' });
	}
});

championshipSuperRouter.get('/practice-bank', async (_req, res) => {
	try {
		return res.json({ sets: await listPracticeSetsForAdmin() });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load practice bank.' });
	}
});

championshipSuperRouter.post('/practice-bank/import', async (req, res) => {
	const user = (req as any).superUser;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = importSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid practice bank payload.' });
	try {
		const questions = parseBulkPracticeQuestions(parsed.data.rawText);
		if (!questions.length) return res.status(400).json({ error: 'No valid questions were detected in the pasted text.' });
		const set = await upsertPracticeSetForAdmin({
			title: parsed.data.title,
			subject: parsed.data.subject,
			scope: parsed.data.scope,
			visibility: parsed.data.visibility,
			level: parsed.data.level,
			mode: parsed.data.mode || 'Bulk import',
			note: parsed.data.note || 'Imported from pasted question text in the super-admin examinations studio.',
			examFamily: parsed.data.examFamily,
			classBand: parsed.data.classBand,
			tags: parsed.data.tags,
			source: 'Super admin bulk import',
			questions,
		});
		return res.status(201).json({ set, parsedCount: questions.length, assistedCount: questions.filter((question) => question.answerSource === 'assisted').length });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to import practice bank.' });
	}
});

championshipSuperRouter.patch('/flags/:name', async (req, res) => {
	const parsed = flagSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid flag payload.' });
	try {
		const flag = await setFeatureFlag(String(req.params.name || '').trim() as any, parsed.data.enabled);
		return res.json(flag);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update feature flag.' });
	}
});