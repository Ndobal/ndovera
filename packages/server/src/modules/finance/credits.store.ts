import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { ensureSqlSchema, executeSql, queryFirstSql, queryRowsSql } from '../../common/runtimeSqlStore.js';
import { recordInvoicePayment } from './billing.store.js';
import { nowIso, roundMoney, schoolIdForUser, trimOrNull, userIdForUser, type WalletOwnerType } from './finance.shared.js';
import { getMonetizationSettings } from './monetization.store.js';

type WalletRow = {
	id: string;
	owner_type: WalletOwnerType;
	owner_id: string;
	school_id: string;
	balance_credits: number;
	reserved_credits: number;
	updated_at: string;
};

type LedgerRow = {
	id: string;
	wallet_id: string;
	school_id: string;
	user_id: string | null;
	direction: string;
	entry_type: string;
	credits_delta: number;
	balance_after: number;
	reference_type: string | null;
	reference_id: string | null;
	metadata_json: string | null;
	created_at: string;
	created_by: string | null;
};

type PurchaseRow = {
	id: string;
	school_id: string;
	wallet_id: string;
	package_id: string;
	invoice_id: string | null;
	payment_id: string | null;
	credits_purchased: number;
	naira_amount: number;
	status: string;
	created_at: string;
	fulfilled_at: string | null;
};

