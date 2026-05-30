import { getSettings, upsertSettings } from './db'

export const AI_GLOBAL_SETTINGS_KEY = 'platform_ai_billing'

export type AiBillingModel = 'individual' | 'school'

export type AiBillingPolicy = {
  billingModel: AiBillingModel
  dailyFreeRequests: number
  pricePerCreditNaira: number
  creditsPerRequest: number
}

type AiWalletRecord = {
  credits: number
  totalPurchasedCredits: number
  updatedAt: string
}

type AiUsageRecord = {
  dailyCounts: Record<string, number>
  updatedAt: string
}

type AiActorAccessArgs = {
  tenantId?: string
  settingsKey: string
  policyOverrides?: Partial<AiBillingPolicy>
}

type ConsumeAiAccessArgs = AiActorAccessArgs & {
  actorId?: string
  actorName?: string
}

export type AiAccessSummary = {
  policy: AiBillingPolicy
  usage: {
    date: string
    usedToday: number
    remainingFreeRequests: number
    dailyFreeRequests: number
  }
  wallet: {
    activeScope: AiBillingModel
    availableCredits: number
    userCredits: number
    schoolCredits: number
  }
}

export const DEFAULT_AI_BILLING_POLICY: AiBillingPolicy = {
  billingModel: 'individual',
  dailyFreeRequests: 50,
  pricePerCreditNaira: 0,
  creditsPerRequest: 1,
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function isRecentDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false

  const daysAgo = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  return daysAgo >= -1 && daysAgo <= 31
}

function clampInteger(value: unknown, fallback: number, min = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.floor(numeric))
}

function clampDecimal(value: unknown, fallback: number, min = 0) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Number(numeric.toFixed(2)))
}

function normalizeBillingModel(value: unknown): AiBillingModel {
  return String(value || '').trim().toLowerCase() === 'school' ? 'school' : 'individual'
}

function normalizePromptMode(value: unknown) {
  const raw = String(value || '').trim()
  return raw || 'Explain Mode'
}

function getUserWalletSettingsKey(settingsKey: string) {
  return `ai_wallet_user_${String(settingsKey || '').trim()}`
}

function getUsageSettingsKey(settingsKey: string) {
  return `ai_usage_${String(settingsKey || '').trim()}`
}

function getSchoolWalletSettingsKey(tenantId: string) {
  return `tenant_ai_wallet_${String(tenantId || '').trim()}`
}

export function getTenantAiBillingSettingsKey(tenantId: string) {
  return `tenant_ai_billing_${String(tenantId || '').trim()}`
}

export function getAiPaymentSettingsKey(txRef: string) {
  return `ai_credit_payment_${String(txRef || '').trim()}`
}

export function normalizeAiBillingPolicy(raw: Record<string, any> | null | undefined, fallback: AiBillingPolicy = DEFAULT_AI_BILLING_POLICY): AiBillingPolicy {
  return {
    billingModel: normalizeBillingModel(raw?.billingModel || fallback.billingModel),
    dailyFreeRequests: clampInteger(raw?.dailyFreeRequests, fallback.dailyFreeRequests, 0),
    pricePerCreditNaira: clampDecimal(raw?.pricePerCreditNaira, fallback.pricePerCreditNaira, 0),
    creditsPerRequest: clampInteger(raw?.creditsPerRequest, fallback.creditsPerRequest, 1),
  }
}

function mapWalletRecord(raw: Record<string, any> | null | undefined): AiWalletRecord {
  return {
    credits: clampInteger(raw?.credits, 0, 0),
    totalPurchasedCredits: clampInteger(raw?.totalPurchasedCredits, 0, 0),
    updatedAt: String(raw?.updatedAt || new Date().toISOString()),
  }
}

function mapUsageRecord(raw: Record<string, any> | null | undefined): AiUsageRecord {
  const source = raw?.dailyCounts && typeof raw.dailyCounts === 'object'
    ? raw.dailyCounts
    : raw && typeof raw === 'object'
      ? raw
      : {}

  const dailyCounts = Object.entries(source).reduce((accumulator, [dateKey, value]) => {
    if (!isRecentDateKey(dateKey)) return accumulator
    accumulator[dateKey] = clampInteger(value, 0, 0)
    return accumulator
  }, {} as Record<string, number>)

  return {
    dailyCounts,
    updatedAt: String(raw?.updatedAt || new Date().toISOString()),
  }
}

