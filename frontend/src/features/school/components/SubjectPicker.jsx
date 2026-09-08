import React, { useEffect, useMemo, useState } from 'react';
import SUBJECT_CATALOGUE from '../data/subjectCatalogue';

const CHIP = 'rounded-full border px-3 py-1.5 text-xs font-semibold transition';
const CHIP_OFF = 'border-[#c9a96e]/50 bg-white text-[#191970] hover:bg-[#ade1f4] dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';
const CHIP_ON = 'border-[#1a5c38] bg-[#1a5c38] text-[#b5e3f4]';
const CHIP_TAKEN = 'border-[#c9a96e]/30 bg-[#ade1f4]/50 text-[#4a5578] line-through cursor-not-allowed dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-500';
const INPUT = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';

function normalize(name) {
  return String(name || '').trim().toLowerCase();
}

/**
 * Pick subjects for a class from a list instead of typing them out.
 *
 * Two lists, in the order a school needs them: the subjects it has already used
 * elsewhere — the ones it will reach for most — then NDOVERA's catalogue for
 * everything else. Anything already on this class is shown struck through
 * rather than hidden, so an owner can see at a glance what is covered instead
 * of wondering why a subject is missing from the list.
 *
 * Typing stays possible. A school with a subject neither list knows should not
 * be stuck, and what they type joins their own list for the next class.
 */
export default function SubjectPicker({
  schoolSubjects = [],
  existingSubjects = [],
  presetNames = null,
  busy = false,
  onAdd,
  addLabel = 'Add',
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [customName, setCustomName] = useState('');
  // Typed subjects are held separately: they are in neither list, so nothing
  // else would remember the spelling the school actually used.
  const [customNames, setCustomNames] = useState([]);

  const taken = useMemo(
    () => new Set(existingSubjects.map(normalize)),
    [existingSubjects],
  );

  // A preset arrives selected but not yet saved, so the school reviews the list
  // and drops what it does not teach before anything is written.
  useEffect(() => {
    if (!presetNames?.length) return;
    const wanted = presetNames.map(name => String(name || '').trim()).filter(Boolean);
    setSelected(new Set(wanted.map(normalize)));
    setCustomNames(wanted);
    setSearch('');
  }, [presetNames]);

  // The school's own subjects first, then the catalogue minus anything the
  // school already has under that name, so no subject is offered twice.
  const sections = useMemo(() => {
    const own = Array.from(new Set(schoolSubjects.map(name => String(name || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    const ownKeys = new Set(own.map(normalize));

    return [
      ...(own.length ? [{ group: 'Your school’s subjects', subjects: own }] : []),
      ...SUBJECT_CATALOGUE.map(section => ({
        group: section.group,
        subjects: section.subjects.filter(name => !ownKeys.has(normalize(name))),
      })),
    ].filter(section => section.subjects.length);
  }, [schoolSubjects]);

  const visible = useMemo(() => {
    const term = normalize(search);
    if (!term) return sections;
    return sections
      .map(section => ({ ...section, subjects: section.subjects.filter(name => normalize(name).includes(term)) }))
      .filter(section => section.subjects.length);
  }, [sections, search]);

  // A search that matches nothing is exactly when a school wants to add its own.
  const searchIsNewSubject = Boolean(
    search.trim() && !visible.length && !taken.has(normalize(search)),
  );

  function toggle(name) {
    if (taken.has(normalize(name))) return;
    setSelected(prev => {
      const next = new Set(prev);
      const key = normalize(name);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addCustom(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed || taken.has(normalize(trimmed))) return;
    setSelected(prev => new Set(prev).add(normalize(trimmed)));
    setCustomNames(prev => (prev.some(item => normalize(item) === normalize(trimmed)) ? prev : [...prev, trimmed]));
    setCustomName('');
    setSearch('');
  }

  const allNames = useMemo(
    () => [...customNames, ...sections.flatMap(section => section.subjects)],
    [customNames, sections],
  );

  // Only the ones the lists below will not already render, so a preset does not
  // show every subject twice.
  const pickedCustom = useMemo(() => {
    const listed = new Set(sections.flatMap(section => section.subjects).map(normalize));
    return customNames.filter(name => !listed.has(normalize(name)));
  }, [customNames, sections]);

  const chosen = useMemo(() => {
    const seen = new Set();
    const names = [];
    allNames.forEach(name => {
      const key = normalize(name);
      if (selected.has(key) && !seen.has(key)) {
        seen.add(key);
        names.push(name);
      }
    });
    return names;
  }, [allNames, selected]);

  async function submit() {
    if (!chosen.length) return;
    // Clear only on a confirmed save. A refused or failed add used to wipe the
    // selection too, so a school that forgot to choose a section had to pick
    // fifteen subjects again to find that out.
    const saved = await onAdd(chosen);
    if (!saved) return;
    setSelected(new Set());
    setCustomNames([]);
    setSearch('');
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && searchIsNewSubject) { e.preventDefault(); addCustom(search); } }}
          placeholder="Search subjects…"
          className={`${INPUT} flex-1 min-w-[160px]`}
          aria-label="Search subjects"
        />
      </div>

      {searchIsNewSubject ? (
        <button
          type="button"
          onClick={() => addCustom(search)}
          className="w-full rounded-xl border border-dashed border-[#1a5c38]/50 px-3 py-2 text-left text-sm font-semibold text-[#1a5c38] dark:border-emerald-400/40 dark:text-emerald-300"
        >
          Nothing matches “{search.trim()}”. Add it as a new subject.
        </button>
      ) : null}

      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {pickedCustom.length ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-slate-400">Chosen</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {pickedCustom.map(name => (
                <button
                  key={`custom-${name}`}
                  type="button"
                  onClick={() => toggle(name)}
                  className={`${CHIP} ${selected.has(normalize(name)) ? CHIP_ON : CHIP_OFF}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {visible.map(section => (
          <div key={section.group}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-slate-400">{section.group}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {section.subjects.map(name => {
                const isTaken = taken.has(normalize(name));
                const isOn = selected.has(normalize(name));
                return (
                  <button
                    key={`${section.group}-${name}`}
                    type="button"
                    disabled={isTaken}
                    title={isTaken ? 'Already on this class' : undefined}
                    onClick={() => toggle(name)}
                    className={`${CHIP} ${isTaken ? CHIP_TAKEN : isOn ? CHIP_ON : CHIP_OFF}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {!visible.length && !searchIsNewSubject ? (
          <p className="text-sm text-[#4a5578] dark:text-slate-400">Every subject in the list is already on this class.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(customName); } }}
          placeholder="Or type a subject the list does not have"
          className={`${INPUT} flex-1 min-w-[180px]`}
          aria-label="Add a subject by name"
        />
        <button
          type="button"
          onClick={() => addCustom(customName)}
          disabled={!customName.trim()}
          className="rounded-xl border border-[#c9a96e]/50 px-3 py-2 text-sm font-semibold text-[#14215b] disabled:opacity-50 dark:border-white/20 dark:text-slate-200"
        >
          Add to list
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!chosen.length || busy}
          className="rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-60"
        >
          {busy ? 'Adding…' : `${addLabel}${chosen.length ? ` ${chosen.length} subject${chosen.length === 1 ? '' : 's'}` : ''}`}
        </button>
        {chosen.length ? (
          <button
            type="button"
            onClick={() => { setSelected(new Set()); setCustomNames([]); }}
            className="text-xs font-semibold text-[#800020] underline dark:text-slate-300"
          >
            Clear selection
          </button>
        ) : null}
      </div>
    </div>
  );
}
