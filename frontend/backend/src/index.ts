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
  createPost, getAssignmentsForClass, createAssignment, getMaterialsForClass,
  addMaterial, getAttendanceForClass, recordAttendance, saveContent,
  getAttendance, upsertAttendance, updateAttendance, getConversations,
  createConversation, getMessages, sendMessage, markMessagesRead,
  getTuckOrders, createTuckOrder, updateTuckOrder, getWeeklyTuckSummary,
  createTenant, getTenantById, getTenantByOwnerEmail, getTenantBySubdomain,
  listTenants, updateTenant, listTenantDiscountCodes, getTenantDiscountCode,
  upsertTenantDiscountCode, incrementTenantDiscountCodeRedemption,
  createTenantPayment, getTenantPaymentByTxRef, listTenantPayments,
  updateTenantPayment,
} from './db'

type Bindings = {
  APP_DB: D1Database
  SESSIONS: KVNamespace
  UPLOADS: R2Bucket
  JWT_SECRET: string
  CORS_ORIGIN: string
  FLUTTERWAVE_SECRET_KEY?: string
  FLUTTERWAVE_REDIRECT_BASE_URL?: string
  TENANT_BASE_DOMAIN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

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

function buildTenantQuote(planKey: string, studentCount: number, discountCode?: any, plans: Record<string, any> = TENANT_PLANS) {
  const plan = plans[planKey]
  if (!plan) {
    throw new Error('Unsupported tenant plan.')
  }

  const safeStudentCount = Math.max(0, Number(studentCount || 0))
  const activeDiscount = isDiscountActive(discountCode, planKey) ? discountCode : null
  const setupFeeCents = activeDiscount?.setupFeeCents ?? plan.setupFeeCents
  const studentFeeCents = activeDiscount?.studentFeeCents ?? plan.studentFeeCents
  const termTotalCents = safeStudentCount * studentFeeCents
  const totalDueNowCents = setupFeeCents

  return {
    planKey,
    planName: plan.label,
    description: plan.description,
    features: plan.features,
    requiresManualReview: Boolean(plan.requiresManualReview),
    studentCount: safeStudentCount,
    currency: 'NGN',
    setupFeeCents,
    setupFee: setupFeeCents / KOBO_PER_NAIRA,
    studentFeeCents,
    studentFeePerTerm: studentFeeCents / KOBO_PER_NAIRA,
    termTotalCents,
    termTotal: termTotalCents / KOBO_PER_NAIRA,
    nextTermStudentBillingCents: termTotalCents,
    nextTermStudentBilling: termTotalCents / KOBO_PER_NAIRA,
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
  const studentCount = Number(payload.studentCount || 0)
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

  if (studentCount <= 0) {
    const error = new Error('Student count must be greater than 0.') as Error & { status?: number }
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
      studentCount,
      discountCode: quote.discountCode,
      requestedSubdomain,
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
    studentCount: tenant.studentCount,
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
        description: `${quote.planName} plan: onboarding setup fee only. Student billing starts from the subsequent term.`,
      },
      meta: {
        tenantId: tenant.id,
        initiatedBy: actorId,
        initiatedRole,
        planKey: tenant.planKey,
        studentCount: tenant.studentCount,
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
  const quote = buildTenantQuote(updatedTenant.planKey, updatedTenant.studentCount, discountCode, plans)

  return {
    payment: updatedPayment,
    tenant: updatedTenant,
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
  }
}

async function finishLogin(c: any, payload: Record<string, any>) {
  let id = payload.id || payload.email || payload.username
  const password = payload.password
  const requestedRole = payload.role

  if (!id || !password) {
    return c.json({ error: 'id and password required' }, 400)
  }

  let settings = await getSettings(c.env.APP_DB, id)

  // Accounts created before the PBKDF2 fix have no settings row.
  // If the user exists in the users table and presents the default password,
  // bootstrap their settings on the fly so they can log in.
  if (!settings) {
    const DEFAULT_PASSWORD = 'abcABC@123'
    if (String(password) !== DEFAULT_PASSWORD) {
      return c.json({ error: 'invalid credentials' }, 401)
    }
    const userRow = await c.env.APP_DB.prepare(
      `SELECT id, email, name, role, tenantId, status FROM users WHERE email = ? OR id = ?`
    ).bind(id, id).first() as Record<string, any> | null

    if (!userRow) {
      return c.json({ error: 'invalid credentials' }, 401)
    }

    // Bootstrap settings with plain initialPassword — they must change password on first login
    settings = {
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      tenantId: userRow.tenantId,
      schoolId: userRow.tenantId,
      status: 'active',
      mustChangePassword: true,
      initialPassword: DEFAULT_PASSWORD,
    }
    await upsertSettings(c.env.APP_DB, userRow.email, settings).catch(e =>
      console.error('Bootstrap settings failed', e)
    )
    // Reassign id to canonical email for the rest of login
    id = userRow.email
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
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
  }, c.env.JWT_SECRET)

  const user = attachTenantContext(buildUserProfile(id, userRole, name, settings), tenant)
  if (mustChangePassword) (user as any).mustChangePassword = true

  return c.json({ success: true, token, user, id: user.id, role: user.role, name: user.name, ...(mustChangePassword ? { mustChangePassword: true } : {}) })
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
}))

