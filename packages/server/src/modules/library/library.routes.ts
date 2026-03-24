import { Router } from 'express';
import { z } from 'zod';

import { borrowLibraryBookForUser, getLibraryDashboardForUser, openLibraryBookForUser, submitLibraryBookForUser, toggleLibraryRecommendationForUser } from '../operations/schoolOps.store.js';

export const libraryRouter = Router();

const submissionSchema = z.object({
	title: z.string().trim().min(1),
	category: z.string().trim().optional(),
	summary: z.string().trim().optional(),
	format: z.string().trim().optional(),
	nairaPrice: z.coerce.number().min(0).optional(),
});

libraryRouter.get('/dashboard', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getLibraryDashboardForUser(user));
});

libraryRouter.post('/submissions', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = submissionSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid library submission payload.' });
	return res.status(201).json(await submitLibraryBookForUser(user, parsed.data));
});

libraryRouter.get('/books', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const dashboard = await getLibraryDashboardForUser(user);
	return res.json({ books: dashboard.books });
});

libraryRouter.post('/books/:bookId/open', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await openLibraryBookForUser(user, String(req.params.bookId || '').trim()));
});

libraryRouter.post('/books/:bookId/recommend', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await toggleLibraryRecommendationForUser(user, String(req.params.bookId || '').trim()));
});

libraryRouter.post('/books/:bookId/borrow', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await borrowLibraryBookForUser(user, String(req.params.bookId || '').trim()));
});