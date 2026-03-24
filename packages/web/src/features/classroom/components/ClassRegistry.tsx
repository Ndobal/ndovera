import { useMemo, useState } from 'react';
import { Pencil, Plus, School2, Trash2, Users, X } from 'lucide-react';

import { useData } from '../../../hooks/useData';
import { buildClassDisplayName, classCatalogBySection, classCatalogSections, getClassSectionLabel } from '../data/classCatalog';
import { createSchoolClass, deleteSchoolClass, type SchoolClass, updateSchoolClass } from '../services/classroomApi';

type ClassRegistryProps = {
  role: string;
  onOpenClass?: (schoolClass: SchoolClass) => void;
};

export function ClassRegistry({ role, onOpenClass }: ClassRegistryProps) {
  const managerView = role === 'Teacher' || role === 'School Admin' || role === 'HOS' || role === 'HoS' || role === 'Super Admin' || role === 'Owner' || role === 'ICT' || role === 'ICT Manager';
  const { data, loading, refetch } = useData<SchoolClass[]>('/api/classes');
  const classes = useMemo(() => data || [], [data]);
  const [draft, setDraft] = useState({
    level: '',
    name: '',
    section: classCatalogSections[0]?.id || 'primary',
  });
  const [saving, setSaving] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
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

  const resetDraft = () => {
    setDraft({
      level: '',
      name: '',
      section: classCatalogSections[0]?.id || 'primary',
    });
    setEditingClassId(null);
    setFormError(null);
  };

  const submitClass = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingClassId) {
        await updateSchoolClass(editingClassId, {
          level: draft.level.trim() || undefined,
          name: draft.name.trim(),
          section: draft.section,
        });
      } else {
        await createSchoolClass({
          level: draft.level.trim() || undefined,
          name: draft.name.trim(),
          section: draft.section,
        });
      }
      resetDraft();
      await refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create class right now.');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (schoolClass: SchoolClass) => {
    setEditingClassId(schoolClass.id);
    setDraft({
      level: schoolClass.level || '',
      name: schoolClass.name || '',
      section: schoolClass.section || classCatalogSections[0]?.id || 'primary',
    });
    setFormError(null);
  };

  const removeClass = async (classId: string) => {
    const confirmed = window.confirm('Delete this class? Any subjects attached to it will also be removed.');
    if (!confirmed) return;
    setDeletingClassId(classId);
    setFormError(null);
    try {
      await deleteSchoolClass(classId);
      if (editingClassId === classId) resetDraft();
      await refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to delete class right now.');
    } finally {
      setDeletingClassId(null);
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
            {editingClassId ? (
              <button type="button" onClick={resetDraft} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                <X className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
            <button type="button" onClick={submitClass} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" />
              {saving ? 'Saving…' : editingClassId ? 'Save class' : 'Create class'}
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
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-50 px-3 py-1 text-[10px] font-semibold text-sky-700">{getClassSectionLabel(cls.section)}</span>
                {managerView ? (
                  <>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        beginEdit(cls);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          beginEdit(cls);
                        }
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeClass(cls.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          void removeClass(cls.id);
                        }
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-500 hover:border-rose-300 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{buildClassDisplayName(cls.level, cls.name) || cls.name}</h3>
            <p className="mt-2 text-sm text-slate-600">{cls.teacherName || 'Class teacher not assigned yet'}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Users className="h-4 w-4 text-sky-600" />
              <span>{deletingClassId === cls.id ? 'Deleting…' : cls.level || 'Open level'}</span>
            </div>
          </button>
        ))}
      </div>

      {!loading && classes.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">No saved classes yet. Create the live class structure here instead of relying on demo data.</div> : null}
    </div>
  );
}
