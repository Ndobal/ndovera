// NDOVERA Championship badges, certificates and Hall of Fame.
//
// championship.md §29–§31 and §10. The point of this module is permanence: a result earned at
// twelve should still be readable at eighteen, and a certificate handed to a stranger should be
// checkable without trusting the person holding it.
//
// Certificates therefore carry an HMAC signature over their own fields. Verification recomputes
// it, so an altered name, award or date fails the check — a screenshot cannot be edited into a
// different award, and the public verification endpoint needs no login to confirm a real one.

const BADGES_DDL = `CREATE TABLE IF NOT EXISTS championship_badges (
  id TEXT PRIMARY KEY,
  championship_id TEXT,
  championship_name TEXT,
  badge_key TEXT NOT NULL,
  label TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  user_id TEXT,
  tenant_id TEXT,
  recipient_name TEXT,
  note TEXT,
  awarded_by TEXT,
  awarded_at TEXT,
  UNIQUE(championship_id, badge_key, recipient_type, user_id, tenant_id)
)`

const CERTIFICATES_DDL = `CREATE TABLE IF NOT EXISTS championship_certificates (
  id TEXT PRIMARY KEY,
  certificate_no TEXT UNIQUE,
  championship_id TEXT,
  championship_name TEXT,
  kind TEXT NOT NULL,
  award_label TEXT,
  recipient_type TEXT NOT NULL,
  user_id TEXT,
  tenant_id TEXT,
  recipient_name TEXT,
  position INTEGER,
  issued_at TEXT,
  issued_by TEXT,
  signature TEXT,
  revoked INTEGER DEFAULT 0,
  revoked_reason TEXT,
  UNIQUE(championship_id, kind, recipient_type, user_id, tenant_id)
)`

const GALLERY_DDL = `CREATE TABLE IF NOT EXISTS championship_gallery (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL,
  kind TEXT,
  url TEXT NOT NULL,
  caption TEXT,
  position INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT
)`

// Progress badges follow the stage a participant reached; special badges are awarded by hand.
export const PROGRESS_BADGES = [
  { key: 'participant', label: 'Participant', points: 10 },
  { key: 'qualifier', label: 'Qualifier', points: 20 },
  { key: 'quarter_finalist', label: 'Quarter-Finalist', points: 40 },
  { key: 'semi_finalist', label: 'Semi-Finalist', points: 70 },
  { key: 'finalist', label: 'Finalist', points: 100 },
  { key: 'winner', label: 'Winner', points: 250 },
]

export const SPECIAL_BADGES = [
  { key: 'outstanding_performance', label: 'Outstanding Performance' },
  { key: 'academic_excellence', label: 'Academic Excellence' },
  { key: 'best_school', label: 'Best School' },
  { key: 'best_independent', label: 'Best Independent Participant' },
  { key: 'most_improved', label: 'Most Improved' },
  { key: 'innovation_award', label: 'Innovation Award' },
]

export const CERTIFICATE_KINDS = [
  { key: 'participation', label: 'Certificate of Participation' },
  { key: 'quarter_final', label: 'Quarter-Finalist Certificate' },
  { key: 'semi_final', label: 'Semi-Finalist Certificate' },
  { key: 'finalist', label: 'Finalist Certificate' },
  { key: 'winner', label: 'Winner Certificate' },
  { key: 'school', label: 'School Certificate' },
  { key: 'judge', label: 'Judge Certificate' },
  { key: 'reviewer', label: 'Reviewer Certificate' },
]

const _awardTablesReady = { done: false }

