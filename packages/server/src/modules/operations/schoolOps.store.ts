import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { loadIdentityState } from '../../../../../identity-state.js';
import { readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';
import { getPlatformSettings } from '../platform/platformSettings.store.js';

export type LiveClassSessionRecord = {
	id: string;
	title: string;
	mode: string;
	schedule: string;
	duration: string;
	attendees: number;
	limit: number;
	hosts: string[];
	tools: string[];
	note: string;
	meetingUrl?: string;
	participantIds: string[];
	createdBy: string;
	createdAt: string;
	closedAt?: string;
};

type FinanceStats = {
	totalCollected: number;
	outstanding: number;
	payrollTotal: number;
	payrollPending: number;
	updatedAt: string;
};

type NotificationRecord = {
	id: string;
	message: string;
	created_at: string;
	is_read: boolean;
	readBy: string[];
	targetRole?: string | null;
	createdBy?: string;
};

type MessagingSettings = {
	allowStudentPeerMessaging: boolean;
};

type ChatMessageRecord = {
	id: string;
	from: string;
	fromName: string;
	to: string | null;
	text: string;
	time: string;
};

type LibraryBookRecord = {
	id: string;
	title: string;
	author: string;
	category: string;
	mode: 'Physical' | 'Digital' | 'User Upload' | 'Shared';
	library: 'School Library' | 'Global Library' | 'Contributor Library';
	access: 'Free' | 'Premium' | 'Borrow';
	nairaPrice: number;
	auraPrice: number;
	approval: 'Approved' | 'In Review' | 'Flagged';
	owner: string;
	qualityScore: string;
	shelf?: string;
	format: string;
	summary: string;
	visibility: string;
	createdAt: string;
	ownerUserId?: string | null;
	openCount: number;
	recommendedBy: string[];
	borrowedBy: Array<{ userId: string; borrowedAt: string; dueAt: string; status: string }>;
};

type LibrarySubmissionRecord = {
	id: string;
	title: string;
	owner: string;
	ownerUserId: string;
	stage: 'Published' | 'AI Review' | 'Flagged';
	ai: string;
	compliance: string;
	createdAt: string;
};

type LibraryHistoryRecord = {
	id: string;
	userId: string;
	user: string;
	title: string;
	activity: string;
	timestamp: string;
	status?: string;
};

type LibraryRecommendationRecord = {
	book_id: string;
	userId: string;
	created_at: string;
};

type SchoolOpsState = {
	financeStats: FinanceStats;
	notifications: NotificationRecord[];
	messagingSettings: MessagingSettings;
	messages: ChatMessageRecord[];
	libraryBooks: LibraryBookRecord[];
	librarySubmissions: LibrarySubmissionRecord[];
	libraryHistory: LibraryHistoryRecord[];
	libraryRecommendations: LibraryRecommendationRecord[];
	liveClasses: LiveClassSessionRecord[];
};

const NAMESPACE = 'school-operations';

function nowIso() {
	return new Date().toISOString();
}

function ensureSchoolId(user: User) {
	return String(user.school_id || 'school-1').trim();
}

function ensureRole(user: User) {
	return String(user.activeRole || user.roles?.[0] || 'User').trim();
}

function isAdminRole(role: string) {
	return ['school admin', 'hos', 'owner', 'tenant school owner', 'super admin', 'principal', 'head teacher', 'nursery head'].includes(role.trim().toLowerCase());
}

function defaultLibraryBooks() {
	const createdAt = nowIso();
	return [
		{
			id: 'LIB-001',
			title: 'Senior Secondary Mathematics Companion',
			author: 'Ndovera Press',
			category: 'Textbook',
			mode: 'Digital' as const,
			library: 'School Library' as const,
			access: 'Free' as const,
			nairaPrice: 0,
			auraPrice: 0,
			approval: 'Approved' as const,
			owner: 'School Library Unit',
			qualityScore: 'Verified',
			format: 'Protected PDF',
			summary: 'Core school library title.',
			visibility: 'School only',
			createdAt,
			ownerUserId: null,
			openCount: 0,
			recommendedBy: [],
			borrowedBy: [],
		},
		{
			id: 'LIB-002',
			title: 'Things Fall Apart',
			author: 'Chinua Achebe',
			category: 'Novel',
			mode: 'Physical' as const,
			library: 'School Library' as const,
			access: 'Borrow' as const,
			nairaPrice: 0,
			auraPrice: 0,
			approval: 'Approved' as const,
			owner: 'Main Campus Shelf',
			qualityScore: 'Verified classic',
			shelf: 'B-04',
			format: 'Hard copy',
			summary: 'Physical borrowing title.',
			visibility: 'School circulation',
			createdAt,
			ownerUserId: null,
			openCount: 0,
			recommendedBy: [],
			borrowedBy: [],
		},
	];
	}

function defaultState(): SchoolOpsState {
	return {
		financeStats: { totalCollected: 0, outstanding: 0, payrollTotal: 0, payrollPending: 0, updatedAt: nowIso() },
		notifications: [],
		messagingSettings: { allowStudentPeerMessaging: false },
		messages: [],
		libraryBooks: defaultLibraryBooks(),
		librarySubmissions: [],
		libraryHistory: [],
		libraryRecommendations: [],
		liveClasses: [],
	};
}

async function readState(schoolId: string) {
	return readDocument<SchoolOpsState>(NAMESPACE, schoolId, defaultState);
}

async function writeState(schoolId: string, state: SchoolOpsState) {
	return writeDocument(NAMESPACE, schoolId, state);
}

export async function getFinanceStatsForUser(user: User) {
	const state = await readState(ensureSchoolId(user));
	return {
		totalCollected: state.financeStats.totalCollected,
		outstanding: state.financeStats.outstanding,
	};
}

export async function buildDashboardSummaryForUser(user: User) {
	const state = await readState(ensureSchoolId(user));
	const identity = await loadIdentityState();
	const schoolId = ensureSchoolId(user);
	const schoolUsers = identity.users.filter((entry) => entry.schoolId === schoolId);
	const schoolStudents = identity.students.filter((entry) => entry.schoolId === schoolId);
	const activeLiveClasses = state.liveClasses.filter((entry) => !entry.closedAt);
	return {
		student: {
			stats: {
				latestAverage: '0%',
				subjectCount: 0,
				liveClassCount: activeLiveClasses.length,
				pendingAssignments: 0,
				submittedAssignments: 0,
			},
			liveClasses: activeLiveClasses,
			announcements: state.notifications.slice(0, 5).map((entry) => ({ id: entry.id, title: entry.message, detail: entry.message })),
		},
		teacher: {
			stats: {
				subjectCount: 0,
				classCount: 0,
				assignmentCount: 0,
				pendingGrading: 0,
				lessonPlanCount: 0,
				liveClassCount: activeLiveClasses.length,
			},
			liveClasses: activeLiveClasses,
			assignments: [],
			subjects: [],
		},
		generic: {
			stats: {
				subjectCount: 0,
				pendingTraining: 0,
				totalUsers: schoolUsers.length,
				totalStudents: schoolStudents.length,
			},
			announcements: state.notifications.slice(0, 5).map((entry) => ({ id: entry.id, title: entry.message, detail: entry.message })),
		},
	};
}

export async function listNotificationsForUser(user: User) {
	const schoolId = ensureSchoolId(user);
	const role = ensureRole(user);
	const state = await readState(schoolId);
	return state.notifications
		.filter((entry) => !entry.targetRole || entry.targetRole.toLowerCase() === role.toLowerCase() || entry.targetRole.toLowerCase() === 'staff' && !['student', 'parent'].includes(role.toLowerCase()))
		.map((entry) => ({ ...entry, is_read: entry.readBy.includes(user.id) || entry.is_read }))
		.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function createNotificationBroadcast(user: User, message: string, targetRole?: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const notification: NotificationRecord = {
		id: `notification_${crypto.randomUUID()}`,
		message: message.trim(),
		created_at: nowIso(),
		is_read: false,
		readBy: [],
		targetRole: String(targetRole || '').trim() || null,
		createdBy: user.id,
	};
	state.notifications.unshift(notification);
	await writeState(schoolId, state);
	return notification;
}

export async function markNotificationReadForUser(user: User, notificationId: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const index = state.notifications.findIndex((entry) => entry.id === notificationId);
	if (index < 0) return { ok: true };
	const current = state.notifications[index];
	if (!current.readBy.includes(user.id)) current.readBy.push(user.id);
	current.is_read = current.readBy.length > 0;
	state.notifications[index] = current;
	await writeState(schoolId, state);
	return { ok: true };
}

export async function getMessagingSettingsForUser(user: User) {
	const state = await readState(ensureSchoolId(user));
	return state.messagingSettings;
}

export async function updateMessagingSettingsForUser(user: User, settings: MessagingSettings) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	state.messagingSettings = { allowStudentPeerMessaging: Boolean(settings.allowStudentPeerMessaging) };
	await writeState(schoolId, state);
	return state.messagingSettings;
}

export async function getMessagingContactsForUser(user: User) {
	const schoolId = ensureSchoolId(user);
	const role = ensureRole(user).toLowerCase();
	const state = await loadIdentityState();
	const contacts: Array<{
		id: string;
		kind: 'user' | 'helpdesk';
		name: string;
		role: string;
		subtitle?: string;
		identifier: string | null;
		contextLabel: string;
	}> = state.users
		.filter((entry) => entry.schoolId === schoolId && entry.id !== user.id)
		.filter((entry) => state.users.length > 0)
		.filter((entry) => role !== 'student' || entry.category !== 'student')
		.map((entry) => ({
			id: entry.id,
			kind: 'user' as const,
			name: entry.name,
			role: entry.activeRole || entry.roles[0] || entry.category,
			subtitle: entry.email || undefined,
			identifier: entry.email || null,
			contextLabel: entry.schoolName,
		}));
	contacts.unshift({
		id: 'helpdesk',
		kind: 'helpdesk' as const,
		name: 'Ndovera Helpdesk',
		role: 'Helpdesk',
		subtitle: 'Platform support',
		identifier: null,
		contextLabel: 'Platform',
	});
	return contacts;
}

export async function getMessagingThreadForUser(user: User, peerId: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	return state.messages
		.filter((entry) => (entry.from === user.id && entry.to === peerId) || (entry.from === peerId && entry.to === user.id) || (peerId === 'helpdesk' && entry.to === 'helpdesk' && entry.from === user.id))
		.sort((left, right) => left.time.localeCompare(right.time));
}

export async function sendMessagingThreadMessageForUser(user: User, peerId: string, text: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const message: ChatMessageRecord = {
		id: `message_${crypto.randomUUID()}`,
		from: user.id,
		fromName: String(user.name || user.email || 'User').trim(),
		to: peerId,
		text: text.trim(),
		time: nowIso(),
	};
	state.messages.push(message);
	if (peerId === 'helpdesk') {
		state.messages.push({
			id: `message_${crypto.randomUUID()}`,
			from: 'helpdesk',
			fromName: 'Ndovera Helpdesk',
			to: user.id,
			text: 'Your message has been received by the helpdesk.',
			time: nowIso(),
		});
	}
	await writeState(schoolId, state);
	return { messages: await getMessagingThreadForUser(user, peerId) };
}

export async function listLiveClassesForUser(user: User) {
	const state = await readState(ensureSchoolId(user));
	return state.liveClasses.filter((entry) => !entry.closedAt).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createLiveClassForUser(user: User, input: { title: string; mode: string; schedule: string; duration: string }) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const platformSettings = await getPlatformSettings();
	const activeCount = state.liveClasses.filter((entry) => !entry.closedAt).length;
	const schoolActiveLimit = Number(platformSettings.liveMeetings.schoolConcurrentLimit || 5);
	if (activeCount >= schoolActiveLimit) {
		const error = new Error('This school has reached the active live class limit.') as Error & { status?: number };
		error.status = 409;
		throw error;
	}
	const session: LiveClassSessionRecord = {
		id: `live_${crypto.randomUUID()}`,
		title: input.title.trim(),
		mode: input.mode.trim(),
		schedule: input.schedule.trim(),
		duration: input.duration.trim(),
		attendees: 1,
		limit: Number(platformSettings.liveMeetings.defaultParticipantLimit || 50),
		hosts: [String(user.name || ensureRole(user)).trim()],
		tools: ['chat', 'notes', 'whiteboard', 'attendance'],
		note: 'Teacher moderated live classroom',
		meetingUrl: `/live/${crypto.randomUUID()}`,
		participantIds: [user.id],
		createdBy: user.id,
		createdAt: nowIso(),
	};
	state.liveClasses.unshift(session);
	await writeState(schoolId, state);
	return { id: session.id, status: 'active', schoolActiveLimit, activeCount: activeCount + 1 };
}

export async function joinLiveClassForUser(user: User, sessionId: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const index = state.liveClasses.findIndex((entry) => entry.id === sessionId && !entry.closedAt);
	if (index < 0) {
		const error = new Error('Live class not found.') as Error & { status?: number };
		error.status = 404;
		throw error;
	}
	const session = state.liveClasses[index];
	if (!session.participantIds.includes(user.id) && session.participantIds.length >= Number(session.limit || 0)) {
		const error = new Error('This live class is already at its participant limit.') as Error & { status?: number };
		error.status = 409;
		throw error;
	}
	if (!session.participantIds.includes(user.id)) {
		session.participantIds.push(user.id);
		session.attendees = session.participantIds.length;
		state.liveClasses[index] = session;
		await writeState(schoolId, state);
	}
	return { ok: true, attendees: session.attendees, meetingUrl: session.meetingUrl, title: session.title };
}

export async function closeLiveClassForUser(user: User, sessionId: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const index = state.liveClasses.findIndex((entry) => entry.id === sessionId && !entry.closedAt);
	if (index < 0) return { ok: true };
	const session = state.liveClasses[index];
	if (session.createdBy !== user.id && !isAdminRole(ensureRole(user))) {
		const error = new Error('Only the host or a school admin can close this live class.') as Error & { status?: number };
		error.status = 403;
		throw error;
	}
	session.closedAt = nowIso();
	state.liveClasses[index] = session;
	await writeState(schoolId, state);
	return { ok: true };
}

function buildLibraryRoleState(role: string) {
	const normalized = role.toLowerCase();
	return {
		role,
		canManagePhysical: ['librarian', 'hos', 'head teacher', 'principal', 'owner'].includes(normalized),
		canModerate: ['owner', 'ami', 'librarian', 'hos', 'head teacher', 'principal'].includes(normalized),
		canUpload: ['student', 'parent', 'teacher', 'librarian', 'hos', 'head teacher', 'principal', 'class teacher', 'hod', 'owner'].includes(normalized),
		canSeeAnalytics: ['librarian', 'hos', 'head teacher', 'principal', 'owner', 'ami'].includes(normalized),
		showParentHistory: normalized === 'parent',
	};
}

export async function getLibraryDashboardForUser(user: User) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const roleState = buildLibraryRoleState(ensureRole(user));
	const books = state.libraryBooks.map((book) => ({
		...book,
		recommendationCount: book.recommendedBy.length,
		recommendedByMe: book.recommendedBy.includes(user.id),
	}));
	const myBooks = state.librarySubmissions.filter((entry) => entry.ownerUserId === user.id);
	const history = state.libraryHistory.filter((entry) => entry.userId === user.id || roleState.showParentHistory);
	const myBorrowedBooks = state.libraryBooks
		.filter((entry) => entry.borrowedBy.some((borrow) => borrow.userId === user.id))
		.map((entry) => {
			const borrow = entry.borrowedBy.find((item) => item.userId === user.id)!;
			return { id: entry.id, title: entry.title, borrow_date: borrow.borrowedAt, due_date: borrow.dueAt, status: borrow.status };
		});
	const physicalRecords = state.libraryBooks
		.filter((entry) => entry.mode === 'Physical')
		.flatMap((entry) => entry.borrowedBy.map((borrow) => ({
			id: `${entry.id}_${borrow.userId}`,
			borrower: borrow.userId === user.id ? String(user.name || 'You') : borrow.userId,
			userType: borrow.userId === user.id ? ensureRole(user) : 'User',
			book: entry.title,
			dueDate: borrow.dueAt,
			status: borrow.status,
			offline: 'Synced',
		})));
	const recommendations = state.libraryRecommendations.filter((entry) => entry.userId === user.id).map((entry) => ({
		book_id: entry.book_id,
		created_at: entry.created_at,
		title: books.find((book) => book.id === entry.book_id)?.title || 'Book',
	}));
	return {
		roleState,
		books,
		myBooks,
		history,
		myBorrowedBooks,
		physicalRecords,
		earnings: [{ label: 'Contributor Wallet', value: '₦0', note: 'No withdrawals yet.' }, { label: 'Aura Balance', value: '0 Auras', note: 'No premium reads yet.' }, { label: 'Revenue Split', value: '80% / 20%', note: 'Owner share vs Ndovera share.' }],
		analytics: [{ label: 'Most Opened', value: books[0]?.title || 'No data', note: 'Tracking starts once books are opened.' }, { label: 'Recommendation Pulse', value: String(state.libraryRecommendations.length), note: 'Total recommendation actions stored.' }],
		recommendations,
		stats: {
			modesCount: new Set(books.map((book) => book.mode)).size,
			approvedTitles: books.filter((book) => book.approval === 'Approved').length,
			historyVisibility: roleState.showParentHistory ? 'Child view' : 'Visible',
			drmProtection: 'Active',
		},
	};
}

