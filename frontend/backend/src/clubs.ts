// Clubs: extracurricular activities (Press Club, JETS, Debate, Football, Red Cross…).
//
//   Owner / Head of School / admin: create any club, name its patrons, add anyone.
//   Teachers: start a club (they become its patron); patrons run it — add and remove
//             members, post, set work, mark it.
//   Students: the clubs they belong to — read, watch, download, save notes for offline
//             reading, hand in assignments, take quizzes.
//
// A club's feed holds notes (written like class notes, readable offline and aloud),
// videos (uploaded or a YouTube link), images, documents, links and announcements.
// Assignments take a written answer and/or files and are marked by a patron; quizzes
// are marked by Ndovera at once, on the server, from answers students never receive
// before they hand in. Nothing is ever hard-deleted: posts are withdrawn, members leave.
//
// Club fees: the Owner or Head of School sets a club's fee per term. Each student member
// pays it in full or half (staff children), and it is written into the NEXT term's fee
// table as one "Club fee" item (syncClubFees) — the term already running is never touched.
// A student belongs to one club unless the Owner or Head of School allows more.

export class ClubError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export type ClubActor = { tenantId: string, id: string, name: string, role: string, isManager: boolean, isStaff: boolean,
  /** Owner, HoS and ICT: the only people who add or remove club members. */
  canManageMembers?: boolean,
  /** Owner and Head of School only: club fees, and whether a student may join more than one club. */
  isHead?: boolean }

export const POST_KINDS = ['note', 'video', 'image', 'document', 'link', 'announcement', 'assignment', 'quiz'] as const
export type PostKind = typeof POST_KINDS[number]
export const CLUB_CATEGORIES = ['Academic', 'Arts & Culture', 'Sports', 'Science & Technology', 'Service & Leadership', 'Faith', 'Other'] as const

const now = () => new Date().toISOString()
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
const parse = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }
const clean = (value: unknown, max: number) => String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)

