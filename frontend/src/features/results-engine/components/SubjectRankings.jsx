import React, { useEffect, useState } from 'react';
import { getResultRankings } from '../../school/services/schoolApi';
import { RESULT_BODY, RESULT_HEADING, RESULT_INNER_SURFACE, RESULT_LABEL, RESULT_SURFACE } from './resultSheetTheme';

// Rankings from the C.A. score sheet as it stands, from the first score entered: a tab per
// subject (the teacher's own subjects; all for the class teacher and leaders) and, for the class
// teacher and HoS/Owner, the class positions. In the 3rd term everything is on the cumulative
// (whole-session) score. The top three in each subject carry a badge.

export const BADGE = { gold: ['🥇', 'Best in subject', 'bg-amber-100 text-amber-900 border-amber-300'], silver: ['🥈', '2nd in subject', 'bg-slate-100 text-slate-800 border-slate-300'], bronze: ['🥉', '3rd in subject', 'bg-orange-100 text-orange-900 border-orange-300'] };
const ordinal = n => (n ? `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}` : '—');

export default function SubjectRankings({ classId, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    getResultRankings({ classId }).then(result => {
      if (cancelled) return;
      setData(result);
      setTab(current => current || (result.overall ? 'overall' : result.subjects?.[0]?.subjectId || ''));
    }).catch(err => { if (!cancelled) setError(err.message || 'Could not load the rankings.'); });
    return () => { cancelled = true; };
  }, [classId, refreshKey]);

  if (error) return <section role="alert" className={`${RESULT_SURFACE} p-5 text-sm text-rose-800`}>{error}</section>;
  if (!data) return <section className={`${RESULT_SURFACE} p-5 text-sm ${RESULT_BODY}`}>Loading rankings…</section>;
  const subject = data.subjects.find(item => item.subjectId === tab);
  const tabs = [...(data.overall ? [{ key: 'overall', label: 'Class positions' }] : []), ...data.subjects.map(item => ({ key: item.subjectId, label: item.subjectName }))];

  return (
    <section className={`${RESULT_SURFACE} space-y-4 p-4 sm:p-5`} aria-label="Rankings">
      <div>
        <p className={`micro-label ${RESULT_LABEL}`}>Rankings · {data.period?.termName} {data.period?.sessionName}</p>
        <p className={`mt-1 text-sm ${RESULT_BODY}`}>
          Live from the score sheet{data.cumulative ? ', on the whole-session (cumulative) score: 1st, 2nd and 3rd term' : ''}. The top three in each subject earn a badge on their result.
          {data.positionsOnResult ? '' : ' Your school keeps positions for analysis only: they are not printed on results.'}
        </p>
      </div>
      {!tabs.length ? <p className={`text-sm ${RESULT_BODY}`}>No scores yet. Rankings appear as soon as scores are entered.</p> : (
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Subjects">
          {tabs.map(item => (
            <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-sm font-bold ${tab === item.key ? 'border-[#2447d8] bg-[#2447d8] text-white' : 'border-[#7cc4e8]/60 bg-white text-[#191970] dark:bg-slate-900 dark:text-slate-200'}`}>{item.label}</button>
          ))}
        </div>
      )}

      {tab === 'overall' && data.overall ? (
        <div className={`${RESULT_INNER_SURFACE} overflow-x-auto p-0`}>
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left">{['Position', 'Student', data.cumulative ? 'Session average' : 'Average', 'Subjects', 'Badges'].map(head => <th key={head} className={`px-3 py-2 text-xs uppercase ${RESULT_LABEL}`}>{head}</th>)}</tr></thead>
            <tbody>
              {data.overall.map(row => (
                <tr key={row.studentId} className="border-t border-[#c9a96e]/25 dark:border-white/10">
                  <td className={`px-3 py-2 font-black ${RESULT_HEADING}`}>{ordinal(row.position)}</td>
                  <td className={`px-3 py-2 font-semibold ${RESULT_HEADING}`}>{row.name}</td>
                  <td className="px-3 py-2 font-mono">{row.average}</td>
                  <td className="px-3 py-2">{row.subjects}</td>
                  <td className="px-3 py-2">{row.badges.map(badge => <span key={badge.subjectName} title={`${badge.subjectName}: ${ordinal(badge.place)}`} className="mr-1">{BADGE[['gold', 'silver', 'bronze'][badge.place - 1]]?.[0]}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {subject ? (
        <div className={`${RESULT_INNER_SURFACE} overflow-x-auto p-0`}>
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left">{['Position', 'Student', ...(data.cumulative ? ['1st term', '2nd term', '3rd term'] : []), data.cumulative ? 'Cumulative' : 'Score', 'Grade', ''].map(head => <th key={head || 'badge'} className={`px-3 py-2 text-xs uppercase ${RESULT_LABEL}`}>{head}</th>)}</tr></thead>
            <tbody>
              {subject.rows.map(row => (
                <tr key={row.studentId} className={`border-t border-[#c9a96e]/25 dark:border-white/10 ${row.badge === 'gold' ? 'bg-amber-50/70 dark:bg-amber-400/10' : ''}`}>
                  <td className={`px-3 py-2 font-black ${RESULT_HEADING}`}>{ordinal(row.position)}</td>
                  <td className={`px-3 py-2 font-semibold ${RESULT_HEADING}`}>{row.name}</td>
                  {data.cumulative ? <><td className="px-3 py-2 font-mono">{row.firstTerm ?? '—'}</td><td className="px-3 py-2 font-mono">{row.secondTerm ?? '—'}</td><td className="px-3 py-2 font-mono">{row.thisTerm}</td></> : null}
                  <td className="px-3 py-2 font-mono font-black">{row.score}</td>
                  <td className="px-3 py-2 font-bold">{row.grade}</td>
                  <td className="px-3 py-2">{row.badge ? <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${BADGE[row.badge][2]}`}>{BADGE[row.badge][0]} {BADGE[row.badge][1]}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
