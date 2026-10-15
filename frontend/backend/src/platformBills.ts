// Ndovera's own invoices and receipts to schools (onboarding fee and the per-student term charge).
//
// A bill is prepared by Ami as a draft; nothing reaches the school until Ami presses Send. Sending
// emails the invoice to the school's communication email with a pay link and starts the 30 days;
// after that, only the Owner, HoS and ICT accounts are locked until it is paid. Flutterwave
// confirms the payment (never the browser), and the receipt is emailed at once.

export const NDOVERA_LETTERHEAD = {
  name: 'NDOVERA',
  tagline: 'School management, learning and growth',
  email: 'support@ndovera.com',
  phone: '+234 812 888 2800',
  website: 'ndovera.com',
  logoUrl: 'https://ndovera.com/apple-touch-icon.png',
}

export const INVOICE_PAY_DAYS = 30

export type BillLine = { label: string, detail?: string, quantity?: number, unitCents?: number, amountCents: number }

export type BillView = {
  id: string, invoiceNo: string, receiptNo?: string, schoolName: string, schoolAddress?: string, sentTo?: string,
  session: string, term: string, lines: BillLine[], amountCents: number, status: string,
  createdAt?: string | null, sentAt?: string | null, dueAt?: string | null, paidAt?: string | null, paidReference?: string | null,
}

/** The lines of a school's bill: the onboarding fee (if any) and the term's students × rate. */
export function billLines(input: { onboardingCents: number, students: number, rateCents: number, term?: string, session?: string }): BillLine[] {
  const lines: BillLine[] = []
  if (input.onboardingCents > 0) lines.push({ label: 'Onboarding fee', detail: 'One-time school set-up on Ndovera', amountCents: input.onboardingCents })
  if (input.students > 0 && input.rateCents > 0) {
    const period = [input.term, input.session].filter(Boolean).join(', ')
    lines.push({ label: 'Per-student charge', detail: period ? `${period} — active students` : 'Active students this term', quantity: input.students, unitCents: input.rateCents, amountCents: input.students * input.rateCents })
  }
  return lines
}

