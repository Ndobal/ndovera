import React, { useCallback, useEffect, useState } from 'react';
import {
  getAmiChampionship,
  listAmiChampionships,
  saveAmiChampionship,
  setAmiChampionshipStatus,
} from '../../../features/championships/services/championshipApi';
import { formatDate, naira } from '../../../features/championships/championshipUi';
import AmiQuestionModeration from '../../../features/championships/AmiQuestionModeration';

// Ami's championship workspace (championship.md §2, §3, §4). Everything a competition needs is
// configuration, so Ami can launch "Spelling Bee 2027" or "National Essay Championship" with
// no developer involvement — only the rules, stages and eligibility differ.

const input = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#fff8ee] px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const label = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';
const panel = 'rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-4 dark:border-white/10 dark:bg-slate-800/40';

const STAGE_KINDS = [
  'registration', 'screening', 'qualifier', 'preliminary', 'round', 'quarter_final',
  'semi_final', 'final', 'physical_round', 'interview', 'presentation', 'judging',
  'winner_selection', 'awards',
];

const SCOPES = [
  ['inter_school', 'Inter-school'], ['school_only', 'School only'], ['regional', 'Regional'],
  ['national', 'National'], ['independent', 'Independent only'],
];
const MODES = [['online', 'Online'], ['physical', 'Physical'], ['hybrid', 'Hybrid']];

const EMPTY = {
  id: '', name: '', category: 'Mathematics', subject: '', summary: '', description: '',
  rules: '', terms: '', coverUrl: '', flyerUrl: '', scope: 'inter_school', mode: 'online',
  minAge: '', maxAge: '', ageAsOf: '', classLevelsText: '', geoStatesText: '',
  allowIndependent: true, allowSchoolStudents: true, maxParticipants: '',
  registrationOpensAt: '', registrationClosesAt: '', competitionDate: '', competitionTime: '',
  registrationFee: '', prizeStructure: '', scholarshipNote: '', sponsorName: '',
  contactEmail: '', contactPhone: '', promoEnabled: true,
};

const DEFAULT_STAGES = [
  { name: 'Registration', kind: 'registration', startsAt: '', endsAt: '', instructions: '', isPublic: true },
  { name: 'Preliminary Round', kind: 'preliminary', startsAt: '', endsAt: '', instructions: '', isPublic: true },
  { name: 'Semi Final', kind: 'semi_final', startsAt: '', endsAt: '', instructions: '', isPublic: true },
  { name: 'Final', kind: 'final', startsAt: '', endsAt: '', instructions: '', isPublic: true },
];

function toForm(championship) {
  if (!championship) return { ...EMPTY };
  return {
    ...EMPTY,
    ...championship,
    minAge: championship.minAge ?? '',
    maxAge: championship.maxAge ?? '',
    maxParticipants: championship.maxParticipants || '',
    registrationFee: championship.registrationFee || '',
    classLevelsText: (championship.classLevels || []).join(', '),
    geoStatesText: (championship.geoStates || []).join(', '),
  };
}

function toPayload(form, stages) {
  return {
    ...form,
    classLevels: form.classLevelsText.split(',').map(item => item.trim()).filter(Boolean),
    geoStates: form.geoStatesText.split(',').map(item => item.trim()).filter(Boolean),
    stages,
  };
}

