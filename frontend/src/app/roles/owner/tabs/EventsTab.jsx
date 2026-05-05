import React, { useEffect, useState, useRef } from 'react';
import { getEvents, createEvent, updateEvent, deleteEvent, uploadEventMedia } from '../../../../features/school/services/schoolApi';

function MediaPreview({ urls }) {
  if (!urls?.length) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {urls.map((url, i) => {
        const isVideo = /\.(mp4|mov|webm|ogg)$/i.test(url);
        return isVideo
          ? <video key={i} src={url} className="h-16 rounded-lg border border-[#c9a96e]/40" controls muted />
          : <img key={i} src={url} alt="" className="h-16 rounded-lg border border-[#c9a96e]/40 object-cover" />;
      })}
    </div>
  );
}

function EventForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { title: '', description: '', eventDate: '', mediaUrls: [] });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef();

  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setErr('');
    try {
      const uploaded = await Promise.all(files.map(f => uploadEventMedia(f)));
      const newUrls = uploaded.map(r => r.url).filter(Boolean);
      setForm(f => ({ ...f, mediaUrls: [...(f.mediaUrls || []), ...newUrls] }));
    } catch (e2) { setErr(e2.message); }
    finally { setUploading(false); }
  }

  function removeMedia(idx) {
    setForm(f => ({ ...f, mediaUrls: f.mediaUrls.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setErr('');
    try { await onSave(form); } catch (e2) { setErr(e2.message); setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {[['Title', 'title', 'text', true], ['Event Date', 'eventDate', 'date', false]].map(([label, key, type, req]) => (
        <div key={key}>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">{label}</label>
          <input type={type} required={!!req} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none" />
        </div>
      ))}
      <div>
        <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Description</label>
        <textarea rows={3} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none resize-none" />
      </div>
      <div>
        <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Media (Photos &amp; Videos)</label>
        <div className="flex gap-2 items-center mt-1">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-4 py-1.5 rounded-xl text-xs transition-colors disabled:opacity-60">
            {uploading ? 'Uploading…' : '📎 Upload Photos/Videos'}
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
          <span className="text-xs text-[#800020] dark:text-slate-400">{form.mediaUrls?.length || 0} file(s)</span>
        </div>
        {form.mediaUrls?.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-2">
            {form.mediaUrls.map((url, i) => (
              <div key={i} className="relative">
                {/\.(mp4|mov|webm|ogg)$/i.test(url)
                  ? <video src={url} className="h-16 rounded-lg border border-[#c9a96e]/40 object-cover" muted />
                  : <img src={url} alt="" className="h-16 rounded-lg border border-[#c9a96e]/40 object-cover" />}
                <button type="button" onClick={() => removeMedia(i)}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {err && <p className="text-red-600 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-1.5 rounded-xl text-sm transition-colors disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Event'}
        </button>
        {onCancel && <button type="button" onClick={onCancel}
          className="bg-[#f5deb3] border border-[#c9a96e]/40 text-[#800020] font-bold px-4 py-1.5 rounded-xl text-sm">Cancel</button>}
      </div>
    </form>
  );
}

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    getEvents().then(d => setEvents(d?.events || [])).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(form) {
    await createEvent(form); setShowAdd(false); load();
  }

  async function handleUpdate(form) {
    await updateEvent(editing.id, form); setEditing(null); load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this event?')) return;
    try { await deleteEvent(id); load(); } catch (e) { setError(e.message); }
  }

  if (loading) return <p className="text-[#800020]">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-[#800020] dark:text-slate-400">Manage your school events. Photos and videos appear on the public events page.</p>
        <button onClick={() => { setShowAdd(true); setEditing(null); }}
          className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-4 py-2 rounded-2xl text-sm transition-colors">
          + Add Event
        </button>
      </div>

      {showAdd && !editing && (
        <div className="rounded-2xl p-5 bg-[#fff8ee] dark:bg-slate-800/40 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="font-bold text-[#800000] mb-3">New Event</p>
          <EventForm onSave={handleCreate} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {events.length === 0 && !showAdd && (
        <div className="rounded-2xl p-6 bg-[#f5deb3] dark:bg-slate-800/40 border border-dashed border-[#c9a96e]/60 text-center">
          <p className="text-[#800020] dark:text-slate-400 text-sm">No events yet. Add your first event.</p>
        </div>
      )}

      <div className="space-y-3">
        {events.map(ev => (
          <div key={ev.id} className="rounded-2xl p-5 bg-[#f5deb3] dark:bg-slate-800/40 border border-[#c9a96e]/40 dark:border-white/10">
            {editing?.id === ev.id ? (
              <>
                <p className="font-bold text-[#800000] mb-3">Edit Event</p>
                <EventForm initial={{ title: ev.title, description: ev.description, eventDate: ev.event_date, mediaUrls: ev.mediaUrls || [] }}
                  onSave={handleUpdate} onCancel={() => setEditing(null)} />
              </>
            ) : (
              <>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-bold text-[#800000] dark:text-slate-100">{ev.title}</p>
                    {ev.event_date && <p className="text-xs text-[#800020] dark:text-slate-400 mt-0.5">{new Date(ev.event_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>}
                    {ev.description && <p className="text-sm text-[#191970] dark:text-slate-300 mt-1">{ev.description}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setEditing(ev); setShowAdd(false); }}
                      className="text-xs bg-[#800020] text-[#f5deb3] font-bold px-3 py-1 rounded-xl hover:bg-[#600018]">Edit</button>
                    <button onClick={() => handleDelete(ev.id)}
                      className="text-xs bg-red-700 text-white font-bold px-3 py-1 rounded-xl hover:bg-red-800">Delete</button>
                  </div>
                </div>
                <MediaPreview urls={ev.mediaUrls} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
