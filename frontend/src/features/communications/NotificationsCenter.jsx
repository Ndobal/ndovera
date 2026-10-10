import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './communicationsApi';

// Communication → Notifications (Owner, HoS; bursars can buy units and see history).
// Parents are told automatically when fees are published, payments verified, results
// published, work set or notices posted. Paid channels use units; email and in-app are free.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl bg-white p-4 dark:bg-slate-900';
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970] dark:border-white/15 dark:bg-slate-950 dark:text-slate-100';
const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50 dark:bg-[#00ffff] dark:text-black';
const SECONDARY = 'rounded-2xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-400';
const EVENT_LABELS = { fee_bill: 'Term fees published', fee_reminder: 'Fee reminders', receipt: 'Payment receipts', fee_cleared: 'Fees fully paid', results: 'Results published', assignment: 'New assignments', assignment_digest: 'Daily assignment summary', deadline: 'Deadline reminders', notice: 'School notices' };

function useNotice() {
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  const run = useCallback(async (work, success = '') => {
    setNotice({ text: '', tone: 'ok' });
    try { const result = await work(); if (success) setNotice({ text: success, tone: 'ok' }); return result; } catch (error) { setNotice({ text: error.message, tone: 'error' }); return null; }
  }, []);
  const view = notice.text ? <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p> : null;
  return [run, view];
}

function WalletCard({ channel, wallet, price }) {
  return (
    <div className={INNER}>
      <p className={LABEL}>{api.CHANNEL_LABELS[channel]}</p>
      <p className="mt-1 text-3xl font-black text-[#800000] dark:text-white">{channel === 'email' && price?.billingMode === 'FREE' ? 'Free' : wallet.spendable}</p>
      {!(channel === 'email' && price?.billingMode === 'FREE') && <p className="text-xs text-[#191970] dark:text-slate-300">units to spend · {wallet.reserved} reserved · {wallet.used} used</p>}
      {channel !== 'email' && <p className="mt-1 text-xs text-[#191970] dark:text-slate-300">Term allowance {wallet.termAllowance} · gifts {wallet.gifts} · bought {wallet.purchased}</p>}
      {wallet.expiring?.length > 0 && <p className="mt-1 text-xs text-amber-700">{wallet.expiring.map(item => `${item.units} expire ${new Date(item.expiresAt).toLocaleDateString()}`).join(' · ')}</p>}
      {price && <p className="mt-1 text-xs text-slate-500">{price.billingMode === 'FREE' ? 'Free to your school' : `${api.naira(price.unitPriceKobo)} per ${channel === 'sms' ? 'SMS segment' : 'message'}`}</p>}
    </div>
  );
}

function Overview({ data, onRecheck, run }) {
  const stats = useMemo(() => {
    const out = {};
    for (const row of data.last30Days || []) {
      out[row.channel] = out[row.channel] || {};
      out[row.channel][row.status] = row.n;
    }
    return out;
  }, [data.last30Days]);
  return (
    <div className="space-y-4">
      {data.warnings.map(warning => <p key={warning} role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{warning}</p>)}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {['whatsapp', 'sms', 'email'].map(channel => <WalletCard key={channel} channel={channel} wallet={data.wallet[channel]} price={data.prices?.[channel]?.current} />)}
      </div>
      <div className={INNER}>
        <p className={LABEL}>Automatic sending</p>
        <ul className="mt-2 space-y-1 text-sm text-[#191970] dark:text-slate-200">
          {data.automation.map(item => (
            <li key={item.channel}>{api.CHANNEL_LABELS[item.channel]}: {item.paused ? <span className="font-bold text-amber-700">paused ({item.reasons.map(reason => (reason === 'credits' ? 'waiting for units' : reason)).join(', ')})</span> : <span className="font-bold text-emerald-700">active</span>}
              {item.channel === 'whatsapp' && !data.providers.whatsapp ? ' — Ndovera is still connecting WhatsApp.' : ''}{item.channel === 'sms' && !data.providers.sms ? ' — Ndovera is still connecting SMS.' : ''}</li>
          ))}
          <li>In-app: <span className="font-bold text-emerald-700">always on</span></li>
        </ul>
      </div>
      <div className={INNER}>
        <p className={LABEL}>Waiting for units ({data.waiting.length})</p>
        {!data.waiting.length && <p className="mt-1 text-sm text-[#191970]">Nothing is waiting.</p>}
        <ul className="mt-2 space-y-2">
          {data.waiting.map(batch => (
            <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#c9a96e]/30 p-3 text-sm text-[#191970] dark:text-slate-200">
              <span><b>{batch.label}</b> · {batch.counts.recipients || 0} families · short {Object.entries(batch.shortfall).map(([channel, units]) => `${units} ${api.CHANNEL_LABELS[channel]}`).join(', ') || 'behind earlier notices'} · {new Date(batch.createdAt).toLocaleString()}</span>
              <button type="button" className={SECONDARY} onClick={() => run(() => onRecheck(batch.id), 'Checked again.')}>Check again</button>
            </li>
          ))}
        </ul>
      </div>
      <div className={INNER}>
        <p className={LABEL}>Last 30 days</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[#191970] md:grid-cols-4 dark:text-slate-200">
          {['inapp', 'email', 'whatsapp', 'sms'].map(channel => (
            <div key={channel} className="rounded-xl bg-[#fff8f0] p-2 dark:bg-slate-800">
              <p className="font-bold">{api.CHANNEL_LABELS[channel]}</p>
              {Object.entries(stats[channel] || {}).map(([status, n]) => <p key={status} className="text-xs">{api.STATUS_LABELS[status] || status}: {n}</p>)}
              {!stats[channel] && <p className="text-xs text-slate-500">none</p>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">"Accepted by provider" means WhatsApp or the SMS network took the message; it does not prove it reached the phone. SMS can only ever show as accepted.</p>
      </div>
    </div>
  );
}

function Settings({ data, onSaved, run }) {
  const [form, setForm] = useState(data.settings);
  useEffect(() => setForm(data.settings), [data.settings]);
  const set = patch => setForm(current => ({ ...current, ...patch }));
  const smsPrice = data.prices?.sms?.current?.unitPriceKobo || 800;
  const save = () => run(async () => {
    const body = { ...form, acknowledgeSmsCost: form.shortagePolicy === 'SMS_FOR_REMAINDER' && data.settings.shortagePolicy !== 'SMS_FOR_REMAINDER' ? window.confirm(`SMS will be used for parents WhatsApp units cannot cover, at ${api.naira(smsPrice)} per SMS segment, from your SMS units. Continue?`) : undefined };
    if (body.acknowledgeSmsCost === false) throw new Error('Not saved: SMS fallback was not confirmed.');
    await api.saveSettings(body);
    onSaved();
  }, 'Saved.');
  const toggle = (key, label, hint) => (
    <label className="flex items-start gap-3 rounded-xl bg-white p-3 text-sm text-[#191970] dark:bg-slate-900 dark:text-slate-200">
      <input type="checkbox" className="mt-1" checked={Boolean(form[key])} disabled={!data.canChangeSettings} onChange={event => set({ [key]: event.target.checked })} />
      <span><b>{label}</b>{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span>
    </label>
  );
  return (
    <div className="space-y-4">
      {!data.canChangeSettings && <p className="text-sm text-[#191970]">Only the Owner or Head of School can change these settings.</p>}
      <div className={`${INNER} grid grid-cols-1 gap-2 md:grid-cols-2`}>
        {toggle('whatsappEnabled', 'WhatsApp')}
        {toggle('smsEnabled', 'SMS')}
        {toggle('emailEnabled', 'Email', 'Free to your school.')}
        {toggle('consentConfirmed', 'Parents agreed to WhatsApp/SMS messages', 'Tick only if your enrolment forms collected this. A parent can still opt out at any time.')}
        {toggle('detailedMessages', 'Include children’s names and amounts in messages', 'Off: messages only say information is available and link to Ndovera. Scores are never included.')}
      </div>
      <div className={INNER}>
        <p className={LABEL}>When WhatsApp units run short</p>
        <label className="mt-2 flex items-start gap-2 text-sm text-[#191970] dark:text-slate-200"><input type="radio" name="policy" disabled={!data.canChangeSettings} checked={form.shortagePolicy === 'PAUSE_BATCH'} onChange={() => set({ shortagePolicy: 'PAUSE_BATCH' })} /><span><b>Pause the whole WhatsApp send</b> until you add units (recommended). Email and in-app still go.</span></label>
        <label className="mt-2 flex items-start gap-2 text-sm text-[#191970] dark:text-slate-200"><input type="radio" name="policy" disabled={!data.canChangeSettings} checked={form.shortagePolicy === 'SMS_FOR_REMAINDER'} onChange={() => set({ shortagePolicy: 'SMS_FOR_REMAINDER' })} /><span><b>WhatsApp first, SMS for the rest</b> — uses SMS units ({api.naira(smsPrice)} per segment). If SMS units cannot cover everyone left, the send waits.</span></label>
      </div>
      <div className={`${INNER} grid grid-cols-1 gap-3 md:grid-cols-3`}>
        <label className="text-xs font-semibold text-[#800020]">Who receives
          <select className={FIELD} disabled={!data.canChangeSettings} value={form.guardianMode} onChange={event => set({ guardianMode: event.target.value })}><option value="designated">One notification parent per child</option><option value="all">Every linked parent</option></select>
        </label>
        <label className="text-xs font-semibold text-[#800020]">Assignments
          <select className={FIELD} disabled={!data.canChangeSettings} value={form.assignmentMode} onChange={event => set({ assignmentMode: event.target.value })}><option value="digest">One daily summary (fewer units)</option><option value="each">Each new assignment</option><option value="off">Do not notify</option></select>
        </label>
        <label className="text-xs font-semibold text-[#800020]">Daily summary time<input type="time" className={FIELD} disabled={!data.canChangeSettings} value={form.digestTime} onChange={event => set({ digestTime: event.target.value })} /></label>
        <label className="text-xs font-semibold text-[#800020]">Deadline reminder (hours before; 0 = off)<input type="number" min="0" max="168" className={FIELD} disabled={!data.canChangeSettings} value={form.deadlineHoursBefore} onChange={event => set({ deadlineHoursBefore: Number(event.target.value) })} /></label>
        <label className="text-xs font-semibold text-[#800020]">Fee reminders every (days)<input type="number" min="7" max="60" className={FIELD} disabled={!data.canChangeSettings} value={form.reminderIntervalDays} onChange={event => set({ reminderIntervalDays: Number(event.target.value) })} /></label>
        <label className="text-xs font-semibold text-[#800020]">First fee reminder on (optional)<input type="date" className={FIELD} disabled={!data.canChangeSettings} value={form.initialReminderDate || ''} onChange={event => set({ initialReminderDate: event.target.value })} /></label>
      </div>
      <div className={INNER}>
        <p className={LABEL}>What parents are told about</p>
        <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-3">
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-[#191970] dark:text-slate-200"><input type="checkbox" disabled={!data.canChangeSettings} checked={Boolean(form.events?.[key])} onChange={event => set({ events: { ...form.events, [key]: event.target.checked } })} /> {label}{!data.templatesApproved.includes(key) ? <span className="text-xs text-slate-500">(WhatsApp template awaiting approval)</span> : null}</label>
          ))}
        </div>
      </div>
      {data.canChangeSettings && <button type="button" className={PRIMARY} onClick={save}>Save settings</button>}
    </div>
  );
}

function BuyUnits({ data, run }) {
  const [channel, setChannel] = useState('whatsapp');
  const [units, setUnits] = useState(100);
  const price = data.prices?.[channel]?.current;
  const total = price ? units * price.unitPriceKobo : 0;
  const buy = () => run(async () => {
    const quote = (await api.quoteUnits({ channel, units: Number(units) })).quote;
    const started = await api.startPurchase(quote.id);
    if (started.checkoutUrl) window.location.assign(started.checkoutUrl);
  });
  if (!data.canBuy) return <p className="text-sm text-[#191970]">Ask the Owner, Head of School or bursar to buy units.</p>;
  return (
    <div className={`${INNER} space-y-3`}>
      <div className="flex flex-wrap gap-2">
        {['whatsapp', 'sms'].map(item => <button key={item} type="button" className={channel === item ? PRIMARY : SECONDARY} onClick={() => setChannel(item)}>{api.CHANNEL_LABELS[item]} · {api.naira(data.prices?.[item]?.current?.unitPriceKobo)} per {item === 'sms' ? 'segment' : 'message'}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">{data.packages.map(size => <button key={size} type="button" className={Number(units) === size ? PRIMARY : SECONDARY} onClick={() => setUnits(size)}>{size} units · {api.naira(size * (price?.unitPriceKobo || 0))}</button>)}</div>
      <label className="block text-xs font-semibold text-[#800020]">Or any number (at least {data.minimumPurchase?.[channel] || 10})
        <input type="number" min={data.minimumPurchase?.[channel] || 10} className={`${FIELD} max-w-[12rem]`} value={units} onChange={event => setUnits(Math.max(0, Math.floor(Number(event.target.value) || 0)))} />
      </label>
      <p className="text-sm text-[#191970] dark:text-slate-200">Total: <b>{api.naira(total)}</b>. Units you buy never expire and carry over between terms. A message the provider accepts uses its units even if a phone is off or out of coverage; paying does not guarantee delivery to the handset.</p>
      <button type="button" className={PRIMARY} disabled={!units} onClick={buy}>Pay with Flutterwave</button>
    </div>
  );
}

function SendNotice({ run, onSent }) {
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState(null);
  const check = () => run(async () => setPreview((await api.previewNotification({ type: 'notice', scope: { kind: 'school' }, facts: { title } })).preview));
  const send = () => run(async () => { await api.sendNotice({ title, idempotencyKey: `${Date.now()}` }); setTitle(''); setPreview(null); onSent(); }, 'Queued: parents will be notified within a minute.');
  return (
    <div className={`${INNER} space-y-3`}>
      <p className="text-sm text-[#191970] dark:text-slate-200">A short notice to every parent. Posting an announcement for parents on the school board sends one too.</p>
      <input className={FIELD} placeholder="Notice title, e.g. Mid-term break starts Friday" value={title} onChange={event => { setTitle(event.target.value); setPreview(null); }} />
      <div className="flex gap-2"><button type="button" className={SECONDARY} disabled={!title.trim()} onClick={check}>Preview cost</button><button type="button" className={PRIMARY} disabled={!preview} onClick={send}>Send</button></div>
      {preview && (
        <div className="rounded-xl bg-[#fff8f0] p-3 text-sm text-[#191970] dark:bg-slate-800 dark:text-slate-200">
          <p><b>{preview.recipients}</b> families · WhatsApp {preview.whatsapp} · SMS {preview.sms} ({preview.smsSegments} segments) · email {preview.email} · in-app {preview.inapp}</p>
          {Object.keys(preview.excluded).length > 0 && <p className="mt-1">Not reachable by WhatsApp/SMS: {Object.entries(preview.excluded).map(([reason, n]) => `${api.EXCLUDED_LABELS[reason] || reason}: ${n}`).join(' · ')}</p>}
          {preview.warning && <p className="mt-1 font-semibold text-amber-800">{preview.warning}</p>}
          {preview.sample && <p className="mt-2 text-xs text-slate-500">Message: “{preview.sample}”</p>}
        </div>
      )}
    </div>
  );
}

function History() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState({ channel: '', status: '' });
  useEffect(() => { api.getDeliveries(filter).then(result => setRows(result.deliveries || [])).catch(() => setRows([])); }, [filter]);
  return (
    <div className={INNER}>
      <div className="mb-2 flex flex-wrap gap-2">
        <select className={`${FIELD} max-w-[10rem]`} aria-label="Channel" value={filter.channel} onChange={event => setFilter(current => ({ ...current, channel: event.target.value }))}><option value="">All channels</option>{Object.entries(api.CHANNEL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select className={`${FIELD} max-w-[12rem]`} aria-label="Status" value={filter.status} onChange={event => setFilter(current => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{Object.entries(api.STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-[#191970] dark:text-slate-200">
          <thead><tr className="text-left text-xs uppercase text-[#800020]"><th className="p-2">When</th><th className="p-2">What</th><th className="p-2">Parent</th><th className="p-2">Channel</th><th className="p-2">Status</th><th className="p-2">Units</th></tr></thead>
          <tbody>{rows.map(row => (
            <tr key={row.id} className="border-t border-[#c9a96e]/25"><td className="p-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td><td className="p-2">{row.label}</td><td className="p-2">{row.guardianName || '—'}</td><td className="p-2">{api.CHANNEL_LABELS[row.channel]}</td><td className="p-2">{api.STATUS_LABELS[row.status] || row.status}{row.error ? <span className="block text-xs text-rose-700">{row.error}</span> : null}</td><td className="p-2">{row.units || '—'}</td></tr>
          ))}</tbody>
        </table>
        {!rows.length && <p className="p-3 text-sm">Nothing sent yet.</p>}
      </div>
    </div>
  );
}

function Contacts({ run }) {
  const [data, setData] = useState({ contacts: [], summary: {} });
  const load = useCallback(() => api.getContacts().then(setData).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const toggle = (person, channel) => run(async () => { await api.setContactConsent(person.id, { channel, status: person.consent?.[channel] === 'withdrawn' ? 'granted' : 'withdrawn' }); load(); });
  return (
    <div className={INNER}>
      <p className="text-sm text-[#191970] dark:text-slate-200">{data.summary.total || 0} parents · <b>{data.summary.invalidPhones || 0}</b> without a valid phone number (they still get email and in-app) · {data.summary.noChildren || 0} not linked to a child.</p>
      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-sm text-[#191970] dark:text-slate-200">
          <thead><tr className="text-left text-xs uppercase text-[#800020]"><th className="p-2">Parent</th><th className="p-2">Phone</th><th className="p-2">Children</th><th className="p-2">WhatsApp</th><th className="p-2">SMS</th><th className="p-2">Email</th></tr></thead>
          <tbody>{data.contacts.map(person => (
            <tr key={person.id} className="border-t border-[#c9a96e]/25">
              <td className="p-2">{person.name}<span className="block text-xs text-slate-500">{person.email}</span></td>
              <td className={`p-2 ${person.phoneValid ? '' : 'text-rose-700'}`}>{person.phone || 'none'}{!person.phoneValid && person.phone ? ' (check)' : ''}</td>
              <td className="p-2">{person.children}</td>
              {['whatsapp', 'sms', 'email'].map(channel => <td key={channel} className="p-2"><button type="button" className="text-xs font-semibold underline" onClick={() => toggle(person, channel)}>{person.consent?.[channel] === 'withdrawn' ? 'Opted out' : person.consent?.[channel] === 'granted' ? 'Agreed' : 'Default'}</button></td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function WalletAndPurchases() {
  const [wallets, setWallets] = useState(null);
  const [purchases, setPurchases] = useState([]);
  useEffect(() => {
    api.getWallets().then(setWallets).catch(() => {});
    api.listPurchases().then(result => setPurchases(result.purchases || [])).catch(() => {});
  }, []);
  return (
    <div className="space-y-4">
      <div className={INNER}>
        <p className={LABEL}>Purchases</p>
        <ul className="mt-2 space-y-1 text-sm text-[#191970] dark:text-slate-200">{purchases.map(item => <li key={item.id}>{new Date(item.createdAt).toLocaleString()} · {item.units} {api.CHANNEL_LABELS[item.channel]} units · {api.naira(item.amountKobo)} · <b>{item.status}</b>{item.failure ? ` (${item.failure})` : ''}</li>)}{!purchases.length && <li>No purchases yet.</li>}</ul>
      </div>
      <div className={INNER}>
        <p className={LABEL}>Unit history</p>
        <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-xs text-[#191970] dark:text-slate-200">{(wallets?.ledger || []).map(row => <li key={row.id}>{new Date(row.created_at).toLocaleString()} · {api.CHANNEL_LABELS[row.channel]} · {row.op} {row.units}{row.note ? ` · ${row.note}` : ''}</li>)}</ul>
      </div>
    </div>
  );
}

export default function NotificationsCenter() {
  const [run, notice] = useNotice();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const load = useCallback(() => api.getOverview().then(setData).catch(error => setData({ error: error.message })), []);
  useEffect(() => { load(); }, [load]);
  // Back from Flutterwave: Ndovera checks the payment with Flutterwave before adding units.
  useEffect(() => {
    const purchaseId = new URLSearchParams(window.location.search).get('purchase');
    if (!purchaseId) return;
    run(async () => {
      const { purchase } = await api.checkPurchase(purchaseId);
      await load();
      if (purchase.status === 'paid') return `Payment confirmed: ${purchase.units} ${api.CHANNEL_LABELS[purchase.channel]} units added.`;
      if (purchase.status === 'pending') throw new Error('The payment is not confirmed yet. Check again in a minute.');
      throw new Error(`The payment was not accepted${purchase.failure ? `: ${purchase.failure}` : '.'}`);
    }).then(message => { if (message) window.alert(message); });
  }, [load, run]);

  if (!data) return <p className="p-6 text-sm text-[#191970]">Loading…</p>;
  if (data.error) return <p role="alert" className="p-6 text-sm text-rose-700">{data.error}</p>;
  const tabs = [['overview', 'Overview'], ['settings', 'Settings'], ['buy', 'Buy units'], ['notice', 'Send a notice'], ['history', 'Delivery history'], ['contacts', 'Contacts & consent'], ['wallet', 'Wallet & purchases']]
    .filter(([key]) => (key === 'contacts' || key === 'notice' ? data.canChangeSettings : true));
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className={CARD}>
        <p className={LABEL}>Communication</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Parent notifications</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Parents are told automatically about fees, receipts, results, school work and notices — by WhatsApp or SMS (units), email (free) and in the app (free).</p>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? PRIMARY : SECONDARY} onClick={() => setTab(key)}>{label}</button>)}</div>
      </div>
      {notice}
      {tab === 'overview' && <Overview data={data} run={run} onRecheck={async batchId => { await api.recheckBatch(batchId); await load(); }} />}
      {tab === 'settings' && <Settings data={data} run={run} onSaved={load} />}
      {tab === 'buy' && <BuyUnits data={data} run={run} />}
      {tab === 'notice' && <SendNotice run={run} onSent={load} />}
      {tab === 'history' && <History />}
      {tab === 'contacts' && <Contacts run={run} />}
      {tab === 'wallet' && <WalletAndPurchases />}
    </div>
  );
}
