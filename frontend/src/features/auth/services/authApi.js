import { getApiUrl } from '../../../config/apiBase';

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'authUser';
const SELECTED_ROLE_KEY = 'selectedRole';
const AUTH_COOKIE_KEY = 'ndovera_token';

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

function safeParse(value) {
	if (!value) return null;

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

export function getStoredAuth() {
	const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || getCookie(AUTH_COOKIE_KEY);
	const user = safeParse(window.localStorage.getItem(AUTH_USER_KEY));

	if (!token) {
		return null;
	}

	if (!window.localStorage.getItem(AUTH_TOKEN_KEY)) {
		window.localStorage.setItem(AUTH_TOKEN_KEY, token);
	}

	return {
		token,
		user,
	};
}

export function persistAuth(payload) {
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

	window.localStorage.setItem(AUTH_TOKEN_KEY, token);
	window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
	window.localStorage.setItem(SELECTED_ROLE_KEY, normalizedUser.role);
	setAuthCookie(token);
	// Also expose classroomId and userId as standalone keys for legacy reads
	if (normalizedUser.classId) window.localStorage.setItem('classroomId', normalizedUser.classId);
	if (normalizedUser.id) window.localStorage.setItem('userId', normalizedUser.id);

	return { token, user: normalizedUser };
}

export function clearStoredAuth() {
	window.localStorage.removeItem(AUTH_TOKEN_KEY);
	window.localStorage.removeItem(AUTH_USER_KEY);
	window.localStorage.removeItem(SELECTED_ROLE_KEY);
	document.cookie = `${AUTH_COOKIE_KEY}=; path=/; domain=.ndovera.com; max-age=0; secure; samesite=lax`;
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
	if (!response.ok) throw new Error(data.error || 'Could not change password.');
	return data;
}

const authApi = {
	login,
	getStoredAuth,
	clearStoredAuth,
	persistAuth,
	changePassword,
};

export default authApi;
