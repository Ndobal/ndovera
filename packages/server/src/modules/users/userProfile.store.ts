import type { User } from '../../../rbac.js';
import type { IdentityUserRecord } from '../../../../../identity-state.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type UserStatusAvailability = 'available' | 'busy' | 'away' | 'offline';

export type UserProfileRecord = {
	userId: string;
	avatarUrl: string;
	statusText: string;
	statusAvailability: UserStatusAvailability;
	statusUpdatedAt: string | null;
	ndoveraEmail: string;
	alternateEmail: string;
	phone: string;
	gender: string;
	dateOfBirth: string;
	address: string;
	city: string;
	state: string;
	country: string;
	nationality: string;
	bio: string;
	emergencyContactName: string;
	emergencyContactPhone: string;
	occupation: string;
	department: string;
	employeeId: string;
	admissionNumber: string;
	className: string;
	guardianName: string;
	guardianPhone: string;
	skills: string[];
	preferences: Record<string, unknown>;
	updatedAt: string;
};

type UserProfileDocument = Record<string, UserProfileRecord>;

export type PublicUserProfile = {
	avatarUrl: string | null;
	statusText: string | null;
	statusAvailability: UserStatusAvailability;
	statusUpdatedAt: string | null;
};

export type UserProfileUpdateInput = Omit<UserProfileRecord, 'userId' | 'updatedAt' | 'statusUpdatedAt'>;

const NAMESPACE = 'user-profiles';

function nowIso() {
	return new Date().toISOString();
}

function normalizeText(value: unknown, maxLength: number) {
	return String(value || '').trim().slice(0, maxLength);
}

function normalizeSkills(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value
		.map((entry) => normalizeText(entry, 80))
		.filter(Boolean)
		.slice(0, 30);
}

