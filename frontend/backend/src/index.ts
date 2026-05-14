import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sign, verify } from '@tsndr/cloudflare-worker-jwt'
import {
  hasRequiredRole,
  migrateLegacyPasswordIfNeeded,
  verifyPasswordCandidate,
  withHashedPassword,
} from './passwords'
import {
  getSettings, upsertSettings, addAudit, getAuditForStudent, getAllAudits,
  getAllBooks, getBookById, upsertBook, deleteBook, borrowBook, returnBook,
  getBorrowingsForStudent, getAllBorrowings, getClassById, getPostsForClass,
  createPost, addPostComment, getAssignmentsForClass, getAssignmentById, createAssignment, getLatestSubmissionForStudent, createSubmission, getMaterialsForClass,
  addMaterial, getAttendanceForClass, recordAttendance, saveContent,
  getAttendance, upsertAttendance, updateAttendance, getConversations,
  createConversation, getMessages, sendMessage, markMessagesRead,
  getTuckOrders, createTuckOrder, updateTuckOrder, getWeeklyTuckSummary,
  createTenant, getTenantById, getTenantByOwnerEmail, getTenantBySubdomain,
  listTenants, updateTenant, listTenantDiscountCodes, getTenantDiscountCode,
  upsertTenantDiscountCode, incrementTenantDiscountCodeRedemption,
  createTenantPayment, getTenantPaymentByTxRef, listTenantPayments,
  updateTenantPayment, getLiveSessionsForClass, createLiveSession, updateLiveSessionStatus,
} from './db'

type Bindings = {
  APP_DB: D1Database
  SESSIONS: KVNamespace
  UPLOADS: R2Bucket
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
}

const app = new Hono<{ Bindings: Bindings }>()
const AUTH_COOKIE_NAME = 'ndovera_token'
const AUTH_SESSION_SECONDS = 30 * 24 * 60 * 60
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000
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

