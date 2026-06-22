import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sign, verify } from '@tsndr/cloudflare-worker-jwt'
import {
  canTeach,
  deriveCapabilities,
  deriveEmploymentCategory,
  hasRequiredRole,
  hasRequiredCapability,
  isStaff,
  migrateLegacyPasswordIfNeeded,
  normalizeRoleValues,
  verifyPasswordCandidate,
  withHashedPassword,
} from './passwords'
import {
  getSettings, upsertSettings, addAudit, getAuditForStudent, getAllAudits,
  getAllBooks, getBookById, upsertBook, deleteBook, borrowBook, returnBook,
  getBorrowingsForStudent, getAllBorrowings, getClassById, getPostsForClass,
  createPost, getPostById, updatePost, deletePost, addPostComment,
  getAssignmentsForClass, getAssignmentById, createAssignment, updateAssignment, deleteAssignment, getLatestSubmissionForStudent, createSubmission,
  getMaterialsForClass, getMaterialById, addMaterial, updateMaterial, deleteMaterial, getAttendanceForClass, recordAttendance, saveContent,
  getAttendance, upsertAttendance, updateAttendance, getConversations,
  createConversation, getMessages, sendMessage, markMessagesRead, listConversationReadStates,
  listSchoolAnnouncements, createSchoolAnnouncement,
  getTuckOrders, createTuckOrder, updateTuckOrder, getWeeklyTuckSummary,
  createTenant, getTenantById, getTenantByOwnerEmail, getTenantBySubdomain, getTenantByWebsiteHost,
  listTenants, updateTenant, listTenantDiscountCodes, getTenantDiscountCode,
  upsertTenantDiscountCode, incrementTenantDiscountCodeRedemption,
  createTenantPayment, getTenantPaymentByTxRef, listTenantPayments,
  updateTenantPayment, getLiveSessionsForClass, createLiveSession, updateLiveSessionStatus,
} from './db'
import {
  ensureResultsTables,
  getResultSettings,
  saveResultSettings,
  getResultBatch,
  listResultBatches,
  upsertResultEntries,
  listResultEntries,
  upsertResultStudentProfiles,
  listResultStudentProfiles,
  updateResultBatchStatus,
  saveResultPublications,
  listStudentResultPublications,
  saveResultDocuments,
  listStudentResultDocuments,
  listRecentResultDocuments,
  listResultDocumentsForPeriod,
} from './results'
import {
  ensureLessonPlanTables,
  getLessonPlanById,
  listLessonPlans,
  upsertLessonPlan,
  reviewLessonPlan,
} from './lessonPlans'
import {
  ensureNewsroomTables,
  getSchoolNewsPostById,
  getSchoolNewsEngagement,
  listSchoolNewsPosts,
  publishSchoolNewsPost,
  recordSchoolNewsEngagement,
  reviewSchoolNewsPost,
  saveSchoolNewsPost,
  submitSchoolNewsPost,
} from './newsroom'
import {
  buildPracticeQuestionFeed,
  deleteCbtExam,
  deleteQuestionFromBank,
  getCbtExamById,
  listCbtExams,
  listQuestionBankQuestions,
  saveCbtExam,
  saveQuestionToBank,
  startCbtExam,
  submitCbtExamAttempt,
  syncQuestionUsagesForEngine,
} from './questionBank'
import {
  AI_GLOBAL_SETTINGS_KEY,
  consumeAiAccess,
  getAiPaymentRecord,
  getResolvedAiBillingPolicy,
  getTenantAiBillingSettingsKey,
  grantAiCredits,
  isAcademicOnlyPrompt,
  normalizeAiBillingPolicy,
  saveAiPaymentRecord,
  summarizeAiAccess,
} from './aiTutor'

type Bindings = {
  APP_DB: D1Database
  SESSIONS: KVNamespace
  UPLOADS: R2Bucket
  AI?: {
    run: (model: string, inputs: Record<string, any>) => Promise<any>
  }
  NVIDIA_API_KEY?: string
  NVIDIA_API_BASE_URL?: string
  NVIDIA_STUDENT_AI_MODEL?: string
  JWT_SECRET: string
  CORS_ORIGIN: string
  PASSWORD_RESET_BASE_URL?: string
  FLUTTERWAVE_SECRET_KEY?: string
  FLUTTERWAVE_REDIRECT_BASE_URL?: string
  TENANT_BASE_DOMAIN?: string
  ZOHO_MAIL_ACCOUNT_ID?: string
  ZOHO_MAIL_FROM_ADDRESS?: string
  ZOHO_MAIL_CLIENT_ID?: string
  ZOHO_MAIL_CLIENT_SECRET?: string
  ZOHO_MAIL_REFRESH_TOKEN?: string
  WEB_PUSH_VAPID_PUBLIC_KEY?: string
  WEB_PUSH_VAPID_PRIVATE_KEY?: string
  WEB_PUSH_SUBJECT?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Module-level guard: ensure*Table functions are idempotent DDL. Running them on every
// request burns D1 CPU budget needlessly (each has 3–8 DDL statements). Track which
// tables have been initialised for this isolate lifetime so subsequent calls are free.
// Cloudflare reuses isolates across requests, so this persists until the Worker is redeployed.
const _initializedTables = new Set<string>()
const AUTH_COOKIE_NAME = 'ndovera_token'
const DEFAULT_AUTH_SESSION_SECONDS = 30 * 24 * 60 * 60
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000
const SCHOOL_ANNOUNCEMENT_CREATOR_ROLES = ['owner', 'hos', 'ict']
const PASSWORD_RESET_TOKENS_DDL = `CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  requested_ip TEXT,
  user_agent TEXT
)`

function getCookieValue(header: string | undefined | null, name: string) {
  if (!header) return ''
  const parts = header.split(';').map(part => part.trim())
  const match = parts.find(part => part.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

function normalizeHostname(value: unknown) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''

  try {
    const parsed = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`)
    return String(parsed.hostname || '').trim().toLowerCase().replace(/\.$/, '')
  } catch {
    return raw.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '')
  }
}

function stripLeadingWww(hostname: string) {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname
}

function resolveAuthSessionSeconds(env?: Partial<Bindings> | null) {
  const rawValue = Number(env?.SESSION_TTL_SECONDS || DEFAULT_AUTH_SESSION_SECONDS)
  return Number.isFinite(rawValue) && rawValue > 0 ? Math.floor(rawValue) : DEFAULT_AUTH_SESSION_SECONDS
}

function authCookie(token: string, requestUrl: string | URL | null = null, baseDomain = DEFAULT_TENANT_BASE_DOMAIN, maxAgeSeconds = DEFAULT_AUTH_SESSION_SECONDS) {
  const normalizedBaseDomain = normalizeHostname(baseDomain) || DEFAULT_TENANT_BASE_DOMAIN
  const requestHost = normalizeHostname(requestUrl instanceof URL ? requestUrl.hostname : requestUrl || '')
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'Secure',
    'SameSite=Lax',
  ]

  if (requestHost && (requestHost === normalizedBaseDomain || requestHost.endsWith(`.${normalizedBaseDomain}`))) {
    parts.splice(2, 0, `Domain=.${normalizedBaseDomain}`)
  }

  return parts.join('; ')
}

function escapePasswordResetHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getPasswordResetBaseUrl(env: Bindings) {
  const configured = String(env.PASSWORD_RESET_BASE_URL || '').trim()
  return configured || 'https://ndovera.com/reset-password'
}

function isEligibleSelfServeReset(role: unknown, accountType: unknown) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  const normalizedAccountType = String(accountType || '').trim().toLowerCase()
  return normalizedRole === 'owner' || normalizedRole === 'ami' || normalizedAccountType === 'superadmin'
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function fromBase64Url(value: string) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(String(value || '').length / 4) * 4, '=')

  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function sanitizeProfileText(value: unknown, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeIsoDateValue(value: unknown) {
  const normalized = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : ''
}

function normalizeProfileBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  const normalized = String(value || '').trim().toLowerCase()
  if (['true', '1', 'yes', 'required'].includes(normalized)) return true
  if (['false', '0', 'no', 'optional', 'not_required'].includes(normalized)) return false
  return false
}

function buildAdmissionProfileRecord(settings: Record<string, any> = {}, row: Record<string, any> = {}) {
  const profile = settings?.profile && typeof settings.profile === 'object'
    ? settings.profile as Record<string, any>
    : {}

  return {
    id: String(profile.id || row.id || '').trim(),
    name: sanitizeProfileText(profile.name ?? settings.name ?? row.name, 160),
    email: sanitizeProfileText(profile.email ?? settings.email ?? row.email, 180),
    avatar: sanitizeProfileText(profile.avatar ?? settings.avatar ?? settings.avatarUrl, 2048),
    dateOfBirth: normalizeIsoDateValue(profile.dateOfBirth ?? settings.dateOfBirth),
    gender: sanitizeProfileText(profile.gender ?? settings.gender, 80),
    phone: sanitizeProfileText(profile.phone ?? settings.phone, 60),
    address: sanitizeProfileText(profile.address ?? settings.address, 240),
    relationship: sanitizeProfileText(profile.relationship ?? settings.relationship, 120),
    nationality: sanitizeProfileText(profile.nationality, 120),
    stateOfOrigin: sanitizeProfileText(profile.stateOfOrigin, 120),
    religion: sanitizeProfileText(profile.religion, 120),
    bloodGroup: sanitizeProfileText(profile.bloodGroup, 16),
    parentName: sanitizeProfileText(profile.parentName, 160),
    parentEmail: sanitizeProfileText(profile.parentEmail, 180),
    parentPhone: sanitizeProfileText(profile.parentPhone, 60),
    emergencyContactName: sanitizeProfileText(profile.emergencyContactName, 160),
    emergencyContactPhone: sanitizeProfileText(profile.emergencyContactPhone, 60),
    previousSchool: sanitizeProfileText(profile.previousSchool, 240),
    strengths: sanitizeProfileText(profile.strengths, 500),
    allergies: sanitizeProfileText(profile.allergies, 500),
    conditions: sanitizeProfileText(profile.conditions, 500),
    medicalNotes: sanitizeProfileText(profile.medicalNotes, 500),
    senNeeds: sanitizeProfileText(profile.senNeeds, 500),
    talents: sanitizeProfileText(profile.talents, 500),
    transportRequired: normalizeProfileBoolean(profile.transportRequired),
    transportArea: sanitizeProfileText(profile.transportArea, 240),
    hostelRequired: normalizeProfileBoolean(profile.hostelRequired),
    hostelNotes: sanitizeProfileText(profile.hostelNotes, 500),
    registrationPlan: sanitizeProfileText(profile.registrationPlan, 120),
    preferredExamDate: normalizeIsoDateValue(profile.preferredExamDate),
  }
}

function mergeAdmissionProfileRecord(existingProfile: Record<string, any>, payload: Record<string, any> = {}) {
  const source = payload?.profile && typeof payload.profile === 'object'
    ? payload.profile as Record<string, any>
    : payload
  const nextProfile = { ...existingProfile }

  if (source.name !== undefined) nextProfile.name = sanitizeProfileText(source.name, 160)
  if (source.avatar !== undefined) nextProfile.avatar = sanitizeProfileText(source.avatar, 2048)
  if (source.dateOfBirth !== undefined) nextProfile.dateOfBirth = normalizeIsoDateValue(source.dateOfBirth)
  if (source.gender !== undefined) nextProfile.gender = sanitizeProfileText(source.gender, 80)
  if (source.phone !== undefined) nextProfile.phone = sanitizeProfileText(source.phone, 60)
  if (source.address !== undefined) nextProfile.address = sanitizeProfileText(source.address, 240)
  if (source.relationship !== undefined) nextProfile.relationship = sanitizeProfileText(source.relationship, 120)
  if (source.nationality !== undefined) nextProfile.nationality = sanitizeProfileText(source.nationality, 120)
  if (source.stateOfOrigin !== undefined) nextProfile.stateOfOrigin = sanitizeProfileText(source.stateOfOrigin, 120)
  if (source.religion !== undefined) nextProfile.religion = sanitizeProfileText(source.religion, 120)
  if (source.bloodGroup !== undefined) nextProfile.bloodGroup = sanitizeProfileText(source.bloodGroup, 16)
  if (source.parentName !== undefined) nextProfile.parentName = sanitizeProfileText(source.parentName, 160)
  if (source.parentEmail !== undefined) nextProfile.parentEmail = sanitizeProfileText(source.parentEmail, 180)
  if (source.parentPhone !== undefined) nextProfile.parentPhone = sanitizeProfileText(source.parentPhone, 60)
  if (source.emergencyContactName !== undefined) nextProfile.emergencyContactName = sanitizeProfileText(source.emergencyContactName, 160)
  if (source.emergencyContactPhone !== undefined) nextProfile.emergencyContactPhone = sanitizeProfileText(source.emergencyContactPhone, 60)
  if (source.previousSchool !== undefined) nextProfile.previousSchool = sanitizeProfileText(source.previousSchool, 240)
  if (source.strengths !== undefined) nextProfile.strengths = sanitizeProfileText(source.strengths, 500)
  if (source.allergies !== undefined) nextProfile.allergies = sanitizeProfileText(source.allergies, 500)
  if (source.conditions !== undefined) nextProfile.conditions = sanitizeProfileText(source.conditions, 500)
  if (source.medicalNotes !== undefined) nextProfile.medicalNotes = sanitizeProfileText(source.medicalNotes, 500)
  if (source.senNeeds !== undefined) nextProfile.senNeeds = sanitizeProfileText(source.senNeeds, 500)
  if (source.talents !== undefined) nextProfile.talents = sanitizeProfileText(source.talents, 500)
  if (source.transportRequired !== undefined) nextProfile.transportRequired = normalizeProfileBoolean(source.transportRequired)
  if (source.transportArea !== undefined) nextProfile.transportArea = sanitizeProfileText(source.transportArea, 240)
  if (source.hostelRequired !== undefined) nextProfile.hostelRequired = normalizeProfileBoolean(source.hostelRequired)
  if (source.hostelNotes !== undefined) nextProfile.hostelNotes = sanitizeProfileText(source.hostelNotes, 500)
  if (source.registrationPlan !== undefined) nextProfile.registrationPlan = sanitizeProfileText(source.registrationPlan, 120)
  if (source.preferredExamDate !== undefined) nextProfile.preferredExamDate = normalizeIsoDateValue(source.preferredExamDate)

  return nextProfile
}

async function ensurePasswordResetTokensTable(db: D1Database) {
  if (_initializedTables.has('password_reset_tokens')) return
  _initializedTables.add('password_reset_tokens')
  await db.prepare(PASSWORD_RESET_TOKENS_DDL).run()
}

async function createPasswordResetToken(
  db: D1Database,
  email: string,
  role: string,
  metadata: { requestedIp?: string; userAgent?: string } = {},
) {
  await ensurePasswordResetTokensTable(db)

  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString()

    await syncQuestionUsagesForEngine(c.env.APP_DB, String(classRow.tenantId || tenantId || '').trim(), 'assignment', String(insertedAssignment.id || ''), normalizedQuestions, {
      classId: classroomId,
      className: `${classRow.name}${classRow.arm ? ` ${classRow.arm}` : ''}`,
      subjectId: String(subjectRow.id || ''),
      subjectName: String(subjectRow.name || ''),
      createdBy: teacherId,
    })

  const rawToken = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256Hex(rawToken)

  await db.prepare(
    `INSERT INTO password_reset_tokens (id, email, role, token_hash, expires_at, used_at, created_at, requested_ip, user_agent)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`
  )
    .bind(
      `password-reset-${crypto.randomUUID()}`,
      email,
      role,
      tokenHash,
      expiresAt,
      createdAt,
      metadata.requestedIp || null,
      metadata.userAgent || null,
    )
    .run()

  return { token: rawToken, expiresAt }
}

async function getPasswordResetTokenRecord(db: D1Database, rawToken: string) {
  await ensurePasswordResetTokensTable(db)
  const tokenHash = await sha256Hex(String(rawToken || '').trim())
  return db.prepare(
    `SELECT id, email, role, expires_at as expiresAt, used_at as usedAt, created_at as createdAt
     FROM password_reset_tokens
     WHERE token_hash = ?
     LIMIT 1`
  ).bind(tokenHash).first() as Promise<Record<string, any> | null>
}

async function markPasswordResetTokenUsed(db: D1Database, tokenId: string) {
  await ensurePasswordResetTokensTable(db)
  await db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`).bind(new Date().toISOString(), tokenId).run()
}

async function getZohoAccessToken(env: Bindings) {
  const clientId = String(env.ZOHO_MAIL_CLIENT_ID || '').trim()
  const clientSecret = String(env.ZOHO_MAIL_CLIENT_SECRET || '').trim()
  const refreshToken = String(env.ZOHO_MAIL_REFRESH_TOKEN || '').trim()

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho Mail credentials are not configured. Set ZOHO_MAIL_CLIENT_ID, ZOHO_MAIL_CLIENT_SECRET, and ZOHO_MAIL_REFRESH_TOKEN secrets.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => '')
    throw new Error(`Zoho token refresh failed: ${errorText}`)
  }

  const tokenData = await tokenResponse.json() as Record<string, any>
  const accessToken = String(tokenData.access_token || '').trim()
  if (!accessToken) throw new Error('Zoho token refresh returned no access_token.')
  return accessToken
}

async function sendZohoPasswordResetEmail(env: Bindings, payload: { to: string; name: string; resetUrl: string }) {
  const accountId = String(env.ZOHO_MAIL_ACCOUNT_ID || '').trim()
  const fromAddress = String(env.ZOHO_MAIL_FROM_ADDRESS || '').trim()

  if (!accountId || !fromAddress) {
    throw new Error('ZOHO_MAIL_ACCOUNT_ID and ZOHO_MAIL_FROM_ADDRESS must be set.')
  }

  const accessToken = await getZohoAccessToken(env)

  const recipientName = escapePasswordResetHtml(payload.name || payload.to)
  const safeResetUrl = escapePasswordResetHtml(payload.resetUrl)
  const emailBody = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#191970;line-height:1.6;max-width:640px;margin:0 auto;padding:24px;background:#fff8ef;border:1px solid rgba(201,169,110,0.45);border-radius:24px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#b08d2d;">NDOVERA</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#191970;">Reset your password</h1>
      <p style="margin:0 0 16px;">Hello ${recipientName},</p>
      <p style="margin:0 0 20px;">Use the button below to set a new password for your NDOVERA account.</p>
      <p style="margin:0 0 24px;">
        <a href="${safeResetUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#1a5c38;color:#ffffff;text-decoration:none;font-weight:700;">Reset Password</a>
      </p>
      <p style="margin:0 0 10px;">If the button does not open, use this link:</p>
      <p style="margin:0 0 18px;word-break:break-word;"><a href="${safeResetUrl}" style="color:#b08d2d;">${safeResetUrl}</a></p>
      <p style="margin:0;font-size:14px;color:#31416f;">This link expires in 30 minutes.</p>
    </div>
  `.trim()

  const response = await fetch(`https://mail.zoho.com/api/accounts/${encodeURIComponent(accountId)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: JSON.stringify({
      fromAddress,
      toAddress: payload.to,
      subject: 'NDOVERA password reset',
      content: emailBody,
      mailFormat: 'html',
      encoding: 'UTF-8',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || 'Zoho email request failed.')
  }
}

// R2 file proxy — serves uploaded files at /files/:key
app.get('/files/*', async (c) => {
  const key = c.req.path.replace(/^\/files\//, '')
  if (!key) return c.json({ error: 'Not found' }, 404)
  try {
    const obj = await c.env.UPLOADS.get(key)
    if (!obj) return c.json({ error: 'Not found' }, 404)
    const contentType = obj.httpMetadata?.contentType || 'application/octet-stream'
    return new Response(obj.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return c.json({ error: 'Not found' }, 404)
  }
})

const headerFallbackByRole: Record<string, any> = {}

const studentDashboardFallback = {
  studentName: 'David',
  roleWatermark: 'STUDENT',
  metrics: [
    { label: 'Tasks To Do', value: '4', accent: 'accent-amber' },
    { label: 'Attendance', value: '98%', accent: 'accent-emerald' },
    { label: 'Latest Score', value: 'A-', accent: 'accent-indigo' },
    { label: 'Auras', value: '320', accent: 'accent-rose' },
  ],
  quickLinks: [
    { name: 'Classroom', path: '/roles/student/classroom' },
    { name: 'Practice', path: '/roles/student/practice' },
    { name: 'Assignments', path: '/roles/student/assignments' },
    { name: 'Materials', path: '/roles/student/materials' },
    { name: 'Results', path: '/roles/student/results' },
  ],
  notices: [
    { text: 'Math assignment is due today.', time: 'Due Today', accent: 'accent-amber' },
    { text: 'Biology quiz starts in 2 days.', time: 'Upcoming', accent: 'accent-indigo' },
    { text: 'Your attendance this week is very good.', time: 'Great Job', accent: 'accent-emerald' },
  ],
}

const KOBO_PER_NAIRA = 100
const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3'
const TENANT_BASE_SETUP_FEE_CENTS = 50000 * KOBO_PER_NAIRA
const TENANT_BASE_STUDENT_FEE_CENTS = 500 * KOBO_PER_NAIRA
const DEFAULT_TENANT_BASE_DOMAIN = 'ndovera.com'
const TENANT_PRICING_SETTINGS_KEY = 'system:tenant-pricing'

function buildDefaultTenantWebsiteHost(tenant: Record<string, any> | null | undefined, baseDomain: string) {
  const requestedSubdomain = normalizeSubdomain(String(tenant?.requestedSubdomain || ''))
  const normalizedBaseDomain = normalizeHostname(baseDomain) || DEFAULT_TENANT_BASE_DOMAIN
  if (!requestedSubdomain) return normalizedBaseDomain
  return `${requestedSubdomain}.${normalizedBaseDomain}`
}

function resolveTenantWebsiteHost(tenant: Record<string, any> | null | undefined, baseDomain: string) {
  const configuredHost = normalizeHostname(tenant?.websiteDomain)
  return configuredHost || buildDefaultTenantWebsiteHost(tenant, baseDomain)
}

function buildTenantWebsiteUrl(tenant: Record<string, any> | null | undefined, baseDomain: string) {
  const host = resolveTenantWebsiteHost(tenant, baseDomain)
  return host ? `https://${host}` : `https://${normalizeHostname(baseDomain) || DEFAULT_TENANT_BASE_DOMAIN}`
}

function extractTenantSubdomainFromHost(hostname: string, baseDomain: string) {
  const normalizedHost = normalizeHostname(hostname)
  const normalizedBaseDomain = normalizeHostname(baseDomain)
  if (!normalizedHost || !normalizedBaseDomain) return ''

  const suffix = `.${normalizedBaseDomain}`
  if (!normalizedHost.endsWith(suffix)) return ''

  const prefix = normalizedHost.slice(0, -suffix.length)
  const candidate = stripLeadingWww(prefix)
  return candidate && !candidate.includes('.') ? candidate : ''
}

function isPlatformHost(hostname: string, baseDomain: string) {
  const normalizedHost = normalizeHostname(hostname)
  const normalizedBaseDomain = normalizeHostname(baseDomain)
  return normalizedHost === normalizedBaseDomain || normalizedHost === `www.${normalizedBaseDomain}`
}

function isCustomTenantHost(hostname: string, baseDomain: string) {
  const normalizedHost = normalizeHostname(hostname)
  const normalizedBaseDomain = normalizeHostname(baseDomain)
  if (!normalizedHost || !normalizedBaseDomain) return false
  return !isPlatformHost(normalizedHost, normalizedBaseDomain) && !normalizedHost.endsWith(`.${normalizedBaseDomain}`)
}

function buildPlatformAuthUrl(path: string, tenantReturnUrl = '') {
  const target = new URL(`https://${DEFAULT_TENANT_BASE_DOMAIN}${path}`)
  if (tenantReturnUrl) target.searchParams.set('tenantReturnUrl', tenantReturnUrl)
  return target.toString()
}

const TENANT_PLANS: Record<string, any> = {
  growth: {
    key: 'growth',
    label: 'Growth',
    description: 'Fast onboarding for growing schools that want a standard NDOVERA launch.',
    setupFeeCents: TENANT_BASE_SETUP_FEE_CENTS,
    studentFeeCents: TENANT_BASE_STUDENT_FEE_CENTS,
    features: ['Owner portal', 'School website activation', 'Tenant governance support'],
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    description: 'Custom rollout with an Ami-managed onboarding fee that can be adjusted at any time before payment.',
    setupFeeCents: TENANT_BASE_SETUP_FEE_CENTS,
    studentFeeCents: TENANT_BASE_STUDENT_FEE_CENTS,
    features: ['Tailored onboarding', 'Custom rollout notes', 'Ami review required'],
    requiresManualReview: true,
    manualPricing: true,
  },
}

async function getTenantPricingConfig(db: D1Database) {
  const existing = await getSettings(db, TENANT_PRICING_SETTINGS_KEY)
  const customPlanSetupFeeCents = Number(existing?.customPlanSetupFeeCents || 0)

  return {
    customPlanSetupFeeCents: Number.isFinite(customPlanSetupFeeCents) && customPlanSetupFeeCents > 0
      ? Math.round(customPlanSetupFeeCents)
      : TENANT_BASE_SETUP_FEE_CENTS,
    customPlanSetupFee: (Number.isFinite(customPlanSetupFeeCents) && customPlanSetupFeeCents > 0
      ? Math.round(customPlanSetupFeeCents)
      : TENANT_BASE_SETUP_FEE_CENTS) / KOBO_PER_NAIRA,
    updatedAt: existing?.updatedAt || null,
    updatedBy: existing?.updatedBy || null,
  }
}

async function saveTenantPricingConfig(db: D1Database, updates: Record<string, any>, updatedBy: string) {
  const current = await getTenantPricingConfig(db)
  const next = {
    customPlanSetupFeeCents: typeof updates.customPlanSetupFeeCents === 'number' && updates.customPlanSetupFeeCents > 0
      ? Math.round(updates.customPlanSetupFeeCents)
      : current.customPlanSetupFeeCents,
    updatedAt: new Date().toISOString(),
    updatedBy,
  }

  await upsertSettings(db, TENANT_PRICING_SETTINGS_KEY, next)
  return getTenantPricingConfig(db)
}

function buildTenantPlans(pricingConfig: Record<string, any>) {
  return {
    growth: {
      ...TENANT_PLANS.growth,
      manualPricing: false,
    },
    custom: {
      ...TENANT_PLANS.custom,
      setupFeeCents: pricingConfig.customPlanSetupFeeCents,
      manualPricing: true,
    },
  }
}

function serializeTenantPlans(plans: Record<string, any>) {
  return Object.values(plans).map(plan => ({
    key: plan.key,
    label: plan.label,
    description: plan.description,
    setupFee: plan.setupFeeCents / KOBO_PER_NAIRA,
    studentFeePerTerm: plan.studentFeeCents / KOBO_PER_NAIRA,
    requiresManualReview: Boolean(plan.requiresManualReview),
    features: plan.features,
    manualPricing: Boolean(plan.manualPricing),
  }))
}

async function getTenantPricingState(db: D1Database) {
  const pricingConfig = await getTenantPricingConfig(db)
  return {
    pricingConfig,
    plans: buildTenantPlans(pricingConfig),
  }
}

function slugifyValue(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeSubdomain(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function isDiscountActive(discountCode: any, planKey: string) {
  if (!discountCode || !discountCode.active) return false

  const now = new Date().toISOString()
  if (discountCode.startsAt && discountCode.startsAt > now) return false
  if (discountCode.endsAt && discountCode.endsAt < now) return false
  if (typeof discountCode.maxRedemptions === 'number' && discountCode.maxRedemptions > 0 && discountCode.redemptionCount >= discountCode.maxRedemptions) {
    return false
  }

  if (!discountCode.planScope) return true
  return String(discountCode.planScope)
    .split(',')
    .map((item: string) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(planKey)
}

function buildTenantQuote(planKey: string, billableUserCount: number, discountCode?: any, plans: Record<string, any> = TENANT_PLANS, userCounts: Record<string, number> = {}) {
  const plan = plans[planKey]
  if (!plan) {
    throw new Error('Unsupported tenant plan.')
  }

  const safeBillableUserCount = Math.max(0, Number(billableUserCount || 0))
  const activeDiscount = isDiscountActive(discountCode, planKey) ? discountCode : null
  const setupFeeCents = activeDiscount?.setupFeeCents ?? plan.setupFeeCents
  const studentFeeCents = activeDiscount?.studentFeeCents ?? plan.studentFeeCents
  const termTotalCents = safeBillableUserCount * studentFeeCents
  const totalDueNowCents = setupFeeCents

  return {
    planKey,
    planName: plan.label,
    description: plan.description,
    features: plan.features,
    requiresManualReview: Boolean(plan.requiresManualReview),
    studentCount: safeBillableUserCount,
    billableUserCount: safeBillableUserCount,
    userCounts,
    currency: 'NGN',
    setupFeeCents,
    setupFee: setupFeeCents / KOBO_PER_NAIRA,
    studentFeeCents,
    studentFeePerTerm: studentFeeCents / KOBO_PER_NAIRA,
    userFeePerTerm: studentFeeCents / KOBO_PER_NAIRA,
    termTotalCents,
    termTotal: termTotalCents / KOBO_PER_NAIRA,
    nextTermStudentBillingCents: termTotalCents,
    nextTermStudentBilling: termTotalCents / KOBO_PER_NAIRA,
    nextTermUserBillingCents: termTotalCents,
    nextTermUserBilling: termTotalCents / KOBO_PER_NAIRA,
    totalDueNowCents,
    totalDueNow: totalDueNowCents / KOBO_PER_NAIRA,
    discountCode: activeDiscount?.code || null,
    discountApplied: Boolean(activeDiscount),
    discountSnapshot: activeDiscount ? {
      code: activeDiscount.code,
      name: activeDiscount.name,
      description: activeDiscount.description,
      setupFeeCents: activeDiscount.setupFeeCents,
      studentFeeCents: activeDiscount.studentFeeCents,
      startsAt: activeDiscount.startsAt,
      endsAt: activeDiscount.endsAt,
    } : null,
  }
}

function deriveTenantLifecycleState(approvalStatus: string, paymentStatus: string, suspendedAt?: string | null) {
  if (suspendedAt) {
    return {
      status: 'suspended',
      websiteStatus: 'inactive',
      dashboardActive: false,
    }
  }

  if (approvalStatus === 'approved' && paymentStatus === 'paid') {
    return {
      status: 'active',
      websiteStatus: 'active',
      dashboardActive: true,
    }
  }

  if (approvalStatus === 'approved') {
    return {
      status: 'approved_pending_payment',
      websiteStatus: 'inactive',
      dashboardActive: false,
    }
  }

  if (paymentStatus === 'paid') {
    return {
      status: 'pending_approval',
      websiteStatus: 'inactive',
      dashboardActive: false,
    }
  }

  return {
    status: 'pending_payment',
    websiteStatus: 'inactive',
    dashboardActive: false,
  }
}

function attachTenantContext(user: Record<string, any>, tenant: any) {
  if (!tenant) return user

  return {
    ...user,
    tenantId: tenant.id,
    schoolId: tenant.id,
    schoolName: tenant.schoolName,
    tenantStatus: tenant.status,
    approvalStatus: tenant.approvalStatus,
    paymentStatus: tenant.paymentStatus,
    websiteStatus: tenant.websiteStatus,
    websiteDomain: tenant.websiteDomain,
    requestedSubdomain: tenant.requestedSubdomain,
    planKey: tenant.planKey,
    studentCount: tenant.studentCount,
    dashboardActive: tenant.status === 'active',
  }
}

async function resolveDiscountCode(db: D1Database, code: string | undefined, planKey: string) {
  if (!code) return null

  const discountCode = await getTenantDiscountCode(db, code.toUpperCase())
  if (!isDiscountActive(discountCode, planKey)) {
    return null
  }

  return discountCode
}

async function resolveTenantForActor(c: any, requestedTenantId?: string) {
  const currentUser = c.var.user || {}
  const actorId = currentUser.id || currentUser.sub || currentUser.email
  if (!actorId) {
    return { actorId: null, settings: null, role: getActiveRole(currentUser), tenant: null, forbidden: false }
  }

  const settings = await getSettings(c.env.APP_DB, actorId)
  const role = normalizeRole(settings?.role) || getActiveRole(currentUser)

  if (role === 'ami') {
    const tenant = requestedTenantId ? await getTenantById(c.env.APP_DB, requestedTenantId) : null
    return { actorId, settings, role, tenant, forbidden: false }
  }

  const tenantId = settings?.tenantId || settings?.schoolId
  const tenant = tenantId
    ? await getTenantById(c.env.APP_DB, tenantId)
    : await getTenantByOwnerEmail(c.env.APP_DB, actorId)

  if (requestedTenantId && tenant?.id !== requestedTenantId) {
    return { actorId, settings, role, tenant: null, forbidden: true }
  }

  return { actorId, settings, role, tenant, forbidden: false }
}

const RESULT_SETTINGS_EDITOR_ROLES = ['owner', 'hos', 'ict', 'ict_manager']
const RESULT_ENTRY_EDITOR_ROLES = ['teacher', 'classteacher', 'owner', 'hos', 'ict', 'ict_manager']
const RESULT_APPROVER_ROLES = ['owner', 'hos']
const RESULT_DOCUMENT_UPLOADER_ROLES = ['owner', 'hos', 'ict', 'ict_manager']

const RESULT_TEMPLATE_CATALOG = [
  {
    key: 'premium-ledger',
    name: 'Premium Academic Ledger',
    description: 'Formal ledger layout with strong headers, wide subject tables, and signature space for official printing.',
    preview: {
      mood: 'Formal',
      strengths: ['Large summary strip', 'Broad subject table', 'Signature block and QR area'],
    },
  },
  {
    key: 'glass-crest',
    name: 'Glass Crest Report',
    description: 'Modern layered report sheet with highlight cards for term summary, affective scores, and approval workflow.',
    preview: {
      mood: 'Modern',
      strengths: ['Hero summary card', 'Segmented domains', 'Parent-friendly visual grouping'],
    },
  },
  {
    key: 'montessori-grid',
    name: 'Montessori Grid',
    description: 'Soft structured template for early years and primary with rating grids and narrative remarks.',
    preview: {
      mood: 'Foundational',
      strengths: ['Narrative-friendly', 'Affective emphasis', 'Clean print spacing'],
    },
  },
]

const RESULT_DEFAULT_GRADING_SCALE = [
  { minScore: 85, grade: 'A', remark: 'Excellent' },
  { minScore: 75, grade: 'B+', remark: 'Very Good' },
  { minScore: 65, grade: 'B', remark: 'Good' },
  { minScore: 55, grade: 'C+', remark: 'Credit' },
  { minScore: 45, grade: 'C', remark: 'Pass' },
  { minScore: 0, grade: 'D', remark: 'Needs Improvement' },
]

const RESULT_DEFAULT_RATING_SCALE = [
  { value: 5, label: 'Outstanding' },
  { value: 4, label: 'Very Good' },
  { value: 3, label: 'Good' },
  { value: 2, label: 'Fair' },
  { value: 1, label: 'Needs Attention' },
]

const RESULT_DEFAULT_AFFECTIVE_SCALE = [
  { value: 5, label: 'Excellent' },
  { value: 4, label: 'Very Good' },
  { value: 3, label: 'Good' },
  { value: 2, label: 'Fair' },
  { value: 1, label: 'Weak' },
]

const RESULT_DEFAULT_AFFECTIVE_DOMAINS = [
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'neatness', label: 'Neatness' },
  { key: 'honesty', label: 'Honesty' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'relationship_with_others', label: 'Relationship With Others' },
]

const RESULT_DEFAULT_RATING_DOMAINS = [
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'attention', label: 'Attention' },
  { key: 'creativity', label: 'Creativity' },
]

const RESULT_DEFAULT_CA_COMPONENTS = [
  { key: 'homework', label: 'Homework', maxScore: 10 },
  { key: 'quiz', label: 'Quiz', maxScore: 15 },
  { key: 'classwork', label: 'Classwork', maxScore: 15 },
]

const RESULT_DEFAULT_BRANDING = {
  schoolName: '',
  reportTitle: 'Official Result Record',
  logoUrl: '',
  primaryColor: '#14215b',
  accentColor: '#1a5c38',
}

const RESULT_DEFAULT_SCORE_LIMITS = {
  caMaxScore: 40,
  examMaxScore: 60,
}

function normalizeResultDomainKey(value: unknown, fallback: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback
}

function normalizeResultDomainList(values: unknown, fallback: Record<string, any>[] = [], limit = 8) {
  const base = Array.isArray(values) && values.length > 0 ? values : fallback
  return base
    .slice(0, limit)
    .map((entry, index) => ({
      key: normalizeResultDomainKey((entry as any)?.key || (entry as any)?.label, `domain_${index + 1}`),
      label: String((entry as any)?.label || (entry as any)?.key || `Domain ${index + 1}`).trim(),
      description: String((entry as any)?.description || '').trim(),
    }))
    .filter(entry => entry.label)
}

function normalizeResultCaComponentList(values: unknown, fallback: Record<string, any>[] = [], limit = 8, maxScoreCap = RESULT_DEFAULT_SCORE_LIMITS.caMaxScore) {
  const base = Array.isArray(values) && values.length > 0 ? values : fallback
  const normalizedCap = Math.max(1, Number(maxScoreCap || RESULT_DEFAULT_SCORE_LIMITS.caMaxScore))
  return base
    .slice(0, limit)
    .map((entry, index) => ({
      key: normalizeResultDomainKey((entry as any)?.key || (entry as any)?.label, `ca_${index + 1}`),
      label: String((entry as any)?.label || (entry as any)?.key || `CA${index + 1}`).trim(),
      maxScore: Math.max(1, Math.min(normalizedCap, Number((entry as any)?.maxScore || 0) || 0)),
    }))
    .filter(entry => entry.label && entry.maxScore > 0)
}

function ensureResultDomainEntry(values: Record<string, any>[] = [], entry: Record<string, any>, limit = 8) {
  const normalizedKey = normalizeResultDomainKey(entry?.key || entry?.label, String(entry?.key || ''))
  if (!normalizedKey) return values
  if ((values || []).some(value => normalizeResultDomainKey(value?.key || value?.label, '') === normalizedKey)) {
    return values
  }
  if ((values || []).length >= limit) return values
  return [
    ...(values || []),
    {
      key: normalizedKey,
      label: String(entry?.label || entry?.key || normalizedKey).trim(),
    },
  ]
}

function normalizeResultScale(values: unknown, fallback: Record<string, any>[] = []) {
  const base = Array.isArray(values) && values.length > 0 ? values : fallback
  return base
    .map(entry => ({
      minScore: Number((entry as any)?.minScore ?? (entry as any)?.minimum ?? 0),
      grade: String((entry as any)?.grade || '').trim(),
      remark: String((entry as any)?.remark || '').trim(),
      value: Number((entry as any)?.value ?? 0),
      label: String((entry as any)?.label || '').trim(),
    }))
    .filter(entry => entry.grade || entry.label)
}

function normalizeResultColor(value: unknown, fallback: string) {
  const color = String(value || '').trim()
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback
}

function normalizeResultBranding(value: unknown, fallback: Record<string, any> = RESULT_DEFAULT_BRANDING) {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {}
  return {
    schoolName: String(source.schoolName || fallback.schoolName || '').trim(),
    reportTitle: String(source.reportTitle || fallback.reportTitle || 'Official Result Record').trim() || 'Official Result Record',
    logoUrl: String(source.logoUrl || fallback.logoUrl || '').trim(),
    primaryColor: normalizeResultColor(source.primaryColor, String(fallback.primaryColor || RESULT_DEFAULT_BRANDING.primaryColor)),
    accentColor: normalizeResultColor(source.accentColor, String(fallback.accentColor || RESULT_DEFAULT_BRANDING.accentColor)),
  }
}

function normalizeResultScoreLimit(value: unknown, fallback: number) {
  const numeric = Math.round(Number(value ?? fallback))
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(99, numeric))
}

function normalizeResultScoreSettings(value: unknown, fallback: Record<string, any> = RESULT_DEFAULT_SCORE_LIMITS) {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {}
  const caMaxScore = normalizeResultScoreLimit(source.caMaxScore, Number(fallback.caMaxScore || RESULT_DEFAULT_SCORE_LIMITS.caMaxScore))
  const examMaxScore = normalizeResultScoreLimit(source.examMaxScore, Number(fallback.examMaxScore || RESULT_DEFAULT_SCORE_LIMITS.examMaxScore))

  return {
    caMaxScore,
    examMaxScore,
    totalMaxScore: caMaxScore + examMaxScore,
  }
}

function mergeResultBrandingWithTenant(value: unknown, tenantBranding: Record<string, any> = {}) {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {}
  const schoolName = String(tenantBranding.schoolName || source.schoolName || '').trim()
  const logoUrl = String(tenantBranding.logoUrl || source.logoUrl || '').trim()

  return normalizeResultBranding(
    {
      ...source,
      schoolName,
      logoUrl,
    },
    {
      ...RESULT_DEFAULT_BRANDING,
      schoolName,
      logoUrl,
    },
  )
}

function attachTenantBrandingToResultSettings(settings: Record<string, any>, tenantBranding: Record<string, any> = {}) {
  const metadata = settings?.metadata && typeof settings.metadata === 'object' ? settings.metadata : {}
  return {
    ...settings,
    metadata: {
      ...metadata,
      branding: mergeResultBrandingWithTenant(metadata.branding, tenantBranding),
    },
  }
}

async function getTenantSchoolBranding(db: D1Database, tenant: Record<string, any> | null) {
  if (!tenant?.id) {
    return {
      schoolName: '',
      logoUrl: '',
      tagline: '',
      website: '',
      websiteUrl: '',
      subdomain: '',
      facebook: '',
      instagram: '',
      tiktok: '',
      youtube: '',
      whatsapp: '',
    }
  }

  let row: Record<string, any> | null = null
  try {
    await ensureBrandingTable(db)
    row = await db.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as Record<string, any> | null
  } catch {
    row = null
  }

  return mapTenantBranding(tenant, row)
}

function getSuggestedResultSettings() {
  return {
    templateKey: '',
    gradingScale: RESULT_DEFAULT_GRADING_SCALE,
    ratingScale: RESULT_DEFAULT_RATING_SCALE,
    affectiveScale: RESULT_DEFAULT_AFFECTIVE_SCALE,
    affectiveDomains: RESULT_DEFAULT_AFFECTIVE_DOMAINS,
    metadata: {
      affectiveWriteUp: 'Use the affective scale to describe conduct, attitude, and class disposition clearly and consistently.',
      ratingDomains: RESULT_DEFAULT_RATING_DOMAINS,
      caComponents: RESULT_DEFAULT_CA_COMPONENTS,
      caMaxScore: RESULT_DEFAULT_SCORE_LIMITS.caMaxScore,
      examMaxScore: RESULT_DEFAULT_SCORE_LIMITS.examMaxScore,
      branding: RESULT_DEFAULT_BRANDING,
    },
  }
}

function normalizeResultSettingsInput(payload: Record<string, any> = {}) {
  const fallback = getSuggestedResultSettings()
  const knownTemplateKeys = new Set(RESULT_TEMPLATE_CATALOG.map(template => template.key))
  const templateKey = String(payload.templateKey || '').trim()
  const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata as Record<string, any> : {}
  const fallbackMetadata = fallback.metadata && typeof fallback.metadata === 'object' ? fallback.metadata as Record<string, any> : {}
  const scoreSettings = normalizeResultScoreSettings(metadata, fallbackMetadata)

  return {
    templateKey: knownTemplateKeys.has(templateKey) ? templateKey : '',
    gradingScale: normalizeResultScale(payload.gradingScale, fallback.gradingScale)
      .map(entry => ({ minScore: Number(entry.minScore || 0), grade: entry.grade, remark: entry.remark }))
      .sort((left, right) => right.minScore - left.minScore),
    ratingScale: normalizeResultScale(payload.ratingScale, fallback.ratingScale)
      .map(entry => ({ value: Number(entry.value || 0), label: entry.label }))
      .sort((left, right) => right.value - left.value),
    affectiveScale: normalizeResultScale(payload.affectiveScale, fallback.affectiveScale)
      .map(entry => ({ value: Number(entry.value || 0), label: entry.label }))
      .sort((left, right) => right.value - left.value),
    affectiveDomains: ensureResultDomainEntry(
      normalizeResultDomainList(payload.affectiveDomains, fallback.affectiveDomains, 8),
      { key: 'relationship_with_others', label: 'Relationship With Others' },
      8,
    ),
    metadata: {
      ...metadata,
      affectiveWriteUp: String(metadata.affectiveWriteUp || '').trim(),
      ratingDomains: normalizeResultDomainList(metadata.ratingDomains, fallback.metadata.ratingDomains, 8),
      caMaxScore: scoreSettings.caMaxScore,
      examMaxScore: scoreSettings.examMaxScore,
      caComponents: normalizeResultCaComponentList(metadata.caComponents, fallback.metadata.caComponents, 8, scoreSettings.caMaxScore),
      branding: normalizeResultBranding(metadata.branding, fallback.metadata.branding),
    },
  }
}

function validateResultSettings(settings: Record<string, any>) {
  const scoreSettings = normalizeResultScoreSettings(settings?.metadata, RESULT_DEFAULT_SCORE_LIMITS)
  const caComponents = normalizeResultCaComponentList(settings?.metadata?.caComponents, RESULT_DEFAULT_CA_COMPONENTS, 8, scoreSettings.caMaxScore)
  const caComponentMaxTotal = caComponents.reduce((sum, entry) => sum + Number(entry.maxScore || 0), 0)
  if (!String(settings?.templateKey || '').trim()) return 'Choose a result template before CA scores will be accepted.'
  if (!Array.isArray(settings?.gradingScale) || settings.gradingScale.length === 0) return 'Set the grading system before CA scores will be accepted.'
  if (!Array.isArray(settings?.ratingScale) || settings.ratingScale.length === 0) return 'Set the rating scale before CA scores will be accepted.'
  if (!Array.isArray(settings?.affectiveScale) || settings.affectiveScale.length === 0) return 'Set the affective scale before CA scores will be accepted.'
  if (!Array.isArray(settings?.affectiveDomains) || settings.affectiveDomains.length === 0) return 'Add at least one affective domain before CA scores will be accepted.'
  if (settings.affectiveDomains.length > 8) return 'Affective marking can cover at most 8 areas.'
  if (scoreSettings.totalMaxScore !== 100) return 'CA max score and exam max score must add up to 100.'
  if (caComponents.length === 0) return 'Add at least one CA component before CA scores will be accepted.'
  if (caComponentMaxTotal !== scoreSettings.caMaxScore) return `CA component maximum scores must add up to ${scoreSettings.caMaxScore}.`
  if (!String(settings?.metadata?.affectiveWriteUp || '').trim()) return 'Set the affective write-up guide before CA scores will be accepted.'
  return ''
}

function normalizeResultEntryCaComponents(value: unknown, componentDefinitions: Record<string, any>[] = RESULT_DEFAULT_CA_COMPONENTS, fallbackTotal = 0, caMaxScore = RESULT_DEFAULT_SCORE_LIMITS.caMaxScore) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
  const normalized = Object.fromEntries(
    componentDefinitions.map(component => [
      String(component.key || ''),
      clampResultScore(source?.[String(component.key || '')], Number(component.maxScore || 0) || 0),
    ])
  )
  const hasAnyScore = Object.values(normalized).some(score => Number(score || 0) > 0)
  if (!hasAnyScore && Number(fallbackTotal || 0) > 0 && componentDefinitions.length > 0) {
    let remaining = clampResultScore(fallbackTotal, caMaxScore)
    componentDefinitions.forEach(component => {
      const key = String(component.key || '')
      const maxScore = Number(component.maxScore || 0)
      const allocated = Math.max(0, Math.min(remaining, maxScore))
      normalized[key] = allocated
      remaining -= allocated
    })
  }
  return normalized
}

function sumResultEntryCaComponents(componentScores: Record<string, any> = {}, componentDefinitions: Record<string, any> = RESULT_DEFAULT_CA_COMPONENTS, caMaxScore = RESULT_DEFAULT_SCORE_LIMITS.caMaxScore) {
  return clampResultScore(
    componentDefinitions.reduce((sum, component) => sum + Number(componentScores?.[String(component.key || '')] || 0), 0),
    caMaxScore,
  )
}

async function resolveCurrentResultPeriod(db: D1Database, tenantId: string, requestedSessionName?: unknown, requestedTermName?: unknown) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_sessions (id TEXT PRIMARY KEY, tenantId TEXT, session TEXT, term TEXT, startDate TEXT, endDate TEXT, createdAt TEXT)`).run()
  const current = tenantId
    ? await db.prepare(`SELECT session, term FROM school_sessions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1`).bind(tenantId).first() as Record<string, any> | null
    : null

  return {
    sessionName: String(requestedSessionName || current?.session || 'Current Session').trim(),
    termName: String(requestedTermName || current?.term || 'Term 1').trim() || 'Term 1',
  }
}

async function resolveResultClassAccess(db: D1Database, user: Record<string, any>, classId: string) {
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(db, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId
  const actorId = String(resolvedUser.userRow?.id || resolvedUser.userRow?.email || resolvedUser.settingsKey || userIdentifier || '').trim()
  const actorName = String(resolvedUser.settings?.name || resolvedUser.userRow?.name || user.name || actorId).trim()
  const normalizedRole = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()
  const teacherIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(resolvedUser, user))

  await ensureClassesTable(db)
  await db.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
  try { await db.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}

  const classRow = tenantId
    ? await db.prepare(`SELECT id, tenantId, name, arm, classTeacherId FROM classes WHERE id = ? AND tenantId = ?`).bind(classId, tenantId).first() as Record<string, any> | null
    : null
  const subjectRowsResult = classRow
    ? await db.prepare(`SELECT id, name, teacherId FROM subjects WHERE tenantId = ? AND classId = ? ORDER BY name`).bind(tenantId, classId).all().catch(() => ({ results: [] }))
    : { results: [] }
  const subjectRows = ((subjectRowsResult as any)?.results || []) as Record<string, any>[]
  const isElevatedManager = RESULT_SETTINGS_EDITOR_ROLES.includes(normalizedRole) || RESULT_APPROVER_ROLES.includes(normalizedRole)
  const isClassTeacher = Boolean(classRow) && matchesComparableIdentifier(classRow?.classTeacherId, teacherIdentifiers)
  let allowedSubjectRows = subjectRows.filter(subjectRow => matchesComparableIdentifier(subjectRow.teacherId, teacherIdentifiers))
  if (isClassTeacher || isElevatedManager) {
    allowedSubjectRows = subjectRows
  }

  return {
    tenantId,
    actorId,
    actorName,
    normalizedRole,
    resolvedUser,
    classRow,
    subjectRows,
    allowedSubjectRows,
    isClassTeacher,
    isElevatedManager,
    canManageEntries: Boolean(classRow) && (isElevatedManager || isClassTeacher || allowedSubjectRows.length > 0),
    canManageProfiles: Boolean(classRow) && (isElevatedManager || isClassTeacher),
  }
}

async function listResultClassStudents(db: D1Database, tenantId: string, classRow: Record<string, any>) {
  await ensureUsersTable(db)
  const rows = await db.prepare(
    `SELECT id, name, email, role, status, createdAt FROM users WHERE tenantId = ? AND role = 'student' ORDER BY name`
  ).bind(tenantId).all()
  const hydrated = await hydrateUserRecords(db, (rows.results || []) as Record<string, any>[])
  const className = `${classRow.name}${classRow.arm ? ` ${classRow.arm}` : ''}`
  return hydrated
    .filter(student => String(student?.classId || '') === String(classRow.id || ''))
    .map(student => ({
      id: String(student?.id || ''),
      name: String(student?.name || ''),
      email: String(student?.email || ''),
      displayId: String(student?.displayId || ''),
      classId: String(classRow.id || ''),
      className,
      status: String(student?.status || 'active'),
    }))
}

// Lightweight roster used only for matching result PDFs to students. It reads users, their settings
// (batched), class names and is cheap regardless of school size — unlike hydrateUserRecords, which
// does per-student work and made bulk uploads blow past the Worker subrequest/CPU limits (503s).
async function listStudentsForResultMatching(db: D1Database, tenantId: string) {
  await ensureUsersTable(db)
  await ensureClassesTable(db)
  const userResult = await db.prepare(
    `SELECT id, name, email, role, status FROM users WHERE tenantId = ? AND role = 'student' ORDER BY name`
  ).bind(tenantId).all()
  const rows = (userResult.results || []) as Record<string, any>[]
  if (!rows.length) return [] as Array<Record<string, any>>

  const settingsMap = await getSettingsMapForUserRows(db, rows)
  const classResult = await db.prepare(`SELECT id, name, arm FROM classes WHERE tenantId = ?`).bind(tenantId).all().catch(() => ({ results: [] }))
  const classNameById = new Map<string, string>()
  for (const classRow of (((classResult as any)?.results || []) as Record<string, any>[])) {
    classNameById.set(String(classRow.id || ''), `${classRow.name || ''}${classRow.arm ? ` ${classRow.arm}` : ''}`.trim())
  }

  return rows.map(row => {
    const settings = settingsMap.get(String(row.email || '').trim()) || settingsMap.get(String(row.id || '').trim()) || {}
    const classId = String(settings.classId || settings.class_id || '').trim()
    const displayId = String(getPublicFacingUserId(settings, 'student') || settings.publicStudentId || settings.displayId || '').trim()
    return {
      id: String(row.id || ''),
      name: String(row.name || settings.name || ''),
      email: String(row.email || ''),
      displayId,
      classId,
      className: classNameById.get(classId) || '',
      status: String(row.status || 'active'),
    }
  })
}

function clampResultScore(value: unknown, max: number) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(max, numeric))
}

function resolveGradeBand(score: number, gradingScale: Record<string, any>[] = RESULT_DEFAULT_GRADING_SCALE) {
  const ordered = [...gradingScale]
    .map(entry => ({
      minScore: Number(entry.minScore || 0),
      grade: String(entry.grade || '').trim(),
      remark: String(entry.remark || '').trim(),
    }))
    .sort((left, right) => right.minScore - left.minScore)

  return ordered.find(entry => score >= entry.minScore) || ordered[ordered.length - 1] || { grade: '', remark: '' }
}

function buildPublishedResultPayloads(params: {
  students: Array<Record<string, any>>,
  entries: Array<Record<string, any>>,
  profiles: Array<Record<string, any>>,
  settings: Record<string, any>,
  batch: Record<string, any>,
  className: string,
  actorName: string,
  tenantBranding?: Record<string, any>,
}) {
  const gradeScale = normalizeResultScale(params.settings?.gradingScale, RESULT_DEFAULT_GRADING_SCALE)
  const affectiveDomains = normalizeResultDomainList(params.settings?.affectiveDomains, RESULT_DEFAULT_AFFECTIVE_DOMAINS, 8)
  const ratingDomains = normalizeResultDomainList(params.settings?.metadata?.ratingDomains, RESULT_DEFAULT_RATING_DOMAINS, 8)
  const scoreSettings = normalizeResultScoreSettings(params.settings?.metadata, RESULT_DEFAULT_SCORE_LIMITS)
  const caComponents = normalizeResultCaComponentList(params.settings?.metadata?.caComponents, RESULT_DEFAULT_CA_COMPONENTS, 8, scoreSettings.caMaxScore)
  const branding = mergeResultBrandingWithTenant(params.settings?.metadata?.branding, params.tenantBranding)
  const profileMap = new Map(params.profiles.map(profile => [String(profile.studentId || ''), profile]))

  const studentSummaries = params.students.map(student => {
    const studentId = String(student.id || '')
    const profile = profileMap.get(studentId) || {}
    const subjectRows = params.entries
      .filter(entry => String(entry.studentId || '') === studentId)
      .map(entry => {
        const caComponentScores = normalizeResultEntryCaComponents(entry.caComponents, caComponents, entry.caScore, scoreSettings.caMaxScore)
        const caScore = sumResultEntryCaComponents(caComponentScores, caComponents, scoreSettings.caMaxScore)
        const total = clampResultScore(caScore + Number(entry.examScore || 0), scoreSettings.totalMaxScore)
        const band = resolveGradeBand(total, gradeScale)
        return {
          subjectId: String(entry.subjectId || ''),
          subjectName: String(entry.subjectName || ''),
          caComponents: caComponents.map(component => ({
            key: String(component.key || ''),
            label: String(component.label || ''),
            maxScore: Number(component.maxScore || 0),
            score: Number(caComponentScores?.[String(component.key || '')] || 0),
          })),
          caScore,
          examScore: clampResultScore(entry.examScore, scoreSettings.examMaxScore),
          total,
          grade: band.grade,
          remark: band.remark,
        }
      })

    const average = subjectRows.length
      ? Math.round(subjectRows.reduce((sum, row) => sum + Number(row.total || 0), 0) / subjectRows.length)
      : 0
    const summaryBand = resolveGradeBand(average, gradeScale)
    const affectiveScores = affectiveDomains.map(domain => ({
      key: domain.key,
      label: domain.label,
      score: (profile as any)?.affective?.[domain.key] ?? '',
    }))
    const ratingScores = ratingDomains.map(domain => ({
      key: domain.key,
      label: domain.label,
      score: (profile as any)?.ratings?.[domain.key] ?? '',
    }))

    return {
      studentId,
      studentName: String(student.name || ''),
      average,
      summaryBand,
      payload: {
        student: {
          id: studentId,
          name: String(student.name || ''),
          email: String(student.email || ''),
          displayId: String(student.displayId || ''),
          className: params.className,
        },
        sessionName: params.batch.sessionName,
        termName: params.batch.termName,
        templateKey: String(params.settings?.templateKey || ''),
        branding,
        scoreModel: scoreSettings,
        settingsSnapshot: params.settings,
        approvals: {
          submittedBy: params.batch.submittedBy || null,
          submittedAt: params.batch.submittedAt || null,
          approvedBy: params.actorName,
          approvedAt: new Date().toISOString(),
        },
        summary: {
          average,
          grade: summaryBand.grade,
          classSize: params.students.length,
          attendanceRate: Number((profile as any)?.attendanceRate || 0),
          promotionStatus: String((profile as any)?.promotionStatus || (average >= 50 ? 'Promoted' : 'Review')).trim(),
          teacherRemark: String((profile as any)?.teacherRemark || '').trim(),
          principalRemark: String((profile as any)?.principalRemark || '').trim(),
        },
        subjects: subjectRows,
        affective: affectiveScores,
        ratings: ratingScores,
      },
    }
  }).filter(item => Array.isArray(item.payload.subjects) && item.payload.subjects.length > 0)

  const ranked = [...studentSummaries]
    .sort((left, right) => right.average - left.average || left.studentName.localeCompare(right.studentName))
    .map((item, index) => ({
      ...item,
      payload: {
        ...item.payload,
        summary: {
          ...item.payload.summary,
          position: index + 1,
        },
      },
    }))

  return ranked.map(item => ({ studentId: item.studentId, payload: item.payload }))
}

async function getStudentFeeStatus(db: D1Database, tenantId: string, studentId: string) {
  await ensureFeesLedgerTable(db)
  const row = await db.prepare(`SELECT fee_amount, amount_paid, status FROM fees_ledger WHERE tenant_id = ? AND student_id = ?`).bind(tenantId, studentId).first() as Record<string, any> | null
  if (!row) return { locked: false, status: 'Not Tracked' }

  const feeAmount = Number(row.fee_amount || 0)
  const amountPaid = Number(row.amount_paid || 0)
  const derivedStatus = deriveFeeLedgerStatus(feeAmount, amountPaid, row.status)

  return {
    locked: ['Partial', 'Unpaid'].includes(derivedStatus),
    status: derivedStatus,
  }
}

const FEES_LEDGER_DDL = `CREATE TABLE IF NOT EXISTS fees_ledger (id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, student_name TEXT, class_id TEXT, class_name TEXT, fee_amount REAL, amount_paid REAL, status TEXT, updated_at TEXT)`
const FEES_CONFIG_DDL = `CREATE TABLE IF NOT EXISTS fees_config (id TEXT PRIMARY KEY, tenant_id TEXT, fee_type TEXT, class_id TEXT, student_id TEXT, amount REAL, session TEXT, term TEXT, sort_order INTEGER, created_at TEXT, updated_at TEXT)`
const FEES_PAYMENT_RECEIPTS_DDL = `CREATE TABLE IF NOT EXISTS fees_payment_receipts (id TEXT PRIMARY KEY, receipt_no TEXT, tenant_id TEXT, student_id TEXT, student_display_id TEXT, student_name TEXT, class_id TEXT, class_name TEXT, amount REAL, payment_type TEXT, payment_reference TEXT, fee_amount REAL, amount_paid_after REAL, balance_after REAL, status_after TEXT, recorded_by TEXT, verification_url TEXT, school_name TEXT, school_logo_url TEXT, session_name TEXT, term_name TEXT, receipt_kind TEXT, reissued_from_receipt_no TEXT, recorded_at TEXT)`
const FEES_PAYMENT_CLAIMS_DDL = `CREATE TABLE IF NOT EXISTS fees_payment_claims (id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, student_name TEXT, class_id TEXT, class_name TEXT, claimant_user_id TEXT, claimant_name TEXT, claimant_role TEXT, amount REAL, payment_method TEXT, payer_name TEXT, payment_reference TEXT, payment_note TEXT, paid_at TEXT, status TEXT, account_name TEXT, account_number TEXT, bank_name TEXT, verified_by TEXT, verified_at TEXT, verification_note TEXT, receipt_id TEXT, receipt_no TEXT, created_at TEXT, updated_at TEXT)`
const WEB_PUSH_SUBSCRIPTIONS_DDL = `CREATE TABLE IF NOT EXISTS web_push_subscriptions (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, user_email TEXT, role_key TEXT, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT, auth_secret TEXT, subscription_json TEXT, device_label TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_used_at TEXT)`
const FEE_PAYMENT_APPROVER_ROLES = ['owner', 'hos', 'accountant']

async function ensureFeesLedgerTable(db: D1Database) {
  if (_initializedTables.has('fees_ledger')) return
  _initializedTables.add('fees_ledger')
  await db.prepare(FEES_LEDGER_DDL).run()
}

async function ensureFeesConfigTable(db: D1Database) {
  if (_initializedTables.has('fees_config')) return
  _initializedTables.add('fees_config')
  await db.prepare(FEES_CONFIG_DDL).run()
  try { await db.exec('ALTER TABLE fees_config ADD COLUMN term TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_config ADD COLUMN sort_order INTEGER') } catch {}
  try { await db.exec('ALTER TABLE fees_config ADD COLUMN updated_at TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_config ADD COLUMN student_id TEXT') } catch {}
}

async function ensureFeesPaymentReceiptsTable(db: D1Database) {
  if (_initializedTables.has('fees_payment_receipts')) return
  _initializedTables.add('fees_payment_receipts')
  await db.prepare(FEES_PAYMENT_RECEIPTS_DDL).run()
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN student_display_id TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN payment_reference TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN verification_url TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN school_name TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN school_logo_url TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN session_name TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN term_name TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN receipt_kind TEXT') } catch {}
  try { await db.exec('ALTER TABLE fees_payment_receipts ADD COLUMN reissued_from_receipt_no TEXT') } catch {}
}

async function ensureFeesPaymentClaimsTable(db: D1Database) {
  if (_initializedTables.has('fees_payment_claims')) return
  _initializedTables.add('fees_payment_claims')
  await db.prepare(FEES_PAYMENT_CLAIMS_DDL).run()
}

async function ensureSchoolSessionsTable(db: D1Database) {
  if (_initializedTables.has('school_sessions')) return
  _initializedTables.add('school_sessions')
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_sessions (id TEXT PRIMARY KEY, tenantId TEXT, session TEXT, term TEXT, startDate TEXT, endDate TEXT, createdAt TEXT)`).run()
}

async function ensureWebPushSubscriptionsTable(db: D1Database) {
  if (_initializedTables.has('web_push_subscriptions')) return
  _initializedTables.add('web_push_subscriptions')
  await db.prepare(WEB_PUSH_SUBSCRIPTIONS_DDL).run()
}

function getFeesPaymentDetailsSettingsKey(tenantId: string) {
  return `fees_payment_details:${tenantId}`
}

function normalizeFeesPaymentDetails(settings: Record<string, any> = {}) {
  return {
    bankName: sanitizeProfileText(settings.bankName, 160),
    accountName: sanitizeProfileText(settings.accountName, 160),
    accountNumber: sanitizeProfileText(settings.accountNumber, 80),
    paymentInstructions: sanitizeProfileText(settings.paymentInstructions, 500),
    paymentReferenceHint: sanitizeProfileText(settings.paymentReferenceHint, 180),
  }
}

async function getFeesPaymentDetails(db: D1Database, tenantId: string) {
  const settings = await getSettings(db, getFeesPaymentDetailsSettingsKey(tenantId)).catch(() => null)
  return normalizeFeesPaymentDetails(settings || {})
}

async function saveFeesPaymentDetails(db: D1Database, tenantId: string, payload: Record<string, any>) {
  const normalized = normalizeFeesPaymentDetails(payload)
  await upsertSettings(db, getFeesPaymentDetailsSettingsKey(tenantId), normalized)
  return normalized
}

async function getCurrentSchoolSessionSnapshot(db: D1Database, tenantId: string) {
  await ensureSchoolSessionsTable(db)
  const row = await db.prepare(
    `SELECT session, term FROM school_sessions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1`
  ).bind(tenantId).first() as Record<string, any> | null

  return {
    sessionName: String(row?.session || '').trim(),
    termName: String(row?.term || '').trim(),
  }
}

function normalizeFeeConfigPeriodValue(value: unknown) {
  return sanitizeProfileText(String(value || '').trim(), 120)
}

function mapFeeConfigRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    feeType: String(row.fee_type || row.feeType || '').trim(),
    classId: String(row.class_id || row.classId || '').trim(),
    studentId: String(row.student_id || row.studentId || '').trim(),
    amount: Number(row.amount || 0),
    session: String(row.session || '').trim(),
    term: String(row.term || '').trim(),
    sortOrder: Number(row.sort_order || row.sortOrder || 0),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
  }
}

function filterFeeConfigRowsForPeriod(configRows: Record<string, any>[] = [], sessionName: unknown, termName: unknown) {
  const normalizedSession = String(sessionName || '').trim().toLowerCase()
  const normalizedTerm = String(termName || '').trim().toLowerCase()

  if (!normalizedSession && !normalizedTerm) {
    return configRows
  }

  const exactRows = configRows.filter((config) => {
    const configSession = String(config.session || config.sessionName || '').trim().toLowerCase()
    const configTerm = String(config.term || config.termName || '').trim().toLowerCase()
    if (!configSession) return false
    if (configSession !== normalizedSession) return false
    if (!normalizedTerm) return true
    return !configTerm || configTerm === normalizedTerm
  })
  if (exactRows.length) return exactRows

  const legacyRows = configRows.filter((config) => {
    const configSession = String(config.session || config.sessionName || '').trim()
    const configTerm = String(config.term || config.termName || '').trim()
    return !configSession && !configTerm
  })

  return legacyRows.length ? legacyRows : configRows
}

async function listSchoolSessionHistory(db: D1Database, tenantId: string) {
  await ensureSchoolSessionsTable(db)
  const rows = await db.prepare(
    `SELECT * FROM school_sessions WHERE tenantId = ? ORDER BY createdAt DESC`
  ).bind(tenantId).all().catch(() => ({ results: [] }))

  const deduped = [] as Array<Record<string, any>>
  const seen = new Set<string>()

  for (const row of ((rows.results || []) as Record<string, any>[])) {
    const sessionName = String(row.session || '').trim()
    const termName = String(row.term || '').trim()
    if (!sessionName && !termName) continue

    const key = `${sessionName.toLowerCase()}::${termName.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    deduped.push({
      id: String(row.id || ''),
      session: sessionName,
      term: termName,
      startDate: String(row.startDate || ''),
      endDate: String(row.endDate || ''),
      createdAt: String(row.createdAt || ''),
    })
  }

  const historyMap = new Map<string, { session: string, createdAt: string, terms: Array<Record<string, any>> }>()
  for (const row of deduped) {
    const sessionName = String(row.session || '').trim()
    if (!sessionName) continue
    if (!historyMap.has(sessionName)) {
      historyMap.set(sessionName, { session: sessionName, createdAt: String(row.createdAt || ''), terms: [] })
    }
    historyMap.get(sessionName)?.terms.push({
      term: String(row.term || '').trim(),
      startDate: String(row.startDate || ''),
      endDate: String(row.endDate || ''),
      createdAt: String(row.createdAt || ''),
    })
  }

  return {
    current: deduped[0] || null,
    history: Array.from(historyMap.values()),
  }
}

async function replaceFeesConfigSnapshot(db: D1Database, options: {
  tenantId: string
  sessionName?: unknown
  termName?: unknown
  configs?: Array<Record<string, any>>
}) {
  await ensureFeesConfigTable(db)

  const sessionName = normalizeFeeConfigPeriodValue(options.sessionName)
  const termName = normalizeFeeConfigPeriodValue(options.termName)
  const now = new Date().toISOString()
  const incoming = Array.isArray(options.configs) ? options.configs : []
  const normalizedMap = new Map<string, Record<string, any>>()

  incoming.forEach((config, index) => {
    const feeType = sanitizeProfileText(String(config.feeType || config.fee_type || '').trim(), 120)
    if (!feeType) return

    const classId = String(config.classId || config.class_id || '').trim()
    // A blank studentId means the row is the class-level default; a set studentId is a per-student override.
    const studentId = String(config.studentId || config.student_id || '').trim()
    const key = `${classId || '__all__'}::${studentId || '__all__'}::${feeType.toLowerCase()}`
    normalizedMap.set(key, {
      feeType,
      classId,
      studentId,
      amount: Number(config.amount || 0),
      sortOrder: Number(config.sortOrder ?? config.sort_order ?? index),
    })
  })

  await db.prepare(
    `DELETE FROM fees_config WHERE tenant_id = ? AND session = ? AND term = ?`
  ).bind(options.tenantId, sessionName, termName).run()

  const normalized = Array.from(normalizedMap.values()).sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))

  const buildConfigId = (config: Record<string, any>) => [
    'fc',
    options.tenantId,
    slugifyValue(sessionName || 'session').slice(0, 24) || 'session',
    slugifyValue(termName || 'term').slice(0, 16) || 'term',
    slugifyValue(config.classId || 'all').slice(0, 24) || 'all',
    slugifyValue(config.studentId || 'all').slice(0, 32) || 'all',
    slugifyValue(config.feeType).slice(0, 40) || 'fee',
  ].join('_')

  // Per-student fees can produce many rows, so write them in batches instead of one await per row.
  const statements = normalized.map((config) => {
    const id = buildConfigId(config)
    return db.prepare(
      `INSERT OR REPLACE INTO fees_config (id, tenant_id, fee_type, class_id, student_id, amount, session, term, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM fees_config WHERE id = ?), ?), ?)`
    ).bind(
      id,
      options.tenantId,
      config.feeType,
      config.classId || null,
      config.studentId || null,
      Number(config.amount || 0),
      sessionName,
      termName,
      Number(config.sortOrder || 0),
      id,
      now,
      now,
    )
  })

  for (let index = 0; index < statements.length; index += 40) {
    await db.batch(statements.slice(index, index + 40))
  }

  return normalized.map((config) => ({
    id: buildConfigId(config),
    tenantId: options.tenantId,
    feeType: config.feeType,
    classId: config.classId,
    studentId: config.studentId,
    amount: Number(config.amount || 0),
    session: sessionName,
    term: termName,
    sortOrder: Number(config.sortOrder || 0),
    createdAt: now,
    updatedAt: now,
  }))
}

function deriveFeeLedgerStatus(feeAmount: unknown, amountPaid: unknown, explicitStatus: unknown = '') {
  const total = Number(feeAmount || 0)
  const paid = Number(amountPaid || 0)

  if (total > 0) {
    return paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'
  }

  const normalizedStatus = String(explicitStatus || '').trim()
  if (normalizedStatus) {
    return normalizedStatus
  }

  return paid > 0 ? 'Partial' : 'Paid'
}

function formatNairaAmount(value: unknown) {
  const amount = Number(value || 0)
  const safeAmount = Number.isFinite(amount) ? amount : 0
  return `₦${safeAmount.toLocaleString()}`
}

function buildFeeReceiptNumber(date = new Date()) {
  const dateKey = date.toISOString().slice(0, 10).replace(/-/g, '')
  const serial = `${Date.now()}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`.slice(-8)
  return `NDV-RCPT-${dateKey}-${serial}`
}

function buildPublicVerificationBaseUrl(baseUrl: string) {
  const fallback = `https://${DEFAULT_TENANT_BASE_DOMAIN}`
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/$/, '')
  if (!normalizedBaseUrl) return fallback

  try {
    const parsed = new URL(normalizedBaseUrl)
    if (!/^https?:$/i.test(parsed.protocol)) {
      return fallback
    }

    const hostname = String(parsed.hostname || '').trim().toLowerCase()
    if (
      hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '0.0.0.0'
      || hostname.endsWith('.local')
      || hostname.startsWith('192.168.')
      || hostname.startsWith('10.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return fallback
    }

    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return fallback
  }
}

function buildFeeReceiptVerificationUrl(baseUrl: string, receiptNo: string) {
  if (!receiptNo) return ''
  return `${buildPublicVerificationBaseUrl(baseUrl)}/receipt-verification/${encodeURIComponent(receiptNo)}`
}

function buildResultVerificationUrl(baseUrl: string, publicationId: string) {
  if (!publicationId) return ''
  return `${buildPublicVerificationBaseUrl(baseUrl)}/result-verification/${encodeURIComponent(publicationId)}`
}

function escapeReceiptVerificationHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatReceiptVerificationDate(value: unknown) {
  const timestamp = String(value || '').trim()
  if (!timestamp) return 'Not recorded'

  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp

  return parsed.toLocaleString()
}

function renderPublicFeeReceiptVerificationHtml(options: {
  verified: boolean
  receiptNo?: string
  message?: string
  receipt?: Record<string, any> | null
}) {
  const receipt = options.receipt || {}
  const verified = Boolean(options.verified)
  const title = verified ? 'Receipt verified' : 'Receipt not found'
  const subtitle = verified
    ? 'This payment receipt is a valid NDOVERA record.'
    : 'The receipt number supplied could not be verified.'
  const receiptNo = escapeReceiptVerificationHtml(options.receiptNo || receipt.receiptNo || '')
  const schoolName = escapeReceiptVerificationHtml(receipt.schoolName || 'NDOVERA School')
  const studentName = escapeReceiptVerificationHtml(receipt.studentName || 'Not available')
  const studentDisplayId = escapeReceiptVerificationHtml(receipt.studentDisplayId || 'Not assigned')
  const className = escapeReceiptVerificationHtml(receipt.className || 'Not assigned')
  const paymentType = escapeReceiptVerificationHtml(receipt.paymentType || 'Not specified')
  const paymentReference = escapeReceiptVerificationHtml(receipt.paymentReference || 'Not provided')
  const statusAfter = escapeReceiptVerificationHtml(receipt.statusAfter || 'Recorded')
  const recordedBy = escapeReceiptVerificationHtml(receipt.recordedBy || 'School bursary')
  const verificationMessage = escapeReceiptVerificationHtml(
    options.message || (verified ? 'Official school receipt confirmed.' : 'Check the receipt number and try again.')
  )
  const amount = formatNairaAmount(receipt.amount || 0)
  const amountPaidAfter = formatNairaAmount(receipt.amountPaidAfter || 0)
  const balanceAfter = formatNairaAmount(receipt.balanceAfter || 0)
  const recordedAt = escapeReceiptVerificationHtml(formatReceiptVerificationDate(receipt.recordedAt))

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeReceiptVerificationHtml(title)} | NDOVERA</title>
    <style>
      :root {
        color-scheme: light;
        --wheat: #ffffff;
        --paper: #fff8f0;
        --maroon: #14215b;
        --midnight: #191970;
        --burgundy: #b08d2d;
        --green: #1a5c38;
        --line: rgba(128, 0, 0, 0.16);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(128, 0, 0, 0.08), transparent 38%),
          radial-gradient(circle at bottom right, rgba(26, 92, 56, 0.12), transparent 32%),
          linear-gradient(160deg, #fffaf3 0%, #ffffff 100%);
        color: var(--midnight);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .card {
        width: min(920px, 100%);
        background: rgba(245, 222, 179, 0.96);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: 0 24px 64px rgba(25, 25, 112, 0.14);
        overflow: hidden;
      }

      .hero {
        padding: 28px 28px 20px;
        background: linear-gradient(135deg, rgba(128, 0, 0, 0.94), rgba(26, 92, 56, 0.92));
        color: #ffffff;
      }

      .eyebrow {
        margin: 0 0 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: #ffffff;
      }

      h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1.05;
      }

      .subtitle {
        margin: 12px 0 0;
        max-width: 640px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.92);
      }

      .status-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 10px 16px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        background: rgba(245, 222, 179, 0.16);
        color: #ffffff;
        border: 1px solid rgba(245, 222, 179, 0.28);
      }

      .body {
        padding: 28px;
        display: grid;
        gap: 22px;
      }

      .message {
        border-radius: 22px;
        background: var(--paper);
        border: 1px solid rgba(128, 0, 32, 0.14);
        padding: 18px 20px;
      }

      .message strong {
        display: block;
        color: var(--maroon);
        margin-bottom: 6px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
      }

      .metric,
      .detail {
        border-radius: 22px;
        background: var(--paper);
        border: 1px solid rgba(128, 0, 32, 0.12);
        padding: 18px;
      }

      .label {
        margin: 0;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--burgundy);
      }

      .value {
        margin: 10px 0 0;
        font-size: 24px;
        font-weight: 900;
        color: var(--midnight);
      }

      .details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }

      .detail-value {
        margin: 8px 0 0;
        line-height: 1.55;
        color: var(--midnight);
        word-break: break-word;
      }

      .footer {
        padding: 0 28px 28px;
        color: var(--midnight);
        font-size: 14px;
        line-height: 1.6;
      }

      .cta {
        display: inline-flex;
        margin-top: 14px;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: var(--green);
        color: var(--wheat);
        padding: 12px 18px;
        text-decoration: none;
        font-weight: 800;
      }

      @media (max-width: 640px) {
        .hero, .body, .footer { padding-left: 20px; padding-right: 20px; }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <section class="hero">
        <p class="eyebrow">NDOVERA Receipt Check</p>
        <h1>${escapeReceiptVerificationHtml(title)}</h1>
        <p class="subtitle">${escapeReceiptVerificationHtml(subtitle)}</p>
        <div class="status-row">
          <span class="pill">${verified ? 'Verified official receipt' : 'Verification unavailable'}</span>
          ${receiptNo ? `<span class="pill">${receiptNo}</span>` : ''}
          <span class="pill">${schoolName}</span>
        </div>
      </section>

      <section class="body">
        <div class="message">
          <strong>Verification status</strong>
          <span>${verificationMessage}</span>
        </div>

        ${verified ? `
        <section class="grid">
          <article class="metric">
            <p class="label">Amount received</p>
            <p class="value">${escapeReceiptVerificationHtml(amount)}</p>
          </article>
          <article class="metric">
            <p class="label">Amount paid after</p>
            <p class="value">${escapeReceiptVerificationHtml(amountPaidAfter)}</p>
          </article>
          <article class="metric">
            <p class="label">Balance after</p>
            <p class="value">${escapeReceiptVerificationHtml(balanceAfter)}</p>
          </article>
          <article class="metric">
            <p class="label">Status after payment</p>
            <p class="value">${statusAfter}</p>
          </article>
        </section>

        <section class="details">
          <article class="detail">
            <p class="label">Student</p>
            <p class="detail-value">${studentName}</p>
          </article>
          <article class="detail">
            <p class="label">Student ID</p>
            <p class="detail-value">${studentDisplayId}</p>
          </article>
          <article class="detail">
            <p class="label">Class</p>
            <p class="detail-value">${className}</p>
          </article>
          <article class="detail">
            <p class="label">Payment type</p>
            <p class="detail-value">${paymentType}</p>
          </article>
          <article class="detail">
            <p class="label">Payment reference</p>
            <p class="detail-value">${paymentReference}</p>
          </article>
          <article class="detail">
            <p class="label">Recorded at</p>
            <p class="detail-value">${recordedAt}</p>
          </article>
          <article class="detail">
            <p class="label">Recorded by</p>
            <p class="detail-value">${recordedBy}</p>
          </article>
          <article class="detail">
            <p class="label">School</p>
            <p class="detail-value">${schoolName}</p>
          </article>
        </section>
        ` : ''}
      </section>

      <section class="footer">
        This verification screen is generated directly from NDOVERA's live school records. If the information above does not match the printed receipt, contact the school bursary with the receipt number.
        ${receiptNo ? `<div><a class="cta" href="/api/public/fees-receipts/${encodeURIComponent(String(options.receiptNo || receipt.receiptNo || ''))}?format=json">Open JSON verification</a></div>` : ''}
      </section>
    </main>
  </body>
</html>`
}

async function resolvePublicFeeReceiptVerification(db: D1Database, receiptNo: string) {
  const normalizedReceiptNo = String(receiptNo || '').trim()
  if (!normalizedReceiptNo) {
    return { success: false, verified: false, message: 'Receipt number is required.', receipt: null }
  }

  await ensureFeesPaymentReceiptsTable(db)
  const receiptRow = await db.prepare(
    'SELECT * FROM fees_payment_receipts WHERE receipt_no = ? LIMIT 1'
  ).bind(normalizedReceiptNo).first() as Record<string, any> | null

  if (!receiptRow) {
    return { success: false, verified: false, message: 'Receipt not found.', receipt: null }
  }

  const tenant = await getTenantById(db, String(receiptRow.tenant_id || '')).catch(() => null)
  return {
    success: true,
    verified: true,
    message: 'Official NDOVERA receipt verified.',
    receipt: {
      receiptNo: String(receiptRow.receipt_no || ''),
      schoolName: String(tenant?.schoolName || tenant?.name || 'NDOVERA School'),
      tenantId: String(receiptRow.tenant_id || ''),
      studentId: String(receiptRow.student_id || ''),
      studentDisplayId: String(receiptRow.student_display_id || ''),
      studentName: String(receiptRow.student_name || ''),
      className: String(receiptRow.class_name || ''),
      amount: Number(receiptRow.amount || 0),
      paymentType: String(receiptRow.payment_type || 'cash'),
      paymentReference: String(receiptRow.payment_reference || ''),
      feeAmount: Number(receiptRow.fee_amount || 0),
      amountPaidAfter: Number(receiptRow.amount_paid_after || 0),
      balanceAfter: Number(receiptRow.balance_after || 0),
      statusAfter: String(receiptRow.status_after || ''),
      recordedBy: String(receiptRow.recorded_by || ''),
      recordedAt: String(receiptRow.recorded_at || ''),
      verificationUrl: String(receiptRow.verification_url || buildFeeReceiptVerificationUrl('', normalizedReceiptNo)),
    },
  }
}

function renderPublicResultVerificationHtml(options: {
  verified: boolean
  publicationId?: string
  message?: string
  result?: Record<string, any> | null
}) {
  const result = options.result || {}
  const verified = Boolean(options.verified)
  const branding = normalizeResultBranding(result.branding, RESULT_DEFAULT_BRANDING)
  const summary = result.summary && typeof result.summary === 'object' ? result.summary as Record<string, any> : {}
  const approvals = result.approvals && typeof result.approvals === 'object' ? result.approvals as Record<string, any> : {}
  const student = result.student && typeof result.student === 'object' ? result.student as Record<string, any> : {}
  const subjects = Array.isArray(result.subjects) ? result.subjects as Record<string, any>[] : []
  const title = verified ? 'Result verified' : 'Result not found'
  const subtitle = verified
    ? 'This result sheet matches NDOVERA published records.'
    : 'The result verification code supplied could not be verified.'
  const publicationId = escapeReceiptVerificationHtml(options.publicationId || result.id || '')
  const schoolName = escapeReceiptVerificationHtml(branding.schoolName || 'NDOVERA School')
  const reportTitle = escapeReceiptVerificationHtml(branding.reportTitle || 'Official Result Record')
  const studentName = escapeReceiptVerificationHtml(student.name || 'Not available')
  const studentDisplayId = escapeReceiptVerificationHtml(student.displayId || 'Not assigned')
  const className = escapeReceiptVerificationHtml(student.className || 'Not assigned')
  const sessionName = escapeReceiptVerificationHtml(result.sessionName || 'Session not specified')
  const termName = escapeReceiptVerificationHtml(result.termName || 'Term not specified')
  const grade = escapeReceiptVerificationHtml(summary.grade || 'Not graded')
  const promotionStatus = escapeReceiptVerificationHtml(summary.promotionStatus || 'Pending review')
  const teacherRemark = escapeReceiptVerificationHtml(summary.teacherRemark || 'No teacher remark recorded.')
  const principalRemark = escapeReceiptVerificationHtml(summary.principalRemark || 'No principal remark recorded.')
  const average = escapeReceiptVerificationHtml(`${Number(summary.average || 0)}%`)
  const attendanceRate = escapeReceiptVerificationHtml(`${Number(summary.attendanceRate || 0)}%`)
  const position = escapeReceiptVerificationHtml(
    summary.position ? `${summary.position}${summary.classSize ? ` of ${summary.classSize}` : ''}` : 'Not ranked'
  )
  const publishedAt = escapeReceiptVerificationHtml(formatReceiptVerificationDate(result.publishedAt))
  const approvedAt = escapeReceiptVerificationHtml(formatReceiptVerificationDate(result.approvedAt || approvals.approvedAt))
  const approvedBy = escapeReceiptVerificationHtml(result.approvedBy || approvals.approvedBy || 'School leadership')
  const verificationMessage = escapeReceiptVerificationHtml(
    options.message || (verified ? 'Official NDOVERA result record confirmed.' : 'Check the verification code and try again.')
  )
  const subjectRows = verified
    ? subjects.map(subject => `
        <tr>
          <td>${escapeReceiptVerificationHtml(subject.subjectName || 'Subject')}</td>
          <td>${escapeReceiptVerificationHtml(subject.caScore ?? '')}</td>
          <td>${escapeReceiptVerificationHtml(subject.examScore ?? '')}</td>
          <td>${escapeReceiptVerificationHtml(subject.total ?? '')}</td>
          <td>${escapeReceiptVerificationHtml(subject.grade || '')}</td>
          <td>${escapeReceiptVerificationHtml(subject.remark || '—')}</td>
        </tr>`).join('')
    : ''

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeReceiptVerificationHtml(title)} | NDOVERA</title>
    <style>
      :root {
        color-scheme: light;
        --wheat: #ffffff;
        --paper: #fff8f0;
        --maroon: ${branding.primaryColor};
        --midnight: #191970;
        --burgundy: #b08d2d;
        --green: ${branding.accentColor};
        --line: rgba(128, 0, 0, 0.16);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(128, 0, 0, 0.08), transparent 38%),
          radial-gradient(circle at bottom right, rgba(26, 92, 56, 0.12), transparent 32%),
          linear-gradient(160deg, #fffaf3 0%, #ffffff 100%);
        color: var(--midnight);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .card {
        width: min(1100px, 100%);
        background: rgba(245, 222, 179, 0.97);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: 0 24px 64px rgba(25, 25, 112, 0.14);
        overflow: hidden;
      }

      .hero {
        padding: 28px 28px 20px;
        background: linear-gradient(135deg, var(--maroon), var(--green));
        color: #ffffff;
      }

      .eyebrow {
        margin: 0 0 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: #ffffff;
      }

      h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 42px);
        line-height: 1.05;
      }

      .subtitle {
        margin: 12px 0 0;
        max-width: 720px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.92);
      }

      .status-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 10px 16px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        background: rgba(245, 222, 179, 0.16);
        color: #ffffff;
        border: 1px solid rgba(245, 222, 179, 0.28);
      }

      .body {
        padding: 28px;
        display: grid;
        gap: 22px;
      }

      .message {
        border-radius: 22px;
        background: var(--paper);
        border: 1px solid rgba(128, 0, 32, 0.14);
        padding: 18px 20px;
      }

      .message strong {
        display: block;
        color: var(--maroon);
        margin-bottom: 6px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
      }

      .metric,
      .detail,
      .table-shell {
        border-radius: 22px;
        background: var(--paper);
        border: 1px solid rgba(128, 0, 32, 0.12);
        padding: 18px;
      }

      .label {
        margin: 0;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--burgundy);
      }

      .value {
        margin: 10px 0 0;
        font-size: 24px;
        font-weight: 900;
        color: var(--midnight);
      }

      .details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }

      .detail-value {
        margin: 8px 0 0;
        line-height: 1.55;
        color: var(--midnight);
        word-break: break-word;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        text-align: left;
        padding: 10px 8px;
        border-top: 1px solid rgba(128, 0, 32, 0.12);
        color: var(--midnight);
        vertical-align: top;
      }

      th {
        border-top: 0;
        color: var(--burgundy);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .footer {
        padding: 0 28px 28px;
        color: var(--midnight);
        font-size: 14px;
        line-height: 1.6;
      }

      .cta {
        display: inline-flex;
        margin-top: 14px;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: var(--green);
        color: var(--wheat);
        padding: 12px 18px;
        text-decoration: none;
        font-weight: 800;
      }

      @media (max-width: 640px) {
        .hero, .body, .footer { padding-left: 20px; padding-right: 20px; }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <section class="hero">
        <p class="eyebrow">NDOVERA Result Check</p>
        <h1>${escapeReceiptVerificationHtml(title)}</h1>
        <p class="subtitle">${escapeReceiptVerificationHtml(subtitle)}</p>
        <div class="status-row">
          <span class="pill">${verified ? 'Verified official result' : 'Verification unavailable'}</span>
          ${publicationId ? `<span class="pill">${publicationId}</span>` : ''}
          <span class="pill">${schoolName}</span>
        </div>
      </section>

      <section class="body">
        <div class="message">
          <strong>Verification status</strong>
          <span>${verificationMessage}</span>
        </div>

        ${verified ? `
        <section class="grid">
          <article class="metric">
            <p class="label">Average</p>
            <p class="value">${average}</p>
          </article>
          <article class="metric">
            <p class="label">Grade</p>
            <p class="value">${grade}</p>
          </article>
          <article class="metric">
            <p class="label">Attendance</p>
            <p class="value">${attendanceRate}</p>
          </article>
          <article class="metric">
            <p class="label">Position</p>
            <p class="value">${position}</p>
          </article>
        </section>

        <section class="details">
          <article class="detail">
            <p class="label">Student</p>
            <p class="detail-value">${studentName}</p>
          </article>
          <article class="detail">
            <p class="label">Student ID</p>
            <p class="detail-value">${studentDisplayId}</p>
          </article>
          <article class="detail">
            <p class="label">Class</p>
            <p class="detail-value">${className}</p>
          </article>
          <article class="detail">
            <p class="label">Session</p>
            <p class="detail-value">${sessionName}</p>
          </article>
          <article class="detail">
            <p class="label">Term</p>
            <p class="detail-value">${termName}</p>
          </article>
          <article class="detail">
            <p class="label">Promotion status</p>
            <p class="detail-value">${promotionStatus}</p>
          </article>
          <article class="detail">
            <p class="label">Approved by</p>
            <p class="detail-value">${approvedBy}</p>
          </article>
          <article class="detail">
            <p class="label">Published at</p>
            <p class="detail-value">${publishedAt}</p>
          </article>
          <article class="detail">
            <p class="label">Approved at</p>
            <p class="detail-value">${approvedAt}</p>
          </article>
          <article class="detail">
            <p class="label">Teacher remark</p>
            <p class="detail-value">${teacherRemark}</p>
          </article>
          <article class="detail">
            <p class="label">Principal remark</p>
            <p class="detail-value">${principalRemark}</p>
          </article>
          <article class="detail">
            <p class="label">Report title</p>
            <p class="detail-value">${reportTitle}</p>
          </article>
        </section>

        <section class="table-shell">
          <p class="label">Published subject breakdown</p>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>CA</th>
                <th>Exam</th>
                <th>Total</th>
                <th>Grade</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>${subjectRows}</tbody>
          </table>
        </section>
        ` : ''}
      </section>

      <section class="footer">
        This verification screen is generated directly from NDOVERA's published result records. If the information above does not match the printed result sheet, contact the school administration with the verification code.
        ${publicationId ? `<div><a class="cta" href="/api/public/results/${encodeURIComponent(String(options.publicationId || result.id || ''))}?format=json">Open JSON verification</a></div>` : ''}
      </section>
    </main>
  </body>
</html>`
}

async function resolvePublicResultVerification(db: D1Database, publicationId: string, baseUrl = '') {
  const normalizedPublicationId = String(publicationId || '').trim()
  if (!normalizedPublicationId) {
    return { success: false, verified: false, message: 'Result verification code is required.', result: null }
  }

  await ensureResultsTables(db)
  const publicationRow = await db.prepare(
    'SELECT * FROM result_publications WHERE id = ? LIMIT 1'
  ).bind(normalizedPublicationId).first() as Record<string, any> | null

  if (!publicationRow) {
    return { success: false, verified: false, message: 'Published result not found.', result: null }
  }

  const payload = parseAdmissionJson(publicationRow.payload_json, {})
  const tenant = await getTenantById(db, String(publicationRow.tenant_id || '')).catch(() => null)
  const branding = normalizeResultBranding(payload?.branding, {
    ...RESULT_DEFAULT_BRANDING,
    schoolName: String(tenant?.schoolName || tenant?.name || RESULT_DEFAULT_BRANDING.schoolName || 'NDOVERA School'),
  })

  return {
    success: true,
    verified: true,
    message: 'Official NDOVERA result record verified.',
    result: {
      id: String(publicationRow.id || normalizedPublicationId),
      tenantId: String(publicationRow.tenant_id || ''),
      student: payload?.student || {},
      sessionName: String(publicationRow.session_name || payload?.sessionName || ''),
      termName: String(publicationRow.term_name || payload?.termName || ''),
      branding,
      summary: payload?.summary || {},
      approvals: payload?.approvals || {},
      subjects: Array.isArray(payload?.subjects) ? payload.subjects : [],
      publishedAt: String(publicationRow.published_at || ''),
      approvedAt: String(publicationRow.approved_at || ''),
      approvedBy: String(publicationRow.approved_by || ''),
      verificationUrl: buildResultVerificationUrl(baseUrl, normalizedPublicationId),
    },
  }
}

function requestPrefersHtml(c: any) {
  const format = String(c.req.query('format') || '').trim().toLowerCase()
  if (format === 'json') return false
  if (format === 'html') return true

  const accept = String(c.req.header('accept') || '').toLowerCase()
  return accept.includes('text/html')
}

function buildFeesConfigLookup(configRows: Record<string, any>[] = []) {
  const feeLookup = {} as Record<string, number>
  const studentFeeLookup = {} as Record<string, number>
  const feeTypes = new Set<string>()

  const orderedRows = [...configRows].sort((left, right) => {
    const leftOrder = Number(left.sort_order || left.sortOrder || 0)
    const rightOrder = Number(right.sort_order || right.sortOrder || 0)
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return String(left.fee_type || left.feeType || '').localeCompare(String(right.fee_type || right.feeType || ''))
  })

  for (const config of orderedRows) {
    const feeType = String(config.fee_type || config.feeType || '').trim()
    if (!feeType) continue

    feeTypes.add(feeType)
    const studentId = String(config.student_id || config.studentId || '').trim()

    if (studentId) {
      const studentKey = `${studentId}::${feeType.toLowerCase()}`
      if (studentFeeLookup[studentKey] === undefined) {
        studentFeeLookup[studentKey] = Number(config.amount || 0)
      }
      continue
    }

    const classKey = String(config.class_id || config.classId || '').trim() || '__all__'
    const lookupKey = `${classKey}::${feeType.toLowerCase()}`

    if (feeLookup[lookupKey] === undefined) {
      feeLookup[lookupKey] = Number(config.amount || 0)
    }
  }

  return {
    feeLookup,
    studentFeeLookup,
    feeTypes: Array.from(feeTypes),
  }
}

function computeConfiguredFeeTotal(
  classId: unknown,
  studentId: unknown,
  feeTypes: string[],
  feeLookup: Record<string, number>,
  studentFeeLookup: Record<string, number> = {},
) {
  const classKey = String(classId || '').trim() || '__all__'
  const studentKey = String(studentId || '').trim()

  return feeTypes.reduce((sum, feeType) => {
    const normalizedFee = feeType.toLowerCase()
    const studentOverride = studentKey ? studentFeeLookup[`${studentKey}::${normalizedFee}`] : undefined
    if (studentOverride !== undefined) {
      return sum + Number(studentOverride || 0)
    }
    const exactKey = `${classKey}::${normalizedFee}`
    const fallbackKey = `__all__::${normalizedFee}`
    const amount = feeLookup[exactKey] !== undefined ? feeLookup[exactKey] : feeLookup[fallbackKey]
    return sum + Number(amount || 0)
  }, 0)
}

function buildTwiceWeeklyReminderSlotKey(date = new Date()) {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = normalized.getUTCDay()
  const mondayBasedDay = day === 0 ? 6 : day - 1
  const weekStart = new Date(normalized)
  weekStart.setUTCDate(normalized.getUTCDate() - mondayBasedDay)
  const slot = mondayBasedDay <= 2 ? 'early' : 'late'
  return `${weekStart.toISOString().slice(0, 10)}:${slot}`
}

async function listTenantActiveStudents(db: D1Database, tenantId: string) {
  await ensureUsersTable(db)
  await ensureClassesTable(db)

  const rows = await db.prepare(
    `SELECT id, name, email, role, status, createdAt
     FROM users
     WHERE tenantId = ? AND role = 'student' AND (status IS NULL OR status != 'inactive')
     ORDER BY name`
  ).bind(tenantId).all()

  const hydrated = await hydrateUserRecords(db, (rows.results || []) as Record<string, any>[])
  const classIds = Array.from(new Set(hydrated.map(student => String(student?.classId || '').trim()).filter(Boolean)))
  const classMap = new Map<string, string>()

  if (classIds.length > 0) {
    const placeholders = classIds.map(() => '?').join(', ')
    const classRows = await db.prepare(
      `SELECT id, name, arm FROM classes WHERE tenantId = ? AND id IN (${placeholders})`
    ).bind(tenantId, ...classIds).all()

    for (const row of ((classRows.results || []) as Record<string, any>[])) {
      classMap.set(String(row.id || ''), `${row.name || ''}${row.arm ? ` ${row.arm}` : ''}`.trim())
    }
  }

  return hydrated.map(student => ({
    id: String(student?.id || ''),
    name: String(student?.name || ''),
    email: String(student?.email || ''),
    displayId: String(student?.displayId || ''),
    classId: String(student?.classId || ''),
    className: classMap.get(String(student?.classId || '')) || String(student?.className || ''),
  }))
}

async function listVisibleFeeLedgerEntries(db: D1Database, currentUser: Record<string, any>) {
  const userIdentifier = String(currentUser.id || currentUser.email || currentUser.sub || '').trim()
  const resolvedUser = userIdentifier
    ? await resolveSettingsIdentity(db, userIdentifier)
    : { settingsKey: '', settings: null, userRow: null }
  const settings = resolvedUser.settings || {}
  const tenantId = String(settings.tenantId || settings.schoolId || resolvedUser.userRow?.tenantId || currentUser.tenantId || '').trim()
  const role = normalizeRole(settings.role) || getActiveRole(currentUser)

  if (!tenantId) {
    return { allowed: false, tenantId: '', role, ledger: [] as Array<Record<string, any>> }
  }

  let students: Array<Record<string, any>> = []
  if (['owner', 'hos', 'accountant', 'admin'].includes(role)) {
    students = await listTenantActiveStudents(db, tenantId)
  } else if (['parent', 'student'].includes(role)) {
    const access = await listAccessibleLearningStudents(db, currentUser)
    students = access.students || []
  } else {
    return { allowed: false, tenantId, role, ledger: [] as Array<Record<string, any>> }
  }

  await ensureFeesLedgerTable(db)
  await ensureFeesConfigTable(db)
  const currentSession = await getCurrentSchoolSessionSnapshot(db, tenantId)

  const studentIds = Array.from(new Set(students.map(student => String(student.id || '').trim()).filter(Boolean)))
  const ledgerMap = new Map<string, Record<string, any>>()

  if (studentIds.length > 0) {
    const placeholders = studentIds.map(() => '?').join(', ')
    const rows = await db.prepare(
      `SELECT * FROM fees_ledger WHERE tenant_id = ? AND student_id IN (${placeholders}) ORDER BY student_name`
    ).bind(tenantId, ...studentIds).all()

    for (const row of ((rows.results || []) as Record<string, any>[])) {
      ledgerMap.set(String(row.student_id || ''), row)
    }
  }

  const configRows = await db.prepare(
    `SELECT * FROM fees_config WHERE tenant_id = ? ORDER BY session DESC, term DESC, sort_order ASC, updated_at DESC, created_at DESC`
  ).bind(tenantId).all().catch(() => ({ results: [] }))
  const activeConfigRows = filterFeeConfigRowsForPeriod(
    (configRows.results || []) as Record<string, any>[],
    currentSession.sessionName,
    currentSession.termName,
  )
  const { feeLookup, studentFeeLookup, feeTypes } = buildFeesConfigLookup(activeConfigRows)

  return {
    allowed: true,
    tenantId,
    role,
    ledger: students.map(student => {
      const ledgerRow = ledgerMap.get(String(student.id || '')) || null
      const configuredFeeAmount = computeConfiguredFeeTotal(student.classId, student.id, feeTypes, feeLookup, studentFeeLookup)
      const recordedFeeAmount = Number(ledgerRow?.fee_amount || 0)
      const feeAmount = recordedFeeAmount > 0 ? recordedFeeAmount : configuredFeeAmount
      const amountPaid = Number(ledgerRow?.amount_paid || 0)
      const status = deriveFeeLedgerStatus(feeAmount, amountPaid, ledgerRow?.status)
      const balance = Math.max(feeAmount - amountPaid, 0)

      return {
        id: String(ledgerRow?.id || student.id || ''),
        studentId: String(student.id || ''),
        displayId: String(student.displayId || ''),
        name: String(student.name || ledgerRow?.student_name || student.id || ''),
        classId: String(student.classId || ledgerRow?.class_id || ''),
        className: String(student.className || ledgerRow?.class_name || ''),
        feeAmount,
        amountPaid,
        balance,
        status,
        updatedAt: String(ledgerRow?.updated_at || ''),
      }
    }),
  }
}

async function buildFeeReminderNotificationItems(db: D1Database, currentUser: Record<string, any>, actorRole: string) {
  if (actorRole !== 'parent') {
    return [] as Array<Record<string, any>>
  }

  const feeView = await listVisibleFeeLedgerEntries(db, currentUser)
  if (!feeView.allowed || feeView.role !== 'parent') {
    return [] as Array<Record<string, any>>
  }

  const reminderSlotKey = buildTwiceWeeklyReminderSlotKey()

  return feeView.ledger
    .filter(entry => ['Partial', 'Unpaid'].includes(String(entry.status || '')) && Number(entry.balance || 0) > 0)
    .slice(0, 8)
    .map(entry => ({
      id: `fee_reminder_${entry.studentId}_${String(entry.status || '').toLowerCase()}`,
      title: entry.status === 'Unpaid' ? 'School fees unpaid' : 'School fees partly paid',
      detail: `${entry.name}${entry.className ? ` (${entry.className})` : ''} still has ${formatNairaAmount(entry.balance)} outstanding. This fee reminder appears twice every week until payment is completed.`,
      sender: 'Fees office',
      time: formatHeaderTime(entry.updatedAt || new Date().toISOString()),
      unread: true,
      category: 'fee_reminder',
      reminderSlotKey,
      studentId: entry.studentId,
      feeStatus: entry.status,
      sortAt: String(entry.updatedAt || new Date().toISOString()),
    }))
}

async function listVisibleFeePaymentReceipts(db: D1Database, currentUser: Record<string, any>) {
  const feeView = await listVisibleFeeLedgerEntries(db, currentUser)
  if (!feeView.allowed) {
    return { allowed: false, tenantId: feeView.tenantId, role: feeView.role, receipts: [] as Array<Record<string, any>> }
  }

  const studentIds = Array.from(new Set((feeView.ledger || []).map(entry => String(entry.studentId || '').trim()).filter(Boolean)))
  if (studentIds.length === 0) {
    return { allowed: true, tenantId: feeView.tenantId, role: feeView.role, receipts: [] as Array<Record<string, any>> }
  }

  await ensureFeesPaymentReceiptsTable(db)
  const placeholders = studentIds.map(() => '?').join(', ')
  const rows = await db.prepare(
    `SELECT * FROM fees_payment_receipts WHERE tenant_id = ? AND student_id IN (${placeholders}) ORDER BY recorded_at DESC LIMIT 200`
  ).bind(feeView.tenantId, ...studentIds).all().catch(() => ({ results: [] }))

  return {
    allowed: true,
    tenantId: feeView.tenantId,
    role: feeView.role,
    receipts: ((rows.results || []) as Record<string, any>[]).map(mapFeePaymentReceiptRow),
  }
}

function mapFeePaymentReceiptRow(row: Record<string, any>) {
  const receiptNo = String(row.receipt_no || row.id || '')
  return {
    id: String(row.id || ''),
    receiptNo,
    studentId: String(row.student_id || ''),
    studentDisplayId: String(row.student_display_id || ''),
    studentName: String(row.student_name || ''),
    classId: String(row.class_id || ''),
    className: String(row.class_name || ''),
    amount: Number(row.amount || 0),
    paymentType: String(row.payment_type || 'cash'),
    paymentReference: String(row.payment_reference || ''),
    feeAmount: Number(row.fee_amount || 0),
    amountPaidAfter: Number(row.amount_paid_after || 0),
    balanceAfter: Number(row.balance_after || 0),
    statusAfter: String(row.status_after || ''),
    recordedBy: String(row.recorded_by || ''),
    verificationUrl: String(row.verification_url || buildFeeReceiptVerificationUrl('', receiptNo)),
    schoolName: String(row.school_name || ''),
    schoolLogoUrl: String(row.school_logo_url || ''),
    sessionName: String(row.session_name || ''),
    termName: String(row.term_name || ''),
    receiptKind: String(row.receipt_kind || 'issued'),
    reissuedFromReceiptNo: String(row.reissued_from_receipt_no || ''),
    recordedAt: String(row.recorded_at || ''),
  }
}

function mapFeePaymentClaimRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    studentId: String(row.student_id || ''),
    studentName: String(row.student_name || ''),
    classId: String(row.class_id || ''),
    className: String(row.class_name || ''),
    claimantUserId: String(row.claimant_user_id || ''),
    claimantName: String(row.claimant_name || ''),
    claimantRole: String(row.claimant_role || ''),
    amount: Number(row.amount || 0),
    paymentMethod: String(row.payment_method || 'bank-transfer'),
    payerName: String(row.payer_name || ''),
    paymentReference: String(row.payment_reference || ''),
    paymentNote: String(row.payment_note || ''),
    paidAt: String(row.paid_at || ''),
    status: String(row.status || 'pending').toLowerCase(),
    accountName: String(row.account_name || ''),
    accountNumber: String(row.account_number || ''),
    bankName: String(row.bank_name || ''),
    verifiedBy: String(row.verified_by || ''),
    verifiedAt: String(row.verified_at || ''),
    verificationNote: String(row.verification_note || ''),
    receiptId: String(row.receipt_id || ''),
    receiptNo: String(row.receipt_no || ''),
    claimedAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

async function listVisibleFeePaymentClaims(db: D1Database, currentUser: Record<string, any>) {
  const feeView = await listVisibleFeeLedgerEntries(db, currentUser)
  if (!feeView.allowed || !feeView.tenantId) {
    return { allowed: false, tenantId: feeView.tenantId, role: feeView.role, claims: [] as Array<Record<string, any>> }
  }

  await ensureFeesPaymentClaimsTable(db)

  if ([...FEE_PAYMENT_APPROVER_ROLES, 'admin'].includes(feeView.role)) {
    const rows = await db.prepare(
      `SELECT * FROM fees_payment_claims WHERE tenant_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 200`
    ).bind(feeView.tenantId).all().catch(() => ({ results: [] }))

    return {
      allowed: true,
      tenantId: feeView.tenantId,
      role: feeView.role,
      claims: ((rows.results || []) as Record<string, any>[]).map(mapFeePaymentClaimRow),
    }
  }

  const studentIds = Array.from(new Set((feeView.ledger || []).map(entry => String(entry.studentId || '').trim()).filter(Boolean)))
  if (studentIds.length === 0) {
    return { allowed: true, tenantId: feeView.tenantId, role: feeView.role, claims: [] as Array<Record<string, any>> }
  }

  const placeholders = studentIds.map(() => '?').join(', ')
  const rows = await db.prepare(
    `SELECT * FROM fees_payment_claims WHERE tenant_id = ? AND student_id IN (${placeholders}) ORDER BY updated_at DESC, created_at DESC LIMIT 200`
  ).bind(feeView.tenantId, ...studentIds).all().catch(() => ({ results: [] }))

  return {
    allowed: true,
    tenantId: feeView.tenantId,
    role: feeView.role,
    claims: ((rows.results || []) as Record<string, any>[]).map(mapFeePaymentClaimRow),
  }
}

async function buildFeePaymentReceiptNotificationItems(db: D1Database, currentUser: Record<string, any>, actorRole: string) {
  if (!['parent', 'student'].includes(actorRole)) {
    return [] as Array<Record<string, any>>
  }

  const receiptView = await listVisibleFeePaymentReceipts(db, currentUser)
  if (!receiptView.allowed) {
    return [] as Array<Record<string, any>>
  }

  return receiptView.receipts.slice(0, 6).map(receipt => ({
    id: `fee_receipt_${receipt.id}`,
    title: 'Fee receipt issued',
    detail: `${receipt.studentName}${receipt.className ? ` (${receipt.className})` : ''} now has a confirmed fee receipt for ${formatNairaAmount(receipt.amount)}.`,
    sender: 'Fees office',
    time: formatHeaderTime(receipt.recordedAt),
    unread: true,
    category: 'fee_payment_receipt',
    studentId: receipt.studentId,
    sortAt: String(receipt.recordedAt || ''),
  }))
}

async function buildFeePaymentClaimNotificationItems(db: D1Database, currentUser: Record<string, any>, actorRole: string) {
  const claimView = await listVisibleFeePaymentClaims(db, currentUser)
  if (!claimView.allowed) {
    return [] as Array<Record<string, any>>
  }

  const claims = claimView.claims.slice(0, 8)

  if ([...FEE_PAYMENT_APPROVER_ROLES, 'admin'].includes(actorRole)) {
    return claims
      .filter(claim => claim.status === 'pending')
      .map(claim => ({
        id: `fee_claim_${claim.id}_pending`,
        title: 'Fee claim awaiting review',
        detail: `${claim.studentName}${claim.className ? ` (${claim.className})` : ''} has a ${formatNairaAmount(claim.amount)} payment claim waiting for verification.`,
        sender: claim.claimantName || 'Parent',
        time: formatHeaderTime(claim.updatedAt || claim.claimedAt),
        unread: true,
        category: 'fee_payment_claim_pending',
        claimId: claim.id,
        studentId: claim.studentId,
        sortAt: String(claim.updatedAt || claim.claimedAt || ''),
      }))
  }

  if (!['parent', 'student'].includes(actorRole)) {
    return [] as Array<Record<string, any>>
  }

  return claims
    .filter(claim => ['pending', 'verified', 'rejected'].includes(claim.status))
    .map(claim => ({
      id: `fee_claim_${claim.id}_${claim.status}`,
      title: claim.status === 'verified'
        ? 'Fee claim approved'
        : claim.status === 'rejected'
          ? 'Fee claim update'
          : 'Fee claim received',
      detail: claim.status === 'verified'
        ? `${claim.studentName}${claim.className ? ` (${claim.className})` : ''} payment claim for ${formatNairaAmount(claim.amount)} was approved${claim.receiptNo ? ` and receipted as ${claim.receiptNo}` : ''}.`
        : claim.status === 'rejected'
          ? `${claim.studentName}${claim.className ? ` (${claim.className})` : ''} payment claim needs attention${claim.verificationNote ? `: ${claim.verificationNote}` : '.'}`
          : `${claim.studentName}${claim.className ? ` (${claim.className})` : ''} payment claim for ${formatNairaAmount(claim.amount)} is pending school verification.`,
      sender: 'Fees office',
      time: formatHeaderTime(claim.updatedAt || claim.claimedAt),
      unread: true,
      category: claim.status === 'verified'
        ? 'fee_payment_claim_verified'
        : claim.status === 'rejected'
          ? 'fee_payment_claim_rejected'
          : 'fee_payment_claim_pending',
      claimId: claim.id,
      studentId: claim.studentId,
      sortAt: String(claim.updatedAt || claim.claimedAt || ''),
    }))
}

async function listLinkedParentIds(db: D1Database, tenantId: string, studentId: string) {
  await ensureParentStudentLinksTable(db)
  const rows = await db.prepare(
    `SELECT DISTINCT parent_id FROM parent_student_links WHERE tenant_id = ? AND student_id = ?`
  ).bind(tenantId, studentId).all().catch(() => ({ results: [] }))
  return Array.from(new Set(((rows.results || []) as Record<string, any>[]).map(row => String(row.parent_id || '').trim()).filter(Boolean)))
}

async function buildFeeStakeholderUserIds(db: D1Database, tenantId: string, studentId: string, extraUserIds: string[] = []) {
  const parentIds = await listLinkedParentIds(db, tenantId, studentId).catch(() => [])
  return Array.from(new Set([studentId, ...parentIds, ...extraUserIds].map(value => String(value || '').trim()).filter(Boolean)))
}

async function recordStudentFeePayment(db: D1Database, options: {
  tenantId: string
  studentId: string
  amount: number
  paymentType?: string
  paymentReference?: string
  feeAmount?: number | null
  recordedBy: string
  verificationBaseUrl?: string
}) {
  await ensureFeesLedgerTable(db)

  const existing = await db.prepare(
    `SELECT * FROM fees_ledger WHERE student_id = ? AND tenant_id = ?`
  ).bind(options.studentId, options.tenantId).first() as Record<string, any> | null
  const studentRow = await findUserByIdentifier(db, options.studentId).catch(() => null)
  const hydratedStudent = (await hydrateUserRecords(db, studentRow ? [studentRow] : []))[0] as Record<string, any> | undefined
  const previousPaid = Number(existing?.amount_paid || 0)
  const paymentAmount = Number(options.amount || 0)
  const newPaid = previousPaid + paymentAmount
  const resolvedFeeAmount = options.feeAmount !== undefined && options.feeAmount !== null && Number.isFinite(Number(options.feeAmount))
    ? Number(options.feeAmount)
    : Number(existing?.fee_amount || 0)
  const status = deriveFeeLedgerStatus(resolvedFeeAmount, newPaid, existing?.status)
  const balanceAfter = Math.max(resolvedFeeAmount - newPaid, 0)
  const studentName = String(hydratedStudent?.name || existing?.student_name || options.studentId)
  const studentDisplayId = String(hydratedStudent?.displayId || existing?.student_display_id || '')
  const classId = String(hydratedStudent?.classId || existing?.class_id || '')
  const className = String(hydratedStudent?.className || existing?.class_name || '')
  const recordedAt = new Date().toISOString()

  if (existing) {
    await db.prepare(
      `UPDATE fees_ledger
       SET student_name = ?, class_id = ?, class_name = ?, fee_amount = ?, amount_paid = ?, status = ?, updated_at = ?
       WHERE student_id = ? AND tenant_id = ?`
    ).bind(studentName, classId || null, className || null, resolvedFeeAmount, newPaid, status, recordedAt, options.studentId, options.tenantId).run()
  } else {
    const id = `fl_${options.studentId}_${options.tenantId}`
    await db.prepare(
      `INSERT INTO fees_ledger (id, tenant_id, student_id, student_name, class_id, class_name, fee_amount, amount_paid, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, options.tenantId, options.studentId, studentName, classId || null, className || null, resolvedFeeAmount, paymentAmount, status, recordedAt).run()
  }

  await db.prepare(
    `INSERT INTO fees_payment_receipts (id, receipt_no, tenant_id, student_id, student_display_id, student_name, class_id, class_name, amount, payment_type, payment_reference, fee_amount, amount_paid_after, balance_after, status_after, recorded_by, verification_url, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    receiptId,
    receiptNo,
    options.tenantId,
    options.studentId,
    studentDisplayId || null,
    studentName,
    classId || null,
    className || null,
    paymentAmount,
    String(options.paymentType || 'cash'),
    String(options.paymentReference || '') || null,
    resolvedFeeAmount,
    newPaid,
    balanceAfter,
    status,
    options.recordedBy,
    verificationUrl || null,
    recordedAt,
  ).run()

  return {
    amountPaid: newPaid,
    previousPaid,
    status,
    balanceAfter,
    feeAmount: resolvedFeeAmount,
    paymentAmount,
    paymentType: String(options.paymentType || 'cash'),
    paymentReference: String(options.paymentReference || ''),
    student: {
      studentId: options.studentId,
      studentDisplayId,
      studentName,
      classId,
      className,
      recordedAt,
    },
  }
}

function hasFeeReceiptSnapshotChanged(current: Record<string, any>, latest: Record<string, any> | null) {
  if (!latest) return false

  return (
    Number(current.feeAmount || 0) !== Number(latest.feeAmount || 0)
    || Number(current.amountPaidAfter || 0) !== Number(latest.amountPaidAfter || 0)
    || Number(current.balanceAfter || 0) !== Number(latest.balanceAfter || 0)
    || String(current.statusAfter || '') !== String(latest.statusAfter || '')
    || String(current.schoolName || '') !== String(latest.schoolName || '')
    || String(current.schoolLogoUrl || '') !== String(latest.schoolLogoUrl || '')
    || String(current.sessionName || '') !== String(latest.sessionName || '')
    || String(current.termName || '') !== String(latest.termName || '')
  )
}

async function issueStudentFeeReceipt(db: D1Database, options: {
  tenantId: string
  studentId: string
  recordedBy: string
  verificationBaseUrl?: string
}) {
  await ensureFeesLedgerTable(db)
  await ensureFeesPaymentReceiptsTable(db)

  const ledgerRow = await db.prepare(
    `SELECT * FROM fees_ledger WHERE student_id = ? AND tenant_id = ?`
  ).bind(options.studentId, options.tenantId).first() as Record<string, any> | null

  if (!ledgerRow) {
    return { success: false, action: 'missing-payment', receipt: null, latestReceipt: null, message: 'No recorded payment found for this student yet.' }
  }

  const currentPaid = Number(ledgerRow.amount_paid || 0)
  if (!Number.isFinite(currentPaid) || currentPaid <= 0) {
    return { success: false, action: 'missing-payment', receipt: null, latestReceipt: null, message: 'No recorded payment found for this student yet.' }
  }

  const studentRow = await findUserByIdentifier(db, options.studentId).catch(() => null)
  const hydratedStudent = (await hydrateUserRecords(db, studentRow ? [studentRow] : []))[0] as Record<string, any> | undefined
  const tenant = await getTenantById(db, options.tenantId).catch(() => null)
  const tenantBranding = await getTenantSchoolBranding(db, tenant)
  const currentSession = await getCurrentSchoolSessionSnapshot(db, options.tenantId)
  const latestReceiptRow = await db.prepare(
    `SELECT * FROM fees_payment_receipts WHERE tenant_id = ? AND student_id = ? ORDER BY recorded_at DESC LIMIT 1`
  ).bind(options.tenantId, options.studentId).first() as Record<string, any> | null
  const latestReceipt = latestReceiptRow ? mapFeePaymentReceiptRow(latestReceiptRow) : null

  const snapshot = {
    studentId: options.studentId,
    studentDisplayId: String(hydratedStudent?.displayId || ledgerRow.student_display_id || ''),
    studentName: String(hydratedStudent?.name || ledgerRow.student_name || options.studentId),
    classId: String(hydratedStudent?.classId || ledgerRow.class_id || ''),
    className: String(hydratedStudent?.className || ledgerRow.class_name || ''),
    feeAmount: Number(ledgerRow.fee_amount || 0),
    amountPaidAfter: currentPaid,
    balanceAfter: Math.max(Number(ledgerRow.fee_amount || 0) - currentPaid, 0),
    statusAfter: String(ledgerRow.status || deriveFeeLedgerStatus(ledgerRow.fee_amount, currentPaid, ledgerRow.status)),
    schoolName: String(tenantBranding.schoolName || tenant?.schoolName || tenant?.name || 'NDOVERA School'),
    schoolLogoUrl: String(tenantBranding.logoUrl || ''),
    sessionName: String(currentSession.sessionName || ''),
    termName: String(currentSession.termName || ''),
  }

  const pendingAmount = Math.max(snapshot.amountPaidAfter - Number(latestReceipt?.amountPaidAfter || 0), 0)
  const needsReissue = pendingAmount <= 0 && hasFeeReceiptSnapshotChanged(snapshot, latestReceipt)

  if (pendingAmount <= 0 && !needsReissue) {
    return {
      success: true,
      action: 'already-issued',
      receipt: latestReceipt,
      latestReceipt,
      message: 'The latest payment snapshot is already receipted.',
    }
  }

  const receiptAmount = needsReissue ? Number(latestReceipt?.amount || 0) : pendingAmount
  const recordedAt = new Date().toISOString()
  const receiptId = `fee_receipt_${options.tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const receiptNo = buildFeeReceiptNumber(new Date(recordedAt))
  const verificationUrl = buildFeeReceiptVerificationUrl(String(options.verificationBaseUrl || ''), receiptNo)
  const receiptKind = needsReissue ? 'reissue' : latestReceipt ? 'balance' : 'initial'

  await db.prepare(
    `INSERT INTO fees_payment_receipts (id, receipt_no, tenant_id, student_id, student_display_id, student_name, class_id, class_name, amount, payment_type, payment_reference, fee_amount, amount_paid_after, balance_after, status_after, recorded_by, verification_url, school_name, school_logo_url, session_name, term_name, receipt_kind, reissued_from_receipt_no, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    receiptId,
    receiptNo,
    options.tenantId,
    options.studentId,
    snapshot.studentDisplayId || null,
    snapshot.studentName,
    snapshot.classId || null,
    snapshot.className || null,
    receiptAmount,
    String(latestReceipt?.paymentType || 'cash'),
    String(latestReceipt?.paymentReference || '') || null,
    snapshot.feeAmount,
    snapshot.amountPaidAfter,
    snapshot.balanceAfter,
    snapshot.statusAfter,
    options.recordedBy,
    verificationUrl || null,
    snapshot.schoolName,
    snapshot.schoolLogoUrl || null,
    snapshot.sessionName || null,
    snapshot.termName || null,
    receiptKind,
    needsReissue ? String(latestReceipt?.receiptNo || '') || null : null,
    recordedAt,
  ).run()

  return {
    success: true,
    action: needsReissue ? 'reissued' : 'issued',
    latestReceipt,
    receipt: {
      id: receiptId,
      receiptNo,
      studentId: options.studentId,
      studentDisplayId: snapshot.studentDisplayId,
      studentName: snapshot.studentName,
      classId: snapshot.classId,
      className: snapshot.className,
      amount: receiptAmount,
      paymentType: String(latestReceipt?.paymentType || 'cash'),
      paymentReference: String(latestReceipt?.paymentReference || ''),
      feeAmount: snapshot.feeAmount,
      amountPaidAfter: snapshot.amountPaidAfter,
      balanceAfter: snapshot.balanceAfter,
      statusAfter: snapshot.statusAfter,
      recordedAt,
      recordedBy: options.recordedBy,
      verificationUrl,
      schoolName: snapshot.schoolName,
      schoolLogoUrl: snapshot.schoolLogoUrl,
      sessionName: snapshot.sessionName,
      termName: snapshot.termName,
      receiptKind,
      reissuedFromReceiptNo: needsReissue ? String(latestReceipt?.receiptNo || '') : '',
    },
  }
}

function normalizePushSubscriptionPayload(value: unknown) {
  const subscription = value && typeof value === 'object' ? value as Record<string, any> : {}
  const endpoint = sanitizeProfileText(subscription.endpoint, 2048)
  const p256dh = sanitizeProfileText(subscription?.keys?.p256dh, 512)
  const authSecret = sanitizeProfileText(subscription?.keys?.auth, 256)

  if (!endpoint || !p256dh || !authSecret) {
    return null
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth: authSecret,
    },
  }
}

function hasWebPushConfig(env: Bindings) {
  return Boolean(String(env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim() && String(env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim())
}

function buildVapidJwk(env: Bindings) {
  const publicKey = String(env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim()
  const privateKey = String(env.WEB_PUSH_VAPID_PRIVATE_KEY || '').trim()
  if (!publicKey || !privateKey) {
    return null
  }

  const publicKeyBytes = fromBase64Url(publicKey)
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4) {
    throw new Error('Invalid VAPID public key.')
  }

  return {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(publicKeyBytes.slice(1, 33)),
    y: toBase64Url(publicKeyBytes.slice(33, 65)),
    d: privateKey,
  }
}

async function buildWebPushHeaders(subscriptionEndpoint: string, env: Bindings) {
  const vapidJwk = buildVapidJwk(env)
  if (!vapidJwk) return null

  const endpointUrl = new URL(subscriptionEndpoint)
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`
  const subject = String(env.WEB_PUSH_SUBJECT || 'mailto:notifications@ndovera.com').trim()
  const token = await sign(
    {
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
      sub: subject,
    },
    vapidJwk,
    { algorithm: 'ES256', header: { typ: 'JWT', alg: 'ES256' } },
  )

  return {
    Authorization: `vapid t=${token}, k=${String(env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim()}`,
    'Crypto-Key': `p256ecdsa=${String(env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim()}`,
  }
}

async function upsertWebPushSubscription(db: D1Database, payload: {
  tenantId: string
  userId: string
  userEmail: string
  roleKey: string
  deviceLabel?: string
  subscription: { endpoint: string, keys: { p256dh: string, auth: string } }
}) {
  await ensureWebPushSubscriptionsTable(db)
  const now = new Date().toISOString()
  const existing = await db.prepare(
    `SELECT id FROM web_push_subscriptions WHERE endpoint = ?`
  ).bind(payload.subscription.endpoint).first() as Record<string, any> | null

  if (existing?.id) {
    await db.prepare(
      `UPDATE web_push_subscriptions
       SET tenant_id = ?, user_id = ?, user_email = ?, role_key = ?, p256dh = ?, auth_secret = ?, subscription_json = ?, device_label = ?, active = 1, updated_at = ?
       WHERE id = ?`
    ).bind(
      payload.tenantId,
      payload.userId,
      payload.userEmail || null,
      payload.roleKey,
      payload.subscription.keys.p256dh,
      payload.subscription.keys.auth,
      JSON.stringify(payload.subscription),
      sanitizeProfileText(payload.deviceLabel, 120) || null,
      now,
      existing.id,
    ).run()

    return { id: String(existing.id), endpoint: payload.subscription.endpoint }
  }

  const id = `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await db.prepare(
    `INSERT INTO web_push_subscriptions (id, tenant_id, user_id, user_email, role_key, endpoint, p256dh, auth_secret, subscription_json, device_label, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(
    id,
    payload.tenantId,
    payload.userId,
    payload.userEmail || null,
    payload.roleKey,
    payload.subscription.endpoint,
    payload.subscription.keys.p256dh,
    payload.subscription.keys.auth,
    JSON.stringify(payload.subscription),
    sanitizeProfileText(payload.deviceLabel, 120) || null,
    now,
    now,
  ).run()

  return { id, endpoint: payload.subscription.endpoint }
}

async function deactivateWebPushSubscriptionByEndpoint(db: D1Database, endpoint: string) {
  await ensureWebPushSubscriptionsTable(db)
  await db.prepare(
    `UPDATE web_push_subscriptions SET active = 0, updated_at = ? WHERE endpoint = ?`
  ).bind(new Date().toISOString(), endpoint).run()
}

async function touchWebPushSubscription(db: D1Database, subscriptionId: string) {
  await ensureWebPushSubscriptionsTable(db)
  const now = new Date().toISOString()
  await db.prepare(
    `UPDATE web_push_subscriptions SET last_used_at = ?, updated_at = ? WHERE id = ?`
  ).bind(now, now, subscriptionId).run()
}

async function listActiveWebPushSubscriptions(db: D1Database, options: {
  tenantId?: string
  userIds?: string[]
  roleKeys?: string[]
}) {
  await ensureWebPushSubscriptionsTable(db)

  const userIds = Array.from(new Set((options.userIds || []).map(value => String(value || '').trim()).filter(Boolean)))
  const roleKeys = Array.from(new Set((options.roleKeys || []).map(value => normalizeRole(value)).filter(Boolean)))

  let rows: { results?: Record<string, any>[] } = { results: [] }

  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(', ')
    const params = options.tenantId ? [options.tenantId, ...userIds] : userIds
    rows = await db.prepare(
      `SELECT * FROM web_push_subscriptions WHERE active = 1 ${options.tenantId ? 'AND tenant_id = ? ' : ''}AND user_id IN (${placeholders}) ORDER BY updated_at DESC`
    ).bind(...params).all().catch(() => ({ results: [] }))
  } else if (options.tenantId && roleKeys.length > 0) {
    if (roleKeys.includes('all')) {
      rows = await db.prepare(
        `SELECT * FROM web_push_subscriptions WHERE active = 1 AND tenant_id = ? ORDER BY updated_at DESC`
      ).bind(options.tenantId).all().catch(() => ({ results: [] }))
    } else {
      const placeholders = roleKeys.map(() => '?').join(', ')
      rows = await db.prepare(
        `SELECT * FROM web_push_subscriptions WHERE active = 1 AND tenant_id = ? AND role_key IN (${placeholders}) ORDER BY updated_at DESC`
      ).bind(options.tenantId, ...roleKeys).all().catch(() => ({ results: [] }))
    }
  } else if (options.tenantId) {
    rows = await db.prepare(
      `SELECT * FROM web_push_subscriptions WHERE active = 1 AND tenant_id = ? ORDER BY updated_at DESC`
    ).bind(options.tenantId).all().catch(() => ({ results: [] }))
  }

  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    userId: String(row.user_id || ''),
    roleKey: String(row.role_key || ''),
    endpoint: String(row.endpoint || ''),
  }))
}

async function sendWebPushSignal(env: Bindings, subscriptionEndpoint: string) {
  const headers = await buildWebPushHeaders(subscriptionEndpoint, env)
  if (!headers) return null

  return fetch(subscriptionEndpoint, {
    method: 'POST',
    headers: {
      ...headers,
      TTL: '60',
      Urgency: 'high',
    },
  })
}

async function sendWebPushToAudience(db: D1Database, env: Bindings, options: {
  tenantId?: string
  userIds?: string[]
  roleKeys?: string[]
}) {
  if (!hasWebPushConfig(env)) {
    return { sent: 0, total: 0, configured: false }
  }

  const subscriptions = await listActiveWebPushSubscriptions(db, options)
  const results = await Promise.all(subscriptions.map(async subscription => {
    try {
      const response = await sendWebPushSignal(env, subscription.endpoint)
      if (response?.ok) {
        await touchWebPushSubscription(db, subscription.id).catch(() => null)
        return 1
      }

      if (response && [404, 410].includes(response.status)) {
        await deactivateWebPushSubscriptionByEndpoint(db, subscription.endpoint).catch(() => null)
      }
    } catch {
      return 0
    }

    return 0
  }))

  return {
    sent: results.reduce((sum, value) => sum + value, 0),
    total: subscriptions.length,
    configured: true,
  }
}

function resolvePushNotificationPath(roleKey: string, category: string) {
  if (category.startsWith('fee_')) {
    return `/roles/${roleKey}/fees`
  }

  return `/roles/${roleKey}`
}

function buildPushNotificationPayload(item: Record<string, any> | null, roleKey: string) {
  if (!item) return null

  const category = String(item.category || 'notice')
  return {
    id: String(item.id || ''),
    title: String(item.title || 'NDOVERA notice'),
    body: String(item.detail || item.preview || item.sender || ''),
    tag: `${category}:${String(item.id || roleKey)}`,
    url: String(item.actionUrl || resolvePushNotificationPath(roleKey, category)),
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    category,
    sortAt: String(item.sortAt || ''),
  }
}

function buildLatestPushNotificationPayload(notificationItems: Array<Record<string, any>>, roleKey: string) {
  const sortedItems = [...(notificationItems || [])].sort((left, right) => String(right.sortAt || '').localeCompare(String(left.sortAt || '')))
  return buildPushNotificationPayload(sortedItems[0] || null, roleKey)
}

function normalizeResultMatchKey(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function buildResultUploadMatchKeys(student: Record<string, any>) {
  const email = normalizeResultMatchKey(student.email)
  const emailPrefix = email.includes('@') ? email.split('@')[0] : email
  return Array.from(new Set([
    normalizeResultMatchKey(student.displayId),
    normalizeResultMatchKey(student.id),
    email,
    emailPrefix,
  ].filter(value => value.length >= 4 || value.includes('@'))))
}

function studentNameTokens(name: unknown) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(part => part.length >= 2)
}

// Match a student by full name when ALL of the student's name tokens appear in
// the provided text (in any order). Returns a unique match or flags ambiguity.
function matchStudentByFullName(rawName: string, students: Record<string, any>[]) {
  const queryTokens = new Set(studentNameTokens(rawName))
  if (queryTokens.size === 0) return { student: null as Record<string, any> | null, ambiguous: false }
  const matches = students.filter(student => {
    const tokens = studentNameTokens(student.name)
    return tokens.length >= 2 && tokens.every(token => queryTokens.has(token))
  })
  if (matches.length > 1) {
    const exact = matches.filter(student => studentNameTokens(student.name).length === queryTokens.size)
    if (exact.length === 1) return { student: exact[0], ambiguous: false }
    return { student: null, ambiguous: true }
  }
  if (matches.length === 1) return { student: matches[0], ambiguous: false }
  return { student: null, ambiguous: false }
}

function matchResultUploadStudent(fileName: string, students: Record<string, any>[]) {
  const base = normalizeResultMatchKey(fileName.replace(/\.[^.]+$/, ''))
  const tokens = Array.from(new Set([
    base,
    ...base.split(/[^a-z0-9@]+/g).filter(Boolean),
  ]))
  const tokenSet = new Set(tokens)

  // 1. Old student code — exact match on any token (codes are unique, any length).
  const oldCodeMatches = students.filter(student =>
    (Array.isArray(student.oldCodes) ? student.oldCodes : [])
      .map(normalizeResultMatchKey)
      .filter(Boolean)
      .some((code: string) => tokenSet.has(code) || base === code),
  )
  if (oldCodeMatches.length === 1) return { student: oldCodeMatches[0], matchedBy: 'old-code', ambiguous: false }
  if (oldCodeMatches.length > 1) return { student: null, matchedBy: 'old-code', ambiguous: true }

  // 2. Student id / display id / email token match.
  const sortedTokens = [...tokens].sort((left, right) => right.length - left.length)
  for (const token of sortedTokens) {
    if (!token || (token.length < 4 && !token.includes('@'))) continue
    const matches = students.filter(student => buildResultUploadMatchKeys(student).includes(token))
    if (matches.length === 1) return { student: matches[0], matchedBy: token, ambiguous: false }
    if (matches.length > 1) return { student: null, matchedBy: token, ambiguous: true }
  }

  // 3. Full name — every one of the student's name tokens present, in any order.
  const fullNameMatches = students.filter(student => {
    const parts = studentNameTokens(student.name)
    return parts.length >= 2 && parts.every(part => tokenSet.has(part))
  })
  if (fullNameMatches.length === 1) return { student: fullNameMatches[0], matchedBy: 'full-name', ambiguous: false }
  if (fullNameMatches.length > 1) return { student: null, matchedBy: 'full-name', ambiguous: true }

  // 4. Looser name fallback (partial overlap / joined forms).
  const nameMatches = students.filter(student => {
    const nameParts = studentNameTokens(student.name)
    if (nameParts.length < 2) return false
    const first = nameParts[0] || ''
    const last = nameParts[nameParts.length - 1] || ''
    const overlap = nameParts.filter(part => tokenSet.has(part)).length
    const fullJoined = nameParts.join('_')
    const fullCompact = nameParts.join('')
    return overlap >= 2
      || Boolean(fullJoined && base.includes(fullJoined))
      || Boolean(fullCompact && base.includes(fullCompact))
      || Boolean(first && last && (
        base.includes(`${first}_${last}`)
        || base.includes(`${first}${last}`)
        || base.includes(`${last}_${first}`)
        || base.includes(`${last}${first}`)
      ))
  })
  if (nameMatches.length === 1) return { student: nameMatches[0], matchedBy: 'student-name', ambiguous: false }
  if (nameMatches.length > 1) return { student: null, matchedBy: 'student-name', ambiguous: true }

  return { student: null, matchedBy: '', ambiguous: false }
}

// ─── Old student codes (migration identity tags) ─────────────────────────────
const STUDENT_OLD_CODES_DDL = `CREATE TABLE IF NOT EXISTS student_old_codes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  student_id TEXT,
  code TEXT,
  normalized_code TEXT,
  created_at TEXT
)`
async function ensureStudentOldCodesTable(db: D1Database) {
  await db.prepare(STUDENT_OLD_CODES_DDL).run()
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS student_old_codes_unique_idx ON student_old_codes(tenant_id, normalized_code)`).run().catch(() => null)
}
async function addStudentOldCode(db: D1Database, tenantId: string, studentId: string, code: string) {
  const normalized = normalizeResultMatchKey(code)
  if (!normalized || !studentId || !tenantId) return false
  await ensureStudentOldCodesTable(db)
  const existing = await db.prepare(`SELECT student_id FROM student_old_codes WHERE tenant_id = ? AND normalized_code = ?`).bind(tenantId, normalized).first() as Record<string, any> | null
  if (existing) {
    await db.prepare(`UPDATE student_old_codes SET student_id = ? WHERE tenant_id = ? AND normalized_code = ?`).bind(studentId, tenantId, normalized).run()
    return true
  }
  await db.prepare(`INSERT INTO student_old_codes (id, tenant_id, student_id, code, normalized_code, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(`oldcode_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, tenantId, studentId, String(code).trim(), normalized, new Date().toISOString())
    .run()
  return true
}
async function getOldCodesByStudent(db: D1Database, tenantId: string) {
  await ensureStudentOldCodesTable(db)
  const rows = await db.prepare(`SELECT student_id, code FROM student_old_codes WHERE tenant_id = ?`).bind(tenantId).all()
  const map = new Map<string, string[]>()
  for (const row of ((rows.results || []) as Record<string, any>[])) {
    const sid = String(row.student_id || '')
    if (!sid) continue
    if (!map.has(sid)) map.set(sid, [])
    map.get(sid)!.push(String(row.code || ''))
  }
  return map
}
async function attachOldCodesToStudents(db: D1Database, tenantId: string, students: Array<Record<string, any>>) {
  const map = await getOldCodesByStudent(db, tenantId)
  return students.map(student => ({ ...student, oldCodes: map.get(String(student.id || '')) || [] }))
}
async function getOldCodeRecordsByStudent(db: D1Database, tenantId: string) {
  await ensureStudentOldCodesTable(db)
  const rows = await db.prepare(`SELECT id, student_id, code FROM student_old_codes WHERE tenant_id = ? ORDER BY created_at DESC`).bind(tenantId).all()
  const map = new Map<string, Array<{ id: string; code: string }>>()
  for (const row of ((rows.results || []) as Record<string, any>[])) {
    const sid = String(row.student_id || '')
    if (!sid) continue
    if (!map.has(sid)) map.set(sid, [])
    map.get(sid)!.push({ id: String(row.id || ''), code: String(row.code || '') })
  }
  return map
}
async function removeStudentOldCode(db: D1Database, tenantId: string, codeId: string) {
  if (!tenantId || !codeId) return
  await ensureStudentOldCodesTable(db)
  await db.prepare(`DELETE FROM student_old_codes WHERE tenant_id = ? AND id = ?`).bind(tenantId, codeId).run()
}

// Auto-create a session/term row when results are uploaded for a period that
// does not exist yet (e.g. migrated past sessions). Uses an old timestamp so it
// never overrides the school's actual current session ordering.
async function ensureSessionTermExists(db: D1Database, tenantId: string, sessionName: unknown, termName: unknown) {
  const session = String(sessionName || '').trim()
  const term = String(termName || '').trim()
  if (!tenantId || !session || !term) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_sessions (id TEXT PRIMARY KEY, tenantId TEXT, session TEXT, term TEXT, startDate TEXT, endDate TEXT, createdAt TEXT)`).run()
  const existing = await db.prepare(`SELECT id FROM school_sessions WHERE tenantId = ? AND session = ? AND term = ? LIMIT 1`).bind(tenantId, session, term).first()
  if (existing) return
  await db.prepare(`INSERT INTO school_sessions (id, tenantId, session, term, startDate, endDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(`session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, tenantId, session, term, '', '', '2000-01-01T00:00:00.000Z')
    .run()
}

function buildTenantWebsite(c: any, schoolId: string, tenant?: any) {
  const origin = new URL(c.req.url).origin
  const baseDomain = c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN

  if (tenant) {
    return {
      schoolId: tenant.id,
      name: tenant.schoolName,
      shortName: tenant.schoolName,
      logoUrl: `${origin}/logo192.png`,
      domain: resolveTenantWebsiteHost(tenant, baseDomain),
      requestedSubdomain: tenant.requestedSubdomain,
      supportEmail: tenant.ownerEmail,
      primaryColor: '#0f172a',
      secondaryColor: '#10b981',
      websiteStatus: tenant.websiteStatus,
      active: tenant.websiteStatus === 'active',
      baseDomain,
    }
  }

  return {
    schoolId,
    name: 'Ndovera',
    shortName: 'NDOVERA',
    logoUrl: `${origin}/logo192.png`,
    domain: baseDomain,
    supportEmail: 'support@ndovera.com',
    primaryColor: '#0f172a',
    secondaryColor: '#10b981',
    websiteStatus: 'inactive',
    active: false,
    baseDomain,
  }
}

async function createFlutterwavePayment(c: any, payload: Record<string, any>) {
  if (!c.env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error('Flutterwave secret is not configured.')
  }

  const response = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || data?.status !== 'success' || !data?.data?.link) {
    throw new Error(data?.message || 'Unable to initialize Flutterwave payment.')
  }

  return data
}

async function verifyFlutterwavePayment(c: any, txRef: string) {
  if (!c.env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error('Flutterwave secret is not configured.')
  }

  const response = await fetch(`${FLUTTERWAVE_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
    headers: {
      Authorization: `Bearer ${c.env.FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || data?.status !== 'success') {
    throw new Error(data?.message || 'Unable to verify Flutterwave payment.')
  }

  return data
}

function buildFlutterwaveRedirectUrl(c: any, initiatedRole: string, tenantId: string, txRef: string) {
  const baseUrl = String(c.env.FLUTTERWAVE_REDIRECT_BASE_URL || 'https://ndovera.com').replace(/\/$/, '')
  let path = `/roles/owner/finance?payment_ref=${encodeURIComponent(txRef)}`

  if (initiatedRole === 'ami') {
    path = `/roles/ami/tenants?tenantId=${encodeURIComponent(tenantId)}&payment_ref=${encodeURIComponent(txRef)}`
  }

  if (initiatedRole === 'public-registration') {
    path = `/register-school?payment_ref=${encodeURIComponent(txRef)}`
  }

  return `${baseUrl}${path}`
}

function buildAiCreditRedirectUrl(c: any, txRef: string) {
  const baseUrl = String(c.env.FLUTTERWAVE_REDIRECT_BASE_URL || 'https://ndovera.com').replace(/\/$/, '')
  return `${baseUrl}/ai-tutor?ai_payment_ref=${encodeURIComponent(txRef)}`
}

async function resolveAiActor(db: D1Database, user: Record<string, any>) {
  const userIdentifier = String(user?.id || user?.email || user?.sub || '').trim()
  const resolvedUser = await resolveSettingsIdentity(db, userIdentifier)
  const settingsKey = String(resolvedUser.settingsKey || resolvedUser.userRow?.email || resolvedUser.userRow?.id || userIdentifier || '').trim()
  const tenantId = String(
    resolvedUser.settings?.tenantId ||
    resolvedUser.settings?.schoolId ||
    resolvedUser.userRow?.tenantId ||
    user?.tenantId ||
    ''
  ).trim()

  return {
    resolvedUser,
    settingsKey,
    tenantId,
    actorId: String(resolvedUser.userRow?.id || user?.id || settingsKey || '').trim(),
    actorName: String(user?.name || resolvedUser.userRow?.name || resolvedUser.settings?.name || settingsKey || 'NDOVERA User').trim(),
    email: String(resolvedUser.userRow?.email || resolvedUser.settings?.email || user?.email || '').trim().toLowerCase(),
    phone: String(resolvedUser.settings?.phone || '').trim(),
    role: getActiveRole(user),
  }
}

function canManageAiBilling(role: string) {
  const normalized = String(role || '').trim().toLowerCase()
  return ['owner', 'ami'].includes(normalized)
}

const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'
const NVIDIA_STUDENT_AI_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const NVIDIA_STUDENT_AI_DEFAULT_MODEL = 'deepseek-ai/deepseek-v4-flash'
const NVIDIA_STUDENT_AI_ROLES = new Set(['student'])
const OPEN_AI_CHAT_ROLES = new Set([
  'teacher',
  'librarian',
  'sanitation',
  'tuckshopmanager',
  'storekeeper',
  'transport',
  'hostel',
  'cafeteria',
  'clinic',
  'ict',
  'ict_manager',
  'classteacher',
  'hod',
  'hodassistant',
  'principal',
  'headteacher',
  'nurseryhead',
  'examofficer',
  'sportsmaster',
])

type AiConversationMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function normalizeAiConversationMessages(raw: unknown): AiConversationMessage[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry) => {
      const role = String((entry as Record<string, any>)?.role || '').trim().toLowerCase()
      const content = String((entry as Record<string, any>)?.content || '').trim()
      if (!content) return null
      if (!['user', 'assistant', 'system'].includes(role)) return null
      return { role: role as AiConversationMessage['role'], content }
    })
    .filter(Boolean)
    .slice(-12) as AiConversationMessage[]
}

function buildAiSystemPrompt(actor: Record<string, any>, mode: string) {
  const role = String(actor?.role || '').trim().toLowerCase()
  const actorName = String(actor?.actorName || 'staff member').trim()
  const normalizedMode = String(mode || '').trim() || 'General Assistant'

  if (!OPEN_AI_CHAT_ROLES.has(role)) {
    return [
      'You are Ndovera AI, an academic-only assistant for students and parents.',
      `Current guidance mode: ${normalizedMode}.`,
      'Answer only educational questions about subjects, revision, practice, and exam preparation.',
      'If the request is not academic, briefly redirect the user to ask an academic question instead.',
      'Do not claim to submit assignments, change records, or take actions inside Ndovera.',
      'Keep answers structured, clear, and age-appropriate.',
    ].join(' ')
  }

  return [
    `You are Ndovera AI, a helpful Workers AI assistant for ${actorName}, working in the ${role || 'staff'} role inside a school operations platform.`,
    `Current guidance mode: ${normalizedMode}.`,
    'You can help with lesson ideas, communication drafts, summaries, planning, reports, professional writing, and general knowledge questions.',
    'Do not claim to perform actions inside Ndovera, send messages, publish records, or change data.',
    'If the request is unsafe, illegal, sexually explicit, hateful, or harmful, refuse briefly and redirect to a safe alternative.',
    'Prefer direct, practical answers with bullets or short steps when useful.',
  ].join(' ')
}

function buildAiConversation(actor: Record<string, any>, payload: Record<string, any>) {
  const prompt = String(payload.prompt || '').trim()
  const mode = String(payload.mode || '').trim() || 'General Assistant'
  const messages = normalizeAiConversationMessages(payload.messages)
  const conversation = messages.filter((message) => message.role !== 'system')

  if (prompt && (!conversation.length || conversation[conversation.length - 1]?.content !== prompt || conversation[conversation.length - 1]?.role !== 'user')) {
    conversation.push({ role: 'user', content: prompt })
  }

  return {
    prompt,
    mode,
    messages: [
      { role: 'system', content: buildAiSystemPrompt(actor, mode) },
      ...conversation.slice(-12),
    ] as AiConversationMessage[],
  }
}

function extractWorkersAiText(result: any): string {
  const direct = [
    result?.response,
    result?.result?.response,
    result?.result?.output_text,
    result?.text,
  ].find((value) => typeof value === 'string' && value.trim())

  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim()
  }

  const arrayCandidates = [result?.result, result?.response, result?.messages]
  for (const candidate of arrayCandidates) {
    if (!Array.isArray(candidate)) continue
    const text = candidate
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (typeof entry?.text === 'string') return entry.text
        if (typeof entry?.content === 'string') return entry.content
        if (typeof entry?.response === 'string') return entry.response
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
      .trim()

    if (text) return text
  }

  return ''
}

function extractOpenAiCompatibleText(result: any): string {
  const content = result?.choices?.[0]?.message?.content

  if (typeof content === 'string' && content.trim()) {
    return content.trim()
  }

  if (Array.isArray(content)) {
    const text = content
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (typeof entry?.text === 'string') return entry.text
        if ((entry?.type === 'text' || entry?.type === 'output_text') && typeof entry?.text === 'string') {
          return entry.text
        }
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
      .trim()

    if (text) return text
  }

  return ''
}

async function runNvidiaStudentChat(env: Bindings, messages: AiConversationMessage[]) {
  const apiKey = String(env.NVIDIA_API_KEY || '').trim()
  if (!apiKey) return ''

  const baseUrl = String(env.NVIDIA_API_BASE_URL || NVIDIA_STUDENT_AI_DEFAULT_BASE_URL).trim().replace(/\/$/, '')
  const model = String(env.NVIDIA_STUDENT_AI_MODEL || NVIDIA_STUDENT_AI_DEFAULT_MODEL).trim() || NVIDIA_STUDENT_AI_DEFAULT_MODEL

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      stream: false,
      chat_template_kwargs: {
        thinking: true,
        reasoning_effort: 'high',
      },
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(String(data?.error?.message || data?.message || 'Ndovera AI request failed.'))
  }

  return extractOpenAiCompatibleText(data)
}

function canAccessAiCreditPayment(actor: Record<string, any>, payment: Record<string, any>) {
  const normalizedRole = String(actor?.role || '').trim().toLowerCase()
  if (normalizedRole === 'ami') return true

  if (String(payment?.target || '').trim().toLowerCase() === 'school') {
    return normalizedRole === 'owner' && String(actor?.tenantId || '').trim() === String(payment?.tenantId || '').trim()
  }

  const actorSettingsKey = String(actor?.settingsKey || '').trim().toLowerCase()
  const actorEmail = String(actor?.email || '').trim().toLowerCase()
  const paymentSettingsKey = String(payment?.settingsKey || '').trim().toLowerCase()
  const paymentEmail = String(payment?.userEmail || '').trim().toLowerCase()

  return Boolean((actorSettingsKey && actorSettingsKey === paymentSettingsKey) || (actorEmail && actorEmail === paymentEmail))
}

async function buildAiAccessPayload(db: D1Database, actor: Record<string, any>) {
  const access = await summarizeAiAccess(db, {
    tenantId: actor.tenantId,
    settingsKey: actor.settingsKey,
    policyOverrides: getAiPolicyOverrides(actor),
  })
  return {
    access,
    management: {
      canManagePolicy: canManageAiBilling(actor.role),
      canTopUpSchoolCredits: canManageAiBilling(actor.role),
      role: actor.role,
      tenantId: actor.tenantId,
    },
  }
}

function getAiPolicyOverrides(actor: Record<string, any>) {
  const normalizedRole = String(actor?.role || '').trim().toLowerCase()
  if (normalizedRole === 'parent') {
    return { dailyFreeRequests: 5 }
  }
  return undefined
}

async function createPendingTenantRegistration(c: any, payload: Record<string, any>) {
  const schoolName = String(payload.schoolName || '').trim()
  const ownerName = String(payload.ownerName || '').trim()
  const ownerEmail = String(payload.ownerEmail || '').trim().toLowerCase()
  const ownerPhone = String(payload.ownerPhone || '').trim()
  const password = String(payload.password || '')
  const planKey = String(payload.planKey || 'growth').toLowerCase()
  const studentCount = 0
  const requestedSubdomain = normalizeSubdomain(payload.requestedSubdomain || schoolName)
  const schoolSlug = slugifyValue(payload.schoolSlug || schoolName)
  const discountCodeValue = payload.discountCode ? String(payload.discountCode).trim().toUpperCase() : ''
  const { plans } = await getTenantPricingState(c.env.APP_DB)

  if (!schoolName || !ownerName || !ownerEmail || !password) {
    const error = new Error('schoolName, ownerName, ownerEmail, and password are required.') as Error & { status?: number }
    error.status = 400
    throw error
  }

  if (!isValidEmail(ownerEmail)) {
    const error = new Error('Provide a valid owner email address.') as Error & { status?: number }
    error.status = 400
    throw error
  }

  if (!plans[planKey]) {
    const error = new Error('Unsupported plan selected.') as Error & { status?: number }
    error.status = 400
    throw error
  }

  if (!requestedSubdomain || requestedSubdomain.length < 3) {
    const error = new Error('Provide a valid school subdomain with at least 3 characters.') as Error & { status?: number }
    error.status = 400
    throw error
  }

  const existingOwner = await getSettings(c.env.APP_DB, ownerEmail)
  if (existingOwner) {
    const error = new Error('An account already exists for this owner email.') as Error & { status?: number }
    error.status = 409
    throw error
  }

  const existingTenant = await getTenantBySubdomain(c.env.APP_DB, requestedSubdomain)
  if (existingTenant) {
    const error = new Error('That school subdomain is already in use.') as Error & { status?: number }
    error.status = 409
    throw error
  }

  const discountCode = await resolveDiscountCode(c.env.APP_DB, discountCodeValue, planKey)
  if (discountCodeValue && !discountCode) {
    const error = new Error('The discount code is invalid, inactive, or no longer available.') as Error & { status?: number }
    error.status = 400
    throw error
  }

  const quote = buildTenantQuote(planKey, studentCount, discountCode, plans)
  const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const baseDomain = c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN
  const lifecycle = deriveTenantLifecycleState('pending', 'pending', null)

  const tenant = await createTenant(c.env.APP_DB, {
    id: tenantId,
    schoolName,
    schoolSlug: schoolSlug || requestedSubdomain,
    ownerName,
    ownerEmail,
    ownerPhone,
    planKey,
    studentCount,
    requestedSubdomain,
    websiteDomain: buildDefaultTenantWebsiteHost({ requestedSubdomain }, baseDomain),
    status: lifecycle.status,
    approvalStatus: 'pending',
    paymentStatus: 'pending',
    websiteStatus: lifecycle.websiteStatus,
    setupFeeCents: quote.setupFeeCents,
    studentFeeCents: quote.studentFeeCents,
    currency: quote.currency,
    discountCode: quote.discountCode,
    discountSnapshot: quote.discountSnapshot,
    metadata: {
      registeredFrom: new URL(c.req.url).origin,
      websiteUrl: buildTenantWebsiteUrl({ requestedSubdomain }, baseDomain),
    },
  })

  const ownerSettings = await withHashedPassword({
    email: ownerEmail,
    name: ownerName,
    role: 'owner',
    primaryRole: 'owner',
    roles: ['owner'],
    accountType: 'school-owner',
    status: 'pending_activation',
    tenantId,
    schoolId: tenantId,
    schoolName,
    planKey,
    requestedSubdomain,
    websiteDomain: buildDefaultTenantWebsiteHost({ requestedSubdomain }, baseDomain),
    tenantStatus: tenant?.status || lifecycle.status,
  }, password)

  await ensureUsersTable(c.env.APP_DB)
  const ownerUserId = createUserId()
  await c.env.APP_DB.prepare(
    `INSERT INTO users (id, email, name, role, primary_role, employment_category, tenantId, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       role = excluded.role,
       primary_role = excluded.primary_role,
       employment_category = excluded.employment_category,
       tenantId = excluded.tenantId,
       status = excluded.status`
  ).bind(
    ownerUserId,
    ownerEmail,
    ownerName,
    'owner',
    'owner',
    'administrative',
    tenantId,
    'pending_activation',
    new Date().toISOString(),
  ).run()
  await upsertSettings(c.env.APP_DB, ownerEmail, ownerSettings)
  const savedOwner = await c.env.APP_DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(ownerEmail).first() as Record<string, any> | null
  await syncUserRoleRecords(c.env.APP_DB, {
    tenantId,
    userId: String(savedOwner?.id || ownerUserId),
    primaryRole: 'owner',
    roles: ['owner'],
  })
  await addAudit(c.env.APP_DB, tenantId, {
    action: 'tenantRegistered',
    data: {
      ownerEmail,
      planKey,
      billableUserCount: quote.billableUserCount,
      discountCode: quote.discountCode,
      requestedSubdomain,
      websiteDomain: buildDefaultTenantWebsiteHost({ requestedSubdomain }, baseDomain),
    },
  })

  return { tenant, quote }
}

async function initiateTenantCheckout(c: any, options: Record<string, any>) {
  const tenant = options.tenant
  const quote = options.quote
  const actorId = options.actorId || tenant.ownerEmail
  const initiatedRole = options.initiatedRole || 'owner'
  const txRef = `tenant_${tenant.id}_${Date.now()}`
  const paymentRecord = await createTenantPayment(c.env.APP_DB, {
    id: `payment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: tenant.id,
    initiatedBy: actorId,
    initiatedRole,
    txRef,
    amountCents: quote.totalDueNowCents,
    currency: quote.currency,
    status: 'pending',
    planKey: tenant.planKey,
    studentCount: quote.billableUserCount || quote.studentCount || 0,
    discountCode: quote.discountCode,
  })

  try {
    const flutterwavePayload = {
      tx_ref: txRef,
      amount: quote.totalDueNow.toFixed(2),
      currency: quote.currency,
      redirect_url: buildFlutterwaveRedirectUrl(c, initiatedRole, tenant.id, txRef),
      customer: {
        email: tenant.ownerEmail,
        name: tenant.ownerName,
        phonenumber: tenant.ownerPhone || undefined,
      },
      customizations: {
        title: `${tenant.schoolName} onboarding payment`,
        description: `${quote.planName} plan: onboarding setup fee only. User billing starts from the subsequent term.`,
      },
      meta: {
        tenantId: tenant.id,
        initiatedBy: actorId,
        initiatedRole,
        planKey: tenant.planKey,
        billableUserCount: quote.billableUserCount || quote.studentCount || 0,
        userCounts: quote.userCounts,
        discountCode: quote.discountCode,
      },
    }

    const providerResponse = await createFlutterwavePayment(c, flutterwavePayload)
    const updatedPayment = await updateTenantPayment(c.env.APP_DB, txRef, {
      flutterwaveLink: providerResponse.data.link,
      providerResponse,
      status: 'pending',
    })

    await addAudit(c.env.APP_DB, tenant.id, {
      action: 'tenantPaymentInitiated',
      data: { txRef, initiatedBy: actorId, role: initiatedRole, amount: quote.totalDueNow },
    })

    return {
      tenant,
      quote,
      payment: updatedPayment || paymentRecord,
      checkoutUrl: providerResponse.data.link,
    }
  } catch (error) {
    await updateTenantPayment(c.env.APP_DB, txRef, {
      status: 'failed',
      providerResponse: { message: error instanceof Error ? error.message : String(error) },
    }).catch(() => {})

    throw error
  }
}

async function verifyTenantPaymentForState(c: any, txRef: string, verifiedByRole: string) {
  const payment = await getTenantPaymentByTxRef(c.env.APP_DB, txRef)
  if (!payment) {
    const error = new Error('Payment record not found.') as Error & { status?: number }
    error.status = 404
    throw error
  }

  const tenant = await getTenantById(c.env.APP_DB, payment.tenantId)
  if (!tenant) {
    const error = new Error('Tenant not found.') as Error & { status?: number }
    error.status = 404
    throw error
  }

  const providerResponse = await verifyFlutterwavePayment(c, txRef)
  const transactionStatus = String(providerResponse?.data?.status || '').toLowerCase()
  const paymentSucceeded = providerResponse?.status === 'success' && transactionStatus === 'successful'
  const nextPaymentStatus = paymentSucceeded ? 'paid' : transactionStatus || 'pending'
  const nextLifecycle = deriveTenantLifecycleState(tenant.approvalStatus, paymentSucceeded ? 'paid' : tenant.paymentStatus, tenant.suspendedAt)
  const now = new Date().toISOString()

  const updatedPayment = await updateTenantPayment(c.env.APP_DB, txRef, {
    status: nextPaymentStatus,
    flutterwaveTxId: providerResponse?.data?.id ? String(providerResponse.data.id) : payment.flutterwaveTxId,
    providerResponse,
    paidAt: paymentSucceeded ? now : payment.paidAt,
  })

  const updatedTenant = await updateTenant(c.env.APP_DB, tenant.id, {
    paymentStatus: paymentSucceeded ? 'paid' : tenant.paymentStatus,
    status: nextLifecycle.status,
    websiteStatus: nextLifecycle.websiteStatus,
    activatedAt: nextLifecycle.dashboardActive ? (tenant.activatedAt || now) : tenant.activatedAt,
    suspendedAt: nextLifecycle.status === 'suspended' ? tenant.suspendedAt : null,
  })

  if (paymentSucceeded && payment.discountCode && payment.status !== 'paid') {
    await incrementTenantDiscountCodeRedemption(c.env.APP_DB, payment.discountCode).catch(() => {})
  }

  await addAudit(c.env.APP_DB, tenant.id, {
    action: 'tenantPaymentVerified',
    data: { txRef, paymentStatus: nextPaymentStatus, verifiedByRole },
  })

  const { plans } = await getTenantPricingState(c.env.APP_DB)
  const discountCode = updatedTenant.discountCode ? await resolveDiscountCode(c.env.APP_DB, updatedTenant.discountCode, updatedTenant.planKey) : null
  const quote = await buildTenantQuoteForTenant(c.env.APP_DB, updatedTenant, discountCode, plans)

  return {
    payment: updatedPayment,
    tenant: { ...updatedTenant, studentCount: quote.billableUserCount, billableUserCount: quote.billableUserCount, userCounts: quote.userCounts, websiteUrl: buildTenantWebsiteUrl(updatedTenant, c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN) },
    verified: paymentSucceeded,
    quote,
  }
}

function buildGenericHeader(_roleKey: string) {
  return {
    auras: 0,
    chats: 0,
    notifications: 0,
    chatItems: [],
    notificationItems: [],
  }
}

function normalizeRole(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

const MERGED_ADMIN_ROLE_KEYS = new Set([
  'accountant',
  'librarian',
  'sanitation',
  'tuckshopmanager',
  'storekeeper',
  'transport',
  'hostel',
  'cafeteria',
  'clinic',
  'ict',
  'examofficer',
  'sportsmaster',
])

function parseRoleList(...values: unknown[]) {
  return Array.from(new Set(values.flatMap(value => normalizeRoleValues(value as string | string[] | undefined))))
}

function createUserId() {
  return crypto.randomUUID()
}

function getPrimaryRole(settings: Record<string, any> = {}, fallbackRole: unknown = '') {
  return normalizeRole(settings.primaryRole || settings.primary_role || settings.role || fallbackRole)
}

function getPublicFacingUserId(settings: Record<string, any> = {}, role: unknown = '') {
  const normalizedRole = normalizeRole(role || settings.primaryRole || settings.primary_role || settings.role)
  if (normalizedRole === 'student') {
    return String(settings.publicStudentId || '').trim() || null
  }
  return String(settings.displayId || '').trim() || null
}

function buildRoleContext(settings: Record<string, any> = {}, storedRole?: unknown, requestedRole?: unknown) {
  const primaryRole = getPrimaryRole(settings, storedRole)
  const rawRoles = parseRoleList(primaryRole, settings.role, settings.roles, storedRole)
  const adminRoles = rawRoles.filter(role => MERGED_ADMIN_ROLE_KEYS.has(role))
  const switchableRoles = rawRoles.filter(role => !MERGED_ADMIN_ROLE_KEYS.has(role))

  if (adminRoles.length > 0 && !switchableRoles.includes('admin')) {
    switchableRoles.push('admin')
  }

  if (switchableRoles.includes('headteacher') && !switchableRoles.includes('nurseryhead') && !rawRoles.includes('nurseryhead')) {
    switchableRoles.push('nurseryhead')
  }

  const normalizedRequestedRole = normalizeRole(requestedRole)
  const canUseRequestedRole = normalizedRequestedRole
    && (switchableRoles.includes(normalizedRequestedRole) || rawRoles.includes(normalizedRequestedRole))

  const selectedRole = canUseRequestedRole
    ? normalizedRequestedRole
    : (switchableRoles[0] || rawRoles[0] || 'student')

  return {
    rawRoles,
    adminRoles,
    switchableRoles,
    selectedRole,
    primaryRole: primaryRole || rawRoles[0] || selectedRole,
    capabilities: deriveCapabilities(rawRoles),
  }
}

function getActiveRole(user: Record<string, any> | null | undefined) {
  return normalizeRole(user?.activeRole || user?.selectedRole || user?.role) || 'student'
}

function canCreateSchoolAnnouncements(role: unknown) {
  return SCHOOL_ANNOUNCEMENT_CREATOR_ROLES.includes(normalizeRole(role))
}

function announcementTargetsRole(audienceRoles: unknown, role: unknown) {
  const normalizedAudience = Array.isArray(audienceRoles)
    ? audienceRoles.map(entry => normalizeRole(entry)).filter(Boolean)
    : []

  if (normalizedAudience.length === 0 || normalizedAudience.includes('all')) {
    return true
  }

  return normalizedAudience.includes(normalizeRole(role))
}

function clampPreview(value: unknown, maxLength = 88) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

function formatHeaderTime(value: unknown) {
  const timestamp = String(value || '').trim()
  if (!timestamp) return ''

  const then = new Date(timestamp).getTime()
  if (!Number.isFinite(then)) return ''

  const diffMs = Date.now() - then
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(timestamp).toLocaleDateString()
}

const HEADER_AUDIT_DDL = `CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  studentId TEXT,
  ts TEXT,
  action TEXT,
  data TEXT
)`

const HIGH_PRIORITY_AUDIT_SNIPPETS = [
  'password',
  'payroll',
  'fee',
  'receipt',
  'claimapproved',
  'claimrejected',
  'deactivated',
  'roleupdated',
  'tenant',
  'discount',
  'announcement',
]

function humanizeHeaderAction(value: unknown) {
  const text = String(value || 'event')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : 'Event'
}

function parseHeaderJsonObject(value: unknown) {
  if (!value) return {} as Record<string, any>
  if (typeof value === 'object') return value as Record<string, any>
  try {
    return JSON.parse(String(value || '')) as Record<string, any>
  } catch {
    return {} as Record<string, any>
  }
}

function summarizeHeaderAuditData(value: unknown) {
  const payload = parseHeaderJsonObject(value)
  return Object.entries(payload)
    .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
    .slice(0, 3)
    .map(([key, entryValue]) => `${key}: ${typeof entryValue === 'object' ? JSON.stringify(entryValue) : String(entryValue)}`)
    .join(' | ')
}

function isHighPriorityAuditEvent(entry: Record<string, any> = {}) {
  const action = String(entry.action || '').trim().toLowerCase()
  if (!action) return false
  return HIGH_PRIORITY_AUDIT_SNIPPETS.some(snippet => action.includes(snippet))
}

async function ensureHeaderAuditTable(db: D1Database) {
  if (_initializedTables.has('header_audit')) return
  _initializedTables.add('header_audit')
  await db.prepare(HEADER_AUDIT_DDL).run().catch(() => null)
}

async function buildWebsiteEnquiryNotificationItems(db: D1Database, tenantId: string, actorRole: string) {
  if (!['owner', 'hos'].includes(normalizeRole(actorRole))) return [] as Array<Record<string, any>>

  await ensureWebsiteEnquiriesTable(db)
  const rows = await db.prepare(
    'SELECT * FROM website_enquiries WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(tenantId, 'new').all().catch(() => ({ results: [] }))

  return ((rows.results || []) as Record<string, any>[])
    .map(mapWebsiteEnquiryRow)
    .map(enquiry => ({
      id: `website-enquiry:${enquiry.id}`,
      title: 'New website enquiry',
      detail: clampPreview(
        `${enquiry.visitorName || 'Website visitor'}${enquiry.subject ? `: ${enquiry.subject}` : ''}${enquiry.sourcePage ? ` • ${enquiry.sourcePage}` : ''}`,
        120,
      ),
      sender: 'Admissions desk',
      time: formatHeaderTime(enquiry.createdAt),
      unread: true,
      category: 'website_enquiry',
      actionUrl: `/roles/${normalizeRole(actorRole)}/admissions`,
      sortAt: String(enquiry.createdAt || ''),
    }))
}

async function buildCriticalAuditNotificationItems(db: D1Database, tenantId: string, actorRole: string) {
  // The `audit` table has no tenantId column so it cannot be filtered by tenant.
  // Return empty rather than fire a query that returns wrong data.
  if (!['owner', 'hos'].includes(normalizeRole(actorRole))) return [] as Array<Record<string, any>>
  return [] as Array<Record<string, any>>

  // eslint-disable-next-line no-unreachable
  await ensureHeaderAuditTable(db)
  const rows = await db.prepare(
    'SELECT id, studentId, ts, action, data FROM audit WHERE studentId = ? ORDER BY ts DESC LIMIT 80'
  ).bind(tenantId).all().catch(() => ({ results: [] }))

  return ((rows.results || []) as Record<string, any>[])
    .map(row => ({
      ...row,
      data: parseHeaderJsonObject(row.data),
    }))
    .filter(isHighPriorityAuditEvent)
    .slice(0, 8)
    .map(entry => ({
      id: `critical-audit:${entry.id}`,
      title: `Critical audit: ${humanizeHeaderAction(entry.action)}`,
      detail: clampPreview(summarizeHeaderAuditData(entry.data) || 'Leadership attention recommended.', 120),
      sender: 'Audit trail',
      time: formatHeaderTime(entry.ts),
      unread: true,
      category: 'critical_audit_event',
      actionUrl: `/roles/${normalizeRole(actorRole)}/audits`,
      sortAt: String(entry.ts || ''),
    }))
}

async function buildAuthenticatedHeader(c: any, roleKey: string) {
  const currentUser = c.var.user || {}
  const userIdentifier = currentUser.id || currentUser.email || currentUser.sub || ''
  if (!userIdentifier) {
    return buildGenericHeader(roleKey)
  }

  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const settings = resolvedUser.settings || {}
  const actorRole = normalizeRole(settings.role) || getActiveRole(currentUser) || roleKey
  const tenantId = settings.tenantId || settings.schoolId || resolvedUser.userRow?.tenantId || currentUser.tenantId

  // Use raw identifiers only — skip resolveCanonicalUserIdentifier (saved 5-8 sequential DB calls).
  const rawIdentifiers = collectResolvedIdentityIdentifiers(resolvedUser, currentUser)
  const comparableIdentifiers = collectComparableIdentifiers(rawIdentifiers)
  const canonicalReaderId = String(rawIdentifiers[0] || userIdentifier).trim()

  // Fire conversations, read-states, and all notification builders in one parallel batch.
  const [allConversations, readStates, notificationBatch] = await Promise.all([
    getConversations(c.env.APP_DB).catch(() => [] as any[]),
    canonicalReaderId ? listConversationReadStates(c.env.APP_DB, canonicalReaderId).catch(() => ({} as Record<string, string>)) : Promise.resolve({} as Record<string, string>),
    tenantId ? Promise.all([
      buildFeeReminderNotificationItems(c.env.APP_DB, currentUser, actorRole).catch(() => [] as any[]),
      buildFeePaymentClaimNotificationItems(c.env.APP_DB, currentUser, actorRole).catch(() => [] as any[]),
      buildFeePaymentReceiptNotificationItems(c.env.APP_DB, currentUser, actorRole).catch(() => [] as any[]),
      buildWebsiteEnquiryNotificationItems(c.env.APP_DB, tenantId, actorRole).catch(() => [] as any[]),
      buildCriticalAuditNotificationItems(c.env.APP_DB, tenantId, actorRole).catch(() => [] as any[]),
      listSchoolAnnouncements(c.env.APP_DB, tenantId, 8).catch(() => [] as any[]),
    ]) : Promise.resolve([[], [], [], [], [], []] as any[][]),
  ])

  // Build chat items from conversation metadata only — skip per-conversation getMessages calls
  // (saved up to 24 DB round-trips). Use conversation updated_at for unread detection.
  const userConversations = (allConversations as any[])
    .filter(conversation => {
      const participants = Array.isArray(conversation.participants) ? conversation.participants : []
      return participants.some((participant: unknown) => matchesComparableIdentifier(participant, comparableIdentifiers))
    })
    .sort((a: any, b: any) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
    .slice(0, 6)

  const chatItems = userConversations.map((conversation: any) => {
    const lastReadAt = (readStates as Record<string, string>)[conversation.id] || ''
    const updatedAt = String(conversation.updated_at || conversation.created_at || '')
    const hasUnread = Boolean(updatedAt && (!lastReadAt || updatedAt > lastReadAt))
    const participants = (Array.isArray(conversation.participants) ? conversation.participants : []).map((v: unknown) => String(v || '').trim()).filter(Boolean)
    const counterpart = participants.find((p: string) => !matchesComparableIdentifier(p, comparableIdentifiers)) || participants[0] || conversation.subject || 'Conversation'
    return {
      id: conversation.id,
      sender: conversation.subject || counterpart,
      preview: clampPreview(conversation.preview || conversation.last_message || ''),
      time: formatHeaderTime(updatedAt),
      unread: hasUnread,
    }
  })

  const [feeReminderItems, feeClaimItems, feeReceiptItems, websiteEnquiryItems, criticalAuditItems, announcements] = notificationBatch as any[][]
  const announcementItems = (announcements || [])
    .filter((announcement: any) => announcementTargetsRole(announcement.audienceRoles, actorRole))
    .map((announcement: any) => ({
      id: announcement.id,
      title: announcement.title,
      detail: clampPreview(announcement.body, 120),
      sender: announcement.authorName || announcement.authorRole || 'School announcement',
      time: formatHeaderTime(announcement.createdAt),
      unread: true,
      category: 'school_announcement',
      sortAt: String(announcement.createdAt || ''),
    }))

  const notificationItems = [
    ...(feeClaimItems || []),
    ...(feeReminderItems || []),
    ...(feeReceiptItems || []),
    ...(websiteEnquiryItems || []),
    ...(criticalAuditItems || []),
    ...announcementItems,
  ].sort((left, right) => String(right.sortAt || '').localeCompare(String(left.sortAt || '')))

  return {
    auras: 0,
    chats: chatItems.filter((item: any) => item.unread).length,
    notifications: notificationItems.length,
    chatItems,
    notificationItems,
  }
}

async function resolveConversationActorContext(db: D1Database, currentUser: Record<string, any> = {}, fallbackIdentifier = '') {
  const userIdentifier = String(currentUser.id || currentUser.email || currentUser.sub || fallbackIdentifier || '').trim()
  const resolvedUser = userIdentifier
    ? await resolveSettingsIdentity(db, userIdentifier)
    : { settingsKey: '', settings: null, userRow: null }
  const rawIdentifiers = collectResolvedIdentityIdentifiers(resolvedUser, currentUser)
  const canonicalIdentifiers = (await Promise.all(
    rawIdentifiers.map(identifier => resolveCanonicalUserIdentifier(db, identifier).catch(() => null))
  )).filter(Boolean) as string[]
  const comparableIdentifiers = collectComparableIdentifiers([...rawIdentifiers, ...canonicalIdentifiers])
  const canonicalUserId = String(
    await resolveCanonicalUserIdentifier(db, userIdentifier).catch(() => null)
      || canonicalIdentifiers[0]
      || rawIdentifiers[0]
      || userIdentifier
  ).trim()

  return {
    userIdentifier,
    resolvedUser,
    rawIdentifiers,
    canonicalIdentifiers,
    comparableIdentifiers,
    canonicalUserId,
  }
}

async function listTenantConversationRecipients(db: D1Database, tenantId: string, roles: string[] = ['owner', 'hos']) {
  const normalizedTenantId = String(tenantId || '').trim()
  const allowedRoles = new Set((roles || []).map(role => String(role || '').trim().toLowerCase()).filter(Boolean))
  if (!normalizedTenantId || allowedRoles.size === 0) return [] as string[]

  const recipientIds = new Set<string>()
  const settingRows = await db.prepare('SELECT studentId, payload FROM settings').all().catch(() => ({ results: [] }))

  for (const row of ((settingRows.results || []) as Record<string, any>[])) {
    try {
      const payload = JSON.parse(String(row.payload || '{}')) as Record<string, any>
      const rowTenantId = String(payload.tenantId || payload.schoolId || '').trim()
      const rowRole = String(payload.role || '').trim().toLowerCase()
      const rowStatus = String(payload.status || 'active').trim().toLowerCase()
      if (rowTenantId !== normalizedTenantId || !allowedRoles.has(rowRole) || rowStatus === 'inactive') continue
      const canonicalId = await resolveCanonicalUserIdentifier(db, payload.email || row.studentId || '').catch(() => null)
      const recipientId = String(canonicalId || payload.email || row.studentId || '').trim()
      if (recipientId) recipientIds.add(recipientId)
    } catch {}
  }

  const userRows = await db.prepare('SELECT id, email, role, tenantId FROM users WHERE tenantId = ?').bind(normalizedTenantId).all().catch(() => ({ results: [] }))
  for (const row of ((userRows.results || []) as Record<string, any>[])) {
    const rowRole = String(row.role || '').trim().toLowerCase()
    if (!allowedRoles.has(rowRole)) continue
    const canonicalId = await resolveCanonicalUserIdentifier(db, row.id || row.email || '').catch(() => null)
    const recipientId = String(canonicalId || row.email || row.id || '').trim()
    if (recipientId) recipientIds.add(recipientId)
  }

  return Array.from(recipientIds)
}

const ADMISSION_APPLICATIONS_DDL = `CREATE TABLE IF NOT EXISTS admission_applications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  applicant_name TEXT,
  applicant_email TEXT,
  applicant_phone TEXT,
  desired_class TEXT,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  service_flags TEXT NOT NULL,
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`
const WEBSITE_ENQUIRIES_DDL = `CREATE TABLE IF NOT EXISTS website_enquiries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  source_page TEXT,
  status TEXT NOT NULL,
  review_notes TEXT,
  outcome_reason TEXT,
  linked_application_id TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`

async function ensureAdmissionApplicationsTable(db: D1Database) {
  if (_initializedTables.has('admission_applications')) return
  _initializedTables.add('admission_applications')
  await db.prepare(ADMISSION_APPLICATIONS_DDL).run()
}

async function ensureWebsiteEnquiriesTable(db: D1Database) {
  if (_initializedTables.has('website_enquiries')) return
  _initializedTables.add('website_enquiries')
  await db.prepare(WEBSITE_ENQUIRIES_DDL).run()
}

function normalizeAdmissionStatus(value: unknown, fallback = 'pending') {
  const normalized = String(value || '').trim().toLowerCase()
  if (['pending', 'reviewing', 'approved', 'rejected', 'waitlisted'].includes(normalized)) return normalized
  return fallback
}

function normalizeWebsiteEnquiryStatus(value: unknown, fallback = 'new') {
  const normalized = String(value || '').trim().toLowerCase()
  if (['new', 'contacted', 'application_started', 'enrolled', 'not_enrolled'].includes(normalized)) return normalized
  return fallback
}

function parseAdmissionJson(value: unknown, fallback: Record<string, any> = {}) {
  if (!value) return fallback
  if (typeof value === 'object') return value as Record<string, any>
  try {
    return JSON.parse(String(value || '')) as Record<string, any>
  } catch {
    return fallback
  }
}

function buildAdmissionServiceFlags(payload: Record<string, any> = {}) {
  return {
    transport: Boolean(payload?.transport?.required || payload?.transportRequired),
    hostel: Boolean(payload?.hostel?.required || payload?.hostelRequired),
    clinic: Boolean(
      payload?.clinic?.followUpRequired
      || payload?.medical?.followUpRequired
      || payload?.medical?.allergies
      || payload?.medical?.conditions
      || payload?.medical?.notes
    ),
  }
}

function mapAdmissionApplicationRow(row: Record<string, any>) {
  const payload = parseAdmissionJson(row.payload)
  const serviceFlags = parseAdmissionJson(row.service_flags)
  return {
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    applicantName: String(row.applicant_name || ''),
    applicantEmail: String(row.applicant_email || ''),
    applicantPhone: String(row.applicant_phone || ''),
    desiredClass: String(row.desired_class || ''),
    status: normalizeAdmissionStatus(row.status),
    payload,
    serviceFlags,
    reviewNotes: String(row.review_notes || ''),
    reviewedBy: String(row.reviewed_by || ''),
    reviewedAt: String(row.reviewed_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

function mapWebsiteEnquiryRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    visitorName: String(row.visitor_name || ''),
    visitorEmail: String(row.visitor_email || ''),
    visitorPhone: String(row.visitor_phone || ''),
    subject: String(row.subject || ''),
    message: String(row.message || ''),
    sourcePage: String(row.source_page || ''),
    status: normalizeWebsiteEnquiryStatus(row.status),
    reviewNotes: String(row.review_notes || ''),
    outcomeReason: String(row.outcome_reason || ''),
    linkedApplicationId: String(row.linked_application_id || ''),
    reviewedBy: String(row.reviewed_by || ''),
    reviewedAt: String(row.reviewed_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

async function syncWebsiteEnquiriesForApplication(
  db: D1Database,
  tenantId: string,
  applicationRow: Record<string, any>,
  admissionStatus: string,
  reviewNotes: string,
  reviewedBy: string,
  reviewedAt: string,
) {
  const applicantEmail = String(applicationRow?.applicant_email || '').trim().toLowerCase()
  const applicantPhone = String(applicationRow?.applicant_phone || '').trim()
  const nextStatus = admissionStatus === 'approved'
    ? 'enrolled'
    : admissionStatus === 'rejected'
      ? 'not_enrolled'
      : admissionStatus === 'reviewing'
        ? 'application_started'
        : ''

  if (!tenantId || !nextStatus || (!applicantEmail && !applicantPhone)) {
    return
  }

  await ensureWebsiteEnquiriesTable(db)
  const rows = await db.prepare(
    'SELECT * FROM website_enquiries WHERE tenant_id = ? ORDER BY created_at DESC'
  ).bind(tenantId).all().catch(() => ({ results: [] }))

  const matchingEnquiries = ((rows.results || []) as Record<string, any>[]).filter(row => {
    const visitorEmail = String(row.visitor_email || '').trim().toLowerCase()
    const visitorPhone = String(row.visitor_phone || '').trim()
    return (applicantEmail && visitorEmail && applicantEmail === visitorEmail)
      || (applicantPhone && visitorPhone && applicantPhone === visitorPhone)
  })

  if (matchingEnquiries.length === 0) {
    return
  }

  await Promise.all(matchingEnquiries.map(row => db.prepare(
    `UPDATE website_enquiries
     SET status = ?, review_notes = ?, outcome_reason = ?, linked_application_id = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`
  ).bind(
    nextStatus,
    reviewNotes || row.review_notes || null,
    nextStatus === 'not_enrolled' ? (reviewNotes || row.outcome_reason || null) : null,
    String(applicationRow.id || ''),
    reviewedBy || null,
    reviewedAt,
    reviewedAt,
    String(row.id || ''),
    tenantId,
  ).run()))
}

function conversationMatchesComparableIdentifiers(conversation: Record<string, any> = {}, comparableIdentifiers: string[] = []) {
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : []
  return participants.some(participant => matchesComparableIdentifier(participant, comparableIdentifiers))
}

function conversationMatchesParticipantSet(conversation: Record<string, any> = {}, comparableParticipants: string[] = []) {
  const participants = collectComparableIdentifiers(Array.isArray(conversation?.participants) ? conversation.participants : [])
  if (participants.length !== comparableParticipants.length) return false
  return comparableParticipants.every(identifier => participants.includes(identifier))
}

function buildUserProfile(id: string, role: string, name: string, settings: Record<string, any> = {}) {
  const roleContext = buildRoleContext(settings, settings.role, role)
  const profile = buildAdmissionProfileRecord(settings, { id, name, email: settings.email || id })
  const displayId = getPublicFacingUserId(settings, roleContext.primaryRole)
  const employmentCategory = deriveEmploymentCategory(roleContext.primaryRole, settings.employmentCategory, roleContext.rawRoles)

  return {
    id,
    email: profile.email || settings.email || id,
    name: profile.name || name,
    role,
    primaryRole: roleContext.primaryRole,
    roles: roleContext.rawRoles,
    switchableRoles: roleContext.switchableRoles,
    adminRoles: roleContext.adminRoles,
    capabilities: roleContext.capabilities,
    schoolId: settings.schoolId || settings.tenantId || 'school-1',
    aura: settings.aura || 320,
    accountType: settings.accountType || (role === 'ami' ? 'superadmin' : 'user'),
    status: settings.status || 'active',
    displayId,
    publicStudentId: String(settings.publicStudentId || '').trim() || null,
    employmentCategory,
    classId: settings.classId || null,
    className: settings.className || null,
    phone: profile.phone || null,
    avatar: profile.avatar || null,
    avatarUrl: profile.avatar || null,
    dateOfBirth: profile.dateOfBirth || null,
    gender: profile.gender || null,
    address: profile.address || null,
    relationship: profile.relationship || null,
    profile,
    mustChangePassword: settings.mustChangePassword === true || settings.mustChangePassword === 'true' || settings.mustChangePassword === 1,
  }
}

async function syncTeacherClassAssignment(
  db: D1Database,
  tenantId: string,
  classRecord: Record<string, any>,
  previousTeacherId?: string | null,
) {
  const classId = String(classRecord?.id || '').trim()
  if (!tenantId || !classId) return

  const nextTeacherId = String(classRecord?.classTeacherId || '').trim()
  const className = String(classRecord?.name || '').trim()
  const classArm = String(classRecord?.arm || '').trim()

  const clearTeacherAssignment = async (teacherId: string) => {
    const resolved = await resolveSettingsIdentity(db, teacherId)
    const settingsKey = resolved.settingsKey || resolved.userRow?.email || resolved.userRow?.id
    if (!settingsKey || !resolved.settings) return
    if (String(resolved.settings.classId || '') !== classId) return

    const nextSettings = { ...resolved.settings }
    delete nextSettings.classId
    delete nextSettings.className
    delete nextSettings.classArm
    await upsertSettings(db, settingsKey, nextSettings)
  }

  const assignTeacherToClass = async (teacherId: string) => {
    const resolved = await resolveSettingsIdentity(db, teacherId)
    const settingsKey = resolved.settingsKey || resolved.userRow?.email || resolved.userRow?.id
    if (!settingsKey) return

    const baseSettings = resolved.settings || {
      email: resolved.userRow?.email || settingsKey,
      name: resolved.userRow?.name || '',
      role: resolved.userRow?.role || 'teacher',
      tenantId,
      schoolId: tenantId,
      status: resolved.userRow?.status || 'active',
    }

    await upsertSettings(db, settingsKey, {
      ...baseSettings,
      classId,
      className,
      classArm,
    })
  }

  const priorTeacherId = String(previousTeacherId || '').trim()
  if (priorTeacherId && priorTeacherId !== nextTeacherId) {
    await clearTeacherAssignment(priorTeacherId)
  }

  if (nextTeacherId) {
    await assignTeacherToClass(nextTeacherId)
  }
}

async function replaceClassMemberships(
  db: D1Database,
  tenantId: string,
  classId: string,
  membershipRole: 'teacher' | 'caregiver',
  userIds: string[] = [],
) {
  await ensureClassMembershipsTable(db)
  const normalizedTenantId = String(tenantId || '').trim()
  const normalizedClassId = String(classId || '').trim()
  if (!normalizedTenantId || !normalizedClassId) return

  const normalizedUserIds = Array.from(new Set(userIds.map(value => String(value || '').trim()).filter(Boolean)))
  const timestamp = new Date().toISOString()

  await db.prepare(
    `DELETE FROM class_memberships WHERE tenant_id = ? AND class_id = ? AND membership_role = ?`
  ).bind(normalizedTenantId, normalizedClassId, membershipRole).run()

  for (const userId of normalizedUserIds) {
    await db.prepare(
      `INSERT OR REPLACE INTO class_memberships (id, tenant_id, class_id, user_id, membership_role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `classmember_${normalizedTenantId}_${normalizedClassId}_${membershipRole}_${slugifyValue(userId).slice(0, 80)}`,
      normalizedTenantId,
      normalizedClassId,
      userId,
      membershipRole,
      timestamp,
      timestamp,
    ).run()
  }
}

async function listClassMembershipIdentifiers(
  db: D1Database,
  tenantId: string,
  classId: string,
  membershipRole?: 'teacher' | 'student' | 'caregiver',
) {
  await ensureClassMembershipsTable(db)

  let query = `SELECT user_id, membership_role FROM class_memberships WHERE tenant_id = ? AND class_id = ?`
  const params: string[] = [tenantId, classId]
  if (membershipRole) {
    query += ` AND membership_role = ?`
    params.push(membershipRole)
  }
  query += ` ORDER BY membership_role, updated_at DESC`

  const rows = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }))
  return (rows.results || []) as Record<string, any>[]
}

async function findUserByIdentifier(db: D1Database, identifier: string) {
  const raw = String(identifier || '').trim()
  if (!raw) return null

  await ensureUsersTable(db)

  const lower = raw.toLowerCase()
  const direct = await db.prepare(
    `SELECT id, email, name, role, tenantId, status FROM users WHERE id = ? OR email = ? OR lower(email) = ?`
  ).bind(raw, raw, lower).first() as Record<string, any> | null

  if (direct) return direct

  // Admins often see/share the friendly display ID, while auth/settings are keyed by email.
  try {
    const settingsRow = await db.prepare(
      `SELECT studentId, payload FROM settings WHERE json_extract(payload, '$.displayId') = ? LIMIT 1`
    ).bind(raw).first() as Record<string, any> | null

    if (!settingsRow?.payload) return null

    const settings = JSON.parse(String(settingsRow.payload))
    const settingsEmail = settings.email || settingsRow.studentId
    const bySettings = await db.prepare(
      `SELECT id, email, name, role, tenantId, status FROM users WHERE id = ? OR email = ? OR lower(email) = ?`
    ).bind(settingsRow.studentId, settingsEmail, String(settingsEmail).toLowerCase()).first() as Record<string, any> | null

    return bySettings || {
      id: settingsRow.studentId,
      email: settingsEmail,
      name: settings.name,
      role: settings.role,
      tenantId: settings.tenantId || settings.schoolId,
      status: settings.status,
    }
  } catch {
    try {
      const settingsRow = await db.prepare(
        `SELECT studentId, payload FROM settings WHERE json_extract(payload, '$.publicStudentId') = ? LIMIT 1`
      ).bind(raw).first() as Record<string, any> | null

      if (!settingsRow?.payload) return null

      const settings = JSON.parse(String(settingsRow.payload))
      const settingsEmail = settings.email || settingsRow.studentId
      const bySettings = await db.prepare(
        `SELECT id, email, name, role, primary_role, tenantId, status FROM users WHERE id = ? OR email = ? OR lower(email) = ?`
      ).bind(settingsRow.studentId, settingsEmail, String(settingsEmail).toLowerCase()).first() as Record<string, any> | null

      return bySettings || {
        id: settingsRow.studentId,
        email: settingsEmail,
        name: settings.name,
        role: settings.role,
        primary_role: settings.primaryRole || settings.role,
        tenantId: settings.tenantId || settings.schoolId,
        status: settings.status,
      }
    } catch {
      return null
    }
  }
}

async function resolveSettingsIdentity(db: D1Database, identifier: string) {
  const raw = String(identifier || '').trim()
  const userRow = raw ? await findUserByIdentifier(db, raw).catch(() => null) : null
  const keys = [
    userRow?.email,
    userRow?.id,
    raw,
    raw.toLowerCase(),
  ].filter(Boolean) as string[]

  const uniqueKeys = Array.from(new Set(keys))
  for (const key of uniqueKeys) {
    const settings = await getSettings(db, key).catch(() => null)
    if (settings) {
      return { settingsKey: key, settings, userRow }
    }
  }

  return {
    settingsKey: userRow?.email || userRow?.id || raw,
    settings: null,
    userRow,
  }
}

type ResolvedIdentityLike = {
  settingsKey?: string | null
  settings?: Record<string, any> | null
  userRow?: Record<string, any> | null
}

function toComparableIdentifier(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function collectResolvedIdentityIdentifiers(
  resolvedIdentity: ResolvedIdentityLike = {},
  user: Record<string, any> = {},
) {
  const rawIdentifiers = [
    resolvedIdentity.userRow?.id,
    resolvedIdentity.userRow?.email,
    resolvedIdentity.settingsKey,
    resolvedIdentity.settings?.email,
    resolvedIdentity.settings?.displayId,
    user.id,
    user.email,
    user.sub,
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)

  return Array.from(new Set(rawIdentifiers))
}

function collectComparableIdentifiers(values: unknown[] = []) {
  return Array.from(new Set(values.map(value => toComparableIdentifier(value)).filter(Boolean)))
}

function matchesComparableIdentifier(value: unknown, comparableIdentifiers: string[]) {
  const normalizedValue = toComparableIdentifier(value)
  return normalizedValue !== '' && comparableIdentifiers.includes(normalizedValue)
}

// A class can have a primary (class) teacher plus assistant/co-teachers stored as class_memberships.
// Co-teachers have the SAME rights as the primary, so management checks accept either.
async function classHasMembershipTeacher(
  db: D1Database,
  tenantId: unknown,
  classId: unknown,
  comparableIdentifiers: string[],
) {
  const normalizedClassId = String(classId || '').trim()
  if (!normalizedClassId || !comparableIdentifiers.length) return false
  try {
    const rows = await db.prepare(
      `SELECT user_id FROM class_memberships WHERE tenant_id = ? AND class_id = ? AND membership_role = 'teacher'`
    ).bind(String(tenantId || ''), normalizedClassId).all()
    return ((rows.results || []) as Record<string, any>[]).some(row => matchesComparableIdentifier(row.user_id, comparableIdentifiers))
  } catch {
    return false
  }
}

async function resolveCanonicalUserIdentifier(db: D1Database, identifier: unknown) {
  const raw = String(identifier || '').trim()
  if (!raw) return null

  const resolved = await resolveSettingsIdentity(db, raw)
  return String(resolved.userRow?.id || resolved.userRow?.email || resolved.settingsKey || raw).trim() || null
}

async function resolveAssignableStaffIdentifier(
  db: D1Database,
  tenantId: string,
  identifier: unknown,
  options: { requireTeachingCapability?: boolean, label?: string } = {},
) {
  const canonicalId = await resolveCanonicalUserIdentifier(db, identifier)
  if (!canonicalId) return null

  const userRow = await findUserByIdentifier(db, canonicalId).catch(() => null)
  const hydratedUser = await hydrateUserRecord(db, userRow)
  const label = String(options.label || 'Staff member')

  if (!hydratedUser || String(hydratedUser.tenantId || hydratedUser.schoolId || '').trim() !== String(tenantId || '').trim()) {
    throw new Error(`${label} was not found in this school.`)
  }

  if (!isStaff(hydratedUser.primaryRole || hydratedUser.role, hydratedUser.roles)) {
    throw new Error(`${label} must be a staff account.`)
  }

  if (options.requireTeachingCapability && !canTeach(hydratedUser.primaryRole || hydratedUser.role, hydratedUser.roles)) {
    throw new Error(`${label} must have teaching capability.`)
  }

  return canonicalId
}

async function finishLogin(c: any, payload: Record<string, any>) {
  let id = payload.id || payload.email || payload.username
  const password = payload.password
  const requestedRole = payload.role

  if (!id || !password) {
    return c.json({ error: 'id and password required' }, 400)
  }

  const resolvedLogin = await resolveSettingsIdentity(c.env.APP_DB, id)
  let settings = resolvedLogin.settings
  id = resolvedLogin.settingsKey || id

  // Accounts created before the PBKDF2 fix have no settings row.
  // If the user exists in the users table and presents the default password,
  // bootstrap their settings on the fly so they can log in.
  if (!settings) {
    const DEFAULT_PASSWORD = 'abcABC@123'
    if (String(password) !== DEFAULT_PASSWORD) {
      return c.json({ error: 'invalid credentials' }, 401)
    }
    const userRow = resolvedLogin.userRow

    if (!userRow) {
      return c.json({ error: 'invalid credentials' }, 401)
    }

    // Bootstrap settings with plain initialPassword — they must change password on first login
    const settingsKey = userRow.email || userRow.id
    settings = {
      email: settingsKey,
      name: userRow.name,
      role: userRow.role,
      tenantId: userRow.tenantId,
      schoolId: userRow.tenantId,
      status: 'active',
      mustChangePassword: true,
      initialPassword: DEFAULT_PASSWORD,
    }
    await upsertSettings(c.env.APP_DB, settingsKey, settings).catch(e =>
      console.error('Bootstrap settings failed', e)
    )
    // Reassign id to canonical email for the rest of login
    id = settingsKey
  }

  let passwordValid = false
  try {
    passwordValid = await verifyPasswordCandidate(String(password), settings)
  } catch (error) {
    console.error('Password verification failed', { id, error })

    if (error instanceof Error && error.message.includes('Cloudflare Worker PBKDF2 limit')) {
      return c.json({ error: 'This account password must be reset before it can be used.' }, 503)
    }

    return c.json({ error: 'Unable to verify credentials right now.' }, 500)
  }

  if (!passwordValid) {
    return c.json({ error: 'invalid credentials' }, 401)
  }

  const migratedSettings = await migrateLegacyPasswordIfNeeded(settings, String(password))
  if (migratedSettings) {
    await upsertSettings(c.env.APP_DB, id, migratedSettings).catch(error => {
      console.error('Legacy password migration failed', error)
    })
    settings = migratedSettings
  }

  const roleContext = buildRoleContext(settings, resolvedLogin.userRow?.role, requestedRole)
  const userRole = roleContext.selectedRole
  const name = settings.name || id
  const tenantId = settings.tenantId || settings.schoolId
  settings = await ensureStudentPublicId(c.env.APP_DB, {
    tenantId,
    userId: resolvedLogin.userRow?.id,
    settingsKey: id,
    settings,
  }) || settings
  const tenant = tenantId
    ? await getTenantById(c.env.APP_DB, tenantId)
    : await getTenantByOwnerEmail(c.env.APP_DB, id)

  // Auto-generate displayId for old users who were created before the displayId system
  if (!settings.displayId) {
    try {
      const newDisplayId = await generateDisplayId(c.env.APP_DB, getDisplayIdConfig(roleContext.primaryRole))
      settings = { ...settings, displayId: newDisplayId }
      await upsertSettings(c.env.APP_DB, id, { ...settings, displayId: newDisplayId }).catch(() => {})
    } catch { /* non-critical */ }
  }

  const mustChangePassword = settings.mustChangePassword === true

  if (tenantId && resolvedLogin.userRow?.id) {
    const employmentCategory = deriveEmploymentCategory(roleContext.primaryRole, settings.employmentCategory, roleContext.rawRoles)
    await c.env.APP_DB.prepare(
      `UPDATE users
       SET role = ?, primary_role = ?, employment_category = ?, tenantId = COALESCE(tenantId, ?)
       WHERE id = ?`
    ).bind(roleContext.primaryRole, roleContext.primaryRole, employmentCategory, tenantId, resolvedLogin.userRow.id).run().catch(() => null)
    await syncUserRoleRecords(c.env.APP_DB, {
      tenantId,
      userId: String(resolvedLogin.userRow.id),
      primaryRole: roleContext.primaryRole,
      roles: roleContext.rawRoles,
    }).catch(() => null)
  }

  const authSessionSeconds = resolveAuthSessionSeconds(c.env)
  const token = await sign({
    role: userRole,
    roles: roleContext.rawRoles,
    switchableRoles: roleContext.switchableRoles,
    adminRoles: roleContext.adminRoles,
    name,
    id,
    tenantId: tenant?.id,
    ...(mustChangePassword ? { mustChangePassword: true } : {}),
    exp: Math.floor(Date.now() / 1000) + authSessionSeconds,
  }, c.env.JWT_SECRET)

  const user = attachTenantContext(buildUserProfile(id, userRole, name, settings), tenant)
  if (mustChangePassword) (user as any).mustChangePassword = true

  const response = c.json({ success: true, token, user, id: user.id, role: user.role, name: user.name, ...(mustChangePassword ? { mustChangePassword: true } : {}) })
  response.headers.append('Set-Cookie', authCookie(token, c.req.url, c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN, authSessionSeconds))
  return response
}

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin
    if (
      origin === 'https://ndovera.com' ||
      origin === 'https://www.ndovera.com' ||
      origin.endsWith('.ndovera.com') ||
      // Flutter web rebuild hosted on Cloudflare Pages (production + preview deploys).
      origin === 'https://ndovera-flutter.pages.dev' ||
      origin.endsWith('.ndovera-flutter.pages.dev')
    ) {
      return origin
    }
    return ''
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Refresh-Token'],
  credentials: true,
}))

app.use('*', logger())

app.use('*', async (c, next) => {
  const requestUrl = new URL(c.req.url)
  if (requestUrl.hostname.toLowerCase() === 'www.ndovera.com') {
    requestUrl.hostname = 'ndovera.com'
    return c.redirect(requestUrl.toString(), 301)
  }
  await next()
})

app.get('/api/tenants/pricing', async (c) => {
  const planKey = String(c.req.query('planKey') || '').toLowerCase()
  const billableUserCount = Number(c.req.query('billableUserCount') || c.req.query('studentCount') || 0)
  const discountCodeValue = c.req.query('discountCode')
  const { pricingConfig, plans } = await getTenantPricingState(c.env.APP_DB)

  const activeDiscountCode = await resolveDiscountCode(c.env.APP_DB, discountCodeValue, planKey || 'growth')
  const quote = planKey && billableUserCount >= 0
    ? buildTenantQuote(planKey, billableUserCount, activeDiscountCode, plans)
    : null

  return c.json({
    success: true,
    plans: serializeTenantPlans(plans),
    pricingConfig,
    quote,
  })
})

app.post('/api/tenants/register', async (c) => {
  try {
    const { tenant, quote } = await createPendingTenantRegistration(c, await c.req.json())

    return c.json({
      success: true,
      tenant,
      quote,
      nextStep: 'Log in as the school owner to complete payment and await Ami approval.',
    }, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to register school.' }, (error as any)?.status || 500)
  }
})

app.post('/api/tenants/register-and-pay', async (c) => {
  try {
    const payload = await c.req.json()
    const { tenant, quote } = await createPendingTenantRegistration(c, payload)
    const checkout = await initiateTenantCheckout(c, {
      tenant,
      quote,
      actorId: tenant.ownerEmail,
      initiatedRole: 'public-registration',
    })

    return c.json({
      success: true,
      tenant,
      quote,
      payment: checkout.payment,
      checkoutUrl: checkout.checkoutUrl,
      nextStep: 'Flutterwave checkout opened for the onboarding fee.',
    }, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to start registration payment.' }, (error as any)?.status || 503)
  }
})

// Authenticate middleware
async function authenticate(c: any, next: any) {
  const auth = c.req.header('Authorization')
  const cookieToken = getCookieValue(c.req.header('Cookie'), AUTH_COOKIE_NAME)
  let token = cookieToken
  if (auth) {
    const parts = auth.split(' ')
    if (parts.length !== 2) return c.json({ error: 'invalid auth' }, 401)
    token = parts[1]
  }
  if (!token) return c.json({ error: 'missing auth' }, 401)
  try {
    const authSessionSeconds = resolveAuthSessionSeconds(c.env)
    const { payload } = await verify(token, c.env.JWT_SECRET)
    const roleContext = buildRoleContext({ role: payload.role, roles: payload.roles }, payload.role, c.req.header('X-Selected-Role'))
    const authenticatedUser = {
      ...payload,
      activeRole: roleContext.selectedRole,
      role: roleContext.rawRoles,
      roles: roleContext.rawRoles,
      switchableRoles: roleContext.switchableRoles,
      adminRoles: roleContext.adminRoles,
    }
    c.set('user', authenticatedUser)
    await next()
    // Sliding expiry: issue a fresh token on every authenticated request
    // so the session stays alive as long as the user keeps using the app
    const refreshed = await sign({
      role: authenticatedUser.activeRole,
      roles: authenticatedUser.roles,
      switchableRoles: authenticatedUser.switchableRoles,
      adminRoles: authenticatedUser.adminRoles,
      name: authenticatedUser.name,
      id: authenticatedUser.id,
      tenantId: authenticatedUser.tenantId,
      ...(authenticatedUser.mustChangePassword ? { mustChangePassword: true } : {}),
      exp: Math.floor(Date.now() / 1000) + authSessionSeconds,
    }, c.env.JWT_SECRET)
    c.res.headers.set('X-Refresh-Token', refreshed)
    c.res.headers.append('Set-Cookie', authCookie(refreshed, c.req.url, c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN, authSessionSeconds))
  } catch (e) {
    return c.json({ error: 'invalid token' }, 401)
  }
}

// Login
app.post('/api/login', async (c) => {
  return finishLogin(c, await c.req.json())
})

app.post('/api/auth/login', async (c) => {
  return finishLogin(c, await c.req.json())
})

app.post('/api/auth/change-password', authenticate, async (c) => {
  const currentUser = c.var.user || {}
  const rawId = currentUser.id || currentUser.email
  if (!rawId) return c.json({ error: 'invalid token' }, 401)

  const { currentPassword, newPassword } = await c.req.json()
  if (!newPassword) return c.json({ error: 'newPassword is required.' }, 400)
  if (newPassword.length < 8) return c.json({ error: 'New password must be at least 8 characters.' }, 400)

  const resolved = await resolveSettingsIdentity(c.env.APP_DB, rawId)
  const id = resolved.settingsKey || rawId
  const settings = resolved.settings
  if (!settings) return c.json({ error: 'User not found.' }, 404)

  const forceChangeFlow =
    settings.mustChangePassword === true ||
    settings.mustChangePassword === 'true' ||
    settings.mustChangePassword === 1 ||
    currentUser.mustChangePassword === true ||
    currentUser.mustChangePassword === 'true' ||
    currentUser.mustChangePassword === 1

  // The user is already authenticated with a valid session token at this point.
  // We still accept currentPassword when clients send it, but we do not block the
  // change if older/stale frontend flows omit it or send an outdated value.
  if (!forceChangeFlow && currentPassword) {
    try {
      await verifyPasswordCandidate(String(currentPassword), settings)
    } catch {
      return c.json({ error: 'Unable to verify credentials.' }, 500)
    }
  }

  const updatedSettings = await withHashedPassword({ ...settings, mustChangePassword: false, initialPassword: undefined }, String(newPassword))
  await upsertSettings(c.env.APP_DB, id, updatedSettings)

  const roleContext = buildRoleContext(updatedSettings, resolved.userRow?.role, currentUser.activeRole || currentUser.role)
  const userRole = roleContext.selectedRole
  const name = updatedSettings.name || resolved.userRow?.name || id
  const tenantId = settings.tenantId || settings.schoolId
  const tenant = tenantId
    ? await getTenantById(c.env.APP_DB, tenantId)
    : await getTenantByOwnerEmail(c.env.APP_DB, id)

  const authSessionSeconds = resolveAuthSessionSeconds(c.env)
  const token = await sign({
    role: userRole,
    roles: roleContext.rawRoles,
    switchableRoles: roleContext.switchableRoles,
    adminRoles: roleContext.adminRoles,
    name,
    id,
    tenantId: tenant?.id,
    exp: Math.floor(Date.now() / 1000) + authSessionSeconds,
  }, c.env.JWT_SECRET)

  const user = attachTenantContext(buildUserProfile(id, userRole, name, { ...updatedSettings, mustChangePassword: false }), tenant)

  await addAudit(c.env.APP_DB, id, { action: 'passwordChanged', data: { by: id } }).catch(() => {})

  const response = c.json({ success: true, token, user })
  response.headers.append('Set-Cookie', authCookie(token, c.req.url, c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN, authSessionSeconds))
  return response
})

app.post('/api/auth/forgot-password', async (c) => {
  const payload = await c.req.json().catch(() => ({}))
  const email = String(payload?.email || '').trim().toLowerCase()
  if (!email) return c.json({ error: 'Email is required.' }, 400)

  const resolved = await resolveSettingsIdentity(c.env.APP_DB, email)
  const settings = resolved.settings || {}
  const role = String(settings.role || resolved.userRow?.role || '').trim().toLowerCase()
  const accountType = String(settings.accountType || '').trim().toLowerCase()

  if (!resolved.settings || !isEligibleSelfServeReset(role, accountType)) {
    return c.json({ error: 'Contact your school admin for password reset.' }, 403)
  }

  try {
    const issued = await createPasswordResetToken(c.env.APP_DB, email, role || accountType || 'user', {
      requestedIp: c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '',
      userAgent: c.req.header('User-Agent') || '',
    })

    const resetUrl = `${getPasswordResetBaseUrl(c.env)}?token=${encodeURIComponent(issued.token)}`
    await sendZohoPasswordResetEmail(c.env, {
      to: email,
      name: String(settings.name || resolved.userRow?.name || email),
      resetUrl,
    })

    await addAudit(c.env.APP_DB, email, { action: 'passwordResetRequested', data: { email, role } }).catch(() => {})
    return c.json({ success: true, message: 'Check your email for the reset link.' })
  } catch (error) {
    console.error('Forgot password failed', { email, error })
    return c.json({ error: error instanceof Error ? error.message : 'Could not request password reset.' }, 500)
  }
})

app.post('/api/auth/reset-password', async (c) => {
  const payload = await c.req.json().catch(() => ({}))
  const token = String(payload?.token || '').trim()
  const newPassword = String(payload?.newPassword || '')

  if (!token || !newPassword) {
    return c.json({ error: 'token and newPassword are required.' }, 400)
  }

  if (newPassword.length < 8) {
    return c.json({ error: 'New password must be at least 8 characters.' }, 400)
  }

  const tokenRecord = await getPasswordResetTokenRecord(c.env.APP_DB, token)
  if (!tokenRecord) return c.json({ error: 'This reset link is invalid or expired.' }, 400)
  if (tokenRecord.usedAt) return c.json({ error: 'This reset link has already been used.' }, 400)
  if (new Date(String(tokenRecord.expiresAt || '')) <= new Date()) {
    return c.json({ error: 'This reset link is invalid or expired.' }, 400)
  }

  const email = String(tokenRecord.email || '').trim().toLowerCase()
  const resolved = await resolveSettingsIdentity(c.env.APP_DB, email)
  const id = resolved.settingsKey || email
  const settings = resolved.settings
  if (!settings) return c.json({ error: 'Account not found.' }, 404)

  const role = String(settings.role || resolved.userRow?.role || tokenRecord.role || '').trim().toLowerCase()
  const accountType = String(settings.accountType || '').trim().toLowerCase()
  if (!isEligibleSelfServeReset(role, accountType)) {
    return c.json({ error: 'Contact your school admin for password reset.' }, 403)
  }

  const updatedSettings = await withHashedPassword({ ...settings, mustChangePassword: false, initialPassword: undefined }, newPassword)
  await upsertSettings(c.env.APP_DB, id, updatedSettings)
  await markPasswordResetTokenUsed(c.env.APP_DB, String(tokenRecord.id))
  await addAudit(c.env.APP_DB, email, { action: 'passwordResetCompleted', data: { email, role } }).catch(() => {})

  return c.json({ success: true, message: 'Password has been reset. You can now sign in.' })
})

app.get('/api/users/me', authenticate, async (c) => {
  const currentUser = c.var.user || {}
  const rawId = currentUser.id || currentUser.sub || currentUser.email
  if (!rawId) {
    return c.json({ error: 'invalid token' }, 401)
  }
  const resolved = await resolveSettingsIdentity(c.env.APP_DB, rawId)
  const id = resolved.settingsKey || rawId
  const settings = resolved.settings
  const roleContext = buildRoleContext(settings || {}, resolved.userRow?.role, currentUser.activeRole || currentUser.role)
  const role = roleContext.selectedRole
  const name = settings?.name || resolved.userRow?.name || currentUser.name || id
  const tenantId = settings?.tenantId || settings?.schoolId
  const tenant = tenantId
    ? await getTenantById(c.env.APP_DB, tenantId)
    : await getTenantByOwnerEmail(c.env.APP_DB, id)
  const user = attachTenantContext(buildUserProfile(id, role, name, settings || {}), tenant)
  return c.json({ success: true, user, ...user })
})

app.get('/api/tenants/me', authenticate, async (c) => {
  const { actorId, role, tenant, forbidden } = await resolveTenantForActor(c)
  if (forbidden) return c.json({ error: 'forbidden' }, 403)
  if (!actorId || !tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const payments = await listTenantPayments(c.env.APP_DB, tenant.id)
  const discountCode = tenant.discountCode ? await getTenantDiscountCode(c.env.APP_DB, tenant.discountCode) : null
  const { plans } = await getTenantPricingState(c.env.APP_DB)
  const quote = await buildTenantQuoteForTenant(c.env.APP_DB, tenant, discountCode, plans)
  const tenantWithUsage = { ...tenant, studentCount: quote.billableUserCount, billableUserCount: quote.billableUserCount, userCounts: quote.userCounts, websiteUrl: buildTenantWebsiteUrl(tenant, c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN) }

  return c.json({
    success: true,
    actorRole: role,
    tenant: tenantWithUsage,
    quote,
    payments,
  })
})

app.post('/api/tenants/payments/initiate', authenticate, async (c) => {
  const payload = await c.req.json()
  const requestedTenantId = payload.tenantId ? String(payload.tenantId) : undefined
  const { actorId, role, tenant, forbidden } = await resolveTenantForActor(c, requestedTenantId)
  if (forbidden) return c.json({ error: 'forbidden' }, 403)
  if (!actorId || !tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const discountCode = tenant.discountCode ? await resolveDiscountCode(c.env.APP_DB, tenant.discountCode, tenant.planKey) : null
  const { plans } = await getTenantPricingState(c.env.APP_DB)
  const quote = await buildTenantQuoteForTenant(c.env.APP_DB, tenant, discountCode, plans)

  try {
    const checkout = await initiateTenantCheckout(c, {
      tenant,
      quote,
      actorId,
      initiatedRole: role,
    })

    return c.json({
      success: true,
      tenant: { ...tenant, studentCount: quote.billableUserCount, billableUserCount: quote.billableUserCount, userCounts: quote.userCounts, websiteUrl: buildTenantWebsiteUrl(tenant, c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN) },
      quote,
      payment: checkout.payment,
      checkoutUrl: checkout.checkoutUrl,
    })
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Unable to initialize payment.',
    }, 503)
  }
})

app.post('/api/tenants/payments/verify', authenticate, async (c) => {
  const payload = await c.req.json()
  const txRef = String(payload.txRef || '').trim()
  if (!txRef) return c.json({ error: 'txRef is required.' }, 400)

  const payment = await getTenantPaymentByTxRef(c.env.APP_DB, txRef)
  if (!payment) return c.json({ error: 'Payment record not found.' }, 404)

  const { role, tenant, forbidden } = await resolveTenantForActor(c, payment.tenantId)
  if (forbidden) return c.json({ error: 'forbidden' }, 403)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  try {
    const verification = await verifyTenantPaymentForState(c, txRef, role)

    return c.json({
      success: true,
      payment: verification.payment,
      tenant: verification.tenant,
      quote: verification.quote,
      verified: verification.verified,
    })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to verify payment.' }, (error as any)?.status || 503)
  }
})

app.post('/api/tenants/payments/verify-public', async (c) => {
  const payload = await c.req.json()
  const txRef = String(payload.txRef || '').trim()
  if (!txRef) return c.json({ error: 'txRef is required.' }, 400)

  try {
    const verification = await verifyTenantPaymentForState(c, txRef, 'public-registration')

    return c.json({
      success: true,
      payment: verification.payment,
      tenant: verification.tenant,
      quote: verification.quote,
      verified: verification.verified,
      nextStep: verification.verified
        ? 'Payment verified. The school now awaits Ami approval before activation.'
        : 'Payment has not been confirmed yet.',
    })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Unable to verify payment.' }, (error as any)?.status || 503)
  }
})

app.get('/api/ami/tenants', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const tenants = await listTenants(c.env.APP_DB)
  const payments = await listTenantPayments(c.env.APP_DB)
  const discountCodes = await listTenantDiscountCodes(c.env.APP_DB, true)
  const tenantAwards = await listSchoolAwards(c.env.APP_DB, { limit: 240 })
  const awardCandidatesEntries = await Promise.all(tenants.map(async tenant => {
    const people = await listActiveTenantPeopleWithProfiles(c.env.APP_DB, tenant.id).catch(() => [])
    return [tenant.id, people.map(person => buildAwardRecipientSnapshot(person))] as const
  }))
  const awardCandidatesByTenantId = Object.fromEntries(awardCandidatesEntries)
  const { pricingConfig, plans } = await getTenantPricingState(c.env.APP_DB)
  const summary = {
    totalTenants: tenants.length,
    activeTenants: tenants.filter(tenant => tenant.status === 'active').length,
    pendingApproval: tenants.filter(tenant => tenant.approvalStatus !== 'approved').length,
    pendingPayments: tenants.filter(tenant => tenant.paymentStatus !== 'paid').length,
    activeDiscountCodes: discountCodes.filter(discountCode => discountCode.active).length,
  }

  return c.json({
    success: true,
    summary,
    tenants,
    payments,
    discountCodes,
    tenantAwards,
    awardCandidatesByTenantId,
    pricingConfig,
    plans: serializeTenantPlans(plans),
  })
})

app.post('/api/ami/tenant-pricing', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const payload = await c.req.json().catch(() => ({}))
  const customPlanSetupFeeNaira = Number(payload.customPlanSetupFeeNaira || 0)

  if (!Number.isFinite(customPlanSetupFeeNaira) || customPlanSetupFeeNaira <= 0) {
    return c.json({ error: 'Provide a valid custom onboarding fee.' }, 400)
  }

  const pricingConfig = await saveTenantPricingConfig(
    c.env.APP_DB,
    { customPlanSetupFeeCents: Math.round(customPlanSetupFeeNaira * KOBO_PER_NAIRA) },
    c.var.user.id || c.var.user.email || 'ami',
  )

  await addAudit(c.env.APP_DB, TENANT_PRICING_SETTINGS_KEY, {
    action: 'tenantPricingUpdated',
    data: {
      by: c.var.user.id || c.var.user.email || 'ami',
      customPlanSetupFeeNaira: pricingConfig.customPlanSetupFee,
    },
  }).catch(() => {})

  return c.json({ success: true, pricingConfig })
})

app.post('/api/ami/tenants/:tenantId/approve', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const tenantId = c.req.param('tenantId')
  const tenant = await getTenantById(c.env.APP_DB, tenantId)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const payload = await c.req.json().catch(() => ({}))
  const approvalNote = payload.approvalNote ? String(payload.approvalNote).trim() : null
  const now = new Date().toISOString()
  const lifecycle = deriveTenantLifecycleState('approved', tenant.paymentStatus, null)
  const updatedTenant = await updateTenant(c.env.APP_DB, tenantId, {
    approvalStatus: 'approved',
    status: lifecycle.status,
    websiteStatus: lifecycle.websiteStatus,
    approvedAt: now,
    approvedBy: c.var.user.id || c.var.user.email || 'ami',
    approvalNote,
    activatedAt: lifecycle.dashboardActive ? (tenant.activatedAt || now) : tenant.activatedAt,
    suspendedAt: null,
  })

  await addAudit(c.env.APP_DB, tenantId, {
    action: 'tenantApproved',
    data: { by: c.var.user.id || 'ami', approvalNote },
  })

  return c.json({ success: true, tenant: updatedTenant })
})

app.post('/api/ami/tenants/:tenantId/suspend', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const tenantId = c.req.param('tenantId')
  const tenant = await getTenantById(c.env.APP_DB, tenantId)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const now = new Date().toISOString()
  const updatedTenant = await updateTenant(c.env.APP_DB, tenantId, {
    status: 'suspended',
    websiteStatus: 'inactive',
    suspendedAt: now,
  })

  await addAudit(c.env.APP_DB, tenantId, {
    action: 'tenantSuspended',
    data: { by: c.var.user.id || 'ami' },
  })

  return c.json({ success: true, tenant: updatedTenant })
})

app.post('/api/ami/tenants/:tenantId/restore', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const tenantId = c.req.param('tenantId')
  const tenant = await getTenantById(c.env.APP_DB, tenantId)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const lifecycle = deriveTenantLifecycleState(tenant.approvalStatus, tenant.paymentStatus, null)
  const updatedTenant = await updateTenant(c.env.APP_DB, tenantId, {
    status: lifecycle.status,
    websiteStatus: lifecycle.websiteStatus,
    suspendedAt: null,
    activatedAt: lifecycle.dashboardActive ? (tenant.activatedAt || new Date().toISOString()) : tenant.activatedAt,
  })

  await addAudit(c.env.APP_DB, tenantId, {
    action: 'tenantRestored',
    data: { by: c.var.user.id || 'ami' },
  })

  return c.json({ success: true, tenant: updatedTenant })
})

app.post('/api/ami/tenants/:tenantId/mark-paid', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const tenantId = c.req.param('tenantId')
  const tenant = await getTenantById(c.env.APP_DB, tenantId)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const now = new Date().toISOString()
  const lifecycle = deriveTenantLifecycleState(tenant.approvalStatus, 'paid', tenant.suspendedAt)
  const updatedTenant = await updateTenant(c.env.APP_DB, tenantId, {
    paymentStatus: 'paid',
    status: lifecycle.status,
    websiteStatus: lifecycle.websiteStatus,
    activatedAt: lifecycle.dashboardActive ? (tenant.activatedAt || now) : tenant.activatedAt,
    suspendedAt: null,
  })

  await addAudit(c.env.APP_DB, tenantId, {
    action: 'tenantMarkedPaid',
    data: { by: c.var.user.id || 'ami', manualOverride: true, markedAt: now },
  })

  return c.json({ success: true, tenant: updatedTenant })
})

app.post('/api/ami/tenants/:tenantId/domain', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const tenantId = c.req.param('tenantId')
  const tenant = await getTenantById(c.env.APP_DB, tenantId)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const baseDomain = c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN
  const defaultWebsiteDomain = buildDefaultTenantWebsiteHost(tenant, baseDomain)

  let websiteDomain = normalizeHostname(payload.websiteDomain)
  if (!websiteDomain) websiteDomain = defaultWebsiteDomain
  if (websiteDomain === normalizeHostname(baseDomain) || websiteDomain === `www.${normalizeHostname(baseDomain)}`) {
    return c.json({ error: 'Platform domains cannot be assigned as tenant domains.' }, 400)
  }
  if (websiteDomain.endsWith(`.${normalizeHostname(baseDomain)}`)) {
    websiteDomain = defaultWebsiteDomain
  }

  const customDomainFeeNaira = Number(payload.customDomainFeeNaira || 0)
  if (!Number.isFinite(customDomainFeeNaira) || customDomainFeeNaira < 0) {
    return c.json({ error: 'Provide a valid custom domain fee.' }, 400)
  }

  const customDomainNotes = String(payload.customDomainNotes || '').trim()
  const existingTenant = await getTenantByWebsiteHost(c.env.APP_DB, websiteDomain)
  if (existingTenant && existingTenant.id !== tenant.id) {
    return c.json({ error: 'That domain is already assigned to another tenant.' }, 409)
  }

  const now = new Date().toISOString()
  const updatedTenant = await updateTenant(c.env.APP_DB, tenantId, {
    websiteDomain,
    metadata: {
      ...(tenant.metadata || {}),
      defaultWebsiteDomain,
      customDomainConfigured: websiteDomain !== defaultWebsiteDomain,
      customDomainFeeNaira,
      customDomainNotes,
      customDomainUpdatedAt: now,
      customDomainUpdatedBy: c.var.user.id || c.var.user.email || 'ami',
    },
    updatedAt: now,
  })

  await addAudit(c.env.APP_DB, tenantId, {
    action: 'tenantDomainUpdated',
    data: {
      by: c.var.user.id || c.var.user.email || 'ami',
      websiteDomain,
      defaultWebsiteDomain,
      customDomainFeeNaira,
      customDomainNotes,
      updatedAt: now,
    },
  }).catch(() => {})

  return c.json({
    success: true,
    tenant: {
      ...updatedTenant,
      websiteUrl: buildTenantWebsiteUrl(updatedTenant, baseDomain),
    },
  })
})

app.post('/api/ami/tenants/:tenantId/awards', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const tenantId = String(c.req.param('tenantId') || '').trim()
  if (!tenantId) return c.json({ error: 'Tenant is required.' }, 400)

  const tenant = await getTenantById(c.env.APP_DB, tenantId)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const subjectUserId = String(payload?.userId || payload?.subjectUserId || '').trim()
  const awardKey = slugifyValue(String(payload?.awardKey || payload?.awardTitle || 'custom-award')).slice(0, 80) || 'custom-award'
  const awardTitle = String(payload?.awardTitle || '').trim() || 'School Recognition Award'
  const description = String(payload?.description || '').trim()
  const periodMonth = normalizeMonthKey(payload?.periodMonth)

  if (!subjectUserId) {
    return c.json({ error: 'Select a user for the award.' }, 400)
  }

  const people = await listActiveTenantPeopleWithProfiles(c.env.APP_DB, tenantId)
  const recipient = people.find(person => String(person.id || '').trim() === subjectUserId)
  if (!recipient) {
    return c.json({ error: 'The selected user is not active in this school.' }, 400)
  }

  const award = await upsertSchoolAward(c.env.APP_DB, {
    tenantId,
    periodMonth,
    awardKey,
    awardTitle,
    description,
    subjectUserId,
    recipientSnapshot: buildAwardRecipientSnapshot(recipient),
    attachedBy: String(c.var.user.id || c.var.user.email || 'ami'),
  })

  await addAudit(c.env.APP_DB, tenantId, {
    action: 'tenantAwardAttached',
    data: {
      by: c.var.user.id || c.var.user.email || 'ami',
      awardKey,
      awardTitle,
      periodMonth,
      subjectUserId,
    },
  }).catch(() => {})

  return c.json({ success: true, award })
})

app.get('/api/ami/discount-codes', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const discountCodes = await listTenantDiscountCodes(c.env.APP_DB, true)
  return c.json({ success: true, discountCodes })
})

app.post('/api/ami/discount-codes', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const payload = await c.req.json()
  const code = String(payload.code || '').trim().toUpperCase()
  if (!code) return c.json({ error: 'Discount code is required.' }, 400)

  const discountCode = await upsertTenantDiscountCode(c.env.APP_DB, {
    code,
    name: payload.name || code,
    description: payload.description || null,
    active: payload.active !== false,
    setupFeeCents: typeof payload.setupFeeNaira === 'number' ? Math.round(payload.setupFeeNaira * KOBO_PER_NAIRA) : payload.setupFeeCents,
    studentFeeCents: typeof payload.studentFeeNaira === 'number' ? Math.round(payload.studentFeeNaira * KOBO_PER_NAIRA) : payload.studentFeeCents,
    planScope: payload.planScope || 'growth,custom',
    startsAt: payload.startsAt || new Date().toISOString(),
    endsAt: payload.endsAt || null,
    maxRedemptions: typeof payload.maxRedemptions === 'number' ? payload.maxRedemptions : null,
    createdBy: c.var.user.id || 'ami',
    metadata: payload.metadata || {},
  })

  await addAudit(c.env.APP_DB, `discount:${code}`, {
    action: 'discountCodeUpserted',
    data: { by: c.var.user.id || 'ami', active: discountCode?.active },
  }).catch(() => {})

  return c.json({ success: true, discountCode })
})

app.post('/api/ami/discount-codes/:code/end', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  const code = String(c.req.param('code') || '').trim().toUpperCase()
  const existingDiscountCode = await getTenantDiscountCode(c.env.APP_DB, code)
  if (!existingDiscountCode) return c.json({ error: 'Discount code not found.' }, 404)

  const discountCode = await upsertTenantDiscountCode(c.env.APP_DB, {
    ...existingDiscountCode,
    code,
    active: false,
    endsAt: new Date().toISOString(),
    createdBy: existingDiscountCode.createdBy,
  })

  return c.json({ success: true, discountCode })
})

app.get('/api/feature-flags', authenticate, async (c) => {
  try {
    const tenantId = String(c.var.user?.tenantId || '').trim()
    const flags = await getResolvedFeatureFlags(c.env.APP_DB, tenantId)
    return c.json({ success: true, featureFlags: flags.featureFlags })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load feature flags.', error }, 500)
  }
})

app.get('/api/ami/feature-flags', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  try {
    const tenantId = String(c.req.query('tenantId') || '').trim()
    const flags = await getResolvedFeatureFlags(c.env.APP_DB, tenantId)
    return c.json({ success: true, tenantId, ...flags })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load feature flags.', error }, 500)
  }
})

app.post('/api/ami/feature-flags', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)

  try {
    const payload = await c.req.json() as Record<string, any>
    const tenantId = String(payload?.tenantId || '').trim()
    const settingsKey = tenantId ? `tenant_feature_flags_${tenantId}` : 'platform_feature_flags'
    const existing = pickFeatureFlagOverrides(await getSettings(c.env.APP_DB, settingsKey))
    const next = {
      ...existing,
      ...pickFeatureFlagOverrides(payload),
    }

    await upsertSettings(c.env.APP_DB, settingsKey, next)
    const flags = await getResolvedFeatureFlags(c.env.APP_DB, tenantId)
    return c.json({ success: true, tenantId, ...flags })
  } catch (error) {
    return c.json({ success: false, message: 'Could not save feature flags.', error }, 500)
  }
})

app.get('/api/schools/:schoolId/website', async (c) => {
  const schoolId = c.req.param('schoolId')
  const tenant = await getTenantById(c.env.APP_DB, schoolId) || await getTenantBySubdomain(c.env.APP_DB, schoolId)
  const website = buildTenantWebsite(c, schoolId, tenant)
  return c.json({ success: true, school: website, website, ...website })
})

app.get('/api/header/:roleKey', authenticate, async (c) => {
  const roleKey = c.req.param('roleKey')
  try {
    return c.json(await buildAuthenticatedHeader(c, roleKey))
  } catch {
    return c.json(headerFallbackByRole[roleKey] || buildGenericHeader(roleKey))
  }
})

app.get('/api/push/public-key', authenticate, async (c) => {
  const publicKey = String(c.env.WEB_PUSH_VAPID_PUBLIC_KEY || '').trim()
  return c.json({ success: true, available: Boolean(publicKey), publicKey: publicKey || null })
})

app.post('/api/push/subscriptions', authenticate, async (c) => {
  const currentUser = c.var.user || {}
  const userIdentifier = String(currentUser.id || currentUser.email || currentUser.sub || '').trim()
  if (!userIdentifier) return c.json({ success: false, error: 'invalid token' }, 401)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const subscription = normalizePushSubscriptionPayload(payload.subscription || payload)
  if (!subscription) return c.json({ success: false, error: 'Valid push subscription is required.' }, 400)

  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const tenantId = String(resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || currentUser.tenantId || '').trim()
  if (!tenantId) return c.json({ success: false, error: 'No tenant.' }, 400)

  const userId = String(resolvedUser.userRow?.id || userIdentifier).trim()
  const userEmail = String(resolvedUser.userRow?.email || resolvedUser.settings?.email || currentUser.email || '').trim()
  const roleKey = normalizeRole(payload.roleKey) || getActiveRole(currentUser) || normalizeRole(resolvedUser.settings?.role) || 'student'

  const saved = await upsertWebPushSubscription(c.env.APP_DB, {
    tenantId,
    userId,
    userEmail,
    roleKey,
    deviceLabel: String(payload.deviceLabel || '').trim(),
    subscription,
  })

  return c.json({ success: true, subscription: saved })
})

app.delete('/api/push/subscriptions', authenticate, async (c) => {
  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const endpoint = String(payload.endpoint || payload?.subscription?.endpoint || '').trim()
  if (!endpoint) return c.json({ success: false, error: 'Subscription endpoint is required.' }, 400)

  await deactivateWebPushSubscriptionByEndpoint(c.env.APP_DB, endpoint).catch(() => null)
  return c.json({ success: true })
})

app.get('/api/push/feed', authenticate, async (c) => {
  const roleKey = normalizeRole(c.req.query('roleKey') || getActiveRole(c.var.user) || 'student') || 'student'
  try {
    const header = await buildAuthenticatedHeader(c, roleKey)
    return c.json({ success: true, notification: buildLatestPushNotificationPayload(header.notificationItems || [], roleKey) })
  } catch {
    return c.json({ success: true, notification: null })
  }
})

app.get('/api/announcements', authenticate, async (c) => {
  const { role, tenant, forbidden } = await resolveTenantForActor(c)
  if (forbidden) return c.json({ success: false, error: 'forbidden' }, 403)

  if (!tenant?.id) {
    return c.json({ success: true, announcements: [], canCreate: canCreateSchoolAnnouncements(role), role })
  }

  const announcements = await listSchoolAnnouncements(c.env.APP_DB, tenant.id, 12)
  return c.json({
    success: true,
    announcements: announcements.filter(announcement => announcementTargetsRole(announcement.audienceRoles, role)),
    canCreate: canCreateSchoolAnnouncements(role),
    role,
  })
})

app.post('/api/announcements', authenticate, async (c) => {
  const { actorId, settings, role, tenant, forbidden } = await resolveTenantForActor(c)
  if (forbidden) return c.json({ success: false, error: 'forbidden' }, 403)
  if (!tenant?.id) return c.json({ success: false, error: 'No tenant.' }, 400)
  if (!canCreateSchoolAnnouncements(role)) return c.json({ success: false, error: 'forbidden' }, 403)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const title = String(payload.title || '').trim()
  const body = String(payload.body || '').trim()
  const audienceRoles = Array.isArray(payload.audienceRoles) ? payload.audienceRoles : ['all']

  if (!title || !body) {
    return c.json({ success: false, error: 'Title and body are required.' }, 400)
  }

  const announcement = await createSchoolAnnouncement(c.env.APP_DB, {
    tenantId: tenant.id,
    title,
    body,
    authorId: actorId || String(c.var.user?.id || c.var.user?.email || 'staff'),
    authorName: String(settings?.name || c.var.user?.name || actorId || role || 'Staff'),
    authorRole: String(role || ''),
    audienceRoles,
  })

  await addAudit(c.env.APP_DB, tenant.id, {
    action: 'schoolAnnouncementCreated',
    data: {
      id: announcement.id,
      title: announcement.title,
      authorId: announcement.authorId,
      authorRole: announcement.authorRole,
    },
  }).catch(() => {})

  await sendWebPushToAudience(c.env.APP_DB, c.env, {
    tenantId: tenant.id,
    roleKeys: Array.isArray(audienceRoles) ? audienceRoles : ['all'],
  }).catch(() => null)

  return c.json({ success: true, announcement }, 201)
})

app.get('/api/dashboards/:roleKey', authenticate, async (c) => {
  const roleKey = c.req.param('roleKey')
  const user = c.var.user
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const settings = resolvedUser.settings
  const tenantId = settings?.tenantId || settings?.schoolId || user.tenantId
  const displayName = settings?.name || resolvedUser.userRow?.name || user.name || user.id || user.email || 'User'

  const quickLinks = [
    { name: 'Classroom', path: '/roles/student/classroom' },
    { name: 'Practice', path: '/roles/student/practice' },
    { name: 'Assignments', path: '/roles/student/assignments' },
    { name: 'Materials', path: '/roles/student/materials' },
    { name: 'Results', path: '/roles/student/results' },
  ]

  if (roleKey === 'student') {
    let className = settings?.className || null
    let subjects: Record<string, any>[] = []
    let metrics: Array<{ label: string, value: string | number, accent: string }> = []

    if (tenantId && settings?.classId) {
      try {
        await ensureClassesTable(c.env.APP_DB)
        const currentClass = await c.env.APP_DB.prepare(
          `SELECT id, name, arm FROM classes WHERE id = ? AND tenantId = ?`
        ).bind(settings.classId, tenantId).first() as Record<string, any> | null

        if (currentClass) {
          className = `${currentClass.name}${currentClass.arm ? ` ${currentClass.arm}` : ''}`
        }
      } catch {}

      try {
        await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
        try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
        try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
        try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
        const subjectRows = await c.env.APP_DB.prepare(
          `SELECT id, name, teacherId FROM subjects WHERE tenantId = ? AND classId = ? ORDER BY name`
        ).bind(tenantId, settings.classId).all()
        subjects = (subjectRows.results || []) as Record<string, any>[]
      } catch {}

      try {
        await ensureSchoolStudentAttendanceTable(c.env.APP_DB)
        const sessionRow = await c.env.APP_DB.prepare(
          `SELECT startDate, endDate FROM school_sessions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1`
        ).bind(tenantId).first() as Record<string, any> | null

        const attendanceQuery = sessionRow?.startDate && sessionRow?.endDate
          ? `SELECT COUNT(*) as count FROM student_attendance_school WHERE tenant_id = ? AND student_id = ? AND date >= ? AND date <= ?`
          : `SELECT COUNT(*) as count FROM student_attendance_school WHERE tenant_id = ? AND student_id = ?`
        const attendanceParams = sessionRow?.startDate && sessionRow?.endDate
          ? [tenantId, resolvedUser.userRow?.id || user.id || userIdentifier, sessionRow.startDate, sessionRow.endDate]
          : [tenantId, resolvedUser.userRow?.id || user.id || userIdentifier]

        const [assignmentCountRow, materialCountRow, classmateCountRow, attendanceCountRow] = await Promise.all([
          c.env.APP_DB.prepare(`SELECT COUNT(*) as count FROM assignments WHERE classId = ?`).bind(settings.classId).first().catch(() => ({ count: 0 })),
          c.env.APP_DB.prepare(`SELECT COUNT(*) as count FROM materials WHERE classId = ?`).bind(settings.classId).first().catch(() => ({ count: 0 })),
          c.env.APP_DB.prepare(
            `SELECT COUNT(*) as count
             FROM settings
             WHERE json_extract(payload, '$.tenantId') = ?
               AND json_extract(payload, '$.role') = 'student'
               AND json_extract(payload, '$.classId') = ?
               AND COALESCE(json_extract(payload, '$.status'), 'active') != 'inactive'`
          ).bind(tenantId, settings.classId).first().catch(() => ({ count: 0 })),
          c.env.APP_DB.prepare(attendanceQuery).bind(...attendanceParams).first().catch(() => ({ count: 0 })),
        ])

        metrics = [
          { label: 'Attendance Days', value: Number(attendanceCountRow?.count || 0), accent: 'accent-emerald' },
          { label: 'Assignments', value: Number(assignmentCountRow?.count || 0), accent: 'accent-indigo' },
          { label: 'Materials', value: Number(materialCountRow?.count || 0), accent: 'accent-amber' },
          { label: 'Classmates', value: Number(classmateCountRow?.count || 0), accent: 'accent-rose' },
        ]
      } catch {}
    }

    return c.json({
      studentName: displayName,
      roleWatermark: 'STUDENT',
      metrics,
      quickLinks,
      notices: [],
      classId: settings?.classId || null,
      className,
      displayId: settings?.displayId || null,
      subjects,
    })
  }

  if (roleKey === 'teacher') {
    const teacherIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(resolvedUser, user))
    const fallbackClassIds = Array.from(new Set([
      settings?.classId,
      user.classId,
      resolvedUser.userRow?.classId,
    ].map(value => String(value || '').trim()).filter(Boolean)))

    let metrics: Array<{ label: string, value: string | number, accent: string }> = []
    let priorities: Array<{ text: string, tag?: string, accent?: string }> = []
    let activity: Array<{ text: string, tag?: string, accent?: string }> = []
    let classes: Record<string, any>[] = []

    const summary = {
      assignedClasses: 0,
      studentsReached: 0,
      activeSubjects: 0,
      reviewedSubmissions: 0,
      waitingReview: 0,
      assignmentsInClasses: 0,
      materialsInClasses: 0,
      activeLiveSessions: 0,
    }

    if (tenantId) {
      try {
        await ensureClassesTable(c.env.APP_DB)
        await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
        try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
        try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
        try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}

        let classRows: Record<string, any>[] = []
        if (teacherIdentifiers.length) {
          const identifierPlaceholders = teacherIdentifiers.map(() => '?').join(', ')
          const assignedClassRows = await c.env.APP_DB.prepare(
            `SELECT DISTINCT c.id, c.name, c.arm, c.classTeacherId
             FROM classes c
             LEFT JOIN subjects s ON s.classId = c.id AND s.tenantId = c.tenantId
             WHERE c.tenantId = ?
               AND (
                 lower(trim(coalesce(c.classTeacherId, ''))) IN (${identifierPlaceholders})
                 OR lower(trim(coalesce(s.teacherId, ''))) IN (${identifierPlaceholders})
               )
             ORDER BY c.name, c.arm`
          ).bind(tenantId, ...teacherIdentifiers, ...teacherIdentifiers).all()
          classRows = (assignedClassRows.results || []) as Record<string, any>[]
        }

        if (fallbackClassIds.length) {
          const classPlaceholders = fallbackClassIds.map(() => '?').join(', ')
          const fallbackRows = await c.env.APP_DB.prepare(
            `SELECT DISTINCT id, name, arm, classTeacherId
             FROM classes
             WHERE tenantId = ? AND id IN (${classPlaceholders})
             ORDER BY name, arm`
          ).bind(tenantId, ...fallbackClassIds).all()

          const rowMap = new Map<string, Record<string, any>>()
          for (const row of [...classRows, ...((fallbackRows.results || []) as Record<string, any>[])]) {
            const classId = String(row?.id || '').trim()
            if (!classId || rowMap.has(classId)) continue
            rowMap.set(classId, row)
          }
          classRows = Array.from(rowMap.values())
        }

        const today = new Date().toISOString().slice(0, 10)

        classes = await Promise.all(classRows.map(async row => {
          const classId = String(row.id || '')
          const isClassTeacher = matchesComparableIdentifier(row.classTeacherId, teacherIdentifiers)
          const [studentCountRow, subjectCountRow, assignmentCountRow, materialCountRow, teacherSubjectRows, liveCountRow, attendanceTodayRow] = await Promise.all([
            c.env.APP_DB.prepare(
              `SELECT COUNT(*) as count
               FROM settings
               WHERE json_extract(payload, '$.tenantId') = ?
                 AND json_extract(payload, '$.role') = 'student'
                 AND json_extract(payload, '$.classId') = ?
                 AND COALESCE(json_extract(payload, '$.status'), 'active') != 'inactive'`
            ).bind(tenantId, classId).first().catch(() => ({ count: 0 })),
            c.env.APP_DB.prepare(
              `SELECT COUNT(*) as count FROM subjects WHERE tenantId = ? AND classId = ?`
            ).bind(tenantId, classId).first().catch(() => ({ count: 0 })),
            c.env.APP_DB.prepare(
              `SELECT COUNT(*) as count FROM assignments WHERE classId = ?`
            ).bind(classId).first().catch(() => ({ count: 0 })),
            c.env.APP_DB.prepare(
              `SELECT COUNT(*) as count FROM materials WHERE classId = ?`
            ).bind(classId).first().catch(() => ({ count: 0 })),
            c.env.APP_DB.prepare(
              `SELECT id, name, teacherId FROM subjects WHERE tenantId = ? AND classId = ? ORDER BY name`
            ).bind(tenantId, classId).all().catch(() => ({ results: [] })),
            c.env.APP_DB.prepare(
              `SELECT COUNT(*) as count
               FROM classroom_live_sessions
               WHERE classId = ? AND lower(trim(coalesce(status, 'live'))) != 'ended'`
            ).bind(classId).first().catch(() => ({ count: 0 })),
            c.env.APP_DB.prepare(
              `SELECT COUNT(*) as count
               FROM student_attendance_school
               WHERE tenant_id = ? AND class_id = ? AND date = ?`
            ).bind(tenantId, classId, today).first().catch(() => ({ count: 0 })),
          ])

          let subjectRows = (((teacherSubjectRows as any)?.results || []) as Record<string, any>[])
            .filter(subjectRow => matchesComparableIdentifier(subjectRow.teacherId, teacherIdentifiers))
          if (subjectRows.length === 0 && isClassTeacher) {
            subjectRows = (((teacherSubjectRows as any)?.results || []) as Record<string, any>[])
          }

          return {
            id: classId,
            className: `${row.name}${row.arm ? ` ${row.arm}` : ''}`,
            isClassTeacher,
            studentCount: Number((studentCountRow as any)?.count || 0),
            subjectCount: Number((subjectCountRow as any)?.count || 0),
            assignmentCount: Number((assignmentCountRow as any)?.count || 0),
            materialCount: Number((materialCountRow as any)?.count || 0),
            liveActiveCount: Number((liveCountRow as any)?.count || 0),
            attendanceTodayCount: Number((attendanceTodayRow as any)?.count || 0),
            subjects: subjectRows.map(subject => ({
              id: String(subject.id || ''),
              name: String(subject.name || ''),
              teacherId: String(subject.teacherId || ''),
            })),
          }
        }))

        const studentsReached = classes.reduce((total, classroom) => total + Number(classroom.studentCount || 0), 0)
        const assignmentsInClasses = classes.reduce((total, classroom) => total + Number(classroom.assignmentCount || 0), 0)
        const materialsInClasses = classes.reduce((total, classroom) => total + Number(classroom.materialCount || 0), 0)
        const activeLiveSessions = classes.reduce((total, classroom) => total + Number(classroom.liveActiveCount || 0), 0)
        const activeSubjects = new Set(classes.flatMap(classroom =>
          (Array.isArray(classroom.subjects) ? classroom.subjects : []).map((subject: Record<string, any>) => String(subject.id || subject.name || '')).filter(Boolean)
        )).size
        const classesPendingAttendance = classes.filter(classroom => classroom.isClassTeacher && Number(classroom.attendanceTodayCount || 0) === 0).length
        const classesWithoutMaterials = classes.filter(classroom => Number(classroom.materialCount || 0) === 0).length

        let assignmentsCreated = 0
        let reviewedSubmissions = 0
        let waitingReview = 0
        let overdueReviews = 0

        if (teacherIdentifiers.length) {
          const identifierPlaceholders = teacherIdentifiers.map(() => '?').join(', ')
          const latestSubmissionCte = `
            WITH latest_submissions AS (
              SELECT s.assignmentId, s.studentId, s.grade, s.gradedAt, s.feedback, s.submittedAt
              FROM submissions s
              INNER JOIN (
                SELECT assignmentId, studentId, MAX(submittedAt) AS latestSubmittedAt
                FROM submissions
                GROUP BY assignmentId, studentId
              ) latest
                ON latest.assignmentId = s.assignmentId
               AND latest.studentId = s.studentId
               AND latest.latestSubmittedAt = s.submittedAt
            )
          `

          const [assignmentsCreatedRow, reviewedSubmissionsRow, waitingReviewRow, overdueReviewRow] = await Promise.all([
            c.env.APP_DB.prepare(
              `SELECT COUNT(*) as count
               FROM assignments
               WHERE lower(trim(coalesce(createdBy, ''))) IN (${identifierPlaceholders})`
            ).bind(...teacherIdentifiers).first().catch(() => ({ count: 0 })),
            c.env.APP_DB.prepare(
              `${latestSubmissionCte}
               SELECT COUNT(*) as count
               FROM latest_submissions s
               INNER JOIN assignments a ON a.id = s.assignmentId
               WHERE lower(trim(coalesce(a.createdBy, ''))) IN (${identifierPlaceholders})
                 AND (s.gradedAt IS NOT NULL OR s.grade IS NOT NULL OR length(trim(coalesce(s.feedback, ''))) > 0)`
            ).bind(...teacherIdentifiers).first().catch(() => ({ count: 0 })),
            c.env.APP_DB.prepare(
              `${latestSubmissionCte}
               SELECT COUNT(*) as count
               FROM latest_submissions s
               INNER JOIN assignments a ON a.id = s.assignmentId
               WHERE lower(trim(coalesce(a.createdBy, ''))) IN (${identifierPlaceholders})
                 AND s.gradedAt IS NULL
                 AND s.grade IS NULL
                 AND length(trim(coalesce(s.feedback, ''))) = 0`
            ).bind(...teacherIdentifiers).first().catch(() => ({ count: 0 })),
            c.env.APP_DB.prepare(
              `${latestSubmissionCte}
               SELECT COUNT(*) as count
               FROM latest_submissions s
               INNER JOIN assignments a ON a.id = s.assignmentId
               WHERE lower(trim(coalesce(a.createdBy, ''))) IN (${identifierPlaceholders})
                 AND a.dueAt IS NOT NULL
                 AND trim(coalesce(a.dueAt, '')) != ''
                 AND a.dueAt < ?
                 AND s.gradedAt IS NULL
                 AND s.grade IS NULL
                 AND length(trim(coalesce(s.feedback, ''))) = 0`
            ).bind(...teacherIdentifiers, new Date().toISOString()).first().catch(() => ({ count: 0 })),
          ])

          assignmentsCreated = Number((assignmentsCreatedRow as any)?.count || 0)
          reviewedSubmissions = Number((reviewedSubmissionsRow as any)?.count || 0)
          waitingReview = Number((waitingReviewRow as any)?.count || 0)
          overdueReviews = Number((overdueReviewRow as any)?.count || 0)
        }

        metrics = [
          { label: 'Assigned Classes', value: classes.length, accent: 'accent-indigo' },
          { label: 'Students Reached', value: studentsReached, accent: 'accent-emerald' },
          { label: 'Reviewed', value: reviewedSubmissions, accent: 'accent-indigo' },
          { label: 'Waiting Review', value: waitingReview, accent: 'accent-amber' },
        ]

        priorities = [
          classesPendingAttendance > 0
            ? { text: `Attendance is still open in ${classesPendingAttendance} class${classesPendingAttendance === 1 ? '' : 'es'} today.`, tag: 'Today', accent: 'accent-rose' }
            : { text: 'Attendance has been recorded for every class where you are the class teacher today.', tag: 'On Track', accent: 'accent-emerald' },
          overdueReviews > 0
            ? { text: `${overdueReviews} submission${overdueReviews === 1 ? '' : 's'} are overdue for review.`, tag: 'Urgent', accent: 'accent-amber' }
            : { text: 'No overdue submission reviews right now.', tag: 'Clear', accent: 'accent-emerald' },
          classesWithoutMaterials > 0
            ? { text: `${classesWithoutMaterials} assigned class${classesWithoutMaterials === 1 ? '' : 'es'} still has no published materials.`, tag: 'Materials', accent: 'accent-indigo' }
            : { text: 'Every assigned class already has at least one published material.', tag: 'Covered', accent: 'accent-emerald' },
        ]

        activity = [
          { text: `${assignmentsCreated} assignment${assignmentsCreated === 1 ? '' : 's'} created by you across ${activeSubjects} active subject${activeSubjects === 1 ? '' : 's'}.`, tag: 'Assignments', accent: 'accent-indigo' },
          { text: `${materialsInClasses} material${materialsInClasses === 1 ? '' : 's'} and ${activeLiveSessions} live session${activeLiveSessions === 1 ? '' : 's'} are currently attached to your teaching classes.`, tag: 'Delivery', accent: 'accent-emerald' },
          { text: `${studentsReached} student${studentsReached === 1 ? '' : 's'} sit across ${classes.length} class${classes.length === 1 ? '' : 'es'} in your present teaching load.`, tag: 'Reach', accent: 'accent-amber' },
        ]

        summary.assignedClasses = classes.length
        summary.studentsReached = studentsReached
        summary.activeSubjects = activeSubjects
        summary.reviewedSubmissions = reviewedSubmissions
        summary.waitingReview = waitingReview
        summary.assignmentsInClasses = assignmentsInClasses
        summary.materialsInClasses = materialsInClasses
        summary.activeLiveSessions = activeLiveSessions
      } catch (error) {
        console.error('Failed to build teacher dashboard', error)
      }
    }

    return c.json({
      role: 'Teacher Dashboard',
      roleWatermark: 'TEACHER',
      name: displayName,
      metrics,
      priorities,
      activity,
      classes,
      summary,
    })
  }

  return c.json({
    role: roleKey.toUpperCase(),
    roleWatermark: roleKey.toUpperCase(),
    studentName: displayName,
    name: displayName,
    metrics: [],
    quickLinks: [],
    notices: [],
    priorities: [],
    activity: [],
  })
})

// Settings
app.get('/api/settings/:id', authenticate, async (c) => {
  const id = c.req.param('id')
  const settings = await getSettings(c.env.APP_DB, id)
  return c.json(settings || null)
})

app.post('/api/settings/:id', authenticate, async (c) => {
  const id = c.req.param('id')
  const payload = await c.req.json()
  await upsertSettings(c.env.APP_DB, id, payload)
  await addAudit(c.env.APP_DB, id, { action: 'upsertSettings', data: { by: c.var.user.name } })
  return c.json({ ok: true })
})

// Audit
app.get('/api/settings/:id/audit', authenticate, async (c) => {
  const id = c.req.param('id')
  const list = await getAuditForStudent(c.env.APP_DB, id)
  return c.json(list || [])
})

app.post('/api/settings/:id/audit', authenticate, async (c) => {
  const id = c.req.param('id')
  const entry = await c.req.json()
  const saved = await addAudit(c.env.APP_DB, id, entry)
  return c.json({ ok: true, entry: saved })
})

// Admin audit
app.get('/api/audit', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['hos', 'owner'])) return c.json({ error: 'forbidden' }, 403)
  const user = c.var.user || {}
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const tenantId = String(resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId || '').trim()
  const all = await getAllAudits(c.env.APP_DB)
  const filtered = !tenantId
    ? []
    : (all || []).filter((entry: Record<string, any>) => {
      const entryTenantId = String(entry?.studentId || entry?.data?.tenantId || entry?.data?.schoolId || '').trim()
      return Boolean(entryTenantId) && entryTenantId === tenantId
    })
  return c.json(filtered)
})

// Admin reset password — owner, hos, ict_manager
app.post('/api/admin/reset-password', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict_manager'])) {
    return c.json({ error: 'forbidden' }, 403)
  }
  const { targetId, newPassword } = await c.req.json()
  if (!targetId || !newPassword) {
    return c.json({ error: 'targetId and newPassword required' }, 400)
  }
  
  // Look up user record to get canonical email (settings key). Accept internal ID,
  // email, or display ID so admins can reset from whichever identifier they see.
  const resolvedTarget = await resolveSettingsIdentity(c.env.APP_DB, targetId)
  const userRow = resolvedTarget.userRow
  
  if (!userRow) {
    return c.json({ error: 'User not found.' }, 404)
  }
  
  const settingsKey = userRow.email || userRow.id
  let settings = resolvedTarget.settings || await getSettings(c.env.APP_DB, settingsKey)
  if (!settings) settings = {}
  
  const nextSettings = await withHashedPassword({
    ...settings,
    email: userRow.email || settingsKey,
    name: userRow.name || settingsKey,
    role: userRow.role || 'student',
    mustChangePassword: true,
  }, String(newPassword))
  
  // Always store under email for consistency with login/change-password flows
  await upsertSettings(c.env.APP_DB, settingsKey, nextSettings)
  await addAudit(c.env.APP_DB, settingsKey, {
    action: 'resetPassword',
    data: { by: c.var.user.name || getActiveRole(c.var.user), adminRole: getActiveRole(c.var.user) }
  })
  return c.json({ ok: true, message: 'Password reset to default. User must change on next sign in.' })
})

// Library
app.get('/api/library/books', async (c) => {
  const list = await getAllBooks(c.env.APP_DB)
  return c.json({ success: true, books: list })
})

app.get('/api/library/books/:id', async (c) => {
  const { id } = c.req.param()
  const book = await getBookById(c.env.APP_DB, id)
  if (!book) return c.json({ success: false, error: 'not found' }, 404)
  return c.json({ success: true, book })
})

app.post('/api/library/books', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['hos', 'owner', 'admin', 'teacher', 'librarian'])) return c.json({ error: 'forbidden' }, 403)
  const payload = await c.req.json()
  const result = await upsertBook(c.env.APP_DB, payload)
  return c.json({ success: true, id: result.id })
})

app.delete('/api/library/books/:id', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['hos', 'owner', 'admin', 'librarian'])) return c.json({ error: 'forbidden' }, 403)
  const { id } = c.req.param()
  await deleteBook(c.env.APP_DB, id)
  return c.json({ success: true })
})

app.post('/api/library/books/:id/borrow', authenticate, async (c) => {
  const { id } = c.req.param()
  const by = c.var.user.name || c.var.user.sub || 'unknown'
  const studentId = getActiveRole(c.var.user) === 'student' ? by : (await c.req.json()).studentId || by
  const { dueAt } = await c.req.json()
  const b = await borrowBook(c.env.APP_DB, id, studentId, dueAt || null, { by })
  await addAudit(c.env.APP_DB, studentId, { action: 'borrow', data: { bookId: id, by } })
  return c.json({ success: true, borrowing: b })
})

app.post('/api/library/borrowings/:id/return', authenticate, async (c) => {
  const { id } = c.req.param()
  const by = c.var.user.name || c.var.user.sub || 'unknown'
  const r = await returnBook(c.env.APP_DB, id)
  await addAudit(c.env.APP_DB, by, { action: 'return', data: { borrowingId: id, by } }).catch(() => {})
  return c.json({ success: true, returned: r })
})

app.get('/api/library/borrowings/mine', authenticate, async (c) => {
  const by = c.var.user.name || c.var.user.sub || 'guest'
  const list = await getBorrowingsForStudent(c.env.APP_DB, by)
  return c.json({ success: true, borrowings: list })
})

app.get('/api/library/borrowings', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['hos', 'owner', 'admin', 'librarian'])) return c.json({ error: 'forbidden' }, 403)
  const all = await getAllBorrowings(c.env.APP_DB)
  return c.json({ success: true, borrowings: all })
})

// Save content
app.post('/api/save-content', authenticate, async (c) => {
  const { classId, content, role } = await c.req.json()
  if (!classId || typeof content === 'undefined') return c.json({ success: false, error: 'missing fields' }, 400)
  try {
    const saved = await saveContent(c.env.APP_DB, classId, role || getActiveRole(c.var.user), content)
    return c.json({ success: true, saved })
  } catch (err) {
    console.error('Save content failed', err)
    return c.json({ success: false, error: 'could not save content' }, 500)
  }
})

function isClassroomSupervisorRole(role: string) {
  return ['owner', 'hos', 'admin', 'ict', 'ict_manager', 'ami'].includes(String(role || '').trim().toLowerCase())
}

// Classrooms
app.get('/api/classrooms/assigned', authenticate, async (c) => {
  const user = c.var.user || {}
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId
  const normalizedRole = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()
  const isSupervisor = isClassroomSupervisorRole(normalizedRole)
  let teacherIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(resolvedUser, user))
  const fallbackClassIds = Array.from(new Set([
    ...(Array.isArray(resolvedUser.settings?.classIds) ? resolvedUser.settings.classIds : []),
    resolvedUser.settings?.classId,
  ].map(value => String(value || '').trim()).filter(Boolean)))

  if (!tenantId || (!isSupervisor && !teacherIdentifiers.length && !fallbackClassIds.length)) {
    return c.json({ success: true, classes: [] })
  }

  try {
    await ensureClassesTable(c.env.APP_DB)
    await ensureSubjectsTable(c.env.APP_DB)
    await ensureClassMembershipsTable(c.env.APP_DB)

    // A teacher may have more than one user row sharing the same email (duplicate accounts created via
    // import vs. login). Subjects could be assigned to either id, so fold every same-email id into the
    // teacher's identifier set — this is why "assigned but can't see" subjects happens.
    if (!isSupervisor) {
      const teacherEmails = teacherIdentifiers.filter(identifier => identifier.includes('@'))
      if (teacherEmails.length) {
        const emailPlaceholders = teacherEmails.map(() => '?').join(', ')
        const duplicateRows = await c.env.APP_DB.prepare(
          `SELECT id FROM users WHERE tenantId = ? AND lower(trim(coalesce(email, ''))) IN (${emailPlaceholders})`
        ).bind(tenantId, ...teacherEmails).all().catch(() => ({ results: [] }))
        const duplicateIds = ((duplicateRows.results || []) as Record<string, any>[])
          .map(row => toComparableIdentifier(row.id))
          .filter(Boolean)
        if (duplicateIds.length) {
          teacherIdentifiers = Array.from(new Set([...teacherIdentifiers, ...duplicateIds]))
        }
      }
    }

    let classRows: Record<string, any>[] = []
    if (isSupervisor) {
      const allClassRows = await c.env.APP_DB.prepare(
        `SELECT DISTINCT id, name, arm, classTeacherId
         FROM classes
         WHERE tenantId = ?
         ORDER BY name, arm`
      ).bind(tenantId).all()
      classRows = (allClassRows.results || []) as Record<string, any>[]
    } else if (teacherIdentifiers.length) {
      const identifierPlaceholders = teacherIdentifiers.map(() => '?').join(', ')
      const assignedClassRows = await c.env.APP_DB.prepare(
        `SELECT DISTINCT c.id, c.name, c.arm, c.classTeacherId
         FROM classes c
         LEFT JOIN subjects s ON s.classId = c.id AND s.tenantId = c.tenantId
         LEFT JOIN class_memberships cm
           ON cm.class_id = c.id
          AND cm.tenant_id = c.tenantId
          AND cm.membership_role = 'teacher'
         WHERE c.tenantId = ?
           AND (
             lower(trim(coalesce(c.classTeacherId, ''))) IN (${identifierPlaceholders})
             OR lower(trim(coalesce(s.teacherId, ''))) IN (${identifierPlaceholders})
             OR lower(trim(coalesce(cm.user_id, ''))) IN (${identifierPlaceholders})
           )
         ORDER BY c.name, c.arm`
      ).bind(tenantId, ...teacherIdentifiers, ...teacherIdentifiers, ...teacherIdentifiers).all()
      classRows = (assignedClassRows.results || []) as Record<string, any>[]
    }

    if (fallbackClassIds.length) {
      const classPlaceholders = fallbackClassIds.map(() => '?').join(', ')
      const fallbackRows = await c.env.APP_DB.prepare(
        `SELECT DISTINCT id, name, arm, classTeacherId
         FROM classes
         WHERE tenantId = ? AND id IN (${classPlaceholders})
         ORDER BY name, arm`
      ).bind(tenantId, ...fallbackClassIds).all()

      const rowMap = new Map<string, Record<string, any>>()
      for (const row of [...classRows, ...((fallbackRows.results || []) as Record<string, any>[])]) {
        const classId = String(row?.id || '').trim()
        if (!classId || rowMap.has(classId)) continue
        rowMap.set(classId, row)
      }
      classRows = Array.from(rowMap.values())
    }

    // Batch all per-class queries so we fire O(1) queries regardless of class count,
    // instead of the previous O(7N) pattern that breached D1 sub-request limits.
    const classIds = classRows.map(row => String(row.id || '')).filter(Boolean)
    const classIdPlaceholders = classIds.map(() => '?').join(', ')

    const [
      subjectAllRows,
      membershipAllRows,
      studentCountRows,
      assignmentCountRows,
      materialCountRows,
      streamCountRows,
    ] = classIds.length ? await Promise.all([
      c.env.APP_DB.prepare(
        `SELECT id, name, teacherId, classId FROM subjects WHERE tenantId = ? AND classId IN (${classIdPlaceholders}) ORDER BY classId, name`
      ).bind(tenantId, ...classIds).all().catch(() => ({ results: [] })),
      c.env.APP_DB.prepare(
        `SELECT class_id, user_id FROM class_memberships WHERE class_id IN (${classIdPlaceholders}) AND tenant_id = ? AND membership_role = 'teacher'`
      ).bind(...classIds, tenantId).all().catch(() => ({ results: [] })),
      c.env.APP_DB.prepare(
        `SELECT json_extract(payload, '$.classId') as classId, COUNT(*) as count
         FROM settings
         WHERE json_extract(payload, '$.tenantId') = ?
           AND json_extract(payload, '$.role') = 'student'
           AND json_extract(payload, '$.classId') IN (${classIdPlaceholders})
           AND COALESCE(json_extract(payload, '$.status'), 'active') != 'inactive'
         GROUP BY json_extract(payload, '$.classId')`
      ).bind(tenantId, ...classIds).all().catch(() => ({ results: [] })),
      c.env.APP_DB.prepare(
        `SELECT classId, COUNT(*) as count FROM assignments WHERE classId IN (${classIdPlaceholders}) GROUP BY classId`
      ).bind(...classIds).all().catch(() => ({ results: [] })),
      c.env.APP_DB.prepare(
        `SELECT classId, COUNT(*) as count FROM materials WHERE classId IN (${classIdPlaceholders}) GROUP BY classId`
      ).bind(...classIds).all().catch(() => ({ results: [] })),
      c.env.APP_DB.prepare(
        `SELECT classId, COUNT(*) as count FROM posts WHERE classId IN (${classIdPlaceholders}) GROUP BY classId`
      ).bind(...classIds).all().catch(() => ({ results: [] })),
    ]) : [{ results: [] }, { results: [] }, { results: [] }, { results: [] }, { results: [] }, { results: [] }]

    // Index batch results by classId for O(1) lookup
    const subjectsByClass = new Map<string, Record<string, any>[]>()
    for (const s of (subjectAllRows.results || []) as Record<string, any>[]) {
      const cid = String(s.classId || '')
      if (!subjectsByClass.has(cid)) subjectsByClass.set(cid, [])
      subjectsByClass.get(cid)!.push(s)
    }
    const membershipsByClass = new Map<string, string[]>()
    for (const m of (membershipAllRows.results || []) as Record<string, any>[]) {
      const cid = String(m.class_id || '')
      if (!membershipsByClass.has(cid)) membershipsByClass.set(cid, [])
      membershipsByClass.get(cid)!.push(String(m.user_id || '').trim())
    }
    const countByClass = (rows: any[]) => {
      const map = new Map<string, number>()
      for (const r of rows as Record<string, any>[]) map.set(String(r.classId || ''), Number(r.count || 0))
      return map
    }
    const studentCounts = countByClass(studentCountRows.results || [])
    const assignmentCounts = countByClass(assignmentCountRows.results || [])
    const materialCounts = countByClass(materialCountRows.results || [])
    const streamCounts = countByClass(streamCountRows.results || [])
    const subjectCounts = new Map<string, number>()
    for (const [cid, rows] of subjectsByClass) subjectCounts.set(cid, rows.length)

    const assignedClasses = classRows.map(row => {
      const classId = String(row.id || '')
      const extraTeacherIds = (membershipsByClass.get(classId) || []).filter(Boolean)
      // Assistant/co-teachers (class_membership teachers) share the class teacher's rights.
      const isCoTeacher = extraTeacherIds.some(id => matchesComparableIdentifier(id, teacherIdentifiers))
      const isClassTeacher = matchesComparableIdentifier(row.classTeacherId, teacherIdentifiers) || isCoTeacher
      const canManageClassroom = isSupervisor || isClassTeacher

      let subjectRows = subjectsByClass.get(classId) || []
      if (!isSupervisor) {
        if (isClassTeacher) {
          // Class teachers manage the whole class, so they see all subjects
        } else {
          subjectRows = subjectRows.filter(subjectRow => matchesComparableIdentifier(subjectRow.teacherId, teacherIdentifiers))
        }
      }

      const className = `${row.name}${row.arm ? ` ${row.arm}` : ''}`
      return {
        id: classId,
        name: row.name,
        arm: row.arm || '',
        className,
        isClassTeacher,
        canManageClassroom,
        isSupervisor,
        teacherIds: Array.from(new Set([String(row.classTeacherId || '').trim(), ...extraTeacherIds].filter(Boolean))),
        studentCount: studentCounts.get(classId) || 0,
        subjectCount: subjectCounts.get(classId) || 0,
        assignmentCount: assignmentCounts.get(classId) || 0,
        materialCount: materialCounts.get(classId) || 0,
        streamCount: streamCounts.get(classId) || 0,
        subjects: subjectRows.map(subject => ({
          id: String(subject.id || ''),
          name: String(subject.name || ''),
          teacherId: String(subject.teacherId || ''),
        })),
      }
    })

    return c.json({ success: true, classes: assignedClasses })
  } catch (error) {
    console.error('Failed to load assigned classes', error)
    return c.json({ success: false, error: 'Could not load assigned classes.' }, 500)
  }
})

app.get('/api/classrooms/:classroomId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const classroom = await getClassById(c.env.APP_DB, classroomId)
  if (!classroom) return c.json({ success: false, message: 'Classroom not found' }, 404)
  return c.json({ success: true, class: classroom })
})

app.get('/api/classrooms/:classroomId/stream', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const posts = await getPostsForClass(c.env.APP_DB, classroomId)
    return c.json({ success: true, posts })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.get('/api/classrooms/:classroomId/posts', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const posts = await getPostsForClass(c.env.APP_DB, classroomId)
    return c.json({ success: true, posts })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/stream', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const body = await c.req.json()
  const content = String(body?.content || body?.text || '').trim()
  const authorId = String(body?.authorId || c.var.user?.id || 'user-teacher-1').trim()
  if (!content) {
    return c.json({ success: false, message: 'Content is required' }, 400)
  }
  try {
    const newPost = {
      classId: classroomId,
      authorId,
      content,
    }
    const insertedPost = await createPost(c.env.APP_DB, newPost)
    return c.json({ success: true, post: insertedPost }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/posts', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const body = await c.req.json()
  const content = String(body?.content || body?.text || '').trim()
  const authorId = String(body?.authorId || c.var.user?.id || 'user-teacher-1').trim()
  if (!content) {
    return c.json({ success: false, message: 'Content is required' }, 400)
  }
  try {
    const newPost = {
      classId: classroomId,
      authorId,
      content,
    }
    const insertedPost = await createPost(c.env.APP_DB, newPost)
    return c.json({ success: true, post: insertedPost }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/posts/:postId/comments', authenticate, async (c) => {
  const postId = c.req.param('postId')
  const body = await c.req.json()
  const text = String(body?.text || body?.content || '').trim()
  const authorId = String(body?.authorId || c.var.user?.id || c.var.user?.email || '').trim()
  const authorName = String(c.var.user?.name || authorId || 'Teacher').trim()

  if (!text) {
    return c.json({ success: false, message: 'Comment text is required.' }, 400)
  }

  try {
    const comment = await addPostComment(c.env.APP_DB, postId, {
      text,
      authorId,
      user: authorName,
    })
    return c.json({ success: true, comment }, 201)
  } catch (error) {
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Could not add comment.' }, 500)
  }
})

app.put('/api/classrooms/:classroomId/stream/:postId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const postId = c.req.param('postId')
  const body = await c.req.json()
  const content = String(body?.content || '').trim()

  if (!content) {
    return c.json({ success: false, message: 'Content is required.' }, 400)
  }

  try {
    const context = await resolveClassroomModerationContext(c.env.APP_DB, c.var.user || {}, classroomId)
    if (!context.ok) {
      return c.json({ success: false, message: context.message }, context.status)
    }

    const post = await getPostById(c.env.APP_DB, postId)
    if (!post || String(post.classId || '') !== String(classroomId || '')) {
      return c.json({ success: false, message: 'Post not found.' }, 404)
    }

    const canManagePost = context.canManageClasswide || matchesComparableIdentifier(post.authorId, context.actorIdentifiers)
    if (!canManagePost) {
      return c.json({ success: false, message: 'You are not allowed to edit this post.' }, 403)
    }

    const updatedPost = await updatePost(c.env.APP_DB, postId, { content })
    return c.json({ success: true, post: updatedPost })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.delete('/api/classrooms/:classroomId/stream/:postId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const postId = c.req.param('postId')

  try {
    const context = await resolveClassroomModerationContext(c.env.APP_DB, c.var.user || {}, classroomId)
    if (!context.ok) {
      return c.json({ success: false, message: context.message }, context.status)
    }

    const post = await getPostById(c.env.APP_DB, postId)
    if (!post || String(post.classId || '') !== String(classroomId || '')) {
      return c.json({ success: false, message: 'Post not found.' }, 404)
    }

    const canManagePost = context.canManageClasswide || matchesComparableIdentifier(post.authorId, context.actorIdentifiers)
    if (!canManagePost) {
      return c.json({ success: false, message: 'You are not allowed to delete this post.' }, 403)
    }

    await deletePost(c.env.APP_DB, postId)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.get('/api/classrooms/:classroomId/live', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const sessions = await getLiveSessionsForClass(c.env.APP_DB, classroomId)
    return c.json({ success: true, sessions })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load live sessions.', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/live', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const { subjectId, topic, mode } = await c.req.json()

  if (!subjectId) {
    return c.json({ success: false, message: 'subjectId is required.' }, 400)
  }

  try {
    const publishContext = await resolveMaterialPublishingContext(c.env.APP_DB, c.var.user || {}, classroomId, String(subjectId))
    if (!publishContext.ok) {
      return c.json({ success: false, message: publishContext.message }, publishContext.status)
    }

    const session = await createLiveSession(c.env.APP_DB, {
      classId: classroomId,
      subjectId: String(publishContext.subjectRow.id || ''),
      subjectName: String(publishContext.subjectRow.name || ''),
      topic: String(topic || '').trim() || `${String(publishContext.subjectRow.name || 'Class')} Live Session`,
      mode: String(mode || '').trim() || 'Video + Audio',
      createdBy: publishContext.teacherId,
      createdByName: publishContext.uploadedByName,
      metadata: {
        className: `${publishContext.classRow.name}${publishContext.classRow.arm ? ` ${publishContext.classRow.arm}` : ''}`,
      },
    })

    return c.json({ success: true, session }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Could not start live class.', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/live/:sessionId/end', authenticate, async (c) => {
  const sessionId = c.req.param('sessionId')

  try {
    const session = await updateLiveSessionStatus(c.env.APP_DB, sessionId, 'Ended')
    return c.json({ success: true, session })
  } catch (error) {
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Could not end live class.' }, 500)
  }
})

app.get('/api/classrooms/:classroomId/subjects', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ success: false, message: 'No tenant.' }, 400)

  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
    const rows = await c.env.APP_DB.prepare(
      'SELECT * FROM subjects WHERE tenantId = ? AND classId = ? ORDER BY name'
    ).bind(tenantId, classroomId).all()
    return c.json({ success: true, subjects: rows.results || [] })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load class subjects.', error }, 500)
  }
})

app.get('/api/classrooms/:classroomId/assignments', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const assignments = await getAssignmentsForClass(c.env.APP_DB, classroomId)
    const user = c.var.user || {}

    if (String(user.role || '').toLowerCase() === 'student') {
      const userIdentifier = user.id || user.email || user.sub || ''
      const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
      const studentId = String(resolvedUser.userRow?.id || user.id || userIdentifier).trim()
      // Batch: one query for all submissions instead of N per-assignment queries
      const assignmentIds = assignments.map(a => String((a as any).id || '')).filter(Boolean)
      let submissionMap = new Map<string, Record<string, any>>()
      if (assignmentIds.length > 0 && studentId) {
        const placeholders = assignmentIds.map(() => '?').join(', ')
        const subRows = await c.env.APP_DB.prepare(
          `SELECT id, assignmentId, studentId, content, submittedAt, grade, gradedAt, feedback
           FROM submissions
           WHERE studentId = ? AND assignmentId IN (${placeholders})
           ORDER BY submittedAt DESC`
        ).bind(studentId, ...assignmentIds).all().catch(() => ({ results: [] }))
        for (const row of ((subRows.results || []) as Record<string, any>[])) {
          const aid = String(row.assignmentId || '')
          if (!submissionMap.has(aid)) {
            submissionMap.set(aid, { ...row, content: (() => { try { return JSON.parse(row.content || '{}') } catch { return {} } })() })
          }
        }
      }
      const hydratedAssignments = assignments.map(assignment => {
        const mySubmission = submissionMap.get(String((assignment as any).id || '')) || null
        return { ...assignment, mySubmission, studentStatus: mySubmission ? 'Submitted' : 'Pending' }
      })
      return c.json({ success: true, assignments: hydratedAssignments })
    }

    // Teachers/admins: flag which assignments the viewer may edit/delete
    // (creator, or class-wide moderator) so the UI can show controls correctly.
    let moderation: any = null
    try {
      moderation = await resolveClassroomModerationContext(c.env.APP_DB, user, classroomId)
    } catch {
      moderation = null
    }
    const canManageClasswide = Boolean(moderation?.ok && moderation.canManageClasswide)
    const actorIdentifiers: string[] = (moderation?.ok && moderation.actorIdentifiers) || []
    const flaggedAssignments = assignments.map(assignment => ({
      ...assignment,
      canManage: canManageClasswide || matchesComparableIdentifier((assignment as any).createdBy, actorIdentifiers),
    }))
    return c.json({ success: true, assignments: flaggedAssignments })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error: String((error as Error)?.message || error) }, 500)
  }
})

app.post('/api/classrooms/:classroomId/assignments', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const payload = await c.req.json().catch(() => ({})) as Record<string, any>
    const { title, description, dueAt, subjectId, format, questions, metadata, topic } = payload
    if (!title || !subjectId) {
      return c.json({ success: false, message: 'Title and subject are required' }, 400)
    }
    const topicName = String(topic || (metadata && typeof metadata === 'object' ? metadata.topic : '') || '').trim()
    const user = c.var.user || {}
    const userIdentifier = user.id || user.email || user.sub || ''
    const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId
    const teacherIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(resolvedUser, user))
    const teacherId = String(resolvedUser.userRow?.id || resolvedUser.userRow?.email || resolvedUser.settingsKey || user.id || '').trim()

    await ensureClassesTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}

    const classRow = await c.env.APP_DB.prepare(
      `SELECT id, tenantId, name, arm, classTeacherId FROM classes WHERE id = ?`
    ).bind(classroomId).first() as Record<string, any> | null

    if (!classRow || (tenantId && String(classRow.tenantId || '') !== String(tenantId))) {
      return c.json({ success: false, message: 'Class not found.' }, 404)
    }

    const subjectRow = await c.env.APP_DB.prepare(
      `SELECT id, name, teacherId FROM subjects WHERE id = ? AND classId = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '')`
    ).bind(subjectId, classroomId, classRow.tenantId || tenantId || '').first() as Record<string, any> | null

    if (!subjectRow) {
      return c.json({ success: false, message: 'Subject not found for this class.' }, 404)
    }

    const userRole = String((user as any).role || '').toLowerCase()
    const isAdmin = ['owner', 'hos', 'ict', 'ict_manager', 'ami'].includes(userRole)
    const canCreateForSubject = isAdmin
      || matchesComparableIdentifier(subjectRow.teacherId, teacherIdentifiers)
      || matchesComparableIdentifier(classRow.classTeacherId, teacherIdentifiers)
      || await classHasMembershipTeacher(c.env.APP_DB, classRow.tenantId || tenantId, classRow.id, teacherIdentifiers)
    if (!canCreateForSubject) {
      return c.json({ success: false, message: 'You are not assigned to this subject.' }, 403)
    }

    const normalizedQuestions = Array.isArray(questions) ? questions : []
    const newAssignment = {
      classId: classroomId,
      title,
      description,
      dueAt,
      subjectId: String(subjectRow.id || ''),
      subjectName: String(subjectRow.name || payload.subjectName || ''),
      format: String(format || (normalizedQuestions.length > 1 ? 'mixed' : normalizedQuestions[0]?.type || 'assignment')),
      questions: normalizedQuestions,
      metadata: {
        ...(metadata && typeof metadata === 'object' ? metadata : {}),
        ...(topicName ? { topic: topicName } : {}),
        questionCount: normalizedQuestions.length,
        className: `${classRow.name}${classRow.arm ? ` ${classRow.arm}` : ''}`,
      },
      createdBy: teacherId,
    }
    const insertedAssignment = await createAssignment(c.env.APP_DB, newAssignment)

    // Persist the tagged topic so it appears alongside materials in the Subjects tab.
    if (topicName) {
      try {
        await ensureClassTopic(c.env.APP_DB, {
          tenantId: classRow.tenantId || tenantId,
          classId: classroomId,
          subjectId: String(subjectRow.id || ''),
          name: topicName,
          createdBy: teacherId,
        })
      } catch (topicError) {
        console.error('ensureClassTopic (assignment create) failed:', topicError)
      }
    }

    // Secondary: index questions into the reuse/practice engine. This must never
    // fail the assignment creation itself, so swallow any error here.
    try {
      await syncQuestionUsagesForEngine(c.env.APP_DB, String(classRow.tenantId || tenantId || '').trim(), 'assignment', String(insertedAssignment.id || '').trim(), normalizedQuestions, {
        classId: classroomId,
        className: `${classRow.name}${classRow.arm ? ` ${classRow.arm}` : ''}`,
        subjectId: String(subjectRow.id || ''),
        subjectName: String(subjectRow.name || ''),
        createdBy: teacherId,
      })
    } catch (syncError) {
      console.error('syncQuestionUsagesForEngine (assignment create) failed:', syncError)
    }

    return c.json({ success: true, assignment: insertedAssignment }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error: String((error as Error)?.message || error) }, 500)
  }
})

app.put('/api/classrooms/:classroomId/assignments/:assignmentId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const assignmentId = c.req.param('assignmentId')
  const payload = await c.req.json()
  const nextTitle = String(payload?.title || '').trim()

  if (!nextTitle) {
    return c.json({ success: false, message: 'Title is required.' }, 400)
  }

  try {
    const context = await resolveClassroomModerationContext(c.env.APP_DB, c.var.user || {}, classroomId)
    if (!context.ok) {
      return c.json({ success: false, message: context.message }, context.status)
    }

    const assignment = await getAssignmentById(c.env.APP_DB, assignmentId)
    if (!assignment || String(assignment.classId || '') !== String(classroomId || '')) {
      return c.json({ success: false, message: 'Assignment not found.' }, 404)
    }

    const canManageAssignment = context.canManageClasswide || matchesComparableIdentifier(assignment.createdBy, context.actorIdentifiers)
    if (!canManageAssignment) {
      return c.json({ success: false, message: 'You are not allowed to edit this assignment.' }, 403)
    }

    const updatedAssignment = await updateAssignment(c.env.APP_DB, assignmentId, {
      title: nextTitle,
      description: typeof payload?.description === 'string' ? payload.description.trim() : assignment.description,
      dueAt: Object.prototype.hasOwnProperty.call(payload || {}, 'dueAt') ? (payload?.dueAt || null) : assignment.dueAt,
    })

    try {
      await syncQuestionUsagesForEngine(
        c.env.APP_DB,
        context.tenantId,
        'assignment',
        assignmentId,
        Array.isArray(updatedAssignment?.questions) ? updatedAssignment.questions : [],
        {
          classId: classroomId,
          className: `${context.classRow.name}${context.classRow.arm ? ` ${context.classRow.arm}` : ''}`,
          subjectId: String(updatedAssignment?.subjectId || ''),
          subjectName: String(updatedAssignment?.subjectName || ''),
          createdBy: String(updatedAssignment?.createdBy || context.actorId || ''),
        },
      )
    } catch (syncError) {
      console.error('syncQuestionUsagesForEngine (assignment update) failed:', syncError)
    }

    return c.json({ success: true, assignment: updatedAssignment })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error: String((error as Error)?.message || error) }, 500)
  }
})

app.delete('/api/classrooms/:classroomId/assignments/:assignmentId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const assignmentId = c.req.param('assignmentId')

  try {
    const context = await resolveClassroomModerationContext(c.env.APP_DB, c.var.user || {}, classroomId)
    if (!context.ok) {
      return c.json({ success: false, message: context.message }, context.status)
    }

    const assignment = await getAssignmentById(c.env.APP_DB, assignmentId)
    if (!assignment || String(assignment.classId || '') !== String(classroomId || '')) {
      return c.json({ success: false, message: 'Assignment not found.' }, 404)
    }

    const canManageAssignment = context.canManageClasswide || matchesComparableIdentifier(assignment.createdBy, context.actorIdentifiers)
    if (!canManageAssignment) {
      return c.json({ success: false, message: 'You are not allowed to delete this assignment.' }, 403)
    }

    await deleteAssignment(c.env.APP_DB, assignmentId)
    await syncQuestionUsagesForEngine(c.env.APP_DB, context.tenantId, 'assignment', assignmentId, [], {})

    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

// ─── Class topics ────────────────────────────────────────────────────────────
// A topic groups assignments and materials within a subject. Topics persist even
// when empty (created from the Subjects tab) and are auto-created when a teacher
// tags an assignment or material with a new topic name.
async function ensureClassTopicsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS class_topics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    class_id TEXT,
    subject_id TEXT,
    name TEXT,
    created_by TEXT,
    created_at TEXT
  )`).run()
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS class_topics_unique_idx ON class_topics(class_id, subject_id, name)`).run().catch(() => null)
}

async function ensureClassTopic(
  db: D1Database,
  params: { tenantId?: unknown; classId: unknown; subjectId: unknown; name: unknown; createdBy?: unknown },
) {
  const name = String(params.name || '').trim()
  const classId = String(params.classId || '').trim()
  const subjectId = String(params.subjectId || '').trim()
  if (!name || !classId || !subjectId) return null
  await ensureClassTopicsTable(db)
  const existing = await db.prepare(
    `SELECT id, name, subject_id FROM class_topics WHERE class_id = ? AND subject_id = ? AND lower(name) = lower(?) LIMIT 1`
  ).bind(classId, subjectId, name).first() as Record<string, any> | null
  if (existing) return existing
  const id = `topic_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  await db.prepare(
    `INSERT INTO class_topics (id, tenant_id, class_id, subject_id, name, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, String(params.tenantId || ''), classId, subjectId, name, String(params.createdBy || ''), new Date().toISOString()).run()
  return { id, name, subject_id: subjectId }
}

app.get('/api/classrooms/:classroomId/topics', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const subjectId = String(c.req.query('subjectId') || '').trim()
  try {
    await ensureClassTopicsTable(c.env.APP_DB)
    const stmt = subjectId
      ? c.env.APP_DB.prepare(`SELECT id, subject_id, name, created_at FROM class_topics WHERE class_id = ? AND subject_id = ? ORDER BY name`).bind(classroomId, subjectId)
      : c.env.APP_DB.prepare(`SELECT id, subject_id, name, created_at FROM class_topics WHERE class_id = ? ORDER BY name`).bind(classroomId)
    const rows = await stmt.all()
    const topics = ((rows.results || []) as Record<string, any>[]).map(row => ({
      id: String(row.id || ''),
      subjectId: String(row.subject_id || ''),
      name: String(row.name || ''),
      createdAt: row.created_at || null,
    }))
    return c.json({ success: true, topics })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load topics.', error: String((error as Error)?.message || error) }, 500)
  }
})

app.post('/api/classrooms/:classroomId/topics', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const payload = await c.req.json().catch(() => ({})) as Record<string, any>
    const subjectId = String(payload?.subjectId || '').trim()
    const name = String(payload?.name || '').trim()
    if (!subjectId || !name) {
      return c.json({ success: false, message: 'Subject and topic name are required.' }, 400)
    }
    const context = await resolveClassroomModerationContext(c.env.APP_DB, c.var.user || {}, classroomId)
    if (!context.ok) return c.json({ success: false, message: context.message }, context.status)
    const subjectRow = await c.env.APP_DB.prepare(
      `SELECT id, teacherId FROM subjects WHERE id = ? AND classId = ?`
    ).bind(subjectId, classroomId).first() as Record<string, any> | null
    const canAdd = context.canManageClasswide || (subjectRow && matchesComparableIdentifier(subjectRow.teacherId, context.actorIdentifiers))
    if (!canAdd) return c.json({ success: false, message: 'You are not assigned to this subject.' }, 403)

    const topic = await ensureClassTopic(c.env.APP_DB, { tenantId: context.tenantId, classId: classroomId, subjectId, name, createdBy: context.actorId })
    return c.json({ success: true, topic: { id: topic?.id, name, subjectId } }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Could not add topic.', error: String((error as Error)?.message || error) }, 500)
  }
})

app.delete('/api/classrooms/:classroomId/topics/:topicId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const topicId = c.req.param('topicId')
  try {
    const context = await resolveClassroomModerationContext(c.env.APP_DB, c.var.user || {}, classroomId)
    if (!context.ok) return c.json({ success: false, message: context.message }, context.status)
    await ensureClassTopicsTable(c.env.APP_DB)
    if (!context.canManageClasswide) {
      const row = await c.env.APP_DB.prepare(`SELECT subject_id FROM class_topics WHERE id = ? AND class_id = ?`).bind(topicId, classroomId).first() as Record<string, any> | null
      const subjectRow = row
        ? await c.env.APP_DB.prepare(`SELECT teacherId FROM subjects WHERE id = ? AND classId = ?`).bind(String(row.subject_id || ''), classroomId).first() as Record<string, any> | null
        : null
      const canDelete = subjectRow && matchesComparableIdentifier(subjectRow.teacherId, context.actorIdentifiers)
      if (!canDelete) return c.json({ success: false, message: 'You are not allowed to delete this topic.' }, 403)
    }
    await c.env.APP_DB.prepare(`DELETE FROM class_topics WHERE id = ? AND class_id = ?`).bind(topicId, classroomId).run()
    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: 'Could not delete topic.', error: String((error as Error)?.message || error) }, 500)
  }
})

app.post('/api/assignments/:assignmentId/submit', authenticate, async (c) => {
  const assignmentId = c.req.param('assignmentId')
  const payload = await c.req.json()

  try {
    const user = c.var.user || {}
    const userIdentifier = user.id || user.email || user.sub || ''
    const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    const studentId = resolvedUser.userRow?.id || user.id || userIdentifier
    const assignment = await getAssignmentById(c.env.APP_DB, assignmentId)

    if (!assignment) {
      return c.json({ success: false, message: 'Assignment not found.' }, 404)
    }

    const assignmentClassId = String((assignment as any).classId || '').trim()
    const knownStudentClassIds = Array.from(new Set([
      resolvedUser.settings?.classId,
      user.classId,
      resolvedUser.userRow?.classId,
    ].map(value => String(value || '').trim()).filter(Boolean)))

    if (knownStudentClassIds.length > 0 && assignmentClassId && !knownStudentClassIds.includes(assignmentClassId)) {
      return c.json({ success: false, message: 'You are not assigned to this class assignment.' }, 403)
    }

    const answers = payload?.answers && typeof payload.answers === 'object' ? payload.answers : {}
    const submission = await createSubmission(c.env.APP_DB, {
      assignmentId,
      studentId,
      content: { answers },
    })

    return c.json({ success: true, submission }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Could not submit assignment.', error }, 500)
  }
})

// Student: get own latest submission for an assignment (includes grade/feedback if marked)
app.get('/api/assignments/:assignmentId/my-submission', authenticate, async (c) => {
  const assignmentId = c.req.param('assignmentId')
  try {
    const user = c.var.user || {}
    const userIdentifier = user.id || user.email || user.sub || ''
    const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    const studentId = resolvedUser.userRow?.id || user.id || userIdentifier
    const submission = await getLatestSubmissionForStudent(c.env.APP_DB, assignmentId, studentId)
    if (!submission) return c.json({ success: true, submission: null })
    return c.json({ success: true, submission })
  } catch (error) {
    return c.json({ success: false, message: 'Could not fetch submission.', error }, 500)
  }
})

// Teacher: get all submissions for an assignment
app.get('/api/assignments/:assignmentId/submissions', authenticate, async (c) => {
  const assignmentId = c.req.param('assignmentId')
  try {
    const db = c.env.APP_DB
    await db.prepare(`CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, assignmentId TEXT NOT NULL, studentId TEXT NOT NULL, content TEXT, submittedAt TEXT, grade REAL, gradedAt TEXT, feedback TEXT)`).run()
    const rows = await db.prepare(
      `SELECT s.id, s.assignmentId, s.studentId, s.content, s.submittedAt, s.grade, s.gradedAt, s.feedback, u.name as studentName
       FROM submissions s
       LEFT JOIN users u ON u.id = s.studentId
       WHERE s.assignmentId = ?
       ORDER BY s.submittedAt DESC`
    ).bind(assignmentId).all()
    const submissions = (rows.results || []).map((s: any) => ({
      ...s,
      content: s.content ? (() => { try { return JSON.parse(s.content) } catch { return {} } })() : {},
    }))
    return c.json({ success: true, submissions })
  } catch (error) {
    return c.json({ success: false, message: 'Could not fetch submissions.', error }, 500)
  }
})

// Teacher: grade a submission
app.post('/api/submissions/:submissionId/grade', authenticate, async (c) => {
  const submissionId = c.req.param('submissionId')
  try {
    const db = c.env.APP_DB
    const body = await c.req.json() as any
    const { grade, feedback } = body
    if (grade === undefined || grade === null) return c.json({ error: 'grade is required' }, 400)
    const existing = await db.prepare('SELECT id FROM submissions WHERE id = ?').bind(submissionId).first()
    if (!existing) return c.json({ error: 'Submission not found' }, 404)
    const gradedAt = new Date().toISOString()
    await db.prepare('UPDATE submissions SET grade = ?, gradedAt = ?, feedback = ? WHERE id = ?')
      .bind(Number(grade), gradedAt, feedback || null, submissionId).run()
    return c.json({ success: true, submissionId, grade: Number(grade), gradedAt, feedback: feedback || null })
  } catch (error) {
    return c.json({ success: false, message: 'Could not grade submission.', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/assignment-assets/upload', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const title = String(formData.get('title') || '').trim() || (file?.name || 'assignment-asset')

  if (!file) {
    return c.json({ success: false, message: 'File is required.' }, 400)
  }

  try {
    const fileName = `assignment_${classroomId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await c.env.UPLOADS.put(fileName, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    })
    const url = `https://ndovera.com/files/${fileName}`
    return c.json({
      success: true,
      asset: {
        title,
        url,
        fileName,
        contentType: file.type || 'application/octet-stream',
      }
    })
  } catch (error) {
    return c.json({ success: false, message: 'Could not upload assignment asset.', error }, 500)
  }
})

async function ensureClassroomSubjectsTable(db: D1Database) {
  if (_initializedTables.has('classroom_subjects')) return
  _initializedTables.add('classroom_subjects')
  await db.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
  try { await db.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
}

const LEARNING_AUTHOR_ROLES = ['teacher', 'classteacher', 'hod', 'hodassistant', 'hos', 'owner', 'ami']
const LEARNING_REVIEWER_ROLES = ['hod', 'hodassistant', 'hos', 'owner', 'ami']
const LEARNING_MANAGER_ROLES = Array.from(new Set([...LEARNING_AUTHOR_ROLES, 'ict', 'ict_manager', 'admin']))

function normalizeLearningVisibility(value: unknown, fallback = 'student') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (normalized === 'student_parent' || normalized === 'parent_student') return 'student_parent'
  if (normalized === 'student' || normalized === 'teacher') return normalized
  return fallback
}

function normalizeLearningReleaseAt(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

function isLearningContentReleased(value: unknown) {
  const normalized = normalizeLearningReleaseAt(value)
  if (!normalized) return true
  return new Date(normalized).getTime() <= Date.now()
}

function canRoleSeeLearningContent(role: string, visibility: string) {
  if (role === 'parent') return visibility === 'student_parent'
  if (role === 'student') return visibility === 'student' || visibility === 'student_parent'
  return true
}

async function listAccessibleLearningStudents(db: D1Database, user: Record<string, any>) {
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(db, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId
  const normalizedRole = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()
  let students: Array<Record<string, any>> = []

  if (normalizedRole === 'student') {
    // Use already-resolved identity — no extra DB calls needed
    const settings = resolvedUser.settings || {}
    const studentId = String(resolvedUser.userRow?.id || resolvedUser.settingsKey || userIdentifier || '')
    students = [{
      id: studentId,
      name: String(settings.name || resolvedUser.userRow?.name || ''),
      email: String(resolvedUser.userRow?.email || settings.email || ''),
      displayId: getPublicFacingUserId(settings, 'student') || String(settings.publicStudentId || ''),
      classId: String(settings.classId || resolvedUser.userRow?.classId || ''),
      className: String(settings.className || ''),
    }]
  } else if (normalizedRole === 'parent' && tenantId) {
    await ensureParentStudentLinksTable(db)
    const parentIdentifiers = Array.from(new Set(collectResolvedIdentityIdentifiers(resolvedUser, user).filter(Boolean)))
    if (parentIdentifiers.length > 0) {
      const parentPlaceholders = parentIdentifiers.map(() => '?').join(', ')
      const linkRows = await db.prepare(
        `SELECT DISTINCT student_id FROM parent_student_links WHERE tenant_id = ? AND parent_id IN (${parentPlaceholders})`
      ).bind(tenantId, ...parentIdentifiers).all()
      const studentIds = ((linkRows.results || []) as Record<string, any>[]).map(row => String(row.student_id || '')).filter(Boolean)
      if (studentIds.length > 0) {
        // Batch: one query for all student rows + one bulk settings query — no per-row DB calls
        const idPlaceholders = studentIds.map(() => '?').join(', ')
        const studentUserRows = await db.prepare(
          `SELECT id, name, email, role, primary_role, tenantId FROM users WHERE tenantId = ? AND (id IN (${idPlaceholders}) OR email IN (${idPlaceholders}))`
        ).bind(tenantId, ...studentIds, ...studentIds).all().catch(() => ({ results: [] }))
        const settingsMap = await getSettingsMapForUserRows(db, (studentUserRows.results || []) as Record<string, any>[])
        students = ((studentUserRows.results || []) as Record<string, any>[]).filter(Boolean).map(row => {
          const emailKey = String(row.email || '').trim().toLowerCase()
          const idKey = String(row.id || '').trim()
          const settings = settingsMap.get(emailKey) || settingsMap.get(idKey) || null
          return {
            id: String(row.id || ''),
            name: String(settings?.name || row.name || ''),
            email: String(row.email || ''),
            displayId: getPublicFacingUserId(settings || {}, 'student') || String(settings?.publicStudentId || ''),
            classId: String(settings?.classId || ''),
            className: String(settings?.className || ''),
          }
        })
      }
    }
  }

  const classIds = Array.from(new Set(students.map(student => String(student?.classId || '').trim()).filter(Boolean)))
  const classMap = new Map<string, string>()
  if (tenantId && classIds.length > 0) {
    await ensureClassesTable(db)
    const placeholders = classIds.map(() => '?').join(', ')
    const classRows = await db.prepare(
      `SELECT id, name, arm FROM classes WHERE tenantId = ? AND id IN (${placeholders})`
    ).bind(tenantId, ...classIds).all()
    for (const row of ((classRows.results || []) as Record<string, any>[])) {
      classMap.set(String(row.id || ''), `${row.name || ''}${row.arm ? ` ${row.arm}` : ''}`.trim())
    }
  }

  return {
    tenantId,
    role: normalizedRole,
    students: students.map(student => ({
      id: String(student?.id || ''),
      name: String(student?.name || ''),
      email: String(student?.email || ''),
      displayId: String(student?.displayId || ''),
      classId: String(student?.classId || ''),
      className: classMap.get(String(student?.classId || '')) || String(student?.className || ''),
    })),
  }
}

async function resolveUserProfileAccess(db: D1Database, currentUser: Record<string, any>, userId: string) {
  const callerIdentifiers = [
    currentUser?.id,
    currentUser?.email,
    currentUser?.sub,
    currentUser?.displayId,
  ].map(value => String(value || '').trim()).filter(Boolean)
  const callerId = callerIdentifiers[0] || ''
  const callerRole = normalizeRole(currentUser?.role)
  const isAdminEdit = hasRequiredRole(callerRole, ['owner', 'hos'])

  if (isAdminEdit) {
    return { allowed: true, isAdminEdit: true, isSelfEdit: callerIdentifiers.includes(userId), linkedStudent: null as Record<string, any> | null }
  }

  if (callerId && callerIdentifiers.includes(userId)) {
    return { allowed: true, isAdminEdit: false, isSelfEdit: true, linkedStudent: null as Record<string, any> | null }
  }

  if (callerRole === 'parent') {
    const audience = await listAccessibleLearningStudents(db, currentUser)
    const linkedStudent = (audience.students || []).find(student => [student.id, student.email, student.displayId].includes(userId)) || null
    if (linkedStudent) {
      return { allowed: true, isAdminEdit: false, isSelfEdit: false, linkedStudent }
    }
  }

  return { allowed: false, isAdminEdit: false, isSelfEdit: false, linkedStudent: null as Record<string, any> | null }
}

async function resolveClassroomLearningAccess(db: D1Database, user: Record<string, any>, classroomId: string, requestedStudentId = '') {
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(db, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId
  const normalizedRole = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()

  await ensureClassesTable(db)
  await ensureClassroomSubjectsTable(db)

  const classRow = tenantId
    ? await db.prepare(
      `SELECT id, tenantId, name, arm, classTeacherId FROM classes WHERE id = ? AND tenantId = ?`
    ).bind(classroomId, tenantId).first() as Record<string, any> | null
    : null

  if (!tenantId || !classRow) {
    return { ok: false, status: 404, message: 'Class not found.' }
  }

  const teacherIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(resolvedUser, user))
  const subjectRows = await db.prepare(
    `SELECT id, name, teacherId FROM subjects WHERE classId = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '')`
  ).bind(classroomId, tenantId).all().catch(() => ({ results: [] }))
  const subjectResults = ((subjectRows.results || []) as Record<string, any>[])
  const isElevatedViewer = LEARNING_MANAGER_ROLES.includes(normalizedRole)
  const isClassTeacher = matchesComparableIdentifier(classRow.classTeacherId, teacherIdentifiers)
    || await classHasMembershipTeacher(db, tenantId, classRow.id, teacherIdentifiers)
  const isAssignedTeacher = subjectResults.some(subject => matchesComparableIdentifier(subject.teacherId, teacherIdentifiers))

  if (isElevatedViewer || isClassTeacher || isAssignedTeacher) {
    return {
      ok: true,
      tenantId,
      role: normalizedRole,
      classRow,
      canManage: true,
      students: [] as Array<Record<string, any>>,
      selectedStudent: null as Record<string, any> | null,
    }
  }

  if (!['student', 'parent'].includes(normalizedRole)) {
    return { ok: false, status: 403, message: 'You are not allowed to view this class.' }
  }

  const audience = await listAccessibleLearningStudents(db, user)
  const classStudents = audience.students.filter(student => String(student.classId || '') === String(classroomId || ''))
  const selectedStudent = classStudents.find(student => [student.id, student.email, student.displayId].includes(requestedStudentId)) || classStudents[0] || null

  if (!selectedStudent) {
    return { ok: false, status: 403, message: 'You are not allowed to view this class.' }
  }

  return {
    ok: true,
    tenantId,
    role: normalizedRole,
    classRow,
    canManage: false,
    students: classStudents,
    selectedStudent,
  }
}

function normalizeMaterialType(value: string, fallback = 'document') {
  const normalized = String(value || '').trim().toLowerCase()
  if (['document', 'video', 'image', 'link'].includes(normalized)) return normalized
  return fallback
}

function inferMaterialType(url: string, contentType = '') {
  const safeUrl = String(url || '').toLowerCase()
  const safeContentType = String(contentType || '').toLowerCase()

  if (safeContentType.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(safeUrl)) return 'video'
  if (safeContentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(safeUrl)) return 'image'
  if (/^https?:\/\//.test(safeUrl) && !/\.(pdf|docx?|pptx?|xlsx?|csv|txt|rtf|zip)(\?|#|$)/.test(safeUrl)) return 'link'
  return 'document'
}

async function resolveMaterialPublishingContext(db: D1Database, user: Record<string, any>, classroomId: string, subjectId: string) {
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(db, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId
  const normalizedRole = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()
  const isSupervisor = isClassroomSupervisorRole(normalizedRole)
  const teacherIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(resolvedUser, user))
  const teacherId = String(resolvedUser.userRow?.id || resolvedUser.userRow?.email || resolvedUser.settingsKey || user.id || '').trim()

  await ensureClassesTable(db)
  await ensureClassroomSubjectsTable(db)

  const classRow = await db.prepare(
    `SELECT id, tenantId, name, arm, classTeacherId FROM classes WHERE id = ?`
  ).bind(classroomId).first() as Record<string, any> | null

  if (!tenantId || !teacherId || !classRow || String(classRow.tenantId || '') !== String(tenantId)) {
    return { ok: false, status: 404, message: 'Class not found.' }
  }

  const subjectRow = await db.prepare(
    `SELECT id, name, teacherId FROM subjects WHERE id = ? AND classId = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '')`
  ).bind(subjectId, classroomId, classRow.tenantId || tenantId || '').first() as Record<string, any> | null

  if (!subjectRow) {
    return { ok: false, status: 404, message: 'Subject not found for this class.' }
  }

  const canPublish = isSupervisor
    || matchesComparableIdentifier(subjectRow.teacherId, teacherIdentifiers)
    || matchesComparableIdentifier(classRow.classTeacherId, teacherIdentifiers)
    || await classHasMembershipTeacher(db, tenantId, classRow.id, teacherIdentifiers)
  if (!canPublish) {
    return { ok: false, status: 403, message: 'You are not assigned to this subject.' }
  }

  return {
    ok: true,
    teacherId,
    subjectRow,
    classRow,
    uploadedByName: String(resolvedUser.settings?.name || resolvedUser.userRow?.name || user.name || teacherId),
  }
}

async function resolveClassroomModerationContext(db: D1Database, user: Record<string, any>, classroomId: string) {
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(db, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId
  const normalizedRole = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()
  const actorIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(resolvedUser, user))
  const actorId = String(resolvedUser.userRow?.id || resolvedUser.userRow?.email || resolvedUser.settingsKey || user.id || '').trim()

  await ensureClassesTable(db)
  const classRow = await db.prepare(
    `SELECT id, tenantId, name, arm, classTeacherId FROM classes WHERE id = ?`
  ).bind(classroomId).first() as Record<string, any> | null

  if (!tenantId || !classRow || String(classRow.tenantId || '') !== String(tenantId)) {
    return { ok: false, status: 404, message: 'Class not found.' }
  }

  const isSupervisor = isClassroomSupervisorRole(normalizedRole)
  const isClassTeacher = matchesComparableIdentifier(classRow.classTeacherId, actorIdentifiers)
    || await classHasMembershipTeacher(db, tenantId, classRow.id, actorIdentifiers)

  return {
    ok: true,
    tenantId: String(tenantId || '').trim(),
    classRow,
    actorId,
    actorIdentifiers,
    normalizedRole,
    isSupervisor,
    isClassTeacher,
    canManageClasswide: isSupervisor || isClassTeacher,
  }
}

app.get('/api/learning/students', authenticate, async (c) => {
  try {
    const audience = await listAccessibleLearningStudents(c.env.APP_DB, c.var.user || {})
    return c.json({ success: true, role: audience.role, students: audience.students })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load learning audience.', error }, 500)
  }
})

app.get('/api/classrooms/:classroomId/materials', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const requestedStudentId = String(c.req.query('studentId') || '').trim()
  try {
    const access = await resolveClassroomLearningAccess(c.env.APP_DB, c.var.user || {}, classroomId, requestedStudentId)
    if (!access.ok) return c.json({ success: false, message: access.message }, access.status)

    let materials = await getMaterialsForClass(c.env.APP_DB, classroomId)
    if (!access.canManage) {
      materials = materials.filter(material => {
        const visibility = normalizeLearningVisibility(material.visibility || material.metadata?.visibility, 'student_parent')
        return isLearningContentReleased(material.releaseAt || material.metadata?.releaseAt)
          && canRoleSeeLearningContent(access.role, visibility)
      })
    }

    return c.json({ success: true, materials, students: access.students || [], activeStudentId: String(access.selectedStudent?.id || '') })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/materials', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const { title, url, subjectId, description, type, topic, week, weekLabel, visibility, releaseAt } = await c.req.json()
  if (!title || !subjectId) {
    return c.json({ success: false, message: 'Title and subject are required.' }, 400)
  }
  try {
    const publishContext = await resolveMaterialPublishingContext(c.env.APP_DB, c.var.user || {}, classroomId, String(subjectId))
    if (!publishContext.ok) {
      return c.json({ success: false, message: publishContext.message }, publishContext.status)
    }

    const newMaterial = {
      classId: classroomId,
      title,
      url: String(url || '').trim() || null,
      uploadedBy: publishContext.uploadedByName,
      metadata: {
        subjectId: String(publishContext.subjectRow.id || ''),
        subjectName: String(publishContext.subjectRow.name || ''),
        description: String(description || '').trim(),
        topic: String(topic || '').trim(),
        weekLabel: String(weekLabel || week || '').trim(),
        visibility: normalizeLearningVisibility(visibility, 'student_parent'),
        releaseAt: normalizeLearningReleaseAt(releaseAt),
        type: normalizeMaterialType(type, inferMaterialType(String(url || ''))),
        uploadedByName: publishContext.uploadedByName,
        uploadedById: publishContext.teacherId,
        className: `${publishContext.classRow.name}${publishContext.classRow.arm ? ` ${publishContext.classRow.arm}` : ''}`,
        source: url ? 'link' : 'note',
      },
    }
    const insertedMaterial = await addMaterial(c.env.APP_DB, newMaterial)
    const materialTopicName = String(topic || '').trim()
    if (materialTopicName) {
      try {
        await ensureClassTopic(c.env.APP_DB, {
          tenantId: publishContext.classRow.tenantId,
          classId: classroomId,
          subjectId: String(publishContext.subjectRow.id || ''),
          name: materialTopicName,
          createdBy: publishContext.teacherId,
        })
      } catch (topicError) {
        console.error('ensureClassTopic (material create) failed:', topicError)
      }
    }
    return c.json({ success: true, material: insertedMaterial }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.put('/api/classrooms/:classroomId/materials/:materialId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const materialId = c.req.param('materialId')
  const payload = await c.req.json()
  const nextTitle = String(payload?.title || '').trim()

  if (!nextTitle) {
    return c.json({ success: false, message: 'Title is required.' }, 400)
  }

  try {
    const context = await resolveClassroomModerationContext(c.env.APP_DB, c.var.user || {}, classroomId)
    if (!context.ok) {
      return c.json({ success: false, message: context.message }, context.status)
    }

    const material = await getMaterialById(c.env.APP_DB, materialId)
    if (!material || String(material.classId || '') !== String(classroomId || '')) {
      return c.json({ success: false, message: 'Material not found.' }, 404)
    }

    const subjectId = String(payload?.subjectId || material.subjectId || '').trim()
    const publishContext = subjectId
      ? await resolveMaterialPublishingContext(c.env.APP_DB, c.var.user || {}, classroomId, subjectId)
      : { ok: false }
    const canManageMaterial = context.canManageClasswide
      || matchesComparableIdentifier(material.uploadedById, context.actorIdentifiers)
      || Boolean((publishContext as any)?.ok)

    if (!canManageMaterial) {
      return c.json({ success: false, message: 'You are not allowed to edit this material.' }, 403)
    }

    const updatedMetadata = {
      ...(material.metadata && typeof material.metadata === 'object' ? material.metadata : {}),
      description: typeof payload?.description === 'string' ? payload.description.trim() : material.description,
      topic: typeof payload?.topic === 'string' ? payload.topic.trim() : material.topic,
      weekLabel: typeof payload?.weekLabel === 'string' ? payload.weekLabel.trim() : material.weekLabel,
      visibility: Object.prototype.hasOwnProperty.call(payload || {}, 'visibility')
        ? normalizeLearningVisibility(payload?.visibility, material.visibility || 'student_parent')
        : material.visibility,
      releaseAt: Object.prototype.hasOwnProperty.call(payload || {}, 'releaseAt')
        ? normalizeLearningReleaseAt(payload?.releaseAt)
        : normalizeLearningReleaseAt(material.releaseAt),
      type: Object.prototype.hasOwnProperty.call(payload || {}, 'type')
        ? normalizeMaterialType(payload?.type, inferMaterialType(String(payload?.url || material.url || '')))
        : normalizeMaterialType(material.type, inferMaterialType(String(material.url || ''))),
    }

    const updatedMaterial = await updateMaterial(c.env.APP_DB, materialId, {
      title: nextTitle,
      url: Object.prototype.hasOwnProperty.call(payload || {}, 'url') ? String(payload?.url || '').trim() || null : material.url,
      metadata: updatedMetadata,
    })

    // A topic typed/renamed on edit should persist like the create paths do.
    const editedTopicName = String(updatedMetadata.topic || '').trim()
    if (editedTopicName && subjectId) {
      try {
        await ensureClassTopic(c.env.APP_DB, {
          tenantId: context.tenantId,
          classId: classroomId,
          subjectId,
          name: editedTopicName,
          createdBy: context.actorId,
        })
      } catch (topicError) {
        console.error('ensureClassTopic (material edit) failed:', topicError)
      }
    }

    return c.json({ success: true, material: updatedMaterial })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.delete('/api/classrooms/:classroomId/materials/:materialId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const materialId = c.req.param('materialId')

  try {
    const context = await resolveClassroomModerationContext(c.env.APP_DB, c.var.user || {}, classroomId)
    if (!context.ok) {
      return c.json({ success: false, message: context.message }, context.status)
    }

    const material = await getMaterialById(c.env.APP_DB, materialId)
    if (!material || String(material.classId || '') !== String(classroomId || '')) {
      return c.json({ success: false, message: 'Material not found.' }, 404)
    }

    const subjectId = String(material.subjectId || '').trim()
    const publishContext = subjectId
      ? await resolveMaterialPublishingContext(c.env.APP_DB, c.var.user || {}, classroomId, subjectId)
      : { ok: false }
    const canManageMaterial = context.canManageClasswide
      || matchesComparableIdentifier(material.uploadedById, context.actorIdentifiers)
      || Boolean((publishContext as any)?.ok)

    if (!canManageMaterial) {
      return c.json({ success: false, message: 'You are not allowed to delete this material.' }, 403)
    }

    await deleteMaterial(c.env.APP_DB, materialId)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

// File upload to R2
app.post('/api/classrooms/:classroomId/materials/upload-multipart', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const title = formData.get('title') as string
  const subjectId = String(formData.get('subjectId') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const requestedType = String(formData.get('type') || '').trim()
  const topic = String(formData.get('topic') || '').trim()
  const weekLabel = String(formData.get('weekLabel') || formData.get('week') || '').trim()
  const visibility = normalizeLearningVisibility(formData.get('visibility'), 'student_parent')
  const releaseAt = normalizeLearningReleaseAt(formData.get('releaseAt'))
  if (!title || !file || !subjectId) {
    return c.json({ success: false, message: 'Title, file, and subject are required.' }, 400)
  }
  try {
    const publishContext = await resolveMaterialPublishingContext(c.env.APP_DB, c.var.user || {}, classroomId, subjectId)
    if (!publishContext.ok) {
      return c.json({ success: false, message: publishContext.message }, publishContext.status)
    }

    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await c.env.UPLOADS.put(fileName, file.stream(), {
      httpMetadata: { contentType: file.type }
    })
    const url = `https://ndovera.com/files/${fileName}` // Assuming custom domain
    const newMaterial = {
      classId: classroomId,
      title,
      url,
      uploadedBy: publishContext.uploadedByName,
      metadata: {
        subjectId: String(publishContext.subjectRow.id || ''),
        subjectName: String(publishContext.subjectRow.name || ''),
        description,
        topic,
        weekLabel,
        visibility,
        releaseAt,
        type: normalizeMaterialType(requestedType, inferMaterialType(file.name, file.type)),
        uploadedByName: publishContext.uploadedByName,
        uploadedById: publishContext.teacherId,
        className: `${publishContext.classRow.name}${publishContext.classRow.arm ? ` ${publishContext.classRow.arm}` : ''}`,
        source: 'upload',
        contentType: file.type || 'application/octet-stream',
      },
    }
    const insertedMaterial = await addMaterial(c.env.APP_DB, newMaterial)
    const materialTopicName = String(topic || '').trim()
    if (materialTopicName) {
      try {
        await ensureClassTopic(c.env.APP_DB, {
          tenantId: publishContext.classRow.tenantId,
          classId: classroomId,
          subjectId: String(publishContext.subjectRow.id || ''),
          name: materialTopicName,
          createdBy: publishContext.teacherId,
        })
      } catch (topicError) {
        console.error('ensureClassTopic (material upload) failed:', topicError)
      }
    }
    return c.json({ success: true, material: insertedMaterial }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.get('/api/lesson-plans', authenticate, async (c) => {
  const classId = String(c.req.query('classId') || '').trim()
  const requestedStudentId = String(c.req.query('studentId') || '').trim()
  const currentUser = c.var.user || {}
  const userIdentifier = currentUser.id || currentUser.email || currentUser.sub || ''
  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || currentUser.tenantId
  const normalizedRole = getActiveRole(currentUser)
  if (!tenantId) return c.json({ success: false, message: 'No tenant.' }, 400)

  try {
    let students: Array<Record<string, any>> = []
    let activeStudentId = ''
    let lessonPlans = await listLessonPlans(c.env.APP_DB, tenantId, classId ? { classId } : {})

    if (classId) {
      const access = await resolveClassroomLearningAccess(c.env.APP_DB, currentUser, classId, requestedStudentId)
      if (!access.ok) return c.json({ success: false, message: access.message }, access.status)

      students = access.students || []
      activeStudentId = String(access.selectedStudent?.id || '')
      if (!access.canManage) {
        lessonPlans = lessonPlans.filter(lessonPlan => (
          String(lessonPlan.status || '') === 'approved'
            && isLearningContentReleased(lessonPlan.releaseAt)
            && canRoleSeeLearningContent(access.role, normalizeLearningVisibility(lessonPlan.visibility))
        ))
      }
    } else if (!LEARNING_REVIEWER_ROLES.includes(normalizedRole)) {
      return c.json({ success: false, message: 'classId is required.' }, 400)
    }

    return c.json({
      success: true,
      lessonPlans,
      students,
      activeStudentId,
      permissions: {
        canCreate: LEARNING_AUTHOR_ROLES.includes(normalizedRole),
        canReview: LEARNING_REVIEWER_ROLES.includes(normalizedRole),
      },
    })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load lesson plans.', error }, 500)
  }
})

app.post('/api/lesson-plans', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, LEARNING_AUTHOR_ROLES)) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const classId = String(body.classId || '').trim()
  const subjectId = String(body.subjectId || '').trim()
  const title = String(body.title || '').trim()
  if (!classId || !subjectId || !title) {
    return c.json({ success: false, message: 'Class, subject, and title are required.' }, 400)
  }

  try {
    const publishContext = await resolveMaterialPublishingContext(c.env.APP_DB, c.var.user || {}, classId, subjectId)
    if (!publishContext.ok) return c.json({ success: false, message: publishContext.message }, publishContext.status)

    const currentUser = c.var.user || {}
    const userIdentifier = currentUser.id || currentUser.email || currentUser.sub || ''
    const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || currentUser.tenantId || publishContext.classRow.tenantId
    const actorId = String(resolvedUser.userRow?.id || publishContext.teacherId || userIdentifier || '').trim()
    const actorName = String(resolvedUser.settings?.name || resolvedUser.userRow?.name || publishContext.uploadedByName || actorId).trim()
    const normalizedStatus = ['draft', 'submitted'].includes(String(body.status || '').trim().toLowerCase())
      ? String(body.status || '').trim().toLowerCase()
      : 'draft'

    const lessonPlan = await upsertLessonPlan(c.env.APP_DB, {
      id: String(body.id || '').trim() || undefined,
      tenantId,
      classId,
      className: `${publishContext.classRow.name}${publishContext.classRow.arm ? ` ${publishContext.classRow.arm}` : ''}`,
      subjectId,
      subjectName: String(publishContext.subjectRow.name || ''),
      teacherId: actorId,
      teacherName: actorName,
      title,
      topic: String(body.topic || '').trim(),
      weekLabel: String(body.weekLabel || body.week || '').trim(),
      visibility: normalizeLearningVisibility(body.visibility, 'student'),
      status: normalizedStatus,
      releaseAt: normalizeLearningReleaseAt(body.releaseAt),
      liveSessionId: String(body.liveSessionId || '').trim(),
      liveSessionLabel: String(body.liveSessionLabel || '').trim(),
      objectives: String(body.objectives || '').trim(),
      activities: String(body.activities || '').trim(),
      assessment: String(body.assessment || '').trim(),
      notes: String(body.notes || '').trim(),
      resources: Array.isArray(body.resources) ? body.resources : [],
      actorId,
      changeNote: String(body.changeNote || '').trim(),
    })

    return c.json({ success: true, lessonPlan }, body.id ? 200 : 201)
  } catch (error) {
    return c.json({ success: false, message: 'Could not save lesson plan.', error }, 500)
  }
})

app.post('/api/lesson-plans/:lessonPlanId/review', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, LEARNING_REVIEWER_ROLES)) return c.json({ error: 'forbidden' }, 403)

  const lessonPlanId = String(c.req.param('lessonPlanId') || '').trim()
  const body = await c.req.json().catch(() => ({}))
  const nextStatus = String(body.status || '').trim().toLowerCase()
  if (!lessonPlanId || !['approved', 'returned'].includes(nextStatus)) {
    return c.json({ success: false, message: 'A valid lesson plan and review status are required.' }, 400)
  }

  const currentUser = c.var.user || {}
  const userIdentifier = currentUser.id || currentUser.email || currentUser.sub || ''
  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || currentUser.tenantId
  if (!tenantId) return c.json({ success: false, message: 'No tenant.' }, 400)

  try {
    await ensureLessonPlanTables(c.env.APP_DB)
    const existing = await getLessonPlanById(c.env.APP_DB, tenantId, lessonPlanId)
    if (!existing) return c.json({ success: false, message: 'Lesson plan not found.' }, 404)

    const reviewerId = String(resolvedUser.userRow?.id || resolvedUser.userRow?.email || resolvedUser.settingsKey || userIdentifier || '').trim()
    const reviewerName = String(resolvedUser.settings?.name || resolvedUser.userRow?.name || currentUser.name || reviewerId).trim()
    const lessonPlan = await reviewLessonPlan(c.env.APP_DB, {
      tenantId,
      id: lessonPlanId,
      status: nextStatus,
      reviewComment: String(body.reviewComment || '').trim(),
      reviewedBy: reviewerId,
      reviewedByName: reviewerName,
    })

    return c.json({ success: true, lessonPlan })
  } catch (error) {
    return c.json({ success: false, message: 'Could not review lesson plan.', error }, 500)
  }
})

async function ensureSchoolStudentAttendanceTable(db: D1Database) {
  if (_initializedTables.has('school_student_attendance')) return
  _initializedTables.add('school_student_attendance')
  await db.prepare(`CREATE TABLE IF NOT EXISTS student_attendance_school (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    student_id TEXT,
    class_id TEXT,
    date TEXT,
    status TEXT,
    notes TEXT,
    recorded_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run()
  try { await db.exec('ALTER TABLE student_attendance_school ADD COLUMN notes TEXT') } catch {}
  try { await db.exec('ALTER TABLE student_attendance_school ADD COLUMN updated_at TEXT') } catch {}
}

async function resolveSchoolAttendanceActor(db: D1Database, user: Record<string, any>) {
  const userIdentifier = String(user?.id || user?.email || user?.sub || '').trim()
  const resolvedUser = await resolveSettingsIdentity(db, userIdentifier)
  const actorId = String(resolvedUser.userRow?.id || user?.id || userIdentifier || '').trim()
  const actorName = String(user?.name || resolvedUser.userRow?.name || resolvedUser.settings?.name || actorId || '').trim()
  const tenantId = String(
    resolvedUser.settings?.tenantId ||
    resolvedUser.settings?.schoolId ||
    resolvedUser.userRow?.tenantId ||
    user?.tenantId ||
    ''
  ).trim()
  const role = String(user?.role || resolvedUser.settings?.role || resolvedUser.userRow?.role || '').toLowerCase().trim()

  return { resolvedUser, actorId, actorName, tenantId, role }
}

async function getSchoolClassroomContext(db: D1Database, tenantId: string, classroomId: string, actorId?: string, actorRole?: string) {
  await ensureClassesTable(db)
  const classRow = await db.prepare(
    `SELECT id, tenantId, name, arm, classTeacherId FROM classes WHERE id = ? AND tenantId = ?`
  ).bind(classroomId, tenantId).first() as Record<string, any> | null

  if (!classRow) {
    return { classRow: null, isClassTeacher: false, canView: false, canManage: false }
  }

  const normalizedActorId = String(actorId || '').trim()
  const normalizedRole = String(actorRole || '').toLowerCase().trim()
  const isElevatedViewer = ['owner', 'hos', 'admin'].includes(normalizedRole)
  const resolvedActor = normalizedActorId ? await resolveSettingsIdentity(db, normalizedActorId).catch(() => null) : null
  const actorIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(
    resolvedActor || { settingsKey: normalizedActorId, settings: null, userRow: null },
    { id: normalizedActorId },
  ))
  const isClassTeacher = matchesComparableIdentifier(classRow.classTeacherId, actorIdentifiers)
    || await classHasMembershipTeacher(db, tenantId, classRow.id, actorIdentifiers)

  return {
    classRow,
    isClassTeacher,
    canView: isElevatedViewer || isClassTeacher,
    canManage: isElevatedViewer || isClassTeacher,
  }
}

async function resolveStudentAttendanceTarget(db: D1Database, tenantId: string, studentIdentifier: string) {
  const resolvedStudent = await resolveSettingsIdentity(db, studentIdentifier)
  const studentId = String(resolvedStudent.userRow?.id || studentIdentifier || '').trim()
  const studentRole = String(resolvedStudent.userRow?.role || resolvedStudent.settings?.role || '').toLowerCase().trim()
  const studentTenantId = String(
    resolvedStudent.settings?.tenantId ||
    resolvedStudent.settings?.schoolId ||
    resolvedStudent.userRow?.tenantId ||
    ''
  ).trim()
  const classId = String(resolvedStudent.settings?.classId || '').trim()

  if (!studentId || studentRole !== 'student' || studentTenantId !== tenantId) {
    return null
  }

  return {
    studentId,
    classId,
    studentName: String(resolvedStudent.userRow?.name || resolvedStudent.settings?.name || studentId),
  }
}

async function listStudentsForClass(db: D1Database, tenantId: string, classroomId: string) {
  await ensureUsersTable(db)
  const rows = await db.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.createdAt, s.payload
     FROM users u
     LEFT JOIN settings s ON (s.studentId = u.email OR s.studentId = u.id)
     WHERE u.tenantId = ?
       AND lower(u.role) = 'student'
       AND (u.status IS NULL OR u.status != 'inactive')
       AND json_extract(s.payload, '$.classId') = ?
     ORDER BY u.name, u.email`
  ).bind(tenantId, classroomId).all().catch(() => ({ results: [] }))

  return ((rows.results || []) as Record<string, any>[]).map(row => {
    const settings = parseHeaderJsonObject(row.payload)
    const profile = buildAdmissionProfileRecord(settings || {}, row)
    return {
      id: String(row.id || ''),
      name: String(row.name || profile.name || ''),
      email: String(row.email || settings.email || ''),
      displayId: settings.displayId || null,
      classId: String(settings.classId || classroomId),
      className: String(settings.className || ''),
      role: 'Student',
      status: String(row.status || 'active').toLowerCase() === 'active' ? 'Active' : String(row.status || ''),
      phone: profile.phone || null,
    }
  })
}

async function listSchoolStudentAttendance(
  db: D1Database,
  filters: { tenantId: string, classId?: string, studentId?: string, date?: string, from?: string, to?: string, limit?: number }
) {
  await ensureSchoolStudentAttendanceTable(db)

  let query = 'SELECT * FROM student_attendance_school WHERE tenant_id = ?'
  const params: Array<string | number> = [filters.tenantId]

  if (filters.classId) {
    query += ' AND class_id = ?'
    params.push(filters.classId)
  }

  if (filters.studentId) {
    query += ' AND student_id = ?'
    params.push(filters.studentId)
  }

  if (filters.date) {
    query += ' AND date = ?'
    params.push(filters.date)
  } else {
    if (filters.from) {
      query += ' AND date >= ?'
      params.push(filters.from)
    }
    if (filters.to) {
      query += ' AND date <= ?'
      params.push(filters.to)
    }
  }

  query += ' ORDER BY date DESC'

  if (typeof filters.limit === 'number' && Number.isFinite(filters.limit) && filters.limit > 0) {
    query += ' LIMIT ?'
    params.push(Math.trunc(filters.limit))
  }

  const rows = await db.prepare(query).bind(...params).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || filters.tenantId || ''),
    studentId: String(row.student_id || ''),
    classId: String(row.class_id || ''),
    date: String(row.date || ''),
    status: String(row.status || ''),
    notes: String(row.notes || ''),
    recordedBy: String(row.recorded_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
  }))
}

async function upsertSchoolStudentAttendance(db: D1Database, record: {
  tenantId: string
  studentId: string
  classId: string
  date: string
  status: string
  notes?: string
  recordedBy: string
}) {
  await ensureSchoolStudentAttendanceTable(db)

  const id = `stua_${record.tenantId}_${record.studentId}_${record.date}`
  const timestamp = new Date().toISOString()

  await db.prepare(
    `INSERT OR REPLACE INTO student_attendance_school (
      id, tenant_id, student_id, class_id, date, status, notes, recorded_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    record.tenantId,
    record.studentId,
    record.classId,
    record.date,
    record.status,
    record.notes || null,
    record.recordedBy,
    timestamp,
    timestamp,
  ).run()

  return {
    id,
    tenantId: record.tenantId,
    studentId: record.studentId,
    classId: record.classId,
    date: record.date,
    status: record.status,
    notes: record.notes || '',
    recordedBy: record.recordedBy,
    updatedAt: timestamp,
  }
}

app.get('/api/classrooms/:classroomId/attendance', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!actor.tenantId) {
      return c.json({ success: false, message: 'No tenant.' }, 400)
    }

    const classroom = await getSchoolClassroomContext(c.env.APP_DB, actor.tenantId, classroomId, actor.actorId, actor.role)
    if (!classroom.classRow) {
      return c.json({ success: false, message: 'Class not found.' }, 404)
    }

    if (!classroom.canView) {
      return c.json({ success: false, message: 'Only the class teacher can view attendance for this class.' }, 403)
    }

    const attendance = await listSchoolStudentAttendance(c.env.APP_DB, {
      tenantId: actor.tenantId,
      classId: classroomId,
      date: c.req.query('date') || undefined,
      from: c.req.query('since') || undefined,
    })
    return c.json({ success: true, attendance })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.get('/api/classrooms/:classroomId/students', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')

  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!actor.tenantId) {
      return c.json({ success: false, message: 'No tenant.' }, 400)
    }

    const classroom = await getSchoolClassroomContext(c.env.APP_DB, actor.tenantId, classroomId, actor.actorId, actor.role)
    if (!classroom.classRow) {
      return c.json({ success: false, message: 'Class not found.' }, 404)
    }

    if (!classroom.canView) {
      return c.json({ success: false, message: 'Only the class teacher can load this class roster.' }, 403)
    }

    const className = `${classroom.classRow.name}${classroom.classRow.arm ? ` ${classroom.classRow.arm}` : ''}`
    const students = (await listStudentsForClass(c.env.APP_DB, actor.tenantId, classroomId))
      .map(student => ({
        ...student,
        className,
      }))

    return c.json({ success: true, students })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.get('/api/classrooms/:classroomId/members', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')

  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!actor.tenantId) {
      return c.json({ success: false, message: 'No tenant.' }, 400)
    }

    const classRow = await c.env.APP_DB.prepare(
      `SELECT id, tenantId, name, arm, classTeacherId FROM classes WHERE id = ? AND tenantId = ?`
    ).bind(classroomId, actor.tenantId).first() as Record<string, any> | null

    if (!classRow) {
      return c.json({ success: false, message: 'Class not found.' }, 404)
    }

    const normalizedRole = String(actor.role || '').toLowerCase().trim()
    let canViewMembers = ['owner', 'hos', 'admin'].includes(normalizedRole)

    if (!canViewMembers && normalizedRole === 'student') {
      const self = await resolveStudentAttendanceTarget(c.env.APP_DB, actor.tenantId, actor.actorId || actor.resolvedUser.settingsKey || '')
      canViewMembers = Boolean(self && String(self.classId || '') === classroomId)
    }

    if (!canViewMembers && ['teacher', 'classteacher'].includes(normalizedRole)) {
      const teacherIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(
        actor.resolvedUser,
        { id: actor.actorId, email: actor.resolvedUser?.settings?.email, sub: actor.actorId },
      ))

      const subjectRows = await c.env.APP_DB.prepare(
        `SELECT teacherId FROM subjects WHERE tenantId = ? AND classId = ?`
      ).bind(actor.tenantId, classroomId).all().catch(() => ({ results: [] }))

      const classTeacherMatch = matchesComparableIdentifier(classRow.classTeacherId, teacherIdentifiers)
      const subjectTeacherMatch = ((subjectRows.results || []) as Record<string, any>[])
        .some(subjectRow => matchesComparableIdentifier(subjectRow.teacherId, teacherIdentifiers))

      canViewMembers = classTeacherMatch || subjectTeacherMatch
    }

    if (!canViewMembers) {
      return c.json({ success: false, message: 'You are not allowed to view this class member list.' }, 403)
    }

    const className = `${classRow.name}${classRow.arm ? ` ${classRow.arm}` : ''}`
    const students = await listStudentsForClass(c.env.APP_DB, actor.tenantId, classroomId)

    const [subjectTeacherRows, classMembershipRows] = await Promise.all([
      c.env.APP_DB.prepare(
        `SELECT teacherId FROM subjects WHERE tenantId = ? AND classId = ? AND teacherId IS NOT NULL AND trim(teacherId) != ''`
      ).bind(actor.tenantId, classroomId).all().catch(() => ({ results: [] })),
      listClassMembershipIdentifiers(c.env.APP_DB, actor.tenantId, classroomId).catch(() => []),
    ])

    const teacherIdentifiers = Array.from(new Set([
      String(classRow.classTeacherId || '').trim(),
      ...((subjectTeacherRows.results || []) as Record<string, any>[]).map(row => String(row.teacherId || '').trim()),
      ...classMembershipRows
        .filter(row => String(row.membership_role || '') === 'teacher')
        .map(row => String(row.user_id || '').trim()),
    ].filter(Boolean)))
    const caregiverIdentifiers = Array.from(new Set(
      classMembershipRows
        .filter(row => String(row.membership_role || '') === 'caregiver')
        .map(row => String(row.user_id || '').trim())
        .filter(Boolean),
    ))

    const teacherRows = (await Promise.all(teacherIdentifiers.map(identifier => findUserByIdentifier(c.env.APP_DB, identifier).catch(() => null))))
      .filter(Boolean) as Record<string, any>[]
    const hydratedTeachers = await hydrateUserRecords(c.env.APP_DB, teacherRows)
    const teachers = hydratedTeachers.map(teacher => ({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      displayId: teacher.displayId || null,
      classId: classroomId,
      className,
      role: 'Teacher',
      status: String(teacher.status || 'active').toLowerCase() === 'active' ? 'Active' : String(teacher.status || ''),
      isClassTeacher: matchesComparableIdentifier(classRow.classTeacherId, collectComparableIdentifiers([
        teacher.id,
        teacher.email,
        teacher.displayId,
      ])),
    }))

    const caregiverRows = (await Promise.all(caregiverIdentifiers.map(identifier => findUserByIdentifier(c.env.APP_DB, identifier).catch(() => null))))
      .filter(Boolean) as Record<string, any>[]
    const hydratedCaregivers = await hydrateUserRecords(c.env.APP_DB, caregiverRows)
    const caregivers = hydratedCaregivers.map(caregiver => ({
      id: caregiver.id,
      name: caregiver.name,
      email: caregiver.email,
      displayId: caregiver.displayId || null,
      classId: classroomId,
      className,
      role: 'Caregiver',
      status: String(caregiver.status || 'active').toLowerCase() === 'active' ? 'Active' : String(caregiver.status || ''),
    }))

    return c.json({ success: true, members: [...teachers, ...caregivers, ...students] })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/members', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')

  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!actor.tenantId) return c.json({ success: false, message: 'No tenant.' }, 400)

    const classroom = await getSchoolClassroomContext(c.env.APP_DB, actor.tenantId, classroomId, actor.actorId, actor.role)
    if (!classroom.classRow) return c.json({ success: false, message: 'Class not found.' }, 404)
    if (!classroom.canManage) {
      return c.json({ success: false, message: 'Only the class teacher, HoS, or owner can manage this class roster.' }, 403)
    }

    const body = await c.req.json().catch(() => ({})) as Record<string, any>
    const memberRole = String(body.memberRole || '').trim().toLowerCase()
    const rawUserId = String(body.userId || '').trim()
    if (!rawUserId || !['teacher', 'student', 'caregiver'].includes(memberRole)) {
      return c.json({ success: false, message: 'userId and a valid memberRole are required.' }, 400)
    }

    const userId = memberRole === 'teacher'
      ? await resolveAssignableStaffIdentifier(c.env.APP_DB, actor.tenantId, rawUserId, {
        requireTeachingCapability: true,
        label: 'Assigned teacher',
      })
      : await resolveCanonicalUserIdentifier(c.env.APP_DB, rawUserId)
    if (!userId) return c.json({ success: false, message: 'User not found.' }, 404)

    if (memberRole === 'student') {
      const resolved = await resolveSettingsIdentity(c.env.APP_DB, userId)
      const settingsKey = resolved.settingsKey || resolved.userRow?.email || userId
      const baseSettings = resolved.settings || {
        email: resolved.userRow?.email || settingsKey,
        name: resolved.userRow?.name || '',
        role: 'student',
        tenantId: actor.tenantId,
        schoolId: actor.tenantId,
        status: 'active',
      }
      await upsertSettings(c.env.APP_DB, settingsKey, {
        ...baseSettings,
        classId: classroomId,
        className: classroom.classRow.name,
        classArm: classroom.classRow.arm || '',
      })
    } else {
      const existingMembershipRows = await listClassMembershipIdentifiers(c.env.APP_DB, actor.tenantId, classroomId, memberRole as 'teacher' | 'caregiver')
      const nextUserIds = Array.from(new Set([
        ...existingMembershipRows.map(row => String(row.user_id || '').trim()).filter(Boolean),
        userId,
      ]))
      await replaceClassMemberships(c.env.APP_DB, actor.tenantId, classroomId, memberRole as 'teacher' | 'caregiver', nextUserIds)
    }

    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Could not add class member.' }, 500)
  }
})

app.delete('/api/classrooms/:classroomId/members/:memberRole/:userId', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const rawUserId = c.req.param('userId')
  const memberRole = String(c.req.param('memberRole') || '').trim().toLowerCase()

  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!actor.tenantId) return c.json({ success: false, message: 'No tenant.' }, 400)

    const classroom = await getSchoolClassroomContext(c.env.APP_DB, actor.tenantId, classroomId, actor.actorId, actor.role)
    if (!classroom.classRow) return c.json({ success: false, message: 'Class not found.' }, 404)
    if (!classroom.canManage) {
      return c.json({ success: false, message: 'Only the class teacher, HoS, or owner can manage this class roster.' }, 403)
    }

    const userId = await resolveCanonicalUserIdentifier(c.env.APP_DB, rawUserId)
    if (!userId) return c.json({ success: false, message: 'User not found.' }, 404)

    if (memberRole === 'student') {
      const resolved = await resolveSettingsIdentity(c.env.APP_DB, userId)
      const settingsKey = resolved.settingsKey || resolved.userRow?.email || userId
      if (resolved.settings && String(resolved.settings.classId || '') === classroomId) {
        const nextSettings = { ...resolved.settings }
        delete nextSettings.classId
        delete nextSettings.className
        delete nextSettings.classArm
        await upsertSettings(c.env.APP_DB, settingsKey, nextSettings)
      }
    } else if (memberRole === 'teacher' || memberRole === 'caregiver') {
      const existingMembershipRows = await listClassMembershipIdentifiers(c.env.APP_DB, actor.tenantId, classroomId, memberRole as 'teacher' | 'caregiver')
      const nextUserIds = existingMembershipRows
        .map(row => String(row.user_id || '').trim())
        .filter(value => value && value !== userId)
      await replaceClassMemberships(c.env.APP_DB, actor.tenantId, classroomId, memberRole as 'teacher' | 'caregiver', nextUserIds)
      if (memberRole === 'teacher' && String(classroom.classRow.classTeacherId || '').trim() === userId) {
        await c.env.APP_DB.prepare(
          `UPDATE classes SET classTeacherId = NULL WHERE id = ? AND tenantId = ?`
        ).bind(classroomId, actor.tenantId).run()
        await syncTeacherClassAssignment(c.env.APP_DB, actor.tenantId, { ...classroom.classRow, classTeacherId: null }, classroom.classRow.classTeacherId)
      }
    } else {
      return c.json({ success: false, message: 'Unsupported member role.' }, 400)
    }

    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Could not remove class member.' }, 500)
  }
})

app.post('/api/classrooms/:classroomId/attendance', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const { studentId, date, status, notes } = await c.req.json()
  if (!studentId || !date || !status) {
    return c.json({ success: false, message: 'studentId, date, and status are required' }, 400)
  }

  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!actor.tenantId) {
      return c.json({ success: false, message: 'No tenant.' }, 400)
    }

    const classroom = await getSchoolClassroomContext(c.env.APP_DB, actor.tenantId, classroomId, actor.actorId, actor.role)
    if (!classroom.classRow) {
      return c.json({ success: false, message: 'Class not found.' }, 404)
    }

    if (!classroom.canManage) {
      return c.json({ success: false, message: 'Only the class teacher can mark attendance for this class.' }, 403)
    }

    const targetStudent = await resolveStudentAttendanceTarget(c.env.APP_DB, actor.tenantId, String(studentId))
    if (!targetStudent) {
      return c.json({ success: false, message: 'Student not found for this tenant.' }, 404)
    }

    if (targetStudent.classId !== classroomId) {
      return c.json({ success: false, message: 'Student does not belong to this class.' }, 400)
    }

    const insertedRecord = await upsertSchoolStudentAttendance(c.env.APP_DB, {
      tenantId: actor.tenantId,
      studentId: targetStudent.studentId,
      classId: classroomId,
      date: String(date),
      status: String(status),
      notes: typeof notes === 'string' ? notes.trim() : '',
      recordedBy: actor.actorName || actor.actorId,
    })
    return c.json({ success: true, attendance: insertedRecord }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

function canAuthorCbt(role: string) {
  return LEARNING_AUTHOR_ROLES.includes(String(role || '').trim().toLowerCase())
}

function canManageCbt(role: string) {
  return LEARNING_MANAGER_ROLES.includes(String(role || '').trim().toLowerCase())
}

function canViewCbtExam(actor: Record<string, any>, user: Record<string, any>, exam: Record<string, any>) {
  if (canManageCbt(actor.role)) return true
  if (canAuthorCbt(actor.role)) {
    const actorIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(actor.resolvedUser, user))
    if (matchesComparableIdentifier(exam.teacherId, actorIdentifiers)) return true
  }
  return String(exam.status || '').trim().toLowerCase() === 'published'
}

app.get('/api/exams', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    const tenantId = String(actor.tenantId || '').trim()
    if (!tenantId) return c.json({ success: false, message: 'School context not found.' }, 400)

    const mode = String(c.req.query('mode') || 'cbt').trim().toLowerCase()
    const subjectId = String(c.req.query('subjectId') || '').trim()
    const classId = String(c.req.query('classId') || '').trim()
    const exams = await listCbtExams(c.env.APP_DB, tenantId, {
      mode,
      subjectId,
      classId,
    })

    const visible = exams.filter(exam => canViewCbtExam(actor, c.var.user || {}, exam))
    return c.json({
      success: true,
      exams: visible.map(exam => ({
        id: exam.id,
        title: exam.title,
        window: exam.window,
        status: exam.status,
        mode: exam.mode,
        questionCount: Array.isArray(exam.questions) ? exam.questions.length : undefined,
        subjectId: exam.subjectId,
        subjectName: exam.subjectName,
        classId: exam.classId,
        className: exam.className,
        updatedAt: exam.updatedAt,
      })),
    })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.get('/api/exams/:id', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    const tenantId = String(actor.tenantId || '').trim()
    if (!tenantId) return c.json({ success: false, message: 'School context not found.' }, 400)

    const exam = await getCbtExamById(c.env.APP_DB, tenantId, c.req.param('id'), { includeQuestions: true })
    if (!exam) return c.json({ success: false, message: 'Exam not found' }, 404)
    if (!canViewCbtExam(actor, c.var.user || {}, exam)) {
      return c.json({ success: false, message: 'You are not allowed to view this exam.' }, 403)
    }

    return c.json({ success: true, exam })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/exams', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    const tenantId = String(actor.tenantId || '').trim()
    if (!tenantId) return c.json({ success: false, message: 'School context not found.' }, 400)
    if (!canAuthorCbt(actor.role)) return c.json({ success: false, message: 'Forbidden' }, 403)

    const payload = await c.req.json() as Record<string, any>
    if (!payload.title || !Array.isArray(payload.questions)) {
      return c.json({ success: false, message: 'Title and questions are required.' }, 400)
    }

    const exam = await saveCbtExam(c.env.APP_DB, {
      ...payload,
      tenantId,
      teacherId: actor.actorId,
      teacherName: actor.actorName,
      status: String(payload.status || 'published').trim().toLowerCase(),
      mode: String(payload.mode || 'cbt').trim().toLowerCase(),
    })
    return c.json({ success: true, exam }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.put('/api/exams/:id', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    const tenantId = String(actor.tenantId || '').trim()
    if (!tenantId) return c.json({ success: false, message: 'School context not found.' }, 400)

    const existingExam = await getCbtExamById(c.env.APP_DB, tenantId, c.req.param('id'), { includeQuestions: true })
    if (!existingExam) return c.json({ success: false, message: 'Exam not found' }, 404)
    if (!canViewCbtExam(actor, c.var.user || {}, existingExam) || !canAuthorCbt(actor.role)) {
      return c.json({ success: false, message: 'You are not allowed to update this exam.' }, 403)
    }

    const payload = await c.req.json() as Record<string, any>
    const exam = await saveCbtExam(c.env.APP_DB, {
      ...existingExam,
      ...payload,
      id: existingExam.id,
      tenantId,
      teacherId: existingExam.teacherId || actor.actorId,
      teacherName: existingExam.teacherName || actor.actorName,
      questions: Array.isArray(payload.questions) ? payload.questions : existingExam.questions,
      status: String(payload.status || existingExam.status || 'published').trim().toLowerCase(),
      mode: String(payload.mode || existingExam.mode || 'cbt').trim().toLowerCase(),
    })
    return c.json({ success: true, exam })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.delete('/api/exams/:id', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    const tenantId = String(actor.tenantId || '').trim()
    if (!tenantId) return c.json({ success: false, message: 'School context not found.' }, 400)

    const existingExam = await getCbtExamById(c.env.APP_DB, tenantId, c.req.param('id'))
    if (!existingExam) return c.json({ success: false, message: 'Exam not found' }, 404)
    if (!canViewCbtExam(actor, c.var.user || {}, existingExam) || !canAuthorCbt(actor.role)) {
      return c.json({ success: false, message: 'You are not allowed to delete this exam.' }, 403)
    }

    await deleteCbtExam(c.env.APP_DB, tenantId, existingExam.id)
    return c.json({ success: true, deletedId: existingExam.id })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/exams/:id/start', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    const tenantId = String(actor.tenantId || '').trim()
    if (!tenantId) return c.json({ success: false, message: 'School context not found.' }, 400)

    const exam = await getCbtExamById(c.env.APP_DB, tenantId, c.req.param('id'))
    if (!exam) return c.json({ success: false, message: 'Exam not found' }, 404)
    if (!canViewCbtExam(actor, c.var.user || {}, exam)) {
      return c.json({ success: false, message: 'You are not allowed to start this exam.' }, 403)
    }

    const session = await startCbtExam(c.env.APP_DB, tenantId, exam.id)
    return c.json({ success: true, ...(session || {}) })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/exams/:id/submit', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    const tenantId = String(actor.tenantId || '').trim()
    if (!tenantId) return c.json({ success: false, message: 'School context not found.' }, 400)

    const payload = await c.req.json() as Record<string, any>
    const exam = await getCbtExamById(c.env.APP_DB, tenantId, c.req.param('id'))
    if (!exam) return c.json({ success: false, message: 'Exam not found' }, 404)
    if (!canViewCbtExam(actor, c.var.user || {}, exam)) {
      return c.json({ success: false, message: 'You are not allowed to submit this exam.' }, 403)
    }

    const result = await submitCbtExamAttempt(c.env.APP_DB, {
      tenantId,
      examId: exam.id,
      studentId: String(payload.userId || actor.actorId || '').trim(),
      answers: payload.answers && typeof payload.answers === 'object' ? payload.answers : {},
    })
    return c.json({ success: true, result })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.get('/api/practice/questions', authenticate, async (c) => {
  try {
    const sanitizePracticeQuestion = (question: Record<string, any>) => {
      const metadata = question?.metadata && typeof question.metadata === 'object' ? question.metadata : {}
      return {
        id: question.id,
        subject: question.subject,
        subjectId: question.subjectId,
        subjectName: question.subjectName,
        topic: question.topic,
        type: question.type,
        prompt: question.prompt,
        text: question.text || question.prompt,
        options: Array.isArray(question.options) ? question.options : [],
        choices: Array.isArray(question.choices) ? question.choices : (Array.isArray(question.options) ? question.options : []),
        answer: question.answer,
        acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : undefined,
        explanation: question.explanation,
        imageUrl: question.imageUrl,
        passage: question.passage || metadata?.passage || '',
        pairs: Array.isArray(question.pairs) ? question.pairs : [],
        left: Array.isArray(question.left) ? question.left : (Array.isArray(metadata?.left) ? metadata.left : []),
        right: Array.isArray(question.right) ? question.right : (Array.isArray(metadata?.right) ? metadata.right : []),
        metadata: {
          difficulty: metadata?.difficulty || question.difficulty || 'standard',
          hint: metadata?.hint || question.hint || '',
          passage: metadata?.passage || question.passage || '',
          left: Array.isArray(metadata?.left) ? metadata.left : (Array.isArray(question.left) ? question.left : []),
          right: Array.isArray(metadata?.right) ? metadata.right : (Array.isArray(question.right) ? question.right : []),
        },
      }
    }

    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    const tenantId = String(actor.tenantId || '').trim()
    if (!tenantId) return c.json({ success: false, message: 'School context not found.' }, 400)

    const practice = await buildPracticeQuestionFeed(c.env.APP_DB, tenantId, {
      classId: String(c.req.query('classId') || '').trim(),
      subjectId: String(c.req.query('subjectId') || '').trim(),
      studentId: String(c.req.query('studentId') || actor.actorId || '').trim(),
    })
    return c.json({
      success: true,
      questions: (Array.isArray(practice.questions) ? practice.questions : []).map(sanitizePracticeQuestion),
      topicPerformanceMap: practice.topicPerformanceMap || {},
    })
  } catch (error) {
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Could not load practice questions.',
      error: error instanceof Error ? error.message : 'Could not load practice questions.',
    }, 500)
  }
})

// Purchase and package (in-memory books)
const books = [
  { id: 'book-ndovera-about', price: 0 },
  { id: 'book-algebra-simplified', price: 0 },
  { id: 'book-waec-2010-23', price: 2000 },
]

app.post('/api/purchase', async (c) => {
  const { bookId, userId, amount, deviceFingerprint } = await c.req.json()
  const book = books.find(b => b.id === bookId)
  if (!book) return c.json({ error: 'Book not found' }, 404)
  if (book.price !== amount) return c.json({ error: 'Invalid amount' }, 400)
  const receiptId = `rcpt_${Date.now()}`
  const license = await sign({ bookId, userId, deviceFingerprint, receiptId }, c.env.JWT_SECRET, { expiresIn: '7d' })
  return c.json({ success: true, receiptId, license })
})

app.post('/api/package', async (c) => {
  const { license, deviceFingerprint } = await c.req.json()
  if (!license) return c.json({ error: 'Missing license token' }, 400)
  try {
    const { payload } = await verify(license, c.env.JWT_SECRET)
    if (payload.deviceFingerprint && deviceFingerprint && payload.deviceFingerprint !== deviceFingerprint) {
      return c.json({ error: 'Device fingerprint mismatch' }, 403)
    }
    const downloadToken = await sign({ bookId: payload.bookId, userId: payload.userId }, c.env.JWT_SECRET, { expiresIn: '24h' })
    const ndbookContent = Buffer.from(`ND-BOOK ${payload.bookId} for ${payload.userId}`).toString('base64')
    return c.json({ success: true, downloadToken, ndbookBase64: ndbookContent })
  } catch (err) {
    return c.json({ error: 'Invalid or expired license' }, 401)
  }
})

app.post('/api/admin/log', (c) => {
  const { bookId, adminId, action, reason } = c.req.json()
  console.log('ADMIN LOG', { bookId, adminId, action, reason, ts: new Date().toISOString() })
  return c.json({ success: true, loggedAt: new Date().toISOString() })
})

app.get('/api/ai/access', authenticate, async (c) => {
  try {
    const actor = await resolveAiActor(c.env.APP_DB, c.var.user || {})
    return c.json({ success: true, ...(await buildAiAccessPayload(c.env.APP_DB, actor)) })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load AI access.', error }, 500)
  }
})

app.post('/api/ai/access/settings', authenticate, async (c) => {
  try {
    const actor = await resolveAiActor(c.env.APP_DB, c.var.user || {})
    if (!canManageAiBilling(actor.role)) return c.json({ success: false, message: 'forbidden' }, 403)

    const payload = await c.req.json().catch(() => ({})) as Record<string, any>
    const requestedScope = String(payload.scope || '').trim().toLowerCase()
    const requestedTenantId = String(payload.tenantId || '').trim()

    if (String(actor.role || '').trim().toLowerCase() !== 'ami' && requestedTenantId && requestedTenantId !== actor.tenantId) {
      return c.json({ success: false, message: 'You can only manage AI billing for your own school.' }, 403)
    }

    const tenantId = requestedScope === 'global'
      ? ''
      : String((String(actor.role || '').trim().toLowerCase() === 'ami' ? requestedTenantId : actor.tenantId) || '').trim()

    if (!tenantId && requestedScope !== 'global' && String(actor.role || '').trim().toLowerCase() !== 'ami') {
      return c.json({ success: false, message: 'No tenant is available for AI billing management.' }, 400)
    }

    const settingsKey = tenantId ? getTenantAiBillingSettingsKey(tenantId) : AI_GLOBAL_SETTINGS_KEY
    const existing = await getSettings(c.env.APP_DB, settingsKey).catch(() => null)
    const next = normalizeAiBillingPolicy({ ...existing, ...payload })

    await upsertSettings(c.env.APP_DB, settingsKey, next)
    const resolved = await getResolvedAiBillingPolicy(c.env.APP_DB, tenantId)

    return c.json({
      success: true,
      tenantId,
      scope: tenantId ? 'tenant' : 'global',
      policy: resolved.policy,
    })
  } catch (error) {
    return c.json({ success: false, message: 'Could not save AI billing settings.', error }, 500)
  }
})

app.post('/api/ai/access/top-up/initiate', authenticate, async (c) => {
  try {
    const actor = await resolveAiActor(c.env.APP_DB, c.var.user || {})
    const payload = await c.req.json().catch(() => ({})) as Record<string, any>
    const target = String(payload.target || 'individual').trim().toLowerCase() === 'school' ? 'school' : 'individual'
    const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 0))

    if (!quantity) {
      return c.json({ success: false, message: 'A positive credit quantity is required.' }, 400)
    }

    if (target === 'school' && !canManageAiBilling(actor.role)) {
      return c.json({ success: false, message: 'Only the school owner or Ami can top up school AI credits.' }, 403)
    }

    if (target === 'school' && !actor.tenantId) {
      return c.json({ success: false, message: 'No school is available for school-sponsored AI billing.' }, 400)
    }

    const { policy } = await getResolvedAiBillingPolicy(c.env.APP_DB, actor.tenantId)
    if (policy.pricePerCreditNaira <= 0) {
      return c.json({ success: false, message: 'AI credit pricing has not been configured yet.' }, 400)
    }

    const amountNaira = Number((quantity * policy.pricePerCreditNaira).toFixed(2))
    const txRef = `ai_${target}_${String(actor.actorId || actor.settingsKey || 'user').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`

    await saveAiPaymentRecord(c.env.APP_DB, txRef, {
      target,
      tenantId: actor.tenantId,
      settingsKey: actor.settingsKey,
      initiatedBy: actor.actorId,
      initiatedRole: actor.role,
      userEmail: actor.email,
      userName: actor.actorName,
      quantity,
      amountNaira,
      currency: 'NGN',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const flutterwavePayload = {
      tx_ref: txRef,
      amount: amountNaira,
      currency: 'NGN',
      redirect_url: buildAiCreditRedirectUrl(c, txRef),
      customer: {
        email: actor.email || 'billing@ndovera.com',
        name: actor.actorName || 'NDOVERA User',
        phone_number: actor.phone || undefined,
      },
      customizations: {
        title: 'NDOVERA AI Credits',
        description: `${quantity} AI credits for ${target === 'school' ? 'school-sponsored AI access' : 'personal AI access'}`,
      },
    }

    const providerResponse = await createFlutterwavePayment(c, flutterwavePayload)
    const payment = await saveAiPaymentRecord(c.env.APP_DB, txRef, {
      target,
      tenantId: actor.tenantId,
      settingsKey: actor.settingsKey,
      initiatedBy: actor.actorId,
      initiatedRole: actor.role,
      userEmail: actor.email,
      userName: actor.actorName,
      quantity,
      amountNaira,
      currency: 'NGN',
      status: 'pending',
      flutterwaveLink: String(providerResponse?.data?.link || '').trim(),
      providerResponse,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return c.json({ success: true, payment, paymentLink: providerResponse?.data?.link || '' })
  } catch (error) {
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Could not start AI credit checkout.' }, 500)
  }
})

app.post('/api/ai/access/top-up/verify', authenticate, async (c) => {
  try {
    const actor = await resolveAiActor(c.env.APP_DB, c.var.user || {})
    const payload = await c.req.json().catch(() => ({})) as Record<string, any>
    const txRef = String(payload.txRef || '').trim()
    if (!txRef) return c.json({ success: false, message: 'txRef is required.' }, 400)

    const payment = await getAiPaymentRecord(c.env.APP_DB, txRef)
    if (!payment) return c.json({ success: false, message: 'AI credit payment not found.' }, 404)
    if (!canAccessAiCreditPayment(actor, payment)) {
      return c.json({ success: false, message: 'You are not allowed to verify this AI credit payment.' }, 403)
    }

    if (payment.status === 'paid') {
      const access = await summarizeAiAccess(c.env.APP_DB, {
        tenantId: payment.tenantId,
        settingsKey: payment.settingsKey,
        policyOverrides: getAiPolicyOverrides(actor),
      })
      return c.json({ success: true, verified: true, payment, access })
    }

    const providerResponse = await verifyFlutterwavePayment(c, txRef)
    const providerStatus = String(providerResponse?.data?.status || '').trim().toLowerCase()
    const providerAmount = Number(providerResponse?.data?.amount || 0)
    const isVerified = ['successful', 'completed'].includes(providerStatus)
      && Math.abs(providerAmount - Number(payment.amountNaira || 0)) < 0.01

    if (!isVerified) {
      const updatedPayment = await saveAiPaymentRecord(c.env.APP_DB, txRef, {
        ...payment,
        status: providerStatus || 'failed',
        providerResponse,
      })
      return c.json({
        success: false,
        verified: false,
        payment: updatedPayment,
        message: 'Flutterwave has not confirmed this AI credit payment yet.',
      }, 400)
    }

    const access = await grantAiCredits(c.env.APP_DB, {
      tenantId: payment.tenantId,
      settingsKey: payment.settingsKey,
      quantity: payment.quantity,
      target: payment.target,
      policyOverrides: getAiPolicyOverrides(actor),
    })

    const updatedPayment = await saveAiPaymentRecord(c.env.APP_DB, txRef, {
      ...payment,
      status: 'paid',
      paidAt: new Date().toISOString(),
      flutterwaveTxId: String(providerResponse?.data?.id || payment.flutterwaveTxId || '').trim(),
      providerResponse,
    })

    return c.json({ success: true, verified: true, payment: updatedPayment, access })
  } catch (error) {
    return c.json({ success: false, message: error instanceof Error ? error.message : 'Could not verify AI credit payment.' }, 500)
  }
})

app.post('/api/ai/tutor/ask', authenticate, async (c) => {
  try {
    const actor = await resolveAiActor(c.env.APP_DB, c.var.user || {})
    const payload = await c.req.json().catch(() => ({})) as Record<string, any>
    const aiBinding = c.env.AI
    const { prompt, mode, messages } = buildAiConversation(actor, payload)
    const normalizedRole = String(actor.role || '').trim().toLowerCase()
    const practiceSurface = NVIDIA_STUDENT_AI_ROLES.has(normalizedRole) && String(payload.surface || '').trim().toLowerCase() === 'practice'
    // Students now use the same Workers AI model as teachers (no separate NVIDIA student model).
    const useNvidiaStudentModel = false

    if (!prompt) {
      return c.json({ success: false, message: 'Prompt is required.' }, 400)
    }

    if (!OPEN_AI_CHAT_ROLES.has(normalizedRole) && !isAcademicOnlyPrompt(prompt)) {
      const access = await summarizeAiAccess(c.env.APP_DB, {
        tenantId: actor.tenantId,
        settingsKey: actor.settingsKey,
        policyOverrides: getAiPolicyOverrides(actor),
      })
      return c.json({
        success: false,
        message: 'Ndovera AI responds only to academic questions. Please ask about a subject topic, problem, or exam review.',
        access,
      }, 400)
    }

    const consumption = practiceSurface
      ? {
          allowed: true,
          statusCode: 200,
          reason: '',
          source: 'practice_aura',
          chargedCredits: 0,
          access: await summarizeAiAccess(c.env.APP_DB, {
            tenantId: actor.tenantId,
            settingsKey: actor.settingsKey,
            policyOverrides: getAiPolicyOverrides(actor),
          }),
        }
      : await consumeAiAccess(c.env.APP_DB, {
          tenantId: actor.tenantId,
          settingsKey: actor.settingsKey,
          actorId: actor.actorId,
          actorName: actor.actorName,
          policyOverrides: getAiPolicyOverrides(actor),
        })

    if (!consumption.allowed) {
      return c.json({
        success: false,
        message: consumption.reason,
        access: consumption.access,
      }, consumption.statusCode)
    }

    let answer = ''

    if (useNvidiaStudentModel) {
      answer = await runNvidiaStudentChat(c.env, messages)

      if (!answer) {
        return c.json({
          success: false,
          message: 'Ndovera AI returned an empty response. Please try again.',
          access: consumption.access,
        }, 502)
      }
    } else {
      if (!aiBinding || typeof aiBinding.run !== 'function') {
        return c.json({
          success: false,
          message: 'Ndovera AI is not configured for this environment yet. Reconnect the AI service and redeploy the API worker.',
          access: consumption.access,
        }, 503)
      }

      const aiResult = await aiBinding.run(WORKERS_AI_MODEL, {
        messages,
        max_tokens: 700,
        temperature: OPEN_AI_CHAT_ROLES.has(normalizedRole) ? 0.65 : 0.45,
      })
      answer = extractWorkersAiText(aiResult)

      if (!answer) {
        return c.json({
          success: false,
          message: 'Workers AI returned an empty response. Please try again.',
          access: consumption.access,
        }, 502)
      }
    }

    return c.json({
      success: true,
      answer,
      source: consumption.source,
      chargedCredits: consumption.chargedCredits,
      access: consumption.access,
      mode,
      provider: 'ndovera-ai',
    })
  } catch (error) {
    console.error('AI tutor request failed', error)
    return c.json({ success: false, message: 'Ndovera AI could not complete that request right now. Please try again.' }, 500)
  }
})

// ─── Daily "Did you know?" knowledge digest (AI-generated once per day, with history) ───────────
async function ensureDailyFeedTable(db: D1Database) {
  if (_initializedTables.has('daily_feed')) return
  _initializedTables.add('daily_feed')
  await db.prepare(`CREATE TABLE IF NOT EXISTS daily_feed (feed_date TEXT PRIMARY KEY, payload_json TEXT, created_at TEXT)`).run()
}

function parseDailyFeedJson(raw: string) {
  try {
    const match = String(raw || '').match(/\{[\s\S]*\}/)
    const obj = JSON.parse(match ? match[0] : raw) as Record<string, any>
    const headlines = (Array.isArray(obj.headlines) ? obj.headlines : []).slice(0, 10).map((item: Record<string, any>) => ({
      category: String(item.category || 'General').trim() || 'General',
      title: String(item.title || '').trim(),
      summary: String(item.summary || '').trim(),
      tip: String(item.tip || '').trim(),
    })).filter((item: Record<string, any>) => item.title)
    const didYouKnow = String(obj.didYouKnow || obj.did_you_know || '').trim()
    if (!didYouKnow && headlines.length === 0) return null
    return { didYouKnow, headlines }
  } catch {
    return null
  }
}

async function generateDailyFeed(env: any, dateStr: string) {
  const messages: any[] = [
    { role: 'system', content: 'You are the editor of a daily knowledge digest for a school community (students, teachers and parents) in Nigeria and the wider world. Cover four areas: Education, Healthcare, Technology, and Career. Be accurate, positive and engaging. Reply with ONLY minified JSON of the shape {"didYouKnow": string, "headlines": [{"category": "Education"|"Healthcare"|"Technology"|"Career", "title": string, "summary": string, "tip": string}]}. Give one surprising, true "did you know" fact, and 6 headlines spread across the four areas, each with a 1-2 sentence summary and one short practical tip. Use evergreen developments and insights; do not invent specific breaking-news claims, dates or numbers you cannot stand behind.' },
    { role: 'user', content: `Create the digest for ${dateStr}. Make the "did you know" genuinely surprising and the headlines varied and useful.` },
  ]
  let raw = ''
  try {
    if (env.AI && typeof env.AI.run === 'function') {
      const result = await env.AI.run(WORKERS_AI_MODEL, { messages, max_tokens: 900, temperature: 0.7 })
      raw = extractWorkersAiText(result)
    }
  } catch {
    raw = ''
  }
  return parseDailyFeedJson(raw)
}

app.get('/api/feed/daily', authenticate, async (c) => {
  await ensureDailyFeedTable(c.env.APP_DB)
  const today = new Date().toISOString().slice(0, 10)
  const requested = String(c.req.query('date') || '').trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today

  const row = await c.env.APP_DB.prepare(`SELECT payload_json FROM daily_feed WHERE feed_date = ?`).bind(date).first() as Record<string, any> | null
  let payload = row ? parseJsonField(row.payload_json, null as any) : null

  // Generate (and cache) lazily for today only.
  if (!payload && date === today) {
    payload = await generateDailyFeed(c.env, date)
    if (payload) {
      await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO daily_feed (feed_date, payload_json, created_at) VALUES (?, ?, ?)`)
        .bind(date, JSON.stringify(payload), new Date().toISOString()).run().catch(() => null)
    }
  }

  if (!payload) return c.json({ success: true, date, didYouKnow: '', headlines: [] })
  return c.json({ success: true, date, didYouKnow: String(payload.didYouKnow || ''), headlines: Array.isArray(payload.headlines) ? payload.headlines : [] })
})

app.get('/api/feed/history', authenticate, async (c) => {
  await ensureDailyFeedTable(c.env.APP_DB)
  const rows = await c.env.APP_DB.prepare(`SELECT feed_date, payload_json FROM daily_feed ORDER BY feed_date DESC LIMIT 30`).all().catch(() => ({ results: [] }))
  const items = (((rows as any).results || []) as Record<string, any>[]).map(row => {
    const payload = parseJsonField(row.payload_json, {} as Record<string, any>)
    return { date: String(row.feed_date || ''), didYouKnow: String(payload.didYouKnow || ''), headlineCount: Array.isArray(payload.headlines) ? payload.headlines.length : 0 }
  })
  return c.json({ success: true, items })
})

app.post('/api/ai/review', (c) => {
  const report = {
    academicQuality: 'High',
    formattingIssues: 'Minor',
    plagiarismRisk: 'Low',
    ageAppropriateness: 'OK',
    recommendedAction: 'Recommend approval',
    score: 87,
  }
  return c.json({ success: true, report })
})

const USERS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, role TEXT, primary_role TEXT, employment_category TEXT, tenantId TEXT, passwordHash TEXT, status TEXT, createdAt TEXT)`
const USER_ROLES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, user_id, role)
)`
const STUDENT_PUBLIC_ID_COUNTERS_SQL = `CREATE TABLE IF NOT EXISTS student_public_id_counters (
  tenant_id TEXT PRIMARY KEY,
  last_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
)`
const PARENT_STUDENT_LINKS_SQL = `CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT)`
const CLASSES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, arm TEXT, classTeacherId TEXT, createdAt TEXT)`
const SUBJECTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`
const CLASS_MEMBERSHIPS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS class_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  membership_role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, class_id, user_id, membership_role)
)`

const BATCH_LIMIT_DEFAULT = 50
const BATCH_LIMIT_MAX = 200

async function runIndexStatements(db: D1Database, statements: string[]) {
  for (const statement of statements) {
    try {
      await db.prepare(statement).run()
    } catch {}
  }
}
const DEFAULT_FEATURE_FLAGS = {
  aurasEnabled: false,
  farmingModeEnabled: false,
}

type DisplayIdConfig = {
  counterKey: string
  prefix: string
  digits: number
}

async function ensureUsersTable(db: D1Database) {
  if (_initializedTables.has('users')) return
  _initializedTables.add('users')
  await db.prepare(USERS_TABLE_SQL).run()
  try { await db.exec('ALTER TABLE users ADD COLUMN tenantId TEXT') } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN passwordHash TEXT') } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN status TEXT') } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN createdAt TEXT') } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN primary_role TEXT') } catch {}
  try { await db.exec('ALTER TABLE users ADD COLUMN employment_category TEXT') } catch {}
  await db.exec(
    `UPDATE users
     SET primary_role = COALESCE(NULLIF(primary_role, ''), role),
         status = COALESCE(NULLIF(status, ''), 'active'),
         createdAt = COALESCE(NULLIF(createdAt, ''), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     WHERE primary_role IS NULL OR primary_role = ''
        OR status IS NULL OR status = ''
        OR createdAt IS NULL OR createdAt = ''`
  ).catch(() => null)
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_users_tenant_role_status_name ON users(tenantId, role, status, name)`,
    `CREATE INDEX IF NOT EXISTS idx_users_tenant_primary_role_status_name ON users(tenantId, primary_role, status, name)`,
    `CREATE INDEX IF NOT EXISTS idx_users_tenant_status_name ON users(tenantId, status, name)`,
    `CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users(lower(email))`,
  ])
}

async function ensureUserRolesTable(db: D1Database) {
  if (_initializedTables.has('user_roles')) return
  _initializedTables.add('user_roles')
  await db.prepare(USER_ROLES_TABLE_SQL).run()
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_role_user ON user_roles(tenant_id, role, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_user_primary ON user_roles(tenant_id, user_id, is_primary)`,
  ])
}

async function ensureStudentPublicIdCounterTable(db: D1Database) {
  if (_initializedTables.has('student_public_id_counter')) return
  _initializedTables.add('student_public_id_counter')
  await db.prepare(STUDENT_PUBLIC_ID_COUNTERS_SQL).run()
}

async function syncUserRoleRecords(
  db: D1Database,
  args: { tenantId: string, userId: string, primaryRole: string, roles: string[] },
) {
  const tenantId = String(args.tenantId || '').trim()
  const userId = String(args.userId || '').trim()
  const primaryRole = normalizeRole(args.primaryRole)
  const roles = Array.from(new Set((args.roles || []).map(role => normalizeRole(role)).filter(Boolean)))
  if (!tenantId || !userId) return

  await ensureUserRolesTable(db)
  await db.prepare(`DELETE FROM user_roles WHERE tenant_id = ? AND user_id = ?`).bind(tenantId, userId).run()

  const timestamp = new Date().toISOString()
  for (const role of roles) {
    await db.prepare(
      `INSERT OR REPLACE INTO user_roles (id, tenant_id, user_id, role, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `userrole_${tenantId}_${userId}_${role}`,
      tenantId,
      userId,
      role,
      role === primaryRole ? 1 : 0,
      timestamp,
      timestamp,
    ).run()
  }
}

async function generateTenantStudentPublicId(db: D1Database, tenantId: string) {
  const normalizedTenantId = String(tenantId || '').trim()
  if (!normalizedTenantId) throw new Error('Tenant is required to generate a student public ID.')

  await ensureStudentPublicIdCounterTable(db)
  const now = new Date().toISOString()
  const row = await db.prepare(
    `SELECT last_count FROM student_public_id_counters WHERE tenant_id = ?`
  ).bind(normalizedTenantId).first() as Record<string, any> | null
  const next = Number(row?.last_count || 0) + 1
  await db.prepare(
    `INSERT INTO student_public_id_counters (tenant_id, last_count, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET last_count = excluded.last_count, updated_at = excluded.updated_at`
  ).bind(normalizedTenantId, next, now).run()
  return `NS${String(next).padStart(7, '0')}`
}

async function ensureStudentPublicId(
  db: D1Database,
  args: { tenantId?: unknown, userId?: unknown, settingsKey?: unknown, settings?: Record<string, any> | null },
) {
  const tenantId = String(args.tenantId || args.settings?.tenantId || args.settings?.schoolId || '').trim()
  const userId = String(args.userId || '').trim()
  const settingsKey = String(args.settingsKey || '').trim()
  const settings = args.settings || null
  const effectiveRole = getPrimaryRole(settings || {}, settings?.role)
  if (!settings || effectiveRole !== 'student' || !tenantId || !settingsKey) {
    return settings
  }

  const existing = String(settings.publicStudentId || '').trim()
  if (existing) {
    return settings
  }

  const publicStudentId = await generateTenantStudentPublicId(db, tenantId)
  const nextSettings = {
    ...settings,
    publicStudentId,
  }
  await upsertSettings(db, settingsKey, nextSettings)

  if (userId) {
    await db.prepare(
      `UPDATE users
       SET employment_category = COALESCE(employment_category, ?)
       WHERE id = ? AND tenantId = ?`
    ).bind(
      deriveEmploymentCategory(getPrimaryRole(nextSettings, 'student'), nextSettings.employmentCategory, nextSettings.roles),
      userId,
      tenantId,
    ).run().catch(() => null)
  }

  return nextSettings
}

function hasOwnerRole(values: unknown[] = []) {
  return parseRoleList(...values).includes('owner')
}

async function assertTenantOwnerAssignmentAllowed(
  db: D1Database,
  tenantId: string,
  nextRoles: unknown[] = [],
  exemptUserId = '',
) {
  if (!hasOwnerRole(nextRoles)) return

  const tenant = await getTenantById(db, tenantId)
  const ownerEmail = String(tenant?.ownerEmail || '').trim().toLowerCase()
  const normalizedExemptUserId = String(exemptUserId || '').trim()
  const users = await db.prepare(
    `SELECT id, email FROM users WHERE tenantId = ? AND lower(COALESCE(primary_role, role, '')) = 'owner' AND (status IS NULL OR status != 'inactive')`
  ).bind(tenantId).all().catch(() => ({ results: [] }))
  const conflictingOwner = ((users.results || []) as Record<string, any>[]).find(user => String(user.id || '').trim() !== normalizedExemptUserId)

  if (conflictingOwner) {
    throw new Error('Only one owner is allowed per tenant. Use the ownership transfer flow instead.')
  }

  if (ownerEmail && ownerEmail !== String(exemptUserId || '').trim().toLowerCase()) {
    // School setup owns the one legal owner account. Normal person/role flows cannot assign owner.
    throw new Error('Owner role can only be assigned during school setup or ownership transfer.')
  }
}

function pickFeatureFlagOverrides(value: Record<string, any> | null | undefined) {
  const overrides = {} as Record<string, boolean>
  if (typeof value?.aurasEnabled === 'boolean') overrides.aurasEnabled = value.aurasEnabled
  if (typeof value?.farmingModeEnabled === 'boolean') overrides.farmingModeEnabled = value.farmingModeEnabled
  return overrides
}

async function getResolvedFeatureFlags(db: D1Database, tenantId = '') {
  const globalFlags = pickFeatureFlagOverrides(await getSettings(db, 'platform_feature_flags'))
  const tenantFlags = tenantId ? pickFeatureFlagOverrides(await getSettings(db, `tenant_feature_flags_${tenantId}`)) : {}

  return {
    globalFlags: { ...DEFAULT_FEATURE_FLAGS, ...globalFlags },
    tenantFlags,
    featureFlags: { ...DEFAULT_FEATURE_FLAGS, ...globalFlags, ...tenantFlags },
  }
}

async function getTenantUserCounts(db: D1Database, tenantId: string) {
  const rows = await db.prepare(
    `SELECT role, COUNT(*) as count FROM users WHERE tenantId = ? AND (status IS NULL OR status != 'inactive') GROUP BY role`
  ).bind(tenantId).all()

  const byRole: Record<string, number> = {}
  for (const row of (rows.results || []) as Record<string, any>[]) {
    const role = String(row.role || 'staff').toLowerCase()
    byRole[role] = Number(row.count || 0)
  }

  const students = byRole.student || 0
  const teachers = byRole.teacher || 0
  const parents = byRole.parent || 0
  const staff = Object.entries(byRole).reduce((sum, [role, count]) => {
    if (['student', 'teacher', 'parent', 'owner', 'ami'].includes(role)) return sum
    return sum + Number(count || 0)
  }, 0)
  // Billing is based on the number of STUDENTS only — never staff, teachers or parents.
  const billable = students

  return {
    ...byRole,
    students,
    teachers,
    parents,
    staff,
    billable,
  }
}

async function buildTenantQuoteForTenant(db: D1Database, tenant: any, discountCode?: any, plans: Record<string, any> = TENANT_PLANS) {
  const counts = tenant?.id ? await getTenantUserCounts(db, tenant.id).catch(() => ({ billable: Number(tenant.studentCount || 0) })) : { billable: 0 }
  return buildTenantQuote(tenant.planKey, Number((counts as any).billable || 0), discountCode, plans, counts as Record<string, number>)
}

async function ensureParentStudentLinksTable(db: D1Database) {
  if (_initializedTables.has('parent_student_links')) return
  _initializedTables.add('parent_student_links')
  await db.prepare(PARENT_STUDENT_LINKS_SQL).run()
}

async function ensureClassesTable(db: D1Database) {
  if (_initializedTables.has('classes')) return
  _initializedTables.add('classes')
  await db.prepare(CLASSES_TABLE_SQL).run()
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_classes_tenant_name_arm ON classes(tenantId, name, arm)`,
    `CREATE INDEX IF NOT EXISTS idx_classes_tenant_teacher ON classes(tenantId, classTeacherId)`,
  ])
}

async function ensureSubjectsTable(db: D1Database) {
  if (_initializedTables.has('subjects')) return
  _initializedTables.add('subjects')
  await db.prepare(SUBJECTS_TABLE_SQL).run()
  try { await db.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN createdAt TEXT') } catch {}
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_subjects_tenant_class_name ON subjects(tenantId, classId, name)`,
    `CREATE INDEX IF NOT EXISTS idx_subjects_tenant_teacher_class ON subjects(tenantId, teacherId, classId)`,
    `CREATE INDEX IF NOT EXISTS idx_subjects_tenant_name ON subjects(tenantId, name)`,
  ])
}

async function ensureClassMembershipsTable(db: D1Database) {
  if (_initializedTables.has('class_memberships')) return
  _initializedTables.add('class_memberships')
  await db.prepare(CLASS_MEMBERSHIPS_TABLE_SQL).run()
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_class_memberships_tenant_class_role ON class_memberships(tenant_id, class_id, membership_role)`,
    `CREATE INDEX IF NOT EXISTS idx_class_memberships_tenant_user_role ON class_memberships(tenant_id, user_id, membership_role)`,
  ])
}

function getDisplayIdConfig(role: string): DisplayIdConfig {
  const normalizedRole = String(role || '').toLowerCase()

  if (normalizedRole === 'student') {
    return { counterKey: 'student', prefix: 'NS', digits: 5 }
  }

  if (normalizedRole === 'parent') {
    return { counterKey: 'parent', prefix: 'NP', digits: 6 }
  }

  if (normalizedRole === 'growthpartner') {
    return { counterKey: 'growthpartner', prefix: 'NG', digits: 6 }
  }

  if (normalizedRole === 'ami') {
    return { counterKey: 'system-admin', prefix: 'NDA', digits: 5 }
  }

  return { counterKey: 'tenant-staff', prefix: 'NS', digits: 6 }
}

async function generateDisplayId(db: D1Database, config: DisplayIdConfig): Promise<string> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS user_id_counters (prefix TEXT PRIMARY KEY, last_count INTEGER NOT NULL DEFAULT 0)`
  ).run()

  const row = await db.prepare(
    `SELECT last_count FROM user_id_counters WHERE prefix = ?`
  ).bind(config.counterKey).first() as any

  const next = Number(row?.last_count || 0) + 1

  await db.prepare(
    `INSERT INTO user_id_counters (prefix, last_count)
     VALUES (?, ?)
     ON CONFLICT(prefix) DO UPDATE SET last_count = excluded.last_count`
  ).bind(config.counterKey, next).run()

  return `${config.prefix}${String(next).padStart(config.digits, '0')}`
}

async function hydrateUserRecord(db: D1Database, row: Record<string, any> | null) {
  if (!row) return null

  const resolvedIdentity = await resolveSettingsIdentity(db, String(row.email || row.id || '').trim())
  let settings = resolvedIdentity.settings || null
  settings = await ensureStudentPublicId(db, {
    tenantId: row.tenantId || settings?.tenantId || settings?.schoolId,
    userId: row.id,
    settingsKey: resolvedIdentity.settingsKey,
    settings,
  })
  const profile = buildAdmissionProfileRecord(settings || {}, row)
  const roleContext = buildRoleContext(settings || {}, row.role)
  const publicDisplayId = getPublicFacingUserId(settings || {}, roleContext.primaryRole)

  return {
    ...row,
    role: roleContext.primaryRole,
    primaryRole: roleContext.primaryRole,
    roles: roleContext.rawRoles,
    switchableRoles: roleContext.switchableRoles,
    adminRoles: roleContext.adminRoles,
    capabilities: roleContext.capabilities,
    displayId: publicDisplayId,
    publicStudentId: String(settings?.publicStudentId || '').trim() || null,
    employmentCategory: deriveEmploymentCategory(roleContext.primaryRole, settings?.employmentCategory, roleContext.rawRoles),
    phone: profile.phone || null,
    classId: settings?.classId || null,
    className: settings?.className || null,
    avatar: profile.avatar || null,
    avatarUrl: profile.avatar || null,
    dateOfBirth: profile.dateOfBirth || null,
    gender: profile.gender || null,
    address: profile.address || null,
    relationship: profile.relationship || null,
    profile,
    mustChangePassword: settings?.mustChangePassword === true,
  }
}

function chunkList<T>(items: T[], size = 100) {
  const normalizedSize = Math.max(1, Math.trunc(size || 100))
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += normalizedSize) {
    chunks.push(items.slice(index, index + normalizedSize))
  }
  return chunks
}

async function getSettingsMapForUserRows(db: D1Database, rows: Record<string, any>[]) {
  const settingsMap = new Map<string, Record<string, any>>()
  const lookupKeys = Array.from(new Set(
    (rows || [])
      .flatMap(row => [row?.email, row?.id])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  ))

  if (!lookupKeys.length) return settingsMap

  for (const keys of chunkList(lookupKeys, 150)) {
    const placeholders = keys.map(() => '?').join(', ')
    const settingsRows = await cenvlessSettingsQuery(db, placeholders, keys)
    for (const row of settingsRows) {
      const settingKey = String(row.studentId || '').trim()
      const payload = parseHeaderJsonObject(row.payload)
      if (settingKey && Object.keys(payload).length > 0) {
        settingsMap.set(settingKey, payload)
      }
    }
  }

  return settingsMap
}

async function cenvlessSettingsQuery(db: D1Database, placeholders: string, keys: string[]) {
  const result = await db.prepare(
    `SELECT studentId, payload FROM settings WHERE studentId IN (${placeholders})`
  ).bind(...keys).all().catch(() => ({ results: [] }))
  return (result.results || []) as Record<string, any>[]
}

async function hydrateUserRecords(db: D1Database, rows: Record<string, any>[]) {
  const settingsMap = await getSettingsMapForUserRows(db, rows)
  return Promise.all((rows || []).map(async row => {
    if (!row) return null

    const lookupKey = String(row.email || row.id || '').trim()
    const emailKey = String(row.email || '').trim()
    const idKey = String(row.id || '').trim()
    let settings = settingsMap.get(emailKey) || settingsMap.get(idKey) || null
    let settingsKey = emailKey && settingsMap.has(emailKey) ? emailKey : idKey

    if ((!settings || !getPublicFacingUserId(settings, row.role)) && lookupKey) {
      const resolvedIdentity = await resolveSettingsIdentity(db, lookupKey).catch(() => null)
      if (resolvedIdentity?.settings) {
        settings = resolvedIdentity.settings
      }
      if (resolvedIdentity?.settingsKey) {
        settingsKey = String(resolvedIdentity.settingsKey || '').trim() || settingsKey
      }
    }

    const roleContext = buildRoleContext(settings || {}, row.role)
    settings = await ensureStudentPublicId(db, {
      tenantId: row.tenantId || settings?.tenantId || settings?.schoolId,
      userId: row.id,
      settingsKey,
      settings,
    })

    if (settings && !settings.displayId && roleContext.primaryRole !== 'student' && settingsKey) {
      try {
        const newDisplayId = await generateDisplayId(db, getDisplayIdConfig(roleContext.primaryRole))
        settings = { ...settings, displayId: newDisplayId }
        await upsertSettings(db, settingsKey, settings)
      } catch {
        // Non-critical for list rendering.
      }
    }

    const profile = buildAdmissionProfileRecord(settings || {}, row)
    const publicDisplayId = getPublicFacingUserId(settings || {}, roleContext.primaryRole)

    return {
      ...row,
      role: roleContext.primaryRole,
      primaryRole: roleContext.primaryRole,
      roles: roleContext.rawRoles,
      switchableRoles: roleContext.switchableRoles,
      adminRoles: roleContext.adminRoles,
      capabilities: roleContext.capabilities,
      displayId: publicDisplayId,
      publicStudentId: String(settings?.publicStudentId || '').trim() || null,
      employmentCategory: deriveEmploymentCategory(roleContext.primaryRole, settings?.employmentCategory, roleContext.rawRoles),
      phone: profile.phone || null,
      classId: settings?.classId || null,
      className: settings?.className || null,
      avatar: profile.avatar || null,
      avatarUrl: profile.avatar || null,
      dateOfBirth: profile.dateOfBirth || null,
      gender: profile.gender || null,
      address: profile.address || null,
      relationship: profile.relationship || null,
      profile,
      mustChangePassword: settings?.mustChangePassword === true,
    }
  }))
}

function normalizeMonthKey(value: unknown) {
  const raw = String(value || '').trim()
  return /^\d{4}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 7)
}

function getMonthDateRange(monthKey: string) {
  const normalized = normalizeMonthKey(monthKey)
  const [yearText, monthText] = normalized.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))

  return {
    month: normalized,
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    fromDateTime: `${start.toISOString().slice(0, 10)}T00:00:00.000Z`,
    toDateTime: `${end.toISOString().slice(0, 10)}T23:59:59.999Z`,
  }
}

function formatPercentage(value: number) {
  return `${Math.round(Number.isFinite(value) ? value : 0)}%`
}

function safeNumber(value: unknown) {
  const normalized = Number(value || 0)
  return Number.isFinite(normalized) ? normalized : 0
}

function parseAwardRecipientSnapshot(value: unknown) {
  if (value && typeof value === 'object') {
    return value as Record<string, any>
  }

  if (typeof value !== 'string' || !value.trim()) {
    return {} as Record<string, any>
  }

  try {
    return JSON.parse(value) as Record<string, any>
  } catch {
    return {} as Record<string, any>
  }
}

function buildAwardRecipientSnapshot(person: Record<string, any> | null) {
  return {
    userId: String(person?.id || ''),
    name: String(person?.name || 'Unknown user'),
    role: String(person?.role || ''),
    avatarUrl: String(person?.avatarUrl || person?.avatar || '').trim(),
    dateOfBirth: String(person?.dateOfBirth || '').trim(),
    classId: String(person?.classId || '').trim(),
    className: String(person?.className || '').trim(),
    displayId: String(person?.displayId || '').trim(),
  }
}

async function listActiveTenantPeopleWithProfiles(db: D1Database, tenantId: string) {
  if (!tenantId) return [] as Record<string, any>[]

  await ensureUsersTable(db)
  const rows = await db.prepare(
    `SELECT id, name, email, role, status, createdAt FROM users WHERE tenantId = ? AND (status IS NULL OR status != 'inactive') ORDER BY role, name`
  ).bind(tenantId).all()
  const people = await hydrateUserRecords(db, (rows.results || []) as Record<string, any>[])
  return people.filter(Boolean) as Record<string, any>[]
}

async function ensureSchoolAwardsTable(db: D1Database) {
  if (_initializedTables.has('school_awards')) return
  _initializedTables.add('school_awards')
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_awards (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    period_month TEXT NOT NULL,
    award_key TEXT NOT NULL,
    award_title TEXT NOT NULL,
    description TEXT,
    subject_user_id TEXT NOT NULL,
    recipient_snapshot TEXT NOT NULL,
    attached_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, period_month, award_key, subject_user_id)
  )`).run()
}

function mapSchoolAwardRow(row: Record<string, any> | null) {
  if (!row) return null

  return {
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    periodMonth: String(row.period_month || ''),
    awardKey: String(row.award_key || ''),
    awardTitle: String(row.award_title || ''),
    description: String(row.description || ''),
    subjectUserId: String(row.subject_user_id || ''),
    recipient: parseAwardRecipientSnapshot(row.recipient_snapshot),
    attachedBy: String(row.attached_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
  }
}

async function listSchoolAwards(
  db: D1Database,
  filters: { tenantId?: string, periodMonth?: string, limit?: number } = {},
) {
  await ensureSchoolAwardsTable(db)

  let query = 'SELECT * FROM school_awards WHERE 1 = 1'
  const params: Array<string | number> = []

  if (filters.tenantId) {
    query += ' AND tenant_id = ?'
    params.push(filters.tenantId)
  }

  if (filters.periodMonth) {
    query += ' AND period_month = ?'
    params.push(normalizeMonthKey(filters.periodMonth))
  }

  query += ' ORDER BY period_month DESC, updated_at DESC'

  if (typeof filters.limit === 'number' && Number.isFinite(filters.limit) && filters.limit > 0) {
    query += ' LIMIT ?'
    params.push(Math.trunc(filters.limit))
  }

  const rows = await db.prepare(query).bind(...params).all()
  return ((rows.results || []) as Record<string, any>[])
    .map(mapSchoolAwardRow)
    .filter(Boolean)
}

async function upsertSchoolAward(db: D1Database, award: {
  tenantId: string
  periodMonth: string
  awardKey: string
  awardTitle: string
  description?: string
  subjectUserId: string
  recipientSnapshot: Record<string, any>
  attachedBy?: string
}) {
  await ensureSchoolAwardsTable(db)

  const timestamp = new Date().toISOString()
  const id = `award_${award.tenantId}_${award.subjectUserId}_${award.awardKey}_${award.periodMonth}`
  const normalizedMonth = normalizeMonthKey(award.periodMonth)
  const normalizedAwardKey = slugifyValue(String(award.awardKey || '').trim()).slice(0, 80) || 'custom-award'

  await db.prepare(
    `INSERT INTO school_awards (
      id, tenant_id, period_month, award_key, award_title, description, subject_user_id, recipient_snapshot, attached_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, period_month, award_key, subject_user_id)
    DO UPDATE SET
      award_title = excluded.award_title,
      description = excluded.description,
      recipient_snapshot = excluded.recipient_snapshot,
      attached_by = excluded.attached_by,
      updated_at = excluded.updated_at`
  ).bind(
    id,
    award.tenantId,
    normalizedMonth,
    normalizedAwardKey,
    String(award.awardTitle || 'School Recognition Award').trim(),
    String(award.description || '').trim() || null,
    award.subjectUserId,
    JSON.stringify(award.recipientSnapshot || {}),
    String(award.attachedBy || '').trim() || null,
    timestamp,
    timestamp,
  ).run()

  const saved = await db.prepare(
    `SELECT * FROM school_awards WHERE tenant_id = ? AND period_month = ? AND award_key = ? AND subject_user_id = ? LIMIT 1`
  ).bind(
    award.tenantId,
    normalizedMonth,
    normalizedAwardKey,
    award.subjectUserId,
  ).first() as Record<string, any> | null

  return mapSchoolAwardRow(saved)
}

function buildGroupedCountMap(rows: any) {
  return ((rows?.results || []) as Record<string, any>[]).reduce((accumulator, row) => {
    const actor = String(row.actor || '').trim().toLowerCase()
    if (!actor) return accumulator
    accumulator[actor] = safeNumber(row.count)
    return accumulator
  }, {} as Record<string, number>)
}

function sumComparableCounts(countMap: Record<string, number>, identifiers: unknown[]) {
  const comparableIdentifiers = collectComparableIdentifiers(identifiers)
  return comparableIdentifiers.reduce((sum, identifier) => sum + safeNumber(countMap[identifier]), 0)
}

async function buildSchoolActivityAggregates(db: D1Database, tenantId: string, monthKey: string) {
  await ensureClassesTable(db)

  const classRows = await db.prepare(
    `SELECT id FROM classes WHERE tenantId = ?`
  ).bind(tenantId).all().catch(() => ({ results: [] }))
  const classIds = ((classRows.results || []) as Record<string, any>[])
    .map(row => String(row.id || '').trim())
    .filter(Boolean)

  if (!classIds.length) {
    return {
      posts: {} as Record<string, number>,
      assignments: {} as Record<string, number>,
      materials: {} as Record<string, number>,
      liveSessions: {} as Record<string, number>,
      submissions: {} as Record<string, number>,
    }
  }

  const period = getMonthDateRange(monthKey)
  const classPlaceholders = classIds.map(() => '?').join(', ')

  const [postRows, assignmentRows, materialRows, liveRows, submissionRows] = await Promise.all([
    db.prepare(
      `SELECT lower(trim(coalesce(authorId, ''))) AS actor, COUNT(*) as count
       FROM posts
       WHERE classId IN (${classPlaceholders})
         AND createdAt >= ?
         AND createdAt <= ?
       GROUP BY lower(trim(coalesce(authorId, '')))`
    ).bind(...classIds, period.fromDateTime, period.toDateTime).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT lower(trim(coalesce(createdBy, ''))) AS actor, COUNT(*) as count
       FROM assignments
       WHERE classId IN (${classPlaceholders})
         AND createdAt >= ?
         AND createdAt <= ?
       GROUP BY lower(trim(coalesce(createdBy, '')))`
    ).bind(...classIds, period.fromDateTime, period.toDateTime).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT lower(trim(coalesce(uploadedBy, ''))) AS actor, COUNT(*) as count
       FROM materials
       WHERE classId IN (${classPlaceholders})
         AND uploadedAt >= ?
         AND uploadedAt <= ?
       GROUP BY lower(trim(coalesce(uploadedBy, '')))`
    ).bind(...classIds, period.fromDateTime, period.toDateTime).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT lower(trim(coalesce(createdBy, ''))) AS actor, COUNT(*) as count
       FROM classroom_live_sessions
       WHERE classId IN (${classPlaceholders})
         AND createdAt >= ?
         AND createdAt <= ?
       GROUP BY lower(trim(coalesce(createdBy, '')))`
    ).bind(...classIds, period.fromDateTime, period.toDateTime).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT lower(trim(coalesce(s.studentId, ''))) AS actor, COUNT(*) as count
       FROM submissions s
       INNER JOIN assignments a ON a.id = s.assignmentId
       WHERE a.classId IN (${classPlaceholders})
         AND s.submittedAt >= ?
         AND s.submittedAt <= ?
       GROUP BY lower(trim(coalesce(s.studentId, '')))`
    ).bind(...classIds, period.fromDateTime, period.toDateTime).all().catch(() => ({ results: [] })),
  ])

  return {
    posts: buildGroupedCountMap(postRows),
    assignments: buildGroupedCountMap(assignmentRows),
    materials: buildGroupedCountMap(materialRows),
    liveSessions: buildGroupedCountMap(liveRows),
    submissions: buildGroupedCountMap(submissionRows),
  }
}

function buildBirthdayHighlights(people: Record<string, any>[], monthKey: string) {
  const normalizedMonth = normalizeMonthKey(monthKey)
  const targetMonth = normalizedMonth.slice(5, 7)
  const targetYear = Number(normalizedMonth.slice(0, 4))

  return people
    .map(person => {
      const dateOfBirth = String(person?.dateOfBirth || '').trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || dateOfBirth.slice(5, 7) !== targetMonth) {
        return null
      }

      const birthYear = Number(dateOfBirth.slice(0, 4))
      const day = dateOfBirth.slice(8, 10)
      return {
        ...buildAwardRecipientSnapshot(person),
        birthdayDate: `${normalizedMonth}-${day}`,
        birthdayLabel: new Date(`${normalizedMonth}-${day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
        ageTurning: Number.isFinite(birthYear) && birthYear > 1900 ? Math.max(0, targetYear - birthYear) : null,
      }
    })
    .filter(Boolean)
    .sort((left, right) => String((left as any).birthdayDate).localeCompare(String((right as any).birthdayDate)))
}

async function buildMonthlyAttendanceReport(db: D1Database, tenantId: string, monthKey: string) {
  const normalizedMonth = normalizeMonthKey(monthKey)
  const period = getMonthDateRange(normalizedMonth)
  const today = new Date().toISOString().slice(0, 10)
  const weeklyEnd = period.to < today ? period.to : today
  const weeklyStartDate = new Date(`${weeklyEnd}T00:00:00Z`)
  weeklyStartDate.setUTCDate(weeklyStartDate.getUTCDate() - 6)
  const weeklyStart = weeklyStartDate.toISOString().slice(0, 10) < period.from ? period.from : weeklyStartDate.toISOString().slice(0, 10)

  const people = await listActiveTenantPeopleWithProfiles(db, tenantId)
  const staffMembers = people.filter(person => !['student', 'parent', 'ami'].includes(String(person.role || '').toLowerCase()))
  const studentMembers = people.filter(person => String(person.role || '').toLowerCase() === 'student')

  const studentRecords = await listSchoolStudentAttendance(db, {
    tenantId,
    from: period.from,
    to: period.to,
  })

  await ensureStaffAttendanceBaseTable(db)
  await ensureStaffAttendanceEventsTable(db)

  const [staffRecordRows, staffEventRows, amiAwards, activityAggregates] = await Promise.all([
    db.prepare(
      `SELECT staff_id, status, date FROM staff_attendance WHERE tenant_id = ? AND date >= ? AND date <= ?`
    ).bind(tenantId, period.from, period.to).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT staff_id, is_late, late_minutes, late_charge, date FROM staff_attendance_events WHERE tenant_id = ? AND action = 'sign-in' AND date >= ? AND date <= ?`
    ).bind(tenantId, period.from, period.to).all().catch(() => ({ results: [] })),
    listSchoolAwards(db, { tenantId, periodMonth: normalizedMonth, limit: 24 }),
    buildSchoolActivityAggregates(db, tenantId, normalizedMonth),
  ])

  const studentStats = new Map<string, Record<string, number>>()
  for (const student of studentMembers) {
    studentStats.set(String(student.id || ''), { present: 0, late: 0, absent: 0, total: 0, weeklyPresent: 0, weeklyLate: 0, weeklyTotal: 0 })
  }

  let studentPresentCount = 0
  let studentLateCount = 0
  let studentAbsentCount = 0

  for (const record of studentRecords) {
    const studentId = String(record.studentId || '')
    if (!studentId) continue
    const status = String(record.status || '').toLowerCase()
    const stats = studentStats.get(studentId) || { present: 0, late: 0, absent: 0, total: 0, weeklyPresent: 0, weeklyLate: 0, weeklyTotal: 0 }
    stats.total += 1
    if (status === 'present') {
      stats.present += 1
      studentPresentCount += 1
    } else if (status === 'late') {
      stats.late += 1
      studentLateCount += 1
    } else if (status === 'absent') {
      stats.absent += 1
      studentAbsentCount += 1
    }
    if (String(record.date || '') >= weeklyStart && String(record.date || '') <= weeklyEnd) {
      stats.weeklyTotal += 1
      if (status === 'present') stats.weeklyPresent += 1
      if (status === 'late') stats.weeklyLate += 1
    }
    studentStats.set(studentId, stats)
  }

  const staffStats = new Map<string, Record<string, number>>()
  for (const staffMember of staffMembers) {
    staffStats.set(String(staffMember.id || ''), { present: 0, late: 0, absent: 0, total: 0, onTime: 0, lateMinutes: 0, lateCharges: 0, signIns: 0 })
  }

  let staffPresentCount = 0
  let staffLateCount = 0
  let staffAbsentCount = 0
  let staffLateChargeTotal = 0

  for (const row of (staffRecordRows.results || []) as Record<string, any>[]) {
    const staffId = String(row.staff_id || '').trim()
    if (!staffId) continue
    const status = String(row.status || '').toLowerCase()
    const stats = staffStats.get(staffId) || { present: 0, late: 0, absent: 0, total: 0, onTime: 0, lateMinutes: 0, lateCharges: 0, signIns: 0 }
    stats.total += 1
    if (status === 'present') {
      stats.present += 1
      staffPresentCount += 1
    } else if (status === 'late') {
      stats.late += 1
      staffLateCount += 1
    } else if (status === 'absent') {
      stats.absent += 1
      staffAbsentCount += 1
    }
    staffStats.set(staffId, stats)
  }

  for (const row of (staffEventRows.results || []) as Record<string, any>[]) {
    const staffId = String(row.staff_id || '').trim()
    if (!staffId) continue
    const stats = staffStats.get(staffId) || { present: 0, late: 0, absent: 0, total: 0, onTime: 0, lateMinutes: 0, lateCharges: 0, signIns: 0 }
    stats.signIns += 1
    if (Boolean(Number(row.is_late || 0))) {
      stats.lateMinutes += safeNumber(row.late_minutes)
    } else {
      stats.onTime += 1
    }
    stats.lateCharges += safeNumber(row.late_charge)
    staffLateChargeTotal += safeNumber(row.late_charge)
    staffStats.set(staffId, stats)
  }

  const studentAttendanceRate = studentRecords.length > 0
    ? ((studentPresentCount + studentLateCount) / studentRecords.length) * 100
    : 0
  const weeklyStudentRecords = studentRecords.filter(record => String(record.date || '') >= weeklyStart && String(record.date || '') <= weeklyEnd)
  const weeklyStudentPresentish = weeklyStudentRecords.filter(record => ['present', 'late'].includes(String(record.status || '').toLowerCase())).length
  const weeklyStudentAttendanceRate = weeklyStudentRecords.length > 0
    ? (weeklyStudentPresentish / weeklyStudentRecords.length) * 100
    : 0
  const staffRecordCount = staffPresentCount + staffLateCount + staffAbsentCount
  const staffAttendanceRate = staffRecordCount > 0
    ? ((staffPresentCount + staffLateCount) / staffRecordCount) * 100
    : 0

  const atRiskStudents = studentMembers
    .map(student => {
      const stats = studentStats.get(String(student.id || '')) || { present: 0, late: 0, absent: 0, total: 0, weeklyPresent: 0, weeklyLate: 0, weeklyTotal: 0 }
      const rate = stats.total > 0 ? ((stats.present + stats.late) / stats.total) * 100 : 0
      return {
        ...buildAwardRecipientSnapshot(student),
        attendanceRate: Number(rate.toFixed(1)),
        presentCount: stats.present,
        lateCount: stats.late,
        absentCount: stats.absent,
        totalRecords: stats.total,
      }
    })
    .filter(student => student.totalRecords > 0 && student.attendanceRate < 75)
    .sort((left, right) => left.attendanceRate - right.attendanceRate)
    .slice(0, 5)

  const mostPunctualStaff = staffMembers
    .map(staffMember => {
      const stats = staffStats.get(String(staffMember.id || '')) || { present: 0, late: 0, absent: 0, total: 0, onTime: 0, lateMinutes: 0, lateCharges: 0, signIns: 0 }
      return {
        ...buildAwardRecipientSnapshot(staffMember),
        onTimeCount: stats.onTime,
        signIns: stats.signIns,
        lateMinutes: stats.lateMinutes,
        score: stats.onTime,
      }
    })
    .filter(staffMember => staffMember.signIns > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (left.lateMinutes !== right.lateMinutes) return left.lateMinutes - right.lateMinutes
      return left.name.localeCompare(right.name)
    })[0] || null

  const consistencyStarStaff = staffMembers
    .map(staffMember => {
      const stats = staffStats.get(String(staffMember.id || '')) || { present: 0, late: 0, absent: 0, total: 0, onTime: 0, lateMinutes: 0, lateCharges: 0, signIns: 0 }
      const rate = stats.total > 0 ? ((stats.present + stats.late) / stats.total) * 100 : 0
      return {
        ...buildAwardRecipientSnapshot(staffMember),
        attendanceRate: Number(rate.toFixed(1)),
        totalRecords: stats.total,
        score: rate,
      }
    })
    .filter(staffMember => staffMember.totalRecords > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.totalRecords !== left.totalRecords) return right.totalRecords - left.totalRecords
      return left.name.localeCompare(right.name)
    })[0] || null

  const attendanceChampionStudent = studentMembers
    .map(student => {
      const stats = studentStats.get(String(student.id || '')) || { present: 0, late: 0, absent: 0, total: 0, weeklyPresent: 0, weeklyLate: 0, weeklyTotal: 0 }
      const rate = stats.total > 0 ? ((stats.present + stats.late) / stats.total) * 100 : 0
      return {
        ...buildAwardRecipientSnapshot(student),
        attendanceRate: Number(rate.toFixed(1)),
        totalRecords: stats.total,
        score: rate,
      }
    })
    .filter(student => student.totalRecords > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.totalRecords !== left.totalRecords) return right.totalRecords - left.totalRecords
      return left.name.localeCompare(right.name)
    })[0] || null

  const activityLeaderboards = {
    staff: staffMembers
      .map(staffMember => {
        const identifiers = [staffMember.id, staffMember.email, staffMember.displayId]
        const posts = sumComparableCounts(activityAggregates.posts, identifiers)
        const assignments = sumComparableCounts(activityAggregates.assignments, identifiers)
        const materials = sumComparableCounts(activityAggregates.materials, identifiers)
        const liveSessions = sumComparableCounts(activityAggregates.liveSessions, identifiers)
        const score = (assignments * 4) + (materials * 3) + (liveSessions * 4) + (posts * 2)
        return {
          ...buildAwardRecipientSnapshot(staffMember),
          posts,
          assignments,
          materials,
          liveSessions,
          score,
        }
      })
      .filter(staffMember => staffMember.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3),
    students: studentMembers
      .map(student => {
        const identifiers = [student.id, student.email, student.displayId]
        const posts = sumComparableCounts(activityAggregates.posts, identifiers)
        const submissions = sumComparableCounts(activityAggregates.submissions, identifiers)
        const score = (submissions * 4) + (posts * 2)
        return {
          ...buildAwardRecipientSnapshot(student),
          posts,
          submissions,
          score,
        }
      })
      .filter(student => student.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3),
  }

  const recognitions = [
    mostPunctualStaff ? {
      key: 'most-punctual-staff',
      title: 'Most Punctual Staff',
      description: `${mostPunctualStaff.name} signed in on time ${mostPunctualStaff.onTimeCount} time${mostPunctualStaff.onTimeCount === 1 ? '' : 's'} this month.`,
      recipient: mostPunctualStaff,
    } : null,
    consistencyStarStaff ? {
      key: 'consistency-star-staff',
      title: 'Consistency Star',
      description: `${consistencyStarStaff.name} kept a ${formatPercentage(consistencyStarStaff.attendanceRate)} staff attendance rate this month.`,
      recipient: consistencyStarStaff,
    } : null,
    attendanceChampionStudent ? {
      key: 'attendance-champion-student',
      title: 'Attendance Champion Student',
      description: `${attendanceChampionStudent.name} led student attendance with ${formatPercentage(attendanceChampionStudent.attendanceRate)} attendance.`,
      recipient: attendanceChampionStudent,
    } : null,
    activityLeaderboards.staff[0] ? {
      key: 'most-active-staff',
      title: 'Most Active Staff',
      description: `${activityLeaderboards.staff[0].name} led classroom delivery with ${activityLeaderboards.staff[0].score} activity points.`,
      recipient: activityLeaderboards.staff[0],
    } : null,
    activityLeaderboards.students[0] ? {
      key: 'most-active-student',
      title: 'Most Active Student',
      description: `${activityLeaderboards.students[0].name} led student participation with ${activityLeaderboards.students[0].score} activity points.`,
      recipient: activityLeaderboards.students[0],
    } : null,
  ].filter(Boolean)

  const lateStaff = staffMembers
    .map(staffMember => {
      const stats = staffStats.get(String(staffMember.id || '')) || { present: 0, late: 0, absent: 0, total: 0, onTime: 0, lateMinutes: 0, lateCharges: 0, signIns: 0 }
      return {
        ...buildAwardRecipientSnapshot(staffMember),
        lateCount: stats.late,
        lateMinutes: stats.lateMinutes,
        lateCharges: Number(stats.lateCharges.toFixed(2)),
      }
    })
    .filter(staffMember => staffMember.lateCount > 0 || staffMember.lateMinutes > 0)
    .sort((left, right) => {
      if (right.lateCount !== left.lateCount) return right.lateCount - left.lateCount
      return right.lateMinutes - left.lateMinutes
    })
    .slice(0, 5)

  return {
    month: normalizedMonth,
    dateRange: { from: period.from, to: period.to },
    generatedAt: new Date().toISOString(),
    staffSummary: {
      totalStaff: staffMembers.length,
      recordsCaptured: staffRecordCount,
      presentCount: staffPresentCount,
      lateCount: staffLateCount,
      absentCount: staffAbsentCount,
      attendanceRate: Number(staffAttendanceRate.toFixed(1)),
      lateChargeTotal: Number(staffLateChargeTotal.toFixed(2)),
    },
    studentSummary: {
      totalStudents: studentMembers.length,
      recordsCaptured: studentRecords.length,
      presentCount: studentPresentCount,
      lateCount: studentLateCount,
      absentCount: studentAbsentCount,
      attendanceRate: Number(studentAttendanceRate.toFixed(1)),
      weeklyAttendanceRate: Number(weeklyStudentAttendanceRate.toFixed(1)),
      atRiskCount: atRiskStudents.length,
    },
    birthdays: buildBirthdayHighlights(people, normalizedMonth),
    recognitions,
    amiAwards,
    lateStaff,
    atRiskStudents,
    activityLeaderboards,
    peopleTotals: {
      staff: staffMembers.length,
      students: studentMembers.length,
    },
  }
}

function buildAttendanceAiAnalysis(report: Record<string, any>) {
  const atRiskStudents = Array.isArray(report?.atRiskStudents) ? report.atRiskStudents : []
  const recognitions = Array.isArray(report?.recognitions) ? report.recognitions : []
  const birthdays = Array.isArray(report?.birthdays) ? report.birthdays : []
  const lateStaff = Array.isArray(report?.lateStaff) ? report.lateStaff : []

  const suggestions: string[] = []
  if (atRiskStudents.length > 0) {
    suggestions.push(`Follow up with ${atRiskStudents.length} student${atRiskStudents.length === 1 ? '' : 's'} below 75% attendance this month, starting with ${atRiskStudents[0].name}.`)
  }
  if (lateStaff.length > 0) {
    suggestions.push(`Review sign-in discipline with ${lateStaff.length} staff member${lateStaff.length === 1 ? '' : 's'} who recorded lateness this month.`)
  }
  if (birthdays.length > 0) {
    suggestions.push(`Celebrate ${birthdays.slice(0, 3).map((person: Record<string, any>) => person.name).join(', ')} in the monthly assembly or on the dashboard.`)
  }
  if (recognitions.length > 0) {
    suggestions.push(`Publicly recognise ${recognitions[0].recipient?.name || 'this month\'s top contributor'} to reinforce strong attendance and platform engagement.`)
  }
  if (suggestions.length === 0) {
    suggestions.push('Attendance is stable this month. Keep celebrating punctual staff and students to maintain momentum.')
  }

  const teacherPatterns = lateStaff.length > 0
    ? `${lateStaff.length} staff member${lateStaff.length === 1 ? '' : 's'} recorded lateness this month, with ${report?.staffSummary?.lateCount || 0} late attendance record${report?.staffSummary?.lateCount === 1 ? '' : 's'} overall.`
    : 'Staff attendance was stable this month, with no recorded late sign-ins in the captured data.'

  return {
    weeklyRate: formatPercentage(safeNumber(report?.studentSummary?.weeklyAttendanceRate)),
    monthlyRate: formatPercentage(safeNumber(report?.studentSummary?.attendanceRate)),
    atRiskStudents: atRiskStudents.map((student: Record<string, any>) => `${student.name} — ${formatPercentage(student.attendanceRate)}`),
    teacherPatterns,
    suggestions,
    report,
  }
}

// Staff list for owner/HoS
app.get('/api/people', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    // ensureUsersTable intentionally omitted — it runs UPDATE users WHERE 1=1 on every call
    // (a full-table migration rewrite) which alone causes Worker CPU timeouts. The table and
    // indexes are guaranteed to exist from write paths (addPerson, login, etc.).
    const search = String(c.req.query('search') || '').trim().toLowerCase()
    const roleFilter = normalizeRole(c.req.query('role') || '')
    const page = Math.max(1, Number(c.req.query('page') || 1) || 1)
    const requestedLimit = Number(c.req.query('limit') || BATCH_LIMIT_DEFAULT)
    const limit = Math.max(1, Math.min(BATCH_LIMIT_MAX, Number.isFinite(requestedLimit) ? requestedLimit : BATCH_LIMIT_DEFAULT))
    const offset = (page - 1) * limit

    // Build role condition at SQL level so we never pull the full table into memory
    const SQL_ADMIN_ROLES = [
      'owner', 'hos', 'accountant', 'principal', 'viceprincipal', 'hod', 'hodassistant',
      'headteacher', 'nurseryhead', 'storekeeper', 'tuckshopmanager', 'transport', 'hostel',
      'cafeteria', 'clinic', 'ict', 'ict_manager', 'examofficer', 'sportsmaster', 'sanitation',
      'librarian', 'admin', 'classteacher',
    ]
    let roleCondition = ''
    const roleConditionParams: string[] = []
    if (roleFilter === 'teacher') {
      roleCondition = ` AND lower(trim(coalesce(primary_role, role, ''))) = 'teacher'`
    } else if (roleFilter === 'student') {
      roleCondition = ` AND lower(trim(coalesce(primary_role, role, ''))) = 'student'`
    } else if (roleFilter === 'parent') {
      roleCondition = ` AND lower(trim(coalesce(primary_role, role, ''))) = 'parent'`
    } else if (roleFilter === 'admin' || roleFilter === 'staff') {
      const placeholders = SQL_ADMIN_ROLES.map(() => '?').join(', ')
      roleCondition = ` AND lower(trim(coalesce(primary_role, role, ''))) IN (${placeholders})`
      roleConditionParams.push(...SQL_ADMIN_ROLES)
    } else if (roleFilter) {
      roleCondition = ` AND lower(trim(coalesce(primary_role, role, ''))) = ?`
      roleConditionParams.push(roleFilter)
    }

    // Basic search on name/email at SQL level (displayId search handled post-hydration)
    let searchCondition = ''
    const searchConditionParams: string[] = []
    if (search) {
      searchCondition = ` AND (lower(coalesce(name,'')) LIKE ? OR lower(coalesce(email,'')) LIKE ?)`
      searchConditionParams.push(`%${search}%`, `%${search}%`)
    }

    const whereClause = `WHERE tenantId = ? AND (status IS NULL OR status != 'inactive')${roleCondition}${searchCondition}`
    const whereParams: string[] = [tenantId, ...roleConditionParams, ...searchConditionParams]

    const [countRow, dataRows] = await Promise.all([
      c.env.APP_DB.prepare(`SELECT COUNT(*) as total FROM users ${whereClause}`)
        .bind(...whereParams).first().catch(() => ({ total: 0 })),
      c.env.APP_DB.prepare(
        `SELECT id, name, email, role, primary_role, employment_category, status, createdAt, tenantId
         FROM users ${whereClause}
         ORDER BY COALESCE(primary_role, role), name, email
         LIMIT ? OFFSET ?`
      ).bind(...whereParams, limit, offset).all().catch(() => ({ results: [] })),
    ])

    const total = Number((countRow as any)?.total || 0)
    const pageRows = (dataRows.results || []) as Record<string, any>[]

    // Light hydration: one bulk settings query, then pure-function mapping — zero per-row DB calls.
    // Full hydrateUserRecords is avoided here because it calls ensureStudentPublicId,
    // resolveSettingsIdentity, and generateDisplayId for every row, causing Worker CPU timeouts.
    const settingsMap = await getSettingsMapForUserRows(c.env.APP_DB, pageRows)
    const people = pageRows.filter(Boolean).map(row => {
      const emailKey = String(row.email || '').trim()
      const idKey = String(row.id || '').trim()
      const settings = settingsMap.get(emailKey) || settingsMap.get(idKey) || null
      const roleContext = buildRoleContext(settings || {}, row.role)
      const profile = buildAdmissionProfileRecord(settings || {}, row)
      const publicDisplayId = getPublicFacingUserId(settings || {}, roleContext.primaryRole)
      return {
        ...row,
        role: roleContext.primaryRole,
        primaryRole: roleContext.primaryRole,
        roles: roleContext.rawRoles,
        switchableRoles: roleContext.switchableRoles,
        adminRoles: roleContext.adminRoles,
        displayId: publicDisplayId || String(settings?.displayId || '').trim() || null,
        publicStudentId: String(settings?.publicStudentId || '').trim() || null,
        employmentCategory: deriveEmploymentCategory(roleContext.primaryRole, settings?.employmentCategory, roleContext.rawRoles),
        phone: profile.phone || null,
        classId: settings?.classId || null,
        className: settings?.className || null,
        avatar: profile.avatar || null,
        avatarUrl: profile.avatar || null,
        mustChangePassword: settings?.mustChangePassword === true,
      }
    })

    return c.json({
      success: true,
      people,
      pagination: { page, limit, total, hasMore: offset + people.length < total },
    })
  } catch (error) {
    console.error('Failed to load people', error)
    return c.json({ success: false, people: [], pagination: { page: 1, limit: BATCH_LIMIT_DEFAULT, total: 0, hasMore: false } })
  }
})

// Approval requests placeholder (uses audit log as base)
app.get('/api/approvals', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ success: true, approvals: [] })
  try {
    const rows = await c.env.APP_DB.prepare(
      `SELECT * FROM audit_log WHERE tenantId = ? AND action LIKE '%request%' ORDER BY createdAt DESC LIMIT 50`
    ).bind(tenantId).all()
    return c.json({ success: true, approvals: rows.results || [] })
  } catch {
    return c.json({ success: true, approvals: [] })
  }
})

// Attendance
app.get('/api/attendance', authenticate, async (c) => {
  const { studentId, limit } = c.req.query()
  if (!studentId) return c.json({ success: false, error: 'Missing studentId' }, 400)
  try {
    const records = await getAttendance(c.env.APP_DB, studentId as string, Number(limit) || 365)
    return c.json({ success: true, records })
  } catch (err) {
    return c.json({ success: false, error: 'Could not fetch attendance' }, 500)
  }
})

app.post('/api/attendance', authenticate, async (c) => {
  const { studentId, date, status, reason, recordedBy } = await c.req.json()
  if (!studentId || !date || !status) return c.json({ success: false, error: 'Missing fields' }, 400)
  try {
    const result = await upsertAttendance(c.env.APP_DB, studentId, date, status, reason, recordedBy)
    return c.json({ success: true, ...result })
  } catch (err) {
    return c.json({ success: false, error: 'Could not save attendance' }, 500)
  }
})

app.put('/api/attendance/:id', authenticate, async (c) => {
  const { id } = c.req.param()
  const { status, reason } = await c.req.json()
  try {
    await updateAttendance(c.env.APP_DB, id, status, reason)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: 'Could not update attendance' }, 500)
  }
})

// Conversations
app.post('/api/public/website-enquiries', async (c) => {
  try {
    const payload = await c.req.json().catch(async () => {
      const formData = await c.req.formData()
      return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value || '')]))
    }) as Record<string, any>

    const tenantId = String(payload?.tenantId || '').trim()
    const name = String(payload?.name || '').trim()
    const email = String(payload?.email || '').trim().toLowerCase()
    const phone = String(payload?.phone || '').trim()
    const subject = String(payload?.subject || '').trim()
    const body = String(payload?.message || '').trim()
    const sourcePage = String(payload?.sourcePage || '/contact').trim() || '/contact'

    if (!tenantId || !name || !email || !body) {
      return c.json({ success: false, message: 'tenantId, name, email, and message are required.' }, 400)
    }

    const tenant = await getTenantById(c.env.APP_DB, tenantId)
    if (!tenant) {
      return c.json({ success: false, message: 'School not found.' }, 404)
    }

    await ensureWebsiteEnquiriesTable(c.env.APP_DB)

    const enquiryId = `website_enquiry_${tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const enquiryTimestamp = new Date().toISOString()

    await c.env.APP_DB.prepare(
      `INSERT INTO website_enquiries (id, tenant_id, visitor_name, visitor_email, visitor_phone, subject, message, source_page, status, review_notes, outcome_reason, linked_application_id, reviewed_by, reviewed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', NULL, NULL, NULL, NULL, NULL, ?, ?)`
    ).bind(
      enquiryId,
      tenantId,
      name,
      email,
      phone || null,
      subject || null,
      body,
      sourcePage,
      enquiryTimestamp,
      enquiryTimestamp,
    ).run()

    const recipients = await listTenantConversationRecipients(c.env.APP_DB, tenantId, ['owner', 'hos'])
    if (recipients.length === 0) {
      return c.json({ success: false, message: 'No owner or HoS inbox is available for this school yet.' }, 503)
    }

    const visitorId = email
    const participants = Array.from(new Set([...recipients, visitorId]))
    const comparableParticipants = collectComparableIdentifiers(participants)
    const existingConversation = (await getConversations(c.env.APP_DB))
      .find(conversation => conversationMatchesParticipantSet(conversation, comparableParticipants))

    const conversationSubject = subject || `Website enquiry from ${name}`
    const conversation = existingConversation || await createConversation(c.env.APP_DB, conversationSubject, participants)
    const message = await sendMessage(c.env.APP_DB, conversation.id, visitorId, body, {
      source: 'website_contact',
      tenantId,
      schoolName: tenant.schoolName || '',
      visitorName: name,
      visitorEmail: email,
      visitorPhone: phone,
      sourcePage,
      subject: conversationSubject,
    })

    await addAudit(c.env.APP_DB, tenantId, {
      action: 'websiteEnquirySubmitted',
      data: {
        enquiryId,
        visitorName: name,
        visitorEmail: email,
        sourcePage,
      },
    }).catch(() => null)

    return c.json({ success: true, conversationId: conversation.id, messageId: message.id })
  } catch (error) {
    return c.json({ success: false, message: 'Could not submit website enquiry.', error }, 500)
  }
})

app.get('/api/conversations', authenticate, async (c) => {
  const { userId } = c.req.query()
  try {
    const actor = await resolveConversationActorContext(c.env.APP_DB, c.var.user || {}, String(userId || ''))
    const conversations = (await getConversations(c.env.APP_DB))
      .filter(conversation => conversationMatchesComparableIdentifiers(conversation, actor.comparableIdentifiers))
    return c.json({ success: true, conversations })
  } catch (err) {
    return c.json({ success: false, error: 'Could not fetch conversations' }, 500)
  }
})

app.post('/api/public/admissions', async (c) => {
  try {
    const payload = await c.req.json().catch(async () => {
      const formData = await c.req.formData()
      return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value || '')]))
    }) as Record<string, any>

    const tenantId = String(payload?.tenantId || '').trim()
    const studentName = String(payload?.studentName || '').trim()
    const parentName = String(payload?.parentName || '').trim()
    const parentEmail = String(payload?.parentEmail || '').trim().toLowerCase()
    const parentPhone = String(payload?.parentPhone || '').trim()
    const desiredClass = String(payload?.desiredClass || '').trim()

    if (!tenantId || !studentName || !parentName || !parentEmail || !desiredClass) {
      return c.json({ success: false, message: 'tenantId, studentName, parentName, parentEmail, and desiredClass are required.' }, 400)
    }

    const tenant = await getTenantById(c.env.APP_DB, tenantId)
    if (!tenant) {
      return c.json({ success: false, message: 'School not found.' }, 404)
    }

    await ensureAdmissionApplicationsTable(c.env.APP_DB)

    const applicationPayload = {
      student: {
        name: studentName,
        gender: String(payload?.gender || '').trim(),
        dateOfBirth: String(payload?.dateOfBirth || '').trim(),
        desiredClass,
      },
      academic: {
        previousSchool: String(payload?.previousSchool || '').trim(),
        strengths: String(payload?.strengths || '').trim(),
      },
      parent: {
        name: parentName,
        email: parentEmail,
        phone: parentPhone,
        relationship: String(payload?.relationship || '').trim(),
        address: String(payload?.address || '').trim(),
      },
      medical: {
        allergies: String(payload?.allergies || '').trim(),
        conditions: String(payload?.conditions || '').trim(),
        notes: String(payload?.medicalNotes || '').trim(),
      },
      sen: {
        needs: String(payload?.senNeeds || '').trim(),
        talents: String(payload?.talents || '').trim(),
      },
      transport: {
        required: String(payload?.transportRequired || '').trim().toLowerCase() === 'yes',
        area: String(payload?.transportArea || '').trim(),
      },
      hostel: {
        required: String(payload?.hostelRequired || '').trim().toLowerCase() === 'yes',
        notes: String(payload?.hostelNotes || '').trim(),
      },
      clinic: {
        followUpRequired: Boolean(String(payload?.allergies || '').trim() || String(payload?.conditions || '').trim() || String(payload?.medicalNotes || '').trim()),
      },
      payment: {
        registrationPlan: String(payload?.registrationPlan || '').trim(),
      },
      exam: {
        preferredDate: String(payload?.examDate || '').trim(),
      },
      sourcePage: String(payload?.sourcePage || '/admissions').trim() || '/admissions',
    }
    const serviceFlags = buildAdmissionServiceFlags(applicationPayload)
    const now = new Date().toISOString()
    const applicationId = `adm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    await c.env.APP_DB.prepare(
      'INSERT INTO admission_applications(id, tenant_id, applicant_name, applicant_email, applicant_phone, desired_class, status, payload, service_flags, review_notes, reviewed_by, reviewed_at, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      applicationId,
      tenantId,
      studentName,
      parentEmail,
      parentPhone || null,
      desiredClass,
      'pending',
      JSON.stringify(applicationPayload),
      JSON.stringify(serviceFlags),
      null,
      null,
      null,
      now,
      now,
    ).run()

    await addAudit(c.env.APP_DB, tenantId, {
      action: 'admissionApplicationSubmitted',
      data: {
        applicationId,
        applicantName: parentName,
        applicantEmail: parentEmail,
        studentName,
        desiredClass,
      },
    }).catch(() => null)

    const recipients = await listTenantConversationRecipients(c.env.APP_DB, tenantId, ['owner', 'hos'])
    if (recipients.length > 0) {
      const participants = Array.from(new Set([...recipients, parentEmail]))
      const comparableParticipants = collectComparableIdentifiers(participants)
      const existingConversation = (await getConversations(c.env.APP_DB))
        .find(conversation => conversationMatchesParticipantSet(conversation, comparableParticipants))
      const conversation = existingConversation || await createConversation(c.env.APP_DB, `Admission application for ${studentName}`, participants)
      await sendMessage(c.env.APP_DB, conversation.id, parentEmail, `New admission application submitted for ${studentName}. Preferred class: ${desiredClass}.`, {
        source: 'admission_application',
        tenantId,
        applicationId,
        parentName,
        parentEmail,
        parentPhone,
        desiredClass,
        serviceFlags,
      })
    }

    return c.json({ success: true, applicationId })
  } catch (error) {
    return c.json({ success: false, message: 'Could not submit admission application.', error }, 500)
  }
})

app.get('/receipt-verification/:receiptNo', async (c) => {
  try {
    const receiptNo = String(c.req.param('receiptNo') || '').trim()
    const payload = await resolvePublicFeeReceiptVerification(c.env.APP_DB, receiptNo)
    const statusCode = payload.verified ? 200 : receiptNo ? 404 : 400
    return c.html(
      renderPublicFeeReceiptVerificationHtml({
        verified: payload.verified,
        receiptNo,
        message: payload.message,
        receipt: payload.receipt,
      }),
      statusCode,
    )
  } catch {
    return c.html(
      renderPublicFeeReceiptVerificationHtml({
        verified: false,
        message: 'Could not verify this receipt right now.',
      }),
      500,
    )
  }
})

app.get('/result-verification/:publicationId', async (c) => {
  try {
    const publicationId = String(c.req.param('publicationId') || '').trim()
    const payload = await resolvePublicResultVerification(c.env.APP_DB, publicationId, new URL(c.req.url).origin)
    const statusCode = payload.verified ? 200 : publicationId ? 404 : 400
    return c.html(
      renderPublicResultVerificationHtml({
        verified: payload.verified,
        publicationId,
        message: payload.message,
        result: payload.result,
      }),
      statusCode,
    )
  } catch {
    return c.html(
      renderPublicResultVerificationHtml({
        verified: false,
        message: 'Could not verify this result right now.',
      }),
      500,
    )
  }
})

app.get('/api/public/fees-receipts/:receiptNo', async (c) => {
  try {
    const receiptNo = String(c.req.param('receiptNo') || '').trim()
    const payload = await resolvePublicFeeReceiptVerification(c.env.APP_DB, receiptNo)
    const statusCode = payload.verified ? 200 : receiptNo ? 404 : 400

    if (requestPrefersHtml(c)) {
      return c.html(
        renderPublicFeeReceiptVerificationHtml({
          verified: payload.verified,
          receiptNo,
          message: payload.message,
          receipt: payload.receipt,
        }),
        statusCode,
      )
    }

    return c.json(payload, statusCode)
  } catch (error) {
    if (requestPrefersHtml(c)) {
      return c.html(
        renderPublicFeeReceiptVerificationHtml({
          verified: false,
          message: 'Could not verify this receipt right now.',
        }),
        500,
      )
    }

    return c.json({ success: false, verified: false, message: 'Could not verify receipt.', error }, 500)
  }
})

// ─── Public school-news engagement (views, reactions, comments on the website) ──
async function loadPublishedWebsitePost(env: Bindings, tenantId: string, postId: string) {
  const post = await getSchoolNewsPostById(env.APP_DB, tenantId, postId)
  if (!post || post.status !== 'published') return null
  return post
}

app.get('/api/public/news/:tenantId/:postId/engagement', async (c) => {
  try {
    const tenantId = String(c.req.param('tenantId') || '').trim()
    const postId = String(c.req.param('postId') || '').trim()
    const post = await loadPublishedWebsitePost(c.env, tenantId, postId)
    if (!post) return c.json({ success: false, error: 'not found' }, 404)
    const engagement = await getSchoolNewsEngagement(c.env.APP_DB, tenantId, postId)
    return c.json({ success: true, ...engagement })
  } catch {
    return c.json({ success: true, views: 0, reactions: {}, comments: [] })
  }
})

app.post('/api/public/news/:tenantId/:postId/:action', async (c) => {
  try {
    const tenantId = String(c.req.param('tenantId') || '').trim()
    const postId = String(c.req.param('postId') || '').trim()
    const action = String(c.req.param('action') || '').trim()
    const post = await loadPublishedWebsitePost(c.env, tenantId, postId)
    if (!post) return c.json({ success: false, error: 'not found' }, 404)

    const body = await c.req.json().catch(() => ({}))
    if (action === 'view') {
      const engagement = await recordSchoolNewsEngagement(c.env.APP_DB, { tenantId, postId, kind: 'view' })
      return c.json({ success: true, ...engagement })
    }
    if (action === 'react') {
      const reaction = String(body?.reaction || '👍').slice(0, 16)
      const engagement = await recordSchoolNewsEngagement(c.env.APP_DB, { tenantId, postId, kind: 'reaction', reaction })
      return c.json({ success: true, ...engagement })
    }
    if (action === 'comment') {
      const text = String(body?.body || '').trim()
      if (!text) return c.json({ success: false, error: 'Comment required.' }, 400)
      const engagement = await recordSchoolNewsEngagement(c.env.APP_DB, {
        tenantId,
        postId,
        kind: 'comment',
        authorName: String(body?.authorName || 'Reader').slice(0, 120),
        body: text,
      })
      return c.json({ success: true, ...engagement })
    }
    return c.json({ success: false, error: 'Unsupported action.' }, 400)
  } catch {
    return c.json({ success: false, error: 'Could not record engagement.' }, 500)
  }
})

app.get('/api/public/results/:publicationId', async (c) => {
  try {
    const publicationId = String(c.req.param('publicationId') || '').trim()
    const payload = await resolvePublicResultVerification(c.env.APP_DB, publicationId, new URL(c.req.url).origin)
    const statusCode = payload.verified ? 200 : publicationId ? 404 : 400

    if (requestPrefersHtml(c)) {
      return c.html(
        renderPublicResultVerificationHtml({
          verified: payload.verified,
          publicationId,
          message: payload.message,
          result: payload.result,
        }),
        statusCode,
      )
    }

    return c.json(payload, statusCode)
  } catch (error) {
    if (requestPrefersHtml(c)) {
      return c.html(
        renderPublicResultVerificationHtml({
          verified: false,
          message: 'Could not verify this result right now.',
        }),
        500,
      )
    }

    return c.json({ success: false, verified: false, message: 'Could not verify result.', error }, 500)
  }
})

app.get('/api/school/admissions', authenticate, async (c) => {
  try {
    const user = c.var.user || {}
    const userIdentifier = user.id || user.email || user.sub || ''
    const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    const tenantId = String(resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId || '').trim()
    const role = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()
    const requestedChannel = String(c.req.query('channel') || '').trim().toLowerCase()
    const requestedStatus = normalizeAdmissionStatus(c.req.query('status'), '')

    const allowedRoles = new Set(['owner', 'hos', 'admin', 'ict', 'ict_manager', 'ami', 'transport', 'hostel', 'clinic'])
    if (!tenantId || !allowedRoles.has(role)) {
      return c.json({ success: false, message: 'forbidden' }, 403)
    }

    await ensureAdmissionApplicationsTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      'SELECT * FROM admission_applications WHERE tenant_id = ? ORDER BY created_at DESC'
    ).bind(tenantId).all()

    const effectiveChannel = ['transport', 'hostel', 'clinic'].includes(role) ? role : requestedChannel
    let applications = ((rows.results || []) as Record<string, any>[]).map(mapAdmissionApplicationRow)

    if (requestedStatus) {
      applications = applications.filter(application => application.status === requestedStatus)
    }

    if (effectiveChannel) {
      applications = applications.filter(application => Boolean(application.serviceFlags?.[effectiveChannel]))
    }

    return c.json({ success: true, applications })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load admissions.', error }, 500)
  }
})

app.post('/api/school/admissions/:applicationId/review', authenticate, async (c) => {
  try {
    const applicationId = c.req.param('applicationId')
    const body = await c.req.json()
    const user = c.var.user || {}
    const userIdentifier = user.id || user.email || user.sub || ''
    const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    const tenantId = String(resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId || '').trim()
    const role = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()

    if (!tenantId || !['owner', 'hos', 'admin', 'ict', 'ict_manager', 'ami'].includes(role)) {
      return c.json({ success: false, message: 'forbidden' }, 403)
    }

    await ensureAdmissionApplicationsTable(c.env.APP_DB)
    const existing = await c.env.APP_DB.prepare(
      'SELECT * FROM admission_applications WHERE id = ? AND tenant_id = ? LIMIT 1'
    ).bind(applicationId, tenantId).first() as Record<string, any> | null

    if (!existing) {
      return c.json({ success: false, message: 'Admission application not found.' }, 404)
    }

    const reviewedAt = new Date().toISOString()
    const status = normalizeAdmissionStatus(body?.status, existing.status)
    const reviewNotes = String(body?.reviewNotes || '').trim()
    const reviewedBy = String(resolvedUser.settings?.name || resolvedUser.userRow?.name || user.name || userIdentifier || role).trim()

    await c.env.APP_DB.prepare(
      'UPDATE admission_applications SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?'
    ).bind(status, reviewNotes || null, reviewedBy || null, reviewedAt, reviewedAt, applicationId, tenantId).run()

    await syncWebsiteEnquiriesForApplication(c.env.APP_DB, tenantId, existing, status, reviewNotes, reviewedBy, reviewedAt).catch(() => null)

    await addAudit(c.env.APP_DB, tenantId, {
      action: 'admissionApplicationReviewed',
      data: {
        applicationId,
        status,
        reviewedBy,
      },
    }).catch(() => null)

    const updated = await c.env.APP_DB.prepare(
      'SELECT * FROM admission_applications WHERE id = ? AND tenant_id = ? LIMIT 1'
    ).bind(applicationId, tenantId).first() as Record<string, any> | null

    return c.json({ success: true, application: updated ? mapAdmissionApplicationRow(updated) : null })
  } catch (error) {
    return c.json({ success: false, message: 'Could not review admission application.', error }, 500)
  }
})

app.get('/api/school/enquiries', authenticate, async (c) => {
  try {
    const user = c.var.user || {}
    const userIdentifier = user.id || user.email || user.sub || ''
    const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    const tenantId = String(resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId || '').trim()
    const role = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()
    const requestedStatus = normalizeWebsiteEnquiryStatus(c.req.query('status'), '')

    if (!tenantId || !['owner', 'hos', 'admin', 'ict', 'ict_manager', 'ami'].includes(role)) {
      return c.json({ success: false, message: 'forbidden' }, 403)
    }

    await ensureWebsiteEnquiriesTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      'SELECT * FROM website_enquiries WHERE tenant_id = ? ORDER BY created_at DESC'
    ).bind(tenantId).all()

    let enquiries = ((rows.results || []) as Record<string, any>[]).map(mapWebsiteEnquiryRow)
    if (requestedStatus) {
      enquiries = enquiries.filter(enquiry => enquiry.status === requestedStatus)
    }

    return c.json({ success: true, enquiries })
  } catch (error) {
    return c.json({ success: false, message: 'Could not load website enquiries.', error }, 500)
  }
})

app.post('/api/school/enquiries/:enquiryId/review', authenticate, async (c) => {
  try {
    const enquiryId = c.req.param('enquiryId')
    const body = await c.req.json()
    const user = c.var.user || {}
    const userIdentifier = user.id || user.email || user.sub || ''
    const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    const tenantId = String(resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId || '').trim()
    const role = String(resolvedUser.settings?.role || resolvedUser.userRow?.role || user.role || '').trim().toLowerCase()

    if (!tenantId || !['owner', 'hos', 'admin', 'ict', 'ict_manager', 'ami'].includes(role)) {
      return c.json({ success: false, message: 'forbidden' }, 403)
    }

    await ensureWebsiteEnquiriesTable(c.env.APP_DB)
    const existing = await c.env.APP_DB.prepare(
      'SELECT * FROM website_enquiries WHERE id = ? AND tenant_id = ? LIMIT 1'
    ).bind(enquiryId, tenantId).first() as Record<string, any> | null

    if (!existing) {
      return c.json({ success: false, message: 'Website enquiry not found.' }, 404)
    }

    const reviewedAt = new Date().toISOString()
    const status = normalizeWebsiteEnquiryStatus(body?.status, existing.status)
    const reviewNotes = String(body?.reviewNotes || '').trim()
    const outcomeReason = String(body?.outcomeReason || '').trim()
    const linkedApplicationId = String(body?.linkedApplicationId || existing.linked_application_id || '').trim()
    const reviewedBy = String(resolvedUser.settings?.name || resolvedUser.userRow?.name || user.name || userIdentifier || role).trim()

    await c.env.APP_DB.prepare(
      'UPDATE website_enquiries SET status = ?, review_notes = ?, outcome_reason = ?, linked_application_id = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?'
    ).bind(
      status,
      reviewNotes || null,
      outcomeReason || null,
      linkedApplicationId || null,
      reviewedBy || null,
      reviewedAt,
      reviewedAt,
      enquiryId,
      tenantId,
    ).run()

    await addAudit(c.env.APP_DB, tenantId, {
      action: 'websiteEnquiryReviewed',
      data: {
        enquiryId,
        status,
        linkedApplicationId: linkedApplicationId || null,
        reviewedBy,
      },
    }).catch(() => null)

    const updated = await c.env.APP_DB.prepare(
      'SELECT * FROM website_enquiries WHERE id = ? AND tenant_id = ? LIMIT 1'
    ).bind(enquiryId, tenantId).first() as Record<string, any> | null

    return c.json({ success: true, enquiry: updated ? mapWebsiteEnquiryRow(updated) : null })
  } catch (error) {
    return c.json({ success: false, message: 'Could not review website enquiry.', error }, 500)
  }
})


app.post('/api/conversations', authenticate, async (c) => {
  const { subject, participants } = await c.req.json()
  try {
    const actor = await resolveConversationActorContext(c.env.APP_DB, c.var.user || {})
    const participantCandidates = Array.isArray(participants) ? participants : []
    const normalizedParticipants = Array.from(new Set((await Promise.all(
      [...participantCandidates, actor.canonicalUserId]
        .map(participant => resolveCanonicalUserIdentifier(c.env.APP_DB, participant).catch(() => String(participant || '').trim() || null))
    )).filter(Boolean) as string[]))

    if (normalizedParticipants.length === 0) {
      return c.json({ success: false, error: 'Missing participants' }, 400)
    }

    const comparableParticipants = collectComparableIdentifiers(normalizedParticipants)
    const existingConversation = (await getConversations(c.env.APP_DB))
      .find(conversation => conversationMatchesParticipantSet(conversation, comparableParticipants))

    const conversation = existingConversation || await createConversation(c.env.APP_DB, subject, normalizedParticipants)
    return c.json({ success: true, conversation })
  } catch (err) {
    return c.json({ success: false, error: err.message }, 400)
  }
})

app.get('/api/conversations/:id/messages', authenticate, async (c) => {
  const { id } = c.req.param()
  try {
    const messages = await getMessages(c.env.APP_DB, id)
    return c.json({ success: true, messages })
  } catch (err) {
    return c.json({ success: false, error: 'Could not fetch messages' }, 500)
  }
})

app.post('/api/conversations/:id/messages', authenticate, async (c) => {
  const { id } = c.req.param()
  const { senderId, body, metadata } = await c.req.json()
  if (!body) return c.json({ success: false, error: 'Missing body' }, 400)
  try {
    const actor = await resolveConversationActorContext(c.env.APP_DB, c.var.user || {}, String(senderId || ''))
    const normalizedSenderId = actor.canonicalUserId || String(senderId || '').trim()
    if (!normalizedSenderId) return c.json({ success: false, error: 'Missing senderId or body' }, 400)

    const message = await sendMessage(c.env.APP_DB, id, normalizedSenderId, body, metadata)
    return c.json({ success: true, message })
  } catch (err) {
    return c.json({ success: false, error: err.message }, 403)
  }
})

app.post('/api/conversations/:id/mark-read', authenticate, async (c) => {
  const { id } = c.req.param()
  try {
    const currentUser = c.var.user || {}
    const userIdentifier = currentUser.id || currentUser.email || currentUser.sub || ''
    const resolvedReader = userIdentifier ? await resolveSettingsIdentity(c.env.APP_DB, userIdentifier) : { settingsKey: '', settings: null, userRow: null }
    const readerIdentifiers = collectResolvedIdentityIdentifiers(resolvedReader, currentUser)
    const canonicalReaderId = String(await resolveCanonicalUserIdentifier(c.env.APP_DB, userIdentifier).catch(() => null) || readerIdentifiers[0] || userIdentifier).trim()
    await markMessagesRead(c.env.APP_DB, id, canonicalReaderId, readerIdentifiers)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: 'Could not mark read' }, 500)
  }
})

// Tuck orders
app.get('/api/tuck/orders', authenticate, async (c) => {
  const { placedBy } = c.req.query()
  try {
    const orders = await getTuckOrders(c.env.APP_DB, placedBy as string)
    return c.json({ success: true, orders })
  } catch (err) {
    return c.json({ success: false, error: 'Could not fetch orders' }, 500)
  }
})

app.post('/api/tuck/orders', authenticate, async (c) => {
  const order = await c.req.json()
  if (!order) return c.json({ success: false, error: 'Invalid order payload' }, 400)
  try {
    const created = await createTuckOrder(c.env.APP_DB, order)
    return c.json({ success: true, order: created })
  } catch (err) {
    return c.json({ success: false, error: 'Could not persist order' }, 500)
  }
})

app.put('/api/tuck/orders/:id', authenticate, async (c) => {
  const { id } = c.req.param()
  const changes = await c.req.json()
  try {
    await updateTuckOrder(c.env.APP_DB, id, changes)
    return c.json({ success: true })
  } catch (err) {
    return c.json({ success: false, error: err.message }, 400)
  }
})

app.get('/api/tuck/orders/weekly', authenticate, async (c) => {
  const { placedBy, weeks } = c.req.query()
  try {
    const weeksData = await getWeeklyTuckSummary(c.env.APP_DB, placedBy as string, Number(weeks) || 12)
    return c.json({ success: true, weeks: weeksData })
  } catch (err) {
    return c.json({ success: false, error: 'Could not compute weekly summary' }, 500)
  }
})

app.get('/api/owner/schools', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'ami'])) return c.json({ error: 'forbidden' }, 403)
  const actorId = c.var.user.id || c.var.user.sub || c.var.user.email
  try {
    const rows = await c.env.APP_DB.prepare(
      `SELECT id, school_name as schoolName, requested_subdomain as subdomain, status, student_count as studentCount, owner_email as ownerEmail, plan_key as planKey, created_at as createdAt FROM tenants WHERE owner_email = ? ORDER BY created_at DESC`
    ).bind(actorId).all()
    return c.json({ success: true, schools: rows.results || [] })
  } catch (err) {
    return c.json({ success: true, schools: [] })
  }
})

app.post('/api/people', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { name, email, role, password, parentData, classId } = await c.req.json()
  if (!name || !email || !role) return c.json({ error: 'name, email, and role are required.' }, 400)
  const normalizedRole = normalizeRole(role)

  let selectedClass: Record<string, any> | null = null
  if (normalizedRole === 'student') {
    await ensureClassesTable(c.env.APP_DB)
    if (!classId) return c.json({ error: 'Students must be assigned to a class. Create or select a class first.' }, 400)
    selectedClass = await c.env.APP_DB.prepare(
      `SELECT id, name, arm FROM classes WHERE id = ? AND tenantId = ?`
    ).bind(classId, tenantId).first() as Record<string, any> | null
    if (!selectedClass) return c.json({ error: 'Selected class was not found for this school.' }, 404)
  }

  if (normalizedRole === 'owner') return c.json({ error: 'Owner role can only be assigned during school setup or ownership transfer.' }, 400)

  const userId = createUserId()
  const defaultPassword = password || 'abcABC@123'
  const existingSettings = await getSettings(c.env.APP_DB, email).catch(() => null)
  const mergedRoles = parseRoleList(existingSettings?.role, existingSettings?.roles, normalizedRole)
  const primaryRole = getPrimaryRole(existingSettings || {}, mergedRoles[0] || normalizedRole) || normalizedRole
  const displayId = existingSettings?.displayId || await generateDisplayId(c.env.APP_DB, getDisplayIdConfig(primaryRole))

  try {
    await assertTenantOwnerAssignmentAllowed(c.env.APP_DB, tenantId, [primaryRole, mergedRoles])
    await ensureUsersTable(c.env.APP_DB)
    const userSettings = await withHashedPassword({
      ...(existingSettings || {}),
      email,
      name,
      role: primaryRole,
      primaryRole,
      roles: mergedRoles,
      tenantId,
      schoolId: tenantId,
      status: 'active',
      mustChangePassword: true,
      initialPassword: defaultPassword, // plain-text fallback for first-login; cleared on password change
      displayId,
      employmentCategory: deriveEmploymentCategory(primaryRole, existingSettings?.employmentCategory, mergedRoles),
      ...(classId ? { classId, className: selectedClass?.name || null, classArm: selectedClass?.arm || null } : {}),
    }, defaultPassword)
    await c.env.APP_DB.prepare(
      `INSERT INTO users (id, email, name, role, primary_role, employment_category, tenantId, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role, primary_role=excluded.primary_role, employment_category=excluded.employment_category, tenantId=excluded.tenantId, status='active'`
    ).bind(userId, email, name, primaryRole, primaryRole, deriveEmploymentCategory(primaryRole, userSettings.employmentCategory, mergedRoles), tenantId, 'active', new Date().toISOString()).run()

    const saved = await c.env.APP_DB.prepare(
      `SELECT id, email, name, role, primary_role, employment_category, status, createdAt, tenantId FROM users WHERE email = ?`
    ).bind(email).first() as Record<string, any> | null
    const actualUserId = saved?.id || userId
    const nextSettings = await ensureStudentPublicId(c.env.APP_DB, {
      tenantId,
      userId: actualUserId,
      settingsKey: email,
      settings: userSettings,
    }) || userSettings
    await upsertSettings(c.env.APP_DB, email, nextSettings)
    await syncUserRoleRecords(c.env.APP_DB, {
      tenantId,
      userId: actualUserId,
      primaryRole,
      roles: mergedRoles,
    })
    await addAudit(c.env.APP_DB, tenantId, { action: 'personCreated', data: { by: c.var.user.id, name, email, role: normalizedRole, roles: mergedRoles, displayId: getPublicFacingUserId(nextSettings, primaryRole), classId: classId || null } })

    if (normalizedRole === 'student' && parentData) {
      await ensureParentStudentLinksTable(c.env.APP_DB)

      let parentId: string | null = null

      if (parentData.existingParentId) {
        const existingParent = await c.env.APP_DB.prepare(
          `SELECT id, name, email, role, primary_role, employment_category, status, createdAt, tenantId FROM users WHERE id = ? AND tenantId = ?`
        ).bind(String(parentData.existingParentId), tenantId).first() as Record<string, any> | null
        const hydratedParent = await hydrateUserRecord(c.env.APP_DB, existingParent)
        parentId = parseRoleList(hydratedParent?.primaryRole, hydratedParent?.role, hydratedParent?.roles).includes('parent')
          ? String(hydratedParent?.id || '')
          : null
      } else if (parentData.name || parentData.email) {
        const parentEmail = parentData.email || `parent_${Date.now()}@ndovera.local`
        const parentName = parentData.name || 'Parent'
        const parentUserId = createUserId()
        const existingParentSettings = await getSettings(c.env.APP_DB, parentEmail).catch(() => null)
        const parentDisplayId = existingParentSettings?.displayId || await generateDisplayId(c.env.APP_DB, getDisplayIdConfig('parent'))
        const parentSettings = await withHashedPassword({
          ...(existingParentSettings || {}),
          email: parentEmail,
          name: parentName,
          role: 'parent',
          primaryRole: 'parent',
          tenantId,
          schoolId: tenantId,
          status: 'active',
          mustChangePassword: true,
          displayId: parentDisplayId,
          phone: parentData.phone || null,
          employmentCategory: deriveEmploymentCategory('parent'),
        }, 'abcABC@123')
        await c.env.APP_DB.prepare(
          `INSERT INTO users (id, email, name, role, primary_role, employment_category, tenantId, status, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role, primary_role=excluded.primary_role, employment_category=excluded.employment_category, tenantId=excluded.tenantId, status='active'`
        ).bind(parentUserId, parentEmail, parentName, 'parent', 'parent', deriveEmploymentCategory('parent'), tenantId, 'active', new Date().toISOString()).run()
        await upsertSettings(c.env.APP_DB, parentEmail, parentSettings)
        const savedParent = await c.env.APP_DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(parentEmail).first() as any
        parentId = savedParent?.id || parentUserId
        await syncUserRoleRecords(c.env.APP_DB, {
          tenantId,
          userId: parentId,
          primaryRole: 'parent',
          roles: ['parent'],
        })
      }

      if (parentId) {
        const linkId = `link_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        await c.env.APP_DB.prepare(
          `INSERT OR IGNORE INTO parent_student_links (id, parent_id, student_id, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(linkId, parentId, actualUserId, tenantId, new Date().toISOString()).run()
      }
    }

    const hydratedSaved = await hydrateUserRecord(c.env.APP_DB, saved || { id: userId, email, name, role: primaryRole, status: 'active' })
    return c.json({ success: true, user: hydratedSaved }, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not create person.' }, 500)
  }
})

// ─── Bulk people import ───────────────────────────────────────────────────────
app.post('/api/people/bulk', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  let rows: Array<{ name?: string; email?: string; role?: string; roles?: string[] | string; password?: string; className?: string; classId?: string }> = []
  try {
    const body = await c.req.json()
    rows = Array.isArray(body?.rows) ? body.rows : []
  } catch {
    return c.json({ error: 'Invalid request body.' }, 400)
  }

  if (!rows.length) return c.json({ error: 'No rows provided.' }, 400)
  if (rows.length > 1000) return c.json({ error: 'Maximum 1000 rows per import.' }, 400)

  await ensureUsersTable(c.env.APP_DB)
  await ensureClassesTable(c.env.APP_DB)
  await ensureClassMembershipsTable(c.env.APP_DB)

  const results: Array<{ email: string; status: 'ok' | 'error'; error?: string }> = []
  const classRows = await c.env.APP_DB.prepare(
    `SELECT id, name, arm FROM classes WHERE tenantId = ?`
  ).bind(tenantId).all().catch(() => ({ results: [] }))
  const classLookup = new Map<string, Record<string, any>>()
  for (const classRow of ((classRows.results || []) as Record<string, any>[])) {
    const classId = String(classRow.id || '').trim()
    const className = String(classRow.name || '').trim()
    const fullLabel = `${className}${classRow.arm ? ` ${classRow.arm}` : ''}`.trim()
    if (classId) classLookup.set(`id:${classId.toLowerCase()}`, classRow)
    if (className) classLookup.set(`name:${className.toLowerCase()}`, classRow)
    if (fullLabel) classLookup.set(`name:${fullLabel.toLowerCase()}`, classRow)
  }

  for (const row of rows) {
    const { name, email, role, roles, password, className, classId } = row
    if (!name || !email || !role) {
      results.push({ email: email || '?', status: 'error', error: 'name, email, and role are required.' })
      continue
    }
    try {
      const userId = createUserId()
      const defaultPassword = password || 'abcABC@123'
      const normalizedEmail = String(email || '').trim().toLowerCase()
      const existingSettings = await getSettings(c.env.APP_DB, normalizedEmail).catch(() => null)
      const normalizedRole = normalizeRole(role)
      if (normalizedRole === 'owner') {
        results.push({ email: normalizedEmail, status: 'error', error: 'Owner role cannot be bulk imported.' })
        continue
      }
      const mergedRoles = parseRoleList(existingSettings?.role, existingSettings?.roles, roles, normalizedRole)
      const primaryRole = getPrimaryRole(existingSettings || {}, mergedRoles[0] || normalizedRole) || normalizedRole
      const displayId = existingSettings?.displayId || await generateDisplayId(c.env.APP_DB, getDisplayIdConfig(primaryRole))

      let selectedClass: Record<string, any> | null = null
      if (normalizedRole === 'student' && (classId || className)) {
        const classIdKey = String(classId || '').trim().toLowerCase()
        const classNameKey = String(className || '').trim().toLowerCase()
        selectedClass = classLookup.get(`id:${classIdKey}`) || classLookup.get(`name:${classNameKey}`) || null
      }

      await assertTenantOwnerAssignmentAllowed(c.env.APP_DB, tenantId, [primaryRole, mergedRoles])
      const userSettings = await withHashedPassword({
        ...(existingSettings || {}),
        email: normalizedEmail,
        name,
        role: primaryRole,
        primaryRole,
        roles: mergedRoles,
        tenantId,
        schoolId: tenantId,
        status: 'active',
        mustChangePassword: true,
        displayId,
        employmentCategory: deriveEmploymentCategory(primaryRole, existingSettings?.employmentCategory, mergedRoles),
        ...(selectedClass ? { classId: selectedClass.id, className: selectedClass.name, classArm: selectedClass.arm } : {}),
      }, defaultPassword)

      await c.env.APP_DB.prepare(
        `INSERT INTO users (id, email, name, role, primary_role, employment_category, tenantId, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role, primary_role=excluded.primary_role, employment_category=excluded.employment_category, tenantId=excluded.tenantId, status='active'`
      ).bind(userId, normalizedEmail, name, primaryRole, primaryRole, deriveEmploymentCategory(primaryRole, userSettings.employmentCategory, mergedRoles), tenantId, 'active', new Date().toISOString()).run()

      const savedUser = await c.env.APP_DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(normalizedEmail).first() as Record<string, any> | null
      const actualUserId = String(savedUser?.id || userId)
      const nextSettings = await ensureStudentPublicId(c.env.APP_DB, {
        tenantId,
        userId: actualUserId,
        settingsKey: normalizedEmail,
        settings: userSettings,
      }) || userSettings
      await upsertSettings(c.env.APP_DB, normalizedEmail, nextSettings)
      await syncUserRoleRecords(c.env.APP_DB, {
        tenantId,
        userId: actualUserId,
        primaryRole,
        roles: mergedRoles,
      })
      results.push({ email: normalizedEmail, status: 'ok' })
    } catch (err) {
      results.push({ email: email || '?', status: 'error', error: err instanceof Error ? err.message : 'unknown error' })
    }
  }

  await addAudit(c.env.APP_DB, tenantId, { action: 'bulkImport', data: { by: c.var.user.id, total: rows.length, ok: results.filter(r => r.status === 'ok').length } })
  return c.json({ results })
})

app.delete('/api/people/:userId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  const userId = c.req.param('userId')
  try {
    await ensureUsersTable(c.env.APP_DB)
    const existingUser = await c.env.APP_DB.prepare(`SELECT email FROM users WHERE id = ? AND tenantId = ?`).bind(userId, tenantId).first() as any
    await c.env.APP_DB.prepare(`UPDATE users SET status='inactive' WHERE id=? AND tenantId=?`).bind(userId, tenantId).run()
    if (existingUser?.email) {
      const settings = await getSettings(c.env.APP_DB, existingUser.email).catch(() => null)
      if (settings) {
        await upsertSettings(c.env.APP_DB, existingUser.email, { ...settings, status: 'inactive' })
      }
    }
    await addAudit(c.env.APP_DB, tenantId, { action: 'personDeactivated', data: { by: c.var.user.id, userId } })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Could not deactivate person.' }, 500)
  }
})

app.put('/api/people/:userId/role', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  const userId = c.req.param('userId')
  const { role } = await c.req.json()
  if (!role) return c.json({ error: 'role is required.' }, 400)
  try {
    const existingUser = await c.env.APP_DB.prepare(`SELECT id, email, role, primary_role, employment_category FROM users WHERE id = ? AND tenantId = ?`).bind(userId, tenantId).first() as any
    const normalizedRole = normalizeRole(role)
    if (normalizedRole === 'owner') {
      return c.json({ error: 'Owner role can only be assigned during school setup or ownership transfer.' }, 400)
    }
    const settings = existingUser?.email ? await getSettings(c.env.APP_DB, existingUser.email).catch(() => null) : null
    const mergedRoles = parseRoleList(settings?.primaryRole, settings?.role, settings?.roles, normalizedRole)
    const primaryRole = getPrimaryRole(settings || existingUser || {}, mergedRoles[0] || normalizedRole) || normalizedRole
    await assertTenantOwnerAssignmentAllowed(c.env.APP_DB, tenantId, [primaryRole, mergedRoles], userId)
    const employmentCategory = deriveEmploymentCategory(primaryRole, settings?.employmentCategory || existingUser?.employment_category, mergedRoles)
    await c.env.APP_DB.prepare(`UPDATE users SET role=?, primary_role=?, employment_category=? WHERE id=? AND tenantId=?`).bind(primaryRole, primaryRole, employmentCategory, userId, tenantId).run()
    if (existingUser?.email) {
      if (settings) {
        await upsertSettings(c.env.APP_DB, existingUser.email, { ...settings, role: primaryRole, primaryRole, roles: mergedRoles, employmentCategory })
      }
    }
    await syncUserRoleRecords(c.env.APP_DB, { tenantId, userId, primaryRole, roles: mergedRoles })
    await addAudit(c.env.APP_DB, tenantId, { action: 'personRoleUpdated', data: { by: c.var.user.id, userId, role: normalizedRole, roles: mergedRoles } })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Could not update role.' }, 500)
  }
})

app.put('/api/people/:userId', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const userId = c.req.param('userId')
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const access = await resolveUserProfileAccess(c.env.APP_DB, c.var.user || {}, userId)
  if (!access.allowed) return c.json({ error: 'forbidden' }, 403)
  try {
    await ensureUsersTable(c.env.APP_DB)
    const existingUser = await findUserByIdentifier(c.env.APP_DB, userId)
    if (!existingUser || String(existingUser.tenantId || '').trim() !== tenantId) return c.json({ error: 'User not found.' }, 404)
    if (!existingUser) return c.json({ error: 'User not found.' }, 404)
    if (access.linkedStudent && normalizeRole(existingUser.role) !== 'student') {
      return c.json({ error: 'Only linked student profiles can be updated from a parent account.' }, 403)
    }

    const normalizedName = payload.name !== undefined ? sanitizeProfileText(payload.name, 160) : undefined
    if (payload.name !== undefined && !normalizedName) {
      return c.json({ error: 'Name is required.' }, 400)
    }

    if (normalizedName) {
      await c.env.APP_DB.prepare(`UPDATE users SET name = ? WHERE id = ? AND tenantId = ?`).bind(normalizedName, existingUser.id, tenantId).run()
    }
    const resolvedIdentity = await resolveSettingsIdentity(c.env.APP_DB, existingUser.email || existingUser.id)
    const settingsKey = String(resolvedIdentity.settingsKey || existingUser.email || existingUser.id || '').trim()
    const settings = resolvedIdentity.settings || {}
    const existingProfile = buildAdmissionProfileRecord(settings, { id: existingUser.id || userId, email: existingUser.email, name: normalizedName || settings?.name || existingUser.name || '' })
    const updates: Record<string, any> = {}
    const profileUpdates = mergeAdmissionProfileRecord(existingProfile, payload)

    profileUpdates.id = existingUser.id || userId
    profileUpdates.email = existingUser.email || existingProfile.email || ''
    profileUpdates.name = normalizedName || profileUpdates.name || settings?.name || existingUser.name || existingUser.email || userId

    if (normalizedName !== undefined) updates.name = normalizedName
    if (payload.phone !== undefined) updates.phone = profileUpdates.phone || null
    if (payload.dateOfBirth !== undefined) updates.dateOfBirth = profileUpdates.dateOfBirth || null
    if (payload.avatar !== undefined) {
      updates.avatar = profileUpdates.avatar || null
      updates.avatarUrl = profileUpdates.avatar || null
    }
    if (payload.gender !== undefined) updates.gender = profileUpdates.gender || null
    if (payload.address !== undefined) updates.address = profileUpdates.address || null
    if (payload.relationship !== undefined) updates.relationship = profileUpdates.relationship || null

    if (payload.classId !== undefined && access.isAdminEdit) {
      // resolve class name for classId
      try {
        await ensureClassesTable(c.env.APP_DB)
        const classId = String(payload.classId || '').trim()
        const cls = await c.env.APP_DB.prepare(`SELECT id, name, arm FROM classes WHERE id = ? AND tenantId = ?`).bind(classId, tenantId).first() as any
        updates.classId = classId || null
        updates.className = classId ? (cls ? `${cls.name}${cls.arm ? ` ${cls.arm}` : ''}` : classId) : null
      } catch {
        updates.classId = String(payload.classId || '').trim() || null
      }
    }

    updates.profile = profileUpdates

    if (Object.keys(updates).length > 0) {
      await upsertSettings(c.env.APP_DB, settingsKey, { ...settings, ...updates })
    }
    await addAudit(c.env.APP_DB, tenantId, { action: 'personUpdated', data: { by: c.var.user?.id, userId: existingUser.id || userId, fields: Object.keys(updates) } })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Could not update profile.' }, 500)
  }
})

app.post('/api/people/:userId/avatar-upload', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const userId = c.req.param('userId')
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const access = await resolveUserProfileAccess(c.env.APP_DB, c.var.user || {}, userId)
  if (!access.allowed) return c.json({ error: 'forbidden' }, 403)

  try {
    await ensureUsersTable(c.env.APP_DB)
    const existingUser = await findUserByIdentifier(c.env.APP_DB, userId)
    if (!existingUser || String(existingUser.tenantId || '').trim() !== tenantId) return c.json({ error: 'User not found.' }, 404)
    if (access.linkedStudent && normalizeRole(existingUser.role) !== 'student') {
      return c.json({ error: 'Only linked student profiles can be updated from a parent account.' }, 403)
    }

    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return c.json({ error: 'No file provided.' }, 400)
    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      return c.json({ error: 'Only image uploads are allowed.' }, 400)
    }

    const rawExtension = String(file.name || '').split('.').pop()?.toLowerCase() || 'png'
    const extension = /^[a-z0-9]+$/.test(rawExtension) ? rawExtension : 'png'
    const key = `avatars/${tenantId}/${existingUser.id}/avatar_${Date.now()}.${extension}`
    await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'image/png' } })

    const avatarUrl = `https://ndovera.com/files/${key}`
    const resolvedIdentity = await resolveSettingsIdentity(c.env.APP_DB, existingUser.email || existingUser.id)
    const settingsKey = String(resolvedIdentity.settingsKey || existingUser.email || existingUser.id || '').trim()
    const settings = resolvedIdentity.settings || {}
    const existingProfile = buildAdmissionProfileRecord(settings, {
      id: existingUser.id || userId,
      email: existingUser.email || '',
      name: existingUser.name || settings?.name || '',
    })
    const profile = mergeAdmissionProfileRecord(existingProfile, { avatar: avatarUrl })

    await upsertSettings(c.env.APP_DB, settingsKey, {
      ...settings,
      avatar: avatarUrl,
      avatarUrl,
      profile,
    })

    await addAudit(c.env.APP_DB, tenantId, {
      action: 'personAvatarUploaded',
      data: { by: c.var.user?.id, userId: existingUser.id || userId, avatarUrl },
    })

    return c.json({ success: true, avatarUrl })
  } catch {
    return c.json({ error: 'Upload failed.' }, 500)
  }
})

app.post('/api/school/parent-student-link', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'parent'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  const callerRole = c.var.user?.role
  const callerId = c.var.user?.id
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { parentId, studentId } = await c.req.json()
  if (!parentId || !studentId) return c.json({ error: 'parentId and studentId are required.' }, 400)
  // parents can only link themselves
  if (callerRole === 'parent' && callerId !== parentId) return c.json({ error: 'forbidden' }, 403)
  try {
    await ensureParentStudentLinksTable(c.env.APP_DB)
    // enforce max 2 parents per student
    const existingLinks = await c.env.APP_DB.prepare(
      `SELECT id FROM parent_student_links WHERE student_id = ? AND tenant_id = ?`
    ).bind(studentId, tenantId).all()
    // check if this parent is already linked
    const alreadyLinked = (existingLinks.results || []).length > 0 &&
      await c.env.APP_DB.prepare(
        `SELECT id FROM parent_student_links WHERE student_id = ? AND parent_id = ? AND tenant_id = ?`
      ).bind(studentId, parentId, tenantId).first()
    if (alreadyLinked) return c.json({ success: true, message: 'Already linked.' })
    if ((existingLinks.results || []).length >= 2) return c.json({ error: 'A student can have at most 2 linked parents.' }, 400)
    const linkId = `link_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    await c.env.APP_DB.prepare(
      `INSERT OR IGNORE INTO parent_student_links (id, parent_id, student_id, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(linkId, parentId, studentId, tenantId, new Date().toISOString()).run()
    return c.json({ success: true, linkId })
  } catch (err) {
    return c.json({ error: 'Could not create link.' }, 500)
  }
})

app.get('/api/people/:userId', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const userId = c.req.param('userId')
  const access = await resolveUserProfileAccess(c.env.APP_DB, c.var.user || {}, userId)
  if (!access.allowed) return c.json({ error: 'forbidden' }, 403)
  try {
    await ensureUsersTable(c.env.APP_DB)
    const user = await findUserByIdentifier(c.env.APP_DB, userId)
    if (!user || String(user.tenantId || '').trim() !== String(tenantId || '').trim()) return c.json({ error: 'User not found.' }, 404)
    const hydratedUser = await hydrateUserRecord(c.env.APP_DB, user)
    if (!hydratedUser) return c.json({ error: 'User not found.' }, 404)
    const targetUserId = String(hydratedUser.id || user.id || userId).trim()

    let linkedParents: any[] = []
    let linkedChildren: any[] = []
    let recentAttendance: any[] = []
    let currentClass: Record<string, any> | null = null
    let activity: any[] = []

    try {
      await ensureParentStudentLinksTable(c.env.APP_DB)
      if (hydratedUser.role === 'student') {
        const parentLinks = await c.env.APP_DB.prepare(
          `SELECT u.id, u.name, u.email, u.role, u.status, u.createdAt FROM parent_student_links psl JOIN users u ON psl.parent_id = u.id WHERE psl.student_id = ? AND psl.tenant_id = ?`
        ).bind(targetUserId, tenantId).all()
        linkedParents = await hydrateUserRecords(c.env.APP_DB, (parentLinks.results || []) as Record<string, any>[])
      }
      if (hydratedUser.role === 'parent') {
        const childLinks = await c.env.APP_DB.prepare(
          `SELECT u.id, u.name, u.email, u.role, u.status, u.createdAt FROM parent_student_links psl JOIN users u ON psl.student_id = u.id WHERE psl.parent_id = ? AND psl.tenant_id = ?`
        ).bind(targetUserId, tenantId).all()
        linkedChildren = await hydrateUserRecords(c.env.APP_DB, (childLinks.results || []) as Record<string, any>[])
      }
    } catch {}

    try {
      await ensureClassesTable(c.env.APP_DB)
      if (hydratedUser.classId) {
        currentClass = await c.env.APP_DB.prepare(
          `SELECT id, name, arm FROM classes WHERE id = ? AND tenantId = ?`
        ).bind(hydratedUser.classId, tenantId).first() as Record<string, any> | null
      }
    } catch {}

    try {
      recentAttendance = await getAttendance(c.env.APP_DB, hydratedUser.email || targetUserId, 30)
      if (!recentAttendance.length && hydratedUser.id && hydratedUser.id !== hydratedUser.email) {
        recentAttendance = await getAttendance(c.env.APP_DB, hydratedUser.id, 30)
      }
    } catch {}

    try {
      activity = await getAuditForStudent(c.env.APP_DB, hydratedUser.email || targetUserId)
    } catch {}

    return c.json({
      success: true,
      user: {
        ...hydratedUser,
        linkedParents,
        linkedChildren,
        currentClass,
        recentAttendance,
        activity: activity.slice(0, 10),
      },
    })
  } catch (err) {
    return c.json({ error: 'Could not fetch user profile.' }, 500)
  }
})

const INIT_BRANDING = `CREATE TABLE IF NOT EXISTS tenant_branding (tenant_id TEXT PRIMARY KEY, logo_url TEXT, tagline TEXT, website TEXT, facebook_url TEXT, instagram_url TEXT, tiktok_url TEXT, youtube_url TEXT, whatsapp_url TEXT, updated_at TEXT)`
const INIT_WEBSITE_SECTIONS = `CREATE TABLE IF NOT EXISTS website_sections (id TEXT PRIMARY KEY, tenant_id TEXT, section_key TEXT, title TEXT, content TEXT, image_url TEXT, metadata TEXT, updated_at TEXT)`
const INIT_PLATFORM_SITE_SECTIONS = `CREATE TABLE IF NOT EXISTS platform_site_sections (id TEXT PRIMARY KEY, section_key TEXT, title TEXT, content TEXT, image_url TEXT, metadata TEXT, updated_at TEXT)`
const INIT_SCHOOL_EVENTS = `CREATE TABLE IF NOT EXISTS school_events (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, description TEXT, event_date TEXT, media_urls TEXT, created_at TEXT, updated_at TEXT)`

const BRANDING_SOCIAL_COLUMNS = [
  { key: 'facebook', column: 'facebook_url', label: 'Facebook', action: 'Like / Follow', className: 'social-facebook' },
  { key: 'instagram', column: 'instagram_url', label: 'Instagram', action: 'Follow', className: 'social-instagram' },
  { key: 'tiktok', column: 'tiktok_url', label: 'TikTok', action: 'Follow', className: 'social-tiktok' },
  { key: 'youtube', column: 'youtube_url', label: 'YouTube', action: 'Subscribe', className: 'social-youtube' },
  { key: 'whatsapp', column: 'whatsapp_url', label: 'WhatsApp', action: 'Chat', className: 'social-whatsapp' },
] as const

async function ensureBrandingTable(db: D1Database) {
  if (_initializedTables.has('branding')) return
  _initializedTables.add('branding')
  await db.prepare(INIT_BRANDING).run()
  for (const social of BRANDING_SOCIAL_COLUMNS) {
    await db.prepare(`ALTER TABLE tenant_branding ADD COLUMN ${social.column} TEXT`).run().catch(() => {})
  }
}

function normalizeAbsoluteUrl(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^www\./i.test(raw)) return `https://${raw}`
  return ''
}

function normalizeSocialHandle(value: unknown) {
  return String(value || '').trim().replace(/^@+/, '').replace(/^\/+/, '')
}

function normalizeBrandingSocialLink(platform: string, value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const absoluteUrl = normalizeAbsoluteUrl(raw)
  if (absoluteUrl) return absoluteUrl

  if (/^(facebook\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com)/i.test(raw)) {
    return `https://${raw.replace(/^\/+/, '')}`
  }

  if (platform === 'facebook') {
    const handle = normalizeSocialHandle(raw)
    return handle ? `https://www.facebook.com/${handle}` : ''
  }

  if (platform === 'instagram') {
    const handle = normalizeSocialHandle(raw)
    return handle ? `https://www.instagram.com/${handle}` : ''
  }

  if (platform === 'tiktok') {
    const handle = normalizeSocialHandle(raw)
    return handle ? `https://www.tiktok.com/@${handle}` : ''
  }

  if (platform === 'youtube') {
    const path = String(raw).trim().replace(/^\/+/, '')
    if (!path) return ''
    if (path.startsWith('@')) return `https://www.youtube.com/${path}`
    if (/^(channel|c|user)\//i.test(path)) return `https://www.youtube.com/${path}`
    return `https://www.youtube.com/@${path.replace(/^@+/, '')}`
  }

  if (platform === 'whatsapp') {
    const digits = raw.replace(/[^\d]/g, '')
    return digits.length >= 7 ? `https://wa.me/${digits}` : ''
  }

  return ''
}

function mapTenantBranding(tenant: Record<string, any> | null, row: Record<string, any> | null = null) {
  const websiteUrl = row?.website || (tenant?.websiteDomain ? `https://${tenant.websiteDomain}` : null)
  return {
    schoolName: String(tenant?.schoolName || '').trim(),
    logoUrl: String(row?.logo_url || '').trim(),
    tagline: String(row?.tagline || '').trim(),
    website: String(websiteUrl || '').trim(),
    websiteUrl: String(websiteUrl || '').trim(),
    subdomain: String(tenant?.requestedSubdomain || '').trim(),
    facebook: String(row?.facebook_url || '').trim(),
    instagram: String(row?.instagram_url || '').trim(),
    tiktok: String(row?.tiktok_url || '').trim(),
    youtube: String(row?.youtube_url || '').trim(),
    whatsapp: String(row?.whatsapp_url || '').trim(),
  }
}

async function upsertTenantBranding(db: D1Database, tenant: Record<string, any>, values: Record<string, any>) {
  await ensureBrandingTable(db)
  const existing = await db.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as Record<string, any> | null
  const websiteValue = values.website ?? existing?.website ?? (tenant.websiteDomain ? `https://${tenant.websiteDomain}` : null)
  const nextRow = {
    logo_url: values.logoUrl ?? existing?.logo_url ?? null,
    tagline: values.tagline ?? existing?.tagline ?? null,
    website: websiteValue == null ? null : String(websiteValue).trim(),
    facebook_url: normalizeBrandingSocialLink('facebook', values.facebook ?? existing?.facebook_url) || null,
    instagram_url: normalizeBrandingSocialLink('instagram', values.instagram ?? existing?.instagram_url) || null,
    tiktok_url: normalizeBrandingSocialLink('tiktok', values.tiktok ?? existing?.tiktok_url) || null,
    youtube_url: normalizeBrandingSocialLink('youtube', values.youtube ?? existing?.youtube_url) || null,
    whatsapp_url: normalizeBrandingSocialLink('whatsapp', values.whatsapp ?? existing?.whatsapp_url) || null,
  }

  await db.prepare(`INSERT OR REPLACE INTO tenant_branding (tenant_id, logo_url, tagline, website, facebook_url, instagram_url, tiktok_url, youtube_url, whatsapp_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      tenant.id,
      nextRow.logo_url,
      nextRow.tagline,
      nextRow.website,
      nextRow.facebook_url,
      nextRow.instagram_url,
      nextRow.tiktok_url,
      nextRow.youtube_url,
      nextRow.whatsapp_url,
      new Date().toISOString(),
    )
    .run()

  return nextRow
}

const PLATFORM_SITE_SECTION_SEEDS = [
  {
    sectionKey: 'home',
    title: 'School owners get control, parents get clarity, and students get better support.',
    content: 'NDOVERA helps schools run daily work, support learning, and keep parents informed from one place. It gives school owners a clearer view, helps teachers stay organised, and helps families feel included.',
    imageUrl: '/site-media/ndovera-home-hero.svg',
    metadata: {
      eyebrow: 'For School Owners, Parents, And Growth Partners',
      buttonLabel: 'Discover NDOVERA',
      buttonUrl: '/about',
      secondaryButtonLabel: 'See NDOVERA Tutor',
      secondaryButtonUrl: '/tutor',
      spotlightEyebrow: 'Built For Real School Life',
      spotlightTitle: 'When a school runs well, everyone feels it.',
      spotlightDescription: 'Owners see what needs attention. Parents get updates they can understand. Teachers and students work in a calmer system that is easier to trust.',
      stats: [
        { label: 'School owners', value: 'Clear view' },
        { label: 'Parents', value: 'Better updates' },
        { label: 'Teachers', value: 'Less stress' },
        { label: 'Growth', value: 'Stronger base' },
      ],
      cards: [
        { title: 'Leadership Control', description: 'Give school owners a clearer picture of daily work, progress, and what needs attention next.' },
        { title: 'Parent Confidence', description: 'Help families feel informed, respected, and closer to the life of the school.' },
        { title: 'Better Learning Support', description: 'Support teachers and students with tools that keep learning clear and steady.' },
        { title: 'A Stronger School Brand', description: 'Show the school well in public while improving how the school runs inside.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-about-story.svg',
        '/site-media/ndovera-gallery-learning.svg',
      ],
    },
  },
  {
    sectionKey: 'about',
    title: 'NDOVERA helps schools look professional and run with confidence.',
    content: 'A good school needs more than good intentions. It needs clear systems, trusted communication, and a strong public presence. NDOVERA brings these together in one steady platform.',
    imageUrl: '/site-media/ndovera-about-story.svg',
    metadata: {
      eyebrow: 'About NDOVERA',
      spotlightEyebrow: 'Clear By Design',
      spotlightTitle: 'Schools deserve one strong system for both the office and the classroom.',
      spotlightDescription: 'NDOVERA was shaped around real school life. It gives owners, teachers, parents, and students a shared system that feels useful from day one.',
      cards: [
        { title: 'For School Owners', description: 'See the school more clearly, lead with more confidence, and make better decisions faster.' },
        { title: 'For Parents', description: 'Create communication that is easier to trust and easier to understand.' },
        { title: 'For Real Growth', description: 'Build a stronger school image while improving the daily systems behind it.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-gallery-school.svg',
      ],
    },
  },
  {
    sectionKey: 'mission',
    title: 'Our mission is to make school management simpler, clearer, and more trusted.',
    content: 'We help schools reduce confusion, improve communication, and support learning with tools people can actually use. NDOVERA is built to make daily school work lighter and more dependable.',
    imageUrl: '/site-media/ndovera-home-hero.svg',
    metadata: {
      eyebrow: 'Our Mission',
      spotlightEyebrow: 'What Drives Us',
      spotlightTitle: 'Good schools move faster when the system behind them is strong.',
      spotlightDescription: 'We want owners to lead with confidence, parents to stay informed, and teachers to spend more time helping students succeed.',
      cards: [
        { title: 'Help Owners Lead Well', description: 'Give school leaders better visibility and fewer blind spots in daily operations.' },
        { title: 'Help Parents Stay Informed', description: 'Make school communication clearer, calmer, and easier to trust.' },
        { title: 'Help Teaching Stay Strong', description: 'Support teachers and students with tools that keep learning focused and moving forward.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-gallery-community.svg',
      ],
    },
  },
  {
    sectionKey: 'vision',
    title: 'Our vision is a future where every school can grow on a stronger digital foundation.',
    content: 'We want school owners to have a clearer view of progress, parents to feel informed, and students to learn in better supported environments. NDOVERA is growing toward that future one strong school at a time.',
    imageUrl: '/site-media/ndovera-opportunity-paths.svg',
    metadata: {
      eyebrow: 'Our Vision',
      spotlightEyebrow: 'Looking Ahead',
      spotlightTitle: 'Every school deserves tools that help people move with confidence.',
      spotlightDescription: 'We see a future where leadership is clearer, parent trust is stronger, and student support is built into the daily life of the school.',
      cards: [
        { title: 'Confident Leadership', description: 'School owners should be able to see what matters and act early with confidence.' },
        { title: 'Trusted Parent Communication', description: 'Families should not be left guessing about school life or student progress.' },
        { title: 'Better Supported Learning', description: 'Students should have stronger guidance without losing effort, care, or human support.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-gallery-learning.svg',
      ],
    },
  },
  {
    sectionKey: 'partners',
    title: 'We welcome growth partners who want better results for schools.',
    content: 'NDOVERA is open to school groups, rollout teams, education supporters, and investors who believe practical school improvement matters. We want partnerships that create useful change, not empty noise.',
    imageUrl: '/site-media/ndovera-partner-network.svg',
    metadata: {
      eyebrow: 'Growth Partners',
      spotlightEyebrow: 'Built Through Collaboration',
      spotlightTitle: 'The best partnerships help schools grow faster and with less waste.',
      spotlightDescription: 'We are interested in partners who want real outcomes for schools, stronger rollout, and long-term value that people can actually see.',
      cards: [
        { title: 'School Groups', description: 'Work with NDOVERA to help more schools move into stronger, more trusted systems.' },
        { title: 'Rollout Partners', description: 'Help schools launch well, train teams, and keep adoption strong after go-live.' },
        { title: 'Education Supporters And Investors', description: 'Back practical tools and services that help schools improve in visible ways.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-opportunity-paths.svg',
        '/site-media/ndovera-event-briefing.svg',
      ],
    },
  },
  {
    sectionKey: 'tutor',
    title: 'NDOVERA Tutor helps students learn with more confidence.',
    content: 'Students can ask questions, revise important topics, and get help in clear English. It supports better understanding in a way parents can trust and teachers can respect.',
    imageUrl: '/site-media/ndovera-tutor-focus.svg',
    metadata: {
      eyebrow: 'NDOVERA Tutor',
      spotlightEyebrow: 'Student Support',
      spotlightTitle: 'Parents want support they can trust. Students need help they can understand.',
      spotlightDescription: 'NDOVERA Tutor is designed to explain, guide, and support practice in a way that still respects the learner, the teacher, and the parent.',
      mediaEyebrow: 'Learning Support',
      mediaTitle: 'Simple explanations, steady revision, and support that feels safe and useful.',
      mediaDescription: 'The tutor helps students break down hard topics, prepare with more confidence, and keep learning moving forward in plain English.',
      cards: [
        { title: 'Homework Help', description: 'Support students with clear guidance when they get stuck and need a better way into the work.' },
        { title: 'Lesson Support', description: 'Turn confusion into understanding with explanations that are easier to follow.' },
        { title: 'Exam Revision', description: 'Help students prepare with more focus, stronger recall, and better confidence.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-gallery-learning.svg',
      ],
    },
  },
  {
    sectionKey: 'pricing',
    title: 'Simple pricing for schools that want a strong start with NDOVERA.',
    content: 'Choose a standard rollout or a custom launch. Pay the onboarding fee now, then move to live-user billing from the next term based on active users in your school.',
    imageUrl: '/site-media/ndovera-partner-network.svg',
    metadata: {
      eyebrow: 'Pricing',
      buttonLabel: 'Register A School',
      buttonUrl: '/register-school',
      secondaryButtonLabel: 'Talk To Growth Team',
      secondaryButtonUrl: '/growth-partners',
      spotlightEyebrow: 'Clear Billing',
      spotlightTitle: 'Only the onboarding fee is paid now. Live-user billing starts later.',
      spotlightDescription: 'NDOVERA keeps the first payment simple, then moves to term billing based on actual active users instead of rough guesses.',
      mediaEyebrow: 'How Billing Works',
      mediaTitle: 'Growth gives schools a standard launch. Custom supports schools that need extra rollout planning.',
      mediaDescription: 'The pricing page helps owners understand what is paid now, what starts next term, and where custom rollout support fits in.',
      cards: [
        { title: 'Pay Onboarding First', description: 'Reserve your school domain, create the owner account, and pay the onboarding fee before launch work begins.' },
        { title: 'Move To Live-User Billing', description: 'From the next term, NDOVERA bills by active users so schools can scale with clearer cost control.' },
        { title: 'Choose Growth Or Custom', description: 'Pick a standard NDOVERA launch or a custom rollout that Ami reviews before final approval.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-home-hero.svg',
        '/site-media/ndovera-event-briefing.svg',
      ],
    },
  },
  {
    sectionKey: 'opportunities',
    title: 'There are real opportunities to build, support, and grow with NDOVERA.',
    content: 'If you work with schools, support education, or want to back practical tools that help schools improve, there may be a place for you here. We are open to people and teams who want useful work with real impact.',
    imageUrl: '/site-media/ndovera-opportunity-paths.svg',
    metadata: {
      eyebrow: 'Opportunities',
      spotlightEyebrow: 'Grow With Purpose',
      spotlightTitle: 'Real opportunity starts where useful work meets real school needs.',
      spotlightDescription: 'We are open to schools, partners, operators, and backers who want to help schools become more organised, more trusted, and more ready for growth.',
      cards: [
        { title: 'School Onboarding', description: 'Support schools that are ready to strengthen their systems and public presence.' },
        { title: 'Training And Rollout', description: 'Help teams learn the platform, settle in well, and stay confident after launch.' },
        { title: 'Education Partners', description: 'Work with NDOVERA on programmes, content, and support that help schools grow.' },
        { title: 'Product And Growth', description: 'Back better workflows, stronger delivery, and practical school innovation.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-partner-network.svg',
        '/site-media/ndovera-gallery-community.svg',
      ],
    },
  },
  {
    sectionKey: 'events',
    title: 'NDOVERA events bring school owners, parents, partners, and supporters into useful conversation.',
    content: 'We host moments that help people learn, connect, and take practical next steps. Every event should leave visitors with clearer thinking and stronger confidence in where NDOVERA is going.',
    imageUrl: '/site-media/ndovera-event-briefing.svg',
    metadata: {
      eyebrow: 'Events',
      spotlightEyebrow: 'Useful Conversations',
      spotlightTitle: 'Our events are built around clarity, connection, and practical action.',
      spotlightDescription: 'We want every briefing, demo, and roundtable to give people real insight, not just a nice poster and a short speech.',
      cards: [
        { eyebrow: 'Jun 2026', title: 'School Owner Growth Briefing', description: 'A live session for school owners and leadership teams exploring stronger structure for admissions, reporting, and parent communication.' },
        { eyebrow: 'Jul 2026', title: 'Parent Trust And Tutor Demo', description: 'A focused session showing how simple learning support and clearer school updates can build confidence for families.' },
        { eyebrow: 'Aug 2026', title: 'Partner And Investor Roundtable', description: 'A conversation with growth partners, education supporters, and backers who want practical school progress.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-gallery-community.svg',
        '/site-media/ndovera-gallery-school.svg',
        '/site-media/ndovera-gallery-learning.svg',
      ],
    },
  },
  {
    sectionKey: 'gallery',
    title: 'See how NDOVERA supports school growth in real life.',
    content: 'This gallery holds moments that reflect the spirit of NDOVERA: calm systems, strong learning, better teamwork, and visible growth. It helps visitors feel the work, the care, and the direction of NDOVERA.',
    imageUrl: '/site-media/ndovera-gallery-school.svg',
    metadata: {
      eyebrow: 'Gallery',
      spotlightEyebrow: 'In Motion',
      spotlightTitle: 'The NDOVERA story is best seen in real moments of work, learning, and growth.',
      spotlightDescription: 'This gallery gives visitors a clearer feel for the people, sessions, and progress behind the platform.',
      cards: [
        { title: 'Leadership And Planning', description: 'Scenes that reflect direction, decision-making, and confident school management.' },
        { title: 'Parents And Communication', description: 'Moments that show trust, visibility, and stronger family connection.' },
        { title: 'Learning Support In Motion', description: 'Visuals that capture focus, support, and student progress.' },
        { title: 'Partners And Progress', description: 'A look at how NDOVERA grows through collaboration, demos, and real working days.' },
      ],
      mediaUrls: [
        '/site-media/ndovera-home-hero.svg',
        '/site-media/ndovera-about-story.svg',
        '/site-media/ndovera-partner-network.svg',
        '/site-media/ndovera-tutor-focus.svg',
        '/site-media/ndovera-gallery-learning.svg',
        '/site-media/ndovera-gallery-community.svg',
      ],
    },
  },
]

async function ensureWebsiteSectionsTable(db: D1Database) {
  if (_initializedTables.has('website_sections')) return
  _initializedTables.add('website_sections')
  await db.prepare(INIT_WEBSITE_SECTIONS).run()
  await db.prepare(`ALTER TABLE website_sections ADD COLUMN metadata TEXT`).run().catch(() => {})
}

async function ensurePlatformSiteSectionsTable(db: D1Database) {
  if (_initializedTables.has('platform_site_sections')) return
  _initializedTables.add('platform_site_sections')
  await db.prepare(INIT_PLATFORM_SITE_SECTIONS).run()
  await db.prepare(`ALTER TABLE platform_site_sections ADD COLUMN metadata TEXT`).run().catch(() => {})

  for (const seed of PLATFORM_SITE_SECTION_SEEDS) {
    const metadataText = JSON.stringify(seed.metadata || {})
    const updatedAt = new Date().toISOString()

    await db.prepare(
      `INSERT INTO platform_site_sections (id, section_key, title, content, image_url, metadata, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM platform_site_sections WHERE section_key = ?)`
    )
      .bind(`platform_${seed.sectionKey}`, seed.sectionKey, seed.title, seed.content, seed.imageUrl || null, metadataText, updatedAt, seed.sectionKey)
      .run()

    await db.prepare(
      `UPDATE platform_site_sections
       SET title = ?, content = ?, image_url = ?, metadata = ?, updated_at = ?
       WHERE section_key = ?
         AND COALESCE(title, '') = ''
         AND COALESCE(content, '') = ''
         AND COALESCE(image_url, '') = ''
         AND (metadata IS NULL OR TRIM(metadata) = '' OR TRIM(metadata) = '{}')`
    )
      .bind(seed.title, seed.content, seed.imageUrl || null, metadataText, updatedAt, seed.sectionKey)
      .run()
  }
}

app.get('/api/school/branding', authenticate, async (c) => {
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)
  try {
    await ensureBrandingTable(c.env.APP_DB)
    const row = await c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as any
    return c.json({ success: true, branding: mapTenantBranding(tenant, row) })
  } catch {
    return c.json({ success: true, branding: mapTenantBranding(tenant, null) })
  }
})

app.post('/api/school/branding', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner'])) return c.json({ error: 'forbidden' }, 403)
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)
  const { tagline, website, logoUrl, facebook, instagram, tiktok, youtube, whatsapp } = await c.req.json()
  try {
    await upsertTenantBranding(c.env.APP_DB, tenant, { tagline, website, logoUrl, facebook, instagram, tiktok, youtube, whatsapp })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Could not save branding.' }, 500)
  }
})

// Logo file upload to R2
app.post('/api/school/logo', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner'])) return c.json({ error: 'forbidden' }, 403)
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  if (!file) return c.json({ error: 'No file provided.' }, 400)
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const key = `logos/${tenant.id}/logo_${Date.now()}.${ext}`
    await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
    const logoUrl = `https://ndovera.com/files/${key}`
    await upsertTenantBranding(c.env.APP_DB, tenant, { logoUrl })
    return c.json({ success: true, logoUrl })
  } catch {
    return c.json({ error: 'Upload failed.' }, 500)
  }
})

// Website sections
app.get('/api/school/website/sections', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensureWebsiteSectionsTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM website_sections WHERE tenant_id = ? ORDER BY section_key`).bind(tenantId).all()
    return c.json({ success: true, sections: rows.results || [] })
  } catch { return c.json({ success: true, sections: [] }) }
})

app.post('/api/school/website/sections', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { sectionKey, title, content, imageUrl, metadata } = await c.req.json()
  if (!sectionKey) return c.json({ error: 'Section key required.' }, 400)
  const id = `ws_${tenantId}_${sectionKey}`
  try {
    await ensureWebsiteSectionsTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO website_sections (id, tenant_id, section_key, title, content, image_url, metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, sectionKey, title || '', content || '', imageUrl || null, JSON.stringify(metadata || {}), new Date().toISOString()).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Could not save section.' }, 500)
  }
})

app.post('/api/school/website/sections/upload', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const sectionKey = (formData.get('sectionKey') as string) || 'general'
  if (!file) return c.json({ error: 'No file provided.' }, 400)
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const key = `website/${tenantId}/${sectionKey}/${Date.now()}.${ext}`
    await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
    return c.json({ success: true, url: `https://ndovera.com/files/${key}` })
  } catch { return c.json({ error: 'Upload failed.' }, 500) }
})

app.get('/api/public/platform-site', async (c) => {
  try {
    await ensurePlatformSiteSectionsTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM platform_site_sections ORDER BY section_key`).all()
    return c.json({ success: true, sections: rows.results || [] })
  } catch {
    return c.json({ success: true, sections: [] })
  }
})

app.get('/api/ami/website/sections', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)
  try {
    await ensurePlatformSiteSectionsTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM platform_site_sections ORDER BY section_key`).all()
    return c.json({ success: true, sections: rows.results || [] })
  } catch {
    return c.json({ success: true, sections: [] })
  }
})

app.post('/api/ami/website/sections', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)
  const { sectionKey, title, content, imageUrl, metadata } = await c.req.json()
  if (!sectionKey) return c.json({ error: 'Section key required.' }, 400)

  try {
    await ensurePlatformSiteSectionsTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(
      `INSERT OR REPLACE INTO platform_site_sections (id, section_key, title, content, image_url, metadata, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(`platform_${sectionKey}`, sectionKey, title || '', content || '', imageUrl || null, JSON.stringify(metadata || {}), new Date().toISOString())
      .run()
    return c.json({ success: true })
  } catch {
    return c.json({ error: 'Could not save section.' }, 500)
  }
})

app.post('/api/ami/website/sections/upload', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['ami'])) return c.json({ error: 'forbidden' }, 403)
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const sectionKey = (formData.get('sectionKey') as string) || 'general'
  if (!file) return c.json({ error: 'No file provided.' }, 400)

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const key = `platform-site/${sectionKey}/${Date.now()}.${ext}`
    await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
    return c.json({ success: true, url: `https://ndovera.com/files/${key}` })
  } catch {
    return c.json({ error: 'Upload failed.' }, 500)
  }
})

// School events
app.get('/api/school/events', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await c.env.APP_DB.prepare(INIT_SCHOOL_EVENTS).run()
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM school_events WHERE tenant_id = ? ORDER BY event_date DESC`).bind(tenantId).all()
    const events = (rows.results || []).map((e: any) => ({ ...e, mediaUrls: JSON.parse(e.media_urls || '[]') }))
    return c.json({ success: true, events })
  } catch { return c.json({ success: true, events: [] }) }
})

app.post('/api/school/events', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { title, description, eventDate, mediaUrls } = await c.req.json()
  if (!title) return c.json({ error: 'Title required.' }, 400)
  const id = `event_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    await c.env.APP_DB.prepare(INIT_SCHOOL_EVENTS).run()
    await c.env.APP_DB.prepare(`INSERT INTO school_events (id, tenant_id, title, description, event_date, media_urls, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, title, description || '', eventDate || '', JSON.stringify(mediaUrls || []), new Date().toISOString(), new Date().toISOString()).run()
    return c.json({ success: true, id }, 201)
  } catch (err) { return c.json({ error: 'Could not create event.' }, 500) }
})

app.put('/api/school/events/:id', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  const eventId = c.req.param('id')
  const { title, description, eventDate, mediaUrls } = await c.req.json()
  await c.env.APP_DB.prepare(`UPDATE school_events SET title=?, description=?, event_date=?, media_urls=?, updated_at=? WHERE id=? AND tenant_id=?`)
    .bind(title, description || '', eventDate || '', JSON.stringify(mediaUrls || []), new Date().toISOString(), eventId, tenantId).run()
  return c.json({ success: true })
})

app.delete('/api/school/events/:id', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  const eventId = c.req.param('id')
  await c.env.APP_DB.prepare(`DELETE FROM school_events WHERE id=? AND tenant_id=?`).bind(eventId, tenantId).run()
  return c.json({ success: true })
})

app.post('/api/school/events/upload', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  if (!file) return c.json({ error: 'No file provided.' }, 400)
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const key = `events/${tenantId}/${Date.now()}.${ext}`
    await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
    return c.json({ success: true, url: `https://ndovera.com/files/${key}` })
  } catch { return c.json({ error: 'Upload failed.' }, 500) }
})


function canAuthorSchoolNews(role: unknown, tenantId: unknown) {
  return Boolean(String(tenantId || '').trim()) && String(role || '').trim().toLowerCase() !== 'ami'
}

function canReviewSchoolNews(role: unknown) {
  return hasRequiredRole(role, ['ict', 'ict_manager', 'hos', 'owner'])
}

function canPublishSchoolNews(role: unknown) {
  return hasRequiredRole(role, ['hos', 'owner'])
}

function canManageSchoolNewsPost(post: Record<string, any> | null, actor: Record<string, any> = {}) {
  if (!post) return false
  if (canReviewSchoolNews(actor.role) || canPublishSchoolNews(actor.role)) return true
  return String(post.authorId || '') === String(actor.id || '')
}

app.get('/api/school/news/posts', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const actorId = c.var.user?.id
  const actorRole = c.var.user?.role
  const scope = String(c.req.query('scope') || 'mine').trim().toLowerCase()

  if (!canAuthorSchoolNews(actorRole, tenantId)) return c.json({ error: 'forbidden' }, 403)

  try {
    let posts = [] as any[]
    if (scope === 'review') {
      if (!canReviewSchoolNews(actorRole)) return c.json({ error: 'forbidden' }, 403)
      posts = await listSchoolNewsPosts(c.env.APP_DB, tenantId, { status: 'submitted' })
    } else if (scope === 'publication') {
      if (!canPublishSchoolNews(actorRole)) return c.json({ error: 'forbidden' }, 403)
      posts = await listSchoolNewsPosts(c.env.APP_DB, tenantId, { status: 'reviewed' })
    } else if (scope === 'published') {
      posts = await listSchoolNewsPosts(c.env.APP_DB, tenantId, { status: 'published' })
    } else if (scope === 'all') {
      if (!canReviewSchoolNews(actorRole)) return c.json({ error: 'forbidden' }, 403)
      posts = await listSchoolNewsPosts(c.env.APP_DB, tenantId)
    } else {
      posts = await listSchoolNewsPosts(c.env.APP_DB, tenantId, { authorId: actorId })
    }

    return c.json({ success: true, posts })
  } catch {
    return c.json({ success: true, posts: [] })
  }
})

app.post('/api/school/news/posts', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const actor = c.var.user || {}
  if (!canAuthorSchoolNews(actor.role, tenantId)) return c.json({ error: 'forbidden' }, 403)

  const payload = await c.req.json()
  if (!String(payload.title || '').trim()) return c.json({ error: 'Title required.' }, 400)

  const existing = payload.id ? await getSchoolNewsPostById(c.env.APP_DB, tenantId, String(payload.id || '')) : null
  if (existing && !canManageSchoolNewsPost(existing, actor)) return c.json({ error: 'forbidden' }, 403)
  if (existing?.status === 'published' && !canPublishSchoolNews(actor.role)) return c.json({ error: 'Published stories can only be edited by HoS or Owner.' }, 403)

  try {
    const post = await saveSchoolNewsPost(c.env.APP_DB, {
      tenantId,
      id: payload.id,
      title: payload.title,
      excerpt: payload.excerpt,
      content: payload.content,
      coverUrl: payload.coverUrl,
      audience: payload.audience,
      authorId: actor.id,
      authorName: actor.name || actor.email || actor.id,
      authorRole: actor.role,
    })
    return c.json({ success: true, post })
  } catch {
    return c.json({ error: 'Could not save story.' }, 500)
  }
})

app.post('/api/school/news/posts/submit', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const actor = c.var.user || {}
  if (!canAuthorSchoolNews(actor.role, tenantId)) return c.json({ error: 'forbidden' }, 403)

  const payload = await c.req.json()
  if (!String(payload.title || '').trim()) return c.json({ error: 'Title required.' }, 400)
  if (!String(payload.content || '').trim()) return c.json({ error: 'Content required before submission.' }, 400)

  const existing = payload.id ? await getSchoolNewsPostById(c.env.APP_DB, tenantId, String(payload.id || '')) : null
  if (existing && !canManageSchoolNewsPost(existing, actor)) return c.json({ error: 'forbidden' }, 403)
  if (existing?.status === 'published') return c.json({ error: 'Published stories cannot be resubmitted.' }, 400)

  try {
    const post = await submitSchoolNewsPost(c.env.APP_DB, {
      tenantId,
      id: payload.id,
      title: payload.title,
      excerpt: payload.excerpt,
      content: payload.content,
      coverUrl: payload.coverUrl,
      audience: payload.audience,
      authorId: actor.id,
      authorName: actor.name || actor.email || actor.id,
      authorRole: actor.role,
    })
    return c.json({ success: true, post })
  } catch {
    return c.json({ error: 'Could not submit story for review.' }, 500)
  }
})

app.post('/api/school/news/posts/:id/review', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const actor = c.var.user || {}
  if (!tenantId || !canReviewSchoolNews(actor.role)) return c.json({ error: 'forbidden' }, 403)

  const payload = await c.req.json()
  const decision = String(payload.decision || '').trim().toLowerCase()
  if (!['approve', 'changes_requested'].includes(decision)) {
    return c.json({ error: 'A valid review decision is required.' }, 400)
  }

  try {
    const post = await reviewSchoolNewsPost(c.env.APP_DB, {
      tenantId,
      id: c.req.param('id'),
      decision,
      reviewNotes: payload.reviewNotes,
      reviewedBy: actor.id,
      reviewedByName: actor.name || actor.email || actor.id,
    })
    return c.json({ success: true, post })
  } catch {
    return c.json({ error: 'Could not review story.' }, 500)
  }
})

app.post('/api/school/news/posts/:id/publish', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const actor = c.var.user || {}
  if (!tenantId || !canPublishSchoolNews(actor.role)) return c.json({ error: 'forbidden' }, 403)

  try {
    const post = await publishSchoolNewsPost(c.env.APP_DB, {
      tenantId,
      id: c.req.param('id'),
      publishedBy: actor.id,
      publishedByName: actor.name || actor.email || actor.id,
    })
    return c.json({ success: true, post })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Could not publish story.' }, 500)
  }
})

// Engagement (views/reactions/comments) on published stories — shared with the public website.
app.get('/api/school/news/posts/:id/engagement', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    const engagement = await getSchoolNewsEngagement(c.env.APP_DB, tenantId, c.req.param('id'))
    return c.json({ success: true, ...engagement })
  } catch {
    return c.json({ success: true, views: 0, reactions: {}, comments: [] })
  }
})

app.post('/api/school/news/posts/:id/engagement', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const actor = c.var.user || {}
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    const post = await getSchoolNewsPostById(c.env.APP_DB, tenantId, c.req.param('id'))
    if (!post || post.status !== 'published') return c.json({ error: 'not found' }, 404)
    const payload = await c.req.json().catch(() => ({}))
    const kind = String(payload.kind || '').trim()
    if (kind === 'reaction') {
      const engagement = await recordSchoolNewsEngagement(c.env.APP_DB, {
        tenantId,
        postId: post.id,
        kind: 'reaction',
        reaction: String(payload.reaction || '👍').slice(0, 16),
      })
      return c.json({ success: true, ...engagement })
    }
    if (kind === 'comment') {
      const text = String(payload.body || '').trim()
      if (!text) return c.json({ error: 'Comment required.' }, 400)
      const engagement = await recordSchoolNewsEngagement(c.env.APP_DB, {
        tenantId,
        postId: post.id,
        kind: 'comment',
        authorName: actor.name || actor.email || 'Reader',
        body: text,
      })
      return c.json({ success: true, ...engagement })
    }
    return c.json({ error: 'Unsupported engagement.' }, 400)
  } catch {
    return c.json({ error: 'Could not record engagement.' }, 500)
  }
})

app.post('/api/school/news/upload', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!canAuthorSchoolNews(c.var.user?.role, tenantId)) return c.json({ error: 'forbidden' }, 403)
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const formData = await c.req.formData()
  const file = formData.get('file') as File
  if (!file) return c.json({ error: 'No file provided.' }, 400)

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const key = `news/${tenantId}/${Date.now()}.${ext}`
    await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } })
    return c.json({ success: true, url: `https://ndovera.com/files/${key}` })
  } catch {
    return c.json({ error: 'Upload failed.' }, 500)
  }
})
app.get('/api/school/parents', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensureUsersTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      `SELECT id, name, email, role, primary_role, employment_category, status, createdAt, tenantId
       FROM users
       WHERE tenantId = ? AND (status IS NULL OR status != 'inactive')
       ORDER BY name`
    ).bind(tenantId).all()
    const parents = (await hydrateUserRecords(c.env.APP_DB, (rows.results || []) as Record<string, any>[]))
      .filter(parent => parseRoleList(parent?.primaryRole, parent?.role, parent?.roles).includes('parent'))
    return c.json({ success: true, parents })
  } catch {
    return c.json({ success: true, parents: [] })
  }
})

// parent-student-link is registered earlier (before GET /api/people/:userId)

app.get('/api/school/classes', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensureClassesTable(c.env.APP_DB)
    await ensureClassMembershipsTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM classes WHERE tenantId = ? ORDER BY name, arm`).bind(tenantId).all()
    const classRows = (rows.results || []) as Record<string, any>[]
    const membershipRows = await c.env.APP_DB.prepare(
      `SELECT class_id, user_id, membership_role
       FROM class_memberships
       WHERE tenant_id = ?
         AND membership_role IN ('teacher', 'caregiver')
       ORDER BY updated_at DESC`
    ).bind(tenantId).all().catch(() => ({ results: [] }))

    const membershipsByClassId = new Map<string, { teacherIds: string[], caregiverIds: string[] }>()
    for (const row of ((membershipRows.results || []) as Record<string, any>[])) {
      const classId = String(row.class_id || '').trim()
      if (!classId) continue
      const bucket = membershipsByClassId.get(classId) || { teacherIds: [], caregiverIds: [] }
      if (String(row.membership_role || '') === 'caregiver') {
        if (!bucket.caregiverIds.includes(String(row.user_id || ''))) bucket.caregiverIds.push(String(row.user_id || ''))
      } else if (!bucket.teacherIds.includes(String(row.user_id || ''))) {
        bucket.teacherIds.push(String(row.user_id || ''))
      }
      membershipsByClassId.set(classId, bucket)
    }

    return c.json({
      success: true,
      classes: classRows.map(classRow => {
        const classId = String(classRow.id || '').trim()
        const membership = membershipsByClassId.get(classId) || { teacherIds: [], caregiverIds: [] }
        const teacherIds = Array.from(new Set([
          String(classRow.classTeacherId || '').trim(),
          ...membership.teacherIds,
        ].filter(Boolean)))
        return {
          ...classRow,
          teacherIds,
          caregiverIds: membership.caregiverIds,
        }
      }),
    })
  } catch {
    return c.json({ success: true, classes: [] })
  }
})

app.post('/api/school/classes', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { name, arm, classTeacherId, teacherIds, caregiverIds } = await c.req.json()
  if (!name) return c.json({ error: 'Class name is required.' }, 400)
  const id = `class_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    await ensureClassesTable(c.env.APP_DB)
    await ensureClassMembershipsTable(c.env.APP_DB)
    const normalizedTeacherId = await resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, classTeacherId, {
      requireTeachingCapability: true,
      label: 'Class teacher',
    })
    await c.env.APP_DB.prepare(`INSERT INTO classes (id, tenantId, name, arm, classTeacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, tenantId, name, arm || '', normalizedTeacherId, new Date().toISOString()).run()
    const normalizedTeacherIds = Array.from(new Set([
      normalizedTeacherId,
      ...((Array.isArray(teacherIds) ? teacherIds : []).map((value: unknown) => String(value || '').trim()).filter(Boolean)),
    ].filter(Boolean)))
    const canonicalTeacherIds = (await Promise.all(normalizedTeacherIds.map(value => resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, value, {
      requireTeachingCapability: true,
      label: 'Assigned teacher',
    })))).filter(Boolean) as string[]
    const canonicalCaregiverIds = (await Promise.all(
      (Array.isArray(caregiverIds) ? caregiverIds : []).map(value => resolveCanonicalUserIdentifier(c.env.APP_DB, value))
    )).filter(Boolean) as string[]
    await replaceClassMemberships(c.env.APP_DB, tenantId, id, 'teacher', canonicalTeacherIds)
    await replaceClassMemberships(c.env.APP_DB, tenantId, id, 'caregiver', canonicalCaregiverIds)
    await syncTeacherClassAssignment(c.env.APP_DB, tenantId, { id, name, arm: arm || '', classTeacherId: normalizedTeacherId })
    return c.json({ success: true, id }, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not add class.' }, 500)
  }
})

app.put('/api/school/classes/:classId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const classId = c.req.param('classId')
  const body = await c.req.json()
  const { name, arm, classTeacherId, teacherIds, caregiverIds } = body
  try {
    const existingClass = await c.env.APP_DB.prepare(`SELECT * FROM classes WHERE id = ? AND tenantId = ?`).bind(classId, tenantId).first() as Record<string, any> | null
    if (!existingClass) return c.json({ error: 'Class not found.' }, 404)

    const sets: string[] = []
    const vals: unknown[] = []
    if (name !== undefined) { sets.push('name = ?'); vals.push(name) }
    if (arm !== undefined) { sets.push('arm = ?'); vals.push(arm) }
    const normalizedTeacherId = classTeacherId !== undefined
      ? await resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, classTeacherId, {
        requireTeachingCapability: true,
        label: 'Class teacher',
      })
      : undefined
    if (normalizedTeacherId !== undefined) { sets.push('classTeacherId = ?'); vals.push(normalizedTeacherId) }
    if (sets.length === 0) return c.json({ error: 'Nothing to update.' }, 400)
    vals.push(classId, tenantId)
    await c.env.APP_DB.prepare(`UPDATE classes SET ${sets.join(', ')} WHERE id = ? AND tenantId = ?`).bind(...vals).run()

    const updatedClass = {
      ...existingClass,
      ...(name !== undefined ? { name } : {}),
      ...(arm !== undefined ? { arm } : {}),
      ...(normalizedTeacherId !== undefined ? { classTeacherId: normalizedTeacherId } : {}),
    }
    await syncTeacherClassAssignment(c.env.APP_DB, tenantId, updatedClass, existingClass.classTeacherId)

    if (teacherIds !== undefined || classTeacherId !== undefined) {
      const requestedTeacherIds = Array.isArray(teacherIds) ? teacherIds : []
      const normalizedTeacherIds = Array.from(new Set([
        ...(requestedTeacherIds.map((value: unknown) => String(value || '').trim()).filter(Boolean)),
        String(normalizedTeacherId !== undefined ? normalizedTeacherId : updatedClass.classTeacherId || '').trim(),
      ].filter(Boolean)))
      const canonicalTeacherIds = (await Promise.all(normalizedTeacherIds.map(value => resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, value, {
        requireTeachingCapability: true,
        label: 'Assigned teacher',
      })))).filter(Boolean) as string[]
      await replaceClassMemberships(c.env.APP_DB, tenantId, classId, 'teacher', canonicalTeacherIds)
    }

    if (caregiverIds !== undefined) {
      const canonicalCaregiverIds = (await Promise.all(
        (Array.isArray(caregiverIds) ? caregiverIds : []).map(value => resolveCanonicalUserIdentifier(c.env.APP_DB, value))
      )).filter(Boolean) as string[]
      await replaceClassMemberships(c.env.APP_DB, tenantId, classId, 'caregiver', canonicalCaregiverIds)
    }

    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not update class.' }, 500)
  }
})

app.put('/api/school/classes', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const rows = Array.isArray(body.classes) ? body.classes : []
  if (!rows.length) return c.json({ error: 'classes array required.' }, 400)

  const results: Array<{ id: string, status: 'ok' | 'error', error?: string }> = []
  for (const row of rows) {
    const classId = String(row?.id || '').trim()
    if (!classId) {
      results.push({ id: '', status: 'error', error: 'Class id missing.' })
      continue
    }

    try {
      const existingClass = await c.env.APP_DB.prepare(
        `SELECT * FROM classes WHERE id = ? AND tenantId = ?`
      ).bind(classId, tenantId).first() as Record<string, any> | null
      if (!existingClass) {
        results.push({ id: classId, status: 'error', error: 'Class not found.' })
        continue
      }

      const normalizedTeacherId = row.classTeacherId !== undefined
        ? await resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, row.classTeacherId, {
          requireTeachingCapability: true,
          label: 'Class teacher',
        })
        : existingClass.classTeacherId

      await c.env.APP_DB.prepare(
        `UPDATE classes SET name = ?, arm = ?, classTeacherId = ? WHERE id = ? AND tenantId = ?`
      ).bind(
        row.name !== undefined ? String(row.name || '').trim() : existingClass.name,
        row.arm !== undefined ? String(row.arm || '').trim() : String(existingClass.arm || ''),
        normalizedTeacherId,
        classId,
        tenantId,
      ).run()

      const canonicalTeacherIds = (await Promise.all(
        Array.from(new Set([
          normalizedTeacherId,
          ...((Array.isArray(row.teacherIds) ? row.teacherIds : []).map((value: unknown) => String(value || '').trim()).filter(Boolean)),
        ].filter(Boolean))).map(value => resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, value, {
          requireTeachingCapability: true,
          label: 'Assigned teacher',
        }))
      )).filter(Boolean) as string[]
      const canonicalCaregiverIds = (await Promise.all(
        (Array.isArray(row.caregiverIds) ? row.caregiverIds : []).map(value => resolveCanonicalUserIdentifier(c.env.APP_DB, value))
      )).filter(Boolean) as string[]

      await replaceClassMemberships(c.env.APP_DB, tenantId, classId, 'teacher', canonicalTeacherIds)
      await replaceClassMemberships(c.env.APP_DB, tenantId, classId, 'caregiver', canonicalCaregiverIds)
      await syncTeacherClassAssignment(c.env.APP_DB, tenantId, {
        ...existingClass,
        id: classId,
        name: row.name !== undefined ? String(row.name || '').trim() : existingClass.name,
        arm: row.arm !== undefined ? String(row.arm || '').trim() : String(existingClass.arm || ''),
        classTeacherId: normalizedTeacherId,
      }, existingClass.classTeacherId)

      results.push({ id: classId, status: 'ok' })
    } catch (error) {
      results.push({ id: classId, status: 'error', error: error instanceof Error ? error.message : 'Could not save class.' })
    }
  }

  return c.json({ success: true, results })
})

app.delete('/api/school/classes/:classId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const classId = c.req.param('classId')

  try {
    const existingClass = await c.env.APP_DB.prepare(
      `SELECT * FROM classes WHERE id = ? AND tenantId = ?`
    ).bind(classId, tenantId).first() as Record<string, any> | null
    if (!existingClass) return c.json({ error: 'Class not found.' }, 404)

    const settingsRows = await c.env.APP_DB.prepare(
      `SELECT studentId, payload FROM settings WHERE json_extract(payload, '$.tenantId') = ? AND json_extract(payload, '$.classId') = ?`
    ).bind(tenantId, classId).all().catch(() => ({ results: [] }))
    for (const row of ((settingsRows.results || []) as Record<string, any>[])) {
      const payload = parseHeaderJsonObject(row.payload)
      delete payload.classId
      delete payload.className
      delete payload.classArm
      await upsertSettings(c.env.APP_DB, String(row.studentId || ''), payload)
    }

    await replaceClassMemberships(c.env.APP_DB, tenantId, classId, 'teacher', [])
    await replaceClassMemberships(c.env.APP_DB, tenantId, classId, 'caregiver', [])
    await c.env.APP_DB.prepare(`DELETE FROM subjects WHERE tenantId = ? AND classId = ?`).bind(tenantId, classId).run().catch(() => null)
    await c.env.APP_DB.prepare(`DELETE FROM classes WHERE id = ? AND tenantId = ?`).bind(classId, tenantId).run()
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Could not delete class.' }, 500)
  }
})

app.get('/api/school/subjects', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensureSubjectsTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM subjects WHERE tenantId = ? ORDER BY name`).bind(tenantId).all()
    return c.json({ success: true, subjects: rows.results || [] })
  } catch {
    return c.json({ success: true, subjects: [] })
  }
})

app.post('/api/school/subjects', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { name, classId, teacherId } = await c.req.json()
  if (!name) return c.json({ error: 'Subject name is required.' }, 400)
  const id = `subject_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    const normalizedClassId = String(classId || '').trim() || null
    const normalizedTeacherId = await resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, teacherId, {
      requireTeachingCapability: true,
      label: 'Assigned teacher',
    })
    if (normalizedTeacherId && !normalizedClassId) {
      return c.json({ error: 'Assign the subject to a class before assigning a teacher.' }, 400)
    }

    await ensureSubjectsTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(`INSERT INTO subjects (id, tenantId, name, classId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, tenantId, name, normalizedClassId, normalizedTeacherId, new Date().toISOString()).run()
    return c.json({ success: true, id }, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not add subject.' }, 500)
  }
})

app.post('/api/school/classes/:classId/subjects/bulk', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const classId = c.req.param('classId')
  const { subjects } = await c.req.json()
  if (!Array.isArray(subjects) || subjects.length === 0) return c.json({ error: 'subjects array required.' }, 400)
  try {
    await ensureSubjectsTable(c.env.APP_DB)
    let added = 0
    for (const name of subjects) {
      const trimmed = (name as string).trim()
      if (!trimmed) continue
      const id = `subject_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      await c.env.APP_DB.prepare(`INSERT INTO subjects (id, tenantId, name, classId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(id, tenantId, trimmed, classId, null, new Date().toISOString()).run()
      added++
    }
    return c.json({ success: true, added }, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not add subjects.' }, 500)
  }
})

app.put('/api/school/subjects/:subjectId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const subjectId = c.req.param('subjectId')
  const body = await c.req.json()
  const { name, classId, teacherId } = body
  try {
    const existingSubject = await c.env.APP_DB.prepare(`SELECT * FROM subjects WHERE id = ? AND tenantId = ?`).bind(subjectId, tenantId).first() as Record<string, any> | null
    if (!existingSubject) return c.json({ error: 'Subject not found.' }, 404)

    const sets: string[] = []
    const vals: unknown[] = []
    if (name !== undefined) { sets.push('name = ?'); vals.push(name) }
    const normalizedClassId = classId !== undefined
      ? (String(classId || '').trim() || null)
      : (String(existingSubject.classId || '').trim() || null)
    const normalizedTeacherId = teacherId !== undefined
      ? await resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, teacherId, {
        requireTeachingCapability: true,
        label: 'Assigned teacher',
      })
      : undefined
    if (normalizedTeacherId && !normalizedClassId) {
      return c.json({ error: 'Assign the subject to a class before assigning a teacher.' }, 400)
    }
    if (classId !== undefined) { sets.push('classId = ?'); vals.push(normalizedClassId) }
    if (teacherId !== undefined) { sets.push('teacherId = ?'); vals.push(normalizedTeacherId) }
    if (sets.length === 0) return c.json({ error: 'Nothing to update.' }, 400)
    vals.push(subjectId, tenantId)
    await c.env.APP_DB.prepare(`UPDATE subjects SET ${sets.join(', ')} WHERE id = ? AND tenantId = ?`).bind(...vals).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not update subject.' }, 500)
  }
})

app.delete('/api/school/subjects/:subjectId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const subjectId = c.req.param('subjectId')
  try {
    await c.env.APP_DB.prepare(`DELETE FROM subjects WHERE id = ? AND tenantId = ?`).bind(subjectId, tenantId).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not delete subject.' }, 500)
  }
})

// ─── Section-level bulk subject creation ──────────────────────────────────────
app.post('/api/school/sections/:sectionName/subjects/bulk', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const sectionName = decodeURIComponent(c.req.param('sectionName'))
  const { subjects, teacherId } = await c.req.json()
  if (!Array.isArray(subjects) || subjects.length === 0) return c.json({ error: 'subjects array required.' }, 400)
  try {
    await ensureSubjectsTable(c.env.APP_DB)
    await ensureClassesTable(c.env.APP_DB)
    const classRows = await c.env.APP_DB.prepare(
      `SELECT id FROM classes WHERE name = ? AND tenantId = ?`
    ).bind(sectionName, tenantId).all()
    const classIds = ((classRows.results || []) as Record<string, any>[]).map((r: any) => String(r.id || '').trim()).filter(Boolean)
    if (classIds.length === 0) return c.json({ error: 'No classes found in this section.' }, 404)
    let added = 0
    for (const classId of classIds) {
      for (const name of subjects) {
        const trimmed = String(name || '').trim()
        if (!trimmed) continue
        const existing = await c.env.APP_DB.prepare(
          `SELECT id FROM subjects WHERE tenantId = ? AND classId = ? AND lower(trim(name)) = lower(trim(?))`
        ).bind(tenantId, classId, trimmed).first()
        if (existing) continue
        const id = `subject_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const resolvedTeacherId = teacherId
          ? await resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, teacherId, {
            requireTeachingCapability: true,
            label: 'Assigned teacher',
          })
          : null
        await c.env.APP_DB.prepare(
          `INSERT INTO subjects (id, tenantId, name, classId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, tenantId, trimmed, classId, resolvedTeacherId, new Date().toISOString()).run()
        added++
      }
    }
    return c.json({ success: true, added, classCount: classIds.length }, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not add subjects to section.' }, 500)
  }
})

app.post('/api/school/subjects/assignments/bulk', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const teacherId = await resolveAssignableStaffIdentifier(c.env.APP_DB, tenantId, body.teacherId, {
    requireTeachingCapability: true,
    label: 'Assigned teacher',
  })
  const subjectNames = Array.from(new Set(
    (Array.isArray(body.subjectNames) ? body.subjectNames : [])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  ))
  const classIds = Array.from(new Set(
    (Array.isArray(body.classIds) ? body.classIds : [])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  ))
  const sectionNames = Array.from(new Set(
    (Array.isArray(body.sectionNames) ? body.sectionNames : [])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  ))
  const mode = String(body.mode || 'class').trim().toLowerCase()

  if (!teacherId) return c.json({ error: 'Teacher is required.' }, 400)
  if (!subjectNames.length) return c.json({ error: 'Select at least one subject.' }, 400)

  try {
    await ensureSubjectsTable(c.env.APP_DB)
    await ensureClassesTable(c.env.APP_DB)

    const filters: string[] = ['s.tenantId = ?']
    const params: Array<string> = [tenantId]

    const subjectPlaceholders = subjectNames.map(() => '?').join(', ')
    filters.push(`lower(trim(s.name)) IN (${subjectPlaceholders})`)
    params.push(...subjectNames.map(value => value.toLowerCase()))

    if (mode === 'class' && classIds.length > 0) {
      const placeholders = classIds.map(() => '?').join(', ')
      filters.push(`s.classId IN (${placeholders})`)
      params.push(...classIds)
    } else if (mode === 'section' && sectionNames.length > 0) {
      const placeholders = sectionNames.map(() => '?').join(', ')
      filters.push(`c.name IN (${placeholders})`)
      params.push(...sectionNames)
    }

    const targetRows = await c.env.APP_DB.prepare(
      `SELECT s.id
       FROM subjects s
       LEFT JOIN classes c ON c.id = s.classId AND c.tenantId = s.tenantId
       WHERE ${filters.join(' AND ')}`
    ).bind(...params).all()

    const subjectIds = ((targetRows.results || []) as Record<string, any>[]).map(row => String(row.id || '').trim()).filter(Boolean)
    if (!subjectIds.length) return c.json({ error: 'No matching subject records were found.' }, 404)

    for (const subjectId of subjectIds) {
      await c.env.APP_DB.prepare(
        `UPDATE subjects SET teacherId = ? WHERE id = ? AND tenantId = ?`
      ).bind(teacherId, subjectId, tenantId).run()
    }

    return c.json({ success: true, updated: subjectIds.length })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Could not bulk assign subjects.' }, 500)
  }
})

// ─── Subject exclusions (remove/restore student from a subject) ───────────────
app.post('/api/classrooms/:classroomId/subjects/:subjectId/remove-student', authenticate, async (c) => {
  const actor = c.var.user || {}
  const role = actor.role
  const tenantId = actor.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const classroomId = c.req.param('classroomId')
  const subjectId = c.req.param('subjectId')
  const { studentId } = await c.req.json()
  if (!studentId) return c.json({ error: 'studentId required.' }, 400)
  try {
    await c.env.APP_DB.prepare(
      `CREATE TABLE IF NOT EXISTS subject_exclusions (id TEXT PRIMARY KEY, tenantId TEXT, subjectId TEXT, classId TEXT, studentId TEXT, createdAt TEXT, createdBy TEXT)`
    ).run()
    await ensureClassesTable(c.env.APP_DB)
    const classRow = await c.env.APP_DB.prepare(
      `SELECT id, classTeacherId FROM classes WHERE id = ? AND tenantId = ?`
    ).bind(classroomId, tenantId).first() as Record<string, any> | null
    if (!classRow) return c.json({ error: 'Class not found.' }, 404)
    const isAdmin = hasRequiredRole(role, ['owner', 'hos', 'ict', 'ict_manager'])
    const teacherIdentifiers = collectComparableIdentifiers([actor.id, actor.email, actor.sub].filter(Boolean))
    const isClassTeacher = matchesComparableIdentifier(classRow.classTeacherId, teacherIdentifiers)
      || await classHasMembershipTeacher(c.env.APP_DB, tenantId, classRow.id, teacherIdentifiers)
    if (!isAdmin && !isClassTeacher) return c.json({ error: 'forbidden' }, 403)
    const id = `excl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    await c.env.APP_DB.prepare(
      `INSERT OR IGNORE INTO subject_exclusions (id, tenantId, subjectId, classId, studentId, createdAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, tenantId, subjectId, classroomId, studentId, new Date().toISOString(), actor.id || '').run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not remove student.' }, 500)
  }
})

app.delete('/api/classrooms/:classroomId/subjects/:subjectId/remove-student/:studentId', authenticate, async (c) => {
  const actor = c.var.user || {}
  const role = actor.role
  const tenantId = actor.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const classroomId = c.req.param('classroomId')
  const subjectId = c.req.param('subjectId')
  const studentId = c.req.param('studentId')
  try {
    await c.env.APP_DB.prepare(
      `CREATE TABLE IF NOT EXISTS subject_exclusions (id TEXT PRIMARY KEY, tenantId TEXT, subjectId TEXT, classId TEXT, studentId TEXT, createdAt TEXT, createdBy TEXT)`
    ).run()
    await ensureClassesTable(c.env.APP_DB)
    const classRow = await c.env.APP_DB.prepare(
      `SELECT id, classTeacherId FROM classes WHERE id = ? AND tenantId = ?`
    ).bind(classroomId, tenantId).first() as Record<string, any> | null
    if (!classRow) return c.json({ error: 'Class not found.' }, 404)
    const isAdmin = hasRequiredRole(role, ['owner', 'hos', 'ict', 'ict_manager'])
    const teacherIdentifiers = collectComparableIdentifiers([actor.id, actor.email, actor.sub].filter(Boolean))
    const isClassTeacher = matchesComparableIdentifier(classRow.classTeacherId, teacherIdentifiers)
      || await classHasMembershipTeacher(c.env.APP_DB, tenantId, classRow.id, teacherIdentifiers)
    if (!isAdmin && !isClassTeacher) return c.json({ error: 'forbidden' }, 403)
    await c.env.APP_DB.prepare(
      `DELETE FROM subject_exclusions WHERE tenantId = ? AND subjectId = ? AND classId = ? AND studentId = ?`
    ).bind(tenantId, subjectId, classroomId, studentId).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not restore student.' }, 500)
  }
})

app.get('/api/classrooms/:classroomId/subjects/:subjectId/members', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const classroomId = c.req.param('classroomId')
  const subjectId = c.req.param('subjectId')
  try {
    await c.env.APP_DB.prepare(
      `CREATE TABLE IF NOT EXISTS subject_exclusions (id TEXT PRIMARY KEY, tenantId TEXT, subjectId TEXT, classId TEXT, studentId TEXT, createdAt TEXT, createdBy TEXT)`
    ).run()
    await ensureUsersTable(c.env.APP_DB)
    const exclusionRows = await c.env.APP_DB.prepare(
      `SELECT studentId FROM subject_exclusions WHERE tenantId = ? AND subjectId = ? AND classId = ?`
    ).bind(tenantId, subjectId, classroomId).all()
    const excludedIds = new Set(((exclusionRows.results || []) as Record<string, any>[]).map((r: any) => String(r.studentId || '')))
    const studentRows = await c.env.APP_DB.prepare(
      `SELECT u.id, u.name, u.email, u.role, u.status
       FROM users u
       JOIN settings s ON (s.studentId = u.email OR s.studentId = u.id)
       WHERE u.tenantId = ? AND u.role = 'student' AND (u.status IS NULL OR u.status != 'inactive')
         AND json_extract(s.payload, '$.classId') = ?
       ORDER BY u.name`
    ).bind(tenantId, classroomId).all().catch(() => ({ results: [] }))
    const members = ((studentRows.results || []) as Record<string, any>[]).map((r: any) => ({
      id: r.id, name: r.name, email: r.email, role: r.role, status: r.status,
      excluded: excludedIds.has(String(r.id || ''))
    }))
    return c.json({ success: true, members })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not load subject members.' }, 500)
  }
})

app.get('/api/school/session', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    const sessionState = await listSchoolSessionHistory(c.env.APP_DB, tenantId)
    return c.json({ success: true, session: sessionState.current, history: sessionState.history })
  } catch {
    return c.json({ success: true, session: null, history: [] })
  }
})

app.post('/api/school/session', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { session, term, startDate, endDate } = await c.req.json()
  const normalizedSession = normalizeFeeConfigPeriodValue(session)
  const normalizedTerm = normalizeFeeConfigPeriodValue(term || 'Term 1') || 'Term 1'
  try {
    await ensureSchoolSessionsTable(c.env.APP_DB)
    const latestRow = await c.env.APP_DB.prepare(
      `SELECT * FROM school_sessions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1`
    ).bind(tenantId).first() as Record<string, any> | null
    const sameCurrent = String(latestRow?.session || '').trim() === normalizedSession
      && String(latestRow?.term || '').trim() === normalizedTerm
    const id = sameCurrent && latestRow?.id
      ? String(latestRow.id)
      : `session_${tenantId}_${Date.now()}_${slugifyValue(normalizedSession || 'session').slice(0, 30)}_${slugifyValue(normalizedTerm || 'term').slice(0, 20)}`
    const createdAt = new Date().toISOString()

    await c.env.APP_DB.prepare(
      `INSERT OR REPLACE INTO school_sessions (id, tenantId, session, term, startDate, endDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, tenantId, normalizedSession, normalizedTerm, startDate || '', endDate || '', createdAt).run()

    const sessionState = await listSchoolSessionHistory(c.env.APP_DB, tenantId)
    return c.json({ success: true, session: sessionState.current, history: sessionState.history })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not save session.' }, 500)
  }
})

app.get('/api/results/templates', authenticate, async (c) => {
  return c.json({ success: true, templates: RESULT_TEMPLATE_CATALOG, suggestedSettings: getSuggestedResultSettings() })
})

app.get('/api/results/settings', authenticate, async (c) => {
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const stored = await getResultSettings(c.env.APP_DB, tenant.id)
  const tenantBranding = await getTenantSchoolBranding(c.env.APP_DB, tenant)
  const settings = attachTenantBrandingToResultSettings({ ...stored, ...normalizeResultSettingsInput(stored) }, tenantBranding)
  const suggestedSettings = attachTenantBrandingToResultSettings(getSuggestedResultSettings(), tenantBranding)
  const configurationError = validateResultSettings(settings)

  return c.json({
    success: true,
    settings,
    templates: RESULT_TEMPLATE_CATALOG,
    suggestedSettings,
    configurationReady: !configurationError,
    configurationError,
    canManageSettings: hasRequiredRole(c.var.user.role, RESULT_SETTINGS_EDITOR_ROLES),
  })
})

app.post('/api/results/settings', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, RESULT_SETTINGS_EDITOR_ROLES)) return c.json({ error: 'forbidden' }, 403)
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const actorId = String(c.var.user?.id || c.var.user?.email || c.var.user?.sub || '').trim()
  const normalized = normalizeResultSettingsInput(await c.req.json().catch(() => ({})))
  const configurationError = validateResultSettings(normalized)
  if (configurationError) return c.json({ error: configurationError }, 400)

  const saved = await saveResultSettings(c.env.APP_DB, tenant.id, normalized, actorId)
  const tenantBranding = await getTenantSchoolBranding(c.env.APP_DB, tenant)
  const settings = attachTenantBrandingToResultSettings({ ...saved, ...normalizeResultSettingsInput(saved) }, tenantBranding)
  return c.json({ success: true, settings, configurationReady: true, configurationError: '' })
})

app.get('/api/results/sheet', authenticate, async (c) => {
  const query = c.req.query()
  const classId = String(query.classId || '').trim()
  if (!classId) return c.json({ error: 'classId is required.' }, 400)

  const access = await resolveResultClassAccess(c.env.APP_DB, c.var.user || {}, classId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.classRow) return c.json({ error: 'Class not found.' }, 404)
  if (!access.canManageEntries && !access.isElevatedManager) return c.json({ error: 'forbidden' }, 403)

  const period = await resolveCurrentResultPeriod(c.env.APP_DB, access.tenantId, query.sessionName || query.session, query.termName || query.term)
  const tenant = await getTenantById(c.env.APP_DB, access.tenantId)
  const tenantBranding = await getTenantSchoolBranding(c.env.APP_DB, tenant)
  const storedSettings = await getResultSettings(c.env.APP_DB, access.tenantId)
  const settings = attachTenantBrandingToResultSettings({ ...storedSettings, ...normalizeResultSettingsInput(storedSettings) }, tenantBranding)
  const configurationError = validateResultSettings(settings)
  const batch = await getResultBatch(c.env.APP_DB, access.tenantId, classId, period.sessionName, period.termName)
  const [entries, profiles, students] = await Promise.all([
    listResultEntries(c.env.APP_DB, batch.id),
    listResultStudentProfiles(c.env.APP_DB, batch.id),
    listResultClassStudents(c.env.APP_DB, access.tenantId, access.classRow),
  ])

  return c.json({
    success: true,
    period,
    settings,
    configurationReady: !configurationError,
    configurationError,
    templates: RESULT_TEMPLATE_CATALOG,
    classroom: {
      id: String(access.classRow.id || ''),
      className: `${access.classRow.name}${access.classRow.arm ? ` ${access.classRow.arm}` : ''}`,
      isClassTeacher: access.isClassTeacher,
    },
    permissions: {
      canManageEntries: access.canManageEntries,
      canManageProfiles: access.canManageProfiles,
      canSubmit: access.canManageProfiles || RESULT_APPROVER_ROLES.includes(access.normalizedRole),
      canPublish: RESULT_APPROVER_ROLES.includes(access.normalizedRole),
    },
    subjects: access.allowedSubjectRows.map(subject => ({
      id: String(subject.id || ''),
      name: String(subject.name || ''),
      teacherId: String(subject.teacherId || ''),
    })),
    students,
    batch,
    entries,
    profiles,
  })
})

app.post('/api/results/entries', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, RESULT_ENTRY_EDITOR_ROLES)) return c.json({ error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const classId = String(body.classId || '').trim()
  if (!classId) return c.json({ error: 'classId is required.' }, 400)

  const access = await resolveResultClassAccess(c.env.APP_DB, c.var.user || {}, classId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.classRow) return c.json({ error: 'Class not found.' }, 404)
  if (!access.canManageEntries) return c.json({ error: 'You are not allowed to enter scores for this class.' }, 403)

  const period = await resolveCurrentResultPeriod(c.env.APP_DB, access.tenantId, body.sessionName || body.session, body.termName || body.term)
  await ensureSessionTermExists(c.env.APP_DB, access.tenantId, period.sessionName, period.termName)
  const storedSettings = await getResultSettings(c.env.APP_DB, access.tenantId)
  const settings = { ...storedSettings, ...normalizeResultSettingsInput(storedSettings) }
  const configurationError = validateResultSettings(settings)
  if (configurationError) return c.json({ error: configurationError }, 400)

  const students = await listResultClassStudents(c.env.APP_DB, access.tenantId, access.classRow)
  const allowedStudentIds = new Set(students.map(student => String(student.id || '')))
  const allowedSubjects = new Map(access.allowedSubjectRows.map(subject => [String(subject.id || ''), subject]))
  const scoreSettings = normalizeResultScoreSettings(settings.metadata, RESULT_DEFAULT_SCORE_LIMITS)
  const caComponents = normalizeResultCaComponentList(settings.metadata?.caComponents, RESULT_DEFAULT_CA_COMPONENTS, 8, scoreSettings.caMaxScore)
  const rows = Array.isArray(body.rows) ? body.rows : []
  const normalizedRows = rows
    .map((row: any) => {
      const subject = allowedSubjects.get(String(row.subjectId || ''))
      const studentId = String(row.studentId || '')
      if (!subject || !allowedStudentIds.has(studentId)) return null

      const componentScores = normalizeResultEntryCaComponents(row.caComponents, caComponents, row.caScore, scoreSettings.caMaxScore)

      return {
        studentId,
        subjectId: String(subject.id || ''),
        subjectName: String(subject.name || ''),
        teacherId: String(subject.teacherId || access.actorId || ''),
        caComponents: componentScores,
        caScore: sumResultEntryCaComponents(componentScores, caComponents, scoreSettings.caMaxScore),
        examScore: clampResultScore(row.examScore, scoreSettings.examMaxScore),
      }
    })
    .filter(Boolean) as Array<Record<string, any>>

  if (normalizedRows.length === 0) return c.json({ error: 'No valid score rows were provided.' }, 400)

  const batch = await upsertResultEntries(c.env.APP_DB, {
    tenantId: access.tenantId,
    classId,
    sessionName: period.sessionName,
    termName: period.termName,
    actorId: access.actorId,
    templateKey: settings.templateKey,
    settingsSnapshot: settings,
    rows: normalizedRows,
  })

  return c.json({ success: true, batch, savedRows: normalizedRows.length })
})

app.post('/api/results/profiles', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, RESULT_ENTRY_EDITOR_ROLES)) return c.json({ error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const classId = String(body.classId || '').trim()
  if (!classId) return c.json({ error: 'classId is required.' }, 400)

  const access = await resolveResultClassAccess(c.env.APP_DB, c.var.user || {}, classId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.classRow) return c.json({ error: 'Class not found.' }, 404)
  if (!access.canManageProfiles) return c.json({ error: 'Only the class teacher, HoS, owner, or ICT manager can update class result profiles.' }, 403)

  const period = await resolveCurrentResultPeriod(c.env.APP_DB, access.tenantId, body.sessionName || body.session, body.termName || body.term)
  await ensureSessionTermExists(c.env.APP_DB, access.tenantId, period.sessionName, period.termName)
  const storedSettings = await getResultSettings(c.env.APP_DB, access.tenantId)
  const settings = { ...storedSettings, ...normalizeResultSettingsInput(storedSettings) }
  const configurationError = validateResultSettings(settings)
  if (configurationError) return c.json({ error: configurationError }, 400)

  const students = await listResultClassStudents(c.env.APP_DB, access.tenantId, access.classRow)
  const allowedStudentIds = new Set(students.map(student => String(student.id || '')))
  const affectiveDomains = normalizeResultDomainList(settings.affectiveDomains, RESULT_DEFAULT_AFFECTIVE_DOMAINS, 8)
  const ratingDomains = normalizeResultDomainList(settings.metadata?.ratingDomains, RESULT_DEFAULT_RATING_DOMAINS, 8)
  const affectiveMax = Math.max(...settings.affectiveScale.map((entry: any) => Number(entry.value || 0)), 5)
  const ratingMax = Math.max(...settings.ratingScale.map((entry: any) => Number(entry.value || 0)), 5)
  const allowedAffectiveKeys = new Set(affectiveDomains.map(domain => domain.key))
  const allowedRatingKeys = new Set(ratingDomains.map(domain => domain.key))
  const rows = Array.isArray(body.rows) ? body.rows : []
  const normalizedRows = rows
    .map((row: any) => {
      const studentId = String(row.studentId || '')
      if (!allowedStudentIds.has(studentId)) return null

      const affective = Object.fromEntries(
        Object.entries((row.affective && typeof row.affective === 'object') ? row.affective : {})
          .filter(([key]) => allowedAffectiveKeys.has(String(key)))
          .map(([key, value]) => [String(key), clampResultScore(value, affectiveMax)])
      )
      const ratings = Object.fromEntries(
        Object.entries((row.ratings && typeof row.ratings === 'object') ? row.ratings : {})
          .filter(([key]) => allowedRatingKeys.has(String(key)))
          .map(([key, value]) => [String(key), clampResultScore(value, ratingMax)])
      )

      return {
        studentId,
        attendanceRate: clampResultScore(row.attendanceRate, 100),
        affective,
        ratings,
        teacherRemark: String(row.teacherRemark || '').trim(),
        principalRemark: String(row.principalRemark || '').trim(),
        promotionStatus: String(row.promotionStatus || '').trim(),
      }
    })
    .filter(Boolean) as Array<Record<string, any>>

  if (normalizedRows.length === 0) return c.json({ error: 'No valid student profile rows were provided.' }, 400)

  const batch = await upsertResultStudentProfiles(c.env.APP_DB, {
    tenantId: access.tenantId,
    classId,
    sessionName: period.sessionName,
    termName: period.termName,
    actorId: access.actorId,
    templateKey: settings.templateKey,
    settingsSnapshot: settings,
    rows: normalizedRows,
  })

  return c.json({ success: true, batch, savedRows: normalizedRows.length })
})

app.post('/api/results/batch-status', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const classId = String(body.classId || '').trim()
  const status = String(body.status || '').trim().toLowerCase()
  if (!classId || !['draft', 'submitted'].includes(status)) return c.json({ error: 'classId and a valid status are required.' }, 400)

  const access = await resolveResultClassAccess(c.env.APP_DB, c.var.user || {}, classId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.classRow) return c.json({ error: 'Class not found.' }, 404)
  if (!access.canManageProfiles && !RESULT_APPROVER_ROLES.includes(access.normalizedRole)) {
    return c.json({ error: 'Only the class teacher, HoS, or owner can submit this batch.' }, 403)
  }

  const period = await resolveCurrentResultPeriod(c.env.APP_DB, access.tenantId, body.sessionName || body.session, body.termName || body.term)
  await ensureSessionTermExists(c.env.APP_DB, access.tenantId, period.sessionName, period.termName)
  const storedSettings = await getResultSettings(c.env.APP_DB, access.tenantId)
  const settings = { ...storedSettings, ...normalizeResultSettingsInput(storedSettings) }
  if (status === 'submitted') {
    const configurationError = validateResultSettings(settings)
    if (configurationError) return c.json({ error: configurationError }, 400)
  }

  const batch = await updateResultBatchStatus(c.env.APP_DB, {
    tenantId: access.tenantId,
    classId,
    sessionName: period.sessionName,
    termName: period.termName,
    actorId: access.actorId,
    status: status as 'draft' | 'submitted',
    templateKey: settings.templateKey,
    settingsSnapshot: settings,
  })

  return c.json({ success: true, batch })
})

app.post('/api/results/publish', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, RESULT_APPROVER_ROLES)) return c.json({ error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({}))
  const classId = String(body.classId || '').trim()
  if (!classId) return c.json({ error: 'classId is required.' }, 400)

  const access = await resolveResultClassAccess(c.env.APP_DB, c.var.user || {}, classId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.classRow) return c.json({ error: 'Class not found.' }, 404)

  const period = await resolveCurrentResultPeriod(c.env.APP_DB, access.tenantId, body.sessionName || body.session, body.termName || body.term)
  await ensureSessionTermExists(c.env.APP_DB, access.tenantId, period.sessionName, period.termName)
  const tenant = await getTenantById(c.env.APP_DB, access.tenantId)
  const tenantBranding = await getTenantSchoolBranding(c.env.APP_DB, tenant)
  const storedSettings = await getResultSettings(c.env.APP_DB, access.tenantId)
  const settings = attachTenantBrandingToResultSettings({ ...storedSettings, ...normalizeResultSettingsInput(storedSettings) }, tenantBranding)
  const configurationError = validateResultSettings(settings)
  if (configurationError) return c.json({ error: configurationError }, 400)

  const batch = await getResultBatch(c.env.APP_DB, access.tenantId, classId, period.sessionName, period.termName)
  const [entries, profiles, students] = await Promise.all([
    listResultEntries(c.env.APP_DB, batch.id),
    listResultStudentProfiles(c.env.APP_DB, batch.id),
    listResultClassStudents(c.env.APP_DB, access.tenantId, access.classRow),
  ])

  if (entries.length === 0) return c.json({ error: 'No CA score rows were found for this batch.' }, 400)

  const publications = buildPublishedResultPayloads({
    students,
    entries,
    profiles,
    settings,
    batch: { ...batch, sessionName: period.sessionName, termName: period.termName },
    className: `${access.classRow.name}${access.classRow.arm ? ` ${access.classRow.arm}` : ''}`,
    actorName: access.actorName,
  })
  if (publications.length === 0) return c.json({ error: 'No publishable student results were generated from the CA score sheet.' }, 400)

  const publishedBatch = await saveResultPublications(c.env.APP_DB, {
    tenantId: access.tenantId,
    classId,
    sessionName: period.sessionName,
    termName: period.termName,
    actorId: access.actorId,
    templateKey: settings.templateKey,
    settingsSnapshot: settings,
    publications,
  })

  return c.json({ success: true, batch: publishedBatch, publishedCount: publications.length })
})

app.get('/api/results/overview', authenticate, async (c) => {
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  await ensureResultsTables(c.env.APP_DB)
  const stored = await getResultSettings(c.env.APP_DB, tenant.id)
  const tenantBranding = await getTenantSchoolBranding(c.env.APP_DB, tenant)
  const settings = attachTenantBrandingToResultSettings({ ...stored, ...normalizeResultSettingsInput(stored) }, tenantBranding)
  const suggestedSettings = attachTenantBrandingToResultSettings(getSuggestedResultSettings(), tenantBranding)
  const configurationError = validateResultSettings(settings)
  const [batches, recentDocuments] = await Promise.all([
    listResultBatches(c.env.APP_DB, tenant.id),
    listRecentResultDocuments(c.env.APP_DB, tenant.id, 80),
  ])

  return c.json({
    success: true,
    settings,
    templates: RESULT_TEMPLATE_CATALOG,
    suggestedSettings,
    configurationReady: !configurationError,
    configurationError,
    batches,
    recentDocuments,
    canManageSettings: hasRequiredRole(c.var.user.role, RESULT_SETTINGS_EDITOR_ROLES),
    canPublish: hasRequiredRole(c.var.user.role, RESULT_APPROVER_ROLES),
    canUploadDocuments: hasRequiredRole(c.var.user.role, RESULT_DOCUMENT_UPLOADER_ROLES),
  })
})

app.get('/api/results/records', authenticate, async (c) => {
  const currentUser = c.var.user || {}
  const userIdentifier = currentUser.id || currentUser.email || currentUser.sub || ''
  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || currentUser.tenantId
  const normalizedRole = getActiveRole(currentUser)
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const queryStudentId = String(c.req.query('studentId') || '').trim()
  let students: Array<Record<string, any>> = []

  if (normalizedRole === 'student') {
    const selfRow = await findUserByIdentifier(c.env.APP_DB, String(resolvedUser.userRow?.id || resolvedUser.settingsKey || userIdentifier || '')).catch(() => null)
    const hydrated = await hydrateUserRecords(c.env.APP_DB, selfRow ? [selfRow] : [])
    students = hydrated.map(student => ({
      id: String(student?.id || ''),
      name: String(student?.name || ''),
      email: String(student?.email || ''),
      displayId: String(student?.displayId || ''),
      classId: String(student?.classId || ''),
      className: String(student?.className || ''),
    }))
  } else if (normalizedRole === 'parent') {
    await ensureParentStudentLinksTable(c.env.APP_DB)
    const parentIdentifiers = Array.from(new Set(collectResolvedIdentityIdentifiers(resolvedUser, currentUser).filter(Boolean)))
    if (parentIdentifiers.length > 0) {
      const placeholders = parentIdentifiers.map(() => '?').join(', ')
      const linkRows = await c.env.APP_DB.prepare(
        `SELECT DISTINCT student_id FROM parent_student_links WHERE tenant_id = ? AND parent_id IN (${placeholders})`
      ).bind(tenantId, ...parentIdentifiers).all()
      const linkedStudentRows = await Promise.all(
        ((linkRows.results || []) as Record<string, any>[]).map(row => findUserByIdentifier(c.env.APP_DB, String(row.student_id || '')).catch(() => null))
      )
      const hydrated = await hydrateUserRecords(c.env.APP_DB, linkedStudentRows.filter(Boolean) as Record<string, any>[])
      students = hydrated.map(student => ({
        id: String(student?.id || ''),
        name: String(student?.name || ''),
        email: String(student?.email || ''),
        displayId: String(student?.displayId || ''),
        classId: String(student?.classId || ''),
        className: String(student?.className || ''),
      }))
    }
  } else if (queryStudentId && RESULT_SETTINGS_EDITOR_ROLES.concat(RESULT_APPROVER_ROLES).includes(normalizedRole)) {
    const requested = await findUserByIdentifier(c.env.APP_DB, queryStudentId).catch(() => null)
    const hydrated = await hydrateUserRecords(c.env.APP_DB, requested ? [requested] : [])
    students = hydrated
      .filter(student => String(student?.role || '').toLowerCase() === 'student' && String(student?.tenantId || '') === String(tenantId))
      .map(student => ({
        id: String(student?.id || ''),
        name: String(student?.name || ''),
        email: String(student?.email || ''),
        displayId: String(student?.displayId || ''),
        classId: String(student?.classId || ''),
        className: String(student?.className || ''),
      }))
  }

  if (students.length === 0) {
    return c.json({ success: true, students: [], activeStudentId: '', lockedByFees: false, feeStatus: 'Not Tracked', publications: [], documents: [] })
  }

  const selectedStudent = students.find(student => [student.id, student.email, student.displayId].includes(queryStudentId)) || students[0]
  const feeState = await getStudentFeeStatus(c.env.APP_DB, tenantId, String(selectedStudent.id || ''))
  const [publications, documents] = await Promise.all([
    listStudentResultPublications(c.env.APP_DB, tenantId, String(selectedStudent.id || '')),
    listStudentResultDocuments(c.env.APP_DB, tenantId, String(selectedStudent.id || '')),
  ])
  const hideSensitiveContent = ['student', 'parent'].includes(normalizedRole) && feeState.locked

  return c.json({
    success: true,
    role: normalizedRole,
    students,
    activeStudentId: String(selectedStudent.id || ''),
    lockedByFees: hideSensitiveContent,
    feeStatus: feeState.status,
    publications: hideSensitiveContent
      ? publications.map(publication => ({ ...publication, payload: null }))
      : publications.map(publication => ({
        ...publication,
        verificationUrl: buildResultVerificationUrl(new URL(c.req.url).origin, String(publication.id || '')),
      })),
    documents: hideSensitiveContent ? [] : documents,
  })
})

// ─── Student 360° profile (results, assignments, attendance, records, AI report) ─────────────
const STUDENT_RECORD_CATEGORIES = ['punishment', 'reward', 'comment', 'report', 'recommendation', 'scholarship', 'competition', 'note']
const STUDENT_PROFILE_MANAGER_ROLES = ['owner', 'hos', 'ict', 'ict_manager', 'admin', 'teacher', 'classteacher', 'accountant', 'principal', 'viceprincipal', 'headteacher', 'nurseryhead', 'examofficer', 'hod', 'hodassistant']

async function ensureStudentRecordsTable(db: D1Database) {
  if (_initializedTables.has('student_records')) return
  _initializedTables.add('student_records')
  await db.prepare(`CREATE TABLE IF NOT EXISTS student_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    student_id TEXT,
    category TEXT,
    title TEXT,
    detail TEXT,
    metadata_json TEXT,
    created_by TEXT,
    created_by_name TEXT,
    created_at TEXT
  )`).run()
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_student_records_student ON student_records(tenant_id, student_id, category)`,
  ])
}

function mapStudentRecordRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    category: String(row.category || 'note'),
    title: String(row.title || ''),
    detail: String(row.detail || ''),
    metadata: parseJsonField(row.metadata_json, {} as Record<string, any>),
    createdBy: String(row.created_by || ''),
    createdByName: String(row.created_by_name || ''),
    createdAt: String(row.created_at || ''),
  }
}

// Decide who can see/manage a student's full profile: school staff (manage), the linked parent
// (read), or the student themselves (read).
async function resolveStudentProfileAccess(db: D1Database, actorUser: Record<string, any>, studentId: string) {
  const userIdentifier = actorUser.id || actorUser.email || actorUser.sub || ''
  const resolved = await resolveSettingsIdentity(db, userIdentifier)
  const tenantId = resolved.settings?.tenantId || resolved.settings?.schoolId || resolved.userRow?.tenantId || actorUser.tenantId
  const role = String(resolved.settings?.role || resolved.userRow?.role || actorUser.role || '').trim().toLowerCase()
  const actorId = String(resolved.userRow?.id || resolved.settingsKey || userIdentifier || '').trim()
  const actorName = String(resolved.settings?.name || resolved.userRow?.name || actorUser.name || actorId).trim()

  const studentRow = await findUserByIdentifier(db, studentId).catch(() => null)
  const student = ((await hydrateUserRecords(db, studentRow ? [studentRow] : []))[0]) as Record<string, any> | undefined
  if (!student || String(student.tenantId || '') !== String(tenantId || '') || String(student.role || '').toLowerCase() !== 'student') {
    return { ok: false, canManage: false, tenantId, role, actorId, actorName, student: null as Record<string, any> | null }
  }

  const canManage = STUDENT_PROFILE_MANAGER_ROLES.includes(role)
  let canView = canManage
  const actorIdentifiers = collectResolvedIdentityIdentifiers(resolved, actorUser).map(value => String(value || '').toLowerCase()).filter(Boolean)
  if (!canView && role === 'student') {
    canView = [student.id, student.email, student.displayId].some(value => actorIdentifiers.includes(String(value || '').toLowerCase()))
  }
  if (!canView && role === 'parent') {
    await ensureParentStudentLinksTable(db)
    const parentIds = collectResolvedIdentityIdentifiers(resolved, actorUser).filter(Boolean)
    if (parentIds.length) {
      const placeholders = parentIds.map(() => '?').join(', ')
      const link = await db.prepare(
        `SELECT 1 FROM parent_student_links WHERE tenant_id = ? AND student_id = ? AND parent_id IN (${placeholders}) LIMIT 1`
      ).bind(tenantId, String(student.id || ''), ...parentIds).first().catch(() => null)
      canView = Boolean(link)
    }
  }

  return { ok: canView, canManage, tenantId, role, actorId, actorName, student }
}

// Most-frequently-contacted people for a student, derived from conversations + message volume.
async function buildStudentFrequentContacts(db: D1Database, student: Record<string, any>) {
  try {
    const identifiers = [student.id, student.email, student.displayId].map(value => String(value || '').trim()).filter(Boolean)
    if (!identifiers.length) return [] as Array<Record<string, any>>

    const likeClauses = identifiers.map(() => 'participants LIKE ?').join(' OR ')
    const convResult = await db.prepare(
      `SELECT id, participants FROM conversations WHERE ${likeClauses} ORDER BY updated_at DESC LIMIT 80`
    ).bind(...identifiers.map(value => `%${value}%`)).all()
    const conversations = ((convResult.results || []) as Record<string, any>[])
      .map(row => ({ id: String(row.id || ''), participants: (() => { try { return JSON.parse(String(row.participants || '[]')).map((value: any) => String(value)) } catch { return [] as string[] } })() }))
      .filter(conv => conv.id && conv.participants.some((value: string) => identifiers.includes(value)))
    if (!conversations.length) return []

    const convIds = conversations.map(conv => conv.id)
    const idPlaceholders = convIds.map(() => '?').join(', ')
    const msgResult = await db.prepare(
      `SELECT conversation_id, COUNT(*) as n FROM messages WHERE conversation_id IN (${idPlaceholders}) GROUP BY conversation_id`
    ).bind(...convIds).all().catch(() => ({ results: [] }))
    const countByConv = new Map<string, number>()
    for (const row of (((msgResult as any).results || []) as Record<string, any>[])) {
      countByConv.set(String(row.conversation_id || ''), Number(row.n || 0))
    }

    const byContact = new Map<string, number>()
    conversations.forEach(conv => {
      const messages = countByConv.get(conv.id) || 0
      conv.participants
        .filter((value: string) => !identifiers.includes(value))
        .forEach((other: string) => byContact.set(other, (byContact.get(other) || 0) + messages))
    })

    const top = Array.from(byContact.entries()).sort((left, right) => right[1] - left[1]).slice(0, 8)
    const contacts: Array<Record<string, any>> = []
    for (const [identifier, messageCount] of top) {
      const row = await findUserByIdentifier(db, identifier).catch(() => null)
      const name = String(row?.name || '').trim() || identifier.replace(/[_-]+/g, ' ').replace(/@.*/, '').trim() || 'Contact'
      contacts.push({ id: identifier, name, role: String(row?.role || '').trim(), messageCount })
    }
    return contacts
  } catch {
    return [] as Array<Record<string, any>>
  }
}

// Aggregate the data the profile shows (and feeds to the AI report). Every per-source query is
// defensive so a missing/older table never breaks the whole profile.
async function buildStudentProfileSnapshot(db: D1Database, tenantId: string, student: Record<string, any>) {
  const sid = String(student.id || '')
  const classId = String(student.classId || '')

  const [publications, documents] = await Promise.all([
    listStudentResultPublications(db, tenantId, sid).catch(() => [] as Record<string, any>[]),
    listStudentResultDocuments(db, tenantId, sid).catch(() => [] as Record<string, any>[]),
  ])

  let assignments = { total: 0, completed: 0, notDone: 0, graded: 0, averageScore: 0 }
  try {
    const totalRow = classId
      ? await db.prepare(`SELECT COUNT(*) as n FROM assignments WHERE classId = ?`).bind(classId).first() as Record<string, any> | null
      : null
    const subResult = await db.prepare(`SELECT grade FROM submissions WHERE studentId = ?`).bind(sid).all()
    const subs = (subResult.results || []) as Record<string, any>[]
    const graded = subs.filter(row => row.grade !== null && row.grade !== undefined)
    const total = Number(totalRow?.n || 0)
    assignments = {
      total,
      completed: subs.length,
      notDone: Math.max(total - subs.length, 0),
      graded: graded.length,
      averageScore: graded.length ? Math.round(graded.reduce((sum, row) => sum + Number(row.grade || 0), 0) / graded.length) : 0,
    }
  } catch {}

  let attendance = { present: 0, absent: 0, late: 0, excused: 0, total: 0, rate: 0 }
  try {
    const rows = await db.prepare(
      `SELECT lower(trim(coalesce(status, 'present'))) as st, COUNT(*) as n FROM student_attendance_school WHERE tenant_id = ? AND student_id = ? GROUP BY st`
    ).bind(tenantId, sid).all()
    let present = 0, absent = 0, late = 0, excused = 0
    for (const row of ((rows.results || []) as Record<string, any>[])) {
      const st = String(row.st || '')
      const n = Number(row.n || 0)
      if (st.includes('absent')) absent += n
      else if (st.includes('late')) late += n
      else if (st.includes('excus')) excused += n
      else present += n
    }
    const total = present + absent + late + excused
    attendance = { present, absent, late, excused, total, rate: total ? Math.round(((present + late) / total) * 100) : 0 }
  } catch {}

  await ensureStudentRecordsTable(db)
  const recRows = await db.prepare(
    `SELECT * FROM student_records WHERE tenant_id = ? AND student_id = ? ORDER BY created_at DESC`
  ).bind(tenantId, sid).all().catch(() => ({ results: [] }))
  const records = (((recRows as any).results || []) as Record<string, any>[]).map(mapStudentRecordRow)
  const contacts = await buildStudentFrequentContacts(db, student)

  return {
    results: {
      publicationCount: publications.length,
      documentCount: documents.length,
      latestTerm: String((publications[0] as any)?.termName || ''),
      latestSession: String((publications[0] as any)?.sessionName || ''),
    },
    assignments,
    attendance,
    records,
    contacts,
  }
}

app.get('/api/students/:studentId/profile', authenticate, async (c) => {
  const studentId = String(c.req.param('studentId') || '').trim()
  const access = await resolveStudentProfileAccess(c.env.APP_DB, c.var.user || {}, studentId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.ok || !access.student) return c.json({ error: 'forbidden' }, 403)

  const snapshot = await buildStudentProfileSnapshot(c.env.APP_DB, access.tenantId, access.student)
  return c.json({
    success: true,
    canManage: access.canManage,
    student: {
      id: String(access.student.id || ''),
      name: String(access.student.name || ''),
      email: String(access.student.email || ''),
      displayId: String(access.student.displayId || ''),
      classId: String(access.student.classId || ''),
      className: String(access.student.className || ''),
      avatar: String(access.student.avatar || access.student.avatarUrl || ''),
      status: String(access.student.status || 'active'),
    },
    ...snapshot,
    categories: STUDENT_RECORD_CATEGORIES,
  })
})

app.post('/api/students/:studentId/records', authenticate, async (c) => {
  const studentId = String(c.req.param('studentId') || '').trim()
  const access = await resolveStudentProfileAccess(c.env.APP_DB, c.var.user || {}, studentId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.canManage || !access.student) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const category = String(body.category || '').trim().toLowerCase()
  if (!STUDENT_RECORD_CATEGORIES.includes(category)) return c.json({ error: 'Invalid category.' }, 400)
  const title = sanitizeProfileText(String(body.title || '').trim(), 200)
  const detail = sanitizeProfileText(String(body.detail || '').trim(), 4000)
  if (!title && !detail) return c.json({ error: 'Add a title or some detail.' }, 400)

  await ensureStudentRecordsTable(c.env.APP_DB)
  const id = `srec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  await c.env.APP_DB.prepare(
    `INSERT INTO student_records (id, tenant_id, student_id, category, title, detail, metadata_json, created_by, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, access.tenantId, String(access.student.id || ''), category, title, detail, JSON.stringify(body.metadata || {}), access.actorId, access.actorName, now).run()

  return c.json({ success: true, record: { id, category, title, detail, metadata: body.metadata || {}, createdBy: access.actorId, createdByName: access.actorName, createdAt: now } }, 201)
})

app.delete('/api/students/:studentId/records/:recordId', authenticate, async (c) => {
  const studentId = String(c.req.param('studentId') || '').trim()
  const recordId = String(c.req.param('recordId') || '').trim()
  const access = await resolveStudentProfileAccess(c.env.APP_DB, c.var.user || {}, studentId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.canManage || !access.student) return c.json({ error: 'forbidden' }, 403)
  await ensureStudentRecordsTable(c.env.APP_DB)
  await c.env.APP_DB.prepare(`DELETE FROM student_records WHERE tenant_id = ? AND student_id = ? AND id = ?`).bind(access.tenantId, String(access.student.id || ''), recordId).run()
  return c.json({ success: true })
})

app.post('/api/students/:studentId/ai-report', authenticate, async (c) => {
  const studentId = String(c.req.param('studentId') || '').trim()
  const access = await resolveStudentProfileAccess(c.env.APP_DB, c.var.user || {}, studentId)
  if (!access.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!access.ok || !access.student) return c.json({ error: 'forbidden' }, 403)

  const snapshot = await buildStudentProfileSnapshot(c.env.APP_DB, access.tenantId, access.student)
  const recordLines = snapshot.records.slice(0, 30).map(record => `- [${record.category}] ${record.title}${record.detail ? `: ${record.detail}` : ''}`).join('\n') || '- none recorded'
  const dataBlock = [
    `Student: ${access.student.name} (${access.student.displayId || access.student.id})`,
    `Class: ${access.student.className || 'Unassigned'}`,
    `Results: ${snapshot.results.publicationCount} published record(s), ${snapshot.results.documentCount} uploaded result document(s). Latest: ${snapshot.results.latestTerm || '—'} ${snapshot.results.latestSession || ''}`.trim(),
    `Assignments: ${snapshot.assignments.completed}/${snapshot.assignments.total} done, ${snapshot.assignments.notDone} outstanding, ${snapshot.assignments.graded} graded, average score ${snapshot.assignments.averageScore}%`,
    `Attendance: present ${snapshot.attendance.present}, late ${snapshot.attendance.late}, absent ${snapshot.attendance.absent}, excused ${snapshot.attendance.excused} (rate ${snapshot.attendance.rate}%)`,
    `Teacher/staff records:\n${recordLines}`,
  ].join('\n')

  const messages: any[] = [
    { role: 'system', content: 'You are an experienced Nigerian school teacher writing a concise termly progress report for one student, for staff and parents. Be encouraging, specific and constructive. Use only the figures provided; do not invent data. Reply in plain text with clearly labelled sections: SUMMARY, STRENGTHS, AREAS TO IMPROVE, RECOMMENDATIONS.' },
    { role: 'user', content: `Generate the progress report from this data:\n\n${dataBlock}` },
  ]

  let raw = ''
  try {
    if (c.env.AI && typeof c.env.AI.run === 'function') {
      const result = await c.env.AI.run(WORKERS_AI_MODEL, { messages, max_tokens: 700, temperature: 0.5 })
      raw = extractWorkersAiText(result)
    } else if (String((c.env as any).NVIDIA_API_KEY || '').trim()) {
      raw = await runNvidiaStudentChat(c.env, messages)
    }
  } catch {
    raw = ''
  }
  if (!raw) return c.json({ error: 'The AI progress report is not available right now. Please try again shortly.' }, 503)
  return c.json({ success: true, report: raw, generatedAt: new Date().toISOString() })
})

// Per-student old-code manager: list students with their tagged codes.
app.get('/api/students/old-codes', authenticate, async (c) => {
  try {
    const { role, tenant, forbidden } = await resolveTenantForActor(c)
    if (forbidden || !hasRequiredRole(role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ success: false, error: 'forbidden' }, 403)
    if (!tenant?.id) return c.json({ success: false, error: 'No tenant.' }, 400)
    await ensureUsersTable(c.env.APP_DB)
    const studentRows = await c.env.APP_DB.prepare(`SELECT id, name, email, role, status, createdAt FROM users WHERE tenantId = ? AND role = 'student' ORDER BY name`).bind(tenant.id).all()
    const hydrated = await hydrateUserRecords(c.env.APP_DB, (studentRows.results || []) as Record<string, any>[])
    const codeMap = await getOldCodeRecordsByStudent(c.env.APP_DB, tenant.id)
    const students = hydrated.map(student => ({
      id: String(student?.id || ''),
      name: String(student?.name || ''),
      email: String(student?.email || ''),
      displayId: String(student?.displayId || ''),
      className: String(student?.className || ''),
      codes: codeMap.get(String(student?.id || '')) || [],
    }))
    return c.json({ success: true, students })
  } catch (error) {
    return c.json({ success: false, message: String((error as Error)?.message || 'Could not load old codes.') }, 500)
  }
})

app.post('/api/students/old-codes', authenticate, async (c) => {
  try {
    const { role, tenant, forbidden } = await resolveTenantForActor(c)
    if (forbidden || !hasRequiredRole(role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ success: false, error: 'forbidden' }, 403)
    if (!tenant?.id) return c.json({ success: false, error: 'No tenant.' }, 400)
    const payload = await c.req.json().catch(() => ({})) as Record<string, any>
    const studentId = String(payload?.studentId || '').trim()
    const code = String(payload?.code || '').trim()
    if (!studentId || !code) return c.json({ success: false, message: 'Student and code are required.' }, 400)
    await addStudentOldCode(c.env.APP_DB, tenant.id, studentId, code)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: String((error as Error)?.message || 'Could not add code.') }, 500)
  }
})

app.delete('/api/students/old-codes/:codeId', authenticate, async (c) => {
  try {
    const { role, tenant, forbidden } = await resolveTenantForActor(c)
    if (forbidden || !hasRequiredRole(role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ success: false, error: 'forbidden' }, 403)
    if (!tenant?.id) return c.json({ success: false, error: 'No tenant.' }, 400)
    await removeStudentOldCode(c.env.APP_DB, tenant.id, c.req.param('codeId'))
    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: String((error as Error)?.message || 'Could not remove code.') }, 500)
  }
})

// Bulk-tag students with their old portal codes (name + code rows, sent in chunks).
app.post('/api/students/old-codes/bulk', authenticate, async (c) => {
  try {
    const { role, tenant, forbidden } = await resolveTenantForActor(c)
    if (forbidden || !hasRequiredRole(role, ['owner', 'hos', 'ict', 'ict_manager'])) return c.json({ success: false, error: 'forbidden' }, 403)
    if (!tenant?.id) return c.json({ success: false, error: 'No tenant.' }, 400)

    const payload = await c.req.json().catch(() => ({})) as Record<string, any>
    const rows = Array.isArray(payload?.rows) ? payload.rows : []
    if (rows.length === 0) return c.json({ success: false, message: 'No rows provided.' }, 400)

    await ensureUsersTable(c.env.APP_DB)
    const studentRows = await c.env.APP_DB.prepare(`SELECT id, name, email, role, status, createdAt FROM users WHERE tenantId = ? AND role = 'student'`).bind(tenant.id).all()
    const hydrated = await hydrateUserRecords(c.env.APP_DB, (studentRows.results || []) as Record<string, any>[])
    const students = hydrated.map(student => ({ id: String(student?.id || ''), name: String(student?.name || ''), email: String(student?.email || '') }))

    const results: Array<Record<string, any>> = []
    let tagged = 0
    for (const row of rows) {
      const name = String(row?.name || '').trim()
      const code = String(row?.code || row?.oldCode || '').trim()
      if (!name || !code) {
        results.push({ name, code, status: 'invalid', message: 'Name and code are both required.' })
        continue
      }
      const match = matchStudentByFullName(name, students)
      if (match.ambiguous) {
        results.push({ name, code, status: 'ambiguous', message: 'This name matched more than one student.' })
        continue
      }
      if (!match.student) {
        results.push({ name, code, status: 'unmatched', message: 'No student matched this name.' })
        continue
      }
      // eslint-disable-next-line no-await-in-loop
      await addStudentOldCode(c.env.APP_DB, tenant.id, String(match.student.id || ''), code)
      tagged += 1
      results.push({ name, code, status: 'tagged', studentId: match.student.id, studentName: match.student.name })
    }

    return c.json({ success: true, tagged, total: rows.length, results })
  } catch (error) {
    return c.json({ success: false, message: String((error as Error)?.message || 'Could not tag old student codes.') }, 500)
  }
})

app.post('/api/results/documents/upload', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, RESULT_DOCUMENT_UPLOADER_ROLES)) return c.json({ error: 'forbidden' }, 403)
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)

  const actorId = String(c.var.user?.id || c.var.user?.email || c.var.user?.sub || '').trim()
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    // A too-large/garbled multipart body would otherwise crash the Worker as a 503.
    return c.json({ error: 'This upload batch was too large to process. The app will retry with fewer files.' }, 413)
  }
  const files = formData.getAll('files').filter(item => item instanceof File) as File[]
  if (files.length === 0) return c.json({ error: 'Upload at least one PDF file.' }, 400)
  const rawFileStudentMap = String(formData.get('fileStudentMap') || '').trim()
  let fileStudentMap: Record<string, string> = {}
  if (rawFileStudentMap) {
    try {
      const parsed = JSON.parse(rawFileStudentMap)
      fileStudentMap = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return c.json({ error: 'Invalid manual result mapping payload.' }, 400)
    }
  }

  const classId = String(formData.get('classId') || '').trim()
  const period = await resolveCurrentResultPeriod(
    c.env.APP_DB,
    tenant.id,
    formData.get('sessionName') || formData.get('session') || undefined,
    formData.get('termName') || formData.get('term') || undefined,
  )
  // Migrated/past results: make sure the period exists in the school's sessions.
  await ensureSessionTermExists(c.env.APP_DB, tenant.id, period.sessionName, period.termName)

  // Use the lightweight matching roster (a few batched queries) instead of full hydration, which
  // ran per-student work and made bulk uploads exceed the Worker subrequest/CPU limits (503s).
  let students: Array<Record<string, any>> = []
  if (classId) {
    const access = await resolveResultClassAccess(c.env.APP_DB, c.var.user || {}, classId)
    if (!access.classRow) return c.json({ error: 'Class not found.' }, 404)
    const roster = await listStudentsForResultMatching(c.env.APP_DB, tenant.id)
    students = roster.filter(student => String(student.classId || '') === String(classId))
  } else {
    students = await listStudentsForResultMatching(c.env.APP_DB, tenant.id)
  }

  if (students.length === 0) return c.json({ error: 'No students were available for result distribution.' }, 400)
  // Add each student's old portal codes so result PDFs can be matched by them.
  students = await attachOldCodesToStudents(c.env.APP_DB, tenant.id, students)

  // Only the already-uploaded student ids are needed for dedup. Fetch just that column (the table
  // grows with every upload, so SELECT * here got heavier each chunk and added to the 503 pressure).
  const existingDocRows = await c.env.APP_DB.prepare(
    `SELECT student_id FROM result_documents WHERE tenant_id = ? AND session_name = ? AND term_name = ?`
  ).bind(tenant.id, period.sessionName, period.termName).all().catch(() => ({ results: [] }))
  const relevantStudentIds = new Set(students.map(student => String(student.id || '')).filter(Boolean))
  const alreadyUploadedStudentIds = new Set(
    (((existingDocRows as any).results || []) as Record<string, any>[])
      .map(row => String(row.student_id || ''))
      .filter(studentId => relevantStudentIds.has(studentId))
  )
  const queuedStudentIds = new Set<string>()
  const coveredStudentIds = new Set(alreadyUploadedStudentIds)
  const docsToSave: Array<Record<string, any>> = []
  const results: Array<Record<string, any>> = []
  const summary = {
    totalFiles: files.length,
    matchedCount: 0,
    uploadedCount: 0,
    skippedCount: 0,
    alreadyUploadedCount: 0,
    duplicateMatchedCount: 0,
    unmatchedCount: 0,
    ambiguousCount: 0,
    invalidTypeCount: 0,
    manualMappedCount: 0,
  }

  for (const file of files) {
    const lowerName = String(file.name || '').toLowerCase()
    if (!lowerName.endsWith('.pdf') && !String(file.type || '').toLowerCase().includes('pdf')) {
      summary.invalidTypeCount += 1
      results.push({ fileName: file.name, status: 'error', message: 'Only PDF result files are supported.' })
      continue
    }

    const fileKey = `${String(file.name || 'result.pdf')}::${Number(file.size || 0)}`
    const manuallySelectedStudentId = String(fileStudentMap[fileKey] || fileStudentMap[String(file.name || '')] || '').trim()
    const matched = manuallySelectedStudentId
      ? {
          student: students.find(student => String(student.id || '') === manuallySelectedStudentId) || null,
          matchedBy: 'manual-selection',
          ambiguous: false,
        }
      : matchResultUploadStudent(file.name, students)

    if (manuallySelectedStudentId && !matched.student) {
      summary.unmatchedCount += 1
      results.push({ fileName: file.name, status: 'error', message: 'The selected student could not be found for this batch.' })
      continue
    }

    if (matched.ambiguous) {
      summary.ambiguousCount += 1
      results.push({ fileName: file.name, status: 'error', message: 'Filename matched more than one student. Include the exact display ID, student email, or a clearer student name and surname.' })
      continue
    }
    if (!matched.student) {
      summary.unmatchedCount += 1
      results.push({ fileName: file.name, status: 'error', message: 'Could not match this PDF to a student. Use the exact student ID, display ID, email, or student name and surname in the filename.' })
      continue
    }

    summary.matchedCount += 1
    if (matched.matchedBy === 'manual-selection') {
      summary.manualMappedCount += 1
    }
    const studentId = String(matched.student.id || '')
    coveredStudentIds.add(studentId)

    if (alreadyUploadedStudentIds.has(studentId)) {
      summary.skippedCount += 1
      summary.alreadyUploadedCount += 1
      results.push({
        fileName: file.name,
        status: 'skipped',
        studentId,
        studentName: matched.student.name,
        matchedBy: matched.matchedBy,
        message: 'A result PDF for this student, session, and term already exists. Skipped.',
      })
      continue
    }

    if (queuedStudentIds.has(studentId)) {
      summary.skippedCount += 1
      summary.duplicateMatchedCount += 1
      results.push({
        fileName: file.name,
        status: 'skipped',
        studentId,
        studentName: matched.student.name,
        matchedBy: matched.matchedBy,
        message: 'Another file in this upload already matched this student. Skipped.',
      })
      continue
    }

    queuedStudentIds.add(studentId)

    const safeFileName = String(file.name || 'result.pdf').replace(/[^A-Za-z0-9_.-]+/g, '_')
    const key = `results/${normalizeResultDomainKey(tenant.id, 'tenant')}/${normalizeResultDomainKey(period.sessionName, 'session')}/${normalizeResultDomainKey(period.termName, 'term')}/${normalizeResultDomainKey(matched.student.id, 'student')}/${Date.now()}_${safeFileName}`
    try {
      await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'application/pdf' } })
    } catch {
      // A single storage hiccup must not fail the whole batch — flag this file and move on.
      queuedStudentIds.delete(studentId)
      coveredStudentIds.delete(studentId)
      summary.skippedCount += 1
      results.push({
        fileName: file.name,
        status: 'error',
        studentId,
        studentName: matched.student.name,
        message: 'Storage error while saving this PDF. Please re-upload this file.',
      })
      continue
    }
    const uploadedAt = new Date().toISOString()

    docsToSave.push({
      id: `resultdoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: tenant.id,
      studentId: matched.student.id,
      sessionName: period.sessionName,
      termName: period.termName,
      sourceKind: 'uploaded-pdf',
      fileUrl: `https://ndovera.com/files/${key}`,
      fileName: safeFileName,
      uploadedBy: actorId,
      uploadedAt,
      metadata: {
        classId: classId || null,
        matchedBy: matched.matchedBy,
        originalFileName: file.name,
      },
    })
    summary.uploadedCount += 1
    results.push({
      fileName: file.name,
      status: 'ok',
      studentId: matched.student.id,
      studentName: matched.student.name,
      matchedBy: matched.matchedBy,
    })
  }

  if (docsToSave.length > 0) {
    try {
      await saveResultDocuments(c.env.APP_DB, docsToSave)
    } catch {
      // Files reached storage but recording them failed; report so the operator can retry this set.
      const savedIds = new Set(docsToSave.map(doc => String(doc.studentId || '')))
      results.forEach(result => {
        if (result.status === 'ok' && savedIds.has(String(result.studentId || ''))) {
          result.status = 'error'
          result.message = 'Saved to storage but could not be recorded. Please re-upload this file.'
        }
      })
      summary.uploadedCount = 0
      return c.json({
        success: false,
        hasBlockingIssues: true,
        sessionName: period.sessionName,
        termName: period.termName,
        results,
        summary: { ...summary, missingStudentCount: 0 },
        missingStudents: [],
      })
    }
  }

  const missingStudents = students
    .filter(student => !coveredStudentIds.has(String(student.id || '')))
    .map(student => ({
      id: String(student.id || ''),
      name: String(student.name || ''),
      displayId: String(student.displayId || ''),
      className: String(student.className || ''),
    }))
  const hasBlockingIssues = summary.invalidTypeCount > 0 || summary.unmatchedCount > 0 || summary.ambiguousCount > 0

  return c.json({
    success: !hasBlockingIssues,
    partialSuccess: hasBlockingIssues && summary.uploadedCount > 0,
    hasBlockingIssues,
    sessionName: period.sessionName,
    termName: period.termName,
    results,
    summary: {
      ...summary,
      missingStudentCount: missingStudents.length,
    },
    missingStudents,
  })
})

// Delete a single uploaded result PDF (staff only). Lets schools remove a wrong file and
// re-upload — uploads already enforce one document per student/session/term, so this keeps
// results clean without ever leaving duplicates.
app.delete('/api/results/documents/:documentId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, RESULT_DOCUMENT_UPLOADER_ROLES)) return c.json({ error: 'forbidden' }, 403)
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)
  const documentId = String(c.req.param('documentId') || '').trim()
  if (!documentId) return c.json({ error: 'documentId required.' }, 400)
  try {
    await ensureResultsTables(c.env.APP_DB)
    const row = await c.env.APP_DB.prepare(
      `SELECT id, file_url FROM result_documents WHERE id = ? AND tenant_id = ?`
    ).bind(documentId, tenant.id).first() as Record<string, any> | null
    if (!row) return c.json({ error: 'Result document not found.' }, 404)
    const fileUrl = String(row.file_url || '')
    const key = fileUrl.replace(/^https?:\/\/[^/]+\/files\//, '')
    if (key && key !== fileUrl) {
      try { await c.env.UPLOADS.delete(key) } catch {}
    }
    await c.env.APP_DB.prepare(`DELETE FROM result_documents WHERE id = ? AND tenant_id = ?`).bind(documentId, tenant.id).run()
    return c.json({ success: true })
  } catch {
    return c.json({ error: 'Could not delete the result document.' }, 500)
  }
})

// Students across the school (or one class) who have no published result AND no uploaded result
// document for a given session + term — i.e. whose results are not yet published.
app.get('/api/results/unpublished', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, RESULT_DOCUMENT_UPLOADER_ROLES.concat(RESULT_APPROVER_ROLES))) return c.json({ error: 'forbidden' }, 403)
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)
  const period = await resolveCurrentResultPeriod(
    c.env.APP_DB,
    tenant.id,
    c.req.query('sessionName') || c.req.query('session') || undefined,
    c.req.query('termName') || c.req.query('term') || undefined,
  )
  const classId = String(c.req.query('classId') || '').trim()
  try {
    await ensureResultsTables(c.env.APP_DB)
    const roster = await listStudentsForResultMatching(c.env.APP_DB, tenant.id)
    const students = classId ? roster.filter(student => String(student.classId || '') === classId) : roster

    const [pubRows, docRows] = await Promise.all([
      c.env.APP_DB.prepare(`SELECT student_id FROM result_publications WHERE tenant_id = ? AND session_name = ? AND term_name = ?`).bind(tenant.id, period.sessionName, period.termName).all().catch(() => ({ results: [] })),
      c.env.APP_DB.prepare(`SELECT student_id FROM result_documents WHERE tenant_id = ? AND session_name = ? AND term_name = ?`).bind(tenant.id, period.sessionName, period.termName).all().catch(() => ({ results: [] })),
    ])
    const covered = new Set<string>()
    for (const row of [...(((pubRows as any).results || []) as Record<string, any>[]), ...(((docRows as any).results || []) as Record<string, any>[])]) {
      covered.add(String(row.student_id || ''))
    }

    const missing = students
      .filter(student => !covered.has(String(student.id || '')))
      .map(student => ({ id: String(student.id || ''), name: String(student.name || ''), displayId: String(student.displayId || ''), className: String(student.className || '') }))

    return c.json({
      success: true,
      sessionName: period.sessionName,
      termName: period.termName,
      totalStudents: students.length,
      publishedCount: students.length - missing.length,
      missing,
    })
  } catch {
    return c.json({ success: true, sessionName: period.sessionName, termName: period.termName, totalStudents: 0, publishedCount: 0, missing: [] })
  }
})

// ─── Fees Config ────────────────────────────────────────────────────────────
app.get('/api/school/fees-config', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensureFeesConfigTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      `SELECT * FROM fees_config WHERE tenant_id = ? ORDER BY session DESC, term DESC, sort_order ASC, updated_at DESC, created_at DESC`
    ).bind(tenantId).all()
    const currentSession = await getCurrentSchoolSessionSnapshot(c.env.APP_DB, tenantId)
    return c.json({ success: true, configs: ((rows.results || []) as Record<string, any>[]).map(mapFeeConfigRow), currentSession })
  } catch { return c.json({ success: true, configs: [] }) }
})

app.post('/api/school/fees-config', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { feeType, classId, studentId, amount, session, term, sortOrder } = await c.req.json()
  if (amount === undefined || amount === null || amount === '') return c.json({ error: 'Amount required.' }, 400)
  const id = `fc_${tenantId}_${Date.now()}`
  try {
    await ensureFeesConfigTable(c.env.APP_DB)
    const timestamp = new Date().toISOString()
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO fees_config (id, tenant_id, fee_type, class_id, student_id, amount, session, term, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, feeType || 'Tuition', classId || null, String(studentId || '').trim() || null, Number(amount), normalizeFeeConfigPeriodValue(session), normalizeFeeConfigPeriodValue(term), Number(sortOrder || 0), timestamp, timestamp).run()
    return c.json({ success: true, id }, 201)
  } catch (err) { return c.json({ error: 'Could not save fees config.' }, 500) }
})

app.put('/api/school/fees-config/snapshot', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const savedConfigs = await replaceFeesConfigSnapshot(c.env.APP_DB, {
    tenantId,
    sessionName: payload.session,
    termName: payload.term,
    configs: Array.isArray(payload.configs) ? payload.configs : [],
  }).catch(() => null)

  if (!savedConfigs) {
    return c.json({ error: 'Could not save fee template.' }, 500)
  }

  return c.json({ success: true, configs: savedConfigs })
})

app.get('/api/school/fees-ledger', authenticate, async (c) => {
  try {
    const feeView = await listVisibleFeeLedgerEntries(c.env.APP_DB, c.var.user || {})
    if (!feeView.tenantId) return c.json({ error: 'No tenant.' }, 400)
    if (!feeView.allowed) return c.json({ error: 'forbidden' }, 403)
    return c.json({ success: true, ledger: feeView.ledger })
  } catch {
    return c.json({ success: true, ledger: [] })
  }
})

app.get('/api/school/fees-receipts', authenticate, async (c) => {
  try {
    const receiptView = await listVisibleFeePaymentReceipts(c.env.APP_DB, c.var.user || {})
    if (!receiptView.tenantId) return c.json({ error: 'No tenant.' }, 400)
    if (!receiptView.allowed) return c.json({ error: 'forbidden' }, 403)
    return c.json({ success: true, receipts: receiptView.receipts })
  } catch {
    return c.json({ success: true, receipts: [] })
  }
})

app.get('/api/school/fees/payment-details', authenticate, async (c) => {
  const currentUser = c.var.user || {}
  const userIdentifier = String(currentUser.id || currentUser.email || currentUser.sub || '').trim()
  const resolvedUser = userIdentifier
    ? await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
    : { settings: null, userRow: null }
  const role = normalizeRole(resolvedUser.settings?.role || getActiveRole(currentUser))
  const tenantId = String(resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || currentUser.tenantId || '').trim()

  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (![...FEE_PAYMENT_APPROVER_ROLES, 'admin', 'parent', 'student'].includes(role)) return c.json({ error: 'forbidden' }, 403)

  const paymentDetails = await getFeesPaymentDetails(c.env.APP_DB, tenantId)
  return c.json({ success: true, paymentDetails, canEdit: [...FEE_PAYMENT_APPROVER_ROLES, 'admin'].includes(role) })
})

app.post('/api/school/fees/payment-details', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, [...FEE_PAYMENT_APPROVER_ROLES, 'admin'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const paymentDetails = await saveFeesPaymentDetails(c.env.APP_DB, tenantId, payload)
  await addAudit(c.env.APP_DB, tenantId, {
    action: 'feesPaymentDetailsUpdated',
    data: { by: c.var.user?.id },
  }).catch(() => null)

  return c.json({ success: true, paymentDetails })
})

app.get('/api/school/fees/payment-claims', authenticate, async (c) => {
  try {
    const claimView = await listVisibleFeePaymentClaims(c.env.APP_DB, c.var.user || {})
    if (!claimView.tenantId) return c.json({ error: 'No tenant.' }, 400)
    if (!claimView.allowed) return c.json({ error: 'forbidden' }, 403)
    return c.json({ success: true, claims: claimView.claims, canReview: [...FEE_PAYMENT_APPROVER_ROLES, 'admin'].includes(claimView.role) })
  } catch {
    return c.json({ success: true, claims: [], canReview: false })
  }
})

app.post('/api/school/fees/payment-claims', authenticate, async (c) => {
  const feeView = await listVisibleFeeLedgerEntries(c.env.APP_DB, c.var.user || {})
  if (!feeView.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!feeView.allowed || !['parent', 'student'].includes(feeView.role)) return c.json({ error: 'forbidden' }, 403)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const studentId = String(payload.studentId || '').trim()
  const studentEntry = (feeView.ledger || []).find(entry => String(entry.studentId || '').trim() === studentId)
  if (!studentEntry) return c.json({ error: 'Student not accessible.' }, 403)

  const amount = Number(payload.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) return c.json({ error: 'Amount required.' }, 400)

  await ensureFeesPaymentClaimsTable(c.env.APP_DB)
  const paymentDetails = await getFeesPaymentDetails(c.env.APP_DB, feeView.tenantId)
  const claimId = `fee_claim_${feeView.tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const paidAt = normalizeIsoDateValue(payload.paidAt) || now.slice(0, 10)
  const claimRow = {
    id: claimId,
    tenant_id: feeView.tenantId,
    student_id: studentId,
    student_name: String(studentEntry.name || ''),
    class_id: String(studentEntry.classId || ''),
    class_name: String(studentEntry.className || ''),
    claimant_user_id: String(c.var.user?.id || c.var.user?.email || '').trim(),
    claimant_name: String(c.var.user?.name || c.var.user?.email || 'Parent').trim(),
    claimant_role: feeView.role,
    amount,
    payment_method: sanitizeProfileText(payload.paymentMethod || 'bank-transfer', 80) || 'bank-transfer',
    payer_name: sanitizeProfileText(payload.payerName || c.var.user?.name, 160),
    payment_reference: sanitizeProfileText(payload.paymentReference, 160),
    payment_note: sanitizeProfileText(payload.paymentNote, 500),
    paid_at: paidAt,
    status: 'pending',
    account_name: paymentDetails.accountName,
    account_number: paymentDetails.accountNumber,
    bank_name: paymentDetails.bankName,
    verified_by: '',
    verified_at: '',
    verification_note: '',
    receipt_id: '',
    receipt_no: '',
    created_at: now,
    updated_at: now,
  }

  await c.env.APP_DB.prepare(
    `INSERT INTO fees_payment_claims (id, tenant_id, student_id, student_name, class_id, class_name, claimant_user_id, claimant_name, claimant_role, amount, payment_method, payer_name, payment_reference, payment_note, paid_at, status, account_name, account_number, bank_name, verified_by, verified_at, verification_note, receipt_id, receipt_no, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    claimRow.id,
    claimRow.tenant_id,
    claimRow.student_id,
    claimRow.student_name,
    claimRow.class_id || null,
    claimRow.class_name || null,
    claimRow.claimant_user_id,
    claimRow.claimant_name,
    claimRow.claimant_role,
    claimRow.amount,
    claimRow.payment_method,
    claimRow.payer_name || null,
    claimRow.payment_reference || null,
    claimRow.payment_note || null,
    claimRow.paid_at,
    claimRow.status,
    claimRow.account_name || null,
    claimRow.account_number || null,
    claimRow.bank_name || null,
    null,
    null,
    null,
    null,
    null,
    claimRow.created_at,
    claimRow.updated_at,
  ).run()

  await addAudit(c.env.APP_DB, feeView.tenantId, {
    action: 'feePaymentClaimSubmitted',
    data: {
      claimId,
      studentId,
      amount,
      by: c.var.user?.id,
    },
  }).catch(() => null)

  await sendWebPushToAudience(c.env.APP_DB, c.env, {
    tenantId: feeView.tenantId,
    roleKeys: FEE_PAYMENT_APPROVER_ROLES,
  }).catch(() => null)

  return c.json({ success: true, claim: mapFeePaymentClaimRow(claimRow) }, 201)
})

app.post('/api/school/fees/payment-claims/:claimId/approve', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, [...FEE_PAYMENT_APPROVER_ROLES, 'admin'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  await ensureFeesPaymentClaimsTable(c.env.APP_DB)
  const claimId = c.req.param('claimId')
  const claimRow = await c.env.APP_DB.prepare(
    `SELECT * FROM fees_payment_claims WHERE id = ? AND tenant_id = ?`
  ).bind(claimId, tenantId).first() as Record<string, any> | null
  if (!claimRow) return c.json({ error: 'Claim not found.' }, 404)
  if (String(claimRow.status || '').toLowerCase() !== 'pending') return c.json({ error: 'Claim has already been reviewed.' }, 400)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const providedFeeAmount = payload.feeAmount === undefined || payload.feeAmount === null || payload.feeAmount === ''
    ? undefined
    : Number(payload.feeAmount)
  if (providedFeeAmount !== undefined && (!Number.isFinite(providedFeeAmount) || providedFeeAmount < 0)) {
    return c.json({ error: 'Invalid fee amount.' }, 400)
  }

  const paymentResult = await recordStudentFeePayment(c.env.APP_DB, {
    tenantId,
    studentId: String(claimRow.student_id || ''),
    amount: Number(claimRow.amount || 0),
    paymentType: String(claimRow.payment_method || 'bank-transfer'),
    paymentReference: String(claimRow.payment_reference || ''),
    feeAmount: providedFeeAmount,
    recordedBy: String(c.var.user?.name || c.var.user?.id || 'Fees office'),
    verificationBaseUrl: new URL(c.req.url).origin,
  })

  const verifiedAt = new Date().toISOString()
  const verificationNote = sanitizeProfileText(payload.verificationNote, 500)
  await c.env.APP_DB.prepare(
    `UPDATE fees_payment_claims
     SET status = 'verified', verified_by = ?, verified_at = ?, verification_note = ?, receipt_id = ?, receipt_no = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`
  ).bind(
    String(c.var.user?.id || c.var.user?.email || ''),
    verifiedAt,
    verificationNote || null,
    null,
    null,
    verifiedAt,
    claimId,
    tenantId,
  ).run()

  await addAudit(c.env.APP_DB, tenantId, {
    action: 'feePaymentClaimApproved',
    data: {
      claimId,
      studentId: String(claimRow.student_id || ''),
      amountPaid: paymentResult.amountPaid,
      receiptReady: paymentResult.amountPaid > paymentResult.previousPaid,
      by: c.var.user?.id,
    },
  }).catch(() => null)

  const stakeholderUserIds = await buildFeeStakeholderUserIds(c.env.APP_DB, tenantId, String(claimRow.student_id || ''), [String(claimRow.claimant_user_id || '')])
  await sendWebPushToAudience(c.env.APP_DB, c.env, {
    tenantId,
    userIds: stakeholderUserIds,
  }).catch(() => null)

  return c.json({
    success: true,
    claim: mapFeePaymentClaimRow({
      ...claimRow,
      status: 'verified',
      verified_by: String(c.var.user?.id || c.var.user?.email || ''),
      verified_at: verifiedAt,
      verification_note: verificationNote,
      receipt_id: '',
      receipt_no: '',
      updated_at: verifiedAt,
    }),
    receipt: null,
    receiptReady: paymentResult.amountPaid > paymentResult.previousPaid,
  })
})

app.post('/api/school/fees/payment-claims/:claimId/reject', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, [...FEE_PAYMENT_APPROVER_ROLES, 'admin'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  await ensureFeesPaymentClaimsTable(c.env.APP_DB)
  const claimId = c.req.param('claimId')
  const claimRow = await c.env.APP_DB.prepare(
    `SELECT * FROM fees_payment_claims WHERE id = ? AND tenant_id = ?`
  ).bind(claimId, tenantId).first() as Record<string, any> | null
  if (!claimRow) return c.json({ error: 'Claim not found.' }, 404)
  if (String(claimRow.status || '').toLowerCase() !== 'pending') return c.json({ error: 'Claim has already been reviewed.' }, 400)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const verificationNote = sanitizeProfileText(payload.verificationNote, 500)
  const verifiedAt = new Date().toISOString()

  await c.env.APP_DB.prepare(
    `UPDATE fees_payment_claims
     SET status = 'rejected', verified_by = ?, verified_at = ?, verification_note = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`
  ).bind(
    String(c.var.user?.id || c.var.user?.email || ''),
    verifiedAt,
    verificationNote || null,
    verifiedAt,
    claimId,
    tenantId,
  ).run()

  await addAudit(c.env.APP_DB, tenantId, {
    action: 'feePaymentClaimRejected',
    data: {
      claimId,
      studentId: String(claimRow.student_id || ''),
      by: c.var.user?.id,
    },
  }).catch(() => null)

  const stakeholderUserIds = await buildFeeStakeholderUserIds(c.env.APP_DB, tenantId, String(claimRow.student_id || ''), [String(claimRow.claimant_user_id || '')])
  await sendWebPushToAudience(c.env.APP_DB, c.env, {
    tenantId,
    userIds: stakeholderUserIds,
  }).catch(() => null)

  return c.json({
    success: true,
    claim: mapFeePaymentClaimRow({
      ...claimRow,
      status: 'rejected',
      verified_by: String(c.var.user?.id || c.var.user?.email || ''),
      verified_at: verifiedAt,
      verification_note: verificationNote,
      updated_at: verifiedAt,
    }),
  })
})

app.post('/api/school/fees/:studentId/pay', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, FEE_PAYMENT_APPROVER_ROLES)) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const studentId = c.req.param('studentId')
  const { amount, paymentType, feeAmount } = await c.req.json()
  const paymentAmount = Number(amount)
  const providedFeeAmount = feeAmount === undefined || feeAmount === null || feeAmount === ''
    ? null
    : Number(feeAmount)

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return c.json({ error: 'Amount required.' }, 400)
  try {
    const paymentResult = await recordStudentFeePayment(c.env.APP_DB, {
      tenantId,
      studentId,
      amount: paymentAmount,
      paymentType: String(paymentType || 'cash'),
      feeAmount: providedFeeAmount,
      recordedBy: String(c.var.user.name || c.var.user.id || 'Fees office'),
      verificationBaseUrl: new URL(c.req.url).origin,
    })
    await addAudit(c.env.APP_DB, tenantId, { action: 'feePaymentRecorded', data: { studentId, amount, paymentType, by: c.var.user.id } })
    const stakeholderUserIds = await buildFeeStakeholderUserIds(c.env.APP_DB, tenantId, studentId)
    await sendWebPushToAudience(c.env.APP_DB, c.env, { tenantId, userIds: stakeholderUserIds }).catch(() => null)
    return c.json({ success: true, amountPaid: paymentResult.amountPaid, previousPaid: paymentResult.previousPaid, status: paymentResult.status, receipt: null, receiptReady: paymentResult.amountPaid > paymentResult.previousPaid })
  } catch (err) { return c.json({ error: 'Could not record payment.' }, 500) }
})

app.post('/api/school/fees/:studentId/issue-receipt', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, FEE_PAYMENT_APPROVER_ROLES)) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const studentId = c.req.param('studentId')

  try {
    const issueResult = await issueStudentFeeReceipt(c.env.APP_DB, {
      tenantId,
      studentId,
      recordedBy: String(c.var.user.name || c.var.user.id || 'Fees office'),
      verificationBaseUrl: new URL(c.req.url).origin,
    })

    if (!issueResult.success) {
      return c.json({ error: issueResult.message || 'Could not issue receipt.' }, 400)
    }

    if (issueResult.action === 'issued' || issueResult.action === 'reissued') {
      await addAudit(c.env.APP_DB, tenantId, {
        action: issueResult.action === 'reissued' ? 'feeReceiptReissued' : 'feeReceiptIssued',
        data: {
          studentId,
          receiptId: issueResult.receipt?.id,
          receiptNo: issueResult.receipt?.receiptNo,
          previousReceiptNo: issueResult.latestReceipt?.receiptNo || '',
          by: c.var.user?.id,
        },
      }).catch(() => null)

      const stakeholderUserIds = await buildFeeStakeholderUserIds(c.env.APP_DB, tenantId, studentId)
      await sendWebPushToAudience(c.env.APP_DB, c.env, { tenantId, userIds: stakeholderUserIds }).catch(() => null)
    }

    return c.json({
      success: true,
      action: issueResult.action,
      receipt: issueResult.receipt,
      latestReceipt: issueResult.latestReceipt || null,
      message: issueResult.message || '',
    })
  } catch {
    return c.json({ error: 'Could not issue receipt.' }, 500)
  }
})

// ─── Expenditure ─────────────────────────────────────────────────────────────
app.get('/api/school/expenditure', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS expenditures (id TEXT PRIMARY KEY, tenant_id TEXT, description TEXT, category TEXT, amount REAL, date TEXT, recorded_by TEXT, created_at TEXT)`).run()
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM expenditures WHERE tenant_id = ? ORDER BY date DESC, created_at DESC`).bind(tenantId).all()
    const expenditures = (rows.results || []).map((r: any) => ({ id: r.id, description: r.description, category: r.category, amount: r.amount || 0, date: r.date, recordedBy: r.recorded_by, createdAt: r.created_at }))
    return c.json({ success: true, expenditures })
  } catch { return c.json({ success: true, expenditures: [] }) }
})

app.post('/api/school/expenditure', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { description, category, amount, date } = await c.req.json()
  if (!description || !amount) return c.json({ error: 'description and amount required.' }, 400)
  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS expenditures (id TEXT PRIMARY KEY, tenant_id TEXT, description TEXT, category TEXT, amount REAL, date TEXT, recorded_by TEXT, created_at TEXT)`).run()
    await c.env.APP_DB.prepare(`INSERT INTO expenditures (id, tenant_id, description, category, amount, date, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, description, category || 'Other', Number(amount), date || new Date().toISOString().slice(0, 10), c.var.user.name || c.var.user.id, new Date().toISOString()).run()
    return c.json({ success: true, id }, 201)
  } catch (err) { return c.json({ error: 'Could not add expenditure.' }, 500) }
})

async function ensurePayrollEntriesTable(db: D1Database) {
  if (_initializedTables.has('payroll_entries')) return
  _initializedTables.add('payroll_entries')
  await db.prepare(`CREATE TABLE IF NOT EXISTS payroll_entries (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, period TEXT, basic_salary REAL, allowances_json TEXT, deductions_json TEXT, gross REAL, deductions REAL, manual_deductions REAL, net REAL, status TEXT, payment_status TEXT, employment_category TEXT, bank_name TEXT, account_name TEXT, account_number TEXT, approved INTEGER, submitted INTEGER, created_at TEXT, updated_at TEXT)`).run()
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN submitted INTEGER DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN manual_deductions REAL DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN basic_salary REAL DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN allowances_json TEXT') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN deductions_json TEXT') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN payment_status TEXT DEFAULT \'pending\'') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN employment_category TEXT') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN bank_name TEXT') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN account_name TEXT') } catch {}
  try { await db.exec('ALTER TABLE payroll_entries ADD COLUMN account_number TEXT') } catch {}
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_payroll_entries_tenant_period_staff ON payroll_entries(tenant_id, period, staff_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payroll_entries_tenant_period_payment_status ON payroll_entries(tenant_id, period, payment_status)`,
  ])
}

const DEFAULT_PAYROLL_EARNING_COLUMNS = [
  { key: 'basicSalary', label: 'Basic Salary' },
  { key: 'housingAllowance', label: 'Housing Allowance' },
  { key: 'transportAllowance', label: 'Transport Allowance' },
  { key: 'bonus', label: 'Bonus' },
]

const DEFAULT_PAYROLL_DEDUCTION_COLUMNS = [
  { key: 'tax', label: 'Income Tax' },
  { key: 'pension', label: 'Pension' },
  { key: 'otherDeduction', label: 'Other Deductions' },
]

function normalizePayrollColumnKey(value: unknown, fallback = '') {
  const normalized = String(value || fallback || '').trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return normalized.slice(0, 48)
}

function normalizePayrollColumnLabel(value: unknown, fallback: string) {
  return sanitizeProfileText(value, 80) || fallback
}

function normalizePayrollColumnList(values: unknown, defaults: Array<Record<string, any>>, prefix: string) {
  const rawEntries = Array.isArray(values) ? values : []
  const rawMap = new Map(
    rawEntries
      .map((entry, index) => {
        const source = entry && typeof entry === 'object' ? entry as Record<string, any> : { key: entry, label: entry }
        const key = normalizePayrollColumnKey(source.key || source.label, `${prefix}_${index + 1}`)
        return key ? [key, source] as const : null
      })
      .filter(Boolean) as Array<readonly [string, Record<string, any>]>,
  )
  const seen = new Set<string>()

  const defaultColumns = defaults.map(defaultEntry => {
    const key = String(defaultEntry.key || '').trim()
    seen.add(key)
    const customEntry = rawMap.get(key) || {}
    return {
      key,
      label: normalizePayrollColumnLabel(customEntry.label, String(defaultEntry.label || key)),
      fixed: true,
    }
  })

  const customColumns = rawEntries
    .map((entry, index) => {
      const source = entry && typeof entry === 'object' ? entry as Record<string, any> : { key: entry, label: entry }
      const key = normalizePayrollColumnKey(source.key || source.label, `${prefix}_${index + 1}`)
      if (!key || seen.has(key)) return null
      seen.add(key)
      return {
        key,
        label: normalizePayrollColumnLabel(source.label || key, key),
        fixed: false,
      }
    })
    .filter(Boolean)

  return [...defaultColumns, ...customColumns]
}

function normalizePayrollNumericMap(value: unknown, excludedKeys: string[] = []) {
  const excluded = new Set(excludedKeys)
  return Object.entries(parseHeaderJsonObject(value)).reduce((accumulator, [rawKey, rawValue]) => {
    const key = normalizePayrollColumnKey(rawKey, rawKey)
    if (!key || excluded.has(key)) return accumulator
    const numericValue = Number(rawValue || 0)
    accumulator[key] = Number.isFinite(numericValue) ? numericValue : 0
    return accumulator
  }, {} as Record<string, number>)
}

function sumPayrollNumericMapValues(values: Record<string, any> = {}) {
  return Object.values(values || {}).reduce((sum, value) => sum + (Number(value || 0) || 0), 0)
}

function normalizePayrollSettingsInput(payload: Record<string, any> = {}) {
  return {
    housingAllowance: Number(payload.housingAllowance || 0),
    transportAllowance: Number(payload.transportAllowance || 0),
    taxRate: Number(payload.taxRate || 7.5),
    pensionRate: Number(payload.pensionRate || 8),
    earningColumns: normalizePayrollColumnList(payload.earningColumns, DEFAULT_PAYROLL_EARNING_COLUMNS, 'earning'),
    deductionColumns: normalizePayrollColumnList(payload.deductionColumns, DEFAULT_PAYROLL_DEDUCTION_COLUMNS, 'deduction'),
  }
}

function normalizePayrollPeriod(value: unknown) {
  const normalized = String(value || '').trim()
  return /^\d{4}-\d{2}$/.test(normalized) ? normalized : new Date().toISOString().slice(0, 7)
}

function getPayrollNoteSettingsKey(tenantId: string, period: string) {
  return `payroll_note_${String(tenantId || '').trim()}_${normalizePayrollPeriod(period)}`
}

function buildPayrollBankDetailsRecord(value: unknown) {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {}
  return {
    bankName: String(source.bankName || '').trim().slice(0, 120),
    accountName: String(source.accountName || '').trim().slice(0, 120),
    accountNumber: String(source.accountNumber || '').trim().slice(0, 40),
  }
}

function normalizePayrollNoteRows(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map((entry, index) => {
      const source = entry && typeof entry === 'object' ? entry as Record<string, any> : {}
      const bankDetails = buildPayrollBankDetailsRecord(source)
      return {
        id: String(source.id || source.staffId || `payroll_note_row_${index + 1}`).trim().slice(0, 120),
        staffId: String(source.staffId || source.id || '').trim().slice(0, 120),
        displayId: String(source.displayId || '').trim().slice(0, 120),
        name: String(source.name || source.staffName || 'Staff').trim().slice(0, 160) || 'Staff',
        role: String(source.role || 'staff').trim().slice(0, 80) || 'staff',
        employmentCategory: String(source.employmentCategory || '').trim().slice(0, 80),
        bankName: bankDetails.bankName,
        accountName: bankDetails.accountName,
        accountNumber: bankDetails.accountNumber,
        net: Number(source.net || 0) || 0,
      }
    })
    .filter(entry => entry.name)
    .slice(0, 500)
}

function normalizePayrollNoteRecord(value: unknown, fallbackPeriod = '') {
  if (!value || typeof value !== 'object') return null

  const source = value as Record<string, any>
  const period = normalizePayrollPeriod(source.period || fallbackPeriod)
  const rows = normalizePayrollNoteRows(source.rows)
  const totalNetPay = rows.reduce((sum, row) => sum + Number(row.net || 0), 0)

  return {
    period,
    noteText: String(source.noteText || '').trim().slice(0, 5000),
    preparedByName: String(source.preparedByName || '').trim().slice(0, 160),
    preparedByRole: String(source.preparedByRole || '').trim().slice(0, 80),
    preparedByUserId: String(source.preparedByUserId || '').trim().slice(0, 120),
    savedAt: String(source.savedAt || '').trim() || null,
    rows,
    totalNetPay,
  }
}

function getPayrollPeriodBounds(period: string) {
  const [rawYear, rawMonth] = String(period || '').split('-').map(value => Number(value))
  const today = new Date()
  const year = Number.isFinite(rawYear) && rawYear > 0 ? rawYear : today.getUTCFullYear()
  const monthIndex = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth - 1 : today.getUTCMonth()
  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 1))

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

async function listPayrollLateChargeSummaries(db: D1Database, tenantId: string, period: string) {
  await ensureStaffAttendanceEventsTable(db)
  const { startDate, endDate } = getPayrollPeriodBounds(period)
  const rows = await db.prepare(
    `SELECT staff_id, SUM(late_charge) AS total_late_charge, COUNT(*) AS late_count
     FROM staff_attendance_events
     WHERE tenant_id = ?
       AND action = 'sign-in'
       AND late_charge > 0
       AND date >= ?
       AND date < ?
     GROUP BY staff_id`
  ).bind(tenantId, startDate, endDate).all().catch(() => ({ results: [] }))

  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    staffId: String(row.staff_id || '').trim(),
    amount: Number(row.total_late_charge || 0),
    count: Number(row.late_count || 0),
  })).filter(row => row.staffId)
}

async function getPayrollLateChargeSummaryForIdentifiers(db: D1Database, tenantId: string, period: string, identifiers: string[]) {
  const normalizedIdentifiers = Array.from(new Set((identifiers || []).map(value => String(value || '').trim()).filter(Boolean)))
  if (normalizedIdentifiers.length === 0) {
    return { amount: 0, count: 0 }
  }

  await ensureStaffAttendanceEventsTable(db)
  const { startDate, endDate } = getPayrollPeriodBounds(period)
  const placeholders = normalizedIdentifiers.map(() => '?').join(', ')
  const row = await db.prepare(
    `SELECT COALESCE(SUM(late_charge), 0) AS total_late_charge, COUNT(*) AS late_count
     FROM staff_attendance_events
     WHERE tenant_id = ?
       AND action = 'sign-in'
       AND late_charge > 0
       AND date >= ?
       AND date < ?
       AND staff_id IN (${placeholders})`
  ).bind(tenantId, startDate, endDate, ...normalizedIdentifiers).first() as Record<string, any> | null

  return {
    amount: Number(row?.total_late_charge || 0),
    count: Number(row?.late_count || 0),
  }
}

function shiftIsoDate(value: string, dayOffset = 0) {
  const parsed = new Date(`${String(value || '').trim()}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime())) return ''
  parsed.setUTCDate(parsed.getUTCDate() + Math.trunc(dayOffset || 0))
  return parsed.toISOString().slice(0, 10)
}

function listWeekdayIsoDates(startDate: string, endDate: string) {
  const start = new Date(`${String(startDate || '').trim()}T00:00:00Z`)
  const end = new Date(`${String(endDate || '').trim()}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.getTime() > end.getTime()) {
    return [] as string[]
  }

  const dates: string[] = []
  const cursor = new Date(start.getTime())
  while (cursor.getTime() <= end.getTime()) {
    const dayOfWeek = cursor.getUTCDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(cursor.toISOString().slice(0, 10))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

async function listPayrollAttendanceDeductionSummaries(
  db: D1Database,
  tenantId: string,
  period: string,
  staffRoster: Record<string, any>[] = [],
) {
  const roster = Array.isArray(staffRoster) && staffRoster.length ? staffRoster : await listTenantStaffRoster(db, tenantId)
  if (!tenantId || !roster.length) return [] as Array<Record<string, any>>

  await ensureStaffAttendanceBaseTable(db)
  await ensureStaffAttendancePermissionRequestsTable(db)

  const settings = await getOrCreateStaffAttendanceSettings(db, tenantId)
  const absencePenaltyEnabled = Boolean(Number(settings?.absence_penalty_enabled ?? 0))
  const payrollAutoDeductAbsence = Boolean(Number(settings?.payroll_auto_deduct_absence ?? 0))
  const configuredAmount = Number(settings?.absence_penalty_amount || 0)
  const { startDate, endDate } = getPayrollPeriodBounds(period)
  const inclusiveEndDate = shiftIsoDate(endDate, -1)
  const today = new Date().toISOString().slice(0, 10)
  const effectiveEndDate = inclusiveEndDate && inclusiveEndDate < today ? inclusiveEndDate : today

  if (!effectiveEndDate || effectiveEndDate < startDate) {
    return roster.map(staffMember => ({
      staffId: String(staffMember?.id || staffMember?.email || '').trim(),
      amount: 0,
      count: 0,
      approvedCount: 0,
      expectedCount: 0,
      workedCount: 0,
      autoDeduct: absencePenaltyEnabled && payrollAutoDeductAbsence,
    })).filter(summary => summary.staffId)
  }

  const [attendanceRows, permissionRows] = await Promise.all([
    db.prepare(
      `SELECT staff_id, date, status
       FROM staff_attendance
       WHERE tenant_id = ?
         AND date >= ?
         AND date <= ?`
    ).bind(tenantId, startDate, effectiveEndDate).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT staff_id, request_type, start_date, end_date, status
       FROM staff_attendance_permission_requests
       WHERE tenant_id = ?
         AND status = 'approved'
         AND start_date <= ?
         AND end_date >= ?`
    ).bind(tenantId, effectiveEndDate, startDate).all().catch(() => ({ results: [] })),
  ])

  const attendanceResults = (attendanceRows.results || []) as Record<string, any>[]
  const permissionResults = (permissionRows.results || []) as Record<string, any>[]

  // Public holidays and school breaks are not school days, so they must never be
  // counted as unauthorized absences for payroll deductions.
  const holidayDateSet = new Set(Array.from((await listTenantHolidayMap(db, tenantId, startDate, effectiveEndDate)).keys()))

  return roster.map(staffMember => {
    const identifiers = collectComparableIdentifiers([
      staffMember?.id,
      staffMember?.email,
      staffMember?.displayId,
    ])
    const presentDates = new Set(
      attendanceResults
        .filter(row => matchesComparableIdentifier(row.staff_id, identifiers))
        .filter(row => ['present', 'late'].includes(String(row.status || '').toLowerCase().trim()))
        .map(row => String(row.date || '').trim())
        .filter(Boolean),
    )
    const approvedDates = new Set<string>()
    permissionResults.forEach(row => {
      if (!matchesComparableIdentifier(row.staff_id, identifiers)) return
      const permissionStart = String(row.start_date || '').trim()
      const permissionEnd = String(row.end_date || permissionStart).trim()
      if (!permissionStart || !permissionEnd) return
      const boundedStart = permissionStart > startDate ? permissionStart : startDate
      const boundedEnd = permissionEnd < effectiveEndDate ? permissionEnd : effectiveEndDate
      listWeekdayIsoDates(boundedStart, boundedEnd).forEach(dateKey => approvedDates.add(dateKey))
    })

    const createdAtDate = normalizeIsoDateValue(staffMember?.createdAt)
    const effectiveStartDate = createdAtDate && createdAtDate > startDate ? createdAtDate : startDate
    const expectedDates = (effectiveStartDate && effectiveStartDate <= effectiveEndDate
      ? listWeekdayIsoDates(effectiveStartDate, effectiveEndDate)
      : []).filter(dateKey => !holidayDateSet.has(dateKey))
    const unauthorizedAbsenceDates = expectedDates.filter(dateKey => !presentDates.has(dateKey) && !approvedDates.has(dateKey))
    const amount = absencePenaltyEnabled && payrollAutoDeductAbsence
      ? Number((unauthorizedAbsenceDates.length * configuredAmount).toFixed(2))
      : 0

    return {
      staffId: String(staffMember?.id || staffMember?.email || '').trim(),
      amount,
      count: unauthorizedAbsenceDates.length,
      approvedCount: approvedDates.size,
      expectedCount: expectedDates.length,
      workedCount: presentDates.size,
      autoDeduct: absencePenaltyEnabled && payrollAutoDeductAbsence,
    }
  }).filter(summary => summary.staffId)
}

async function listTenantStaffRoster(db: D1Database, tenantId: string) {
  // ensureUsersTable intentionally omitted — it runs UPDATE users WHERE 1=1 on every call.
  const [userRows, settingRows] = await Promise.all([
    db.prepare(
    `SELECT id, name, email, role, primary_role, employment_category, status, createdAt, tenantId
     FROM users
     WHERE tenantId = ? AND (status IS NULL OR status != 'inactive')
     ORDER BY COALESCE(primary_role, role), name, email`
    ).bind(tenantId).all().catch(() => ({ results: [] })),
    db.prepare(
      `SELECT studentId, payload
       FROM settings
       WHERE json_extract(payload, '$.tenantId') = ?
          OR json_extract(payload, '$.schoolId') = ?`
    ).bind(tenantId, tenantId).all().catch(() => ({ results: [] })),
  ])

  // Build settings map from already-fetched settings rows — no extra DB queries.
  const settingsMapForUsers = new Map<string, Record<string, any>>()
  for (const sr of (settingRows.results || []) as Record<string, any>[]) {
    const payload = parseHeaderJsonObject(sr.payload)
    const key = String(sr.studentId || '').trim()
    if (key) settingsMapForUsers.set(key.toLowerCase(), payload)
  }

  // Light hydration — zero additional DB calls (same pattern as /api/people list).
  const hydratedUsers = ((userRows.results || []) as Record<string, any>[]).filter(Boolean).map(row => {
    const emailKey = String(row.email || '').trim().toLowerCase()
    const idKey = String(row.id || '').trim()
    const settings = settingsMapForUsers.get(emailKey) || settingsMapForUsers.get(idKey) || null
    const roleContext = buildRoleContext(settings || {}, row.role)
    const profile = buildAdmissionProfileRecord(settings || {}, row)
    const publicDisplayId = getPublicFacingUserId(settings || {}, roleContext.primaryRole)
    return {
      ...row,
      role: roleContext.primaryRole,
      primaryRole: roleContext.primaryRole,
      roles: roleContext.rawRoles,
      switchableRoles: roleContext.switchableRoles,
      adminRoles: roleContext.adminRoles,
      capabilities: roleContext.capabilities,
      displayId: publicDisplayId || String(settings?.displayId || '').trim() || null,
      publicStudentId: String(settings?.publicStudentId || '').trim() || null,
      employmentCategory: deriveEmploymentCategory(roleContext.primaryRole, settings?.employmentCategory, roleContext.rawRoles),
      phone: profile.phone || null,
      classId: settings?.classId || null,
      className: settings?.className || null,
      avatar: profile.avatar || null,
      avatarUrl: profile.avatar || null,
      mustChangePassword: settings?.mustChangePassword === true,
      bankName: (settings?.payrollBankDetails as any)?.bankName || null,
      accountName: (settings?.payrollBankDetails as any)?.accountName || null,
      accountNumber: (settings?.payrollBankDetails as any)?.accountNumber || null,
    }
  })
  const roster = new Map<string, Record<string, any>>()

  for (const person of hydratedUsers) {
    const identityKeys = Array.from(new Set([
      String(person?.id || '').trim(),
      String(person?.email || '').trim().toLowerCase(),
    ].filter(Boolean)))
    for (const key of identityKeys) {
      roster.set(key, person)
    }
  }

  for (const row of ((settingRows.results || []) as Record<string, any>[])) {
    const settings = parseHeaderJsonObject(row.payload)
    const status = String(settings?.status || 'active').trim().toLowerCase()
    const email = String(settings?.email || row.studentId || '').trim()
    const recordId = String(settings?.userId || settings?.profile?.id || email || row.studentId || '').trim()
    const identityKeys = Array.from(new Set([
      recordId,
      email.toLowerCase(),
      String(row.studentId || '').trim().toLowerCase(),
    ].filter(Boolean)))
    const existingPerson = identityKeys.map(key => roster.get(key)).find(Boolean) || null
    const settingsRoles = normalizeRoleValues([
      settings?.primaryRole,
      settings?.primary_role,
      settings?.role,
      settings?.roles,
    ])
    const fallbackRoles = normalizeRoleValues([
      existingPerson?.primaryRole,
      existingPerson?.role,
      existingPerson?.roles,
    ])
    const roleContext = buildRoleContext(
      settingsRoles.length
        ? {
            ...settings,
            primaryRole: settings?.primaryRole || settings?.primary_role || settingsRoles[0],
            role: settings?.role || settingsRoles[0],
            roles: settingsRoles,
          }
        : {
            primaryRole: existingPerson?.primaryRole || existingPerson?.role || '',
            role: existingPerson?.role || '',
            roles: fallbackRoles,
          },
      settings?.role || existingPerson?.role,
    )
    const primaryRole = roleContext.primaryRole || fallbackRoles[0] || 'staff'
    const roles = roleContext.rawRoles.length ? roleContext.rawRoles : fallbackRoles

    if (!identityKeys.length || status === 'inactive' || !isStaff(primaryRole, roles)) {
      continue
    }

    const profile = buildAdmissionProfileRecord(settings || {}, {
      id: existingPerson?.id || recordId,
      name: settings?.name || existingPerson?.name || email,
      email: existingPerson?.email || email,
    })
    const payrollBankDetails = buildPayrollBankDetailsRecord(settings?.payrollBankDetails)
    const person = {
      ...existingPerson,
      id: existingPerson?.id || recordId || email,
      email: existingPerson?.email || email || String(row.studentId || '').trim(),
      name: profile.name || existingPerson?.name || String(settings?.name || email || row.studentId || 'Staff').trim(),
      role: primaryRole,
      primaryRole,
      roles,
      switchableRoles: roleContext.switchableRoles,
      adminRoles: roleContext.adminRoles,
      capabilities: roleContext.capabilities,
      tenantId,
      schoolId: tenantId,
      status: settings?.status || existingPerson?.status || 'active',
      displayId: getPublicFacingUserId(settings || existingPerson || {}, primaryRole) || existingPerson?.displayId || null,
      publicStudentId: String(settings?.publicStudentId || existingPerson?.publicStudentId || '').trim() || null,
      employmentCategory: deriveEmploymentCategory(primaryRole, settings?.employmentCategory || existingPerson?.employmentCategory, roles),
      classId: settings?.classId || existingPerson?.classId || null,
      className: settings?.className || existingPerson?.className || null,
      phone: profile.phone || existingPerson?.phone || null,
      avatar: profile.avatar || existingPerson?.avatar || null,
      avatarUrl: profile.avatar || existingPerson?.avatarUrl || existingPerson?.avatar || null,
      dateOfBirth: profile.dateOfBirth || existingPerson?.dateOfBirth || null,
      gender: profile.gender || existingPerson?.gender || null,
      address: profile.address || existingPerson?.address || null,
      relationship: profile.relationship || existingPerson?.relationship || null,
      bankName: payrollBankDetails.bankName || existingPerson?.bankName || null,
      accountName: payrollBankDetails.accountName || existingPerson?.accountName || null,
      accountNumber: payrollBankDetails.accountNumber || existingPerson?.accountNumber || null,
      profile: {
        ...(existingPerson?.profile && typeof existingPerson.profile === 'object' ? existingPerson.profile : {}),
        ...profile,
        payrollBankDetails,
      },
      mustChangePassword: settings?.mustChangePassword === true || settings?.mustChangePassword === 'true' || settings?.mustChangePassword === 1,
    }

    const mergedIdentityKeys = Array.from(new Set([
      ...identityKeys,
      String(existingPerson?.id || '').trim(),
      String(existingPerson?.email || '').trim().toLowerCase(),
    ].filter(Boolean)))

    for (const key of mergedIdentityKeys) {
      roster.set(key, person)
    }
  }

  return Array.from(new Map(
    Array.from(roster.values())
      .filter(person => isStaff(person?.role, person?.roles))
      .map(person => [String(person.id || person.email || '').trim(), person])
  ).values()).sort((left, right) => {
    const leftName = String(left?.name || left?.email || '')
    const rightName = String(right?.name || right?.email || '')
    return leftName.localeCompare(rightName)
  })
}

// ─── Payroll ──────────────────────────────────────────────────────────────────
app.get('/api/school/payroll', authenticate, async (c) => {
  if (!hasRequiredCapability(c.var.user.role, 'manage_payroll', c.var.user.roles)) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensurePayrollEntriesTable(c.env.APP_DB)
    const period = normalizePayrollPeriod(c.req.query('period'))
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM payroll_entries WHERE tenant_id = ? AND period = ?`).bind(tenantId, period).all()
    const staffRoster = await listTenantStaffRoster(c.env.APP_DB, tenantId)
    const lateChargeSummaries = await listPayrollLateChargeSummaries(c.env.APP_DB, tenantId, period)
    const attendanceDeductionSummaries = await listPayrollAttendanceDeductionSummaries(c.env.APP_DB, tenantId, period, staffRoster)
    const payrollSettings = normalizePayrollSettingsInput(await getSettings(c.env.APP_DB, `payroll_settings_${tenantId}`).catch(() => ({})))
    const payrollMap = new Map((rows.results || []).map((row: any) => [String(row.staff_id || '').trim(), row]))
    const payroll = staffRoster.map((staffMember: any) => {
      const row = payrollMap.get(String(staffMember.id || '').trim())
        || payrollMap.get(String(staffMember.email || '').trim())
        || null
      const allowances = normalizePayrollNumericMap(row?.allowances_json)
      const deductionsMap = normalizePayrollNumericMap(row?.deductions_json)
      const basicSalary = Number(row?.basic_salary || 0)
      const housingAllowance = Number(allowances.housingAllowance || 0)
      const transportAllowance = Number(allowances.transportAllowance || 0)
      const bonus = Number(allowances.bonus || 0)
      const tax = Number(deductionsMap.tax || 0)
      const pension = Number(deductionsMap.pension || 0)
      const otherDeduction = Number(deductionsMap.otherDeduction || 0)
      const lateChargeSummary = lateChargeSummaries.find(summary => summary.staffId === String(staffMember.id || '').trim())
        || lateChargeSummaries.find(summary => summary.staffId === String(staffMember.email || '').trim())
        || { amount: 0, count: 0 }
      const attendanceDeductionSummary = attendanceDeductionSummaries.find(summary => summary.staffId === String(staffMember.id || '').trim())
        || attendanceDeductionSummaries.find(summary => summary.staffId === String(staffMember.email || '').trim())
        || { amount: 0, count: 0, approvedCount: 0, expectedCount: 0, workedCount: 0, autoDeduct: false }
      const gross = Number(row?.gross || (basicSalary + sumPayrollNumericMapValues(allowances)))
      const manualDeductions = Number(row?.manual_deductions || sumPayrollNumericMapValues(deductionsMap))
      const autoLateDeductions = Number(lateChargeSummary.amount || 0)
      const autoAbsenceDeductions = Number(attendanceDeductionSummary.amount || 0)
      const autoAttendanceDeductions = autoLateDeductions + autoAbsenceDeductions
      const deductions = manualDeductions + autoAttendanceDeductions
      const paymentStatus = String(row?.payment_status || (String(row?.status || '').toLowerCase() === 'paid' ? 'paid' : 'pending')).toLowerCase()

      return {
        id: row?.id || `pay_${tenantId}_${staffMember.id}_${period}`,
        staffId: staffMember.id,
        staffInternalId: staffMember.id,
        displayId: staffMember.displayId || staffMember.email || 'Staff',
        name: staffMember.name || staffMember.email || 'Staff',
        email: staffMember.email || '',
        primaryRole: staffMember.primaryRole || staffMember.role || 'staff',
        role: staffMember.role || 'staff',
        roles: Array.isArray(staffMember.roles) ? staffMember.roles : [staffMember.role].filter(Boolean),
        capabilities: Array.isArray(staffMember.capabilities) ? staffMember.capabilities : deriveCapabilities(staffMember.role, staffMember.roles),
        employmentCategory: String(row?.employment_category || staffMember.employmentCategory || deriveEmploymentCategory(staffMember.role, staffMember.employmentCategory, staffMember.roles)),
        period,
        basicSalary,
        housingAllowance,
        transportAllowance,
        bonus,
        allowancesMap: allowances,
        gross,
        tax,
        pension,
        otherDeduction,
        deductionsMap,
        manualDeductions,
        autoLateDeductions,
        autoAbsenceDeductions,
        autoAttendanceDeductions,
        lateChargeCount: Number(lateChargeSummary.count || 0),
        absenceChargeCount: Number(attendanceDeductionSummary.count || 0),
        approvedAbsenceDays: Number(attendanceDeductionSummary.approvedCount || 0),
        expectedAttendanceDays: Number(attendanceDeductionSummary.expectedCount || 0),
        recordedAttendanceDays: Number(attendanceDeductionSummary.workedCount || 0),
        deductions,
        net: Number(gross - deductions),
        status: row?.status || 'Ready',
        paymentStatus,
        approved: Boolean(row?.approved),
        submitted: Boolean(row?.submitted),
        bankName: String(row?.bank_name || staffMember?.bankName || staffMember?.profile?.payrollBankDetails?.bankName || ''),
        accountName: String(row?.account_name || staffMember?.accountName || staffMember?.profile?.payrollBankDetails?.accountName || ''),
        accountNumber: String(row?.account_number || staffMember?.accountNumber || staffMember?.profile?.payrollBankDetails?.accountNumber || ''),
      }
    })
    const approved = payroll.some(p => p.approved)
    const submitted = payroll.some(p => p.submitted)
    return c.json({ success: true, payroll, lateChargeSummaries, attendanceDeductionSummaries, approved, submitted, period, settings: payrollSettings })
  } catch { return c.json({ success: true, payroll: [], approved: false, submitted: false }) }
})

app.put('/api/school/payroll/staff/:staffId', authenticate, async (c) => {
  if (!hasRequiredCapability(c.var.user.role, 'manage_payroll', c.var.user.roles)) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const staffId = c.req.param('staffId')
  const {
    basicSalary,
    housingAllowance,
    transportAllowance,
    bonus,
    allowancesMap,
    tax,
    pension,
    otherDeduction,
    deductionsMap,
    gross,
    deductions,
    status,
    paymentStatus,
    employmentCategory,
    bankName,
    accountName,
    accountNumber,
  } = await c.req.json()
  const period = new Date().toISOString().slice(0, 7)
  const id = `pay_${tenantId}_${staffId}_${period}`
  try {
    await ensurePayrollEntriesTable(c.env.APP_DB)
    const existing = await c.env.APP_DB.prepare(`SELECT * FROM payroll_entries WHERE id = ?`).bind(id).first() as any
    const staffUser = await c.env.APP_DB.prepare(
      `SELECT id, name, email, role, primary_role, employment_category, status, createdAt, tenantId FROM users WHERE id = ? AND tenantId = ?`
    ).bind(staffId, tenantId).first() as Record<string, any> | null
    const hydratedStaffUser = await hydrateUserRecord(c.env.APP_DB, staffUser)
    const allowanceDefaults = normalizePayrollNumericMap(existing?.allowances_json)
    const deductionDefaults = normalizePayrollNumericMap(existing?.deductions_json)
    const nextBasicSalary = basicSalary !== undefined ? Number(basicSalary) : Number(existing?.basic_salary || 0)
    const providedAllowancesMap = normalizePayrollNumericMap(allowancesMap, ['basicSalary'])
    const nextAllowances = {
      ...allowanceDefaults,
      ...providedAllowancesMap,
      housingAllowance: housingAllowance !== undefined ? Number(housingAllowance) : Number(allowanceDefaults.housingAllowance || 0),
      transportAllowance: transportAllowance !== undefined ? Number(transportAllowance) : Number(allowanceDefaults.transportAllowance || 0),
      bonus: bonus !== undefined ? Number(bonus) : Number(allowanceDefaults.bonus || 0),
    }
    const providedDeductionsMap = normalizePayrollNumericMap(deductionsMap)
    const nextDeductionsMap = {
      ...deductionDefaults,
      ...providedDeductionsMap,
      tax: tax !== undefined ? Number(tax) : Number(deductionDefaults.tax || 0),
      pension: pension !== undefined ? Number(pension) : Number(deductionDefaults.pension || 0),
      otherDeduction: otherDeduction !== undefined ? Number(otherDeduction) : Number(deductionDefaults.otherDeduction || 0),
    }
    const computedGross = nextBasicSalary + sumPayrollNumericMapValues(nextAllowances)
    const nextGross = gross !== undefined ? Number(gross) : computedGross
    const computedManualDeductions = sumPayrollNumericMapValues(nextDeductionsMap)
    const nextManualDed = deductions !== undefined ? Number(deductions) : computedManualDeductions
    const nextStatus = status || existing?.status || 'Ready'
    const nextPaymentStatus = String(paymentStatus || existing?.payment_status || (String(nextStatus).toLowerCase() === 'paid' ? 'paid' : 'pending')).toLowerCase()
    const nextBankDetails = buildPayrollBankDetailsRecord({
      bankName: bankName !== undefined ? bankName : existing?.bank_name,
      accountName: accountName !== undefined ? accountName : existing?.account_name,
      accountNumber: accountNumber !== undefined ? accountNumber : existing?.account_number,
    })
    const nextEmploymentCategory = String(
      employmentCategory
      || existing?.employment_category
      || hydratedStaffUser?.employmentCategory
      || deriveEmploymentCategory(hydratedStaffUser?.role || existing?.role || '', hydratedStaffUser?.employmentCategory, hydratedStaffUser?.roles)
      || 'support'
    ).toLowerCase()
    const staffRoster = await listTenantStaffRoster(c.env.APP_DB, tenantId)
    const lateChargeSummary = await getPayrollLateChargeSummaryForIdentifiers(
      c.env.APP_DB,
      tenantId,
      period,
      collectComparableIdentifiers([staffId, hydratedStaffUser?.email, hydratedStaffUser?.id]),
    )
    const attendanceDeductionSummary = (await listPayrollAttendanceDeductionSummaries(c.env.APP_DB, tenantId, period, staffRoster))
      .find(summary => summary.staffId === String(staffId || '').trim())
      || { amount: 0 }
    const newNet = nextGross - (nextManualDed + Number(lateChargeSummary.amount || 0) + Number(attendanceDeductionSummary.amount || 0))
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO payroll_entries (id, tenant_id, staff_id, period, basic_salary, allowances_json, deductions_json, gross, deductions, manual_deductions, net, status, payment_status, employment_category, bank_name, account_name, account_number, approved, submitted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        tenantId,
        staffId,
        period,
        nextBasicSalary,
        JSON.stringify(nextAllowances),
        JSON.stringify(nextDeductionsMap),
        nextGross,
        nextManualDed + Number(lateChargeSummary.amount || 0) + Number(attendanceDeductionSummary.amount || 0),
        nextManualDed,
        newNet,
        nextStatus,
        nextPaymentStatus,
        nextEmploymentCategory,
        nextBankDetails.bankName,
        nextBankDetails.accountName,
        nextBankDetails.accountNumber,
        existing?.approved || 0,
        existing?.submitted || 0,
        existing?.created_at || new Date().toISOString(),
        new Date().toISOString(),
      ).run()

    const resolvedIdentity = await resolveSettingsIdentity(c.env.APP_DB, hydratedStaffUser?.email || staffId).catch(() => null)
    if (resolvedIdentity?.settingsKey) {
      await upsertSettings(c.env.APP_DB, resolvedIdentity.settingsKey, {
        ...(resolvedIdentity.settings && typeof resolvedIdentity.settings === 'object' ? resolvedIdentity.settings : {}),
        payrollBankDetails: nextBankDetails,
      }).catch(() => {})
    }

    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not update payroll.' }, 500) }
})

app.post('/api/school/payroll/approve', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const period = new Date().toISOString().slice(0, 7)
  try {
    await c.env.APP_DB.prepare(`UPDATE payroll_entries SET approved = 1, updated_at = ? WHERE tenant_id = ? AND period = ?`).bind(new Date().toISOString(), tenantId, period).run()
    await addAudit(c.env.APP_DB, tenantId, { action: 'payrollApproved', data: { period, by: c.var.user.id } })
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not approve payroll.' }, 500) }
})

app.post('/api/school/payroll/submit', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['accountant', 'hos', 'owner'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const period = new Date().toISOString().slice(0, 7)
  try {
    await ensurePayrollEntriesTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(`UPDATE payroll_entries SET submitted = 1, updated_at = ? WHERE tenant_id = ? AND period = ?`).bind(new Date().toISOString(), tenantId, period).run()
    await addAudit(c.env.APP_DB, tenantId, { action: 'payrollSubmitted', data: { period, by: c.var.user.id } })
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not submit payroll.' }, 500) }
})

app.get('/api/school/payroll/history', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensurePayrollEntriesTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(`SELECT period, SUM(net) as total_net, MAX(approved) as approved, MAX(submitted) as submitted FROM payroll_entries WHERE tenant_id = ? GROUP BY period ORDER BY period DESC LIMIT 12`).bind(tenantId).all()
    const history = await Promise.all(((rows.results || []) as Record<string, any>[]).map(async (r: any) => {
      const note = normalizePayrollNoteRecord(await getSettings(c.env.APP_DB, getPayrollNoteSettingsKey(tenantId, String(r.period || ''))).catch(() => null), String(r.period || ''))
      return {
        period: r.period,
        totalNet: r.total_net || 0,
        status: r.approved ? 'approved' : r.submitted ? 'submitted' : 'draft',
        hasPayrollNote: Boolean(note?.savedAt),
        payrollNoteSavedAt: note?.savedAt || null,
        payrollNotePreparedBy: note?.preparedByName || '',
      }
    }))
    return c.json({ success: true, history })
  } catch { return c.json({ success: true, history: [] }) }
})

app.get('/api/school/payroll/settings', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    const data = await getSettings(c.env.APP_DB, `payroll_settings_${tenantId}`)
    return c.json({ success: true, settings: normalizePayrollSettingsInput(data || {}) })
  } catch { return c.json({ success: true, settings: normalizePayrollSettingsInput({}) }) }
})

app.post('/api/school/payroll/settings', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const payload = normalizePayrollSettingsInput(await c.req.json())
  try {
    await upsertSettings(c.env.APP_DB, `payroll_settings_${tenantId}`, payload)
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not save settings.' }, 500) }
})

app.get('/api/school/payroll/note', authenticate, async (c) => {
  if (!hasRequiredCapability(c.var.user.role, 'manage_payroll', c.var.user.roles)) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const period = normalizePayrollPeriod(c.req.query('period'))
  try {
    const note = normalizePayrollNoteRecord(await getSettings(c.env.APP_DB, getPayrollNoteSettingsKey(tenantId, period)).catch(() => null), period)
    return c.json({ success: true, note })
  } catch {
    return c.json({ success: true, note: null })
  }
})

app.post('/api/school/payroll/note', authenticate, async (c) => {
  if (!hasRequiredCapability(c.var.user.role, 'manage_payroll', c.var.user.roles)) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)

  const payload = await c.req.json().catch(() => ({})) as Record<string, any>
  const period = normalizePayrollPeriod(payload.period)

  try {
    await ensurePayrollEntriesTable(c.env.APP_DB)
    const statusRow = await c.env.APP_DB.prepare(
      `SELECT COUNT(*) AS total_rows, MAX(submitted) AS submitted, MAX(approved) AS approved
       FROM payroll_entries
       WHERE tenant_id = ? AND period = ?`
    ).bind(tenantId, period).first() as Record<string, any> | null

    if (Number(statusRow?.total_rows || 0) <= 0) {
      return c.json({ error: 'No payroll rows were found for this period.' }, 400)
    }

    if (!Number(statusRow?.submitted || 0) && !Number(statusRow?.approved || 0)) {
      return c.json({ error: 'Submit payroll before saving payroll notes for this month.' }, 400)
    }

    const note = normalizePayrollNoteRecord({
      ...payload,
      period,
      preparedByName: c.var.user?.name || c.var.user?.email || 'Authorized Officer',
      preparedByRole: c.var.user?.role || '',
      preparedByUserId: c.var.user?.id || c.var.user?.email || '',
      savedAt: new Date().toISOString(),
    }, period)

    if (!note || !note.rows.length) {
      return c.json({ error: 'Payroll notes need at least one staff row before they can be saved.' }, 400)
    }

    await upsertSettings(c.env.APP_DB, getPayrollNoteSettingsKey(tenantId, period), note)
    await addAudit(c.env.APP_DB, tenantId, {
      action: 'payrollNoteSaved',
      data: {
        period,
        by: c.var.user?.id || c.var.user?.email || '',
        preparedByRole: note.preparedByRole,
        rows: note.rows.length,
      },
    }).catch(() => {})

    return c.json({ success: true, note })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Could not save payroll notes.' }, 500)
  }
})

app.get('/api/school/payroll/my-payslip', authenticate, async (c) => {
  const userId = c.var.user?.id || c.var.user?.email
  const tenantId = c.var.user?.tenantId
  if (!userId || !tenantId) return c.json({ error: 'No user/tenant.' }, 400)
  const period = new Date().toISOString().slice(0, 7)
  try {
    await ensurePayrollEntriesTable(c.env.APP_DB)
    await ensureBrandingTable(c.env.APP_DB)
    const resolvedIdentity = await resolveSettingsIdentity(c.env.APP_DB, userId)
    const settings = await getSettings(c.env.APP_DB, userId)
    const payrollSettings = normalizePayrollSettingsInput(await getSettings(c.env.APP_DB, `payroll_settings_${tenantId}`))
    const tenant = tenantId ? await getTenantById(c.env.APP_DB, tenantId) : null
    const brandingRow = await c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenantId).first() as any
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM payroll_entries WHERE (staff_id = ? OR staff_id = ?) AND tenant_id = ? AND period = ? LIMIT 1`).bind(userId, settings?.email || userId, tenantId, period).first() as any
    // Staff can only see a payslip once the owner/HoS has approved the payroll for the period.
    if (rows && Number(rows.approved) !== 1) {
      return c.json({ success: true, payslip: null, status: 'pending', message: 'Your payslip will be available once payroll is approved by the school leadership.' })
    }
    const allowances = normalizePayrollNumericMap(rows?.allowances_json)
    const deductionsMap = normalizePayrollNumericMap(rows?.deductions_json)
    const basicSalary = Number(rows?.basic_salary || 0)
    const gross = Number(rows?.gross || (basicSalary + sumPayrollNumericMapValues(allowances)))
    const manualDeductions = Number((rows?.manual_deductions ?? rows?.deductions) || sumPayrollNumericMapValues(deductionsMap))
    const lateChargeSummary = await getPayrollLateChargeSummaryForIdentifiers(
      c.env.APP_DB,
      tenantId,
      period,
      collectResolvedIdentityIdentifiers(resolvedIdentity, c.var.user || {}),
    )
    const deductions = manualDeductions + lateChargeSummary.amount
    const net = Number(gross - deductions)
    const branding = {
      schoolName: tenant?.schoolName || 'School',
      logoUrl: String(brandingRow?.logo_url || '').trim(),
      tagline: String(brandingRow?.tagline || '').trim(),
      website: String(brandingRow?.website || (tenant?.websiteDomain ? `https://${tenant.websiteDomain}` : '') || '').trim(),
    }
    const earnings = payrollSettings.earningColumns
      .map((column: Record<string, any>) => ({
        key: column.key,
        label: String(column.label || column.key),
        amount: Number((column.key === 'basicSalary' ? basicSalary : allowances[column.key] || 0) || 0),
      }))
      .filter((entry: Record<string, any>) => entry.amount > 0 || entry.key === 'basicSalary')
    const deductionBreakdown = payrollSettings.deductionColumns
      .map((column: Record<string, any>) => ({
        key: column.key,
        label: String(column.label || column.key),
        amount: Number(deductionsMap[column.key] || 0),
      }))
      .filter((entry: Record<string, any>) => entry.amount > 0)

    return c.json({ success: true, payslip: {
      staffId: userId, name: settings?.name || c.var.user.name || userId, displayId: getPublicFacingUserId(settings || {}, getPrimaryRole(settings || {}, getActiveRole(c.var.user))),
      role: settings?.role || getActiveRole(c.var.user), period, schoolName: branding.schoolName,
      logoUrl: branding.logoUrl,
      tagline: branding.tagline,
      website: branding.website,
      branding,
      gross,
      deductions,
      net,
      earnings,
      deductionBreakdown: [
        ...deductionBreakdown,
        { label: 'Lateness Charges', amount: Number(lateChargeSummary.amount.toFixed(2)) },
      ].filter(entry => entry.amount > 0),
      lateChargeCount: lateChargeSummary.count,
      settings: {
        ...(payrollSettings || {}),
      },
    }})
  } catch { return c.json({ success: true, payslip: { gross: 0, deductions: 0, net: 0, period } }) }
})

// ─── Staff Attendance ─────────────────────────────────────────────────────────
async function ensureStaffAttendanceBaseTable(db: D1Database) {
  if (_initializedTables.has('staff_attendance_base')) return
  _initializedTables.add('staff_attendance_base')
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    staff_id TEXT,
    date TEXT,
    status TEXT,
    recorded_by TEXT,
    created_at TEXT
  )`).run()
}

async function ensureStaffAttendanceSettingsTable(db: D1Database) {
  if (_initializedTables.has('staff_attendance_settings')) return
  _initializedTables.add('staff_attendance_settings')
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance_settings (
    tenant_id TEXT PRIMARY KEY,
    mode TEXT,
    require_qr_on_face INTEGER,
    active_qr_code TEXT,
    late_after_time TEXT,
    grace_period_minutes INTEGER,
    late_penalty_enabled INTEGER,
    late_penalty_amount REAL,
    absence_penalty_enabled INTEGER,
    absence_penalty_amount REAL,
    payroll_auto_deduct_absence INTEGER,
    qr_rotated_at TEXT,
    updated_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run()

  try { await db.exec('ALTER TABLE staff_attendance_settings ADD COLUMN late_after_time TEXT') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_settings ADD COLUMN grace_period_minutes INTEGER DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_settings ADD COLUMN late_penalty_enabled INTEGER DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_settings ADD COLUMN late_penalty_amount REAL DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_settings ADD COLUMN absence_penalty_enabled INTEGER DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_settings ADD COLUMN absence_penalty_amount REAL DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_settings ADD COLUMN payroll_auto_deduct_absence INTEGER DEFAULT 0') } catch {}
}

async function ensureStaffAttendanceEventsTable(db: D1Database) {
  if (_initializedTables.has('staff_attendance_events')) return
  _initializedTables.add('staff_attendance_events')
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    staff_id TEXT,
    date TEXT,
    action TEXT,
    method TEXT,
    qr_code TEXT,
    face_image_url TEXT,
    shared_phone INTEGER,
    is_late INTEGER,
    late_minutes INTEGER,
    late_charge REAL,
    permission_request_id TEXT,
    permission_status TEXT,
    notes TEXT,
    recorded_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run()

  try { await db.exec('ALTER TABLE staff_attendance_events ADD COLUMN shared_phone INTEGER DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_events ADD COLUMN is_late INTEGER DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_events ADD COLUMN late_minutes INTEGER DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_events ADD COLUMN late_charge REAL DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_events ADD COLUMN permission_request_id TEXT') } catch {}
  try { await db.exec('ALTER TABLE staff_attendance_events ADD COLUMN permission_status TEXT') } catch {}
}

async function ensureStaffAttendancePermissionRequestsTable(db: D1Database) {
  if (_initializedTables.has('staff_attendance_permission_requests')) return
  _initializedTables.add('staff_attendance_permission_requests')
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance_permission_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    staff_id TEXT,
    request_type TEXT,
    start_date TEXT,
    end_date TEXT,
    reason TEXT,
    status TEXT,
    decision_note TEXT,
    requested_by TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run()

  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_staff_attendance_permission_requests_tenant_staff_status ON staff_attendance_permission_requests(tenant_id, staff_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_attendance_permission_requests_tenant_dates ON staff_attendance_permission_requests(tenant_id, start_date, end_date)`,
  ])
}

function canManageStaffAttendanceConfig(role: string) {
  return ['owner', 'hos', 'ict', 'ict_manager'].includes(String(role || '').toLowerCase().trim())
}

function canUseStaffAttendance(role: string) {
  return !['', 'student', 'parent', 'ami'].includes(String(role || '').toLowerCase().trim())
}

function generateStaffAttendanceQrCode(tenantId: string) {
  return `ndovera-${tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeStaffAttendanceCutoffTime(value: unknown, fallback = '08:00') {
  const normalized = String(value || '').trim()
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : fallback
}

function normalizeStaffAttendanceGraceMinutes(value: unknown, fallback = 0) {
  const normalized = Math.max(0, Math.trunc(Number(value || fallback) || 0))
  return Number.isFinite(normalized) ? normalized : fallback
}

function normalizeStaffAttendanceRequestType(value: unknown, fallback = 'absence') {
  const normalized = String(value || fallback).trim().toLowerCase()
  return ['absence', 'late', 'official', 'remote'].includes(normalized) ? normalized : fallback
}

function normalizeStaffAttendancePermissionStatus(value: unknown, fallback = 'pending') {
  const normalized = String(value || fallback).trim().toLowerCase()
  return ['pending', 'approved', 'rejected'].includes(normalized) ? normalized : fallback
}

function canReviewStaffAttendancePermissions(role: string) {
  return ['owner', 'hos'].includes(String(role || '').toLowerCase().trim())
}

function buildStaffAttendanceLateMetrics(attendanceDate: string, recordedAt: string, settings: Record<string, any> | null) {
  const lateAfterTime = normalizeStaffAttendanceCutoffTime(settings?.late_after_time, '08:00')
  const gracePeriodMinutes = normalizeStaffAttendanceGraceMinutes(settings?.grace_period_minutes, 0)
  const latePenaltyEnabled = Boolean(Number(settings?.late_penalty_enabled ?? 0))
  const configuredCharge = Number(settings?.late_penalty_amount || 0)
  const eventTimestamp = new Date(recordedAt).getTime()
  const cutoffTimestamp = new Date(`${attendanceDate}T${lateAfterTime}:00`).getTime()
  const effectiveCutoffTimestamp = cutoffTimestamp + (gracePeriodMinutes * 60000)

  if (!Number.isFinite(eventTimestamp) || !Number.isFinite(effectiveCutoffTimestamp) || eventTimestamp <= effectiveCutoffTimestamp) {
    return {
      lateAfterTime,
      gracePeriodMinutes,
      latePenaltyEnabled,
      latePenaltyAmount: configuredCharge,
      isLate: false,
      lateMinutes: 0,
      lateCharge: 0,
    }
  }

  const lateMinutes = Math.max(0, Math.round((eventTimestamp - effectiveCutoffTimestamp) / 60000))
  return {
    lateAfterTime,
    gracePeriodMinutes,
    latePenaltyEnabled,
    latePenaltyAmount: configuredCharge,
    isLate: lateMinutes > 0,
    lateMinutes,
    lateCharge: latePenaltyEnabled ? configuredCharge : 0,
  }
}

function mapStaffAttendanceSettings(row: Record<string, any> | null, includeSecret = true) {
  const mode = String(row?.mode || 'qr') === 'face_qr' ? 'face_qr' : 'qr'
  const mapped = {
    mode,
    modeLabel: mode === 'face_qr' ? 'Face + QR (Shared Phone)' : 'QR Sign-In',
    modeDescription: mode === 'face_qr'
      ? 'Use this when a staff member is signing in from another person\'s phone. The face capture and active school QR must appear together.'
      : 'Use this when staff sign in with the active school QR on their own phone or a school scanner.',
    requireQrOnFace: Boolean(Number(row?.require_qr_on_face ?? 1)),
    lateAfterTime: normalizeStaffAttendanceCutoffTime(row?.late_after_time, '08:00'),
    gracePeriodMinutes: normalizeStaffAttendanceGraceMinutes(row?.grace_period_minutes, 0),
    latePenaltyEnabled: Boolean(Number(row?.late_penalty_enabled ?? 0)),
    latePenaltyAmount: Number(row?.late_penalty_amount || 0),
    absencePenaltyEnabled: Boolean(Number(row?.absence_penalty_enabled ?? 0)),
    absencePenaltyAmount: Number(row?.absence_penalty_amount || 0),
    payrollAutoDeductAbsence: Boolean(Number(row?.payroll_auto_deduct_absence ?? 0)),
    qrRotatedAt: String(row?.qr_rotated_at || row?.updated_at || row?.created_at || ''),
    updatedAt: String(row?.updated_at || row?.created_at || ''),
  } as Record<string, any>

  if (includeSecret) {
    mapped.activeQrCode = String(row?.active_qr_code || '')
  }

  return mapped
}

function mapStaffAttendanceEvent(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    staffId: String(row.staff_id || ''),
    date: String(row.date || ''),
    action: String(row.action || ''),
    method: String(row.method || ''),
    qrCode: String(row.qr_code || ''),
    faceImageUrl: String(row.face_image_url || ''),
    sharedPhone: Boolean(Number(row.shared_phone || 0)),
    isLate: Boolean(Number(row.is_late || 0)),
    lateMinutes: Number(row.late_minutes || 0),
    lateCharge: Number(row.late_charge || 0),
    permissionRequestId: String(row.permission_request_id || ''),
    permissionStatus: String(row.permission_status || ''),
    notes: String(row.notes || ''),
    recordedBy: String(row.recorded_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
  }
}

function mapStaffAttendancePermissionRequest(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    tenantId: String(row.tenant_id || ''),
    staffId: String(row.staff_id || ''),
    requestType: normalizeStaffAttendanceRequestType(row.request_type, 'absence'),
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || row.start_date || ''),
    reason: String(row.reason || ''),
    status: normalizeStaffAttendancePermissionStatus(row.status, 'pending'),
    decisionNote: String(row.decision_note || ''),
    requestedBy: String(row.requested_by || ''),
    reviewedBy: String(row.reviewed_by || ''),
    reviewedAt: String(row.reviewed_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
  }
}

function decodeBase64String(value: string) {
  const normalized = String(value || '').replace(/\s+/g, '')
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function parseImageDataUrl(value: unknown) {
  const normalized = String(value || '').trim()
  const match = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null

  return {
    contentType: String(match[1] || 'image/jpeg').trim() || 'image/jpeg',
    bytes: decodeBase64String(String(match[2] || '')),
  }
}

async function storeStaffAttendanceFaceImageDataUrl(env: any, tenantId: string, staffId: string, dataUrl: unknown) {
  const parsed = parseImageDataUrl(dataUrl)
  if (!parsed) return ''

  const extension = parsed.contentType.split('/').pop()?.split('+')[0] || 'jpg'
  const key = `attendance/staff/${tenantId}/${staffId}/${Date.now()}.${extension}`
  await env.UPLOADS.put(key, parsed.bytes, { httpMetadata: { contentType: parsed.contentType } })
  return `https://ndovera.com/files/${key}`
}

async function getOrCreateStaffAttendanceSettings(db: D1Database, tenantId: string) {
  await ensureStaffAttendanceSettingsTable(db)
  const existing = await db.prepare(`SELECT * FROM staff_attendance_settings WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null

  if (existing) {
    return existing
  }

  const timestamp = new Date().toISOString()
  const seeded = {
    tenant_id: tenantId,
    mode: 'qr',
    require_qr_on_face: 1,
    active_qr_code: generateStaffAttendanceQrCode(tenantId),
    late_after_time: '08:00',
    grace_period_minutes: 0,
    late_penalty_enabled: 0,
    late_penalty_amount: 0,
    absence_penalty_enabled: 0,
    absence_penalty_amount: 0,
    payroll_auto_deduct_absence: 0,
    qr_rotated_at: timestamp,
    updated_by: 'system',
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.prepare(
    `INSERT INTO staff_attendance_settings (tenant_id, mode, require_qr_on_face, active_qr_code, late_after_time, grace_period_minutes, late_penalty_enabled, late_penalty_amount, absence_penalty_enabled, absence_penalty_amount, payroll_auto_deduct_absence, qr_rotated_at, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    seeded.tenant_id,
    seeded.mode,
    seeded.require_qr_on_face,
    seeded.active_qr_code,
    seeded.late_after_time,
    seeded.grace_period_minutes,
    seeded.late_penalty_enabled,
    seeded.late_penalty_amount,
    seeded.absence_penalty_enabled,
    seeded.absence_penalty_amount,
    seeded.payroll_auto_deduct_absence,
    seeded.qr_rotated_at,
    seeded.updated_by,
    seeded.created_at,
    seeded.updated_at,
  ).run()

  return seeded
}

app.get('/api/school/staff-attendance', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10)
  try {
    await ensureStaffAttendanceBaseTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM staff_attendance WHERE tenant_id = ? AND date = ?`).bind(actor.tenantId, date).all()
    const records = ((rows.results || []) as Record<string, any>[]).map(row => ({
      id: String(row.id || ''),
      tenantId: String(row.tenant_id || actor.tenantId),
      staffId: String(row.staff_id || ''),
      date: String(row.date || ''),
      status: String(row.status || ''),
      recordedBy: String(row.recorded_by || ''),
      createdAt: String(row.created_at || ''),
    }))
    return c.json({ success: true, records })
  } catch { return c.json({ success: true, records: [] }) }
})

app.post('/api/school/staff-attendance', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { staffId, date, status } = await c.req.json()
  if (!staffId || !date || !status) return c.json({ error: 'staffId, date, status required.' }, 400)
  const id = `sa_${actor.tenantId}_${staffId}_${date}`
  try {
    await ensureStaffAttendanceBaseTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO staff_attendance (id, tenant_id, staff_id, date, status, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, actor.tenantId, staffId, date, status, actor.actorName || actor.actorId, new Date().toISOString()).run()
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not record attendance.' }, 500) }
})

app.get('/api/school/staff-attendance/settings', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)

  try {
    const settings = await getOrCreateStaffAttendanceSettings(c.env.APP_DB, actor.tenantId)
    return c.json({
      success: true,
      settings: mapStaffAttendanceSettings(settings, canManageStaffAttendanceConfig(actor.role)),
    })
  } catch {
    return c.json({ error: 'Could not load staff attendance settings.' }, 500)
  }
})

app.post('/api/school/staff-attendance/settings', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!canManageStaffAttendanceConfig(actor.role)) return c.json({ error: 'forbidden' }, 403)
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)

  const body = await c.req.json()
  const mode = String(body?.mode || 'qr') === 'face_qr' ? 'face_qr' : 'qr'
  const requireQrOnFace = body?.requireQrOnFace === false ? 0 : 1
  const lateAfterTime = normalizeStaffAttendanceCutoffTime(body?.lateAfterTime, '08:00')
  const gracePeriodMinutes = normalizeStaffAttendanceGraceMinutes(body?.gracePeriodMinutes, 0)
  const latePenaltyEnabled = body?.latePenaltyEnabled === true ? 1 : 0
  const latePenaltyAmount = Number(body?.latePenaltyAmount || 0)
  const absencePenaltyEnabled = body?.absencePenaltyEnabled === true ? 1 : 0
  const absencePenaltyAmount = Number(body?.absencePenaltyAmount || 0)
  const payrollAutoDeductAbsence = body?.payrollAutoDeductAbsence === true ? 1 : 0

  try {
    const existing = await getOrCreateStaffAttendanceSettings(c.env.APP_DB, actor.tenantId)
    const timestamp = new Date().toISOString()
    await c.env.APP_DB.prepare(
      `INSERT OR REPLACE INTO staff_attendance_settings (tenant_id, mode, require_qr_on_face, active_qr_code, late_after_time, grace_period_minutes, late_penalty_enabled, late_penalty_amount, absence_penalty_enabled, absence_penalty_amount, payroll_auto_deduct_absence, qr_rotated_at, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      actor.tenantId,
      mode,
      requireQrOnFace,
      String(existing.active_qr_code || generateStaffAttendanceQrCode(actor.tenantId)),
      lateAfterTime,
      gracePeriodMinutes,
      latePenaltyEnabled,
      Number.isFinite(latePenaltyAmount) && latePenaltyAmount > 0 ? latePenaltyAmount : 0,
      absencePenaltyEnabled,
      Number.isFinite(absencePenaltyAmount) && absencePenaltyAmount > 0 ? absencePenaltyAmount : 0,
      payrollAutoDeductAbsence,
      String(existing.qr_rotated_at || timestamp),
      actor.actorName || actor.actorId,
      String(existing.created_at || timestamp),
      timestamp,
    ).run()

    const updated = await getOrCreateStaffAttendanceSettings(c.env.APP_DB, actor.tenantId)
    return c.json({ success: true, settings: mapStaffAttendanceSettings(updated, true) })
  } catch {
    return c.json({ error: 'Could not save staff attendance settings.' }, 500)
  }
})

app.post('/api/school/staff-attendance/settings/rotate-qr', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!canManageStaffAttendanceConfig(actor.role)) return c.json({ error: 'forbidden' }, 403)
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)

  try {
    const existing = await getOrCreateStaffAttendanceSettings(c.env.APP_DB, actor.tenantId)
    const timestamp = new Date().toISOString()
    const activeQrCode = generateStaffAttendanceQrCode(actor.tenantId)
    await c.env.APP_DB.prepare(
      `INSERT OR REPLACE INTO staff_attendance_settings (tenant_id, mode, require_qr_on_face, active_qr_code, late_after_time, grace_period_minutes, late_penalty_enabled, late_penalty_amount, absence_penalty_enabled, absence_penalty_amount, payroll_auto_deduct_absence, qr_rotated_at, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      actor.tenantId,
      String(existing.mode || 'qr'),
      Number(existing.require_qr_on_face ?? 1),
      activeQrCode,
      normalizeStaffAttendanceCutoffTime(existing.late_after_time, '08:00'),
      normalizeStaffAttendanceGraceMinutes(existing.grace_period_minutes, 0),
      Number(existing.late_penalty_enabled ?? 0),
      Number(existing.late_penalty_amount || 0),
      Number(existing.absence_penalty_enabled ?? 0),
      Number(existing.absence_penalty_amount || 0),
      Number(existing.payroll_auto_deduct_absence ?? 0),
      timestamp,
      actor.actorName || actor.actorId,
      String(existing.created_at || timestamp),
      timestamp,
    ).run()

    const updated = await getOrCreateStaffAttendanceSettings(c.env.APP_DB, actor.tenantId)
    return c.json({ success: true, settings: mapStaffAttendanceSettings(updated, true) })
  } catch {
    return c.json({ error: 'Could not rotate attendance QR.' }, 500)
  }
})

app.post('/api/school/staff-attendance/face-upload', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canUseStaffAttendance(actor.role)) return c.json({ error: 'forbidden' }, 403)

  const formData = await c.req.formData()
  const file = formData.get('file') as File
  if (!file) return c.json({ error: 'No file provided.' }, 400)

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const key = `attendance/staff/${actor.tenantId}/${actor.actorId}/${Date.now()}.${ext}`
    await c.env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'image/jpeg' } })
    return c.json({ success: true, url: `https://ndovera.com/files/${key}` })
  } catch {
    return c.json({ error: 'Upload failed.' }, 500)
  }
})

app.get('/api/school/staff-attendance/permissions', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canUseStaffAttendance(actor.role)) return c.json({ error: 'forbidden' }, 403)

  const requestedStaffId = String(c.req.query('staffId') || '').trim()
  const status = normalizeStaffAttendancePermissionStatus(c.req.query('status'), '')
  const fromDate = normalizeIsoDateValue(c.req.query('from'))
  const toDate = normalizeIsoDateValue(c.req.query('to'))
  const rawLimit = Number(c.req.query('limit') || 40)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(200, Math.trunc(rawLimit)) : 40
  const effectiveStaffId = canReviewStaffAttendancePermissions(actor.role) ? requestedStaffId : actor.actorId

  if (!canReviewStaffAttendancePermissions(actor.role) && requestedStaffId && requestedStaffId !== actor.actorId) {
    return c.json({ error: 'forbidden' }, 403)
  }

  try {
    await ensureStaffAttendancePermissionRequestsTable(c.env.APP_DB)
    let query = 'SELECT * FROM staff_attendance_permission_requests WHERE tenant_id = ?'
    const params: Array<string | number> = [actor.tenantId]

    if (effectiveStaffId) {
      query += ' AND staff_id = ?'
      params.push(effectiveStaffId)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (fromDate) {
      query += ' AND end_date >= ?'
      params.push(fromDate)
    }

    if (toDate) {
      query += ' AND start_date <= ?'
      params.push(toDate)
    }

    query += ' ORDER BY updated_at DESC, created_at DESC LIMIT ?'
    params.push(limit)

    const rows = await c.env.APP_DB.prepare(query).bind(...params).all()
    return c.json({
      success: true,
      requests: ((rows.results || []) as Record<string, any>[]).map(mapStaffAttendancePermissionRequest),
    })
  } catch {
    return c.json({ success: true, requests: [] })
  }
})

app.post('/api/school/staff-attendance/permissions', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canUseStaffAttendance(actor.role)) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const requestType = normalizeStaffAttendanceRequestType(body?.requestType, 'absence')
  const startDate = normalizeIsoDateValue(body?.startDate || body?.date)
  const endDate = normalizeIsoDateValue(body?.endDate || body?.startDate || body?.date)
  const reason = String(body?.reason || '').trim().slice(0, 1200)

  if (!startDate || !endDate || endDate < startDate) {
    return c.json({ error: 'A valid start and end date are required.' }, 400)
  }

  if (!reason) {
    return c.json({ error: 'Explain why you need attendance permission.' }, 400)
  }

  try {
    await ensureStaffAttendancePermissionRequestsTable(c.env.APP_DB)
    const timestamp = new Date().toISOString()
    const requestId = `sap_${actor.tenantId}_${actor.actorId}_${Date.now()}`
    await c.env.APP_DB.prepare(
      `INSERT INTO staff_attendance_permission_requests (id, tenant_id, staff_id, request_type, start_date, end_date, reason, status, decision_note, requested_by, reviewed_by, reviewed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      requestId,
      actor.tenantId,
      actor.actorId,
      requestType,
      startDate,
      endDate,
      reason,
      'pending',
      null,
      actor.actorName || actor.actorId,
      null,
      null,
      timestamp,
      timestamp,
    ).run()

    return c.json({
      success: true,
      request: mapStaffAttendancePermissionRequest({
        id: requestId,
        tenant_id: actor.tenantId,
        staff_id: actor.actorId,
        request_type: requestType,
        start_date: startDate,
        end_date: endDate,
        reason,
        status: 'pending',
        decision_note: '',
        requested_by: actor.actorName || actor.actorId,
        reviewed_by: '',
        reviewed_at: '',
        created_at: timestamp,
        updated_at: timestamp,
      }),
    })
  } catch {
    return c.json({ error: 'Could not submit the attendance permission request.' }, 500)
  }
})

app.post('/api/school/staff-attendance/permissions/:requestId/review', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canReviewStaffAttendancePermissions(actor.role)) return c.json({ error: 'forbidden' }, 403)

  const requestId = String(c.req.param('requestId') || '').trim()
  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const decision = normalizeStaffAttendancePermissionStatus(body?.decision, '')
  const decisionNote = String(body?.decisionNote || body?.note || '').trim().slice(0, 1200)

  if (!requestId || !['approved', 'rejected'].includes(decision)) {
    return c.json({ error: 'A valid review decision is required.' }, 400)
  }

  try {
    await ensureStaffAttendancePermissionRequestsTable(c.env.APP_DB)
    const existing = await c.env.APP_DB.prepare(
      `SELECT * FROM staff_attendance_permission_requests WHERE id = ? AND tenant_id = ? LIMIT 1`
    ).bind(requestId, actor.tenantId).first() as Record<string, any> | null

    if (!existing) {
      return c.json({ error: 'Attendance permission request not found.' }, 404)
    }

    const timestamp = new Date().toISOString()
    await c.env.APP_DB.prepare(
      `UPDATE staff_attendance_permission_requests
       SET status = ?, decision_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`
    ).bind(
      decision,
      decisionNote || null,
      actor.actorName || actor.actorId,
      timestamp,
      timestamp,
      requestId,
      actor.tenantId,
    ).run()

    const updated = await c.env.APP_DB.prepare(
      `SELECT * FROM staff_attendance_permission_requests WHERE id = ? AND tenant_id = ? LIMIT 1`
    ).bind(requestId, actor.tenantId).first() as Record<string, any> | null

    return c.json({ success: true, request: mapStaffAttendancePermissionRequest(updated || existing) })
  } catch {
    return c.json({ error: 'Could not review the attendance permission request.' }, 500)
  }
})

app.get('/api/school/staff-attendance/activity', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canUseStaffAttendance(actor.role)) return c.json({ error: 'forbidden' }, 403)

  const requestedStaffId = String(c.req.query('staffId') || '').trim()
  const date = String(c.req.query('date') || '').trim()
  const fromDate = String(c.req.query('from') || '').trim()
  const toDate = String(c.req.query('to') || '').trim()
  const rawLimit = Number(c.req.query('limit') || 20)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : 20
  const effectiveStaffId = canManageStaffAttendanceConfig(actor.role) ? requestedStaffId : actor.actorId

  if (!canManageStaffAttendanceConfig(actor.role) && requestedStaffId && requestedStaffId !== actor.actorId) {
    return c.json({ error: 'forbidden' }, 403)
  }

  try {
    await ensureStaffAttendanceEventsTable(c.env.APP_DB)
    let query = 'SELECT * FROM staff_attendance_events WHERE tenant_id = ?'
    const params: Array<string | number> = [actor.tenantId]

    if (date) {
      query += ' AND date = ?'
      params.push(date)
    } else {
      const effectiveFrom = fromDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
      const effectiveTo = toDate || new Date().toISOString().slice(0, 10)
      query += ' AND date >= ? AND date <= ?'
      params.push(effectiveFrom, effectiveTo)
    }

    if (effectiveStaffId) {
      query += ' AND staff_id = ?'
      params.push(effectiveStaffId)
    }

    query += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const rows = await c.env.APP_DB.prepare(query).bind(...params).all()
    const events = ((rows.results || []) as Record<string, any>[]).map(mapStaffAttendanceEvent)
    const signInEvents = events.filter(event => event.action === 'sign-in')
    const summary = {
      signIns: signInEvents.length,
      signOuts: events.filter(event => event.action === 'sign-out').length,
      onTimeCount: signInEvents.filter(event => !event.isLate).length,
      lateCount: signInEvents.filter(event => event.isLate).length,
      lateMinutes: signInEvents.reduce((sum, event) => sum + Number(event.lateMinutes || 0), 0),
      lateCharge: signInEvents.reduce((sum, event) => sum + Number(event.lateCharge || 0), 0),
      totalCharges: signInEvents.reduce((sum, event) => sum + Number(event.lateCharge || 0), 0),
    }
    return c.json({ success: true, events, summary })
  } catch {
    return c.json({ success: true, events: [], summary: { signIns: 0, signOuts: 0, onTimeCount: 0, lateCount: 0, lateMinutes: 0, lateCharge: 0, totalCharges: 0 } })
  }
})

// Resolve a colleague (any non-student/parent staff in the same tenant) for proxy sign-in.
async function resolveStaffMemberForProxy(db: D1Database, tenantId: string, staffId: string) {
  const row = await findUserByIdentifier(db, staffId).catch(() => null)
  if (!row) return null
  const hydrated = ((await hydrateUserRecords(db, [row]))[0]) as Record<string, any> | undefined
  if (!hydrated || String(hydrated.tenantId || '') !== String(tenantId || '')) return null
  const role = String(hydrated.role || '').toLowerCase()
  if (['student', 'parent'].includes(role)) return null
  return { id: String(hydrated.id || ''), name: String(hydrated.name || hydrated.email || staffId) }
}

// Colleague list for the "sign in for a friend" selector.
app.get('/api/school/staff-attendance/colleagues', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canUseStaffAttendance(actor.role)) return c.json({ error: 'forbidden' }, 403)
  try {
    await ensureUsersTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      `SELECT id, name, email, role FROM users WHERE tenantId = ? AND (status IS NULL OR status != 'inactive') AND lower(coalesce(role,'')) NOT IN ('student','parent') ORDER BY name`
    ).bind(actor.tenantId).all()
    const colleagues = ((rows.results || []) as Record<string, any>[])
      .map(row => ({ id: String(row.id || ''), name: String(row.name || row.email || 'Staff'), role: String(row.role || '') }))
      .filter(person => person.id && String(person.id) !== String(actor.actorId))
    return c.json({ success: true, colleagues })
  } catch {
    return c.json({ success: true, colleagues: [] })
  }
})

app.post('/api/school/staff-attendance/activity', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canUseStaffAttendance(actor.role)) return c.json({ error: 'forbidden' }, 403)

  const body = await c.req.json()
  const action = String(body?.action || 'sign-in') === 'sign-out' ? 'sign-out' : 'sign-in'
  const attendanceDate = String(body?.date || new Date().toISOString().slice(0, 10)).trim()
  const qrCode = String(body?.qrCode || '').trim()
  const sharedPhone = body?.sharedPhone === true || body?.sharedPhone === 'true' || body?.sharedPhone === 1
  const faceImageDataUrl = String(body?.faceImageDataUrl || '').trim()
  let faceImageUrl = String(body?.faceImageUrl || '').trim()
  const notes = String(body?.notes || '').trim()
  const targetStaffId = String(body?.targetStaffId || '').trim()

  try {
    const settings = await getOrCreateStaffAttendanceSettings(c.env.APP_DB, actor.tenantId)
    const normalizedMode = String(settings.mode || 'qr') === 'face_qr' ? 'face_qr' : 'qr'
    const requireQrOnFace = Boolean(Number(settings.require_qr_on_face ?? 1))
    const activeQrCode = String(settings.active_qr_code || '')

    // "Sign in for a friend": the signed-in staff marks a colleague's attendance. The colleague's
    // face + the school QR are always required so it can't be abused for buddy-punching.
    let subjectId = actor.actorId
    let subjectName = actor.actorName || actor.actorId
    let isProxy = false
    if (targetStaffId && targetStaffId !== actor.actorId) {
      const target = await resolveStaffMemberForProxy(c.env.APP_DB, actor.tenantId, targetStaffId)
      if (!target) return c.json({ error: 'Could not find that colleague to sign in for.' }, 404)
      subjectId = target.id
      subjectName = target.name
      isProxy = true
    }

    const effectiveMode = normalizedMode === 'face_qr' || sharedPhone || isProxy ? 'face_qr' : 'qr'

    if (!qrCode || qrCode !== activeQrCode) {
      return c.json({ error: 'The scanned QR code is not valid for this school.' }, 400)
    }

    if (!faceImageUrl && faceImageDataUrl) {
      faceImageUrl = await storeStaffAttendanceFaceImageDataUrl(c.env, actor.tenantId, subjectId, faceImageDataUrl)
    }

    if (effectiveMode === 'face_qr') {
      if (requireQrOnFace && !qrCode) {
        return c.json({ error: 'QR code is required for face attendance.' }, 400)
      }
      if (!faceImageUrl) {
        return c.json({ error: 'A face capture is required for this attendance mode.' }, 400)
      }
    }

    await ensureStaffAttendanceEventsTable(c.env.APP_DB)
    await ensureStaffAttendanceBaseTable(c.env.APP_DB)
    await ensureStaffAttendancePermissionRequestsTable(c.env.APP_DB)

    const timestamp = new Date().toISOString()
    const eventId = `sae_${actor.tenantId}_${subjectId}_${attendanceDate}_${action}`
    const method = isProxy ? 'proxy_face_qr' : (sharedPhone ? 'shared_phone' : (effectiveMode === 'face_qr' ? 'face_qr' : 'qr'))
    const approvedPermission = await c.env.APP_DB.prepare(
      `SELECT *
       FROM staff_attendance_permission_requests
       WHERE tenant_id = ?
         AND staff_id = ?
         AND status = 'approved'
         AND start_date <= ?
         AND end_date >= ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    ).bind(actor.tenantId, subjectId, attendanceDate, attendanceDate).first() as Record<string, any> | null
    let lateMetrics = action === 'sign-in'
      ? buildStaffAttendanceLateMetrics(attendanceDate, timestamp, settings)
      : buildStaffAttendanceLateMetrics(attendanceDate, `${attendanceDate}T00:00:00`, settings)

    if (approvedPermission && action === 'sign-in' && lateMetrics.isLate) {
      lateMetrics = {
        ...lateMetrics,
        lateCharge: 0,
      }
    }

    await c.env.APP_DB.prepare(
      `INSERT OR REPLACE INTO staff_attendance_events (id, tenant_id, staff_id, date, action, method, qr_code, face_image_url, shared_phone, is_late, late_minutes, late_charge, permission_request_id, permission_status, notes, recorded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventId,
      actor.tenantId,
      subjectId,
      attendanceDate,
      action,
      method,
      qrCode,
      faceImageUrl || null,
      (sharedPhone || isProxy) ? 1 : 0,
      lateMetrics.isLate ? 1 : 0,
      lateMetrics.lateMinutes,
      lateMetrics.lateCharge,
      String(approvedPermission?.id || '') || null,
      approvedPermission ? 'approved' : null,
      notes || null,
      actor.actorName || actor.actorId,
      timestamp,
      timestamp,
    ).run()

    if (action === 'sign-in') {
      const summaryId = `sa_${actor.tenantId}_${subjectId}_${attendanceDate}`
      await c.env.APP_DB.prepare(
        `INSERT OR REPLACE INTO staff_attendance (id, tenant_id, staff_id, date, status, recorded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        summaryId,
        actor.tenantId,
        subjectId,
        attendanceDate,
        lateMetrics.isLate ? 'Late' : 'Present',
        actor.actorName || actor.actorId,
        timestamp,
      ).run()
    }

    return c.json({
      success: true,
      event: mapStaffAttendanceEvent({
        id: eventId,
        tenant_id: actor.tenantId,
        staff_id: subjectId,
        subject_name: subjectName,
        date: attendanceDate,
        action,
        method,
        qr_code: qrCode,
        face_image_url: faceImageUrl,
        shared_phone: (sharedPhone || isProxy) ? 1 : 0,
        is_late: lateMetrics.isLate ? 1 : 0,
        late_minutes: lateMetrics.lateMinutes,
        late_charge: lateMetrics.lateCharge,
        permission_request_id: String(approvedPermission?.id || '') || null,
        permission_status: approvedPermission ? 'approved' : '',
        notes,
        recorded_by: actor.actorName || actor.actorId,
        created_at: timestamp,
        updated_at: timestamp,
      }),
    })
  } catch {
    return c.json({ error: 'Could not record staff attendance activity.' }, 500)
  }
})

// ─── School Calendar & Public Holidays ───────────────────────────────────────

const SCHOOL_CALENDAR_TYPES = new Set(['holiday', 'break', 'event', 'term_start', 'term_end'])
// Fixed-date Nigerian public holidays (month-day). Variable holidays (Eid, Easter,
// Good Friday) shift each year, so schools add those to their own calendar.
const NIGERIA_FIXED_PUBLIC_HOLIDAYS: Array<{ monthDay: string; title: string }> = [
  { monthDay: '01-01', title: "New Year's Day" },
  { monthDay: '05-01', title: "Workers' Day" },
  { monthDay: '05-27', title: "Children's Day" },
  { monthDay: '06-12', title: 'Democracy Day' },
  { monthDay: '10-01', title: 'Independence Day' },
  { monthDay: '12-25', title: 'Christmas Day' },
  { monthDay: '12-26', title: 'Boxing Day' },
]

async function ensureSchoolCalendarTable(db: D1Database) {
  if (_initializedTables.has('school_calendar_events')) return
  _initializedTables.add('school_calendar_events')
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_calendar_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    title TEXT,
    type TEXT,
    start_date TEXT,
    end_date TEXT,
    recurring_annual INTEGER DEFAULT 0,
    source TEXT DEFAULT 'school',
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run()
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_school_calendar_tenant_dates ON school_calendar_events(tenant_id, start_date, end_date)`,
  ])
}

function mapSchoolCalendarEvent(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    type: String(row.type || 'event'),
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || row.start_date || ''),
    recurringAnnual: Boolean(Number(row.recurring_annual || 0)),
    source: String(row.source || 'school'),
    createdBy: String(row.created_by || ''),
    createdAt: String(row.created_at || ''),
  }
}

function listIsoDatesInclusive(startDate: string, endDate: string, max = 400) {
  const start = new Date(`${String(startDate || '').trim()}T00:00:00Z`)
  const end = new Date(`${String(endDate || '').trim()}T00:00:00Z`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.getTime() > end.getTime()) {
    return [] as string[]
  }
  const dates: string[] = []
  const cursor = new Date(start.getTime())
  let guard = 0
  while (cursor.getTime() <= end.getTime() && guard < max) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    guard += 1
  }
  return dates
}

// Map of ISO date -> { title, type, source } for every NON-SCHOOL day (national public
// holidays + school holidays/breaks) within [fromDate, toDate]. Used to label the calendar
// and to ensure those dates are never counted as staff/student absences.
async function listTenantHolidayMap(db: D1Database, tenantId: string, fromDate: string, toDate: string) {
  const map = new Map<string, { title: string; type: string; source: string }>()
  const from = String(fromDate || '').trim()
  const to = String(toDate || '').trim()
  if (!tenantId || !from || !to || from > to) return map

  const startYear = Number(from.slice(0, 4))
  const endYear = Number(to.slice(0, 4))

  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    for (let year = startYear; year <= endYear; year += 1) {
      for (const holiday of NIGERIA_FIXED_PUBLIC_HOLIDAYS) {
        const dateKey = `${year}-${holiday.monthDay}`
        if (dateKey >= from && dateKey <= to) {
          map.set(dateKey, { title: holiday.title, type: 'holiday', source: 'national' })
        }
      }
    }
  }

  await ensureSchoolCalendarTable(db)
  const rows = await db.prepare(
    `SELECT * FROM school_calendar_events WHERE tenant_id = ?`
  ).bind(tenantId).all().catch(() => ({ results: [] }))

  for (const row of ((rows.results || []) as Record<string, any>[])) {
    const type = String(row.type || 'event').toLowerCase()
    if (type !== 'holiday' && type !== 'break') continue
    const title = String(row.title || (type === 'break' ? 'School Break' : 'Holiday'))
    const recurringAnnual = Boolean(Number(row.recurring_annual || 0))
    const rawStart = String(row.start_date || '').trim()
    const rawEnd = String(row.end_date || rawStart).trim()
    if (!rawStart) continue

    if (recurringAnnual && Number.isFinite(startYear) && Number.isFinite(endYear)) {
      const monthDayStart = rawStart.slice(5)
      const monthDayEnd = (rawEnd || rawStart).slice(5)
      for (let year = startYear; year <= endYear; year += 1) {
        listIsoDatesInclusive(`${year}-${monthDayStart}`, `${year}-${monthDayEnd}`).forEach(dateKey => {
          if (dateKey >= from && dateKey <= to) map.set(dateKey, { title, type, source: 'school' })
        })
      }
    } else {
      const boundedStart = rawStart > from ? rawStart : from
      const boundedEnd = rawEnd < to ? rawEnd : to
      listIsoDatesInclusive(boundedStart, boundedEnd).forEach(dateKey => map.set(dateKey, { title, type, source: 'school' }))
    }
  }

  return map
}

app.get('/api/school/calendar', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  const year = new Date().getFullYear()
  const from = String(c.req.query('from') || '').trim() || `${year}-01-01`
  const to = String(c.req.query('to') || '').trim() || `${year}-12-31`
  try {
    await ensureSchoolCalendarTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      `SELECT * FROM school_calendar_events WHERE tenant_id = ? ORDER BY start_date ASC`
    ).bind(actor.tenantId).all().catch(() => ({ results: [] }))
    const events = ((rows.results || []) as Record<string, any>[]).map(mapSchoolCalendarEvent)
    const holidayMap = await listTenantHolidayMap(c.env.APP_DB, actor.tenantId, from, to)
    const holidays = Array.from(holidayMap.entries())
      .map(([date, info]) => ({ date, ...info }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return c.json({ success: true, events, holidays, canManage: canManageStaffAttendanceConfig(actor.role) })
  } catch {
    return c.json({ success: true, events: [], holidays: [], canManage: false })
  }
})

app.post('/api/school/calendar', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canManageStaffAttendanceConfig(actor.role)) return c.json({ error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const title = String(body?.title || '').trim().slice(0, 120)
  const type = String(body?.type || 'holiday').toLowerCase()
  const startDate = normalizeIsoDateValue(body?.startDate)
  const endDate = normalizeIsoDateValue(body?.endDate) || startDate
  const recurringAnnual = body?.recurringAnnual === true ? 1 : 0
  if (!title || !SCHOOL_CALENDAR_TYPES.has(type) || !startDate) {
    return c.json({ error: 'title, a valid type, and startDate are required.' }, 400)
  }
  if (endDate && endDate < startDate) return c.json({ error: 'endDate cannot be before startDate.' }, 400)
  try {
    await ensureSchoolCalendarTable(c.env.APP_DB)
    const id = `cal_${actor.tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    await c.env.APP_DB.prepare(
      `INSERT INTO school_calendar_events (id, tenant_id, title, type, start_date, end_date, recurring_annual, source, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'school', ?, ?, ?)`
    ).bind(id, actor.tenantId, title, type, startDate, endDate, recurringAnnual, actor.actorName || actor.actorId, now, now).run()
    await addAudit(c.env.APP_DB, actor.tenantId, { action: 'schoolCalendarEventAdded', data: { id, title, type, startDate, endDate } }).catch(() => null)
    return c.json({
      success: true,
      event: mapSchoolCalendarEvent({ id, tenant_id: actor.tenantId, title, type, start_date: startDate, end_date: endDate, recurring_annual: recurringAnnual, source: 'school', created_by: actor.actorName, created_at: now, updated_at: now }),
    })
  } catch {
    return c.json({ error: 'Could not save calendar event.' }, 500)
  }
})

app.delete('/api/school/calendar/:id', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canManageStaffAttendanceConfig(actor.role)) return c.json({ error: 'forbidden' }, 403)
  const id = c.req.param('id')
  try {
    await ensureSchoolCalendarTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(`DELETE FROM school_calendar_events WHERE id = ? AND tenant_id = ? AND source = 'school'`).bind(id, actor.tenantId).run()
    return c.json({ success: true })
  } catch {
    return c.json({ error: 'Could not delete calendar event.' }, 500)
  }
})

// ─── Class Timetable ─────────────────────────────────────────────────────────

async function ensureTimetableTable(db: D1Database) {
  if (_initializedTables.has('timetable_entries')) return
  _initializedTables.add('timetable_entries')
  await db.prepare(`CREATE TABLE IF NOT EXISTS timetable_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    class_id TEXT,
    day_of_week INTEGER,
    period_index INTEGER,
    start_time TEXT,
    end_time TEXT,
    subject_id TEXT,
    subject_name TEXT,
    teacher_id TEXT,
    teacher_name TEXT,
    is_break INTEGER DEFAULT 0,
    label TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run()
  await runIndexStatements(db, [
    `CREATE INDEX IF NOT EXISTS idx_timetable_tenant_class ON timetable_entries(tenant_id, class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_timetable_tenant_teacher ON timetable_entries(tenant_id, teacher_id)`,
  ])
}

function mapTimetableEntry(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    classId: String(row.class_id || ''),
    dayOfWeek: Number(row.day_of_week || 1),
    periodIndex: Number(row.period_index || 0),
    startTime: String(row.start_time || ''),
    endTime: String(row.end_time || ''),
    subjectId: String(row.subject_id || ''),
    subjectName: String(row.subject_name || ''),
    teacherId: String(row.teacher_id || ''),
    teacherName: String(row.teacher_name || ''),
    isBreak: Boolean(Number(row.is_break || 0)),
    label: String(row.label || ''),
  }
}

app.get('/api/school/timetable', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  const role = actor.role
  const mine = String(c.req.query('mine') || '').trim() === 'true'
  let classId = String(c.req.query('classId') || '').trim()
  const canManage = canManageStaffAttendanceConfig(role)
  try {
    await ensureTimetableTable(c.env.APP_DB)

    if (role === 'student') {
      classId = String(actor.resolvedUser?.settings?.classId || '').trim()
      if (!classId) return c.json({ success: true, entries: [], scope: 'student', classId: '' })
      const rows = await c.env.APP_DB.prepare(
        `SELECT * FROM timetable_entries WHERE tenant_id = ? AND class_id = ? ORDER BY day_of_week, period_index`
      ).bind(actor.tenantId, classId).all()
      return c.json({ success: true, entries: ((rows.results || []) as Record<string, any>[]).map(mapTimetableEntry), classId, scope: 'student' })
    }

    if ((role === 'teacher' || role === 'classteacher') && (mine || !classId)) {
      const rows = await c.env.APP_DB.prepare(
        `SELECT * FROM timetable_entries WHERE tenant_id = ? AND teacher_id = ? ORDER BY day_of_week, period_index`
      ).bind(actor.tenantId, actor.actorId).all()
      return c.json({ success: true, entries: ((rows.results || []) as Record<string, any>[]).map(mapTimetableEntry), scope: 'teacher' })
    }

    if (!classId) {
      return c.json({ success: true, entries: [], canManage, scope: 'manage', classId: '' })
    }

    const rows = await c.env.APP_DB.prepare(
      `SELECT * FROM timetable_entries WHERE tenant_id = ? AND class_id = ? ORDER BY day_of_week, period_index`
    ).bind(actor.tenantId, classId).all()
    return c.json({ success: true, entries: ((rows.results || []) as Record<string, any>[]).map(mapTimetableEntry), classId, canManage, scope: 'manage' })
  } catch {
    return c.json({ success: true, entries: [] })
  }
})

app.post('/api/school/timetable', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canManageStaffAttendanceConfig(actor.role)) return c.json({ error: 'forbidden' }, 403)
  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const classId = String(body?.classId || '').trim()
  if (!classId) return c.json({ error: 'classId is required.' }, 400)
  const entries = Array.isArray(body?.entries) ? body.entries : []
  try {
    await ensureTimetableTable(c.env.APP_DB)
    const now = new Date().toISOString()
    const statements: D1PreparedStatement[] = [
      c.env.APP_DB.prepare(`DELETE FROM timetable_entries WHERE tenant_id = ? AND class_id = ?`).bind(actor.tenantId, classId),
    ]

    entries.forEach((entry: Record<string, any>, index: number) => {
      const dayOfWeek = Number(entry?.dayOfWeek || 0)
      const periodIndex = Number(entry?.periodIndex ?? index)
      const startTime = String(entry?.startTime || '').trim()
      const endTime = String(entry?.endTime || '').trim()
      const isBreak = entry?.isBreak === true ? 1 : 0
      const subjectId = String(entry?.subjectId || '').trim()
      const subjectName = String(entry?.subjectName || '').trim()
      const teacherId = String(entry?.teacherId || '').trim()
      const teacherName = String(entry?.teacherName || '').trim()
      const label = String(entry?.label || '').trim()
      if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 7 || !startTime) return
      if (!isBreak && !subjectName && !label) return
      const id = `tt_${actor.tenantId}_${classId}_${dayOfWeek}_${periodIndex}_${Math.random().toString(36).slice(2, 7)}`
      statements.push(c.env.APP_DB.prepare(
        `INSERT INTO timetable_entries (id, tenant_id, class_id, day_of_week, period_index, start_time, end_time, subject_id, subject_name, teacher_id, teacher_name, is_break, label, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, actor.tenantId, classId, dayOfWeek, periodIndex, startTime, endTime, subjectId, subjectName, teacherId, teacherName, isBreak, label, now, now))
    })

    await c.env.APP_DB.batch(statements)
    await addAudit(c.env.APP_DB, actor.tenantId, { action: 'timetableSaved', data: { classId, count: statements.length - 1 } }).catch(() => null)
    return c.json({ success: true, count: statements.length - 1 })
  } catch {
    return c.json({ error: 'Could not save timetable.' }, 500)
  }
})

// ─── Student Attendance (school-level) ───────────────────────────────────────
app.get('/api/school/student-attendance', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)

    const requestedStudentId = String(c.req.query('studentId') || '').trim()
    let classId = String(c.req.query('classId') || '').trim()
    let studentId = requestedStudentId

    if (actor.role === 'student') {
      const self = await resolveStudentAttendanceTarget(c.env.APP_DB, actor.tenantId, actor.actorId || actor.resolvedUser.settingsKey || '')
      if (!self) {
        return c.json({ error: 'Student record not found.' }, 404)
      }
      studentId = self.studentId
      classId = self.classId
    } else if (['teacher', 'classteacher'].includes(actor.role)) {
      if (!classId && studentId) {
        const studentTarget = await resolveStudentAttendanceTarget(c.env.APP_DB, actor.tenantId, studentId)
        classId = studentTarget?.classId || ''
      }

      if (!classId) {
        return c.json({ error: 'classId is required.' }, 400)
      }

      const classroom = await getSchoolClassroomContext(c.env.APP_DB, actor.tenantId, classId, actor.actorId, actor.role)
      if (!classroom.classRow) {
        return c.json({ error: 'Class not found.' }, 404)
      }

      if (!classroom.canView) {
        return c.json({ error: 'Only the class teacher can view attendance for this class.' }, 403)
      }

      if (studentId) {
        const studentTarget = await resolveStudentAttendanceTarget(c.env.APP_DB, actor.tenantId, studentId)
        if (!studentTarget || studentTarget.classId !== classId) {
          return c.json({ error: 'Student does not belong to this class.' }, 400)
        }
      }
    } else if (!['owner', 'hos', 'admin'].includes(actor.role)) {
      return c.json({ error: 'forbidden' }, 403)
    }

    const rawLimit = Number(c.req.query('limit') || 0)
    const records = await listSchoolStudentAttendance(c.env.APP_DB, {
      tenantId: actor.tenantId,
      classId: classId || undefined,
      studentId: studentId || undefined,
      date: c.req.query('date') || undefined,
      from: c.req.query('from') || undefined,
      to: c.req.query('to') || undefined,
      limit: rawLimit > 0 ? rawLimit : undefined,
    })
    return c.json({ success: true, records })
  } catch {
    return c.json({ success: true, records: [] })
  }
})

app.post('/api/school/student-attendance', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!['teacher', 'classteacher'].includes(actor.role)) return c.json({ error: 'forbidden' }, 403)
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)

  const { studentId, date, status, classId, notes } = await c.req.json()
  if (!studentId || !date || !status) return c.json({ error: 'studentId, date, status required.' }, 400)

  try {
    const targetStudent = await resolveStudentAttendanceTarget(c.env.APP_DB, actor.tenantId, String(studentId))
    if (!targetStudent) {
      return c.json({ error: 'Student not found for this tenant.' }, 404)
    }

    const effectiveClassId = String(classId || targetStudent.classId || '').trim()
    if (!effectiveClassId) {
      return c.json({ error: 'classId is required.' }, 400)
    }

    const classroom = await getSchoolClassroomContext(c.env.APP_DB, actor.tenantId, effectiveClassId, actor.actorId, actor.role)
    if (!classroom.classRow) {
      return c.json({ error: 'Class not found.' }, 404)
    }

    if (!classroom.canManage) {
      return c.json({ error: 'Only the class teacher can mark attendance for this class.' }, 403)
    }

    if (targetStudent.classId !== effectiveClassId) {
      return c.json({ error: 'Student does not belong to this class.' }, 400)
    }

    const record = await upsertSchoolStudentAttendance(c.env.APP_DB, {
      tenantId: actor.tenantId,
      studentId: targetStudent.studentId,
      classId: effectiveClassId,
      date: String(date),
      status: String(status),
      notes: typeof notes === 'string' ? notes.trim() : '',
      recordedBy: actor.actorName || actor.actorId,
    })

    return c.json({ success: true, record })
  } catch (err) {
    return c.json({ error: 'Could not record student attendance.' }, 500)
  }
})

// ─── AI Analysis ──────────────────────────────────────────────────────────────
app.get('/api/school/attendance/monthly-report', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!['owner', 'hos', 'admin'].includes(actor.role)) return c.json({ error: 'forbidden' }, 403)

  try {
    const report = await buildMonthlyAttendanceReport(c.env.APP_DB, actor.tenantId, c.req.query('month') || undefined)
    return c.json({ success: true, report })
  } catch {
    return c.json({ error: 'Could not build attendance report.' }, 500)
  }
})

app.post('/api/school/attendance/ai-analysis', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!['owner', 'hos', 'admin'].includes(actor.role)) return c.json({ error: 'forbidden' }, 403)

  try {
    const body = await c.req.json().catch(() => ({})) as Record<string, any>
    const report = await buildMonthlyAttendanceReport(c.env.APP_DB, actor.tenantId, body?.month)
    return c.json({ success: true, analysis: buildAttendanceAiAnalysis(report) })
  } catch {
    return c.json({ error: 'Could not analyse attendance.' }, 500)
  }
})

const FINANCE_AI_VIEW_ROLES = ['owner', 'hos', 'accountant', 'admin']

// Pulls a real, tenant-scoped finance snapshot (fees ledger debtors, expenditure,
// payroll, current session) so the AI analysis runs on live data instead of mock copy.
async function buildSchoolFinanceSnapshot(db: D1Database, currentUser: Record<string, any>) {
  const feeView = await listVisibleFeeLedgerEntries(db, currentUser)
  if (!feeView.tenantId) {
    return { allowed: false, reason: 'no-tenant', tenantId: '', role: feeView.role } as const
  }
  if (!feeView.allowed || !FINANCE_AI_VIEW_ROLES.includes(feeView.role)) {
    return { allowed: false, reason: 'forbidden', tenantId: feeView.tenantId, role: feeView.role } as const
  }

  const tenantId = feeView.tenantId
  const ledger = feeView.ledger || []

  const totalExpected = ledger.reduce((sum, entry) => sum + Number(entry.feeAmount || 0), 0)
  const totalCollected = ledger.reduce((sum, entry) => sum + Number(entry.amountPaid || 0), 0)
  const totalOutstanding = ledger.reduce((sum, entry) => sum + Number(entry.balance || 0), 0)
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0
  const paidCount = ledger.filter(entry => String(entry.status) === 'Paid').length
  const partialCount = ledger.filter(entry => String(entry.status) === 'Partial').length
  const unpaidCount = ledger.filter(entry => String(entry.status) === 'Unpaid').length

  const debtors = ledger
    .filter(entry => Number(entry.balance || 0) > 0)
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
    .map(entry => ({
      studentId: String(entry.studentId || ''),
      name: String(entry.name || 'Student'),
      className: String(entry.className || ''),
      feeAmount: Number(entry.feeAmount || 0),
      amountPaid: Number(entry.amountPaid || 0),
      balance: Number(entry.balance || 0),
      status: String(entry.status || ''),
    }))

  const now = new Date()
  const thisMonthKey = now.toISOString().slice(0, 7)
  const prevMonthKey = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7)

  let totalExpenditure = 0
  let monthExpenditure = 0
  let prevMonthExpenditure = 0
  const categoryTotals: Record<string, number> = {}
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS expenditures (id TEXT PRIMARY KEY, tenant_id TEXT, description TEXT, category TEXT, amount REAL, date TEXT, recorded_by TEXT, created_at TEXT)`).run()
    const expRows = await db.prepare(`SELECT amount, category, date, created_at FROM expenditures WHERE tenant_id = ?`).bind(tenantId).all()
    for (const row of ((expRows.results || []) as Record<string, any>[])) {
      const amount = Number(row.amount || 0)
      totalExpenditure += amount
      const periodKey = String(row.date || row.created_at || '').slice(0, 7)
      if (periodKey === thisMonthKey) monthExpenditure += amount
      if (periodKey === prevMonthKey) prevMonthExpenditure += amount
      const category = String(row.category || 'Other').trim() || 'Other'
      categoryTotals[category] = (categoryTotals[category] || 0) + amount
    }
  } catch {}

  let monthlyPayrollGross = 0
  try {
    await ensurePayrollEntriesTable(db)
    const payRows = await db.prepare(`SELECT gross, basic_salary FROM payroll_entries WHERE tenant_id = ? AND period = ?`).bind(tenantId, thisMonthKey).all()
    for (const row of ((payRows.results || []) as Record<string, any>[])) {
      monthlyPayrollGross += Number(row.gross || row.basic_salary || 0)
    }
  } catch {}

  const session = await getCurrentSchoolSessionSnapshot(db, tenantId)

  return {
    allowed: true as const,
    tenantId,
    role: feeView.role,
    session,
    debtors,
    categoryTotals,
    metrics: {
      studentCount: ledger.length,
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate,
      paidCount,
      partialCount,
      unpaidCount,
      totalExpenditure,
      monthExpenditure,
      prevMonthExpenditure,
      monthlyPayrollGross,
      netPosition: totalCollected - totalExpenditure,
    },
  }
}

type FinanceSnapshot = Extract<Awaited<ReturnType<typeof buildSchoolFinanceSnapshot>>, { allowed: true }>

// Deterministic analysis that always names debtors + amounts, used as the AI fallback.
function buildDeterministicFinanceAnalysis(snapshot: FinanceSnapshot) {
  const m = snapshot.metrics
  const periodLabel = [snapshot.session.termName, snapshot.session.sessionName].filter(Boolean).join(' • ') || 'the current term'
  const owingCount = m.partialCount + m.unpaidCount
  const topDebtors = snapshot.debtors.slice(0, 5)

  const summaryParts = [
    `For ${periodLabel}, the school has collected ${formatNairaAmount(m.totalCollected)} of ${formatNairaAmount(m.totalExpected)} in expected fees (${m.collectionRate}% collected) across ${m.studentCount} student${m.studentCount === 1 ? '' : 's'}.`,
    owingCount > 0
      ? `${formatNairaAmount(m.totalOutstanding)} is still outstanding from ${owingCount} student${owingCount === 1 ? '' : 's'} (${m.unpaidCount} unpaid, ${m.partialCount} part-paid).`
      : 'All recorded fees have been fully collected.',
  ]
  if (topDebtors.length) {
    summaryParts.push(`The largest balances are owed by ${topDebtors.map(d => `${d.name}${d.className ? ` (${d.className})` : ''} — ${formatNairaAmount(d.balance)}`).join('; ')}.`)
  }
  summaryParts.push(`Recorded expenditure stands at ${formatNairaAmount(m.totalExpenditure)}, leaving a net cash position of ${formatNairaAmount(m.netPosition)}.`)

  let comparison: string
  if (m.prevMonthExpenditure > 0) {
    const change = Math.round(((m.monthExpenditure - m.prevMonthExpenditure) / m.prevMonthExpenditure) * 100)
    const direction = change >= 0 ? 'higher' : 'lower'
    comparison = `This month's expenditure (${formatNairaAmount(m.monthExpenditure)}) is ${Math.abs(change)}% ${direction} than last month (${formatNairaAmount(m.prevMonthExpenditure)}).`
  } else {
    comparison = `This month's recorded expenditure is ${formatNairaAmount(m.monthExpenditure)}. No expenditure was recorded last month for comparison.`
  }

  const suggestions: string[] = []
  if (topDebtors.length) {
    suggestions.push(`Follow up on outstanding fees, starting with ${topDebtors.slice(0, 3).map(d => `${d.name} (${formatNairaAmount(d.balance)})`).join(', ')}.`)
  }
  if (m.collectionRate < 80 && m.totalExpected > 0) {
    suggestions.push(`Collection is at ${m.collectionRate}% — send fee reminders to the ${owingCount} student${owingCount === 1 ? '' : 's'} with balances to lift it above 80%.`)
  }
  const topCategory = Object.entries(snapshot.categoryTotals).sort((a, b) => b[1] - a[1])[0]
  if (topCategory && topCategory[1] > 0) {
    suggestions.push(`${topCategory[0]} is the biggest expenditure line at ${formatNairaAmount(topCategory[1])} — review it for savings.`)
  }
  if (m.monthlyPayrollGross > 0) {
    const cover = m.monthlyPayrollGross > 0 ? Math.round((m.totalCollected / m.monthlyPayrollGross) * 100) : 0
    suggestions.push(`Collected fees cover roughly ${cover}% of this month's ${formatNairaAmount(m.monthlyPayrollGross)} payroll obligation.`)
  }
  if (!suggestions.length) {
    suggestions.push('Finances are healthy — keep recording expenditure and issuing receipts promptly to maintain a clean audit trail.')
  }

  return { summary: summaryParts.join(' '), comparison, suggestions }
}

function parseFinanceAiJson(raw: string) {
  let text = String(raw || '').trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return { summary: text.slice(0, 1400), comparison: '', suggestions: [] as string[] }
  }
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, any>
    const suggestions = Array.isArray(obj.suggestions)
      ? obj.suggestions.map((s: unknown) => String(s || '').trim()).filter(Boolean).slice(0, 8)
      : []
    return {
      summary: String(obj.summary || '').trim(),
      comparison: String(obj.comparison || '').trim(),
      suggestions,
    }
  } catch {
    return { summary: text.slice(0, 1400), comparison: '', suggestions: [] as string[] }
  }
}

// Generates the narrative with the same AI model that powers the teacher/staff assistant
// (the Workers AI binding), with an optional NVIDIA key fallback. Returns null if no model
// is configured so the deterministic analysis can take over.
async function runFinanceAiNarrative(env: Bindings, snapshot: FinanceSnapshot) {
  const m = snapshot.metrics
  const topDebtors = snapshot.debtors.slice(0, 12)
  const debtorLines = topDebtors.length
    ? topDebtors.map((d, i) => `${i + 1}. ${d.name}${d.className ? ` (${d.className})` : ''} owes ${formatNairaAmount(d.balance)} of ${formatNairaAmount(d.feeAmount)} (${d.status})`).join('\n')
    : 'None — all fees collected.'

  const dataBlock = [
    `Period: ${[snapshot.session.termName, snapshot.session.sessionName].filter(Boolean).join(' / ') || 'current term'}`,
    `Students on the fee register: ${m.studentCount}`,
    `Expected fees: ${formatNairaAmount(m.totalExpected)}`,
    `Collected fees: ${formatNairaAmount(m.totalCollected)} (${m.collectionRate}%)`,
    `Outstanding fees: ${formatNairaAmount(m.totalOutstanding)} from ${m.partialCount + m.unpaidCount} student(s) (${m.unpaidCount} unpaid, ${m.partialCount} part-paid)`,
    `Total recorded expenditure: ${formatNairaAmount(m.totalExpenditure)}`,
    `Expenditure this month: ${formatNairaAmount(m.monthExpenditure)}; last month: ${formatNairaAmount(m.prevMonthExpenditure)}`,
    `Estimated payroll this month (gross): ${formatNairaAmount(m.monthlyPayrollGross)}`,
    `Net cash position (collected minus expenditure): ${formatNairaAmount(m.netPosition)}`,
  ].join('\n')

  const systemPrompt = [
    'You are Ndovera Finance AI, a precise school finance analyst.',
    'Respond with ONLY valid minified JSON in this exact shape: {"summary": string, "comparison": string, "suggestions": string[]}.',
    'Use only the real figures provided. All amounts are Nigerian Naira (₦).',
    'In "summary", explicitly name the students with the largest outstanding balances and state how much each one owes.',
    'In "comparison", compare this month and last month spending and comment on collection health.',
    'In "suggestions", give 3-5 short, concrete finance actions. Be professional and specific. Do not invent numbers.',
  ].join(' ')

  const userPrompt = `School finance data:\n${dataBlock}\n\nStudents with outstanding balances (largest first):\n${debtorLines}`

  const messages: AiConversationMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let raw = ''
  if (env.AI && typeof env.AI.run === 'function') {
    const result = await env.AI.run(WORKERS_AI_MODEL, { messages, max_tokens: 900, temperature: 0.4 })
    raw = extractWorkersAiText(result)
  } else if (String(env.NVIDIA_API_KEY || '').trim()) {
    raw = await runNvidiaStudentChat(env, messages)
  } else {
    return null
  }

  if (!raw) return null
  const parsed = parseFinanceAiJson(raw)
  return parsed.summary ? parsed : null
}

app.post('/api/school/finance/ai-analysis', authenticate, async (c) => {
  try {
    const snapshot = await buildSchoolFinanceSnapshot(c.env.APP_DB, c.var.user || {})
    if (!snapshot.allowed) {
      return c.json({ error: snapshot.reason === 'no-tenant' ? 'No tenant.' : 'forbidden' }, snapshot.reason === 'no-tenant' ? 400 : 403)
    }

    const fallback = buildDeterministicFinanceAnalysis(snapshot)
    let aiAnalysis: { summary: string; comparison: string; suggestions: string[] } | null = null
    try {
      aiAnalysis = await runFinanceAiNarrative(c.env, snapshot)
    } catch (error) {
      console.error('finance AI narrative failed', error)
    }

    return c.json({
      success: true,
      analysis: {
        summary: aiAnalysis?.summary || fallback.summary,
        comparison: aiAnalysis?.comparison || fallback.comparison,
        suggestions: aiAnalysis?.suggestions?.length ? aiAnalysis.suggestions : fallback.suggestions,
        debtors: snapshot.debtors.slice(0, 50),
        metrics: snapshot.metrics,
        generatedBy: aiAnalysis ? 'ai' : 'computed',
      },
    })
  } catch (error) {
    console.error('finance ai-analysis failed', error)
    return c.json({ error: 'Could not analyse finances.' }, 500)
  }
})

// ─── Public tenant data endpoint ─────────────────────────────────────────────
app.get('/api/public/tenant/:subdomain', async (c) => {
  const subdomain = c.req.param('subdomain')
  try {
    const tenant = await getTenantBySubdomain(c.env.APP_DB, subdomain)
    if (!tenant) return c.json({ error: 'Not found' }, 404)
    await ensureBrandingTable(c.env.APP_DB)
    await ensureWebsiteSectionsTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(INIT_SCHOOL_EVENTS).run()
    const [brandingRow, sectionsResult, eventsResult] = await Promise.all([
      c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as Promise<any>,
      c.env.APP_DB.prepare(`SELECT * FROM website_sections WHERE tenant_id = ? ORDER BY section_key`).bind(tenant.id).all(),
      c.env.APP_DB.prepare(`SELECT * FROM school_events WHERE tenant_id = ? ORDER BY event_date DESC LIMIT 10`).bind(tenant.id).all(),
    ])
    return c.json({
      success: true,
      tenant: { id: tenant.id, schoolName: tenant.schoolName, subdomain: tenant.requestedSubdomain },
      branding: mapTenantBranding(tenant, brandingRow),
      sections: sectionsResult.results || [],
      events: (eventsResult.results || []).map((e: any) => ({ ...e, mediaUrls: JSON.parse(e.media_urls || '[]') })),
    })
  } catch { return c.json({ error: 'Not found' }, 404) }
})

// ─── Subdomain HTML rendering ─────────────────────────────────────────────────
function subdomainNavbar(schoolName: string, subdomain: string, logoUrl?: string | null) {
  const logoImg = logoUrl
    ? `<img src="${escAttr(logoUrl)}" alt="${escAttr(schoolName)} logo" class="site-logo">`
    : `<div class="site-logo logo-fallback">${escHtml(schoolName.charAt(0))}</div>`
  return `
  <div class="top-strip"><a href="/gallery">Virtual Tour</a><a href="/contact">Contact</a></div>
  <nav class="site-nav">
    <a href="/" class="brand-link">
      ${logoImg}
      <span>${escHtml(schoolName)}</span>
    </a>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/about">About Us</a>
      <a href="/academics">Academics</a>
      <a href="/admissions">Admission</a>
      <a href="/events">News</a>
      <a href="/gallery">Gallery</a>
      <a href="/contact">Contact</a>
      <a href="/login" class="portal-link">Portal Login</a>
    </div>
  </nav>`
}

function getBrandingSocialLinks(branding: any = {}) {
  return BRANDING_SOCIAL_COLUMNS
    .map((social) => {
      const href = String(branding?.[social.key] || '').trim()
      if (!href) return null
      return { ...social, href }
    })
    .filter(Boolean) as Array<{ key: string; label: string; action: string; href: string }>
}

function getSocialButtonStyle(key: string) {
  const shared = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:999px;font-size:13px;font-weight:900;text-decoration:none;margin:0;'
  if (key === 'facebook') return `${shared}background:#ffffff;color:#14215b;border:1px solid rgba(227,201,139,.4);`
  if (key === 'instagram') return `${shared}background:#fff8ee;color:#b08d2d;border:1px solid rgba(227,201,139,.35);`
  if (key === 'tiktok') return `${shared}background:#111827;color:#ffffff;border:1px solid rgba(227,201,139,.2);`
  if (key === 'youtube') return `${shared}background:#14215b;color:#ffffff;border:1px solid rgba(227,201,139,.25);`
  return `${shared}background:#1a5c38;color:#ffffff;border:1px solid rgba(227,201,139,.2);`
}

function toFacebookPagePluginUrl(url: string) {
  const href = String(url || '').trim()
  if (!href) return ''
  return `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(href)}&tabs=timeline&width=340&height=360&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`
}

function toYouTubeSubscribeEmbedUrl(url: string) {
  const raw = String(url || '').trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw)
    if (!parsed.hostname.includes('youtube.com')) return ''

    const channelMatch = parsed.pathname.match(/^\/channel\/([^/?#]+)/i)
    if (channelMatch?.[1]) {
      return `https://www.youtube.com/subscribe_embed?usegapi=1&channelid=${encodeURIComponent(channelMatch[1])}&layout=full&count=default`
    }

    const namedChannelMatch = parsed.pathname.match(/^\/(user|c)\/([^/?#]+)/i)
    if (namedChannelMatch?.[2]) {
      return `https://www.youtube.com/subscribe_embed?usegapi=1&channel=${encodeURIComponent(namedChannelMatch[2])}&layout=full&count=default`
    }
  } catch {
    return ''
  }

  return ''
}

function renderBrandingSocialEmbeds(branding: any = {}) {
  const cards = [] as string[]
  const facebookUrl = String(branding?.facebook || '').trim()
  const youtubeUrl = String(branding?.youtube || '').trim()
  const facebookEmbedUrl = toFacebookPagePluginUrl(facebookUrl)
  const youtubeSubscribeUrl = toYouTubeSubscribeEmbedUrl(youtubeUrl)
  const youtubeVideoEmbedUrl = youtubeSubscribeUrl ? '' : toYouTubeEmbedUrl(youtubeUrl)

  if (facebookEmbedUrl) {
    cards.push(`
      <div style="flex:1 1 320px;min-width:280px;border:1px solid rgba(227,201,139,.18);border-radius:18px;padding:16px;background:rgba(255,255,255,.06);">
        <p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#ffffff;">Facebook Page</p>
        <iframe src="${escAttr(facebookEmbedUrl)}" title="Facebook page preview" loading="lazy" style="width:100%;min-height:360px;border:0;border-radius:16px;background:#fff;"></iframe>
      </div>`)
  }

  if (youtubeSubscribeUrl || youtubeVideoEmbedUrl) {
    cards.push(`
      <div style="flex:1 1 280px;min-width:280px;border:1px solid rgba(227,201,139,.18);border-radius:18px;padding:16px;background:rgba(255,255,255,.06);">
        <p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#ffffff;">YouTube</p>
        ${youtubeSubscribeUrl
          ? `<iframe src="${escAttr(youtubeSubscribeUrl)}" title="YouTube subscribe" loading="lazy" style="width:100%;height:120px;border:0;border-radius:16px;background:#fff;"></iframe>`
          : `<iframe src="${escAttr(youtubeVideoEmbedUrl)}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="width:100%;min-height:220px;border:0;border-radius:16px;background:#000;"></iframe>`}
        <p style="margin:10px 0 0;font-size:12px;color:rgba(227,201,139,.82);">${youtubeSubscribeUrl ? 'Visitors can subscribe to the school channel directly from the site.' : 'Visitors can preview the school YouTube video without leaving the site.'}</p>
      </div>`)
  }

  if (!cards.length) return ''

  return `<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:16px;align-items:stretch;">${cards.join('')}</div>`
}

function renderBrandingSocialLinks(
  branding: any = {},
  options: { title?: string; note?: string; panelStyle?: string; titleStyle?: string; noteStyle?: string; includeEmbeds?: boolean } = {},
) {
  const links = getBrandingSocialLinks(branding)
  const embeds = options.includeEmbeds ? renderBrandingSocialEmbeds(branding) : ''
  if (!links.length && !embeds) return ''

  const panelStyle = options.panelStyle || 'margin-top:24px;'
  const titleStyle = options.titleStyle || 'margin-bottom:10px;color:#ffffff;font-size:20px;line-height:1.2;'
  const noteStyle = options.noteStyle || 'margin-top:12px;font-size:13px;color:rgba(227,201,139,.82);max-width:560px;'

  return `
  <div style="${panelStyle}">
    ${options.title ? `<h4 style="${titleStyle}">${escHtml(options.title)}</h4>` : ''}
    ${links.length ? `<div style="display:flex;flex-wrap:wrap;gap:10px;">${links.map((social) => `<a href="${escAttr(social.href)}" target="_blank" rel="noopener noreferrer" style="${getSocialButtonStyle(social.key)}">${escHtml(social.action)} on ${escHtml(social.label)}</a>`).join('')}</div>` : ''}
    ${options.note ? `<p style="${noteStyle}">${escHtml(options.note)}</p>` : ''}
    ${embeds}
  </div>`
}

function subdomainFooter(schoolName: string, branding: any = {}, contact: any = {}) {
  const phone = contact.phone || branding?.phone || ''
  const email = contact.email || branding?.email || ''
  const address = contact.address || ''
  const socialLinks = renderBrandingSocialLinks(branding, {
    title: 'Follow Us',
    note: 'Buttons open the school official social pages so visitors can like, follow, subscribe, or chat there.',
  })
  return `
  <footer class="site-footer">
    <div>
      <h3>${escHtml(schoolName)}</h3>
      <p>Raising confident learners through excellent academics, character, leadership, and community.</p>
    </div>
    <div>
      <h4>Quick Links</h4>
      <a href="/about">About</a>
      <a href="/academics">Academics</a>
      <a href="/admissions">Admissions</a>
      <a href="/login">Portal Login</a>
    </div>
    <div>
      <h4>Get In Touch</h4>
      ${address ? `<p>${escHtml(address)}</p>` : ''}
      ${phone ? `<p>${escHtml(phone)}</p>` : ''}
      ${email ? `<p>${escHtml(email)}</p>` : ''}
    </div>
    ${socialLinks ? `<div>${socialLinks}</div>` : ''}
    <div class="footer-bottom">
      <span>&copy; ${new Date().getFullYear()} ${escHtml(schoolName)}. All rights reserved.</span>
      <span>Powered by <a href="https://ndovera.com">Ndovera</a></span>
    </div>
  </footer>`
}

function escHtml(s: string) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function escAttr(s: string) {
  return escHtml(s).replace(/'/g, '&#39;')
}

function parseMeta(section: any) {
  if (!section?.metadata) return {}
  if (typeof section.metadata === 'object') return section.metadata
  try { return JSON.parse(section.metadata) } catch { return {} }
}

function sectionByKey(sections: any[], key: string) {
  return sections.find((s: any) => s.section_key === key) || null
}

function uniqueMediaUrls(...groups: unknown[]) {
  return Array.from(new Set(
    groups.flatMap(group => Array.isArray(group) ? group : [group])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  ))
}

function getWebsiteSectionDefaultPath(sectionKey: string) {
  const normalized = String(sectionKey || '').trim().toLowerCase()
  if (normalized === 'hero' || normalized === 'about' || normalized === 'mission') return '/about'
  if (normalized === 'academics') return '/academics'
  if (normalized === 'admissions' || normalized === 'admission' || normalized === 'admission_flyer') return '/admissions'
  if (normalized === 'tour' || normalized === 'gallery') return '/gallery'
  if (normalized === 'news' || normalized === 'events') return '/events'
  if (normalized === 'contact') return '/contact'
  if (normalized === 'login' || normalized === 'portal') return '/login'
  return '/'
}

function resolveWebsiteCtaHref(value: string, fallbackPath = '/') {
  const raw = String(value || '').trim()
  if (!raw) return fallbackPath
  if (/^(https?:|mailto:|tel:)/i.test(raw) || raw.startsWith('#')) return raw
  if (raw.startsWith('/')) return raw

  const normalized = raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^\/+|\/+$/g, '')

  if (!normalized) return fallbackPath
  if (normalized === 'news') return '/events'
  if (normalized === 'admission' || normalized === 'apply' || normalized === 'enquire') return '/admissions'
  if (normalized === 'portal' || normalized === 'portal-login') return '/login'
  if (['about', 'academics', 'admissions', 'events', 'gallery', 'contact', 'login'].includes(normalized)) {
    return `/${normalized}`
  }

  return /^[a-z0-9.-]+\.[a-z]{2,}/i.test(raw) ? `https://${raw}` : `/${normalized}`
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(String(url || ''))
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|#|$)/i.test(String(url || ''))
}

function isYouTubeUrl(url: string) {
  return /(youtube\.com|youtu\.be)/i.test(String(url || ''))
}

function toYouTubeEmbedUrl(url: string) {
  const raw = String(url || '').trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw)
    if (parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.pathname.replace(/^\//, '').trim()
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
    }

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        const videoId = parsed.searchParams.get('v') || ''
        return videoId ? `https://www.youtube.com/embed/${videoId}` : ''
      }

      const match = parsed.pathname.match(/\/(embed|shorts)\/([^/?#]+)/)
      return match?.[2] ? `https://www.youtube.com/embed/${match[2]}` : ''
    }
  } catch {
    return ''
  }

  return ''
}

function renderMedia(url: string, alt: string, className = 'media-frame') {
  if (!url) return ''
  if (isYouTubeUrl(url)) {
    const embedUrl = toYouTubeEmbedUrl(url)
    if (embedUrl) {
      return `<iframe class="${className}" src="${escAttr(embedUrl)}" title="${escAttr(alt || 'Embedded video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
    }
  }
  if (isPdfUrl(url)) {
    return `<div class="${className || 'placeholder-media'}"><a class="btn-primary" href="${escAttr(url)}" target="_blank" rel="noopener">${escHtml(alt || 'View document')}</a></div>`
  }
  if (isVideoUrl(url)) {
    return `<video class="${className}" src="${escAttr(url)}" controls playsinline muted></video>`
  }
  return `<img class="${className}" src="${escAttr(url)}" alt="${escAttr(alt)}">`
}

function renderLoginPanel(
  schoolName: string,
  logoUrl?: string | null,
  compact = false,
  options: { platformLoginUrl?: string } = {},
) {
  const logoHtml = logoUrl
    ? `<img src="${escAttr(logoUrl)}" alt="${escAttr(schoolName)}" class="login-logo">`
    : `<div class="login-logo logo-fallback">${escHtml(schoolName.charAt(0))}</div>`
  const platformLoginUrl = String(options.platformLoginUrl || '').trim()
  return `
    <div class="${compact ? 'login-card compact-login' : 'login-card'}">
      <div class="login-heading">
        ${logoHtml}
        <div>
          <h2>${compact ? 'Portal Login' : escHtml(schoolName)}</h2>
          <p>${platformLoginUrl ? 'The school dashboard opens securely on the NDOVERA portal.' : 'Students, parents, and staff can sign in here.'}</p>
        </div>
      </div>
      ${platformLoginUrl ? `
      <div class="tenant-login-form">
        <a href="${escAttr(platformLoginUrl)}" class="btn-primary" style="justify-content:center;width:100%;">Continue to Secure Portal</a>
        <p style="font-size:13px;color:#b08d2d;text-transform:none;line-height:1.6;">The portal opens on NDOVERA's secure dashboard host. When you sign out there, you will return to this school website.</p>
      </div>` : `
      <form class="tenant-login-form">
        <label>Email Address<input name="email" type="email" required placeholder="Enter your email"></label>
        <label>Password<div class="password-field"><input name="password" type="password" required placeholder="Enter your password"><button type="button" class="password-toggle" aria-label="Show password">Show</button></div></label>
        <div class="login-error"></div>
        <button type="submit">Sign In</button>
      </form>`}
    </div>`
}

function loginScript() {
  return `<script>
    document.querySelectorAll('.password-toggle').forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        var field = toggle.parentElement && toggle.parentElement.querySelector('input[name="password"]');
        if (!field) return;
        var showing = field.type === 'text';
        field.type = showing ? 'password' : 'text';
        toggle.textContent = showing ? 'Show' : 'Hide';
        toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      });
    });

    document.querySelectorAll('.tenant-login-form').forEach(function(form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = form.querySelector('button');
        const errDiv = form.querySelector('.login-error');
        const email = form.querySelector('[name=email]').value.trim();
        const password = form.querySelector('[name=password]').value;
        const tenantReturnUrl = window.location.origin;
        btn.disabled = true; btn.textContent = 'Signing in...';
        errDiv.style.display = 'none';
        try {
          const res = await fetch('https://ndovera.com/api/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (!res.ok || !data.token) throw new Error(data.error || 'Login failed. Please check your credentials.');
          localStorage.setItem('token', data.token);
          localStorage.setItem('authUser', JSON.stringify(data.user));
          if (data.user?.classId) localStorage.setItem('classroomId', data.user.classId);
          if (data.user?.id) localStorage.setItem('userId', data.user.id);
          const role = data.user?.role || 'student';
          const roleMap = { owner: '/roles/owner', hos: '/roles/hos', teacher: '/roles/teacher', student: '/roles/student', parent: '/roles/parent', accountant: '/roles/accountant', ami: '/roles/ami', ict: '/roles/ict' };
          const redirectUrl = new URL('https://ndovera.com' + (roleMap[role] || '/roles/student'));
          redirectUrl.searchParams.set('tenantReturnUrl', tenantReturnUrl);
          window.location.href = redirectUrl.toString();
        } catch(err) {
          errDiv.textContent = err.message;
          errDiv.style.display = 'block';
          btn.disabled = false; btn.textContent = 'Sign In';
        }
      });
    });
  </script>`
}

function baseHtml(title: string, body: string) {
  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(title)}</title>
  <style>
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#191970;background:#fff8ee;line-height:1.6}a{color:inherit}h1,h2,h3,.brand-link,.page-title{font-family:Georgia,'Times New Roman',serif;letter-spacing:.01em}.top-strip{height:34px;background:#191970;color:#ffffff;display:flex;align-items:center;justify-content:flex-end;gap:22px;padding:0 32px;font-size:12px;font-weight:700}.top-strip a{text-decoration:none}.site-nav{background:#14215b;color:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:76px;padding:12px 34px;position:sticky;top:0;z-index:100;box-shadow:0 10px 28px rgba(25,25,112,.16)}.brand-link{display:flex;align-items:center;gap:12px;text-decoration:none;font-size:18px;font-weight:900}.site-logo,.login-logo{height:48px;width:48px;border-radius:50%;object-fit:cover;border:2px solid #ffffff}.logo-fallback{background:#ffffff;color:#14215b;display:flex;align-items:center;justify-content:center;font-weight:900}.nav-links{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.nav-links a{text-decoration:none;font-size:13px;font-weight:800}.portal-link,.btn-primary{background:#1a5c38;color:#ffffff!important;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:800;display:inline-flex;transition:filter .2s}.portal-link:hover,.btn-primary:hover{filter:brightness(1.08)}.btn-secondary{border:1.5px solid #14215b;color:#14215b;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:800;display:inline-flex}.hero .btn-secondary,.admission-flyer .btn-secondary,.page-hero .btn-secondary{color:#fff;border-color:rgba(255,255,255,.55)}.hero .btn-primary{background:#e3c98b;color:#14215b!important}.nav-links a{padding:8px 12px;border-radius:8px}.nav-links a:hover{background:rgba(255,255,255,.12)}.hero{min-height:620px;background:#191970;color:#ffffff;position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,.75fr);gap:34px;align-items:center;padding:74px 7vw}.hero:before{content:'';position:absolute;inset:0;background:linear-gradient(120deg,rgba(16,19,58,.94),rgba(20,33,91,.82) 45%,rgba(36,71,216,.5));z-index:1}.hero-bg{position:absolute;inset:0;background-position:center;background-size:cover;opacity:.62}.hero-content,.hero-login{position:relative;z-index:2}.eyebrow{color:#e3c98b;text-transform:uppercase;font-size:12px;font-weight:900;letter-spacing:.18em}.hero h1{font-size:clamp(36px,6vw,72px);line-height:1.02;max-width:820px;margin:14px 0 18px;letter-spacing:0}.hero p{font-size:18px;max-width:680px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.section{padding:72px 7vw}.section.alt{background:#f6f8ff}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:30px}.section h2,.page-title{color:#14215b;font-size:clamp(28px,4vw,44px);line-height:1.1}.section-kicker{color:#b08d2d;font-weight:900;text-transform:uppercase;font-size:12px;letter-spacing:.16em}.split{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.85fr);gap:38px;align-items:center}.media-frame{width:100%;height:360px;object-fit:cover;border-radius:8px;border:1px solid rgba(20,33,91,.16);box-shadow:0 20px 50px rgba(25,25,112,.12);background:#ffffff}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}.info-card,.news-card{background:#fff;border:1px solid rgba(20,33,91,.14);border-radius:8px;overflow:hidden;box-shadow:0 12px 28px rgba(25,25,112,.08)}.info-card{padding:22px}.info-card h3,.news-card h3{color:#14215b;font-size:18px;margin-bottom:8px}.info-card p,.news-card p{color:#191970;font-size:14px}.news-card img,.news-card video{width:100%;height:190px;object-fit:cover;background:#ffffff}.news-card>div{padding:18px}.admission-flyer{background:#14215b;color:#ffffff;border-radius:8px;display:grid;grid-template-columns:minmax(0,.75fr) minmax(300px,1fr);gap:0;overflow:hidden;box-shadow:0 24px 60px rgba(20,33,91,.2)}.admission-flyer .copy{padding:34px}.admission-flyer h2{color:#ffffff}.admission-flyer img,.admission-flyer video{height:100%;min-height:320px;width:100%;object-fit:cover}.login-card{background:#fff;color:#191970;border-radius:8px;padding:24px;border:1px solid rgba(20,33,91,.16);box-shadow:0 24px 70px rgba(25,25,112,.18)}.login-heading{display:flex;gap:14px;align-items:center;margin-bottom:18px}.login-heading h2{color:#14215b;font-size:22px;line-height:1.1}.login-heading p{font-size:13px;color:#b08d2d}.tenant-login-form{display:grid;gap:12px}.tenant-login-form label{display:grid;gap:5px;color:#b08d2d;font-size:12px;text-transform:uppercase;font-weight:900}.tenant-login-form input,.tenant-login-form textarea{border:1.5px solid rgba(20,33,91,.28);border-radius:8px;padding:11px 12px;color:#191970;background:#fff8ee;font:inherit;outline:none}.password-field{position:relative}.password-field input{padding-right:74px}.password-toggle{position:absolute;top:50%;right:8px;transform:translateY(-50%);background:transparent!important;color:#b08d2d!important;border:0!important;padding:4px 8px!important;font-size:12px;font-weight:900;cursor:pointer}.tenant-login-form > button{background:#1a5c38;color:#ffffff;border:0;border-radius:8px;padding:12px;font-weight:900;cursor:pointer}.login-error{display:none;background:#fef2f2;color:#14215b;padding:9px 11px;border-radius:8px;font-size:13px;text-transform:none}.gallery-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.gallery-grid img,.gallery-grid video{width:100%;height:210px;object-fit:cover;border-radius:8px;background:#ffffff}.page-hero{background:#191970;color:#ffffff;padding:70px 7vw}.page-hero h1{font-size:clamp(34px,5vw,58px);line-height:1.05}.page-hero p{max-width:760px;margin-top:12px}.site-footer{background:#191970;color:#ffffff;padding:48px 7vw 24px;display:grid;grid-template-columns:1.3fr .7fr 1fr;gap:30px}.site-footer h3,.site-footer h4{color:#ffffff;margin-bottom:10px}.site-footer a{display:block;color:#ffffff;text-decoration:none;margin:4px 0}.footer-bottom{grid-column:1/-1;border-top:1px solid rgba(227,201,139,.25);padding-top:18px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:13px}.muted{color:#b08d2d}.placeholder-media{height:260px;background:#14215b;color:#ffffff;display:flex;align-items:center;justify-content:center;border-radius:8px;font-weight:900}.hero{min-height:100svh;grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);align-items:stretch;padding:96px 7vw 64px}.hero-content{display:flex;flex-direction:column;justify-content:center;padding-right:6px;position:relative;z-index:2}.hero-side{display:flex;flex-direction:column;gap:18px;justify-content:flex-end;min-width:0;position:relative;z-index:2}.hero-media-rail{display:flex;gap:14px;overflow-x:auto;padding:6px 2px 10px 0;scroll-snap-type:x mandatory;scrollbar-width:thin}.hero-media-card{flex:0 0 min(280px,78vw);scroll-snap-align:start;padding:10px;border-radius:24px;border:1px solid rgba(227,201,139,.2);background:rgba(255,248,238,.1);backdrop-filter:blur(10px)}.hero-media-frame{width:100%;height:250px;object-fit:cover;border-radius:18px;border:1px solid rgba(227,201,139,.18);background:#ffffff;box-shadow:none}.hero-scroll-note{font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(227,201,139,.88);margin-bottom:8px}
  @media(max-width:860px){.top-strip{justify-content:center}.site-nav{align-items:flex-start;flex-direction:column;padding:16px 20px}.nav-links{gap:12px}.hero,.split,.admission-flyer{grid-template-columns:1fr}.hero{min-height:auto;padding:64px 22px 52px}.hero-side{gap:14px}.hero-media-card{flex-basis:min(82vw,320px)}.hero-media-frame{height:220px}.section,.page-hero{padding:52px 22px}.section-head{align-items:flex-start;flex-direction:column}.gallery-grid{grid-template-columns:repeat(2,1fr)}.site-footer{grid-template-columns:1fr}.admission-flyer img,.admission-flyer video{min-height:240px}.media-frame{height:260px}}
  @media(max-width:520px){.gallery-grid{grid-template-columns:1fr}.nav-links a{font-size:12px}.hero h1{font-size:36px}.site-logo,.login-logo{height:42px;width:42px}}
  </style>
  </head><body>${body}</body></html>`
}

function renderSchoolHome(tenant: any, branding: any, sections: any[], events: any[], options: { platformLoginUrl?: string } = {}) {
  const schoolName = tenant.schoolName || 'Our School'
  const tagline = branding?.tagline || 'Excellence in Education'
  const logoUrl = branding?.logoUrl || null
  const hero = sectionByKey(sections, 'hero')
  const heroMeta = parseMeta(hero)
  const about = sectionByKey(sections, 'about') || sectionByKey(sections, 'mission')
  const aboutMeta = parseMeta(about)
  const academics = sectionByKey(sections, 'academics')
  const admissions = sectionByKey(sections, 'admissions')
  const flyer = sectionByKey(sections, 'admission_flyer')
  const tour = sectionByKey(sections, 'tour')
  const tourMeta = parseMeta(tour)
  const gallery = sectionByKey(sections, 'gallery')
  const contact = sectionByKey(sections, 'contact')
  const contactMeta = parseMeta(contact)
  const heroMediaUrls = uniqueMediaUrls(hero?.image_url, ...(Array.isArray(heroMeta.mediaUrls) ? heroMeta.mediaUrls : [])).slice(0, 5)
  const galleryUrls = uniqueMediaUrls(gallery?.image_url, ...(parseMeta(gallery).mediaUrls || [])).slice(0, 8)
  const heroBg = heroMediaUrls[0] ? `<div class="hero-bg" style="background-image:url('${escAttr(heroMediaUrls[0])}')"></div>` : ''
  const heroTitle = hero?.title || schoolName
  const heroContent = hero?.content || tagline || 'Building excellence in every student.'
  const heroButton = heroMeta.buttonLabel || 'Learn More'
  const heroHref = resolveWebsiteCtaHref(heroMeta.buttonUrl, '/about')
  const heroSecondaryButton = heroMeta.secondaryButtonLabel || 'Apply / Enquire'
  const heroSecondaryHref = resolveWebsiteCtaHref(heroMeta.secondaryButtonUrl, '/admissions')
  const aboutMediaUrl = aboutMeta.youtubeUrl || aboutMeta.videoUrl || about?.image_url || ''
  const tourMediaUrl = tourMeta.youtubeUrl || tourMeta.videoUrl || tour?.image_url || ''
  const eventsPreview = events.slice(0, 4)
  const flyerUrl = flyer?.image_url || parseMeta(flyer).flyerUrl
  const heroMediaRail = heroMediaUrls.length
    ? `<div><p class="hero-scroll-note">Hero media ${heroMediaUrls.length}/5 · scroll to view more</p><div class="hero-media-rail">${heroMediaUrls.map((url: string, index: number) => `<div class="hero-media-card">${renderMedia(url, `${heroTitle} media ${index + 1}`, 'hero-media-frame')}</div>`).join('')}</div></div>`
    : ''

  const flyerHtml = flyerUrl ? `
    <section class="section">
      <div class="admission-flyer">
        <div class="copy">
          <p class="section-kicker">Admissions</p>
          <h2>${escHtml(flyer?.title || 'Admissions Now Open')}</h2>
          <p>${escHtml(flyer?.content || 'Begin your child journey where excellence meets character, leadership, and lifelong learning.')}</p>
          <div class="hero-actions"><a class="btn-primary" href="/admissions">Admission Details</a><a class="btn-secondary" href="${escAttr(flyerUrl)}" target="_blank" rel="noopener">View Flyer</a></div>
        </div>
        ${renderMedia(flyerUrl, flyer?.title || 'Admission flyer', '')}
      </div>
    </section>` : ''

  // Optional homepage flier pop-up (shown once per browser session; closeable).
  const flyerPopupEnabled = Boolean(flyerUrl) && Boolean(parseMeta(flyer).popup)
  const flyerPopupHtml = flyerPopupEnabled ? `
    <div id="flier-popup" class="flier-popup-overlay" role="dialog" aria-modal="true" aria-label="School flier">
      <div class="flier-popup-card">
        <button type="button" class="flier-popup-close" aria-label="Close" onclick="(function(){var p=document.getElementById('flier-popup');if(p){p.style.display='none';}try{sessionStorage.setItem('flierPopupClosed','1');}catch(e){}})()">&times;</button>
        ${renderMedia(flyerUrl, flyer?.title || 'School flier', 'flier-popup-media')}
        <a class="flier-popup-cta" href="/admissions">Admission Details</a>
      </div>
    </div>
    <style>
      .flier-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;}
      .flier-popup-card{position:relative;background:#fff;border-radius:18px;max-width:520px;width:100%;max-height:90vh;overflow:auto;padding:14px;box-shadow:0 24px 70px rgba(0,0,0,.45);animation:flierPopIn .25s ease-out;}
      .flier-popup-card .flier-popup-media,.flier-popup-card img,.flier-popup-card video,.flier-popup-card iframe{display:block;width:100%;border-radius:12px;}
      .flier-popup-cta{display:block;text-align:center;margin-top:10px;background:#14215b;color:#ffffff;padding:12px;border-radius:999px;text-decoration:none;font-weight:700;}
      .flier-popup-close{position:absolute;top:8px;right:10px;border:none;background:rgba(0,0,0,.55);color:#fff;width:34px;height:34px;border-radius:50%;font-size:22px;line-height:1;cursor:pointer;z-index:2;}
      @keyframes flierPopIn{from{opacity:0;transform:scale(.94);}to{opacity:1;transform:scale(1);}}
    </style>
    <script>(function(){try{if(sessionStorage.getItem('flierPopupClosed')==='1'){var p=document.getElementById('flier-popup');if(p)p.style.display='none';}}catch(e){}})();</script>` : ''

  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  ${flyerPopupHtml}
  <section class="hero">
    ${heroBg}
    <div class="hero-content">
      <p class="eyebrow">${escHtml(heroMeta.eyebrow || 'Admissions and Learning Portal')}</p>
      <h1>${escHtml(heroTitle)}</h1>
      <p>${escHtml(heroContent)}</p>
      <div class="hero-actions">
        <a class="btn-primary" href="${escAttr(heroHref)}">${escHtml(heroButton)}</a>
        <a class="btn-secondary" href="${escAttr(heroSecondaryHref)}">${escHtml(heroSecondaryButton)}</a>
      </div>
      ${renderBrandingSocialLinks(branding, {
        title: 'Follow Our Updates',
        note: 'These buttons open the school official social pages so visitors can like, follow, subscribe, or chat there.',
        panelStyle: 'margin-top:26px;background:rgba(227,201,139,.12);border:1px solid rgba(227,201,139,.22);border-radius:18px;padding:18px 20px;max-width:640px;',
        includeEmbeds: true,
      })}
    </div>
    <div class="hero-side">${heroMediaRail}${renderLoginPanel(schoolName, logoUrl, true, options)}</div>
  </section>

  ${flyerHtml}

  <section class="section alt">
    <div class="split">
      <div>
        <p class="section-kicker">The School Mission</p>
        <h2>${escHtml(about?.title || 'A Mission With Purpose')}</h2>
        <p>${escHtml(about?.content || `${schoolName} partners with families to develop disciplined, confident, curious learners prepared for leadership and lifelong success.`)}</p>
        <div class="hero-actions"><a class="btn-primary" href="/about">Read More</a></div>
      </div>
      ${aboutMediaUrl ? renderMedia(aboutMediaUrl, about?.title || 'About our school') : '<div class="placeholder-media">School Story</div>'}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><div><p class="section-kicker">Academics</p><h2>${escHtml(academics?.title || 'A Global Standard In Learning')}</h2></div><a class="btn-primary" href="/academics">Explore Academics</a></div>
    <div class="cards">
      ${(parseMeta(academics).programs || ['Primary School', 'High School', 'Leadership & Character', 'Digital Learning']).map((item: string) => `<div class="info-card"><h3>${escHtml(item)}</h3><p>${escHtml(academics?.content || 'Structured learning, strong values, and close support for every learner.')}</p></div>`).join('')}
    </div>
  </section>

  <section class="section alt">
    <div class="split">
      ${tourMediaUrl ? renderMedia(tourMediaUrl, tour?.title || 'Virtual tour') : '<div class="placeholder-media">Virtual Tour</div>'}
      <div>
        <p class="section-kicker">Campus Life</p>
        <h2>${escHtml(tour?.title || 'Shaping Future Leaders')}</h2>
        <p>${escHtml(tour?.content || 'Show families your classrooms, learning spaces, activities, and student life through uploaded photos and videos.')}</p>
        <div class="hero-actions"><a class="btn-primary" href="/gallery">Take A Tour</a></div>
      </div>
    </div>
  </section>

  ${galleryUrls.length ? `<section class="section"><div class="section-head"><div><p class="section-kicker">Gallery</p><h2>${escHtml(gallery?.title || 'Life At Our School')}</h2></div><a class="btn-primary" href="/gallery">Open Gallery</a></div><div class="gallery-grid">${galleryUrls.map((url: string) => renderMedia(url, 'School gallery')).join('')}</div></section>` : ''}

  ${eventsPreview.length ? `<section class="section alt"><div class="section-head"><div><p class="section-kicker">News & Updates</p><h2>Latest From ${escHtml(schoolName)}</h2></div><a class="btn-primary" href="/events">View All News</a></div><div class="cards">${eventsPreview.map((e: any) => renderEventCard(e)).join('')}</div></section>` : ''}

  <section class="section"><div class="split"><div><p class="section-kicker">Begin Your Journey</p><h2>${escHtml(admissions?.title || 'Begin Your Admission Journey')}</h2><p>${escHtml(admissions?.content || 'Learn about enrolment, admission requirements, school visits, and how to begin your application.')}</p><div class="hero-actions"><a class="btn-primary" href="/admissions">Learn More About Admissions</a></div></div>${admissions?.image_url ? renderMedia(admissions.image_url, 'Admissions') : renderLoginPanel(schoolName, logoUrl, true, options)}</div></section>

  ${subdomainFooter(schoolName, branding, contactMeta)}
  ${loginScript()}`

  return baseHtml(schoolName, body)
}

function renderEventCard(e: any, options: { fullCopy?: boolean; tenantId?: string } = {}) {
  const fullCopy = Boolean(options.fullCopy)
  const rawDescription = String(e.description || '')
  const previewText = fullCopy
    ? rawDescription
    : `${escHtml(rawDescription.slice(0, 150))}${rawDescription.length > 150 ? '...' : ''}`
  const media = e.mediaUrls?.[0] ? renderMedia(e.mediaUrls[0], e.title, '') : '<div class="placeholder-media">News</div>'
  const engagement = fullCopy && e.id && options.tenantId ? renderNewsEngagementWidget(String(options.tenantId), String(e.id)) : ''
  return `<article class="news-card"${e.id ? ` id="story-${escAttr(String(e.id || ''))}"` : ''}>${media}<div><p class="muted">${e.event_date ? new Date(e.event_date).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : 'School update'}</p><h3>${escHtml(e.title)}</h3><p>${previewText}</p>${engagement}${fullCopy ? '' : `<p style="margin-top:12px"><a class="btn-primary" href="/events${e.id ? `#story-${escAttr(String(e.id || ''))}` : ''}">Read More</a></p>`}</div></article>`
}

function renderNewsEngagementWidget(tenantId: string, postId: string) {
  return `<div class="news-engagement" data-tenant="${escAttr(tenantId)}" data-post="${escAttr(postId)}" style="margin-top:16px;border-top:1px solid rgba(0,0,0,0.12);padding-top:12px;">
    <div class="ne-stats muted" style="display:flex;gap:14px;flex-wrap:wrap;font-weight:600;">
      <span class="ne-views">👁 0 views</span>
      <span class="ne-react-count">⭐ 0 reactions</span>
      <span class="ne-comment-count">💬 0 comments</span>
    </div>
    <div class="ne-reactions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      ${['👍','❤️','🎉','👏','😮'].map(r => `<button type="button" class="ne-react" data-reaction="${escAttr(r)}" style="border:1px solid rgba(0,0,0,0.15);background:#fff;border-radius:999px;padding:4px 12px;cursor:pointer;">${r} <span class="ne-react-n">0</span></button>`).join('')}
    </div>
    <div class="ne-comments" style="margin-top:12px;display:grid;gap:8px;"></div>
    <form class="ne-comment-form" style="margin-top:10px;display:flex;gap:8px;">
      <input class="ne-name" placeholder="Your name" style="flex:0 0 30%;border:1px solid rgba(0,0,0,0.15);border-radius:999px;padding:8px 12px;" />
      <input class="ne-body" placeholder="Add a comment" required style="flex:1;border:1px solid rgba(0,0,0,0.15);border-radius:999px;padding:8px 12px;" />
      <button type="submit" class="btn-primary" style="border:none;border-radius:999px;padding:8px 16px;cursor:pointer;">Post</button>
    </form>
  </div>`
}

function newsEngagementScript() {
  return `<script>
  (function () {
    function render(el, data) {
      el.querySelector('.ne-views').textContent = '👁 ' + (data.views || 0) + ' views';
      var reactions = data.reactions || {};
      var totalReactions = Object.keys(reactions).reduce(function (sum, key) { return sum + Number(reactions[key] || 0); }, 0);
      el.querySelector('.ne-react-count').textContent = '⭐ ' + totalReactions + ' reactions';
      el.querySelector('.ne-comment-count').textContent = '💬 ' + ((data.comments || []).length) + ' comments';
      el.querySelectorAll('.ne-react').forEach(function (btn) {
        var r = btn.getAttribute('data-reaction');
        btn.querySelector('.ne-react-n').textContent = reactions[r] || 0;
      });
      var list = el.querySelector('.ne-comments');
      list.innerHTML = (data.comments || []).map(function (c) {
        return '<div style="background:#fff8ee;border-radius:14px;padding:8px 12px;"><strong>' + escapeHtml(c.authorName || 'Reader') + ':</strong> ' + escapeHtml(c.body || '') + '</div>';
      }).join('');
    }
    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
    }
    document.querySelectorAll('.news-engagement').forEach(function (el) {
      var tenant = el.getAttribute('data-tenant');
      var post = el.getAttribute('data-post');
      var base = '/api/public/news/' + encodeURIComponent(tenant) + '/' + encodeURIComponent(post);
      fetch(base + '/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function (r) { return r.json(); })
        .then(function (data) { if (data && data.success) render(el, data); })
        .catch(function () {});
      el.querySelectorAll('.ne-react').forEach(function (btn) {
        btn.addEventListener('click', function () {
          fetch(base + '/react', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reaction: btn.getAttribute('data-reaction') }) })
            .then(function (r) { return r.json(); })
            .then(function (data) { if (data && data.success) render(el, data); })
            .catch(function () {});
        });
      });
      el.querySelector('.ne-comment-form').addEventListener('submit', function (event) {
        event.preventDefault();
        var name = el.querySelector('.ne-name').value;
        var body = el.querySelector('.ne-body').value;
        if (!body.trim()) return;
        fetch(base + '/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ authorName: name, body: body }) })
          .then(function (r) { return r.json(); })
          .then(function (data) { if (data && data.success) { render(el, data); el.querySelector('.ne-body').value = ''; } })
          .catch(function () {});
      });
    });
  }());
  </script>`
}

function renderContentPage(tenant: any, branding: any, sections: any[], key: string, fallbackTitle: string, fallbackCopy: string) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const section = sectionByKey(sections, key)
  const meta = parseMeta(section)
  const mediaUrl = meta.youtubeUrl || meta.videoUrl || section?.image_url || ''
  const heroCopy = section?.content || fallbackCopy
  const detailCopy = String(meta.detailCopy || '').trim()
  const ctaHref = resolveWebsiteCtaHref(meta.buttonUrl, getWebsiteSectionDefaultPath(key))
  const ctaLabel = meta.buttonLabel || 'Learn More'
  const body = `
    ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
    <header class="page-hero"><p class="eyebrow">${escHtml(meta.eyebrow || schoolName)}</p><h1>${escHtml(section?.title || fallbackTitle)}</h1><p>${escHtml(heroCopy)}</p></header>
    <main class="section">
      <div class="split">
        <div>
          <p class="section-kicker">${escHtml(fallbackTitle)}</p>
          <h2>${escHtml(section?.title || fallbackTitle)}</h2>
          ${detailCopy ? `<p>${escHtml(detailCopy)}</p>` : ''}
          <div class="hero-actions"><a class="btn-primary" href="${escAttr(ctaHref)}">${escHtml(ctaLabel)}</a></div>
        </div>
        ${mediaUrl ? renderMedia(mediaUrl, section?.title || fallbackTitle) : '<div class="placeholder-media">Add photos or videos from Website settings</div>'}
      </div>
      ${Array.isArray(meta.programs) && meta.programs.length ? `<div class="cards" style="margin-top:34px">${meta.programs.map((item: string) => `<div class="info-card"><h3>${escHtml(item)}</h3><p>${escHtml(section?.content || fallbackCopy)}</p></div>`).join('')}</div>` : ''}
    </main>
    ${subdomainFooter(schoolName, branding, parseMeta(sectionByKey(sections, 'contact')))}`
  return baseHtml(`${fallbackTitle} - ${schoolName}`, body)
}

function renderAdmissionsPage(tenant: any, branding: any, sections: any[], options: { platformLoginUrl?: string } = {}) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const admissions = sectionByKey(sections, 'admissions')
  const flyer = sectionByKey(sections, 'admission_flyer')
  const flyerUrl = flyer?.image_url || parseMeta(flyer).flyerUrl
  const docsSection = sectionByKey(sections, 'admission_documents')
  const downloadDocuments = (Array.isArray(parseMeta(docsSection).documents) ? parseMeta(docsSection).documents : [])
    .filter((doc: any) => doc && String(doc.url || '').trim())
    .slice(0, 5)
  const documentsHtml = downloadDocuments.length ? `
    <section class="section">
      <p class="section-kicker">Downloads</p>
      <h2>${escHtml(docsSection?.title || 'Admission Documents')}</h2>
      ${docsSection?.content ? `<p>${escHtml(docsSection.content)}</p>` : ''}
      <div class="cards" style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:18px;">
        ${downloadDocuments.map((doc: any) => `<a class="info-card" href="${escAttr(String(doc.url))}" target="_blank" rel="noopener" download style="text-decoration:none;display:flex;align-items:center;gap:12px;"><span style="font-size:26px;">📄</span><span style="font-weight:700;color:#14215b;">${escHtml(String(doc.title || 'Document'))}</span></a>`).join('')}
      </div>
    </section>` : ''
  const body = `
    ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
    <header class="page-hero"><p class="eyebrow">Admission</p><h1>${escHtml(admissions?.title || 'Begin Your Admission Journey')}</h1><p>${escHtml(admissions?.content || 'Discover the enrolment process, prepare your documents, and contact the school to begin.')}</p></header>
    ${flyerUrl ? `<section class="section"><div class="admission-flyer"><div class="copy"><p class="section-kicker">Admission Flyer</p><h2>${escHtml(flyer?.title || 'Admissions Now Open')}</h2><p>${escHtml(flyer?.content || 'Download or view the latest admission flyer.')}</p><div class="hero-actions"><a class="btn-primary" href="${escAttr(flyerUrl)}" target="_blank" rel="noopener">View Flyer</a></div></div>${renderMedia(flyerUrl, 'Admission flyer', '')}</div></section>` : ''}
    ${documentsHtml}
    <section class="section alt">
      <div class="split" style="align-items:start;gap:24px;">
        <div class="info-card" style="padding:28px;">
          <p class="section-kicker">Online Application</p>
          <h2 style="margin-top:0;">Start An Admission Request</h2>
          <p>Provide the learner, parent, medical, transport, hostel, and support details the school needs to begin review.</p>
          <form id="website-admission-form" style="display:grid;gap:18px;margin-top:20px;">
            <input type="hidden" name="tenantId" value="${escAttr(String(tenant.id || ''))}" />
            <input type="hidden" name="sourcePage" value="/admissions" />
            <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
              <input type="text" name="studentName" placeholder="Student full name" required style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="text" name="desiredClass" placeholder="Applying for class" required style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <select name="gender" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;"><option value="">Gender</option><option value="Female">Female</option><option value="Male">Male</option></select>
              <input type="date" name="dateOfBirth" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            </div>
            <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
              <input type="text" name="parentName" placeholder="Parent or guardian name" required style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="email" name="parentEmail" placeholder="Parent email" required style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="text" name="parentPhone" placeholder="Parent phone" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="text" name="relationship" placeholder="Relationship" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            </div>
            <textarea name="address" rows="2" placeholder="Home address" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;resize:vertical;"></textarea>
            <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
              <input type="text" name="previousSchool" placeholder="Previous school" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="text" name="strengths" placeholder="Academic strengths or interests" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="text" name="talents" placeholder="Talents and gifts" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="datetime-local" name="examDate" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            </div>
            <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
              <input type="text" name="allergies" placeholder="Allergies" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="text" name="conditions" placeholder="Medical conditions" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="text" name="senNeeds" placeholder="SEN or learning support needs" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <input type="text" name="registrationPlan" placeholder="Registration fee/payment note" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            </div>
            <textarea name="medicalNotes" rows="3" placeholder="Medical notes, clinic follow-up needs, or special care instructions" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;resize:vertical;"></textarea>
            <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
              <select name="transportRequired" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;"><option value="">Transport needed?</option><option value="yes">Yes</option><option value="no">No</option></select>
              <input type="text" name="transportArea" placeholder="Pick-up or route area" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
              <select name="hostelRequired" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;"><option value="">Hostel needed?</option><option value="yes">Yes</option><option value="no">No</option></select>
              <input type="text" name="hostelNotes" placeholder="Hostel notes" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            </div>
            <button type="submit" style="border:none;border-radius:999px;padding:14px 20px;background:#14215b;color:#ffffff;font-weight:700;cursor:pointer;">Submit Admission Request</button>
            <p id="website-admission-status" style="margin:0;font-size:14px;color:#191970;"></p>
          </form>
        </div>
        <div class="cards" style="display:grid;gap:16px;">
          <div class="info-card"><h3>1. Submit</h3><p>Share student, guardian, academic, medical, transport, and hostel needs in one application.</p></div>
          <div class="info-card"><h3>2. Review</h3><p>The owner and Head of School review the application inside the school system.</p></div>
          <div class="info-card"><h3>3. Operational Routing</h3><p>Transport, hostel, and clinic teams can view applications that need their follow-up.</p></div>
          <div class="info-card"><h3>4. Portal Access</h3><p>Once admitted, the family can continue onboarding through the school portal.</p></div>
          ${renderLoginPanel(schoolName, logoUrl, true, options)}
        </div>
      </div>
    </section>
    ${subdomainFooter(schoolName, branding, parseMeta(sectionByKey(sections, 'contact')))}
    ${loginScript()}
    ${admissionFormScript()}`
  return baseHtml(`Admissions - ${schoolName}`, body)
}

function admissionFormScript() {
  return `<script>
  (function () {
    const form = document.getElementById('website-admission-form');
    const status = document.getElementById('website-admission-status');
    if (!form || !status) return;

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      status.textContent = 'Submitting application...';
      status.style.color = '#191970';

      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch('/api/public/admissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json.success === false) {
          throw new Error(json.message || 'Could not submit the application right now.');
        }

        status.textContent = 'Application submitted. The school will review it in the admissions dashboard.';
        status.style.color = '#1a5c38';
        form.reset();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Could not submit the application right now.';
        status.style.color = '#14215b';
      }
    });
  }());
  </script>`
}

function renderGalleryPage(tenant: any, branding: any, sections: any[]) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const gallery = sectionByKey(sections, 'gallery')
  const urls = [gallery?.image_url, ...(parseMeta(gallery).mediaUrls || [])].filter(Boolean)
  const body = `
    ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
    <header class="page-hero"><p class="eyebrow">Gallery</p><h1>${escHtml(gallery?.title || 'School Gallery')}</h1><p>${escHtml(gallery?.content || 'Photos and videos from campus life, learning, events, and activities.')}</p></header>
    <main class="section">${urls.length ? `<div class="gallery-grid">${urls.map((url: string) => renderMedia(url, 'School gallery')).join('')}</div>` : '<div class="placeholder-media">Upload photos and videos from Website settings.</div>'}</main>
    ${subdomainFooter(schoolName, branding, parseMeta(sectionByKey(sections, 'contact')))}`
  return baseHtml(`Gallery - ${schoolName}`, body)
}

function renderEventsPage(tenant: any, branding: any, events: any[]) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null

  const eventsHtml = events.length === 0
    ? `<div class="placeholder-media">No news posted yet. Check back soon.</div>`
    : `<div class="cards">${events.map((e: any) => renderEventCard(e, { fullCopy: true, tenantId: String(tenant.id || '') })).join('')}</div>`

  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <header class="page-hero"><p class="eyebrow">News & Updates</p><h1>Latest From ${escHtml(schoolName)}</h1><p>Upcoming and recent events, announcements, celebrations, and school highlights.</p></header>
  <main class="section">
    ${eventsHtml}
  </main>
  ${subdomainFooter(schoolName, branding)}
  ${newsEngagementScript()}`

  return baseHtml(`News - ${schoolName}`, body)
}

function websiteEnquiryScript() {
  return `<script>
  (function () {
    const form = document.getElementById('website-contact-form');
    const status = document.getElementById('website-contact-status');
    if (!form || !status) return;

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      status.textContent = 'Sending your enquiry...';
      status.style.color = '#191970';

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/api/public/website-enquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await response.json().catch(() => ({}));

        if (!response.ok || json.success === false) {
          throw new Error(json.message || 'Could not send your enquiry right now.');
        }

        status.textContent = 'Your message has been sent to the school leadership team.';
        status.style.color = '#1a5c38';
        form.reset();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Could not send your enquiry right now.';
        status.style.color = '#14215b';
      }
    });
  }());
  </script>`
}

function renderContactPage(tenant: any, branding: any, sections: any[] = [], options: { platformLoginUrl?: string } = {}) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const website = branding?.website || null
  const contact = sectionByKey(sections, 'contact')
  const meta = parseMeta(contact)

  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <header class="page-hero"><p class="eyebrow">Contact</p><h1>${escHtml(contact?.title || 'Get In Touch')}</h1><p>${escHtml(contact?.content || 'For enquiries about admissions, fees, visits, or school activities, please reach out to us directly.')}</p></header>
  <main class="section">
    <div class="split">
      <div class="cards" style="display:grid;gap:16px;">
        <div class="info-card">
          <h3>Send A Direct Enquiry</h3>
          <p style="margin-bottom:16px;">Website enquiries now go straight to the owner and Head of School inbox.</p>
          <form id="website-contact-form" style="display:grid;gap:12px;">
            <input type="hidden" name="tenantId" value="${escAttr(String(tenant.id || ''))}" />
            <input type="hidden" name="sourcePage" value="/contact" />
            <input type="text" name="name" placeholder="Your full name" required style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            <input type="email" name="email" placeholder="Your email address" required style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            <input type="text" name="phone" placeholder="Phone number" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            <input type="text" name="subject" placeholder="What is this about?" style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;" />
            <textarea name="message" rows="5" placeholder="Tell the school what you need help with." required style="padding:12px 14px;border-radius:14px;border:1px solid rgba(20,33,91,0.15);font:inherit;resize:vertical;"></textarea>
            <button type="submit" style="border:none;border-radius:999px;padding:12px 18px;background:#14215b;color:#ffffff;font-weight:700;cursor:pointer;">Send Enquiry</button>
            <p id="website-contact-status" style="margin:0;font-size:14px;color:#191970;"></p>
          </form>
        </div>
        ${meta.address ? `<div class="info-card"><h3>Address</h3><p>${escHtml(meta.address)}</p></div>` : ''}
        ${meta.phone ? `<div class="info-card"><h3>Phone</h3><p>${escHtml(meta.phone)}</p></div>` : ''}
        ${meta.email ? `<div class="info-card"><h3>Email</h3><p>${escHtml(meta.email)}</p></div>` : ''}
        ${website ? `<div class="info-card"><h3>Website</h3><p><a href="${escAttr(website)}">${escHtml(website)}</a></p></div>` : ''}
        <div class="info-card"><h3>Response Window</h3><p>The school leadership team receives this message inside their dashboard as soon as you submit it.</p></div>
      </div>
      ${renderLoginPanel(schoolName, logoUrl, true, options)}
    </div>
  </main>
  ${subdomainFooter(schoolName, branding, meta)}
  ${loginScript()}
  ${websiteEnquiryScript()}`

  return baseHtml(`Contact - ${schoolName}`, body)
}

function renderLoginPage(tenant: any, branding: any, options: { platformLoginUrl?: string } = {}) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <section class="hero">
    <div class="hero-content"><p class="eyebrow">Secure Portal</p><h1>${escHtml(schoolName)} Login</h1><p>Access your dashboard for learning, school operations, parent updates, and staff workflows.</p></div>
    <div class="hero-login">${renderLoginPanel(schoolName, logoUrl, false, options)}</div>
  </section>
  ${loginScript()}`

  return baseHtml(`Login - ${schoolName}`, body)
}

function renderTenantNotFoundHtml(requestedHost: string) {
  const safeHost = requestedHost || 'this school address'
  return baseHtml('School Not Found', `
    <div style="min-height:100vh;background:#ffffff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;">
      <div>
        <h1 style="color:#14215b;font-size:32px;margin-bottom:16px;">School Not Found</h1>
        <p style="color:#191970;font-size:16px;margin-bottom:24px;">No school is registered at <strong>${escHtml(safeHost)}</strong>.</p>
        <a href="https://ndovera.com" style="background:#14215b;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">← Back to Ndovera</a>
      </div>
    </div>`)
}

async function renderTenantWebsiteResponse(
  env: Bindings,
  tenant: Record<string, any>,
  url: URL,
  options: { platformLoginUrl?: string } = {},
): Promise<Response> {
  try {
    await ensureBrandingTable(env.APP_DB)
    await ensureWebsiteSectionsTable(env.APP_DB)
    await ensureNewsroomTables(env.APP_DB)
    await env.APP_DB.prepare(INIT_SCHOOL_EVENTS).run()

    const [brandingRow, sectionsResult, eventsResult, newsPosts] = await Promise.all([
      env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as Promise<any>,
      env.APP_DB.prepare(`SELECT * FROM website_sections WHERE tenant_id = ? ORDER BY section_key`).bind(tenant.id).all(),
      env.APP_DB.prepare(`SELECT * FROM school_events WHERE tenant_id = ? ORDER BY event_date DESC LIMIT 10`).bind(tenant.id).all(),
      listSchoolNewsPosts(env.APP_DB, String(tenant.id || ''), { status: 'published', channel: 'website' }),
    ])

    const branding = mapTenantBranding(tenant, brandingRow as any)
    const sections = sectionsResult.results || []
    const events = (eventsResult.results || []).map((e: any) => ({ ...e, mediaUrls: JSON.parse(e.media_urls || '[]') }))
    const publicNewsItems = newsPosts.length
      ? newsPosts.map((post: any) => ({
          id: post.id,
          title: post.title,
          description: post.excerpt || post.content,
          event_date: post.publishedAt || post.createdAt,
          mediaUrls: post.coverUrl ? [post.coverUrl] : [],
        }))
      : events

    const path = url.pathname.replace(/\/$/, '') || '/'
    let html: string
  if (path === '/login') html = renderLoginPage(tenant, branding, options)
    else if (path === '/about') html = renderContentPage(tenant, branding, sections, 'about', 'About Us', 'Learn about our mission, values, leadership, and the culture that shapes our learners.')
    else if (path === '/academics') html = renderContentPage(tenant, branding, sections, 'academics', 'Academics', 'Explore our academic programmes, learning pathways, and student support structure.')
    else if (path === '/admissions') html = renderAdmissionsPage(tenant, branding, sections, options)
    else if (path === '/gallery') html = renderGalleryPage(tenant, branding, sections)
    else if (path === '/events') html = renderEventsPage(tenant, branding, publicNewsItems)
    else if (path === '/contact') html = renderContactPage(tenant, branding, sections, options)
    else html = renderSchoolHome(tenant, branding, sections, publicNewsItems, options)

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
  } catch (err) {
    return new Response(`<html><body><p>Error loading school page.</p></body></html>`, { status: 500, headers: { 'Content-Type': 'text/html' } })
  }
}

async function handleSubdomainRequest(request: Request, env: Bindings, subdomain: string, url: URL, requestedHost = ''): Promise<Response> {
  const tenant = await getTenantBySubdomain(env.APP_DB, subdomain)
  if (!tenant) {
    return new Response(renderTenantNotFoundHtml(requestedHost || `${subdomain}.${env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN}`), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return renderTenantWebsiteResponse(env, tenant, url)
}

// ─── Question Bank Endpoints ────────────────────────────────────────────────

app.get('/api/question-bank', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!canAuthorCbt(actor.role) && !canManageCbt(actor.role)) {
      return c.json({ success: false, message: 'Forbidden' }, 403)
    }

    const tenantId = String(actor.tenantId || 'global').trim()
    const questions = await listQuestionBankQuestions(c.env.APP_DB, tenantId, {
      subject: c.req.query('subject') || '',
      classLevel: c.req.query('classLevel') || '',
      classId: c.req.query('classId') || '',
      subjectId: c.req.query('subjectId') || '',
      type: c.req.query('type') || '',
      status: c.req.query('status') || '',
    })
    return c.json({ success: true, questions })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/question-bank', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!canAuthorCbt(actor.role) && !canManageCbt(actor.role)) {
      return c.json({ success: false, message: 'Forbidden' }, 403)
    }

    const body = await c.req.json() as Record<string, any>
    if (!body.subject && !body.subjectId) {
      return c.json({ success: false, message: 'A subject or subjectId is required.' }, 400)
    }
    if (!body.type || !(body.prompt || body.text || body.question)) {
      return c.json({ success: false, message: 'Question type and prompt are required.' }, 400)
    }

    const result = await saveQuestionToBank(c.env.APP_DB, String(actor.tenantId || 'global').trim(), {
      ...body,
      createdBy: actor.actorId,
    })
    return c.json({ success: true, question: result.question, deduplicated: result.deduplicated, similarMatches: result.similarMatches }, result.deduplicated ? 200 : 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.delete('/api/question-bank/:id', authenticate, async (c) => {
  try {
    const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
    if (!canManageCbt(actor.role)) {
      return c.json({ success: false, message: 'Forbidden' }, 403)
    }

    const tenantId = String(actor.tenantId || 'global').trim()
    const existing = await listQuestionBankQuestions(c.env.APP_DB, tenantId)
    const question = existing.find(entry => String(entry.id || '') === String(c.req.param('id') || ''))
    if (!question) return c.json({ success: false, message: 'Not found' }, 404)

    await deleteQuestionFromBank(c.env.APP_DB, tenantId, String(question.id || ''))
    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const hostname = normalizeHostname(url.hostname)
    const baseDomain = env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN

    if (!url.pathname.startsWith('/api/')) {
      if (hostname === `www.${normalizeHostname(baseDomain)}`) {
        url.hostname = normalizeHostname(baseDomain)
        return Response.redirect(url.toString(), 301)
      }

      const subdomain = extractTenantSubdomainFromHost(hostname, baseDomain)
      if (subdomain) {
        const canonicalHost = `${subdomain}.${normalizeHostname(baseDomain)}`
        if (hostname !== canonicalHost) {
          url.hostname = canonicalHost
          return Response.redirect(url.toString(), 301)
        }

        return handleSubdomainRequest(request, env, subdomain, url, canonicalHost)
      }

      if (!isPlatformHost(hostname, baseDomain)) {
        const tenant = await getTenantByWebsiteHost(env.APP_DB, hostname)
        if (tenant) {
          const canonicalHost = resolveTenantWebsiteHost(tenant, baseDomain)
          if (canonicalHost && hostname !== canonicalHost) {
            url.hostname = canonicalHost
            return Response.redirect(url.toString(), 301)
          }

          return renderTenantWebsiteResponse(env, tenant, url, {
            platformLoginUrl: isCustomTenantHost(hostname, baseDomain)
              ? buildPlatformAuthUrl('/login', `https://${hostname}`)
              : '',
          })
        }
      }
    }

    return app.fetch(request, env, ctx)
  }
}
