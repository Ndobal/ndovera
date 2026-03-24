import crypto from 'crypto';
import path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';

export type ChampionshipFlagName =
	| 'championship_enabled'
	| 'hosted_exams_enabled'
	| 'spelling_bee_enabled'
	| 'essay_ai_enabled'
	| 'proctoring_enabled'
	| 'live_mode_enabled'
	| 'ads_enabled'
	| 'global_competitions';

export type CompetitionType = 'quiz' | 'spelling' | 'essay' | 'math' | 'live' | 'exam';
export type CompetitionScope = 'school' | 'global' | 'hosted';
export type CompetitionMode = 'single' | 'stage';
export type CompetitionStatus = 'draft' | 'scheduled' | 'active' | 'completed';
export type ParticipantStatus = 'joined' | 'in_progress' | 'submitted';

export type FeatureFlag = { name: ChampionshipFlagName; enabled: boolean };
export type CompetitionQuestion = {
	id: string;
	competitionId: string;
	type: string;
	prompt: string;
	options: string[];
	correctAnswer: string;
	explanation?: string | null;
	extraData?: Record<string, unknown> | null;
	points: number;
	position: number;
};
export type CompetitionRecord = {
	id: string;
	schoolId?: string | null;
	title: string;
	description?: string | null;
	type: CompetitionType;
	scope: CompetitionScope;
	mode: CompetitionMode;
	entryFee: number;
	status: CompetitionStatus;
	startTime?: string | null;
	endTime?: string | null;
	hostOrganization?: string | null;
	hostedByNdovera: boolean;
	isLive: boolean;
	liveRoomUrl?: string | null;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	questionCount?: number;
	participantCount?: number;
	joined?: boolean;
	participantStatus?: ParticipantStatus | null;
	currentScore?: number;
	rank?: number | null;
};
export type ParticipantRecord = {
	id: string;
	competitionId: string;
	userId: string;
	schoolId?: string | null;
	score: number;
	status: ParticipantStatus;
	joinedAt: string;
	submittedAt?: string | null;
	totalTimeTaken: number;
	violationCount: number;
};
export type SubmissionRecord = {
	id: string;
	participantId: string;
	questionId: string;
	answer: string;
	isCorrect: boolean;
	timeTaken: number;
	submittedAt: string;
};
export type LeaderboardEntry = {
	competitionId: string;
	userId: string;
	score: number;
	timeTaken: number;
	rank: number;
	name?: string | null;
};
export type CompetitionDetail = {
	competition: CompetitionRecord;
	questions: Array<Omit<CompetitionQuestion, 'correctAnswer'> & { answered?: boolean; submittedAnswer?: string | null; isCorrect?: boolean | null; correctAnswer?: string }>;
	participant: ParticipantRecord | null;
	leaderboard: LeaderboardEntry[];
	featureFlags: FeatureFlag[];
	stats: { questionCount: number; participantCount: number; submittedCount: number; violationCount: number };
};
export type CreateCompetitionInput = {
	schoolId?: string | null;
	title: string;
	description?: string | null;
	type: CompetitionType;
	scope: CompetitionScope;
	mode: CompetitionMode;
	entryFee?: number;
	status?: CompetitionStatus;
	startTime?: string | null;
	endTime?: string | null;
	hostOrganization?: string | null;
	hostedByNdovera?: boolean;
	isLive?: boolean;
	liveRoomUrl?: string | null;
	createdBy: string;
	questions: Array<{
		type: string;
		prompt: string;
		options?: string[];
		correctAnswer: string;
		explanation?: string | null;
		extraData?: Record<string, unknown> | null;
		points?: number;
	}>;
};

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

function resolveRuntimePath(envValue: string | undefined, fallbackPath: string) {
	const trimmed = (envValue || '').trim();
	return trimmed ? path.resolve(trimmed) : path.join(REPO_ROOT, fallbackPath);
}

const SQLITE_PATH = resolveRuntimePath(process.env.NDOVERA_CHAMPIONSHIP_DB_PATH, 'ndovera-championship.db');
const sqlite = DATABASE_URL ? null : new Database(SQLITE_PATH);
const pgPool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' || process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined }) : null;
const defaultFlags: FeatureFlag[] = [
	{ name: 'championship_enabled', enabled: true },
	{ name: 'hosted_exams_enabled', enabled: true },
	{ name: 'spelling_bee_enabled', enabled: true },
	{ name: 'essay_ai_enabled', enabled: false },
	{ name: 'proctoring_enabled', enabled: false },
	{ name: 'live_mode_enabled', enabled: false },
	{ name: 'ads_enabled', enabled: true },
	{ name: 'global_competitions', enabled: true },
];
let schemaPromise: Promise<void> | null = null;

