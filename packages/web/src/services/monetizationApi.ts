import { fetchWithAuth } from './apiClient';

export type PricingTier = {
	key: string;
	label: string;
	minStudents: number;
	maxStudents: number | null;
	oneTimeSetupNaira: number;
	perStudentPerTermNaira: number;
	oneTimeSetupDiscountNaira?: number;
	perStudentPerTermDiscountNaira?: number;
	pricing?: {
		oneTimeSetupNaira: number;
		perStudentPerTermNaira: number;
		discountPercent: number;
	};
};

export type AiCreditPackage = {
	id: string;
	label: string;
	nairaAmount: number;
	aiCredits: number;
};

export type PricingCatalog = {
	schoolPricing: {
		currencyCode: string;
		academicTermsPerYear: number;
		tiers: PricingTier[];
	};
	aiEconomy: {
		freeQueriesEveryDays: number;
		freeQueriesPerWindow: number;
		keyuPerAiCredit: number;
		packages: AiCreditPackage[];
	};
	marketplace: {
		keyuPerNaira: number;
		bundles: MarketplaceBundle[];
		tutorBilling: TutorBillingPolicy;
	};
};

export type TutorBillingPolicy = {
	trialDays: number;
	monthlyFeeNaira: number;
	includedStudents: number;
	extraStudentFeeNaira: number;
	requireUpfrontAfterTrial: boolean;
};

export type PriceIncreaseNotice = {
	id: string;
	scope: 'school-signup' | 'termly-billing' | 'ai-credits';
	title: string;
	message: string;
	currentAmountNaira: number;
	newAmountNaira: number;
	effectiveAt: string;
	active: boolean;
	createdAt: string;
	updatedAt: string;
	agreed: boolean;
	dismissedToday: boolean;
	showToday: boolean;
};

export type PayrollPayoutProfile = {
	schoolId: string;
	userId: string;
	accountName: string;
	bankName: string;
	accountNumber: string;
	bvn: string | null;
	nin: string | null;
	kycStatus: 'missing' | 'pending' | 'verified';
	kycReference: string | null;
	kycCheckedAt: string | null;
	consentAcknowledgedAt: string | null;
	updatedAt: string;
};

export type PayrollSlip = {
	id: string;
	payrollMonthId: string;
	schoolId: string;
	userId: string;
	staffName: string;
	roleName: string;
	baseSalaryNaira: number;
	allowancesNaira: number;
	deductionsNaira: number;
	grossNaira: number;
	netNaira: number;
	status: 'draft' | 'published' | 'held-kyc';
	paymentReference: string | null;
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
	monthKey?: string;
	metadata?: Record<string, unknown> | null;
};

export type PayrollConfig = {
	userId: string;
	schoolId: string;
	staffName: string;
	roleName: string;
	baseSalaryNaira: number;
	allowancesNaira: number;
	deductionsNaira: number;
	payrollEnabled: boolean;
	updatedAt: string;
};

export type PayrollMonth = {
	id: string;
	schoolId: string;
	monthKey: string;
	status: 'draft' | 'published';
	notes: string | null;
	directorNote?: string | null;
	directorSheet?: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
	publishedAt: string | null;
	createdBy: string | null;
};

export type PayrollAdminSnapshot = {
	configs: PayrollConfig[];
	months: PayrollMonth[];
	slips: PayrollSlip[];
	overview: {
		totalNetNaira: number;
		pendingKycCount: number;
		publishedCount: number;
	};
};

export type PayrollHistoryQuery = {
	search?: string;
	monthKey?: string;
	status?: 'draft' | 'published';
};

export type StaffIncentiveReadiness = {
	eligible: boolean;
	rank: number | null;
	periodKey: string;
	payoutEstimateNaira: number;
	profile: PayrollPayoutProfile | null;
	requiresProfileSubmission: boolean;
	kycRequired: boolean;
};

export type MarketplaceBundle = {
	id: string;
	label: string;
	description: string;
	category: 'ai-credits' | 'keyu' | 'tutor-subscription';
	nairaAmount: number;
	originalNairaAmount: number | null;
	aiCredits: number;
	keyuAmount: number;
	active: boolean;
	featured: boolean;
	createdAt: string;
	updatedAt: string;
	discountPercent?: number;
};