async function getUserWallet(db: D1Database, settingsKey: string) {
  const raw = await getSettings(db, getUserWalletSettingsKey(settingsKey)).catch(() => null)
  return mapWalletRecord(raw)
}

async function saveUserWallet(db: D1Database, settingsKey: string, wallet: AiWalletRecord) {
  await upsertSettings(db, getUserWalletSettingsKey(settingsKey), wallet)
  return getUserWallet(db, settingsKey)
}

async function getSchoolWallet(db: D1Database, tenantId: string) {
  if (!tenantId) return mapWalletRecord(null)
  const raw = await getSettings(db, getSchoolWalletSettingsKey(tenantId)).catch(() => null)
  return mapWalletRecord(raw)
}

async function saveSchoolWallet(db: D1Database, tenantId: string, wallet: AiWalletRecord) {
  if (!tenantId) return mapWalletRecord(null)
  await upsertSettings(db, getSchoolWalletSettingsKey(tenantId), wallet)
  return getSchoolWallet(db, tenantId)
}

async function getUsageRecord(db: D1Database, settingsKey: string) {
  const raw = await getSettings(db, getUsageSettingsKey(settingsKey)).catch(() => null)
  return mapUsageRecord(raw)
}

async function saveUsageRecord(db: D1Database, settingsKey: string, usage: AiUsageRecord) {
  await upsertSettings(db, getUsageSettingsKey(settingsKey), usage)
  return getUsageRecord(db, settingsKey)
}

export async function getResolvedAiBillingPolicy(db: D1Database, tenantId = '') {
  const globalPolicy = normalizeAiBillingPolicy(await getSettings(db, AI_GLOBAL_SETTINGS_KEY).catch(() => null))
  const tenantPolicy = tenantId
    ? normalizeAiBillingPolicy(await getSettings(db, getTenantAiBillingSettingsKey(tenantId)).catch(() => null), globalPolicy)
    : globalPolicy

  return {
    globalPolicy,
    tenantPolicy: tenantId ? tenantPolicy : null,
    policy: tenantId ? { ...globalPolicy, ...tenantPolicy } : globalPolicy,
  }
}

export async function summarizeAiAccess(db: D1Database, args: AiActorAccessArgs): Promise<AiAccessSummary> {
  const normalizedSettingsKey = String(args.settingsKey || '').trim()
  const normalizedTenantId = String(args.tenantId || '').trim()
  const { policy } = await getResolvedAiBillingPolicy(db, normalizedTenantId)
  const effectivePolicy = normalizeAiBillingPolicy({ ...policy, ...(args.policyOverrides || {}) }, policy)
  const usage = normalizedSettingsKey ? await getUsageRecord(db, normalizedSettingsKey) : mapUsageRecord(null)
  const userWallet = normalizedSettingsKey ? await getUserWallet(db, normalizedSettingsKey) : mapWalletRecord(null)
  const schoolWallet = normalizedTenantId ? await getSchoolWallet(db, normalizedTenantId) : mapWalletRecord(null)
  const date = todayKey()
  const usedToday = usage.dailyCounts[date] || 0

  return {
    policy: effectivePolicy,
    usage: {
      date,
      usedToday,
      remainingFreeRequests: Math.max(0, effectivePolicy.dailyFreeRequests - usedToday),
      dailyFreeRequests: effectivePolicy.dailyFreeRequests,
    },
    wallet: {
      activeScope: effectivePolicy.billingModel,
      availableCredits: effectivePolicy.billingModel === 'school' ? schoolWallet.credits : userWallet.credits,
      userCredits: userWallet.credits,
      schoolCredits: schoolWallet.credits,
    },
  }
}

