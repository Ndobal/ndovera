import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLinkOverview, linkParentStudent, unlinkParentStudent } from '../services/schoolApi';

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/30';
const CHIP = 'rounded-full px-3 py-1 text-xs font-bold';

// The wizard walks whichever side still needs work, so an admin can clear a backlog without
// hunting: pick a subject, tick the other side, save, move to the next one.
const MODES = [
  { key: 'parent', label: 'Link by parent', subjectLabel: 'parent', targetLabel: 'children' },
  { key: 'child', label: 'Link by child', subjectLabel: 'child', targetLabel: 'parents' },
];

function matches(person, term) {
  if (!term) return true;
  const haystack = `${person.name || ''} ${person.email || ''} ${person.displayId || ''} ${person.className || ''}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

export default function LinkStudentsPanel() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('parent');
  const [subjectId, setSubjectId] = useState('');
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [onlyOutstanding, setOnlyOutstanding] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLinkOverview();
      setOverview(data);
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'Could not load linking data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const students = useMemo(() => overview?.students || [], [overview]);
  const parents = useMemo(() => overview?.parents || [], [overview]);
  const maxParents = overview?.maxParentsPerStudent || 2;

  // In parent mode the subjects are parents and the targets are students; in child mode the
  // two swap. Everything below is written against these two lists so the flow is identical.
  const byParent = mode === 'parent';
  const subjects = byParent ? parents : students;
  const targets = byParent ? students : parents;

  const outstanding = useMemo(() => subjects.filter(subject => (
    byParent ? (subject.children || []).length === 0 : (subject.parents || []).length === 0
  )), [subjects, byParent]);

  const queue = useMemo(() => {
    const base = onlyOutstanding ? outstanding : subjects;
    return base.filter(subject => matches(subject, search));
  }, [onlyOutstanding, outstanding, subjects, search]);

  const subject = useMemo(
    () => subjects.find(item => item.id === subjectId) || null,
    [subjects, subjectId],
  );

  // Keep a subject selected as the queue changes, so saving one row lands on the next.
  useEffect(() => {
    if (subject || !queue.length) return;
    setSubjectId(queue[0].id);
  }, [queue, subject]);

  useEffect(() => { setSelected([]); setTargetSearch(''); }, [subjectId, mode]);

  const currentLinks = useMemo(() => {
    if (!subject) return [];
    return byParent ? (subject.children || []) : (subject.parents || []);
  }, [subject, byParent]);

  const linkedIds = useMemo(() => new Set(currentLinks.map(link => link.id)), [currentLinks]);

  const availableTargets = useMemo(() => targets
    .filter(target => !linkedIds.has(target.id))
    .filter(target => matches(target, targetSearch))
    .slice(0, 60), [targets, linkedIds, targetSearch]);

  function toggle(targetId) {
    setSelected(current => (current.includes(targetId)
      ? current.filter(id => id !== targetId)
      : [...current, targetId]));
  }

  function goToNext() {
    const index = queue.findIndex(item => item.id === subjectId);
    const next = queue[index + 1] || queue.find(item => item.id !== subjectId);
    setSubjectId(next ? next.id : '');
    setSelected([]);
    setTargetSearch('');
  }

  async function saveLinks({ advance }) {
    if (!subject || selected.length === 0) {
      if (advance) goToNext();
      return;
    }

    setSaving(true);
    setNotice('');
    setError('');
    const failures = [];

    for (const targetId of selected) {
      const payload = byParent
        ? { parentId: subject.id, studentId: targetId }
        : { parentId: targetId, studentId: subject.id };
      try {
        await linkParentStudent(payload);
      } catch (linkError) {
        const target = targets.find(item => item.id === targetId);
        failures.push(`${target?.name || targetId}: ${linkError?.message || 'could not link'}`);
      }
    }

    const linkedCount = selected.length - failures.length;
    setSelected([]);
    await load();
    setSaving(false);

    if (failures.length) {
      setError(`Linked ${linkedCount}. ${failures.length} failed — ${failures.join('; ')}`);
      return;
    }

    setNotice(`Linked ${linkedCount} ${byParent ? 'child' : 'parent'}${linkedCount === 1 ? '' : 'ren'} to ${subject.name}.`);
    if (advance) goToNext();
  }

  async function removeLink(link) {
    if (!subject) return;
    const payload = byParent
      ? { parentId: subject.id, studentId: link.id }
      : { parentId: link.id, studentId: subject.id };
    if (!window.confirm(`Remove the link between ${subject.name} and ${link.name}?`)) return;

    try {
      await unlinkParentStudent(payload);
      setNotice(`Unlinked ${link.name}.`);
      await load();
    } catch (unlinkError) {
      setError(unlinkError?.message || 'Could not remove that link.');
    }
  }

  if (loading && !overview) return <div className={CARD}><p className="text-[#800020] dark:text-slate-400">Loading linking data...</p></div>;

  const counts = overview?.counts || {};
  const queuePosition = queue.findIndex(item => item.id === subjectId) + 1;
  const studentIsFull = !byParent && currentLinks.length >= maxParents;

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#800000] dark:text-slate-100">Link students and parents</h2>
            <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
              Work through one {byParent ? 'parent' : 'child'} at a time. Tick everyone that belongs together, save, then move to the next.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`${CHIP} bg-[#191970] text-[#b5e3f4]`}>{counts.unlinkedStudents ?? 0} students unlinked</span>
            <span className={`${CHIP} bg-[#800020] text-[#b5e3f4]`}>{counts.parentsWithoutChildren ?? 0} parents with no child</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {MODES.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setMode(item.key); setSubjectId(''); }}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
                mode === item.key
                  ? 'border-[#800020] bg-[#800020] text-[#b5e3f4]'
                  : 'border-[#c9a96e]/40 bg-[#b5e3f4] text-[#800020] dark:border-white/10 dark:bg-slate-900/30 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-[#191970] dark:text-slate-300">
            <input type="checkbox" checked={onlyOutstanding} onChange={event => { setOnlyOutstanding(event.target.checked); setSubjectId(''); }} />
            Only those still needing a link
          </label>
        </div>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">{notice}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className={CARD}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#800020] dark:text-slate-400">
            {byParent ? 'Parents' : 'Children'} ({queue.length})
          </p>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={`Search ${byParent ? 'parents' : 'children'}`}
            className="mt-3 w-full rounded-2xl border border-[#c9a96e]/40 bg-white px-4 py-2.5 text-sm text-[#191970] outline-none dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100"
          />
          <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {queue.length === 0 ? (
              <p className="text-sm text-[#800020] dark:text-slate-400">
                {onlyOutstanding ? 'Nothing left to link. Untick the filter to review existing links.' : 'No matches.'}
              </p>
            ) : null}
            {queue.map(item => {
              const links = byParent ? (item.children || []) : (item.parents || []);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSubjectId(item.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                    item.id === subjectId
                      ? 'border-[#800020] bg-[#efd4a0]/70 dark:border-fuchsia-300/50 dark:bg-slate-800/70'
                      : 'border-[#c9a96e]/30 bg-white/70 hover:bg-[#efd4a0]/40 dark:border-white/10 dark:bg-slate-900/40'
                  }`}
                >
                  <p className="font-semibold text-[#191970] dark:text-slate-100">{item.name}</p>
                  <p className="text-xs text-[#4a5578] dark:text-slate-400">
                    {item.displayId ? `${item.displayId} • ` : ''}{item.className || item.email}
                  </p>
                  <p className={`mt-1 text-xs font-bold ${links.length ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-[#800020] dark:text-amber-300'}`}>
                    {links.length ? `${links.length} linked` : 'Not linked'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className={CARD}>
          {!subject ? (
            <p className="text-sm text-[#800020] dark:text-slate-400">Choose a {byParent ? 'parent' : 'child'} on the left to begin.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#800020] dark:text-slate-400">
                    {queuePosition > 0 ? `${queuePosition} of ${queue.length}` : 'Reviewing'}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[#191970] dark:text-slate-100">{subject.name}</h3>
                  <p className="text-xs text-[#4a5578] dark:text-slate-400">{subject.displayId || subject.email || ''}</p>
                </div>
                <button
                  type="button"
                  onClick={goToNext}
                  className="rounded-2xl border border-[#c9a96e]/50 px-4 py-2 text-sm font-semibold text-[#191970] dark:border-white/20 dark:text-slate-100"
                >
                  Skip
                </button>
              </div>

              {currentLinks.length ? (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5c38] dark:text-emerald-300">Already linked</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentLinks.map(link => (
                      <span key={link.id} className="flex items-center gap-2 rounded-full border border-[#1a5c38]/40 bg-white/70 px-3 py-1 text-xs font-semibold text-[#1a5c38] dark:bg-slate-900/50 dark:text-emerald-200">
                        {link.name}
                        <button type="button" onClick={() => removeLink(link)} className="font-black text-[#800020] dark:text-rose-300" aria-label={`Unlink ${link.name}`}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {studentIsFull ? (
                <p className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  This child already has the maximum of {maxParents} linked parents. Remove one above to add another.
                </p>
              ) : (
                <>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-slate-400">
                    Select {byParent ? 'children' : 'parents'} to link
                  </p>
                  <input
                    value={targetSearch}
                    onChange={event => setTargetSearch(event.target.value)}
                    placeholder={`Search ${byParent ? 'children' : 'parents'}`}
                    className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-white px-4 py-2.5 text-sm text-[#191970] outline-none dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100"
                  />
                  <div className="mt-3 max-h-[18rem] space-y-2 overflow-y-auto pr-1">
                    {availableTargets.length === 0 ? (
                      <p className="text-sm text-[#800020] dark:text-slate-400">No matches.</p>
                    ) : null}
                    {availableTargets.map(target => (
                      <label
                        key={target.id}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#c9a96e]/30 bg-white/70 px-4 py-2.5 dark:border-white/10 dark:bg-slate-900/40"
                      >
                        <input type="checkbox" checked={selected.includes(target.id)} onChange={() => toggle(target.id)} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-[#191970] dark:text-slate-100">{target.name}</span>
                          <span className="block truncate text-xs text-[#4a5578] dark:text-slate-400">
                            {target.displayId ? `${target.displayId} • ` : ''}{target.className || target.email}
                            {byParent && (target.parents || []).length ? ` • ${target.parents.length} parent(s) already` : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveLinks({ advance: false })}
                      disabled={saving || selected.length === 0}
                      className="rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] disabled:opacity-50"
                    >
                      {saving ? 'Linking...' : `Link ${selected.length || ''}`.trim()}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveLinks({ advance: true })}
                      disabled={saving}
                      className="rounded-2xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] disabled:opacity-50"
                    >
                      {selected.length ? 'Link and next' : 'Next'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
