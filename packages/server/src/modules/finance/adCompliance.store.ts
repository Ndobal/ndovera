import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { ensureSqlSchema, executeSql, queryFirstSql, queryRowsSql } from '../../common/runtimeSqlStore.js';
import { nowIso, schoolIdForUser, trimOrNull, userIdForUser } from './finance.shared.js';
import { getMonetizationSettings } from './monetization.store.js';

type ConsentRow = {
	id: string;
	school_id: string;
	user_id: string;
	consent_scope: string;
	consent_status: string;
	policy_version: string;
	lawful_basis: string;
	recorded_at: string;
	expires_at: string | null;
	metadata_json: string | null;
};

type ReceiptRow = {
	id: string;
	impression_event_id: string;
	provider_name: string;
	provider_impression_id: string | null;
	request_fingerprint: string;
	consent_record_id: string | null;
	retention_until: string | null;
	created_at: string;
};

type AdEventRow = {
	id: string;
	school_id: string;
	user_id: string;
	role_name: string;
	focus_session_id: string | null;
	page_key: string;
	placement_key: string;
	network_name: string;
	impression_status: string;
	system_revenue_naira: number;
	hidden_teacher_incentive_naira: number;
	created_at: string;
	metadata_json: string | null;
	receipt_id: string | null;
	provider_impression_id: string | null;
	request_fingerprint: string | null;
	consent_record_id: string | null;
	retention_until: string | null;
};