export async function submitLibraryBookForUser(user: User, payload: { title: string; category?: string; summary?: string; format?: string; nairaPrice?: number }) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const createdAt = nowIso();
	const submission: LibrarySubmissionRecord = {
		id: `submission_${crypto.randomUUID()}`,
		title: payload.title.trim(),
		owner: String(user.name || user.email || 'Contributor').trim(),
		ownerUserId: user.id,
		stage: 'AI Review',
		ai: 'Queued',
		compliance: 'Pending moderation',
		createdAt,
	};
	state.librarySubmissions.unshift(submission);
	state.libraryBooks.unshift({
		id: `book_${crypto.randomUUID()}`,
		title: payload.title.trim(),
		author: String(user.name || 'Contributor').trim(),
		category: String(payload.category || 'Storybook').trim(),
		mode: 'User Upload',
		library: 'Contributor Library',
		access: Number(payload.nairaPrice || 0) > 0 ? 'Premium' : 'Free',
		nairaPrice: Number(payload.nairaPrice || 0),
		auraPrice: Math.max(0, Math.round(Number(payload.nairaPrice || 0) / 20)),
		approval: 'In Review',
		owner: `Contributor wallet: ${String(user.name || 'Contributor').trim()}`,
		qualityScore: 'AI review pending',
		format: String(payload.format || 'Draft Manuscript').trim(),
		summary: String(payload.summary || '').trim() || 'Contributor upload awaiting review.',
		visibility: 'Pending moderation',
		createdAt,
		ownerUserId: user.id,
		openCount: 0,
		recommendedBy: [],
		borrowedBy: [],
	});
	await writeState(schoolId, state);
	return submission;
}

