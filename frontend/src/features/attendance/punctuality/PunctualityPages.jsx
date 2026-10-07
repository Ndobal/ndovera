import React, { useCallback, useEffect, useState } from 'react';
import { getPunctualityAward, getPunctualityReport, getPunctualityWinner, publishPunctualityAward } from './punctualityApi';

// Staff punctuality: the daily log and period reports for leadership, the
// monthly award they publish, and the winner banner every member of staff sees.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const BTN = 'rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const PERIODS = [['day', 'Today'], ['week', 'This week'], ['month', 'This month'], ['term', 'This term']];
const BADGES = [['🏆', 'Most Punctual Staff'], ['⏰', 'Early Bird'], ['⭐', 'Punctuality Star'], ['🥇', 'Gold for Punctuality']];
const STATUS_STYLE = { on_time: 'bg-emerald-100 text-emerald-900', late: 'bg-amber-100 text-amber-900', absent: 'bg-rose-100 text-rose-900' };
const STATUS_LABEL = { on_time: 'On time', late: 'Late', absent: 'No sign-in' };

const monthLabel = month => new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const previousMonth = () => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7); };

function WinnerPanel() {
  const [month, setMonth] = useState(previousMonth);
  const [data, setData] = useState(null);
  const [badge, setBadge] = useState(BADGES[0]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => getPunctualityWinner(month).then(setData).catch(err => setNotice(err.message)), [month]);
  useEffect(() => { load(); }, [load]);

  async function publish() {
    setBusy(true); setNotice('');
    try {
      await publishPunctualityAward({ month, badgeIcon: badge[0], badgeLabel: badge[1], message });
      setNotice('Published — staff will see it when they next open Ndovera.');
      load();
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }

  return (
    <section className={`${CARD} space-y-3`} aria-label="Monthly punctuality award">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-lg font-black text-[#800000] dark:text-white">Monthly punctuality award</h2>
        <input type="month" aria-label="Month" value={month} onChange={event => setMonth(event.target.value)} className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" />
      </div>
      {!data ? <p role="status">Working it out…</p> : (
        <>
          {!data.monthComplete && <p className="text-xs text-[#191970] dark:text-slate-300">{monthLabel(month)} is not over yet — this is the standing so far.</p>}
          {data.winners.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">No one qualifies yet (at least 80% of working days attended, with on-time arrivals).</p> : (
            <p className="text-sm text-[#191970] dark:text-white">
              Most punctual: <strong>{data.winners.map(winner => winner.name).join(' and ')}</strong> — {data.winners[0].onTimeDays} of {data.winners[0].workingDays} days on time ({data.winners[0].punctualityRate}%), average arrival {data.winners[0].averageArrival}.
            </p>
          )}
          {data.award && <p className="rounded-xl bg-white/70 px-3 py-2 text-sm text-[#191970]">Published {new Date(data.award.publishedAt).toLocaleDateString()} as {data.award.badgeIcon} {data.award.badgeLabel}{data.award.publishedBy ? ` by ${data.award.publishedBy}` : ''}.</p>}
          {data.winners.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {BADGES.map(option => (
                  <button key={option[1]} type="button" onClick={() => setBadge(option)} className={`${BTN} ${badge[1] === option[1] ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#191970]'}`}>{option[0]} {option[1]}</button>
                ))}
              </div>
              <textarea rows={2} aria-label="Message to staff" value={message} onChange={event => setMessage(event.target.value)} placeholder="A word of thanks shown with the award (optional)" className="w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" />
              <button type="button" disabled={busy} onClick={publish} className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`}>{busy ? 'Publishing…' : data.award ? 'Publish again' : 'Publish award'}</button>
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-xs font-bold uppercase text-[#800020]">Top 10 for {monthLabel(month)}</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#191970] dark:text-slate-200">
              {data.ranking.map(row => <li key={row.staffId}>{row.name} — {row.punctualityRate}% on time, {row.lateMinutes} late minutes, average {row.averageArrival || '—'}</li>)}
            </ol>
          </details>
        </>
      )}
      {notice && <p role="status" className="text-sm font-semibold text-[#1a5c38]">{notice}</p>}
    </section>
  );
}

/** Owner / HOS: daily, weekly, monthly and term punctuality, and the award. */
export function StaffPunctualityPage({ dashboardLabel = 'Dashboard' }) {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null);
    getPunctualityReport(period, date).then(setData).catch(err => setError(err.message));
  }, [period, date]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
      <section className={CARD}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{dashboardLabel}</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Staff Punctuality</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">From staff sign-ins, judged against your school's lateness time. Weekends, holidays and breaks are not counted.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PERIODS.map(([key, label]) => <button key={key} type="button" onClick={() => setPeriod(key)} className={`${BTN} ${period === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#800020]'}`}>{label}</button>)}
          {period !== 'term' && <input type="date" aria-label="Date" value={date} onChange={event => setDate(event.target.value)} className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" />}
        </div>
      </section>
      {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
      {!data ? <p role="status">Loading…</p> : (
        <section className={CARD} aria-label="Report">
          <h2 className="mb-2 text-base font-black text-[#800000] dark:text-white">{data.range.label} · {data.staff[0]?.workingDays ?? 0} working day{data.staff[0]?.workingDays === 1 ? '' : 's'} so far</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm text-[#191970] dark:text-slate-200">
              <thead><tr className="text-xs uppercase text-[#800020]">
                <th className="p-2">Staff</th>
                {period === 'day' ? <><th className="p-2">Status</th><th className="p-2">Arrived</th><th className="p-2">Minutes late</th></> : <><th className="p-2">On time</th><th className="p-2">Late</th><th className="p-2">No sign-in</th><th className="p-2">Late minutes</th><th className="p-2">Average arrival</th><th className="p-2">Punctuality</th></>}
              </tr></thead>
              <tbody>
                {data.staff.map(row => {
                  const today = row.daily[row.daily.length - 1];
                  return (
                    <tr key={row.staffId} className="border-t border-[#c9a96e]/30">
                      <td className="p-2 font-semibold">{row.name}</td>
                      {period === 'day' ? (
                        today ? <><td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[today.status]}`}>{STATUS_LABEL[today.status]}</span></td><td className="p-2">{today.arrival || '—'}</td><td className="p-2">{today.lateMinutes || 0}</td></> : <td className="p-2" colSpan={3}>Not a working day</td>
                      ) : (
                        <><td className="p-2">{row.onTimeDays}</td><td className="p-2">{row.lateDays}</td><td className="p-2">{row.absentDays}</td><td className="p-2">{row.lateMinutes}</td><td className="p-2">{row.averageArrival || '—'}</td><td className="p-2 font-bold">{row.punctualityRate}%</td></>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <WinnerPanel />
    </div>
  );
}

/**
 * The school's punctuality winner, for every member of staff. `variant="card"`
 * sits on overview pages; `variant="celebration"` is mounted once in the app
 * shell and opens the first time each person sees a new award.
 */
export function PunctualityWinnerBanner({ variant = 'card' }) {
  const [award, setAward] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getPunctualityAward().then(data => {
      if (cancelled || !data?.award) return;
      setAward(data.award);
      if (variant !== 'celebration') return;
      try {
        const key = `ndovera.punctuality.seen.${data.award.id}.${data.award.publishedAt}`;
        if (!window.localStorage.getItem(key)) { setCelebrate(true); window.localStorage.setItem(key, '1'); }
      } catch { /* storage unavailable: the card still shows */ }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [variant]);
  // Shown for the month after the award, then it steps aside.
  if (!award) return null;
  const [year, month] = award.month.split('-').map(Number);
  if (new Date() > new Date(year, month + 1, 1)) return null;
  const names = award.winners.map(winner => winner.name).join(' and ');

  if (variant === 'celebration' && !celebrate) return null;

  return (
    <>
      {variant === 'card' && <section aria-label="Punctuality award" className="rounded-3xl bg-gradient-to-br from-[#c9a96e] to-[#e9d3a0] p-5 text-[#191970] shadow">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{monthLabel(award.month)} · {award.badgeLabel}</p>
        <p className="mt-1 text-xl font-black"><span aria-hidden className="mr-2">{award.badgeIcon}</span>{names}</p>
        {award.message && <p className="mt-1 text-sm">{award.message}</p>}
      </section>}
      {celebrate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#191970]/70 p-4" role="dialog" aria-modal="true" aria-label="Punctuality winner">
          <div className="w-full max-w-md rounded-3xl bg-gradient-to-br from-[#c9a96e] to-[#fff6e0] p-6 text-center text-[#191970] shadow-2xl">
            <p className="text-6xl" aria-hidden>{award.badgeIcon}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{award.badgeLabel} · {monthLabel(award.month)}</p>
            <h2 className="mt-1 text-2xl font-black">{names}</h2>
            <p className="mt-2 text-sm">{award.winners[0]?.onTimeDays} of {award.winners[0]?.workingDays} days on time.{award.message ? ` ${award.message}` : ''}</p>
            <button type="button" onClick={() => setCelebrate(false)} className="mt-4 rounded-2xl bg-[#800020] px-5 py-2 text-sm font-bold text-[#b5e3f4]">Congratulations!</button>
          </div>
        </div>
      )}
    </>
  );
}
