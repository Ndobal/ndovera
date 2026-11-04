import React, { useCallback, useEffect, useRef, useState } from 'react';
import { emailReceiptBatch, getEmailTemplates, getReceiptEmailStatus, resetEmailTemplate, saveEmailTemplate } from './schoolEmailApi';
import { askConfirm } from '../../shared/components/AppDialog';

// The school's emails: one button to email every new receipt, and the words the school sends.

const CARD = 'space-y-3 rounded-3xl border border-[#c9a96e]/40 bg-white p-5 text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-slate-100';
const HEADING = 'text-lg font-black text-[#800000] dark:text-white';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-black text-white disabled:opacity-60';
const SECONDARY = 'rounded-xl border border-[#191970]/40 bg-white px-4 py-2 text-sm font-black text-[#191970] disabled:opacity-60 dark:border-white/30 dark:bg-slate-800 dark:text-white';
const TITLES = { fee_reminder: 'Fee reminder', receipt: 'Payment receipt' };
const SAMPLE = { schoolName: 'Your School', parentName: 'Mrs Obi', studentName: 'Ada Obi', className: 'JSS 1 A', term: 'First Term, 2026/2027', date: '4 November 2026', senderTitle: 'The Accounts Office', totalPayable: '₦150,000', paid: '₦100,000', balance: '₦50,000', bankDetails: 'Bank: First Bank\nAccount name: Your School\nAccount number: 0123456789', receiptNo: 'RCT-2026-0001', amount: '₦100,000', paidToDate: '₦100,000', method: 'bank transfer', reference: 'TRF12345', paidOn: '4 November 2026', verifyLink: 'https://yourschool.ndovera.com/receipt-verification/RCT-2026-0001' };

const fill = text => text.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_, name) => SAMPLE[name] ?? `{{${name}}}`);

/** One press sends every new receipt this term. A request sends only a few, so the page keeps calling until none remain. */
export function ReceiptBulkEmail() {
  const [pending, setPending] = useState(null);
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState('');
  const running = useRef(false);
  const load = useCallback(() => getReceiptEmailStatus().then(result => setPending(result.pending)).catch(error => setMessage(error.message)), []);
  useEffect(() => { load(); }, [load]);

  const start = async () => {
    if (running.current) return;
    if (!await askConfirm(`Email ${pending} new receipt${pending === 1 ? '' : 's'} to parents now? Each receipt is emailed once.`)) return;
    running.current = true;
    setMessage('');
    const total = { sent: 0, noEmail: 0, failed: 0 };
    try {
      for (let round = 0; round < 60; round += 1) {
        // eslint-disable-next-line no-await-in-loop
        const result = await emailReceiptBatch();
        total.sent += result.sent; total.noEmail += result.noEmail; total.failed += result.failed;
        setProgress({ ...total, remaining: result.remaining });
        if (result.stop) { setMessage('Email is not going through right now. Nothing more was sent. Please try again later.'); break; }
        if (!result.remaining || !(result.sent + result.noEmail)) break;
      }
      setMessage(current => current || `Done: ${total.sent} sent${total.noEmail ? `, ${total.noEmail} with no parent email on file` : ''}${total.failed ? `, ${total.failed} could not be sent` : ''}.`);
    } catch (error) { setMessage(error.message); } finally {
      running.current = false;
      setProgress(null);
      load();
    }
  };

  return (
    <section className={CARD} aria-label="Email receipts to parents">
      <h2 className={HEADING}>Email receipts to parents</h2>
      <p className="text-sm">{pending === null ? 'Checking…' : pending ? `${pending} receipt${pending === 1 ? '' : 's'} from this term not yet emailed.` : 'Every receipt this term has been emailed.'}</p>
      {progress ? <p role="status" className="text-sm font-bold">Sending… {progress.sent} sent, {progress.remaining} left. Please keep this page open.</p> : null}
      {message ? <p role="status" className="text-sm font-bold">{message}</p> : null}
      <button type="button" className={PRIMARY} disabled={!pending || Boolean(progress)} onClick={start}>Email all new receipts</button>
    </section>
  );
}

function TemplateEditor({ template, onChanged }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);
  const save = () => saveEmailTemplate(template.kind, { subject, body }).then(() => { setMessage('Saved. This is what parents will receive.'); onChanged(); }).catch(error => setMessage(error.message));
  const reset = () => resetEmailTemplate(template.kind).then(() => { setSubject(template.defaults.subject); setBody(template.defaults.body); setMessage('Back to Ndovera\'s wording.'); onChanged(); }).catch(error => setMessage(error.message));
  return (
    <section className={CARD} aria-label={TITLES[template.kind]}>
      <h3 className={HEADING}>{TITLES[template.kind]}{template.custom ? ' · your wording' : ''}</h3>
      <label className="block text-sm font-bold">Subject<input className={FIELD} value={subject} onChange={event => setSubject(event.target.value)} /></label>
      <label className="block text-sm font-bold">Message<textarea className={FIELD} rows={12} value={body} onChange={event => setBody(event.target.value)} /></label>
      <p className="text-xs">Ndovera fills in: {template.placeholders.map(name => `{{${name}}}`).join(' ')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={PRIMARY} onClick={save}>Save</button>
        <button type="button" className={SECONDARY} aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? 'Hide preview' : 'Preview'}</button>
        {template.custom ? <button type="button" className={SECONDARY} onClick={reset}>Use Ndovera's wording</button> : null}
      </div>
      {message ? <p role="status" className="text-sm font-bold">{message}</p> : null}
      {preview ? <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-900 dark:bg-white/10 dark:text-white"><p className="font-black">{fill(subject)}</p><p className="mt-2 whitespace-pre-wrap">{fill(body)}</p></div> : null}
    </section>
  );
}

export default function SchoolEmailPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => getEmailTemplates().then(setData).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);
  const letter = data?.letterhead;
  return (
    <div className="space-y-4">
      <ReceiptBulkEmail />
      {error ? <p role="alert" className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900">{error}</p> : null}
      {letter ? (
        <section className={CARD} aria-label="Your letterhead">
          <h2 className={HEADING}>Your letterhead on every email</h2>
          <div className="flex items-center gap-3 border-b-4 border-[#800000] pb-3 dark:border-amber-300">
            {letter.logoUrl ? <img src={letter.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain" /> : null}
            <div>
              <p className="text-lg font-black text-[#800000] dark:text-amber-200">{letter.schoolName}</p>
              {letter.tagline ? <p className="text-xs italic">{letter.tagline}</p> : null}
              <p className="text-xs">{[letter.address, letter.email, letter.website].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          {!letter.logoUrl || !letter.address ? <p className="text-sm">Add your {!letter.logoUrl ? 'logo' : ''}{!letter.logoUrl && !letter.address ? ' and ' : ''}{!letter.address ? 'address' : ''} in your school settings to complete it.</p> : null}
        </section>
      ) : null}
      {(data?.templates || []).map(template => <TemplateEditor key={template.kind} template={template} onChanged={load} />)}
    </div>
  );
}