const AD_COMPLIANCE_SCHEMA_KEY = 'monetization-ad-compliance-v1';
const AD_COMPLIANCE_SCHEMA_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS ad_consent_records (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		consent_scope TEXT NOT NULL,
		consent_status TEXT NOT NULL,
		policy_version TEXT NOT NULL,
		lawful_basis TEXT NOT NULL,
		recorded_at TEXT NOT NULL,
		expires_at TEXT,
		metadata_json TEXT
	)`,
	`CREATE TABLE IF NOT EXISTS ad_event_receipts (
		id TEXT PRIMARY KEY,
		impression_event_id TEXT NOT NULL,
		provider_name TEXT NOT NULL,
		provider_impression_id TEXT,
		request_fingerprint TEXT NOT NULL,
		consent_record_id TEXT,
		retention_until TEXT,
		created_at TEXT NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS ad_event_receipts_fingerprint_idx ON ad_event_receipts (provider_name, request_fingerprint)`
];

function parseJsonObject(value: string | null) {
	if (!value) return null;
	try {
		return JSON.parse(value) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function mapConsent(row: ConsentRow) {
	return {
		id: row.id,
		schoolId: row.school_id,
		userId: row.user_id,
		consentScope: row.consent_scope,
		consentStatus: row.consent_status,
		policyVersion: row.policy_version,
		lawfulBasis: row.lawful_basis,
		recordedAt: row.recorded_at,
		expiresAt: row.expires_at,
		metadata: parseJsonObject(row.metadata_json),
	};
}

function mapReceipt(row: ReceiptRow) {
	return {
		id: row.id,
		impressionEventId: row.impression_event_id,
		providerName: row.provider_name,
		providerImpressionId: row.provider_impression_id,
		requestFingerprint: row.request_fingerprint,
		consentRecordId: row.consent_record_id,
		retentionUntil: row.retention_until,
		createdAt: row.created_at,
	};
}

function mapAdEvent(row: AdEventRow) {
	return {
		id: row.id,
		schoolId: row.school_id,
		userId: row.user_id,
		roleName: row.role_name,
		focusSessionId: row.focus_session_id,
		pageKey: row.page_key,
		placementKey: row.placement_key,
		networkName: row.network_name,
		impressionStatus: row.impression_status,
		systemRevenueNaira: Number(row.system_revenue_naira || 0),
		hiddenTeacherIncentiveNaira: Number(row.hidden_teacher_incentive_naira || 0),
		createdAt: row.created_at,
		metadata: parseJsonObject(row.metadata_json),
		receiptId: row.receipt_id,
		providerImpressionId: row.provider_impression_id,
		requestFingerprint: row.request_fingerprint,
		consentRecordId: row.consent_record_id,
		retentionUntil: row.retention_until,
	};
}

export async function ensureAdComplianceSchema() {
	await getMonetizationSettings();
	await ensureSqlSchema(AD_COMPLIANCE_SCHEMA_KEY, AD_COMPLIANCE_SCHEMA_STATEMENTS);
}

export async function recordAdConsent(user: User, input: {
	consentScope: string;
	consentStatus: string;
	policyVersion: string;
	lawfulBasis: string;
	expiresAt?: string | null;
	metadata?: Record<string, unknown>;
}) {
	await ensureAdComplianceSchema();
	const consentId = `consent_${crypto.randomUUID()}`;
	const recordedAt = nowIso();
	await executeSql('INSERT INTO ad_consent_records (id, school_id, user_id, consent_scope, consent_status, policy_version, lawful_basis, recorded_at, expires_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [consentId, schoolIdForUser(user), userIdForUser(user), input.consentScope, input.consentStatus, input.policyVersion, input.lawfulBasis, recordedAt, trimOrNull(input.expiresAt), input.metadata ? JSON.stringify(input.metadata) : null]);
	const row = await queryFirstSql<ConsentRow>('SELECT id, school_id, user_id, consent_scope, consent_status, policy_version, lawful_basis, recorded_at, expires_at, metadata_json FROM ad_consent_records WHERE id = ?', [consentId]);
	if (!row) throw new Error('Ad consent record not found.');
	return mapConsent(row);
}

export async function listAdConsentRecords(input: { schoolId?: string; userId?: string }) {
	await ensureAdComplianceSchema();
	const clauses: string[] = [];
	const params: Array<string> = [];
	if (input.schoolId) {
		clauses.push('school_id = ?');
		params.push(input.schoolId);
	}
	if (input.userId) {
		clauses.push('user_id = ?');
		params.push(input.userId);
	}
	const whereClause = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
	const rows = await queryRowsSql<ConsentRow>(`SELECT id, school_id, user_id, consent_scope, consent_status, policy_version, lawful_basis, recorded_at, expires_at, metadata_json FROM ad_consent_records${whereClause} ORDER BY recorded_at DESC`, params);
	return rows.map(mapConsent);
}

export async function listAdConsentRecordsForUser(user: User) {
	return listAdConsentRecords({ schoolId: schoolIdForUser(user), userId: userIdForUser(user) });
}

export async function recordAdEventReceipt(input: {
	impressionEventId: string;
	providerName: string;
	providerImpressionId?: string | null;
	requestFingerprint?: string | null;
	consentRecordId?: string | null;
	retentionUntil?: string | null;
}) {
	await ensureAdComplianceSchema();
	const event = await queryFirstSql<{ id: string }>('SELECT id FROM ad_impression_events WHERE id = ?', [input.impressionEventId]);
	if (!event) throw new Error('Ad impression event not found.');
	const requestFingerprint = trimOrNull(input.requestFingerprint) || `evt:${input.impressionEventId}`;
	const existing = await queryFirstSql<ReceiptRow>('SELECT id, impression_event_id, provider_name, provider_impression_id, request_fingerprint, consent_record_id, retention_until, created_at FROM ad_event_receipts WHERE provider_name = ? AND request_fingerprint = ?', [input.providerName, requestFingerprint]);
	if (existing) return mapReceipt(existing);
	const receiptId = `receipt_${crypto.randomUUID()}`;
	const createdAt = nowIso();
	await executeSql('INSERT INTO ad_event_receipts (id, impression_event_id, provider_name, provider_impression_id, request_fingerprint, consent_record_id, retention_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [receiptId, input.impressionEventId, input.providerName, trimOrNull(input.providerImpressionId), requestFingerprint, trimOrNull(input.consentRecordId), trimOrNull(input.retentionUntil), createdAt]);
	const row = await queryFirstSql<ReceiptRow>('SELECT id, impression_event_id, provider_name, provider_impression_id, request_fingerprint, consent_record_id, retention_until, created_at FROM ad_event_receipts WHERE id = ?', [receiptId]);
	if (!row) throw new Error('Ad event receipt not found.');
	return mapReceipt(row);
}

export async function listAdEvents(input: { schoolId?: string; impressionStatus?: string }) {
	await ensureAdComplianceSchema();
	const clauses: string[] = [];
	const params: Array<string> = [];
	if (input.schoolId) {
		clauses.push('e.school_id = ?');
		params.push(input.schoolId);
	}
	if (input.impressionStatus) {
		clauses.push('e.impression_status = ?');
		params.push(input.impressionStatus);
	}
	const whereClause = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
	const rows = await queryRowsSql<AdEventRow>(`SELECT e.id, e.school_id, e.user_id, e.role_name, e.focus_session_id, e.page_key, e.placement_key, e.network_name, e.impression_status, e.system_revenue_naira, e.hidden_teacher_incentive_naira, e.created_at, e.metadata_json, r.id AS receipt_id, r.provider_impression_id, r.request_fingerprint, r.consent_record_id, r.retention_until FROM ad_impression_events e LEFT JOIN ad_event_receipts r ON r.impression_event_id = e.id${whereClause} ORDER BY e.created_at DESC`, params);
	return rows.map(mapAdEvent);
}

export async function reprocessAdEvents(input: { impressionIds: string[]; retentionUntil?: string | null }) {
	await ensureAdComplianceSchema();
	const results = [] as Array<ReturnType<typeof mapReceipt>>;
	for (const impressionId of input.impressionIds) {
		const event = await queryFirstSql<{ id: string; network_name: string }>('SELECT id, network_name FROM ad_impression_events WHERE id = ?', [impressionId]);
		if (!event) continue;
		results.push(await recordAdEventReceipt({ impressionEventId: event.id, providerName: event.network_name, requestFingerprint: `reprocess:${event.id}`, retentionUntil: input.retentionUntil }));
	}
	return results;
}
