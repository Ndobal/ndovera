import { Router } from 'express';
import { z } from 'zod';
import { applyClassroomNoteSignatureForUser, createClassroomNoteForUser, listClassroomNotesForUser } from './classroomNotes.store.js';
import { consumeAiCredits } from '../finance/credits.store.js';
import { listHistoryAssetsForUser, listOldResultAssetsForUser } from './migration.store.js';
import { createPracticeSetForUser, deriveExplanationForQuestion, listPracticeSetsForUser } from './practiceBank.store.js';
import { approveStudentResultForUser, listStudentResultsForUser, upsertStudentResultForUser } from './classroomResults.store.js';
import { listResultDocumentsForUser } from './resultsDocuments.store.js';
import { createClassroomSubjectForUser, deleteClassroomSubjectForUser, listClassroomSubjectsForUser, updateClassroomSubjectForUser } from './subjects.store.js';
import { closeLiveClassForUser, createLiveClassForUser, joinLiveClassForUser, listLiveClassesForUser } from '../operations/schoolOps.store.js';

export const classroomRouter = Router();

const createClassroomNoteSchema = z.object({
	title: z.string().trim().min(1),
	subject: z.string().trim().min(1),
	topic: z.string().trim().min(1),
	className: z.string().trim().optional(),
	classSection: z.string().trim().optional(),
	week: z.coerce.number().int().min(1).max(40),
	summary: z.string().trim().min(1),
	visibility: z.string().trim().min(1),
	format: z.string().trim().optional(),
	duration: z.string().trim().optional(),
	access: z.string().trim().optional(),
	viewerType: z.string().trim().optional(),
	materials: z.array(z.any()).optional(),
	ndoveraDocument: z.any().nullable().optional(),
});

const resultSubjectSchema = z.object({
	subject: z.string().trim().min(1),
	ca: z.coerce.number().min(0),
	exam: z.coerce.number().min(0),
	total: z.coerce.number().min(0),
	grade: z.string().trim().optional(),
	remark: z.string().trim().optional(),
});

const resultSummarySchema = z.object({
	attendance: z.string().trim().optional(),
	position: z.string().trim().optional(),
	teacherRemark: z.string().optional(),
	principalRemark: z.string().optional(),
}).optional();

const nurseryProgressSectionSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	items: z.array(z.object({
		no: z.string().trim().min(1),
		text: z.string().trim().min(1),
		status: z.enum(['not_yet', 'progressing', 'yes']),
	})).optional().default([]),
});

const gradeCognitiveSectionSchema = z.object({
	id: z.string().trim().min(1),
	title: z.string().trim().min(1),
	items: z.array(z.object({
		label: z.string().trim().min(1),
		rating: z.coerce.number().min(1).max(5),
	})).optional(),
	content: z.array(z.object({
		sub: z.string().trim().min(1),
		items: z.array(z.object({
			label: z.string().trim().min(1),
			rating: z.coerce.number().min(1).max(5),
		})),
	})).optional(),
});

const pageTwoSchema = z.object({
	variant: z.enum(['none', 'nursery-progress', 'grade-cognitive']),
	affectiveTraits: z.array(z.string().trim().min(1)).optional().default([]),
	physical: z.object({
		height: z.coerce.number().nullable().optional(),
		weight: z.coerce.number().nullable().optional(),
	}).optional(),
	nurseryProgressSections: z.array(nurseryProgressSectionSchema).optional(),
	gradeCognitiveSections: z.array(gradeCognitiveSectionSchema).optional(),
}).optional();

const upsertResultSchema = z.object({
	studentId: z.string().trim().min(1),
	studentName: z.string().trim().min(1),
	className: z.string().trim().optional(),
	classSection: z.string().trim().optional(),
	session: z.string().trim().min(1),
	term: z.string().trim().min(1),
	feeStatus: z.string().trim().optional(),
	outstanding: z.string().trim().optional(),
	subject: resultSubjectSchema,
	summary: resultSummarySchema,
	trend: z.array(z.string()).optional(),
	pageTwo: pageTwoSchema,
});

const approveResultSchema = z.object({
	session: z.string().trim().min(1),
	term: z.string().trim().min(1),
	remark: z.string().optional(),
});