function nowIso() { return new Date().toISOString(); }
function asJson(value: unknown) { return JSON.stringify(value ?? null); }
function parseJsonObject(value: unknown) { if (!value || typeof value !== 'string') return null; try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null; } catch { return null; } }
function parseJsonArray(value: unknown) { if (!value || typeof value !== 'string') return []; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }

function rowToFlag(row: any): FeatureFlag { return { name: String(row.name) as ChampionshipFlagName, enabled: Boolean(row.enabled) }; }
function rowToCompetition(row: any): CompetitionRecord {
	return {
		id: String(row.id), schoolId: row.school_id ? String(row.school_id) : null, title: String(row.title), description: row.description ? String(row.description) : null,
		type: String(row.type) as CompetitionType, scope: String(row.scope) as CompetitionScope, mode: String(row.mode) as CompetitionMode, entryFee: Number(row.entry_fee || 0),
		status: String(row.status) as CompetitionStatus, startTime: row.start_time ? String(row.start_time) : null, endTime: row.end_time ? String(row.end_time) : null,
		hostOrganization: row.host_organization ? String(row.host_organization) : null, hostedByNdovera: Boolean(row.hosted_by_ndovera), isLive: Boolean(row.is_live), liveRoomUrl: row.live_room_url ? String(row.live_room_url) : null, createdBy: String(row.created_by), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
		questionCount: row.question_count != null ? Number(row.question_count) : undefined, participantCount: row.participant_count != null ? Number(row.participant_count) : undefined,
		joined: row.joined != null ? Boolean(row.joined) : undefined, participantStatus: row.participant_status ? String(row.participant_status) as ParticipantStatus : null,
		currentScore: row.current_score != null ? Number(row.current_score) : undefined, rank: row.rank != null ? Number(row.rank) : null,
	};
}
function rowToQuestion(row: any): CompetitionQuestion {
	return { id: String(row.id), competitionId: String(row.competition_id), type: String(row.type), prompt: String(row.prompt), options: parseJsonArray(row.options_json), correctAnswer: String(row.correct_answer), explanation: row.explanation ? String(row.explanation) : null, extraData: parseJsonObject(row.extra_data_json), points: Number(row.points || 1), position: Number(row.position || 0) };
}
function rowToParticipant(row: any): ParticipantRecord {
	return { id: String(row.id), competitionId: String(row.competition_id), userId: String(row.user_id), schoolId: row.school_id ? String(row.school_id) : null, score: Number(row.score || 0), status: String(row.status) as ParticipantStatus, joinedAt: String(row.joined_at), submittedAt: row.submitted_at ? String(row.submitted_at) : null, totalTimeTaken: Number(row.total_time_taken || 0), violationCount: Number(row.violation_count || 0) };
}
function rowToSubmission(row: any): SubmissionRecord {
	return { id: String(row.id), participantId: String(row.participant_id), questionId: String(row.question_id), answer: String(row.answer || ''), isCorrect: Boolean(row.is_correct), timeTaken: Number(row.time_taken || 0), submittedAt: String(row.submitted_at) };
}
function rowToLeaderboard(row: any): LeaderboardEntry {
	return { competitionId: String(row.competition_id), userId: String(row.user_id), score: Number(row.score || 0), timeTaken: Number(row.time_taken || 0), rank: Number(row.rank || 0), name: row.name ? String(row.name) : null };
}

async function readFeatureFlagsRaw() {
	if (pgPool) return (await pgPool.query('SELECT name, enabled FROM championship_feature_flags ORDER BY name ASC')).rows.map(rowToFlag);
	return sqlite ? (sqlite.prepare('SELECT name, enabled FROM championship_feature_flags ORDER BY name ASC').all() as any[]).map(rowToFlag) : [];
}

async function writeFeatureFlagRaw(name: ChampionshipFlagName, enabled: boolean) {
	if (pgPool) {
		await pgPool.query('INSERT INTO championship_feature_flags (name, enabled) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET enabled = EXCLUDED.enabled', [name, enabled]);
		return;
	}
	sqlite?.prepare('INSERT INTO championship_feature_flags (name, enabled) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled').run(name, enabled ? 1 : 0);
}

