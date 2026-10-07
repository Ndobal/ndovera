import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { StaffLink } from '../staff-file/StaffFilePage';
import {
  createComplianceRule, decideComplianceFine, getClassReportTemplate, getClassReports, getComplianceConfig, getComplianceOverview,
  getTeacherCompliance, saveClassReportTemplate, saveComplianceSettings, setComplianceRuleActive, updateComplianceRule,
  uploadComplianceFile, verifyComplianceUnit,
} from './complianceApi';
import { BODY, CARD, HEADING, INNER, INPUT, KIND_LABELS, LABEL, PRIMARY, SECONDARY, STATUS, StatusChip, WEEKDAYS, formatDue, naira } from './complianceUi';

// Management → Submissions & Compliance. Owner and HOS see every teacher;
// section heads see the teachers of their sections. Totals first, then a
// teacher × requirement matrix: any cell opens exactly what is missing.

const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const SECTION_LABELS = { nursery: 'Nursery', primary: 'Primary', secondary: 'Secondary', all: 'All teachers' };

function Tile({ label, value, tone = '' }) {
  return (
    <div className={INNER}>
      <p className={LABEL}>{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone || HEADING}`}>{value}</p>
    </div>
  );
}

function useRoleKey() {
  const location = useLocation();
  return location.pathname.split('/').filter(Boolean)[1] || 'hos';
}

// ─── One teacher, in full ────────────────────────────────────────────────────

function UnitActions({ item, unit, teacherId, onChanged, canVerify }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!canVerify) return null;
  const base = { ruleId: item.ruleId, periodKey: item.periodKey, teacherId, unitKey: unit.key };

  async function act(payload) {
    setBusy(true); setError('');
    try { await verifyComplianceUnit({ ...base, ...payload }); onChanged(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function onBehalf(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError('');
    try {
      const uploaded = await uploadComplianceFile(file);
      await verifyComplianceUnit({ ...base, onBehalf: true, files: [uploaded], note: 'Submitted on the teacher\'s behalf' });
      onChanged();
    } catch (err) { setError(err.message); } finally { setBusy(false); event.target.value = ''; }
  }

  const manual = unit.done && (unit.source === 'manual' || unit.source === 'upload');
  return (
    <span className="flex flex-wrap items-center gap-1">
      {!unit.done && item.method !== 'ndovera' && (
        <button type="button" disabled={busy} className="rounded-lg border border-emerald-400 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-200"
          onClick={() => act({ note: window.prompt('Note (optional) — for example "Physical register seen"') || '' })}>Mark submitted</button>
      )}
      {!unit.done && ['exam_questions', 'lesson_notes', 'diary', 'custom'].includes(item.kind) && (
        <label className="cursor-pointer rounded-lg border border-[#c9a96e]/60 px-2 py-0.5 text-xs font-bold text-[#191970] dark:text-slate-100">
          Upload on behalf
          <input type="file" className="sr-only" onChange={onBehalf} disabled={busy} />
        </label>
      )}
      {unit.awaitingApproval && unit.key && item.method !== 'ndovera' && (
        <button type="button" disabled={busy} className="rounded-lg border border-emerald-400 px-2 py-0.5 text-xs font-bold text-emerald-800" onClick={() => act({ note: 'Evidence checked' })}>Accept evidence</button>
      )}
      {manual && (
        <button type="button" disabled={busy} className="rounded-lg border border-rose-300 px-2 py-0.5 text-xs font-bold text-rose-700"
          onClick={() => { const note = window.prompt('Why is this being withdrawn?'); if (note !== null) act({ revoke: true, note }); }}>Withdraw</button>
      )}
      {error && <span role="alert" className="text-xs font-semibold text-rose-700">{error}</span>}
    </span>
  );
}

function FineDecision({ item, teacherId, onChanged }) {
  const [amount, setAmount] = useState(String(item.fine.amount));
  const [reason, setReason] = useState(item.fine.reason || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(decision) {
    setBusy(true); setError('');
    try {
      await decideComplianceFine({ ruleId: item.ruleId, periodKey: item.periodKey, teacherId, decision, amount, reason });
      onChanged();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-100">
      <p className="font-semibold">
        🔴 {naira(item.fine.proposed)} penalty proposed{item.fine.decision ? ` — ${item.fine.decision}${item.fine.decision !== 'waived' ? ` at ${naira(item.fine.amount)}` : ''}` : ''}
        {item.fine.reason ? ` (${item.fine.reason})` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={reason} onChange={event => setReason(event.target.value)} placeholder="Reason (needed to waive or adjust)" aria-label="Reason" className={`${INPUT} min-w-[220px] flex-1`} />
        <input type="number" min="0" value={amount} onChange={event => setAmount(event.target.value)} aria-label="Adjusted amount" className={`${INPUT} w-28`} />
        <button type="button" disabled={busy} onClick={() => decide('approved')} className={SECONDARY}>Approve</button>
        <button type="button" disabled={busy} onClick={() => decide('adjusted')} className={SECONDARY}>Adjust</button>
        <button type="button" disabled={busy} onClick={() => decide('waived')} className={SECONDARY}>Waive</button>
      </div>
      {error && <p role="alert" className="text-xs font-semibold">{error}</p>}
    </div>
  );
}

function TeacherDrawer({ teacherId, date, permissions, onClose, onChanged }) {
  const roleKey = useRoleKey();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    getTeacherCompliance(teacherId, { date }).then(setData).catch(err => setError(err.message));
  }, [teacherId, date]);
  useEffect(() => { load(); }, [load]);
  const changed = () => { load(); onChanged(); };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Teacher compliance" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#fff8f0] p-5 dark:bg-slate-950" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className={`text-xl font-black ${HEADING}`}>{data?.teacher?.name || 'Teacher'}</h2>
            {data?.teacher && <p className={`text-sm ${BODY}`}>{data.teacher.sections.map(section => SECTION_LABELS[section]).join(', ')}</p>}
            {data?.teacher && <Link to={`/roles/${roleKey}/staff/${encodeURIComponent(data.teacher.id)}`} className="text-sm font-semibold underline">Open staff file</Link>}
          </div>
          <button type="button" onClick={onClose} className={SECONDARY} aria-label="Close">✕</button>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {!data && !error && <p role="status" className={BODY}>Loading…</p>}
        {data && (
          <div className="space-y-4">
            {data.items.map(item => (
              <article key={`${item.ruleId}:${item.periodKey}`} className={INNER}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className={`font-black ${HEADING}`}>{item.ruleName}</p>
                    <p className={`text-xs ${BODY}`}>{item.periodLabel} · due {formatDue(item.dueAt)}{item.verification ? ` · ${item.verification === 'auto' ? 'auto-verified' : item.verification === 'manual' ? 'manually verified' : 'auto + manual'}` : ''}</p>
                  </div>
                  <StatusChip item={item} />
                </div>
                <ul className="mt-2 divide-y divide-[#c9a96e]/25">
                  {item.units.map(unit => (
                    <li key={unit.key} className={`flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm ${BODY}`}>
                      <span><span aria-hidden="true">{unit.done ? '✓' : '❌'}</span> {unit.label} <span className="text-xs opacity-75">— {unit.detail}</span></span>
                      <UnitActions item={item} unit={unit} teacherId={data.teacher.id} canVerify={permissions.canVerify} onChanged={changed} />
                    </li>
                  ))}
                </ul>
                {item.fine && (permissions.canDecideFines
                  ? <FineDecision item={item} teacherId={data.teacher.id} onChanged={changed} />
                  : <p className="mt-2 text-sm font-semibold text-rose-700">{naira(item.fine.amount)} penalty {item.fine.decision || 'proposed'}</p>)}
              </article>
            ))}
            {!data.items.length && <p className={BODY}>Nothing is due for this teacher in this period.</p>}

            {data.history.length > 0 && (
              <section className={INNER}>
                <h3 className={`mb-2 font-black ${HEADING}`}>Compliance history</h3>
                <table className={`w-full text-sm ${BODY}`}>
                  <thead><tr className="text-left">{['Week', 'Required', 'On time', 'Late', 'Missing'].map(head => <th key={head} className={`${LABEL} pr-2`}>{head}</th>)}</tr></thead>
                  <tbody>{data.history.map(week => <tr key={week.weekStart} className="border-t border-[#c9a96e]/25"><td className="py-1 pr-2">{week.label}</td><td>{week.required}</td><td>{week.onTime}</td><td>{week.late}</td><td>{week.missing + week.partial}</td></tr>)}</tbody>
                </table>
              </section>
            )}
            {data.audit.length > 0 && (
              <section className={INNER}>
                <h3 className={`mb-2 font-black ${HEADING}`}>Audit trail</h3>
                <ul className={`space-y-1 text-xs ${BODY}`}>
                  {data.audit.slice(0, 40).map(entry => (
                    <li key={entry.id}>{new Date(entry.createdAt).toLocaleString()} — <strong>{entry.actorName}</strong> {entry.action.replace(/_/g, ' ')}{entry.reason ? ` · “${entry.reason}”` : ''}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function Overview({ config }) {
  const [date, setDate] = useState('');
  const [filters, setFilters] = useState({ section: '', kind: '', status: '', search: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openTeacher, setOpenTeacher] = useState('');

  const load = useCallback(() => {
    getComplianceOverview({ date, section: filters.section, kind: filters.kind, status: filters.status })
      .then(next => { setData(next); setError(''); }).catch(err => setError(err.message));
  }, [date, filters.section, filters.kind, filters.status]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.rows || []).filter(row => !filters.search || row.teacher.name.toLowerCase().includes(filters.search.toLowerCase())), [data, filters.search]);
  const columns = data?.columns || [];
  const scopeSections = config.permissions.scope === 'all' ? ['nursery', 'primary', 'secondary'] : config.permissions.scope;
  const current = date || data?.date || '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={SECONDARY} disabled={!current} onClick={() => setDate(shiftDate(current, -7))}>← Previous week</button>
        <button type="button" className={SECONDARY} onClick={() => setDate('')}>This week</button>
        <button type="button" className={SECONDARY} disabled={!current} onClick={() => setDate(shiftDate(current, 7))}>Next week →</button>
        <input type="date" value={current} onChange={event => setDate(event.target.value)} aria-label="Week containing" className={INPUT} />
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      {data && (
        <>
          <section className={`${CARD} space-y-3`}>
            <h2 className={`text-lg font-black ${HEADING}`}>{data.weekLabel} — Teacher Compliance</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Teachers" value={data.summary.teachers} />
              <Tile label="Fully compliant" value={data.summary.fullyCompliant} tone="text-emerald-700 dark:text-emerald-300" />
              <Tile label="Partial" value={data.summary.partial} tone="text-amber-700 dark:text-amber-300" />
              <Tile label="Outstanding" value={data.summary.outstanding} tone="text-rose-700 dark:text-rose-300" />
              <Tile label="Late submissions" value={data.summary.late} tone="text-orange-700 dark:text-orange-300" />
              <Tile label="Proposed penalties" value={naira(data.summary.proposedPenalties)} />
            </div>
          </section>

          <section className={`${CARD} space-y-3`}>
            <div className="flex flex-wrap items-center gap-2">
              <input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Search teacher" aria-label="Search teacher" className={INPUT} />
              {scopeSections.length > 1 && (
                <select value={filters.section} onChange={event => setFilters(current => ({ ...current, section: event.target.value }))} aria-label="Section" className={INPUT}>
                  <option value="">All sections</option>
                  {scopeSections.map(section => <option key={section} value={section}>{SECTION_LABELS[section]}</option>)}
                </select>
              )}
              <select value={filters.kind} onChange={event => setFilters(current => ({ ...current, kind: event.target.value }))} aria-label="Submission type" className={INPUT}>
                <option value="">Every submission type</option>
                {config.kinds.map(kind => <option key={kind.key} value={kind.key}>{kind.label}</option>)}
              </select>
              <select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} aria-label="Status" className={INPUT}>
                <option value="">Any status</option>
                {['missing', 'partial', 'late', 'pending', 'complete'].map(status => <option key={status} value={status}>{STATUS[status].label}</option>)}
              </select>
            </div>
            {!columns.length && <p className={BODY}>No submission requirements yet. {config.permissions.canConfigure ? 'Add them under Settings.' : 'The Owner or HOS sets them up.'}</p>}
            {columns.length > 0 && (
              <div className="overflow-x-auto">
                <table className={`w-full min-w-[640px] text-sm ${BODY}`}>
                  <thead>
                    <tr className="text-left">
                      <th className={`${LABEL} py-2 pr-3`}>Teacher</th>
                      {columns.filter(column => !filters.kind || column.kind === filters.kind).map(column => <th key={column.ruleId} className={`${LABEL} py-2 pr-3`}>{column.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.teacher.id} className="border-t border-[#c9a96e]/25">
                        <td className="py-2 pr-3">
                          <button type="button" onClick={() => setOpenTeacher(row.teacher.id)} className="font-semibold underline-offset-2 hover:underline">{row.teacher.name}</button>
                          <StaffLink staffId={row.teacher.id} className="ml-2 text-xs underline opacity-70">file</StaffLink>
                        </td>
                        {columns.filter(column => !filters.kind || column.kind === filters.kind).map(column => {
                          const item = row.items.find(entry => entry.ruleId === column.ruleId);
                          return (
                            <td key={column.ruleId} className="py-2 pr-3">
                              {item ? (
                                <button type="button" onClick={() => setOpenTeacher(row.teacher.id)} title={item.missing.length ? `Missing: ${item.missing.join(', ')}` : item.ruleName} aria-label={`${row.teacher.name}: ${column.name} ${STATUS[item.status]?.label || item.status}`}>
                                  <StatusChip item={item} compact />
                                </button>
                              ) : <span className="text-xs opacity-50">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={columns.length + 1} className="py-3">No teachers match.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {openTeacher && <TeacherDrawer teacherId={openTeacher} date={current} permissions={data?.permissions || {}} onClose={() => setOpenTeacher('')} onChanged={load} />}
    </div>
  );
}

// ─── Class reports ───────────────────────────────────────────────────────────

function ClassReports() {
  const [reports, setReports] = useState(null);
  const [open, setOpen] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { getClassReports().then(data => setReports(data.reports)).catch(err => setError(err.message)); }, []);
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>;
  if (!reports) return <p role="status" className={BODY}>Loading…</p>;
  if (!reports.length) return <p className={`${CARD} ${BODY}`}>No class reports have been submitted yet.</p>;
  return (
    <div className="space-y-3">
      {reports.map(report => (
        <article key={report.id} className={CARD}>
          <button type="button" onClick={() => setOpen(current => (current === report.id ? '' : report.id))} aria-expanded={open === report.id} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
            <span><span className={`block font-black ${HEADING}`}>{report.className} — {report.periodLabel}</span><span className={`text-xs ${BODY}`}>{report.teacherName} · submitted {new Date(report.submittedAt).toLocaleString()}</span></span>
            <span className={LABEL}>{open === report.id ? 'Hide' : 'Read'}</span>
          </button>
          {open === report.id && (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <section className={INNER}>
                <h3 className={`mb-2 font-black ${HEADING}`}>Teacher's answers</h3>
                <dl className={`space-y-2 text-sm ${BODY}`}>
                  {report.questions.map(question => {
                    const value = report.answers[question.id];
                    const text = Array.isArray(value) ? value.map(item => (typeof item === 'object' ? item.name : item)).join(', ') : String(value ?? '');
                    return <div key={question.id}><dt className="font-semibold">{question.label}</dt><dd className="whitespace-pre-wrap">{text || '—'}</dd></div>;
                  })}
                </dl>
              </section>
              <section className={INNER}>
                <h3 className={`mb-2 font-black ${HEADING}`}>Report</h3>
                <p className={`whitespace-pre-wrap text-sm ${BODY}`}>{report.summary || '—'}</p>
                {report.aiSummary && report.aiSummary !== report.summary && (
                  <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Ndovera AI's original draft</summary><p className={`mt-1 whitespace-pre-wrap ${BODY}`}>{report.aiSummary}</p></details>
                )}
              </section>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

const BLANK_RULE = { caComponent: 'all', name: '', kind: 'lesson_notes', appliesTo: ['all'], frequency: 'weekly', intervalDays: 14, dueWeekday: 5, dueDayOfMonth: 28, dueTime: '16:00', dueDate: '', method: 'either', approvalRequired: false, lateAllowed: true, fineAmount: 0, graceHours: 24, startsOn: '', endsOn: '', evidenceUpload: false };

function RuleForm({ rule, config, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...BLANK_RULE, ...(rule || {}) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = patch => setForm(current => ({ ...current, ...patch }));
  const toggleSection = section => {
    const without = form.appliesTo.filter(item => item !== 'all' && item !== section);
    set({ appliesTo: section === 'all' ? ['all'] : form.appliesTo.includes(section) ? (without.length ? without : ['all']) : [...without, section] });
  };
  async function save() {
    setBusy(true); setError('');
    try {
      const payload = { ...form, fineAmount: Number(form.fineAmount || 0), graceHours: Number(form.graceHours || 0) };
      if (rule?.id) await updateComplianceRule(rule.id, payload); else await createComplianceRule(payload);
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className={`${INNER} grid gap-3 text-sm sm:grid-cols-2 ${BODY}`}>
      <label className="sm:col-span-2">Submission<input value={form.name} onChange={event => set({ name: event.target.value })} placeholder="e.g. Lesson Notes" className={`${INPUT} mt-1 w-full`} /></label>
      <label>What Ndovera checks
        <select value={form.kind} onChange={event => set({ kind: event.target.value })} className={`${INPUT} mt-1 w-full`}>
          {config.kinds.map(kind => <option key={kind.key} value={kind.key}>{kind.label}</option>)}
        </select>
      </label>
      {form.kind === 'ca_scores' && (
        <label>Which C.A.
          <select value={form.caComponent} onChange={event => set({ caComponent: event.target.value })} className={`${INPUT} mt-1 w-full`}>
            <option value="all">All C.A. (hand in once)</option>
            {(config.caComponents || []).map(component => <option key={component.key} value={component.key}>{component.label}</option>)}
          </select>
        </label>
      )}
      <fieldset><legend>Applies to</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {['all', ...config.sections].map(section => (
            <label key={section} className="flex items-center gap-1"><input type="checkbox" checked={form.appliesTo.includes(section)} onChange={() => toggleSection(section)} />{SECTION_LABELS[section]}</label>
          ))}
        </div>
      </fieldset>
      <label>Frequency
        <select value={form.frequency} onChange={event => set({ frequency: event.target.value })} className={`${INPUT} mt-1 w-full`}>
          <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="termly">Termly</option><option value="once">Once (one deadline)</option><option value="custom">Every few days</option>
        </select>
      </label>
      {form.frequency === 'weekly' && <label>Due day<select value={form.dueWeekday} onChange={event => set({ dueWeekday: Number(event.target.value) })} className={`${INPUT} mt-1 w-full`}>{WEEKDAYS.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>}
      {form.frequency === 'monthly' && <label>Due day of the month<input type="number" min="1" max="31" value={form.dueDayOfMonth} onChange={event => set({ dueDayOfMonth: Number(event.target.value) })} className={`${INPUT} mt-1 w-full`} /></label>}
      {form.frequency === 'custom' && <label>Every (days)<input type="number" min="1" value={form.intervalDays} onChange={event => set({ intervalDays: Number(event.target.value) })} className={`${INPUT} mt-1 w-full`} /></label>}
      {(form.frequency === 'once' || form.frequency === 'termly') && <label>Deadline date<input type="date" value={form.dueDate} onChange={event => set({ dueDate: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>}
      <label>Due time<input type="time" value={form.dueTime} onChange={event => set({ dueTime: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>
      <label>Submission method
        <select value={form.method} onChange={event => set({ method: event.target.value })} className={`${INPUT} mt-1 w-full`}>
          <option value="ndovera">Ndovera only</option><option value="manual">Manual verification</option><option value="either">Either</option>
        </select>
      </label>
      <label>Fine (₦, 0 for none)<input type="number" min="0" value={form.fineAmount} onChange={event => set({ fineAmount: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>
      <label>Grace period (hours)<input type="number" min="0" value={form.graceHours} onChange={event => set({ graceHours: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>
      <label>Starts<input type="date" value={form.startsOn} onChange={event => set({ startsOn: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>
      <label>Ends (blank: end of term)<input type="date" value={form.endsOn} onChange={event => set({ endsOn: event.target.value })} className={`${INPUT} mt-1 w-full`} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.approvalRequired} onChange={event => set({ approvalRequired: event.target.checked })} />Approval required</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.lateAllowed} onChange={event => set({ lateAllowed: event.target.checked })} />Late submission allowed</label>
      {['diary', 'custom'].includes(form.kind) && <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={form.evidenceUpload} onChange={event => set({ evidenceUpload: event.target.checked })} />Teachers may upload a file or photo as evidence</label>}
      {error && <p role="alert" className="font-semibold text-rose-700 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" disabled={busy} onClick={save} className={PRIMARY}>{busy ? 'Saving…' : 'Save requirement'}</button>
        <button type="button" onClick={onCancel} className={SECONDARY}>Cancel</button>
      </div>
    </div>
  );
}

function describeRule(rule) {
  const when = rule.frequency === 'weekly' ? `Weekly, ${WEEKDAYS[rule.dueWeekday]}` : rule.frequency === 'monthly' ? `Monthly, day ${rule.dueDayOfMonth}` : rule.frequency === 'once' ? `Once, ${rule.dueDate}` : rule.frequency === 'termly' ? 'Once a term' : `Every ${rule.intervalDays} days`;
  const who = rule.appliesTo.includes('all') ? 'All teachers' : rule.appliesTo.map(section => SECTION_LABELS[section]).join(', ');
  const which = rule.kind === 'ca_scores' ? ` (${rule.caComponent === 'all' ? 'all C.A.' : rule.caComponent.toUpperCase().replace('_', ' ')})` : '';
  return `${KIND_LABELS[rule.kind]}${which} · ${who} · ${when} ${rule.dueTime}${rule.fineAmount ? ` · fine ${naira(rule.fineAmount)} after ${rule.graceHours}h` : ''}`;
}

function TemplateEditor() {
  const [questions, setQuestions] = useState(null);
  const [types, setTypes] = useState([]);
  const [message, setMessage] = useState('');
  useEffect(() => { getClassReportTemplate().then(data => { setQuestions(data.questions); setTypes(data.questionTypes); }).catch(err => setMessage(err.message)); }, []);
  if (!questions) return null;
  const update = (index, patch) => setQuestions(current => current.map((question, at) => (at === index ? { ...question, ...patch } : question)));
  return (
    <section className={`${CARD} space-y-2`}>
      <h3 className={`font-black ${HEADING}`}>Weekly class report questions</h3>
      {questions.map((question, index) => (
        <div key={question.id || index} className="flex flex-wrap items-center gap-2">
          <input value={question.label} onChange={event => update(index, { label: event.target.value })} aria-label={`Question ${index + 1}`} className={`${INPUT} min-w-[240px] flex-1`} />
          <select value={question.type} onChange={event => update(index, { type: event.target.value })} aria-label={`Question ${index + 1} type`} className={INPUT}>
            {types.map(type => <option key={type} value={type}>{{ short: 'Short text', long: 'Long text', number: 'Number', yesno: 'Yes/No', choice: 'Multiple choice', students: 'Student selector', file: 'File attachment' }[type] || type}</option>)}
          </select>
          {question.type === 'choice' && <input value={(question.options || []).join(', ')} onChange={event => update(index, { options: event.target.value.split(',').map(item => item.trim()) })} placeholder="Options, comma-separated" className={INPUT} />}
          <label className={`flex items-center gap-1 text-xs ${BODY}`}><input type="checkbox" checked={Boolean(question.required)} onChange={event => update(index, { required: event.target.checked })} />Required</label>
          <button type="button" onClick={() => setQuestions(current => current.filter((_, at) => at !== index))} aria-label={`Remove question ${index + 1}`} className="text-rose-700">✕</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SECONDARY} onClick={() => setQuestions(current => [...current, { id: `q${Date.now()}`, label: '', type: 'short' }])}>Add question</button>
        <button type="button" className={PRIMARY} onClick={() => saveClassReportTemplate(questions).then(data => { setQuestions(data.questions); setMessage('Questions saved.'); }).catch(err => setMessage(err.message))}>Save questions</button>
      </div>
      {message && <p role="status" className={`text-sm font-semibold ${BODY}`}>{message}</p>}
    </section>
  );
}

function Settings({ config, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [heads, setHeads] = useState(() => Object.fromEntries(Object.entries(config.settings.sectionHeads).map(([section, roles]) => [section, roles.join(', ')])));
  const [message, setMessage] = useState('');
  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={`font-black ${HEADING}`}>Submission requirements</h3>
          {!editing && <button type="button" className={PRIMARY} onClick={() => setEditing('new')}>Add requirement</button>}
        </div>
        <p className={`text-sm ${BODY}`}>Set a requirement once; Ndovera works out every week (or month, or the single deadline) from it.</p>
        {editing === 'new' && <RuleForm config={config} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
        {config.rules.map(rule => (editing === rule.id
          ? <RuleForm key={rule.id} rule={rule} config={config} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />
          : (
            <div key={rule.id} className={`${INNER} flex flex-wrap items-center justify-between gap-2 ${rule.active ? '' : 'opacity-60'}`}>
              <div><p className={`font-black ${HEADING}`}>{rule.name}{!rule.active && ' (stopped)'}</p><p className={`text-xs ${BODY}`}>{describeRule(rule)}</p></div>
              <div className="flex gap-2">
                <button type="button" className={SECONDARY} onClick={() => setEditing(rule.id)}>Edit</button>
                <button type="button" className={SECONDARY} onClick={() => setComplianceRuleActive(rule.id, !rule.active).then(onChanged)}>{rule.active ? 'Stop' : 'Restart'}</button>
              </div>
            </div>
          )))}
      </section>
      <section className={`${CARD} space-y-2`}>
        <h3 className={`font-black ${HEADING}`}>Who oversees each section</h3>
        <p className={`text-sm ${BODY}`}>Roles (comma-separated) that see and verify the teachers of each section. The Owner and HOS always see everyone.</p>
        {Object.keys(heads).map(section => (
          <label key={section} className={`flex flex-wrap items-center gap-2 text-sm ${BODY}`}>
            <span className="w-24 font-semibold">{SECTION_LABELS[section]}</span>
            <input value={heads[section]} onChange={event => setHeads(current => ({ ...current, [section]: event.target.value }))} className={`${INPUT} flex-1`} />
          </label>
        ))}
        <button type="button" className={PRIMARY} onClick={() => saveComplianceSettings({ sectionHeads: Object.fromEntries(Object.entries(heads).map(([section, text]) => [section, text.split(',').map(item => item.trim()).filter(Boolean)])) })
          .then(() => { setMessage('Saved.'); onChanged(); }).catch(err => setMessage(err.message))}>Save</button>
        {message && <p role="status" className={`text-sm font-semibold ${BODY}`}>{message}</p>}
      </section>
      <TemplateEditor />
    </div>
  );
}

export default function ComplianceCentre({ dashboardLabel = 'Dashboard' }) {
  const [config, setConfig] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const load = useCallback(() => { getComplianceConfig().then(setConfig).catch(err => setError(err.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'reports', label: 'Class reports' },
    ...(config?.permissions.canConfigure ? [{ key: 'settings', label: 'Settings' }] : []),
  ];
  return (
    <StudentSectionShell title="Submissions & Compliance" dashboardLabel={dashboardLabel} subtitle="Who has submitted what, what is missing, and what is late — work done in Ndovera is counted automatically; work done on paper is verified here.">
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      {config && !config.permissions.canOversee && <p className={`${CARD} ${BODY}`}>You do not oversee any teachers.</p>}
      {config && config.permissions.canOversee && (
        <div className="space-y-4">
          <nav className="flex flex-wrap gap-2" aria-label="Compliance sections">
            {tabs.map(item => (
              <button key={item.key} type="button" aria-pressed={tab === item.key} onClick={() => setTab(item.key)} className={tab === item.key ? PRIMARY : SECONDARY}>{item.label}</button>
            ))}
          </nav>
          {tab === 'overview' && <Overview config={config} />}
          {tab === 'reports' && <ClassReports />}
          {tab === 'settings' && <Settings config={config} onChanged={load} />}
        </div>
      )}
    </StudentSectionShell>
  );
}
