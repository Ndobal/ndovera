// Monnify payments integration: reserved (virtual) accounts for tenants, with
// settlement routed to each school's own bank account via a Monnify sub-account
// + income split. Auth, banks, account validation and webhook signature checks.

export interface MonnifyEnv {
  MONNIFY_BASE_URL?: string
  MONNIFY_API_KEY?: string
  MONNIFY_SECRET_KEY?: string
  MONNIFY_CONTRACT_CODE?: string
  MONNIFY_WALLET_ACCOUNT_NUMBER?: string
}

export function monnifyConfigured(env: MonnifyEnv) {
  return Boolean(
    String(env.MONNIFY_API_KEY || '').trim() &&
    String(env.MONNIFY_SECRET_KEY || '').trim() &&
    String(env.MONNIFY_CONTRACT_CODE || '').trim(),
  )
}

function monnifyBaseUrl(env: MonnifyEnv) {
  return String(env.MONNIFY_BASE_URL || 'https://sandbox.monnify.com').trim().replace(/\/$/, '')
}

// Lightweight in-isolate token cache (Monnify tokens last ~1h).
let cachedToken: { value: string; expiresAt: number } | null = null

export async function getMonnifyToken(env: MonnifyEnv): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value
  const credentials = `${String(env.MONNIFY_API_KEY || '').trim()}:${String(env.MONNIFY_SECRET_KEY || '').trim()}`
  const res = await fetch(`${monnifyBaseUrl(env)}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(credentials)}`, 'Content-Type': 'application/json' },
  })
  const data = (await res.json().catch(() => ({}))) as any
  const token = data?.responseBody?.accessToken
  if (!res.ok || !token) throw new Error(data?.responseMessage || 'Monnify authentication failed.')
  const expiresIn = Number(data?.responseBody?.expiresIn || 3000)
  cachedToken = { value: token, expiresAt: Date.now() + expiresIn * 1000 }
  return token
}

async function monnifyRequest(env: MonnifyEnv, path: string, options: { method?: string; body?: any } = {}) {
  const token = await getMonnifyToken(env)
  const res = await fetch(`${monnifyBaseUrl(env)}${path}`, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as any
  if (!res.ok || data?.requestSuccessful === false) {
    throw new Error(data?.responseMessage || `Monnify request failed (${res.status}).`)
  }
  return data?.responseBody
}

export async function listMonnifyBanks(env: MonnifyEnv) {
  const body = await monnifyRequest(env, '/api/v1/banks')
  return (Array.isArray(body) ? body : [])
    .map((bank: any) => ({ name: String(bank.name || ''), code: String(bank.code || '') }))
    .filter((bank: any) => bank.code && bank.name)
}

export async function validateBankAccount(env: MonnifyEnv, accountNumber: string, bankCode: string) {
  const body = await monnifyRequest(
    env,
    `/api/v1/disbursements/account/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`,
  )
  return {
    accountName: String(body?.accountName || ''),
    accountNumber: String(body?.accountNumber || accountNumber),
    bankCode: String(body?.bankCode || bankCode),
  }
}

export async function createMonnifySubAccount(
  env: MonnifyEnv,
  params: { bankCode: string; accountNumber: string; email: string },
) {
  const body = await monnifyRequest(env, '/api/v1/sub-accounts', {
    method: 'POST',
    body: [
      {
        currencyCode: 'NGN',
        bankCode: params.bankCode,
        accountNumber: params.accountNumber,
        email: params.email,
        defaultSplitPercentage: 100,
      },
    ],
  })
  const first = Array.isArray(body) ? body[0] : body
  return {
    subAccountCode: String(first?.subAccountCode || ''),
    accountName: String(first?.accountName || ''),
  }
}

export async function createReservedAccount(
  env: MonnifyEnv,
  params: {
    accountReference: string
    accountName: string
    customerName: string
    customerEmail: string
    bvn?: string
    nin?: string
    subAccountCode?: string
  },
) {
  const requestBody: Record<string, any> = {
    accountReference: params.accountReference,
    accountName: params.accountName,
    currencyCode: 'NGN',
    contractCode: String(env.MONNIFY_CONTRACT_CODE || '').trim(),
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    getAllAvailableBanks: true,
  }
  if (params.bvn) requestBody.bvn = params.bvn
  if (params.nin) requestBody.nin = params.nin
  if (params.subAccountCode) {
    requestBody.incomeSplitConfig = [
      { subAccountCode: params.subAccountCode, feePercentage: 0, splitPercentage: 100, feeBearer: true },
    ]
  }
  const body = await monnifyRequest(env, '/api/v2/bank-transfer/reserved-accounts', { method: 'POST', body: requestBody })
  return {
    accountReference: String(body?.accountReference || params.accountReference),
    reservationReference: String(body?.reservationReference || ''),
    status: String(body?.status || ''),
    accounts: (Array.isArray(body?.accounts) ? body.accounts : []).map((account: any) => ({
      bankName: String(account.bankName || ''),
      bankCode: String(account.bankCode || ''),
      accountNumber: String(account.accountNumber || ''),
    })),
  }
}

// Monnify signs webhooks with SHA-512 HMAC (hex) of the raw body using the secret key.
export async function verifyMonnifySignature(env: MonnifyEnv, rawBody: string, signature: string): Promise<boolean> {
  const secret = String(env.MONNIFY_SECRET_KEY || '').trim()
  if (!secret || !signature) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const hex = Array.from(new Uint8Array(signed)).map(byte => byte.toString(16).padStart(2, '0')).join('')
  return hex === String(signature).trim().toLowerCase()
}