export type ValidatedDiscountCode = {
	id: string;
	code: string;
	description: string;
	percentageOff: number;
	scope?: 'school-onboarding' | 'marketplace' | 'all';
	validFrom?: string | null;
	expiresAt?: string | null;
};

export type InvoicePayment = {
	id: string;
	invoiceId: string;
	schoolId: string;
	providerName: string;
	providerReference: string;
	status: string;
	amountNaira: number;
	receivedAt: string | null;
	metadata?: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
};

export type InvoiceItem = {
	id: string;
	invoiceId: string;
	itemType: string;
	label: string;
	quantity: number;
	unitAmountNaira: number;
	totalAmountNaira: number;
	metadata?: Record<string, unknown> | null;
};

export type Invoice = {
	id: string;
	schoolId: string;
	invoiceType: string;
	academicYear: string | null;
	termKey: string | null;
	status: string;
	currencyCode: string;
	subtotalNaira: number;
	totalNaira: number;
	paidNaira: number;
	balanceNaira: number;
	metadata?: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
	dueAt: string | null;
	items?: InvoiceItem[];
	payments?: InvoicePayment[];
};

export type AiCreditWallet = {
	id: string;
	ownerType: 'school' | 'user';
	ownerId: string;
	schoolId: string;
	balanceCredits: number;
	reservedCredits: number;
	updatedAt: string;
};

export type AiCreditBalanceResponse = {
	schoolWallet: AiCreditWallet;
	userWallet: AiCreditWallet;
};

export type AiCreditLedgerEntry = {
	id: string;
	walletId: string;
	schoolId: string;
	userId: string | null;
	direction: string;
	entryType: string;
	creditsDelta: number;
	balanceAfter: number;
	referenceType: string | null;
	referenceId: string | null;
	metadata?: Record<string, unknown> | null;
	createdAt: string;
	createdBy: string | null;
};

export async function getPricingCatalog() {
	return fetchWithAuth('/api/finance/monetization/pricing') as Promise<PricingCatalog>;
}