function StageBuilder({ stages, onChange }) {
  function update(index, patch) {
    onChange(stages.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)));
  }
  function move(index, delta) {
    const next = [...stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">Competition Format</p>
        <button
          type="button"
          onClick={() => onChange([...stages, { name: '', kind: 'round', startsAt: '', endsAt: '', instructions: '', isPublic: true }])}
          className="rounded-xl bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-white"
        >
          + Add stage
        </button>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#191970]/80 dark:text-slate-400">
        The sequence a participant moves through. Order matters — this is what the public page shows.
      </p>

      <div className="mt-3 space-y-3">
        {stages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#c9a96e]/60 px-4 py-6 text-center text-xs text-[#800020] dark:text-slate-400">
            No stages yet. A championship needs at least one stage before it can be published.
          </p>
        ) : null}

        {stages.map((stage, index) => (
          <div key={index} className="rounded-xl border border-[#c9a96e]/40 bg-white p-3 dark:border-white/10 dark:bg-slate-900/50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#191970] px-2.5 py-1 text-xs font-bold text-white">{index + 1}</span>
              <input
                className={`${input} mt-0 flex-1`}
                value={stage.name}
                onChange={e => update(index, { name: e.target.value })}
                placeholder="Stage name, e.g. Quarter Final"
              />
              <select className={`${input} mt-0 w-40`} value={stage.kind} onChange={e => update(index, { kind: e.target.value })}>
                {STAGE_KINDS.map(kind => <option key={kind} value={kind}>{kind.replace(/_/g, ' ')}</option>)}
              </select>
              <button type="button" onClick={() => move(index, -1)} className="rounded-lg border border-[#c9a96e]/50 px-2 py-1 text-xs font-bold" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(index, 1)} className="rounded-lg border border-[#c9a96e]/50 px-2 py-1 text-xs font-bold" aria-label="Move down">↓</button>
              <button type="button" onClick={() => onChange(stages.filter((_, i) => i !== index))} className="rounded-lg border border-[#800020]/40 px-2 py-1 text-xs font-bold text-[#800020]" aria-label="Remove stage">✕</button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block"><span className={label}>Starts</span>
                <input type="date" className={input} value={stage.startsAt || ''} onChange={e => update(index, { startsAt: e.target.value })} /></label>
              <label className="block"><span className={label}>Ends</span>
                <input type="date" className={input} value={stage.endsAt || ''} onChange={e => update(index, { endsAt: e.target.value })} /></label>
            </div>
            <label className="mt-2 block"><span className={label}>Instructions for this stage</span>
              <textarea rows={2} className={`${input} resize-none`} value={stage.instructions || ''} onChange={e => update(index, { instructions: e.target.value })} /></label>
            <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#191970] dark:text-slate-300">
              <input type="checkbox" checked={stage.isPublic !== false} onChange={e => update(index, { isPublic: e.target.checked })} />
              Show this stage on the public championship page
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AmiChampionshipsPage() {
  const [championships, setChampionships] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [registrations, setRegistrations] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAmiChampionships();
      setChampionships(Array.isArray(data?.championships) ? data.championships : []);
      setCategories(Array.isArray(data?.categories) ? data.categories : []);
      setError('');
    } catch (loadError) {
      setChampionships([]);
      setError(loadError.message || 'Could not load championships.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startNew() {
    setEditing('new');
    setForm({ ...EMPTY });
    setStages(DEFAULT_STAGES);
    setRegistrations([]);
    setMessage('');
    setError('');
  }

  async function startEdit(championship) {
    setEditing(championship.id);
    setForm(toForm(championship));
    setMessage('');
    setError('');
    try {
      const detail = await getAmiChampionship(championship.id);
      setStages(Array.isArray(detail?.stages) && detail.stages.length ? detail.stages : DEFAULT_STAGES);
      setRegistrations(Array.isArray(detail?.registrations) ? detail.registrations : []);
    } catch {
      setStages(DEFAULT_STAGES);
      setRegistrations([]);
    }
  }

  async function save(event) {
    event.preventDefault();
    setBusy('save');
    setMessage('');
    setError('');
    try {
      const result = await saveAmiChampionship(toPayload(form, stages));
      setMessage(`Saved "${result.championship.name}".`);
      setForm(toForm(result.championship));
      setEditing(result.championship.id);
      await load();
    } catch (saveError) {
      setError(saveError.message || 'Could not save this championship.');
    } finally {
      setBusy('');
    }
  }

  async function changeStatus(championship, status) {
    setBusy(`status-${championship.id}`);
    setMessage('');
    setError('');
    try {
      await setAmiChampionshipStatus(championship.id, status);
      setMessage(status === 'published'
        ? `"${championship.name}" is live. It now appears on the public championships page and promotes once to each user.`
        : `"${championship.name}" moved to ${status}.`);
      await load();
    } catch (statusError) {
      setError(statusError.message || 'Could not change the status.');
    } finally {
      setBusy('');
    }
  }

  const set = patch => setForm(current => ({ ...current, ...patch }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-white/10 bg-[#b5e3f4] p-6 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#800020] dark:text-slate-400">🏆 NDOVERA Championships</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#800000] dark:text-slate-100">Championship engine</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-[#191970] dark:text-slate-300">
          One engine runs every competition. Create a championship, set who can enter, build the stage
          sequence, then publish. Publishing puts it on the public championships page and shows a
          dismissible promo card once to each signed-in user.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={startNew} className="rounded-2xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#670019]">
            + Create championship
          </button>
          <a href="/championships" target="_blank" rel="noreferrer" className="rounded-2xl border border-[#191970]/25 bg-white/70 px-5 py-2.5 text-sm font-bold text-[#191970] dark:border-white/20 dark:bg-slate-800 dark:text-slate-100">
            View public page
          </a>
        </div>
      </section>

      {message ? <p className="rounded-2xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-3 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      <AmiQuestionModeration />

      <section className="rounded-3xl border border-[#c9a96e]/45 bg-[#fff8ee] p-5 dark:border-white/10 dark:bg-slate-900/40">
        <h2 className="text-lg font-black text-[#800000] dark:text-slate-100">All championships</h2>

        {loading ? <p className="mt-3 text-sm text-[#800020] dark:text-slate-400">Loading…</p> : null}

        {!loading && championships.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-[#c9a96e]/70 px-6 py-10 text-center">
            <p className="text-4xl" aria-hidden="true">🏆</p>
            <p className="mt-3 text-lg font-black text-[#191970] dark:text-slate-100">No competition is created</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#191970] dark:text-slate-300">
              Nothing has been created yet. Use “Create championship” above to set up the first one —
              schools, parents and students see the same message until you publish.
            </p>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {championships.map(championship => (
            <div key={championship.id} className="rounded-2xl border border-[#c9a96e]/40 bg-white p-4 dark:border-white/10 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-black text-[#191970] dark:text-slate-100">{championship.name}</p>
                  <p className="mt-0.5 text-xs text-[#4a5578] dark:text-slate-400">
                    {[championship.category, formatDate(championship.competitionDate), championship.registrationFee > 0 ? naira.format(championship.registrationFee) : 'Free'].filter(Boolean).join(' • ')}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                  championship.status === 'published' ? 'bg-[#1a5c38] text-white'
                    : championship.status === 'live' ? 'bg-[#800020] text-[#b5e3f4]'
                    : championship.status === 'completed' ? 'bg-[#191970] text-white'
                    : 'bg-[#c9a96e] text-[#191970]'
                }`}>{championship.status}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => startEdit(championship)} className="rounded-xl border border-[#191970]/25 px-4 py-2 text-sm font-bold text-[#191970] dark:border-white/20 dark:text-slate-100">
                  Configure
                </button>
                {championship.status === 'draft' || championship.status === 'archived' ? (
                  <button type="button" disabled={busy === `status-${championship.id}`} onClick={() => changeStatus(championship, 'published')} className="rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    Publish
                  </button>
                ) : null}
                {championship.status === 'published' ? (
                  <>
                    <button type="button" disabled={busy === `status-${championship.id}`} onClick={() => changeStatus(championship, 'live')} className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50">
                      Mark live
                    </button>
                    <button type="button" disabled={busy === `status-${championship.id}`} onClick={() => changeStatus(championship, 'draft')} className="rounded-xl border border-[#800020]/40 px-4 py-2 text-sm font-bold text-[#800020] disabled:opacity-50">
                      Unpublish
                    </button>
                  </>
                ) : null}
                {championship.status === 'live' ? (
                  <button type="button" disabled={busy === `status-${championship.id}`} onClick={() => changeStatus(championship, 'completed')} className="rounded-xl bg-[#191970] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    Mark completed
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {editing ? (
        <form onSubmit={save} className="space-y-4 rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black text-[#800000] dark:text-slate-100">
              {editing === 'new' ? 'Create championship' : `Configure: ${form.name}`}
            </h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-[#191970]/25 px-4 py-2 text-sm font-bold text-[#191970] dark:border-white/20 dark:text-slate-100">
              Close
            </button>
          </div>

          <div className={panel}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">Basic information</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2"><span className={label}>Championship name</span>
                <input required className={input} value={form.name} onChange={e => set({ name: e.target.value })} placeholder="NDOVERA National Mathematics Championship 2026" /></label>
              <label className="block"><span className={label}>Category</span>
                <select className={input} value={form.category} onChange={e => set({ category: e.target.value })}>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select></label>
              <label className="block"><span className={label}>Subject (optional)</span>
                <input className={input} value={form.subject} onChange={e => set({ subject: e.target.value })} /></label>
              <label className="block md:col-span-2"><span className={label}>Short summary — shown on cards and the promo</span>
                <textarea rows={2} className={`${input} resize-none`} value={form.summary} onChange={e => set({ summary: e.target.value })} /></label>
              <label className="block md:col-span-2"><span className={label}>Full description</span>
                <textarea rows={5} className={`${input} resize-none`} value={form.description} onChange={e => set({ description: e.target.value })} /></label>
              <label className="block"><span className={label}>Cover image URL</span>
                <input className={input} value={form.coverUrl} onChange={e => set({ coverUrl: e.target.value })} placeholder="https://…" /></label>
              <label className="block"><span className={label}>Flyer image URL</span>
                <input className={input} value={form.flyerUrl} onChange={e => set({ flyerUrl: e.target.value })} placeholder="https://…" /></label>
            </div>
          </div>

          <StageBuilder stages={stages} onChange={setStages} />

          <div className={panel}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">Eligibility</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="block"><span className={label}>Minimum age</span>
                <input type="number" min="0" className={input} value={form.minAge} onChange={e => set({ minAge: e.target.value })} /></label>
              <label className="block"><span className={label}>Maximum age</span>
                <input type="number" min="0" className={input} value={form.maxAge} onChange={e => set({ maxAge: e.target.value })} /></label>
              <label className="block"><span className={label}>Age measured as of</span>
                <input type="date" className={input} value={form.ageAsOf} onChange={e => set({ ageAsOf: e.target.value })} /></label>
              <label className="block md:col-span-3"><span className={label}>Eligible classes (comma separated)</span>
                <input className={input} value={form.classLevelsText} onChange={e => set({ classLevelsText: e.target.value })} placeholder="JSS 1, JSS 2, JSS 3" /></label>
              <label className="block md:col-span-3"><span className={label}>Eligible states (comma separated, blank = anywhere)</span>
                <input className={input} value={form.geoStatesText} onChange={e => set({ geoStatesText: e.target.value })} placeholder="Enugu, Lagos" /></label>
              <label className="block"><span className={label}>Maximum participants (0 = no cap)</span>
                <input type="number" min="0" className={input} value={form.maxParticipants} onChange={e => set({ maxParticipants: e.target.value })} /></label>
              <label className="block"><span className={label}>Scope</span>
                <select className={input} value={form.scope} onChange={e => set({ scope: e.target.value })}>
                  {SCOPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select></label>
              <label className="block"><span className={label}>Format</span>
                <select className={input} value={form.mode} onChange={e => set({ mode: e.target.value })}>
                  {MODES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select></label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#191970] dark:text-slate-300">
                <input type="checkbox" checked={form.allowSchoolStudents} onChange={e => set({ allowSchoolStudents: e.target.checked })} />
                Open to NDOVERA school students
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#191970] dark:text-slate-300">
                <input type="checkbox" checked={form.allowIndependent} onChange={e => set({ allowIndependent: e.target.checked })} />
                Open to independent participants
              </label>
            </div>
          </div>

          <div className={panel}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">Schedule and entry</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block"><span className={label}>Registration opens</span>
                <input type="date" className={input} value={form.registrationOpensAt} onChange={e => set({ registrationOpensAt: e.target.value })} /></label>
              <label className="block"><span className={label}>Registration closes</span>
                <input type="date" className={input} value={form.registrationClosesAt} onChange={e => set({ registrationClosesAt: e.target.value })} /></label>
              <label className="block"><span className={label}>Competition date</span>
                <input type="date" className={input} value={form.competitionDate} onChange={e => set({ competitionDate: e.target.value })} /></label>
              <label className="block"><span className={label}>Time</span>
                <input type="time" className={input} value={form.competitionTime} onChange={e => set({ competitionTime: e.target.value })} /></label>
              <label className="block"><span className={label}>Registration fee (₦, 0 = free)</span>
                <input type="number" min="0" className={input} value={form.registrationFee} onChange={e => set({ registrationFee: e.target.value })} /></label>
              <label className="block"><span className={label}>Sponsor name</span>
                <input className={input} value={form.sponsorName} onChange={e => set({ sponsorName: e.target.value })} /></label>
            </div>
          </div>

          <div className={panel}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">Rules, prizes and contact</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2"><span className={label}>Rules</span>
                <textarea rows={4} className={`${input} resize-none`} value={form.rules} onChange={e => set({ rules: e.target.value })} /></label>
              <label className="block md:col-span-2"><span className={label}>Prize structure</span>
                <textarea rows={3} className={`${input} resize-none`} value={form.prizeStructure} onChange={e => set({ prizeStructure: e.target.value })} /></label>
              <label className="block md:col-span-2"><span className={label}>Scholarship opportunities</span>
                <textarea rows={3} className={`${input} resize-none`} value={form.scholarshipNote} onChange={e => set({ scholarshipNote: e.target.value })} /></label>
              <label className="block md:col-span-2"><span className={label}>Terms and conditions</span>
                <textarea rows={3} className={`${input} resize-none`} value={form.terms} onChange={e => set({ terms: e.target.value })} /></label>
              <label className="block"><span className={label}>Contact email</span>
                <input className={input} value={form.contactEmail} onChange={e => set({ contactEmail: e.target.value })} /></label>
              <label className="block"><span className={label}>Contact phone</span>
                <input className={input} value={form.contactPhone} onChange={e => set({ contactPhone: e.target.value })} /></label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#191970] dark:text-slate-300">
              <input type="checkbox" checked={form.promoEnabled} onChange={e => set({ promoEnabled: e.target.checked })} />
              Show the promotional card to signed-in users when this is published
            </label>
          </div>

          {registrations.length > 0 ? (
            <div className={panel}>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">
                Registrations ({registrations.length})
              </p>
              <div className="mt-3 max-h-64 overflow-y-auto">
                <table className="w-full min-w-[30rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#c9a96e]/40 text-xs uppercase tracking-wide text-[#800020] dark:text-slate-400">
                      <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Participant</th>
                      <th className="py-2 pr-3">School</th><th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map(registration => (
                      <tr key={registration.id} className="border-b border-[#c9a96e]/20">
                        <td className="py-2 pr-3 font-mono text-xs">{registration.registrationCode}</td>
                        <td className="py-2 pr-3">{registration.participantName || '—'}</td>
                        <td className="py-2 pr-3">{registration.schoolName || 'Independent'}</td>
                        <td className="py-2">{registration.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <button type="submit" disabled={busy === 'save'} className="rounded-2xl bg-[#800020] px-6 py-3 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#670019] disabled:opacity-60">
            {busy === 'save' ? 'Saving…' : 'Save championship'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
