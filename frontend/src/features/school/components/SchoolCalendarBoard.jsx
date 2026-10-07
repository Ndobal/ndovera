import React, { useCallback, useEffect, useState } from 'react';
import { getSchoolCalendar, addCalendarEvent, deleteCalendarEvent, updateCalendarEvent, getClasses } from '../services/schoolApi';

// The school calendar. Owner and HOS create, edit and cancel events with times,
// reminders and an audience (staff, parents, students, or chosen classes).
// Cancelling keeps the event on file and in the audit trail. Holidays and breaks
// here also stop attendance being marked absent on those days.

const CARD = 'rounded-3xl p-6 bg-[#b5e3f4] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#ade1f4] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#b5e3f4] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors disabled:opacity-60';
const INPUT = 'rounded-xl border border-[#c9a96e]/40 bg-white/80 p-2 text-[#191970] text-sm outline-none focus:border-[#800020]';
const LABEL = 'text-xs font-semibold text-[#800020]';

const TYPE_OPTIONS = [
  { value: 'event', label: 'Event' },
  { value: 'holiday', label: 'Public Holiday' },
  { value: 'break', label: 'School Break' },
  { value: 'term_start', label: 'Term Start' },
  { value: 'term_end', label: 'Term End' },
];
const TYPE_LABEL = TYPE_OPTIONS.reduce((acc, t) => { acc[t.value] = t.label; return acc; }, {});
const REMINDERS = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'When it starts' },
  { value: '15', label: '15 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
  { value: '10080', label: '1 week before' },
];
const AUDIENCE_ROLES = [['staff', 'Staff'], ['parent', 'Parents'], ['student', 'Students']];

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

export function describeAudience(audience, classes = []) {
  if (!audience || audience.everyone) return 'Everyone';
  const roles = (audience.roles || []).map(role => AUDIENCE_ROLES.find(([key]) => key === role)?.[1] || role);
  const classNames = (audience.classIds || []).map(id => classes.find(item => item.id === id)?.name || 'a class');
  return [roles.join(', '), classNames.length ? `in ${classNames.join(', ')}` : ''].filter(Boolean).join(' ');
}

const CURRENT_YEAR = new Date().getFullYear();
const EMPTY_FORM = { title: '', type: 'event', startDate: '', endDate: '', startTime: '', endTime: '', location: '', description: '', reminderMinutes: '', roles: [], classIds: [], recurringAnnual: false };