function normalizePreferences(value: unknown) {
	return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function defaultAvailability(value?: string | null): UserStatusAvailability {
	return value === 'busy' || value === 'away' || value === 'offline' ? value : 'available';
}

function createDefaultProfile(userId: string, identityUser?: IdentityUserRecord | null): UserProfileRecord {
	return {
		userId,
		avatarUrl: '',
		statusText: '',
		statusAvailability: 'available',
		statusUpdatedAt: null,
		ndoveraEmail: normalizeText(identityUser?.email || '', 160),
		alternateEmail: '',
		phone: '',
		gender: '',
		dateOfBirth: '',
		address: '',
		city: '',
		state: '',
		country: '',
		nationality: '',
		bio: '',
		emergencyContactName: '',
		emergencyContactPhone: '',
		occupation: '',
		department: '',
		employeeId: '',
		admissionNumber: '',
		className: '',
		guardianName: '',
		guardianPhone: '',
		skills: [],
		preferences: {},
		updatedAt: nowIso(),
	};
}

async function readProfiles() {
	return readDocument<UserProfileDocument>(NAMESPACE, GLOBAL_SCOPE, () => ({}));
}

async function writeProfiles(document: UserProfileDocument) {
	return writeDocument(NAMESPACE, GLOBAL_SCOPE, document);
}

export function getUserProfileTemplate() {
	return {
		recommended: 'default',
		default: [
			'Profile picture',
			'Status update',
			'Ndovera email',
			'Alternate email',
			'Phone number',
			'Emergency contact',
			'Department or class data',
			'Biography and skills',
		],
	};
}

export async function getUserProfileById(userId: string, identityUser?: IdentityUserRecord | null) {
	const profiles = await readProfiles();
	return profiles[userId] || createDefaultProfile(userId, identityUser);
}

export async function updateUserProfileForUser(user: User, input: Partial<UserProfileUpdateInput>, identityUser?: IdentityUserRecord | null) {
	const profiles = await readProfiles();
	const current = profiles[user.id] || createDefaultProfile(user.id, identityUser);
	const nextStatusText = Object.prototype.hasOwnProperty.call(input, 'statusText') ? normalizeText(input.statusText, 280) : current.statusText;
	const next: UserProfileRecord = {
		...current,
		avatarUrl: Object.prototype.hasOwnProperty.call(input, 'avatarUrl') ? normalizeText(input.avatarUrl, 500) : current.avatarUrl,
		statusText: nextStatusText,
		statusAvailability: Object.prototype.hasOwnProperty.call(input, 'statusAvailability') ? defaultAvailability(String(input.statusAvailability || '')) : current.statusAvailability,
		statusUpdatedAt: Object.prototype.hasOwnProperty.call(input, 'statusText') || Object.prototype.hasOwnProperty.call(input, 'statusAvailability') ? nowIso() : current.statusUpdatedAt,
		ndoveraEmail: Object.prototype.hasOwnProperty.call(input, 'ndoveraEmail') ? normalizeText(input.ndoveraEmail, 160) : current.ndoveraEmail,
		alternateEmail: Object.prototype.hasOwnProperty.call(input, 'alternateEmail') ? normalizeText(input.alternateEmail, 160) : current.alternateEmail,
		phone: Object.prototype.hasOwnProperty.call(input, 'phone') ? normalizeText(input.phone, 40) : current.phone,
		gender: Object.prototype.hasOwnProperty.call(input, 'gender') ? normalizeText(input.gender, 40) : current.gender,
		dateOfBirth: Object.prototype.hasOwnProperty.call(input, 'dateOfBirth') ? normalizeText(input.dateOfBirth, 40) : current.dateOfBirth,
		address: Object.prototype.hasOwnProperty.call(input, 'address') ? normalizeText(input.address, 200) : current.address,
		city: Object.prototype.hasOwnProperty.call(input, 'city') ? normalizeText(input.city, 80) : current.city,
		state: Object.prototype.hasOwnProperty.call(input, 'state') ? normalizeText(input.state, 80) : current.state,
		country: Object.prototype.hasOwnProperty.call(input, 'country') ? normalizeText(input.country, 80) : current.country,
		nationality: Object.prototype.hasOwnProperty.call(input, 'nationality') ? normalizeText(input.nationality, 80) : current.nationality,
		bio: Object.prototype.hasOwnProperty.call(input, 'bio') ? normalizeText(input.bio, 1200) : current.bio,
		emergencyContactName: Object.prototype.hasOwnProperty.call(input, 'emergencyContactName') ? normalizeText(input.emergencyContactName, 120) : current.emergencyContactName,
		emergencyContactPhone: Object.prototype.hasOwnProperty.call(input, 'emergencyContactPhone') ? normalizeText(input.emergencyContactPhone, 40) : current.emergencyContactPhone,
		occupation: Object.prototype.hasOwnProperty.call(input, 'occupation') ? normalizeText(input.occupation, 120) : current.occupation,
		department: Object.prototype.hasOwnProperty.call(input, 'department') ? normalizeText(input.department, 120) : current.department,
		employeeId: Object.prototype.hasOwnProperty.call(input, 'employeeId') ? normalizeText(input.employeeId, 80) : current.employeeId,
		admissionNumber: Object.prototype.hasOwnProperty.call(input, 'admissionNumber') ? normalizeText(input.admissionNumber, 80) : current.admissionNumber,
		className: Object.prototype.hasOwnProperty.call(input, 'className') ? normalizeText(input.className, 120) : current.className,
		guardianName: Object.prototype.hasOwnProperty.call(input, 'guardianName') ? normalizeText(input.guardianName, 120) : current.guardianName,
		guardianPhone: Object.prototype.hasOwnProperty.call(input, 'guardianPhone') ? normalizeText(input.guardianPhone, 40) : current.guardianPhone,
		skills: Object.prototype.hasOwnProperty.call(input, 'skills') ? normalizeSkills(input.skills) : current.skills,
		preferences: Object.prototype.hasOwnProperty.call(input, 'preferences') ? normalizePreferences(input.preferences) : current.preferences,
		updatedAt: nowIso(),
	};
	profiles[user.id] = next;
	await writeProfiles(profiles);
	return next;
}

export function toPublicUserProfile(profile: UserProfileRecord | null | undefined): PublicUserProfile {
	return {
		avatarUrl: profile?.avatarUrl || null,
		statusText: profile?.statusText || null,
		statusAvailability: profile?.statusAvailability || 'available',
		statusUpdatedAt: profile?.statusUpdatedAt || null,
	};
}
