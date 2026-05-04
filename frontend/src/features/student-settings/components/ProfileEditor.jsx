import React, { useEffect, useState } from 'react';
import { getSettings, updateProfile } from '../service/settingsService';

export default function ProfileEditor() {
  const [profile, setProfile] = useState({ name: '', email: '', avatar: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await getSettings();
      if (!mounted) return;
      setProfile(s.profile || { name: '', email: '', avatar: '' });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(profile);
    } catch (e) {
      // ignore for now
    }
    setSaving(false);
  };

  if (loading) return <div className="glass-surface rounded-3xl p-5">Loading…</div>;

  return (
    <div className="glass-surface rounded-3xl p-5 space-y-3">
      <p className="micro-label neon-subtle">Profile</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="micro-label">Full name</label>
          <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full rounded-xl p-2 wheat-input dark:bg-slate-900/40 dark:text-slate-100" />
        </div>
        <div>
          <label className="micro-label">Email</label>
          <input value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} className="w-full rounded-xl p-2 wheat-input dark:bg-slate-900/40 dark:text-slate-100" />
        </div>
        <div>
          <label className="micro-label">Avatar URL</label>
          <input value={profile.avatar} onChange={e => setProfile({ ...profile, avatar: e.target.value })} className="w-full rounded-xl p-2 wheat-input dark:bg-slate-900/40 dark:text-slate-100" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-2xl bg-emerald-500/20">{saving ? 'Saving…' : 'Save Profile'}</button>
      </div>
    </div>
  );
}
