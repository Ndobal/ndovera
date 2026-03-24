import { Router } from 'express';
import { mockData } from '../../common/mockData.js';
export const libraryRouter = Router();
libraryRouter.get('/dashboard', (_req, res) => res.json({ books: mockData.books }));
libraryRouter.post('/submissions', (req, res) => res.json({ ok: true, payload: req.body || {} }));
libraryRouter.get('/books', (_req, res) => res.json({ books: mockData.books }));
