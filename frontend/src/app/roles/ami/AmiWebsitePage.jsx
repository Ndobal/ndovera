import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAmiWebsiteSections, saveAmiWebsiteSection, uploadAmiWebsiteAsset } from '../../../features/public/services/publicSiteApi';
import OpportunitiesManager from '../../../features/public/components/OpportunitiesManager';
import GrowthPartnersAdmin from '../../../features/public/components/GrowthPartnersAdmin';

const SECTION_DEFINITIONS = [
  {
    key: 'flier',
    label: 'Flier / Advert Popup',
    description: 'Shown as a popup when visitors first open ndovera.com. Upload 1–3 images and set the call-to-action button (label + link). Leave media empty to disable.',
    allowMultipleMedia: true,
  },
  {
    key: 'home',
    label: 'Homepage',
    description: 'Main NDOVERA landing page with hero copy, CTAs, stats, and media.',
    allowMultipleMedia: true,
    supportsStats: true,
    supportsCards: true,
  },
  {
    key: 'about',
    label: 'About',
    description: 'Public NDOVERA story, purpose, and positioning.',
    supportsCards: true,
  },
  {
    key: 'mission',
    label: 'Mission',
    description: 'Mission page content and supporting cards.',
    supportsCards: true,
  },
  {
    key: 'vision',
    label: 'Vision',
    description: 'Vision page content and long-horizon messaging.',
    supportsCards: true,
  },
  {
    key: 'partners',
    label: 'Growth Partners',
    description: 'Partnership tracks, implementation routes, and collaboration stories.',
    supportsCards: true,
  },
  {
    key: 'tutor',
    label: 'Tutor',
    description: 'NDOVERA Tutor explanations, demonstrations, and supporting media.',
    supportsCards: true,
  },
  {
    key: 'pricing',
    label: 'Pricing',
    description: 'Public pricing page copy, rollout terms, and onboarding explanation.',
    allowMultipleMedia: true,
    supportsCards: true,
  },
  {
    key: 'opportunities',
    label: 'Opportunities',
    description: 'School opportunities, implementation tracks, and collaboration calls.',
    supportsCards: true,
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Public events, showcases, roundtables, and event gallery media.',
    allowMultipleMedia: true,
    supportsCards: true,
  },
  {
    key: 'gallery',
    label: 'Gallery',
    description: 'Uploaded NDOVERA public photos and videos shown on the gallery page.',
    allowMultipleMedia: true,
  },
];

const inputClass = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#fff8ee] px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const labelClass = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';

function parseMeta(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function asMediaLines(value) {
  if (!Array.isArray(value)) return '';
  return value.join('\n');
}

function asCardLines(value) {
  if (!Array.isArray(value)) return '';
  return value
    .map(item => [item.eyebrow || '', item.title || '', item.description || ''].filter(Boolean).join(' | '))
    .join('\n');
}

function asStatLines(value) {
  if (!Array.isArray(value)) return '';
  return value
    .map(item => [item.label || '', item.value || ''].filter(Boolean).join(' | '))
    .join('\n');
}

function toMediaLines(value) {
  return String(value || '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function toCardItems(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [first = '', second = '', ...rest] = line.split('|').map(item => item.trim()).filter(Boolean);
      if (rest.length > 0) {
        return { eyebrow: first, title: second, description: rest.join(' | ') };
      }
      if (second) {
        return { title: first, description: second };
      }
      return { title: first, description: '' };
    });
}

function toStatItems(value) {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [label = '', valueText = ''] = line.split('|').map(item => item.trim());
      return { label, value: valueText };
    })
    .filter(item => item.label || item.value);
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

