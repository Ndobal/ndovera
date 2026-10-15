import React, { useCallback, useEffect, useState } from 'react';
import * as api from './communicationsApi';
import { askText } from '../../shared/components/AppDialog';

// Super Admin → Communications: pricing, providers and WhatsApp templates, school wallets,
// free allocation (reviewed before it is given), allocation history and reconciliation.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl bg-white p-4 dark:bg-slate-900';
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970] dark:border-white/15 dark:bg-slate-950 dark:text-slate-100';
const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50 dark:bg-[#00ffff] dark:text-black';
const SECONDARY = 'rounded-2xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-400';

function useNotice() {
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  const run = useCallback(async (work, success = '') => {
    setNotice({ text: '', tone: 'ok' });
    try { const result = await work(); if (success) setNotice({ text: success, tone: 'ok' }); return result; } catch (error) { setNotice({ text: error.message, tone: 'error' }); return null; }
  }, []);
  return [run, notice.text ? <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p> : null];
}

function Pricing({ run }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ channel: 'email', unitPriceKobo: 0, effectiveFrom: '', notice: '' });
  const [config, setConfig] = useState({});
  const load = useCallback(() => api.getPrices().then(result => { setData(result); setConfig({ 'allowance.whatsapp': result.config.termAllowance.whatsapp, 'allowance.sms': result.config.termAllowance.sms, 'minimum.whatsapp': result.config.minimumPurchase.whatsapp, 'minimum.sms': result.config.minimumPurchase.sms }); }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <p className="text-sm">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className={`${INNER} grid grid-cols-1 gap-3 md:grid-cols-3`}>
        {['whatsapp', 'sms', 'email'].map(channel => (
          <div key={channel}>
            <p className={LABEL}>{api.CHANNEL_LABELS[channel]}</p>
            <p className="text-2xl font-black text-[#800000] dark:text-white">{data.prices[channel].current.billingMode === 'FREE' ? 'Free' : api.naira(data.prices[channel].current.unitPriceKobo)}</p>
            <p className="text-xs text-slate-500">Version {data.prices[channel].current.version}</p>
            {data.prices[channel].upcoming.map(item => <p key={item.version} className="text-xs text-amber-700">From {new Date(item.effectiveFrom).toLocaleDateString()}: {item.billingMode === 'FREE' ? 'free' : api.naira(item.unitPriceKobo)}</p>)}
          </div>
        ))}
      </div>
      <div className={`${INNER} space-y-2`}>
        <p className={LABEL}>Schedule a price change</p>
        <p className="text-xs text-[#191970] dark:text-slate-300">Takes effect in the future only. Work already sent or reserved keeps its price; schools are never charged without buying units.</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select className={FIELD} value={form.channel} onChange={event => setForm({ ...form, channel: event.target.value })}>{['whatsapp', 'sms', 'email'].map(channel => <option key={channel} value={channel}>{api.CHANNEL_LABELS[channel]}</option>)}</select>
          <input className={FIELD} type="number" min="0" placeholder="Price in kobo (1520 = ₦15.20)" value={form.unitPriceKobo} onChange={event => setForm({ ...form, unitPriceKobo: Number(event.target.value) })} />
          <input className={FIELD} type="datetime-local" value={form.effectiveFrom} onChange={event => setForm({ ...form, effectiveFrom: event.target.value })} />
          <input className={FIELD} placeholder="Notice to schools" value={form.notice} onChange={event => setForm({ ...form, notice: event.target.value })} />
        </div>
        <button type="button" className={PRIMARY} disabled={!form.effectiveFrom} onClick={() => run(async () => { await api.schedulePrice({ ...form, effectiveFrom: new Date(form.effectiveFrom).toISOString() }); load(); }, 'Price change scheduled.')}>Schedule</button>
      </div>
      <div className={`${INNER} space-y-2`}>
        <p className={LABEL}>Free term allowance and minimum purchase</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[['allowance.whatsapp', 'WhatsApp units per term'], ['allowance.sms', 'SMS units per term'], ['minimum.whatsapp', 'Min. WhatsApp purchase'], ['minimum.sms', 'Min. SMS purchase']].map(([key, label]) => (
            <label key={key} className="text-xs font-semibold text-[#800020]">{label}<input type="number" min="0" className={FIELD} value={config[key] ?? 0} onChange={event => setConfig({ ...config, [key]: Number(event.target.value) })} /></label>
          ))}
        </div>
        <button type="button" className={PRIMARY} onClick={() => run(async () => { await api.savePlatformConfig(config); load(); }, 'Saved. New terms get the new allowance; existing grants are unchanged.')}>Save</button>
      </div>
    </div>
  );
}

