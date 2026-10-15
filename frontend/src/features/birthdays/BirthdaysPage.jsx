import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as api from './birthdaysApi';
import { askConfirm } from '../../shared/components/AppDialog';

// Birthdays: today's celebrations (card, wishes), my memories, my choice to be celebrated,
// and for the Owner/HoS the settings and the wish review queue.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl bg-white p-4 dark:bg-slate-900';
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970] dark:border-white/15 dark:bg-slate-950 dark:text-slate-100';
const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50 dark:bg-[#00ffff] dark:text-black';
const SECONDARY = 'rounded-2xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-400';
const STYLE_LABELS = { cheerful: 'Cheerful', warm: 'Warm', formal: 'Formal', short: 'Short', faith: 'With a blessing' };

function Celebration({ celebrationId, onBack }) {
  const [data, setData] = useState(null);
  const [cardUrl, setCardUrl] = useState('');
  const [wishes, setWishes] = useState([]);
  const [message, setMessage] = useState('');
  const [style, setStyle] = useState('cheerful');
  const [notice, setNotice] = useState('');
  const [requestId, setRequestId] = useState('');
  const load = useCallback(async () => {
    try {
      const detail = await api.getCelebration(celebrationId);
      setData(detail);
      if (detail.canReadWishes) setWishes((await api.getWishes(celebrationId)).items || []);
    } catch (error) { setNotice(error.message); }
  }, [celebrationId]);
  useEffect(() => {
    load();
    let url = '';
    api.getCardUrl(celebrationId).then(value => { url = value; setCardUrl(value); }).catch(() => setCardUrl(''));
    return () => { if (url) URL.revokeObjectURL?.(url); };
  }, [celebrationId, load]);

  const send = async () => {
    const text = message.trim();
    if (!text || text.length > 1000) return;
    if (!await askConfirm(`Send this wish?\n\n${text}`)) return;
    const key = requestId || `${Date.now()}-${celebrationId}`;
    setRequestId(key);
    try {
      const result = await api.sendWish(celebrationId, text, key);
      setMessage(''); setRequestId('');
      setNotice(result.status === 'pending' ? 'Wish sent. A teacher will check it before it is shown.' : 'Wish sent.');
      load();
    } catch (error) { setNotice(error.message); }
  };

  if (!data) return <p className="text-sm text-[#191970]">{notice || 'Loading…'}</p>;
  return (
    <div className="space-y-4">
      <button type="button" className={SECONDARY} onClick={onBack}>← Back</button>
      <div className={INNER}>
        <h2 className="text-2xl font-black text-[#800000] dark:text-white">Happy Birthday, {data.name}!</h2>
        <p className="text-sm text-[#191970] dark:text-slate-300">{data.displayDate}</p>
        {cardUrl ? <img src={cardUrl} alt={`Birthday card for ${data.name}`} className="mt-3 w-full max-w-md rounded-3xl shadow" /> : <p className="mt-3 text-sm text-slate-500">Card unavailable.</p>}
        <p className="mt-3 text-[#191970] dark:text-slate-200">{data.message}</p>
        {cardUrl && <button type="button" className={`${SECONDARY} mt-2`} onClick={() => api.downloadCardPng(cardUrl, `birthday-${celebrationId}.png`).catch(() => setNotice('Could not save the card on this device.'))}>Save card (PNG)</button>}
      </div>
      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{notice}</p>}
      {data.canSendWish && (
        <div className={`${INNER} space-y-2`}>
          <p className={LABEL}>Send a wish</p>
          <textarea className={FIELD} rows={3} maxLength={1000} value={message} onChange={event => { setMessage(event.target.value); setRequestId(''); }} placeholder="Your birthday wish" />
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${FIELD} max-w-[12rem]`} aria-label="Style" value={style} onChange={event => setStyle(event.target.value)}>{data.allowedStyles.map(item => <option key={item} value={item}>{STYLE_LABELS[item] || item}</option>)}</select>
            <button type="button" className={SECONDARY} onClick={async () => { try { setMessage((await api.suggestWish(celebrationId, style)).message); } catch (error) { setNotice(error.message); } }}>Help me write</button>
            <button type="button" className={PRIMARY} disabled={!message.trim()} onClick={send}>Preview &amp; send</button>
          </div>
        </div>
      )}
      <div className={INNER}>
        <p className={LABEL}>{data.wishCount} birthday wish{data.wishCount === 1 ? '' : 'es'}</p>
        {data.canReadWishes && (
          <ul className="mt-2 space-y-2">{wishes.map(wish => (
            <li key={wish.id} className="flex items-start justify-between gap-2 rounded-xl bg-[#fff8f0] p-3 text-sm text-[#191970] dark:bg-slate-800 dark:text-slate-200">
              <span><b>{wish.senderName}</b>{wish.state === 'pending' ? ' (waiting for approval)' : ''}<span className="block whitespace-pre-wrap">{wish.message}</span></span>
              <button type="button" className="text-xs font-semibold text-rose-700 underline" onClick={async () => { const reason = window.prompt('Why are you reporting this wish?'); if (!reason) return; try { await api.reportWish(celebrationId, wish.id, reason); setNotice('Reported. It is hidden until the school reviews it.'); load(); } catch (error) { setNotice(error.message); } }}>Report</button>
            </li>
          ))}</ul>
        )}
      </div>
    </div>
  );
}

function List({ items, empty, onOpen }) {
  if (!items) return <p className="text-sm text-[#191970]">Loading…</p>;
  if (!items.length) return <p className="text-sm text-[#191970]">{empty}</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{items.map(item => (
      <li key={item.id}><button type="button" className={`${INNER} w-full text-left hover:ring-2 hover:ring-[#c9a96e]`} onClick={() => onOpen(item.id)}>
        <p className="font-bold text-[#800000] dark:text-white">🎂 {item.name}</p><p className="text-sm text-[#191970] dark:text-slate-300">{item.displayDate}</p>
      </button></li>
    ))}</ul>
  );
}

