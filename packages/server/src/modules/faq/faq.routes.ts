import { Router } from 'express';
import { z } from 'zod';

import { findUserByIdentifier, isIdentityUserActive, loadIdentityState } from '../../../../../identity-state.js';
import { getUserProfileById } from '../users/userProfile.store.js';
import { buildFaqAnswer, type FaqVerifiedUser } from './faqKnowledge.js';

export const faqRouter = Router();

const SUPPORT_EMAIL = 'support@ndovera.com';

const verifySchema = z.object({
	identifier: z.string().trim().min(1),
});

const chatSchema = z.object({
	question: z.string().trim().min(1),
	mode: z.enum(['public', 'verified']).optional(),
	verifiedUser: z.object({
		id: z.string().trim().optional(),
		name: z.string().trim().optional(),
		schoolName: z.string().trim().optional(),
		activeRole: z.string().trim().optional(),
		roles: z.array(z.string().trim()).optional(),
	}).optional().nullable(),
});

function normalizeText(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(value: string) {
	return value.replace(/\D+/g, '');
}

async function findUserByNameOrPhone(identifier: string) {
	const state = await loadIdentityState();
	const direct = findUserByIdentifier(state, identifier);
	if (direct && isIdentityUserActive(direct)) return direct;

	const normalizedName = normalizeText(identifier);
	const normalizedPhone = normalizePhone(identifier);
	for (const user of state.users) {
		if (!isIdentityUserActive(user)) continue;
		if (normalizeText(user.name) === normalizedName) return user;
		if (user.email && normalizeText(user.email) === normalizedName) return user;
		const profile = await getUserProfileById(user.id, user);
		const profileEmails = [profile.ndoveraEmail, profile.alternateEmail].filter(Boolean).map(normalizeText);
		if (profileEmails.includes(normalizedName)) return user;
		if (normalizedPhone) {
			const phones = [profile.phone, profile.emergencyContactPhone, profile.guardianPhone]
				.filter(Boolean)
				.map(normalizePhone)
				.filter(Boolean);
			if (phones.includes(normalizedPhone)) return user;
		}
	}
	return null;
}

function toVerifiedUser(user: Awaited<ReturnType<typeof findUserByNameOrPhone>>): FaqVerifiedUser {
	if (!user) return null;
	return {
		id: user.id,
		name: user.name,
		schoolName: user.schoolName,
		activeRole: user.activeRole,
		roles: user.roles,
	};
}

faqRouter.post('/verify', async (req, res) => {
	const parsed = verifySchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Enter your Ndovera name, ID, email, or phone number.' });
	}

	const user = await findUserByNameOrPhone(parsed.data.identifier);
	if (!user) {
		return res.json({
			matched: false,
			mode: 'public' as const,
			message: `I could not confirm that detail. I will stay in public help mode. You can still ask about Ndovera, register your school, or contact ${SUPPORT_EMAIL}.`,
		});
	}

	return res.json({
		matched: true,
		mode: 'verified' as const,
		user: toVerifiedUser(user),
		message: `I found ${user.name} (${user.activeRole}) from ${user.schoolName}. You can now ask how Ndovera works, what your role can do, how sign-up works for others, or what makes Ndovera different.`,
	});
});

faqRouter.post('/chat', async (req, res) => {
	const parsed = chatSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Enter a question for the FAQ assistant.' });
	}

	const mode = parsed.data.mode || 'public';
	const answer = buildFaqAnswer(parsed.data.question, {
		mode,
		verifiedUser: parsed.data.verifiedUser || null,
	});

	return res.json({ answer });
});