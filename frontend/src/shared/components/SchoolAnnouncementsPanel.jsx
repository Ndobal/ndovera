import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../../config/apiBase';
import { getStoredAuth } from '../../features/auth/services/authApi';

const CARD = 'rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10';
const INPUT = 'mt-2 w-full rounded-2xl border border-[#c9a96e]/45 bg-white/85 px-4 py-3 text-sm font-medium text-[#191970] outline-none transition focus:border-[#1a5c38] focus:ring-2 focus:ring-[#1a5c38]/20 dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#39ff14] dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20';
const PRIMARY_BUTTON = 'inline-flex items-center justify-center rounded-2xl bg-[#1a5c38] px-4 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#6affff]';

function buildRequestInit(token, init = {}) {
  const nextHeaders = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  };

  return {
    credentials: 'include',
    ...init,
    headers: nextHeaders,
  };
}

async function requestJson(path, token, init = {}) {
  const response = await fetch(getApiUrl(path), buildRequestInit(token, init));
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || payload?.message || 'Request failed.');
  }

  return payload;
}

function formatTimestamp(value) {
  const timestamp = String(value || '').trim();
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function SchoolAnnouncementsPanel({
  title = 'School Announcements',
  subtitle = 'Publish one school-wide update here. School users will see it from the notification bell in their dashboards.',
}) {
  const storedAuth = getStoredAuth();
  const token = storedAuth?.token || localStorage.getItem('token') || '';
  const authUser = storedAuth?.user || {};
  const [announcements, setAnnouncements] = useState([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ title: '', body: '' });

  useEffect(() => {
    let ignore = false;
    let signature = '';

    async function loadAnnouncements({ silent = false } = {}) {
      if (!token) {
        if (!ignore) {
          setAnnouncements([]);
          setCanCreate(false);
          setLoading(false);
        }
        return;
      }

      // Background polls stay silent: no spinner, and the list only swaps in when it
      // actually changed, so the panel never blinks between identical refreshes.
      if (!silent) setLoading(true);

      try {
        const payload = await requestJson('/api/announcements', token);
        const nextAnnouncements = payload.announcements || [];
        const nextSignature = nextAnnouncements.map(item => `${item.id}:${item.createdAt || ''}`).join('|');
        if (!ignore && (!silent || nextSignature !== signature)) {
          signature = nextSignature;
          setAnnouncements(nextAnnouncements);
          setCanCreate(Boolean(payload.canCreate));
        }
        if (!ignore && !silent) setError('');
      } catch (loadError) {
        if (!ignore && !silent) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load announcements.');
        }
      } finally {
        if (!ignore && !silent) {
          setLoading(false);
        }
      }
    }

    loadAnnouncements();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadAnnouncements({ silent: true });
    }, 15000);
    return () => {
      ignore = true;
      window.clearInterval(poll);
    };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and announcement body are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = await requestJson('/api/announcements', token, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
          audienceRoles: ['all'],
        }),
      });

      if (payload.announcement) {
        setAnnouncements(previous => [payload.announcement, ...previous.filter(item => item.id !== payload.announcement.id)]);
      }
      setForm({ title: '', body: '' });
      setNotice('Announcement published. School users can now see it in their notification bell.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not publish the announcement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100">{title}</h2>
          <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">{subtitle}</p>
        </div>
        {authUser?.role && (
          <span className="rounded-full border border-[#c9a96e]/45 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">
            {authUser.role}
          </span>
        )}
      </div>

      {canCreate && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Announcement Title</label>
            <input
              value={form.title}
              onChange={(event) => setForm(current => ({ ...current, title: event.target.value }))}
              className={INPUT}
              placeholder="e.g. Resumption notice for all staff and learners"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Announcement Body</label>
            <textarea
              value={form.body}
              onChange={(event) => setForm(current => ({ ...current, body: event.target.value }))}
              className={`${INPUT} min-h-[140px]`}
              placeholder="Write the update exactly as school users should read it."
            />
          </div>

          {error && <div className="rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{error}</div>}
          {notice && <div className="rounded-2xl border border-[#1a5c38]/35 bg-[#edf8f1] px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:border-[#00ffff]/35 dark:bg-[#002b2c] dark:text-[#00ffff]">{notice}</div>}

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
              {saving ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      )}

      {!canCreate && error && <div className="mt-5 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{error}</div>}

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Recent Announcements</h3>
          {loading && <span className="text-xs font-semibold text-[#191970] dark:text-slate-300">Loading...</span>}
        </div>

        {announcements.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-[#c9a96e]/50 bg-white/60 px-4 py-5 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-slate-300">
            No school announcements have been published yet.
          </div>
        ) : (
          announcements.map(announcement => (
            <article key={announcement.id} className="rounded-2xl border border-[#c9a96e]/45 bg-white/70 px-4 py-4 dark:border-[#bf00ff]/35 dark:bg-black/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-[#800000] dark:text-slate-100">{announcement.title}</h4>
                  <p className="mt-1 text-sm text-[#191970] dark:text-slate-300 whitespace-pre-wrap">{announcement.body}</p>
                </div>
                <div className="text-right text-xs font-semibold uppercase tracking-[0.12em] text-[#800020] dark:text-[#bf00ff]">
                  <div>{announcement.authorName || announcement.authorRole || 'School notice'}</div>
                  <div className="mt-1 normal-case tracking-normal text-[#191970] dark:text-slate-300">{formatTimestamp(announcement.createdAt)}</div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}