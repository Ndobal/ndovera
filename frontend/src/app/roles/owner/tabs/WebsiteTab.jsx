import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getWebsiteSections, saveWebsiteSection, uploadSectionImage } from '../../../../features/school/services/schoolApi';

const SECTION_KEYS = [
  {
    key: 'hero',
    label: 'Homepage Hero',
    desc: 'Large first-screen banner, headline, CTA, and optional background video/image.',
    mediaLabel: 'Hero Picture / Video',
    fields: ['eyebrow', 'button'],
  },
  {
    key: 'about',
    label: 'About / Mission',
    desc: 'Mission, values, and school story shown on home and About page.',
    mediaLabel: 'About Picture / Video',
  },
  {
    key: 'academics',
    label: 'Academics',
    desc: 'Programmes such as nursery, primary, high school, sixth form, or special pathways.',
    mediaLabel: 'Academic Picture / Video',
    fields: ['programs'],
  },
  {
    key: 'admissions',
    label: 'Admissions',
    desc: 'Admission message, process summary, and call-to-action for families.',
    mediaLabel: 'Admission Picture / Video',
    fields: ['button'],
  },
  {
    key: 'admission_flyer',
    label: 'Admission Flyer',
    desc: 'Upload a flyer. When it exists, it appears prominently on the homepage and admission page.',
    mediaLabel: 'Flyer Image / PDF / Video',
    accept: 'image/*,application/pdf,video/*',
  },
  {
    key: 'tour',
    label: 'Virtual Tour',
    desc: 'Campus tour content. Use a video or strong image of school life.',
    mediaLabel: 'Tour Picture / Video',
    fields: ['button'],
  },
  {
    key: 'gallery',
    label: 'Gallery',
    desc: 'Photos and videos used by the public Gallery page and homepage preview.',
    mediaLabel: 'Gallery Picture / Video',
    fields: ['gallery'],
    multiple: true,
  },
  {
    key: 'contact',
    label: 'Contact Info',
    desc: 'Address, phone, and email shown on contact page and footer.',
    mediaLabel: 'Contact Picture / Video',
    fields: ['contact'],
  },
];

const inputClass = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]';
const labelClass = 'text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold';