function MediaPreview({ url, label }) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  const youtubeUrl = getYouTubeEmbedUrl(raw);
  if (youtubeUrl) {
    return (
      <iframe
        src={youtubeUrl}
        title={label}
        className="mt-2 h-40 w-full rounded-xl border border-[#c9a96e]/40"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  if (/\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(raw)) {
    return <video src={raw} controls className="mt-2 h-40 w-full rounded-xl border border-[#c9a96e]/40 object-cover" />;
  }

  return <img src={raw} alt={label} className="mt-2 h-40 w-full rounded-xl border border-[#c9a96e]/40 object-cover" />;
}

function SectionEditor({ section, data, onSaved }) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    imageUrl: '',
    eyebrow: '',
    spotlightEyebrow: '',
    spotlightTitle: '',
    spotlightDescription: '',
    mediaEyebrow: '',
    mediaTitle: '',
    mediaDescription: '',
    buttonLabel: '',
    buttonUrl: '',
    secondaryButtonLabel: '',
    secondaryButtonUrl: '',
    youtubeUrl: '',
    mediaUrls: '',
    cardsText: '',
    statsText: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);
  const heroFileRef = useRef(null);

  // Replace the primary/hero image directly (always overwrites imageUrl).
  async function handleHeroUpload(event) {
    const file = (event.target.files || [])[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const result = await uploadAmiWebsiteAsset(file, section.key);
      setForm(current => ({ ...current, imageUrl: result.url }));
      setMessage('Hero image uploaded — click "Save Section" to publish it.');
    } catch (error) {
      setMessage(error.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (heroFileRef.current) heroFileRef.current.value = '';
    }
  }

  useEffect(() => {
    const meta = parseMeta(data?.metadata);
    setForm({
      title: data?.title || '',
      content: data?.content || '',
      imageUrl: data?.image_url || '',
      eyebrow: meta.eyebrow || '',
      spotlightEyebrow: meta.spotlightEyebrow || '',
      spotlightTitle: meta.spotlightTitle || '',
      spotlightDescription: meta.spotlightDescription || '',
      mediaEyebrow: meta.mediaEyebrow || '',
      mediaTitle: meta.mediaTitle || '',
      mediaDescription: meta.mediaDescription || '',
      buttonLabel: meta.buttonLabel || '',
      buttonUrl: meta.buttonUrl || '',
      secondaryButtonLabel: meta.secondaryButtonLabel || '',
      secondaryButtonUrl: meta.secondaryButtonUrl || '',
      youtubeUrl: meta.youtubeUrl || meta.videoUrl || '',
      mediaUrls: asMediaLines(meta.mediaUrls),
      cardsText: asCardLines(meta.cards),
      statsText: asStatLines(meta.stats),
    });
  }, [data]);

  const mediaUrls = useMemo(() => toMediaLines(form.mediaUrls), [form.mediaUrls]);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await saveAmiWebsiteSection({
        sectionKey: section.key,
        title: form.title,
        content: form.content,
        imageUrl: form.imageUrl,
        metadata: {
          eyebrow: form.eyebrow,
          spotlightEyebrow: form.spotlightEyebrow,
          spotlightTitle: form.spotlightTitle,
          spotlightDescription: form.spotlightDescription,
          mediaEyebrow: form.mediaEyebrow,
          mediaTitle: form.mediaTitle,
          mediaDescription: form.mediaDescription,
          buttonLabel: form.buttonLabel,
          buttonUrl: form.buttonUrl,
          secondaryButtonLabel: form.secondaryButtonLabel,
          secondaryButtonUrl: form.secondaryButtonUrl,
          youtubeUrl: form.youtubeUrl,
          mediaUrls: toMediaLines(form.mediaUrls),
          cards: toCardItems(form.cardsText),
          stats: toStatItems(form.statsText),
        },
      });
      setMessage('Saved.');
      onSaved?.();
    } catch (error) {
      setMessage(error.message || 'Could not save this section.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMediaUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setMessage('');

    try {
      for (const file of files) {
        const result = await uploadAmiWebsiteAsset(file, section.key);
        setForm(current => {
          if (section.allowMultipleMedia) {
            const nextMediaUrls = [...toMediaLines(current.mediaUrls), result.url];
            return {
              ...current,
              mediaUrls: nextMediaUrls.join('\n'),
              imageUrl: current.imageUrl || result.url,
            };
          }

          return { ...current, imageUrl: result.url };
        });
      }
      setMessage('Upload complete.');
    } catch (error) {
      setMessage(error.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  return (
    <section className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-white/10 dark:bg-slate-900/40">
      <div>
        <p className="text-lg font-bold text-[#800000] dark:text-slate-100">{section.label}</p>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">{section.description}</p>
      </div>

      <form onSubmit={handleSave} className="mt-5 space-y-4">
        <div className="rounded-2xl border-2 border-dashed border-[#1a5c38]/50 bg-[#fff8ee]/80 p-4 dark:border-emerald-400/30 dark:bg-slate-800/50">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-300">
            {section.key === 'home' ? 'Hero Image' : 'Main Image'}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#191970] dark:text-slate-300">
            {section.key === 'home'
              ? 'The large background image on the NDOVERA homepage hero. Upload a new file to replace it, then click "Save Section".'
              : 'The primary image shown on this page. Upload a new file to replace it.'}
          </p>
          {form.imageUrl ? (
            <MediaPreview url={form.imageUrl} label={`${section.label} hero`} />
          ) : (
            <p className="mt-2 text-xs italic text-[#800020]/70 dark:text-slate-400">No image set — the hero currently shows a plain gradient.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => heroFileRef.current?.click()} disabled={uploading}
              className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60">
              {uploading ? 'Uploading…' : form.imageUrl ? (section.key === 'home' ? 'Replace Hero Image' : 'Replace Image') : 'Upload Image'}
            </button>
            <input ref={heroFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleHeroUpload} />
            {form.imageUrl ? (
              <button type="button" onClick={() => setForm(current => ({ ...current, imageUrl: '' }))}
                className="rounded-2xl border border-[#800020]/30 px-4 py-2 text-sm font-semibold text-[#800020] transition hover:bg-[#800020]/5 dark:text-slate-200">
                Remove
              </button>
            ) : null}
          </div>
          <label className="mt-3 block">
            <span className={labelClass}>Or paste an image / video URL</span>
            <input value={form.imageUrl} onChange={event => setForm(current => ({ ...current, imageUrl: event.target.value }))} className={inputClass} placeholder="https://…" />
          </label>
        </div>

        <div>
          <label className={labelClass}>Page Title</label>
          <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Eyebrow</label>
          <input value={form.eyebrow} onChange={event => setForm(current => ({ ...current, eyebrow: event.target.value }))} className={inputClass} placeholder="Public NDOVERA Website" />
        </div>

        <div>
          <label className={labelClass}>Page Description</label>
          <textarea rows={4} value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} className={`${inputClass} resize-none`} />
        </div>

        <div className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-4 dark:border-white/10 dark:bg-slate-800/40">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">Feature Block</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass}>Feature Label</label>
              <input value={form.spotlightEyebrow} onChange={event => setForm(current => ({ ...current, spotlightEyebrow: event.target.value }))} className={inputClass} placeholder="Built For Real Schools" />
            </div>
            <div>
              <label className={labelClass}>Feature Title</label>
              <input value={form.spotlightTitle} onChange={event => setForm(current => ({ ...current, spotlightTitle: event.target.value }))} className={inputClass} placeholder="Strong schools need clear systems, not more confusion." />
            </div>
            <div>
              <label className={labelClass}>Feature Description</label>
              <textarea rows={4} value={form.spotlightDescription} onChange={event => setForm(current => ({ ...current, spotlightDescription: event.target.value }))} className={`${inputClass} resize-none`} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-4 dark:border-white/10 dark:bg-slate-800/40">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">Media Block</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass}>Media Label</label>
              <input value={form.mediaEyebrow} onChange={event => setForm(current => ({ ...current, mediaEyebrow: event.target.value }))} className={inputClass} placeholder="Learning Support" />
            </div>
            <div>
              <label className={labelClass}>Media Title</label>
              <input value={form.mediaTitle} onChange={event => setForm(current => ({ ...current, mediaTitle: event.target.value }))} className={inputClass} placeholder="Simple explanations, steady revision, and support that feels useful." />
            </div>
            <div>
              <label className={labelClass}>Media Description</label>
              <textarea rows={4} value={form.mediaDescription} onChange={event => setForm(current => ({ ...current, mediaDescription: event.target.value }))} className={`${inputClass} resize-none`} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Primary Button Text</label>
            <input value={form.buttonLabel} onChange={event => setForm(current => ({ ...current, buttonLabel: event.target.value }))} className={inputClass} placeholder="Explore NDOVERA" />
          </div>
          <div>
            <label className={labelClass}>Primary Button Link</label>
            <input value={form.buttonUrl} onChange={event => setForm(current => ({ ...current, buttonUrl: event.target.value }))} className={inputClass} placeholder="/about" />
          </div>
          <div>
            <label className={labelClass}>Secondary Button Text</label>
            <input value={form.secondaryButtonLabel} onChange={event => setForm(current => ({ ...current, secondaryButtonLabel: event.target.value }))} className={inputClass} placeholder="Register School" />
          </div>
          <div>
            <label className={labelClass}>Secondary Button Link</label>
            <input value={form.secondaryButtonUrl} onChange={event => setForm(current => ({ ...current, secondaryButtonUrl: event.target.value }))} className={inputClass} placeholder="/register-school" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Upload Picture / Video To R2</label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60">
              {uploading ? 'Uploading...' : section.allowMultipleMedia ? 'Upload Media' : 'Upload Main Media'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple={section.allowMultipleMedia} className="hidden" onChange={handleMediaUpload} />
            {form.imageUrl ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1a5c38] dark:text-emerald-300">Primary media ready</span> : null}
          </div>
          <MediaPreview url={form.imageUrl} label={section.label} />
        </div>

        <div>
          <label className={labelClass}>YouTube Video URL</label>
          <input value={form.youtubeUrl} onChange={event => setForm(current => ({ ...current, youtubeUrl: event.target.value }))} className={inputClass} placeholder="https://www.youtube.com/watch?v=..." />
          <MediaPreview url={form.youtubeUrl} label={`${section.label} video`} />
        </div>

        {section.allowMultipleMedia && (
          <div>
            <label className={labelClass}>Additional Media URLs</label>
            <textarea rows={5} value={form.mediaUrls} onChange={event => setForm(current => ({ ...current, mediaUrls: event.target.value }))} className={`${inputClass} resize-none`} placeholder="One R2 or YouTube URL per line" />
            {mediaUrls.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {mediaUrls.slice(0, 6).map(url => <MediaPreview key={url} url={url} label="Additional media" />)}
              </div>
            ) : null}
          </div>
        )}

        {section.supportsCards && (
          <div>
            <label className={labelClass}>Cards / Highlights</label>
            <textarea rows={5} value={form.cardsText} onChange={event => setForm(current => ({ ...current, cardsText: event.target.value }))} className={`${inputClass} resize-none`} placeholder="Use one line per card: Title | Description or Label | Title | Description" />
          </div>
        )}

        {section.supportsStats && (
          <div>
            <label className={labelClass}>Hero Stats</label>
            <textarea rows={4} value={form.statsText} onChange={event => setForm(current => ({ ...current, statsText: event.target.value }))} className={`${inputClass} resize-none`} placeholder="Use one line per stat: Label | Value" />
          </div>
        )}

        {message ? <p className={`text-sm ${message === 'Saved.' || message === 'Upload complete.' ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-red-600'}`}>{message}</p> : null}

        <button type="submit" disabled={saving} className="rounded-2xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#670019] disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Section'}
        </button>
      </form>
    </section>
  );
}

export default function AmiWebsitePage() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadSections() {
    setLoading(true);
    try {
      const data = await getAmiWebsiteSections();
      setSections(data?.sections || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load NDOVERA website sections.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSections();
  }, []);

  const sectionsByKey = useMemo(() => Object.fromEntries((sections || []).map(section => [section.section_key, section])), [sections]);

  return (
    <div className="p-8 mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-white/10 bg-[#b5e3f4] p-6 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#800020] dark:text-slate-400">AMI Public Website</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[#800000] dark:text-slate-100">Manage the main NDOVERA website</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-[#191970] dark:text-slate-300">
          This editor controls the AMI-managed NDOVERA website at ndovera.com. Tenant school websites remain separate and continue to be managed by each tenant owner inside their own website settings.
        </p>
      </section>

      {loading ? <p className="text-sm text-[#800020] dark:text-slate-400">Loading website sections...</p> : null}
      {error ? <p className="rounded-2xl border border-red-300/30 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-200">{error}</p> : null}

      <GrowthPartnersAdmin />

      <OpportunitiesManager allowTenantField />

      <div className="grid gap-5 xl:grid-cols-2">
        {SECTION_DEFINITIONS.map(section => (
          <SectionEditor key={section.key} section={section} data={sectionsByKey[section.key]} onSaved={loadSections} />
        ))}
      </div>
    </div>
  );
}