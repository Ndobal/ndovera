import { Router } from 'express';
export const onboardingRouter = Router();
onboardingRouter.post('/register-school', (req, res) => res.json({ ok: true, request: req.body || {} }));
onboardingRouter.post('/:waitToken/payment', (req, res) => res.json({ ok: true, token: req.params.waitToken }));
onboardingRouter.get('/:waitToken/status', (req, res) => res.json({ status: 'pending', token: req.params.waitToken }));
