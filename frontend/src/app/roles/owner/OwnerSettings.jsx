import React, { useCallback, useEffect, useState, useRef } from 'react';
import { getMe, getClasses, addClass, getSubjects, addSubject, getSession, saveSession, getBranding, saveBranding, uploadLogo, getPeople, bulkAddSubjectsBySection, updateSubject, deleteSubject, updateClass, bulkUpdateClasses, deleteClass } from '../../../features/school/services/schoolApi';
import AdminPasswordReset from '../../../features/auth/components/AdminPasswordReset';
import StaffAttendanceManagementPanel from '../../../features/attendance/components/StaffAttendanceManagementPanel';
import WebsiteTab from './tabs/WebsiteTab';
import EventsTab from './tabs/EventsTab';
import PromotionPanel from './PromotionPanel';

const TABS = ['Profile', 'School Branding', 'Website', 'Events', 'Classes', 'Promotion', 'Subjects', 'Sessions & Terms', 'Attendance Management'];

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
      <div className="rounded-2xl p-5 bg-[#ade1f4] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5">
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
      <div className="rounded-2xl p-5 bg-[#ade1f4] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5">
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
              className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#b5e3f4] font-bold px-5 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
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

      <div className="rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4]/50 p-4 dark:border-white/10 dark:bg-slate-900/20">
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
      <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#b5e3f4] font-bold px-6 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Branding'}
      </button>
    </form>
  );
}

