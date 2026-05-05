import { getApiUrl } from '../../../config/apiBase';

const AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'authUser';
const SELECTED_ROLE_KEY = 'selectedRole';

function safeParse(value) {
	if (!value) return null;

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

export function getStoredAuth() {
	const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
	const user = safeParse(window.localStorage.getItem(AUTH_USER_KEY));

	if (!token) {
		return null;
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

	if (!token || !user?.role) {
		throw new Error('Invalid authentication payload');
	}

	window.localStorage.setItem(AUTH_TOKEN_KEY, token);
	window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
	window.localStorage.setItem(SELECTED_ROLE_KEY, user.role);

	return { token, user };
}

export function clearStoredAuth() {
	window.localStorage.removeItem(AUTH_TOKEN_KEY);
	window.localStorage.removeItem(AUTH_USER_KEY);
	window.localStorage.removeItem(SELECTED_ROLE_KEY);
}

export async function login(credentials) {
	const response = await fetch(getApiUrl('/api/auth/login'), {
		method: 'POST',
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
