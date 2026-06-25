import React, { useEffect, useState } from 'react';
import { bulkPublishResults, getResultsBulkJobs, retryResultsBulkJob } from '../../school/services/schoolApi';

// "Distribute all results" trigger + persistent background-job status. Publishes
// every class's results to students in the background (survives leaving the page).
export default function ResultsDistributeBanner({ session = '', term = '' }) {
  const [jobs, setJobs] = useState([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try { const d = await getResultsBulkJobs(); if (active) setJobs(d.jobs || []); } catch { /* ignore */ }
    }
    load();
    const t = setInterval(load, 5000);
    return () => { active = false; clearInterval(t); };
  }, []);

  async function distributeAll() {
    if (!window.confirm('Distribute results for ALL classes to students now? This runs in the background.')) return;
    setStarting(true); setError('');
    try { await bulkPublishResults({ session, term }); }
    catch (e) { setError(e.message || 'Could not start distribution.'); }
    finally { setStarting(false); }
  }

  async function retry(id) { try { await retryResultsBulkJob(id); } catch { /* ignore */ } }

  const recent = jobs.filter(j => {
    if (j.status === 'pending' || j.status === 'processing') return true;
    return Date.now() - new Date(j.createdAt || 0).getTime() < 1000 * 60 * 60 * 24;
  }).slice(0, 2);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-4 dark:border-white/10 dark:bg-slate-900/40">
        <div>
          <p className="text-sm font-black text-[#191970] dark:text-slate-100">Distribute results to students</p>
          <p className="text-xs text-[#4a5578] dark:text-slate-400">Publishes every class's results in the background — it keeps going after you leave or go offline.</p>
        </div>
        <button type="button" onClick={distributeAll} disabled={starting} className="shrink-0 rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60">
          {starting ? 'Starting…' : 'Distribute all results'}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {recent.map(job => {
        const active = job.status === 'pending' || job.status === 'processing';
        const pct = job.total ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;
        return (
          <div key={job.id} className="rounded-2xl border border-[#c9a96e]/40 bg-[#ade1f4] p-4 dark:border-white/10 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-[#191970] dark:text-slate-100">{active ? '⏳ Distributing results' : job.failed > 0 ? '⚠️ Distribution finished with some failures' : '✓ Results distributed'} — {job.message}</p>
              {!active && job.failed > 0 ? <button type="button" onClick={() => retry(job.id)} className="shrink-0 rounded-xl bg-[#800020] px-3 py-1.5 text-xs font-bold text-white">Retry {job.failed} classes</button> : null}
            </div>
            {active ? <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/50"><div className="h-full bg-[#1a5c38] transition-all duration-500" style={{ width: `${pct}%` }} /></div> : null}
            <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">{job.processed}/{job.total} classes · {job.published} student results published · {job.failed} failed</p>
          </div>
        );
      })}
    </div>
  );
}
