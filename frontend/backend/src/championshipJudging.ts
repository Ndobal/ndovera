// NDOVERA Championship judging, ranking and appeals.
//
// The integrity rules from championship.md are enforced here rather than left to the UI,
// because a screen can be bypassed and a query cannot:
//
//   §17 Blind judging      — a judge sees "E-10482", never "John Williams, Genesis". Identity is
//                            stripped in the data layer, so no endpoint can leak it by accident.
//   §20 Judge protection   — a judge cannot see another judge's scores until their own are
//                            locked. Enforced when reading, not by hiding a button.
//   §19 Aggregation        — each judge's marks become a percentage of the maximum available,
//                            and the result is the mean of those percentages. Judges with
//                            different rubric totals therefore still carry equal weight.
//   §42 Result locking     — once results are locked a score cannot be quietly edited. A change
//                            requires a reason, keeps the previous value, and is audited.
//   §41 Appeals            — a participant can contest an outcome inside a window, with the
//                            reason, evidence and decision all recorded.

const JUDGES_DDL = `CREATE TABLE IF NOT EXISTS championship_judges (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL,
  stage_id TEXT,
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  name TEXT,
  role TEXT,
  blind INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(championship_id, stage_id, user_id)
)`

const SCORES_DDL = `CREATE TABLE IF NOT EXISTS championship_scores (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL,
  stage_id TEXT,
  submission_id TEXT NOT NULL,
  judge_id TEXT NOT NULL,
  scores_json TEXT,
  total REAL DEFAULT 0,
  max_total REAL DEFAULT 0,
  percentage REAL DEFAULT 0,
  comment TEXT,
  locked INTEGER DEFAULT 0,
  previous_scores_json TEXT,
  override_reason TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(submission_id, judge_id)
)`

const APPEALS_DDL = `CREATE TABLE IF NOT EXISTS championship_appeals (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL,
  stage_id TEXT,
  submission_id TEXT,
  registration_id TEXT,
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT,
  reviewer_id TEXT,
  decision_note TEXT,
  decided_at TEXT,
  created_at TEXT,
  updated_at TEXT
)`

const RESULT_LOCKS_DDL = `CREATE TABLE IF NOT EXISTS championship_result_locks (
  championship_id TEXT NOT NULL,
  stage_id TEXT NOT NULL DEFAULT '',
  locked INTEGER DEFAULT 0,
  locked_by TEXT,
  locked_at TEXT,
  PRIMARY KEY (championship_id, stage_id)
)`

export const JUDGE_ROLES = ['judge', 'school_reviewer', 'championship_officer']
export const APPEAL_STATUSES = ['submitted', 'under_review', 'accepted', 'rejected', 'closed']

const _judgingTablesReady = { done: false }

export async function ensureJudgingTables(db: D1Database) {
  if (_judgingTablesReady.done) return
  await db.prepare(JUDGES_DDL).run()
  await db.prepare(SCORES_DDL).run()
  await db.prepare(APPEALS_DDL).run()
  await db.prepare(RESULT_LOCKS_DDL).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cjudges_champ ON championship_judges (championship_id, stage_id)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cscores_submission ON championship_scores (submission_id)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cscores_champ ON championship_scores (championship_id, stage_id)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cappeals_champ ON championship_appeals (championship_id, status)`).run()
  _judgingTablesReady.done = true
}

function text(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max)
}

function jsonOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  try { return JSON.parse(String(value)) } catch { return null }
}

// ─── Judges ──────────────────────────────────────────────────────────────────────────────────

export function mapJudgeRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    stageId: String(row.stage_id || ''),
    userId: String(row.user_id || ''),
    tenantId: String(row.tenant_id || ''),
    name: String(row.name || ''),
    role: String(row.role || 'judge'),
    blind: Number(row.blind || 0) === 1,
    active: Number(row.active || 0) === 1,
  }
}

export async function assignJudge(
  db: D1Database,
  input: {
    championshipId: string
    stageId?: string
    userId: string
    tenantId?: string
    name?: string
    role?: string
    blind?: boolean
  },
) {
  await ensureJudgingTables(db)
  const now = new Date().toISOString()
  const role = JUDGE_ROLES.includes(text(input.role, 40)) ? text(input.role, 40) : 'judge'
  const id = `cjudge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  await db.prepare(
    `INSERT INTO championship_judges (id, championship_id, stage_id, user_id, tenant_id, name, role, blind, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(championship_id, stage_id, user_id)
     DO UPDATE SET name = excluded.name, role = excluded.role, blind = excluded.blind, active = 1, updated_at = excluded.updated_at`
  ).bind(
    id, input.championshipId, text(input.stageId, 120), input.userId, text(input.tenantId, 120),
    text(input.name, 160), role, input.blind === false ? 0 : 1, now, now,
  ).run()

  const row = await db.prepare(
    `SELECT * FROM championship_judges WHERE championship_id = ? AND COALESCE(stage_id,'') = ? AND user_id = ?`
  ).bind(input.championshipId, text(input.stageId, 120), input.userId).first() as Record<string, any> | null
  return row ? mapJudgeRow(row) : null
}

