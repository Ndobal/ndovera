import { getApiUrl } from '../../../config/apiBase';

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'authUser';
const AUTH_COOKIE_KEY = 'ndovera_token';
const AUTH_PROFILE_SYNC_KEY = 'authProfileSyncedAt';
const SIGNED_OUT_REDIRECT_PATH = '/';
const TENANT_SITE_URL_KEY = 'tenantWebsiteUrl';
const SIGNED_OUT_TENANT_REDIRECT_KEY = 'signedOutRedirectUrl';
const AUTH_PROFILE_MAX_AGE_MS = 5 * 60 * 1000;
const PLATFORM_BASE_DOMAIN = 'ndovera.com';

function normalizeHostname(value) {
	const raw = String(value || '').trim().toLowerCase();
	if (!raw) return '';

	try {
		const parsed = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
		return String(parsed.hostname || '').trim().toLowerCase().replace(/\.$/, '');
	} catch {
		return raw.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '');
	}
}

function shouldUseSharedAuthCookieDomain(hostname = window.location.hostname) {
	const normalizedHost = normalizeHostname(hostname);
	return normalizedHost === PLATFORM_BASE_DOMAIN || normalizedHost.endsWith(`.${PLATFORM_BASE_DOMAIN}`);
}

function buildCookieDomainClause(hostname = window.location.hostname) {
	return shouldUseSharedAuthCookieDomain(hostname) ? `; domain=.${PLATFORM_BASE_DOMAIN}` : '';
}

function normalizeTenantSiteUrl(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';

	try {
		const parsed = new URL(raw);
		if (!/^https?:$/i.test(parsed.protocol)) return '';
		const normalizedHost = normalizeHostname(parsed.hostname);
		if (!normalizedHost || normalizedHost === PLATFORM_BASE_DOMAIN || normalizedHost === `www.${PLATFORM_BASE_DOMAIN}`) {
			return '';
		}
		return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '');
	} catch {
		return '';
	}
}

export function rememberTenantSiteUrl(value, options = {}) {
	const normalizedUrl = normalizeTenantSiteUrl(value);
	if (!normalizedUrl) return '';
	window.localStorage.setItem(TENANT_SITE_URL_KEY, normalizedUrl);
	if (options.persistSignedOutRedirect !== false) {
		window.sessionStorage.setItem(SIGNED_OUT_TENANT_REDIRECT_KEY, normalizedUrl);
	}
	return normalizedUrl;
}

export function consumeTenantReturnUrlFromLocation() {
	const params = new URLSearchParams(window.location.search);
	const tenantReturnUrl = params.get('tenantReturnUrl');
	const remembered = rememberTenantSiteUrl(tenantReturnUrl, { persistSignedOutRedirect: true });
	if (!tenantReturnUrl) return remembered;

	params.delete('tenantReturnUrl');
	const nextQuery = params.toString();
	const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
	window.history.replaceState({}, document.title, nextUrl);
	return remembered;
}

