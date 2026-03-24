import { Router } from 'express';
import { z } from 'zod';
import { createCompetition, listCompetitions, listFeatureFlags, setFeatureFlag } from '../../../championship-state.js';
export const championshipSuperRouter = Router();
const questionSchema = z.object({
    type: z.string().trim().min(1),
    prompt: z.string().trim().min(3),
    options: z.array(z.string().trim()).optional(),
    correctAnswer: z.string().trim().min(1),
    explanation: z.string().trim().optional(),
    extraData: z.record(z.any()).optional(),
    points: z.number().int().min(1).max(100).optional(),
});
const createSchema = z.object({
    schoolId: z.string().trim().optional(),
    title: z.string().trim().min(3),
    description: z.string().trim().optional(),
    type: z.enum(['quiz', 'spelling', 'essay', 'math', 'live', 'exam']),
    scope: z.enum(['school', 'global', 'hosted']).default('global'),
    mode: z.enum(['single', 'stage']).default('single'),
    entryFee: z.number().min(0).optional(),
    status: z.enum(['draft', 'scheduled', 'active', 'completed']).optional(),
    startTime: z.string().trim().optional(),
    endTime: z.string().trim().optional(),
    hostOrganization: z.string().trim().optional(),
    hostedByNdovera: z.boolean().optional(),
    isLive: z.boolean().optional(),
    liveRoomUrl: z.string().trim().url().optional().or(z.literal('')),
    questions: z.array(questionSchema).min(1),
});
const flagSchema = z.object({ enabled: z.boolean() });
championshipSuperRouter.get('/dashboard', async (_req, res) => {
    try {
        const [featureFlags, competitions] = await Promise.all([
            listFeatureFlags(),
            listCompetitions({ includeGlobal: true }),
        ]);
        return res.json({ featureFlags, competitions });
    }
    catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to load championship controls.' });
    }
});
championshipSuperRouter.post('/', async (req, res) => {
    const user = req.superUser;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const parsed = createSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid championship payload.' });
    try {
        const result = await createCompetition({ ...parsed.data, schoolId: parsed.data.scope === 'school' ? parsed.data.schoolId || null : null, hostOrganization: parsed.data.hostOrganization || null, hostedByNdovera: parsed.data.scope === 'hosted' ? true : Boolean(parsed.data.hostedByNdovera), liveRoomUrl: parsed.data.liveRoomUrl || null, createdBy: user.id });
        return res.status(201).json(result);
    }
    catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create championship.' });
    }
});
championshipSuperRouter.patch('/flags/:name', async (req, res) => {
    const parsed = flagSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid flag payload.' });
    try {
        const flag = await setFeatureFlag(String(req.params.name || '').trim(), parsed.data.enabled);
        return res.json(flag);
    }
    catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update feature flag.' });
    }
});
