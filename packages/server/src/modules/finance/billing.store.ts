import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { ensureSqlSchema, executeSql, queryFirstSql, queryRowsSql } from '../../common/runtimeSqlStore.js';
import { consumeDiscountCode, getMarketplaceBundlePrice, getMarketplaceCatalog, getMonetizationSettings, getTierDiscountedAmounts, validateDiscountCode } from './monetization.store.js';
import { nowIso, plusDays, roundMoney, schoolIdForUser, trimOrNull } from './finance.shared.js';

type InvoiceRow = {
	id: string;
	school_id: string;
	invoice_type: string;
	academic_year: string | null;
	term_key: string | null;
	status: string;
	currency_code: string;
	subtotal_naira: number;
	total_naira: number;
	paid_naira: number;
	balance_naira: number;
	metadata_json: string | null;
	created_at: string;
	updated_at: string;
	due_at: string | null;
};

type InvoiceItemRow = {
	id: string;
	invoice_id: string;
	item_type: string;
	label: string;
	quantity: number;
	unit_amount_naira: number;
	total_amount_naira: number;
	metadata_json: string | null;
};

type InvoicePaymentRow = {
	id: string;
	invoice_id: string;
	school_id: string;
	provider_name: string;
	provider_reference: string;
	status: string;
	amount_naira: number;
	received_at: string | null;
	metadata_json: string | null;
	created_at: string;
	updated_at: string;
};

type BillingEventRow = {
	id: string;
	provider_name: string;
	provider_event_id: string;
	event_type: string;
	event_status: string;
	payload_json: string;
	processed_at: string | null;
	created_at: string;
};

export type InvoiceDetail = ReturnType<typeof mapInvoice> & {
	items: ReturnType<typeof mapInvoiceItem>[];
	payments: ReturnType<typeof mapInvoicePayment>[];
};