export async function validateDiscountCode(body: { code: string; scope?: 'school-onboarding' | 'marketplace' | 'all' }) {
	const response = await fetchWithAuth('/api/finance/monetization/discount-codes/validate', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as { code: ValidatedDiscountCode };
	return response.code;
}

export async function getInvoices() {
	const response = await fetchWithAuth('/api/finance/monetization/invoices') as { invoices: Invoice[] };
	return response.invoices || [];
}

export async function getInvoice(invoiceId: string) {
	const response = await fetchWithAuth(`/api/finance/monetization/invoices/${encodeURIComponent(invoiceId)}`) as { invoice: Invoice };
	return response.invoice;
}

export async function submitInvoicePaymentProof(invoiceId: string, body: {
	proofUrl: string;
	note?: string;
	providerName?: string;
	providerReference?: string;
	amountNaira?: number;
}) {
	const response = await fetchWithAuth(`/api/finance/monetization/invoices/${encodeURIComponent(invoiceId)}/payments/proof`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as { invoice: Invoice };
	return response.invoice;
}

export async function getAiCreditBalance() {
	return fetchWithAuth('/api/finance/monetization/ai-credits/balance') as Promise<AiCreditBalanceResponse>;
}

export async function getAiCreditLedger(ownerType?: 'school' | 'user') {
	const query = ownerType ? `?ownerType=${encodeURIComponent(ownerType)}` : '';
	const response = await fetchWithAuth(`/api/finance/monetization/ai-credits/ledger${query}`) as { entries: AiCreditLedgerEntry[] };
	return response.entries || [];
}

export async function createAiCreditPurchaseIntent(body: { packageId: string; ownerType?: 'school' | 'user' }) {
	return fetchWithAuth('/api/finance/monetization/ai-credits/purchase-intents', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as Promise<{
		purchase: {
			id: string;
			packageId: string;
			invoiceId: string | null;
			creditsPurchased: number;
			nairaAmount: number;
			status: string;
			createdAt: string;
		};
		wallet: AiCreditWallet;
	}>;
}

export async function consumeAiCredits(body: {
	credits: number;
	featureKey: string;
	ownerType?: 'school' | 'user';
	referenceId?: string;
	metadata?: Record<string, unknown>;
}) {
	return fetchWithAuth('/api/finance/monetization/ai-credits/consume', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as Promise<{
		wallet: AiCreditWallet;
		entry: AiCreditLedgerEntry;
	}>;
}

export async function createMarketplacePurchaseIntent(body: { bundleId: string; discountCode?: string }) {
	return fetchWithAuth('/api/finance/monetization/marketplace/purchase-intents', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as Promise<{
		invoice: Invoice;
		bundle: MarketplaceBundle & {
			baseAmount: number;
			discountAmount: number;
			payableAmount: number;
			appliedDiscountCode: Pick<ValidatedDiscountCode, 'id' | 'code' | 'percentageOff'> | null;
		};
	}>;
}

export async function getPriceIncreaseNotices() {
	const response = await fetchWithAuth('/api/finance/monetization/price-increase-notices') as { notices: PriceIncreaseNotice[] };
	return response.notices || [];
}

export async function acknowledgePriceIncreaseNotice(body: { noticeId: string; action: 'dismiss' | 'agree' }) {
	const response = await fetchWithAuth('/api/finance/monetization/price-increase-notices/acknowledge', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as { notices: PriceIncreaseNotice[] };
	return response.notices || [];
}

export async function getPayrollSelfService() {
	return fetchWithAuth('/api/finance/payroll/self-service') as Promise<{
		profile: PayrollPayoutProfile | null;
		slips: PayrollSlip[];
	}>;
}

export async function savePayrollPayoutProfile(body: {
	accountName: string;
	bankName: string;
	accountNumber: string;
	bvn?: string | null;
	nin?: string | null;
	consentAcknowledged?: boolean;
}) {
	const response = await fetchWithAuth('/api/finance/payroll/payout-profile', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as { profile: PayrollPayoutProfile };
	return response.profile;
}

export async function getStaffIncentiveReadiness() {
	const response = await fetchWithAuth('/api/finance/payroll/incentive-readiness') as { readiness: StaffIncentiveReadiness | null };
	return response.readiness;
}

export async function getPayrollAdminSnapshot() {
	return fetchWithAuth('/api/finance/payroll/admin') as Promise<PayrollAdminSnapshot>;
}

export async function preparePayrollMonth(body?: { monthKey?: string; notes?: string | null }) {
	return fetchWithAuth('/api/finance/payroll/months/prepare', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body || {}),
	}) as Promise<PayrollAdminSnapshot>;
}

export async function publishPayrollMonth(monthId: string) {
	return fetchWithAuth(`/api/finance/payroll/months/${encodeURIComponent(monthId)}/publish`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
	}) as Promise<PayrollAdminSnapshot>;
}

export async function updatePayrollConfig(body: {
	userId: string;
	baseSalaryNaira: number;
	allowancesNaira?: number;
	deductionsNaira?: number;
	payrollEnabled?: boolean;
}) {
	const response = await fetchWithAuth('/api/finance/payroll/config', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as { config: PayrollConfig };
	return response.config;
}

export async function updatePayrollSlip(body: {
	slipId: string;
	baseSalaryNaira: number;
	bonusNaira?: number;
	allowancesNaira?: number;
	taxNaira?: number;
	loanNaira?: number;
	deductionsNaira?: number;
	note?: string | null;
}) {
	const response = await fetchWithAuth('/api/finance/payroll/slips', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as { slip: PayrollSlip };
	return response.slip;
}

export async function savePayrollMonthNote(body: {
	monthId: string;
	notes?: string | null;
	directorNote?: string | null;
	generateDefault?: boolean;
}) {
	return fetchWithAuth('/api/finance/payroll/months/note', {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	}) as Promise<PayrollAdminSnapshot>;
}

export async function generatePayrollDirectorSheet(monthId: string) {
	return fetchWithAuth(`/api/finance/payroll/months/${encodeURIComponent(monthId)}/director-sheet`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
	}) as Promise<PayrollAdminSnapshot>;
}

export async function getPayrollHistory(query?: PayrollHistoryQuery) {
	const params = new URLSearchParams();
	if (query?.search) params.set('search', query.search);
	if (query?.monthKey) params.set('monthKey', query.monthKey);
	if (query?.status) params.set('status', query.status);
	const suffix = params.toString() ? `?${params.toString()}` : '';
	return fetchWithAuth(`/api/finance/payroll/history${suffix}`) as Promise<PayrollAdminSnapshot>;
}