const classroomSubjectSchema = z.object({
	name: z.string().trim().min(1),
	code: z.string().trim().optional(),
	section: z.string().trim().optional(),
	classId: z.string().trim().optional(),
	className: z.string().trim().optional(),
	teacherId: z.string().trim().optional(),
	teacherName: z.string().trim().optional(),
	accent: z.string().trim().optional(),
	summary: z.string().trim().optional(),
	room: z.string().trim().optional(),
	curriculum: z.object({
		term1: z.array(z.object({ id: z.string().trim().min(1), title: z.string().trim().min(1), isTreated: z.boolean() })),
		term2: z.array(z.object({ id: z.string().trim().min(1), title: z.string().trim().min(1), isTreated: z.boolean() })),
		term3: z.array(z.object({ id: z.string().trim().min(1), title: z.string().trim().min(1), isTreated: z.boolean() })),
	}).optional(),
});

const classroomSubjectUpdateSchema = classroomSubjectSchema.partial();
const liveClassSchema = z.object({ title: z.string().trim().min(1), mode: z.string().trim().min(1), schedule: z.string().trim().min(1), duration: z.string().trim().min(1) });
const practiceQuestionSchema = z.object({
	id: z.string().trim().optional(),
	stem: z.string().trim().min(1),
	options: z.array(z.string().trim().min(1)).min(2).max(4),
	answer: z.string().trim().optional(),
	explanation: z.string().trim().optional(),
	hint: z.string().trim().optional(),
});
const createPracticeSetSchema = z.object({
	source: z.string().trim().optional(),
	scope: z.enum(['practice', 'exam', 'cbt', 'mid-term']).optional(),
	visibility: z.enum(['global', 'school']).optional(),
	subject: z.string().trim().min(1),
	title: z.string().trim().min(1),
	level: z.string().trim().optional(),
	mode: z.string().trim().optional(),
	reward: z.string().trim().optional(),
	note: z.string().trim().optional(),
	examFamily: z.enum(['JAMB', 'WAEC', 'NECO', 'IGCSE', 'GCE', 'NABTEB', 'NECO BECE', 'Junior WAEC', 'NCEE', 'School Practice', 'Scholarship']).optional(),
	classBand: z.enum(['Grade 3-6', 'JSS 1-3', 'SS 1-3', 'Mixed']).optional(),
	tags: z.array(z.string().trim().min(1)).optional(),
	questions: z.array(practiceQuestionSchema).min(1).max(100),
});
const explainQuestionSchema = z.object({
	stem: z.string().trim().min(1),
	options: z.array(z.string().trim().min(1)).min(2).max(4),
	answer: z.string().trim().min(1),
	explanation: z.string().trim().optional(),
});

function canManagePracticeBank(user: { activeRole?: string; roles?: string[] }) {
	const role = String(user.activeRole || user.roles?.[0] || '').trim().toLowerCase();
	return role !== 'student' && role !== 'parent';
}

classroomRouter.get('/notes', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await listClassroomNotesForUser(user));
});

classroomRouter.post('/notes', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });

	const parsed = createClassroomNoteSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid classroom note payload.' });
	}

	const note = await createClassroomNoteForUser(user, parsed.data);
	return res.status(201).json(note);
});

classroomRouter.post('/notes/:noteId/signature', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });

	try {
		const result = await applyClassroomNoteSignatureForUser(user, String(req.params.noteId || '').trim());
		return res.json(result);
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to sign lesson note.';
		return res.status(status || 500).json({ error: message });
	}
});

