import { useMemo, useState } from 'react';
import { Plus, School2, Users } from 'lucide-react';

import { useData } from '../../../hooks/useData';
import { buildClassDisplayName, classCatalogBySection, classCatalogSections, getClassSectionLabel } from '../data/classCatalog';
import { createSchoolClass, type SchoolClass } from '../services/classroomApi';

type ClassRegistryProps = {
  role: string;
  onOpenClass?: (schoolClass: SchoolClass) => void;
};

const fallbackClasses: SchoolClass[] = [
  { id: 'fallback_jhs1', section: 'junior-secondary', level: 'JHS 1', name: 'Thinkers', teacherName: 'Mrs. Jane Smith' },
  { id: 'fallback_jhs2', section: 'junior-secondary', level: 'JHS 2', name: 'Strategists', teacherName: 'Mr. John Doe' },
  { id: 'fallback_shs1', section: 'senior-secondary', level: 'SHS 1', name: 'Visionaries', teacherName: 'Mr. Samuel Okoro' },
];

export function ClassRegistry({ role, onOpenClass }: ClassRegistryProps) {
  const managerView = role === 'Teacher' || role === 'School Admin' || role === 'HOS';
  const { data, loading, refetch } = useData<SchoolClass[]>('/api/classes');
  const classes = useMemo(() => (data && data.length ? data : fallbackClasses), [data]);
  const [draft, setDraft] = useState({
    level: '',
    name: '',
    section: classCatalogSections[0]?.id || 'primary',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const existingKeys = useMemo(
    () => new Set(classes.filter((item) => item.section === draft.section).map((item) => `${(item.level || '').trim().toLowerCase()}__${item.name.trim().toLowerCase()}`)),
    [classes, draft.section],
  );
  const catalogEntries = useMemo(
    () => (classCatalogBySection[draft.section] || []).filter((entry) => !existingKeys.has(`${entry.level.trim().toLowerCase()}__${entry.name.trim().toLowerCase()}`)),
    [draft.section, existingKeys],
  );

  const chooseCatalogClass = (value: string) => {
    const next = (classCatalogBySection[draft.section] || []).find((entry) => entry.id === value);
    if (!next) return;
    setDraft((current) => ({ ...current, level: next.level, name: next.name }));
    setFormError(null);
  };

  const createClass = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await createSchoolClass({
        level: draft.level.trim() || undefined,
        name: draft.name.trim(),
        section: draft.section,
      });
      setDraft((current) => ({ ...current, level: '', name: '' }));
      await refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create class right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {managerView ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs text-slate-500">Schools can choose from the built-in section class list, customize the class name or level, or add their own class naming style.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={draft.section} onChange={(event) => setDraft((current) => ({ ...current, section: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400">
              {classCatalogSections.map((section) => (
                <option key={section.id} value={section.id}>{section.label}</option>
              ))}
            </select>
            <select defaultValue="" onChange={(event) => chooseCatalogClass(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400">
              <option value="">Select from section list</option>
              {catalogEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.level} • {entry.name}</option>
              ))}
            </select>
            <input value={draft.level} onChange={(event) => setDraft((current) => ({ ...current, level: event.target.value }))} placeholder="Level / grade" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Class name" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
          </div>
          <div className="mt-3 flex items-center justify-end gap-3">
            {formError ? <p className="text-sm text-rose-500">{formError}</p> : null}
            <button type="button" onClick={createClass} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" />
              {saving ? 'Saving…' : 'Create class'}
            </button>
          </div>
        </section>
      ) : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">Loading classes…</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((cls) => (
          <button key={cls.id} type="button" onClick={() => onOpenClass?.(cls)} className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex rounded-2xl bg-sky-50 p-3 text-sky-700">
                <School2 className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-semibold text-sky-700">{getClassSectionLabel(cls.section)}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{buildClassDisplayName(cls.level, cls.name) || cls.name}</h3>
            <p className="mt-2 text-sm text-slate-600">{cls.teacherName || 'Class teacher not assigned yet'}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Users className="h-4 w-4 text-sky-600" />
              <span>{cls.level || 'Open level'}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
