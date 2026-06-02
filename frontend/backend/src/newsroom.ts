function normalizeKeyPart(value: unknown) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '') || 'news'
}

function sanitizeText(value: unknown, maxLength = 10000) {
	return String(value || '').trim().slice(0, maxLength)
}

function normalizeNewsStatus(value: unknown, fallback = 'draft') {
	const normalized = String(value || '').trim().toLowerCase()
	if (['draft', 'submitted', 'changes_requested', 'reviewed', 'published'].includes(normalized)) {
		return normalized
	}
	return fallback
}

function buildNewsPostId(tenantId: string, title: string) {
	return `news_${normalizeKeyPart(tenantId)}_${normalizeKeyPart(title).slice(0, 32)}_${Date.now()}`
}

const VALID_AUDIENCE_CHANNELS = ['parents', 'staff', 'students', 'website']

export function normalizeAudience(value: unknown): string[] {
	let list: unknown[] = []
	if (Array.isArray(value)) {
		list = value
	} else if (typeof value === 'string') {
		const trimmed = value.trim()
		if (trimmed) {
			try {
				const parsed = JSON.parse(trimmed)
				list = Array.isArray(parsed) ? parsed : [trimmed]
			} catch {
				list = trimmed.split(',')
			}
		}
	}
	const normalized = list
		.map(item => String(item || '').trim().toLowerCase())
		.flatMap(item => (item === 'everyone' ? ['parents', 'staff', 'students'] : [item]))
		.filter(item => VALID_AUDIENCE_CHANNELS.includes(item))
	return Array.from(new Set(normalized))
}

// A post with no audience set is legacy data — treat it as visible everywhere.
export function postMatchesChannel(audience: string[] | undefined | null, channel: string) {
	if (!audience || audience.length === 0) return true
	return audience.includes(channel)
}

function mapNewsPostRow(row: Record<string, any>) {
	return {
		id: String(row.id || ''),
		tenantId: String(row.tenant_id || ''),
		title: String(row.title || ''),
		excerpt: String(row.excerpt || ''),
		content: String(row.content || ''),
		coverUrl: String(row.cover_url || ''),
		audience: normalizeAudience(row.audience),
		status: normalizeNewsStatus(row.status, 'draft'),
		authorId: String(row.author_id || ''),
		authorName: String(row.author_name || ''),
		authorRole: String(row.author_role || ''),
		reviewNotes: String(row.review_notes || ''),
		reviewedBy: String(row.reviewed_by || ''),
		reviewedByName: String(row.reviewed_by_name || ''),
		reviewedAt: String(row.reviewed_at || ''),
		publishedBy: String(row.published_by || ''),
		publishedByName: String(row.published_by_name || ''),
		publishedAt: String(row.published_at || ''),
		createdAt: String(row.created_at || ''),
		updatedAt: String(row.updated_at || ''),
	}
}

const SCHOOL_NEWSROOM_DDL = `CREATE TABLE IF NOT EXISTS school_news_posts (
	id TEXT PRIMARY KEY,
	tenant_id TEXT NOT NULL,
	title TEXT NOT NULL,
	excerpt TEXT,
	content TEXT NOT NULL,
	cover_url TEXT,
	audience TEXT,
	status TEXT NOT NULL,
	author_id TEXT NOT NULL,
	author_name TEXT,
	author_role TEXT,
	review_notes TEXT,
	reviewed_by TEXT,
	reviewed_by_name TEXT,
	reviewed_at TEXT,
	published_by TEXT,
	published_by_name TEXT,
	published_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
)`

const SCHOOL_NEWS_ENGAGEMENT_DDL = `CREATE TABLE IF NOT EXISTS school_news_engagement (
	id TEXT PRIMARY KEY,
	tenant_id TEXT NOT NULL,
	post_id TEXT NOT NULL,
	kind TEXT NOT NULL,
	reaction TEXT,
	author_name TEXT,
	body TEXT,
	created_at TEXT NOT NULL
)`

export async function ensureNewsroomTables(db: D1Database) {
	await db.prepare(SCHOOL_NEWSROOM_DDL).run()
	await db.prepare(SCHOOL_NEWS_ENGAGEMENT_DDL).run()
	// Migrate older tables that pre-date the audience column.
	try {
		await db.prepare(`ALTER TABLE school_news_posts ADD COLUMN audience TEXT`).run()
	} catch {
		// Column already exists.
	}
}

