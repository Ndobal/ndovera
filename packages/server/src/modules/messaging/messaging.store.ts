import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { loadIdentityState, type IdentityUserRecord } from '../../../../../identity-state.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';
import { getUserProfileById, toPublicUserProfile } from '../users/userProfile.store.js';

type GlobalChatMessageRecord = {
	id: string;
	from: string;
	fromName: string;
	to: string | null;
	text: string;
	time: string;
	readBy: string[];
};

type GlobalMessagingState = {
	messages: GlobalChatMessageRecord[];
	typing: Array<{ from: string; to: string; expiresAt: string }>;
	presence: Array<{ userId: string; isOnline: boolean; lastSeenAt: string | null }>;
};

type MessagingContact = {
	id: string;
	kind: 'user' | 'helpdesk';
	name: string;
	role: string;
	subtitle?: string;
	identifier: string | null;
	contextLabel: string;
	avatarUrl?: string | null;
	statusText?: string | null;
	statusAvailability?: 'available' | 'busy' | 'away' | 'offline';
	statusUpdatedAt?: string | null;
	isOnline?: boolean;
	lastSeenAt?: string | null;
	lastMessageText?: string | null;
	lastMessageTime?: string | null;
	unreadCount?: number;
};

const NAMESPACE = 'global-messaging';

function nowIso() {
	return new Date().toISOString();
}

function defaultState(): GlobalMessagingState {
	return { messages: [], typing: [], presence: [] };
}

function normalizeLookup(value: string) {
	return value.trim().toLowerCase();
}

async function readState() {
	return readDocument<GlobalMessagingState>(NAMESPACE, GLOBAL_SCOPE, defaultState);
}

async function writeState(state: GlobalMessagingState) {
	return writeDocument(NAMESPACE, GLOBAL_SCOPE, state);
}


type MessagingPresenceSnapshot = {
	isOnline: boolean;
	lastSeenAt: string | null;
};

function pruneExpiredTyping(state: GlobalMessagingState) {
	const initialCount = state.typing.length;
	const now = nowIso();
	state.typing = state.typing.filter((entry) => entry.expiresAt > now);
	return state.typing.length !== initialCount;
}

function getPresenceSnapshot(state: GlobalMessagingState, userId: string): MessagingPresenceSnapshot {
	const entry = state.presence.find((candidate) => candidate.userId === userId);
	return {
		isOnline: entry?.isOnline || false,
		lastSeenAt: entry?.lastSeenAt || null,
	};
}

function createContact(
	identityUser: IdentityUserRecord,
	currentSchoolId: string,
	publicProfile: ReturnType<typeof toPublicUserProfile>,
	presence: MessagingPresenceSnapshot,
): MessagingContact {
	return {
		id: identityUser.id,
		kind: 'user',
		name: identityUser.name,
		role: identityUser.activeRole || identityUser.roles[0] || identityUser.category,
		subtitle: identityUser.email || undefined,
		identifier: identityUser.email || identityUser.id,
		contextLabel: identityUser.schoolId === currentSchoolId ? identityUser.schoolName : `${identityUser.schoolName} • Cross-school`,
		avatarUrl: publicProfile.avatarUrl,
		statusText: publicProfile.statusText,
		statusAvailability: publicProfile.statusAvailability,
		statusUpdatedAt: publicProfile.statusUpdatedAt,
		isOnline: presence.isOnline,
		lastSeenAt: presence.lastSeenAt,
	};
}

async function resolvePublicContact(identityUser: IdentityUserRecord, currentSchoolId: string, state: GlobalMessagingState) {
	const profile = await getUserProfileById(identityUser.id, identityUser);
	return createContact(identityUser, currentSchoolId, toPublicUserProfile(profile), getPresenceSnapshot(state, identityUser.id));
}

function getThreadMessagesForUsers(state: GlobalMessagingState, userId: string, peerId: string) {
	return state.messages.filter((entry) => (entry.from === userId && entry.to === peerId) || (entry.from === peerId && entry.to === userId));
}

function getHelpdeskMessages(state: GlobalMessagingState, userId: string) {
	return state.messages.filter((entry) => (entry.from === userId && entry.to === 'helpdesk') || (entry.from === 'helpdesk' && entry.to === userId));
}

function findPeerByLookup(users: IdentityUserRecord[], actorId: string, query: string) {
	const normalizedQuery = normalizeLookup(query);
	if (!normalizedQuery) return null;
	return users.find((entry) => {
		if (entry.id === actorId) return false;
		if (normalizeLookup(entry.id) === normalizedQuery) return true;
		if (entry.email && normalizeLookup(entry.email) === normalizedQuery) return true;
		return entry.aliases.some((alias) => normalizeLookup(alias) === normalizedQuery);
	}) || null;
}