function authCookie(token: string) {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Domain=.ndovera.com; Max-Age=${AUTH_SESSION_SECONDS}; Secure; SameSite=Lax`
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

async function ensurePasswordResetTokensTable(db: D1Database) {
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
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#800020;">NDOVERA</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#191970;">Reset your password</h1>
      <p style="margin:0 0 16px;">Hello ${recipientName},</p>
      <p style="margin:0 0 20px;">Use the button below to set a new password for your NDOVERA account.</p>
      <p style="margin:0 0 24px;">
        <a href="${safeResetUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#1a5c38;color:#f5deb3;text-decoration:none;font-weight:700;">Reset Password</a>
      </p>
      <p style="margin:0 0 10px;">If the button does not open, use this link:</p>
      <p style="margin:0 0 18px;word-break:break-word;"><a href="${safeResetUrl}" style="color:#800020;">${safeResetUrl}</a></p>
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
    return { actorId: null, settings: null, role: currentUser.role, tenant: null, forbidden: false }
  }

  const settings = await getSettings(c.env.APP_DB, actorId)
  const role = settings?.role || currentUser.role

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

function buildTenantWebsite(c: any, schoolId: string, tenant?: any) {
  const origin = new URL(c.req.url).origin
  const baseDomain = c.env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN

  if (tenant) {
    return {
      schoolId: tenant.id,
      name: tenant.schoolName,
      shortName: tenant.schoolName,
      logoUrl: `${origin}/logo192.png`,
      domain: tenant.websiteDomain,
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
    websiteDomain: `${requestedSubdomain}.${baseDomain}`,
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
      websiteUrl: `https://${requestedSubdomain}.${baseDomain}`,
    },
  })

  const ownerSettings = await withHashedPassword({
    email: ownerEmail,
    name: ownerName,
    role: 'owner',
    accountType: 'school-owner',
    status: 'pending_activation',
    tenantId,
    schoolId: tenantId,
    schoolName,
    planKey,
    requestedSubdomain,
    websiteDomain: `${requestedSubdomain}.${baseDomain}`,
    tenantStatus: tenant?.status || lifecycle.status,
  }, password)

  await upsertSettings(c.env.APP_DB, ownerEmail, ownerSettings)
  await addAudit(c.env.APP_DB, tenantId, {
    action: 'tenantRegistered',
    data: {
      ownerEmail,
      planKey,
      billableUserCount: quote.billableUserCount,
      discountCode: quote.discountCode,
      requestedSubdomain,
      websiteDomain: `${requestedSubdomain}.${baseDomain}`,
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
    tenant: { ...updatedTenant, studentCount: quote.billableUserCount, billableUserCount: quote.billableUserCount, userCounts: quote.userCounts, websiteUrl: `https://${updatedTenant.websiteDomain}` },
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

function buildUserProfile(id: string, role: string, name: string, settings: Record<string, any> = {}) {
  return {
    id,
    email: settings.email || id,
    name,
    role,
    schoolId: settings.schoolId || settings.tenantId || 'school-1',
    aura: settings.aura || 320,
    accountType: settings.accountType || (role === 'ami' ? 'superadmin' : 'user'),
    status: settings.status || 'active',
    displayId: settings.displayId || null,
    classId: settings.classId || null,
    phone: settings.phone || null,
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
    return null
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

async function resolveCanonicalUserIdentifier(db: D1Database, identifier: unknown) {
  const raw = String(identifier || '').trim()
  if (!raw) return null

  const resolved = await resolveSettingsIdentity(db, raw)
  return String(resolved.userRow?.id || resolved.userRow?.email || resolved.settingsKey || raw).trim() || null
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
  }

  const userRole = settings.role || requestedRole || 'student'
  const name = settings.name || id
  const tenantId = settings.tenantId || settings.schoolId
  const tenant = tenantId
    ? await getTenantById(c.env.APP_DB, tenantId)
    : await getTenantByOwnerEmail(c.env.APP_DB, id)

  // Auto-generate displayId for old users who were created before the displayId system
  if (!settings.displayId) {
    try {
      const newDisplayId = await generateDisplayId(c.env.APP_DB, getDisplayIdConfig(userRole))
      settings = { ...settings, displayId: newDisplayId }
      await upsertSettings(c.env.APP_DB, id, { ...settings, displayId: newDisplayId }).catch(() => {})
    } catch { /* non-critical */ }
  }

  const mustChangePassword = settings.mustChangePassword === true

  const token = await sign({
    role: userRole,
    name,
    id,
    tenantId: tenant?.id,
    ...(mustChangePassword ? { mustChangePassword: true } : {}),
    exp: Math.floor(Date.now() / 1000) + AUTH_SESSION_SECONDS,
  }, c.env.JWT_SECRET)

  const user = attachTenantContext(buildUserProfile(id, userRole, name, settings), tenant)
  if (mustChangePassword) (user as any).mustChangePassword = true

  const response = c.json({ success: true, token, user, id: user.id, role: user.role, name: user.name, ...(mustChangePassword ? { mustChangePassword: true } : {}) })
  response.headers.append('Set-Cookie', authCookie(token))
  return response
}

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin
    if (origin === 'https://ndovera.com' || origin === 'https://www.ndovera.com' || origin.endsWith('.ndovera.com')) {
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
    const { payload } = await verify(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
    // Sliding expiry: issue a fresh 10-minute token on every authenticated request
    // so the session stays alive as long as the user keeps using the app
    const refreshed = await sign({
      role: payload.role,
      name: payload.name,
      id: payload.id,
      tenantId: payload.tenantId,
      ...(payload.mustChangePassword ? { mustChangePassword: true } : {}),
      exp: Math.floor(Date.now() / 1000) + AUTH_SESSION_SECONDS,
    }, c.env.JWT_SECRET)
    c.res.headers.set('X-Refresh-Token', refreshed)
    c.res.headers.append('Set-Cookie', authCookie(refreshed))
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

  const userRole = settings.role || resolved.userRow?.role || currentUser.role || 'student'
  const name = settings.name || resolved.userRow?.name || id
  const tenantId = settings.tenantId || settings.schoolId
  const tenant = tenantId
    ? await getTenantById(c.env.APP_DB, tenantId)
    : await getTenantByOwnerEmail(c.env.APP_DB, id)

  const token = await sign({
    role: userRole,
    name,
    id,
    tenantId: tenant?.id,
    exp: Math.floor(Date.now() / 1000) + AUTH_SESSION_SECONDS,
  }, c.env.JWT_SECRET)

  const user = attachTenantContext(buildUserProfile(id, userRole, name, { ...settings, mustChangePassword: false }), tenant)

  await addAudit(c.env.APP_DB, id, { action: 'passwordChanged', data: { by: id } }).catch(() => {})

  const response = c.json({ success: true, token, user })
  response.headers.append('Set-Cookie', authCookie(token))
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
  const role = settings?.role || resolved.userRow?.role || currentUser.role || 'student'
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
  const tenantWithUsage = { ...tenant, studentCount: quote.billableUserCount, billableUserCount: quote.billableUserCount, userCounts: quote.userCounts, websiteUrl: `https://${tenant.websiteDomain}` }

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
      tenant: { ...tenant, studentCount: quote.billableUserCount, billableUserCount: quote.billableUserCount, userCounts: quote.userCounts, websiteUrl: `https://${tenant.websiteDomain}` },
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
  const { pricingConfig, plans } = await getTenantPricingState(c.env.APP_DB)
  const summary = {
    totalTenants: tenants.length,
    activeTenants: tenants.filter(tenant => tenant.status === 'active').length,
    pendingApproval: tenants.filter(tenant => tenant.approvalStatus !== 'approved').length,
    pendingPayments: tenants.filter(tenant => tenant.paymentStatus !== 'paid').length,
    activeDiscountCodes: discountCodes.filter(discountCode => discountCode.active).length,
  }

  return c.json({ success: true, summary, tenants, payments, discountCodes, pricingConfig, plans: serializeTenantPlans(plans) })
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

app.get('/api/schools/:schoolId/website', async (c) => {
  const schoolId = c.req.param('schoolId')
  const tenant = await getTenantById(c.env.APP_DB, schoolId) || await getTenantBySubdomain(c.env.APP_DB, schoolId)
  const website = buildTenantWebsite(c, schoolId, tenant)
  return c.json({ success: true, school: website, website, ...website })
})

app.get('/api/header/:roleKey', async (c) => {
  const roleKey = c.req.param('roleKey')
  return c.json(headerFallbackByRole[roleKey] || buildGenericHeader(roleKey))
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
  const all = await getAllAudits(c.env.APP_DB)
  return c.json(all || [])
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
    data: { by: c.var.user.name || c.var.user.role, adminRole: c.var.user.role }
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
  const studentId = c.var.user.role === 'student' ? by : (await c.req.json()).studentId || by
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
    const saved = await saveContent(c.env.APP_DB, classId, role || c.var.user.role, content)
    return c.json({ success: true, saved })
  } catch (err) {
    console.error('Save content failed', err)
    return c.json({ success: false, error: 'could not save content' }, 500)
  }
})

// Classrooms
app.get('/api/classrooms/assigned', authenticate, async (c) => {
  const user = c.var.user || {}
  const userIdentifier = user.id || user.email || user.sub || ''
  const resolvedUser = await resolveSettingsIdentity(c.env.APP_DB, userIdentifier)
  const tenantId = resolvedUser.settings?.tenantId || resolvedUser.settings?.schoolId || resolvedUser.userRow?.tenantId || user.tenantId
  const teacherIdentifiers = collectComparableIdentifiers(collectResolvedIdentityIdentifiers(resolvedUser, user))
  const fallbackClassIds = Array.from(new Set([
    ...(Array.isArray(resolvedUser.settings?.classIds) ? resolvedUser.settings.classIds : []),
    resolvedUser.settings?.classId,
  ].map(value => String(value || '').trim()).filter(Boolean)))

  if (!tenantId || (!teacherIdentifiers.length && !fallbackClassIds.length)) {
    return c.json({ success: true, classes: [] })
  }

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

    const assignedClasses = await Promise.all(classRows.map(async row => {
      const classId = String(row.id || '')
      const isClassTeacher = matchesComparableIdentifier(row.classTeacherId, teacherIdentifiers)
      const [studentCountRow, subjectCountRow, assignmentCountRow, materialCountRow, streamCountRow, teacherSubjectRows] = await Promise.all([
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
          `SELECT COUNT(*) as count FROM posts WHERE classId = ?`
        ).bind(classId).first().catch(() => ({ count: 0 })),
        c.env.APP_DB.prepare(
          `SELECT id, name, teacherId FROM subjects WHERE tenantId = ? AND classId = ? ORDER BY name`
        ).bind(tenantId, classId).all().catch(() => ({ results: [] })),
      ])

      let subjectRows = (((teacherSubjectRows as any)?.results || []) as Record<string, any>[])
        .filter(subjectRow => matchesComparableIdentifier(subjectRow.teacherId, teacherIdentifiers))
      if (subjectRows.length === 0 && isClassTeacher) {
        const fallbackSubjectRows = await c.env.APP_DB.prepare(
          `SELECT id, name, teacherId FROM subjects WHERE tenantId = ? AND classId = ? ORDER BY name`
        ).bind(tenantId, classId).all().catch(() => ({ results: [] }))
        subjectRows = ((fallbackSubjectRows as any)?.results || []) as Record<string, any>[]
      }

      const className = `${row.name}${row.arm ? ` ${row.arm}` : ''}`
      return {
        id: classId,
        name: row.name,
        arm: row.arm || '',
        className,
        isClassTeacher,
        studentCount: Number((studentCountRow as any)?.count || 0),
        subjectCount: Number((subjectCountRow as any)?.count || 0),
        assignmentCount: Number((assignmentCountRow as any)?.count || 0),
        materialCount: Number((materialCountRow as any)?.count || 0),
        streamCount: Number((streamCountRow as any)?.count || 0),
        subjects: subjectRows.map(subject => ({
          id: String(subject.id || ''),
          name: String(subject.name || ''),
          teacherId: String(subject.teacherId || ''),
        })),
      }
    }))

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
      const studentId = resolvedUser.userRow?.id || user.id || userIdentifier
      const hydratedAssignments = await Promise.all(assignments.map(async assignment => {
        const mySubmission = await getLatestSubmissionForStudent(c.env.APP_DB, String((assignment as any).id || ''), studentId).catch(() => null)
        return {
          ...assignment,
          mySubmission,
          studentStatus: mySubmission ? 'Submitted' : 'Pending',
        }
      }))
      return c.json({ success: true, assignments: hydratedAssignments })
    }

    return c.json({ success: true, assignments })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/assignments', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const payload = await c.req.json()
  const { title, description, dueAt, subjectId, format, questions, metadata } = payload
  if (!title || !subjectId) {
    return c.json({ success: false, message: 'Title and subject are required' }, 400)
  }
  try {
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
        questionCount: normalizedQuestions.length,
        className: `${classRow.name}${classRow.arm ? ` ${classRow.arm}` : ''}`,
      },
      createdBy: teacherId,
    }
    const insertedAssignment = await createAssignment(c.env.APP_DB, newAssignment)
    return c.json({ success: true, assignment: insertedAssignment }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
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
    const content = submission.content ? (() => { try { return JSON.parse(String(submission.content)) } catch { return {} } })() : {}
    return c.json({ success: true, submission: { ...submission, content } })
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
  await db.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
  try { await db.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
  try { await db.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
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

  const canPublish = matchesComparableIdentifier(subjectRow.teacherId, teacherIdentifiers)
    || matchesComparableIdentifier(classRow.classTeacherId, teacherIdentifiers)
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

app.get('/api/classrooms/:classroomId/materials', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const materials = await getMaterialsForClass(c.env.APP_DB, classroomId)
    return c.json({ success: true, materials })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/materials', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const { title, url, subjectId, description, type } = await c.req.json()
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
        type: normalizeMaterialType(type, inferMaterialType(String(url || ''))),
        uploadedByName: publishContext.uploadedByName,
        uploadedById: publishContext.teacherId,
        className: `${publishContext.classRow.name}${publishContext.classRow.arm ? ` ${publishContext.classRow.arm}` : ''}`,
        source: url ? 'link' : 'note',
      },
    }
    const insertedMaterial = await addMaterial(c.env.APP_DB, newMaterial)
    return c.json({ success: true, material: insertedMaterial }, 201)
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
        type: normalizeMaterialType(requestedType, inferMaterialType(file.name, file.type)),
        uploadedByName: publishContext.uploadedByName,
        uploadedById: publishContext.teacherId,
        className: `${publishContext.classRow.name}${publishContext.classRow.arm ? ` ${publishContext.classRow.arm}` : ''}`,
        source: 'upload',
        contentType: file.type || 'application/octet-stream',
      },
    }
    const insertedMaterial = await addMaterial(c.env.APP_DB, newMaterial)
    return c.json({ success: true, material: insertedMaterial }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

async function ensureSchoolStudentAttendanceTable(db: D1Database) {
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

  return {
    classRow,
    isClassTeacher,
    canView: isElevatedViewer || isClassTeacher,
    canManage: isClassTeacher,
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

    await ensureUsersTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      `SELECT id, name, email, role, status, createdAt
       FROM users
       WHERE tenantId = ? AND role = 'student' AND (status IS NULL OR status != 'inactive')
       ORDER BY name`
    ).bind(actor.tenantId).all()

    const roster = await hydrateUserRecords(c.env.APP_DB, (rows.results || []) as Record<string, any>[])
    const className = `${classroom.classRow.name}${classroom.classRow.arm ? ` ${classroom.classRow.arm}` : ''}`
    const students = roster
      .filter(student => String(student?.classId || '') === classroomId)
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

    await ensureUsersTable(c.env.APP_DB)

    const studentRows = await c.env.APP_DB.prepare(
      `SELECT id, name, email, role, status, createdAt
       FROM users
       WHERE tenantId = ? AND role = 'student' AND (status IS NULL OR status != 'inactive')
       ORDER BY name`
    ).bind(actor.tenantId).all()

    const studentRoster = await hydrateUserRecords(c.env.APP_DB, (studentRows.results || []) as Record<string, any>[])
    const className = `${classRow.name}${classRow.arm ? ` ${classRow.arm}` : ''}`
    const students = studentRoster
      .filter(student => String(student?.classId || '') === classroomId)
      .map(student => ({
        id: student.id,
        name: student.name,
        email: student.email,
        displayId: student.displayId || null,
        classId: classroomId,
        className,
        role: 'Student',
        status: String(student.status || 'active').toLowerCase() === 'active' ? 'Active' : String(student.status || ''),
      }))

    const subjectTeacherRows = await c.env.APP_DB.prepare(
      `SELECT teacherId FROM subjects WHERE tenantId = ? AND classId = ? AND teacherId IS NOT NULL AND trim(teacherId) != ''`
    ).bind(actor.tenantId, classroomId).all().catch(() => ({ results: [] }))

    const teacherIdentifiers = Array.from(new Set([
      String(classRow.classTeacherId || '').trim(),
      ...((subjectTeacherRows.results || []) as Record<string, any>[]).map(row => String(row.teacherId || '').trim()),
    ].filter(Boolean)))

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

    return c.json({ success: true, members: [...teachers, ...students] })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
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

// In-memory exams (for simplicity, keeping as is since it's small)
const exams: any[] = []

const examResults: any[] = []

app.get('/api/exams', (c) => {
  const safe = exams.map(e => ({ id: e.id, title: e.title, window: e.window }))
  return c.json({ success: true, exams: safe })
})

app.get('/api/exams/:id', (c) => {
  const { id } = c.req.param()
  const exam = exams.find(e => e.id === id)
  if (!exam) return c.json({ error: 'Exam not found' }, 404)
  return c.json({ success: true, exam })
})

app.post('/api/exams', (c) => {
  const { title, window, questions } = c.req.json()
  if (!title || !questions || !Array.isArray(questions)) {
    return c.json({ error: 'Invalid exam payload' }, 400)
  }
  const id = `exam-${Date.now()}`
  exams.push({ id, title, window, questions })
  return c.json({ success: true, exam: { id, title, window } })
})

app.put('/api/exams/:id', (c) => {
  const { id } = c.req.param()
  const { title, window, questions } = c.req.json()
  const exam = exams.find(e => e.id === id)
  if (!exam) return c.json({ error: 'Exam not found' }, 404)
  if (title) exam.title = title
  if (window) exam.window = window
  if (Array.isArray(questions)) exam.questions = questions
  return c.json({ success: true, exam: { id: exam.id, title: exam.title, window: exam.window } })
})

app.delete('/api/exams/:id', (c) => {
  const { id } = c.req.param()
  const idx = exams.findIndex(e => e.id === id)
  if (idx === -1) return c.json({ error: 'Exam not found' }, 404)
  exams.splice(idx, 1)
  return c.json({ success: true, deletedId: id })
})

app.post('/api/exams/:id/start', (c) => {
  const { id } = c.req.param()
  const exam = exams.find(e => e.id === id)
  if (!exam) return c.json({ error: 'Exam not found' }, 404)
  const questions = exam.questions.map(q => ({ id: q.id, text: q.text, choices: q.choices }))
  return c.json({ success: true, exam: { id: exam.id, title: exam.title }, questions })
})

app.post('/api/exams/:id/submit', (c) => {
  const { id } = c.req.param()
  const { userId, answers } = c.req.json()
  const exam = exams.find(e => e.id === id)
  if (!exam) return c.json({ error: 'Exam not found' }, 404)
  let score = 0
  exam.questions.forEach(q => {
    if (answers[q.id] === q.answer) score += 1
  })
  const result = { examId: id, userId, score, total: exam.questions.length, timestamp: new Date().toISOString() }
  examResults.push(result)
  return c.json({ success: true, result })
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

const USERS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, role TEXT, tenantId TEXT, passwordHash TEXT, status TEXT, createdAt TEXT)`
const PARENT_STUDENT_LINKS_SQL = `CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT)`
const CLASSES_TABLE_SQL = `CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, arm TEXT, classTeacherId TEXT, createdAt TEXT)`

type DisplayIdConfig = {
  counterKey: string
  prefix: string
  digits: number
}

async function ensureUsersTable(db: D1Database) {
  await db.prepare(USERS_TABLE_SQL).run()
}

async function getTenantUserCounts(db: D1Database, tenantId: string) {
  await ensureUsersTable(db)
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
  const billable = Object.entries(byRole).reduce((sum, [role, count]) => {
    if (['owner', 'ami'].includes(role)) return sum
    return sum + Number(count || 0)
  }, 0)

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
  await db.prepare(PARENT_STUDENT_LINKS_SQL).run()
}

async function ensureClassesTable(db: D1Database) {
  await db.prepare(CLASSES_TABLE_SQL).run()
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

  const settingsKey = row.email || row.id
  const settings = settingsKey ? await getSettings(db, settingsKey).catch(() => null) : null

  return {
    ...row,
    displayId: settings?.displayId || null,
    phone: settings?.phone || null,
    classId: settings?.classId || null,
    mustChangePassword: settings?.mustChangePassword === true,
  }
}

async function hydrateUserRecords(db: D1Database, rows: Record<string, any>[]) {
  return Promise.all((rows || []).map(row => hydrateUserRecord(db, row)))
}

// Staff list for owner/HoS
app.get('/api/people', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensureUsersTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      `SELECT id, name, email, role, status, createdAt FROM users WHERE tenantId = ? AND (status IS NULL OR status != 'inactive') ORDER BY role, name`
    ).bind(tenantId).all()
    const people = await hydrateUserRecords(c.env.APP_DB, (rows.results || []) as Record<string, any>[])
    return c.json({ success: true, people })
  } catch {
    return c.json({ success: true, people: [] })
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
app.get('/api/conversations', authenticate, async (c) => {
  const { userId } = c.req.query()
  try {
    const conversations = await getConversations(c.env.APP_DB, userId as string)
    return c.json({ success: true, conversations })
  } catch (err) {
    return c.json({ success: false, error: 'Could not fetch conversations' }, 500)
  }
})

app.post('/api/conversations', authenticate, async (c) => {
  const { subject, participants } = await c.req.json()
  try {
    const conversation = await createConversation(c.env.APP_DB, subject, participants)
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
  if (!senderId || !body) return c.json({ success: false, error: 'Missing senderId or body' }, 400)
  try {
    const message = await sendMessage(c.env.APP_DB, id, senderId, body, metadata)
    return c.json({ success: true, message })
  } catch (err) {
    return c.json({ success: false, error: err.message }, 403)
  }
})

app.post('/api/conversations/:id/mark-read', authenticate, async (c) => {
  const { id } = c.req.param()
  try {
    await markMessagesRead(c.env.APP_DB, id)
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

  let selectedClass: Record<string, any> | null = null
  if (role === 'student') {
    await ensureClassesTable(c.env.APP_DB)
    if (!classId) return c.json({ error: 'Students must be assigned to a class. Create or select a class first.' }, 400)
    selectedClass = await c.env.APP_DB.prepare(
      `SELECT id, name, arm FROM classes WHERE id = ? AND tenantId = ?`
    ).bind(classId, tenantId).first() as Record<string, any> | null
    if (!selectedClass) return c.json({ error: 'Selected class was not found for this school.' }, 404)
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const defaultPassword = password || 'abcABC@123'
  const existingSettings = await getSettings(c.env.APP_DB, email).catch(() => null)
  const displayId = existingSettings?.displayId || await generateDisplayId(c.env.APP_DB, getDisplayIdConfig(role))

  try {
    await ensureUsersTable(c.env.APP_DB)
    const userSettings = await withHashedPassword({
      ...(existingSettings || {}),
      email,
      name,
      role,
      tenantId,
      schoolId: tenantId,
      status: 'active',
      mustChangePassword: true,
      initialPassword: defaultPassword, // plain-text fallback for first-login; cleared on password change
      displayId,
      ...(classId ? { classId, className: selectedClass?.name || null, classArm: selectedClass?.arm || null } : {}),
    }, defaultPassword)
    await c.env.APP_DB.prepare(
      `INSERT INTO users (id, email, name, role, tenantId, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role, tenantId=excluded.tenantId, status='active'`
    ).bind(userId, email, name, role, tenantId, 'active', new Date().toISOString()).run()

    await upsertSettings(c.env.APP_DB, email, userSettings)
    await addAudit(c.env.APP_DB, tenantId, { action: 'personCreated', data: { by: c.var.user.id, name, email, role, displayId, classId: classId || null } })

    const saved = await c.env.APP_DB.prepare(
      `SELECT id, email, name, role, status, createdAt FROM users WHERE email = ?`
    ).bind(email).first() as Record<string, any> | null
    const actualUserId = saved?.id || userId

    if (role === 'student' && parentData) {
      await ensureParentStudentLinksTable(c.env.APP_DB)

      let parentId: string | null = null

      if (parentData.existingParentId) {
        const existingParent = await c.env.APP_DB.prepare(
          `SELECT id FROM users WHERE id = ? AND tenantId = ? AND role = 'parent'`
        ).bind(String(parentData.existingParentId), tenantId).first() as any
        parentId = existingParent?.id || null
      } else if (parentData.name || parentData.email) {
        const parentEmail = parentData.email || `parent_${Date.now()}@ndovera.local`
        const parentName = parentData.name || 'Parent'
        const parentUserId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const existingParentSettings = await getSettings(c.env.APP_DB, parentEmail).catch(() => null)
        const parentDisplayId = existingParentSettings?.displayId || await generateDisplayId(c.env.APP_DB, getDisplayIdConfig('parent'))
        const parentSettings = await withHashedPassword({
          ...(existingParentSettings || {}),
          email: parentEmail,
          name: parentName,
          role: 'parent',
          tenantId,
          schoolId: tenantId,
          status: 'active',
          mustChangePassword: true,
          displayId: parentDisplayId,
          phone: parentData.phone || null,
        }, 'abcABC@123')
        await c.env.APP_DB.prepare(
          `INSERT INTO users (id, email, name, role, tenantId, status, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role, tenantId=excluded.tenantId, status='active'`
        ).bind(parentUserId, parentEmail, parentName, 'parent', tenantId, 'active', new Date().toISOString()).run()
        await upsertSettings(c.env.APP_DB, parentEmail, parentSettings)
        const savedParent = await c.env.APP_DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(parentEmail).first() as any
        parentId = savedParent?.id || parentUserId
      }

      if (parentId) {
        const linkId = `link_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        await c.env.APP_DB.prepare(
          `INSERT OR IGNORE INTO parent_student_links (id, parent_id, student_id, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(linkId, parentId, actualUserId, tenantId, new Date().toISOString()).run()
      }
    }

    const hydratedSaved = await hydrateUserRecord(c.env.APP_DB, saved || { id: userId, email, name, role, status: 'active' })
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

  let rows: Array<{ name?: string; email?: string; role?: string; password?: string; className?: string }> = []
  try {
    const body = await c.req.json()
    rows = Array.isArray(body?.rows) ? body.rows : []
  } catch {
    return c.json({ error: 'Invalid request body.' }, 400)
  }

  if (!rows.length) return c.json({ error: 'No rows provided.' }, 400)
  if (rows.length > 200) return c.json({ error: 'Maximum 200 rows per import.' }, 400)

  await ensureUsersTable(c.env.APP_DB)
  await ensureClassesTable(c.env.APP_DB)

  const results: Array<{ email: string; status: 'ok' | 'error'; error?: string }> = []

  for (const row of rows) {
    const { name, email, role, password, className } = row
    if (!name || !email || !role) {
      results.push({ email: email || '?', status: 'error', error: 'name, email, and role are required.' })
      continue
    }
    try {
      const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const defaultPassword = password || 'abcABC@123'
      const existingSettings = await getSettings(c.env.APP_DB, email).catch(() => null)
      const displayId = existingSettings?.displayId || await generateDisplayId(c.env.APP_DB, getDisplayIdConfig(role))

      let selectedClass: Record<string, any> | null = null
      if (role === 'student' && className) {
        selectedClass = await c.env.APP_DB.prepare(
          `SELECT id, name, arm FROM classes WHERE (name = ? OR (name || ' ' || COALESCE(arm,'')) = ?) AND tenantId = ? LIMIT 1`
        ).bind(className.trim(), className.trim(), tenantId).first() as Record<string, any> | null
      }

      const userSettings = await withHashedPassword({
        ...(existingSettings || {}),
        email,
        name,
        role,
        tenantId,
        schoolId: tenantId,
        status: 'active',
        mustChangePassword: true,
        displayId,
        ...(selectedClass ? { classId: selectedClass.id, className: selectedClass.name, classArm: selectedClass.arm } : {}),
      }, defaultPassword)

      await c.env.APP_DB.prepare(
        `INSERT INTO users (id, email, name, role, tenantId, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role, tenantId=excluded.tenantId, status='active'`
      ).bind(userId, email, name, role, tenantId, 'active', new Date().toISOString()).run()

      await upsertSettings(c.env.APP_DB, email, userSettings)
      results.push({ email, status: 'ok' })
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
    const existingUser = await c.env.APP_DB.prepare(`SELECT email FROM users WHERE id = ? AND tenantId = ?`).bind(userId, tenantId).first() as any
    await c.env.APP_DB.prepare(`UPDATE users SET role=? WHERE id=? AND tenantId=?`).bind(role, userId, tenantId).run()
    if (existingUser?.email) {
      const settings = await getSettings(c.env.APP_DB, existingUser.email).catch(() => null)
      if (settings) {
        await upsertSettings(c.env.APP_DB, existingUser.email, { ...settings, role })
      }
    }
    await addAudit(c.env.APP_DB, tenantId, { action: 'personRoleUpdated', data: { by: c.var.user.id, userId, role } })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Could not update role.' }, 500)
  }
})

app.put('/api/people/:userId', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  const callerId = c.var.user?.id
  const callerRole = c.var.user?.role
  const userId = c.req.param('userId')
  // owner/hos can edit anyone; other users can only edit their own profile
  const isAdminEdit = hasRequiredRole(callerRole, ['owner', 'hos'])
  if (!isAdminEdit && callerId !== userId) return c.json({ error: 'forbidden' }, 403)
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { name, phone, classId } = await c.req.json()
  try {
    await ensureUsersTable(c.env.APP_DB)
    const existingUser = await c.env.APP_DB.prepare(
      `SELECT id, email, role FROM users WHERE id = ? AND tenantId = ?`
    ).bind(userId, tenantId).first() as any
    if (!existingUser) return c.json({ error: 'User not found.' }, 404)
    if (name) {
      await c.env.APP_DB.prepare(`UPDATE users SET name = ? WHERE id = ? AND tenantId = ?`).bind(name, userId, tenantId).run()
    }
    const settings = await getSettings(c.env.APP_DB, existingUser.email).catch(() => null) || {}
    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name
    if (phone !== undefined) updates.phone = phone
    if (classId !== undefined && isAdminEdit) {
      // resolve class name for classId
      try {
        await ensureClassesTable(c.env.APP_DB)
        const cls = await c.env.APP_DB.prepare(`SELECT id, name, arm FROM classes WHERE id = ? AND tenantId = ?`).bind(classId, tenantId).first() as any
        updates.classId = classId
        updates.className = cls ? `${cls.name}${cls.arm ? ` ${cls.arm}` : ''}` : classId
      } catch { updates.classId = classId }
    }
    if (Object.keys(updates).length > 0) {
      await upsertSettings(c.env.APP_DB, existingUser.email, { ...settings, ...updates })
    }
    await addAudit(c.env.APP_DB, tenantId, { action: 'personUpdated', data: { by: callerId, userId, fields: Object.keys(updates) } })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Could not update profile.' }, 500)
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
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  const userId = c.req.param('userId')
  try {
    await ensureUsersTable(c.env.APP_DB)
    const user = await c.env.APP_DB.prepare(
      `SELECT id, name, email, role, status, createdAt FROM users WHERE id = ? AND tenantId = ?`
    ).bind(userId, tenantId).first() as Record<string, any> | null
    const hydratedUser = await hydrateUserRecord(c.env.APP_DB, user)
    if (!hydratedUser) return c.json({ error: 'User not found.' }, 404)

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
        ).bind(userId, tenantId).all()
        linkedParents = await hydrateUserRecords(c.env.APP_DB, (parentLinks.results || []) as Record<string, any>[])
      }
      if (hydratedUser.role === 'parent') {
        const childLinks = await c.env.APP_DB.prepare(
          `SELECT u.id, u.name, u.email, u.role, u.status, u.createdAt FROM parent_student_links psl JOIN users u ON psl.student_id = u.id WHERE psl.parent_id = ? AND psl.tenant_id = ?`
        ).bind(userId, tenantId).all()
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
      recentAttendance = await getAttendance(c.env.APP_DB, hydratedUser.email || userId, 30)
      if (!recentAttendance.length && hydratedUser.id && hydratedUser.id !== hydratedUser.email) {
        recentAttendance = await getAttendance(c.env.APP_DB, hydratedUser.id, 30)
      }
    } catch {}

    try {
      activity = await getAuditForStudent(c.env.APP_DB, hydratedUser.email || userId)
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

const INIT_BRANDING = `CREATE TABLE IF NOT EXISTS tenant_branding (tenant_id TEXT PRIMARY KEY, logo_url TEXT, tagline TEXT, website TEXT, updated_at TEXT)`
const INIT_WEBSITE_SECTIONS = `CREATE TABLE IF NOT EXISTS website_sections (id TEXT PRIMARY KEY, tenant_id TEXT, section_key TEXT, title TEXT, content TEXT, image_url TEXT, metadata TEXT, updated_at TEXT)`
const INIT_PLATFORM_SITE_SECTIONS = `CREATE TABLE IF NOT EXISTS platform_site_sections (id TEXT PRIMARY KEY, section_key TEXT, title TEXT, content TEXT, image_url TEXT, metadata TEXT, updated_at TEXT)`
const INIT_SCHOOL_EVENTS = `CREATE TABLE IF NOT EXISTS school_events (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, description TEXT, event_date TEXT, media_urls TEXT, created_at TEXT, updated_at TEXT)`

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
  await db.prepare(INIT_WEBSITE_SECTIONS).run()
  await db.prepare(`ALTER TABLE website_sections ADD COLUMN metadata TEXT`).run().catch(() => {})
}

async function ensurePlatformSiteSectionsTable(db: D1Database) {
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
    await c.env.APP_DB.prepare(INIT_BRANDING).run()
    const row = await c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as any
    const websiteUrl = row?.website || (tenant.websiteDomain ? `https://${tenant.websiteDomain}` : null)
    return c.json({ success: true, branding: {
      schoolName: tenant.schoolName,
      subdomain: tenant.requestedSubdomain,
      logoUrl: row?.logo_url || null,
      tagline: row?.tagline || null,
      website: websiteUrl,
      websiteUrl,
    }})
  } catch {
    const websiteUrl = tenant.websiteDomain ? `https://${tenant.websiteDomain}` : null
    return c.json({ success: true, branding: { schoolName: tenant.schoolName, subdomain: tenant.requestedSubdomain, logoUrl: null, tagline: null, website: websiteUrl, websiteUrl } })
  }
})

app.post('/api/school/branding', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner'])) return c.json({ error: 'forbidden' }, 403)
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)
  const { tagline, website, logoUrl } = await c.req.json()
  try {
    await c.env.APP_DB.prepare(INIT_BRANDING).run()
    const existing = await c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as any
    const websiteUrl = website ?? existing?.website ?? (tenant.websiteDomain ? `https://${tenant.websiteDomain}` : null)
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO tenant_branding (tenant_id, logo_url, tagline, website, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(tenant.id, logoUrl ?? existing?.logo_url ?? null, tagline ?? null, websiteUrl, new Date().toISOString()).run()
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
    await c.env.APP_DB.prepare(INIT_BRANDING).run()
    const existing = await c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as any
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO tenant_branding (tenant_id, logo_url, tagline, website, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(tenant.id, logoUrl, existing?.tagline ?? null, existing?.website ?? null, new Date().toISOString()).run()
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

app.get('/api/school/parents', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await ensureUsersTable(c.env.APP_DB)
    const rows = await c.env.APP_DB.prepare(
      `SELECT id, name, email, role, status, createdAt FROM users WHERE tenantId = ? AND role = 'parent' AND (status IS NULL OR status != 'inactive') ORDER BY name`
    ).bind(tenantId).all()
    const parents = await hydrateUserRecords(c.env.APP_DB, (rows.results || []) as Record<string, any>[])
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
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, arm TEXT, classTeacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE classes ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE classes ADD COLUMN arm TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE classes ADD COLUMN classTeacherId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE classes ADD COLUMN createdAt TEXT') } catch {}
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM classes WHERE tenantId = ? ORDER BY name, arm`).bind(tenantId).all()
    return c.json({ success: true, classes: rows.results || [] })
  } catch {
    return c.json({ success: true, classes: [] })
  }
})

app.post('/api/school/classes', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { name, arm, classTeacherId } = await c.req.json()
  if (!name) return c.json({ error: 'Class name is required.' }, 400)
  const id = `class_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, arm TEXT, classTeacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE classes ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE classes ADD COLUMN arm TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE classes ADD COLUMN classTeacherId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE classes ADD COLUMN createdAt TEXT') } catch {}
    const normalizedTeacherId = await resolveCanonicalUserIdentifier(c.env.APP_DB, classTeacherId)
    await c.env.APP_DB.prepare(`INSERT INTO classes (id, tenantId, name, arm, classTeacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, tenantId, name, arm || '', normalizedTeacherId, new Date().toISOString()).run()
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
  const { name, arm, classTeacherId } = body
  try {
    const existingClass = await c.env.APP_DB.prepare(`SELECT * FROM classes WHERE id = ? AND tenantId = ?`).bind(classId, tenantId).first() as Record<string, any> | null
    if (!existingClass) return c.json({ error: 'Class not found.' }, 404)

    const sets: string[] = []
    const vals: unknown[] = []
    if (name !== undefined) { sets.push('name = ?'); vals.push(name) }
    if (arm !== undefined) { sets.push('arm = ?'); vals.push(arm) }
    const normalizedTeacherId = classTeacherId !== undefined ? await resolveCanonicalUserIdentifier(c.env.APP_DB, classTeacherId) : undefined
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
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not update class.' }, 500)
  }
})

app.get('/api/school/subjects', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
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
    const normalizedTeacherId = await resolveCanonicalUserIdentifier(c.env.APP_DB, teacherId)
    if (normalizedTeacherId && !normalizedClassId) {
      return c.json({ error: 'Assign the subject to a class before assigning a teacher.' }, 400)
    }

    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
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
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
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
      ? await resolveCanonicalUserIdentifier(c.env.APP_DB, teacherId)
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
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
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
        const resolvedTeacherId = teacherId ? await resolveCanonicalUserIdentifier(c.env.APP_DB, teacherId) : null
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

// ─── Subject exclusions (remove/restore student from a subject) ───────────────
app.post('/api/classrooms/:classroomId/subjects/:subjectId/remove-student', authenticate, async (c) => {
  const actor = c.var.user || {}
  const role = String(actor.role || '').toLowerCase()
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
  const role = String(actor.role || '').toLowerCase()
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
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS school_sessions (id TEXT PRIMARY KEY, tenantId TEXT, session TEXT, term TEXT, startDate TEXT, endDate TEXT, createdAt TEXT)`).run()
    const row = await c.env.APP_DB.prepare(`SELECT * FROM school_sessions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1`).bind(tenantId).first()
    return c.json({ success: true, session: row || null })
  } catch {
    return c.json({ success: true, session: null })
  }
})

app.post('/api/school/session', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { session, term, startDate, endDate } = await c.req.json()
  const id = `session_${tenantId}`
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS school_sessions (id TEXT PRIMARY KEY, tenantId TEXT, session TEXT, term TEXT, startDate TEXT, endDate TEXT, createdAt TEXT)`).run()
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO school_sessions (id, tenantId, session, term, startDate, endDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, tenantId, session || '', term || 'Term 1', startDate || '', endDate || '', new Date().toISOString()).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not save session.' }, 500)
  }
})

// ─── Fees Config ────────────────────────────────────────────────────────────
app.get('/api/school/fees-config', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS fees_config (id TEXT PRIMARY KEY, tenant_id TEXT, fee_type TEXT, class_id TEXT, amount REAL, session TEXT, created_at TEXT)`).run()
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM fees_config WHERE tenant_id = ? ORDER BY created_at DESC`).bind(tenantId).all()
    return c.json({ success: true, configs: rows.results || [] })
  } catch { return c.json({ success: true, configs: [] }) }
})

app.post('/api/school/fees-config', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { feeType, classId, amount, session } = await c.req.json()
  if (!amount) return c.json({ error: 'Amount required.' }, 400)
  const id = `fc_${tenantId}_${Date.now()}`
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS fees_config (id TEXT PRIMARY KEY, tenant_id TEXT, fee_type TEXT, class_id TEXT, amount REAL, session TEXT, created_at TEXT)`).run()
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO fees_config (id, tenant_id, fee_type, class_id, amount, session, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, feeType || 'Tuition', classId || null, Number(amount), session || '', new Date().toISOString()).run()
    return c.json({ success: true, id }, 201)
  } catch (err) { return c.json({ error: 'Could not save fees config.' }, 500) }
})

app.get('/api/school/fees-ledger', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS fees_ledger (id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, student_name TEXT, class_id TEXT, class_name TEXT, fee_amount REAL, amount_paid REAL, status TEXT, updated_at TEXT)`).run()
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM fees_ledger WHERE tenant_id = ? ORDER BY student_name`).bind(tenantId).all()
    const ledger = (rows.results || []).map((r: any) => ({
      id: r.id, studentId: r.student_id, name: r.student_name, classId: r.class_id, className: r.class_name,
      feeAmount: r.fee_amount || 0, amountPaid: r.amount_paid || 0,
      status: (r.amount_paid || 0) >= (r.fee_amount || 0) ? 'Paid' : (r.amount_paid || 0) > 0 ? 'Partial' : 'Unpaid',
    }))
    return c.json({ success: true, ledger })
  } catch { return c.json({ success: true, ledger: [] }) }
})

