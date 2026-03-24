import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';
import { classifyEnquiryPath } from '../faq/faqKnowledge.js';
import { getTutorBillingSettings } from '../finance/monetization.store.js';

export const publicRouter = Router();

const contactSchema = z.object({
	name: z.string().trim().min(1).max(120).optional().or(z.literal('')),
	email: z.string().trim().email(),
	message: z.string().trim().min(5).max(4000),
	school_id: z.string().trim().max(120).optional().nullable(),
});

const growthApplicationSchema = z.object({
	name: z.string().trim().min(2).max(120),
	email: z.string().trim().email(),
	phone: z.string().trim().min(5).max(40),
	city: z.string().trim().max(120).optional().or(z.literal('')),
	notes: z.string().trim().max(2000).optional().or(z.literal('')),
	school_id: z.string().trim().max(120).optional().nullable(),
	source: z.string().trim().max(80).optional().or(z.literal('')),
});

const opportunityApplicationSchema = z.object({
	vacancyId: z.string().trim().min(1).max(120),
	vacancyTitle: z.string().trim().min(2).max(160),
	name: z.string().trim().min(2).max(120),
	email: z.string().trim().email(),
	phone: z.string().trim().min(5).max(40),
	hasExistingAccount: z.boolean().optional(),
	resume: z.object({
		fullName: z.string().trim().min(2).max(120),
		email: z.string().trim().email(),
		phone: z.string().trim().min(5).max(40),
		experience: z.string().trim().max(4000).optional().or(z.literal('')),
		education: z.string().trim().max(4000).optional().or(z.literal('')),
		skills: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
		fileUrl: z.string().trim().max(1024).optional().or(z.literal('')),
	}).optional(),
	assessment: z.object({
		required: z.boolean().optional(),
		status: z.enum(['not-required', 'pending', 'completed']).optional(),
		score: z.number().min(0).max(100).optional(),
	}).optional(),
});

const tutorRegistrationSchema = z.object({
	displayName: z.string().trim().min(2).max(120),
	email: z.string().trim().email(),
	specialty: z.string().trim().min(2).max(120),
	headline: z.string().trim().max(240).optional().or(z.literal('')),
	phone: z.string().trim().max(40).optional().or(z.literal('')),
});

const tutorClassSchema = z.object({
	tutorId: z.string().trim().min(1),
	title: z.string().trim().min(2).max(120),
	subject: z.string().trim().min(2).max(120),
	level: z.string().trim().min(1).max(120),
	schedule: z.string().trim().min(1).max(160),
	delivery: z.string().trim().min(1).max(120),
	summary: z.string().trim().min(2).max(400),
});

const tutorStudentSchema = z.object({
	tutorId: z.string().trim().min(1),
	name: z.string().trim().min(2).max(120),
	stage: z.string().trim().max(120).optional().or(z.literal('')),
	email: z.string().trim().email().optional().or(z.literal('')),
});

const tutorSubscriptionSchema = z.object({
	tutorId: z.string().trim().min(1),
	status: z.enum(['inactive', 'pending', 'trial', 'active']).optional(),
	premiumToolsEnabled: z.boolean().optional(),
});

type ContactInquiryRecord = {
	id: string;
	schoolId: string | null;
	name: string | null;
	email: string;
	message: string;
	enquiryPath: string;
	enquiryLabel: string;
	primaryResponsibleRole: string;
	responsibleRoles: string[];
	routingNote: string;
	status: 'new';
	createdAt: string;
};

type GrowthPartnerApplicationRecord = {
	id: string;
	schoolId: string | null;
	name: string;
	email: string;
	phone: string;
	city: string | null;
	notes: string | null;
	source: string | null;
	primaryResponsibleRole: string;
	responsibleRoles: string[];
	status: 'new';
	createdAt: string;
};

type ContactInquiryState = {
	messages: ContactInquiryRecord[];
};

type GrowthPartnerApplicationState = {
	applications: GrowthPartnerApplicationRecord[];
};

type OpportunityApplicationRecord = {
	id: string;
	applicationCode: string;
	vacancyId: string;
	vacancyTitle: string;
	name: string;
	email: string;
	phone: string;
	hasExistingAccount: boolean;
	resume: {
		fullName: string;
		email: string;
		phone: string;
		experience: string | null;
		education: string | null;
		skills: string[];
		fileUrl: string | null;
	} | null;
	assessment: {
		required: boolean;
		status: 'not-required' | 'pending' | 'completed';
		score: number | null;
	};
	status: 'received' | 'assessment-pending' | 'under-review';
	createdAt: string;
	updatedAt: string;
};