function scoreSearchCandidate(candidate: IdentityUserRecord, query: string) {
	const normalizedQuery = normalizeLookup(query);
	if (!normalizedQuery) return 0;
	const aliases = candidate.aliases.map((alias) => normalizeLookup(alias));
	const id = normalizeLookup(candidate.id);
	const email = normalizeLookup(candidate.email || '');
	const name = normalizeLookup(candidate.name || '');
	const allFields = [id, email, name, ...aliases].filter(Boolean).join(' ');
	const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

	if (id === normalizedQuery || email === normalizedQuery || aliases.includes(normalizedQuery)) return 1000;
	if (name === normalizedQuery) return 950;
	if (id.startsWith(normalizedQuery) || email.startsWith(normalizedQuery) || aliases.some((alias) => alias.startsWith(normalizedQuery))) return 850;
	if (name.startsWith(normalizedQuery)) return 800;
	if (tokens.length > 1 && tokens.every((token) => allFields.includes(token))) return 700;
	if (name.includes(normalizedQuery)) return 650;
	if (allFields.includes(normalizedQuery)) return 500;
	return 0;
}

async function ensurePeer(identityUsers: IdentityUserRecord[], actor: User, peerId: string) {
	if (peerId === 'helpdesk') return null;
	const peer = identityUsers.find((entry) => entry.id === peerId);
	if (!peer || peer.id === actor.id) {
		const error = new Error('Chat contact not found.') as Error & { status?: number };
		error.status = 404;
		throw error;
	}
	return peer;
}

export async function lookupMessagingContactForUser(user: User, query: string) {
	const [identity, state] = await Promise.all([loadIdentityState(), readState()]);
	const peer = findPeerByLookup(identity.users, user.id, query);
	if (!peer) {
		const error = new Error('No Ndovera user matched that ID or email address.') as Error & { status?: number };
		error.status = 404;
		throw error;
	}
	return resolvePublicContact(peer, String(user.school_id || 'school-1').trim(), state);
}

export async function searchMessagingContactsForUser(user: User, query: string) {
	const schoolId = String(user.school_id || 'school-1').trim();
	const [identity, state] = await Promise.all([loadIdentityState(), readState()]);
	const normalizedQuery = normalizeLookup(query);
	if (!normalizedQuery) return [];
	const rankedMatches = identity.users
		.filter((entry) => entry.id !== user.id)
		.map((entry) => ({ entry, score: scoreSearchCandidate(entry, normalizedQuery) }))
		.filter((entry) => entry.score > 0)
		.sort((left, right) => {
			if (left.score !== right.score) return right.score - left.score;
			return left.entry.name.localeCompare(right.entry.name);
		})
		.slice(0, 12);
	return Promise.all(rankedMatches.map(({ entry }) => resolvePublicContact(entry, schoolId, state)));
}

export async function getMessagingContactsForUser(user: User) {
	const schoolId = String(user.school_id || 'school-1').trim();
	const [identity, state] = await Promise.all([loadIdentityState(), readState()]);
	pruneExpiredTyping(state);
	const peerIds = new Set(
		state.messages
			.filter((entry) => entry.from === user.id || entry.to === user.id)
			.map((entry) => (entry.from === user.id ? entry.to : entry.from))
			.filter((entry): entry is string => Boolean(entry) && entry !== 'helpdesk' && entry !== user.id),
	);
	const sameSchoolUsers = identity.users.filter((entry) => entry.schoolId === schoolId && entry.id !== user.id);
	const priorPeers = identity.users.filter((entry) => peerIds.has(entry.id) && entry.id !== user.id);
	const uniqueUsers = [...sameSchoolUsers, ...priorPeers].filter((entry, index, array) => array.findIndex((candidate) => candidate.id === entry.id) === index);
	const contacts = await Promise.all(uniqueUsers.map(async (entry) => {
		const base = await resolvePublicContact(entry, schoolId, state);
		const threadMessages = getThreadMessagesForUsers(state, user.id, entry.id);
		const latest = threadMessages[threadMessages.length - 1] || null;
		const unreadCount = threadMessages.filter((message) => message.from === entry.id && !message.readBy.includes(user.id)).length;
		return {
			...base,
			lastMessageText: latest?.text || null,
			lastMessageTime: latest?.time || null,
			unreadCount,
		};
	}));
	const helpdeskMessages = getHelpdeskMessages(state, user.id);
	const latestHelpdesk = helpdeskMessages[helpdeskMessages.length - 1] || null;
	const helpdeskUnreadCount = helpdeskMessages.filter((message) => message.from === 'helpdesk' && !message.readBy.includes(user.id)).length;
	contacts.sort((left, right) => {
		const leftTime = left.lastMessageTime || '';
		const rightTime = right.lastMessageTime || '';
		if (leftTime && rightTime && leftTime !== rightTime) return rightTime.localeCompare(leftTime);
		if (leftTime || rightTime) return rightTime.localeCompare(leftTime);
		return left.name.localeCompare(right.name);
	});
	contacts.unshift({
		id: 'helpdesk',
		kind: 'helpdesk',
		name: 'Ndovera Helpdesk',
		role: 'Helpdesk',
		subtitle: 'Platform support',
		identifier: null,
		contextLabel: 'Platform',
		statusText: 'Replies instantly to support messages.',
		statusAvailability: 'available',
		statusUpdatedAt: null,
		isOnline: true,
		lastSeenAt: null,
		lastMessageText: latestHelpdesk?.text || null,
		lastMessageTime: latestHelpdesk?.time || null,
		unreadCount: helpdeskUnreadCount,
	});
	return contacts;
}