export async function getSchoolNewsEngagement(db: D1Database, tenantId: string, postId: string) {
	await ensureNewsroomTables(db)
	const rows = await db.prepare(
		`SELECT * FROM school_news_engagement WHERE tenant_id = ? AND post_id = ? ORDER BY created_at ASC`
	).bind(tenantId, postId).all()
	const records = (rows.results || []) as Record<string, any>[]
	const reactions: Record<string, number> = {}
	const comments: Array<{ id: string; authorName: string; body: string; createdAt: string }> = []
	let views = 0
	for (const record of records) {
		const kind = String(record.kind || '')
		if (kind === 'view') {
			views += 1
		} else if (kind === 'reaction') {
			const reaction = String(record.reaction || '👍')
			reactions[reaction] = (reactions[reaction] || 0) + 1
		} else if (kind === 'comment') {
			comments.push({
				id: String(record.id || ''),
				authorName: String(record.author_name || 'Reader'),
				body: String(record.body || ''),
				createdAt: String(record.created_at || ''),
			})
		}
	}
	return { views, reactions, comments }
}

export async function recordSchoolNewsEngagement(
	db: D1Database,
	input: { tenantId: string; postId: string; kind: 'view' | 'reaction' | 'comment'; reaction?: string; authorName?: string; body?: string },
) {
	await ensureNewsroomTables(db)
	const now = new Date().toISOString()
	const id = `eng_${normalizeKeyPart(input.postId)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
	await db.prepare(
		`INSERT INTO school_news_engagement (id, tenant_id, post_id, kind, reaction, author_name, body, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(
		id,
		String(input.tenantId || ''),
		String(input.postId || ''),
		String(input.kind || 'view'),
		input.kind === 'reaction' ? sanitizeText(input.reaction || '👍', 16) : null,
		input.kind === 'comment' ? sanitizeText(input.authorName || 'Reader', 120) : null,
		input.kind === 'comment' ? sanitizeText(input.body || '', 1500) : null,
		now,
	).run()
	return getSchoolNewsEngagement(db, String(input.tenantId || ''), String(input.postId || ''))
}

export async function getSchoolNewsPostById(db: D1Database, tenantId: string, postId: string) {
	await ensureNewsroomTables(db)
	const row = await db.prepare(
		`SELECT * FROM school_news_posts WHERE tenant_id = ? AND id = ? LIMIT 1`
	).bind(tenantId, postId).first() as Record<string, any> | null

	return row ? mapNewsPostRow(row) : null
}

export async function listSchoolNewsPosts(db: D1Database, tenantId: string, filters: Record<string, any> = {}) {
	await ensureNewsroomTables(db)

	let query = `SELECT * FROM school_news_posts WHERE tenant_id = ?`
	const binds: unknown[] = [tenantId]

	if (filters.authorId) {
		query += ` AND author_id = ?`
		binds.push(String(filters.authorId || ''))
	}

	if (filters.status) {
		query += ` AND status = ?`
		binds.push(normalizeNewsStatus(filters.status, 'draft'))
	}

	query += ` ORDER BY COALESCE(published_at, reviewed_at, updated_at, created_at) DESC, updated_at DESC`
	const rows = await db.prepare(query).bind(...binds).all()
	let posts = ((rows.results || []) as Record<string, any>[]).map(mapNewsPostRow)

	// Optional audience channel filter (e.g. only posts targeted at the public website or a viewer role).
	if (filters.channel) {
		posts = posts.filter(post => postMatchesChannel(post.audience, String(filters.channel)))
	}

	return posts
}

export async function saveSchoolNewsPost(db: D1Database, input: Record<string, any>) {
	await ensureNewsroomTables(db)

	const existing = input.id
		? await getSchoolNewsPostById(db, String(input.tenantId || ''), String(input.id || ''))
		: null

	const now = new Date().toISOString()
	const status = normalizeNewsStatus(input.status, existing?.status || 'draft')
	const id = String(existing?.id || input.id || buildNewsPostId(String(input.tenantId || ''), String(input.title || 'story')))
	const shouldResetReview = Boolean(input.resetReview)

	// Preserve existing audience when the caller does not send one (e.g. review/publish steps).
	const audience = input.audience !== undefined
		? normalizeAudience(input.audience)
		: (existing?.audience || [])

	await db.prepare(
		`INSERT OR REPLACE INTO school_news_posts (
			id, tenant_id, title, excerpt, content, cover_url, audience, status, author_id, author_name, author_role,
			review_notes, reviewed_by, reviewed_by_name, reviewed_at, published_by, published_by_name, published_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(
		id,
		String(input.tenantId || existing?.tenantId || ''),
		sanitizeText(input.title, 180),
		sanitizeText(input.excerpt, 360),
		sanitizeText(input.content, 40000),
		sanitizeText(input.coverUrl, 2048),
		JSON.stringify(audience),
		status,
		String(existing?.authorId || input.authorId || ''),
		sanitizeText(existing?.authorName || input.authorName, 180),
		sanitizeText(existing?.authorRole || input.authorRole, 80),
		shouldResetReview ? '' : sanitizeText(existing?.reviewNotes || input.reviewNotes, 1500),
		shouldResetReview ? '' : sanitizeText(existing?.reviewedBy || input.reviewedBy, 120),
		shouldResetReview ? '' : sanitizeText(existing?.reviewedByName || input.reviewedByName, 180),
		shouldResetReview ? '' : sanitizeText(existing?.reviewedAt || input.reviewedAt, 80),
		status === 'published' ? sanitizeText(existing?.publishedBy || input.publishedBy, 120) : sanitizeText(existing?.publishedBy, 120),
		status === 'published' ? sanitizeText(existing?.publishedByName || input.publishedByName, 180) : sanitizeText(existing?.publishedByName, 180),
		status === 'published' ? sanitizeText(existing?.publishedAt || input.publishedAt || now, 80) : sanitizeText(existing?.publishedAt, 80),
		sanitizeText(existing?.createdAt || now, 80),
		now,
	).run()

	return getSchoolNewsPostById(db, String(input.tenantId || existing?.tenantId || ''), id)
}

export async function submitSchoolNewsPost(db: D1Database, input: Record<string, any>) {
	return saveSchoolNewsPost(db, {
		...input,
		status: 'submitted',
		resetReview: true,
	})
}

export async function reviewSchoolNewsPost(db: D1Database, input: Record<string, any>) {
	await ensureNewsroomTables(db)

	const existing = await getSchoolNewsPostById(db, String(input.tenantId || ''), String(input.id || ''))
	if (!existing) return null

	const now = new Date().toISOString()
	const nextStatus = String(input.decision || '').toLowerCase() === 'approve' ? 'reviewed' : 'changes_requested'

	await db.prepare(
		`UPDATE school_news_posts
		 SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = ?, updated_at = ?
		 WHERE tenant_id = ? AND id = ?`
	).bind(
		nextStatus,
		sanitizeText(input.reviewNotes, 1500),
		sanitizeText(input.reviewedBy, 120),
		sanitizeText(input.reviewedByName, 180),
		now,
		now,
		String(input.tenantId || ''),
		String(input.id || ''),
	).run()

	return getSchoolNewsPostById(db, String(input.tenantId || ''), String(input.id || ''))
}

export async function publishSchoolNewsPost(db: D1Database, input: Record<string, any>) {
	await ensureNewsroomTables(db)

	const existing = await getSchoolNewsPostById(db, String(input.tenantId || ''), String(input.id || ''))
	if (!existing) return null
	if (existing.status !== 'reviewed' && existing.status !== 'published') {
		throw new Error('This story must be reviewed before publication.')
	}

	const now = new Date().toISOString()
	await db.prepare(
		`UPDATE school_news_posts
		 SET status = 'published', published_by = ?, published_by_name = ?, published_at = ?, updated_at = ?
		 WHERE tenant_id = ? AND id = ?`
	).bind(
		sanitizeText(input.publishedBy, 120),
		sanitizeText(input.publishedByName, 180),
		now,
		now,
		String(input.tenantId || ''),
		String(input.id || ''),
	).run()

	return getSchoolNewsPostById(db, String(input.tenantId || ''), String(input.id || ''))
}