const AI_CREDIT_SCHEMA_KEY = 'monetization-ai-credits-v1';
const AI_CREDIT_SCHEMA_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS ai_credit_wallets (
		id TEXT PRIMARY KEY,
		owner_type TEXT NOT NULL,
		owner_id TEXT NOT NULL,
		school_id TEXT NOT NULL,
		balance_credits INTEGER NOT NULL DEFAULT 0,
		reserved_credits INTEGER NOT NULL DEFAULT 0,
		updated_at TEXT NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS ai_credit_wallets_owner_idx ON ai_credit_wallets (owner_type, owner_id)`,
	`CREATE TABLE IF NOT EXISTS ai_credit_ledger (
		id TEXT PRIMARY KEY,
		wallet_id TEXT NOT NULL,
		school_id TEXT NOT NULL,
		user_id TEXT,
		direction TEXT NOT NULL,
		entry_type TEXT NOT NULL,
		credits_delta INTEGER NOT NULL,
		balance_after INTEGER NOT NULL,
		reference_type TEXT,
		reference_id TEXT,
		metadata_json TEXT,
		created_at TEXT NOT NULL,
		created_by TEXT
	)`,
	`CREATE TABLE IF NOT EXISTS ai_credit_purchase_orders (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		wallet_id TEXT NOT NULL,
		package_id TEXT NOT NULL,
		invoice_id TEXT,
		payment_id TEXT,
		credits_purchased INTEGER NOT NULL,
		naira_amount REAL NOT NULL,
		status TEXT NOT NULL,
		created_at TEXT NOT NULL,
		fulfilled_at TEXT
	)`
];

function parseJsonObject(value: string | null) {
	if (!value) return null;
	try {
		return JSON.parse(value) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function mapWallet(row: WalletRow) {
	return {
		id: row.id,
		ownerType: row.owner_type,
		ownerId: row.owner_id,
		schoolId: row.school_id,
		balanceCredits: Number(row.balance_credits || 0),
		reservedCredits: Number(row.reserved_credits || 0),
		updatedAt: row.updated_at,
	};
}

function mapLedger(row: LedgerRow) {
	return {
		id: row.id,
		walletId: row.wallet_id,
		schoolId: row.school_id,
		userId: row.user_id,
		direction: row.direction,
		entryType: row.entry_type,
		creditsDelta: Number(row.credits_delta || 0),
		balanceAfter: Number(row.balance_after || 0),
		referenceType: row.reference_type,
		referenceId: row.reference_id,
		metadata: parseJsonObject(row.metadata_json),
		createdAt: row.created_at,
		createdBy: row.created_by,
	};
}

function mapPurchase(row: PurchaseRow) {
	return {
		id: row.id,
		schoolId: row.school_id,
		walletId: row.wallet_id,
		packageId: row.package_id,
		invoiceId: row.invoice_id,
		paymentId: row.payment_id,
		creditsPurchased: Number(row.credits_purchased || 0),
		nairaAmount: Number(row.naira_amount || 0),
		status: row.status,
		createdAt: row.created_at,
		fulfilledAt: row.fulfilled_at,
	};
}

export async function ensureAiCreditSchema() {
	await getMonetizationSettings();
	await ensureSqlSchema(AI_CREDIT_SCHEMA_KEY, AI_CREDIT_SCHEMA_STATEMENTS);
}

async function getOrCreateWallet(ownerType: WalletOwnerType, ownerId: string, schoolId: string) {
	await ensureAiCreditSchema();
	const existing = await queryFirstSql<WalletRow>('SELECT id, owner_type, owner_id, school_id, balance_credits, reserved_credits, updated_at FROM ai_credit_wallets WHERE owner_type = ? AND owner_id = ?', [ownerType, ownerId]);
	if (existing) return mapWallet(existing);
	const walletId = `wallet_${crypto.randomUUID()}`;
	const updatedAt = nowIso();
	await executeSql('INSERT INTO ai_credit_wallets (id, owner_type, owner_id, school_id, balance_credits, reserved_credits, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [walletId, ownerType, ownerId, schoolId, 0, 0, updatedAt]);
	return { id: walletId, ownerType, ownerId, schoolId, balanceCredits: 0, reservedCredits: 0, updatedAt };
}

async function applyLedgerEntry(input: {
	walletId: string;
	schoolId: string;
	userId?: string | null;
	creditsDelta: number;
	entryType: string;
	referenceType?: string | null;
	referenceId?: string | null;
	metadata?: Record<string, unknown>;
	createdBy?: string | null;
}) {
	await ensureAiCreditSchema();
	const wallet = await queryFirstSql<WalletRow>('SELECT id, owner_type, owner_id, school_id, balance_credits, reserved_credits, updated_at FROM ai_credit_wallets WHERE id = ?', [input.walletId]);
	if (!wallet) throw new Error('AI credit wallet not found.');
	const nextBalance = Number(wallet.balance_credits || 0) + Math.round(input.creditsDelta);
	if (nextBalance < 0) throw new Error('Insufficient AI credits.');
	const createdAt = nowIso();
	await executeSql('UPDATE ai_credit_wallets SET balance_credits = ?, updated_at = ? WHERE id = ?', [nextBalance, createdAt, input.walletId]);
	const ledgerId = `ledger_${crypto.randomUUID()}`;
	await executeSql('INSERT INTO ai_credit_ledger (id, wallet_id, school_id, user_id, direction, entry_type, credits_delta, balance_after, reference_type, reference_id, metadata_json, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [ledgerId, input.walletId, input.schoolId, trimOrNull(input.userId), input.creditsDelta >= 0 ? 'credit' : 'debit', input.entryType, Math.round(input.creditsDelta), nextBalance, trimOrNull(input.referenceType), trimOrNull(input.referenceId), input.metadata ? JSON.stringify(input.metadata) : null, createdAt, trimOrNull(input.createdBy)]);
	const row = await queryFirstSql<LedgerRow>('SELECT id, wallet_id, school_id, user_id, direction, entry_type, credits_delta, balance_after, reference_type, reference_id, metadata_json, created_at, created_by FROM ai_credit_ledger WHERE id = ?', [ledgerId]);
	if (!row) throw new Error('AI credit ledger entry not found.');
	return mapLedger(row);
}

function resolveWalletOwner(user: User, ownerType: WalletOwnerType) {
	return ownerType === 'user'
		? { ownerType, ownerId: userIdForUser(user), schoolId: schoolIdForUser(user) }
		: { ownerType, ownerId: schoolIdForUser(user), schoolId: schoolIdForUser(user) };
}

export async function getAiCreditBalanceForUser(user: User) {
	const schoolWallet = await getOrCreateWallet('school', schoolIdForUser(user), schoolIdForUser(user));
	const userWallet = await getOrCreateWallet('user', userIdForUser(user), schoolIdForUser(user));
	return { schoolWallet, userWallet };
}

export async function listAiCreditLedger(input: { schoolId: string; ownerType?: WalletOwnerType; ownerId?: string }) {
	await ensureAiCreditSchema();
	const clauses = ['school_id = ?'];
	const params: Array<string> = [input.schoolId];
	if (input.ownerType) {
		clauses.push('wallet_id IN (SELECT id FROM ai_credit_wallets WHERE owner_type = ?' + (input.ownerId ? ' AND owner_id = ?' : '') + ')');
		params.push(input.ownerType);
		if (input.ownerId) params.push(input.ownerId);
	}
	const rows = await queryRowsSql<LedgerRow>(`SELECT id, wallet_id, school_id, user_id, direction, entry_type, credits_delta, balance_after, reference_type, reference_id, metadata_json, created_at, created_by FROM ai_credit_ledger WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`, params);
	return rows.map(mapLedger);
}

export async function listAiCreditLedgerForUser(user: User, ownerType?: WalletOwnerType) {
	const resolved = ownerType ? resolveWalletOwner(user, ownerType) : null;
	return listAiCreditLedger({ schoolId: schoolIdForUser(user), ownerType: resolved?.ownerType, ownerId: resolved?.ownerId });
}

export async function createAiCreditPurchaseIntent(user: User, input: { packageId: string; ownerType?: WalletOwnerType }) {
	await ensureAiCreditSchema();
	const settings = await getMonetizationSettings();
	const selectedPackage = settings.aiEconomy.packages.find((entry) => entry.id === input.packageId);
	if (!selectedPackage) throw new Error('AI credit package not found.');
	const resolved = resolveWalletOwner(user, input.ownerType || 'school');
	const wallet = await getOrCreateWallet(resolved.ownerType, resolved.ownerId, resolved.schoolId);
	const purchaseId = `purchase_${crypto.randomUUID()}`;
	const invoiceId = `inv_${crypto.randomUUID()}`;
	const itemId = `item_${crypto.randomUUID()}`;
	const createdAt = nowIso();
	await executeSql('INSERT INTO school_invoices (id, school_id, invoice_type, academic_year, term_key, status, currency_code, subtotal_naira, total_naira, paid_naira, balance_naira, metadata_json, created_at, updated_at, due_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [invoiceId, resolved.schoolId, 'ai-credits', null, null, 'issued', settings.schoolPricing.currencyCode, roundMoney(selectedPackage.nairaAmount), roundMoney(selectedPackage.nairaAmount), 0, roundMoney(selectedPackage.nairaAmount), JSON.stringify({ packageId: selectedPackage.id, walletOwnerType: resolved.ownerType, walletOwnerId: resolved.ownerId }), createdAt, createdAt, createdAt]);
	await executeSql('INSERT INTO school_invoice_items (id, invoice_id, item_type, label, quantity, unit_amount_naira, total_amount_naira, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [itemId, invoiceId, 'ai-credit-pack', `${selectedPackage.label} AI credits`, selectedPackage.aiCredits, roundMoney(selectedPackage.nairaAmount / selectedPackage.aiCredits), roundMoney(selectedPackage.nairaAmount), JSON.stringify({ packageId: selectedPackage.id })]);
	await executeSql('INSERT INTO ai_credit_purchase_orders (id, school_id, wallet_id, package_id, invoice_id, payment_id, credits_purchased, naira_amount, status, created_at, fulfilled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [purchaseId, resolved.schoolId, wallet.id, selectedPackage.id, invoiceId, null, selectedPackage.aiCredits, roundMoney(selectedPackage.nairaAmount), 'pending', createdAt, null]);
	const purchase = await queryFirstSql<PurchaseRow>('SELECT id, school_id, wallet_id, package_id, invoice_id, payment_id, credits_purchased, naira_amount, status, created_at, fulfilled_at FROM ai_credit_purchase_orders WHERE id = ?', [purchaseId]);
	if (!purchase) throw new Error('AI credit purchase order not found.');
	return { purchase: mapPurchase(purchase), wallet };
}

export async function fulfillAiCreditPurchase(purchaseId: string, fulfilledBy?: string | null) {
	await ensureAiCreditSchema();
	const purchase = await queryFirstSql<PurchaseRow>('SELECT id, school_id, wallet_id, package_id, invoice_id, payment_id, credits_purchased, naira_amount, status, created_at, fulfilled_at FROM ai_credit_purchase_orders WHERE id = ?', [purchaseId]);
	if (!purchase) throw new Error('AI credit purchase order not found.');
	if (purchase.status !== 'fulfilled') {
		await applyLedgerEntry({
			walletId: purchase.wallet_id,
			schoolId: purchase.school_id,
			creditsDelta: Number(purchase.credits_purchased || 0),
			entryType: 'purchase',
			referenceType: 'purchase-order',
			referenceId: purchase.id,
			metadata: { packageId: purchase.package_id },
			createdBy: trimOrNull(fulfilledBy),
		});
		await executeSql('UPDATE ai_credit_purchase_orders SET status = ?, fulfilled_at = ? WHERE id = ?', ['fulfilled', nowIso(), purchaseId]);
		if (purchase.invoice_id) {
			await recordInvoicePayment({
				invoiceId: purchase.invoice_id,
				providerName: 'ai-credit-fulfilment',
				providerReference: purchase.id,
				amountNaira: Number(purchase.naira_amount || 0),
				status: 'received',
				metadata: { autoFulfilled: true },
			});
		}
	}
	const nextPurchase = await queryFirstSql<PurchaseRow>('SELECT id, school_id, wallet_id, package_id, invoice_id, payment_id, credits_purchased, naira_amount, status, created_at, fulfilled_at FROM ai_credit_purchase_orders WHERE id = ?', [purchaseId]);
	if (!nextPurchase) throw new Error('AI credit purchase order not found.');
	const wallet = await queryFirstSql<WalletRow>('SELECT id, owner_type, owner_id, school_id, balance_credits, reserved_credits, updated_at FROM ai_credit_wallets WHERE id = ?', [nextPurchase.wallet_id]);
	if (!wallet) throw new Error('AI credit wallet not found.');
	return { purchase: mapPurchase(nextPurchase), wallet: mapWallet(wallet) };
}

export async function adjustAiCredits(input: {
	schoolId: string;
	ownerType: WalletOwnerType;
	ownerId: string;
	creditsDelta: number;
	reason: string;
	metadata?: Record<string, unknown>;
	createdBy?: string | null;
}) {
	const wallet = await getOrCreateWallet(input.ownerType, input.ownerId, input.schoolId);
	const ledger = await applyLedgerEntry({
		walletId: wallet.id,
		schoolId: input.schoolId,
		creditsDelta: Math.round(input.creditsDelta),
		entryType: input.creditsDelta >= 0 ? 'manual-adjustment-credit' : 'manual-adjustment-debit',
		referenceType: 'manual-adjustment',
		referenceId: input.reason,
		metadata: input.metadata,
		createdBy: trimOrNull(input.createdBy),
	});
	const nextWallet = await queryFirstSql<WalletRow>('SELECT id, owner_type, owner_id, school_id, balance_credits, reserved_credits, updated_at FROM ai_credit_wallets WHERE id = ?', [wallet.id]);
	if (!nextWallet) throw new Error('AI credit wallet not found.');
	return { wallet: mapWallet(nextWallet), ledger };
}

export async function consumeAiCredits(user: User, input: {
	credits: number;
	featureKey: string;
	ownerType?: WalletOwnerType;
	referenceId?: string;
	metadata?: Record<string, unknown>;
}) {
	const resolved = resolveWalletOwner(user, input.ownerType || 'school');
	const wallet = await getOrCreateWallet(resolved.ownerType, resolved.ownerId, resolved.schoolId);
	const ledger = await applyLedgerEntry({
		walletId: wallet.id,
		schoolId: resolved.schoolId,
		userId: userIdForUser(user),
		creditsDelta: -Math.abs(Math.round(input.credits || 0)),
		entryType: 'ai-usage',
		referenceType: 'feature',
		referenceId: trimOrNull(input.referenceId) || input.featureKey,
		metadata: { featureKey: input.featureKey, ...(input.metadata || {}) },
		createdBy: userIdForUser(user),
	});
	const nextWallet = await queryFirstSql<WalletRow>('SELECT id, owner_type, owner_id, school_id, balance_credits, reserved_credits, updated_at FROM ai_credit_wallets WHERE id = ?', [wallet.id]);
	if (!nextWallet) throw new Error('AI credit wallet not found.');
	return { wallet: mapWallet(nextWallet), ledger };
}
