import { getApiUrl } from '../../../config/apiBase';

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'authUser';
const AUTH_COOKIE_KEY = 'ndovera_token';
const AUTH_PROFILE_SYNC_KEY = 'authProfileSyncedAt';
const SIGNED_OUT_REDIRECT_PATH = '/';
const AUTH_PROFILE_MAX_AGE_MS = 5 * 60 * 1000;

function getCookie(name) {
	const match = document.cookie
		.split(';')
		.map(part => part.trim())
		.find(part => part.startsWith(`${name}=`));
	return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function setAuthCookie(token) {
	document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; path=/; domain=.ndovera.com; max-age=600; secure; samesite=lax`;
}

function clearAuthCookie() {
	const expiredCookie = `${AUTH_COOKIE_KEY}=; path=/; max-age=0; secure; samesite=lax`;
	document.cookie = expiredCookie;
	document.cookie = `${expiredCookie}; domain=.ndovera.com`;
}

function storeToken(token) {
	if (!token) return;
	window.localStorage.setItem(AUTH_TOKEN_KEY, token);
	setAuthCookie(token);
}

function safeParse(value) {
	if (!value) return null;

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function decodeBase64Url(value) {
	if (!value) return '';

	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

	try {
		return atob(padded);
	} catch {
		return '';
	}
}

function parseTokenPayload(token) {
	if (!token) return null;

	const parts = token.split('.');
	if (parts.length < 2) return null;

	return safeParse(decodeBase64Url(parts[1]));
}

function normalizeComparableValue(value) {
	return String(value || '').trim().toLowerCase();
}

function readProfileSyncedAt() {
	const rawValue = Number(window.localStorage.getItem(AUTH_PROFILE_SYNC_KEY));
	return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
}

function markProfileSynced() {
	window.localStorage.setItem(AUTH_PROFILE_SYNC_KEY, String(Date.now()));
}

function hasEssentialUserContext(user) {
	if (!user?.id || !user?.role || !String(user?.name || '').trim()) return false;

	const normalizedRole = normalizeComparableValue(user.role);
	const hasTenantContext = Boolean(String(user.tenantId || user.schoolId || '').trim());
	if (normalizedRole !== 'ami' && !hasTenantContext) return false;

	if (normalizedRole === 'student' && !String(user.classId || window.localStorage.getItem('classroomId') || '').trim()) {
		return false;
	}

	return true;
}

function isProfileStale(profileSyncedAt) {
	if (!profileSyncedAt) return true;
	return (Date.now() - profileSyncedAt) > AUTH_PROFILE_MAX_AGE_MS;
}

function buildUserFromTokenPayload(payload) {
	if (!payload?.id || !payload?.role) return null;

	const tenantId = String(payload.tenantId || '').trim();

	return {
		id: payload.id,
		email: payload.id,
		role: payload.role,
		name: payload.name || '',
		...(tenantId ? { tenantId, schoolId: tenantId } : {}),
		...(payload.mustChangePassword === true ? { mustChangePassword: true } : {}),
	};
}

function userMatchesTokenPayload(user, payload) {
	if (!user || !payload) return false;

	const userId = normalizeComparableValue(user.id || user.email);
	const tokenId = normalizeComparableValue(payload.id);
	if (!userId || !tokenId || userId !== tokenId) return false;

	const userRole = normalizeComparableValue(user.role);
	const tokenRole = normalizeComparableValue(payload.role);
	if (userRole && tokenRole && userRole !== tokenRole) return false;

	const userTenantId = normalizeComparableValue(user.tenantId || user.schoolId);
	const tokenTenantId = normalizeComparableValue(payload.tenantId);
	if (userTenantId && tokenTenantId && userTenantId !== tokenTenantId) return false;

	return true;
}

function mergeStoredUserWithToken(storedUser, payload) {
	const tokenUser = buildUserFromTokenPayload(payload);

	if (!storedUser) return tokenUser;
	if (!tokenUser) return storedUser;
	if (!userMatchesTokenPayload(storedUser, payload)) return tokenUser;

	const tenantId = storedUser.tenantId || storedUser.schoolId || tokenUser.tenantId || tokenUser.schoolId;

	return {
		...tokenUser,
		...storedUser,
		id: storedUser.id || tokenUser.id,
		email: storedUser.email || tokenUser.email,
		role: storedUser.role || tokenUser.role,
		name: storedUser.name || tokenUser.name,
		...(tenantId ? { tenantId, schoolId: storedUser.schoolId || storedUser.tenantId || tokenUser.schoolId } : {}),
		...(storedUser.mustChangePassword === true || tokenUser.mustChangePassword === true ? { mustChangePassword: true } : {}),
	};
}

export function getSignedOutRedirectPath() {
	return SIGNED_OUT_REDIRECT_PATH;
}

export function getStoredAuth() {
	const localToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
	const cookieToken = getCookie(AUTH_COOKIE_KEY);
	const token = cookieToken || localToken;
	const tokenChanged = Boolean(cookieToken && cookieToken !== localToken);
	const storedUser = safeParse(window.localStorage.getItem(AUTH_USER_KEY));
	const tokenPayload = parseTokenPayload(token);
	const profileSyncedAt = readProfileSyncedAt();

	if (!token) {
		return null;
	}

	if (tokenChanged) {
		window.localStorage.removeItem('selectedRole');
	}

	if (cookieToken && cookieToken !== localToken) {
		window.localStorage.setItem(AUTH_TOKEN_KEY, cookieToken);
	} else if (!localToken) {
		window.localStorage.setItem(AUTH_TOKEN_KEY, token);
	}

	const identityMismatch = Boolean(tokenChanged && storedUser && tokenPayload && !userMatchesTokenPayload(storedUser, tokenPayload));
	if (identityMismatch) {
		window.localStorage.removeItem(AUTH_USER_KEY);
	}

	const user = mergeStoredUserWithToken(identityMismatch ? null : storedUser, tokenPayload);
	const needsHydration = !storedUser || !user?.role || identityMismatch || Boolean(tokenChanged && !tokenPayload) || !hasEssentialUserContext(user) || isProfileStale(profileSyncedAt);

	return {
		token,
		user,
		...(profileSyncedAt ? { profileSyncedAt } : {}),
		...(needsHydration ? { needsHydration: true } : {}),
	};
}

export function persistAuth(payload, options = {}) {
	const token = payload?.token;
	const user = payload?.user || {
		id: payload?.id,
		email: payload?.id,
		role: payload?.role,
		name: payload?.name,
	};
	const normalizedUser = {
		...user,
		...(payload?.mustChangePassword === true ? { mustChangePassword: true } : {}),
	};

	if (!token || !normalizedUser?.role) {
		throw new Error('Invalid authentication payload');
	}

	storeToken(token);
	window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
	markProfileSynced();
	if (options?.preserveSelectedRole !== true) {
		window.localStorage.removeItem('selectedRole');
	}
	// Also expose classroomId and userId as standalone keys for legacy reads
	if (normalizedUser.classId) window.localStorage.setItem('classroomId', normalizedUser.classId);
	if (normalizedUser.id) window.localStorage.setItem('userId', normalizedUser.id);

	return { token, user: normalizedUser };
}

export function syncRefreshedToken(response) {
	const refreshedToken = response?.headers?.get?.('X-Refresh-Token');
	if (refreshedToken) {
		storeToken(refreshedToken);
	}
	return refreshedToken || '';
}

export function clearStoredAuth() {
	window.localStorage.removeItem(AUTH_TOKEN_KEY);
	window.localStorage.removeItem(AUTH_USER_KEY);
	window.localStorage.removeItem(AUTH_PROFILE_SYNC_KEY);
	window.localStorage.removeItem('selectedRole');
	clearAuthCookie();
}

export async function login(credentials) {
	const response = await fetch(getApiUrl('/api/auth/login'), {
		method: 'POST',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(credentials),
	});

	const data = await response.json().catch(() => ({ error: 'Unable to complete login.' }));
	syncRefreshedToken(response);

	if (!response.ok) {
		throw new Error(data.error || data.message || 'Unable to complete login.');
	}

	return persistAuth(data);
}

export async function changePassword(payload, token) {
	const response = await fetch(getApiUrl('/api/auth/change-password'), {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify(payload),
	});
	const data = await response.json().catch(() => ({}));
	syncRefreshedToken(response);
	if (!response.ok) throw new Error(data.error || 'Could not change password.');
	return data;
}

export async function requestPasswordReset(email) {
	const response = await fetch(getApiUrl('/api/auth/forgot-password'), {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email }),
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || 'Could not request password reset.');
	return data;
}

export async function resetPasswordWithToken(payload) {
	const response = await fetch(getApiUrl('/api/auth/reset-password'), {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || 'Could not reset password.');
	return data;
}

const authApi = {
	login,
	getStoredAuth,
	clearStoredAuth,
	persistAuth,
	syncRefreshedToken,
	changePassword,
	requestPasswordReset,
	resetPasswordWithToken,
};

export default authApi;
