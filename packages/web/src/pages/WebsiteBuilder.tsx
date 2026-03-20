import React, { useState, useEffect, useRef } from 'react';
import { 
  Briefcase,
  Globe, 
  Layout as LayoutIcon, 
  Type, 
  Image as ImageIcon, 
  Palette, 
  Save,
  Eye,
  Plus,
  Trash2,
  ChevronRight,
  Settings,
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { WebsitePage, WebsiteSection, SchoolWebsite } from '../types';

const isVacancyPageSlug = (value?: string) => ['opportunities', 'opportunity', 'vacancies', 'vacancy', 'careers', 'jobs'].includes(String(value || '').trim().toLowerCase());
const hexToRgba = (value: string | undefined, alpha: number) => {
  const hex = String(value || '#10b981').replace('#', '').trim();
  const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex.padEnd(6, '0').slice(0, 6);
  const numeric = Number.parseInt(normalized, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const DEFAULT_WEBSITE: SchoolWebsite = {
  schoolId: '1',
  theme: {
    primaryColor: '#10b981',
    fontFamily: 'Inter',
  },
  pages: [
    {
      id: 'p1',
      title: 'Home',
      slug: 'home',
      sections: [
        { id: 's1', type: 'hero', content: { title: 'Welcome to Ndovera Academy', subtitle: 'Excellence in Education and Character' } },
        { id: 's2', type: 'about', content: { text: 'We provide a world-class education for the next generation of leaders.' } }
      ]
    },
    {
      id: 'p2',
      title: 'Admissions',
      slug: 'admissions',
      sections: [
        { id: 's3', type: 'hero', content: { title: 'Join Our Community', subtitle: 'Admissions for 2026/2027 are now open.' } }
      ]
    }
  ]
};

export const WebsiteBuilder = () => {
  const [website, setWebsite] = useState<SchoolWebsite>(DEFAULT_WEBSITE);
  const [activePageId, setActivePageId] = useState<string>(DEFAULT_WEBSITE.pages[0].id);
  const [activeTab, setActiveTab] = useState<'content' | 'layout' | 'theme' | 'pages' | 'events' | 'faq' | 'carousel' | 'testimonials' | 'vacancies'>('content');
  const [isPreview, setIsPreview] = useState(false);
  const [previewPageId, setPreviewPageId] = useState<string>(DEFAULT_WEBSITE.pages[0].id);

  const [isPublishing, setIsPublishing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshotRef = useRef<string>(JSON.stringify(website));
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);

  const activePage = website.pages.find(p => p.id === activePageId) || website.pages[0];
  const [events, setEvents] = useState<any[]>([]);
  const [eventForm, setEventForm] = useState<{ title: string; date: string; description: string; image?: File | null }>({ title: '', date: '', description: '', image: null });
  const [faqs, setFaqs] = useState<any[]>([]);
  const [faqForm, setFaqForm] = useState<{ question: string; answer: string }>({ question: '', answer: '' });
  const [contactForm, setContactForm] = useState<{ name: string; email: string; message: string }>({ name: '', email: '', message: '' });
  const [carouselItems, setCarouselItems] = useState<string[]>((website as any)?.carousel || [] as string[]);
  const [testimonialsList, setTestimonialsList] = useState<any[]>([]);
  const [vacancies, setVacancies] = useState<any[]>([]);

  const addPage = () => {
    const newPage: WebsitePage = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Page',
      slug: 'new-page',
      sections: []
    };
    setWebsite({ ...website, pages: [...website.pages, newPage] });
    setActivePageId(newPage.id);
  };

  const deletePage = (id: string) => {
    if (website.pages.length <= 1) return;
    const newPages = website.pages.filter(p => p.id !== id);
    setWebsite({ ...website, pages: newPages });
    if (activePageId === id) setActivePageId(newPages[0].id);
  };

  const addSection = (type: WebsiteSection['type']) => {
    const newSection: WebsiteSection = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: { title: 'New Section', subtitle: 'Edit this content' }
    };
    const newPages = website.pages.map(p => {
      if (p.id === activePageId) {
        return { ...p, sections: [...p.sections, newSection] };
      }
      return p;
    });
    setWebsite({ ...website, pages: newPages });
  };

  const handlePublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 2000);
  };

  const saveWebsite = async () => {
    setIsPublishing(true);
    try {
      const resp = await fetch('/api/schools/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: website.schoolId,
          website_config: website,
          primary_color: website.theme.primaryColor,
          logo_url: website.theme.logoUrl || null
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'save failed');
      setToast({ message: 'Site saved', type: 'success' });
      initialSnapshotRef.current = JSON.stringify(website);
      setIsDirty(false);
    } catch (err) {
      console.error('Save failed', err);
      setToast({ message: 'Save failed: ' + String(err), type: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  // load events on mount
  React.useEffect(() => {
    (async () => {
      try {
        const [eventsResp, vacanciesResp] = await Promise.all([
          fetch(`/api/schools/${website.schoolId}/events`),
          fetch(`/api/schools/${website.schoolId}/vacancies`),
        ]);
        if (eventsResp.ok) {
          const data = await eventsResp.json();
          setEvents(data.events || []);
        }
        if (vacanciesResp.ok) {
          const vacancyData = await vacanciesResp.json();
          setVacancies(vacancyData.vacancies || []);
        }
      } catch (e) {
        console.warn('failed to load events/vacancies', e);
      }
    })();
  }, [website.schoolId]);

  // load faqs, testimonials
  useEffect(() => {
    (async () => {
      try {
        const fid = website.schoolId;
        const fresp = await fetch(`/api/schools/${fid}/faqs`);
        if (fresp.ok) { const fd = await fresp.json(); setFaqs(fd.faqs || []); }
        const tresp = await fetch(`/api/schools/${fid}/testimonials`);
        if (tresp.ok) { const td = await tresp.json(); setTestimonialsList(td.testimonials || []); }
      } catch (e) { console.warn('failed to load faq/testimonials', e); }
    })();
  }, [website.schoolId]);

  useEffect(() => {
    try {
      setIsDirty(JSON.stringify(website) !== initialSnapshotRef.current);
    } catch (e) {
      setIsDirty(false);
    }
  }, [website]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const previewPages = [
    ...website.pages,
    ...(!website.pages.some((page) => isVacancyPageSlug(page.slug) || isVacancyPageSlug(page.title)) && vacancies.length ? [{ id: 'vacancies_public', title: 'Opportunities', slug: 'opportunities', sections: [] }] : []),
  ];
  const previewPage = previewPages.find((page: any) => page.id === previewPageId) || previewPages[0];
  const previewIsVacancies = isVacancyPageSlug(previewPage?.slug) || isVacancyPageSlug(previewPage?.title) || previewPage?.id === 'vacancies_public';
  const brandColor = website.theme?.primaryColor || '#10b981';
  const brandSoft = hexToRgba(brandColor, 0.12);
  const brandBorder = hexToRgba(brandColor, 0.24);
  const brandGlow = hexToRgba(brandColor, 0.18);

  if (isPreview) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0B0D] overflow-y-auto">
        {showSuccess && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-60 bg-emerald-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl animate-in fade-in slide-in-from-top-4">
            Site Published Successfully!
          </div>
        )}
        <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPreview(false)}
              className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"
            >
              <ArrowLeft size={20} />
            </button>
            <span className="text-sm font-bold text-white">Previewing: {activePage.title}</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handlePublish}
              disabled={isPublishing}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {isPublishing ? 'Publishing...' : 'Publish Site'}
            </button>
          </div>
        </div>
        
        {/* Actual Website Preview Content */}
        <div className="min-h-screen bg-white text-zinc-900">
          <nav className="p-6 flex items-center justify-between border-b border-zinc-100">
            <div className="text-xl font-bold text-emerald-600">NDOVERA</div>
            <div className="flex gap-8">
              {previewPages.map((p: any) => (
                <button 
                  key={p.id} 
                  onClick={() => setPreviewPageId(p.id)}
                  className={`text-sm font-medium ${previewPage?.id === p.id ? 'text-emerald-600 underline' : 'text-zinc-500'}`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </nav>

          {previewIsVacancies ? (
            <div className="mx-auto max-w-6xl px-8 py-20">
              <div className="max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ background: brandSoft, color: brandColor }}>
                  <Briefcase size={14} /> Public Careers Page
                </div>
                <h1 className="text-5xl font-black tracking-tight">Current Opportunities</h1>
                <p className="text-lg text-zinc-500">Vacancies posted from the school dashboard are rendered here automatically for the public website.</p>
              </div>
              <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {vacancies.length ? vacancies.map((vacancy) => (
                  <div key={vacancy.id} className="rounded-3xl border bg-zinc-50 p-8" style={{ borderColor: brandBorder, boxShadow: `0 18px 40px ${brandGlow}` }}>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ background: brandSoft, color: brandColor }}>{vacancy.category}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] text-zinc-500">{vacancy.type}</span>
                    </div>
                    <h2 className="mt-5 text-2xl font-bold">{vacancy.title}</h2>
                    <p className="mt-4 text-sm leading-7 text-zinc-600">{vacancy.description}</p>
                    <div className="mt-6 flex items-center justify-between gap-4 border-t border-zinc-200 pt-5">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Salary</div>
                        <div className="text-sm font-semibold text-zinc-900">{vacancy.salary || 'Competitive'}</div>
                      </div>
                      <button className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: brandColor }}>Apply Now</button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-3xl border border-dashed border-zinc-200 px-8 py-16 text-center text-zinc-400">No vacancies have been published yet.</div>
                )}
              </div>
            </div>
          ) : previewPage?.sections.map((section: any) => (
            <div key={section.id} className="py-20 px-8 max-w-5xl mx-auto">
              {section.type === 'hero' && (
                <div className="text-center space-y-6">
                  <h1 className="text-6xl font-black tracking-tight">{section.content.title}</h1>
                  <p className="text-xl text-zinc-500">{section.content.subtitle}</p>
                  <button className="bg-emerald-600 text-white px-8 py-4 rounded-full font-bold hover:bg-emerald-500 transition-colors">Get Started</button>
                </div>
              )}
              {section.type === 'about' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div className="space-y-4">
                    <h2 className="text-3xl font-bold">About Our School</h2>
                    <p className="text-zinc-600 leading-relaxed">{section.content.text}</p>
                  </div>
                  <div className="bg-zinc-100 aspect-video rounded-3xl flex items-center justify-center text-zinc-300">
                    <ImageIcon size={48} />
                  </div>
                </div>
              )}
              {section.type === 'features' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="p-8 bg-zinc-50 rounded-3xl space-y-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: brandSoft, color: brandColor }}>
                        <LayoutIcon size={24} />
                      </div>
                      <h3 className="font-bold text-lg">Feature {i}</h3>
                      <p className="text-sm text-zinc-500">High-quality educational programs designed for modern learning.</p>
                    </div>
                  ))}
                </div>
              )}
              {section.type === 'contact' && (
                <div className="max-w-2xl mx-auto bg-zinc-900 text-white rounded-3xl p-12 space-y-8">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold">Contact Us</h2>
                    <p className="text-zinc-400 mt-2">Have questions? We're here to help.</p>
                  </div>
                    <div className="space-y-4">
                      <div>
                        <label className="sr-only">Your Name</label>
                        <input value={contactForm.name} onChange={(e) => setContactForm(f => ({ ...f, name: e.target.value }))} type="text" aria-label="Your name" className="w-full bg-white/10 border border-white/10 rounded-xl p-4 outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="sr-only">Email address</label>
                        <input value={contactForm.email} onChange={(e) => setContactForm(f => ({ ...f, email: e.target.value }))} type="email" aria-label="Email address" className="w-full bg-white/10 border border-white/10 rounded-xl p-4 outline-none focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="sr-only">Message</label>
                        <textarea value={contactForm.message} onChange={(e) => setContactForm(f => ({ ...f, message: e.target.value }))} aria-label="Message" className="w-full bg-white/10 border border-white/10 rounded-xl p-4 outline-none focus:border-emerald-500 h-32"></textarea>
                      </div>
                      <button onClick={async () => {
                        if (!contactForm.email || !contactForm.message) return alert('Email and message are required');
                        try {
                          const resp = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: contactForm.name, email: contactForm.email, message: contactForm.message, school_id: website.schoolId }) });
                          const d = await resp.json(); if (!resp.ok) throw new Error(d?.error || 'send failed');
                          setToast({ message: 'Message sent', type: 'success' });
                          setContactForm({ name: '', email: '', message: '' });
                        } catch (err) { console.error(err); alert('Send failed'); }
                      }} className="w-full bg-emerald-600 py-4 rounded-xl font-bold hover:bg-emerald-500 transition-colors">Send Message</button>
                    </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">School Website Builder</h2>
          <p className="text-zinc-500 text-xs">Customize your school's public presence.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => setIsPreview(true)}
            className="bg-white/5 border border-white/5 text-zinc-400 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-white/10 transition-all"
          >
            <Eye size={14} /> Preview
          </button>
          <button onClick={saveWebsite} disabled={!isDirty || isPublishing} className="bg-emerald-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/20">
            <Save size={14} /> {isPublishing ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
          </button>
          {toast && (
            <div className={`ml-3 px-3 py-1 rounded text-sm ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
              {toast.message}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Editor Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Editor Tools</h3>
            <div className="space-y-1">
              {[
                { id: 'pages', label: 'Pages', icon: <Globe size={16} /> },
                { id: 'content', label: 'Page Content', icon: <Type size={16} /> },
                { id: 'layout', label: 'Layout Blocks', icon: <LayoutIcon size={16} /> },
                { id: 'theme', label: 'Branding', icon: <Palette size={16} /> },
                  { id: 'vacancies', label: 'Vacancies Page', icon: <Briefcase size={16} /> },
                { id: 'events', label: 'Events', icon: <Calendar size={16} /> },
                { id: 'faq', label: 'FAQ', icon: <MessageSquare size={16} /> },
                { id: 'carousel', label: 'Carousel', icon: <ImageIcon size={16} /> },
                { id: 'testimonials', label: 'Testimonials', icon: <MessageSquare size={16} /> },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTab(tool.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    activeTab === tool.id ? 'bg-emerald-600/10 text-emerald-500 border border-emerald-500/20' : 'text-zinc-500 hover:bg-white/5'
                  }`}
                >
                  {tool.icon}
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

              {activeTab === 'theme' && (
                <div className="card-compact animate-in fade-in slide-in-from-left-2 duration-300">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Branding</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                        <img src={previewUrl || website.theme.logoUrl || '/logo.png'} alt="logo" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] text-zinc-400">School Logo</p>
                        <p className="text-[10px] text-zinc-500">PNG or JPEG. Max 6MB. Will be resized automatically.</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files ? e.target.files[0] : null;
                          setSelectedFile(f);
                          if (f) setPreviewUrl(URL.createObjectURL(f));
                        }}
                        className="text-sm text-zinc-400"
                      />
                      <button
                        onClick={async () => {
                          if (!selectedFile) return;
                          setUploading(true);
                          try {
                            const fd = new FormData();
                            fd.append('logo', selectedFile);
                            fd.append('school_id', website.schoolId);
                            const resp = await fetch('/api/uploads/logo', { method: 'POST', body: fd });
                            const data = await resp.json();
                            if (!resp.ok) throw new Error(data?.error || 'upload failed');
                            const large = data.urls?.large;
                            if (large) {
                              // update local state preview and website theme
                              setWebsite(prev => ({ ...prev, theme: { ...prev.theme, logoUrl: large } }));
                              setPreviewUrl(large);
                              setToast({ message: 'Logo uploaded', type: 'success' });
                            }
                            setSelectedFile(null);
                          } catch (err) {
                            console.error('Upload failed', err);
                            alert('Upload failed: ' + String(err));
                          } finally {
                            setUploading(false);
                          }
                        }}
                        disabled={uploading || !selectedFile}
                        className="bg-emerald-600 disabled:opacity-50 text-white px-3 py-2 rounded"
                      >
                        {uploading ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

          {activeTab === 'pages' && (
            <div className="card-compact animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Site Pages</h3>
                <button onClick={addPage} className="p-1 hover:bg-white/5 rounded text-emerald-500">
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {website.pages.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => setActivePageId(p.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                      activePageId === p.id ? 'bg-white/5 border border-white/5' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs text-zinc-300">{p.title}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deletePage(p.id); }}
                      className="text-zinc-600 hover:text-red-500 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="card-compact animate-in fade-in slide-in-from-left-2 duration-300">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">FAQ Manager</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Question</label>
                  <input value={faqForm.question} onChange={(e) => setFaqForm(f => ({ ...f, question: e.target.value }))} className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Answer</label>
                  <textarea value={faqForm.answer} onChange={(e) => setFaqForm(f => ({ ...f, answer: e.target.value }))} className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!faqForm.question || !faqForm.answer) return alert('question and answer required');
                    try {
                      const resp = await fetch(`/api/schools/${website.schoolId}/faqs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: faqForm.question, answer: faqForm.answer }) });
                      const data = await resp.json();
                      if (!resp.ok) throw new Error(data?.error || 'save failed');
                      setFaqs(prev => [data.faq, ...prev]);
                      setFaqForm({ question: '', answer: '' });
                      setToast({ message: 'FAQ added', type: 'success' });
                    } catch (err) {
                      console.error(err); alert('FAQ save failed');
                    }
                  }} className="bg-emerald-600 text-white px-3 py-1 rounded">Add FAQ</button>
                </div>
                <div className="mt-3 space-y-2">
                  {faqs.map(f => (
                    <div key={f.id} className="rounded bg-white/2 p-2">
                      <div className="text-sm font-bold text-white">{f.question}</div>
                      <div className="text-xs text-zinc-400">{f.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="card-compact animate-in fade-in slide-in-from-left-2 duration-300">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Events</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Title</label>
                  <input value={eventForm.title} onChange={(e) => setEventForm(f => ({ ...f, title: e.target.value }))} className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Date</label>
                  <input type="date" value={eventForm.date} onChange={(e) => setEventForm(f => ({ ...f, date: e.target.value }))} className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Description</label>
                  <textarea value={eventForm.description} onChange={(e) => setEventForm(f => ({ ...f, description: e.target.value }))} className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={(e) => setEventForm(f => ({ ...f, image: e.target.files ? e.target.files[0] : null }))} />
                  <button onClick={async () => {
                    if (!eventForm.title) return alert('Title required');
                    const fd = new FormData();
                    fd.append('title', eventForm.title);
                    fd.append('date', eventForm.date || '');
                    fd.append('description', eventForm.description || '');
                    fd.append('school_id', website.schoolId);
                    if (eventForm.image) fd.append('image', eventForm.image);
                    try {
                      const resp = await fetch(`/api/schools/${website.schoolId}/events`, { method: 'POST', body: fd });
                      const data = await resp.json();
                      if (!resp.ok) throw new Error(data?.error || 'create event failed');
                      setEvents(prev => [data.event, ...prev]);
                      setEventForm({ title: '', date: '', description: '', image: null });
                      setToast({ message: 'Event created', type: 'success' });
                    } catch (err) {
                      console.error(err); alert('Event create failed');
                    }
                  }} className="bg-emerald-600 text-white px-3 py-1 rounded disabled:opacity-50">Create Event</button>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs text-zinc-400 uppercase mb-2">Existing Events</h4>
                  <div className="space-y-2">
                    {events.map(ev => (
                      <div key={ev.id} className="flex items-center gap-3 rounded bg-white/2 p-2">
                        {ev.image && <img src={ev.image} className="w-16 h-10 object-cover rounded" />}
                        <div>
                          <div className="font-bold text-sm text-white">{ev.title}</div>
                          <div className="text-xs text-zinc-500">{ev.date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vacancies' && (
            <div className="card-compact animate-in fade-in slide-in-from-left-2 duration-300">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Vacancies Website Page</h3>
              <div className="space-y-3 text-sm text-zinc-400">
                <p>Vacancies created from the school dashboard are now rendered automatically on a dedicated public opportunities page.</p>
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: brandColor }}>Published Opportunities</div>
                  <div className="mt-2 text-2xl font-bold text-white">{vacancies.length}</div>
                  <p className="mt-2 text-xs text-zinc-500">If your website does not already have an Opportunities/Careers page, preview mode will add one automatically.</p>
                </div>
                <div className="space-y-2">
                  {vacancies.length ? vacancies.map((vacancy) => (
                    <div key={vacancy.id} className="rounded-xl border border-white/5 bg-white/2 p-3">
                      <div className="text-sm font-bold text-white">{vacancy.title}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">{vacancy.category} • {vacancy.type}</div>
                    </div>
                  )) : <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">No school vacancy has been posted yet.</div>}
                </div>
              </div>
            </div>
          )}



          {activeTab === 'carousel' && (
            <div className="card-compact animate-in fade-in slide-in-from-left-2 duration-300">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Homepage Carousel</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    (async () => {
                      const fd = new FormData(); fd.append('image', f); fd.append('school_id', website.schoolId);
                      const r = await fetch('/api/uploads/media', { method: 'POST', body: fd }); const d = await r.json();
                      if (!r.ok) throw new Error(d?.error || 'upload failed');
                      // add to carouselItems and update website state
                      setCarouselItems(prev => { const next = [d.url, ...prev]; setWebsite(w => ({ ...w, pages: w.pages || [], carousel: next } as any)); return next; });
                      setToast({ message: 'Carousel image uploaded', type: 'success' });
                    })().catch(err => { console.error(err); alert('Upload failed'); });
                  }} />
                </div>
                <div className="mt-4">
                  <h4 className="text-xs text-zinc-400 uppercase mb-2">Carousel Images</h4>
                  <div className="flex gap-3 flex-wrap">
                    {carouselItems.map((src, i) => (
                      <div key={i} className="w-36 h-24 rounded overflow-hidden bg-white/5">
                        <img src={src} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <button onClick={async () => { await saveWebsite(); setToast({ message: 'Carousel saved', type: 'success' }); }} className="bg-emerald-600 text-white px-3 py-1 rounded">Save Carousel</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'testimonials' && (
            <div className="card-compact animate-in fade-in slide-in-from-left-2 duration-300">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Testimonials</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Add Testimonial</label>
                  <div>
                    <label className="sr-only" htmlFor="t-author">Author</label>
                    <input id="t-author" aria-label="Testimonial author" className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm mb-2" />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="t-role">Role</label>
                    <input id="t-role" aria-label="Author role" className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm mb-2" />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="t-quote">Quote</label>
                    <textarea id="t-quote" aria-label="Testimonial quote" className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm mb-2" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      const author = (document.getElementById('t-author') as HTMLInputElement).value;
                      const role = (document.getElementById('t-role') as HTMLInputElement).value;
                      const quote = (document.getElementById('t-quote') as HTMLTextAreaElement).value;
                      if (!quote) return alert('quote required');
                      try {
                        const resp = await fetch(`/api/schools/${website.schoolId}/testimonials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ author, role, quote, featured: false }) });
                        const d = await resp.json(); if (!resp.ok) throw new Error(d?.error || 'failed');
                        setTestimonialsList(prev => [d.testimonial, ...prev]);
                        setToast({ message: 'Testimonial added', type: 'success' });
                        (document.getElementById('t-author') as HTMLInputElement).value = '';
                        (document.getElementById('t-role') as HTMLInputElement).value = '';
                        (document.getElementById('t-quote') as HTMLTextAreaElement).value = '';
                      } catch (err) { console.error(err); alert('Failed to add'); }
                    }} className="bg-emerald-600 text-white px-3 py-1 rounded">Add</button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs text-zinc-400 uppercase mb-2">Manage Testimonials</h4>
                  <div className="space-y-2">
                    {testimonialsList.map(t => (
                      <div key={t.id} className="flex items-center justify-between rounded bg-white/2 p-2">
                        <div>
                          <div className="font-bold text-sm text-white">{t.author} {t.role ? `— ${t.role}` : ''}</div>
                          <div className="text-xs text-zinc-400">{t.quote}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-400 mr-2">Feature</label>
                          <input type="checkbox" checked={!!t.featured} onChange={async (e) => {
                            try {
                              const resp = await fetch(`/api/schools/${website.schoolId}/testimonials/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: e.target.checked }) });
                              const d = await resp.json(); if (!resp.ok) throw new Error(d?.error || 'update failed');
                              setTestimonialsList(prev => prev.map(x => x.id === t.id ? d.testimonial : x));
                              setToast({ message: 'Updated', type: 'success' });
                            } catch (err) { console.error(err); alert('update failed'); }
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card-compact bg-emerald-600/5 border-emerald-500/10">
            <p className="text-[10px] font-bold text-emerald-500 uppercase mb-2">Public URL</p>
            <p className="text-xs font-mono text-white truncate">ndovera-academy.ndovera.com</p>
            <button className="mt-3 text-[10px] font-bold text-zinc-500 hover:text-white flex items-center gap-1">
              <ExternalLink size={12} /> Visit Site
            </button>
          </div>
        </div>

        {/* Editor Canvas */}
        <div className="lg:col-span-3 space-y-6">
          <div className="min-h-150 rounded-3xl border border-white/5 bg-white/5 p-8">
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                  <LayoutIcon size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{activePage.title}</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">/{activePage.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400 mr-2">Page Images</label>
                <input type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try {
                    const fd = new FormData(); fd.append('image', f);
                    const resp = await fetch(`/api/schools/${website.schoolId}/website/pages/${activePage.id}/images`, { method: 'POST', body: fd });
                    const d = await resp.json(); if (!resp.ok) throw new Error(d?.error || 'upload failed');
                    // update local website state
                    setWebsite(prev => {
                      const pages = prev.pages.map(p => p.id === activePage.id ? { ...p, images: [...(((p as any).images)||[]), d.url] } : p);
                      return { ...prev, pages } as any;
                    });
                    setToast({ message: 'Page image uploaded', type: 'success' });
                  } catch (err) { console.error(err); alert('upload failed'); }
                }} />
                <button className="p-2 text-zinc-600 hover:text-white transition-colors">
                  <Settings size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {activePage.sections.length > 0 ? (
                activePage.sections.map((section, idx) => (
                  <div key={section.id} className="group relative rounded-2xl border border-white/5 bg-white/2 p-6 transition-all hover:border-emerald-500/30">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-1">
                      <button className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white border border-white/5 shadow-xl">
                        <Plus size={12} />
                      </button>
                    </div>
                    
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">
                          {section.type}
                        </span>
                      </div>
                      <button className="text-zinc-600 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {section.type === 'hero' && (
                      <div className="space-y-4">
                        <input 
                          type="text" 
                          value={section.content.title}
                          className="w-full bg-transparent text-xl font-bold text-white outline-none border-b border-transparent focus:border-emerald-500/30 pb-1"
                        />
                        <textarea 
                          value={section.content.subtitle}
                          className="w-full bg-transparent text-sm text-zinc-500 outline-none border-b border-transparent focus:border-emerald-500/30 resize-none h-12"
                        />
                      </div>
                    )}

                    {section.type === 'about' && (
                      <div className="space-y-4">
                        <textarea 
                          value={section.content.text}
                          className="w-full bg-transparent text-sm text-zinc-500 outline-none border-b border-transparent focus:border-emerald-500/30 resize-none h-24"
                        />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-700 mb-4">
                    <Plus size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-400">No sections yet</h4>
                  <p className="text-xs text-zinc-600 mt-1">Add a section from the library below.</p>
                </div>
              )}
            </div>

            {/* Block Library */}
            <div className="mt-12 pt-12 border-t border-white/5">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Add New Section</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { type: 'hero', label: 'Hero Section' },
                  { type: 'about', label: 'About Us' },
                  { type: 'features', label: 'Features' },
                  { type: 'contact', label: 'Contact Form' }
                ].map((block) => (
                  <button 
                    key={block.type}
                    onClick={() => addSection(block.type as any)}
                    className="card-mini border-dashed flex flex-col items-center justify-center py-6 hover:bg-white/5 transition-colors group"
                  >
                    <LayoutIcon size={20} className="text-zinc-600 group-hover:text-emerald-500 transition-all mb-2" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{block.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
