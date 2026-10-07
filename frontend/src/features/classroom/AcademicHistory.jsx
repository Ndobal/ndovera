import React, { useEffect, useMemo, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import MaterialViewer from './materials/MaterialViewer';
import { ReuseDialog } from './materials/TeacherMaterialList';
import { getArchivedMaterials, getAssignedClasses, getTeachingHistory } from './classroomService';

// Academic History: earlier terms and sessions, kept apart from the current
// academic context that students and teachers land in by default. Nothing here
// is deleted when a term or session closes; it simply stops being current.

const ROLE_LABELS = { subject: 'Subject teacher', class_teacher: 'Class teacher', co_teacher: 'Co-teacher' };

/** Session → term → materials, in the order the server returns (newest first). */
function groupBySessionAndTerm(materials) {
  const sessions = new Map();
  for (const material of materials) {
    const sessionId = material.academicSessionId || material.metadata?.academicSessionId || 'legacy';
    if (!sessions.has(sessionId)) sessions.set(sessionId, { id: sessionId, name: material.academicSessionName || 'Earlier materials', terms: new Map() });
    const terms = sessions.get(sessionId).terms;
    const termName = material.academicTermName || 'Whole session';
    if (!terms.has(termName)) terms.set(termName, []);
    terms.get(termName).push(material);
  }
  return Array.from(sessions.values()).map(session => ({ ...session, terms: Array.from(session.terms.entries()) }));
}

// Everything a search should look through, lower-cased once.
function searchableText(material) {
  return [
    material.title,
    material.topic,
    material.metadata?.topic,
    material.weekLabel,
    material.subjectName,
    material.archiveClassName,
    String(material.description || '').replace(/<[^>]+>/g, ' '),
  ].filter(Boolean).join(' ').toLowerCase();
}

function subjectOf(material) {
  return String(material.subjectName || '').trim() || 'No subject';
}

function Chevron({ open }) {
  return <span aria-hidden="true" className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>;
}

export default function AcademicHistory({ role = 'student' }) {
  const [materials, setMaterials] = useState([]);
  const [current, setCurrent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [teaching, setTeaching] = useState([]);
  const [session, setSession] = useState('all');
  const [subject, setSubject] = useState('all');
  const [query, setQuery] = useState('');
  // Sections the viewer opened or closed by hand; anything else follows the defaults.
  const [toggled, setToggled] = useState({});
  const [active, setActive] = useState(null);
  const [copy, setCopy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isTeacher = role === 'teacher';

  useEffect(() => {
    let cancelled = false;
    const none = Promise.resolve({ success: true, classes: [], assignments: [] });
    Promise.all([getArchivedMaterials(), isTeacher ? getAssignedClasses() : none, isTeacher ? getTeachingHistory() : none])
      .then(([archive, assigned, history]) => {
        if (cancelled) return;
        if (!archive.success || !assigned.success) throw new Error(archive.message || assigned.message || 'Could not load the archive.');
        setMaterials(archive.materials || []);
        setCurrent(archive.current || null);
        setClasses(assigned.classes || []);
        setTeaching(history?.success ? history.assignments || [] : []);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isTeacher]);

  const subjects = useMemo(() => {
    const counts = new Map();
    materials.forEach(material => counts.set(subjectOf(material), (counts.get(subjectOf(material)) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [materials]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtering = words.length > 0 || subject !== 'all';
  const filteredMaterials = useMemo(() => materials.filter(material => {
    if (subject !== 'all' && subjectOf(material) !== subject) return false;
    if (!words.length) return true;
    const haystack = searchableText(material);
    return words.every(word => haystack.includes(word));
    // `words` is derived from `query`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [materials, subject, query]);

  const groups = useMemo(() => groupBySessionAndTerm(materials), [materials]);
  const visibleGroups = groupBySessionAndTerm(filteredMaterials).filter(group => session === 'all' || group.id === session);

  // A new search or filter opens everything it finds.
  useEffect(() => { setToggled({}); }, [query, subject, session]);

  // Unfiltered, the newest session and its first term start open; filtered, all matches do.
  function isOpen(key, openByDefault) {
    return Object.prototype.hasOwnProperty.call(toggled, key) ? toggled[key] : (filtering || openByDefault);
  }
  function toggle(key, openByDefault) {
    setToggled(current => ({ ...current, [key]: !isOpen(key, openByDefault) }));
  }
  const previousTeaching = teaching.filter(item => !item.current);
  const currentLabel = [current?.sessionName, current?.termName].filter(Boolean).join(' • ');

  return (
    <StudentSectionShell
      title="Academic History"
      dashboardLabel={isTeacher ? 'Teacher Dashboard' : 'Student Dashboard'}
      subtitle={isTeacher
        ? 'Your earlier classes, terms and sessions. Reuse any material in your current classes without losing the original.'
        : 'Materials from your earlier terms and sessions, organised by session and term.'}
    >
      {currentLabel && <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Current: {currentLabel}. Your dashboard and Materials page always open here.</p>}
      {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}
      {message && <p role="status" className="mb-4 text-emerald-700 dark:text-emerald-300">{message}</p>}
      {loading ? <p role="status">Loading academic history…</p> : (
        <>
          {isTeacher && previousTeaching.length > 0 && (
            <section className="glass-surface mb-6 rounded-2xl p-5">
              <h2 className="mb-3 text-lg font-bold">Teaching history</h2>
              <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {previousTeaching.map(item => (
                  <li key={item.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-semibold">{item.className}{item.subjectName ? ` — ${item.subjectName}` : ''}</p>
                    <p className="text-slate-600 dark:text-slate-300">{item.sessionName || 'Earlier session'} • {ROLE_LABELS[item.role] || item.role}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {materials.length > 0 && (
            <section className="glass-surface mb-6 space-y-3 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="relative min-w-[220px] flex-1">
                  <span className="sr-only">Search by topic or text</span>
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                  <input
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search by topic or text…"
                    className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm text-slate-900"
                  />
                </label>
                {groups.length > 1 && (
                  <label className="text-sm">Session
                    <select className="ml-2 rounded-lg border p-2 text-slate-900" value={session} onChange={event => setSession(event.target.value)}>
                      <option value="all">All sessions</option>
                      {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {subjects.length > 1 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by subject">
                  {[['all', materials.length], ...subjects].map(([name, count]) => (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={subject === name}
                      onClick={() => setSubject(name)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${subject === name ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10'}`}
                    >
                      {name === 'all' ? 'All subjects' : name} <span className="opacity-70">({count})</span>
                    </button>
                  ))}
                </div>
              )}
              {filtering && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {filteredMaterials.length} of {materials.length} item{materials.length === 1 ? '' : 's'} match.{' '}
                  <button type="button" className="font-semibold underline" onClick={() => { setQuery(''); setSubject('all'); }}>Clear</button>
                </p>
              )}
            </section>
          )}

          {!visibleGroups.length && (
            <p className="glass-surface rounded-2xl p-6">{filtering ? 'Nothing matches your search or subject filter.' : 'No earlier materials are available yet.'}</p>
          )}

          {visibleGroups.map((group, groupIndex) => {
            const sessionKey = `session:${group.id}`;
            const sessionOpen = isOpen(sessionKey, groupIndex === 0);
            const sessionCount = group.terms.reduce((sum, [, items]) => sum + items.length, 0);
            return (
              <section key={group.id} className="mb-4" aria-label={group.name}>
                <button
                  type="button"
                  aria-expanded={sessionOpen}
                  onClick={() => toggle(sessionKey, groupIndex === 0)}
                  className="glass-surface flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-xl font-black"><Chevron open={sessionOpen} />{group.name}</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{sessionCount} item{sessionCount === 1 ? '' : 's'} • {group.terms.length} term{group.terms.length === 1 ? '' : 's'}</span>
                </button>

                {sessionOpen && (
                  <div className="mt-3 space-y-3 pl-2 sm:pl-4">
                    {group.terms.map(([termName, termMaterials], termIndex) => {
                      const termKey = `term:${group.id}:${termName}`;
                      const termDefault = groupIndex === 0 && termIndex === 0;
                      const termOpen = isOpen(termKey, termDefault);
                      return (
                        <div key={termName}>
                          <button
                            type="button"
                            aria-expanded={termOpen}
                            onClick={() => toggle(termKey, termDefault)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left dark:border-white/10"
                          >
                            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200"><Chevron open={termOpen} />{termName}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">{termMaterials.length}</span>
                          </button>
                          {termOpen && (
                            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              {termMaterials.map(material => (
                                <article key={material.id} className="glass-surface space-y-3 rounded-2xl p-5">
                                  <p className="text-sm text-slate-600 dark:text-slate-300">{material.archiveClassName}{material.subjectName ? ` • ${material.subjectName}` : ''}</p>
                                  <h4 className="text-lg font-bold">{material.title}</h4>
                                  {(material.topic || material.metadata?.topic) && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Topic: {material.topic || material.metadata?.topic}{material.weekLabel ? ` • ${material.weekLabel}` : ''}</p>}
                                  {isTeacher && material.status !== 'published' && <p className="text-xs font-semibold">{material.status === 'draft' ? 'Draft' : 'Hidden'}</p>}
                                  {material.sharedFromAssignment && <p className="text-xs font-semibold">Shared with you as this subject's current teacher • {material.uploadedByName}</p>}
                                  {material.description && <RichContent className="line-clamp-4 text-sm" text={material.description} />}
                                  <div className="flex flex-wrap gap-3">
                                    <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setActive(material)}>Open material</button>
                                    {isTeacher && <button type="button" className="rounded-lg bg-indigo-700 px-3 py-2 text-white" onClick={() => { setCopy(material); setMessage(''); }}>Reuse in current session</button>}
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
      {copy && <ReuseDialog material={copy} classes={classes} onClose={() => setCopy(null)} onReused={text => { setCopy(null); setMessage(text); }} />}
      {active && <MaterialViewer material={active} onClose={() => setActive(null)} />}
    </StudentSectionShell>
  );
}
