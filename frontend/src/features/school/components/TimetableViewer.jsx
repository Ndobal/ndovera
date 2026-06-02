import React, { useEffect, useMemo, useState } from 'react';
import { getTimetable, getClasses } from '../services/schoolApi';

const PAGE = 'p-6 md:p-8 max-w-6xl mx-auto space-y-6';
const HEADER = 'rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10';
const CARD = 'rounded-3xl p-5 bg-[#f5deb3] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/30';
const INNER = 'rounded-2xl p-3 bg-[#f0d090] border border-[#c9a96e]/30';

const DAYS = [
  { n: 1, label: 'Monday' },
  { n: 2, label: 'Tuesday' },
  { n: 3, label: 'Wednesday' },
  { n: 4, label: 'Thursday' },
  { n: 5, label: 'Friday' },
];

export default function TimetableViewer({ viewerRole = 'student', title = 'My Timetable', subtitle = 'Your weekly class schedule.' }) {
  const [entries, setEntries] = useState([]);
  const [classMap, setClassMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const isTeacher = viewerRole === 'teacher';
    Promise.all([
      getTimetable(isTeacher ? { mine: true } : {}).then(d => d?.entries || []).catch(() => []),
      isTeacher ? getClasses().then(d => d?.classes || []).catch(() => []) : Promise.resolve([]),
    ])
      .then(([ents, classes]) => {
        if (ignore) return;
        setEntries(ents);
        const map = {};
        classes.forEach(c => { map[c.id] = `${c.name}${c.arm ? ` ${c.arm}` : ''}`; });
        setClassMap(map);
      })
      .catch(e => { if (!ignore) setError(e.message || 'Could not load timetable.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [viewerRole]);

  const byDay = useMemo(() => {
    const groups = {};
    DAYS.forEach(d => { groups[d.n] = []; });
    entries.forEach(e => {
      if (!groups[e.dayOfWeek]) groups[e.dayOfWeek] = [];
      groups[e.dayOfWeek].push(e);
    });
    Object.values(groups).forEach(list => list.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)) || a.periodIndex - b.periodIndex));
    return groups;
  }, [entries]);

  const isTeacher = viewerRole === 'teacher';

  return (
    <div className={PAGE}>
      <div className={HEADER}>
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">{title}</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">{subtitle}</p>
      </div>

      {loading ? <div className={CARD}><p className="text-[#800020] text-sm">Loading timetable…</p></div>
        : error ? <div className={CARD}><p className="text-[#800000] text-sm">{error}</p></div>
        : entries.length === 0 ? <div className={CARD}><p className="text-[#800020] text-sm">No timetable has been published yet. Please check back once your school sets it up.</p></div>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DAYS.map(d => (
              <div key={d.n} className={CARD}>
                <h2 className="text-base font-bold text-[#800000] mb-3">{d.label}</h2>
                {byDay[d.n].length === 0 ? <p className="text-[#800020] text-sm">No periods scheduled.</p> : (
                  <div className="space-y-2">
                    {byDay[d.n].map((e, i) => (
                      <div key={e.id || i} className={`${INNER} ${e.isBreak ? 'opacity-80' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-mono text-[#800020]">{e.startTime}{e.endTime ? `–${e.endTime}` : ''}</p>
                          {e.isBreak ? <span className="text-[10px] uppercase font-bold text-[#800020]">{e.label || 'Break'}</span> : null}
                        </div>
                        {!e.isBreak ? (
                          <>
                            <p className="text-[#191970] font-semibold mt-1">{e.subjectName || '—'}</p>
                            <p className="text-xs text-[#800020]">{isTeacher ? (classMap[e.classId] || e.classId || '') : (e.teacherName || '')}</p>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