type OpportunityApplicationState = {
	applications: OpportunityApplicationRecord[];
};

type TutorClassRecord = {
	id: string;
	title: string;
	subject: string;
	level: string;
	schedule: string;
	delivery: string;
	summary: string;
	studentCount: number;
	createdAt: string;
};

type TutorStudentRecord = {
	id: string;
	name: string;
	stage: string | null;
	email: string | null;
	createdAt: string;
};

type TutorProfileRecord = {
	id: string;
	userId: string | null;
	schoolId: string | null;
	displayName: string;
	email: string;
	phone: string | null;
	specialty: string;
	headline: string | null;
	mode: 'independent' | 'school';
	accessKey: string;
	classes: TutorClassRecord[];
	students: TutorStudentRecord[];
	subscription: {
		status: 'inactive' | 'pending' | 'trial' | 'active';
		monthlyFeeNaira: number;
		includedStudents: number;
		extraStudentFeeNaira: number;
		premiumToolsEnabled: boolean;
		extraStudentCount: number;
		extraStudentDeficitNaira: number;
		trialStartedAt: string;
		trialEndsAt: string;
		paymentPhase: 'trial' | 'upfront' | 'active';
		paymentRequiredNow: boolean;
		updatedAt: string;
	};
	analytics: {
		studentCount: number;
		classCount: number;
	};
	createdAt: string;
	updatedAt: string;
};

type TutorHubState = {
	tutors: TutorProfileRecord[];
};

function nowIso() {
	return new Date().toISOString();
}

function plusDays(days: number) {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString();
}

function normalizeOptional(value: string | null | undefined) {
	const normalized = String(value || '').trim();
	return normalized || null;
}

async function readContactState() {
	return readDocument<ContactInquiryState>('public-contact-inquiries', GLOBAL_SCOPE, () => ({ messages: [] }));
}

async function writeContactState(state: ContactInquiryState) {
	return writeDocument('public-contact-inquiries', GLOBAL_SCOPE, state);
}

async function readGrowthApplicationState() {
	return readDocument<GrowthPartnerApplicationState>('growth-partner-applications', GLOBAL_SCOPE, () => ({ applications: [] }));
}

async function writeGrowthApplicationState(state: GrowthPartnerApplicationState) {
	return writeDocument('growth-partner-applications', GLOBAL_SCOPE, state);
}

async function readOpportunityApplicationState() {
	return readDocument<OpportunityApplicationState>('public-opportunity-applications', GLOBAL_SCOPE, () => ({ applications: [] }));
}

async function writeOpportunityApplicationState(state: OpportunityApplicationState) {
	return writeDocument('public-opportunity-applications', GLOBAL_SCOPE, state);
}

async function readTutorHubState() {
	return readDocument<TutorHubState>('public-tutor-hub', GLOBAL_SCOPE, () => ({ tutors: [] }));
}

async function writeTutorHubState(state: TutorHubState) {
	return writeDocument('public-tutor-hub', GLOBAL_SCOPE, state);
}

