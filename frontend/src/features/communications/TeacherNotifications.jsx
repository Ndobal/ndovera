import React, { useCallback, useEffect, useState } from 'react';
import * as api from './communicationsApi';

// Teachers: how the notifications about their own classes went (assignments, daily
// summaries, deadline reminders, results) — counts only, no parent details. Read when the
// page opens; there is no timer.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl bg-white p-4 dark:bg-slate-900';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-400';
const TYPE_LABELS = { assignment: 'New assignment', assignment_digest: 'Daily assignment summary', deadline: 'Deadline reminder', results: 'Results published' };
const DONE = ['delivered', 'read', 'sent', 'accepted'];

function channelLine(channel, statuses) {
  const total = Object.values(statuses).reduce((sum, n) => sum + n, 0);
  const done = DONE.reduce((sum, status) => sum + (statuses[status] || 0), 0);
  const failed = statuses.failed || 0;
  const waiting = (statuses.awaiting_credits || 0) + (statuses.queued || 0) + (statuses.planned || 0);
  return `${api.CHANNEL_LABELS[channel] || channel}: ${done} of ${total} sent${failed ? ` · ${failed} failed` : ''}${waiting ? ` · ${waiting} waiting` : ''}`;
}

export default function TeacherNotifications() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    api.getClassNotifications().then(setData).catch(err => setError(err.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className={CARD}>
        <p className={LABEL}>My classes</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Parent notifications</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">How parents were told about your classes’ work and results in the last 30 days. The school decides which notifications are sent and how.</p>
        <button type="button" onClick={load} className="mt-3 rounded-2xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm font-semibold text-[#191970]">Refresh</button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
      {data && !data.classes.length && <p className="text-sm text-[#191970]">You are not set as the teacher of any class yet.</p>}
      {data && data.classes.length > 0 && !data.notifications.length && <p className="text-sm text-[#191970]">No notifications about {data.classes.join(', ')} in the last 30 days.</p>}
      <ul className="space-y-3">
        {(data?.notifications || []).map(item => (
          <li key={item.id} className={INNER}>
            <p className="font-bold text-[#800000] dark:text-white">{TYPE_LABELS[item.type] || item.type}{item.title ? `: ${item.title}` : ''}{item.term ? ` (${item.term})` : ''}</p>
            <p className="text-xs text-slate-500">{item.classes.join(', ')} · {new Date(item.createdAt).toLocaleString()} · {item.families} families</p>
            <ul className="mt-2 space-y-0.5 text-sm text-[#191970] dark:text-slate-200">
              {Object.entries(item.channels).map(([channel, statuses]) => <li key={channel}>{channelLine(channel, statuses)}</li>)}
              {!Object.keys(item.channels).length && <li>{item.batchStatus === 'awaiting_credits' ? 'Waiting for the school to add message units.' : 'Being prepared.'}</li>}
            </ul>
            {Object.keys(item.notReachable).length > 0 && <p className="mt-1 text-xs text-amber-800">Not reachable by WhatsApp/SMS: {Object.entries(item.notReachable).map(([reason, n]) => `${api.EXCLUDED_LABELS[reason] || reason}: ${n}`).join(' · ')}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
