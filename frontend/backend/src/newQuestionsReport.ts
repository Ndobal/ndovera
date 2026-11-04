// For Ami: new questions per subject over a period. Runs only when Ami asks for it.
//
// Cost: no new index and nothing kept. New questions are the newest rows, so the first one in the period is found
// by a binary search on rowid (about 20 one-row reads), and only the rows after it are read, at most MAX_ROWS.

import { ensurePracticeTables } from './practiceArena'

export const REPORT_PERIODS = [1, 7, 30, 90]
const MAX_ROWS = 50000
const MAX_SUBJECTS = 300

/** The first rowid created on or after `since`. Rowids follow the order questions were added. */
async function firstRowidSince(db: D1Database, since: string) {
  const newest = await db.prepare(`SELECT MAX(rowid) AS id FROM question_bank`).first() as Record<string, any> | null
  if (newest?.id === null || newest?.id === undefined) return null
  let low = 0
  let high = Number(newest.id) + 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const row = await db.prepare(`SELECT rowid AS id, created_at FROM question_bank WHERE rowid >= ? ORDER BY rowid LIMIT 1`).bind(middle).first() as Record<string, any> | null
    if (!row || String(row.created_at) >= since) high = middle
    else low = Number(row.id) + 1
  }
  return low
}

export async function newQuestionsReport(db: D1Database, days: number, at = new Date()) {
  await ensurePracticeTables(db)
  const period = REPORT_PERIODS.includes(days) ? days : 7
  const since = new Date(at.getTime() - period * 86400_000).toISOString()
  const start = await firstRowidSince(db, since)
  const rows = start === null ? { results: [] } : await db.prepare(`SELECT COALESCE(NULLIF(subject_key, ''), subject, '') AS subject_key, MAX(subject) AS subject, COUNT(*) AS total,
      SUM(quality IN ('ok', 'upgraded')) AS checked, SUM(quality IS NULL AND playable = 1) AS waiting, SUM(exam IS NOT NULL AND exam != '') AS for_exams
    FROM (SELECT subject_key, subject, quality, playable, exam FROM question_bank WHERE rowid >= ? AND created_at >= ? ORDER BY rowid LIMIT ${MAX_ROWS})
    GROUP BY 1 ORDER BY total DESC LIMIT ${MAX_SUBJECTS}`).bind(start, since).all()
  const subjects = ((rows.results || []) as Record<string, any>[]).map(row => ({
    key: String(row.subject_key || ''), name: String(row.subject || row.subject_key || 'No subject'), total: Number(row.total || 0),
    checked: Number(row.checked || 0), waiting: Number(row.waiting || 0), forExams: Number(row.for_exams || 0),
  }))
  const total = subjects.reduce((sum, item) => sum + item.total, 0)
  return { days: period, since, subjects, total, capped: total >= MAX_ROWS }
}
