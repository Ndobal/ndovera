import React, { useEffect, useState, useRef } from 'react';
import { getMe, getClasses, addClass, getSubjects, addSubject, getSession, saveSession, getBranding, saveBranding, uploadLogo, getPeople, bulkAddSubjects, updateSubject, deleteSubject, updateClass } from '../../../features/school/services/schoolApi';
import AdminPasswordReset from '../../../features/auth/components/AdminPasswordReset';
import WebsiteTab from './tabs/WebsiteTab';
import EventsTab from './tabs/EventsTab';

const TABS = ['Profile', 'School Branding', 'Website', 'Events', 'Classes', 'Subjects', 'Sessions & Terms'];

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
      <p className="text-xs text-[#800020] dark:text-slate-400">Your logo and branding appear in the Ndovera school directory.</p>

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
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({ name: '', arm: '', classTeacherId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // bulk add subjects per class
  const [bulkClassId, setBulkClassId] = useState(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');
  // edit class teacher
  const [editingClassId, setEditingClassId] = useState(null);
  const [editTeacherId, setEditTeacherId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  function reload() {
    return Promise.all([getClasses(), getPeople(), getSubjects()]).then(([cd, pd, sd]) => {
      setClasses(cd?.classes || []);
      setTeachers((pd?.people || []).filter(p => ['teacher', 'classteacher'].includes(p.role)));
      setSubjects(sd?.subjects || []);
    });
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  async function handleAdd(e) {
    e.preventDefault(); if (!form.name) return; setSaving(true); setError('');
    try { await addClass(form); await reload(); setForm({ name: '', arm: '', classTeacherId: '' }); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleBulkAdd(classId) {
    if (!bulkText.trim()) return;
    setBulkSaving(true); setBulkMsg('');
    try {
      const lines = bulkText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const result = await bulkAddSubjects(classId, { subjects: lines });
      setBulkMsg(`Added ${result.added} subject(s)!`);
      setBulkText('');
      await reload();
    } catch (err) { setBulkMsg(err.message); }
    finally { setBulkSaving(false); }
  }

  async function handleUpdateTeacher(classId) {
    setEditSaving(true);
    try { await updateClass(classId, { classTeacherId: editTeacherId }); await reload(); setEditingClassId(null); }
    catch {} finally { setEditSaving(false); }
  }

  function teacherName(id) {
    if (!id) return null;
    const t = teachers.find(t => t.id === id);
    return t ? t.name : id;
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
        {classes.length === 0 ? <p className="text-[#800020] dark:text-slate-400 text-sm">No classes yet.</p> : classes.map(cls => {
          const classSubjects = subjects.filter(s => s.classId === cls.id);
          return (
            <div key={cls.id} className="rounded-2xl p-4 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5 space-y-2">
              <p className="font-bold text-[#800000] dark:text-slate-100 text-base">{cls.name} {cls.arm && `(${cls.arm})`}</p>

              {/* Class teacher */}
              {editingClassId === cls.id ? (
                <div className="flex gap-1 items-center">
                  <select value={editTeacherId} onChange={e => setEditTeacherId(e.target.value)} className="flex-1 rounded-lg border border-[#c9a96e]/40 bg-[#f5deb3] text-[#191970] px-2 py-1 text-xs">
                    <option value="">— None —</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={() => handleUpdateTeacher(cls.id)} disabled={editSaving} className="bg-[#1a5c38] text-[#f5deb3] text-xs px-2 py-1 rounded-lg font-bold disabled:opacity-60">Save</button>
                  <button onClick={() => setEditingClassId(null)} className="text-[#800020] text-xs px-1">✕</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs text-[#800020] dark:text-slate-400">
                    Teacher: <span className="text-[#191970] font-semibold">{teacherName(cls.classTeacherId) || '—'}</span>
                  </p>
                  <button onClick={() => { setEditingClassId(cls.id); setEditTeacherId(cls.classTeacherId || ''); }} className="text-xs text-[#1a5c38] font-semibold hover:underline">Edit</button>
                </div>
              )}

              {/* Subjects list */}
              {classSubjects.length > 0 && (
                <div>
                  <p className="text-xs text-[#800020] font-semibold uppercase mb-1">Subjects ({classSubjects.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {classSubjects.map(s => (
                      <span key={s.id} className="text-xs bg-[#f5deb3] text-[#191970] border border-[#c9a96e]/40 px-2 py-0.5 rounded-full">{s.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Bulk add subjects */}
              {bulkClassId === cls.id ? (
                <div className="space-y-1">
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder="Enter subjects (comma-separated or one per line)..."
                    rows={3}
                    className="w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] text-[#191970] px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#1a5c38] resize-none"
                  />
                  {bulkMsg && <p className={`text-xs ${bulkMsg.includes('!') ? 'text-emerald-700' : 'text-red-600'}`}>{bulkMsg}</p>}
                  <div className="flex gap-1">
                    <button onClick={() => handleBulkAdd(cls.id)} disabled={bulkSaving} className="flex-1 bg-[#1a5c38] text-[#f5deb3] font-bold text-xs py-1.5 rounded-xl disabled:opacity-60">
                      {bulkSaving ? 'Adding...' : 'Add Subjects'}
                    </button>
                    <button onClick={() => { setBulkClassId(null); setBulkText(''); setBulkMsg(''); }} className="text-xs text-[#800020] px-2">✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setBulkClassId(cls.id); setBulkMsg(''); }} className="w-full text-xs bg-[#f5deb3] border border-[#c9a96e]/40 text-[#1a5c38] font-bold py-1.5 rounded-xl hover:bg-[#efd4a0] transition-colors">
                  📚 Bulk Add Subjects
                </button>
              )}
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

  function reload() {
    return Promise.all([getSubjects(), getClasses(), getPeople()]).then(([sd, cd, pd]) => {
      setSubjects(sd?.subjects || []); setClasses(cd?.classes || []);
      setTeachers((pd?.people || []).filter(p => ['teacher', 'classteacher'].includes(p.role)));
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
  const tabContent = { Profile: <ProfileTab />, 'School Branding': <BrandingTab />, Website: <WebsiteTab />, Events: <EventsTab />, Classes: <ClassesTab />, Subjects: <SubjectsTab />, 'Sessions & Terms': <SessionTab /> };
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
