import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { confirmInvoicePayment, getPublicInvoice, startInvoiceCheckout } from '../services/tenantApi';

// Ndovera's letterhead, as on the emailed invoice and receipt.
const LETTERHEAD = { email: 'support@ndovera.com', phone: '+234 812 888 2800', website: 'ndovera.com' };
const LOGO = `${process.env.PUBLIC_URL || ''}/apple-touch-icon.png`;

const naira = cents => `₦${(Math.round(Number(cents || 0)) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = value => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function threeDigits(n) {
  let s = '';
  if (n >= 100) { s += `${ONES[Math.floor(n / 100)]} Hundred `; n %= 100; }
  if (n >= 20) { s += `${TENS[Math.floor(n / 10)]} `; n %= 10; }
  if (n > 0) s += `${ONES[n]} `;
  return s.trim();
}
function amountInWords(cents) {
  let n = Math.floor(Number(cents || 0) / 100);
  if (n === 0) return 'Zero Naira Only';
  const parts = [];
  for (const [name, factor] of [['Billion', 1e9], ['Million', 1e6], ['Thousand', 1e3]]) {
    if (n >= factor) { parts.push(`${threeDigits(Math.floor(n / factor))} ${name}`); n %= factor; }
  }
  if (n > 0) parts.push(threeDigits(n));
  return `${parts.join(' ').replace(/\s+/g, ' ').trim()} Naira Only`;
}

/** The invoice (or, once paid, the receipt) on Ndovera's letterhead. */
export function NdoveraBillDocument({ invoice }) {
  const paid = invoice.status === 'paid';
  const meta = paid
    ? [['Receipt No.', invoice.receiptNo || '—'], ['Invoice No.', invoice.invoiceNo], ['Date paid', day(invoice.paidAt)], ['Reference', invoice.paidReference || '—']]
    : [['Invoice No.', invoice.invoiceNo], ['Date issued', day(invoice.sentAt || invoice.createdAt)], ['Pay by', day(invoice.dueAt)], ['Period', [invoice.term, invoice.session].filter(Boolean).join(', ') || '—']];
  return (
    <div id="ndovera-bill" className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-white text-[#191970] shadow-[0_18px_44px_rgba(25,25,112,0.18)]">
      <div className="h-2 bg-gradient-to-r from-[#800000] via-[#c9a96e] via-60% to-[#1a5c38]" />
      <div className="flex items-center gap-4 bg-[#191970] px-5 py-5">
        <img src={LOGO} alt="Ndovera logo" className="h-16 w-16 rounded-2xl bg-white p-1 sm:h-20 sm:w-20" />
        <div className="min-w-0">
          <p className="text-2xl font-black tracking-[0.18em] text-[#c9a96e] sm:text-3xl">NDOVERA</p>
          <p className="text-xs text-[#b5e3f4]">School management, learning and growth</p>
          <p className="mt-1 text-xs text-white">✉ {LETTERHEAD.email} · ☎ {LETTERHEAD.phone} · {LETTERHEAD.website}</p>
        </div>
      </div>
      <div className={`py-2 text-center text-sm font-black tracking-[0.3em] text-white ${paid ? 'bg-[#1a5c38]' : 'bg-[#800020]'}`}>
        {paid ? 'OFFICIAL PAYMENT RECEIPT' : 'INVOICE'}
      </div>
      <div className="relative space-y-4 p-5">
        <div className={`absolute right-5 top-4 -rotate-12 rounded-xl border-[3px] px-4 py-1 text-lg font-black tracking-[0.3em] ${paid ? 'border-[#1a5c38] text-[#1a5c38]' : 'border-[#800020] text-[#800020]'}`}>
          {paid ? 'PAID' : 'DUE'}
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b08d2d]">{paid ? 'Received with thanks from' : 'Billed to'}</p>
          <h1 className="mt-1 pr-24 text-xl font-black text-[#800000] sm:text-2xl">{invoice.schoolName}</h1>
          {invoice.schoolAddress ? <p className="text-xs text-slate-600">{invoice.schoolAddress}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#fff8ef] p-3 sm:grid-cols-4">
          {meta.map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#800020]">{label}</p>
              <p className="break-words text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#c9a96e]">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr className="bg-[#800000] text-left text-[11px] uppercase tracking-[0.12em] text-white">
              <th className="p-3">Description</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th>
            </tr></thead>
            <tbody>
              {(invoice.lines || []).map((line, index) => (
                <tr key={`${line.label}-${index}`} className={index % 2 ? 'bg-white' : 'bg-[#f3fafd]'}>
                  <td className="border-b border-[#e6dcc6] p-3"><p className="font-bold">{line.label}</p>{line.detail ? <p className="text-xs text-slate-600">{line.detail}</p> : null}</td>
                  <td className="border-b border-[#e6dcc6] p-3 text-center">{line.quantity || 1}</td>
                  <td className="border-b border-[#e6dcc6] p-3 text-right">{naira(line.unitCents ?? line.amountCents)}</td>
                  <td className="border-b border-[#e6dcc6] p-3 text-right font-black">{naira(line.amountCents)}</td>
                </tr>
              ))}
              <tr className="bg-[#191970]">
                <td colSpan={3} className="p-3 font-black tracking-[0.12em] text-[#c9a96e]">{paid ? 'TOTAL PAID' : 'TOTAL DUE'}</td>
                <td className="p-3 text-right text-lg font-black text-white">{naira(invoice.amountCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-l-4 border-[#c9a96e] bg-[#f3fafd] px-3 py-2 text-xs italic">Amount in words: <b>{amountInWords(invoice.amountCents)}</b></p>
      </div>
      <div className="border-t-2 border-[#c9a96e] bg-[#fff8ef] px-5 py-3 text-center text-[11px] text-slate-600">
        Questions? Email {LETTERHEAD.email} or call {LETTERHEAD.phone}. · NDOVERA · {LETTERHEAD.website}
      </div>
      <div className="h-2 bg-gradient-to-r from-[#1a5c38] via-[#191970] to-[#800000]" />
    </div>
  );
}

/** /invoice/:token — the school opens its invoice, pays through Flutterwave, and gets its receipt. */
export default function InvoicePayPage() {
  const { token } = useParams();
  const location = useLocation();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(location.search);
    const txRef = params.get('payment_ref') || params.get('tx_ref') || '';
    (async () => {
      try {
        if (txRef) {
          setNotice('Confirming your payment with Flutterwave…');
          const result = await confirmInvoicePayment(token, txRef).catch(err => ({ success: false, message: err.message }));
          if (!cancelled && result?.invoice) setInvoice(result.invoice);
          if (!cancelled) setNotice(result?.paid ? 'Payment confirmed. Your receipt has been emailed to you.' : (result?.message || 'The payment has not been confirmed. If you were charged, it will be confirmed automatically shortly.'));
          if (result?.invoice) return;
        }
        const data = await getPublicInvoice(token);
        if (!cancelled) setInvoice(data.invoice);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Invoice not found.');
      }
    })();
    return () => { cancelled = true; };
  }, [token, location.search]);

  async function pay() {
    setBusy(true); setError('');
    try {
      const result = await startInvoiceCheckout(token);
      window.location.assign(result.link);
    } catch (err) {
      setError(err.message || 'Online payment could not be started.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#b5e3f4] via-[#fff8ef] to-[#b5e3f4] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {error && !invoice ? <p role="alert" className="rounded-2xl bg-white p-6 text-center font-semibold text-[#800000]">{error}</p> : null}
        {!invoice && !error ? <p className="rounded-2xl bg-white p-6 text-center text-[#191970]">Loading invoice…</p> : null}
        {notice ? <p role="status" className={`rounded-2xl px-4 py-3 text-sm font-semibold ${invoice?.status === 'paid' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{notice}</p> : null}
        {invoice ? <NdoveraBillDocument invoice={invoice} /> : null}
        {invoice && invoice.status !== 'paid' ? (
          <div className="rounded-3xl bg-white p-5 text-center shadow">
            <button type="button" onClick={pay} disabled={busy} className="rounded-full bg-[#1a5c38] px-8 py-3 text-lg font-black text-white shadow-lg transition-transform hover:-translate-y-0.5 disabled:opacity-60">
              {busy ? 'Opening Flutterwave…' : `Pay ${naira(invoice.amountCents)} now`}
            </button>
            <p className="mt-2 text-xs text-slate-600">Card, bank transfer or USSD, through Flutterwave. Your receipt is emailed as soon as Flutterwave confirms the payment.</p>
            <p className="mt-3 rounded-2xl bg-[#fdecee] px-4 py-2 text-sm text-[#800000]">
              Please pay by <b>{day(invoice.dueAt)}</b>. After that, the Owner, Head of School and ICT accounts are locked until it is paid. Teachers, students, parents and your website are not affected.
            </p>
            {error ? <p role="alert" className="mt-2 text-sm font-semibold text-[#800000]">{error}</p> : null}
          </div>
        ) : null}
        {invoice ? (
          <div className="text-center">
            <button type="button" onClick={() => window.print()} className="rounded-full bg-[#191970] px-5 py-2 text-sm font-bold text-[#c9a96e]">Print or save as PDF</button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