function getCookie(name) {
	const match = document.cookie
		.split(';')
		.map(part => part.trim())
		.find(part => part.startsWith(`${name}=`));
	return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function setAuthCookie(token) {
	document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; path=/${buildCookieDomainClause()}; max-age=2592000; secure; samesite=lax`;
}

function clearAuthCookie() {
	const expiredCookie = `${AUTH_COOKIE_KEY}=; path=/; max-age=0; secure; samesite=lax`;
	document.cookie = expiredCookie;
	document.cookie = `${expiredCookie}; domain=.${PLATFORM_BASE_DOMAIN}`;
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

function normalizeRoleList(...values) {
	const roles = [];
	const seen = new Set();

	const appendRole = (value) => {
		const normalized = normalizeComparableValue(value);
		if (!normalized || seen.has(normalized)) return;
		seen.add(normalized);
		roles.push(normalized);
	};

	const visit = (value) => {
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}

		if (typeof value === 'string' && value.includes(',')) {
			value.split(',').forEach(entry => appendRole(entry));
			return;
		}

		appendRole(value);
	};

	values.forEach(visit);
	return roles;
}

function normalizeAuthUser(user) {
	if (!user) return null;

	const roles = normalizeRoleList(user.roles, user.role);
	const switchableRoles = normalizeRoleList(user.switchableRoles, user.role);
	const adminRoles = normalizeRoleList(user.adminRoles);
	const role = normalizeComparableValue(user.role)
		|| (switchableRoles.includes('admin') && adminRoles.length > 0 ? 'admin' : '')
		|| switchableRoles[0]
		|| roles[0]
		|| 'student';

	return {
		...user,
		role,
		roles,
		switchableRoles: switchableRoles.length > 0 ? switchableRoles : [role],
		adminRoles,
	};
}

function resolveSelectedRoleForUser(user) {
	const normalizedUser = normalizeAuthUser(user);
	if (!normalizedUser) return '';

	const storedSelectedRole = normalizeComparableValue(window.localStorage.getItem('selectedRole'));
	if (storedSelectedRole && normalizedUser.switchableRoles.includes(storedSelectedRole)) {
		return storedSelectedRole;
	}

	if (normalizedUser.switchableRoles.includes(normalizedUser.role)) {
		return normalizedUser.role;
	}

	if (normalizedUser.switchableRoles.includes('admin') && normalizedUser.adminRoles.includes(normalizedUser.role)) {
		return 'admin';
	}

	return normalizedUser.switchableRoles[0] || normalizedUser.role;
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

	return normalizeAuthUser({
		id: payload.id,
		email: payload.id,
		role: payload.role,
		roles: payload.roles,
		switchableRoles: payload.switchableRoles,
		adminRoles: payload.adminRoles,
		name: payload.name || '',
		...(tenantId ? { tenantId, schoolId: tenantId } : {}),
		...(payload.mustChangePassword === true ? { mustChangePassword: true } : {}),
	});
}

function userMatchesTokenPayload(user, payload) {
	if (!user || !payload) return false;

	const userId = normalizeComparableValue(user.id || user.email);
	const tokenId = normalizeComparableValue(payload.id);
	if (!userId || !tokenId || userId !== tokenId) return false;

	const userTenantId = normalizeComparableValue(user.tenantId || user.schoolId);
	const tokenTenantId = normalizeComparableValue(payload.tenantId);
	if (userTenantId && tokenTenantId && userTenantId !== tokenTenantId) return false;

	return true;
}

function mergeStoredUserWithToken(storedUser, payload) {
	const tokenUser = buildUserFromTokenPayload(payload);
	const normalizedStoredUser = normalizeAuthUser(storedUser);

	if (!normalizedStoredUser) return tokenUser;
	if (!tokenUser) return storedUser;
	if (!userMatchesTokenPayload(normalizedStoredUser, payload)) return tokenUser;

	const tenantId = normalizedStoredUser.tenantId || normalizedStoredUser.schoolId || tokenUser.tenantId || tokenUser.schoolId;

	return normalizeAuthUser({
		...tokenUser,
		...normalizedStoredUser,
		id: normalizedStoredUser.id || tokenUser.id,
		email: normalizedStoredUser.email || tokenUser.email,
		role: tokenUser.role || normalizedStoredUser.role,
		roles: tokenUser.roles?.length ? tokenUser.roles : normalizedStoredUser.roles,
		switchableRoles: tokenUser.switchableRoles?.length ? tokenUser.switchableRoles : normalizedStoredUser.switchableRoles,
		adminRoles: tokenUser.adminRoles?.length ? tokenUser.adminRoles : normalizedStoredUser.adminRoles,
		name: normalizedStoredUser.name || tokenUser.name,
		...(tenantId ? { tenantId, schoolId: normalizedStoredUser.schoolId || normalizedStoredUser.tenantId || tokenUser.schoolId } : {}),
		...(normalizedStoredUser.mustChangePassword === true || tokenUser.mustChangePassword === true ? { mustChangePassword: true } : {}),
	});
}

export function getSelectedRole() {
	const storedUser = safeParse(window.localStorage.getItem(AUTH_USER_KEY));
	return resolveSelectedRoleForUser(storedUser);
}

export function buildSelectedRoleHeader() {
	const selectedRole = getSelectedRole();
	return selectedRole ? { 'X-Selected-Role': selectedRole } : {};
}

export function getSignedOutRedirectPath() {
	const rememberedRedirect = normalizeTenantSiteUrl(window.sessionStorage.getItem(SIGNED_OUT_TENANT_REDIRECT_KEY));
	if (rememberedRedirect) {
		return rememberedRedirect;
	}

	const websiteUrl = normalizeTenantSiteUrl(window.localStorage.getItem(TENANT_SITE_URL_KEY));
	if (websiteUrl) {
		return websiteUrl;
	}

	const subdomain = window.localStorage.getItem('tenantSubdomain');
	if (subdomain) {
		return `https://${subdomain}.ndovera.com`;
	}
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
		roles: payload?.roles,
		switchableRoles: payload?.switchableRoles,
		adminRoles: payload?.adminRoles,
		name: payload?.name,
	};
	const normalizedUser = normalizeAuthUser({
		...user,
		...(payload?.mustChangePassword === true ? { mustChangePassword: true } : {}),
	});

	if (!token || !normalizedUser?.role) {
		throw new Error('Invalid authentication payload');
	}

	storeToken(token);
	window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
	markProfileSynced();
	const nextSelectedRole = resolveSelectedRoleForUser(normalizedUser);
	if (options?.preserveSelectedRole !== true) {
		window.localStorage.removeItem('selectedRole');
	} else if (nextSelectedRole) {
		window.localStorage.setItem('selectedRole', nextSelectedRole);
	} else {
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
	const tenantWebsiteUrl = normalizeTenantSiteUrl(window.localStorage.getItem(TENANT_SITE_URL_KEY));
	const tenantSubdomain = window.localStorage.getItem('tenantSubdomain');
	if (tenantWebsiteUrl) {
		window.sessionStorage.setItem(SIGNED_OUT_TENANT_REDIRECT_KEY, tenantWebsiteUrl);
	} else if (tenantSubdomain) {
		window.sessionStorage.setItem(SIGNED_OUT_TENANT_REDIRECT_KEY, `https://${tenantSubdomain}.ndovera.com`);
	}

	window.localStorage.removeItem(AUTH_TOKEN_KEY);
	window.localStorage.removeItem(AUTH_USER_KEY);
	window.localStorage.removeItem(AUTH_PROFILE_SYNC_KEY);
	window.localStorage.removeItem('selectedRole');
	window.localStorage.removeItem('tenantSubdomain');
	window.localStorage.removeItem(TENANT_SITE_URL_KEY);
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