export async function getMessagingThreadForUser(user: User, peerId: string) {
	const [identity, state] = await Promise.all([loadIdentityState(), readState()]);
	await ensurePeer(identity.users, user, peerId);
	const typingPruned = pruneExpiredTyping(state);
	const thread = state.messages
		.filter((entry) => (entry.from === user.id && entry.to === peerId) || (entry.from === peerId && entry.to === user.id) || (peerId === 'helpdesk' && ((entry.from === user.id && entry.to === 'helpdesk') || (entry.from === 'helpdesk' && entry.to === user.id))))
		.sort((left, right) => left.time.localeCompare(right.time));
	let changed = typingPruned;
	let markedRead = false;
	for (const message of thread) {
		if ((message.to === user.id || (peerId === 'helpdesk' && message.to === user.id)) && message.from !== user.id && !message.readBy.includes(user.id)) {
			message.readBy.push(user.id);
			changed = true;
			markedRead = true;
		}
	}
	if (changed) await writeState(state);
	return { messages: thread, markedRead };
}

export async function sendMessagingThreadMessageForUser(user: User, peerId: string, text: string) {
	const [identity, state] = await Promise.all([loadIdentityState(), readState()]);
	const peer = await ensurePeer(identity.users, user, peerId);
	pruneExpiredTyping(state);
	state.messages.push({
		id: `message_${crypto.randomUUID()}`,
		from: user.id,
		fromName: String(user.name || user.email || 'User').trim(),
		to: peerId,
		text: text.trim(),
		time: nowIso(),
		readBy: [user.id],
	});
	if (peerId === 'helpdesk') {
		state.messages.push({
			id: `message_${crypto.randomUUID()}`,
			from: 'helpdesk',
			fromName: 'Ndovera Helpdesk',
			to: user.id,
			text: 'Your message has been received by the helpdesk.',
			time: nowIso(),
			readBy: ['helpdesk'],
		});
	}
	if (peer) {
		void peer;
	}
	state.typing = state.typing.filter((entry) => !(entry.from === user.id && entry.to === peerId));
	await writeState(state);
	return { messages: (await getMessagingThreadForUser(user, peerId)).messages };
}

export async function publishTypingStatusForUser(user: User, peerId: string, isTyping: boolean) {
	const [identity, state] = await Promise.all([loadIdentityState(), readState()]);
	await ensurePeer(identity.users, user, peerId);
	pruneExpiredTyping(state);
	state.typing = state.typing.filter((entry) => !(entry.from === user.id && entry.to === peerId));
	if (isTyping) {
		state.typing.push({
			from: user.id,
			to: peerId,
			expiresAt: new Date(Date.now() + 12000).toISOString(),
		});
	}
	await writeState(state);
	return { ok: true, isTyping };
}

export async function getTypingStatusForUser(user: User, peerId: string) {
	const [identity, state] = await Promise.all([loadIdentityState(), readState()]);
	await ensurePeer(identity.users, user, peerId);
	const changed = pruneExpiredTyping(state);
	const typing = state.typing.some((entry) => entry.from === peerId && entry.to === user.id);
	if (changed) await writeState(state);
	return { typing };
}

export async function setMessagingPresenceForUser(userId: string, isOnline: boolean) {
	const state = await readState();
	const current = state.presence.find((entry) => entry.userId === userId);
	const nextLastSeenAt = isOnline ? (current?.lastSeenAt || null) : nowIso();
	if (current) {
		current.isOnline = isOnline;
		current.lastSeenAt = nextLastSeenAt;
	} else {
		state.presence.push({ userId, isOnline, lastSeenAt: nextLastSeenAt });
	}
	await writeState(state);
	return getPresenceSnapshot(state, userId);
}

export async function getRelevantPresenceAudienceForUser(userId: string) {
	const [identity, state] = await Promise.all([loadIdentityState(), readState()]);
	const actor = identity.users.find((entry) => entry.id === userId);
	if (!actor) return [userId];

	const audience = new Set<string>([userId]);
	for (const entry of identity.users) {
		if (entry.id !== userId && entry.schoolId === actor.schoolId) {
			audience.add(entry.id);
		}
	}

	for (const message of state.messages) {
		if (message.from === userId && message.to && message.to !== 'helpdesk') {
			audience.add(message.to);
		}
		if (message.to === userId && message.from !== 'helpdesk') {
			audience.add(message.from);
		}
	}

	return [...audience];
}
