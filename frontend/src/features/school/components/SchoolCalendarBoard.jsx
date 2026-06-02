import React, { useCallback, useEffect, useState } from 'react';
import { getSchoolCalendar, addCalendarEvent, deleteCalendarEvent } from '../services/schoolApi';

const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors disabled:opacity-60';
const INPUT = 'rounded-xl border border-[#c9a96e]/40 bg-white/80 p-2 text-[#191970] text-sm outline-none focus:border-[#800020]';

const TYPE_OPTIONS = [
  { value: 'holiday', label: 'Public Holiday' },
  { value: 'break', label: 'School Break' },
  { value: 'term_start', label: 'Term Start' },
  { value: 'term_end', label: 'Term End' },
  { value: 'event', label: 'Event' },
];

const TYPE_LABEL = TYPE_OPTIONS.reduce((acc, t) => { acc[t.value] = t.label; return acc; }, {});

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function typeBadge(type) {
  const map = {
    holiday: 'bg-red-100 text-red-700',
    break: 'bg-amber-100 text-amber-700',
    term_start: 'bg-emerald-100 text-emerald-700',
    term_end: 'bg-indigo-100 text-indigo-700',
    event: 'bg-slate-100 text-slate-600',
  };
  return map[type] || 'bg-slate-100 text-slate-600';
}

const CURRENT_YEAR = new Date().getFullYear();

export default function SchoolCalendarBoard() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ title: '', type: 'holiday', startDate: '', endDate: '', recurringAnnual: false });

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const load = useCallback(() => {
    setLoading(true);
    getSchoolCalendar({ from: `${year}-01-01`, to: `${year}-12-31` })
      .then(data => {
        setEvents(data?.events || []);
        setHolidays(data?.holidays || []);
        setCanManage(Boolean(data?.canManage));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!form.title.trim() || !form.startDate) { showToast('Title and start date are required.'); return; }
    setSaving(true);
    try {
      await addCalendarEvent({
        title: form.title.trim(),
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        recurringAnnual: form.recurringAnnual,
      });
      showToast('Calendar entry added.');
      setForm({ title: '', type: 'holiday', startDate: '', endDate: '', recurringAnnual: false });
      load();
    } catch (e) { showToast(e.message || 'Could not add entry.'); } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this calendar entry?')) return;
    try { await deleteCalendarEvent(id); showToast('Entry removed.'); load(); } catch (e) { showToast(e.message || 'Could not remove entry.'); }
  }

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#800000]">School Calendar</h2>
            <p className="text-sm text-[#191970] mt-1">Public holidays and breaks here are automatically applied to attendance — staff and students are never marked absent on these days.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setYear(y => y - 1)} className="rounded-xl border border-[#c9a96e]/40 px-3 py-2 text-[#800020] font-bold">‹</button>
            <span className="text-lg font-bold text-[#800000] w-16 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="rounded-xl border border-[#c9a96e]/40 px-3 py-2 text-[#800020] font-bold">›</button>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className={CARD}>
          <h3 className="text-base font-bold text-[#800000] mb-3">Add Holiday, Break, or Event</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (e.g. Mid-Term Break)" className={INPUT} />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-[#191970]"><input type="checkbox" checked={form.recurringAnnual} onChange={e => setForm(f => ({ ...f, recurringAnnual: e.target.checked }))} /> Repeats every year</label>
            <div><label className="text-xs font-semibold text-[#800020]">Start date</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={`${INPUT} w-full mt-1`} /></div>
            <div><label className="text-xs font-semibold text-[#800020]">End date (optional)</label><input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={`${INPUT} w-full mt-1`} /></div>
            <div className="flex items-end"><button onClick={handleAdd} disabled={saving} className={BTN}>{saving ? 'Saving…' : '+ Add Entry'}</button></div>
          </div>
          <p className="text-xs text-[#191970] mt-2">Only <strong>Public Holiday</strong> and <strong>School Break</strong> entries suppress absence marking. Term markers and events are informational.</p>
        </div>
      ) : null}

      <div className={CARD}>
        <h3 className="text-base font-bold text-[#800000] mb-1">Non-School Days in {year}</h3>
        <p className="text-xs text-[#191970] mb-3">Includes national public holidays plus this school&apos;s holidays and breaks.</p>
        {loading ? <p className="text-[#800020] text-sm">Loading…</p> : holidays.length === 0 ? <p className="text-[#800020] text-sm">No holidays or breaks recorded for {year}.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {holidays.map(h => (
              <div key={`${h.date}-${h.title}`} className={`${INNER} flex items-center justify-between gap-3`}>
                <div>
                  <p className="text-[#191970] font-semibold">{h.title}</p>
                  <p className="text-xs text-[#800020]">{formatDate(h.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeBadge(h.type)}`}>{h.type === 'break' ? 'Break' : 'Holiday'}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[#800020]">{h.source === 'national' ? 'National' : 'School'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={CARD}>
        <h3 className="text-base font-bold text-[#800000] mb-3">School Calendar Entries</h3>
        {events.length === 0 ? <p className="text-[#800020] text-sm">This school has not added any calendar entries yet.</p> : (
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className={`${INNER} flex items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <p className="text-[#191970] font-semibold truncate">{ev.title} {ev.recurringAnnual ? <span className="text-[10px] text-[#800020]">(yearly)</span> : null}</p>
                  <p className="text-xs text-[#800020]">{formatDate(ev.startDate)}{ev.endDate && ev.endDate !== ev.startDate ? ` – ${formatDate(ev.endDate)}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeBadge(ev.type)}`}>{TYPE_LABEL[ev.type] || ev.type}</span>
                  {canManage ? <button onClick={() => handleDelete(ev.id)} className="text-red-700 text-xs font-bold hover:underline">Remove</button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
