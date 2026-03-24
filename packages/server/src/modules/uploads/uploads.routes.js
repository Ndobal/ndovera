import { Router } from 'express';
export const uploadsRouter = Router();
uploadsRouter.post('/logo', (_req, res) => res.json({ ok: true, url: '/uploads/logo.png' }));
uploadsRouter.post('/payment-proof', (_req, res) => res.json({ ok: true, url: '/uploads/proof.png' }));
uploadsRouter.post('/media', (_req, res) => res.json({ ok: true, url: '/uploads/media.png' }));
uploadsRouter.post('/classroom-asset', (_req, res) => res.json({ ok: true, url: '/uploads/asset.png' }));
uploadsRouter.post('/live-class-recording', (_req, res) => res.json({ ok: true, url: '/uploads/recording.mp4' }));