export async function openLibraryBookForUser(user: User, bookId: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const index = state.libraryBooks.findIndex((entry) => entry.id === bookId);
	if (index >= 0) {
		state.libraryBooks[index].openCount += 1;
		state.libraryHistory.unshift({
			id: `history_${crypto.randomUUID()}`,
			userId: user.id,
			user: String(user.name || user.email || 'User').trim(),
			title: state.libraryBooks[index].title,
			activity: 'Opened digital title',
			timestamp: nowIso(),
			status: 'Opened',
		});
		await writeState(schoolId, state);
	}
	return { ok: true };
}

export async function toggleLibraryRecommendationForUser(user: User, bookId: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const bookIndex = state.libraryBooks.findIndex((entry) => entry.id === bookId);
	if (bookIndex < 0) {
		const error = new Error('Book not found.') as Error & { status?: number };
		error.status = 404;
		throw error;
	}
	const book = state.libraryBooks[bookIndex];
	const existing = book.recommendedBy.includes(user.id);
	book.recommendedBy = existing ? book.recommendedBy.filter((entry) => entry !== user.id) : [...book.recommendedBy, user.id];
	state.libraryBooks[bookIndex] = book;
	state.libraryRecommendations = existing
		? state.libraryRecommendations.filter((entry) => !(entry.book_id === bookId && entry.userId === user.id))
		: [{ book_id: bookId, userId: user.id, created_at: nowIso() }, ...state.libraryRecommendations];
	await writeState(schoolId, state);
	return { recommended: !existing };
}

export async function borrowLibraryBookForUser(user: User, bookId: string) {
	const schoolId = ensureSchoolId(user);
	const state = await readState(schoolId);
	const bookIndex = state.libraryBooks.findIndex((entry) => entry.id === bookId);
	if (bookIndex < 0) {
		const error = new Error('Book not found.') as Error & { status?: number };
		error.status = 404;
		throw error;
	}
	const book = state.libraryBooks[bookIndex];
	const existing = book.borrowedBy.find((entry) => entry.userId === user.id && entry.status !== 'Returned');
	if (existing) return { alreadyBorrowed: true };
	const borrowedAt = nowIso();
	const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
	book.borrowedBy.push({ userId: user.id, borrowedAt, dueAt, status: 'Borrowed' });
	state.libraryBooks[bookIndex] = book;
	state.libraryHistory.unshift({
		id: `history_${crypto.randomUUID()}`,
		userId: user.id,
		user: String(user.name || user.email || 'User').trim(),
		title: book.title,
		activity: book.mode === 'Physical' ? 'Borrowed physically' : 'Added to reading shelf',
		timestamp: borrowedAt,
		status: 'Borrowed',
	});
	await writeState(schoolId, state);
	return { alreadyBorrowed: false };
}