export async function ensureAwardTables(db: D1Database) {
  if (_awardTablesReady.done) return
  await db.prepare(BADGES_DDL).run()
  await db.prepare(CERTIFICATES_DDL).run()
  await db.prepare(GALLERY_DDL).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cbadges_user ON championship_badges (user_id)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cbadges_tenant ON championship_badges (tenant_id)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_ccerts_user ON championship_certificates (user_id)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cgallery_champ ON championship_gallery (championship_id, position)`).run()
  _awardTablesReady.done = true
}

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

export function badgeLabel(badgeKey: string) {
  const all = [...PROGRESS_BADGES, ...SPECIAL_BADGES]
  return all.find(badge => badge.key === badgeKey)?.label || badgeKey
}

export function badgePoints(badgeKey: string) {
  return PROGRESS_BADGES.find(badge => badge.key === badgeKey)?.points || 0
}

/**
 * The badge a finishing position earns (§29).
 *
 * Everyone who competed is a Participant; the rest are layered on top by how far they got.
 * Returned as a list because a winner is also a finalist, and a profile should say so.
 */
export function badgesForPosition(position: number | null, totalRanked: number) {
  const earned = ['participant']
  if (position === null || position < 1) return earned

  if (position === 1) earned.push('qualifier', 'quarter_finalist', 'semi_finalist', 'finalist', 'winner')
  else if (position <= 3) earned.push('qualifier', 'quarter_finalist', 'semi_finalist', 'finalist')
  else if (position <= 10 || position <= Math.ceil(totalRanked * 0.1)) earned.push('qualifier', 'quarter_finalist', 'semi_finalist')
  else if (position <= 40 || position <= Math.ceil(totalRanked * 0.4)) earned.push('qualifier', 'quarter_finalist')
  else earned.push('qualifier')

  return Array.from(new Set(earned))
}

export function mapBadgeRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    championshipName: String(row.championship_name || ''),
    badgeKey: String(row.badge_key || ''),
    label: String(row.label || ''),
    recipientType: String(row.recipient_type || 'user'),
    userId: String(row.user_id || ''),
    tenantId: String(row.tenant_id || ''),
    recipientName: String(row.recipient_name || ''),
    points: badgePoints(String(row.badge_key || '')),
    awardedAt: String(row.awarded_at || ''),
  }
}

export async function awardBadge(
  db: D1Database,
  input: {
    championshipId: string
    championshipName?: string
    badgeKey: string
    recipientType?: 'user' | 'school'
    userId?: string
    tenantId?: string
    recipientName?: string
    note?: string
    awardedBy?: string
  },
) {
  await ensureAwardTables(db)
  const now = new Date().toISOString()
  const recipientType = input.recipientType === 'school' ? 'school' : 'user'
  const id = `cbadge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  // A badge is idempotent: re-running an award pass never duplicates what a student already has.
  await db.prepare(
    `INSERT INTO championship_badges (
      id, championship_id, championship_name, badge_key, label, recipient_type,
      user_id, tenant_id, recipient_name, note, awarded_by, awarded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(championship_id, badge_key, recipient_type, user_id, tenant_id) DO NOTHING`
  ).bind(
    id, input.championshipId, text(input.championshipName, 160), input.badgeKey,
    badgeLabel(input.badgeKey), recipientType,
    text(input.userId, 120), text(input.tenantId, 120), text(input.recipientName, 160),
    text(input.note, 500), text(input.awardedBy, 120), now,
  ).run()
}

export async function listBadgesForUser(db: D1Database, userId: string) {
  await ensureAwardTables(db)
  const rows = await db.prepare(
    `SELECT * FROM championship_badges WHERE user_id = ? ORDER BY awarded_at DESC`
  ).bind(userId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapBadgeRow)
}

export async function listBadgesForTenant(db: D1Database, tenantId: string) {
  await ensureAwardTables(db)
  const rows = await db.prepare(
    `SELECT * FROM championship_badges WHERE tenant_id = ? AND recipient_type = 'school' ORDER BY awarded_at DESC`
  ).bind(tenantId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapBadgeRow)
}

// ─── Certificates (§31) ──────────────────────────────────────────────────────────────────────

/**
 * Signs the immutable facts of a certificate.
 *
 * HMAC-SHA256 over a canonical field string using the platform secret. Verification recomputes
 * it from the stored row, so any later edit to name, award or date breaks the signature. This
 * is what lets the public endpoint answer "is this real?" for someone holding only a printout.
 */