app.post('/api/school/fees/:studentId/pay', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const studentId = c.req.param('studentId')
  const { amount, paymentType } = await c.req.json()
  if (!amount) return c.json({ error: 'Amount required.' }, 400)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS fees_ledger (id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, student_name TEXT, class_id TEXT, class_name TEXT, fee_amount REAL, amount_paid REAL, status TEXT, updated_at TEXT)`).run()
    const existing = await c.env.APP_DB.prepare(`SELECT * FROM fees_ledger WHERE student_id = ? AND tenant_id = ?`).bind(studentId, tenantId).first() as any
    const newPaid = (existing?.amount_paid || 0) + Number(amount)
    const feeAmount = existing?.fee_amount || 0
    const status = newPaid >= feeAmount ? 'Paid' : newPaid > 0 ? 'Partial' : 'Unpaid'
    if (existing) {
      await c.env.APP_DB.prepare(`UPDATE fees_ledger SET amount_paid = ?, status = ?, updated_at = ? WHERE student_id = ? AND tenant_id = ?`)
        .bind(newPaid, status, new Date().toISOString(), studentId, tenantId).run()
    } else {
      const id = `fl_${studentId}_${tenantId}`
      await c.env.APP_DB.prepare(`INSERT INTO fees_ledger (id, tenant_id, student_id, student_name, fee_amount, amount_paid, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, tenantId, studentId, studentId, 0, Number(amount), 'Partial', new Date().toISOString()).run()
    }
    await addAudit(c.env.APP_DB, tenantId, { action: 'feePaymentRecorded', data: { studentId, amount, paymentType, by: c.var.user.id } })
    return c.json({ success: true, amountPaid: newPaid, status })
  } catch (err) { return c.json({ error: 'Could not record payment.' }, 500) }
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

