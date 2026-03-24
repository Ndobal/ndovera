import express from 'express';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { attachSuperUserFromHeaders, clearSuperSessionCookie, createSuperSessionCookie, requireSuperRole } from './rbac.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { buildMetrics, loadIdentityState, provisionUser, transferStudent } from '../../identity-state.js';
import { championshipSuperRouter } from './src/championship.routes.js';
const app = express();
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigins = (process.env.CORS_ORIGIN || process.env.NDOVERA_CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const csrfProtection = csurf({
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
    },
});
function resolveTrustProxy(value) {
    const normalized = String(value || '1').trim().toLowerCase();
    if (normalized === 'false' || normalized === '0')
        return false;
    if (normalized === 'true')
        return 1;
    const asNumber = Number(normalized);
    return Number.isNaN(asNumber) ? normalized : asNumber;
}
app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            frameSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
        },
    },
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
    const origin = String(req.headers.origin || '').trim();
    if (origin && corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS')
        return res.status(204).end();
    return next();
});
app.use(attachSuperUserFromHeaders);
app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
        const user = req.superUser;
        console.log(JSON.stringify({
            userId: user?.id || null,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - startedAt,
            ip: req.ip,
            userAgent: req.headers['user-agent'] || null,
        }));
    });
    next();
});
const schools = [{ id: 'school-1', name: 'Ndovera Academy', subdomain: 'ndovera', liveClassQuota: 5, pageCount: 1, website: null, createdAt: new Date().toISOString() }];
const plans = [{ id: 'plan-1', name: 'Starter', description: 'Starter plan', priceCents: 0, billingInterval: 'monthly', features: ['5 live classrooms', 'Website builder', 'Core operations'] }];
const onboardingRequests = [{ id: 'req-1', school_name: 'Ndovera Academy', subdomain: 'ndovera', owner_name: 'Admin', owner_ndovera_email: 'admin@ndovera.com', status: 'pending', payment_status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
const aiFeatures = [{ featureKey: 'ai-tutor', label: 'AI Tutor', category: 'student', audience: 'Students', description: 'Student tutor', enabled: true, auraCost: 5, freeTierLimit: 10, requiresSuperApproval: false, usageCount: 0, totalAuraSpent: 0 }];
const provisionSchema = z.object({
    category: z.enum(['student', 'staff', 'parent', 'admin']),
    schoolId: z.string().trim().min(1),
    schoolName: z.string().trim().min(2),
    name: z.string().trim().min(2),
    email: z.string().trim().email().optional().or(z.literal('')),
    password: z.string().min(6).optional(),
    roles: z.array(z.string().trim().min(1)).optional(),
});
const transferSchema = z.object({
    targetSchoolId: z.string().trim().min(1),
    reason: z.string().trim().optional(),
});
const loginSchema = z.object({
    email: z.string().trim().min(3),
    password: z.string().min(1),
});
function normalizeEnv(name, fallback) {
    return (process.env[name] || process.env[fallback] || '').trim();
}
function passwordMatches(password, stored) {
    if (!stored)
        return false;
    if (stored.startsWith('$2'))
        return bcrypt.compareSync(password, stored);
    return password === stored;
}
app.get('/health', async (_req, res) => {
    try {
        await loadIdentityState();
        return res.json({ ok: true, service: 'ndovera-super-admin-server', storage: (process.env.DATABASE_URL || process.env.POSTGRES_URL) ? 'postgres' : 'sqlite' });
    }
    catch {
        return res.status(503).json({ ok: false, service: 'ndovera-super-admin-server', error: 'Storage unavailable' });
    }
});
app.use('/api/super/auth', (req, res, next) => next());
app.post('/api/super/auth/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid login payload.' });
    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;
    const bootstrapEmail = normalizeEnv('SUPER_ADMIN_EMAIL', 'NDOVERA_SUPER_ADMIN_EMAIL').toLowerCase();
    const passwordHash = normalizeEnv('SUPER_ADMIN_PASSWORD_HASH', 'NDOVERA_SUPER_ADMIN_PASSWORD_HASH');
    const authSecret = process.env.NDOVERA_SUPER_ADMIN_AUTH_SECRET?.trim() || process.env.NDOVERA_AUTH_SECRET?.trim();
    const role = (process.env.NDOVERA_SUPER_ADMIN_ROLE || 'Super Admin').trim();
    if (!bootstrapEmail || !passwordHash || !authSecret) {
        return res.status(503).json({ error: 'Super-admin authentication is not configured.' });
    }
    if (email !== bootstrapEmail || !passwordMatches(password, passwordHash)) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const user = {
        id: process.env.NDOVERA_SUPER_ADMIN_ID || 'super-admin',
        name: process.env.NDOVERA_SUPER_ADMIN_NAME || 'Super Admin',
        email: bootstrapEmail,
        roles: [role],
        activeRole: role,
    };
    res.setHeader('Set-Cookie', createSuperSessionCookie(user));
    res.json({ user });
});
app.get('/api/super/auth/me', (req, res) => {
    const user = req.superUser;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    return res.json({ user });
});
app.post('/api/super/auth/logout', (_req, res) => {
    res.setHeader('Set-Cookie', clearSuperSessionCookie());
    res.json({ ok: true });
});
app.use(csrfProtection);
app.get('/csrf-token', (req, res) => res.json({ csrfToken: req.csrfToken() }));
app.use('/api/super', requireSuperRole('Super Admin'));
app.use('/api/super/championships', championshipSuperRouter);
app.get('/api/super/schools', async (_req, res) => {
    const state = await loadIdentityState();
    const metrics = buildMetrics(state);
    return res.json({
        schools: state.schools.map((school) => ({
            ...school,
            liveClassQuota: 5,
            pageCount: 1,
            website: null,
            counts: metrics.schools.find((entry) => entry.id === school.id)?.counts || { students: 0, staff: 0, parents: 0, admins: 0, total: 0 },
        })),
    });
});
app.get('/api/super/pricing-plans', (_req, res) => res.json({ plans }));
app.get('/api/super/onboarding/requests', (_req, res) => res.json({ requests: onboardingRequests }));
app.get('/api/super/ai/features', (_req, res) => res.json({ features: aiFeatures }));
app.get('/api/super/ai/usage', (_req, res) => res.json({ usage: [] }));
app.get('/api/super/ai/summary', (_req, res) => res.json({ features: aiFeatures.length, enabledFeatures: aiFeatures.length, usageCount: 0, auraSpent: 0 }));
app.get('/api/super/metrics', async (_req, res) => {
    const state = await loadIdentityState();
    return res.json(buildMetrics(state));
});
app.get('/api/super/users/directory', async (req, res) => {
    const user = req.superUser;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const state = await loadIdentityState();
    const schoolId = String(req.query.schoolId || user.schoolId || '').trim();
    const users = schoolId ? state.users.filter((item) => item.schoolId === schoolId) : state.users;
    const students = schoolId ? state.students.filter((item) => item.schoolId === schoolId) : state.students;
    return res.json({ schoolId, users, students });
});
app.post('/api/super/users/provision', requireSuperRole('Super Admin'), async (req, res) => {
    const parsed = provisionSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid user payload.' });
    const state = await loadIdentityState();
    const result = await provisionUser(state, parsed.data);
    return res.status(201).json(result);
});
app.post('/api/super/students/:studentId/transfer', requireSuperRole('Super Admin'), async (req, res) => {
    const parsed = transferSchema.safeParse(req.body || {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid transfer payload.' });
    const studentId = String(req.params.studentId || '').trim();
    try {
        const state = await loadIdentityState();
        const result = await transferStudent(state, studentId, parsed.data.targetSchoolId, parsed.data.reason, req.superUser?.id);
        return res.json(result);
    }
    catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Transfer failed.' });
    }
});
app.use((err, _req, res, next) => {
    if (err?.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    return next(err);
});
const server = app.listen(port, () => console.log(`Ndovera super-admin server running on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        console.log(`Received ${signal}, shutting down ndovera-super-admin-server`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10000).unref();
    });
}