export async function signCertificate(secret: string, fields: {
  certificateNo: string
  championshipId: string
  kind: string
  recipientName: string
  issuedAt: string
}) {
  const canonical = [
    fields.certificateNo, fields.championshipId, fields.kind, fields.recipientName, fields.issuedAt,
  ].join('|')

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(String(secret || 'ndovera')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function mapCertificateRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    certificateNo: String(row.certificate_no || ''),
    championshipId: String(row.championship_id || ''),
    championshipName: String(row.championship_name || ''),
    kind: String(row.kind || ''),
    kindLabel: CERTIFICATE_KINDS.find(item => item.key === String(row.kind || ''))?.label || String(row.kind || ''),
    awardLabel: String(row.award_label || ''),
    recipientType: String(row.recipient_type || 'user'),
    userId: String(row.user_id || ''),
    tenantId: String(row.tenant_id || ''),
    recipientName: String(row.recipient_name || ''),
    position: row.position === null || row.position === undefined ? null : Number(row.position),
    issuedAt: String(row.issued_at || ''),
    signature: String(row.signature || ''),
    revoked: Number(row.revoked || 0) === 1,
    revokedReason: String(row.revoked_reason || ''),
  }
}

export async function issueCertificate(
  db: D1Database,
  secret: string,
  input: {
    championshipId: string
    championshipName?: string
    kind: string
    awardLabel?: string
    recipientType?: 'user' | 'school'
    userId?: string
    tenantId?: string
    recipientName: string
    position?: number | null
    issuedBy?: string
  },
) {
  await ensureAwardTables(db)
  const now = new Date().toISOString()
  const recipientType = input.recipientType === 'school' ? 'school' : 'user'

  const existing = await db.prepare(
    `SELECT * FROM championship_certificates
      WHERE championship_id = ? AND kind = ? AND recipient_type = ?
        AND COALESCE(user_id,'') = ? AND COALESCE(tenant_id,'') = ?`
  ).bind(
    input.championshipId, input.kind, recipientType,
    text(input.userId, 120), text(input.tenantId, 120),
  ).first() as Record<string, any> | null
  if (existing) return mapCertificateRow(existing)

  const id = `ccert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  // Readable enough to print and type back in for verification.
  const certificateNo = `NC-${new Date(now).getUTCFullYear()}-${String(Date.now()).slice(-7)}`
  const signature = await signCertificate(secret, {
    certificateNo,
    championshipId: input.championshipId,
    kind: input.kind,
    recipientName: text(input.recipientName, 160),
    issuedAt: now,
  })

  await db.prepare(
    `INSERT INTO championship_certificates (
      id, certificate_no, championship_id, championship_name, kind, award_label,
      recipient_type, user_id, tenant_id, recipient_name, position,
      issued_at, issued_by, signature, revoked, revoked_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')`
  ).bind(
    id, certificateNo, input.championshipId, text(input.championshipName, 160), input.kind,
    text(input.awardLabel, 160), recipientType, text(input.userId, 120), text(input.tenantId, 120),
    text(input.recipientName, 160),
    input.position === null || input.position === undefined ? null : Number(input.position),
    now, text(input.issuedBy, 120), signature,
  ).run()

  const row = await db.prepare(`SELECT * FROM championship_certificates WHERE id = ?`).bind(id).first() as Record<string, any>
  return mapCertificateRow(row)
}

export async function listCertificatesForUser(db: D1Database, userId: string) {
  await ensureAwardTables(db)
  const rows = await db.prepare(
    `SELECT * FROM championship_certificates WHERE user_id = ? AND revoked = 0 ORDER BY issued_at DESC`
  ).bind(userId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapCertificateRow)
}

export async function listCertificatesForTenant(db: D1Database, tenantId: string) {
  await ensureAwardTables(db)
  const rows = await db.prepare(
    `SELECT * FROM championship_certificates WHERE tenant_id = ? AND revoked = 0 ORDER BY issued_at DESC`
  ).bind(tenantId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapCertificateRow)
}

/**
 * Public verification (§31). Returns only what a verifier needs to confirm the claim — the
 * award, the championship, the recipient and whether the signature still matches. No contact
 * details, no scores, nothing that would turn a verification link into a data leak.
 */
