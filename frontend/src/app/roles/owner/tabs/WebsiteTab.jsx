import React, { useEffect, useState, useRef } from 'react';
import { getWebsiteSections, saveWebsiteSection, uploadSectionImage } from '../../../../features/school/services/schoolApi';

const SECTION_KEYS = [
  { key: 'hero', label: 'Hero Banner', desc: 'Main banner image and headline' },
  { key: 'about', label: 'About Us', desc: 'School description and mission' },
  { key: 'gallery', label: 'Gallery', desc: 'School photos and highlights' },
  { key: 'facilities', label: 'Facilities', desc: 'Classrooms, lab, library, etc.' },
  { key: 'contact', label: 'Contact Info', desc: 'Address, phone, email' },
];

function SectionCard({ section, data, onSaved }) {
  const [form, setForm] = useState({ title: '', content: '', imageUrl: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (data) setForm({ title: data.title || '', content: data.content || '', imageUrl: data.image_url || '' });
  }, [data]);

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const result = await uploadSectionImage(file, section.key);
      setForm(f => ({ ...f, imageUrl: result.url }));
    } catch (err) { setMsg(err.message); }
    finally { setUploading(false); }
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await saveWebsiteSection({ sectionKey: section.key, ...form });
      setMsg('Saved!'); onSaved?.();
    } catch (err) { setMsg(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl p-5 bg-[#f5deb3] dark:bg-slate-800/40 border border-[#c9a96e]/40 dark:border-white/10 space-y-3">
      <div>
        <p className="font-bold text-[#800000] dark:text-slate-100">{section.label}</p>
        <p className="text-xs text-[#800020] dark:text-slate-400">{section.desc}</p>
      </div>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Title</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Content</label>
          <textarea rows={3} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38] resize-none" />
        </div>
        <div>
          <label className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Image</label>
          <div className="flex gap-2 items-center mt-1">
            <button type="button" onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-4 py-1.5 rounded-xl text-xs transition-colors disabled:opacity-60">
              {uploading ? 'Uploading…' : '📁 Upload Image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {form.imageUrl && <span className="text-xs text-emerald-700 truncate max-w-[120px]">✓ Image set</span>}
          </div>
          {form.imageUrl && (
            <img src={form.imageUrl} alt={section.label} className="mt-2 h-24 rounded-xl object-cover border border-[#c9a96e]/40" />
          )}
        </div>
        {msg && <p className={`text-xs ${msg === 'Saved!' ? 'text-emerald-700' : 'text-red-600'}`}>{msg}</p>}
        <button type="submit" disabled={saving}
          className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-1.5 rounded-xl text-sm transition-colors disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Section'}
        </button>
      </form>
    </div>
  );
}

export default function WebsiteTab() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    getWebsiteSections()
      .then(d => setSections(d?.sections || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <p className="text-[#800020]">Loading…</p>;

  function getSectionData(key) {
    return sections.find(s => s.section_key === key) || null;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#800020] dark:text-slate-400">
        These sections appear on your school's public website. Upload images and fill in content for each section.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTION_KEYS.map(s => (
          <SectionCard key={s.key} section={s} data={getSectionData(s.key)} onSaved={load} />
        ))}
      </div>
    </div>
  );
}