function makeApplicationCode() {
	return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function makeTutorAccessKey(displayName: string) {
	const base = String(displayName || 'ndovera-tutor').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'NDOVERA-TUTOR';
	return `${base}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function findTutor(state: TutorHubState, req: any, tutorId?: string, email?: string) {
	const userId = String(req.user?.id || '').trim() || null;
	const normalizedTutorId = String(tutorId || '').trim();
	const normalizedEmail = String(email || req.user?.email || '').trim().toLowerCase();
	return state.tutors.find((entry) => (
		(normalizedTutorId && entry.id === normalizedTutorId)
		|| (userId && entry.userId === userId)
		|| (normalizedEmail && entry.email.toLowerCase() === normalizedEmail)
	)) || null;
}

async function resolveTutorPaymentState(tutor: TutorProfileRecord) {
	const billing = await getTutorBillingSettings();
	const trialStartedAt = tutor.subscription.trialStartedAt || tutor.createdAt;
	const trialEndsAt = tutor.subscription.trialEndsAt || plusDays(billing.trialDays);
	const trialExpired = new Date(trialEndsAt).getTime() <= Date.now();
	const paymentPhase = tutor.subscription.status === 'active'
		? 'active'
		: (billing.requireUpfrontAfterTrial && trialExpired ? 'upfront' : 'trial');
	const paymentRequiredNow = paymentPhase === 'upfront' && tutor.subscription.status !== 'active';
	return {
		...billing,
		trialStartedAt,
		trialEndsAt,
		paymentPhase,
		paymentRequiredNow,
	};
}

async function withTutorBillingState(tutor: TutorProfileRecord): Promise<TutorProfileRecord> {
	const paymentState = await resolveTutorPaymentState(tutor);
	return {
		...tutor,
		subscription: {
			...tutor.subscription,
			monthlyFeeNaira: paymentState.monthlyFeeNaira,
			includedStudents: paymentState.includedStudents,
			extraStudentFeeNaira: paymentState.extraStudentFeeNaira,
			trialStartedAt: paymentState.trialStartedAt,
			trialEndsAt: paymentState.trialEndsAt,
			paymentPhase: paymentState.paymentPhase,
			paymentRequiredNow: paymentState.paymentRequiredNow,
			premiumToolsEnabled: tutor.subscription.status === 'active' ? true : tutor.subscription.premiumToolsEnabled,
		},
	};
}

async function ensureTutorCanUsePremiumTools(tutor: TutorProfileRecord) {
	const paymentState = await resolveTutorPaymentState(tutor);
	if (paymentState.paymentRequiredNow) {
		const error = new Error('Tutor payment is now upfront. Activate payment to keep creating classes and managing premium tutorial tools.') as Error & { status?: number };
		error.status = 402;
		throw error;
	}
}

publicRouter.post('/contact', async (req, res) => {
	const parsed = contactSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Valid email and message are required.' });
	}

	const routing = classifyEnquiryPath(parsed.data.message);
	const state = await readContactState();
	const inquiry: ContactInquiryRecord = {
		id: `contact_${crypto.randomUUID()}`,
		schoolId: normalizeOptional(parsed.data.school_id),
		name: normalizeOptional(parsed.data.name),
		email: parsed.data.email.trim(),
		message: parsed.data.message.trim(),
		enquiryPath: routing.path,
		enquiryLabel: routing.label,
		primaryResponsibleRole: routing.primaryResponsibleRole,
		responsibleRoles: routing.responsibleRoles,
		routingNote: routing.note,
		status: 'new',
		createdAt: nowIso(),
	};
	state.messages.unshift(inquiry);
	await writeContactState(state);

	return res.status(201).json({
		ok: true,
		inquiry,
		message: `Message received and tagged for ${routing.primaryResponsibleRole}.`,
	});
});

publicRouter.post('/growth-partners/apply', async (req, res) => {
	const parsed = growthApplicationSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Name, email, and phone number are required.' });
	}

	const state = await readGrowthApplicationState();
	const application: GrowthPartnerApplicationRecord = {
		id: `growth_${crypto.randomUUID()}`,
		schoolId: normalizeOptional(parsed.data.school_id),
		name: parsed.data.name.trim(),
		email: parsed.data.email.trim(),
		phone: parsed.data.phone.trim(),
		city: normalizeOptional(parsed.data.city),
		notes: normalizeOptional(parsed.data.notes),
		source: normalizeOptional(parsed.data.source),
		primaryResponsibleRole: 'Growth & Partnership Director',
		responsibleRoles: ['Growth & Partnership Director', 'Super Admin'],
		status: 'new',
		createdAt: nowIso(),
	};
	state.applications.unshift(application);
	await writeGrowthApplicationState(state);

	return res.status(201).json({
		ok: true,
		application,
		message: 'Application received and routed to the Growth & Partnership Director for review.',
	});
});

publicRouter.post('/opportunities/apply', async (req, res) => {
	const parsed = opportunityApplicationSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Vacancy, applicant details, and resume details are required.' });
	}
	const state = await readOpportunityApplicationState();
	const assessmentRequired = Boolean(parsed.data.assessment?.required);
	const application: OpportunityApplicationRecord = {
		id: `opp_${crypto.randomUUID()}`,
		applicationCode: makeApplicationCode(),
		vacancyId: parsed.data.vacancyId,
		vacancyTitle: parsed.data.vacancyTitle,
		name: parsed.data.name.trim(),
		email: parsed.data.email.trim().toLowerCase(),
		phone: parsed.data.phone.trim(),
		hasExistingAccount: Boolean(parsed.data.hasExistingAccount),
		resume: parsed.data.resume ? {
			fullName: parsed.data.resume.fullName.trim(),
			email: parsed.data.resume.email.trim().toLowerCase(),
			phone: parsed.data.resume.phone.trim(),
			experience: normalizeOptional(parsed.data.resume.experience),
			education: normalizeOptional(parsed.data.resume.education),
			skills: Array.isArray(parsed.data.resume.skills) ? parsed.data.resume.skills.map((entry) => entry.trim()).filter(Boolean) : [],
			fileUrl: normalizeOptional(parsed.data.resume.fileUrl),
		} : null,
		assessment: {
			required: assessmentRequired,
			status: assessmentRequired ? 'pending' : 'not-required',
			score: parsed.data.assessment?.status === 'completed' ? Number(parsed.data.assessment?.score || 0) : null,
		},
		status: assessmentRequired ? 'assessment-pending' : 'under-review',
		createdAt: nowIso(),
		updatedAt: nowIso(),
	};
	state.applications.unshift(application);
	await writeOpportunityApplicationState(state);
	return res.status(201).json({
		ok: true,
		application,
		message: assessmentRequired ? 'Application received. Finish the short assessment to complete your submission.' : 'Application received. You can now track it from your application code.',
	});
});

publicRouter.get('/opportunities/applications/lookup', async (req, res) => {
	const email = String(req.query.email || '').trim().toLowerCase();
	const applicationCode = String(req.query.applicationCode || '').trim().toUpperCase();
	if (!email && !applicationCode) return res.status(400).json({ error: 'Email or application code is required.' });
	const state = await readOpportunityApplicationState();
	const applications = state.applications.filter((entry) => (!email || entry.email === email) && (!applicationCode || entry.applicationCode === applicationCode));
	return res.json({ ok: true, applications });
});

publicRouter.post('/tutorials/register-tutor', async (req, res) => {
	const parsed = tutorRegistrationSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Tutor name, email, and specialty are required.' });
	}
	const state = await readTutorHubState();
	const existing = findTutor(state, req, undefined, parsed.data.email);
	const now = nowIso();
	const tutorBilling = await getTutorBillingSettings();
	const tutor: TutorProfileRecord = existing ? {
		...existing,
		displayName: parsed.data.displayName.trim(),
		email: parsed.data.email.trim().toLowerCase(),
		phone: normalizeOptional(parsed.data.phone),
		specialty: parsed.data.specialty.trim(),
		headline: normalizeOptional(parsed.data.headline),
		mode: req.user?.school_id ? 'school' : existing.mode,
		updatedAt: now,
	} : {
		id: `tutor_${crypto.randomUUID()}`,
		userId: normalizeOptional(req.user?.id),
		schoolId: normalizeOptional(req.user?.school_id),
		displayName: parsed.data.displayName.trim(),
		email: parsed.data.email.trim().toLowerCase(),
		phone: normalizeOptional(parsed.data.phone),
		specialty: parsed.data.specialty.trim(),
		headline: normalizeOptional(parsed.data.headline),
		mode: req.user?.school_id ? 'school' : 'independent',
		accessKey: makeTutorAccessKey(parsed.data.displayName),
		classes: [],
		students: [],
		subscription: {
			status: 'trial',
			monthlyFeeNaira: tutorBilling.monthlyFeeNaira,
			includedStudents: tutorBilling.includedStudents,
			extraStudentFeeNaira: tutorBilling.extraStudentFeeNaira,
			premiumToolsEnabled: true,
			extraStudentCount: 0,
			extraStudentDeficitNaira: 0,
			trialStartedAt: now,
			trialEndsAt: plusDays(tutorBilling.trialDays),
			paymentPhase: 'trial',
			paymentRequiredNow: false,
			updatedAt: now,
		},
		analytics: { studentCount: 0, classCount: 0 },
		createdAt: now,
		updatedAt: now,
	};
	const normalizedTutor = await withTutorBillingState(tutor);
	state.tutors = existing ? state.tutors.map((entry) => entry.id === existing.id ? normalizedTutor : entry) : [normalizedTutor, ...state.tutors];
	await writeTutorHubState(state);
	return res.status(201).json({ ok: true, tutor: normalizedTutor });
});

publicRouter.get('/tutorials/dashboard', async (req, res) => {
	const state = await readTutorHubState();
	const tutor = findTutor(state, req, String(req.query.tutorId || '').trim(), String(req.query.email || '').trim());
	if (!tutor) return res.json({ ok: true, tutor: null });
	return res.json({ ok: true, tutor: await withTutorBillingState(tutor) });
});

publicRouter.post('/tutorials/classes', async (req, res) => {
	const parsed = tutorClassSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Class details are required.' });
	const state = await readTutorHubState();
	const tutor = findTutor(state, req, parsed.data.tutorId);
	if (!tutor) return res.status(404).json({ error: 'Tutor profile not found.' });
	try {
		await ensureTutorCanUsePremiumTools(tutor);
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 402;
		return res.status(status || 402).json({ error: error instanceof Error ? error.message : 'Tutor access requires payment.' });
	}
	const createdAt = nowIso();
	const createdClass: TutorClassRecord = {
		id: `tutorial_class_${crypto.randomUUID()}`,
		title: parsed.data.title.trim(),
		subject: parsed.data.subject.trim(),
		level: parsed.data.level.trim(),
		schedule: parsed.data.schedule.trim(),
		delivery: parsed.data.delivery.trim(),
		summary: parsed.data.summary.trim(),
		studentCount: 0,
		createdAt,
	};
	const updatedTutor: TutorProfileRecord = {
		...tutor,
		classes: [createdClass, ...tutor.classes],
		analytics: { ...tutor.analytics, classCount: tutor.classes.length + 1 },
		updatedAt: createdAt,
	};
	state.tutors = state.tutors.map((entry) => entry.id === tutor.id ? updatedTutor : entry);
	await writeTutorHubState(state);
	return res.status(201).json({ ok: true, tutor: await withTutorBillingState(updatedTutor), tutorialClass: createdClass });
});

publicRouter.post('/tutorials/students', async (req, res) => {
	const parsed = tutorStudentSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Student details are required.' });
	const state = await readTutorHubState();
	const tutor = findTutor(state, req, parsed.data.tutorId);
	if (!tutor) return res.status(404).json({ error: 'Tutor profile not found.' });
	try {
		await ensureTutorCanUsePremiumTools(tutor);
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 402;
		return res.status(status || 402).json({ error: error instanceof Error ? error.message : 'Tutor access requires payment.' });
	}
	const createdAt = nowIso();
	const student: TutorStudentRecord = {
		id: `tutorial_student_${crypto.randomUUID()}`,
		name: parsed.data.name.trim(),
		stage: normalizeOptional(parsed.data.stage),
		email: normalizeOptional(parsed.data.email),
		createdAt,
	};
	const nextStudentCount = tutor.students.length + 1;
	const extraStudentCount = Math.max(0, nextStudentCount - tutor.subscription.includedStudents);
	const updatedTutor: TutorProfileRecord = {
		...tutor,
		students: [student, ...tutor.students],
		subscription: {
			...tutor.subscription,
			extraStudentCount,
			extraStudentDeficitNaira: extraStudentCount * tutor.subscription.extraStudentFeeNaira,
			updatedAt: createdAt,
		},
		analytics: { ...tutor.analytics, studentCount: nextStudentCount },
		classes: tutor.classes.map((entry, index) => index === 0 ? { ...entry, studentCount: entry.studentCount + 1 } : entry),
		updatedAt: createdAt,
	};
	state.tutors = state.tutors.map((entry) => entry.id === tutor.id ? updatedTutor : entry);
	await writeTutorHubState(state);
	return res.status(201).json({ ok: true, tutor: await withTutorBillingState(updatedTutor), student });
});

publicRouter.post('/tutorials/subscription/activate', async (req, res) => {
	const parsed = tutorSubscriptionSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Tutor subscription update is invalid.' });
	const state = await readTutorHubState();
	const tutor = findTutor(state, req, parsed.data.tutorId);
	if (!tutor) return res.status(404).json({ error: 'Tutor profile not found.' });
	const updatedAt = nowIso();
	const nextStatus = parsed.data.status || 'active';
	const updatedTutor: TutorProfileRecord = {
		...tutor,
		subscription: {
			...tutor.subscription,
			status: nextStatus,
			premiumToolsEnabled: parsed.data.premiumToolsEnabled ?? nextStatus === 'active',
			updatedAt,
		},
		updatedAt,
	};
	state.tutors = state.tutors.map((entry) => entry.id === tutor.id ? updatedTutor : entry);
	await writeTutorHubState(state);
	return res.json({ ok: true, tutor: await withTutorBillingState(updatedTutor) });
});