export async function verifyCertificate(db: D1Database, secret: string, certificateNo: string) {
  await ensureAwardTables(db)
  const row = await db.prepare(
    `SELECT * FROM championship_certificates WHERE certificate_no = ?`
  ).bind(text(certificateNo, 60)).first() as Record<string, any> | null
  if (!row) return { valid: false, reason: 'No certificate with that number was issued.', certificate: null }

  const certificate = mapCertificateRow(row)
  if (certificate.revoked) {
    return { valid: false, reason: 'This certificate has been revoked.', certificate: null }
  }

  const expected = await signCertificate(secret, {
    certificateNo: certificate.certificateNo,
    championshipId: certificate.championshipId,
    kind: certificate.kind,
    recipientName: certificate.recipientName,
    issuedAt: certificate.issuedAt,
  })
  if (expected !== certificate.signature) {
    return { valid: false, reason: 'This certificate could not be verified.', certificate: null }
  }

  return {
    valid: true,
    reason: '',
    certificate: {
      certificateNo: certificate.certificateNo,
      championshipName: certificate.championshipName,
      award: certificate.awardLabel || certificate.kindLabel,
      recipientName: certificate.recipientName,
      recipientType: certificate.recipientType,
      issuedAt: certificate.issuedAt,
    },
  }
}

// ─── Gallery and Hall of Fame (§10, §30) ─────────────────────────────────────────────────────

export function mapGalleryRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    kind: String(row.kind || 'photo'),
    url: String(row.url || ''),
    caption: String(row.caption || ''),
    position: Number(row.position || 0),
  }
}

export async function addGalleryItem(
  db: D1Database,
  input: { championshipId: string; kind?: string; url: string; caption?: string; position?: number; createdBy?: string },
) {
  await ensureAwardTables(db)
  const id = `cgal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  await db.prepare(
    `INSERT INTO championship_gallery (id, championship_id, kind, url, caption, position, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, input.championshipId, text(input.kind, 20) || 'photo', text(input.url, 500),
    text(input.caption, 300), Number(input.position || 0), text(input.createdBy, 120),
    new Date().toISOString(),
  ).run()
  return id
}

export async function listGallery(db: D1Database, championshipId: string) {
  await ensureAwardTables(db)
  const rows = await db.prepare(
    `SELECT * FROM championship_gallery WHERE championship_id = ? ORDER BY position ASC, created_at ASC`
  ).bind(championshipId).all()
  return (((rows as any).results || []) as Record<string, any>[]).map(mapGalleryRow)
}

/**
 * The public showcase for a finished championship (§10).
 *
 * Only winner-tier badges are exposed; everything else about a participant stays private per
 * §9. That is why this reads from badges rather than from rankings — a badge is the outcome a
 * competition chose to publish, while a ranking row still carries scoring detail.
 */
export async function buildHallOfFame(db: D1Database, championshipId = '') {
  await ensureAwardTables(db)
  const publicBadges = ['winner', 'finalist', 'semi_finalist', 'quarter_finalist']
  const placeholders = publicBadges.map(() => '?').join(', ')

  const rows = championshipId
    ? await db.prepare(
      `SELECT * FROM championship_badges
        WHERE championship_id = ? AND badge_key IN (${placeholders})
        ORDER BY awarded_at DESC LIMIT 300`
    ).bind(championshipId, ...publicBadges).all()
    : await db.prepare(
      `SELECT * FROM championship_badges
        WHERE badge_key IN (${placeholders})
        ORDER BY awarded_at DESC LIMIT 300`
    ).bind(...publicBadges).all()

  const badges = (((rows as any).results || []) as Record<string, any>[]).map(mapBadgeRow)
  return {
    winners: badges.filter(badge => badge.badgeKey === 'winner'),
    finalists: badges.filter(badge => badge.badgeKey === 'finalist'),
    semiFinalists: badges.filter(badge => badge.badgeKey === 'semi_finalist'),
    quarterFinalists: badges.filter(badge => badge.badgeKey === 'quarter_finalist'),
  }
}

/** Championship points across every competition a participant has entered (§40). */
export function totalChampionshipPoints(badges: ReturnType<typeof mapBadgeRow>[]) {
  // Only the highest progress badge per championship counts, so a winner does not also bank
  // the finalist and semi-finalist points for the same competition.
  const bestByChampionship = new Map<string, number>()
  for (const badge of badges) {
    const points = badgePoints(badge.badgeKey)
    const current = bestByChampionship.get(badge.championshipId) || 0
    if (points > current) bestByChampionship.set(badge.championshipId, points)
  }
  return Array.from(bestByChampionship.values()).reduce((sum, points) => sum + points, 0)
}
