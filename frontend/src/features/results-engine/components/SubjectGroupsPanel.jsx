import React, { useEffect, useState } from 'react';
import { getSubjectGroups, saveSubjectGroupChoice } from '../../school/services/schoolApi';
import { RESULT_BODY, RESULT_BUTTON, RESULT_HEADING, RESULT_INNER_SURFACE, RESULT_LABEL, RESULT_SECONDARY_BUTTON, RESULT_SURFACE } from './resultSheetTheme';

// Combined subjects: a subject taught in two or more classes of a section can be put on
// one score sheet for its teacher. Trade subjects (Fashion and Design, Catering…) are
// combined automatically; the school can switch any group off, or on, and pick the classes.

export default function SubjectGroupsPanel() {
  const [groups, setGroups] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({});

  async function load() {
    const data = await getSubjectGroups();
    setGroups(data?.groups || []);
    setCanManage(Boolean(data?.canManage));
    setDrafts({});
  }

  useEffect(() => { load().catch(err => { setGroups([]); setError(err.message || 'Could not load combined subjects.'); }); }, []);

  async function save(group, enabled, classIds) {
    setBusy(group.id); setError(''); setMessage('');
    try {
      await saveSubjectGroupChoice({ section: group.section, subjectKey: group.subjectKey, enabled, classIds });
      setMessage(`${group.name}: ${enabled ? 'combined' : 'kept separate in each class'}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setBusy('');
    }
  }

  const chosen = group => drafts[group.id] || group.classIds;
  const toggleClass = (group, classId) => {
    const current = chosen(group);
    setDrafts(all => ({ ...all, [group.id]: current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId] }));
  };

  return (
    <section className={`${RESULT_SURFACE} space-y-4 p-6`} aria-label="Combined subjects">
      <div>
        <p className={`micro-label ${RESULT_LABEL}`}>Combined subjects</p>
        <p className={`mt-1 text-sm ${RESULT_BODY}`}>
          A subject taught to students from different classes — such as Fashion and Design — can be scored on one sheet by its teacher. Scores still go to each student's own class result.
          Trade subjects are combined automatically; switch a group off if your school teaches it class by class.
        </p>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="text-sm font-semibold text-emerald-700">{message}</p>}
      {!groups ? <p role="status" className={`text-sm ${RESULT_BODY}`}>Loading…</p> : !groups.length ? (
        <p className={`text-sm ${RESULT_BODY}`}>No subject is taught in two or more classes of the same section yet.</p>
      ) : groups.map(group => {
        const selected = chosen(group);
        const changed = Boolean(drafts[group.id]);
        return (
          <article key={group.id} className={`${RESULT_INNER_SURFACE} space-y-2 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className={`text-sm font-black ${RESULT_HEADING}`}>{group.name}</p>
                <p className={`text-xs capitalize ${RESULT_BODY}`}>{group.section}{group.special ? ' · trade subject' : ''}{group.automatic ? ' · automatic' : ''}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${group.enabled ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>{group.enabled ? 'Combined' : 'Separate'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.classes.map(item => (
                <label key={item.id} className={`flex items-center gap-1 rounded-xl border px-2 py-1 text-xs ${RESULT_BODY}`}>
                  <input type="checkbox" disabled={!canManage} checked={selected.includes(item.id)} onChange={() => toggleClass(group, item.id)} />
                  {item.name}
                </label>
              ))}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {group.enabled ? (
                  <>
                    {changed && <button type="button" className={RESULT_BUTTON} disabled={Boolean(busy) || selected.length < 2} onClick={() => save(group, true, selected)}>Save classes</button>}
                    <button type="button" className={RESULT_SECONDARY_BUTTON} disabled={Boolean(busy)} onClick={() => save(group, false, group.classIds)}>Do not combine</button>
                  </>
                ) : (
                  <button type="button" className={RESULT_BUTTON} disabled={Boolean(busy) || selected.length < 2} onClick={() => save(group, true, selected)}>Combine these classes</button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