export default function SchoolCalendarBoard() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [classes, setClasses] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [cancelling, setCancelling] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  const set = patch => setForm(current => ({ ...current, ...patch }));

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
  useEffect(() => {
    if (!canManage) return;
    getClasses().then(data => setClasses((data?.classes || data || []).map(item => ({ id: item.id, name: `${item.name}${item.arm ? ` ${item.arm}` : ''}` })))).catch(() => {});
  }, [canManage]);

  function startEdit(event) {
    setEditingId(event.id);
    setForm({
      title: event.title, type: event.type, startDate: event.startDate, endDate: event.endDate, startTime: event.startTime, endTime: event.endTime,
      location: event.location, description: event.description, reminderMinutes: event.reminderMinutes == null ? '' : String(event.reminderMinutes),
      roles: event.audience?.roles || [], classIds: event.audience?.classIds || [], recurringAnnual: event.recurringAnnual,
    });
  }

  async function handleSave() {
    if (!form.title.trim() || !form.startDate) { showToast('Title and start date are required.'); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(), type: form.type, startDate: form.startDate, endDate: form.endDate || form.startDate,
      startTime: form.startTime, endTime: form.endTime, location: form.location, description: form.description,
      reminderMinutes: form.reminderMinutes === '' ? null : Number(form.reminderMinutes),
      audience: { roles: form.roles, classIds: form.classIds }, recurringAnnual: form.recurringAnnual,
    };
    try {
      if (editingId) await updateCalendarEvent(editingId, payload); else await addCalendarEvent(payload);
      showToast(editingId ? 'Event updated.' : 'Calendar entry published.');
      setForm(EMPTY_FORM);
      setEditingId('');
      load();
    } catch (e) { showToast(e.message || 'Could not save entry.'); } finally { setSaving(false); }
  }

  async function confirmCancel() {
    try {
      await deleteCalendarEvent(cancelling.id, cancelling.reason);
      showToast('Event cancelled. It stays on record.');
      setCancelling(null);
      load();
    } catch (e) { showToast(e.message || 'Could not cancel entry.'); }
  }

  const toggle = (key, value) => set({ [key]: form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value] });

  return (
    <div className="space-y-4">
      {toast && <div role="status" className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#b5e3f4] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#800000]">School Calendar</h2>
            <p className="text-sm text-[#191970] mt-1">Events appear on the dashboards of the people they are for. Public holidays and breaks also stop staff and students being marked absent.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous year" onClick={() => setYear(y => y - 1)} className="rounded-xl border border-[#c9a96e]/40 px-3 py-2 text-[#800020] font-bold">‹</button>
            <span className="text-lg font-bold text-[#800000] w-16 text-center">{year}</span>
            <button type="button" aria-label="Next year" onClick={() => setYear(y => y + 1)} className="rounded-xl border border-[#c9a96e]/40 px-3 py-2 text-[#800020] font-bold">›</button>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className={CARD}>
          <h3 className="text-base font-bold text-[#800000] mb-3">{editingId ? 'Edit calendar entry' : 'Add an event, holiday or break'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className={LABEL}>Title<input value={form.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. PTA Meeting" className={`${INPUT} w-full mt-1`} /></label>
            <label className={LABEL}>Type
              <select value={form.type} onChange={e => set({ type: e.target.value })} className={`${INPUT} w-full mt-1`}>
                {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className={LABEL}>Location<input value={form.location} onChange={e => set({ location: e.target.value })} placeholder="Optional" className={`${INPUT} w-full mt-1`} /></label>
            <label className={LABEL}>Start date<input type="date" value={form.startDate} onChange={e => set({ startDate: e.target.value })} className={`${INPUT} w-full mt-1`} /></label>
            <label className={LABEL}>End date (optional)<input type="date" value={form.endDate} onChange={e => set({ endDate: e.target.value })} className={`${INPUT} w-full mt-1`} /></label>
            <label className={LABEL}>Reminder
              <select value={form.reminderMinutes} onChange={e => set({ reminderMinutes: e.target.value })} className={`${INPUT} w-full mt-1`}>
                {REMINDERS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className={LABEL}>Starts at (optional)<input type="time" value={form.startTime} onChange={e => set({ startTime: e.target.value })} className={`${INPUT} w-full mt-1`} /></label>
            <label className={LABEL}>Ends at (optional)<input type="time" value={form.endTime} onChange={e => set({ endTime: e.target.value })} className={`${INPUT} w-full mt-1`} /></label>
            <label className="flex items-center gap-2 text-sm text-[#191970]"><input type="checkbox" checked={form.recurringAnnual} onChange={e => set({ recurringAnnual: e.target.checked })} /> Repeats every year</label>
            <label className={`${LABEL} md:col-span-2 lg:col-span-3`}>Details<textarea rows={2} value={form.description} onChange={e => set({ description: e.target.value })} className={`${INPUT} w-full mt-1`} /></label>
          </div>
          <fieldset className="mt-3">
            <legend className={LABEL}>Who should see it (leave everything unticked for everyone)</legend>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-[#191970]">
              {AUDIENCE_ROLES.map(([key, label]) => <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={form.roles.includes(key)} onChange={() => toggle('roles', key)} />{label}</label>)}
            </div>
            {classes.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-[#191970]">Only certain classes ({form.classIds.length || 'all'})</summary>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-[#191970]">
                  {classes.map(item => <label key={item.id} className="flex items-center gap-1"><input type="checkbox" checked={form.classIds.includes(item.id)} onChange={() => toggle('classIds', item.id)} />{item.name}</label>)}
                </div>
              </details>
            )}
          </fieldset>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleSave} disabled={saving} className={BTN}>{saving ? 'Saving…' : editingId ? 'Save changes' : '+ Publish entry'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(''); setForm(EMPTY_FORM); }} className="rounded-2xl px-4 py-2 text-sm font-bold text-[#800020]">Cancel editing</button>}
          </div>
          <p className="text-xs text-[#191970] mt-2">Only <strong>Public Holiday</strong> and <strong>School Break</strong> entries suppress absence marking.</p>
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
            {events.map(ev => {
              const cancelled = ev.status === 'cancelled';
              return (
                <div key={ev.id} className={`${INNER} flex flex-wrap items-center justify-between gap-3 ${cancelled ? 'opacity-70' : ''}`}>
                  <div className="min-w-0">
                    <p className={`text-[#191970] font-semibold ${cancelled ? 'line-through' : ''}`}>{ev.title} {ev.recurringAnnual ? <span className="text-[10px] text-[#800020]">(yearly)</span> : null}</p>
                    <p className="text-xs text-[#800020]">
                      {formatDate(ev.startDate)}{ev.endDate && ev.endDate !== ev.startDate ? ` – ${formatDate(ev.endDate)}` : ''}
                      {ev.startTime ? ` · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}` : ''}{ev.location ? ` · ${ev.location}` : ''}
                    </p>
                    <p className="text-xs text-[#191970]">For: {describeAudience(ev.audience, classes)}{ev.reminderMinutes != null ? ` · Reminder ${REMINDERS.find(r => r.value === String(ev.reminderMinutes))?.label.toLowerCase()}` : ''}</p>
                    {cancelled && <p className="text-xs font-semibold text-red-700">Cancelled{ev.cancelReason ? `: ${ev.cancelReason}` : ''}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeBadge(ev.type)}`}>{TYPE_LABEL[ev.type] || ev.type}</span>
                    {canManage && !cancelled && ev.source === 'school' ? (
                      <>
                        <button type="button" onClick={() => startEdit(ev)} className="text-[#191970] text-xs font-bold hover:underline">Edit</button>
                        <button type="button" onClick={() => setCancelling({ id: ev.id, title: ev.title, reason: '' })} className="text-red-700 text-xs font-bold hover:underline">Cancel</button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancelling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191970]/60 p-4" role="dialog" aria-modal="true" aria-label="Cancel event">
          <div className="w-full max-w-md rounded-3xl bg-[#b5e3f4] p-5">
            <h3 className="text-lg font-bold text-[#800000]">Cancel “{cancelling.title}”?</h3>
            <p className="mt-1 text-sm text-[#191970]">It disappears from dashboards but stays on record with your reason.</p>
            <label className={`${LABEL} mt-3 block`}>Reason (optional)<input value={cancelling.reason} onChange={e => setCancelling(current => ({ ...current, reason: e.target.value }))} className={`${INPUT} w-full mt-1`} /></label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={confirmCancel} className="rounded-2xl bg-[#800000] px-4 py-2 text-sm font-bold text-white">Cancel event</button>
              <button type="button" onClick={() => setCancelling(null)} className="rounded-2xl px-4 py-2 text-sm font-bold text-[#800020]">Keep it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
