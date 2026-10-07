import React from 'react';

// Shared look for the compliance screens: one colour and word per status, used everywhere.

export const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
export const INNER = 'rounded-2xl bg-white p-4 dark:bg-slate-900';
export const INPUT = 'rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970] dark:border-white/15 dark:bg-slate-950 dark:text-slate-100';
export const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50 dark:bg-[#00ffff] dark:text-black';
export const SECONDARY = 'rounded-2xl border border-[#c9a96e]/50 bg-white px-4 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100';
export const HEADING = 'text-[#800000] dark:text-white';
export const BODY = 'text-[#191970] dark:text-slate-200';
export const LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-400';

export const KIND_LABELS = { register: 'Register', diary: 'Diary', lesson_notes: 'Lesson Notes', exam_questions: 'Exam Questions', ca_scores: 'C.A. Scores', class_report: 'Class Report', custom: 'Other' };
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const STATUS = {
  complete: { label: 'Done', dot: '🟢', tone: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200' },
  late: { label: 'Late', dot: '🟠', tone: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200' },
  partial: { label: 'Partial', dot: '🟡', tone: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200' },
  pending: { label: 'Due', dot: '⚪', tone: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200' },
  missing: { label: 'Missing', dot: '🔴', tone: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200' },
};

export function StatusChip({ item, compact = false }) {
  const status = STATUS[item.status] || STATUS.pending;
  const fraction = item.total > 1 && item.status !== 'complete' ? `${item.done}/${item.total}` : '';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${status.tone}`}>
      <span aria-hidden="true">{status.dot}</span>
      {compact ? (fraction || status.label) : `${status.label}${fraction ? ` · ${fraction}` : ''}`}
    </span>
  );
}

/** "Done automatically", "Verified", "7/9 submitted" — the line a teacher reads. */
export function describeItem(item) {
  if (item.status === 'complete' || item.status === 'late') {
    const how = item.verification === 'auto' ? 'done automatically' : item.verification === 'manual' ? 'verified' : 'done';
    return `${item.status === 'late' ? 'Late — ' : ''}${how}`;
  }
  if (item.total > 1) return `${item.done}/${item.total} submitted`;
  if (item.units?.[0]?.awaitingApproval) return 'Awaiting verification';
  return item.status === 'missing' ? 'Not submitted' : 'Pending';
}

export function formatDue(dueAt) {
  if (!dueAt) return '';
  return new Date(dueAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
}

export const naira = value => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/** Where a teacher goes to complete a requirement of this kind. */
export function actionFor(kind) {
  if (kind === 'lesson_notes') return { to: '/roles/teacher/submissions', label: 'Submit lesson notes' };
  if (kind === 'exam_questions') return { to: '/roles/teacher/exams', label: 'Open Exams' };
  if (kind === 'register') return { to: '/roles/teacher/attendance', label: 'Mark the register' };
  if (kind === 'class_report') return { to: '/roles/teacher/class-report', label: 'Write the class report' };
  if (kind === 'ca_scores') return { to: '/roles/teacher/scores', label: 'Open the C.A. score sheet' };
  return null;
}
