import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { getMe, getClasses, addClass, getSubjects, addSubject, getSession, saveSession, getBranding, saveBranding, uploadLogo, getPeople, bulkAddSubjects, bulkAddSubjectsBySection, updateSubject, deleteSubject, updateClass, bulkUpdateClasses, deleteClass, bulkAssignSubjects } from '../../../features/school/services/schoolApi';
import AdminPasswordReset from '../../../features/auth/components/AdminPasswordReset';
import StaffAttendanceManagementPanel from '../../../features/attendance/components/StaffAttendanceManagementPanel';
import WebsiteTab from './tabs/WebsiteTab';
import EventsTab from './tabs/EventsTab';

const TABS = ['Profile', 'School Branding', 'Website', 'Events', 'Classes', 'Subjects', 'Sessions & Terms', 'Attendance Management'];

const DEFAULT_CLASS_NAMES = [
  { label: 'Primary 1', value: 'Primary 1' },
  { label: 'Primary 2', value: 'Primary 2' },
  { label: 'Primary 3', value: 'Primary 3' },
  { label: 'Primary 4', value: 'Primary 4' },
  { label: 'Primary 5', value: 'Primary 5' },
  { label: 'Primary 6', value: 'Primary 6' },
  { label: 'JSS 1', value: 'JSS 1' },
  { label: 'JSS 2', value: 'JSS 2' },
  { label: 'JSS 3', value: 'JSS 3' },
  { label: 'SS 1', value: 'SS 1' },
  { label: 'SS 2', value: 'SS 2' },
  { label: 'SS 3', value: 'SS 3' },
];

const DEFAULT_SUBJECT_PRESETS = {
  'Primary 1': 'Mathematics\nEnglish Language\nPhonics\nHandwriting\nSocial Studies\nBasic Science\nCultural & Creative Arts\nReligious Studies\nPhysical Education',
  'Primary 2': 'Mathematics\nEnglish Language\nPhonics\nHandwriting\nSocial Studies\nBasic Science\nCultural & Creative Arts\nReligious Studies\nPhysical Education',
  'Primary 3': 'Mathematics\nEnglish Language\nPhonics\nHandwriting\nSocial Studies\nBasic Science\nCultural & Creative Arts\nReligious Studies\nPhysical Education',
  'Primary 4': 'Mathematics\nEnglish Language\nSocial Studies\nBasic Science\nCultural & Creative Arts\nReligious Studies\nBasic Technology\nPhysical Education',
  'Primary 5': 'Mathematics\nEnglish Language\nSocial Studies\nBasic Science\nCultural & Creative Arts\nReligious Studies\nBasic Technology\nPhysical Education',
  'Primary 6': 'Mathematics\nEnglish Language\nSocial Studies\nBasic Science\nCultural & Creative Arts\nReligious Studies\nBasic Technology\nPhysical Education',
  'JSS 1': 'Mathematics\nEnglish Language\nFrench Language\nBiology\nChemistry\nPhysics\nGeography\nHistory\nSocial Studies\nBasic Technology\nCultural & Creative Arts\nComputer Studies\nReligious Studies\nAgricultural Science\nPhysical & Health Education',
  'JSS 2': 'Mathematics\nEnglish Language\nFrench Language\nBiology\nChemistry\nPhysics\nGeography\nHistory\nSocial Studies\nBasic Technology\nCultural & Creative Arts\nComputer Studies\nReligious Studies\nAgricultural Science\nPhysical & Health Education',
  'JSS 3': 'Mathematics\nEnglish Language\nFrench Language\nBiology\nChemistry\nPhysics\nGeography\nHistory\nSocial Studies\nBasic Technology\nCultural & Creative Arts\nComputer Studies\nReligious Studies\nAgricultural Science\nPhysical & Health Education',
  'SS 1': 'Mathematics\nEnglish Language\nFrench Language\nBiology\nChemistry\nPhysics\nGeography\nHistory\nLiterature in English\nEconomics\nGovernment\nAccounting\nCommerce\nChristian Religious Knowledge\nIslamic Religious Knowledge',
  'SS 2': 'Mathematics\nEnglish Language\nFrench Language\nBiology\nChemistry\nPhysics\nGeography\nHistory\nLiterature in English\nEconomics\nGovernment\nAccounting\nCommerce\nChristian Religious Knowledge\nIslamic Religious Knowledge',
  'SS 3': 'Mathematics\nEnglish Language\nFrench Language\nBiology\nChemistry\nPhysics\nGeography\nHistory\nLiterature in English\nEconomics\nGovernment\nAccounting\nCommerce\nChristian Religious Knowledge\nIslamic Religious Knowledge',
};

