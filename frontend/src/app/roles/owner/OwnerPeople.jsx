import React, { useEffect, useState } from 'react';
import { getPeople, addPerson, deactivatePerson, updatePersonRole } from '../../../features/school/services/schoolApi';

const ROLES = ['teacher', 'hos', 'accountant', 'student', 'parent', 'librarian', 'classteacher', 'hod', 'principal'];
const FILTERS = ['All', 'Teachers', 'Admin', 'Students', 'Parents'];

function filterPeople(people, filter) {
  if (filter === 'Teachers') return people.filter(p => p.role === 'teacher');
  if (filter === 'Admin') return people.filter(p => ['owner', 'hos', 'accountant', 'principal', 'hod'].includes(p.role));
  if (filter === 'Students') return people.filter(p => p.role === 'student');
  if (filter === 'Parents') return people.filter(p => p.role === 'parent');
  return people;
}

function AddPersonModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'teacher', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onAdd(form);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900 border border-[#c9a96e]/40 dark:border-white/10 shadow-xl">
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

export default function OwnerPeople({ auth }) {
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [changingRole, setChangingRole] = useState(null);
  const [newRole, setNewRole] = useState('');

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

  const filtered = filterPeople(people, filter);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {showAdd && <AddPersonModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">People</h1>
          <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Manage all staff enrolled in your institution.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="shrink-0 bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl text-sm transition-colors">+ Add</button>
      </div>

      <div className="flex gap-3 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors ${filter === f ? 'bg-[#800020] text-[#f5deb3] border-[#800020]' : 'bg-[#f5deb3] text-[#800020] border-[#c9a96e]/40 dark:bg-slate-900/30 dark:text-slate-400 dark:border-white/10 hover:bg-[#efd4a0]'}`}>{f}</button>
        ))}
      </div>

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {loading ? (
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        ) : error ? (
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-[#800020] dark:text-slate-400">No people found. Click + Add to enroll staff.</p>
        ) : (
          <>
            <p className="text-xs text-[#800020] dark:text-slate-400 mb-4 font-semibold uppercase">{filtered.length} {filter.toLowerCase()}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#c9a96e]/40 dark:border-white/10">
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-2 pr-4 text-[#800020] dark:text-slate-400 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-[#c9a96e]/20 dark:border-white/5">
                      <td className="py-2 pr-4 text-[#191970] dark:text-slate-300">{p.name || '—'}</td>
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
                          <button onClick={() => { setChangingRole(p.id); setNewRole(p.role); }} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] text-xs px-3 py-1 rounded-xl font-bold transition-colors">Role</button>
                          <button onClick={() => handleDeactivate(p)} className="border border-red-300 text-red-600 text-xs px-3 py-1 rounded-xl font-semibold hover:bg-red-50 transition-colors">Off</button>
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
