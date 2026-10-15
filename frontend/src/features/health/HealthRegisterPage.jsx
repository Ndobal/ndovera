import React, { useCallback, useEffect, useState } from 'react';
import {
  getHealthContext, getHealthIncident, getStudentHealth, listHealthIncidents, saveHealthProfile, setHealthRest, updateHealthIncident, uploadHealthPhoto,
} from './healthApi';
import {
  CATEGORY_LABELS, FIELD, HealthPhoto, IncidentCard, IncidentForm, LABEL, OUTCOME_LABELS, SEVERITY_LABELS, StudentPicker, when,
} from './healthShared';

// The school nurse's register (the Owner and HoS see it all, and manage it when there is no nurse):
// the sick bay now, the full register, and each student's history and health profile.

const TABS = [['now', 'Sick bay now'], ['register', 'Register'], ['follow_up', 'Follow-ups'], ['students', 'Student history']];

function minutesSince(value) {
  if (!value) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
}

function ManageRecord({ incidentId, canManage, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const result = await getHealthIncident(incidentId);
    setData(result);
    const item = result.incident;
    setForm({
      severity: item.severity, temperature: item.temperature, firstAidGiven: item.firstAidGiven, medication: item.medication, outcome: item.outcome,
      parentNotified: Boolean(item.parentNotifiedAt), parentNotifiedHow: item.parentNotifiedHow, followUpNeeded: item.followUpNeeded,
      followUpDate: item.followUpDate, followUpNotes: item.followUpNotes, followUpDone: Boolean(item.followUpDoneAt), nurseNotes: item.nurseNotes,
    });
  }, [incidentId]);
  useEffect(() => { load().catch(err => setError(err.message)); }, [load]);
  // Keep the rest timer moving.
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(timer); }, []);

  async function act(work) {
    setBusy(true); setError('');
    try { await work(); await load(); onChanged(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!data || !form) return <div className="rounded-3xl bg-white p-4 text-sm">{error || 'Loading…'}</div>;
  const item = data.incident;
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const resting = item.restStartedAt && !item.restEndedAt;

  return (
    <section className="space-y-3 rounded-3xl border-2 border-[#c9a96e] bg-white p-4 text-[#191970] shadow-lg dark:bg-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1">
          <h2 className="text-xl font-black text-[#800000] dark:text-amber-200">{item.studentName} <span className="text-sm font-semibold text-slate-500">{item.className}</span></h2>
          <p className="text-sm"><b>{item.complaint}</b> · {CATEGORY_LABELS[item.category]} · {when(item.occurredAt)}{item.location ? ` · ${item.location}` : ''}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">Reported by {item.reportedByName || 'staff'}{item.handledByName ? ` · handled by ${item.handledByName}` : ''}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl bg-[#800020] px-3 py-1.5 text-xs font-bold text-[#b5e3f4]">Close</button>
      </div>

      {data.profile && (data.profile.allergies || data.profile.conditions) ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-900"><b>Health profile:</b> {data.profile.allergies ? `Allergies: ${data.profile.allergies}. ` : ''}{data.profile.conditions ? `Conditions: ${data.profile.conditions}.` : ''}</p>
      ) : null}
      {item.description ? <p className="text-sm"><b>Details:</b> {item.description}</p> : null}

      {!canManage ? (
        <>
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">The school nurse manages health records. You can see everything here.</p>
          <IncidentCard incident={item} showStudent={false} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#b5e3f4] p-3 text-sm">
            <span className="flex-1 font-bold">
              Rest in the sick bay: {item.restStartedAt ? `${resting ? minutesSince(item.restStartedAt) : item.restMinutes} min${resting ? ' so far' : ''}` : 'not started'}
            </span>
            {!resting ? <button type="button" disabled={busy} onClick={() => act(() => setHealthRest(item.id, 'start'))} className="rounded-xl bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-white">{item.restStartedAt ? 'Rest again' : 'Start rest'}</button>
              : <button type="button" disabled={busy} onClick={() => act(() => setHealthRest(item.id, 'end'))} className="rounded-xl bg-[#800020] px-3 py-1.5 text-xs font-bold text-[#b5e3f4]">End rest</button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={LABEL}>Severity<select value={form.severity} onChange={set('severity')} className={FIELD}>{Object.entries(SEVERITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className={LABEL}>Temperature (°C)<input value={form.temperature} onChange={set('temperature')} className={FIELD} /></label>
            <label className={`${LABEL} sm:col-span-2`}>First aid / treatment<textarea value={form.firstAidGiven} onChange={set('firstAidGiven')} rows={2} className={FIELD} /></label>
            <label className={`${LABEL} sm:col-span-2`}>Medication given (name, dose, time)<input value={form.medication} onChange={set('medication')} placeholder="e.g. Paracetamol 250 mg at 10:30" className={FIELD} /></label>
            <label className={LABEL}>Outcome<select value={form.outcome} onChange={set('outcome')} className={FIELD}><option value="">Not decided yet</option>{Object.entries(OUTCOME_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.parentNotified} onChange={set('parentNotified')} /> Parent informed</label>
              <input value={form.parentNotifiedHow} onChange={set('parentNotifiedHow')} placeholder="How (phone call, in person…)" className={FIELD} />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={form.followUpNeeded} onChange={set('followUpNeeded')} /> Follow-up needed</label>
            {form.followUpNeeded ? (
              <>
                <label className={LABEL}>Follow up by<input type="date" value={form.followUpDate} onChange={set('followUpDate')} className={FIELD} /></label>
                <label className="flex items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" checked={form.followUpDone} onChange={set('followUpDone')} /> Follow-up done</label>
                <label className={`${LABEL} sm:col-span-2`}>Follow-up notes<input value={form.followUpNotes} onChange={set('followUpNotes')} className={FIELD} /></label>
              </>
            ) : null}
            <label className={`${LABEL} sm:col-span-2`}>Nurse&apos;s notes (not shown to parents)<textarea value={form.nurseNotes} onChange={set('nurseNotes')} rows={2} className={FIELD} /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => act(() => updateHealthIncident(item.id, form))} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-black text-white disabled:opacity-60">Save</button>
            <button type="button" disabled={busy} onClick={() => act(() => updateHealthIncident(item.id, { ...form, status: 'closed' }))} className="rounded-2xl bg-[#191970] px-4 py-2 text-sm font-black text-[#c9a96e] disabled:opacity-60">Save and close record</button>
            <label className="cursor-pointer rounded-2xl bg-[#c9a96e] px-4 py-2 text-sm font-black text-[#191970]">
              Add photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) act(() => uploadHealthPhoto(item.id, file)); event.target.value = ''; }} />
            </label>
          </div>
        </>
      )}
      {item.photos?.length ? <div className="flex flex-wrap gap-2">{item.photos.map(photo => <HealthPhoto key={photo.id} url={photo.url} />)}</div> : null}
      {error ? <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p> : null}
    </section>
  );
}

