import { Router } from 'express';
import { z } from 'zod';
import { mockData } from '../../common/mockData.js';
import { approveStudentResultForUser, listStudentResultsForUser, upsertStudentResultForUser } from './classroomResults.store.js';
import { createClassroomSubjectForUser, deleteClassroomSubjectForUser, listClassroomSubjectsForUser, updateClassroomSubjectForUser } from './subjects.store.js';
export const classroomRouter = Router();
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
classroomRouter.get('/live-classes', (_req, res) => res.json(mockData.liveClasses));
classroomRouter.get('/subjects', (req, res) => {
	const user = req.user;
	if (!user)
		return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(listClassroomSubjectsForUser(user, {
		classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
	}));
});
classroomRouter.post('/subjects', (req, res) => {
	const user = req.user;
	if (!user)
		return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = classroomSubjectSchema.safeParse(req.body || {});
	if (!parsed.success)
		return res.status(400).json({ error: 'Invalid subject payload.' });
	try {
		return res.status(201).json(createClassroomSubjectForUser(user, parsed.data));
	}
	catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to create subject.';
		return res.status(status || 500).json({ error: message });
	}
});
classroomRouter.patch('/subjects/:subjectId', (req, res) => {
	const user = req.user;
	if (!user)
		return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = classroomSubjectUpdateSchema.safeParse(req.body || {});
	if (!parsed.success)
		return res.status(400).json({ error: 'Invalid subject update payload.' });
	try {
		return res.json(updateClassroomSubjectForUser(user, String(req.params.subjectId || '').trim(), parsed.data));
	}
	catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to update subject.';
		return res.status(status || 500).json({ error: message });
	}
});
classroomRouter.delete('/subjects/:subjectId', (req, res) => {
	const user = req.user;
	if (!user)
		return res.status(401).json({ error: 'Unauthenticated' });
	try {
		return res.json({ ok: true, removed: deleteClassroomSubjectForUser(user, String(req.params.subjectId || '').trim()) });
	}
	catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to delete subject.';
		return res.status(status || 500).json({ error: message });
	}
});
classroomRouter.get('/subjects/mine', (req, res) => {
	const user = req.user;
	if (!user)
		return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({ subjects: listClassroomSubjectsForUser(user) });
});
classroomRouter.get('/feed', (_req, res) => res.json({ posts: [] }));
classroomRouter.get('/results', (req, res) => {
	const user = req.user;
	if (!user)
		return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(listStudentResultsForUser(user, {
		className: typeof req.query.className === 'string' ? req.query.className : undefined,
		classSection: typeof req.query.classSection === 'string' ? req.query.classSection : undefined,
		studentId: typeof req.query.studentId === 'string' ? req.query.studentId : undefined,
	}));
});
classroomRouter.post('/results', (req, res) => {
	const user = req.user;
	if (!user)
		return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = upsertResultSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid result payload.' });
	}
	return res.status(201).json(upsertStudentResultForUser(user, parsed.data));
});
classroomRouter.post('/results/:studentId/approve', (req, res) => {
	const user = req.user;
	if (!user)
		return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = approveResultSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid result approval payload.' });
	}
	try {
		const result = approveStudentResultForUser(user, String(req.params.studentId || '').trim(), parsed.data.session, parsed.data.term, parsed.data.remark);
		return res.json(result);
	}
	catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
		const message = error instanceof Error ? error.message : 'Unable to approve result.';
		return res.status(status || 500).json({ error: message });
	}
});
classroomRouter.post('/feed', (req, res) => res.json({ ok: true, payload: req.body || {} }));
