import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { attachSuperUserFromHeaders, clearSuperSessionCookie, createSuperSessionCookie, requireSuperRole } from './rbac.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { buildMetrics, createSchoolWithOwner, isIdentityUserActive, listIdentityLifecycleEvents, listIdentityUsers, loadIdentityState, provisionUser, transferStudent, updateIdentityUser } from '../../identity-state.js';
import { adComplianceSuperRouter } from './src/adCompliance.routes.js';
import { billingSuperRouter, billingWebhookRouter } from './src/billing.routes.js';
import { championshipSuperRouter } from './src/championship.routes.js';
import { creditsSuperRouter } from './src/credits.routes.js';
import { monetizationSuperRouter } from './src/monetization.routes.js';

type PricingPlan = { id: string; name: string; description: string; priceCents: number; billingInterval: string; features: string[] };
type LiveCapacityOption = { participantLimit: number; priceNaira: number; label: string };
type PlatformSettings = {
	liveMeetings: {
		defaultParticipantLimit: number;
		schoolConcurrentLimit: number;
		upgradeOptions: LiveCapacityOption[];
	};
	economy: {
		currencyName: string;
		currencyPlural: string;
		currencySymbol: string;
		aiUnitsPerNaira: number;
		cashoutNairaPerUnit: number;
		adRewardPerImpression: number;
	};
};
type AiFeature = { featureKey: string; label: string; category: 'student' | 'teacher' | 'staff'; audience: string; description: string; enabled: boolean; keyuCost: number; freeTierLimit: number; requiresSuperApproval: boolean; usageCount: number; totalKeyuSpent: number };
type PublicInboxStatus = 'new' | 'reviewing' | 'resolved';
type PublicContactInquiry = {
	id: string;
	schoolId: string | null;
	name: string | null;
	email: string;
	message: string;
	enquiryPath: string;
	enquiryLabel: string;
	primaryResponsibleRole: string;
	responsibleRoles: string[];
	routingNote: string;
	status: PublicInboxStatus;
	createdAt: string;
	updatedAt?: string;
	reviewedAt?: string | null;
	reviewedBy?: string | null;
};
type GrowthPartnerApplication = {
	id: string;
	schoolId: string | null;
	name: string;
	email: string;
	phone: string;
	city: string | null;
	notes: string | null;
	source: string | null;
	primaryResponsibleRole: string;
	responsibleRoles: string[];
	status: PublicInboxStatus;
	createdAt: string;
	updatedAt?: string;
	reviewedAt?: string | null;
	reviewedBy?: string | null;
};
type PublicContactState = { messages: PublicContactInquiry[] };
type GrowthPartnerApplicationState = { applications: GrowthPartnerApplication[] };
type SchoolProfileRecord = {
	schoolId: string;
	logoUrl: string | null;
	websiteUrl: string | null;
	primaryColor: string | null;
	websiteConfig: Record<string, unknown> | null;
	updatedAt: string;
};
type SchoolProfilesState = { profiles: SchoolProfileRecord[] };

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
			scriptSrc: ["'self'"],
			frameSrc: ["'self'"],
			imgSrc: ["'self'", 'data:'],
		},
	},
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({
	limit: '1mb',
	verify: (req, _res, buf) => {
		(req as any).rawBody = buf.toString('utf8');
	},
}));
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
app.use(attachSuperUserFromHeaders);
app.use((req, res, next) => {
	const startedAt = Date.now();
	res.on('finish', () => {
		const user = (req as any).superUser;
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
const aiFeatures: AiFeature[] = [{ featureKey: 'ai-tutor', label: 'AI Tutor', category: 'student', audience: 'Students', description: 'Student tutor', enabled: true, keyuCost: 5, freeTierLimit: 10, requiresSuperApproval: false, usageCount: 0, totalKeyuSpent: 0 }];
const provisionSchema = z.object({
	category: z.enum(['student', 'staff', 'parent', 'admin', 'alumni']),
	schoolId: z.string().trim().min(1),
	schoolName: z.string().trim().min(2),
	name: z.string().trim().min(2),
	email: z.string().trim().email().optional().or(z.literal('')),
	phone: z.string().trim().optional().or(z.literal('')),
	password: z.string().min(6).optional(),
	roles: z.array(z.string().trim().min(1)).optional(),
});
const createSchoolSchema = z.object({
	schoolName: z.string().trim().min(2),
	subdomain: z.string().trim().min(2).regex(/^[a-z0-9-]+$/i),
	schoolId: z.string().trim().optional().or(z.literal('')),
	ownerName: z.string().trim().min(2),
	ownerEmail: z.string().trim().email().optional().or(z.literal('')),
	ownerPhone: z.string().trim().optional().or(z.literal('')),
	ownerPassword: z.string().min(6).optional().or(z.literal('')),
	ownerRoles: z.array(z.string().trim().min(1)).optional(),
});
const updateUserSchema = z.object({
	name: z.string().trim().min(2).optional(),
	email: z.string().trim().email().optional().or(z.literal('')).nullable(),
	phone: z.string().trim().optional().or(z.literal('')).nullable(),
	password: z.string().min(6).optional().or(z.literal('')),
	roles: z.array(z.string().trim().min(1)).optional(),
	activeRole: z.string().trim().min(1).optional(),
	category: z.enum(['student', 'staff', 'parent', 'admin', 'alumni']).optional(),
	status: z.enum(['active', 'inactive']).optional(),
	schoolId: z.string().trim().optional(),
});
const transferSchema = z.object({
	targetSchoolId: z.string().trim().min(1),
	reason: z.string().trim().optional(),
});
const loginSchema = z.object({
	email: z.string().trim().min(3),
	password: z.string().min(1),
});
const pricingPlanSchema = z.object({
	id: z.string().trim().min(1),
	name: z.string().trim().min(1),
	description: z.string().trim().min(1),
	priceCents: z.number().int().min(0),
	billingInterval: z.string().trim().min(1),
	features: z.array(z.string().trim().min(1)).min(1),
});
const platformSettingsSchema = z.object({
	liveMeetings: z.object({
		defaultParticipantLimit: z.number().int().min(1),
		schoolConcurrentLimit: z.number().int().min(1),
		upgradeOptions: z.array(z.object({
			participantLimit: z.number().int().min(1),
			priceNaira: z.number().int().min(0),
			label: z.string().trim().min(1),
		})).min(1),
	}),
	economy: z.object({
		currencyName: z.string().trim().min(1),
		currencyPlural: z.string().trim().min(1),
		currencySymbol: z.string().trim().min(1),
		aiUnitsPerNaira: z.number().positive(),
		cashoutNairaPerUnit: z.number().nonnegative(),
		adRewardPerImpression: z.number().nonnegative(),
	}),
});
const publicInboxStatusSchema = z.enum(['new', 'reviewing', 'resolved']);
const saveWebsiteSchema = z.object({
	website_config: z.record(z.unknown()),
	primary_color: z.string().trim().min(4).max(32).optional().nullable(),
	logo_url: z.string().trim().min(1).optional().nullable(),
	website_url: z.string().trim().min(1).optional().nullable(),
});

function normalizeEnv(name: string, fallback: string) {
	return (process.env[name] || process.env[fallback] || '').trim();
}

function passwordMatches(password: string, stored: string) {
	if (!stored) return false;
	if (stored.startsWith('$2')) return bcrypt.compareSync(password, stored);
	return password === stored;
}

const DOCUMENT_DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
const DOCUMENT_SQLITE_PATH = (process.env.NDOVERA_APP_DB_PATH || '').trim() || 'C:/app/storage/ndovera-app.db';
const documentSqlite = DOCUMENT_DATABASE_URL ? null : new Database(DOCUMENT_SQLITE_PATH);
const documentPgPool = DOCUMENT_DATABASE_URL
	? new Pool({
		connectionString: DOCUMENT_DATABASE_URL,
		ssl: process.env.PGSSLMODE === 'require' || process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
	})
	: null;
let documentSchemaPromise: Promise<void> | null = null;

function defaultPricingPlans(): PricingPlan[] {
	return [
		{ id: 'plan-1', name: 'Starter', description: 'Starter plan', priceCents: 0, billingInterval: 'monthly', features: ['5 live classrooms', '50 live participants', 'Website template', 'Core operations'] },
		{ id: 'plan-2', name: 'Growth', description: 'Growth plan', priceCents: 250000, billingInterval: 'monthly', features: ['10 live classrooms', '100 live participants', 'Advanced management', 'Priority support'] },
	];
}

function defaultPlatformSettings(): PlatformSettings {
	return {
		liveMeetings: {
			defaultParticipantLimit: 50,
			schoolConcurrentLimit: 5,
			upgradeOptions: [
				{ participantLimit: 100, priceNaira: 15000, label: 'Starter expansion' },
				{ participantLimit: 150, priceNaira: 22500, label: 'Growth expansion' },
				{ participantLimit: 200, priceNaira: 30000, label: 'Scale expansion' },
				{ participantLimit: 300, priceNaira: 45000, label: 'Summit expansion' },
			],
		},
		economy: {
			currencyName: 'Keyu',
			currencyPlural: 'Keyu',
			currencySymbol: 'K',
			aiUnitsPerNaira: 3,
			cashoutNairaPerUnit: 1,
			adRewardPerImpression: 1,
		},
	};
}

async function ensureDocumentSchema() {
	if (documentSchemaPromise) return documentSchemaPromise;
	documentSchemaPromise = (async () => {
		if (documentPgPool) {
			await documentPgPool.query('CREATE TABLE IF NOT EXISTS ndovera_documents (namespace TEXT NOT NULL, school_scope TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (namespace, school_scope))');
			return;
		}
		if (documentSqlite) {
			documentSqlite.pragma('journal_mode = WAL');
			documentSqlite.exec('CREATE TABLE IF NOT EXISTS ndovera_documents (namespace TEXT NOT NULL, school_scope TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (namespace, school_scope))');
		}
	})();
	return documentSchemaPromise;
}

async function listPersistedOnboardingRequests() {
	await ensureDocumentSchema();
	const namespace = 'school-onboarding';
	const scope = '__global__';
	if (documentPgPool) {
		const result = await documentPgPool.query('SELECT payload_json FROM ndovera_documents WHERE namespace = $1 AND school_scope = $2', [namespace, scope]);
		const requests = result.rows[0]?.payload_json ? JSON.parse(String(result.rows[0].payload_json)).requests : [];
		return Array.isArray(requests) ? requests : [];
	}
	if (!documentSqlite) return [];
	const row = documentSqlite.prepare('SELECT payload_json FROM ndovera_documents WHERE namespace = ? AND school_scope = ?').get(namespace, scope) as { payload_json?: string } | undefined;
	const requests = row?.payload_json ? JSON.parse(String(row.payload_json)).requests : [];
	return Array.isArray(requests) ? requests : [];
}

async function readGlobalDocument<T>(namespace: string, fallbackFactory: () => T): Promise<T> {
	await ensureDocumentSchema();
	const scope = '__global__';
	if (documentPgPool) {
		const result = await documentPgPool.query('SELECT payload_json FROM ndovera_documents WHERE namespace = $1 AND school_scope = $2', [namespace, scope]);
		const payload = result.rows[0]?.payload_json;
		if (!payload) return fallbackFactory();
		try {
			return JSON.parse(String(payload)) as T;
		} catch {
			return fallbackFactory();
		}
	}
	if (!documentSqlite) return fallbackFactory();
	const row = documentSqlite.prepare('SELECT payload_json FROM ndovera_documents WHERE namespace = ? AND school_scope = ?').get(namespace, scope) as { payload_json?: string } | undefined;
	if (!row?.payload_json) return fallbackFactory();
	try {
		return JSON.parse(String(row.payload_json)) as T;
	} catch {
		return fallbackFactory();
	}
}

async function writeGlobalDocument<T>(namespace: string, value: T) {
	await ensureDocumentSchema();
	const scope = '__global__';
	const payloadJson = JSON.stringify(value);
	const updatedAt = new Date().toISOString();
	if (documentPgPool) {
		await documentPgPool.query(
			'INSERT INTO ndovera_documents (namespace, school_scope, payload_json, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (namespace, school_scope) DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = EXCLUDED.updated_at',
			[namespace, scope, payloadJson, updatedAt],
		);
		return value;
	}
	if (documentSqlite) {
		documentSqlite.prepare('INSERT INTO ndovera_documents (namespace, school_scope, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(namespace, school_scope) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at').run(namespace, scope, payloadJson, updatedAt);
	}
	return value;
}

async function readPricingPlans() {
	return readGlobalDocument<PricingPlan[]>('super-pricing-plans', defaultPricingPlans);
}

async function writePricingPlans(plans: PricingPlan[]) {
	return writeGlobalDocument('super-pricing-plans', plans);
}

async function readPlatformSettings() {
	return readGlobalDocument<PlatformSettings>('platform-settings', defaultPlatformSettings);
}

async function writePlatformSettings(settings: PlatformSettings) {
	return writeGlobalDocument('platform-settings', settings);
}

async function readPublicContactState() {
	return readGlobalDocument<PublicContactState>('public-contact-inquiries', () => ({ messages: [] }));
}

async function writePublicContactState(state: PublicContactState) {
	return writeGlobalDocument('public-contact-inquiries', state);
}

async function readGrowthPartnerApplications() {
	return readGlobalDocument<GrowthPartnerApplicationState>('growth-partner-applications', () => ({ applications: [] }));
}

async function writeGrowthPartnerApplications(state: GrowthPartnerApplicationState) {
	return writeGlobalDocument('growth-partner-applications', state);
}

function normalizeOptionalString(value: unknown) {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized ? normalized : null;
}

function nowIso() {
	return new Date().toISOString();
}

async function readSchoolProfilesState() {
	return readGlobalDocument<SchoolProfilesState>('school-profiles', () => ({ profiles: [] }));
}

async function getStoredSchoolProfile(schoolId: string) {
	const normalizedSchoolId = schoolId.trim();
	if (!normalizedSchoolId) return null;
	const state = await readSchoolProfilesState();
	return state.profiles.find((profile) => profile.schoolId === normalizedSchoolId) || null;
}

async function upsertStoredSchoolProfile(input: {
	schoolId: string;
	logoUrl?: string | null;
	websiteUrl?: string | null;
	primaryColor?: string | null;
	websiteConfig?: Record<string, unknown> | null;
}) {
	const schoolId = input.schoolId.trim();
	if (!schoolId) throw new Error('schoolId is required');
	const state = await readSchoolProfilesState();
	const profileIndex = state.profiles.findIndex((profile) => profile.schoolId === schoolId);
	const current = profileIndex >= 0 ? state.profiles[profileIndex] : null;
	const nextProfile: SchoolProfileRecord = {
		schoolId,
		logoUrl: input.logoUrl !== undefined ? normalizeOptionalString(input.logoUrl) : current?.logoUrl || null,
		websiteUrl: input.websiteUrl !== undefined ? normalizeOptionalString(input.websiteUrl) : current?.websiteUrl || null,
		primaryColor: input.primaryColor !== undefined ? normalizeOptionalString(input.primaryColor) : current?.primaryColor || null,
		websiteConfig: input.websiteConfig !== undefined ? input.websiteConfig : current?.websiteConfig || null,
		updatedAt: nowIso(),
	};
	if (profileIndex >= 0) {
		state.profiles[profileIndex] = nextProfile;
	} else {
		state.profiles.push(nextProfile);
	}
	await writeGlobalDocument('school-profiles', state);
	return nextProfile;
}

function updatePublicInboxItem<T extends { id: string; status: PublicInboxStatus; updatedAt?: string; reviewedAt?: string | null; reviewedBy?: string | null }>(
	items: T[],
	itemId: string,
	status: PublicInboxStatus,
	reviewedBy: string,
) {
	const updatedAt = new Date().toISOString();
	let found = false;
	const nextItems = items.map((item) => {
		if (item.id !== itemId) return item;
		found = true;
		return {
			...item,
			status,
			updatedAt,
			reviewedAt: status === 'new' ? null : updatedAt,
			reviewedBy: status === 'new' ? null : reviewedBy,
		};
	});
	return { found, items: nextItems };
}

app.get('/health', async (_req, res) => {
	try {
		await loadIdentityState();
		return res.json({ ok: true, service: 'ndovera-super-admin-server', storage: (process.env.DATABASE_URL || process.env.POSTGRES_URL) ? 'postgres' : 'sqlite' });
	} catch {
		return res.status(503).json({ ok: false, service: 'ndovera-super-admin-server', error: 'Storage unavailable' });
	}
});
app.use('/api/super/auth', (req, res, next) => next());

app.post('/api/super/auth/login', (req, res) => {
	const parsed = loginSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid login payload.' });
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
	const user = (req as any).superUser;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({ user });
});

app.post('/api/super/auth/logout', (_req, res) => {
	res.setHeader('Set-Cookie', clearSuperSessionCookie());
	res.json({ ok: true });
});

app.use('/api/super/monetization', billingWebhookRouter);
app.use(csrfProtection);
app.get('/csrf-token', (req, res) => res.json({ csrfToken: (req as any).csrfToken() }));
app.use('/api/super', requireSuperRole('Super Admin'));
app.use('/api/super/championships', championshipSuperRouter);
app.use('/api/super/monetization', billingSuperRouter);
app.use('/api/super/monetization', creditsSuperRouter);
app.use('/api/super/monetization', adComplianceSuperRouter);
app.use('/api/super/monetization', monetizationSuperRouter);

app.get('/api/super/schools', async (_req, res) => {
	const state = await loadIdentityState();
	const metrics = buildMetrics(state);
	const platformSettings = await readPlatformSettings();
	const schoolProfiles = await readSchoolProfilesState();
	return res.json({
		schools: state.schools.map((school) => {
			const profile = schoolProfiles.profiles.find((entry) => entry.schoolId === school.id) || null;
			const pageCount = Array.isArray((profile?.websiteConfig as { pages?: unknown[] } | null | undefined)?.pages)
				? (((profile?.websiteConfig as { pages?: unknown[] }).pages) || []).length
				: 0;
			return {
				...school,
				logoUrl: profile?.logoUrl || undefined,
				primaryColor: profile?.primaryColor || undefined,
				liveClassQuota: platformSettings.liveMeetings.schoolConcurrentLimit,
				pageCount,
				website: profile?.websiteConfig || null,
				counts: metrics.schools.find((entry) => entry.id === school.id)?.counts || { students: 0, staff: 0, parents: 0, admins: 0, total: 0 },
			};
		}),
	});
});
app.post('/api/super/schools', requireSuperRole('Super Admin'), async (req, res) => {
	const parsed = createSchoolSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid school payload.' });
	const state = await loadIdentityState();
	try {
		const result = await createSchoolWithOwner(state, {
			schoolName: parsed.data.schoolName,
			subdomain: parsed.data.subdomain,
			schoolId: parsed.data.schoolId || undefined,
			ownerName: parsed.data.ownerName,
			ownerEmail: parsed.data.ownerEmail || undefined,
			ownerPhone: parsed.data.ownerPhone || undefined,
			ownerPassword: parsed.data.ownerPassword || undefined,
			ownerRoles: parsed.data.ownerRoles,
		});
		return res.status(201).json(result);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create school.' });
	}
});
app.get('/api/super/schools/:schoolId/website', async (req, res) => {
	const schoolId = String(req.params.schoolId || '').trim();
	if (!schoolId) return res.status(400).json({ error: 'schoolId is required.' });
	const profile = await getStoredSchoolProfile(schoolId);
	return res.json({ schoolId, profile, website: profile?.websiteConfig || null });
});
app.put('/api/super/schools/:schoolId/website', async (req, res) => {
	const schoolId = String(req.params.schoolId || '').trim();
	if (!schoolId) return res.status(400).json({ error: 'schoolId is required.' });
	const parsed = saveWebsiteSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid website payload.' });
	const profile = await upsertStoredSchoolProfile({
		schoolId,
		websiteConfig: parsed.data.website_config,
		primaryColor: parsed.data.primary_color,
		logoUrl: parsed.data.logo_url,
		websiteUrl: parsed.data.website_url,
	});
	return res.json({ ok: true, schoolId, profile, website: profile.websiteConfig });
});
app.get('/api/super/pricing-plans', async (_req, res) => res.json({ plans: await readPricingPlans() }));
app.put('/api/super/pricing-plans', async (req, res) => {
	const parsed = z.array(pricingPlanSchema).safeParse(req.body?.plans || req.body || []);
	if (!parsed.success) return res.status(400).json({ error: 'Invalid pricing plan payload.' });
	return res.json({ plans: await writePricingPlans(parsed.data) });
});
app.get('/api/super/onboarding/requests', async (_req, res) => res.json({ requests: await listPersistedOnboardingRequests() }));
app.get('/api/super/public-inbox', async (_req, res) => {
	const [contactState, growthState] = await Promise.all([readPublicContactState(), readGrowthPartnerApplications()]);
	return res.json({
		contactInquiries: contactState.messages || [],
		growthApplications: growthState.applications || [],
	});
});
app.patch('/api/super/public-inbox/:kind/:itemId', async (req, res) => {
	const kind = String(req.params.kind || '').trim().toLowerCase();
	const itemId = String(req.params.itemId || '').trim();
	const parsed = publicInboxStatusSchema.safeParse(req.body?.status);
	if (!itemId) return res.status(400).json({ error: 'Item id is required.' });
	if (!parsed.success) return res.status(400).json({ error: 'Valid status is required.' });
	const reviewedBy = String((req as any).superUser?.email || (req as any).superUser?.id || 'super-admin');

	if (kind === 'contact') {
		const state = await readPublicContactState();
		const result = updatePublicInboxItem(state.messages || [], itemId, parsed.data, reviewedBy);
		if (!result.found) return res.status(404).json({ error: 'Contact inquiry not found.' });
		const nextState = { ...state, messages: result.items };
		await writePublicContactState(nextState);
		return res.json({ ok: true, inquiry: result.items.find((item) => item.id === itemId) });
	}

	if (kind === 'growth') {
		const state = await readGrowthPartnerApplications();
		const result = updatePublicInboxItem(state.applications || [], itemId, parsed.data, reviewedBy);
		if (!result.found) return res.status(404).json({ error: 'Growth application not found.' });
		const nextState = { ...state, applications: result.items };
		await writeGrowthPartnerApplications(nextState);
		return res.json({ ok: true, application: result.items.find((item) => item.id === itemId) });
	}

	return res.status(400).json({ error: 'Unsupported inbox type.' });
});
app.get('/api/super/ai/features', (_req, res) => res.json({ features: aiFeatures }));
app.get('/api/super/ai/usage', (_req, res) => res.json({ usage: [] }));
app.get('/api/super/ai/summary', (_req, res) => res.json({ features: aiFeatures.length, enabledFeatures: aiFeatures.length, usageCount: 0, keyuSpent: aiFeatures.reduce((sum, feature) => sum + feature.totalKeyuSpent, 0) }));
app.get('/api/super/platform-settings', async (_req, res) => res.json({ settings: await readPlatformSettings() }));
app.put('/api/super/platform-settings', async (req, res) => {
	const parsed = platformSettingsSchema.safeParse(req.body?.settings || req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid platform settings payload.' });
	return res.json({ settings: await writePlatformSettings(parsed.data) });
});
app.get('/api/super/metrics', async (_req, res) => {
	const state = await loadIdentityState();
	return res.json(buildMetrics(state));
});

app.get('/api/super/users/directory', async (req, res) => {
	const user = (req as any).superUser;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const state = await loadIdentityState();
	const schoolId = String(req.query.schoolId || user.schoolId || '').trim();
	const includeInactive = String(req.query.includeInactive || '').trim() === '1';
	const users = listIdentityUsers(state, schoolId, includeInactive);
	const students = schoolId ? state.students.filter((item) => item.schoolId === schoolId) : state.students;
	return res.json({ schoolId, includeInactive, users, students, lifecycleEvents: listIdentityLifecycleEvents(state, { schoolId, limit: 160 }) });
});

app.post('/api/super/users/provision', requireSuperRole('Super Admin'), async (req, res) => {
	const parsed = provisionSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid user payload.' });
	const state = await loadIdentityState();
	try {
		const result = await provisionUser(state, parsed.data);
		return res.status(201).json(result);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Provisioning failed.' });
	}
});

app.patch('/api/super/users/:userId', requireSuperRole('Super Admin'), async (req, res) => {
	const userId = String(req.params.userId || '').trim();
	if (!userId) return res.status(400).json({ error: 'userId is required.' });
	const parsed = updateUserSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid user update payload.' });
	const state = await loadIdentityState();
	try {
		const result = await updateIdentityUser(state, {
			userId,
			name: parsed.data.name,
			email: parsed.data.email === '' ? null : parsed.data.email,
			phone: parsed.data.phone === '' ? null : parsed.data.phone,
			password: parsed.data.password || undefined,
			roles: parsed.data.roles,
			activeRole: parsed.data.activeRole,
			category: parsed.data.category,
			status: parsed.data.status,
			schoolId: parsed.data.schoolId,
			auditActorId: (req as any).superUser?.id,
			auditActorName: (req as any).superUser?.name || (req as any).superUser?.email || (req as any).superUser?.id,
			auditActorRole: (req as any).superUser?.role || 'Super Admin',
		});
		return res.json(result);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'User update failed.' });
	}
});

app.post('/api/super/students/:studentId/transfer', requireSuperRole('Super Admin'), async (req, res) => {
	const parsed = transferSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid transfer payload.' });
	const studentId = String(req.params.studentId || '').trim();
	try {
		const state = await loadIdentityState();
		const result = await transferStudent(state, studentId, parsed.data.targetSchoolId, parsed.data.reason, (req as any).superUser?.id);
		return res.json(result);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Transfer failed.' });
	}
});

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
	if (err?.code === 'EBADCSRFTOKEN') {
		return res.status(403).json({ error: 'Invalid CSRF token' });
	}
	return next(err);
});

const server = app.listen(port, () => console.log(`Ndovera super-admin server running on port ${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		console.log(`Received ${signal}, shutting down ndovera-super-admin-server`);
		Promise.resolve(documentPgPool?.end())
			.finally(() => {
				if (documentSqlite) documentSqlite.close();
				server.close(() => process.exit(0));
			});
		setTimeout(() => process.exit(1), 10000).unref();
	});
}