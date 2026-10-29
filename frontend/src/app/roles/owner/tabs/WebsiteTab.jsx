import React, { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeGalleryItems, saveGalleryItems } from '../../../../features/school/website/galleryMetadata';
import { getWebsiteSections, saveWebsiteSection, uploadSectionImage } from '../../../../features/school/services/schoolApi';

const SECTION_KEYS = [
  {
    key: 'hero',
    label: 'Homepage Hero',
    desc: 'Full-screen first impression with linked CTAs and up to 5 scrollable hero images or videos.',
    mediaLabel: 'Hero Pictures / Videos',
    fields: ['eyebrow', 'button', 'secondaryButton', 'gallery'],
    multiple: true,
    maxFiles: 5,
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

function uniqueLines(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean)));
}

function getCombinedMediaUrls(primaryUrl, mediaValue, maxFiles = 0) {
  const combined = uniqueLines([primaryUrl, ...toLines(mediaValue)]);
  return maxFiles > 0 ? combined.slice(0, maxFiles) : combined;
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
    secondaryButtonLabel: '',
    secondaryButtonUrl: '',
    videoUrl: '',
    programs: '',
    mediaUrls: '',
    galleryItems: [],
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
      secondaryButtonLabel: meta.secondaryButtonLabel || '',
      secondaryButtonUrl: meta.secondaryButtonUrl || '',
      videoUrl: meta.videoUrl || '',
      programs: asLines(meta.programs),
      mediaUrls: asLines(meta.mediaUrls),
      galleryItems: normalizeGalleryItems(meta, data?.image_url),
      address: meta.address || '',
      phone: meta.phone || '',
      email: meta.email || '',
      popup: !!meta.popup,
    });
  }, [data, section.key]);

  const metadata = useMemo(() => ({
    ...parseMeta(data?.metadata),
    eyebrow: form.eyebrow,
    buttonLabel: form.buttonLabel,
    buttonUrl: form.buttonUrl,
    secondaryButtonLabel: form.secondaryButtonLabel,
    secondaryButtonUrl: form.secondaryButtonUrl,
    videoUrl: form.videoUrl,
    programs: toLines(form.programs),
    ...((section.key === 'gallery')
      ? saveGalleryItems({}, getCombinedMediaUrls(form.imageUrl, form.mediaUrls).map(url => form.galleryItems.find(item => item.url === url) || { url, caption: '', album: '' }))
      : { mediaUrls: getCombinedMediaUrls(form.imageUrl, form.mediaUrls, section.maxFiles || 0) }),
    address: form.address,
    phone: form.phone,
    email: form.email,
    flyerUrl: section.key === 'admission_flyer' ? form.imageUrl : undefined,
    popup: section.key === 'admission_flyer' ? !!form.popup : undefined,
  }), [form, data?.metadata, section.key, section.maxFiles]);

  async function uploadOne(file, appendToGallery = false) {
    const result = await uploadSectionImage(file, section.key);
    if (appendToGallery) {
      setForm(f => ({
        ...f,
        mediaUrls: uniqueLines([...toLines(f.mediaUrls), result.url]).join('\n'),
        imageUrl: f.imageUrl || result.url,
      }));
      return;
    }
    setForm(f => ({ ...f, imageUrl: result.url }));
  }

  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const currentMedia = getCombinedMediaUrls(form.imageUrl, form.mediaUrls, 0);
    const remainingSlots = section.maxFiles ? Math.max(section.maxFiles - currentMedia.length, 0) : files.length;
    const filesToUpload = section.maxFiles ? files.slice(0, remainingSlots) : files;

    if (!filesToUpload.length) {
      setMsg(`You can upload up to ${section.maxFiles} files for this section.`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    setMsg('');
    try {
      // Accumulate upload results before updating React state. A failed file must
      // not erase earlier successful uploads, and each URL is recorded only once.
      const uploaded = [];
      const failures = [];
      for (const file of filesToUpload) {
        try {
          const result = await uploadSectionImage(file, section.key);
          if (!result?.url) throw new Error('Upload returned no media URL.');
          uploaded.push(result.url);
        } catch (error) {
          failures.push(`${file.name}: ${error.message || 'Upload failed'}`);
        }
      }
      if (uploaded.length) {
        setForm(previous => {
          if (!section.multiple) return { ...previous, imageUrl: uploaded[uploaded.length - 1] };
          const urls = uniqueLines([...getCombinedMediaUrls(previous.imageUrl, previous.mediaUrls), ...uploaded]);
          const capped = section.maxFiles ? urls.slice(0, section.maxFiles) : urls;
          return {
            ...previous,
            imageUrl: previous.imageUrl || capped[0] || '',
            mediaUrls: capped.join('\\n'),
          };
        });
      }
      const limitNote = filesToUpload.length < files.length ? ` Only ${section.maxFiles} files were allowed.` : '';
      setMsg(`${uploaded.length} uploaded; ${failures.length} failed.${limitNote}${failures.length ? ' ' + failures.join('; ') : ''} Save Section to publish changes.`);
    } catch (error) {
      setMsg(error.message || 'Media upload could not be completed.');
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
      setMsg(err.message || 'Could not save website section.');
    } finally {
      setSaving(false);
    }
  }

  const show = name => section.fields?.includes(name);
  const galleryUrls = getCombinedMediaUrls(form.imageUrl, form.mediaUrls, section.maxFiles || 0);

  return (
    <div className="rounded-2xl p-5 bg-[#b5e3f4] dark:bg-slate-800/40 border border-[#c9a96e]/40 dark:border-white/10 space-y-4">
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
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="bg-[#1a5c38] hover:bg-[#154a2e] text-white font-bold px-4 py-1.5 rounded-xl text-xs transition-colors disabled:opacity-60">
              {uploading ? 'Uploading...' : section.multiple ? 'Upload Media' : 'Upload File'}
            </button>
            <input ref={fileRef} type="file" accept={section.accept || 'image/*,video/*'} multiple={!!section.multiple} className="hidden" onChange={handleMediaUpload} />
            {section.maxFiles ? <span className="text-xs text-[#800020] font-semibold">Up to {section.maxFiles} files</span> : null}
            {form.imageUrl && !section.multiple ? <span className="text-xs text-[#1a5c38] font-semibold">Primary media set</span> : null}
          </div>
          {!section.multiple ? <MediaPreview url={form.imageUrl} label={section.label} /> : null}
        </div>

        {section.key === 'admission_flyer' && (
          <label className="flex items-start gap-2 text-sm text-[#191970] dark:text-slate-200 bg-[#fff8ee] dark:bg-slate-900/40 rounded-xl p-3 border border-[#c9a96e]/40 dark:border-white/10">
            <input type="checkbox" checked={!!form.popup} onChange={e => setForm(f => ({ ...f, popup: e.target.checked }))} className="mt-0.5" />
            <span>Show this flier as a pop-up on the homepage. Visitors see it when they arrive and can close it.</span>
          </label>
        )}

        <div>
          <label className={labelClass}>YouTube / Video URL</label>
          <input value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} className={inputClass} placeholder="https://www.youtube.com/watch?v=..." />
          <MediaPreview url={form.videoUrl} label={`${section.label} video`} />
        </div>

        {show('button') && (
          <div className="space-y-3">
            <p className="text-xs text-[#800020] dark:text-slate-400">Leave button links blank to auto-link them to the matching website page.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Button Text</label>
                <input value={form.buttonLabel} onChange={e => setForm(f => ({ ...f, buttonLabel: e.target.value }))} className={inputClass} placeholder="Learn More" />
              </div>
              <div>
                <label className={labelClass}>Button Link</label>
                <input value={form.buttonUrl} onChange={e => setForm(f => ({ ...f, buttonUrl: e.target.value }))} className={inputClass} placeholder="Leave blank to auto-link" />
              </div>
            </div>
            {show('secondaryButton') ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Secondary Button Text</label>
                  <input value={form.secondaryButtonLabel} onChange={e => setForm(f => ({ ...f, secondaryButtonLabel: e.target.value }))} className={inputClass} placeholder="Apply / Enquire" />
                </div>
                <div>
                  <label className={labelClass}>Secondary Button Link</label>
                  <input value={form.secondaryButtonUrl} onChange={e => setForm(f => ({ ...f, secondaryButtonUrl: e.target.value }))} className={inputClass} placeholder="Leave blank to auto-link" />
                </div>
              </div>
            ) : null}
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
            <label className={labelClass}>{section.key === 'hero' ? 'Hero Media URLs' : 'Gallery Media URLs'}</label>
            <textarea rows={5} value={form.mediaUrls} onChange={e => setForm(f => ({ ...f, mediaUrls: e.target.value }))} className={`${inputClass} resize-none`} placeholder="Upload files above, or paste one URL per line." />
            {galleryUrls.length > 0 && (
              <div className={section.key === 'hero' ? 'mt-3 flex gap-3 overflow-x-auto pb-2' : 'mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3'}>
                {galleryUrls.map((url, index) => (
                  <div key={url} className={section.key === 'hero' ? 'min-w-[220px] max-w-[220px] shrink-0' : 'min-w-0 rounded-xl border border-[#c9a96e]/50 bg-[#fff8ee] dark:bg-slate-900 p-2'}>
                    <MediaPreview url={url} label={section.key === 'hero' ? 'Hero media' : `Gallery media ${index + 1}`} />
                    {section.key === 'gallery' && (
                      <div className="mt-2 space-y-2">
                        <label className="block text-xs font-semibold text-[#191970]">Caption
                          <input className={inputClass} value={form.galleryItems.find(item => item.url === url)?.caption || ''} onChange={e => setForm(f => ({ ...f, galleryItems: [...f.galleryItems.filter(item => item.url !== url), { ...(f.galleryItems.find(item => item.url === url) || { url }), caption: e.target.value }] }))} placeholder="Describe this photo or video" />
                        </label>
                        <label className="block text-xs font-semibold text-[#191970]">Album
                          <input className={inputClass} value={form.galleryItems.find(item => item.url === url)?.album || ''} onChange={e => setForm(f => ({ ...f, galleryItems: [...f.galleryItems.filter(item => item.url !== url), { ...(f.galleryItems.find(item => item.url === url) || { url }), album: e.target.value }] }))} placeholder="e.g. Sports Day" />
                        </label>
                        <div className="flex flex-wrap gap-1">
                        <button type="button" disabled={index === 0} onClick={() => setForm(f => {
                          const urls = getCombinedMediaUrls(f.imageUrl, f.mediaUrls);
                          const i = urls.indexOf(url);
                          if (i < 1) return f;
                          [urls[i - 1], urls[i]] = [urls[i], urls[i - 1]];
                          return { ...f, imageUrl: urls[0], mediaUrls: urls.join('\\n') };
                        })} className="rounded-lg bg-[#191970] px-2 py-1 text-xs font-semibold text-white disabled:opacity-40" aria-label={`Move gallery item ${index + 1} earlier`}>Earlier</button>
                        <button type="button" disabled={index === galleryUrls.length - 1} onClick={() => setForm(f => {
                          const urls = getCombinedMediaUrls(f.imageUrl, f.mediaUrls);
                          const i = urls.indexOf(url);
                          if (i < 0 || i >= urls.length - 1) return f;
                          [urls[i], urls[i + 1]] = [urls[i + 1], urls[i]];
                          return { ...f, imageUrl: urls[0], mediaUrls: urls.join('\\n') };
                        })} className="rounded-lg bg-[#191970] px-2 py-1 text-xs font-semibold text-white disabled:opacity-40" aria-label={`Move gallery item ${index + 1} later`}>Later</button>
                        <button type="button" onClick={() => setForm(f => {
                          const urls = getCombinedMediaUrls(f.imageUrl, f.mediaUrls).filter(item => item !== url);
                          return { ...f, imageUrl: urls[0] || '', mediaUrls: urls.join('\\n') };
                        })} className="rounded-lg bg-[#800020] px-2 py-1 text-xs font-semibold text-white" aria-label={`Remove gallery item ${index + 1} from website`}>Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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

        {msg && <p className={`text-xs ${msg === 'Saved.' || (msg.includes('uploaded; 0 failed.') && !msg.startsWith('0 uploaded')) ? 'text-[#1a5c38]' : 'text-red-600'}`}>{msg}</p>}
        <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Section'}
        </button>
      </form>
    </div>
  );
}

function DocRow({ doc, idx, uploading, onTitle, onUpload, onRemove }) {
  const ref = useRef();
  const fileName = doc.url ? String(doc.url).split('/').pop() : '';
  return (
    <div className="rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-900/40 p-3 flex flex-wrap items-center gap-2">
      <input value={doc.title} onChange={e => onTitle(e.target.value)} placeholder={`Document ${idx + 1} title (e.g. Prospectus)`} className="flex-1 min-w-[150px] rounded-lg border border-[#c9a96e]/40 dark:border-white/10 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-[#191970] dark:text-slate-100" />
      <button type="button" onClick={() => ref.current?.click()} disabled={uploading} className="bg-[#1a5c38] text-white font-bold px-3 py-1.5 rounded-lg text-xs disabled:opacity-60">{uploading ? 'Uploading...' : doc.url ? 'Replace' : 'Upload'}</button>
      <input ref={ref} type="file" accept="application/pdf,image/*,.doc,.docx" className="hidden" onChange={e => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
      {doc.url ? <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-[#1a5c38] dark:text-[#00ffff] underline truncate max-w-[150px]">{fileName}</a> : <span className="text-xs text-[#800020] dark:text-slate-400">No file yet</span>}
      <button type="button" onClick={onRemove} className="text-xs text-red-600 font-semibold ml-auto">Remove</button>
    </div>
  );
}

function DocumentsCard({ data, onSaved }) {
  const [sectionTitle, setSectionTitle] = useState('Admission Documents');
  const [intro, setIntro] = useState('');
  const [docs, setDocs] = useState([]);
  const [uploadingIdx, setUploadingIdx] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const meta = parseMeta(data?.metadata);
    setSectionTitle(data?.title || 'Admission Documents');
    setIntro(data?.content || '');
    setDocs(Array.isArray(meta.documents) ? meta.documents.slice(0, 5).map(d => ({ title: d.title || '', url: d.url || '' })) : []);
  }, [data]);

  function setDoc(idx, patch) {
    setDocs(list => list.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  async function handleUpload(idx, file) {
    if (!file) return;
    setUploadingIdx(idx);
    setMsg('');
    try {
      const result = await uploadSectionImage(file, 'admission_documents');
      setDocs(list => list.map((d, i) => (i === idx ? { url: result.url, title: d.title || file.name.replace(/\.[^.]+$/, '') } : d)));
    } catch (err) {
      setMsg(err.message);
    } finally {
      setUploadingIdx(-1);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg('');
    try {
      const cleaned = docs
        .filter(d => String(d.url || '').trim())
        .slice(0, 5)
        .map(d => ({ title: String(d.title || 'Document').trim() || 'Document', url: d.url }));
      await saveWebsiteSection({ sectionKey: 'admission_documents', title: sectionTitle, content: intro, imageUrl: '', metadata: { documents: cleaned } });
      setMsg('Saved.');
      onSaved?.();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl p-5 bg-[#b5e3f4] dark:bg-slate-800/40 border border-[#c9a96e]/40 dark:border-white/10 space-y-4">
      <div>
        <p className="font-bold text-[#800000] dark:text-slate-100">Admission Documents (Downloads)</p>
        <p className="text-xs text-[#800020] dark:text-slate-400">Add up to 5 files (PDF, Word, or image) that visitors can download from the Admissions page. Give each a clear title.</p>
      </div>
      <div>
        <label className={labelClass}>Section Title</label>
        <input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Intro (optional)</label>
        <textarea rows={2} value={intro} onChange={e => setIntro(e.target.value)} className={`${inputClass} resize-none`} placeholder="e.g. Download our prospectus and admission form below." />
      </div>
      <div className="space-y-2">
        {docs.map((doc, idx) => (
          <DocRow
            key={idx}
            doc={doc}
            idx={idx}
            uploading={uploadingIdx === idx}
            onTitle={t => setDoc(idx, { title: t })}
            onUpload={f => handleUpload(idx, f)}
            onRemove={() => setDocs(list => list.filter((_, i) => i !== idx))}
          />
        ))}
        {docs.length < 5 && (
          <button type="button" onClick={() => setDocs(list => (list.length >= 5 ? list : [...list, { title: '', url: '' }]))} className="text-xs font-bold text-[#1a5c38] dark:text-[#00ffff] underline">
            + Add document ({docs.length}/5)
          </button>
        )}
      </div>
      {msg && <p className={`text-xs ${msg === 'Saved.' ? 'text-[#1a5c38]' : 'text-red-600'}`}>{msg}</p>}
      <button type="button" onClick={handleSave} disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-60">
        {saving ? 'Saving...' : 'Save Documents'}
      </button>
    </div>
  );
}

export default function WebsiteTab() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  function load() {
    setLoading(true);
    getWebsiteSections()
      .then(d => { setSections(d?.sections || []); setLoadError(''); })
      .catch(error => { setLoadError(error.message || 'Could not load website sections. Please retry.'); })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function getSectionData(key) {
    return sections.find(s => s.section_key === key) || null;
  }

  if (loading) return <p role="status" className="text-[#800020]">Loading website sections...</p>;
  if (loadError) return <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700"><p>{loadError}</p><button type="button" onClick={load} className="mt-3 rounded-lg bg-[#191970] px-4 py-2 font-bold text-white">Retry</button></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 bg-[#b5e3f4] border border-[#c9a96e]/40">
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
        <DocumentsCard data={getSectionData('admission_documents')} onSaved={load} />
      </div>
    </div>
  );
}
