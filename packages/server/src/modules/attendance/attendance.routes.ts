import { Router } from 'express';
import { z } from 'zod';
import { getParentAttendance, getStaffAttendance, getStudentAttendance, markParentAttendance, markSingleStudentAttendance, markStaffAttendance, saveStudentAttendanceRecords } from './attendance.store.js';

export const attendanceRouter = Router();

const statusSchema = z.enum(['Present', 'Absent', 'Late', 'Excused']);

const singleStudentMarkSchema = z.object({
	student_id: z.string().trim().min(1),
	class_id: z.string().trim().optional(),
	date: z.string().trim().optional(),
	status: statusSchema.optional(),
});

const studentRecordSchema = z.object({
	student_id: z.string().trim().min(1),
	class_id: z.string().trim().optional(),
	date: z.string().trim().optional(),
	morningStatus: statusSchema.optional(),
	afternoonStatus: statusSchema.optional(),
});

const bulkStudentSchema = z.object({
	records: z.array(studentRecordSchema).min(1),
});

const staffMarkSchema = z.object({
	staff_id: z.string().trim().min(1),
	date: z.string().trim().optional(),
	status: statusSchema.optional(),
});

const parentMarkSchema = z.object({
	parent_id: z.string().trim().min(1),
	date: z.string().trim().optional(),
	status: statusSchema.optional(),
});

attendanceRouter.get('/', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getStudentAttendance(user, typeof req.query.date === 'string' ? req.query.date : undefined));
});

attendanceRouter.post('/', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = bulkStudentSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid attendance payload.' });
	try {
		await saveStudentAttendanceRecords(user, parsed.data.records);
		return res.json({ ok: true });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save attendance records.' });
	}
});

attendanceRouter.post('/mark', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = singleStudentMarkSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid attendance payload.' });
	try {
		await markSingleStudentAttendance(user, parsed.data);
		return res.json({ ok: true });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to mark attendance.' });
	}
});

attendanceRouter.get('/staff', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getStaffAttendance(user, typeof req.query.date === 'string' ? req.query.date : undefined));
});

attendanceRouter.post('/staff/mark', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = staffMarkSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid staff attendance payload.' });
	try {
		await markStaffAttendance(user, parsed.data);
		return res.json({ ok: true });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to mark staff attendance.' });
	}
});

attendanceRouter.get('/parent', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getParentAttendance(user, typeof req.query.date === 'string' ? req.query.date : undefined));
});

attendanceRouter.post('/parent/mark', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = parentMarkSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid parent attendance payload.' });
	try {
		await markParentAttendance(user, parsed.data);
		return res.json({ ok: true });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to mark parent attendance.' });
	}
});