// Fee reminders a school sends by hand (Fees → Student Accounts → Remind).
//
// Polite words, the school's own name and its bank account, never Ndovera's. Email is
// sent by Ndovera; WhatsApp opens on the sender's own phone with the message typed in
// (wa.me), so it costs nothing and needs no WhatsApp Business set-up.

export type ReminderFacts = {
  schoolName: string
  parentName: string
  studentName: string
  className: string
  termLabel: string
  totalPayable: number
  paid: number
  balance: number
  bank: { bankName: string, accountName: string, accountNumber: string, paymentInstructions?: string, paymentReferenceHint?: string }
  senderTitle?: string
}

const naira = (value: number) => `₦${(Math.round((Number(value) || 0) * 100) / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`

/** The reminder in plain text: the same words go by email and by WhatsApp. */
export function feeReminderText(facts: ReminderFacts) {
  const greeting = facts.parentName ? `Dear ${facts.parentName},` : 'Dear Parent/Guardian,'
  const child = `${facts.studentName}${facts.className ? ` (${facts.className})` : ''}`
  const lines = [
    greeting,
    '',
    `We hope this message finds you and your family well.`,
    '',
    `This is a gentle reminder that ${child}'s school fees${facts.termLabel ? ` for ${facts.termLabel}` : ''} have an outstanding balance of ${naira(facts.balance)}${facts.paid > 0 ? ` (amount payable ${naira(facts.totalPayable)}; paid so far ${naira(facts.paid)} — thank you)` : ''}.`,
    '',
    `We would be grateful if you could kindly make the payment at your earliest convenience.`,
  ]
  const bank = facts.bank
  if (bank.bankName || bank.accountNumber) {
    lines.push('', 'School account details:')
    if (bank.bankName) lines.push(`Bank: ${bank.bankName}`)
    if (bank.accountName) lines.push(`Account name: ${bank.accountName}`)
    if (bank.accountNumber) lines.push(`Account number: ${bank.accountNumber}`)
    if (bank.paymentReferenceHint) lines.push(`Reference: ${bank.paymentReferenceHint}`)
    if (bank.paymentInstructions) lines.push(bank.paymentInstructions)
  }
  lines.push(
    '',
    `If you have already made this payment, please accept our sincere thanks and kindly share the payment receipt with us so that we can update the record.`,
    '',
    `Please do not hesitate to contact the school if you have any questions.`,
    '',
    `Thank you for your continued support.`,
    '',
    'Warm regards,',
    facts.senderTitle || 'The Accounts Office',
    facts.schoolName,
  )
  return lines.join('\n').trim()
}

export function feeReminderSubject(facts: Pick<ReminderFacts, 'schoolName' | 'studentName' | 'termLabel'>) {
  return `${facts.schoolName ? `${facts.schoolName}: ` : ''}Kind reminder — ${facts.studentName}'s school fees${facts.termLabel ? ` (${facts.termLabel})` : ''}`
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The school's own email layout: its name at the top, no Ndovera branding. */
export function schoolEmailHtml(schoolName: string, text: string, logoUrl = '') {
  const paragraphs = text.split(/\n{2,}/).map(block => `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')
  const logo = /^https:\/\//.test(logoUrl) ? `<img src="${escapeHtml(logoUrl)}" alt="" width="56" height="56" style="display:block;margin:0 0 10px;border-radius:12px;object-fit:contain;" />` : ''
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#191970;line-height:1.6;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid rgba(201,169,110,0.45);border-radius:24px;">
      ${logo}<p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#800000;">${escapeHtml(schoolName || 'School')}</p>
      ${paragraphs}
    </div>`.trim()
}

/** A wa.me link that opens WhatsApp with the message typed, to one number (or the chooser without one). */
export function whatsappLinkFor(phone: string, text: string) {
  const digits = String(phone || '').replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