export const naira = (cents: number) => `₦${(Math.round(Number(cents || 0)) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
function threeDigits(n: number) {
  let s = ''
  if (n >= 100) { s += `${ONES[Math.floor(n / 100)]} Hundred `; n %= 100 }
  if (n >= 20) { s += `${TENS[Math.floor(n / 10)]} `; n %= 10 }
  if (n > 0) s += `${ONES[n]} `
  return s.trim()
}
export function amountInWords(cents: number) {
  let n = Math.floor(Number(cents || 0) / 100)
  if (n === 0) return 'Zero Naira Only'
  const parts: string[] = []
  for (const [name, factor] of [['Billion', 1e9], ['Million', 1e6], ['Thousand', 1e3]] as Array<[string, number]>) {
    if (n >= factor) { parts.push(`${threeDigits(Math.floor(n / factor))} ${name}`); n %= factor }
  }
  if (n > 0) parts.push(threeDigits(n))
  return `${parts.join(' ').replace(/\s+/g, ' ').trim()} Naira Only`
}

const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const day = (value?: string | null) => {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
}

// Ndovera colours: maroon, burgundy, midnight blue, gold, sky and forest green.
const C = { maroon: '#800000', burgundy: '#800020', midnight: '#191970', gold: '#c9a96e', goldDeep: '#b08d2d', sky: '#b5e3f4', cream: '#fff8ef', green: '#1a5c38' }

/** The shared letterhead, document band, lines table and totals of an invoice or receipt email. */
function documentHtml(bill: BillView, kind: 'invoice' | 'receipt', extra: { payUrl?: string } = {}) {
  const L = NDOVERA_LETTERHEAD
  const isReceipt = kind === 'receipt'
  const rows = bill.lines.map((line, index) => `
    <tr style="background:${index % 2 ? '#ffffff' : '#f3fafd'};">
      <td style="padding:12px 14px;border-bottom:1px solid #e6dcc6;">
        <div style="font-weight:700;color:${C.midnight};">${esc(line.label)}</div>
        ${line.detail ? `<div style="font-size:12px;color:#5a5a7a;margin-top:2px;">${esc(line.detail)}</div>` : ''}
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #e6dcc6;text-align:center;color:${C.midnight};">${line.quantity ? esc(line.quantity) : '1'}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e6dcc6;text-align:right;color:${C.midnight};">${esc(naira(line.unitCents ?? line.amountCents))}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e6dcc6;text-align:right;font-weight:800;color:${C.midnight};">${esc(naira(line.amountCents))}</td>
    </tr>`).join('')
  const meta = isReceipt
    ? [['Receipt No.', bill.receiptNo || '—'], ['Invoice No.', bill.invoiceNo], ['Date paid', day(bill.paidAt)], ['Reference', bill.paidReference || '—']]
    : [['Invoice No.', bill.invoiceNo], ['Date issued', day(bill.sentAt || bill.createdAt)], ['Pay by', day(bill.dueAt)], ['Period', [bill.term, bill.session].filter(Boolean).join(', ') || '—']]
  const stamp = isReceipt
    ? `<div style="display:inline-block;border:3px solid ${C.green};color:${C.green};border-radius:10px;padding:6px 16px;font-weight:900;letter-spacing:0.3em;transform:rotate(-8deg);">PAID</div>`
    : `<div style="display:inline-block;border:3px solid ${C.burgundy};color:${C.burgundy};border-radius:10px;padding:6px 16px;font-weight:900;letter-spacing:0.25em;transform:rotate(-8deg);">DUE</div>`

  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:${C.sky};padding:24px 12px;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:2px solid ${C.gold};box-shadow:0 18px 44px rgba(25,25,112,0.18);">
      <div style="height:8px;background:linear-gradient(90deg,${C.maroon},${C.gold},${C.midnight},${C.green});background-color:${C.gold};"></div>
      <table role="presentation" width="100%" style="border-collapse:collapse;background:${C.midnight};">
        <tr>
          <td style="padding:20px 22px;width:84px;vertical-align:middle;">
            <img src="${esc(L.logoUrl)}" alt="Ndovera logo" width="72" height="72" style="display:block;border-radius:16px;background:#ffffff;padding:4px;" />
          </td>
          <td style="padding:20px 22px 20px 0;vertical-align:middle;">
            <div style="font-size:26px;font-weight:900;letter-spacing:0.18em;color:${C.gold};">${esc(L.name)}</div>
            <div style="font-size:12px;color:${C.sky};margin-top:2px;">${esc(L.tagline)}</div>
            <div style="font-size:12px;color:#ffffff;margin-top:8px;">✉ ${esc(L.email)} &nbsp;•&nbsp; ☎ ${esc(L.phone)} &nbsp;•&nbsp; ${esc(L.website)}</div>
          </td>
        </tr>
      </table>
      <div style="background:${isReceipt ? C.green : C.burgundy};color:#ffffff;text-align:center;padding:10px;font-weight:800;letter-spacing:0.3em;font-size:13px;">
        ${isReceipt ? 'OFFICIAL PAYMENT RECEIPT' : 'INVOICE'}
      </div>
      <div style="padding:22px;">
        <table role="presentation" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;color:${C.goldDeep};text-transform:uppercase;">${isReceipt ? 'Received with thanks from' : 'Billed to'}</div>
              <div style="font-size:20px;font-weight:900;color:${C.maroon};margin-top:4px;">${esc(bill.schoolName)}</div>
              ${bill.schoolAddress ? `<div style="font-size:12px;color:#5a5a7a;">${esc(bill.schoolAddress)}</div>` : ''}
              ${bill.sentTo ? `<div style="font-size:12px;color:#5a5a7a;">${esc(bill.sentTo)}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:right;">${stamp}</td>
          </tr>
        </table>
        <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:16px;background:${C.cream};border-radius:14px;">
          <tr>${meta.map(([label, value]) => `
            <td style="padding:10px 12px;vertical-align:top;">
              <div style="font-size:10px;font-weight:800;letter-spacing:0.14em;color:${C.burgundy};text-transform:uppercase;">${esc(label)}</div>
              <div style="font-size:13px;font-weight:700;color:${C.midnight};margin-top:2px;">${esc(value)}</div>
            </td>`).join('')}
          </tr>
        </table>
        <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:18px;border:1px solid ${C.gold};border-radius:14px;overflow:hidden;">
          <tr style="background:${C.maroon};color:#ffffff;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">
            <th style="padding:10px 14px;text-align:left;">Description</th><th style="padding:10px 14px;">Qty</th>
            <th style="padding:10px 14px;text-align:right;">Rate</th><th style="padding:10px 14px;text-align:right;">Amount</th>
          </tr>
          ${rows}
          <tr style="background:${C.midnight};">
            <td colspan="3" style="padding:14px;color:${C.gold};font-weight:900;letter-spacing:0.12em;">${isReceipt ? 'TOTAL PAID' : 'TOTAL DUE'}</td>
            <td style="padding:14px;text-align:right;color:#ffffff;font-size:18px;font-weight:900;">${esc(naira(bill.amountCents))}</td>
          </tr>
        </table>
        <p style="margin:12px 0 0;padding:10px 12px;background:#f3fafd;border-left:4px solid ${C.gold};font-size:12px;font-style:italic;color:${C.midnight};">
          Amount in words: <b>${esc(amountInWords(bill.amountCents))}</b>
        </p>
        ${!isReceipt && extra.payUrl ? `
        <div style="text-align:center;margin:24px 0 8px;">
          <a href="${esc(extra.payUrl)}" style="display:inline-block;background:${C.green};color:#ffffff;text-decoration:none;font-weight:900;padding:14px 30px;border-radius:999px;font-size:16px;letter-spacing:0.04em;">Pay ${esc(naira(bill.amountCents))} now</a>
          <div style="font-size:12px;color:#5a5a7a;margin-top:8px;">Secure payment by card, bank transfer or USSD through Flutterwave.</div>
        </div>
        <p style="font-size:13px;color:${C.maroon};background:#fdecee;border-radius:12px;padding:10px 12px;">
          Please pay by <b>${esc(day(bill.dueAt))}</b>. If it is still unpaid after that date, the Owner, Head of School and ICT accounts will be locked until it is paid.
          Teachers, students and parents are not affected, and your school website stays online.
        </p>` : ''}
        ${isReceipt ? `<p style="font-size:13px;color:${C.green};font-weight:700;">Thank you. Your payment has been confirmed and your school account is in good standing.</p>` : ''}
      </div>
      <div style="background:${C.cream};border-top:2px solid ${C.gold};padding:14px 22px;font-size:11px;color:#5a5a7a;text-align:center;">
        Questions about this ${isReceipt ? 'receipt' : 'invoice'}? Email ${esc(L.email)} or call ${esc(L.phone)}.<br/>
        ${esc(L.name)} · ${esc(L.website)}
      </div>
      <div style="height:8px;background:linear-gradient(90deg,${C.green},${C.midnight},${C.gold},${C.maroon});background-color:${C.maroon};"></div>
    </div>
  </div>`
}

export function invoiceEmail(bill: BillView, payUrl: string) {
  return {
    subject: `Ndovera invoice ${bill.invoiceNo} for ${bill.schoolName}: ${naira(bill.amountCents)} due by ${day(bill.dueAt)}`,
    html: documentHtml(bill, 'invoice', { payUrl }),
  }
}

export function receiptEmail(bill: BillView) {
  return {
    subject: `Ndovera receipt ${bill.receiptNo || ''} — ${naira(bill.amountCents)} received from ${bill.schoolName}`.replace(/\s+/g, ' '),
    html: documentHtml(bill, 'receipt'),
  }
}

/** Short, readable numbers: NDV-INV-202610-7K3Q / NDV-RCT-202610-7K3Q. */
export function documentNumber(kind: 'INV' | 'RCT', when = new Date()) {
  const month = `${when.getUTCFullYear()}${String(when.getUTCMonth() + 1).padStart(2, '0')}`
  const tail = Array.from(crypto.getRandomValues(new Uint8Array(4)), byte => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join('')
  return `NDV-${kind}-${month}-${tail}`
}

/**
 * Whether a Flutterwave transaction settles this bill: successful, in naira, for at least the
 * amount, and with a reference made for this bill.
 */
export function paymentSettlesBill(bill: { id: string, amountCents: number }, tx: { status: string, currency: string, amount: number, txRef: string }) {
  if (String(tx.status).toLowerCase() !== 'successful') return false
  if (String(tx.currency).toUpperCase() !== 'NGN') return false
  if (Math.round(Number(tx.amount || 0) * 100) < bill.amountCents) return false
  return tx.txRef.startsWith(`nbill_${bill.id}_`)
}