function StudentHistory({ canManage }) {
  const [student, setStudent] = useState(null);
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!student) { setData(null); return; }
    getStudentHealth(student.id).then(result => { setData(result); setProfile(result.profile); }).catch(err => setMessage(err.message));
  }, [student]);
  const set = key => event => setProfile(current => ({ ...current, [key]: event.target.value }));
  return (
    <div className="space-y-3">
      <StudentPicker value={student} onChange={value => { setStudent(value); setMessage(''); }} />
      {data && profile ? (
        <>
          <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#fff8ef] p-4 dark:bg-slate-900/50">
            <h3 className="mb-2 font-black text-[#800000]">Health profile</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={LABEL}>Blood group<input value={profile.bloodGroup} onChange={set('bloodGroup')} disabled={!canManage} className={FIELD} /></label>
              <label className={LABEL}>Genotype<input value={profile.genotype} onChange={set('genotype')} disabled={!canManage} className={FIELD} /></label>
              <label className={`${LABEL} sm:col-span-2`}>Allergies<input value={profile.allergies} onChange={set('allergies')} disabled={!canManage} className={FIELD} /></label>
              <label className={`${LABEL} sm:col-span-2`}>Medical conditions<input value={profile.conditions} onChange={set('conditions')} disabled={!canManage} className={FIELD} /></label>
              <label className={`${LABEL} sm:col-span-2`}>Regular medication<input value={profile.medications} onChange={set('medications')} disabled={!canManage} className={FIELD} /></label>
              <label className={`${LABEL} sm:col-span-2`}>Notes<textarea value={profile.notes} onChange={set('notes')} disabled={!canManage} rows={2} className={FIELD} /></label>
            </div>
            {canManage ? <button type="button" onClick={() => saveHealthProfile(student.id, profile).then(() => setMessage('Health profile saved.')).catch(err => setMessage(err.message))} className="mt-2 rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-white">Save profile</button> : null}
          </section>
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#800020]">{data.incidents.length} record{data.incidents.length === 1 ? '' : 's'}</h3>
          {data.incidents.map(incident => <IncidentCard key={incident.id} incident={incident} showStudent={false} />)}
        </>
      ) : null}
      {message ? <p className="text-sm font-semibold text-[#1a5c38]">{message}</p> : null}
    </div>
  );
}

