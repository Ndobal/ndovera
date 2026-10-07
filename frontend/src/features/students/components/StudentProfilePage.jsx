import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addStudentRecord,
  deleteResultDocument,
  deleteStudentRecord,
  generateStudentAiReport,
  getResultRecords,
  getStudentProfile,
  updateStudentRecord,
} from '../../school/services/schoolApi';
import { uploadComplianceFile } from '../../compliance/complianceApi';
import ResultRecordViewer from '../../results-engine/components/ResultRecordViewer';

// The Digital Student File. One file per learner, opened from their name
// anywhere in Ndovera. The server says what this viewer may see and add
// (teachers: their pupils' academic and pastoral file; the clinic: health;
// the accountant: fees; parents and the learner: their own slice), and every
// tab that shows up can actually be used — no empty decoration.

const CARD = 'rounded-2xl border border-[#c9a96e]/40 bg-[#fff8f0] p-4 dark:border-white/10 dark:bg-slate-900/40';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white/85 px-3 py-2 text-sm text-[#191970] outline-none focus:border-[#1a5c38] dark:border-white/15 dark:bg-black/20 dark:text-slate-100';
const BTN = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black';
const GHOST = 'rounded-2xl border border-[#c9a96e]/50 px-3 py-1.5 text-xs font-bold text-[#191970] dark:border-white/15 dark:text-slate-100';
const TEXT = 'text-[#191970] dark:text-slate-200';

// Record tabs: which stored categories each shows, and what a new entry is called.
const RECORD_GROUPS = {
  behaviour: { label: 'Behaviour', categories: [['behaviour', 'Behaviour note']] },
  reports: { label: 'Reports', categories: [['report', 'Report'], ['comment', 'Comment'], ['recommendation', 'Recommendation']] },
  health: { label: 'Health', categories: [['health', 'Health record']] },
  documents: { label: 'Documents', categories: [['document', 'Document']] },
  awards: { label: 'Awards', categories: [['reward', 'Award'], ['scholarship', 'Scholarship'], ['competition', 'Competition']] },
  disciplinary: { label: 'Disciplinary', categories: [['disciplinary', 'Disciplinary case'], ['punishment', 'Sanction']] },
  notes: { label: 'Notes', categories: [['note', 'Staff note']] },
  activities: { label: 'Activities', categories: [['activity', 'Activity / club']] },
};
const BEHAVIOUR_RATINGS = ['Excellent', 'Good', 'Fair', 'Needs attention'];
// Private records: seen only by the student, their parents, the HoS/Owner and the Accountant.
const PRIVATE_GROUP = {
  label: 'Private',
  categories: Object.values(RECORD_GROUPS).flatMap(group => group.categories).filter(([category], index, all) => all.findIndex(([other]) => other === category) === index),
};
const isPrivate = record => record?.metadata?.visibility === 'private';
const naira = value => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const when = value => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Stat({ label, value, accent = 'text-[#800000] dark:text-white' }) {
  return (
    <div className={CARD}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-300">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function Empty({ children }) {
  return <div className={`${CARD} text-sm ${TEXT}`}>{children}</div>;
}

function RecordGroup({ group, profile, studentId, onChanged, setError }) {
  const privateTab = group === 'private';
  const config = privateTab ? PRIVATE_GROUP : RECORD_GROUPS[group];
  const addable = config.categories.filter(([category]) => (privateTab ? profile.privateCategories : profile.addableCategories)?.includes(category));
  const [form, setForm] = useState({ category: addable[0]?.[0] || '', title: '', detail: '', rating: '', files: [] });
  const [saving, setSaving] = useState(false);
  const categories = config.categories.map(([category]) => category);
  const items = (profile.records || []).filter(record => (privateTab ? isPrivate(record) : categories.includes(record.category)));
  const labelOf = category => config.categories.find(([key]) => key === category)?.[1] || category;

  async function save() {
    if (!form.title.trim() && !form.detail.trim()) return;
    setSaving(true);
    try {
      await addStudentRecord(studentId, {
        category: form.category, title: form.title.trim(), detail: form.detail.trim(), files: form.files, private: privateTab,
        metadata: form.rating ? { rating: form.rating } : undefined,
      });
      setForm(current => ({ ...current, title: '', detail: '', rating: '', files: [] }));
      onChanged();
    } catch (err) { setError(err?.message || 'Could not save the record.'); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      {addable.length > 0 && (
        <div className={`${CARD} space-y-2`}>
          <p className="text-sm font-bold text-[#800000] dark:text-white">{privateTab ? 'Add a private record' : `Add to ${config.label.toLowerCase()}`}</p>
          {privateTab && <p className={`text-xs ${TEXT}`}>Only the student, their parents, the HoS, the Owner and the Accountant can see private records. Teachers cannot.</p>}
          {addable.length > 1 && (
            <select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} aria-label="Kind" className={INPUT}>
              {addable.map(([category, label]) => <option key={category} value={category}>{label}</option>)}
            </select>
          )}
          <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Title" aria-label="Title" className={INPUT} />
          <textarea value={form.detail} onChange={event => setForm(current => ({ ...current, detail: event.target.value }))} placeholder="Details" aria-label="Details" rows={3} className={INPUT} />
          {group === 'behaviour' && (
            <select value={form.rating} onChange={event => setForm(current => ({ ...current, rating: event.target.value }))} aria-label="Behaviour rating" className={INPUT}>
              <option value="">Overall behaviour (optional)</option>
              {BEHAVIOUR_RATINGS.map(rating => <option key={rating} value={rating}>{rating}</option>)}
            </select>
          )}
          {(group === 'documents' || group === 'health' || group === 'awards' || privateTab) && (
            <label className={`block text-sm ${TEXT}`}>
              Attach a file
              <input type="file" className="mt-1 block text-sm" onChange={async event => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const uploaded = await uploadComplianceFile(file);
                  setForm(current => ({ ...current, files: [...current.files, uploaded] }));
                } catch (err) { setError(err?.message || 'Could not upload that file.'); }
              }} />
            </label>
          )}
          {form.files.length > 0 && <p className="text-xs">{form.files.map(file => file.name).join(', ')}</p>}
          <button type="button" onClick={save} disabled={saving} className={BTN}>{saving ? 'Saving…' : 'Add'}</button>
        </div>
      )}
      {items.length === 0 ? <Empty>No {privateTab ? 'private records' : config.label.toLowerCase()} recorded yet.</Empty> : items.map(record => (
        <div key={record.id} className={CARD}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-400">
                {isPrivate(record) ? '🔒 Private · ' : ''}{privateTab ? (Object.values(RECORD_GROUPS).flatMap(item => item.categories).find(([key]) => key === record.category)?.[1] || record.category) : labelOf(record.category)}{record.metadata?.rating ? ` · ${record.metadata.rating}` : ''}{record.metadata?.status ? ` · ${record.metadata.status}` : ''}
              </p>
              {record.title ? <p className="font-bold text-[#191970] dark:text-white">{record.title}</p> : null}
              {record.detail ? <p className={`mt-1 whitespace-pre-wrap text-sm ${TEXT}`}>{record.detail}</p> : null}
              {(record.metadata?.files || []).map(file => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="mr-2 text-xs underline">📎 {file.name}</a>)}
              {(record.metadata?.history || []).map((entry, index) => <p key={index} className="text-[11px] text-[#800020] dark:text-slate-400">{when(entry.at)} — {entry.by}: {entry.status}{entry.note ? ` · ${entry.note}` : ''}</p>)}
              <p className="mt-2 text-[11px] text-[#800020] dark:text-slate-400">{record.createdByName || 'Staff'} • {when(record.createdAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {record.category === 'disciplinary' && record.metadata?.status !== 'closed' && profile.addableCategories?.includes('disciplinary') && (
                <button type="button" className={GHOST} onClick={async () => {
                  const note = window.prompt('How was it resolved?');
                  if (note === null) return;
                  try { await updateStudentRecord(studentId, record.id, { status: 'closed', note }); onChanged(); } catch (err) { setError(err?.message || 'Could not update the case.'); }
                }}>Close case</button>
              )}
              {profile.permissions?.deleteRecords && (
                <button type="button" onClick={async () => {
                  if (!window.confirm('Remove this record?')) return;
                  try { await deleteStudentRecord(studentId, record.id); onChanged(); } catch (err) { setError(err?.message || 'Could not remove the record.'); }
                }} className="text-xs font-bold text-red-600">Remove</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function paymentLink(studentId, studentName) {
  const role = (typeof window !== 'undefined' && window.location.pathname.split('/')[2]) || 'accountant';
  const page = role === 'accountant' ? 'billing' : 'finance';
  return `/roles/${role}/${page}?pay=${encodeURIComponent(studentId)}&name=${encodeURIComponent(studentName || '')}`;
}

export default function StudentProfilePage({ studentId, studentName = 'Student', onClose, inline = false }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [resultData, setResultData] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProfile(await getStudentProfile(studentId));
    } catch (loadError) {
      setError(loadError?.message || 'Could not load this student file.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (inline) return undefined;
    function onKey(event) { if (event.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [onClose, inline]);

  useEffect(() => {
    if (activeTab !== 'results' || resultData || resultsLoading) return;
    let cancelled = false;
    setResultsLoading(true);
    getResultRecords(studentId)
      .then(data => { if (!cancelled) { setResultData(data); setSelectedRecordId(data?.publications?.[0]?.id || ''); } })
      .catch(() => { if (!cancelled) setResultData({ publications: [], documents: [], students: [] }); })
      .finally(() => { if (!cancelled) setResultsLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, resultData, resultsLoading, studentId]);

  const permissions = profile?.permissions;
  const student = profile?.student || { name: studentName };
  const tabs = useMemo(() => {
    if (!permissions) return [{ id: 'overview', label: 'Overview' }];
    const groups = permissions.groups || {};
    return [
      { id: 'overview', label: 'Overview', show: true },
      { id: 'personal', label: 'Personal', show: permissions.personal?.view },
      { id: 'guardians', label: 'Parents/Guardians', show: permissions.guardians?.view },
      { id: 'academic', label: 'Academic', show: permissions.academic?.view },
      { id: 'results', label: 'Results', show: permissions.results?.view },
      { id: 'attendance', label: 'Attendance', show: permissions.attendance?.view },
      { id: 'behaviour', label: 'Behaviour', show: groups.behaviour?.view },
      { id: 'reports', label: 'Reports', show: groups.reports?.view },
      { id: 'health', label: 'Health', show: groups.health?.view },
      { id: 'fees', label: 'Fees', show: permissions.fees?.view },
      { id: 'payments', label: 'Payments', show: permissions.fees?.view },
      { id: 'documents', label: 'Documents', show: groups.documents?.view },
      { id: 'awards', label: 'Awards', show: groups.awards?.view },
      { id: 'disciplinary', label: 'Disciplinary', show: groups.disciplinary?.view },
      { id: 'notes', label: 'Notes', show: groups.notes?.view },
      { id: 'activities', label: 'Activities', show: groups.activities?.view },
      { id: 'private', label: '🔒 Private', show: permissions.seePrivate },
      { id: 'timeline', label: 'Timeline', show: true },
      { id: 'ai', label: 'AI Progress Report', show: permissions.aiReport?.view },
    ].filter(tab => tab.show);
  }, [permissions]);

  async function generateReport() {
    setAiLoading(true);
    setAiError('');
    try {
      const data = await generateStudentAiReport(studentId);
      setAiReport(data?.report || '');
    } catch (reportError) {
      setAiError(reportError?.message || 'Could not generate the AI report.');
    } finally {
      setAiLoading(false);
    }
  }

  function renderTab() {
    if (!profile) return null;
    const overview = profile.overview || {};
    if (activeTab === 'overview') {
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {overview.academic != null && <Stat label="Academic" value={`${overview.academic}%`} />}
          {overview.attendance != null && <Stat label="Attendance" value={`${overview.attendance}%`} accent="text-[#1a5c38] dark:text-emerald-300" />}
          {overview.outstandingFees != null && <Stat label="Outstanding fees" value={naira(overview.outstandingFees)} accent={overview.outstandingFees > 0 ? 'text-[#800020] dark:text-rose-300' : 'text-[#1a5c38] dark:text-emerald-300'} />}
          {permissions.groups?.behaviour?.view && <Stat label="Behaviour" value={overview.behaviour} />}
          {permissions.groups?.awards?.view && <Stat label="Awards" value={overview.awards} />}
          {permissions.groups?.disciplinary?.view && <Stat label="Open disciplinary cases" value={overview.openDisciplinary} accent={overview.openDisciplinary ? 'text-[#800020] dark:text-rose-300' : 'text-[#1a5c38] dark:text-emerald-300'} />}
          {overview.assignmentCompletion != null && <Stat label="Assignments" value={`${overview.assignmentCompletion}% completion`} />}
        </div>
      );
    }
    if (activeTab === 'personal') {
      const personal = profile.personal || {};
      const rows = [['Full name', student.name], ['Student ID', student.displayId], ['Class', student.className], ['Date of birth', personal.dateOfBirth ? when(personal.dateOfBirth) : ''], ['Gender', personal.gender], ['Phone', personal.phone], ['Address', personal.address], ['State of origin', personal.stateOfOrigin], ['Nationality', personal.nationality], ['Religion', personal.religion], ['Admitted', personal.admittedOn ? when(personal.admittedOn) : ''], ['Status', student.status]];
      return (
        <div className={CARD}>
          <dl className={`grid gap-3 sm:grid-cols-2 text-sm ${TEXT}`}>
            {rows.map(([label, value]) => <div key={label}><dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-400">{label}</dt><dd className="font-semibold">{value || '—'}</dd></div>)}
          </dl>
          {permissions.personal?.add && <p className="mt-3 text-xs text-[#800020] dark:text-slate-400">Personal details are edited from People → the student's profile.</p>}
        </div>
      );
    }
    if (activeTab === 'guardians') {
      if (!profile.guardians?.length) return <Empty>No parent or guardian is linked yet.{permissions.guardians?.add ? ' Link one from People → Parents.' : ''}</Empty>;
      return (
        <div className="space-y-3">
          {profile.guardians.map(guardian => (
            <div key={guardian.id} className={CARD}>
              <p className="font-bold text-[#191970] dark:text-white">{guardian.name}</p>
              <p className={`text-sm ${TEXT}`}>{guardian.relationship}{guardian.phone ? ` · ${guardian.phone}` : ''}{guardian.email ? ` · ${guardian.email}` : ''}</p>
            </div>
          ))}
        </div>
      );
    }
    if (activeTab === 'academic') {
      const assignments = profile.assignments || { total: 0, completed: 0, notDone: 0, graded: 0, averageScore: 0 };
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Class" value={student.className || '—'} />
          <Stat label="Latest average" value={overview.academic != null ? `${overview.academic}%` : '—'} />
          <Stat label="Assignments done" value={`${assignments.completed}/${assignments.total}`} />
          <Stat label="Not done" value={assignments.notDone} accent="text-[#800020] dark:text-rose-300" />
          <Stat label="Graded" value={assignments.graded} />
          <Stat label="Average assignment score" value={`${assignments.averageScore}%`} accent="text-[#1a5c38] dark:text-emerald-300" />
        </div>
      );
    }
    if (activeTab === 'results') {
      if (resultsLoading) return <Empty>Loading results…</Empty>;
      return (
        <ResultRecordViewer
          students={resultData?.students || []}
          activeStudentId={resultData?.activeStudentId || studentId}
          records={resultData?.publications || []}
          selectedRecordId={selectedRecordId}
          onSelectRecord={setSelectedRecordId}
          documents={resultData?.documents || []}
          lockedByFees={Boolean(resultData?.lockedByFees)}
          feeStatus={resultData?.feeStatus || ''}
          emptyMessage="No published results or uploaded result documents for this student yet."
          canManageDocuments={Boolean(permissions.deleteRecords)}
          onDeleteDocument={async (documentId) => {
            await deleteResultDocument(documentId);
            setResultData(await getResultRecords(studentId));
          }}
        />
      );
    }
    if (activeTab === 'attendance') {
      const attendance = profile.attendance || { present: 0, absent: 0, late: 0, excused: 0, total: 0, rate: 0 };
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Attendance rate" value={`${attendance.rate}%`} accent="text-[#1a5c38] dark:text-emerald-300" />
          <Stat label="Present" value={attendance.present} accent="text-[#1a5c38] dark:text-emerald-300" />
          <Stat label="Late" value={attendance.late} accent="text-[#a86b1f] dark:text-amber-300" />
          <Stat label="Absent" value={attendance.absent} accent="text-[#800020] dark:text-rose-300" />
          <Stat label="Excused" value={attendance.excused} />
          <Stat label="Days recorded" value={attendance.total} />
        </div>
      );
    }
    if (activeTab === 'fees') {
      const fees = profile.fees;
      if (!fees) return <Empty>No fee account found for this student.</Empty>;
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="This term's charges" value={naira(fees.totals.currentTermCharges)} />
            <Stat label="Paid this term" value={naira(fees.totals.paidThisTerm)} accent="text-[#1a5c38] dark:text-emerald-300" />
            <Stat label="Earlier balances" value={naira(fees.totals.previousOutstanding)} />
            <Stat label="Total outstanding" value={naira(fees.totals.totalOutstanding)} accent={fees.totals.totalOutstanding > 0 ? 'text-[#800020] dark:text-rose-300' : 'text-[#1a5c38] dark:text-emerald-300'} />
          </div>
          <div className={CARD}>
            <p className="mb-2 text-sm font-bold text-[#800000] dark:text-white">Charges</p>
            {![...fees.current, ...fees.previousOutstanding].length && <p className={`text-sm ${TEXT}`}>No charges.</p>}
            {[...fees.current, ...fees.previousOutstanding].map(charge => (
              <p key={charge.id} className={`flex justify-between gap-3 text-sm ${TEXT}`}><span>{charge.feeItem || charge.label || 'Fee'}{charge.termName ? ` · ${charge.termName}` : ''}</span><span className="font-semibold">{naira(charge.balance)} of {naira(charge.netAmount)}</span></p>
            ))}
          </div>
          {permissions.recordPayment && <a href={paymentLink(student.id, student.name)} className={`${BTN} inline-block`}>Record payment</a>}
        </div>
      );
    }
    if (activeTab === 'payments') {
      return (
        <div className="space-y-3">
          {permissions.recordPayment && <a href={paymentLink(student.id, student.name)} className={`${BTN} inline-block`}>Record payment</a>}
          {!profile.payments?.length && <Empty>No payments recorded.</Empty>}
          {(profile.payments || []).map(payment => (
            <div key={payment.id} className={`${CARD} flex flex-wrap items-center justify-between gap-2`}>
              <span className={`text-sm ${TEXT}`}>{when(payment.paidOn)} · {payment.method || 'payment'}{payment.reference ? ` · ${payment.reference}` : ''}{payment.status === 'reversed' ? ' · reversed' : ''}</span>
              <span className="font-black text-[#1a5c38] dark:text-emerald-300">{naira(payment.amount)}</span>
            </div>
          ))}
          {profile.receipts?.length > 0 && <p className={`text-xs ${TEXT}`}>Receipts: {profile.receipts.map(receipt => receipt.receiptNo).join(', ')}</p>}
        </div>
      );
    }
    if (activeTab === 'timeline') {
      if (!profile.timeline?.length) return <Empty>Nothing on the timeline yet.</Empty>;
      return (
        <ol className="space-y-2">
          {profile.timeline.map((event, index) => <li key={index} className={`${CARD} text-sm ${TEXT}`}><span className="font-bold">{when(event.at)}</span> — {event.text}</li>)}
        </ol>
      );
    }
    if (activeTab === 'ai') {
      return (
        <div className="space-y-4">
          <div className={CARD}>
            <p className={`text-sm ${TEXT}`}>Generate an AI termly progress report from this student&apos;s results, assignments, attendance and staff records.</p>
            <button type="button" onClick={generateReport} disabled={aiLoading} className={`${BTN} mt-3`}>{aiLoading ? 'Generating…' : aiReport ? 'Regenerate report' : 'Generate AI Progress Report'}</button>
            {aiError ? <p className="mt-3 text-sm text-red-600 dark:text-rose-300">{aiError}</p> : null}
          </div>
          {aiReport ? <div className={`${CARD} whitespace-pre-wrap text-sm leading-7 ${TEXT}`}>{aiReport}</div> : null}
        </div>
      );
    }
    if (RECORD_GROUPS[activeTab] || activeTab === 'private') return <RecordGroup key={activeTab} group={activeTab} profile={profile} studentId={studentId} onChanged={loadProfile} setError={setError} />;
    return null;
  }

  const body = (
    <>
      <div className="flex items-center gap-3 border-b border-[#c9a96e]/40 bg-[#b5e3f4] px-4 py-3 dark:border-white/10 dark:bg-slate-900/60">
        {student.avatar ? (
          <img src={student.avatar} alt={student.name} className="h-12 w-12 rounded-2xl border border-[#c9a96e]/40 object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a5c38]/15 text-lg font-black text-[#1a5c38] dark:bg-[#00ffff]/15 dark:text-[#00ffff]">{String(student.name || 'S').slice(0, 1).toUpperCase()}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-[#800000] dark:text-white">{student.name || studentName}</p>
          <p className="truncate text-xs text-[#800020] dark:text-slate-300">{[student.className, student.displayId, 'Digital Student File'].filter(Boolean).join(' • ')}</p>
        </div>
        {onClose && <button type="button" onClick={onClose} className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-bold text-[#b5e3f4] dark:bg-rose-500/80">Close</button>}
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-[#c9a96e]/30 bg-[#b5e3f4]/60 px-4 py-2 dark:border-white/10 dark:bg-slate-900/40" role="tablist" aria-label="Student file sections">
        {tabs.map(tab => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs font-bold transition ${activeTab === tab.id ? 'bg-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-black' : 'bg-white/60 text-[#800020] dark:bg-slate-800/60 dark:text-slate-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {error && <div className={`${CARD} mb-3 text-sm text-red-600 dark:text-rose-300`} role="alert">{error}</div>}
        {loading && !profile ? <Empty>Loading student file…</Empty> : <div className="mx-auto max-w-5xl">{renderTab()}</div>}
      </div>
    </>
  );

  if (inline) return <div className="flex min-h-[70vh] flex-col rounded-3xl border border-[#c9a96e]/40 bg-[#fdf7ec] dark:border-white/10 dark:bg-slate-950" aria-label={`${student.name} student file`}>{body}</div>;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#fdf7ec] dark:bg-slate-950" role="dialog" aria-modal="true" aria-label={`${student.name} profile`}>{body}</div>,
    document.body,
  );
}
