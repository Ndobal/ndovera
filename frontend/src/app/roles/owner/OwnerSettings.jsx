import React, { useEffect, useState } from 'react';
import { getMe, getClasses, addClass, getSubjects, addSubject, getSession, saveSession, getBranding, saveBranding, getPeople } from '../../../features/school/services/schoolApi';
import AdminPasswordReset from '../../../features/auth/components/AdminPasswordReset';

const TABS = ['Profile', 'School Branding', 'Classes', 'Subjects', 'Sessions & Terms'];

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
  const [form, setForm] = useState({ schoolName: '', tagline: '', website: '', logoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    getBranding().then(d => { if (d?.branding) setForm(f => ({ ...f, ...d.branding })); }).finally(() => setLoading(false));
  }, []);
  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setMsg('');
    try { await saveBranding(form); setMsg('Saved!'); } catch (err) { setMsg(err.message); } finally { setSaving(false); }
  }
  if (loading) return <p className="text-[#800020]">Loading...</p>;
  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-xs text-[#800020] dark:text-slate-400">Your logo and branding appear in the Ndovera school directory.</p>
      {[['School Name', 'schoolName'], ['Tagline', 'tagline'], ['Website URL', 'website'], ['Logo URL', 'logoUrl']].map(([label, key]) => (
        <div key={key}>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">{label}</label>
          <input
            value={form[key] || ''}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
          />
        </div>
      ))}
      {form.logoUrl && <img src={form.logoUrl} alt="Logo preview" className="h-16 rounded-xl object-contain border border-[#c9a96e]/40" />}
      {msg && <p className={`text-sm ${msg === 'Saved!' ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</p>}
      <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-6 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Branding'}
      </button>
    </form>
  );
}

function ClassesTab() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ name: '', arm: '', classTeacherId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([getClasses(), getPeople()]).then(([cd, pd]) => {
      setClasses(cd?.classes || []); setTeachers((pd?.people || []).filter(p => ['teacher', 'classteacher'].includes(p.role)));
    }).finally(() => setLoading(false));
  }, []);
  async function handleAdd(e) {
    e.preventDefault(); if (!form.name) return; setSaving(true); setError('');
    try { await addClass(form); const d = await getClasses(); setClasses(d?.classes || []); setForm({ name: '', arm: '', classTeacherId: '' }); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  if (loading) return <p className="text-[#800020]">Loading...</p>;
  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
        {[['Class Name', 'name', 'text', true], ['Arm/Section', 'arm', 'text', false]].map(([label, key, type, req]) => (
          <div key={key} className="flex-1 min-w-[140px]">
            <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">{label}</label>
            <input required={req} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
          </div>
        ))}
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Class Teacher</label>
          <select value={form.classTeacherId} onChange={e => setForm(f => ({ ...f, classTeacherId: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none">
            <option value="">— None —</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">+ Add</button>
      </form>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {classes.length === 0 ? <p className="text-[#800020] dark:text-slate-400 text-sm">No classes yet.</p> : classes.map(c => (
          <div key={c.id} className="rounded-2xl p-4 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5">
            <p className="font-bold text-[#800000] dark:text-slate-100">{c.name} {c.arm && `(${c.arm})`}</p>
            {c.classTeacherId && <p className="text-xs text-[#800020] dark:text-slate-400 mt-1">Teacher: {c.classTeacherId}</p>}
          </div>
        ))}
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
  useEffect(() => {
    Promise.all([getSubjects(), getClasses(), getPeople()]).then(([sd, cd, pd]) => {
      setSubjects(sd?.subjects || []); setClasses(cd?.classes || []);
      setTeachers((pd?.people || []).filter(p => p.role === 'teacher'));
    }).finally(() => setLoading(false));
  }, []);
  async function handleAdd(e) {
    e.preventDefault(); if (!form.name) return; setSaving(true); setError('');
    try { await addSubject(form); const d = await getSubjects(); setSubjects(d?.subjects || []); setForm({ name: '', classId: '', teacherId: '' }); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  if (loading) return <p className="text-[#800020]">Loading...</p>;
  return (
    <div className="space-y-4">
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
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {subjects.length === 0 ? <p className="text-[#800020] dark:text-slate-400 text-sm">No subjects yet.</p> : subjects.map(s => (
          <div key={s.id} className="rounded-2xl p-4 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5">
            <p className="font-bold text-[#800000] dark:text-slate-100">{s.name}</p>
          </div>
        ))}
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
  const tabContent = { Profile: <ProfileTab />, 'School Branding': <BrandingTab />, Classes: <ClassesTab />, Subjects: <SubjectsTab />, 'Sessions & Terms': <SessionTab /> };
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Settings</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Manage your profile, branding, classes, and academic sessions.</p>
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