function ProfileTab() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getMe().then(d => setMe(d?.user || d)).finally(() => setLoading(false)); }, []);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5">
        {loading ? <p className="text-[#800020]">Loading...</p> : me ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[['Name', me.name], ['Email', me.email], ['Role', me.role]].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">{label}</p>
                <p className="text-[#191970] dark:text-slate-300 mt-1 capitalize">{val || '—'}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-[#800020]">No profile info.</p>}
      </div>
      <div className="rounded-2xl p-5 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5">
        <h3 className="text-base font-semibold text-[#800000] dark:text-slate-100 mb-4">Password Reset</h3>
        <AdminPasswordReset />
      </div>
    </div>
  );
}

function BrandingTab() {
  const [form, setForm] = useState({
    schoolName: '',
    tagline: '',
    website: '',
    logoUrl: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    whatsapp: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    getBranding().then(d => { if (d?.branding) setForm(f => ({ ...f, ...d.branding })); }).finally(() => setLoading(false));
  }, []);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const result = await uploadLogo(file);
      setForm(f => ({ ...f, logoUrl: result.logoUrl }));
      setMsg('Logo uploaded!');
    } catch (err) { setMsg(err.message); }
    finally { setUploading(false); }
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setMsg('');
    try { await saveBranding(form); setMsg('Saved!'); } catch (err) { setMsg(err.message); } finally { setSaving(false); }
  }

  if (loading) return <p className="text-[#800020]">Loading...</p>;
  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-xs text-[#800020] dark:text-slate-400">Your logo, website, and social links appear on the school public website and in the Ndovera directory.</p>

      <div>
        <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">School Logo</label>
        <div className="flex items-center gap-3 mt-2">
          {form.logoUrl && <img src={form.logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-contain border border-[#c9a96e]/40 bg-white" />}
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
              {uploading ? 'Uploading…' : '📁 Upload Logo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <p className="text-xs text-[#800020] dark:text-slate-400">PNG, JPG, SVG recommended</p>
          </div>
        </div>
      </div>

      {[['School Name', 'schoolName'], ['Tagline', 'tagline'], ['Website URL', 'website']].map(([label, key]) => (
        <div key={key}>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">{label}</label>
          <input value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]" />
        </div>
      ))}

      <div className="rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090]/50 p-4 dark:border-white/10 dark:bg-slate-900/20">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">Social Media Links</p>
          <p className="mt-1 text-xs text-[#191970] dark:text-slate-300">Use a full profile URL, an @handle, or for WhatsApp a phone number or wa.me link.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            ['Facebook', 'facebook', 'facebook.com/your-school'],
            ['Instagram', 'instagram', '@your-school'],
            ['TikTok', 'tiktok', '@your-school'],
            ['YouTube', 'youtube', 'youtube.com/@your-school'],
            ['WhatsApp', 'whatsapp', '2348012345678'],
          ].map(([label, key, placeholder]) => (
            <div key={key}>
              <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">{label}</label>
              <input
                value={form[key] || ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
              />
            </div>
          ))}
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.includes('!') ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</p>}
      <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-6 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Branding'}
      </button>
    </form>
  );
}

