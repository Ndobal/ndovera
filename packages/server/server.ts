import express from 'express';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachUserFromHeaders } from './rbac.js';
import { loadIdentityState } from '../../identity-state.js';
import { authRouter } from './src/modules/auth/auth.routes.js';
import { usersRouter } from './src/modules/users/users.routes.js';
import { dashboardRouter } from './src/modules/dashboard/dashboard.routes.js';
import { attendanceRouter } from './src/modules/attendance/attendance.routes.js';
import { studentsRouter } from './src/modules/students/students.routes.js';
import { faqRouter } from './src/modules/faq/faq.routes.js';
import { classroomRouter } from './src/modules/classroom/classroom.routes.js';
import { classesRouter } from './src/modules/classroom/classes.routes.js';
import { financeRouter } from './src/modules/finance/finance.routes.js';
import { messagingRouter } from './src/modules/messaging/messaging.routes.js';
import { onboardingRouter } from './src/modules/onboarding/onboarding.routes.js';
import { notificationsRouter } from './src/modules/notifications/notifications.routes.js';
import { publicRouter } from './src/modules/public/public.routes.js';
import { uploadsRouter } from './src/modules/uploads/uploads.routes.js';
import { libraryRouter } from './src/modules/library/library.routes.js';
import { championshipRouter } from './src/modules/championship/championship.routes.js';
import { schoolsRouter } from './src/modules/schools/schools.routes.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const storageBackend = (process.env.DATABASE_URL || process.env.POSTGRES_URL) ? 'postgres' : 'sqlite';
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

function resolveTrustProxy(value: string | undefined) {
	const normalized = String(value || '1').trim().toLowerCase();
	if (normalized === 'false' || normalized === '0') return false;
	if (normalized === 'true') return 1;
	const asNumber = Number(normalized);
	return Number.isNaN(asNumber) ? normalized : asNumber;
}

app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY));

app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", 'https://www.youtube.com'],
			frameSrc: ["'self'", 'https://www.youtube.com'],
			imgSrc: ["'self'", 'data:', 'https://img.youtube.com'],
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
	if (req.method === 'OPTIONS') return res.status(204).end();
	return next();
});
app.use(attachUserFromHeaders);
app.use((req, res, next) => {
	const startedAt = Date.now();
	res.on('finish', () => {
		const user = (req as any).user;
		console.log(JSON.stringify({
			userId: user?.id || null,
			tenantId: user?.school_id || null,
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
app.get('/health', async (_req, res) => {
	try {
		await loadIdentityState();
		return res.json({ ok: true, service: 'ndovera-server', storage: storageBackend });
	} catch {
		return res.status(503).json({ ok: false, service: 'ndovera-server', error: 'Storage unavailable' });
	}
});
app.use('/api', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/faq', faqRouter);
app.use(csrfProtection);
app.get('/csrf-token', (req, res) => res.json({ csrfToken: (req as any).csrfToken() }));
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/students', studentsRouter);
app.use('/api/classes', classesRouter);
app.use('/api/classroom', classroomRouter);
app.use('/api/finance', financeRouter);
app.use('/api/messaging', messagingRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/schools', schoolsRouter);
app.use('/api/library', libraryRouter);
app.use('/api/championships', championshipRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
	if (err?.code === 'EBADCSRFTOKEN') {
		return res.status(403).json({ error: 'Invalid CSRF token' });
	}
	return next(err);
});
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const server = app.listen(port, () => console.log(`Ndovera server running on port ${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		console.log(`Received ${signal}, shutting down ndovera-server`);
		server.close(() => process.exit(0));
		setTimeout(() => process.exit(1), 10000).unref();
	});
}