function ClassesTab() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [form, setForm] = useState({ name: '', arm: '', section: '', classTeacherId: '', teacherIds: [], caregiverIds: [] });
  const [drafts, setDrafts] = useState({});
  const [dirtyClassIds, setDirtyClassIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingClassId, setSavingClassId] = useState('');
  const [savingAll, setSavingAll] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickArms, setQuickArms] = useState('A,B,C');
  const [quickSelected, setQuickSelected] = useState([]);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickMsg, setQuickMsg] = useState('');

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
    ]).then(([classData, teacherData, caregiverData]) => {
      const nextClasses = classData?.classes || [];
      setClasses(nextClasses);
      setTeachers(teacherData?.people || []);
      setCaregivers(caregiverData?.people || []);
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

  // Primary class teacher is always teacherIds[0]; the optional assistant/co-teacher is the other entry.
  function assistantIdOf(draft) {
    return (Array.isArray(draft?.teacherIds) ? draft.teacherIds : []).find(id => id && id !== draft.classTeacherId) || '';
  }
  function setPrimaryTeacher(classId, nextTeacherId) {
    updateDraft(classId, current => {
      const assistant = assistantIdOf(current);
      return { ...current, classTeacherId: nextTeacherId, teacherIds: Array.from(new Set([nextTeacherId, assistant].filter(Boolean))) };
    });
  }
  function setAssistantTeacher(classId, nextAssistantId) {
    updateDraft(classId, current => ({
      ...current,
      teacherIds: Array.from(new Set([current.classTeacherId, nextAssistantId].filter(Boolean))),
    }));
  }
  function setCaregiver(classId, nextCaregiverId) {
    updateDraft(classId, current => ({ ...current, caregiverIds: nextCaregiverId ? [nextCaregiverId] : [] }));
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
      setForm({ name: '', arm: '', section: '', classTeacherId: '', teacherIds: [], caregiverIds: [] });
      setStatusMsg('Class created.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
      <div className="rounded-2xl border border-[#c9a96e]/40 bg-[#ade1f4] dark:bg-slate-800/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#800000] dark:text-slate-100">Quick Setup and Save-All</p>
            <p className="text-xs text-[#800020] dark:text-slate-400 mt-1">Build classes fast, assign multiple teachers or caregivers, then save every edited class together.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowQuickSetup(value => !value); setQuickMsg(''); }} className="rounded-2xl border border-[#c9a96e]/40 px-4 py-2 text-xs font-semibold text-[#1a5c38]">
              {showQuickSetup ? 'Hide Quick Setup' : 'Show Quick Setup'}
            </button>
            <button type="button" onClick={handleSaveAll} disabled={savingAll || dirtyClassIds.length === 0} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#b5e3f4] disabled:opacity-60">
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
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${selected ? 'bg-[#1a5c38] text-[#b5e3f4] border-[#1a5c38]' : 'bg-[#b5e3f4] text-[#800020] border-[#c9a96e]/40'}`}
                  >
                    {cls.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Arms</label>
                <input value={quickArms} onChange={e => setQuickArms(e.target.value)} className="mt-1 w-48 rounded-xl border border-[#c9a96e]/40 bg-[#b5e3f4] px-3 py-2 text-sm text-[#191970]" placeholder="A,B,C" />
              </div>
              <button type="button" onClick={handleQuickSetup} disabled={quickSaving || quickSelected.length === 0} className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-60">
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
          <input required value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] px-3 py-2 text-sm text-[#191970]" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Arm</label>
          <input value={form.arm} onChange={e => setForm(current => ({ ...current, arm: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] px-3 py-2 text-sm text-[#191970]" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">School Section</label>
          <select value={form.section} onChange={e => setForm(current => ({ ...current, section: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] px-3 py-2 text-sm text-[#191970]">
            <option value="">Auto-detect from name</option>
            <option value="nursery">Nursery</option>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
          </select>
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
          }} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] px-3 py-2 text-sm text-[#191970]">
            <option value="">— None —</option>
            {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </select>
        </div>
        <div className="xl:col-span-2 flex items-end">
          <button type="submit" disabled={saving} className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-60">
            {saving ? 'Adding...' : 'Add Class'}
          </button>
        </div>
      </form>

      {(error || statusMsg) && <p className={`text-sm ${error ? 'text-red-600' : 'text-[#1a5c38]'}`}>{error || statusMsg}</p>}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {classes.length === 0 ? <p className="text-[#800020] dark:text-slate-400 text-sm">No classes yet.</p> : classes.map(cls => {
          const draft = drafts[cls.id] || buildDraft(cls);
          const assistantId = assistantIdOf(draft);
          const caregiverId = (Array.isArray(draft.caregiverIds) ? draft.caregiverIds : [])[0] || '';
          const isDirty = dirtyClassIds.includes(cls.id);
          const FIELD = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#b5e3f4] dark:bg-slate-800 px-3 py-2 text-sm text-[#191970] dark:text-slate-100';
          const LABEL = 'text-xs font-semibold uppercase text-[#800020] dark:text-slate-300';

          return (
            <div key={cls.id} className={`rounded-2xl p-4 border space-y-3 ${isDirty ? 'border-[#1a5c38] bg-[#ade1f4] dark:bg-slate-800/60' : 'border-[#c9a96e]/30 bg-[#ade1f4] dark:bg-slate-800/40 dark:border-white/5'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={LABEL}>Class Name</label>
                    <input value={draft.name} onChange={e => updateDraft(cls.id, current => ({ ...current, name: e.target.value }))} className={FIELD} />
                  </div>
                  <div>
                    <label className={LABEL}>Arm</label>
                    <input value={draft.arm} onChange={e => updateDraft(cls.id, current => ({ ...current, arm: e.target.value }))} className={FIELD} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isDirty && <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-[11px] font-bold uppercase text-[#b5e3f4]">Unsaved</span>}
                  <button type="button" onClick={() => handleDeleteClass(cls.id, `${cls.name}${cls.arm ? ` ${cls.arm}` : ''}`)} disabled={deletingClassId === cls.id} className="rounded-xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-60">
                    {deletingClassId === cls.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className={LABEL}>Primary Teacher (Class Teacher)</label>
                  <select value={draft.classTeacherId} onChange={e => setPrimaryTeacher(cls.id, e.target.value)} className={FIELD}>
                    <option value="">— None —</option>
                    {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Assistant / Co-Teacher</label>
                  <select value={assistantId} onChange={e => setAssistantTeacher(cls.id, e.target.value)} className={FIELD}>
                    <option value="">— None —</option>
                    {teachers.filter(teacher => teacher.id !== draft.classTeacherId).map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-[#800020] dark:text-slate-400">Has the same rights as the primary teacher.</p>
                </div>
                <div>
                  <label className={LABEL}>Caregiver (optional)</label>
                  <select value={caregiverId} onChange={e => setCaregiver(cls.id, e.target.value)} className={FIELD}>
                    <option value="">— None —</option>
                    {caregivers.map(caregiver => <option key={caregiver.id} value={caregiver.id}>{caregiver.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-[#800020] dark:text-slate-400">Manage this class's subjects in the <span className="font-semibold">Subjects</span> tab.</p>
                <button type="button" onClick={() => handleSaveClass(cls.id)} disabled={savingClassId === cls.id} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-60">
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedClassId, setExpandedClassId] = useState('');
  const [newSubject, setNewSubject] = useState({}); // { [classId]: { name, teacherId } }
  const [savingClassId, setSavingClassId] = useState('');
  const [updatingSubjectId, setUpdatingSubjectId] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [sectionForm, setSectionForm] = useState({ sectionName: '', subjectsText: '', teacherId: '' });
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionMsg, setSectionMsg] = useState('');

  function reload() {
    return Promise.all([getSubjects(), getClasses(), getPeople({ role: 'teacher', limit: 200 })]).then(([sd, cd, pd]) => {
      setSubjects(sd?.subjects || []); setClasses(cd?.classes || []); setTeachers(pd?.people || []);
    });
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  const draftFor = (classId) => newSubject[classId] || { name: '', teacherId: '' };

  async function addSubjectsToClass(classId) {
    const draft = draftFor(classId);
    const names = String(draft.name || '').split(/[\n,]+/).map(value => value.trim()).filter(Boolean);
    if (!names.length) return;
    setSavingClassId(classId); setError('');
    try {
      for (const name of names) {
        // eslint-disable-next-line no-await-in-loop
        await addSubject({ name, classId, teacherId: draft.teacherId || '' });
      }
      await reload();
      setNewSubject(current => ({ ...current, [classId]: { name: '', teacherId: draft.teacherId || '' } }));
    } catch (err) { setError(err.message); } finally { setSavingClassId(''); }
  }

  async function changeSubjectTeacher(subjectId, teacherId) {
    setUpdatingSubjectId(subjectId); setError('');
    try { await updateSubject(subjectId, { teacherId }); await reload(); }
    catch (err) { setError(err.message); } finally { setUpdatingSubjectId(''); }
  }

  async function changeSubjectClass(subjectId, classId) {
    setUpdatingSubjectId(subjectId); setError('');
    try { await updateSubject(subjectId, { classId }); await reload(); }
    catch (err) { setError(err.message); } finally { setUpdatingSubjectId(''); }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove subject "${name}"?`)) return;
    setError('');
    try { await deleteSubject(id); await reload(); } catch (err) { setError(err.message); }
  }

  async function handleSectionBulk(e) {
    e.preventDefault(); setSectionSaving(true); setSectionMsg('');
    try {
      const lines = sectionForm.subjectsText.split('\n').map(l => l.trim()).filter(Boolean);
      if (!sectionForm.sectionName || lines.length === 0) { setSectionMsg('Choose a section and add at least one subject.'); setSectionSaving(false); return; }
      const result = await bulkAddSubjectsBySection(sectionForm.sectionName, lines, sectionForm.teacherId || null);
      if (result?.success) { setSectionMsg(`Added ${result.added} subject(s) across ${result.classCount} class(es).`); await reload(); setSectionForm({ sectionName: '', subjectsText: '', teacherId: '' }); }
      else setSectionMsg(result?.error || 'Could not add subjects.');
    } catch (err) { setSectionMsg(err.message); } finally { setSectionSaving(false); }
  }

  if (loading) return <p className="text-[#800020] dark:text-slate-300">Loading...</p>;

  const classLabel = (cls) => `${cls.name}${cls.arm ? ` ${cls.arm}` : ''}`;
  const unassigned = subjects.filter(s => !s.classId);

  const TEACHER_SELECT = 'rounded-xl border border-[#c9a96e]/40 bg-[#b5e3f4] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-2 py-1 text-xs';

  function renderClassPanel(cls) {
    const classSubjects = subjects.filter(s => s.classId === cls.id);
    const open = expandedClassId === cls.id;
    const draft = draftFor(cls.id);
    return (
      <div key={cls.id} className="rounded-2xl border border-[#c9a96e]/40 dark:border-white/10 overflow-hidden">
        <button type="button" onClick={() => setExpandedClassId(open ? '' : cls.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#ade1f4] dark:bg-slate-800/40 text-left">
          <span className="font-bold text-[#800000] dark:text-slate-100">{classLabel(cls)}</span>
          <span className="flex items-center gap-2 text-xs font-semibold text-[#800020] dark:text-slate-300">
            {classSubjects.length} subject{classSubjects.length === 1 ? '' : 's'}
            <span aria-hidden>{open ? '▲' : '▼'}</span>
          </span>
        </button>
        {open && (
          <div className="p-4 space-y-3 bg-[#b5e3f4] dark:bg-slate-900/30">
            {classSubjects.length === 0 ? (
              <p className="text-sm text-[#800020] dark:text-slate-400">No subjects yet. Add the first one below.</p>
            ) : (
              <div className="space-y-2">
                {classSubjects.map(s => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#c9a96e]/30 dark:border-white/5 bg-[#ade1f4] dark:bg-slate-800/40 px-3 py-2">
                    <span className="flex-1 min-w-[120px] font-semibold text-[#191970] dark:text-slate-100">{s.name}</span>
                    <select value={s.teacherId || ''} disabled={updatingSubjectId === s.id} onChange={e => changeSubjectTeacher(s.id, e.target.value)} className={TEACHER_SELECT}>
                      <option value="">— No teacher —</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button type="button" onClick={() => handleDelete(s.id, s.name)} className="rounded-xl border border-red-300 text-red-600 text-xs px-2 py-1 font-semibold hover:bg-red-50 dark:hover:bg-red-500/10">Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-[#c9a96e]/50 dark:border-white/10 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-300">Add subject(s) to {classLabel(cls)}</p>
              <textarea value={draft.name} onChange={e => setNewSubject(current => ({ ...current, [cls.id]: { ...draft, name: e.target.value } }))} rows={2} placeholder={'One subject per line, e.g.\nMathematics\nEnglish Language'} className="w-full rounded-xl border border-[#c9a96e]/40 bg-white dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
              <div className="flex flex-wrap items-center gap-2">
                <select value={draft.teacherId} onChange={e => setNewSubject(current => ({ ...current, [cls.id]: { ...draft, teacherId: e.target.value } }))} className="rounded-xl border border-[#c9a96e]/40 bg-[#b5e3f4] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-2 py-1 text-sm">
                  <option value="">— Teacher (optional) —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" onClick={() => addSubjectsToClass(cls.id)} disabled={savingClassId === cls.id} className="rounded-xl bg-[#1a5c38] text-[#b5e3f4] font-bold px-4 py-1.5 text-sm disabled:opacity-60">
                  {savingClassId === cls.id ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#ade1f4] dark:bg-slate-800/40 p-4">
        <p className="text-sm font-bold text-[#800000] dark:text-slate-100">Subjects by class</p>
        <p className="text-xs text-[#800020] dark:text-slate-400 mt-1">Open a class to see its subjects, add new ones, and pick the teacher for each. Only one class is open at a time.</p>
      </div>

      {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

      <div className="space-y-2">
        {classes.length === 0 ? (
          <p className="text-[#800020] dark:text-slate-400 text-sm">No classes yet. Create classes in the Classes tab first.</p>
        ) : classes.map(renderClassPanel)}

        {unassigned.length > 0 && (
          <div className="rounded-2xl border border-[#c9a96e]/40 dark:border-white/10 overflow-hidden">
            <button type="button" onClick={() => setExpandedClassId(expandedClassId === '__unassigned' ? '' : '__unassigned')} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#ade1f4] dark:bg-slate-800/40 text-left">
              <span className="font-bold text-[#800000] dark:text-slate-100">Subjects not yet in a class</span>
              <span className="flex items-center gap-2 text-xs font-semibold text-[#800020] dark:text-slate-300">{unassigned.length}<span aria-hidden>{expandedClassId === '__unassigned' ? '▲' : '▼'}</span></span>
            </button>
            {expandedClassId === '__unassigned' && (
              <div className="p-4 space-y-2 bg-[#b5e3f4] dark:bg-slate-900/30">
                {unassigned.map(s => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#c9a96e]/30 dark:border-white/5 bg-[#ade1f4] dark:bg-slate-800/40 px-3 py-2">
                    <span className="flex-1 min-w-[120px] font-semibold text-[#191970] dark:text-slate-100">{s.name}</span>
                    <select value="" disabled={updatingSubjectId === s.id} onChange={e => e.target.value && changeSubjectClass(s.id, e.target.value)} className={TEACHER_SELECT}>
                      <option value="">Move to class…</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                    </select>
                    <button type="button" onClick={() => handleDelete(s.id, s.name)} className="rounded-xl border border-red-300 text-red-600 text-xs px-2 py-1 font-semibold hover:bg-red-50 dark:hover:bg-red-500/10">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced: add a whole section's subjects at once (collapsed by default) */}
      <div className="rounded-2xl border border-[#c9a96e]/40 dark:border-white/10 overflow-hidden">
        <button type="button" onClick={() => setShowBulk(v => !v)} className="w-full text-left px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:text-[#00ffff] bg-[#ade1f4]/60 dark:bg-slate-800/40">
          {showBulk ? 'Hide bulk setup' : 'Bulk setup — add the same subjects to every arm of a section (optional)'}
        </button>
        {showBulk && (
          <form onSubmit={handleSectionBulk} className="p-4 space-y-3 bg-[#b5e3f4] dark:bg-slate-900/30">
            <div>
              <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Section (e.g. JSS 1)</label>
              <select required value={sectionForm.sectionName} onChange={e => setSectionForm(f => ({ ...f, sectionName: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none">
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
                className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none"
                placeholder={"Mathematics\nEnglish Language\nBasic Science"} />
            </div>
            <div>
              <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Default Teacher (optional)</label>
              <select value={sectionForm.teacherId} onChange={e => setSectionForm(f => ({ ...f, teacherId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none">
                <option value="">— None —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {sectionMsg && <p className={`text-sm font-semibold ${sectionMsg.includes('Added') ? 'text-[#1a5c38]' : 'text-red-600'}`}>{sectionMsg}</p>}
            <button type="submit" disabled={sectionSaving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#b5e3f4] font-bold px-5 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
              {sectionSaving ? 'Adding...' : 'Add to All Section Arms'}
            </button>
          </form>
        )}
      </div>
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
          <input value={form.session || ''} onChange={e => setForm(f => ({ ...f, session: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
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
          <input type="date" value={form.startDate || ''} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Term End Date</label>
          <input type="date" value={form.endDate || ''} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#ade1f4] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
        </div>
      </div>
      {msg && <p className={`text-sm ${msg === 'Saved!' ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</p>}
      <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#b5e3f4] font-bold px-6 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Session'}
      </button>
    </form>
  );
}

export default function OwnerSettings({ auth }) {
  const [tab, setTab] = useState('Profile');
  const tabContent = { Profile: <ProfileTab />, 'School Branding': <BrandingTab />, Website: <WebsiteTab />, Events: <EventsTab />, Classes: <ClassesTab />, Promotion: <PromotionPanel />, Subjects: <SubjectsTab />, 'Sessions & Terms': <SessionTab />, 'Attendance Management': <StaffAttendanceManagementPanel /> };
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Settings</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Manage your profile, branding, classes, academic sessions, and staff attendance policy.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors ${tab === t ? 'bg-[#800020] text-[#b5e3f4] border-[#800020]' : 'bg-[#b5e3f4] text-[#800020] border-[#c9a96e]/40 dark:bg-slate-900/30 dark:text-slate-400 dark:border-white/10 hover:bg-[#efd4a0]'}`}>{t}</button>
        ))}
      </div>
      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {tabContent[tab]}
      </div>
    </div>
  );
}