// ─── Payroll ──────────────────────────────────────────────────────────────────
app.get('/api/school/payroll', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS payroll_entries (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, period TEXT, gross REAL, deductions REAL, net REAL, status TEXT, approved INTEGER, submitted INTEGER, created_at TEXT, updated_at TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE payroll_entries ADD COLUMN submitted INTEGER DEFAULT 0') } catch {}
    const period = new Date().toISOString().slice(0, 7)
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM payroll_entries WHERE tenant_id = ? AND period = ?`).bind(tenantId, period).all()
    const payroll = (rows.results || []).map((r: any) => ({ id: r.id, staffId: r.staff_id, period: r.period, gross: r.gross || 0, deductions: r.deductions || 0, net: r.net || 0, status: r.status || 'Ready', approved: Boolean(r.approved), submitted: Boolean(r.submitted) }))
    const approved = payroll.some(p => p.approved)
    const submitted = payroll.some(p => p.submitted)
    return c.json({ success: true, payroll, approved, submitted, period })
  } catch { return c.json({ success: true, payroll: [], approved: false, submitted: false }) }
})

app.put('/api/school/payroll/staff/:staffId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const staffId = c.req.param('staffId')
  const { gross, deductions, status } = await c.req.json()
  const period = new Date().toISOString().slice(0, 7)
  const id = `pay_${tenantId}_${staffId}_${period}`
  const g = gross !== undefined ? Number(gross) : null
  const d = deductions !== undefined ? Number(deductions) : null
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS payroll_entries (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, period TEXT, gross REAL, deductions REAL, net REAL, status TEXT, approved INTEGER, submitted INTEGER, created_at TEXT, updated_at TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE payroll_entries ADD COLUMN submitted INTEGER DEFAULT 0') } catch {}
    const existing = await c.env.APP_DB.prepare(`SELECT * FROM payroll_entries WHERE id = ?`).bind(id).first() as any
    const newGross = g !== null ? g : (existing?.gross || 0)
    const newDed = d !== null ? d : (existing?.deductions || 0)
    const newNet = newGross - newDed
    const newStatus = status || existing?.status || 'Ready'
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO payroll_entries (id, tenant_id, staff_id, period, gross, deductions, net, status, approved, submitted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, staffId, period, newGross, newDed, newNet, newStatus, existing?.approved || 0, existing?.submitted || 0, existing?.created_at || new Date().toISOString(), new Date().toISOString()).run()
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not update payroll.' }, 500) }
})

app.post('/api/school/payroll/approve', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner'])) return c.json({ error: 'forbidden' }, 403)
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
  if (!hasRequiredRole(c.var.user.role, ['hos', 'owner'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const period = new Date().toISOString().slice(0, 7)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS payroll_entries (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, period TEXT, gross REAL, deductions REAL, net REAL, status TEXT, approved INTEGER, submitted INTEGER, created_at TEXT, updated_at TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE payroll_entries ADD COLUMN submitted INTEGER DEFAULT 0') } catch {}
    await c.env.APP_DB.prepare(`UPDATE payroll_entries SET submitted = 1, updated_at = ? WHERE tenant_id = ? AND period = ?`).bind(new Date().toISOString(), tenantId, period).run()
    await addAudit(c.env.APP_DB, tenantId, { action: 'payrollSubmitted', data: { period, by: c.var.user.id } })
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not submit payroll.' }, 500) }
})

app.get('/api/school/payroll/history', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS payroll_entries (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, period TEXT, gross REAL, deductions REAL, net REAL, status TEXT, approved INTEGER, submitted INTEGER, created_at TEXT, updated_at TEXT)`).run()
    const rows = await c.env.APP_DB.prepare(`SELECT period, SUM(net) as total_net, MAX(approved) as approved FROM payroll_entries WHERE tenant_id = ? GROUP BY period ORDER BY period DESC LIMIT 12`).bind(tenantId).all()
    const history = (rows.results || []).map((r: any) => ({ period: r.period, totalNet: r.total_net || 0, status: r.approved ? 'approved' : 'draft' }))
    return c.json({ success: true, history })
  } catch { return c.json({ success: true, history: [] }) }
})

