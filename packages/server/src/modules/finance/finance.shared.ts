import type { User } from '../../../rbac.js';

export type WalletOwnerType = 'school' | 'user';

export function nowIso() {
	return new Date().toISOString();
}

export function roundMoney(value: number) {
	return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function schoolIdForUser(user: User) {
	return String(user.school_id || 'school-1').trim();
}

export function userIdForUser(user: User) {
	return String(user.id || '').trim();
}

export function trimOrNull(value: unknown) {
	const normalized = String(value || '').trim();
	return normalized || null;
}

export function plusDays(days: number) {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString();
}
