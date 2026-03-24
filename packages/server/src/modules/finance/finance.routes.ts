import { Router } from 'express';
import { z } from 'zod';
import { adComplianceRouter } from './adCompliance.routes.js';
import { billingRouter } from './billing.routes.js';
import { creditsRouter } from './credits.routes.js';
import { getFinanceStatsForUser } from '../operations/schoolOps.store.js';
import { monetizationRouter } from './monetization.routes.js';
import { generatePayrollDirectorSheet, getPayrollOverview, getPayrollSelfService, getStaffIncentiveReadiness, listPayrollAdminSnapshot, listPayrollHistory, preparePayrollMonth, publishPayrollMonth, savePayrollMonthNote, savePayrollPayoutProfile, updatePayrollSlip, upsertPayrollConfig } from './payroll.store.ts';

export const financeRouter = Router();

const payrollConfigSchema = z.object({
	userId: z.string().trim().min(1),
	baseSalaryNaira: z.number().nonnegative(),
	allowancesNaira: z.number().nonnegative().optional(),
	deductionsNaira: z.number().nonnegative().optional(),
	payrollEnabled: z.boolean().optional(),
});

const payrollMonthSchema = z.object({
	monthKey: z.string().trim().regex(/^\d{4}-\d{2}$/).optional(),
	notes: z.string().trim().max(4000).optional().nullable(),
});

const payrollMonthNoteSchema = z.object({
	monthId: z.string().trim().min(1),
	notes: z.string().trim().max(20000).optional().nullable(),
	directorNote: z.string().trim().max(20000).optional().nullable(),
	generateDefault: z.boolean().optional(),
});

const payrollSlipSchema = z.object({
	slipId: z.string().trim().min(1),
	baseSalaryNaira: z.number().nonnegative(),
	bonusNaira: z.number().nonnegative().optional(),
	allowancesNaira: z.number().nonnegative().optional(),
	taxNaira: z.number().nonnegative().optional(),
	loanNaira: z.number().nonnegative().optional(),
	deductionsNaira: z.number().nonnegative().optional(),
	note: z.string().trim().max(5000).optional().nullable(),
});

const payoutProfileSchema = z.object({
	accountName: z.string().trim().min(2),
	bankName: z.string().trim().min(2),
	accountNumber: z.string().trim().min(10),
	bvn: z.string().trim().optional().nullable(),
	nin: z.string().trim().optional().nullable(),
	consentAcknowledged: z.boolean().optional(),
});

financeRouter.use('/monetization', billingRouter);
financeRouter.use('/monetization', creditsRouter);
financeRouter.use('/monetization', adComplianceRouter);
financeRouter.use('/monetization', monetizationRouter);

financeRouter.get('/stats', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getFinanceStatsForUser(user));
});
financeRouter.get('/payroll/overview', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getPayrollOverview(user));
});

financeRouter.get('/payroll/admin', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		return res.json(await listPayrollAdminSnapshot(user));
	} catch (error) {
		return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
	}
});

financeRouter.get('/payroll/history', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		return res.json(await listPayrollHistory(user, {
			search: typeof req.query.search === 'string' ? req.query.search : undefined,
			monthKey: typeof req.query.monthKey === 'string' ? req.query.monthKey : undefined,
			status: req.query.status === 'draft' || req.query.status === 'published' ? req.query.status : undefined,
		}));
	} catch (error) {
		return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
	}
});

financeRouter.put('/payroll/config', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = payrollConfigSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid payroll configuration payload.' });
	try {
		return res.json({ config: await upsertPayrollConfig(user, parsed.data) });
	} catch (error) {
		return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
	}
});

financeRouter.post('/payroll/months/prepare', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = payrollMonthSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid payroll month payload.' });
	try {
		return res.json(await preparePayrollMonth(user, parsed.data));
	} catch (error) {
		return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
	}
});

financeRouter.post('/payroll/months/:monthId/publish', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		return res.json(await publishPayrollMonth(user, String(req.params.monthId || '').trim()));
	} catch (error) {
		return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
	}
});

financeRouter.put('/payroll/months/note', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = payrollMonthNoteSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid payroll note payload.' });
	try {
		return res.json(await savePayrollMonthNote(user, parsed.data));
	} catch (error) {
		return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
	}
});

financeRouter.post('/payroll/months/:monthId/director-sheet', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	try {
		return res.json(await generatePayrollDirectorSheet(user, String(req.params.monthId || '').trim()));
	} catch (error) {
		return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
	}
});

financeRouter.put('/payroll/slips', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = payrollSlipSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid payroll slip payload.' });
	try {
		return res.json({ slip: await updatePayrollSlip(user, parsed.data) });
	} catch (error) {
		return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
	}
});

financeRouter.get('/payroll/self-service', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getPayrollSelfService(user));
});

financeRouter.put('/payroll/payout-profile', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = payoutProfileSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid payout profile payload.' });
	return res.json({ profile: await savePayrollPayoutProfile(user, parsed.data) });
});

financeRouter.get('/payroll/incentive-readiness', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({ readiness: await getStaffIncentiveReadiness(user) });
});