const readyDbs = new WeakSet<object>()
export async function ensureClubTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS clubs (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, category TEXT, meeting TEXT, color TEXT,
      status TEXT NOT NULL DEFAULT 'active', created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_clubs_tenant ON clubs(tenant_id, status)`,
    `CREATE TABLE IF NOT EXISTS club_members (
      club_id TEXT NOT NULL, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT, member_role TEXT NOT NULL, class_name TEXT,
      added_by TEXT, joined_at TEXT NOT NULL, left_at TEXT, PRIMARY KEY (club_id, user_id))`,
    `CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(tenant_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS club_posts (
      id TEXT PRIMARY KEY, club_id TEXT NOT NULL, tenant_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT, url TEXT, files_json TEXT,
      due_at TEXT, questions_json TEXT, max_score REAL, created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, withdrawn_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_club_posts_club ON club_posts(club_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS club_submissions (
      id TEXT PRIMARY KEY, post_id TEXT NOT NULL, club_id TEXT NOT NULL, tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT,
      answer_text TEXT, files_json TEXT, answers_json TEXT, score REAL, total REAL, feedback TEXT, submitted_at TEXT NOT NULL,
      marked_by TEXT, marked_at TEXT, UNIQUE (post_id, student_id))`,
    `CREATE INDEX IF NOT EXISTS idx_club_submissions_post ON club_submissions(post_id)`,
    `CREATE TABLE IF NOT EXISTS club_settings (tenant_id TEXT PRIMARY KEY, multiple_clubs INTEGER NOT NULL DEFAULT 0, updated_by TEXT, updated_at TEXT)`,
  ]) await db.prepare(statement).run()
  // Added with club fees: a club's fee per term, and whether a member pays all of it or half.
  await db.prepare(`ALTER TABLE clubs ADD COLUMN fee REAL`).run().catch(() => null)
  await db.prepare(`ALTER TABLE club_members ADD COLUMN fee_share TEXT`).run().catch(() => null)
  readyDbs.add(db as object)
}

// ─── Clubs and who is in them ────────────────────────────────────────────────

function mapClub(row: Record<string, any>) {
  return {
    id: String(row.id), name: String(row.name), description: String(row.description || ''), category: String(row.category || 'Other'),
    meeting: String(row.meeting || ''), color: String(row.color || ''), status: String(row.status || 'active'),
    createdByName: String(row.created_by_name || ''), createdAt: row.created_at, fee: Number(row.fee) > 0 ? Number(row.fee) : 0,
  }
}

function mapMember(row: Record<string, any>) {
  return { userId: String(row.user_id), name: String(row.name || row.user_id), role: String(row.member_role), className: String(row.class_name || ''), joinedAt: row.joined_at, feeShare: row.fee_share === 'half' ? 'half' : 'full' }
}

async function membership(db: D1Database, clubId: string, userId: string) {
  return await db.prepare(`SELECT * FROM club_members WHERE club_id = ? AND lower(user_id) = lower(?) AND left_at IS NULL`).bind(clubId, userId).first() as Record<string, any> | null
}

/** A club the actor may open, and what they may do in it. */
export async function clubAccess(db: D1Database, actor: ClubActor, clubId: string) {
  await ensureClubTables(db)
  const row = await db.prepare(`SELECT * FROM clubs WHERE id = ? AND tenant_id = ?`).bind(clubId, actor.tenantId).first() as Record<string, any> | null
  const overseer = actor.isManager || Boolean(actor.canManageMembers)
  if (!row || row.status === 'closed' && !overseer) throw new ClubError('Club not found.', 404)
  const member = await membership(db, clubId, actor.id)
  if (!member && !overseer) throw new ClubError('Club not found.', 404)
  const isPatron = member?.member_role === 'patron'
  return {
    club: mapClub(row), member, canManage: actor.isManager || isPatron, canManageMembers: Boolean(actor.canManageMembers),
    isStudent: member?.member_role === 'member' || member?.member_role === 'leader',
  }
}

export async function listClubs(db: D1Database, actor: ClubActor) {
  await ensureClubTables(db)
  // Leaders see every club in the school; everyone else, the clubs they belong to.
  const rows = actor.isManager || actor.canManageMembers
    ? await db.prepare(`SELECT * FROM clubs WHERE tenant_id = ? ORDER BY status, name`).bind(actor.tenantId).all()
    : await db.prepare(`SELECT c.* FROM clubs c JOIN club_members m ON m.club_id = c.id WHERE c.tenant_id = ? AND lower(m.user_id) = lower(?) AND m.left_at IS NULL AND c.status = 'active' ORDER BY c.name`).bind(actor.tenantId, actor.id).all()
  const clubs = ((rows.results || []) as Record<string, any>[]).map(mapClub)
  if (!clubs.length) return []
  const ids = clubs.map(club => club.id)
  const [counts, mine, latest] = await Promise.all([
    db.prepare(`SELECT club_id, member_role, COUNT(*) AS n FROM club_members WHERE club_id IN (${ids.map(() => '?').join(',')}) AND left_at IS NULL GROUP BY club_id, member_role`).bind(...ids).all(),
    db.prepare(`SELECT club_id, member_role FROM club_members WHERE club_id IN (${ids.map(() => '?').join(',')}) AND lower(user_id) = lower(?) AND left_at IS NULL`).bind(...ids, actor.id).all(),
    db.prepare(`SELECT club_id, MAX(created_at) AS at, COUNT(*) AS n FROM club_posts WHERE club_id IN (${ids.map(() => '?').join(',')}) AND withdrawn_at IS NULL GROUP BY club_id`).bind(...ids).all(),
  ])
  const memberCounts = new Map<string, { patrons: number, members: number }>()
  for (const row of (counts.results || []) as Record<string, any>[]) {
    const entry = memberCounts.get(String(row.club_id)) || { patrons: 0, members: 0 }
    if (row.member_role === 'patron') entry.patrons += Number(row.n)
    else entry.members += Number(row.n)
    memberCounts.set(String(row.club_id), entry)
  }
  const myRole = new Map(((mine.results || []) as Record<string, any>[]).map(row => [String(row.club_id), String(row.member_role)]))
  const activity = new Map(((latest.results || []) as Record<string, any>[]).map(row => [String(row.club_id), { at: row.at, posts: Number(row.n) }]))
  return clubs.map(club => ({
    ...club, ...(memberCounts.get(club.id) || { patrons: 0, members: 0 }), myRole: myRole.get(club.id) || '',
    posts: activity.get(club.id)?.posts || 0, lastPostAt: activity.get(club.id)?.at || null,
    canManage: actor.isManager || myRole.get(club.id) === 'patron',
    canManageMembers: Boolean(actor.canManageMembers),
  }))
}

export async function createClub(db: D1Database, actor: ClubActor, input: Record<string, any>) {
  await ensureClubTables(db)
  if (!actor.isManager && !actor.isStaff) throw new ClubError('Only staff can start a club.', 403)
  const name = clean(input.name, 80)
  if (name.length < 2) throw new ClubError('Give the club a name.')
  const existing = await db.prepare(`SELECT id FROM clubs WHERE tenant_id = ? AND lower(name) = lower(?) AND status = 'active'`).bind(actor.tenantId, name).first()
  if (existing) throw new ClubError(`There is already a club called ${name}.`, 409)
  const id = newId('club')
  const stamp = now()
  const category = (CLUB_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : 'Other'
  const statements = [
    db.prepare(`INSERT INTO clubs (id, tenant_id, name, description, category, meeting, color, status, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`)
      .bind(id, actor.tenantId, name, clean(input.description, 2000), category, clean(input.meeting, 120), clean(input.color, 20), actor.id, actor.name, stamp, stamp),
  ]
  // A teacher who starts a club runs it.
  if (!actor.isManager || input.joinAsPatron) {
    statements.push(db.prepare(`INSERT OR IGNORE INTO club_members (club_id, tenant_id, user_id, name, member_role, added_by, joined_at) VALUES (?, ?, ?, ?, 'patron', ?, ?)`).bind(id, actor.tenantId, actor.id, actor.name, actor.id, stamp))
  }
  await db.batch(statements)
  return (await clubAccess(db, actor, id)).club
}

export async function updateClub(db: D1Database, actor: ClubActor, clubId: string, input: Record<string, any>) {
  const access = await clubAccess(db, actor, clubId)
  if (!access.canManage) throw new ClubError('Only the club\'s patrons can change it.', 403)
  const status = input.status === 'closed' || input.status === 'active' ? input.status : access.club.status
  if (status !== access.club.status && !actor.isManager) throw new ClubError('Only the Owner or Head of School can close or reopen a club.', 403)
  await db.prepare(`UPDATE clubs SET name = ?, description = ?, category = ?, meeting = ?, color = ?, status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(
    clean(input.name ?? access.club.name, 80) || access.club.name, clean(input.description ?? access.club.description, 2000),
    (CLUB_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : access.club.category,
    clean(input.meeting ?? access.club.meeting, 120), clean(input.color ?? access.club.color, 20), status, now(), clubId, actor.tenantId,
  ).run()
  return (await clubAccess(db, actor, clubId)).club
}

export async function listMembers(db: D1Database, clubId: string) {
  const rows = await db.prepare(`SELECT * FROM club_members WHERE club_id = ? AND left_at IS NULL ORDER BY CASE member_role WHEN 'patron' THEN 0 WHEN 'leader' THEN 1 ELSE 2 END, name`).bind(clubId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapMember)
}

/** People to add: `people` are { id, name, role (school role), className }. Staff join as patrons, students as members. */
export async function addMembers(db: D1Database, actor: ClubActor, clubId: string, people: Array<{ id: string, name: string, role: string, className?: string }>, asRole = '') {
  const access = await clubAccess(db, actor, clubId)
  if (!access.canManageMembers) throw new ClubError('Only the Owner, Head of School or ICT can add club members.', 403)
  if (!people.length) throw new ClubError('Choose who to add.')
  // One club per student, unless the Owner or Head of School allows more.
  const students = people.filter(person => person.role === 'student')
  if (students.length && !(await getClubSettings(db, actor.tenantId)).multipleClubs) {
    const ids = students.map(person => person.id.toLowerCase())
    const elsewhere = ((await db.prepare(`SELECT m.user_id, m.name, c.name AS club_name FROM club_members m JOIN clubs c ON c.id = m.club_id
      WHERE m.tenant_id = ? AND m.club_id != ? AND m.left_at IS NULL AND m.member_role IN ('member', 'leader') AND c.status = 'active'
        AND lower(m.user_id) IN (${ids.map(() => '?').join(',')})`).bind(actor.tenantId, clubId, ...ids).all()).results || []) as Record<string, any>[]
    if (elsewhere.length) {
      const names = elsewhere.slice(0, 5).map(row => `${row.name || row.user_id} (${row.club_name})`).join(', ')
      throw new ClubError(`A student can be in one club only: ${names}${elsewhere.length > 5 ? ` and ${elsewhere.length - 5} more` : ''} ${elsewhere.length === 1 ? 'is' : 'are'} already in another club. Remove them there first, or ask the Owner or Head of School to allow more than one club.`, 409)
    }
  }
  const stamp = now()
  const statements = people.slice(0, 200).map(person => {
    const role = person.role === 'student' ? (asRole === 'leader' ? 'leader' : 'member') : 'patron'
    return db.prepare(`INSERT INTO club_members (club_id, tenant_id, user_id, name, member_role, class_name, added_by, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(club_id, user_id) DO UPDATE SET left_at = NULL, member_role = excluded.member_role, name = excluded.name, class_name = excluded.class_name, added_by = excluded.added_by`)
      .bind(clubId, actor.tenantId, person.id, person.name, role, person.className || null, actor.id, stamp)
  })
  await db.batch(statements)
  return listMembers(db, clubId)
}

export async function removeMember(db: D1Database, actor: ClubActor, clubId: string, userId: string) {
  const access = await clubAccess(db, actor, clubId)
  if (!access.canManageMembers) throw new ClubError('Only the Owner, Head of School or ICT can remove club members.', 403)
  const patrons = (await listMembers(db, clubId)).filter(member => member.role === 'patron')
  if (patrons.length === 1 && patrons[0].userId.toLowerCase() === userId.toLowerCase() && !actor.isManager && !actor.canManageMembers) throw new ClubError('A club needs at least one patron. Add another patron first.', 409)
  await db.prepare(`UPDATE club_members SET left_at = ? WHERE club_id = ? AND lower(user_id) = lower(?)`).bind(now(), clubId, userId).run()
  return listMembers(db, clubId)
}

/** Patrons can make a student a club leader (president, captain…) or back to a member. */
export async function setLeader(db: D1Database, actor: ClubActor, clubId: string, userId: string, leader: boolean) {
  const access = await clubAccess(db, actor, clubId)
  if (!access.canManage) throw new ClubError('Only the club\'s patrons can do that.', 403)
  await db.prepare(`UPDATE club_members SET member_role = ? WHERE club_id = ? AND lower(user_id) = lower(?) AND member_role IN ('member', 'leader')`).bind(leader ? 'leader' : 'member', clubId, userId).run()
  return listMembers(db, clubId)
}

// ─── Posts: notes, media, documents, assignments, quizzes ────────────────────

export type QuizQuestion = { id: string, type: 'mcq' | 'truefalse' | 'short', prompt: string, options: string[], answer: number | string, marks: number }

export function normalizeQuiz(input: unknown): QuizQuestion[] {
  const list = Array.isArray(input) ? input : []
  const out: QuizQuestion[] = []
  for (const raw of list.slice(0, 100)) {
    const type = ['mcq', 'truefalse', 'short'].includes(String(raw?.type)) ? String(raw.type) as QuizQuestion['type'] : 'mcq'
    const prompt = clean(raw?.prompt, 2000)
    if (!prompt) continue
    const options = type === 'truefalse' ? ['True', 'False'] : type === 'mcq' ? (Array.isArray(raw?.options) ? raw.options : []).map((option: unknown) => clean(option, 300)).filter(Boolean).slice(0, 6) : []
    if (type === 'mcq' && options.length < 2) throw new ClubError(`"${prompt.slice(0, 40)}" needs at least two options.`)
    const answer = type === 'short' ? clean(raw?.answer, 300) : Number(raw?.answer)
    if (type === 'short' ? !answer : !(Number.isInteger(answer) && (answer as number) >= 0 && (answer as number) < options.length)) throw new ClubError(`Mark the correct answer for "${prompt.slice(0, 40)}".`)
    out.push({ id: String(raw?.id || newId('q')), type, prompt, options, answer, marks: Math.max(1, Math.min(20, Number(raw?.marks) || 1)) })
  }
  return out
}

const normalizeAnswerText = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9\s.]/g, ' ').replace(/\s+/g, ' ').trim()

/** Mark a quiz: objective answers by index; short answers match any accepted answer ("Abuja | Abuja city"). */
export function markQuiz(questions: QuizQuestion[], answers: Record<string, unknown>) {
  let score = 0
  let total = 0
  const results = questions.map(question => {
    total += question.marks
    const given = answers?.[question.id]
    const correct = question.type === 'short'
      ? String(question.answer).split('|').map(normalizeAnswerText).filter(Boolean).includes(normalizeAnswerText(given))
      : Number(given) === Number(question.answer) && given !== '' && given !== null && given !== undefined
    if (correct) score += question.marks
    return { questionId: question.id, given: given ?? null, correct, answer: question.answer }
  })
  return { score, total, results }
}

function normalizeFiles(input: unknown) {
  return (Array.isArray(input) ? input : []).map(file => ({
    name: clean((file as any)?.name, 200) || 'File', url: clean((file as any)?.url, 1000), type: clean((file as any)?.type, 100), size: Number((file as any)?.size) || 0,
  })).filter(file => /^https:\/\//.test(file.url)).slice(0, 10)
}

/** A YouTube link becomes its embed address; other video links are kept as given. */
export function videoEmbedUrl(url: string) {
  const match = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : ''
}

function mapPost(row: Record<string, any>, viewer: { canManage: boolean }) {
  const questions = parse<QuizQuestion[]>(row.questions_json, [])
  return {
    id: String(row.id), clubId: String(row.club_id), kind: String(row.kind) as PostKind, title: String(row.title), body: String(row.body || ''), url: String(row.url || ''),
    embedUrl: row.kind === 'video' ? videoEmbedUrl(String(row.url || '')) : '', files: parse<any[]>(row.files_json, []), dueAt: row.due_at || null,
    maxScore: row.max_score === null || row.max_score === undefined ? null : Number(row.max_score),
    // Students get the questions, never the answers, until they have handed in.
    questions: viewer.canManage ? questions : questions.map(({ answer, ...rest }) => rest),
    createdByName: String(row.created_by_name || ''), createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export async function createPost(db: D1Database, actor: ClubActor, clubId: string, input: Record<string, any>) {
  const access = await clubAccess(db, actor, clubId)
  if (!access.canManage) throw new ClubError('Only the club\'s patrons can post.', 403)
  const kind = (POST_KINDS as readonly string[]).includes(String(input.kind)) ? String(input.kind) as PostKind : 'note'
  const title = clean(input.title, 200)
  if (!title) throw new ClubError('Give it a title.')
  const body = clean(input.body, 100_000)
  const url = clean(input.url, 1000)
  const files = normalizeFiles(input.files)
  if (url && !/^https:\/\//.test(url)) throw new ClubError('Links must start with https://')
  if (kind === 'note' && !body && !files.length) throw new ClubError('Write the note, or attach it.')
  if (kind === 'video' && !url && !files.length) throw new ClubError('Upload the video or paste its link (YouTube works).')
  if ((kind === 'image' || kind === 'document') && !files.length) throw new ClubError(`Attach the ${kind}.`)
  if (kind === 'link' && !url) throw new ClubError('Paste the link.')
  const questions = kind === 'quiz' ? normalizeQuiz(input.questions) : []
  if (kind === 'quiz' && !questions.length) throw new ClubError('Add at least one question.')
  const dueAt = ['assignment', 'quiz'].includes(kind) && input.dueAt ? new Date(String(input.dueAt)).toISOString() : null
  const maxScore = kind === 'quiz' ? questions.reduce((sum, question) => sum + question.marks, 0) : kind === 'assignment' ? Math.max(1, Math.min(1000, Number(input.maxScore) || 10)) : null
  const id = newId('cpost')
  const stamp = now()
  await db.prepare(`INSERT INTO club_posts (id, club_id, tenant_id, kind, title, body, url, files_json, due_at, questions_json, max_score, created_by, created_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, clubId, actor.tenantId, kind, title, body, url || null, JSON.stringify(files), dueAt, JSON.stringify(questions), maxScore, actor.id, actor.name, stamp, stamp).run()
  const row = await db.prepare(`SELECT * FROM club_posts WHERE id = ?`).bind(id).first() as Record<string, any>
  return mapPost(row, { canManage: true })
}

export async function withdrawPost(db: D1Database, actor: ClubActor, clubId: string, postId: string) {
  const access = await clubAccess(db, actor, clubId)
  if (!access.canManage) throw new ClubError('Only the club\'s patrons can remove posts.', 403)
  await db.prepare(`UPDATE club_posts SET withdrawn_at = ? WHERE id = ? AND club_id = ?`).bind(now(), postId, clubId).run()
}

/** The club page: details, members, the feed, and (for a student) their own work. */
export async function clubPage(db: D1Database, actor: ClubActor, clubId: string) {
  const access = await clubAccess(db, actor, clubId)
  const [members, postRows, subs] = await Promise.all([
    listMembers(db, clubId),
    db.prepare(`SELECT * FROM club_posts WHERE club_id = ? AND withdrawn_at IS NULL ORDER BY created_at DESC LIMIT 300`).bind(clubId).all(),
    access.canManage
      ? db.prepare(`SELECT post_id, COUNT(*) AS n, SUM(CASE WHEN marked_at IS NULL AND score IS NULL THEN 1 ELSE 0 END) AS unmarked FROM club_submissions WHERE club_id = ? GROUP BY post_id`).bind(clubId).all()
      : db.prepare(`SELECT * FROM club_submissions WHERE club_id = ? AND lower(student_id) = lower(?)`).bind(clubId, actor.id).all(),
  ])
  const posts = ((postRows.results || []) as Record<string, any>[]).map(row => mapPost(row, access))
  const work: Record<string, any> = {}
  for (const row of (subs.results || []) as Record<string, any>[]) {
    work[String(row.post_id)] = access.canManage
      ? { handedIn: Number(row.n), unmarked: Number(row.unmarked) }
      : mySubmission(row, posts.find(post => post.id === row.post_id), await quizFor(db, String(row.post_id)))
  }
  return { club: access.club, canManage: access.canManage, canManageMembers: access.canManageMembers, myRole: access.member?.member_role || (actor.isManager ? 'manager' : ''), members, posts, work }
}

async function quizFor(db: D1Database, postId: string) {
  const row = await db.prepare(`SELECT questions_json FROM club_posts WHERE id = ?`).bind(postId).first() as Record<string, any> | null
  return parse<QuizQuestion[]>(row?.questions_json, [])
}

function mySubmission(row: Record<string, any>, post: ReturnType<typeof mapPost> | undefined, questions: QuizQuestion[]) {
  const answers = parse<Record<string, unknown>>(row.answers_json, {})
  return {
    id: String(row.id), answerText: String(row.answer_text || ''), files: parse<any[]>(row.files_json, []), submittedAt: row.submitted_at,
    score: row.score === null || row.score === undefined ? null : Number(row.score), total: row.total === null || row.total === undefined ? (post?.maxScore ?? null) : Number(row.total),
    feedback: String(row.feedback || ''), markedAt: row.marked_at || null,
    // After handing in, a quiz shows what was right.
    ...(post?.kind === 'quiz' ? { review: markQuiz(questions, answers).results } : {}),
  }
}

export async function submitWork(db: D1Database, actor: ClubActor, clubId: string, postId: string, input: Record<string, any>) {
  const access = await clubAccess(db, actor, clubId)
  if (!access.isStudent) throw new ClubError('Only the club\'s students hand in work.', 403)
  const row = await db.prepare(`SELECT * FROM club_posts WHERE id = ? AND club_id = ? AND withdrawn_at IS NULL`).bind(postId, clubId).first() as Record<string, any> | null
  if (!row || !['assignment', 'quiz'].includes(String(row.kind))) throw new ClubError('There is nothing to hand in here.', 404)
  const existing = await db.prepare(`SELECT * FROM club_submissions WHERE post_id = ? AND lower(student_id) = lower(?)`).bind(postId, actor.id).first() as Record<string, any> | null
  const stamp = now()
  if (row.kind === 'quiz') {
    const questions = parse<QuizQuestion[]>(row.questions_json, [])
    const answers = input.answers && typeof input.answers === 'object' ? input.answers as Record<string, unknown> : {}
    // The same answers again is a hand-in sent twice (a phone retrying after a dropped connection), not a second try.
    if (existing && String(existing.answers_json || '') === JSON.stringify(answers)) return mySubmission(existing, mapPost(row, access), questions)
    if (existing) throw new ClubError('You have already taken this quiz.', 409)
    const marked = markQuiz(questions, answers)
    await db.prepare(`INSERT INTO club_submissions (id, post_id, club_id, tenant_id, student_id, student_name, answers_json, score, total, submitted_at, marked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(newId('csub'), postId, clubId, actor.tenantId, actor.id, actor.name, JSON.stringify(answers), marked.score, marked.total, stamp, stamp).run()
  } else {
    const answerText = clean(input.answerText, 50_000)
    const files = normalizeFiles(input.files)
    if (!answerText && !files.length) throw new ClubError('Write your answer or attach your work.')
    if (existing?.marked_at) throw new ClubError('Your work has been marked; it can no longer be changed.', 409)
    await db.prepare(`INSERT INTO club_submissions (id, post_id, club_id, tenant_id, student_id, student_name, answer_text, files_json, total, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(post_id, student_id) DO UPDATE SET answer_text = excluded.answer_text, files_json = excluded.files_json, submitted_at = excluded.submitted_at`)
      .bind(existing?.id || newId('csub'), postId, clubId, actor.tenantId, existing?.student_id || actor.id, actor.name, answerText, JSON.stringify(files), row.max_score, stamp).run()
  }
  const saved = await db.prepare(`SELECT * FROM club_submissions WHERE post_id = ? AND lower(student_id) = lower(?)`).bind(postId, actor.id).first() as Record<string, any>
  return mySubmission(saved, mapPost(row, access), parse<QuizQuestion[]>(row.questions_json, []))
}

/** A patron's view of who handed in what. */
export async function listSubmissionsFor(db: D1Database, actor: ClubActor, clubId: string, postId: string) {
  const access = await clubAccess(db, actor, clubId)
  if (!access.canManage) throw new ClubError('Only the club\'s patrons can see everyone\'s work.', 403)
  const [rows, members] = await Promise.all([
    db.prepare(`SELECT * FROM club_submissions WHERE post_id = ? AND club_id = ? ORDER BY student_name`).bind(postId, clubId).all(),
    listMembers(db, clubId),
  ])
  const submissions = ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: String(row.id), studentId: String(row.student_id), studentName: String(row.student_name || row.student_id), answerText: String(row.answer_text || ''),
    files: parse<any[]>(row.files_json, []), answers: parse<Record<string, unknown>>(row.answers_json, {}), submittedAt: row.submitted_at,
    score: row.score === null || row.score === undefined ? null : Number(row.score), total: row.total === null || row.total === undefined ? null : Number(row.total), feedback: String(row.feedback || ''), markedAt: row.marked_at || null,
  }))
  const handedIn = new Set(submissions.map(item => item.studentId.toLowerCase()))
  return { submissions, notHandedIn: members.filter(member => member.role !== 'patron' && !handedIn.has(member.userId.toLowerCase())).map(member => member.name) }
}

export async function markSubmission(db: D1Database, actor: ClubActor, clubId: string, submissionId: string, input: Record<string, any>) {
  const access = await clubAccess(db, actor, clubId)
  if (!access.canManage) throw new ClubError('Only the club\'s patrons can mark work.', 403)
  const row = await db.prepare(`SELECT s.*, p.max_score FROM club_submissions s JOIN club_posts p ON p.id = s.post_id WHERE s.id = ? AND s.club_id = ?`).bind(submissionId, clubId).first() as Record<string, any> | null
  if (!row) throw new ClubError('Submission not found.', 404)
  const max = Number(row.max_score) || Number(row.total) || 10
  const score = Number(input.score)
  if (!Number.isFinite(score) || score < 0 || score > max) throw new ClubError(`Give a score from 0 to ${max}.`)
  await db.prepare(`UPDATE club_submissions SET score = ?, total = ?, feedback = ?, marked_by = ?, marked_at = ? WHERE id = ?`).bind(score, max, clean(input.feedback, 4000), actor.name, now(), submissionId).run()
}

// ─── Club fees ───────────────────────────────────────────────────────────────

export const CLUB_FEE_ITEM = 'Club fee'

export async function getClubSettings(db: D1Database, tenantId: string) {
  await ensureClubTables(db)
  const row = await db.prepare(`SELECT multiple_clubs FROM club_settings WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  return { multipleClubs: Number(row?.multiple_clubs || 0) === 1 }
}

/** Owner and Head of School: allow a student to belong to more than one club. */
export async function saveClubSettings(db: D1Database, actor: ClubActor, input: Record<string, any>) {
  if (!actor.isHead) throw new ClubError('Only the Owner or Head of School can change this.', 403)
  await ensureClubTables(db)
  await db.prepare(`INSERT INTO club_settings (tenant_id, multiple_clubs, updated_by, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET multiple_clubs = excluded.multiple_clubs, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(actor.tenantId, input.multipleClubs ? 1 : 0, actor.name, now()).run()
  return getClubSettings(db, actor.tenantId)
}

/** Owner and Head of School: the club's fee per term (0 or empty: free). */
export async function setClubFee(db: D1Database, actor: ClubActor, clubId: string, fee: unknown) {
  if (!actor.isHead) throw new ClubError('Only the Owner or Head of School can set a club\'s fee.', 403)
  await clubAccess(db, actor, clubId)
  const amount = Math.round(Number(fee || 0) * 100) / 100
  if (!Number.isFinite(amount) || amount < 0) throw new ClubError('Enter the fee as an amount, or 0 for a free club.')
  await db.prepare(`UPDATE clubs SET fee = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(amount || null, now(), clubId, actor.tenantId).run()
  return (await clubAccess(db, actor, clubId)).club
}

/** Whether a student member pays the full club fee or half (e.g. a staff member's child). */
export async function setFeeShare(db: D1Database, actor: ClubActor, clubId: string, userId: string, share: unknown) {
  const access = await clubAccess(db, actor, clubId)
  if (!actor.isManager && !access.canManageMembers) throw new ClubError('Only the Owner, Head of School or ICT can change what a member pays.', 403)
  await db.prepare(`UPDATE club_members SET fee_share = ? WHERE club_id = ? AND lower(user_id) = lower(?) AND member_role IN ('member', 'leader')`)
    .bind(share === 'half' ? 'half' : null, clubId, userId).run()
  return listMembers(db, clubId)
}

/**
 * Write each student's club fee into a term's fee table (fee_student_amounts, item
 * "Club fee"): the sum over their active clubs, half where they pay half. Students no longer
 * in a paid club lose the item. Only ever called for a term that has not started.
 */
export async function syncClubFees(db: D1Database, tenantId: string, term: { id: string }) {
  await ensureClubTables(db)
  const rows = ((await db.prepare(`SELECT m.user_id, m.name, m.fee_share, c.fee FROM club_members m JOIN clubs c ON c.id = m.club_id
    WHERE m.tenant_id = ? AND m.left_at IS NULL AND m.member_role IN ('member', 'leader') AND c.status = 'active' AND c.fee > 0`).bind(tenantId).all()).results || []) as Record<string, any>[]
  const owed = new Map<string, { name: string, amount: number }>()
  for (const row of rows) {
    const entry = owed.get(String(row.user_id)) || { name: String(row.name || ''), amount: 0 }
    entry.amount = Math.round((entry.amount + Number(row.fee) * (row.fee_share === 'half' ? 0.5 : 1)) * 100) / 100
    owed.set(String(row.user_id), entry)
  }
  const current = ((await db.prepare(`SELECT student_id, amount FROM fee_student_amounts WHERE tenant_id = ? AND term_id = ? AND item = ?`).bind(tenantId, term.id, CLUB_FEE_ITEM).all()).results || []) as Record<string, any>[]
  const had = new Map(current.map(row => [String(row.student_id), Number(row.amount)]))
  const stamp = now()
  const statements: D1PreparedStatement[] = []
  for (const [studentId, entry] of owed) {
    if (had.get(studentId) === entry.amount) continue
    statements.push(db.prepare(`INSERT INTO fee_student_amounts (tenant_id, term_id, student_id, student_name, item, amount, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Clubs', ?)
      ON CONFLICT(tenant_id, term_id, student_id, item) DO UPDATE SET amount = excluded.amount, student_name = excluded.student_name, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .bind(tenantId, term.id, studentId, entry.name, CLUB_FEE_ITEM, entry.amount, stamp))
  }
  for (const studentId of had.keys()) {
    if (!owed.has(studentId)) statements.push(db.prepare(`DELETE FROM fee_student_amounts WHERE tenant_id = ? AND term_id = ? AND student_id = ? AND item = ?`).bind(tenantId, term.id, studentId, CLUB_FEE_ITEM))
  }
  for (let index = 0; index < statements.length; index += 90) await db.batch(statements.slice(index, index + 90))
  return { students: owed.size, changed: statements.length }
}