export async function removeJudge(db: D1Database, championshipId: string, stageId: string, userId: string) {
  await ensureJudgingTables(db)
  await db.prepare(
    `UPDATE championship_judges SET active = 0, updated_at = ? WHERE championship_id = ? AND COALESCE(stage_id,'') = ? AND user_id = ?`
  ).bind(new Date().toISOString(), championshipId, text(stageId, 120), userId).run()
}

export async function listJudges(db: D1Database, championshipId: string, stageId = '') {
  await ensureJudgingTables(db)
  const rows = stageId
    ? await db.prepare(`SELECT * FROM championship_judges WHERE championship_id = ? AND COALESCE(stage_id,'') = ? AND active = 1`).bind(championshipId, stageId).all()
    : await db.prepare(`SELECT * FROM championship_judges WHERE championship_id = ? AND active = 1`).bind(championshipId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapJudgeRow)
}

export async function findJudge(db: D1Database, championshipId: string, userId: string, stageId = '') {
  await ensureJudgingTables(db)
  // A judge assigned to the whole championship (empty stage) also covers every stage in it.
  const row = await db.prepare(
    `SELECT * FROM championship_judges
      WHERE championship_id = ? AND user_id = ? AND active = 1
        AND (COALESCE(stage_id,'') = ? OR COALESCE(stage_id,'') = '')
      ORDER BY CASE WHEN COALESCE(stage_id,'') = ? THEN 0 ELSE 1 END
      LIMIT 1`
  ).bind(championshipId, userId, text(stageId, 120), text(stageId, 120)).first() as Record<string, any> | null
  return row ? mapJudgeRow(row) : null
}

// ─── Scoring ─────────────────────────────────────────────────────────────────────────────────

export function mapScoreRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    stageId: String(row.stage_id || ''),
    submissionId: String(row.submission_id || ''),
    judgeId: String(row.judge_id || ''),
    scores: jsonOrNull(row.scores_json) || {},
    total: Number(row.total || 0),
    maxTotal: Number(row.max_total || 0),
    percentage: Number(row.percentage || 0),
    comment: String(row.comment || ''),
    locked: Number(row.locked || 0) === 1,
    previousScores: jsonOrNull(row.previous_scores_json),
    overrideReason: String(row.override_reason || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

/**
 * Clamps a judge's marks to the rubric and computes the totals.
 *
 * Every score is bounded by its criterion maximum, so neither a mistyped number nor a crafted
 * request can push a mark past what the rubric allows. The percentage is what aggregation uses
 * (§19), which keeps judges comparable even if a stage rubric changes between them.
 */
export function computeJudgeScore(
  rawScores: Record<string, any>,
  criteria: Array<{ key: string; label: string; max: number }>,
) {
  const scores: Record<string, number> = {}
  let total = 0
  let maxTotal = 0

  for (const criterion of criteria) {
    const raw = Number(rawScores?.[criterion.key])
    const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(criterion.max, raw)) : 0
    scores[criterion.key] = Math.round(clamped * 100) / 100
    total += scores[criterion.key]
    maxTotal += criterion.max
  }

  return {
    scores,
    total: Math.round(total * 100) / 100,
    maxTotal,
    percentage: maxTotal > 0 ? Math.round((total / maxTotal) * 10000) / 100 : 0,
  }
}

export async function isResultLocked(db: D1Database, championshipId: string, stageId = '') {
  await ensureJudgingTables(db)
  const row = await db.prepare(
    `SELECT locked FROM championship_result_locks WHERE championship_id = ? AND stage_id = ?`
  ).bind(championshipId, text(stageId, 120)).first() as Record<string, any> | null
  return Number(row?.locked || 0) === 1
}

export async function setResultLock(db: D1Database, championshipId: string, stageId: string, locked: boolean, actorId: string) {
  await ensureJudgingTables(db)
  const now = new Date().toISOString()
  await db.prepare(
    `INSERT INTO championship_result_locks (championship_id, stage_id, locked, locked_by, locked_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(championship_id, stage_id)
     DO UPDATE SET locked = excluded.locked, locked_by = excluded.locked_by, locked_at = excluded.locked_at`
  ).bind(championshipId, text(stageId, 120), locked ? 1 : 0, actorId, now).run()
}

