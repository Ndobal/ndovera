import React, { useEffect, useState } from 'react';
import {
  getClasses, getPromotionMap, savePromotionMap, runPromotion,
  getAlumni, addAlumni, deleteAlumni,
} from '../../../features/school/services/schoolApi';

const CARD = 'rounded-3xl p-6 bg-[#b5e3f4] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/40';
const INPUT = 'rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60';
const EMPTY_ALUM = { name: '', email: '', phone: '', graduationYear: '', lastClass: '' };

export default function PromotionPanel() {
  const [classes, setClasses] = useState([]);
  const [map, setMap] = useState({});
  const [criteria, setCriteria] = useState('');
  const [alumni, setAlumni] = useState([]);
  const [alumForm, setAlumForm] = useState(EMPTY_ALUM);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const [c, m, a] = await Promise.all([
        getClasses().then(d => d?.classes || []).catch(() => []),
        getPromotionMap().catch(() => ({ map: {}, criteria: '' })),
        getAlumni().catch(() => ({ alumni: [] })),
      ]);
      setClasses(c);
      setMap(m.map || {});
      setCriteria(m.criteria || '');
      setAlumni(a.alumni || []);
    } catch (e) { setMsg(e.message || 'Could not load.'); }
  }
  useEffect(() => { load(); }, []);

  async function saveMap() {
    setBusy('map'); setMsg('');
    try { await savePromotionMap({ map, criteria }); setMsg('Promotion flow saved.'); } catch (e) { setMsg(e.message || 'Could not save.'); } finally { setBusy(''); }
  }

  async function promote() {
    if (!window.confirm('Run promotion now? Every student is moved to their next class, and the final class graduates into the Alumni Community. Make sure the flow is correct.')) return;
    setBusy('run'); setMsg('');
    try {
      await savePromotionMap({ map, criteria });
      const r = await runPromotion();
      setMsg(`Promotion complete: ${r.promoted} promoted, ${r.graduated} graduated to alumni.`);
      await load();
    } catch (e) { setMsg(e.message || 'Could not run promotion.'); } finally { setBusy(''); }
  }

  async function saveAlumnus(e) {
    e.preventDefault();
    if (!alumForm.name.trim()) { setMsg('Alumnus name is required.'); return; }
    setBusy('alum'); setMsg('');
    try { await addAlumni(alumForm); setAlumForm(EMPTY_ALUM); await load(); setMsg('Alumnus added.'); } catch (e2) { setMsg(e2.message || 'Could not add.'); } finally { setBusy(''); }
  }

  async function approve(id) { try { await addAlumni({ id }); await load(); } catch (e) { setMsg(e.message || 'Could not approve.'); } }
  async function remove(id) { try { await deleteAlumni(id); await load(); } catch (e) { setMsg(e.message || 'Could not remove.'); } }

  return (
    <div className="space-y-6">
      {msg ? <p className="rounded-xl bg-[#fff8ee] px-3 py-2 text-sm font-semibold text-[#1a5c38] dark:bg-slate-800 dark:text-emerald-300">{msg}</p> : null}

      <section className={CARD}>
        <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Promotion flow</h3>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">For each class, choose where its students go at the end of the session. The final class should promote to the Alumni Community.</p>
        <div className="mt-4 space-y-2">
          {classes.map(cls => (
            <div key={cls.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4]/60 p-3 dark:bg-slate-800/40">
              <span className="min-w-[140px] font-semibold text-[#14215b] dark:text-slate-100">{cls.name}{cls.arm ? ` ${cls.arm}` : ''}</span>
              <span className="text-[#4a5578]">→</span>
              <select value={map[cls.id] || ''} onChange={e => setMap(m => ({ ...m, [cls.id]: e.target.value }))} className={INPUT}>
                <option value="">(stays / not set)</option>
                {classes.filter(t => t.id !== cls.id).map(t => <option key={t.id} value={t.id}>{t.name}{t.arm ? ` ${t.arm}` : ''}</option>)}
                <option value="alumni">🎓 Alumni Community (graduate)</option>
              </select>
            </div>
          ))}
          {!classes.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">Create classes first (Classes tab).</p> : null}
        </div>
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-[#800020]">Alumni eligibility criteria (shown to people registering as alumni)</label>
          <textarea rows={2} value={criteria} onChange={e => setCriteria(e.target.value)} placeholder="e.g. Graduated from SS3 / completed the final class at this school." className={`${INPUT} mt-1 w-full resize-none`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={saveMap} disabled={busy === 'map'} className="rounded-2xl border border-[#800020]/30 px-5 py-2.5 text-sm font-bold text-[#800020] disabled:opacity-60">{busy === 'map' ? 'Saving…' : 'Save flow'}</button>
          <button type="button" onClick={promote} disabled={busy === 'run' || !classes.length} className={BTN}>{busy === 'run' ? 'Running…' : 'Run Promotion'}</button>
        </div>
      </section>

      <section className={CARD}>
        <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Alumni Community ({alumni.length})</h3>
        <form onSubmit={saveAlumnus} className="mt-3 grid gap-2 sm:grid-cols-3">
          <input className={INPUT} placeholder="Full name" value={alumForm.name} onChange={e => setAlumForm(f => ({ ...f, name: e.target.value }))} />
          <input className={INPUT} placeholder="Email" value={alumForm.email} onChange={e => setAlumForm(f => ({ ...f, email: e.target.value }))} />
          <input className={INPUT} placeholder="Phone" value={alumForm.phone} onChange={e => setAlumForm(f => ({ ...f, phone: e.target.value }))} />
          <input className={INPUT} placeholder="Graduation year" value={alumForm.graduationYear} onChange={e => setAlumForm(f => ({ ...f, graduationYear: e.target.value }))} />
          <input className={INPUT} placeholder="Last class" value={alumForm.lastClass} onChange={e => setAlumForm(f => ({ ...f, lastClass: e.target.value }))} />
          <button type="submit" disabled={busy === 'alum'} className={BTN}>{busy === 'alum' ? 'Adding…' : 'Add alumnus'}</button>
        </form>

        <div className="mt-4 space-y-2">
          {alumni.map(a => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#c9a96e]/30 bg-[#fff8ee]/70 p-3 text-sm dark:bg-slate-800/40">
              <div>
                <p className="font-semibold text-[#14215b] dark:text-slate-100">{a.name} {a.status === 'pending' ? <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">pending</span> : null}</p>
                <p className="text-xs text-[#4a5578] dark:text-slate-400">{[a.lastClass, a.graduationYear, a.email, a.phone].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex gap-2">
                {a.status === 'pending' ? <button type="button" onClick={() => approve(a.id)} className="rounded-lg bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-white">Approve</button> : null}
                <button type="button" onClick={() => remove(a.id)} className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-600">Remove</button>
              </div>
            </div>
          ))}
          {!alumni.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">No alumni yet. Run promotion on your final class, or add alumni manually above.</p> : null}
        </div>
      </section>
    </div>
  );
}
