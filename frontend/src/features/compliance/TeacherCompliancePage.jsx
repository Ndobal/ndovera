import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { getMyCompliance, uploadComplianceEvidence, uploadComplianceFile } from './complianceApi';
import { BODY, CARD, HEADING, INNER, LABEL, PRIMARY, SECONDARY, StatusChip, actionFor, describeItem, formatDue, naira } from './complianceUi';

const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** Dashboard card: this week at a glance, and one button to whatever needs doing. */
export function MySubmissionsCard() {
  const [data, setData] = useState(null);
  useEffect(() => { getMyCompliance().then(setData).catch(() => setData(null)); }, []);
  if (!data || !data.items?.length) return null;
  const week = data.items.find(item => item.periodLabel?.startsWith('Week'))?.periodLabel || 'This week';
  return (
    <section className={`${CARD} space-y-3`} aria-label="My Submissions">
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-lg font-black ${HEADING}`}>My Submissions</h2>
        <span className={LABEL}>{week}</span>
      </div>
      <ul className="space-y-1.5">
        {data.items.map(item => (
          <li key={`${item.ruleId}:${item.periodKey}`} className={`flex items-center justify-between gap-3 text-sm ${BODY}`}>
            <span className="font-semibold">{item.ruleName}</span>
            <span className="flex items-center gap-2 text-xs"><span className="hidden sm:inline">{describeItem(item)}</span><StatusChip item={item} compact /></span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${data.attention ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {data.attention ? `${data.attention} item${data.attention === 1 ? '' : 's'} require${data.attention === 1 ? 's' : ''} attention` : 'All caught up'}
        </p>
        <Link to="/roles/teacher/compliance" className={PRIMARY}>{data.attention ? 'View missing items' : 'Open My Submissions'}</Link>
      </div>
    </section>
  );
}

function EvidenceUpload({ item, onDone }) {
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true); setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        uploaded.push(await uploadComplianceFile(file));
      }
      await uploadComplianceEvidence({ ruleId: item.ruleId, periodKey: item.periodKey, unitKey: item.units[0]?.key, files: uploaded, note });
      setFiles([]); setNote('');
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-dashed border-[#c9a96e]/60 p-3">
      <p className={`text-xs ${BODY}`}>Upload a photo or file as evidence. A Head will verify it.</p>
      <input type="file" multiple accept="image/*,application/pdf" aria-label={`Evidence for ${item.ruleName}`} onChange={event => setFiles([...event.target.files])} className="text-sm" />
      <input value={note} onChange={event => setNote(event.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-[#c9a96e]/45 p-2 text-sm" />
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
      <button type="button" disabled={busy || !files.length} onClick={send} className={PRIMARY}>{busy ? 'Uploading…' : 'Upload evidence'}</button>
    </div>
  );
}

function ItemCard({ item, onChanged }) {
  const [open, setOpen] = useState(item.status !== 'complete');
  const action = actionFor(item.kind);
  const missing = item.units.filter(unit => !unit.done);
  return (
    <article className={INNER}>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <span>
          <span className={`block font-black ${HEADING}`}>{item.ruleName}</span>
          <span className={`block text-xs ${BODY}`}>{item.periodLabel} · due {formatDue(item.dueAt)} · {describeItem(item)}</span>
        </span>
        <StatusChip item={item} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {item.total > 1 && missing.length > 0 && (
            <p className={`text-sm font-semibold text-rose-700 dark:text-rose-300`}>Missing: {missing.map(unit => unit.label).join(', ')}</p>
          )}
          <ul className="divide-y divide-[#c9a96e]/25">
            {item.units.map(unit => (
              <li key={unit.key} className={`flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm ${BODY}`}>
                <span>{unit.done ? '✓' : '✗'} {unit.label}</span>
                <span className="text-xs opacity-80">{unit.detail}</span>
              </li>
            ))}
          </ul>
          {item.fine && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
              {item.fine.decision === 'waived' ? `Penalty waived${item.fine.reason ? ` — ${item.fine.reason}` : ''}`
                : item.fine.decision ? `Penalty ${item.fine.decision}: ${naira(item.fine.amount)}`
                  : `${naira(item.fine.proposed)} penalty proposed — a Head will decide`}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {action && item.status !== 'complete' && <Link to={action.to} className={SECONDARY}>{action.label}</Link>}
          </div>
          {item.evidenceUpload && !['complete', 'late'].includes(item.status) && <EvidenceUpload item={item} onDone={onChanged} />}
          {['diary', 'custom'].includes(item.kind) && !item.evidenceUpload && item.status !== 'complete' && (
            <p className={`text-xs ${BODY}`}>A Head marks this as submitted once they have seen it.</p>
          )}
        </div>
      )}
    </article>
  );
}

export default function TeacherCompliancePage() {
  const [date, setDate] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getMyCompliance(date ? { date } : {}).then(next => { setData(next); setError(''); }).catch(err => setError(err.message));
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const current = date || data?.date || '';
  return (
    <StudentSectionShell title="My Submissions" dashboardLabel="Teacher Dashboard" subtitle="What is due this week, what is done, and exactly what is still missing. Work you do in Ndovera is counted automatically.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={SECONDARY} onClick={() => setDate(shiftDate(current, -7))} disabled={!current}>← Previous week</button>
          <button type="button" className={SECONDARY} onClick={() => setDate('')}>This week</button>
          <button type="button" className={SECONDARY} onClick={() => setDate(shiftDate(current, 7))} disabled={!current}>Next week →</button>
          {current && <span className={`text-sm ${BODY}`}>Showing the week of {current}</span>}
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
        {!data && !error && <p role="status" className={BODY}>Loading…</p>}
        {data && !data.items.length && <p className={`${CARD} ${BODY}`}>Nothing is due for you in this period.</p>}
        {data && data.items.length > 0 && (
          <section className={`${CARD} space-y-3`}>
            <p className={`text-sm font-semibold ${data.attention ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {data.attention ? `${data.attention} item${data.attention === 1 ? '' : 's'} require${data.attention === 1 ? 's' : ''} attention` : 'Everything due is done.'}
            </p>
            {data.items.map(item => <ItemCard key={`${item.ruleId}:${item.periodKey}`} item={item} onChanged={load} />)}
          </section>
        )}
        {data?.history?.length > 0 && (
          <section className={CARD}>
            <h2 className={`mb-2 text-base font-black ${HEADING}`}>My compliance history</h2>
            <div className="overflow-x-auto">
              <table className={`w-full min-w-[480px] text-sm ${BODY}`}>
                <thead><tr className="text-left">{['Week', 'Required', 'On time', 'Late', 'Partial', 'Missing'].map(head => <th key={head} className={`${LABEL} py-2 pr-3`}>{head}</th>)}</tr></thead>
                <tbody>
                  {data.history.map(week => (
                    <tr key={week.weekStart} className="border-t border-[#c9a96e]/25">
                      <td className="py-1.5 pr-3 font-semibold">{week.label}</td><td className="pr-3">{week.required}</td><td className="pr-3">{week.onTime}</td>
                      <td className="pr-3">{week.late}</td><td className="pr-3">{week.partial}</td><td className="pr-3">{week.missing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </StudentSectionShell>
  );
}