classroomRouter.get('/live-classes', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await listLiveClassesForUser(user));
});
classroomRouter.post('/live-classes', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = liveClassSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid live class payload.' });
	try {
		return res.status(201).json(await createLiveClassForUser(user, parsed.data));
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		return res.status(status || 500).json({ error: error instanceof Error ? error.message : 'Unable to create live class.' });
	}
});
classroomRouter.post('/live-classes/:sessionId/join', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		return res.json(await joinLiveClassForUser(user, String(req.params.sessionId || '').trim()));
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		return res.status(status || 500).json({ error: error instanceof Error ? error.message : 'Unable to join live class.' });
	}
});
classroomRouter.post('/live-classes/:sessionId/close', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		return res.json(await closeLiveClassForUser(user, String(req.params.sessionId || '').trim()));
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		return res.status(status || 500).json({ error: error instanceof Error ? error.message : 'Unable to close live class.' });
	}
});
classroomRouter.get('/subjects', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await listClassroomSubjectsForUser(user, {
		classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
	}));
});
classroomRouter.post('/subjects', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = classroomSubjectSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid subject payload.' });
	try {
		return res.status(201).json(await createClassroomSubjectForUser(user, parsed.data));
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to create subject.';
		return res.status(status || 500).json({ error: message });
	}
});
classroomRouter.patch('/subjects/:subjectId', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = classroomSubjectUpdateSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid subject update payload.' });
	try {
		return res.json(await updateClassroomSubjectForUser(user, String(req.params.subjectId || '').trim(), parsed.data));
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to update subject.';
		return res.status(status || 500).json({ error: message });
	}
});
classroomRouter.delete('/subjects/:subjectId', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		return res.json({ ok: true, removed: await deleteClassroomSubjectForUser(user, String(req.params.subjectId || '').trim()) });
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to delete subject.';
		return res.status(status || 500).json({ error: message });
	}
});
classroomRouter.get('/subjects/mine', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({ subjects: await listClassroomSubjectsForUser(user) });
});
classroomRouter.get('/feed', (_req, res) => res.json({ posts: [] }));
classroomRouter.get('/practice', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await listPracticeSetsForUser(user));
});

classroomRouter.post('/question-bank', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	if (!canManagePracticeBank(user)) return res.status(403).json({ error: 'Forbidden' });
	const parsed = createPracticeSetSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid question bank payload.' });
	try {
		const set = await createPracticeSetForUser(user, parsed.data);
		return res.status(201).json(set);
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to create question bank.';
		return res.status(status || 500).json({ error: message });
	}
});

classroomRouter.post('/question/:questionId/explanation', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = explainQuestionSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid explanation request.' });
	try {
		const creditResult = await consumeAiCredits(user, {
			credits: 1,
			featureKey: 'student-ai-tutor-explanation',
			ownerType: 'school',
			referenceId: String(req.params.questionId || '').trim() || undefined,
			metadata: {
				questionId: String(req.params.questionId || '').trim() || null,
				surface: 'classroom-practice-arena',
			},
		});
		return res.json({
			explanation: deriveExplanationForQuestion(parsed.data),
			creditBalance: creditResult.wallet.balanceCredits,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'AI explanation failed.';
		const status = message === 'Insufficient AI credits.' ? 402 : 400;
		return res.status(status).json({ error: message });
	}
});

classroomRouter.get('/results', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await listStudentResultsForUser(user, {
		className: typeof req.query.className === 'string' ? req.query.className : undefined,
		classSection: typeof req.query.classSection === 'string' ? req.query.classSection : undefined,
		studentId: typeof req.query.studentId === 'string' ? req.query.studentId : undefined,
	}));
});

classroomRouter.get('/results/documents', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({
		documents: await listResultDocumentsForUser(user, {
			studentId: typeof req.query.studentId === 'string' ? req.query.studentId : undefined,
		}),
	});
});

classroomRouter.get('/results/old-documents', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({
		assets: await listOldResultAssetsForUser(user, {
			studentId: typeof req.query.studentId === 'string' ? req.query.studentId : undefined,
		}),
	});
});

classroomRouter.get('/history', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const role = String(user.activeRole || user.roles?.[0] || '').trim().toLowerCase();
	if (!['hos', 'owner', 'tenant school owner'].includes(role)) {
		return res.status(403).json({ error: 'Only the Head of School or Owner can view school history.' });
	}
	return res.json({ assets: await listHistoryAssetsForUser(user) });
});

classroomRouter.get('/migrations', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const role = String(user.activeRole || user.roles?.[0] || '').trim().toLowerCase();
	if (!['hos', 'owner', 'tenant school owner'].includes(role)) {
		return res.status(403).json({ error: 'Only the Head of School or Owner can view school history.' });
	}
	return res.json({ assets: await listHistoryAssetsForUser(user) });
});

classroomRouter.post('/results', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = upsertResultSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid result payload.' });
	}
	return res.status(201).json(await upsertStudentResultForUser(user, parsed.data));
});

classroomRouter.post('/results/:studentId/approve', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = approveResultSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid result approval payload.' });
	}
	try {
		const result = await approveStudentResultForUser(user, String(req.params.studentId || '').trim(), parsed.data.session, parsed.data.term, parsed.data.remark);
		return res.json(result);
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to approve result.';
		return res.status(status || 500).json({ error: message });
	}
});
classroomRouter.post('/feed', (req, res) => res.json({ ok: true, payload: req.body || {} }));