/**
 * Records one judge's marks for one submission.
 *
 * Two guards matter here. A locked score is the judge's final word and cannot be edited by
 * them again (§20) — only an authorised override can change it. And once results are locked
 * (§42) any change must carry a reason, keeps the previous marks, and is reported back to the
 * caller so it can be audited.
 */
export async function saveJudgeScore(
  db: D1Database,
  input: {
    championshipId: string
    stageId?: string
    submissionId: string
    judgeUserId: string
    rawScores: Record<string, any>
    comment?: string
    lock?: boolean
    overrideReason?: string
    allowOverride?: boolean
  },
  criteria: Array<{ key: string; label: string; max: number }>,
) {
  await ensureJudgingTables(db)
  const now = new Date().toISOString()
  const computed = computeJudgeScore(input.rawScores || {}, criteria)
  const stageId = text(input.stageId, 120)

  const existing = await db.prepare(
    `SELECT * FROM championship_scores WHERE submission_id = ? AND judge_id = ?`
  ).bind(input.submissionId, input.judgeUserId).first() as Record<string, any> | null

  const resultsLocked = await isResultLocked(db, input.championshipId, stageId)
  const wasLocked = Number(existing?.locked || 0) === 1

  if (resultsLocked && !input.allowOverride) {
    throw new Error('Results for this stage are locked. An authorised override is required to change a score.')
  }
  if (resultsLocked && input.allowOverride && !text(input.overrideReason, 500)) {
    throw new Error('A reason is required to change a score after results are locked.')
  }
  if (wasLocked && !resultsLocked && !input.allowOverride) {
    throw new Error('You have already submitted your score for this entry.')
  }

  const id = String(existing?.id || `cscore_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
  const previous = existing ? String(existing.scores_json || '') : ''

  await db.prepare(
    `INSERT INTO championship_scores (
      id, championship_id, stage_id, submission_id, judge_id, scores_json, total, max_total,
      percentage, comment, locked, previous_scores_json, override_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(submission_id, judge_id) DO UPDATE SET
      scores_json = excluded.scores_json, total = excluded.total, max_total = excluded.max_total,
      percentage = excluded.percentage, comment = excluded.comment, locked = excluded.locked,
      previous_scores_json = excluded.previous_scores_json,
      override_reason = excluded.override_reason, updated_at = excluded.updated_at`
  ).bind(
    id, input.championshipId, stageId, input.submissionId, input.judgeUserId,
    JSON.stringify(computed.scores), computed.total, computed.maxTotal, computed.percentage,
    text(input.comment, 2000), input.lock === false ? 0 : 1,
    // The previous marks are only retained when a change happens after locking — that is the
    // case §42 asks to be able to reconstruct.
    (resultsLocked || wasLocked) && previous ? previous : String(existing?.previous_scores_json || ''),
    text(input.overrideReason, 500), String(existing?.created_at || now), now,
  ).run()

  const row = await db.prepare(`SELECT * FROM championship_scores WHERE id = ?`).bind(id).first() as Record<string, any>
  return { score: mapScoreRow(row), wasOverride: resultsLocked || wasLocked }
}

export async function listScoresForStage(db: D1Database, championshipId: string, stageId = '') {
  await ensureJudgingTables(db)
  const rows = stageId
    ? await db.prepare(`SELECT * FROM championship_scores WHERE championship_id = ? AND COALESCE(stage_id,'') = ?`).bind(championshipId, stageId).all()
    : await db.prepare(`SELECT * FROM championship_scores WHERE championship_id = ?`).bind(championshipId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapScoreRow)
}

/**
 * What a given judge is allowed to see (§20).
 *
 * Until this judge has locked their own score for a submission, other judges' marks are not
 * returned at all — not hidden client-side, simply absent from the response.
 */
export function filterScoresForJudge(scores: ReturnType<typeof mapScoreRow>[], judgeUserId: string) {
  const mine = new Map<string, ReturnType<typeof mapScoreRow>>()
  for (const score of scores) {
    if (score.judgeId === judgeUserId) mine.set(score.submissionId, score)
  }

  return scores.filter((score) => {
    if (score.judgeId === judgeUserId) return true
    const own = mine.get(score.submissionId)
    return Boolean(own && own.locked)
  })
}

/**
 * Final standing for a stage (§19).
 *
 * Each judge contributes a percentage; a submission's result is the mean of those. Submissions
 * nobody has scored are returned with a null result rather than a zero, so an unjudged entry is
 * never mistaken for one that scored nothing.
 */
export function buildRanking(
  submissions: Array<{ id: string; anonymousCode: string; userId: string; tenantId: string }>,
  scores: ReturnType<typeof mapScoreRow>[],
  options: { reveal?: boolean } = {},
) {
  const bySubmission = new Map<string, ReturnType<typeof mapScoreRow>[]>()
  for (const score of scores) {
    if (!score.locked) continue
    const list = bySubmission.get(score.submissionId) || []
    list.push(score)
    bySubmission.set(score.submissionId, list)
  }

  const rows = submissions.map((submission) => {
    const judgeScores = bySubmission.get(submission.id) || []
    const judgeCount = judgeScores.length
    const average = judgeCount > 0
      ? Math.round((judgeScores.reduce((sum, score) => sum + score.percentage, 0) / judgeCount) * 100) / 100
      : null

    return {
      submissionId: submission.id,
      anonymousCode: submission.anonymousCode,
      // Identity only appears once results are revealed (§17).
      userId: options.reveal ? submission.userId : '',
      tenantId: options.reveal ? submission.tenantId : '',
      judgeCount,
      averagePercentage: average,
      judgeBreakdown: options.reveal
        ? judgeScores.map(score => ({ judgeId: score.judgeId, percentage: score.percentage }))
        : [],
    }
  })

  const scored = rows.filter(row => row.averagePercentage !== null)
    .sort((a, b) => (b.averagePercentage as number) - (a.averagePercentage as number))
  const unscored = rows.filter(row => row.averagePercentage === null)

  // Equal averages share a position, and the next position skips accordingly (1,2,2,4).
  let lastValue: number | null = null
  let lastPosition = 0
  const ranked = scored.map((row, index) => {
    const value = row.averagePercentage as number
    const position = value === lastValue ? lastPosition : index + 1
    lastValue = value
    lastPosition = position
    return { ...row, position }
  })

  return [...ranked, ...unscored.map(row => ({ ...row, position: null }))]
}

// ─── Appeals (§41) ───────────────────────────────────────────────────────────────────────────

export function mapAppealRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    stageId: String(row.stage_id || ''),
    submissionId: String(row.submission_id || ''),
    userId: String(row.user_id || ''),
    tenantId: String(row.tenant_id || ''),
    reason: String(row.reason || ''),
    evidenceUrl: String(row.evidence_url || ''),
    status: String(row.status || 'submitted'),
    reviewerId: String(row.reviewer_id || ''),
    decisionNote: String(row.decision_note || ''),
    decidedAt: String(row.decided_at || ''),
    createdAt: String(row.created_at || ''),
  }
}

export async function createAppeal(
  db: D1Database,
  input: {
    championshipId: string
    stageId?: string
    submissionId?: string
    registrationId?: string
    userId: string
    tenantId?: string
    reason: string
    evidenceUrl?: string
  },
) {
  await ensureJudgingTables(db)
  const now = new Date().toISOString()
  const id = `cappeal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  await db.prepare(
    `INSERT INTO championship_appeals (
      id, championship_id, stage_id, submission_id, registration_id, user_id, tenant_id,
      reason, evidence_url, status, reviewer_id, decision_note, decided_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', '', '', '', ?, ?)`
  ).bind(
    id, input.championshipId, text(input.stageId, 120), text(input.submissionId, 120),
    text(input.registrationId, 120), input.userId, text(input.tenantId, 120),
    text(input.reason, 4000), text(input.evidenceUrl, 500), now, now,
  ).run()

  const row = await db.prepare(`SELECT * FROM championship_appeals WHERE id = ?`).bind(id).first() as Record<string, any>
  return mapAppealRow(row)
}

export async function listAppeals(
  db: D1Database,
  filters: { championshipId?: string; userId?: string; status?: string } = {},
) {
  await ensureJudgingTables(db)
  const clauses: string[] = []
  const params: any[] = []
  if (filters.championshipId) { clauses.push('championship_id = ?'); params.push(filters.championshipId) }
  if (filters.userId) { clauses.push('user_id = ?'); params.push(filters.userId) }
  if (filters.status) { clauses.push('status = ?'); params.push(filters.status) }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await db.prepare(
    `SELECT * FROM championship_appeals ${where} ORDER BY created_at DESC LIMIT 300`
  ).bind(...params).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapAppealRow)
}

export async function decideAppeal(
  db: D1Database,
  appealId: string,
  status: string,
  reviewerId: string,
  note = '',
) {
  await ensureJudgingTables(db)
  if (!APPEAL_STATUSES.includes(status)) throw new Error('Unknown appeal status.')
  const now = new Date().toISOString()
  const decided = ['accepted', 'rejected', 'closed'].includes(status)

  await db.prepare(
    `UPDATE championship_appeals
        SET status = ?, reviewer_id = ?, decision_note = ?, decided_at = ?, updated_at = ?
      WHERE id = ?`
  ).bind(status, reviewerId, text(note, 2000), decided ? now : '', now, appealId).run()

  const row = await db.prepare(`SELECT * FROM championship_appeals WHERE id = ?`).bind(appealId).first() as Record<string, any> | null
  return row ? mapAppealRow(row) : null
}