export default function HealthRegisterPage() {
  const [context, setContext] = useState(null);
  const [tab, setTab] = useState('now');
  const [incidents, setIncidents] = useState([]);
  const [range, setRange] = useState({ from: '', to: '' });
  const [open, setOpen] = useState('');
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (tab === 'students') return Promise.resolve();
    const filters = tab === 'now' ? { status: 'open' } : tab === 'follow_up' ? { status: 'follow_up' } : { from: range.from, to: range.to };
    return listHealthIncidents(filters).then(data => setIncidents(data.incidents || [])).catch(err => setError(err.message));
  }, [tab, range]);
  useEffect(() => { getHealthContext().then(setContext).catch(err => setError(err.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const canManage = Boolean(context?.canManage);
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      <header className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-[#191970] text-white">
        <div className="h-1.5 bg-gradient-to-r from-[#800000] via-[#c9a96e] to-[#1a5c38]" />
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a96e]">School health</p>
            <h1 className="text-2xl font-black">🩺 Sick bay & first-aid register</h1>
            <p className="text-sm text-[#b5e3f4]">{context?.hasNurse ? (canManage ? 'You manage the school’s health records.' : 'The school nurse manages these records; you can see them all.') : 'There is no school nurse on Ndovera, so the Owner and Head of School manage these records.'}</p>
          </div>
          <button type="button" onClick={() => setRecording(value => !value)} className="rounded-full bg-[#c9a96e] px-5 py-2 text-sm font-black text-[#191970]">{recording ? 'Close' : '+ Record first aid'}</button>
        </div>
      </header>
      {error ? <p role="alert" className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900">{error}</p> : null}
      {recording ? <IncidentForm title="Record first aid / a sick-bay visit" onSaved={id => { setRecording(false); setTab('now'); setOpen(id); load(); }} /> : null}
      {open ? <ManageRecord incidentId={open} canManage={canManage} onClose={() => setOpen('')} onChanged={load} /> : null}

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#191970]'}`}>{label}</button>
        ))}
      </div>
      {tab === 'register' ? (
        <div className="flex flex-wrap gap-2">
          <label className={LABEL}>From<input type="date" value={range.from} onChange={event => setRange(current => ({ ...current, from: event.target.value }))} className={FIELD} /></label>
          <label className={LABEL}>To<input type="date" value={range.to} onChange={event => setRange(current => ({ ...current, to: event.target.value }))} className={FIELD} /></label>
        </div>
      ) : null}
      {tab === 'students' ? <StudentHistory canManage={canManage} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {incidents.map(incident => <IncidentCard key={incident.id} incident={incident} onOpen={item => setOpen(item.id)} />)}
          {!incidents.length ? <p className="text-sm text-slate-600">{tab === 'now' ? 'Nobody is in the sick bay or awaiting care.' : tab === 'follow_up' ? 'No follow-ups pending.' : 'No records in this period.'}</p> : null}
        </div>
      )}
    </div>
  );
}