const BILLING_SCHEMA_KEY = 'monetization-billing-v1';
const BILLING_SCHEMA_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS invoice_payments (
		id TEXT PRIMARY KEY,
		invoice_id TEXT NOT NULL,
		school_id TEXT NOT NULL,
		provider_name TEXT NOT NULL,
		provider_reference TEXT NOT NULL,
		status TEXT NOT NULL,
		amount_naira REAL NOT NULL,
		received_at TEXT,
		metadata_json TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_provider_ref_idx ON invoice_payments (provider_name, provider_reference)`,
	`CREATE TABLE IF NOT EXISTS billing_provider_events (
		id TEXT PRIMARY KEY,
		provider_name TEXT NOT NULL,
		provider_event_id TEXT NOT NULL,
		event_type TEXT NOT NULL,
		event_status TEXT NOT NULL,
		payload_json TEXT NOT NULL,
		processed_at TEXT,
		created_at TEXT NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS billing_provider_events_provider_idx ON billing_provider_events (provider_name, provider_event_id)`
];

function parseJsonObject(value: string | null) {
	if (!value) return null;
	try {
		return JSON.parse(value) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function mapInvoice(row: InvoiceRow) {
	return {
		id: row.id,
		schoolId: row.school_id,
		invoiceType: row.invoice_type,
		academicYear: row.academic_year,
		termKey: row.term_key,
		status: row.status,
		currencyCode: row.currency_code,
		subtotalNaira: Number(row.subtotal_naira || 0),
		totalNaira: Number(row.total_naira || 0),
		paidNaira: Number(row.paid_naira || 0),
		balanceNaira: Number(row.balance_naira || 0),
		metadata: parseJsonObject(row.metadata_json),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		dueAt: row.due_at,
	};
}

function mapInvoiceItem(row: InvoiceItemRow) {
	return {
		id: row.id,
		invoiceId: row.invoice_id,
		itemType: row.item_type,
		label: row.label,
		quantity: Number(row.quantity || 0),
		unitAmountNaira: Number(row.unit_amount_naira || 0),
		totalAmountNaira: Number(row.total_amount_naira || 0),
		metadata: parseJsonObject(row.metadata_json),
	};
}

function mapInvoicePayment(row: InvoicePaymentRow) {
	return {
		id: row.id,
		invoiceId: row.invoice_id,
		schoolId: row.school_id,
		providerName: row.provider_name,
		providerReference: row.provider_reference,
		status: row.status,
		amountNaira: Number(row.amount_naira || 0),
		receivedAt: row.received_at,
		metadata: parseJsonObject(row.metadata_json),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function mapBillingEvent(row: BillingEventRow) {
	return {
		id: row.id,
		providerName: row.provider_name,
		providerEventId: row.provider_event_id,
		eventType: row.event_type,
		eventStatus: row.event_status,
		payload: parseJsonObject(row.payload_json),
		processedAt: row.processed_at,
		createdAt: row.created_at,
	};
}

export async function ensureBillingSchema() {
	await getMonetizationSettings();
	await ensureSqlSchema(BILLING_SCHEMA_KEY, BILLING_SCHEMA_STATEMENTS);
}

async function loadInvoiceRow(invoiceId: string) {
	await ensureBillingSchema();
	return queryFirstSql<InvoiceRow>('SELECT id, school_id, invoice_type, academic_year, term_key, status, currency_code, subtotal_naira, total_naira, paid_naira, balance_naira, metadata_json, created_at, updated_at, due_at FROM school_invoices WHERE id = ?', [invoiceId]);
}

async function loadInvoiceItems(invoiceId: string) {
	await ensureBillingSchema();
	return queryRowsSql<InvoiceItemRow>('SELECT id, invoice_id, item_type, label, quantity, unit_amount_naira, total_amount_naira, metadata_json FROM school_invoice_items WHERE invoice_id = ? ORDER BY label ASC', [invoiceId]);
}

async function loadInvoicePayments(invoiceId: string) {
	await ensureBillingSchema();
	return queryRowsSql<InvoicePaymentRow>('SELECT id, invoice_id, school_id, provider_name, provider_reference, status, amount_naira, received_at, metadata_json, created_at, updated_at FROM invoice_payments WHERE invoice_id = ? ORDER BY created_at DESC', [invoiceId]);
}

async function loadInvoiceDetail(invoiceId: string): Promise<InvoiceDetail | null> {
	const invoice = await loadInvoiceRow(invoiceId);
	if (!invoice) return null;
	const [items, payments] = await Promise.all([loadInvoiceItems(invoiceId), loadInvoicePayments(invoiceId)]);
	return {
		...mapInvoice(invoice),
		items: items.map(mapInvoiceItem),
		payments: payments.map(mapInvoicePayment),
	};
	}

async function recomputeInvoice(invoiceId: string) {
	const invoice = await loadInvoiceRow(invoiceId);
	if (!invoice) throw new Error('Invoice not found.');
	const paymentRow = await queryFirstSql<{ paid_total: number }>(
		'SELECT COALESCE(SUM(amount_naira), 0) AS paid_total FROM invoice_payments WHERE invoice_id = ? AND status IN (?, ?)',
		[invoiceId, 'succeeded', 'received']
	);
	const paidNaira = roundMoney(Number(paymentRow?.paid_total || 0));
	const totalNaira = roundMoney(Number(invoice.total_naira || 0));
	const balanceNaira = roundMoney(Math.max(0, totalNaira - paidNaira));
	let nextStatus = invoice.status;
	if (balanceNaira <= 0 && totalNaira > 0) nextStatus = 'paid';
	else if (paidNaira > 0 && paidNaira < totalNaira) nextStatus = 'partially-paid';
	await executeSql('UPDATE school_invoices SET paid_naira = ?, balance_naira = ?, status = ?, updated_at = ? WHERE id = ?', [paidNaira, balanceNaira, nextStatus, nowIso(), invoiceId]);
	return loadInvoiceDetail(invoiceId);
}

function resolvePricingTier(studentCount: number, settings: Awaited<ReturnType<typeof getMonetizationSettings>>) {
	const tiers = settings.schoolPricing.tiers;
	return tiers.find((tier) => studentCount >= tier.minStudents && (tier.maxStudents === null || studentCount <= tier.maxStudents)) || tiers[tiers.length - 1];
}

export async function getSchoolPricingCatalog() {
	const settings = await getMonetizationSettings();
	const marketplace = await getMarketplaceCatalog();
	return {
		schoolPricing: {
			...settings.schoolPricing,
			tiers: settings.schoolPricing.tiers.map((tier) => ({
				...tier,
				pricing: getTierDiscountedAmounts(tier),
			})),
		},
		aiEconomy: settings.aiEconomy,
		marketplace,
	};
}

export async function createSchoolTermSnapshot(input: {
	schoolId: string;
	academicYear: string;
	termKey: string;
	studentCount: number;
	capturedBy?: string | null;
}) {
	await ensureBillingSchema();
	const settings = await getMonetizationSettings();
	const studentCount = Math.max(0, Math.round(Number(input.studentCount || 0)));
	const tier = resolvePricingTier(studentCount, settings);
	const snapshotId = `snapshot_${crypto.randomUUID()}`;
	const capturedAt = nowIso();
	await executeSql('INSERT INTO school_term_snapshots (id, school_id, academic_year, term_key, student_count, billing_tier_key, captured_at, captured_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [snapshotId, input.schoolId, input.academicYear, input.termKey, studentCount, tier.key, capturedAt, trimOrNull(input.capturedBy)]);
	return {
		id: snapshotId,
		schoolId: input.schoolId,
		academicYear: input.academicYear,
		termKey: input.termKey,
		studentCount,
		billingTierKey: tier.key,
		capturedAt,
		capturedBy: trimOrNull(input.capturedBy),
	};
}

export async function generateSchoolInvoice(input: {
	schoolId: string;
	academicYear: string;
	termKey: string;
	studentCount: number;
	includeSetupFee?: boolean;
	createdBy?: string | null;
}) {
	await ensureBillingSchema();
	const settings = await getMonetizationSettings();
	const snapshot = await createSchoolTermSnapshot({
		schoolId: input.schoolId,
		academicYear: input.academicYear,
		termKey: input.termKey,
		studentCount: input.studentCount,
		capturedBy: input.createdBy,
	});
	const tier = resolvePricingTier(snapshot.studentCount, settings);
	const invoiceId = `inv_${crypto.randomUUID()}`;
	const createdAt = nowIso();
	const invoiceItems = [
		{
			id: `item_${crypto.randomUUID()}`,
			itemType: 'per-student-term',
			label: `${snapshot.termKey} tuition (${snapshot.studentCount} students)`,
			quantity: snapshot.studentCount,
			unitAmountNaira: tier.perStudentPerTermNaira,
			totalAmountNaira: roundMoney(snapshot.studentCount * tier.perStudentPerTermNaira),
			metadata: { billingTierKey: tier.key },
		},
	];
	if (input.includeSetupFee) {
		invoiceItems.unshift({
			id: `item_${crypto.randomUUID()}`,
			itemType: 'setup-fee',
			label: `${tier.label} setup fee`,
			quantity: 1,
			unitAmountNaira: tier.oneTimeSetupNaira,
			totalAmountNaira: roundMoney(tier.oneTimeSetupNaira),
			metadata: { billingTierKey: tier.key },
		});
	}
	const subtotalNaira = roundMoney(invoiceItems.reduce((sum, item) => sum + item.totalAmountNaira, 0));
	await executeSql('INSERT INTO school_invoices (id, school_id, invoice_type, academic_year, term_key, status, currency_code, subtotal_naira, total_naira, paid_naira, balance_naira, metadata_json, created_at, updated_at, due_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [invoiceId, input.schoolId, 'term-billing', input.academicYear, input.termKey, 'draft', settings.schoolPricing.currencyCode, subtotalNaira, subtotalNaira, 0, subtotalNaira, JSON.stringify({ snapshotId: snapshot.id, includeSetupFee: Boolean(input.includeSetupFee), generatedBy: trimOrNull(input.createdBy) }), createdAt, createdAt, plusDays(14)]);
	for (const item of invoiceItems) {
		await executeSql('INSERT INTO school_invoice_items (id, invoice_id, item_type, label, quantity, unit_amount_naira, total_amount_naira, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [item.id, invoiceId, item.itemType, item.label, item.quantity, item.unitAmountNaira, item.totalAmountNaira, JSON.stringify(item.metadata)]);
	}
	const detail = await loadInvoiceDetail(invoiceId);
	if (!detail) throw new Error('Failed to create invoice.');
	return detail;
}

export async function listInvoices(input?: { schoolId?: string; status?: string }) {
	await ensureBillingSchema();
	const clauses: string[] = [];
	const params: Array<string> = [];
	if (input?.schoolId) {
		clauses.push('school_id = ?');
		params.push(input.schoolId);
	}
	if (input?.status) {
		clauses.push('status = ?');
		params.push(input.status);
	}
	const whereClause = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
	const rows = await queryRowsSql<InvoiceRow>(`SELECT id, school_id, invoice_type, academic_year, term_key, status, currency_code, subtotal_naira, total_naira, paid_naira, balance_naira, metadata_json, created_at, updated_at, due_at FROM school_invoices${whereClause} ORDER BY created_at DESC`, params);
	return rows.map(mapInvoice);
}

export async function listSchoolInvoices(user: User) {
	return listInvoices({ schoolId: schoolIdForUser(user) });
}

export async function getInvoiceDetail(invoiceId: string) {
	await ensureBillingSchema();
	return loadInvoiceDetail(invoiceId);
}

export async function getSchoolInvoiceDetail(user: User, invoiceId: string) {
	const detail = await loadInvoiceDetail(invoiceId);
	if (!detail) return null;
	if (detail.schoolId !== schoolIdForUser(user)) return null;
	return detail;
}

export async function issueInvoice(invoiceId: string, dueAt?: string | null) {
	await ensureBillingSchema();
	const invoice = await loadInvoiceRow(invoiceId);
	if (!invoice) throw new Error('Invoice not found.');
	await executeSql('UPDATE school_invoices SET status = ?, due_at = ?, updated_at = ? WHERE id = ?', ['issued', trimOrNull(dueAt) || invoice.due_at || plusDays(14), nowIso(), invoiceId]);
	const detail = await loadInvoiceDetail(invoiceId);
	if (!detail) throw new Error('Invoice not found.');
	return detail;
}

export async function recordInvoicePayment(input: {
	invoiceId: string;
	providerName: string;
	providerReference: string;
	amountNaira: number;
	status?: string;
	receivedAt?: string | null;
	metadata?: Record<string, unknown>;
}) {
	await ensureBillingSchema();
	const invoice = await loadInvoiceRow(input.invoiceId);
	if (!invoice) throw new Error('Invoice not found.');
	const existing = await queryFirstSql<InvoicePaymentRow>('SELECT id, invoice_id, school_id, provider_name, provider_reference, status, amount_naira, received_at, metadata_json, created_at, updated_at FROM invoice_payments WHERE provider_name = ? AND provider_reference = ?', [input.providerName, input.providerReference]);
	if (!existing) {
		const paymentId = `pay_${crypto.randomUUID()}`;
		const createdAt = nowIso();
		const status = trimOrNull(input.status) || 'succeeded';
		await executeSql('INSERT INTO invoice_payments (id, invoice_id, school_id, provider_name, provider_reference, status, amount_naira, received_at, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [paymentId, input.invoiceId, invoice.school_id, input.providerName, input.providerReference, status, roundMoney(input.amountNaira), trimOrNull(input.receivedAt) || (status === 'succeeded' || status === 'received' ? createdAt : null), input.metadata ? JSON.stringify(input.metadata) : null, createdAt, createdAt]);
	}
	const detail = await recomputeInvoice(input.invoiceId);
	if (!detail) throw new Error('Invoice not found.');
	return detail;
}

export async function recordInvoicePaymentProof(input: {
	invoiceId: string;
	schoolId: string;
	proofUrl: string;
	note?: string;
	providerName?: string;
	providerReference?: string;
	amountNaira?: number;
}) {
	await ensureBillingSchema();
	const invoice = await loadInvoiceRow(input.invoiceId);
	if (!invoice || invoice.school_id !== input.schoolId) throw new Error('Invoice not found.');
	return recordInvoicePayment({
		invoiceId: input.invoiceId,
		providerName: trimOrNull(input.providerName) || 'manual-proof',
		providerReference: trimOrNull(input.providerReference) || `proof_${crypto.randomUUID()}`,
		amountNaira: Number(input.amountNaira || invoice.balance_naira || 0),
		status: 'pending',
		metadata: {
			proofUrl: input.proofUrl,
			note: trimOrNull(input.note),
			source: 'school-upload',
		},
	});
}

export async function recordBillingWebhook(providerName: string, input: {
	providerEventId: string;
	eventType: string;
	eventStatus?: string;
	payload: Record<string, unknown>;
	invoiceId?: string;
	providerReference?: string;
	amountNaira?: number;
	schoolId?: string;
}) {
	await ensureBillingSchema();
	const existing = await queryFirstSql<BillingEventRow>('SELECT id, provider_name, provider_event_id, event_type, event_status, payload_json, processed_at, created_at FROM billing_provider_events WHERE provider_name = ? AND provider_event_id = ?', [providerName, input.providerEventId]);
	if (existing) return mapBillingEvent(existing);
	const createdAt = nowIso();
	const eventId = `evt_${crypto.randomUUID()}`;
	const normalizedStatus = trimOrNull(input.eventStatus) || 'received';
	await executeSql('INSERT INTO billing_provider_events (id, provider_name, provider_event_id, event_type, event_status, payload_json, processed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [eventId, providerName, input.providerEventId, input.eventType, normalizedStatus, JSON.stringify(input.payload || {}), null, createdAt]);
	if (input.invoiceId && input.providerReference && Number(input.amountNaira || 0) > 0 && ['succeeded', 'received', 'paid', 'success'].includes(normalizedStatus.toLowerCase())) {
		await recordInvoicePayment({
			invoiceId: input.invoiceId,
			providerName,
			providerReference: input.providerReference,
			amountNaira: Number(input.amountNaira || 0),
			status: 'received',
			metadata: { webhookEventId: input.providerEventId, schoolId: trimOrNull(input.schoolId) },
		});
		await executeSql('UPDATE billing_provider_events SET processed_at = ? WHERE id = ?', [nowIso(), eventId]);
	}
	const row = await queryFirstSql<BillingEventRow>('SELECT id, provider_name, provider_event_id, event_type, event_status, payload_json, processed_at, created_at FROM billing_provider_events WHERE id = ?', [eventId]);
	if (!row) throw new Error('Billing event not found.');
	return mapBillingEvent(row);
}

export async function createMarketplacePurchaseIntent(user: User, input: { bundleId: string; discountCode?: string | null }) {
	await ensureBillingSchema();
	const settings = await getMonetizationSettings();
	const bundle = settings.marketplace.bundles.find((entry) => entry.id === input.bundleId && entry.active);
	if (!bundle) throw new Error('Marketplace bundle not found.');
	const appliedCode = input.discountCode ? await validateDiscountCode(input.discountCode, 'marketplace') : null;
	const baseAmount = getMarketplaceBundlePrice(bundle);
	const discountAmount = appliedCode ? roundMoney(baseAmount * (Number(appliedCode.percentageOff || 0) / 100)) : 0;
	const payableAmount = Math.max(0, roundMoney(baseAmount - discountAmount));
	const invoiceId = `inv_${crypto.randomUUID()}`;
	const itemId = `item_${crypto.randomUUID()}`;
	const createdAt = nowIso();
	await executeSql('INSERT INTO school_invoices (id, school_id, invoice_type, academic_year, term_key, status, currency_code, subtotal_naira, total_naira, paid_naira, balance_naira, metadata_json, created_at, updated_at, due_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [invoiceId, schoolIdForUser(user), 'marketplace', null, null, 'issued', settings.schoolPricing.currencyCode, baseAmount, payableAmount, 0, payableAmount, JSON.stringify({ bundleId: bundle.id, category: bundle.category, discountCodeId: appliedCode?.id || null, discountCode: appliedCode?.code || null, baseAmount, discountAmount, aiCredits: bundle.aiCredits, keyuAmount: bundle.keyuAmount }), createdAt, createdAt, plusDays(7)]);
	await executeSql('INSERT INTO school_invoice_items (id, invoice_id, item_type, label, quantity, unit_amount_naira, total_amount_naira, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [itemId, invoiceId, 'marketplace-bundle', bundle.label, 1, payableAmount, payableAmount, JSON.stringify({ bundleId: bundle.id, category: bundle.category, discountCodeId: appliedCode?.id || null })]);
	if (appliedCode) {
		await consumeDiscountCode(appliedCode.id, String(user.id || '').trim() || null);
	}
	const invoice = await loadInvoiceDetail(invoiceId);
	if (!invoice) throw new Error('Marketplace invoice could not be created.');
	return {
		invoice,
		bundle: {
			...bundle,
			baseAmount,
			discountAmount,
			payableAmount,
			appliedDiscountCode: appliedCode ? {
				id: appliedCode.id,
				code: appliedCode.code,
				percentageOff: appliedCode.percentageOff,
			} : null,
		},
	};
}