function MyChoice() {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState('');
  const load = () => api.getMyConsent().then(setData).catch(error => setNotice(error.message));
  useEffect(() => { load(); }, []);
  if (!data) return <p className="text-sm text-[#191970]">{notice || 'Loading…'}</p>;
  return (
    <div className={`${INNER} space-y-3 text-sm text-[#191970] dark:text-slate-200`}>
      {data.kind === 'staff' || data.kind === 'student' ? (
        <label className="flex items-center gap-2"><input type="checkbox" checked={data.celebrate} onChange={async event => { await api.setMyConsent(event.target.checked); load(); }} /> Celebrate my birthday at school (my name, photo and day — never my age)</label>
      ) : null}
      {data.children?.length > 0 && (
        <div>
          <p className={LABEL}>My children</p>
          {data.children.map(child => <label key={child.id} className="mt-1 flex items-center gap-2"><input type="checkbox" checked={child.celebrate} onChange={async event => { await api.setChildConsent(child.id, event.target.checked); load(); }} /> Celebrate {child.name}’s birthday at school</label>)}
        </div>
      )}
      <p className="text-xs text-slate-500">You can change this at any time; turning it off removes today’s celebration straight away.</p>
    </div>
  );
}

function Settings() {
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const load = () => api.getSettings().then(setForm).catch(error => setNotice(error.message));
  useEffect(() => { load(); }, []);
  if (!form) return <p className="text-sm text-[#191970]">{notice || 'Loading…'}</p>;
  const toggle = (key, label, hint) => (
    <label className="flex items-start gap-2 text-sm text-[#191970] dark:text-slate-200"><input type="checkbox" className="mt-1" checked={Boolean(form[key])} onChange={event => setForm({ ...form, [key]: event.target.checked })} /><span><b>{label}</b>{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span></label>
  );
  return (
    <div className={`${INNER} space-y-3`}>
      {notice && <p role="status" className="text-sm font-semibold text-emerald-800">{notice}</p>}
      {toggle('enabled', 'Automatic birthday celebrations', 'Announced on everyone’s dashboard at the time below.')}
      {toggle('staff', 'Celebrate staff', 'Staff can opt out themselves.')}
      {toggle('students', 'Celebrate students', 'Only students whose parent (or who themselves) agreed.')}
      {toggle('wishes', 'Allow birthday wishes')}
      {toggle('moderateStudentWishes', 'Check students’ wishes before they are shown')}
      {toggle('aiCards', 'Ndovera AI writes each year’s card message', 'Off: messages come from Ndovera’s written collection.')}
      {toggle('faithStyles', 'Offer wishes with a blessing')}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <label className="text-xs font-semibold text-[#800020]">Announcement time<input type="time" className={FIELD} value={form.announcementTime} onChange={event => setForm({ ...form, announcementTime: event.target.value })} /></label>
        <label className="text-xs font-semibold text-[#800020]">Timezone<input className={FIELD} value={form.timezone} onChange={event => setForm({ ...form, timezone: event.target.value })} /></label>
        <label className="text-xs font-semibold text-[#800020]">29 February in other years<select className={FIELD} value={form.leapDayPolicy} onChange={event => setForm({ ...form, leapDayPolicy: event.target.value })}><option value="feb28">28 February</option><option value="mar01">1 March</option></select></label>
      </div>
      <button type="button" className={PRIMARY} onClick={async () => { try { setForm(await api.saveSettings(form)); setNotice('Saved.'); } catch (error) { setNotice(error.message); if (error.status === 409) load(); } }}>Save settings</button>
    </div>
  );
}

function Review() {
  const [items, setItems] = useState(null);
  const load = () => api.getModeration().then(result => setItems(result.items || [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  if (!items) return <p className="text-sm text-[#191970]">Loading…</p>;
  if (!items.length) return <p className="text-sm text-[#191970]">No wishes waiting for review.</p>;
  return (
    <ul className="space-y-2">{items.map(item => (
      <li key={item.id} className={`${INNER} text-sm text-[#191970] dark:text-slate-200`}>
        <p><b>{item.senderName}</b> ({item.senderRole}) to <b>{item.recipient}</b>{item.reportReason ? <span className="text-rose-700"> · reported: {item.reportReason}</span> : null}</p>
        <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
        <div className="mt-2 flex gap-2"><button type="button" className={PRIMARY} onClick={async () => { await api.decideWish(item.id, 'approve'); load(); }}>Approve</button><button type="button" className={SECONDARY} onClick={async () => { await api.decideWish(item.id, 'reject'); load(); }}>Reject</button></div>
      </li>
    ))}</ul>
  );
}

export default function BirthdaysPage() {
  const { role = '' } = useParams();
  const admin = ['owner', 'hos'].includes(role);
  const [tab, setTab] = useState('today');
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get('c') || '');
  const [today, setToday] = useState(null);
  const [memories, setMemories] = useState(null);
  useEffect(() => {
    if (tab === 'today') api.getToday().then(result => setToday(result.items || [])).catch(() => setToday([]));
    if (tab === 'memories') api.getMemories().then(result => setMemories(result.items || [])).catch(() => setMemories([]));
  }, [tab]);
  const tabs = [['today', 'Today'], ['memories', 'My memories'], ['choice', 'My choice'], ...(admin ? [['review', 'Review wishes'], ['settings', 'Settings']] : [])];
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className={CARD}>
        <p className={LABEL}>Celebrations</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Birthdays</h1>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? PRIMARY : SECONDARY} onClick={() => { setTab(key); setOpen(''); }}>{label}</button>)}</div>
      </div>
      {open ? <Celebration celebrationId={open} onBack={() => setOpen('')} /> : (
        <>
          {tab === 'today' && <List items={today} empty="No birthday celebrations today." onOpen={setOpen} />}
          {tab === 'memories' && <List items={memories} empty="Your birthday memories will appear here." onOpen={setOpen} />}
          {tab === 'choice' && <MyChoice />}
          {tab === 'review' && admin && <Review />}
          {tab === 'settings' && admin && <Settings />}
        </>
      )}
    </div>
  );
}
