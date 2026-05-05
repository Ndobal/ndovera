import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getPeople, addPerson, deactivatePerson, updatePersonRole,
  getClasses, getParents, getUserProfile, updateUserProfile, linkParentStudent,
} from '../../../features/school/services/schoolApi';

const ROLES = ['teacher', 'hos', 'accountant', 'student', 'parent', 'librarian', 'classteacher', 'hod', 'principal', 'growthpartner'];
const FILTERS = ['All', 'Teachers', 'Admin', 'Students', 'Parents'];

function filterPeople(people, filter) {
  if (filter === 'Teachers') return people.filter(p => p.role === 'teacher');
  if (filter === 'Admin') return people.filter(p => ['owner', 'hos', 'accountant', 'principal', 'hod'].includes(p.role));
  if (filter === 'Students') return people.filter(p => p.role === 'student');
  if (filter === 'Parents') return people.filter(p => p.role === 'parent');
  return people;
}

function UserProfileModal({ userId, onClose, isAdmin, currentUserId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  // second parent linking
  const [showLinkParent, setShowLinkParent] = useState(false);
  const [allParents, setAllParents] = useState([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkParentId, setLinkParentId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const [classes, setClasses] = useState([]);

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError('');
    getUserProfile(userId)
      .then(data => {
        const u = data?.user || null;
        setProfile(u);
        setEditForm({ name: u?.name || '', phone: u?.phone || '', classId: u?.classId || '' });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
    getParents().then(d => setAllParents(d?.parents || [])).catch(() => {});
    getClasses().then(d => setClasses(d?.classes || [])).catch(() => {});
  }, [load]);

  async function handleSave() {
    setSaving(true); setSaveMsg('');
    try {
      await updateUserProfile(userId, { name: editForm.name, phone: editForm.phone, classId: editForm.classId || undefined });
      setSaveMsg('Saved!');
      setEditing(false);
      load();
    } catch (err) { setSaveMsg(err.message); }
    finally { setSaving(false); }
  }

  async function handleLinkParent() {
    if (!linkParentId) return;
    setLinking(true); setLinkMsg('');
    try {
      await linkParentStudent({ parentId: linkParentId, studentId: userId });
      setLinkMsg('Parent linked!');
      setShowLinkParent(false);
      load();
    } catch (err) { setLinkMsg(err.message); }
    finally { setLinking(false); }
  }

  const filteredForLink = allParents.filter(p =>
    !linkSearch
    || p.name?.toLowerCase().includes(linkSearch.toLowerCase())
    || p.email?.toLowerCase().includes(linkSearch.toLowerCase())
    || p.phone?.toLowerCase().includes(linkSearch.toLowerCase())
    || p.displayId?.toLowerCase().includes(linkSearch.toLowerCase())
  );

  const canEdit = isAdmin || currentUserId === userId;
  const linkedParentsCount = profile?.linkedParents?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900 border border-[#c9a96e]/40 dark:border-white/10 shadow-xl overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#800000] dark:text-slate-100">User Profile</h2>
          <div className="flex gap-2 items-center">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="bg-[#1a5c38] text-[#f5deb3] font-bold text-xs px-3 py-1.5 rounded-xl">Edit</button>
            )}
            <button onClick={onClose} className="text-[#800020] dark:text-slate-400 text-xl font-bold hover:text-red-600">✕</button>
          </div>
        </div>

        {loading && <p className="text-[#800020] dark:text-slate-400 text-sm">Loading...</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {profile && (
          <div className="space-y-4">
            {profile.displayId && (
              <div className="inline-block px-3 py-1 rounded-full bg-[#800000] text-[#f5deb3] text-xs font-bold tracking-widest">
                {profile.displayId}
              </div>
            )}

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-[#800020]">Name</label>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] text-[#191970] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-[#800020]">Phone</label>
                  <input
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] text-[#191970] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-[#800020]">Email (cannot change)</label>
                  <input value={profile.email} disabled className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#e8c878]/60 text-[#191970]/60 px-3 py-2 text-sm cursor-not-allowed" />
                </div>
                {isAdmin && profile.role === 'student' && (
                  <div>
                    <label className="text-xs font-semibold uppercase text-[#800020]">Class</label>
                    <select
                      value={editForm.classId}
                      onChange={e => setEditForm(f => ({ ...f, classId: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f0d090] text-[#191970] px-3 py-2 text-sm outline-none"
                    >
                      <option value="">— Select Class —</option>
                      {classes.map(cl => <option key={cl.id} value={cl.id}>{cl.name}{cl.arm ? ` ${cl.arm}` : ''}</option>)}
                    </select>
                  </div>
                )}
                {saveMsg && <p className={`text-sm ${saveMsg === 'Saved!' ? 'text-emerald-600' : 'text-red-600'}`}>{saveMsg}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditing(false)} className="flex-1 border border-[#c9a96e]/40 text-[#800020] px-4 py-2 rounded-2xl text-sm font-semibold">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#1a5c38] text-[#f5deb3] font-bold px-4 py-2 rounded-2xl text-sm disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['User ID', profile.displayId],
                  ['Name', profile.name],
                  ['Email', profile.email],
                  ['Phone', profile.phone],
                  ['Role', profile.role],
                  ['Status', profile.status || 'active'],
                  ['Created', profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">{label}</p>
                    <p className="text-sm text-[#191970] dark:text-slate-200 capitalize">{value || '—'}</p>
                  </div>
                ))}
              </div>
            )}

            {!editing && (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400 mb-2">School Record</p>
                  <div className="rounded-2xl bg-[#f0d090] dark:bg-slate-800 px-4 py-3 text-sm text-[#191970] dark:text-slate-200">
                    {profile.currentClass
                      ? `Current class: ${profile.currentClass.name}${profile.currentClass.arm ? ` ${profile.currentClass.arm}` : ''}`
                      : 'No class record assigned yet.'}
                  </div>
                </div>

                {profile.role === 'student' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">
                        Linked Parents ({linkedParentsCount}/2)
                      </p>
                      {linkedParentsCount < 2 && (
                        <button
                          onClick={() => setShowLinkParent(v => !v)}
                          className="bg-[#1a5c38] text-[#f5deb3] font-bold text-xs px-3 py-1 rounded-xl"
                        >
                          + Link Parent
                        </button>
                      )}
                    </div>

                    {profile.linkedParents?.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {profile.linkedParents.map(p => (
                          <div key={p.id} className="text-sm text-[#191970] dark:text-slate-200 bg-[#f0d090] dark:bg-slate-800 rounded-xl px-3 py-1.5 flex justify-between">
                            <span>{p.name}</span>
                            <span className="text-[#800020] text-xs">{p.email || p.phone || ''}{p.displayId ? ` · ${p.displayId}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {showLinkParent && (
                      <div className="rounded-2xl bg-[#f0d090] dark:bg-slate-800 px-4 py-3 space-y-2">
                        <input
                          type="text"
                          placeholder="Search parent by name/email/phone…"
                          value={linkSearch}
                          onChange={e => setLinkSearch(e.target.value)}
                          className="w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] text-[#191970] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
                        />
                        <select
                          value={linkParentId}
                          onChange={e => setLinkParentId(e.target.value)}
                          className="w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] text-[#191970] px-3 py-2 text-sm outline-none"
                        >
                          <option value="">— Select Parent —</option>
                          {filteredForLink.map(p => (
                            <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ''}{p.displayId ? ` · ${p.displayId}` : ''}</option>
                          ))}
                        </select>
                        {linkMsg && <p className={`text-xs ${linkMsg.includes('!') ? 'text-emerald-600' : 'text-red-600'}`}>{linkMsg}</p>}
                        <button
                          onClick={handleLinkParent}
                          disabled={linking || !linkParentId}
                          className="w-full bg-[#1a5c38] text-[#f5deb3] font-bold py-2 rounded-xl text-sm disabled:opacity-60"
                        >
                          {linking ? 'Linking…' : 'Link Parent'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {profile.role === 'parent' && profile.linkedChildren?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400 mb-2">Children</p>
                    <div className="space-y-1">
                      {profile.linkedChildren.map(c => (
                        <div key={c.id} className="text-sm text-[#191970] dark:text-slate-200 bg-[#f0d090] dark:bg-slate-800 rounded-xl px-3 py-1.5">
                          {c.name}{c.displayId ? <span className="text-[#800020] font-mono text-xs ml-1">{c.displayId}</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.recentAttendance?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400 mb-2">Recent Attendance (last 5)</p>
                    <div className="space-y-1">
                      {profile.recentAttendance.slice(0, 5).map((a, i) => (
                        <div key={i} className="text-xs text-[#191970] dark:text-slate-200 flex justify-between bg-[#f0d090] dark:bg-slate-800 rounded-xl px-3 py-1">
                          <span>{a.date}</span>
                          <span className={a.status === 'present' ? 'text-emerald-600' : 'text-red-500'}>{a.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.activity?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400 mb-2">Recent Activity</p>
                    <div className="space-y-1">
                      {profile.activity.slice(0, 5).map(item => (
                        <div key={item.id || `${item.action}-${item.ts}`} className="rounded-xl bg-[#f0d090] dark:bg-slate-800 px-3 py-2">
                          <p className="text-sm font-semibold text-[#800000] dark:text-slate-100">{item.action || 'Record'}</p>
                          <p className="text-xs text-[#191970] dark:text-slate-300">{item.ts ? new Date(item.ts).toLocaleString() : '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddPersonModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    name: '', email: '', role: 'teacher', password: '',
    parentOption: 'new',
    existingParentId: '',
    parentName: '', parentEmail: '', parentPhone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [classes, setClasses] = useState([]);
  const [parents, setParents] = useState([]);
  const [parentSearch, setParentSearch] = useState('');
  const [classId, setClassId] = useState('');

  useEffect(() => {
    getClasses().then(d => setClasses(d?.classes || [])).catch(() => {});
    getParents().then(d => setParents(d?.parents || [])).catch(() => {});
  }, []);

  const filteredParents = parents.filter(p =>
    !parentSearch
    || p.name?.toLowerCase().includes(parentSearch.toLowerCase())
    || p.email?.toLowerCase().includes(parentSearch.toLowerCase())
    || p.phone?.toLowerCase().includes(parentSearch.toLowerCase())
    || p.displayId?.toLowerCase().includes(parentSearch.toLowerCase())
    || p.id?.toLowerCase().includes(parentSearch.toLowerCase())
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (form.role === 'student' && classes.length === 0) {
        throw new Error('Create a class in Settings before adding a student.');
      }
      if (form.role === 'student' && !classId) {
        throw new Error('Select a class for the student before creating the account.');
      }
      const payload = { name: form.name, email: form.email, role: form.role, password: form.password || undefined };
      if (form.role === 'student') {
        payload.classId = classId || undefined;
        if (form.parentOption === 'existing' && form.existingParentId) {
          payload.parentData = { existingParentId: form.existingParentId };
        } else if (form.parentOption === 'new' && (form.parentName || form.parentEmail)) {
          payload.parentData = {
            name: form.parentName || undefined,
            email: form.parentEmail || undefined,
            phone: form.parentPhone || undefined,
          };
        }
      }
      await onAdd(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900 border border-[#c9a96e]/40 dark:border-white/10 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-[#800000] dark:text-slate-100 mb-4">Add Person</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[['Name', 'name', 'text'], ['Email', 'email', 'email'], ['Password', 'password', 'password']].map(([label, key, type]) => (
            <div key={key}>
              <label className="text-xs text-[#800020] dark:text-slate-400 font-semibold uppercase">{label}{key === 'password' && ' (optional)'}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={key !== 'password'}
                className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
              />
              {key === 'password' && (
                <p className="mt-1 text-[11px] text-[#800020] dark:text-slate-400">
                  Leave blank to use the default password <span className="font-bold">abcABC@123</span>. The user must change it on first sign in.
                </p>
              )}
            </div>
          ))}

          <div>
            <label className="text-xs text-[#800020] dark:text-slate-400 font-semibold uppercase">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {form.role === 'student' && (
            <>
              <div>
                <label className="text-xs text-[#800020] dark:text-slate-400 font-semibold uppercase">Class</label>
                {classes.length === 0 ? (
                  <div className="mt-1 rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
                    No classes found. <Link to="/roles/owner/settings" className="underline font-semibold">Create classes in Settings → Classes first.</Link>
                  </div>
                ) : (
                  <select
                    value={classId}
                    onChange={e => setClassId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none"
                  >
                    <option value="">— Select Class —</option>
                    {classes.map(cl => <option key={cl.id} value={cl.id}>{cl.name}{cl.arm ? ` ${cl.arm}` : ''}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs text-[#800020] dark:text-slate-400 font-semibold uppercase mb-1 block">Parent</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, parentOption: 'existing' }))}
                    className={`flex-1 text-xs py-1.5 rounded-xl font-semibold border transition-colors ${form.parentOption === 'existing' ? 'bg-[#800020] text-[#f5deb3] border-[#800020]' : 'bg-[#f0d090] text-[#800020] border-[#c9a96e]/40'}`}
                  >
                    Link Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, parentOption: 'new' }))}
                    className={`flex-1 text-xs py-1.5 rounded-xl font-semibold border transition-colors ${form.parentOption === 'new' ? 'bg-[#800020] text-[#f5deb3] border-[#800020]' : 'bg-[#f0d090] text-[#800020] border-[#c9a96e]/40'}`}
                  >
                    Add New Parent
                  </button>
                </div>

                {form.parentOption === 'existing' && (
                  <div>
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={parentSearch}
                      onChange={e => setParentSearch(e.target.value)}
                      className="w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38] mb-1"
                    />
                    <select
                      value={form.existingParentId}
                      onChange={e => setForm(f => ({ ...f, existingParentId: e.target.value }))}
                      className="w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none"
                    >
                      <option value="">— Select Parent —</option>
                      {filteredParents.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.email ? `(${p.email})` : ''}{p.phone ? ` · ${p.phone}` : ''}{p.displayId ? ` · ${p.displayId}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {form.parentOption === 'new' && (
                  <div className="space-y-2">
                    {[['Parent Name', 'parentName', 'text'], ['Parent Email', 'parentEmail', 'email'], ['Parent Phone', 'parentPhone', 'tel']].map(([label, key, type]) => (
                      <div key={key}>
                        <label className="text-xs text-[#800020] dark:text-slate-400 font-semibold uppercase">{label} (optional)</label>
                        <input
                          type={type}
                          value={form[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[#c9a96e]/40 dark:border-white/10 text-[#800020] dark:text-slate-400 px-4 py-2 rounded-2xl text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-4 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : 'Add Person'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OwnerPeople() {
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [changingRole, setChangingRole] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [profileUserId, setProfileUserId] = useState(null);

  // get current user info for edit-own-profile logic
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('authUser') || '{}'); } catch { return {}; } })();
  const currentUserId = currentUser?.id || '';
  const isAdmin = ['owner', 'hos'].includes(currentUser?.role);

  function load() {
    setLoading(true);
    getPeople()
      .then(data => setPeople(data?.people || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAdd(form) {
    await addPerson(form);
    load();
  }

  async function handleDeactivate(person) {
    if (!window.confirm(`Deactivate ${person.name}?`)) return;
    await deactivatePerson(person.id);
    load();
  }

  async function handleRoleChange(person) {
    if (!newRole || newRole === person.role) { setChangingRole(null); return; }
    await updatePersonRole(person.id, newRole);
    setChangingRole(null);
    load();
  }

  const q = search.trim().toLowerCase();
  const filtered = filterPeople(people, filter).filter(p => {
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q)
      || p.email?.toLowerCase().includes(q)
      || p.phone?.toLowerCase().includes(q)
      || p.displayId?.toLowerCase().includes(q)
      || p.role?.toLowerCase().includes(q)
      || p.id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {showAdd && <AddPersonModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
        />
      )}

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">People</h1>
          <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Manage students, parents, and school staff with live profile records.</p>
        </div>
        <button onClick={() => setShowAdd(true)} aria-label="Add person" className="shrink-0 h-12 w-12 flex items-center justify-center bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold rounded-2xl text-2xl leading-none transition-colors">+</button>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, user ID…"
          className="flex-1 rounded-2xl border border-[#c9a96e]/40 bg-[#f5deb3] dark:bg-slate-900/30 text-[#191970] dark:text-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38] placeholder:text-[#800020]/50"
        />
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors ${filter === f ? 'bg-[#800020] text-[#f5deb3] border-[#800020]' : 'bg-[#f5deb3] text-[#800020] border-[#c9a96e]/40 dark:bg-slate-900/30 dark:text-slate-400 dark:border-white/10 hover:bg-[#efd4a0]'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {loading ? (
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        ) : error ? (
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-[#800020] dark:text-slate-400">
            {q ? `No results for "${search}".` : 'No people found. Click + to add students, parents, or staff.'}
          </p>
        ) : (
          <>
            <p className="text-xs text-[#800020] dark:text-slate-400 mb-4 font-semibold uppercase">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#c9a96e]/40 dark:border-white/10">
                    {['ID', 'Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-[#800020] dark:text-slate-400 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-[#c9a96e]/20 dark:border-white/5">
                      <td className="py-2 pr-4">
                        {p.displayId && (
                          <span className="font-mono text-xs text-[#800000] dark:text-slate-400 bg-[#f0d090] dark:bg-slate-800 px-2 py-0.5 rounded-full">{p.displayId}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          onClick={() => setProfileUserId(p.id)}
                          className="text-[#800020] underline cursor-pointer hover:text-[#800000] font-medium text-left"
                        >
                          {p.name || '—'}
                        </button>
                      </td>
                      <td className="py-2 pr-4 text-[#191970] dark:text-slate-300 text-xs">{p.email || '—'}</td>
                      <td className="py-2 pr-4">
                        {changingRole === p.id ? (
                          <div className="flex gap-1 items-center">
                            <select defaultValue={p.role} onChange={e => setNewRole(e.target.value)} className="rounded-lg border border-[#c9a96e]/40 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-2 py-1 text-xs">
                              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <button onClick={() => handleRoleChange(p)} className="bg-[#1a5c38] text-[#f5deb3] text-xs px-2 py-1 rounded-lg font-bold">Save</button>
                            <button onClick={() => setChangingRole(null)} className="text-[#800020] text-xs px-1">✕</button>
                          </div>
                        ) : (
                          <span className="text-[#191970] dark:text-slate-300 capitalize">{p.role || '—'}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${p.status === 'inactive' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {p.status || 'active'}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          {isAdmin && (
                            <button onClick={() => { setChangingRole(p.id); setNewRole(p.role); }} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] text-xs px-3 py-1 rounded-xl font-bold transition-colors">Role</button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDeactivate(p)} className="border border-red-300 text-red-600 text-xs px-3 py-1 rounded-xl font-semibold hover:bg-red-50 transition-colors">Off</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
