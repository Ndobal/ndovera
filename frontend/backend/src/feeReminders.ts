import { DEFAULT_TEMPLATES, fillTemplate } from './emailTemplates'

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

/** What the placeholders of a fee reminder are filled with. */
export function reminderFacts(facts: ReminderFacts): Record<string, string> {
  const bank = facts.bank
  const bankLines = bank.bankName || bank.accountNumber ? ['School account details:', bank.bankName ? `Bank: ${bank.bankName}` : '', bank.accountName ? `Account name: ${bank.accountName}` : '', bank.accountNumber ? `Account number: ${bank.accountNumber}` : '', bank.paymentReferenceHint ? `Reference: ${bank.paymentReferenceHint}` : '', bank.paymentInstructions || ''].filter(Boolean) : []
  return {
    schoolName: facts.schoolName, parentName: facts.parentName || 'Parent/Guardian', studentName: facts.studentName, className: facts.className || 'their class', term: facts.termLabel || 'this term',
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), senderTitle: facts.senderTitle || 'The Accounts Office',
    totalPayable: naira(facts.totalPayable), paid: naira(facts.paid), balance: naira(facts.balance), bankDetails: bankLines.join('\n'),
  }
}

/** The reminder in plain text: the same words go by email and by WhatsApp. */
export function feeReminderText(facts: ReminderFacts, template = DEFAULT_TEMPLATES.fee_reminder.body) {
  return fillTemplate(template, reminderFacts(facts))
}

export function feeReminderSubject(facts: ReminderFacts, template = DEFAULT_TEMPLATES.fee_reminder.subject) {
  return fillTemplate(template, reminderFacts(facts))
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The school's own email layout: its name at the top, no Ndovera branding. */
export type LetterSchool = { schoolName: string, logoUrl?: string, tagline?: string, address?: string, email?: string, website?: string }

const httpsUrl = (value: unknown) => {
  const text = String(value || '').trim()
  if (/^https:\/\//i.test(text)) return text
  return text.startsWith('/files/') ? `https://ndovera.com${text}` : ''
}

/** The school's letterhead for an email: its logo, name, motto and how to reach it. */
export function letterheadHtml(school: LetterSchool) {
  const logo = httpsUrl(school.logoUrl)
  const contact = [school.address, school.email, school.website].map(item => String(item || '').trim()).filter(Boolean).map(escapeHtml).join(' &middot; ')
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:3px solid #800000;margin:0 0 20px;padding:0 0 12px;">
        <tr>
          ${logo ? `<td width="72" style="padding:0 14px 12px 0;vertical-align:middle;"><img src="${escapeHtml(logo)}" alt="" width="64" height="64" style="display:block;border-radius:12px;object-fit:contain;" /></td>` : ''}
          <td style="padding:0 0 12px;vertical-align:middle;">
            <p style="margin:0;font-size:20px;font-weight:800;line-height:1.25;color:#800000;">${escapeHtml(school.schoolName || 'School')}</p>
            ${school.tagline ? `<p style="margin:2px 0 0;font-size:13px;font-style:italic;color:#191970;">${escapeHtml(school.tagline)}</p>` : ''}
            ${contact ? `<p style="margin:4px 0 0;font-size:12px;color:#444a63;">${contact}</p>` : ''}
          </td>
        </tr>
      </table>`
}

/** Any school email's frame: letterhead, the message, and the line saying who sent it. */
export function schoolEmailFrame(school: LetterSchool, innerHtml: string) {
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#191970;line-height:1.6;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid rgba(201,169,110,0.45);border-radius:16px;">
      ${letterheadHtml(school)}
      ${innerHtml}
      <p style="margin:20px 0 0;padding:10px 0 0;border-top:1px solid #e3e5ee;font-size:11px;color:#5b6178;">Sent by ${escapeHtml(school.schoolName || 'your school')} through Ndovera.</p>
    </div>`.trim()
}

export function schoolEmailHtml(school: LetterSchool, text: string) {
  const paragraphs = text.split(/\n{2,}/).map(block => `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')
  return schoolEmailFrame(school, paragraphs)
}

/** A wa.me link that opens WhatsApp with the message typed, to one number (or the chooser without one). */
export function whatsappLinkFor(phone: string, text: string) {
  const digits = String(phone || '').replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
