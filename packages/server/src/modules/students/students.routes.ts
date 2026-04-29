import { Router } from 'express';
import { requireRoles } from '../../../rbac.js';
import { buildMetrics, graduateStudentToAlumni, loadIdentityState, transferStudent } from '../../../../../identity-state.js';
import { listStudentResultsForUser, type StudentResultRecord } from '../classroom/classroomResults.store.js';

export const studentsRouter = Router();

function normalizeText(value: unknown) {
	return String(value || '').trim().toLowerCase();
}

function normalizeSection(value?: string) {
	const normalized = normalizeText(value);
	if (!normalized) return '';
	if (normalized === 'pre-school' || normalized === 'primary' || normalized === 'junior-secondary' || normalized === 'senior-secondary') return normalized;
	if (/(pre[- ]school|preschool|nursery|reception)/.test(normalized)) return 'pre-school';
	if (/(primary|grade|basic)/.test(normalized)) return 'primary';
	if (/(jss|jhs|junior secondary)/.test(normalized)) return 'junior-secondary';
	if (/(sss|ss\s*[123]|shs|senior secondary)/.test(normalized)) return 'senior-secondary';
	return '';
}

function inferSectionFromClassName(className?: string) {
	const normalized = normalizeText(className);
	if (!normalized) return '';
	if (/(pre[- ]school|preschool|nursery|reception)/.test(normalized)) return 'pre-school';
	if (/(primary|grade|basic)/.test(normalized)) return 'primary';
	if (/(jss|jhs|junior secondary)/.test(normalized)) return 'junior-secondary';
	if (/(sss|ss\s*[123]|shs|senior secondary)/.test(normalized)) return 'senior-secondary';
	return '';
}

function parseClassRank(className?: string, classSection?: string) {
	const normalizedName = normalizeText(className);
	const section = normalizeSection(classSection) || inferSectionFromClassName(className);
	const numberMatch = normalizedName.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
	if (numberMatch) return Number(numberMatch[1]);
	if (/(final|graduating|graduation|leavers)/.test(normalizedName)) return 999;
	if (section === 'pre-school' && /(kg\s*2|kindergarten\s*2)/.test(normalizedName)) return 2;
	return 0;
}

function pickLatestSession(record: StudentResultRecord) {
	return [...record.sessions].sort((left, right) => right.session.localeCompare(left.session))[0];
}

function pickLatestTerm(record: StudentResultRecord) {
	const latestSession = pickLatestSession(record);
	if (!latestSession) return null;
	return [...latestSession.terms].sort((left, right) => {
		const leftNum = Number(String(left.name || '').replace(/\D/g, '') || '0');
		const rightNum = Number(String(right.name || '').replace(/\D/g, '') || '0');
		return rightNum - leftNum;
	})[0] || null;
}

function determineGraduatingSection(records: StudentResultRecord[]) {
	const sections = new Set(records.map((record) => normalizeSection(record.classSection) || inferSectionFromClassName(record.className)).filter(Boolean));
	if (sections.has('senior-secondary')) return 'senior-secondary';
	if (sections.has('junior-secondary')) return 'junior-secondary';
	if (sections.has('primary')) return 'primary';
	if (sections.has('pre-school')) return 'pre-school';
	return '';
}

function isEligibleForAlumniGraduation(records: StudentResultRecord[], target: StudentResultRecord) {
	const graduatingSection = determineGraduatingSection(records);
	if (!graduatingSection) {
		return { ok: false, reason: 'No class progression data was found for this school yet.' };
	}
	const targetSection = normalizeSection(target.classSection) || inferSectionFromClassName(target.className);
	if (targetSection !== graduatingSection) {
		return { ok: false, reason: 'This learner is not in the school\'s current final graduating section.' };
	}
	const sameSectionRecords = records.filter((record) => (normalizeSection(record.classSection) || inferSectionFromClassName(record.className)) === graduatingSection);
	const highestRank = Math.max(...sameSectionRecords.map((record) => parseClassRank(record.className, record.classSection)), 0);
	const targetRank = parseClassRank(target.className, target.classSection);
	if (highestRank > 0 && targetRank < highestRank) {
		return { ok: false, reason: 'This learner is not yet in the highest class for the current graduating section.' };
	}
	const latestTerm = pickLatestTerm(target);
	if (!latestTerm) {
		return { ok: false, reason: 'No result term was found for this learner.' };
	}
	const termNumber = Number(String(latestTerm.name || '').replace(/\D/g, '') || '0');
	if (termNumber && termNumber < 3) {
		return { ok: false, reason: 'Graduation requires a promoted third-term result.' };
	}
	if (normalizeText(latestTerm.summary?.promotion) !== 'promoted') {
		return { ok: false, reason: 'This learner is not marked as promoted in the latest term result.' };
	}
	return { ok: true, reason: null as string | null };
}

studentsRouter.get('/metrics', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const state = await loadIdentityState();
	const metrics = buildMetrics(state);
	return res.json({
		school: metrics.schools.find((school) => school.id === user.school_id) || null,
		...metrics,
	});
});

studentsRouter.get('/', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const schoolId = String(user.school_id || '').trim();
	const state = await loadIdentityState();
	const students = state.students
		.filter((student) => student.schoolId === schoolId && student.status !== 'transferred')
		.map((student, index) => ({
			id: student.userId,
			student_id: student.id,
			name: student.name,
			class_id: null,
			class_name: null,
			roll_no: String(index + 1).padStart(3, '0'),
			status: student.status,
		}));
	return res.json(students);
});

studentsRouter.post('/:studentId/transfer', requireRoles('HoS', 'Admin', 'Super Admin'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const studentId = String(req.params.studentId || '').trim();
	const targetSchoolId = String(req.body?.targetSchoolId || '').trim();
	const reason = String(req.body?.reason || '').trim() || undefined;
	if (!studentId || !targetSchoolId) {
		return res.status(400).json({ error: 'studentId and targetSchoolId are required.' });
	}
	try {
		const state = await loadIdentityState();
		const result = await transferStudent(state, studentId, targetSchoolId, reason, user.id);
		return res.json({ ok: true, ...result });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Transfer failed.' });
	}
});

studentsRouter.post('/:studentId/graduate-to-alumni', requireRoles('HoS', 'Admin', 'Super Admin', 'Owner', 'Tenant School Owner'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const studentId = String(req.params.studentId || '').trim();
	const reason = String(req.body?.reason || '').trim() || 'Graduated from primary school';
	if (!studentId) {
		return res.status(400).json({ error: 'studentId is required.' });
	}
	try {
		const resultsPayload = await listStudentResultsForUser(user);
		const studentResults = Array.isArray(resultsPayload.studentResults) ? resultsPayload.studentResults : [];
		const targetResult = studentResults.find((record) => record.studentId === studentId);
		if (!targetResult) {
			return res.status(400).json({ error: 'This learner has no result record yet, so graduation readiness cannot be confirmed.' });
		}
		const eligibility = isEligibleForAlumniGraduation(studentResults, targetResult);
		if (!eligibility.ok) {
			return res.status(400).json({ error: eligibility.reason || 'This learner is not ready for alumni graduation yet.' });
		}
		const state = await loadIdentityState();
		const result = await graduateStudentToAlumni(state, studentId, reason, user.id);
		return res.json({ ok: true, ...result });
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Graduation to alumni failed.' });
	}
});