export async function consumeAiAccess(db: D1Database, args: ConsumeAiAccessArgs) {
  const normalizedSettingsKey = String(args.settingsKey || '').trim()
  const normalizedTenantId = String(args.tenantId || '').trim()

  if (!normalizedSettingsKey) {
    const access = await summarizeAiAccess(db, { tenantId: normalizedTenantId, settingsKey: normalizedSettingsKey, policyOverrides: args.policyOverrides })
    return {
      allowed: false,
      statusCode: 400,
      reason: 'AI access could not be resolved for this account.',
      source: 'blocked',
      chargedCredits: 0,
      access,
    }
  }

  const access = await summarizeAiAccess(db, { tenantId: normalizedTenantId, settingsKey: normalizedSettingsKey, policyOverrides: args.policyOverrides })
  const date = todayKey()

  if (access.usage.remainingFreeRequests > 0) {
    const usage = await getUsageRecord(db, normalizedSettingsKey)
    usage.dailyCounts[date] = clampInteger((usage.dailyCounts[date] || 0) + 1, 1, 0)
    usage.updatedAt = new Date().toISOString()
    await saveUsageRecord(db, normalizedSettingsKey, usage)

    return {
      allowed: true,
      statusCode: 200,
      reason: '',
      source: 'free',
      chargedCredits: 0,
      access: await summarizeAiAccess(db, { tenantId: normalizedTenantId, settingsKey: normalizedSettingsKey, policyOverrides: args.policyOverrides }),
    }
  }

  if (access.policy.billingModel === 'school') {
    if (!normalizedTenantId) {
      return {
        allowed: false,
        statusCode: 400,
        reason: 'Your school AI billing scope is not configured yet.',
        source: 'blocked',
        chargedCredits: 0,
        access,
      }
    }

    const schoolWallet = await getSchoolWallet(db, normalizedTenantId)
    if (schoolWallet.credits < access.policy.creditsPerRequest) {
      return {
        allowed: false,
        statusCode: 402,
        reason: 'The school AI wallet has no remaining credits. Ask the school to top up the AI balance.',
        source: 'blocked',
        chargedCredits: 0,
        access,
      }
    }

    schoolWallet.credits = Math.max(0, schoolWallet.credits - access.policy.creditsPerRequest)
    schoolWallet.updatedAt = new Date().toISOString()
    await saveSchoolWallet(db, normalizedTenantId, schoolWallet)

    return {
      allowed: true,
      statusCode: 200,
      reason: '',
      source: 'school_credits',
      chargedCredits: access.policy.creditsPerRequest,
      access: await summarizeAiAccess(db, { tenantId: normalizedTenantId, settingsKey: normalizedSettingsKey, policyOverrides: args.policyOverrides }),
    }
  }

  const userWallet = await getUserWallet(db, normalizedSettingsKey)
  if (userWallet.credits < access.policy.creditsPerRequest) {
    return {
      allowed: false,
      statusCode: 402,
      reason: access.policy.pricePerCreditNaira > 0
        ? `Your 50 free AI requests for today are used up. Buy more credits at N${access.policy.pricePerCreditNaira} per credit to continue.`
        : 'Your 50 free AI requests for today are used up and AI credit pricing has not been configured yet.',
      source: 'blocked',
      chargedCredits: 0,
      access,
    }
  }

  userWallet.credits = Math.max(0, userWallet.credits - access.policy.creditsPerRequest)
  userWallet.updatedAt = new Date().toISOString()
  await saveUserWallet(db, normalizedSettingsKey, userWallet)

  return {
    allowed: true,
    statusCode: 200,
    reason: '',
    source: 'individual_credits',
    chargedCredits: access.policy.creditsPerRequest,
    access: await summarizeAiAccess(db, { tenantId: normalizedTenantId, settingsKey: normalizedSettingsKey, policyOverrides: args.policyOverrides }),
  }
}

export async function grantAiCredits(db: D1Database, args: AiActorAccessArgs & { quantity: number, target: AiBillingModel | 'individual' | 'school' }) {
  const normalizedSettingsKey = String(args.settingsKey || '').trim()
  const normalizedTenantId = String(args.tenantId || '').trim()
  const quantity = clampInteger(args.quantity, 0, 1)

  if (!quantity) {
    return summarizeAiAccess(db, { tenantId: normalizedTenantId, settingsKey: normalizedSettingsKey, policyOverrides: args.policyOverrides })
  }

  if (args.target === 'school') {
    const schoolWallet = await getSchoolWallet(db, normalizedTenantId)
    schoolWallet.credits += quantity
    schoolWallet.totalPurchasedCredits += quantity
    schoolWallet.updatedAt = new Date().toISOString()
    await saveSchoolWallet(db, normalizedTenantId, schoolWallet)
    return summarizeAiAccess(db, { tenantId: normalizedTenantId, settingsKey: normalizedSettingsKey, policyOverrides: args.policyOverrides })
  }

  const userWallet = await getUserWallet(db, normalizedSettingsKey)
  userWallet.credits += quantity
  userWallet.totalPurchasedCredits += quantity
  userWallet.updatedAt = new Date().toISOString()
  await saveUserWallet(db, normalizedSettingsKey, userWallet)
  return summarizeAiAccess(db, { tenantId: normalizedTenantId, settingsKey: normalizedSettingsKey, policyOverrides: args.policyOverrides })
}

