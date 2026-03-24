import crypto from 'crypto';

import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type OnboardingRequestRecord = {
	id: string;
	waitToken: string;
	school_name: string;
	subdomain: string;
	owner_name: string;
	owner_ndovera_email: string;
	admin_email?: string;
	phone_number?: string;
	pricing_tier_key?: string;
	pricing_tier_label?: string;
	included_student_range?: string;
	requested_student_count?: number;
	extra_student_count?: number;
	extra_student_term_deficit_naira?: number;
	pricing_subtotal_naira?: number;
	pricing_discount_naira?: number;
	pricing_total_naira?: number;
	discount_code?: string;
	discount_percentage?: number;
	status: 'pending' | 'payment-received' | 'approved' | 'rejected';
	payment_status: 'pending' | 'received' | 'verified' | 'failed';
	payment_reference?: string;
	created_at: string;
	updated_at: string;
};

type OnboardingState = {
	requests: OnboardingRequestRecord[];
};

const NAMESPACE = 'school-onboarding';

function nowIso() {
	return new Date().toISOString();
}

function defaultState(): OnboardingState {
	return { requests: [] };
}

async function readState() {
	return readDocument<OnboardingState>(NAMESPACE, GLOBAL_SCOPE, defaultState);
}

async function writeState(state: OnboardingState) {
	return writeDocument(NAMESPACE, GLOBAL_SCOPE, state);
}

function normalizeSubdomain(name: string) {
	return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || `school-${crypto.randomUUID().slice(0, 8)}`;
}

export async function registerSchoolOnboardingRequest(input: {
	schoolName: string;
	ownerName: string;
	ownerNdoveraEmail: string;
	adminEmail?: string;
	phoneNumber?: string;
	pricingTierKey?: string;
	pricingTierLabel?: string;
	includedStudentRange?: string;
	requestedStudentCount?: number;
	extraStudentCount?: number;
	extraStudentTermDeficitNaira?: number;
	pricingSubtotalNaira?: number;
	pricingDiscountNaira?: number;
	pricingTotalNaira?: number;
	discountCode?: string;
	discountPercentage?: number;
}) {
	const state = await readState();
	const createdAt = nowIso();
	const record: OnboardingRequestRecord = {
		id: `req_${crypto.randomUUID()}`,
		waitToken: crypto.randomBytes(18).toString('hex'),
		school_name: input.schoolName.trim(),
		subdomain: normalizeSubdomain(input.schoolName),
		owner_name: input.ownerName.trim(),
		owner_ndovera_email: input.ownerNdoveraEmail.trim().toLowerCase(),
		admin_email: String(input.adminEmail || '').trim() || undefined,
		phone_number: String(input.phoneNumber || '').trim() || undefined,
		pricing_tier_key: String(input.pricingTierKey || '').trim() || undefined,
		pricing_tier_label: String(input.pricingTierLabel || '').trim() || undefined,
		included_student_range: String(input.includedStudentRange || '').trim() || undefined,
		requested_student_count: Number.isFinite(Number(input.requestedStudentCount)) ? Math.max(0, Number(input.requestedStudentCount)) : undefined,
		extra_student_count: Number.isFinite(Number(input.extraStudentCount)) ? Math.max(0, Number(input.extraStudentCount)) : undefined,
		extra_student_term_deficit_naira: Number.isFinite(Number(input.extraStudentTermDeficitNaira)) ? Math.max(0, Number(input.extraStudentTermDeficitNaira)) : undefined,
		pricing_subtotal_naira: Number.isFinite(Number(input.pricingSubtotalNaira)) ? Math.max(0, Number(input.pricingSubtotalNaira)) : undefined,
		pricing_discount_naira: Number.isFinite(Number(input.pricingDiscountNaira)) ? Math.max(0, Number(input.pricingDiscountNaira)) : undefined,
		pricing_total_naira: Number.isFinite(Number(input.pricingTotalNaira)) ? Math.max(0, Number(input.pricingTotalNaira)) : undefined,
		discount_code: String(input.discountCode || '').trim().toUpperCase() || undefined,
		discount_percentage: Number.isFinite(Number(input.discountPercentage)) ? Math.max(0, Number(input.discountPercentage)) : undefined,
		status: 'pending',
		payment_status: 'pending',
		created_at: createdAt,
		updated_at: createdAt,
	};
	state.requests.unshift(record);
	await writeState(state);
	return record;
}

export async function recordOnboardingPayment(waitToken: string, paymentReference?: string, updates?: {
	pricingSubtotalNaira?: number;
	pricingDiscountNaira?: number;
	pricingTotalNaira?: number;
	discountCode?: string;
	discountPercentage?: number;
}) {
	const state = await readState();
	const index = state.requests.findIndex((entry) => entry.waitToken === waitToken);
	if (index < 0) {
		const error = new Error('Onboarding request not found.') as Error & { status?: number };
		error.status = 404;
		throw error;
	}
	const current = state.requests[index];
	const next: OnboardingRequestRecord = {
		...current,
		payment_reference: String(paymentReference || '').trim() || current.payment_reference,
		pricing_subtotal_naira: Number.isFinite(Number(updates?.pricingSubtotalNaira)) ? Math.max(0, Number(updates?.pricingSubtotalNaira)) : current.pricing_subtotal_naira,
		pricing_discount_naira: Number.isFinite(Number(updates?.pricingDiscountNaira)) ? Math.max(0, Number(updates?.pricingDiscountNaira)) : current.pricing_discount_naira,
		pricing_total_naira: Number.isFinite(Number(updates?.pricingTotalNaira)) ? Math.max(0, Number(updates?.pricingTotalNaira)) : current.pricing_total_naira,
		discount_code: String(updates?.discountCode || '').trim().toUpperCase() || current.discount_code,
		discount_percentage: Number.isFinite(Number(updates?.discountPercentage)) ? Math.max(0, Number(updates?.discountPercentage)) : current.discount_percentage,
		payment_status: 'received',
		status: current.status === 'approved' ? 'approved' : 'payment-received',
		updated_at: nowIso(),
	};
	state.requests[index] = next;
	await writeState(state);
	return next;
}

export async function getOnboardingRequestByWaitToken(waitToken: string) {
	const state = await readState();
	return state.requests.find((entry) => entry.waitToken === waitToken) || null;
}

export async function listOnboardingRequests() {
	const state = await readState();
	return [...state.requests].sort((left, right) => right.created_at.localeCompare(left.created_at));
}