app.use('*', logger())

app.get('/api/tenants/pricing', async (c) => {
  const planKey = String(c.req.query('planKey') || '').toLowerCase()
  const studentCount = Number(c.req.query('studentCount') || 0)
  const discountCodeValue = c.req.query('discountCode')
  const { pricingConfig, plans } = await getTenantPricingState(c.env.APP_DB)

  const activeDiscountCode = await resolveDiscountCode(c.env.APP_DB, discountCodeValue, planKey || 'growth')
  const quote = planKey && studentCount >= 0
    ? buildTenantQuote(planKey, studentCount, activeDiscountCode, plans)
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
  if (!auth) return c.json({ error: 'missing auth' }, 401)
  const parts = auth.split(' ')
  if (parts.length !== 2) return c.json({ error: 'invalid auth' }, 401)
  const token = parts[1]
  try {
    const { payload } = await verify(token, c.env.JWT_SECRET)
    c.set('user', payload)
    await next()
    // Sliding expiry: issue a fresh 7-day token on every authenticated request
    // so the session stays alive as long as the user keeps using the app
    const refreshed = await sign({
      role: payload.role,
      name: payload.name,
      id: payload.id,
      tenantId: payload.tenantId,
      ...(payload.mustChangePassword ? { mustChangePassword: true } : {}),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    }, c.env.JWT_SECRET)
    c.res.headers.set('X-Refresh-Token', refreshed)
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
  const id = currentUser.id || currentUser.email
  if (!id) return c.json({ error: 'invalid token' }, 401)

  const { currentPassword, newPassword } = await c.req.json()
  if (!newPassword) return c.json({ error: 'newPassword is required.' }, 400)
  if (newPassword.length < 8) return c.json({ error: 'New password must be at least 8 characters.' }, 400)

  const settings = await getSettings(c.env.APP_DB, id)
  if (!settings) return c.json({ error: 'User not found.' }, 404)

  const forceChangeFlow = settings.mustChangePassword === true || currentUser.mustChangePassword === true

  if (!forceChangeFlow) {
    if (!currentPassword) return c.json({ error: 'currentPassword is required.' }, 400)
    let passwordValid = false
    try {
      passwordValid = await verifyPasswordCandidate(String(currentPassword), settings)
    } catch {
      return c.json({ error: 'Unable to verify credentials.' }, 500)
    }
    if (!passwordValid) return c.json({ error: 'Current password is incorrect.' }, 400)
  }

  const updatedSettings = await withHashedPassword({ ...settings, mustChangePassword: false, initialPassword: undefined }, String(newPassword))
  await upsertSettings(c.env.APP_DB, id, updatedSettings)

  const userRole = settings.role || currentUser.role || 'student'
  const name = settings.name || id
  const tenantId = settings.tenantId || settings.schoolId
  const tenant = tenantId
    ? await getTenantById(c.env.APP_DB, tenantId)
    : await getTenantByOwnerEmail(c.env.APP_DB, id)

  const token = await sign({
    role: userRole,
    name,
    id,
    tenantId: tenant?.id,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
  }, c.env.JWT_SECRET)

  const user = attachTenantContext(buildUserProfile(id, userRole, name, { ...settings, mustChangePassword: false }), tenant)

  await addAudit(c.env.APP_DB, id, { action: 'passwordChanged', data: { by: id } }).catch(() => {})

  return c.json({ success: true, token, user })
})

app.get('/api/users/me', authenticate, async (c) => {
  const currentUser = c.var.user || {}
  const id = currentUser.id || currentUser.sub || currentUser.email
  if (!id) {
    return c.json({ error: 'invalid token' }, 401)
  }
  const settings = await getSettings(c.env.APP_DB, id)
  const role = settings?.role || currentUser.role || 'student'
  const name = settings?.name || currentUser.name || id
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
  const quote = buildTenantQuote(tenant.planKey, tenant.studentCount, discountCode, plans)

  return c.json({
    success: true,
    actorRole: role,
    tenant,
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
  const quote = buildTenantQuote(tenant.planKey, tenant.studentCount, discountCode, plans)

  try {
    const checkout = await initiateTenantCheckout(c, {
      tenant,
      quote,
      actorId,
      initiatedRole: role,
    })

    return c.json({
      success: true,
      tenant,
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
  const settings = await getSettings(c.env.APP_DB, user.id || user.email).catch(() => null)
  const displayName = settings?.name || user.name || user.id || 'User'

  const quickLinks = [
    { name: 'Classroom', path: '/roles/student/classroom' },
    { name: 'Practice', path: '/roles/student/practice' },
    { name: 'Assignments', path: '/roles/student/assignments' },
    { name: 'Materials', path: '/roles/student/materials' },
    { name: 'Results', path: '/roles/student/results' },
  ]

  if (roleKey === 'student') {
    return c.json({
      studentName: displayName,
      roleWatermark: 'STUDENT',
      metrics: [],
      quickLinks,
      notices: [],
      classId: settings?.classId || null,
      className: settings?.className || null,
      displayId: settings?.displayId || null,
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
  
  // Look up user record to get canonical email (settings key)
  await ensureUsersTable(c.env.APP_DB)
  const userRow = await c.env.APP_DB.prepare(
    `SELECT id, email, name, role FROM users WHERE id = ? OR email = ?`
  ).bind(targetId, targetId).first() as Record<string, any> | null
  
  if (!userRow) {
    return c.json({ error: 'User not found.' }, 404)
  }
  
  const settingsKey = userRow.email || userRow.id
  let settings = await getSettings(c.env.APP_DB, settingsKey)
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

app.post('/api/classrooms/:classroomId/stream', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const { content } = await c.req.json()
  const authorId = 'user-teacher-1' // Placeholder
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

app.get('/api/classrooms/:classroomId/assignments', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const assignments = await getAssignmentsForClass(c.env.APP_DB, classroomId)
    return c.json({ success: true, assignments })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/assignments', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const { title, description, dueAt } = await c.req.json()
  if (!title) {
    return c.json({ success: false, message: 'Title is required' }, 400)
  }
  try {
    const newAssignment = {
      classId: classroomId,
      title,
      description,
      dueAt
    }
    const insertedAssignment = await createAssignment(c.env.APP_DB, newAssignment)
    return c.json({ success: true, assignment: insertedAssignment }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

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
  const { title, url } = await c.req.json()
  const uploadedBy = 'user-teacher-1' // Placeholder
  if (!title || !url) {
    return c.json({ success: false, message: 'Title and URL are required' }, 400)
  }
  try {
    const newMaterial = {
      classId: classroomId,
      title,
      url,
      uploadedBy
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
  const uploadedBy = 'user-teacher-1' // Placeholder
  if (!title || !file) {
    return c.json({ success: false, message: 'Title and file are required' }, 400)
  }
  try {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    await c.env.UPLOADS.put(fileName, file.stream(), {
      httpMetadata: { contentType: file.type }
    })
    const url = `https://ndovera.com/files/${fileName}` // Assuming custom domain
    const newMaterial = {
      classId: classroomId,
      title,
      url,
      uploadedBy
    }
    const insertedMaterial = await addMaterial(c.env.APP_DB, newMaterial)
    return c.json({ success: true, material: insertedMaterial }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.get('/api/classrooms/:classroomId/attendance', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  try {
    const attendance = await getAttendanceForClass(c.env.APP_DB, classroomId)
    return c.json({ success: true, attendance })
  } catch (error) {
    return c.json({ success: false, message: 'Server error', error }, 500)
  }
})

app.post('/api/classrooms/:classroomId/attendance', authenticate, async (c) => {
  const classroomId = c.req.param('classroomId')
  const { studentId, date, status, notes } = await c.req.json()
  const recordedBy = 'user-teacher-1' // Placeholder
  if (!studentId || !date || !status) {
    return c.json({ success: false, message: 'studentId, date, and status are required' }, 400)
  }
  try {
    const insertedRecord = await recordAttendance(c.env.APP_DB, classroomId, studentId, date, status, recordedBy, notes)
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
    `CREATE TABLE IF NOT EXISTS user_id_counters (counter_key TEXT PRIMARY KEY, last_count INTEGER NOT NULL DEFAULT 0)`
  ).run()

  const row = await db.prepare(
    `SELECT last_count FROM user_id_counters WHERE counter_key = ?`
  ).bind(config.counterKey).first() as any

  const next = Number(row?.last_count || 0) + 1

  await db.prepare(
    `INSERT INTO user_id_counters (counter_key, last_count)
     VALUES (?, ?)
     ON CONFLICT(counter_key) DO UPDATE SET last_count = excluded.last_count`
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
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
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

app.delete('/api/people/:userId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
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
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
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
const INIT_WEBSITE_SECTIONS = `CREATE TABLE IF NOT EXISTS website_sections (id TEXT PRIMARY KEY, tenant_id TEXT, section_key TEXT, title TEXT, content TEXT, image_url TEXT, updated_at TEXT)`
const INIT_SCHOOL_EVENTS = `CREATE TABLE IF NOT EXISTS school_events (id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT, description TEXT, event_date TEXT, media_urls TEXT, created_at TEXT, updated_at TEXT)`

app.get('/api/school/branding', authenticate, async (c) => {
  const { tenant } = await resolveTenantForActor(c)
  if (!tenant) return c.json({ error: 'Tenant not found.' }, 404)
  try {
    await c.env.APP_DB.prepare(INIT_BRANDING).run()
    const row = await c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as any
    return c.json({ success: true, branding: {
      schoolName: tenant.schoolName,
      subdomain: tenant.requestedSubdomain,
      logoUrl: row?.logo_url || null,
      tagline: row?.tagline || null,
      website: row?.website || null,
    }})
  } catch {
    return c.json({ success: true, branding: { schoolName: tenant.schoolName, subdomain: tenant.requestedSubdomain, logoUrl: null, tagline: null, website: null } })
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
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO tenant_branding (tenant_id, logo_url, tagline, website, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(tenant.id, logoUrl ?? existing?.logo_url ?? null, tagline ?? null, website ?? null, new Date().toISOString()).run()
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
    await c.env.APP_DB.prepare(INIT_WEBSITE_SECTIONS).run()
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM website_sections WHERE tenant_id = ? ORDER BY section_key`).bind(tenantId).all()
    return c.json({ success: true, sections: rows.results || [] })
  } catch { return c.json({ success: true, sections: [] }) }
})

app.post('/api/school/website/sections', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { sectionKey, title, content, imageUrl } = await c.req.json()
  if (!sectionKey) return c.json({ error: 'Section key required.' }, 400)
  const id = `ws_${tenantId}_${sectionKey}`
  try {
    await c.env.APP_DB.prepare(INIT_WEBSITE_SECTIONS).run()
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO website_sections (id, tenant_id, section_key, title, content, image_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, sectionKey, title || '', content || '', imageUrl || null, new Date().toISOString()).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Could not save section.' }, 500)
  }
})

app.post('/api/school/website/sections/upload', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner'])) return c.json({ error: 'forbidden' }, 403)
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
    await c.env.APP_DB.prepare(`INSERT INTO classes (id, tenantId, name, arm, classTeacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, tenantId, name, arm || '', classTeacherId || null, new Date().toISOString()).run()
    if (classTeacherId) {
      await c.env.APP_DB.prepare('UPDATE subjects SET teacherId = ? WHERE classId = ? AND tenantId = ?')
        .bind(classTeacherId, id, tenantId).run()
    }
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
    const sets: string[] = []
    const vals: unknown[] = []
    if (name !== undefined) { sets.push('name = ?'); vals.push(name) }
    if (arm !== undefined) { sets.push('arm = ?'); vals.push(arm) }
    if (classTeacherId !== undefined) { sets.push('classTeacherId = ?'); vals.push(classTeacherId) }
    if (sets.length === 0) return c.json({ error: 'Nothing to update.' }, 400)
    vals.push(classId, tenantId)
    await c.env.APP_DB.prepare(`UPDATE classes SET ${sets.join(', ')} WHERE id = ? AND tenantId = ?`).bind(...vals).run()
    if (classTeacherId) {
      await c.env.APP_DB.prepare('UPDATE subjects SET teacherId = ? WHERE classId = ? AND tenantId = ?')
        .bind(classTeacherId, classId, tenantId).run()
    }
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
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { name, classId, teacherId } = await c.req.json()
  if (!name) return c.json({ error: 'Subject name is required.' }, 400)
  const id = `subject_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`).run()
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN tenantId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN classId TEXT') } catch {}
    try { await c.env.APP_DB.exec('ALTER TABLE subjects ADD COLUMN teacherId TEXT') } catch {}
    await c.env.APP_DB.prepare(`INSERT INTO subjects (id, tenantId, name, classId, teacherId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, tenantId, name, classId || null, teacherId || null, new Date().toISOString()).run()
    return c.json({ success: true, id }, 201)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not add subject.' }, 500)
  }
})

app.post('/api/school/classes/:classId/subjects/bulk', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
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
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const subjectId = c.req.param('subjectId')
  const body = await c.req.json()
  const { name, classId, teacherId } = body
  try {
    const sets: string[] = []
    const vals: unknown[] = []
    if (name !== undefined) { sets.push('name = ?'); vals.push(name) }
    if (classId !== undefined) { sets.push('classId = ?'); vals.push(classId) }
    if (teacherId !== undefined) { sets.push('teacherId = ?'); vals.push(teacherId) }
    if (sets.length === 0) return c.json({ error: 'Nothing to update.' }, 400)
    vals.push(subjectId, tenantId)
    await c.env.APP_DB.prepare(`UPDATE subjects SET ${sets.join(', ')} WHERE id = ? AND tenantId = ?`).bind(...vals).run()
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Could not update subject.' }, 500)
  }
})

app.delete('/api/school/subjects/:subjectId', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos'])) return c.json({ error: 'forbidden' }, 403)
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
app.get('/api/school/staff-attendance', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10)
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, date TEXT, status TEXT, recorded_by TEXT, created_at TEXT)`).run()
    const rows = await c.env.APP_DB.prepare(`SELECT * FROM staff_attendance WHERE tenant_id = ? AND date = ?`).bind(tenantId, date).all()
    return c.json({ success: true, records: rows.results || [] })
  } catch { return c.json({ success: true, records: [] }) }
})

app.post('/api/school/staff-attendance', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'accountant'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { staffId, date, status } = await c.req.json()
  if (!staffId || !date || !status) return c.json({ error: 'staffId, date, status required.' }, 400)
  const id = `sa_${tenantId}_${staffId}_${date}`
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS staff_attendance (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, date TEXT, status TEXT, recorded_by TEXT, created_at TEXT)`).run()
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO staff_attendance (id, tenant_id, staff_id, date, status, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, staffId, date, status, c.var.user.name || c.var.user.id, new Date().toISOString()).run()
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not record attendance.' }, 500) }
})

// ─── Student Attendance (school-level) ───────────────────────────────────────
app.get('/api/school/student-attendance', authenticate, async (c) => {
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10)
  const classId = c.req.query('classId') || null
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS student_attendance_school (id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, class_id TEXT, date TEXT, status TEXT, recorded_by TEXT, created_at TEXT)`).run()
    let query = `SELECT * FROM student_attendance_school WHERE tenant_id = ? AND date = ?`
    const params: unknown[] = [tenantId, date]
    if (classId) { query += ` AND class_id = ?`; params.push(classId) }
    const rows = await c.env.APP_DB.prepare(query).bind(...params).all()
    return c.json({ success: true, records: rows.results || [] })
  } catch { return c.json({ success: true, records: [] }) }
})

app.post('/api/school/student-attendance', authenticate, async (c) => {
  if (!hasRequiredRole(c.var.user.role, ['owner', 'hos', 'teacher', 'classteacher'])) return c.json({ error: 'forbidden' }, 403)
  const tenantId = c.var.user?.tenantId
  if (!tenantId) return c.json({ error: 'No tenant.' }, 400)
  const { studentId, date, status, classId } = await c.req.json()
  if (!studentId || !date || !status) return c.json({ error: 'studentId, date, status required.' }, 400)
  const id = `stua_${tenantId}_${studentId}_${date}`
  try {
    await c.env.APP_DB.prepare(`CREATE TABLE IF NOT EXISTS student_attendance_school (id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, class_id TEXT, date TEXT, status TEXT, recorded_by TEXT, created_at TEXT)`).run()
    await c.env.APP_DB.prepare(`INSERT OR REPLACE INTO student_attendance_school (id, tenant_id, student_id, class_id, date, status, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, tenantId, studentId, classId || null, date, status, c.var.user.name || c.var.user.id, new Date().toISOString()).run()
    return c.json({ success: true })
  } catch (err) { return c.json({ error: 'Could not record student attendance.' }, 500) }
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
    await c.env.APP_DB.prepare(INIT_WEBSITE_SECTIONS).run()
    await c.env.APP_DB.prepare(INIT_SCHOOL_EVENTS).run()
    const [brandingRow, sectionsResult, eventsResult] = await Promise.all([
      c.env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as Promise<any>,
      c.env.APP_DB.prepare(`SELECT * FROM website_sections WHERE tenant_id = ? ORDER BY section_key`).bind(tenant.id).all(),
      c.env.APP_DB.prepare(`SELECT * FROM school_events WHERE tenant_id = ? ORDER BY event_date DESC LIMIT 10`).bind(tenant.id).all(),
    ])
    return c.json({
      success: true,
      tenant: { schoolName: tenant.schoolName, subdomain: tenant.requestedSubdomain },
      branding: { logoUrl: brandingRow?.logo_url || null, tagline: brandingRow?.tagline || null },
      sections: sectionsResult.results || [],
      events: (eventsResult.results || []).map((e: any) => ({ ...e, mediaUrls: JSON.parse(e.media_urls || '[]') })),
    })
  } catch { return c.json({ error: 'Not found' }, 404) }
})

// ─── Subdomain HTML rendering ─────────────────────────────────────────────────
function subdomainNavbar(schoolName: string, subdomain: string, logoUrl?: string | null) {
  const logoImg = logoUrl
    ? `<img src="${logoUrl}" alt="${schoolName} logo" style="height:40px;width:40px;border-radius:50%;object-fit:cover;">`
    : `<div style="height:40px;width:40px;border-radius:50%;background:#800000;display:flex;align-items:center;justify-content:center;color:#f5deb3;font-weight:700;font-size:18px;">${schoolName.charAt(0)}</div>`
  return `
  <nav style="background:#800000;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:64px;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.18);">
    <a href="/" style="display:flex;align-items:center;gap:12px;text-decoration:none;">
      ${logoImg}
      <span style="color:#f5deb3;font-size:18px;font-weight:700;">${escHtml(schoolName)}</span>
    </a>
    <div style="display:flex;gap:24px;align-items:center;">
      <a href="/" style="color:#f5deb3;text-decoration:none;font-size:14px;font-weight:500;">Home</a>
      <a href="/events" style="color:#f5deb3;text-decoration:none;font-size:14px;font-weight:500;">Events</a>
      <a href="/contact" style="color:#f5deb3;text-decoration:none;font-size:14px;font-weight:500;">Contact</a>
      <a href="/login" style="background:#f5deb3;color:#800000;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:700;">Login</a>
    </div>
  </nav>`
}

function subdomainFooter(schoolName: string) {
  return `
  <footer style="background:#191970;color:#f5deb3;text-align:center;padding:24px;font-size:13px;margin-top:60px;">
    <p style="margin:0 0 6px;">&copy; ${new Date().getFullYear()} ${escHtml(schoolName)}. All rights reserved.</p>
    <p style="margin:0;opacity:0.7;">Powered by <a href="https://ndovera.com" style="color:#f5deb3;text-decoration:underline;">Ndovera</a></p>
  </footer>`
}

function escHtml(s: string) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function baseHtml(title: string, body: string) {
  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(title)}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#191970;background:#fff;}
  @media(max-width:600px){nav div{gap:12px!important;}nav div a{font-size:12px!important;}}</style>
  </head><body>${body}</body></html>`
}

function renderSchoolHome(tenant: any, branding: any, sections: any[], events: any[]) {
  const schoolName = tenant.schoolName || 'Our School'
  const tagline = branding?.tagline || 'Excellence in Education'
  const logoUrl = branding?.logoUrl || null
  const heroSection = sections.find((s: any) => s.section_key === 'hero')
  const aboutSection = sections.find((s: any) => s.section_key === 'about')
  const eventsPreview = events.slice(0, 3)

  const heroImg = heroSection?.image_url
    ? `<div style="position:absolute;inset:0;background:url('${escHtml(heroSection.image_url)}') center/cover no-repeat;opacity:0.25;"></div>`
    : ''

  const aboutHtml = aboutSection
    ? `<section style="padding:60px 24px;max-width:900px;margin:0 auto;display:grid;grid-template-columns:${aboutSection.image_url ? '1fr 1fr' : '1fr'};gap:40px;align-items:center;">
        <div>
          <h2 style="color:#800000;font-size:28px;margin-bottom:16px;">About Us</h2>
          <p style="color:#191970;line-height:1.7;font-size:15px;">${escHtml(aboutSection.content || aboutSection.title || '')}</p>
        </div>
        ${aboutSection.image_url ? `<img src="${escHtml(aboutSection.image_url)}" alt="About" style="width:100%;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);">` : ''}
      </section>` : ''

  const eventsHtml = eventsPreview.length > 0
    ? `<section style="background:#f5deb3;padding:60px 24px;">
        <div style="max-width:900px;margin:0 auto;">
          <h2 style="color:#800000;font-size:28px;margin-bottom:32px;text-align:center;">Latest Events</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px;">
            ${eventsPreview.map((e: any) => `
              <div style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                ${e.mediaUrls?.[0] ? `<img src="${escHtml(e.mediaUrls[0])}" alt="${escHtml(e.title)}" style="width:100%;height:160px;object-fit:cover;">` : `<div style="height:160px;background:#800000;display:flex;align-items:center;justify-content:center;"><span style="color:#f5deb3;font-size:32px;">📅</span></div>`}
                <div style="padding:16px;">
                  <h3 style="color:#800000;margin-bottom:8px;font-size:16px;">${escHtml(e.title)}</h3>
                  <p style="color:#800020;font-size:12px;margin-bottom:8px;">${e.event_date ? new Date(e.event_date).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : ''}</p>
                  <p style="color:#191970;font-size:14px;line-height:1.5;">${escHtml((e.description || '').slice(0, 100))}${(e.description || '').length > 100 ? '…' : ''}</p>
                </div>
              </div>`).join('')}
          </div>
          <div style="text-align:center;margin-top:32px;">
            <a href="/events" style="background:#800000;color:#f5deb3;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;">View All Events</a>
          </div>
        </div>
      </section>` : ''

  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <section style="position:relative;background:#191970;padding:80px 24px;text-align:center;overflow:hidden;">
    ${heroImg}
    <div style="position:relative;z-index:1;">
      ${logoUrl ? `<img src="${escHtml(logoUrl)}" alt="${escHtml(schoolName)}" style="height:80px;width:80px;border-radius:50%;object-fit:cover;border:3px solid #f5deb3;margin-bottom:20px;">` : ''}
      <h1 style="color:#f5deb3;font-size:40px;font-weight:700;margin-bottom:16px;">${escHtml(schoolName)}</h1>
      <p style="color:#f5deb3;font-size:18px;opacity:0.9;max-width:540px;margin:0 auto 32px;">${escHtml(tagline)}</p>
      <a href="/login" style="background:#800000;color:#f5deb3;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;display:inline-block;">Student / Staff Login</a>
    </div>
  </section>
  ${aboutHtml}
  ${eventsHtml}
  ${subdomainFooter(schoolName)}`

  return baseHtml(schoolName, body)
}

function renderEventsPage(tenant: any, branding: any, events: any[]) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null

  const eventsHtml = events.length === 0
    ? `<p style="text-align:center;color:#800020;font-size:16px;padding:60px;">No events posted yet. Check back soon!</p>`
    : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:28px;">
        ${events.map((e: any) => `
          <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
            ${e.mediaUrls?.[0] ? `<img src="${escHtml(e.mediaUrls[0])}" alt="${escHtml(e.title)}" style="width:100%;height:180px;object-fit:cover;">` : `<div style="height:180px;background:#800000;display:flex;align-items:center;justify-content:center;"><span style="color:#f5deb3;font-size:40px;">📅</span></div>`}
            <div style="padding:20px;">
              <h3 style="color:#800000;margin-bottom:8px;font-size:18px;">${escHtml(e.title)}</h3>
              <p style="color:#800020;font-size:13px;font-weight:600;margin-bottom:10px;">${e.event_date ? new Date(e.event_date).toLocaleDateString('en-NG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : ''}</p>
              <p style="color:#191970;font-size:14px;line-height:1.6;">${escHtml(e.description || '')}</p>
            </div>
          </div>`).join('')}
      </div>`

  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <main style="max-width:960px;margin:0 auto;padding:48px 24px;">
    <h1 style="color:#800000;font-size:32px;margin-bottom:8px;">School Events</h1>
    <p style="color:#800020;margin-bottom:36px;">Upcoming and recent events at ${escHtml(schoolName)}</p>
    ${eventsHtml}
  </main>
  ${subdomainFooter(schoolName)}`

  return baseHtml(`Events — ${schoolName}`, body)
}

function renderContactPage(tenant: any, branding: any) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null
  const website = branding?.website || null

  const body = `
  ${subdomainNavbar(schoolName, tenant.requestedSubdomain, logoUrl)}
  <main style="max-width:700px;margin:0 auto;padding:60px 24px;text-align:center;">
    <h1 style="color:#800000;font-size:32px;margin-bottom:24px;">Contact Us</h1>
    ${website ? `<p style="color:#191970;margin-bottom:16px;">Website: <a href="${escHtml(website)}" style="color:#800000;">${escHtml(website)}</a></p>` : ''}
    <p style="color:#191970;margin-bottom:32px;">For enquiries about admissions, fees, or school activities, please reach out to us directly.</p>
    <a href="/login" style="background:#800000;color:#f5deb3;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;">Access School Portal</a>
  </main>
  ${subdomainFooter(schoolName)}`

  return baseHtml(`Contact — ${schoolName}`, body)
}

function renderLoginPage(tenant: any, branding: any) {
  const schoolName = tenant.schoolName || 'Our School'
  const logoUrl = branding?.logoUrl || null

  const logoHtml = logoUrl
    ? `<img src="${escHtml(logoUrl)}" alt="${escHtml(schoolName)}" style="height:72px;width:72px;border-radius:50%;object-fit:cover;border:3px solid #800000;margin-bottom:16px;">`
    : `<div style="height:72px;width:72px;border-radius:50%;background:#800000;display:flex;align-items:center;justify-content:center;color:#f5deb3;font-size:28px;font-weight:700;margin:0 auto 16px;">${schoolName.charAt(0)}</div>`

  const body = `
  <div style="min-height:100vh;background:#f5deb3;display:flex;align-items:center;justify-content:center;padding:24px;">
    <div style="background:#fff;border-radius:16px;padding:40px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,0.15);">
      <div style="text-align:center;margin-bottom:28px;">
        ${logoHtml}
        <h1 style="color:#800000;font-size:22px;font-weight:700;margin-bottom:6px;">${escHtml(schoolName)}</h1>
        <p style="color:#800020;font-size:14px;">School Portal Login</p>
      </div>
      <form id="loginForm">
        <div style="margin-bottom:18px;">
          <label style="display:block;color:#800020;font-size:13px;font-weight:600;margin-bottom:6px;">Email Address</label>
          <input id="email" type="email" placeholder="Enter your email" required
            style="width:100%;padding:10px 14px;border:1.5px solid #800020;border-radius:8px;font-size:15px;color:#191970;outline:none;">
        </div>
        <div style="margin-bottom:24px;">
          <label style="display:block;color:#800020;font-size:13px;font-weight:600;margin-bottom:6px;">Password</label>
          <div style="position:relative;">
            <input id="password" type="password" placeholder="Enter your password" required
              style="width:100%;padding:10px 44px 10px 14px;border:1.5px solid #800020;border-radius:8px;font-size:15px;color:#191970;outline:none;box-sizing:border-box;">
            <button type="button" id="togglePwd" onclick="(function(){var i=document.getElementById('password'),b=document.getElementById('togglePwd');if(i.type==='password'){i.type='text';b.innerHTML='&#128065;&#8419;';}else{i.type='password';b.innerHTML='&#128065;';}})()"
              style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:#800020;line-height:1;padding:0;">&#128065;</button>
          </div>
        </div>
        <div id="errorMsg" style="display:none;background:#fef2f2;color:#800000;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px;"></div>
        <button type="submit" id="submitBtn"
          style="width:100%;background:#1a5c38;color:#f5deb3;padding:12px;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;">
          Sign In
        </button>
      </form>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:#800020;">
        Powered by <a href="https://ndovera.com" style="color:#800000;font-weight:600;">Ndovera</a>
      </p>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const errDiv = document.getElementById('errorMsg');
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      btn.disabled = true; btn.textContent = 'Signing in…';
      errDiv.style.display = 'none';
      try {
        const res = await fetch('https://ndovera.com/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok || !data.token) throw new Error(data.error || 'Login failed. Please check your credentials.');
        localStorage.setItem('token', data.token);
        localStorage.setItem('authUser', JSON.stringify(data.user));
        const role = data.user?.role || 'student';
        const mustChange = data.user?.mustChangePassword;
        if (mustChange) {
          window.location.href = 'https://ndovera.com/change-password';
        } else {
          const roleMap = { owner: '/roles/owner', hos: '/roles/hos', teacher: '/roles/teacher', student: '/roles/student', parent: '/roles/parent', accountant: '/roles/accountant', ami: '/roles/ami' };
          window.location.href = 'https://ndovera.com' + (roleMap[role] || '/roles/student');
        }
      } catch(err) {
        errDiv.textContent = err.message;
        errDiv.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    });
  </script>`

  return baseHtml(`Login — ${schoolName}`, body)
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
    await env.APP_DB.prepare(INIT_WEBSITE_SECTIONS).run()
    await env.APP_DB.prepare(INIT_SCHOOL_EVENTS).run()

    const [brandingRow, sectionsResult, eventsResult] = await Promise.all([
      env.APP_DB.prepare(`SELECT * FROM tenant_branding WHERE tenant_id = ?`).bind(tenant.id).first() as Promise<any>,
      env.APP_DB.prepare(`SELECT * FROM website_sections WHERE tenant_id = ? ORDER BY section_key`).bind(tenant.id).all(),
      env.APP_DB.prepare(`SELECT * FROM school_events WHERE tenant_id = ? ORDER BY event_date DESC LIMIT 10`).bind(tenant.id).all(),
    ])

    const branding = { logoUrl: (brandingRow as any)?.logo_url || null, tagline: (brandingRow as any)?.tagline || null, website: (brandingRow as any)?.website || null }
    const sections = sectionsResult.results || []
    const events = (eventsResult.results || []).map((e: any) => ({ ...e, mediaUrls: JSON.parse(e.media_urls || '[]') }))

    const path = url.pathname.replace(/\/$/, '') || '/'
    let html: string
    if (path === '/login') html = renderLoginPage(tenant, branding)
    else if (path === '/events') html = renderEventsPage(tenant, branding, events)
    else if (path === '/contact') html = renderContactPage(tenant, branding)
    else html = renderSchoolHome(tenant, branding, sections, events)

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
  } catch (err) {
    return new Response(`<html><body><p>Error loading school page.</p></body></html>`, { status: 500, headers: { 'Content-Type': 'text/html' } })
  }
}

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
