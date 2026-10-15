import React, { useCallback, useEffect, useState } from 'react';
import { checkoutPass, clearStudentDevices, getFamilyPasses, getSchoolPasses, naira, quotePass, verifyPass } from './practiceApi';
import { getPeople } from '../school/services/schoolApi';
import { askConfirm } from '../../shared/components/AppDialog';

// Practice passes bought by parents (for each child) and by the school (for a whole
// class, 30% off). Prices are always worked out by Ndovera; payment is by Flutterwave.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70';
const FIELD = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-white';
const PRIMARY = 'rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50';

function BundlePicker({ bundles, subjects, onBuy, busy, school = false }) {
  const [bundle, setBundle] = useState('');
  const [subjectKey, setSubjectKey] = useState('');
  const [jamb, setJamb] = useState([]);
  const chosen = bundles.find(item => item.key === bundle);
  const needsSubject = bundle === 'subject';
  const needsJamb = ['jamb', 'super'].includes(bundle);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Pass" className={FIELD} value={bundle} onChange={event => setBundle(event.target.value)}>
          <option value="">Choose a pass…</option>
          {bundles.map(item => <option key={item.key} value={item.key} disabled={!item.ready}>{item.label} — {naira(school ? item.schoolPriceNaira : item.priceNaira)}{school ? ' per student' : ''}{item.ready ? '' : ' (being prepared)'}</option>)}
        </select>
        {needsSubject && (
          <select aria-label="Subject" className={FIELD} value={subjectKey} onChange={event => setSubjectKey(event.target.value)}>
            <option value="">Subject…</option>{subjects.map(subject => <option key={subject.key} value={subject.key}>{subject.name}</option>)}
          </select>
        )}
      </div>
      {chosen && <p className="text-xs text-slate-600 dark:text-slate-300">{chosen.blurb}</p>}
      {needsJamb && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Three JAMB subjects">
          {subjects.filter(subject => subject.key !== 'english').map(subject => (
            <label key={subject.key} className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold ${jamb.includes(subject.key) ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 text-slate-700 dark:text-slate-200'}`}>
              <input type="checkbox" className="sr-only" checked={jamb.includes(subject.key)} onChange={() => setJamb(current => (current.includes(subject.key) ? current.filter(key => key !== subject.key) : current.length < 3 ? [...current, subject.key] : current))} />{subject.name}
            </label>
          ))}
        </div>
      )}
      <button type="button" className={PRIMARY} disabled={busy || !bundle || (needsSubject && !subjectKey) || (needsJamb && jamb.length !== 3)}
        onClick={() => onBuy({ bundle, ...(needsSubject ? { subjectKey } : {}), ...(needsJamb ? { jambSubjects: jamb } : {}) })}>{busy ? 'Opening payment…' : 'Continue to payment'}</button>
    </div>
  );
}

export default function PracticePassesPage({ mode }) {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [found, setFound] = useState([]);
  const load = useCallback(() => (mode === 'parent' ? getFamilyPasses() : getSchoolPasses()).then(setData).catch(err => setNotice(err.message)), [mode]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let txRef = '';
    try { txRef = new URLSearchParams(window.location.search).get('practice_tx') || ''; } catch { txRef = ''; }
    if (!txRef) return;
    verifyPass(txRef).then(result => setNotice(result.message)).catch(err => setNotice(err.message)).finally(() => { try { window.history.replaceState({}, '', window.location.pathname); } catch { /* ignore */ } load(); });
  }, [load]);
  useEffect(() => {
    if (mode === 'parent' || search.trim().length < 2) { setFound([]); return undefined; }
    const timer = setTimeout(() => getPeople({ search, role: 'student', limit: 8 }).then(result => setFound(result?.people || [])).catch(() => setFound([])), 300);
    return () => clearTimeout(timer);
  }, [mode, search]);

  async function pay(payload) {
    setBusy(true); setNotice('');
    try {
      if (mode !== 'parent') {
        const priced = await quotePass(payload);
        if (!await askConfirm(`${priced.quote.label} for ${priced.quote.students} student(s): ${naira(priced.quote.amountNaira)} (${naira(priced.quote.each)} each). Continue to payment?`)) return;
      }
      const result = await checkoutPass(payload);
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }

  const klass = data?.classes?.find(item => item.id === classId);
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <section className="rounded-[2rem] bg-gradient-to-br from-indigo-700 to-fuchsia-700 p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">Practice Arena</p>
        <h1 className="text-3xl font-black">Practice passes</h1>
        <p className="mt-1 max-w-2xl text-white/90">{mode === 'parent' ? "Every subject is free at your child's class level, 10 new questions a day. Passes remove the daily limit for the term, or give a full year of WAEC, NECO, JAMB, BECE or Common Entrance practice with timed mocks." : `Buy passes for a whole class at ${Math.round((data?.discount || 0.3) * 100)}% off. Each student gets their own pass.`}</p>
      </section>
      {notice && <p role="status" className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100">{notice}</p>}
      {!data ? <p role="status">Loading…</p> : mode === 'parent' ? (
        data.children.length ? data.children.map(child => (
          <section key={child.studentId} className={`${CARD} space-y-3`}>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{child.name} <span className="text-sm font-semibold text-slate-500">· {child.className}</span></h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Free: every subject, {child.freePerDay || 10} new questions a day</p>
            {child.passes.length ? <ul className="text-sm text-slate-700 dark:text-slate-200">{child.passes.map(pass => <li key={pass.id}>✅ {pass.label}{pass.expiresAt ? ` · until ${new Date(pass.expiresAt).toLocaleDateString()}` : ' · this term'}</li>)}</ul> : null}
            <BundlePicker bundles={child.bundles} subjects={child.subjects} busy={busy} onBuy={payload => pay({ ...payload, studentId: child.studentId })} />
          </section>
        )) : <p className={CARD}>No children are linked to your account yet. Ask the school to link them.</p>
      ) : (
        <>
          <section className={`${CARD} space-y-3`}>
            <label className="block text-xs font-black uppercase text-slate-500">Class
              <select className={`${FIELD} mt-1 block`} value={classId} onChange={event => setClassId(event.target.value)}>
                <option value="">Choose a class…</option>{data.classes.filter(item => item.section).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            {klass && <BundlePicker school bundles={klass.bundles} subjects={[]} busy={busy} onBuy={payload => pay({ ...payload, classId })} />}
          </section>
          <section className={`${CARD} space-y-2`}>
            <h2 className="font-black text-slate-900 dark:text-white">A student changed phone?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Paid practice opens on 2 devices per student. Clear a student's devices so they can sign in on a new one.</p>
            <input aria-label="Find a student" className={`${FIELD} w-full`} placeholder="Type the student's name…" value={search} onChange={event => setSearch(event.target.value)} />
            <ul className="space-y-1">
              {found.map(person => (
                <li key={person.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                  <span className="flex-1">{person.name}{person.className ? ` · ${person.className}` : ''}</span>
                  <button type="button" className="text-xs font-bold text-rose-700 underline" onClick={async () => {
                    if (!await askConfirm(`Clear ${person.name}'s practice devices?`)) return;
                    try { await clearStudentDevices(person.id); setNotice(`${person.name}'s devices were cleared.`); } catch (err) { setNotice(err.message); }
                  }}>Clear devices</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
