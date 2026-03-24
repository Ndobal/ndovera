import { Router } from 'express';
import { z } from 'zod';
import { createSchoolClassForUser, deleteSchoolClassForUser, listSchoolClassesForUser, updateSchoolClassForUser } from './classes.store.js';
import { removeSubjectsForClass, syncSubjectsForClass } from './subjects.store.js';
export const classesRouter = Router();
const createClassSchema = z.object({
    name: z.string().trim().min(1),
    level: z.string().trim().optional(),
    section: z.string().trim().optional(),
    teacher_id: z.string().trim().optional(),
    teacherName: z.string().trim().optional(),
});
const updateClassSchema = createClassSchema.partial();
classesRouter.get('/', (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    return res.json(listSchoolClassesForUser(user));
});
classesRouter.post('/', (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const parsed = createClassSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid class payload.' });
    try {
        return res.status(201).json(createSchoolClassForUser(user, parsed.data));
    }
    catch (error) {
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
        const message = error instanceof Error ? error.message : 'Unable to create class.';
        return res.status(status || 500).json({ error: message });
    }
});
classesRouter.patch('/:classId', (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const parsed = updateClassSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid class update payload.' });
    try {
        const updated = updateSchoolClassForUser(user, String(req.params.classId || '').trim(), parsed.data);
        syncSubjectsForClass(user, updated.id, {
            className: [updated.level, updated.name].filter(Boolean).join(' ').trim() || updated.name,
            section: updated.section,
        });
        return res.json(updated);
    }
    catch (error) {
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
        const message = error instanceof Error ? error.message : 'Unable to update class.';
        return res.status(status || 500).json({ error: message });
    }
});
classesRouter.delete('/:classId', (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    try {
        const removed = deleteSchoolClassForUser(user, String(req.params.classId || '').trim());
        removeSubjectsForClass(user, removed.id);
        return res.json({ ok: true, removed });
    }
    catch (error) {
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
        const message = error instanceof Error ? error.message : 'Unable to delete class.';
        return res.status(status || 500).json({ error: message });
    }
});