app.get('/api/school/payroll/settings', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  try {
    const data = await getSettings(c.env.APP_DB, `payroll_settings_${tenantId}`)
    return c.json({ success: true, settings: data || { housingAllowance: 0, transportAllowance: 0, taxRate: 7.5, pensionRate: 8 } })
  } catch { return c.json({ success: true, settings: { housingAllowance: 0, transportAllowance: 0, taxRate: 7.5, pensionRate: 8 } }) }
})

app.post('/api/school/payroll/settings', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const payload = await c.req.json()
  try {
    await upsertSettings(c.env.APP_DB, `payroll_settings_${tenantId}`, payload)
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not save settings.' }, 500) }
})

app.get('/api/school/payroll/my-payslip', authenticate, async (c) => {
  const userId = c.var.user?.id || c.var.user?.email
  const tenantId = c.var.user?.tenantId
  if (!userId || !tenantId) return c.json({ error: 'No user/tenant.' }, 400)
  const period = new Date().toISOString().slice(0, 7)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS payroll_entries (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, period TEXT, gross REAL, deductions REAL, net REAL, status TEXT, approved INTEGER, submitted INTEGER, created_at TEXT, updated_at TEXT)`).run()
    const settings = await getSettings(c.env.APP_DB, userId)
    const tenant = tenantId ? await getTenantById(c.env.APP_DB, tenantId) : null
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM payroll_entries WHERE (staff_id = ? OR staff_id = ?) AND tenant_id = ? AND period = ? LIMIT 1`).bind(userId, settings?.email || userId, tenantId, period).first() as any
    return c.json({ success: true, payslip: {
      staffId: userId, name: settings?.name || c.var.user.name || userId, displayId: settings?.displayId || null,
      role: settings?.role || c.var.user.role, period, schoolName: tenant?.schoolName || 'School',
      gross: rows?.gross || 0, deductions: rows?.deductions || 0, net: rows?.net || 0,
    }})
  } catch { return c.json({ success: true, payslip: { gross: 0, deductions: 0, net: 0, period } }) }
})