function Templates({ run }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => api.getTemplates().then(setData).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <p className="text-sm">Loading…</p>;
  const providers = [['WhatsApp (Meta Cloud API)', data.providers.whatsapp], ['WhatsApp status webhook', data.providers.webhook], ['SMS (PayHos)', data.providers.sms], ['Email (Zoho)', data.providers.email], ['Payments (Flutterwave)', data.providers.payments], ['Payment webhook', data.providers.paymentWebhook]];
  return (
    <div className="space-y-4">
      <div className={INNER}>
        <p className={LABEL}>Providers</p>
        <ul className="mt-2 grid grid-cols-1 gap-1 text-sm md:grid-cols-2">{providers.map(([label, ok]) => <li key={label} className={ok ? 'text-emerald-700' : 'text-amber-700'}>{ok ? '✓' : '•'} {label}{ok ? '' : ' — secret not set'}</li>)}</ul>
        <p className="mt-2 text-xs text-slate-500">Secrets: META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN, PAYHOS_API_KEY, PAYHOS_SENDER_ID, FLUTTERWAVE_WEBHOOK_HASH. Webhooks: /api/webhooks/communications/meta and /api/webhooks/payments/flutterwave.</p>
      </div>
      <div className={INNER}>
        <p className={LABEL}>WhatsApp templates</p>
        <p className="mt-1 text-xs text-[#191970] dark:text-slate-300">Create each template in Meta Business Manager with three body parameters (school, information, link), then mark it approved here once Meta approves it. Until then WhatsApp does not carry that notification.</p>
        <table className="mt-2 min-w-full text-sm text-[#191970] dark:text-slate-200">
          <thead><tr className="text-left text-xs uppercase text-[#800020]"><th className="p-2">Notification</th><th className="p-2">Meta template</th><th className="p-2">Body</th><th className="p-2">Status</th></tr></thead>
          <tbody>{data.templates.map(item => (
            <tr key={item.eventType} className="border-t border-[#c9a96e]/25">
              <td className="p-2">{item.label}</td><td className="p-2 font-mono text-xs">{item.metaName}</td><td className="p-2 text-xs">{item.body}</td>
              <td className="p-2"><select className={FIELD} value={item.status} onChange={event => run(async () => { await api.saveTemplate(item.eventType, { status: event.target.value, metaName: item.metaName, language: item.language }); load(); }, 'Saved.')}>{['pending', 'approved', 'rejected', 'paused'].map(status => <option key={status}>{status}</option>)}</select></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Schools({ schools }) {
  return (
    <div className={`${INNER} overflow-x-auto`}>
      <table className="min-w-full text-sm text-[#191970] dark:text-slate-200">
        <thead><tr className="text-left text-xs uppercase text-[#800020]"><th className="p-2">School</th><th className="p-2">WhatsApp</th><th className="p-2">SMS</th><th className="p-2">Reserved</th><th className="p-2">Used</th></tr></thead>
        <tbody>{schools.map(school => (
          <tr key={school.id} className="border-t border-[#c9a96e]/25"><td className="p-2">{school.name}</td><td className="p-2">{school.wallet.whatsapp.spendable}</td><td className="p-2">{school.wallet.sms.spendable}</td><td className="p-2">{school.wallet.whatsapp.reserved + school.wallet.sms.reserved}</td><td className="p-2">{school.wallet.whatsapp.used + school.wallet.sms.used}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Allocate({ schools, run, onDone }) {
  const [form, setForm] = useState({ tenantIds: [], channel: 'whatsapp', units: 50, reason: '', expiresAt: '', note: '' });
  const [review, setReview] = useState(null);
  const chosen = schools.filter(school => form.tenantIds.includes(school.id));
  const submit = () => run(async () => {
    const result = await api.giftUnits({ ...form, units: Number(form.units), expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : '', idempotencyKey: review.key });
    setReview({ ...review, results: result.results });
    onDone();
  }, 'Units allocated.');
  return (
    <div className={`${INNER} space-y-3`}>
      <label className="block text-xs font-semibold text-[#800020]">Schools
        <select multiple className={`${FIELD} h-40`} value={form.tenantIds} onChange={event => { setForm({ ...form, tenantIds: Array.from(event.target.selectedOptions).map(option => option.value) }); setReview(null); }}>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
      </label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <select className={FIELD} value={form.channel} onChange={event => { setForm({ ...form, channel: event.target.value }); setReview(null); }}>{['whatsapp', 'sms', 'email'].map(channel => <option key={channel} value={channel}>{api.CHANNEL_LABELS[channel]}</option>)}</select>
        <input className={FIELD} type="number" min="1" value={form.units} onChange={event => { setForm({ ...form, units: event.target.value }); setReview(null); }} aria-label="Units" />
        <input className={FIELD} type="date" value={form.expiresAt} onChange={event => { setForm({ ...form, expiresAt: event.target.value }); setReview(null); }} aria-label="Expires (optional)" />
        <input className={FIELD} placeholder="Reason (required)" value={form.reason} onChange={event => { setForm({ ...form, reason: event.target.value }); setReview(null); }} />
      </div>
      <input className={FIELD} placeholder="Internal note (optional)" value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} />
      {!review && <button type="button" className={SECONDARY} disabled={!chosen.length || !form.reason.trim() || !(Number(form.units) > 0)} onClick={() => setReview({ key: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })}>Review</button>}
      {review && (
        <div className="rounded-xl bg-[#fff8f0] p-3 text-sm text-[#191970] dark:bg-slate-800 dark:text-slate-200">
          <p className="font-bold">Give {form.units} {api.CHANNEL_LABELS[form.channel]} units{form.expiresAt ? `, expiring ${form.expiresAt}` : ' (no expiry)'}, to:</p>
          <ul className="list-disc pl-5">{chosen.map(school => <li key={school.id}>{school.name}{review.results ? ` — ${review.results.find(result => result.tenantId === school.id)?.status || ''}` : ''}</li>)}</ul>
          <p className="mt-1">Reason: {form.reason}</p>
          {!review.results && <div className="mt-2 flex gap-2"><button type="button" className={PRIMARY} onClick={submit}>Confirm and allocate</button><button type="button" className={SECONDARY} onClick={() => setReview(null)}>Change</button></div>}
        </div>
      )}
    </div>
  );
}

function GiftHistory({ run, schools }) {
  const [gifts, setGifts] = useState([]);
  const load = useCallback(() => api.listGifts('').then(result => setGifts(result.grants || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const nameOf = id => schools.find(school => school.id === id)?.name || id;
  const exportCsv = () => {
    const lines = [['school', 'channel', 'units', 'remaining', 'reversed', 'reason', 'by', 'expires', 'created'], ...gifts.map(gift => [nameOf(gift.tenantId), gift.channel, gift.initialUnits, gift.remainingUnits, gift.reversedUnits, gift.reason, gift.actorName, gift.expiresAt || '', gift.createdAt])];
    const blob = new Blob([lines.map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ndovera-unit-gifts.csv';
    link.click();
  };
  return (
    <div className={`${INNER} space-y-2`}>
      <button type="button" className={SECONDARY} onClick={exportCsv}>Export CSV</button>
      <ul className="space-y-1 text-sm text-[#191970] dark:text-slate-200">{gifts.map(gift => (
        <li key={gift.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#c9a96e]/25 py-1">
          <span>{new Date(gift.createdAt).toLocaleDateString()} · {nameOf(gift.tenantId)} · {gift.initialUnits} {api.CHANNEL_LABELS[gift.channel]} · {gift.remainingUnits - gift.reservedUnits} unspent{gift.reversedUnits ? ` · ${gift.reversedUnits} reversed` : ''} · {gift.reason} · by {gift.actorName}</span>
          {gift.remainingUnits - gift.reservedUnits > 0 && <button type="button" className="text-xs font-semibold text-rose-700 underline" onClick={async () => { const reason = await askText('Why reverse the unspent units?'); if (reason) run(async () => { await api.reverseGift(gift.id, reason); load(); }, 'Unspent units reversed.'); }}>Reverse unspent</button>}
        </li>
      ))}</ul>
    </div>
  );
}

function Reconciliation({ run }) {
  const [data, setData] = useState({ unknown: [], blocked: [] });
  const load = useCallback(() => api.getReconciliation().then(setData).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <div className={INNER}>
        <p className={LABEL}>Outcome unknown ({data.unknown.length})</p>
        <p className="mt-1 text-xs text-[#191970] dark:text-slate-300">These were never resent automatically. Check with the provider, then settle: “sent” spends the units, “not sent” returns them.</p>
        <ul className="mt-2 space-y-1 text-sm text-[#191970] dark:text-slate-200">{data.unknown.map(row => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#c9a96e]/25 py-1">
            <span>{row.schoolName} · {api.CHANNEL_LABELS[row.channel]} · {row.units} unit(s) · {row.error}{row.providerId ? ` · ${row.providerId}` : ''}</span>
            <span className="flex gap-2"><button type="button" className={SECONDARY} onClick={() => run(async () => { await api.resolveDelivery(row.id, 'sent'); load(); })}>Sent</button><button type="button" className={SECONDARY} onClick={() => run(async () => { await api.resolveDelivery(row.id, 'not_sent'); load(); })}>Not sent</button></span>
          </li>
        ))}</ul>
      </div>
      <div className={INNER}>
        <p className={LABEL}>Schools with sends waiting for units</p>
        <ul className="mt-2 text-sm text-[#191970] dark:text-slate-200">{data.blocked.map(row => <li key={row.tenantId}>{row.schoolName || row.tenantId}: {row.batches}</li>)}{!data.blocked.length && <li>None.</li>}</ul>
      </div>
    </div>
  );
}

export default function AmiCommunications() {
  const [run, notice] = useNotice();
  const [tab, setTab] = useState('pricing');
  const [schools, setSchools] = useState([]);
  const loadSchools = useCallback(() => api.getSchoolWallets().then(result => setSchools(result.schools || [])).catch(() => setSchools([])), []);
  useEffect(() => { loadSchools(); }, [loadSchools]);
  const tabs = [['pricing', 'Pricing'], ['templates', 'Providers & templates'], ['schools', 'School wallets'], ['allocate', 'Allocate free units'], ['history', 'Allocation history'], ['reconcile', 'Reconciliation']];
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className={CARD}>
        <p className={LABEL}>Ndovera</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Communications</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Parent notification prices, providers, school wallets and free units.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? PRIMARY : SECONDARY} onClick={() => setTab(key)}>{label}</button>)}</div>
      </div>
      {notice}
      {tab === 'pricing' && <Pricing run={run} />}
      {tab === 'templates' && <Templates run={run} />}
      {tab === 'schools' && <Schools schools={schools} />}
      {tab === 'allocate' && <Allocate schools={schools} run={run} onDone={loadSchools} />}
      {tab === 'history' && <GiftHistory run={run} schools={schools} />}
      {tab === 'reconcile' && <Reconciliation run={run} />}
    </div>
  );
}
