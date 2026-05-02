import React, { useEffect, useState } from 'react';
import { getSettings, setTheme, setLanguage, setNotifications } from '../service/settingsService';

export default function AppSettings() {
  const [theme, setThemeLocal] = useState('system');
  const [lang, setLangLocal] = useState('en');
  const [notif, setNotifState] = useState({ push: true, email: true, sms: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await getSettings();
      if (!mounted) return;
      setThemeLocal(s.theme || 'system');
      setLangLocal(s.language || 'en');
      setNotifState(s.notifications || { push: true, email: true, sms: false });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const applyTheme = async (t) => {
    await setTheme(t);
    setThemeLocal(t);
  };

  const applyLang = async (l) => {
    await setLanguage(l);
    setLangLocal(l);
  };

  const toggleNotif = async (k) => {
    const next = { ...notif, [k]: !notif[k] };
    await setNotifications(next);
    setNotifState(next);
  };

  if (loading) return <div className="glass-surface rounded-3xl p-5">Loading…</div>;

  return (
    <div className="glass-surface rounded-3xl p-5 space-y-3">
      <p className="micro-label neon-subtle">App Preferences</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <p className="micro-label">Theme</p>
          <select value={theme} onChange={e => applyTheme(e.target.value)} className="w-full p-2 rounded-xl bg-slate-900/40">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div>
          <p className="micro-label">Language</p>
          <select value={lang} onChange={e => applyLang(e.target.value)} className="w-full p-2 rounded-xl bg-slate-900/40">
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
          </select>
        </div>
        <div>
          <p className="micro-label">Notifications</p>
          <div className="flex flex-col gap-2">
            <label><input type="checkbox" checked={notif.push} onChange={() => toggleNotif('push')} /> Push</label>
            <label><input type="checkbox" checked={notif.email} onChange={() => toggleNotif('email')} /> Email</label>
            <label><input type="checkbox" checked={notif.sms} onChange={() => toggleNotif('sms')} /> SMS</label>
          </div>
        </div>
      </div>
    </div>
  );
}
