import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addStudentRecord,
  deleteStudentRecord,
  generateStudentAiReport,
  getResultRecords,
  getStudentProfile,
} from '../../school/services/schoolApi';
import ResultRecordViewer from '../../results-engine/components/ResultRecordViewer';

// One full-screen "student database" with tabs for everything a school keeps on a learner.
// Results/assignments/attendance come from live data; the categorised records (comments,
// reports, punishments, rewards, recommendations, scholarships, competitions) are kept in the
// student_records store and can be added by staff. Visible to staff, the learner and their parent.

const RECORD_TABS = [
  { id: 'comment', label: 'Comments', single: 'Comment' },
  { id: 'report', label: 'Reports', single: 'Report' },
  { id: 'punishment', label: 'Punishments', single: 'Punishment' },
  { id: 'reward', label: 'Rewards', single: 'Reward' },
  { id: 'recommendation', label: 'Recommendations', single: 'Recommendation' },
  { id: 'scholarship', label: 'Scholarships', single: 'Scholarship' },
  { id: 'competition', label: 'Competitions', single: 'Competition' },
];

const PRIMARY_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'results', label: 'Results' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'ai', label: 'AI Progress Report' },
];

const CARD = 'rounded-2xl border border-[#c9a96e]/40 bg-[#fff8f0] p-4 dark:border-white/10 dark:bg-slate-900/40';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white/85 px-3 py-2 text-sm text-[#191970] outline-none focus:border-[#1a5c38] dark:border-white/15 dark:bg-black/20 dark:text-slate-100';
const BTN = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black';

function Stat({ label, value, accent = 'text-[#800000] dark:text-white' }) {
  return (
    <div className={CARD}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-300">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

export default function StudentProfilePage({ studentId, studentName = 'Student', onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Results (lazy)
  const [resultData, setResultData] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState('');

  // AI report (lazy)
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Add-record form
  const [recordForm, setRecordForm] = useState({ title: '', detail: '' });
  const [savingRecord, setSavingRecord] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getStudentProfile(studentId);
      setProfile(data);
    } catch (loadError) {
      setError(loadError?.message || 'Could not load this student profile.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [onClose]);

  // Lazy-load published results when the Results tab is first opened.
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

  const canManage = Boolean(profile?.canManage);
  const student = profile?.student || { name: studentName };
  const recordsByCategory = useMemo(() => {
    const map = {};
    (profile?.records || []).forEach(record => {
      (map[record.category] = map[record.category] || []).push(record);
    });
    return map;
  }, [profile?.records]);

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

  async function submitRecord(category) {
    if (!recordForm.title.trim() && !recordForm.detail.trim()) return;
    setSavingRecord(true);
    try {
      await addStudentRecord(studentId, { category, title: recordForm.title.trim(), detail: recordForm.detail.trim() });
      setRecordForm({ title: '', detail: '' });
      await loadProfile();
    } catch (saveError) {
      setError(saveError?.message || 'Could not save the record.');
    } finally {
      setSavingRecord(false);
    }
  }

  async function removeRecord(recordId) {
    try {
      await deleteStudentRecord(studentId, recordId);
      await loadProfile();
    } catch (deleteError) {
      setError(deleteError?.message || 'Could not remove the record.');
    }
  }

  const assignments = profile?.assignments || { total: 0, completed: 0, notDone: 0, graded: 0, averageScore: 0 };
  const attendance = profile?.attendance || { present: 0, absent: 0, late: 0, excused: 0, total: 0, rate: 0 };

  function renderRecordTab(tab) {
    const items = recordsByCategory[tab.id] || [];
    return (
      <div className="space-y-4">
        {canManage && (
          <div className={CARD}>
            <p className="text-sm font-bold text-[#800000] dark:text-white">Add {tab.single}</p>
            <input
              value={recordForm.title}
              onChange={event => setRecordForm(form => ({ ...form, title: event.target.value }))}
              placeholder={`${tab.single} title`}
              className={`${INPUT} mt-3`}
            />
            <textarea
              value={recordForm.detail}
              onChange={event => setRecordForm(form => ({ ...form, detail: event.target.value }))}
              placeholder="Details"
              rows={3}
              className={`${INPUT} mt-2`}
            />
            <button type="button" onClick={() => submitRecord(tab.id)} disabled={savingRecord} className={`${BTN} mt-3`}>
              {savingRecord ? 'Saving…' : `Add ${tab.single}`}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className={`${CARD} text-sm text-[#191970] dark:text-slate-300`}>No {tab.label.toLowerCase()} recorded yet.</div>
        ) : items.map(record => (
          <div key={record.id} className={CARD}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {record.title ? <p className="font-bold text-[#191970] dark:text-white">{record.title}</p> : null}
                {record.detail ? <p className="mt-1 text-sm text-[#191970] dark:text-slate-300 whitespace-pre-wrap">{record.detail}</p> : null}
                <p className="mt-2 text-[11px] text-[#800020] dark:text-slate-400">
                  {record.createdByName || 'Staff'} • {record.createdAt ? new Date(record.createdAt).toLocaleString() : ''}
                </p>
              </div>
              {canManage && (
                <button type="button" onClick={() => removeRecord(record.id)} className="shrink-0 text-xs font-bold text-red-600">Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderTab() {
    if (activeTab === 'overview') {
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Published results" value={profile?.results?.publicationCount ?? 0} />
          <Stat label="Result documents" value={profile?.results?.documentCount ?? 0} />
          <Stat label="Assignments done" value={`${assignments.completed}/${assignments.total}`} />
          <Stat label="Outstanding" value={assignments.notDone} accent="text-[#800020] dark:text-rose-300" />
          <Stat label="Avg assignment score" value={`${assignments.averageScore}%`} accent="text-[#1a5c38] dark:text-emerald-300" />
          <Stat label="Attendance rate" value={`${attendance.rate}%`} accent="text-[#1a5c38] dark:text-emerald-300" />
          <Stat label="Days present" value={attendance.present} />
          <Stat label="Days absent" value={attendance.absent} accent="text-[#800020] dark:text-rose-300" />
        </div>
      );
    }

    if (activeTab === 'results') {
      if (resultsLoading) return <div className={`${CARD} text-sm`}>Loading results…</div>;
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
        />
      );
    }

    if (activeTab === 'assignments') {
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Total assigned" value={assignments.total} />
          <Stat label="Completed" value={assignments.completed} accent="text-[#1a5c38] dark:text-emerald-300" />
          <Stat label="Not done" value={assignments.notDone} accent="text-[#800020] dark:text-rose-300" />
          <Stat label="Graded" value={assignments.graded} />
          <Stat label="Average score" value={`${assignments.averageScore}%`} accent="text-[#1a5c38] dark:text-emerald-300" />
        </div>
      );
    }

    if (activeTab === 'attendance') {
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

    if (activeTab === 'ai') {
      return (
        <div className="space-y-4">
          <div className={CARD}>
            <p className="text-sm text-[#191970] dark:text-slate-300">
              Generate an AI termly progress report from this student&apos;s results, assignments, attendance and staff records.
            </p>
            <button type="button" onClick={generateReport} disabled={aiLoading} className={`${BTN} mt-3`}>
              {aiLoading ? 'Generating…' : aiReport ? 'Regenerate report' : 'Generate AI Progress Report'}
            </button>
            {aiError ? <p className="mt-3 text-sm text-red-600 dark:text-rose-300">{aiError}</p> : null}
          </div>
          {aiReport ? (
            <div className={`${CARD} whitespace-pre-wrap text-sm leading-7 text-[#191970] dark:text-slate-200`}>{aiReport}</div>
          ) : null}
        </div>
      );
    }

    const recordTab = RECORD_TABS.find(tab => tab.id === activeTab);
    if (recordTab) return renderRecordTab(recordTab);
    return null;
  }

  const allTabs = [...PRIMARY_TABS, ...RECORD_TABS];

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#fdf7ec] dark:bg-slate-950" role="dialog" aria-modal="true" aria-label={`${student.name} profile`}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#c9a96e]/40 bg-[#f5deb3] px-4 py-3 dark:border-white/10 dark:bg-slate-900/60">
        {student.avatar ? (
          <img src={student.avatar} alt={student.name} className="h-12 w-12 rounded-2xl object-cover border border-[#c9a96e]/40" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a5c38]/15 text-lg font-black text-[#1a5c38] dark:bg-[#00ffff]/15 dark:text-[#00ffff]">
            {String(student.name || 'S').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-[#800000] dark:text-white">{student.name || studentName}</p>
          <p className="truncate text-xs text-[#800020] dark:text-slate-300">
            {[student.className, student.displayId].filter(Boolean).join(' • ') || 'Student profile'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-bold text-[#f5deb3] dark:bg-rose-500/80">Close</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-[#c9a96e]/30 bg-[#f5deb3]/60 px-4 py-2 dark:border-white/10 dark:bg-slate-900/40">
        {allTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs font-bold transition ${activeTab === tab.id
              ? 'bg-[#1a5c38] text-[#f5deb3] dark:bg-[#00ffff] dark:text-black'
              : 'bg-white/60 text-[#800020] dark:bg-slate-800/60 dark:text-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className={`${CARD} text-sm`}>Loading student profile…</div>
        ) : error ? (
          <div className={`${CARD} text-sm text-red-600 dark:text-rose-300`}>{error}</div>
        ) : (
          <div className="mx-auto max-w-5xl">{renderTab()}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
