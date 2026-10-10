// Parent notifications (N20) — the providers.
//
//   WhatsApp  Meta WhatsApp Cloud API: approved templates sent from Ndovera's number.
//             Statuses (sent, delivered, read, failed) arrive on a signed webhook.
//   SMS       PayHos (POST /v1/api/sms/send). PayHos returns no message id and documents
//             no delivery reports, so an accepted SMS is "accepted", never "delivered".
//   Email     Zoho Mail (the sender is passed in from index.ts).
//
// Every send ends in one of four outcomes:
//   accepted  the provider took it (WhatsApp: billing follows its status webhook)
//   rejected  the provider refused it before billing (bad number, template, blocked)
//   retry     clearly not processed (rate limited, Meta's servers busy): try again later
//   unknown   no answer, or an answer that does not say (timeout; a PayHos server error):
//             never resent blindly — reconciled from a webhook or by a person

export type SendOutcome = { outcome: 'accepted' | 'rejected' | 'retry' | 'unknown', providerId?: string, error?: string }

export type WhatsAppConfig = { token: string, phoneNumberId: string, apiVersion?: string }
export type PayHosConfig = { apiKey: string, senderId: string, baseUrl?: string }

const TIMEOUT_MS = 15_000

async function timedFetch(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const redact = (text: string) => String(text || '').replace(/\+?\d{7,15}/g, '[number]').slice(0, 300)

// ─── WhatsApp (Meta Cloud API) ──────────────────────────────────────────────

/** Meta error codes that mean "this message cannot go", not "try again". */
const META_PERMANENT = new Set([100, 131008, 131009, 131021, 131026, 131030, 131031, 131045, 131047, 131051, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 133010])

export async function sendWhatsAppTemplate(config: WhatsAppConfig, input: { to: string, template: string, language: string, params: string[] }): Promise<SendOutcome> {
  if (!config.token || !config.phoneNumberId) return { outcome: 'rejected', error: 'WhatsApp is not set up yet.' }
  const url = `https://graph.facebook.com/${config.apiVersion || 'v21.0'}/${encodeURIComponent(config.phoneNumberId)}/messages`
  let response: Response
  try {
    response = await timedFetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.to.replace(/^\+/, ''),
        type: 'template',
        template: { name: input.template, language: { code: input.language || 'en' }, components: [{ type: 'body', parameters: input.params.map(text => ({ type: 'text', text: String(text).slice(0, 1000) })) }] },
      }),
    })
  } catch (error) {
    return { outcome: 'unknown', error: `No answer from WhatsApp (${(error as Error)?.name || 'network'}).` }
  }
  const data = await response.json().catch(() => null) as any
  const id = data?.messages?.[0]?.id
  if (response.ok && id) return { outcome: 'accepted', providerId: String(id) }
  const code = Number(data?.error?.code || 0)
  const message = redact(data?.error?.message || `WhatsApp answered ${response.status}`)
  if (response.status === 429 || code === 130429 || code === 131056 || code === 80007) return { outcome: 'retry', error: message }
  if (response.status >= 500) return { outcome: 'retry', error: message }
  if (META_PERMANENT.has(code) || (response.status >= 400 && response.status < 500)) return { outcome: 'rejected', error: message }
  return { outcome: 'unknown', error: message }
}

/** Meta signs webhook bodies with the app secret: X-Hub-Signature-256: sha256=<hex>. */
export async function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null | undefined) {
  if (!appSecret || !header || !header.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))
  const expected = Array.from(signature).map(byte => byte.toString(16).padStart(2, '0')).join('')
  const given = header.slice('sha256='.length).toLowerCase()
  if (given.length !== expected.length) return false
  let diff = 0
  for (let index = 0; index < expected.length; index += 1) diff |= expected.charCodeAt(index) ^ given.charCodeAt(index)
  return diff === 0
}

export type MetaStatus = { providerId: string, status: 'sent' | 'delivered' | 'read' | 'failed', at: string, error?: string, eventKey: string }

/** The message statuses in a webhook body (other notifications are ignored). */
export function parseMetaStatuses(body: any): MetaStatus[] {
  const out: MetaStatus[] = []
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      for (const item of Array.isArray(change?.value?.statuses) ? change.value.statuses : []) {
        const status = String(item?.status || '')
        if (!['sent', 'delivered', 'read', 'failed'].includes(status) || !item?.id) continue
        const at = item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : new Date().toISOString()
        out.push({ providerId: String(item.id), status: status as MetaStatus['status'], at, error: item.errors?.[0] ? redact(`${item.errors[0].code}: ${item.errors[0].title || item.errors[0].message || ''}`) : undefined, eventKey: `meta:${item.id}:${status}` })
      }
    }
  }
  return out
}

// ─── SMS (PayHos) ───────────────────────────────────────────────────────────

export async function sendPayHosSms(config: PayHosConfig, input: { to: string, text: string }): Promise<SendOutcome> {
  if (!config.apiKey || !config.senderId) return { outcome: 'rejected', error: 'SMS is not set up yet.' }
  let response: Response
  try {
    response = await timedFetch(`${config.baseUrl || 'https://api.payhos.com'}/v1/api/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ recipients: [input.to], message: input.text, senderId: config.senderId }]),
    })
  } catch (error) {
    return { outcome: 'unknown', error: `No answer from PayHos (${(error as Error)?.name || 'network'}).` }
  }
  const data = await response.json().catch(() => null) as any
  if (response.ok && data?.success !== false) return { outcome: 'accepted' }
  const message = redact(Array.isArray(data?.details) ? data.details.join('; ') : data?.message || `PayHos answered ${response.status}`)
  if (response.status === 429) return { outcome: 'retry', error: message }
  // 406: invalid recipient or message; 403: service blocked (a platform problem, not the school's).
  if (response.status === 406 || response.status === 400 || response.status === 403 || response.status === 401) return { outcome: 'rejected', error: message }
  // A PayHos server error may still have sent the SMS: never resend blindly.
  return { outcome: 'unknown', error: message }
}