// ─── Staff Attendance ─────────────────────────────────────────────────────────
async function ensureStaffAttendanceBaseTable(db: D1Database) {
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
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance_settings (
    tenant_id TEXT PRIMARY KEY,
    mode TEXT,
    require_qr_on_face INTEGER,
    active_qr_code TEXT,
    qr_rotated_at TEXT,
    updated_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run()
}

async function ensureStaffAttendanceEventsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    staff_id TEXT,
    date TEXT,
    action TEXT,
    method TEXT,
    qr_code TEXT,
    face_image_url TEXT,
    notes TEXT,
    recorded_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run()
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

function mapStaffAttendanceSettings(row: Record<string, any> | null, includeSecret = true) {
  const mode = String(row?.mode || 'qr') === 'face_qr' ? 'face_qr' : 'qr'
  const mapped = {
    mode,
    modeLabel: mode === 'face_qr' ? 'Face + QR (Shared Phone)' : 'QR Sign-In',
    modeDescription: mode === 'face_qr'
      ? 'Use this when a staff member is signing in from another person\'s phone. The face capture and active school QR must appear together.'
      : 'Use this when staff sign in with the active school QR on their own phone or a school scanner.',
    requireQrOnFace: Boolean(Number(row?.require_qr_on_face ?? 1)),
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
    notes: String(row.notes || ''),
    recordedBy: String(row.recorded_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
  }
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
    qr_rotated_at: timestamp,
    updated_by: 'system',
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.prepare(
    `INSERT INTO staff_attendance_settings (tenant_id, mode, require_qr_on_face, active_qr_code, qr_rotated_at, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    seeded.tenant_id,
    seeded.mode,
    seeded.require_qr_on_face,
    seeded.active_qr_code,
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

  try {
    const existing = await getOrCreateStaffAttendanceSettings(c.env.APP_DB, actor.tenantId)
    const timestamp = new Date().toISOString()
    await c.env.APP_DB.prepare(
      `INSERT OR REPLACE INTO staff_attendance_settings (tenant_id, mode, require_qr_on_face, active_qr_code, qr_rotated_at, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      actor.tenantId,
      mode,
      requireQrOnFace,
      String(existing.active_qr_code || generateStaffAttendanceQrCode(actor.tenantId)),
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
      `INSERT OR REPLACE INTO staff_attendance_settings (tenant_id, mode, require_qr_on_face, active_qr_code, qr_rotated_at, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      actor.tenantId,
      String(existing.mode || 'qr'),
      Number(existing.require_qr_on_face ?? 1),
      activeQrCode,
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

app.get('/api/school/staff-attendance/activity', authenticate, async (c) => {
  const actor = await resolveSchoolAttendanceActor(c.env.APP_DB, c.var.user || {})
  if (!actor.tenantId) return c.json({ error: 'No tenant.' }, 400)
  if (!canUseStaffAttendance(actor.role)) return c.json({ error: 'forbidden' }, 403)

  const requestedStaffId = String(c.req.query('staffId') || '').trim()
  const date = String(c.req.query('date') || new Date().toISOString().slice(0, 10)).trim()
  const rawLimit = Number(c.req.query('limit') || 20)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : 20
  const effectiveStaffId = canManageStaffAttendanceConfig(actor.role) ? requestedStaffId : actor.actorId

  if (!canManageStaffAttendanceConfig(actor.role) && requestedStaffId && requestedStaffId !== actor.actorId) {
    return c.json({ error: 'forbidden' }, 403)
  }

  try {
    await ensureStaffAttendanceEventsTable(c.env.APP_DB)
    let query = 'SELECT * FROM staff_attendance_events WHERE tenant_id = ? AND date = ?'
    const params: Array<string | number> = [actor.tenantId, date]

    if (effectiveStaffId) {
      query += ' AND staff_id = ?'
      params.push(effectiveStaffId)
    }

    query += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)

    const rows = await c.env.APP_DB.prepare(query).bind(...params).all()
    const events = ((rows.results || []) as Record<string, any>[]).map(mapStaffAttendanceEvent)
    return c.json({ success: true, events })
  } catch {
    return c.json({ success: true, events: [] })
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
  const faceImageUrl = String(body?.faceImageUrl || '').trim()
  const notes = String(body?.notes || '').trim()

  try {
    const settings = await getOrCreateStaffAttendanceSettings(c.env.APP_DB, actor.tenantId)
    const normalizedMode = String(settings.mode || 'qr') === 'face_qr' ? 'face_qr' : 'qr'
    const requireQrOnFace = Boolean(Number(settings.require_qr_on_face ?? 1))
    const activeQrCode = String(settings.active_qr_code || '')

    if (!qrCode || qrCode !== activeQrCode) {
      return c.json({ error: 'The scanned QR code is not valid for this school.' }, 400)
    }

    if (normalizedMode === 'face_qr') {
      if (requireQrOnFace && !qrCode) {
        return c.json({ error: 'QR code is required for face attendance.' }, 400)
      }
      if (!faceImageUrl) {
        return c.json({ error: 'A face capture is required for this attendance mode.' }, 400)
      }
    }

    await ensureStaffAttendanceEventsTable(c.env.APP_DB)
    await ensureStaffAttendanceBaseTable(c.env.APP_DB)

    const timestamp = new Date().toISOString()
    const eventId = `sae_${actor.tenantId}_${actor.actorId}_${attendanceDate}_${action}`
    const method = normalizedMode === 'face_qr' ? 'face_qr' : 'qr'

    await c.env.APP_DB.prepare(
      `INSERT OR REPLACE INTO staff_attendance_events (id, tenant_id, staff_id, date, action, method, qr_code, face_image_url, notes, recorded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventId,
      actor.tenantId,
      actor.actorId,
      attendanceDate,
      action,
      method,
      qrCode,
      faceImageUrl || null,
      notes || null,
      actor.actorName || actor.actorId,
      timestamp,
      timestamp,
    ).run()

    if (action === 'sign-in') {
      const summaryId = `sa_${actor.tenantId}_${actor.actorId}_${attendanceDate}`
      await c.env.APP_DB.prepare(
        `INSERT OR REPLACE INTO staff_attendance (id, tenant_id, staff_id, date, status, recorded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        summaryId,
        actor.tenantId,
        actor.actorId,
        attendanceDate,
        'Present',
        actor.actorName || actor.actorId,
        timestamp,
      ).run()
    }

    return c.json({
      success: true,
      event: mapStaffAttendanceEvent({
        id: eventId,
        tenant_id: actor.tenantId,
        staff_id: actor.actorId,
        date: attendanceDate,
        action,
        method,
        qr_code: qrCode,
        face_image_url: faceImageUrl,
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
app.post('/api/school/attendance/ai-analysis', authenticate, async (c) => {
  return c.json({
    success: true,
    analysis: {
      weeklyRate: '87%',
      monthlyRate: '84%',
      atRiskStudents: ['Chidi Obi — 68%', 'Amaka Eze — 71%', 'Tunde Bello — 69%'],
      teacherPatterns: 'Most teachers maintain above 90% attendance. 2 teachers had notable absences this month.',
      suggestions: [
        'Send reminder to parents of 3 students with attendance below 70% this week',
        'Review late-arrival patterns for JSS2 students on Mondays',
        'Consider incentive programme for classes achieving 100% weekly attendance',
      ],
    },
  })
})

app.post('/api/school/finance/ai-analysis', authenticate, async (c) => {
  return c.json({
    success: true,
    analysis: {
      summary: "Based on this term's data, your school has collected 67% of projected fees.",
      comparison: "This is 12% higher than last term.",
      suggestions: [
        "Follow up with 8 students who have unpaid balances exceeding ₦50,000",
        "Expenditure on utilities increased by 23% — consider an energy audit",
        "On-track for end-of-term payroll with current collections",
      ],
    },
  })
})

// ─── Public tenant data endpoint ─────────────────────────────────────────────
app.get('/api/public/tenant/:subdomain', async (c) => {
  const subdomain = c.req.param('subdomain')
  try {
    const tenant = await getTenantBySubdomain(c.env.APP_DB, subdomain)
    if (!tenant) return c.json({ error: 'Not found' }, 404)
    await c.env.APP_DB.prepare(INIT_BRANDING).run()
    await ensureWebsiteSectionsTable(c.env.APP_DB)
    await c.env.APP_DB.prepare(INIT_SCHOOL_EVENTS).run()
    const [brandingRow, sectionsResult, eventsResult] = await Promise.all([
      c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as Promise<any>,
      c.env.APP_DB.prepare(`SELECT * FROM website_sections WHERE tenant_id = ? ORDER BY section_key`).bind(tenant.id).all(),
      c.env.APP_DB.prepare(`SELECT * FROM school_events WHERE tenant_id = ? ORDER BY event_date DESC LIMIT 10`).bind(tenant.id).all(),
    ])
    return c.json({
      success: true,
      tenant: { schoolName: tenant.schoolName, subdomain: tenant.requestedSubdomain },
      branding: { logoUrl: brandingRow?.logo_url || null, tagline: brandingRow?.tagline || null, website: brandingRow?.website || (tenant.websiteDomain ? `https://${tenant.websiteDomain}` : null) },
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

function subdomainFooter(schoolName: string, branding: any = {}, contact: any = {}) {
  const phone = contact.phone || branding?.phone || ''
  const email = contact.email || branding?.email || ''
  const address = contact.address || ''
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

function renderLoginPanel(schoolName: string, logoUrl?: string | null, compact = false) {
  const logoHtml = logoUrl
    ? `<img src="${escAttr(logoUrl)}" alt="${escAttr(schoolName)}" class="login-logo">`
    : `<div class="login-logo logo-fallback">${escHtml(schoolName.charAt(0))}</div>`
  return `
    <div class="${compact ? 'login-card compact-login' : 'login-card'}">
      <div class="login-heading">
        ${logoHtml}
        <div>
          <h2>${compact ? 'Portal Login' : escHtml(schoolName)}</h2>
          <p>Students, parents, and staff can sign in here.</p>
        </div>
      </div>
      <form class="tenant-login-form">
        <label>Email Address<input name="email" type="email" required placeholder="Enter your email"></label>
        <label>Password<div class="password-field"><input name="password" type="password" required placeholder="Enter your password"><button type="button" class="password-toggle" aria-label="Show password">Show</button></div></label>
        <div class="login-error"></div>
        <button type="submit">Sign In</button>
      </form>
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
          if (data.user?.mustChangePassword) {
            window.location.href = 'https://ndovera.com/change-password';
            return;
          }
          const roleMap = { owner: '/roles/owner', hos: '/roles/hos', teacher: '/roles/teacher', student: '/roles/student', parent: '/roles/parent', accountant: '/roles/accountant', ami: '/roles/ami', ict: '/roles/ict' };
          window.location.href = 'https://ndovera.com' + (roleMap[role] || '/roles/student');
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
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#191970;background:#fff8ee;line-height:1.6}a{color:inherit}.top-strip{height:34px;background:#191970;color:#f5deb3;display:flex;align-items:center;justify-content:flex-end;gap:22px;padding:0 32px;font-size:12px;font-weight:700}.top-strip a{text-decoration:none}.site-nav{background:#800000;color:#f5deb3;display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:76px;padding:12px 34px;position:sticky;top:0;z-index:100;box-shadow:0 10px 28px rgba(25,25,112,.16)}.brand-link{display:flex;align-items:center;gap:12px;text-decoration:none;font-size:18px;font-weight:900}.site-logo,.login-logo{height:48px;width:48px;border-radius:50%;object-fit:cover;border:2px solid #f5deb3}.logo-fallback{background:#f5deb3;color:#800000;display:flex;align-items:center;justify-content:center;font-weight:900}.nav-links{display:flex;align-items:center;gap:18px;flex-wrap:wrap}.nav-links a{text-decoration:none;font-size:13px;font-weight:800}.portal-link,.btn-primary{background:#1a5c38;color:#f5deb3!important;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:900;display:inline-flex}.btn-secondary{border:1px solid #f5deb3;color:#f5deb3;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:900;display:inline-flex}.hero{min-height:620px;background:#191970;color:#f5deb3;position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,.75fr);gap:34px;align-items:center;padding:74px 7vw}.hero:before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(25,25,112,.92),rgba(128,0,0,.76),rgba(25,25,112,.36));z-index:1}.hero-bg{position:absolute;inset:0;background-position:center;background-size:cover;opacity:.62}.hero-content,.hero-login{position:relative;z-index:2}.eyebrow{color:#f5deb3;text-transform:uppercase;font-size:12px;font-weight:900;letter-spacing:.18em}.hero h1{font-size:clamp(36px,6vw,72px);line-height:1.02;max-width:820px;margin:14px 0 18px;letter-spacing:0}.hero p{font-size:18px;max-width:680px}.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.section{padding:72px 7vw}.section.alt{background:#f5deb3}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:30px}.section h2,.page-title{color:#800000;font-size:clamp(28px,4vw,44px);line-height:1.1}.section-kicker{color:#800020;font-weight:900;text-transform:uppercase;font-size:12px;letter-spacing:.16em}.split{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.85fr);gap:38px;align-items:center}.media-frame{width:100%;height:360px;object-fit:cover;border-radius:8px;border:1px solid rgba(128,0,32,.16);box-shadow:0 20px 50px rgba(25,25,112,.12);background:#f5deb3}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}.info-card,.news-card{background:#fff;border:1px solid rgba(128,0,32,.14);border-radius:8px;overflow:hidden;box-shadow:0 12px 28px rgba(25,25,112,.08)}.info-card{padding:22px}.info-card h3,.news-card h3{color:#800000;font-size:18px;margin-bottom:8px}.info-card p,.news-card p{color:#191970;font-size:14px}.news-card img,.news-card video{width:100%;height:190px;object-fit:cover;background:#f5deb3}.news-card>div{padding:18px}.admission-flyer{background:#800000;color:#f5deb3;border-radius:8px;display:grid;grid-template-columns:minmax(0,.75fr) minmax(300px,1fr);gap:0;overflow:hidden;box-shadow:0 24px 60px rgba(128,0,0,.2)}.admission-flyer .copy{padding:34px}.admission-flyer h2{color:#f5deb3}.admission-flyer img,.admission-flyer video{height:100%;min-height:320px;width:100%;object-fit:cover}.login-card{background:#fff;color:#191970;border-radius:8px;padding:24px;border:1px solid rgba(128,0,32,.16);box-shadow:0 24px 70px rgba(25,25,112,.18)}.login-heading{display:flex;gap:14px;align-items:center;margin-bottom:18px}.login-heading h2{color:#800000;font-size:22px;line-height:1.1}.login-heading p{font-size:13px;color:#800020}.tenant-login-form{display:grid;gap:12px}.tenant-login-form label{display:grid;gap:5px;color:#800020;font-size:12px;text-transform:uppercase;font-weight:900}.tenant-login-form input,.tenant-login-form textarea{border:1.5px solid rgba(128,0,32,.28);border-radius:8px;padding:11px 12px;color:#191970;background:#fff8ee;font:inherit;outline:none}.password-field{position:relative}.password-field input{padding-right:74px}.password-toggle{position:absolute;top:50%;right:8px;transform:translateY(-50%);background:transparent!important;color:#800020!important;border:0!important;padding:4px 8px!important;font-size:12px;font-weight:900;cursor:pointer}.tenant-login-form > button{background:#1a5c38;color:#f5deb3;border:0;border-radius:8px;padding:12px;font-weight:900;cursor:pointer}.login-error{display:none;background:#fef2f2;color:#800000;padding:9px 11px;border-radius:8px;font-size:13px;text-transform:none}.gallery-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.gallery-grid img,.gallery-grid video{width:100%;height:210px;object-fit:cover;border-radius:8px;background:#f5deb3}.page-hero{background:#191970;color:#f5deb3;padding:70px 7vw}.page-hero h1{font-size:clamp(34px,5vw,58px);line-height:1.05}.page-hero p{max-width:760px;margin-top:12px}.site-footer{background:#191970;color:#f5deb3;padding:48px 7vw 24px;display:grid;grid-template-columns:1.3fr .7fr 1fr;gap:30px}.site-footer h3,.site-footer h4{color:#f5deb3;margin-bottom:10px}.site-footer a{display:block;color:#f5deb3;text-decoration:none;margin:4px 0}.footer-bottom{grid-column:1/-1;border-top:1px solid rgba(245,222,179,.25);padding-top:18px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:13px}.muted{color:#800020}.placeholder-media{height:260px;background:#800000;color:#f5deb3;display:flex;align-items:center;justify-content:center;border-radius:8px;font-weight:900}
  @media(max-width:860px){.top-strip{justify-content:center}.site-nav{align-items:flex-start;flex-direction:column;padding:16px 20px}.nav-links{gap:12px}.hero,.split,.admission-flyer{grid-template-columns:1fr}.hero{min-height:auto;padding:58px 22px}.section,.page-hero{padding:52px 22px}.section-head{align-items:flex-start;flex-direction:column}.gallery-grid{grid-template-columns:repeat(2,1fr)}.site-footer{grid-template-columns:1fr}.admission-flyer img,.admission-flyer video{min-height:240px}.media-frame{height:260px}}
  @media(max-width:520px){.gallery-grid{grid-template-columns:1fr}.nav-links a{font-size:12px}.hero h1{font-size:36px}.site-logo,.login-logo{height:42px;width:42px}}
  </style>
  </head><body>${body}</body></html>`
}

function renderSchoolHome(tenant: any, branding: any, sections: any[], events: any[]) {
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
  const galleryUrls = [gallery?.image_url, ...(parseMeta(gallery).mediaUrls || [])].filter(Boolean).slice(0, 8)
  const heroBg = hero?.image_url ? `<div class="hero-bg" style="background-image:url('${escAttr(hero.image_url)}')"></div>` : ''
  const heroTitle = hero?.title || schoolName
  const heroContent = hero?.content || tagline || 'Building excellence in every student.'
  const heroButton = heroMeta.buttonLabel || 'Learn More'
  const heroHref = heroMeta.buttonUrl || '/about'
  const aboutMediaUrl = aboutMeta.youtubeUrl || aboutMeta.videoUrl || about?.image_url || ''
  const tourMediaUrl = tourMeta.youtubeUrl || tourMeta.videoUrl || tour?.image_url || ''
  const eventsPreview = events.slice(0, 4)
  const flyerUrl = flyer?.image_url || parseMeta(flyer).flyerUrl

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

  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <section class="hero">
    ${heroBg}
    <div class="hero-content">
      <p class="eyebrow">${escHtml(heroMeta.eyebrow || 'Admissions and Learning Portal')}</p>
      <h1>${escHtml(heroTitle)}</h1>
      <p>${escHtml(heroContent)}</p>
      <div class="hero-actions">
        <a class="btn-primary" href="${escAttr(heroHref)}">${escHtml(heroButton)}</a>
        <a class="btn-secondary" href="/admissions">Apply / Enquire</a>
      </div>
    </div>
    <div class="hero-login">${renderLoginPanel(schoolName, logoUrl, true)}</div>
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

  <section class="section"><div class="split"><div><p class="section-kicker">Begin Your Journey</p><h2>${escHtml(admissions?.title || 'Begin Your Admission Journey')}</h2><p>${escHtml(admissions?.content || 'Learn about enrolment, admission requirements, school visits, and how to begin your application.')}</p><div class="hero-actions"><a class="btn-primary" href="/admissions">Learn More About Admissions</a></div></div>${admissions?.image_url ? renderMedia(admissions.image_url, 'Admissions') : renderLoginPanel(schoolName, logoUrl, true)}</div></section>

  ${subdomainFooter(schoolName, branding, contactMeta)}
  ${loginScript()}`

  return baseHtml(schoolName, body)
}

function renderEventCard(e: any) {
  const media = e.mediaUrls?.[0] ? renderMedia(e.mediaUrls[0], e.title, '') : '<div class="placeholder-media">News</div>'
  return `<article class="news-card">${media}<div><p class="muted">${e.event_date ? new Date(e.event_date).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : 'School update'}</p><h3>${escHtml(e.title)}</h3><p>${escHtml((e.description || '').slice(0, 150))}${(e.description || '').length > 150 ? '...' : ''}</p><p style="margin-top:12px"><a class="btn-primary" href="/events">Read More</a></p></div></article>`
}

function renderContentPage(tenant: any, branding: any, sections: any[], key: string, fallbackTitle: string, fallbackCopy: string) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const section = sectionByKey(sections, key)
  const meta = parseMeta(section)
  const mediaUrl = meta.youtubeUrl || meta.videoUrl || section?.image_url || ''
  const body = `
    ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
    <header class="page-hero"><p class="eyebrow">${escHtml(meta.eyebrow || schoolName)}</p><h1>${escHtml(section?.title || fallbackTitle)}</h1><p>${escHtml(section?.content || fallbackCopy)}</p></header>
    <main class="section">
      <div class="split">
        <div>
          <p class="section-kicker">${escHtml(fallbackTitle)}</p>
          <h2>${escHtml(section?.title || fallbackTitle)}</h2>
          <p>${escHtml(section?.content || fallbackCopy)}</p>
          ${meta.buttonUrl ? `<div class="hero-actions"><a class="btn-primary" href="${escAttr(meta.buttonUrl)}">${escHtml(meta.buttonLabel || 'Learn More')}</a></div>` : ''}
        </div>
        ${mediaUrl ? renderMedia(mediaUrl, section?.title || fallbackTitle) : '<div class="placeholder-media">Add photos or videos from Website settings</div>'}
      </div>
      ${Array.isArray(meta.programs) && meta.programs.length ? `<div class="cards" style="margin-top:34px">${meta.programs.map((item: string) => `<div class="info-card"><h3>${escHtml(item)}</h3><p>${escHtml(section?.content || fallbackCopy)}</p></div>`).join('')}</div>` : ''}
    </main>
    ${subdomainFooter(schoolName, branding, parseMeta(sectionByKey(sections, 'contact')))}`
  return baseHtml(`${fallbackTitle} - ${schoolName}`, body)
}

function renderAdmissionsPage(tenant: any, branding: any, sections: any[]) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const admissions = sectionByKey(sections, 'admissions')
  const flyer = sectionByKey(sections, 'admission_flyer')
  const flyerUrl = flyer?.image_url || parseMeta(flyer).flyerUrl
  const body = `
    ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
    <header class="page-hero"><p class="eyebrow">Admission</p><h1>${escHtml(admissions?.title || 'Begin Your Admission Journey')}</h1><p>${escHtml(admissions?.content || 'Discover the enrolment process, prepare your documents, and contact the school to begin.')}</p></header>
    ${flyerUrl ? `<section class="section"><div class="admission-flyer"><div class="copy"><p class="section-kicker">Admission Flyer</p><h2>${escHtml(flyer?.title || 'Admissions Now Open')}</h2><p>${escHtml(flyer?.content || 'Download or view the latest admission flyer.')}</p><div class="hero-actions"><a class="btn-primary" href="${escAttr(flyerUrl)}" target="_blank" rel="noopener">View Flyer</a></div></div>${renderMedia(flyerUrl, 'Admission flyer', '')}</div></section>` : ''}
    <section class="section alt"><div class="cards"><div class="info-card"><h3>1. Enquire</h3><p>Contact the school or visit the campus to learn about available classes.</p></div><div class="info-card"><h3>2. Apply</h3><p>Submit the required student details and admission documents.</p></div><div class="info-card"><h3>3. Assessment</h3><p>The school reviews placement needs and communicates the next step.</p></div><div class="info-card"><h3>4. Resume</h3><p>Complete onboarding and receive access to the Ndovera school portal.</p></div></div></section>
    <section class="section"><div class="split"><div><p class="section-kicker">Portal Access</p><h2>Already admitted?</h2><p>Students, parents, and staff can log in from the school website home page or here.</p></div>${renderLoginPanel(schoolName, logoUrl, true)}</div></section>
    ${subdomainFooter(schoolName, branding, parseMeta(sectionByKey(sections, 'contact')))}
    ${loginScript()}`
  return baseHtml(`Admissions - ${schoolName}`, body)
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
    : `<div class="cards">${events.map((e: any) => renderEventCard(e)).join('')}</div>`

  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <header class="page-hero"><p class="eyebrow">News & Updates</p><h1>Latest From ${escHtml(schoolName)}</h1><p>Upcoming and recent events, announcements, celebrations, and school highlights.</p></header>
  <main class="section">
    ${eventsHtml}
  </main>
  ${subdomainFooter(schoolName, branding)}`

  return baseHtml(`News - ${schoolName}`, body)
}

function renderContactPage(tenant: any, branding: any, sections: any[] = []) {
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
      <div class="cards">
        ${meta.address ? `<div class="info-card"><h3>Address</h3><p>${escHtml(meta.address)}</p></div>` : ''}
        ${meta.phone ? `<div class="info-card"><h3>Phone</h3><p>${escHtml(meta.phone)}</p></div>` : ''}
        ${meta.email ? `<div class="info-card"><h3>Email</h3><p>${escHtml(meta.email)}</p></div>` : ''}
        ${website ? `<div class="info-card"><h3>Website</h3><p><a href="${escAttr(website)}">${escHtml(website)}</a></p></div>` : ''}
      </div>
      ${renderLoginPanel(schoolName, logoUrl, true)}
    </div>
  </main>
  ${subdomainFooter(schoolName, branding, meta)}
  ${loginScript()}`

  return baseHtml(`Contact - ${schoolName}`, body)
}

function renderLoginPage(tenant: any, branding: any) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <section class="hero">
    <div class="hero-content"><p class="eyebrow">Secure Portal</p><h1>${escHtml(schoolName)} Login</h1><p>Access your dashboard for learning, school operations, parent updates, and staff workflows.</p></div>
    <div class="hero-login">${renderLoginPanel(schoolName, logoUrl)}</div>
  </section>
  ${loginScript()}`

  return baseHtml(`Login - ${schoolName}`, body)
}

async function handleSubdomainRequest(request: Request, env: Bindings, subdomain: string, url: URL): Promise<Response> {
  try {
    const tenant = await getTenantBySubdomain(env.APP_DB, subdomain)
    if (!tenant) {
      return new Response(baseHtml('School Not Found', `
        <div style="min-height:100vh;background:#f5deb3;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;">
          <div>
            <h1 style="color:#800000;font-size:32px;margin-bottom:16px;">School Not Found</h1>
            <p style="color:#191970;font-size:16px;margin-bottom:24px;">No school is registered at <strong>${escHtml(subdomain)}.ndovera.com</strong>.</p>
            <a href="https://ndovera.com" style="background:#800000;color:#f5deb3;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">← Back to Ndovera</a>
          </div>
        </div>`), { headers: { 'Content-Type': 'text/html' } })
    }

    await env.APP_DB.prepare(INIT_BRANDING).run()
    await ensureWebsiteSectionsTable(env.APP_DB)
    await env.APP_DB.prepare(INIT_SCHOOL_EVENTS).run()

    const [brandingRow, sectionsResult, eventsResult] = await Promise.all([
      env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as Promise<any>,
      env.APP_DB.prepare(`SELECT * FROM website_sections WHERE tenant_id = ? ORDER BY section_key`).bind(tenant.id).all(),
      env.APP_DB.prepare(`SELECT * FROM school_events WHERE tenant_id = ? ORDER BY event_date DESC LIMIT 10`).bind(tenant.id).all(),
    ])

    const branding = { logoUrl: (brandingRow as any)?.logo_url || null, tagline: (brandingRow as any)?.tagline || null, website: (brandingRow as any)?.website || (tenant.websiteDomain ? `https://${tenant.websiteDomain}` : null) }
    const sections = sectionsResult.results || []
    const events = (eventsResult.results || []).map((e: any) => ({ ...e, mediaUrls: JSON.parse(e.media_urls || '[]') }))

    const path = url.pathname.replace(/\/$/, '') || '/'
    let html: string
    if (path === '/login') html = renderLoginPage(tenant, branding)
    else if (path === '/about') html = renderContentPage(tenant, branding, sections, 'about', 'About Us', 'Learn about our mission, values, leadership, and the culture that shapes our learners.')
    else if (path === '/academics') html = renderContentPage(tenant, branding, sections, 'academics', 'Academics', 'Explore our academic programmes, learning pathways, and student support structure.')
    else if (path === '/admissions') html = renderAdmissionsPage(tenant, branding, sections)
    else if (path === '/gallery') html = renderGalleryPage(tenant, branding, sections)
    else if (path === '/events') html = renderEventsPage(tenant, branding, events)
    else if (path === '/contact') html = renderContactPage(tenant, branding, sections)
    else html = renderSchoolHome(tenant, branding, sections, events)

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
  } catch (err) {
    return new Response(`<html><body><p>Error loading school page.</p></body></html>`, { status: 500, headers: { 'Content-Type': 'text/html' } })
  }
}

// ─── Question Bank Endpoints ────────────────────────────────────────────────

app.get('/api/question-bank', authenticate, async (c) => {
  const user = c.get('user') as any
  const db = c.env.DB
  const { subject, classLevel, type, limit = '200', offset = '0' } = c.req.query() as any
  let sql = 'SELECT * FROM question_bank WHERE 1=1'
  const params: any[] = []
  if (subject) { sql += ' AND subject = ?'; params.push(subject) }
  if (classLevel) { sql += ' AND classLevel = ?'; params.push(classLevel) }
  if (type) { sql += ' AND type = ?'; params.push(type) }
  sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?'
  params.push(Number(limit), Number(offset))
  const rows = await db.prepare(sql).bind(...params).all()
  const questions = (rows.results || []).map((q: any) => ({
    ...q,
    options: q.options ? (() => { try { return JSON.parse(q.options) } catch { return q.options } })() : null,
  }))
  return c.json({ questions })
})

app.post('/api/question-bank', authenticate, async (c) => {
  const user = c.get('user') as any
  if (String(user.role || '').toLowerCase() !== 'ami') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const db = c.env.DB
  const body = await c.req.json() as any
  const { subject, classLevel, type, prompt, options, answer, explanation, imageUrl } = body
  if (!subject || !type || !prompt) return c.json({ error: 'subject, type, and prompt are required' }, 400)
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  await db.prepare(
    `INSERT INTO question_bank (id, subject, classLevel, type, prompt, options, answer, explanation, imageUrl, createdAt, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, subject, classLevel || null, type, prompt, options ? JSON.stringify(options) : null, answer || null, explanation || null, imageUrl || null, createdAt, user.id || user.email || null).run()
  return c.json({ success: true, id })
})

app.delete('/api/question-bank/:id', authenticate, async (c) => {
  const user = c.get('user') as any
  if (String(user.role || '').toLowerCase() !== 'ami') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const db = c.env.DB
  const id = c.req.param('id')
  const existing = await db.prepare('SELECT id FROM question_bank WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await db.prepare('DELETE FROM question_bank WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const hostname = url.hostname
    const baseDomain = env.TENANT_BASE_DOMAIN || DEFAULT_TENANT_BASE_DOMAIN

    if (
      hostname !== baseDomain &&
      hostname !== `www.${baseDomain}` &&
      hostname.endsWith(`.${baseDomain}`)
    ) {
      const subdomain = hostname.slice(0, hostname.length - baseDomain.length - 1)
      if (subdomain && subdomain !== 'www') {
        return handleSubdomainRequest(request, env, subdomain, url)
      }
    }

    return app.fetch(request, env, ctx)
  }
}