function parseMeta(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function asLines(value) {
  if (Array.isArray(value)) return value.join('\n');
  return value || '';
}

function toLines(value) {
  return String(value || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function getYouTubeEmbedUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    if (parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.pathname.replace(/^\//, '').trim();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    }

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        const videoId = parsed.searchParams.get('v') || '';
        return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
      }

      const match = parsed.pathname.match(/\/(embed|shorts)\/([^/?#]+)/);
      return match?.[2] ? `https://www.youtube.com/embed/${match[2]}` : '';
    }
  } catch {
    return '';
  }

  return '';
}

function isVideo(url) {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(String(url || ''));
}

function MediaPreview({ url, label }) {
  if (!url) return null;
  const youtubeUrl = getYouTubeEmbedUrl(url);

  if (youtubeUrl) {
    return (
      <iframe
        src={youtubeUrl}
        title={label}
        className="mt-2 h-28 w-full max-w-xs rounded-xl border border-[#c9a96e]/40"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  if (/\.pdf(\?|#|$)/i.test(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-[#1a5c38] underline">
        Open uploaded flyer
      </a>
    );
  }
  return isVideo(url) ? (
    <video src={url} controls className="mt-2 h-28 w-full max-w-xs rounded-xl object-cover border border-[#c9a96e]/40" />
  ) : (
    <img src={url} alt={label} className="mt-2 h-28 w-full max-w-xs rounded-xl object-cover border border-[#c9a96e]/40" />
  );
}

function SectionCard({ section, data, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    imageUrl: '',
    eyebrow: '',
    buttonLabel: '',
    buttonUrl: '',
    videoUrl: '',
    programs: '',
    mediaUrls: '',
    address: '',
    phone: '',
    email: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    const meta = parseMeta(data?.metadata);
    setForm({
      title: data?.title || '',
      content: data?.content || '',
      imageUrl: data?.image_url || '',
      eyebrow: meta.eyebrow || '',
      buttonLabel: meta.buttonLabel || '',
      buttonUrl: meta.buttonUrl || '',
      videoUrl: meta.videoUrl || '',
      programs: asLines(meta.programs),
      mediaUrls: asLines(meta.mediaUrls),
      address: meta.address || '',
      phone: meta.phone || '',
      email: meta.email || '',
    });
  }, [data, section.key]);

  const metadata = useMemo(() => ({
    eyebrow: form.eyebrow,
    buttonLabel: form.buttonLabel,
    buttonUrl: form.buttonUrl,
    videoUrl: form.videoUrl,
    programs: toLines(form.programs),
    mediaUrls: toLines(form.mediaUrls),
    address: form.address,
    phone: form.phone,
    email: form.email,
    flyerUrl: section.key === 'admission_flyer' ? form.imageUrl : undefined,
  }), [form, section.key]);

  async function uploadOne(file, appendToGallery = false) {
    const result = await uploadSectionImage(file, section.key);
    if (appendToGallery) {
      setForm(f => ({
        ...f,
        mediaUrls: [...toLines(f.mediaUrls), result.url].join('\n'),
        imageUrl: f.imageUrl || result.url,
      }));
      return;
    }
    setForm(f => ({ ...f, imageUrl: result.url }));
  }

  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setMsg('');
    try {
      for (const file of files) {
        await uploadOne(file, section.multiple);
      }
      setMsg('Upload complete.');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await saveWebsiteSection({
        sectionKey: section.key,
        title: form.title,
        content: form.content,
        imageUrl: form.imageUrl,
        metadata,
      });
      setMsg('Saved.');
      onSaved?.();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  const show = name => section.fields?.includes(name);
  const galleryUrls = toLines(form.mediaUrls);

  return (
    <div className="rounded-2xl p-5 bg-[#f5deb3] dark:bg-slate-800/40 border border-[#c9a96e]/40 dark:border-white/10 space-y-4">
      <div>
        <p className="font-bold text-[#800000] dark:text-slate-100">{section.label}</p>
        <p className="text-xs text-[#800020] dark:text-slate-400">{section.desc}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className={labelClass}>Title</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} />
        </div>

        {show('eyebrow') && (
          <div>
            <label className={labelClass}>Small Label</label>
            <input value={form.eyebrow} onChange={e => setForm(f => ({ ...f, eyebrow: e.target.value }))} className={inputClass} placeholder="Admissions Now Open" />
          </div>
        )}

        <div>
          <label className={labelClass}>Content</label>
          <textarea rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className={`${inputClass} resize-none`} />
        </div>

        <div>
          <label className={labelClass}>{section.mediaLabel}</label>
          <div className="flex flex-wrap gap-2 items-center mt-1">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-4 py-1.5 rounded-xl text-xs transition-colors disabled:opacity-60">
              {uploading ? 'Uploading...' : section.multiple ? 'Upload Media' : 'Upload File'}
            </button>
            <input ref={fileRef} type="file" accept={section.accept || 'image/*,video/*'} multiple={!!section.multiple} className="hidden" onChange={handleMediaUpload} />
            {form.imageUrl && <span className="text-xs text-[#1a5c38] font-semibold">Primary media set</span>}
          </div>
          <MediaPreview url={form.imageUrl} label={section.label} />
        </div>

        <div>
          <label className={labelClass}>YouTube / Video URL</label>
          <input value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} className={inputClass} placeholder="https://www.youtube.com/watch?v=..." />
          <MediaPreview url={form.videoUrl} label={`${section.label} video`} />
        </div>

        {show('button') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Button Text</label>
              <input value={form.buttonLabel} onChange={e => setForm(f => ({ ...f, buttonLabel: e.target.value }))} className={inputClass} placeholder="Learn More" />
            </div>
            <div>
              <label className={labelClass}>Button Link</label>
              <input value={form.buttonUrl} onChange={e => setForm(f => ({ ...f, buttonUrl: e.target.value }))} className={inputClass} placeholder="/admissions" />
            </div>
          </div>
        )}

        {show('programs') && (
          <div>
            <label className={labelClass}>Academic Programmes</label>
            <textarea rows={4} value={form.programs} onChange={e => setForm(f => ({ ...f, programs: e.target.value }))} className={`${inputClass} resize-none`} placeholder={'Nursery\nPrimary\nJunior Secondary\nSenior Secondary'} />
          </div>
        )}

        {show('gallery') && (
          <div>
            <label className={labelClass}>Gallery Media URLs</label>
            <textarea rows={5} value={form.mediaUrls} onChange={e => setForm(f => ({ ...f, mediaUrls: e.target.value }))} className={`${inputClass} resize-none`} placeholder="Upload files above, or paste one URL per line." />
            {galleryUrls.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {galleryUrls.slice(0, 6).map(url => <MediaPreview key={url} url={url} label="Gallery media" />)}
              </div>
            )}
          </div>
        )}

        {show('contact') && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Address</label>
              <textarea rows={3} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} />
            </div>
          </div>
        )}

        {msg && <p className={`text-xs ${msg === 'Saved.' || msg === 'Upload complete.' ? 'text-[#1a5c38]' : 'text-red-600'}`}>{msg}</p>}
        <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Section'}
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

  function getSectionData(key) {
    return sections.find(s => s.section_key === key) || null;
  }

  if (loading) return <p className="text-[#800020]">Loading...</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 bg-[#f5deb3] border border-[#c9a96e]/40">
        <h2 className="text-xl font-bold text-[#800000]">Public School Website</h2>
        <p className="mt-1 text-sm text-[#191970]">
          Manage the tenant school website sections, pages, pictures, videos, admission flyer, and homepage portal login content.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#800020]">
          <span className="rounded-full bg-[#fff8ee] px-3 py-1">Home</span>
          <span className="rounded-full bg-[#fff8ee] px-3 py-1">About</span>
          <span className="rounded-full bg-[#fff8ee] px-3 py-1">Academics</span>
          <span className="rounded-full bg-[#fff8ee] px-3 py-1">Admissions</span>
          <span className="rounded-full bg-[#fff8ee] px-3 py-1">Gallery</span>
          <span className="rounded-full bg-[#fff8ee] px-3 py-1">Contact</span>
          <span className="rounded-full bg-[#fff8ee] px-3 py-1">Portal Login</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {SECTION_KEYS.map(section => (
          <SectionCard key={section.key} section={section} data={getSectionData(section.key)} onSaved={load} />
        ))}
      </div>
    </div>
  );
}
