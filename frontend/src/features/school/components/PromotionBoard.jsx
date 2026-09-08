import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAcademicOverview, getClasses, getPromotionBatches, createPromotionBatch,
  getPromotionBatchDetail, updatePromotionBatch, commitPromotionBatch,
  cancelPromotionBatch, getPromotionAudit,
} from '../services/schoolApi';

const CARD = 'rounded-3xl p-5 sm:p-6 bg-[#b5e3f4] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/40';
const INPUT = 'rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60';
const LABEL = 'text-xs font-bold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';

// The commit bar is pinned; the padding keeps it clear of the mobile nav bar.
const STICKY_BAR = 'sticky bottom-0 -mx-5 mt-4 flex flex-wrap items-center gap-3 border-t border-[#c9a96e]/35 bg-[#b5e3f4]/95 px-5 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur sm:-mx-6 sm:px-6 dark:border-white/10 dark:bg-slate-900/95';

const ACTIONS = [
  { value: 'promote', label: 'Promote' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'withdraw', label: 'Withdraw' },
];

const ACTION_STYLES = {
  promote: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  repeat: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  graduate: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  transfer: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  withdraw: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};

function needsClass(action) {
  return action === 'promote' || action === 'repeat';
}

export default function PromotionBoard() {
  const [overview, setOverview] = useState(null);
  const [classes, setClasses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState('');
  const [detail, setDetail] = useState(null);
  const [audit, setAudit] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [classFilter, setClassFilter] = useState('');
  const [draft, setDraft] = useState({ fromSessionId: '', toSessionId: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [overviewData, classData, batchData, auditData] = await Promise.all([
      getAcademicOverview(),
      getClasses().then(d => d?.classes || []).catch(() => []),
      getPromotionBatches().then(d => d?.batches || []).catch(() => []),
      getPromotionAudit({ limit: 60 }).then(d => d?.entries || []).catch(() => []),
    ]);
    setOverview(overviewData);
    setClasses(classData);
    setBatches(batchData);
    setAudit(auditData);

    const sessions = overviewData?.sessions || [];
    const active = overviewData?.activeSession;
    const upcoming = sessions.find(s => s.status === 'upcoming');
    setDraft(d => ({
      fromSessionId: d.fromSessionId || active?.id || '',
      toSessionId: d.toSessionId || upcoming?.id || '',
    }));

    const open = batchData.find(b => b.status === 'draft');
    return open?.id || batchData[0]?.id || '';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await load();
        if (!cancelled && next) setActiveBatchId(next);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load promotion data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (!activeBatchId) { setDetail(null); return; }
    let cancelled = false;
    getPromotionBatchDetail(activeBatchId)
      .then(data => { if (!cancelled) { setDetail(data); setSelected(new Set()); } })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load that promotion round.'); });
    return () => { cancelled = true; };
  }, [activeBatchId]);

  const sessions = overview?.sessions || [];
  // A fresh [] on every render would re-run every memo below it.
  const decisions = useMemo(() => detail?.decisions || [], [detail]);

  const visibleDecisions = useMemo(() => (
    classFilter ? decisions.filter(d => d.fromClassId === classFilter) : decisions
  ), [decisions, classFilter]);

  const pendingCount = decisions.filter(d => d.status !== 'committed').length;
  const fromClasses = useMemo(() => {
    const seen = new Map();
    decisions.forEach(d => { if (d.fromClassId) seen.set(d.fromClassId, d.fromClassName || d.fromClassId); });
    return Array.from(seen.entries());
  }, [decisions]);

  async function refreshDetail() {
    const data = await getPromotionBatchDetail(activeBatchId);
    setDetail(data);
    setSelected(new Set());
    setBatches(await getPromotionBatches().then(d => d?.batches || []).catch(() => []));
    setAudit(await getPromotionAudit({ limit: 60 }).then(d => d?.entries || []).catch(() => []));
  }

  async function handleDraft(event) {
    event.preventDefault();
    setBusy('draft'); setError(''); setNotice('');
    try {
      const created = await createPromotionBatch(draft);
      setBatches(await getPromotionBatches().then(d => d?.batches || []).catch(() => []));
      setActiveBatchId(created.batch.id);
      setNotice(`Proposals drafted for ${created.decisions.length} students. Nothing has moved yet — review, adjust, then approve.`);
    } catch (e) {
      setError(e.message || 'Could not draft the promotion round.');
    } finally {
      setBusy('');
    }
  }

  async function applyUpdate(studentId, patch) {
    setError('');
    const current = decisions.find(d => d.studentId === studentId);
    if (!current) return;
    const next = { ...current, ...patch };
    // Keep the row responsive while the change is saved.
    setDetail(d => ({ ...d, decisions: d.decisions.map(item => item.studentId === studentId ? next : item) }));
    try {
      const updated = await updatePromotionBatch(activeBatchId, [{
        studentId,
        action: next.action,
        ...(needsClass(next.action) ? { toClassId: next.toClassId } : {}),
      }]);
      setDetail(updated);
    } catch (e) {
      setError(e.message || 'Could not save that change.');
      await refreshDetail();
    }
  }

  async function applyBulk(patch) {
    if (!selected.size) return;
    setBusy('bulk'); setError('');
    try {
      const updates = Array.from(selected).map(studentId => ({ studentId, ...patch }));
      const updated = await updatePromotionBatch(activeBatchId, updates);
      setDetail(updated);
      setNotice(`${selected.size} student${selected.size === 1 ? '' : 's'} updated.`);
    } catch (e) {
      setError(e.message || 'Could not apply that change.');
    } finally {
      setBusy('');
    }
  }

  async function handleCommit() {
    const ids = selected.size ? Array.from(selected) : null;
    const count = ids ? ids.length : pendingCount;
    const target = detail?.batch?.toSessionName || 'the new session';

    if (!window.confirm(`${count} student${count === 1 ? ' will be' : 's will be'} enrolled into ${target}. Their existing records stay exactly as they are. Continue?`)) return;

    setBusy('commit'); setError(''); setNotice('');
    try {
      const result = await commitPromotionBatch(activeBatchId, ids);
      setNotice(`${result.enrolled} student${result.enrolled === 1 ? '' : 's'} enrolled into ${result.session.name}.`);
      await refreshDetail();
    } catch (e) {
      setError(e.message || 'Could not commit the promotion.');
    } finally {
      setBusy('');
    }
  }

  function toggle(studentId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  function toggleAll() {
    const selectable = visibleDecisions.filter(d => d.status !== 'committed').map(d => d.studentId);
    setSelected(prev => (selectable.every(id => prev.has(id)) ? new Set() : new Set(selectable)));
  }

  if (loading) return <p className="text-sm text-[#800020] dark:text-slate-300">Loading promotion data…</p>;

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#fff8ee] px-3 py-2 text-sm font-semibold text-[#1a5c38] dark:bg-slate-800 dark:text-emerald-300">{notice}</p> : null}

      <section className={CARD}>
        <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Start a promotion round</h3>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
          Proposals come from the promotion flow you configured. Every one starts pending — no student moves until you approve the round.
        </p>
        <form onSubmit={handleDraft} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={LABEL}>Students are leaving</span>
            <select value={draft.fromSessionId} onChange={e => setDraft(d => ({ ...d, fromSessionId: e.target.value }))} className={`${INPUT} mt-1 w-full`}>
              <option value="">First-ever round (use current classes)</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={LABEL}>Moving into</span>
            <select required value={draft.toSessionId} onChange={e => setDraft(d => ({ ...d, toSessionId: e.target.value }))} className={`${INPUT} mt-1 w-full`}>
              <option value="">Choose a session…</option>
              {sessions.filter(s => s.id !== draft.fromSessionId && s.status !== 'archived').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="flex items-end pb-[var(--safe-bottom)]">
            <button type="submit" disabled={busy === 'draft' || !draft.toSessionId} className={`${BTN} w-full sm:w-auto`}>
              {busy === 'draft' ? 'Drafting…' : 'Generate proposals'}
            </button>
          </div>
        </form>
      </section>

      {batches.length ? (
        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Promotion rounds</h3>
            <select value={activeBatchId} onChange={e => setActiveBatchId(e.target.value)} className={INPUT}>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>
                  {batch.fromSessionName || 'Current classes'} → {batch.toSessionName} ({batch.status})
                </option>
              ))}
            </select>
          </div>

          {detail?.batch ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-[#14215b] dark:text-slate-200">
                  {decisions.length} student{decisions.length === 1 ? '' : 's'} · {pendingCount} awaiting approval
                </p>
                {fromClasses.length > 1 ? (
                  <select value={classFilter} onChange={e => { setClassFilter(e.target.value); setSelected(new Set()); }} className={INPUT}>
                    <option value="">All classes</option>
                    {fromClasses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                ) : null}
                {detail.batch.status === 'draft' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('Discard this promotion round? Nothing has been enrolled yet.')) return;
                      await cancelPromotionBatch(activeBatchId).catch(e => setError(e.message));
                      const next = await load();
                      setActiveBatchId(next);
                    }}
                    className="ml-auto rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-600"
                  >Discard round</button>
                ) : null}
              </div>

              {/* Desktop table */}
              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#c9a96e]/40 text-xs uppercase tracking-wide text-[#800020] dark:border-white/10 dark:text-slate-400">
                      <th className="px-2 py-2"><input type="checkbox" onChange={toggleAll} checked={visibleDecisions.length > 0 && visibleDecisions.filter(d => d.status !== 'committed').every(d => selected.has(d.studentId))} /></th>
                      <th className="px-2 py-2">Student</th>
                      <th className="px-2 py-2">Current class</th>
                      <th className="px-2 py-2">Action</th>
                      <th className="px-2 py-2">Next class</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDecisions.map(decision => (
                      <tr key={decision.studentId} className="border-b border-[#c9a96e]/20 dark:border-white/5">
                        <td className="px-2 py-2">
                          <input type="checkbox" disabled={decision.status === 'committed'} checked={selected.has(decision.studentId)} onChange={() => toggle(decision.studentId)} />
                        </td>
                        <td className="px-2 py-2 font-semibold text-[#14215b] dark:text-slate-100">{decision.studentName || decision.studentId}</td>
                        <td className="px-2 py-2 text-[#4a5578] dark:text-slate-300">{decision.fromClassName || '—'}</td>
                        <td className="px-2 py-2">
                          <select
                            disabled={decision.status === 'committed'}
                            value={decision.action}
                            onChange={e => applyUpdate(decision.studentId, { action: e.target.value })}
                            className={`${INPUT} py-1`}
                          >
                            {ACTIONS.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          {needsClass(decision.action) ? (
                            <select
                              disabled={decision.status === 'committed'}
                              value={decision.toClassId || ''}
                              onChange={e => applyUpdate(decision.studentId, { toClassId: e.target.value })}
                              className={`${INPUT} py-1`}
                            >
                              <option value="">Choose…</option>
                              {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}{cls.arm ? ` ${cls.arm}` : ''}</option>)}
                            </select>
                          ) : <span className="text-xs text-[#4a5578] dark:text-slate-400">—</span>}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${decision.status === 'committed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : ACTION_STYLES[decision.action]}`}>
                            {decision.status === 'committed' ? 'enrolled' : 'pending'}
                          </span>
                          {decision.source === 'manual' ? <span className="ml-1 text-[10px] text-[#4a5578] dark:text-slate-400">manual</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="mt-3 space-y-2 md:hidden">
                {visibleDecisions.map(decision => (
                  <div key={decision.studentId} className="rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4]/60 p-3 dark:border-white/10 dark:bg-slate-800/40">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" disabled={decision.status === 'committed'} checked={selected.has(decision.studentId)} onChange={() => toggle(decision.studentId)} />
                      <span className="flex-1">
                        <span className="block font-bold text-[#14215b] dark:text-slate-100">{decision.studentName || decision.studentId}</span>
                        <span className="block text-xs text-[#4a5578] dark:text-slate-400">Currently {decision.fromClassName || '—'}</span>
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${decision.status === 'committed' ? 'bg-emerald-100 text-emerald-700' : ACTION_STYLES[decision.action]}`}>
                        {decision.status === 'committed' ? 'enrolled' : decision.action}
                      </span>
                    </label>
                    <div className="mt-2 grid gap-2">
                      <select disabled={decision.status === 'committed'} value={decision.action} onChange={e => applyUpdate(decision.studentId, { action: e.target.value })} className={INPUT}>
                        {ACTIONS.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
                      </select>
                      {needsClass(decision.action) ? (
                        <select disabled={decision.status === 'committed'} value={decision.toClassId || ''} onChange={e => applyUpdate(decision.studentId, { toClassId: e.target.value })} className={INPUT}>
                          <option value="">Choose next class…</option>
                          {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}{cls.arm ? ` ${cls.arm}` : ''}</option>)}
                        </select>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {!visibleDecisions.length ? <p className="mt-3 text-sm text-[#4a5578] dark:text-slate-400">No students in this view.</p> : null}

              {detail.batch.status !== 'committed' ? (
                <div className={STICKY_BAR}>
                  <p className="text-sm font-semibold text-[#14215b] dark:text-slate-200">
                    {selected.size ? `${selected.size} selected` : `${pendingCount} awaiting approval`}
                  </p>
                  {selected.size ? (
                    <>
                      <select
                        onChange={e => { if (e.target.value) { applyBulk({ action: e.target.value }); e.target.value = ''; } }}
                        defaultValue=""
                        disabled={busy === 'bulk'}
                        className={INPUT}
                      >
                        <option value="">Set action for selected…</option>
                        {ACTIONS.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}
                      </select>
                      <select
                        onChange={e => { if (e.target.value) { applyBulk({ action: 'promote', toClassId: e.target.value }); e.target.value = ''; } }}
                        defaultValue=""
                        disabled={busy === 'bulk'}
                        className={INPUT}
                      >
                        <option value="">Promote selected into…</option>
                        {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}{cls.arm ? ` ${cls.arm}` : ''}</option>)}
                      </select>
                    </>
                  ) : null}
                  <button type="button" onClick={handleCommit} disabled={busy === 'commit' || !pendingCount} className={`${BTN} ml-auto`}>
                    {busy === 'commit' ? 'Enrolling…' : selected.size ? `Approve ${selected.size} selected` : 'Approve all & enrol'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      <section className={CARD}>
        <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Promotion history</h3>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Every move that has been made, who made it, and whether it followed the configured flow or was set by hand.</p>
        <div className="mt-3 space-y-2">
          {audit.map(entry => (
            <div key={entry.id} className="rounded-2xl border border-[#c9a96e]/30 bg-[#fff8ee]/70 p-3 text-sm dark:border-white/10 dark:bg-slate-800/40">
              <p className="font-semibold text-[#14215b] dark:text-slate-100">
                {entry.studentName || entry.studentId}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ACTION_STYLES[entry.action] || ''}`}>{entry.action}</span>
              </p>
              <p className="text-xs text-[#4a5578] dark:text-slate-400">
                {entry.fromSessionName || '—'} {entry.fromClassName || ''} → {entry.toSessionName} {entry.toClassName || ''}
                {' · '}{entry.mode}{' · '}{entry.performedByName || 'system'}
                {entry.performedAt ? ` · ${new Date(entry.performedAt).toLocaleString()}` : ''}
              </p>
            </div>
          ))}
          {!audit.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">No promotions recorded yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