function ClassesTab() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ name: '', arm: '', classTeacherId: '', teacherIds: [], caregiverIds: [] });
  const [drafts, setDrafts] = useState({});
  const [dirtyClassIds, setDirtyClassIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingClassId, setSavingClassId] = useState('');
  const [savingAll, setSavingAll] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [bulkClassId, setBulkClassId] = useState(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickArms, setQuickArms] = useState('A,B,C');
  const [quickSelected, setQuickSelected] = useState([]);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickMsg, setQuickMsg] = useState('');

  const teacherNameById = useMemo(() => Object.fromEntries(teachers.map(person => [person.id, person.name])), [teachers]);
  const caregiverNameById = useMemo(() => Object.fromEntries(caregivers.map(person => [person.id, person.name])), [caregivers]);

  function buildDraft(cls) {
    return {
      id: cls.id,
      name: cls.name || '',
      arm: cls.arm || '',
      classTeacherId: cls.classTeacherId || '',
      teacherIds: Array.isArray(cls.teacherIds) ? cls.teacherIds.filter(Boolean) : [],
      caregiverIds: Array.isArray(cls.caregiverIds) ? cls.caregiverIds.filter(Boolean) : [],
    };
  }

  const loadAll = useCallback(() => {
    return Promise.all([
      getClasses(),
      getPeople({ role: 'teacher', limit: 200 }),
      getPeople({ role: 'caregiver', limit: 200 }),
      getSubjects(),
    ]).then(([classData, teacherData, caregiverData, subjectData]) => {
      const nextClasses = classData?.classes || [];
      setClasses(nextClasses);
      setTeachers(teacherData?.people || []);
      setCaregivers(caregiverData?.people || []);
      setSubjects(subjectData?.subjects || []);
      setDrafts(Object.fromEntries(nextClasses.map(cls => [cls.id, buildDraft(cls)])));
      setDirtyClassIds([]);
    });
  }, []);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  function markDirty(classId) {
    setDirtyClassIds(current => current.includes(classId) ? current : [...current, classId]);
  }

  function updateDraft(classId, updater) {
    setDrafts(current => {
      const next = typeof updater === 'function' ? updater(current[classId] || buildDraft(classes.find(cls => cls.id === classId) || {})) : updater;
      return { ...current, [classId]: next };
    });
    markDirty(classId);
  }

  function toggleMultiValue(classId, key, value) {
    updateDraft(classId, current => {
      const values = Array.isArray(current[key]) ? current[key] : [];
      const nextValues = values.includes(value) ? values.filter(item => item !== value) : [...values, value];
      const nextDraft = { ...current, [key]: nextValues };
      if (key === 'teacherIds' && current.classTeacherId && !nextValues.includes(current.classTeacherId)) {
        nextDraft.classTeacherId = '';
      }
      return nextDraft;
    });
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    setError('');
    setStatusMsg('');
    try {
      await addClass(form);
      await loadAll();
      setForm({ name: '', arm: '', classTeacherId: '', teacherIds: [], caregiverIds: [] });
      setStatusMsg('Class created.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkAdd(classId) {
    if (!bulkText.trim()) return;
    setBulkSaving(true);
    setBulkMsg('');
    try {
      const lines = bulkText.split(/[\n,]+/).map(value => value.trim()).filter(Boolean);
      const result = await bulkAddSubjects(classId, { subjects: lines });
      setBulkMsg(`Added ${result.added} subject(s).`);
      setBulkText('');
      await loadAll();
    } catch (err) {
      setBulkMsg(err.message);
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleSaveClass(classId) {
    const draft = drafts[classId];
    if (!draft) return;
    setSavingClassId(classId);
    setStatusMsg('');
    try {
      await updateClass(classId, draft);
      await loadAll();
      setStatusMsg('Class updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingClassId('');
    }
  }

  async function handleSaveAll() {
    const changedRows = dirtyClassIds.map(classId => drafts[classId]).filter(Boolean);
    if (!changedRows.length) return;
    setSavingAll(true);
    setStatusMsg('');
    setError('');
    try {
      await bulkUpdateClasses(changedRows);
      await loadAll();
      setStatusMsg('All class changes saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAll(false);
    }
  }

  async function handleDeleteClass(classId, label) {
    if (!window.confirm(`Delete ${label}? Students and subjects in this class will be cleared from the class.`)) return;
    setDeletingClassId(classId);
    setStatusMsg('');
    try {
      await deleteClass(classId);
      await loadAll();
      setStatusMsg('Class deleted.');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingClassId('');
    }
  }

  async function handleQuickSetup() {
    const arms = quickArms.split(',').map(value => value.trim()).filter(Boolean);
    if (quickSelected.length === 0) {
      setQuickMsg('Select at least one class.');
      return;
    }
    setQuickSaving(true);
    setQuickMsg('');
    try {
      let created = 0;
      for (const name of quickSelected) {
        if (!arms.length) {
          await addClass({ name, arm: '', classTeacherId: '', teacherIds: [], caregiverIds: [] });
          created += 1;
          continue;
        }
        for (const arm of arms) {
          await addClass({ name, arm, classTeacherId: '', teacherIds: [], caregiverIds: [] });
          created += 1;
        }
      }
      await loadAll();
      setQuickSelected([]);
      setQuickMsg(`Created ${created} class(es).`);
    } catch (err) {
      setQuickMsg(err.message || 'Could not create classes.');
    } finally {
      setQuickSaving(false);
    }
  }

  if (loading) return <p className="text-[#800020]">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#800000] dark:text-slate-100">Quick Setup and Save-All</p>
            <p className="text-xs text-[#800020] dark:text-slate-400 mt-1">Build classes fast, assign multiple teachers or caregivers, then save every edited class together.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowQuickSetup(value => !value); setQuickMsg(''); }} className="rounded-2xl border border-[#c9a96e]/40 px-4 py-2 text-xs font-semibold text-[#1a5c38]">
              {showQuickSetup ? 'Hide Quick Setup' : 'Show Quick Setup'}
            </button>
            <button type="button" onClick={handleSaveAll} disabled={savingAll || dirtyClassIds.length === 0} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#f5deb3] disabled:opacity-60">
              {savingAll ? 'Saving...' : `Save All Changes${dirtyClassIds.length ? ` (${dirtyClassIds.length})` : ''}`}
            </button>
          </div>
        </div>
        {showQuickSetup && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {DEFAULT_CLASS_NAMES.map(cls => {
                const selected = quickSelected.includes(cls.value);
                return (
                  <button
                    key={cls.value}
                    type="button"
                    onClick={() => setQuickSelected(current => selected ? current.filter(value => value !== cls.value) : [...current, cls.value])}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${selected ? 'bg-[#1a5c38] text-[#f5deb3] border-[#1a5c38]' : 'bg-[#f5deb3] text-[#800020] border-[#c9a96e]/40'}`}
                  >
                    {cls.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Arms</label>
                <input value={quickArms} onChange={e => setQuickArms(e.target.value)} className="mt-1 w-48 rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] px-3 py-2 text-sm text-[#191970]" placeholder="A,B,C" />
              </div>
              <button type="button" onClick={handleQuickSetup} disabled={quickSaving || quickSelected.length === 0} className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#f5deb3] disabled:opacity-60">
                {quickSaving ? 'Creating...' : 'Create Selected Classes'}
              </button>
            </div>
            {quickMsg && <p className={`text-sm font-semibold ${quickMsg.includes('Created') ? 'text-[#1a5c38]' : 'text-red-600'}`}>{quickMsg}</p>}
          </div>
        )}
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Class Name</label>
          <input required value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] px-3 py-2 text-sm text-[#191970]" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Arm/Section</label>
          <input value={form.arm} onChange={e => setForm(current => ({ ...current, arm: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] px-3 py-2 text-sm text-[#191970]" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Primary Teacher</label>
          <select value={form.classTeacherId} onChange={e => {
            const nextTeacherId = e.target.value;
            setForm(current => ({
              ...current,
              classTeacherId: nextTeacherId,
              teacherIds: nextTeacherId && !current.teacherIds.includes(nextTeacherId) ? [...current.teacherIds, nextTeacherId] : current.teacherIds,
            }));
          }} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] px-3 py-2 text-sm text-[#191970]">
            <option value="">— None —</option>
            {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </select>
        </div>
        <div className="xl:col-span-2 flex items-end">
          <button type="submit" disabled={saving} className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#f5deb3] disabled:opacity-60">
            {saving ? 'Adding...' : 'Add Class'}
          </button>
        </div>
      </form>

      {(error || statusMsg) && <p className={`text-sm ${error ? 'text-red-600' : 'text-[#1a5c38]'}`}>{error || statusMsg}</p>}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {classes.length === 0 ? <p className="text-[#800020] dark:text-slate-400 text-sm">No classes yet.</p> : classes.map(cls => {
          const draft = drafts[cls.id] || buildDraft(cls);
          const classSubjects = subjects.filter(subject => subject.classId === cls.id);
          const isDirty = dirtyClassIds.includes(cls.id);

          return (
            <div key={cls.id} className={`rounded-2xl p-4 border space-y-3 ${isDirty ? 'border-[#1a5c38] bg-[#f0d090]' : 'border-[#c9a96e]/30 bg-[#f0d090] dark:bg-slate-800/40 dark:border-white/5'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-[#800020]">Class Name</label>
                    <input value={draft.name} onChange={e => updateDraft(cls.id, current => ({ ...current, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] px-3 py-2 text-sm text-[#191970]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-[#800020]">Arm</label>
                    <input value={draft.arm} onChange={e => updateDraft(cls.id, current => ({ ...current, arm: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] px-3 py-2 text-sm text-[#191970]" />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isDirty && <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-[11px] font-bold uppercase text-[#f5deb3]">Unsaved</span>}
                  <button type="button" onClick={() => handleDeleteClass(cls.id, `${cls.name}${cls.arm ? ` ${cls.arm}` : ''}`)} disabled={deletingClassId === cls.id} className="rounded-xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60">
                    {deletingClassId === cls.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-[#800020]">Primary Teacher</label>
                  <select value={draft.classTeacherId} onChange={e => {
                    const nextTeacherId = e.target.value;
                    updateDraft(cls.id, current => ({
                      ...current,
                      classTeacherId: nextTeacherId,
                      teacherIds: nextTeacherId && !current.teacherIds.includes(nextTeacherId) ? [...current.teacherIds, nextTeacherId] : current.teacherIds,
                    }));
                  }} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] px-3 py-2 text-sm text-[#191970]">
                    <option value="">— None —</option>
                    {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#800020]">Subjects</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {classSubjects.length ? classSubjects.map(subject => (
                      <span key={subject.id} className="rounded-full border border-[#c9a96e]/40 bg-[#f5deb3] px-2 py-0.5 text-xs text-[#191970]">{subject.name}</span>
                    )) : <span className="text-xs text-[#800020]">No subjects yet.</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#c9a96e]/30 bg-[#f5deb3] p-3">
                  <p className="text-xs font-semibold uppercase text-[#800020]">Teachers in This Class</p>
                  <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {teachers.map(teacher => (
                      <button key={teacher.id} type="button" onClick={() => toggleMultiValue(cls.id, 'teacherIds', teacher.id)} className={`rounded-full px-3 py-1 text-xs font-semibold border ${draft.teacherIds.includes(teacher.id) ? 'bg-[#1a5c38] border-[#1a5c38] text-[#f5deb3]' : 'bg-white border-[#c9a96e]/40 text-[#800020]'}`}>
                        {teacher.name}
                      </button>
                    ))}
                  </div>
                  {draft.teacherIds.length > 0 && (
                    <p className="mt-2 text-xs text-[#191970]">Selected: {draft.teacherIds.map(id => teacherNameById[id] || id).join(', ')}</p>
                  )}
                </div>

                <div className="rounded-2xl border border-[#c9a96e]/30 bg-[#f5deb3] p-3">
                  <p className="text-xs font-semibold uppercase text-[#800020]">Caregivers</p>
                  <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {caregivers.map(caregiver => (
                      <button key={caregiver.id} type="button" onClick={() => toggleMultiValue(cls.id, 'caregiverIds', caregiver.id)} className={`rounded-full px-3 py-1 text-xs font-semibold border ${draft.caregiverIds.includes(caregiver.id) ? 'bg-[#191970] border-[#191970] text-[#f5deb3]' : 'bg-white border-[#c9a96e]/40 text-[#800020]'}`}>
                        {caregiver.name}
                      </button>
                    ))}
                  </div>
                  {draft.caregiverIds.length > 0 && (
                    <p className="mt-2 text-xs text-[#191970]">Selected: {draft.caregiverIds.map(id => caregiverNameById[id] || id).join(', ')}</p>
                  )}
                </div>
              </div>

              {bulkClassId === cls.id ? (
                <div className="space-y-2 rounded-2xl border border-[#c9a96e]/30 bg-[#f5deb3] p-3">
                  <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={3} placeholder="One subject per line or comma-separated" className="w-full rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-xs text-[#191970]" />
                  {bulkMsg && <p className={`text-xs ${bulkMsg.includes('Added') ? 'text-[#1a5c38]' : 'text-red-600'}`}>{bulkMsg}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleBulkAdd(cls.id)} disabled={bulkSaving} className="rounded-xl bg-[#1a5c38] px-3 py-2 text-xs font-bold text-[#f5deb3] disabled:opacity-60">
                      {bulkSaving ? 'Adding...' : 'Add Subjects'}
                    </button>
                    <button type="button" onClick={() => { setBulkClassId(null); setBulkText(''); setBulkMsg(''); }} className="rounded-xl border border-[#c9a96e]/40 px-3 py-2 text-xs font-semibold text-[#800020]">
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setBulkClassId(cls.id); setBulkMsg(''); }} className="rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] px-3 py-2 text-xs font-bold text-[#1a5c38]">
                  Bulk Add Subjects
                </button>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => handleSaveClass(cls.id)} disabled={savingClassId === cls.id} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] disabled:opacity-60">
                  {savingClassId === cls.id ? 'Saving...' : 'Save This Class'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectsTab() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ name: '', classId: '', teacherId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  // Section bulk form
  const [sectionMode, setSectionMode] = useState(false);
  const [sectionForm, setSectionForm] = useState({ sectionName: '', subjectsText: '', teacherId: '' });
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionMsg, setSectionMsg] = useState('');
  const [assignmentForm, setAssignmentForm] = useState({ mode: 'class', teacherId: '', classIds: [], sectionNames: [], subjectNames: [] });
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentMsg, setAssignmentMsg] = useState('');

  function reload() {
    return Promise.all([getSubjects(), getClasses(), getPeople({ role: 'teacher', limit: 200 })]).then(([sd, cd, pd]) => {
      setSubjects(sd?.subjects || []); setClasses(cd?.classes || []);
      setTeachers(pd?.people || []);
    });
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  async function handleAdd(e) {
    e.preventDefault(); if (!form.name) return; setSaving(true); setError('');
    try { await addSubject(form); await reload(); setForm({ name: '', classId: '', teacherId: '' }); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleUpdate(id) {
    setEditSaving(true);
    try { await updateSubject(id, editForm); await reload(); setEditingId(null); }
    catch {} finally { setEditSaving(false); }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete subject "${name}"?`)) return;
    try { await deleteSubject(id); await reload(); } catch {}
  }

  async function handleSectionBulk(e) {
    e.preventDefault(); setSectionSaving(true); setSectionMsg('');
    try {
      const lines = sectionForm.subjectsText.split('\n').map(l => l.trim()).filter(Boolean);
      if (!sectionForm.sectionName || lines.length === 0) { setSectionMsg('Section name and at least one subject required.'); setSectionSaving(false); return; }
      const result = await bulkAddSubjectsBySection(sectionForm.sectionName, lines, sectionForm.teacherId || null);
      if (result?.success) { setSectionMsg(`Added ${result.added} subject(s) across ${result.classCount} class(es).`); await reload(); setSectionForm({ sectionName: '', subjectsText: '', teacherId: '' }); }
      else setSectionMsg(result?.error || 'Could not add subjects.');
    } catch (err) { setSectionMsg(err.message); } finally { setSectionSaving(false); }
  }

  async function handleBulkAssignment(e) {
    e.preventDefault();
    if (!assignmentForm.teacherId || assignmentForm.subjectNames.length === 0) {
      setAssignmentMsg('Choose a teacher and at least one subject.');
      return;
    }

    if (assignmentForm.mode === 'class' && assignmentForm.classIds.length === 0) {
      setAssignmentMsg('Choose at least one class.');
      return;
    }

    if (assignmentForm.mode === 'section' && assignmentForm.sectionNames.length === 0) {
      setAssignmentMsg('Choose at least one section.');
      return;
    }

    setAssignmentSaving(true);
    setAssignmentMsg('');
    try {
      const result = await bulkAssignSubjects(assignmentForm);
      setAssignmentMsg(`Updated ${result.updated} subject assignment(s).`);
      await reload();
    } catch (err) {
      setAssignmentMsg(err.message);
    } finally {
      setAssignmentSaving(false);
    }
  }

  function className(classId) {
    const c = classes.find(c => c.id === classId);
    return c ? `${c.name}${c.arm ? ` ${c.arm}` : ''}` : null;
  }

  function teacherName(teacherId) {
    const t = teachers.find(t => t.id === teacherId);
    return t ? t.name : null;
  }

  if (loading) return <p className="text-[#800020]">Loading...</p>;

  // Group by classId
  const grouped = {};
  const unassigned = [];
  subjects.forEach(s => {
    if (s.classId) { if (!grouped[s.classId]) grouped[s.classId] = []; grouped[s.classId].push(s); }
    else unassigned.push(s);
  });

  const groups = [
    ...Object.entries(grouped).map(([classId, subs]) => ({ label: className(classId) || classId, subs })),
    ...(unassigned.length > 0 ? [{ label: 'Unassigned', subs: unassigned }] : []),
  ];
  const sectionOptions = [...new Set(classes.map(c => c.name).filter(Boolean))];
  const subjectNameOptions = [...new Set(subjects.map(subject => subject.name).filter(Boolean))].sort((left, right) => left.localeCompare(right));

  return (
    <div className="space-y-4">
      <form onSubmit={handleBulkAssignment} className="rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-[#800000]">Easy Teacher Assignment</p>
          <p className="text-xs text-[#191970] mt-1">Pick a teacher, choose one or more subjects, then apply the assignment to selected classes, a whole section, or the whole school.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="text-xs text-[#800020] uppercase font-semibold">Scope</label>
            <select value={assignmentForm.mode} onChange={e => setAssignmentForm(current => ({ ...current, mode: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] px-3 py-2 text-sm text-[#191970]">
              <option value="class">Selected Classes</option>
              <option value="section">Selected Sections</option>
              <option value="school">Whole School</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#800020] uppercase font-semibold">Teacher</label>
            <select value={assignmentForm.teacherId} onChange={e => setAssignmentForm(current => ({ ...current, teacherId: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] px-3 py-2 text-sm text-[#191970]">
              <option value="">— Select Teacher —</option>
              {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
          </div>
          <div className="xl:col-span-2">
            <label className="text-xs text-[#800020] uppercase font-semibold">Subjects</label>
            <div className="mt-1 flex flex-wrap gap-2 rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] p-3">
              {subjectNameOptions.map(subjectName => (
                <button key={subjectName} type="button" onClick={() => setAssignmentForm(current => ({
                  ...current,
                  subjectNames: current.subjectNames.includes(subjectName)
                    ? current.subjectNames.filter(value => value !== subjectName)
                    : [...current.subjectNames, subjectName],
                }))} className={`rounded-full px-3 py-1 text-xs font-semibold border ${assignmentForm.subjectNames.includes(subjectName) ? 'bg-[#1a5c38] border-[#1a5c38] text-[#f5deb3]' : 'bg-white border-[#c9a96e]/40 text-[#800020]'}`}>
                  {subjectName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {assignmentForm.mode === 'class' && (
          <div>
            <label className="text-xs text-[#800020] uppercase font-semibold">Classes</label>
            <div className="mt-1 flex flex-wrap gap-2 rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] p-3">
              {classes.map(cls => {
                const label = `${cls.name}${cls.arm ? ` ${cls.arm}` : ''}`;
                return (
                  <button key={cls.id} type="button" onClick={() => setAssignmentForm(current => ({
                    ...current,
                    classIds: current.classIds.includes(cls.id) ? current.classIds.filter(value => value !== cls.id) : [...current.classIds, cls.id],
                  }))} className={`rounded-full px-3 py-1 text-xs font-semibold border ${assignmentForm.classIds.includes(cls.id) ? 'bg-[#191970] border-[#191970] text-[#f5deb3]' : 'bg-white border-[#c9a96e]/40 text-[#800020]'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {assignmentForm.mode === 'section' && (
          <div>
            <label className="text-xs text-[#800020] uppercase font-semibold">Sections</label>
            <div className="mt-1 flex flex-wrap gap-2 rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] p-3">
              {sectionOptions.map(sectionName => (
                <button key={sectionName} type="button" onClick={() => setAssignmentForm(current => ({
                  ...current,
                  sectionNames: current.sectionNames.includes(sectionName) ? current.sectionNames.filter(value => value !== sectionName) : [...current.sectionNames, sectionName],
                }))} className={`rounded-full px-3 py-1 text-xs font-semibold border ${assignmentForm.sectionNames.includes(sectionName) ? 'bg-[#191970] border-[#191970] text-[#f5deb3]' : 'bg-white border-[#c9a96e]/40 text-[#800020]'}`}>
                  {sectionName}
                </button>
              ))}
            </div>
          </div>
        )}

        {assignmentMsg && <p className={`text-sm font-semibold ${assignmentMsg.includes('Updated') ? 'text-[#1a5c38]' : 'text-red-600'}`}>{assignmentMsg}</p>}
        <button type="submit" disabled={assignmentSaving} className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#f5deb3] disabled:opacity-60">
          {assignmentSaving ? 'Saving...' : 'Apply Assignment'}
        </button>
      </form>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setSectionMode(false)} className={`px-4 py-1.5 rounded-2xl border text-sm font-semibold transition-colors ${!sectionMode ? 'bg-[#1a5c38] border-[#1a5c38] text-[#f5deb3]' : 'bg-[#f0d090] border-[#c9a96e]/40 text-[#800020]'}`}>Single / Class</button>
        <button type="button" onClick={() => setSectionMode(true)} className={`px-4 py-1.5 rounded-2xl border text-sm font-semibold transition-colors ${sectionMode ? 'bg-[#1a5c38] border-[#1a5c38] text-[#f5deb3]' : 'bg-[#f0d090] border-[#c9a96e]/40 text-[#800020]'}`}>Bulk by Section</button>
      </div>

      {sectionMode ? (
        <form onSubmit={handleSectionBulk} className="space-y-3">
          <div>
            <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Section Name (e.g. JSS 1)</label>
            <select required value={sectionForm.sectionName} onChange={e => setSectionForm(f => ({ ...f, sectionName: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none">
              <option value="">— Choose Section —</option>
              {[...new Set(classes.map(c => c.name))].sort().map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {sectionForm.sectionName && DEFAULT_SUBJECT_PRESETS[sectionForm.sectionName] && (
              <button type="button"
                onClick={() => setSectionForm(f => ({ ...f, subjectsText: DEFAULT_SUBJECT_PRESETS[sectionForm.sectionName] }))}
                className="mt-1 text-xs font-semibold text-[#1a5c38] underline dark:text-[#00ffff]">
                Load default subjects for {sectionForm.sectionName}
              </button>
            )}
          </div>
          <div>
            <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Subjects (one per line)</label>
            <textarea required value={sectionForm.subjectsText} onChange={e => setSectionForm(f => ({ ...f, subjectsText: e.target.value }))} rows={5}
              className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none"
              placeholder={"Mathematics\nEnglish Language\nBasic Science"} />
          </div>
          <div>
            <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Default Teacher (optional)</label>
            <select value={sectionForm.teacherId} onChange={e => setSectionForm(f => ({ ...f, teacherId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none">
              <option value="">— None —</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {sectionMsg && <p className={`text-sm font-semibold ${sectionMsg.includes('Added') ? 'text-[#1a5c38]' : 'text-red-600'}`}>{sectionMsg}</p>}
          <button type="submit" disabled={sectionSaving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
            {sectionSaving ? 'Adding...' : 'Add to All Section Arms'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Subject Name</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Assign to Class</label>
          <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none">
            <option value="">— None —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Teacher</label>
          <select value={form.teacherId} onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none">
            <option value="">— None —</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">+ Add</button>
      </form>
      )}
      {!sectionMode && error && <p className="text-red-600 text-sm">{error}</p>}

      {groups.length === 0 ? (
        <p className="text-[#800020] dark:text-slate-400 text-sm">No subjects yet.</p>
      ) : groups.map(({ label, subs }) => (
        <div key={label} className="space-y-2">
          <p className="text-sm font-bold text-[#800000] uppercase">{label}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {subs.map(s => (
              <div key={s.id} className="rounded-2xl p-3 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5">
                {editingId === s.id ? (
                  <div className="space-y-2">
                    <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] text-[#191970] px-2 py-1 text-xs" placeholder="Subject name" />
                    <select value={editForm.classId || ''} onChange={e => setEditForm(f => ({ ...f, classId: e.target.value }))}
                      className="w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] text-[#191970] px-2 py-1 text-xs">
                      <option value="">— No Class —</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.arm}</option>)}
                    </select>
                    <select value={editForm.teacherId || ''} onChange={e => setEditForm(f => ({ ...f, teacherId: e.target.value }))}
                      className="w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] text-[#191970] px-2 py-1 text-xs">
                      <option value="">— No Teacher —</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <button onClick={() => handleUpdate(s.id)} disabled={editSaving} className="flex-1 bg-[#1a5c38] text-[#f5deb3] font-bold text-xs py-1 rounded-xl disabled:opacity-60">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[#800020] text-xs px-2">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#800000] text-sm">{s.name}</p>
                      {s.teacherId && <p className="text-xs text-[#191970] mt-0.5">Teacher: <span className="font-semibold">{teacherName(s.teacherId) || s.teacherId}</span></p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingId(s.id); setEditForm({ name: s.name, classId: s.classId || '', teacherId: s.teacherId || '' }); }}
                        className="bg-[#1a5c38] text-[#f5deb3] text-xs px-2 py-1 rounded-xl font-bold">Edit</button>
                      <button onClick={() => handleDelete(s.id, s.name)}
                        className="border border-red-300 text-red-600 text-xs px-2 py-1 rounded-xl font-semibold hover:bg-red-50">Del</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionTab() {
  const [form, setForm] = useState({ session: '', term: 'Term 1', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { getSession().then(d => { if (d?.session) setForm(f => ({ ...f, ...d.session })); }).finally(() => setLoading(false)); }, []);
  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setMsg('');
    try { await saveSession(form); setMsg('Saved!'); } catch (err) { setMsg(err.message); } finally { setSaving(false); }
  }
  if (loading) return <p className="text-[#800020]">Loading...</p>;
  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Current Session (e.g. 2025/2026)</label>
          <input value={form.session || ''} onChange={e => setForm(f => ({ ...f, session: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Current Term</label>
          <div className="flex gap-3 mt-2">
            {['Term 1', 'Term 2', 'Term 3'].map(t => (
              <label key={t} className="flex items-center gap-1 text-sm text-[#191970] dark:text-slate-300 cursor-pointer">
                <input type="radio" name="term" value={t} checked={form.term === t} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} /> {t}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Term Start Date</label>
          <input type="date" value={form.startDate || ''} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Term End Date</label>
          <input type="date" value={form.endDate || ''} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
        </div>
      </div>
      {msg && <p className={`text-sm ${msg === 'Saved!' ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</p>}
      <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-6 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Session'}
      </button>
    </form>
  );
}

export default function OwnerSettings({ auth }) {
  const [tab, setTab] = useState('Profile');
  const tabContent = { Profile: <ProfileTab />, 'School Branding': <BrandingTab />, Website: <WebsiteTab />, Events: <EventsTab />, Classes: <ClassesTab />, Subjects: <SubjectsTab />, 'Sessions & Terms': <SessionTab />, 'Attendance Management': <StaffAttendanceManagementPanel /> };
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Settings</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Manage your profile, branding, classes, academic sessions, and staff attendance policy.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors ${tab === t ? 'bg-[#800020] text-[#f5deb3] border-[#800020]' : 'bg-[#f5deb3] text-[#800020] border-[#c9a96e]/40 dark:bg-slate-900/30 dark:text-slate-400 dark:border-white/10 hover:bg-[#efd4a0]'}`}>{t}</button>
        ))}
      </div>
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {tabContent[tab]}
      </div>
    </div>
  );
}