export function isAcademicOnlyPrompt(prompt: string) {
  const normalized = String(prompt || '').trim().toLowerCase()
  if (!normalized) return false

  const socialTokens = [
    'how are you',
    'what is up',
    "what's up",
    'tell me a joke',
    'gossip',
    'who are you',
    'say something about my life',
    'chat',
    'girlfriend',
    'boyfriend',
  ]

  return !socialTokens.some(token => normalized.includes(token))
}

export function buildAcademicAiResponse(prompt: string, mode: string) {
  const normalizedPrompt = String(prompt || '').trim()
  const normalizedMode = normalizePromptMode(mode)

  return [
    `${normalizedMode}: ${normalizedPrompt}`,
    '',
    'Study path:',
    `1. Identify the exact concept behind "${normalizedPrompt}" from your notes or textbook.`,
    '2. Write the main definition, method, formula, or rule in one short sentence.',
    '3. Work through one clean example step by step without skipping the reason for each step.',
    '4. Test yourself with one short practice question before moving on.',
    '',
    'Next move: explain the topic aloud in your own words, then compare it with your class note to check what you missed.',
  ].join('\n')
}

export type AiPaymentRecord = {
  txRef: string
  target: 'individual' | 'school'
  tenantId: string
  settingsKey: string
  initiatedBy: string
  initiatedRole: string
  userEmail: string
  userName: string
  quantity: number
  amountNaira: number
  currency: string
  status: string
  flutterwaveLink: string
  flutterwaveTxId: string
  providerResponse: Record<string, any> | null
  createdAt: string
  updatedAt: string
  paidAt: string
}

function mapAiPaymentRecord(raw: Record<string, any> | null | undefined, txRef = ''): AiPaymentRecord {
  return {
    txRef: String(raw?.txRef || txRef || '').trim(),
    target: String(raw?.target || '').trim().toLowerCase() === 'school' ? 'school' : 'individual',
    tenantId: String(raw?.tenantId || '').trim(),
    settingsKey: String(raw?.settingsKey || '').trim(),
    initiatedBy: String(raw?.initiatedBy || '').trim(),
    initiatedRole: String(raw?.initiatedRole || '').trim(),
    userEmail: String(raw?.userEmail || '').trim(),
    userName: String(raw?.userName || '').trim(),
    quantity: clampInteger(raw?.quantity, 0, 0),
    amountNaira: clampDecimal(raw?.amountNaira, 0, 0),
    currency: String(raw?.currency || 'NGN').trim() || 'NGN',
    status: String(raw?.status || 'pending').trim().toLowerCase() || 'pending',
    flutterwaveLink: String(raw?.flutterwaveLink || '').trim(),
    flutterwaveTxId: String(raw?.flutterwaveTxId || '').trim(),
    providerResponse: raw?.providerResponse && typeof raw.providerResponse === 'object' ? raw.providerResponse : null,
    createdAt: String(raw?.createdAt || new Date().toISOString()),
    updatedAt: String(raw?.updatedAt || new Date().toISOString()),
    paidAt: String(raw?.paidAt || '').trim(),
  }
}

export async function getAiPaymentRecord(db: D1Database, txRef: string) {
  const key = getAiPaymentSettingsKey(txRef)
  const raw = await getSettings(db, key).catch(() => null)
  return raw ? mapAiPaymentRecord(raw, txRef) : null
}

export async function saveAiPaymentRecord(db: D1Database, txRef: string, payment: Record<string, any>) {
  const key = getAiPaymentSettingsKey(txRef)
  const next = mapAiPaymentRecord({ ...payment, txRef, updatedAt: new Date().toISOString() }, txRef)
  await upsertSettings(db, key, next)
  return getAiPaymentRecord(db, txRef)
}