async function ensureSchema() {
	if (schemaPromise) return schemaPromise;
	schemaPromise = (async () => {
		if (pgPool) {
			await pgPool.query(`CREATE TABLE IF NOT EXISTS championship_feature_flags (name TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT TRUE)`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS championship_competitions (id TEXT PRIMARY KEY, school_id TEXT, title TEXT NOT NULL, description TEXT, type TEXT NOT NULL, scope TEXT NOT NULL, mode TEXT NOT NULL, entry_fee NUMERIC NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', start_time TEXT, end_time TEXT, host_organization TEXT, hosted_by_ndovera BOOLEAN NOT NULL DEFAULT FALSE, is_live BOOLEAN NOT NULL DEFAULT FALSE, live_room_url TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
			await pgPool.query(`ALTER TABLE championship_competitions ADD COLUMN IF NOT EXISTS host_organization TEXT`);
			await pgPool.query(`ALTER TABLE championship_competitions ADD COLUMN IF NOT EXISTS hosted_by_ndovera BOOLEAN NOT NULL DEFAULT FALSE`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS championship_questions (id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES championship_competitions(id) ON DELETE CASCADE, type TEXT NOT NULL, prompt TEXT NOT NULL, options_json TEXT NOT NULL, correct_answer TEXT NOT NULL, explanation TEXT, extra_data_json TEXT, points INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL DEFAULT 0)`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS championship_participants (id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES championship_competitions(id) ON DELETE CASCADE, user_id TEXT NOT NULL, school_id TEXT, score INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'joined', joined_at TEXT NOT NULL, submitted_at TEXT, total_time_taken INTEGER NOT NULL DEFAULT 0, violation_count INTEGER NOT NULL DEFAULT 0, UNIQUE (competition_id, user_id))`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS championship_submissions (id TEXT PRIMARY KEY, participant_id TEXT NOT NULL REFERENCES championship_participants(id) ON DELETE CASCADE, question_id TEXT NOT NULL REFERENCES championship_questions(id) ON DELETE CASCADE, answer TEXT NOT NULL, is_correct BOOLEAN NOT NULL DEFAULT FALSE, time_taken INTEGER NOT NULL DEFAULT 0, submitted_at TEXT NOT NULL, UNIQUE (participant_id, question_id))`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS championship_violations_log (id TEXT PRIMARY KEY, participant_id TEXT NOT NULL REFERENCES championship_participants(id) ON DELETE CASCADE, type TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL)`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS championship_leaderboard (competition_id TEXT NOT NULL REFERENCES championship_competitions(id) ON DELETE CASCADE, user_id TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, time_taken INTEGER NOT NULL DEFAULT 0, rank INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (competition_id, user_id))`);
		} else if (sqlite) {
			sqlite.pragma('journal_mode = WAL'); sqlite.pragma('foreign_keys = ON');
			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS championship_feature_flags (name TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1);
				CREATE TABLE IF NOT EXISTS championship_competitions (id TEXT PRIMARY KEY, school_id TEXT, title TEXT NOT NULL, description TEXT, type TEXT NOT NULL, scope TEXT NOT NULL, mode TEXT NOT NULL, entry_fee REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', start_time TEXT, end_time TEXT, host_organization TEXT, hosted_by_ndovera INTEGER NOT NULL DEFAULT 0, is_live INTEGER NOT NULL DEFAULT 0, live_room_url TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
				CREATE TABLE IF NOT EXISTS championship_questions (id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES championship_competitions(id) ON DELETE CASCADE, type TEXT NOT NULL, prompt TEXT NOT NULL, options_json TEXT NOT NULL, correct_answer TEXT NOT NULL, explanation TEXT, extra_data_json TEXT, points INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL DEFAULT 0);
				CREATE TABLE IF NOT EXISTS championship_participants (id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES championship_competitions(id) ON DELETE CASCADE, user_id TEXT NOT NULL, school_id TEXT, score INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'joined', joined_at TEXT NOT NULL, submitted_at TEXT, total_time_taken INTEGER NOT NULL DEFAULT 0, violation_count INTEGER NOT NULL DEFAULT 0, UNIQUE (competition_id, user_id));
				CREATE TABLE IF NOT EXISTS championship_submissions (id TEXT PRIMARY KEY, participant_id TEXT NOT NULL REFERENCES championship_participants(id) ON DELETE CASCADE, question_id TEXT NOT NULL REFERENCES championship_questions(id) ON DELETE CASCADE, answer TEXT NOT NULL, is_correct INTEGER NOT NULL DEFAULT 0, time_taken INTEGER NOT NULL DEFAULT 0, submitted_at TEXT NOT NULL, UNIQUE (participant_id, question_id));
				CREATE TABLE IF NOT EXISTS championship_violations_log (id TEXT PRIMARY KEY, participant_id TEXT NOT NULL REFERENCES championship_participants(id) ON DELETE CASCADE, type TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL);
				CREATE TABLE IF NOT EXISTS championship_leaderboard (competition_id TEXT NOT NULL REFERENCES championship_competitions(id) ON DELETE CASCADE, user_id TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, time_taken INTEGER NOT NULL DEFAULT 0, rank INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (competition_id, user_id));
			`);
			const competitionColumns = (sqlite.prepare('PRAGMA table_info(championship_competitions)').all() as Array<{ name: string }>).map((column) => column.name);
			if (!competitionColumns.includes('host_organization')) sqlite.exec('ALTER TABLE championship_competitions ADD COLUMN host_organization TEXT');
			if (!competitionColumns.includes('hosted_by_ndovera')) sqlite.exec('ALTER TABLE championship_competitions ADD COLUMN hosted_by_ndovera INTEGER NOT NULL DEFAULT 0');
		}
		const existing = await readFeatureFlagsRaw();
		if (!existing.length) {
			for (const flag of defaultFlags) await writeFeatureFlagRaw(flag.name, flag.enabled);
		}
	})();
	return schemaPromise;
}

async function rebuildLeaderboard(competitionId: string) {
	await ensureSchema();
	if (pgPool) {
		const client = await pgPool.connect();
		try {
			await client.query('BEGIN');
			const participants = await client.query('SELECT competition_id, user_id, score, total_time_taken, joined_at FROM championship_participants WHERE competition_id = $1 ORDER BY score DESC, total_time_taken ASC, joined_at ASC', [competitionId]);
			await client.query('DELETE FROM championship_leaderboard WHERE competition_id = $1', [competitionId]);
			for (const [index, row] of participants.rows.entries()) await client.query('INSERT INTO championship_leaderboard (competition_id, user_id, score, time_taken, rank) VALUES ($1, $2, $3, $4, $5)', [competitionId, row.user_id, Number(row.score || 0), Number(row.total_time_taken || 0), index + 1]);
			await client.query('COMMIT');
		} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
		return;
	}
	if (!sqlite) return;
		sqlite.transaction(() => {
			const participants = sqlite.prepare('SELECT competition_id, user_id, score, total_time_taken, joined_at FROM championship_participants WHERE competition_id = ? ORDER BY score DESC, total_time_taken ASC, joined_at ASC').all(competitionId) as any[];
			sqlite.prepare('DELETE FROM championship_leaderboard WHERE competition_id = ?').run(competitionId);
			const insert = sqlite.prepare('INSERT INTO championship_leaderboard (competition_id, user_id, score, time_taken, rank) VALUES (?, ?, ?, ?, ?)');
			participants.forEach((row, index) => insert.run(competitionId, row.user_id, Number(row.score || 0), Number(row.total_time_taken || 0), index + 1));
		})();
}

export async function listFeatureFlags() {
	await ensureSchema();
	return readFeatureFlagsRaw();
}

export async function setFeatureFlag(name: ChampionshipFlagName, enabled: boolean) {
	await ensureSchema();
	await writeFeatureFlagRaw(name, enabled);
	return { name, enabled };
}

export async function createCompetition(input: CreateCompetitionInput) {
	await ensureSchema();
	const now = nowIso();
	const competitionId = crypto.randomUUID();
	const competition: CompetitionRecord = { id: competitionId, schoolId: input.scope === 'school' ? input.schoolId || null : null, title: input.title.trim(), description: input.description?.trim() || null, type: input.type, scope: input.scope, mode: input.mode, entryFee: Number(input.entryFee || 0), status: input.status || 'scheduled', startTime: input.startTime || null, endTime: input.endTime || null, hostOrganization: input.hostOrganization?.trim() || null, hostedByNdovera: Boolean(input.hostedByNdovera || input.scope === 'hosted'), isLive: Boolean(input.isLive), liveRoomUrl: input.liveRoomUrl?.trim() || null, createdBy: input.createdBy, createdAt: now, updatedAt: now };
	const questions = input.questions.map((question, index) => ({ id: crypto.randomUUID(), competitionId, type: question.type || input.type, prompt: question.prompt.trim(), options: question.options || [], correctAnswer: question.correctAnswer.trim(), explanation: question.explanation?.trim() || null, extraData: question.extraData || null, points: Number(question.points || 1), position: index + 1 }));
	if (pgPool) {
		const client = await pgPool.connect();
		try {
			await client.query('BEGIN');
			await client.query('INSERT INTO championship_competitions (id, school_id, title, description, type, scope, mode, entry_fee, status, start_time, end_time, host_organization, hosted_by_ndovera, is_live, live_room_url, created_by, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)', [competition.id, competition.schoolId, competition.title, competition.description, competition.type, competition.scope, competition.mode, competition.entryFee, competition.status, competition.startTime, competition.endTime, competition.hostOrganization, competition.hostedByNdovera, competition.isLive, competition.liveRoomUrl, competition.createdBy, competition.createdAt, competition.updatedAt]);
			for (const question of questions) await client.query('INSERT INTO championship_questions (id, competition_id, type, prompt, options_json, correct_answer, explanation, extra_data_json, points, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [question.id, question.competitionId, question.type, question.prompt, asJson(question.options), question.correctAnswer, question.explanation, asJson(question.extraData), question.points, question.position]);
			await client.query('COMMIT');
		} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
	} else if (sqlite) {
		sqlite.transaction(() => {
			sqlite.prepare('INSERT INTO championship_competitions (id, school_id, title, description, type, scope, mode, entry_fee, status, start_time, end_time, host_organization, hosted_by_ndovera, is_live, live_room_url, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(competition.id, competition.schoolId, competition.title, competition.description, competition.type, competition.scope, competition.mode, competition.entryFee, competition.status, competition.startTime, competition.endTime, competition.hostOrganization, competition.hostedByNdovera ? 1 : 0, competition.isLive ? 1 : 0, competition.liveRoomUrl, competition.createdBy, competition.createdAt, competition.updatedAt);
			const insert = sqlite.prepare('INSERT INTO championship_questions (id, competition_id, type, prompt, options_json, correct_answer, explanation, extra_data_json, points, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
			questions.forEach((question) => insert.run(question.id, question.competitionId, question.type, question.prompt, asJson(question.options), question.correctAnswer, question.explanation, asJson(question.extraData), question.points, question.position));
		})();
	}
	return { competition, questions };
}

export async function listCompetitions(params: { schoolId?: string | null; userId?: string | null; includeGlobal?: boolean }) {
	await ensureSchema();
	const includeGlobal = params.includeGlobal ?? true;
	const competitionRows = pgPool
		? (await pgPool.query('SELECT c.*, (SELECT COUNT(*) FROM championship_questions q WHERE q.competition_id = c.id) AS question_count, (SELECT COUNT(*) FROM championship_participants p WHERE p.competition_id = c.id) AS participant_count FROM championship_competitions c ORDER BY c.created_at DESC')).rows
		: ((sqlite?.prepare('SELECT c.*, (SELECT COUNT(*) FROM championship_questions q WHERE q.competition_id = c.id) AS question_count, (SELECT COUNT(*) FROM championship_participants p WHERE p.competition_id = c.id) AS participant_count FROM championship_competitions c ORDER BY c.created_at DESC').all() as any[]) || []);
	const participantRows = params.userId ? (pgPool ? (await pgPool.query('SELECT * FROM championship_participants WHERE user_id = $1', [params.userId])).rows : (sqlite?.prepare('SELECT * FROM championship_participants WHERE user_id = ?').all(params.userId) as any[] || [])) : [];
	const leaderboardRows = params.userId ? (pgPool ? (await pgPool.query('SELECT * FROM championship_leaderboard WHERE user_id = $1', [params.userId])).rows : (sqlite?.prepare('SELECT * FROM championship_leaderboard WHERE user_id = ?').all(params.userId) as any[] || [])) : [];
	const participantByCompetition = new Map(participantRows.map((row: any) => [String(row.competition_id), row]));
	const rankByCompetition = new Map(leaderboardRows.map((row: any) => [String(row.competition_id), Number(row.rank || 0)]));
	return (competitionRows.map(rowToCompetition) as CompetitionRecord[]).filter((competition) => {
		if (competition.scope === 'global') return includeGlobal;
		if (competition.scope === 'hosted') return includeGlobal;
		return !params.schoolId || competition.schoolId === params.schoolId;
	}).map((competition) => {
		const participant = participantByCompetition.get(competition.id) as any;
		return { ...competition, joined: Boolean(participant), participantStatus: participant?.status || null, currentScore: participant ? Number(participant.score || 0) : undefined, rank: rankByCompetition.get(competition.id) ?? null };
	});
}

export async function joinCompetition(input: { competitionId: string; userId: string; schoolId?: string | null }) {
	const flags = await listFeatureFlags();
	if (!flags.find((flag) => flag.name === 'championship_enabled')?.enabled) throw new Error('Championships are currently disabled.');
	const competitions = await listCompetitions({ schoolId: input.schoolId, userId: input.userId, includeGlobal: true });
	const competition = competitions.find((entry: CompetitionRecord) => entry.id === input.competitionId);
	if (!competition) throw new Error('Competition not found.');
	if (competition.scope === 'school' && competition.schoolId && input.schoolId && competition.schoolId !== input.schoolId) throw new Error('Competition is not available for your school.');
	if (competition.type === 'exam' && !flags.find((flag) => flag.name === 'hosted_exams_enabled')?.enabled) throw new Error('Hosted exams are currently disabled.');
	if (competition.joined) return getCompetitionDetail({ competitionId: input.competitionId, viewerUserId: input.userId, schoolId: input.schoolId, includeAnswers: false });
	await ensureSchema();
	const participant: ParticipantRecord = { id: crypto.randomUUID(), competitionId: input.competitionId, userId: input.userId, schoolId: input.schoolId || null, score: 0, status: 'joined', joinedAt: nowIso(), submittedAt: null, totalTimeTaken: 0, violationCount: 0 };
	if (pgPool) await pgPool.query('INSERT INTO championship_participants (id, competition_id, user_id, school_id, score, status, joined_at, submitted_at, total_time_taken, violation_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (competition_id, user_id) DO NOTHING', [participant.id, participant.competitionId, participant.userId, participant.schoolId, participant.score, participant.status, participant.joinedAt, participant.submittedAt, participant.totalTimeTaken, participant.violationCount]);
	else sqlite?.prepare('INSERT INTO championship_participants (id, competition_id, user_id, school_id, score, status, joined_at, submitted_at, total_time_taken, violation_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(competition_id, user_id) DO NOTHING').run(participant.id, participant.competitionId, participant.userId, participant.schoolId, participant.score, participant.status, participant.joinedAt, participant.submittedAt, participant.totalTimeTaken, participant.violationCount);
	await rebuildLeaderboard(input.competitionId);
	return getCompetitionDetail({ competitionId: input.competitionId, viewerUserId: input.userId, schoolId: input.schoolId, includeAnswers: false });
}

export async function submitCompetitionAnswer(input: { competitionId: string; userId: string; questionId: string; answer: string; timeTaken?: number; schoolId?: string | null }) {
	await ensureSchema();
	const participantRow = pgPool ? (await pgPool.query('SELECT * FROM championship_participants WHERE competition_id = $1 AND user_id = $2', [input.competitionId, input.userId])).rows[0] : sqlite?.prepare('SELECT * FROM championship_participants WHERE competition_id = ? AND user_id = ?').get(input.competitionId, input.userId);
	if (!participantRow) throw new Error('Join the competition before submitting answers.');
	const questionRow = pgPool ? (await pgPool.query('SELECT * FROM championship_questions WHERE id = $1 AND competition_id = $2', [input.questionId, input.competitionId])).rows[0] : sqlite?.prepare('SELECT * FROM championship_questions WHERE id = ? AND competition_id = ?').get(input.questionId, input.competitionId);
	if (!questionRow) throw new Error('Question not found.');
	const participant = rowToParticipant(participantRow);
	const question = rowToQuestion(questionRow);
	const isCorrect = input.answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
	const submittedAt = nowIso();
	if (pgPool) {
		const client = await pgPool.connect();
		try {
			await client.query('BEGIN');
			await client.query('INSERT INTO championship_submissions (id, participant_id, question_id, answer, is_correct, time_taken, submitted_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (participant_id, question_id) DO UPDATE SET answer = EXCLUDED.answer, is_correct = EXCLUDED.is_correct, time_taken = EXCLUDED.time_taken, submitted_at = EXCLUDED.submitted_at', [crypto.randomUUID(), participant.id, question.id, input.answer.trim(), isCorrect, Number(input.timeTaken || 0), submittedAt]);
			const metrics = await client.query('SELECT COALESCE(SUM(CASE WHEN s.is_correct THEN q.points ELSE 0 END), 0) AS score, COALESCE(SUM(s.time_taken), 0) AS total_time, COUNT(*) AS answered FROM championship_submissions s JOIN championship_questions q ON q.id = s.question_id WHERE s.participant_id = $1', [participant.id]);
			const totalQuestions = await client.query('SELECT COUNT(*) AS total FROM championship_questions WHERE competition_id = $1', [input.competitionId]);
			const answered = Number(metrics.rows[0]?.answered || 0);
			const total = Number(totalQuestions.rows[0]?.total || 0);
			const status: ParticipantStatus = answered >= total && total > 0 ? 'submitted' : 'in_progress';
			await client.query('UPDATE championship_participants SET score = $1, total_time_taken = $2, status = $3, submitted_at = $4 WHERE id = $5', [Number(metrics.rows[0]?.score || 0), Number(metrics.rows[0]?.total_time || 0), status, status === 'submitted' ? submittedAt : null, participant.id]);
			await client.query('COMMIT');
		} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
	} else if (sqlite) {
		sqlite.transaction(() => {
			sqlite.prepare('INSERT INTO championship_submissions (id, participant_id, question_id, answer, is_correct, time_taken, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(participant_id, question_id) DO UPDATE SET answer = excluded.answer, is_correct = excluded.is_correct, time_taken = excluded.time_taken, submitted_at = excluded.submitted_at').run(crypto.randomUUID(), participant.id, question.id, input.answer.trim(), isCorrect ? 1 : 0, Number(input.timeTaken || 0), submittedAt);
			const metrics = sqlite.prepare('SELECT COALESCE(SUM(CASE WHEN s.is_correct = 1 THEN q.points ELSE 0 END), 0) AS score, COALESCE(SUM(s.time_taken), 0) AS total_time, COUNT(*) AS answered FROM championship_submissions s JOIN championship_questions q ON q.id = s.question_id WHERE s.participant_id = ?').get(participant.id) as any;
			const total = Number((sqlite.prepare('SELECT COUNT(*) AS total FROM championship_questions WHERE competition_id = ?').get(input.competitionId) as any)?.total || 0);
			const answered = Number(metrics?.answered || 0);
			const status: ParticipantStatus = answered >= total && total > 0 ? 'submitted' : 'in_progress';
			sqlite.prepare('UPDATE championship_participants SET score = ?, total_time_taken = ?, status = ?, submitted_at = ? WHERE id = ?').run(Number(metrics?.score || 0), Number(metrics?.total_time || 0), status, status === 'submitted' ? submittedAt : null, participant.id);
		})();
	}
	await rebuildLeaderboard(input.competitionId);
	return getCompetitionDetail({ competitionId: input.competitionId, viewerUserId: input.userId, schoolId: input.schoolId, includeAnswers: false });
}

export async function recordViolation(input: { competitionId: string; userId: string; type: string; schoolId?: string | null; metadata?: Record<string, unknown> | null }) {
	await ensureSchema();
	const participantRow = pgPool ? (await pgPool.query('SELECT * FROM championship_participants WHERE competition_id = $1 AND user_id = $2', [input.competitionId, input.userId])).rows[0] : sqlite?.prepare('SELECT * FROM championship_participants WHERE competition_id = ? AND user_id = ?').get(input.competitionId, input.userId);
	if (!participantRow) throw new Error('Participant not found.');
	const participant = rowToParticipant(participantRow);
	const violationId = crypto.randomUUID();
	if (pgPool) {
		await pgPool.query('INSERT INTO championship_violations_log (id, participant_id, type, metadata_json, created_at) VALUES ($1, $2, $3, $4, $5)', [violationId, participant.id, input.type.trim(), asJson(input.metadata), nowIso()]);
		await pgPool.query('UPDATE championship_participants SET violation_count = violation_count + 1 WHERE id = $1', [participant.id]);
	} else {
		sqlite?.transaction(() => {
			sqlite.prepare('INSERT INTO championship_violations_log (id, participant_id, type, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)').run(violationId, participant.id, input.type.trim(), asJson(input.metadata), nowIso());
			sqlite.prepare('UPDATE championship_participants SET violation_count = violation_count + 1 WHERE id = ?').run(participant.id);
		})();
	}
	return getCompetitionDetail({ competitionId: input.competitionId, viewerUserId: input.userId, schoolId: input.schoolId, includeAnswers: false });
}

export async function getCompetitionDetail(params: { competitionId: string; viewerUserId?: string | null; schoolId?: string | null; includeAnswers?: boolean }) {
	await ensureSchema();
	const competitionRow = pgPool ? (await pgPool.query('SELECT c.*, (SELECT COUNT(*) FROM championship_questions q WHERE q.competition_id = c.id) AS question_count, (SELECT COUNT(*) FROM championship_participants p WHERE p.competition_id = c.id) AS participant_count FROM championship_competitions c WHERE c.id = $1', [params.competitionId])).rows[0] : sqlite?.prepare('SELECT c.*, (SELECT COUNT(*) FROM championship_questions q WHERE q.competition_id = c.id) AS question_count, (SELECT COUNT(*) FROM championship_participants p WHERE p.competition_id = c.id) AS participant_count FROM championship_competitions c WHERE c.id = ?').get(params.competitionId);
	if (!competitionRow) throw new Error('Competition not found.');
	const competition = rowToCompetition(competitionRow);
	if (competition.scope === 'school' && competition.schoolId && params.schoolId && competition.schoolId !== params.schoolId) throw new Error('Competition is not available for this school.');
	const questionRows = pgPool ? (await pgPool.query('SELECT * FROM championship_questions WHERE competition_id = $1 ORDER BY position ASC', [params.competitionId])).rows : (sqlite?.prepare('SELECT * FROM championship_questions WHERE competition_id = ? ORDER BY position ASC').all(params.competitionId) as any[] || []);
	const participantRow = params.viewerUserId ? (pgPool ? (await pgPool.query('SELECT * FROM championship_participants WHERE competition_id = $1 AND user_id = $2', [params.competitionId, params.viewerUserId])).rows[0] : sqlite?.prepare('SELECT * FROM championship_participants WHERE competition_id = ? AND user_id = ?').get(params.competitionId, params.viewerUserId)) : null;
	const submissionRows = participantRow ? (pgPool ? (await pgPool.query('SELECT * FROM championship_submissions WHERE participant_id = $1', [participantRow.id])).rows : (sqlite?.prepare('SELECT * FROM championship_submissions WHERE participant_id = ?').all(participantRow.id) as any[] || [])) : [];
	const leaderboardRows = pgPool
		? (await pgPool.query('SELECT l.*, u.name FROM championship_leaderboard l LEFT JOIN users u ON u.id = l.user_id WHERE l.competition_id = $1 ORDER BY l.rank ASC LIMIT 10', [params.competitionId])).rows
		: (sqlite?.prepare('SELECT l.*, u.name FROM championship_leaderboard l LEFT JOIN users u ON u.id = l.user_id WHERE l.competition_id = ? ORDER BY l.rank ASC LIMIT 10').all(params.competitionId) as any[] || []);
	const violationCount = pgPool ? Number((await pgPool.query('SELECT COUNT(*) AS total FROM championship_violations_log v JOIN championship_participants p ON p.id = v.participant_id WHERE p.competition_id = $1', [params.competitionId])).rows[0]?.total || 0) : Number((sqlite?.prepare('SELECT COUNT(*) AS total FROM championship_violations_log v JOIN championship_participants p ON p.id = v.participant_id WHERE p.competition_id = ?').get(params.competitionId) as any)?.total || 0);
	const submissionsByQuestion = new Map(submissionRows.map((row: any) => { const submission = rowToSubmission(row); return [submission.questionId, submission]; }));
	const questions = (questionRows.map(rowToQuestion) as CompetitionQuestion[]).map((question) => {
		const submission = submissionsByQuestion.get(question.id) as SubmissionRecord | undefined;
		return { id: question.id, competitionId: question.competitionId, type: question.type, prompt: question.prompt, options: question.options, explanation: question.explanation, extraData: question.extraData, points: question.points, position: question.position, answered: Boolean(submission), submittedAnswer: submission?.answer || null, isCorrect: submission ? submission.isCorrect : null, ...(params.includeAnswers ? { correctAnswer: question.correctAnswer } : {}) };
	});
	const participant = participantRow ? rowToParticipant(participantRow) : null;
	const featureFlags = await listFeatureFlags();
	return { competition, questions, participant, leaderboard: leaderboardRows.map(rowToLeaderboard), featureFlags, stats: { questionCount: questionRows.length, participantCount: Number(competition.participantCount || 0), submittedCount: participant && participant.status === 'submitted' ? 1 : 0, violationCount } } as CompetitionDetail;
}