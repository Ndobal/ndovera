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
  Calendar,
  ShieldCheck
} from 'lucide-react';
import { WebsitePage, WebsiteSection, SchoolWebsite } from '../types';
import { fetchWithAuth, resolveApiUrl } from '../services/apiClient';
import { PUBLIC_NAV_PAGE_ORDER, createCorePublicPages, ensureCorePublicPages, isCorePublicPageId } from './publicSiteDefaults';
import { PAGE_IMPORT_EXAMPLE_JSON, SUPPORTED_PAGE_SECTION_TYPES, SupportedPageImportPage, buildReplacementPage, validatePageImportText } from './pageImport';

const isVacancyPageSlug = (value?: string) => ['opportunities', 'opportunity', 'vacancies', 'vacancy', 'careers', 'jobs'].includes(String(value || '').trim().toLowerCase());
const normalizePageSlug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
  contactInfo: {
    email: 'info@ndovera-academy.edu',
    phone: '+234 800 000 0000',
    address: 'School campus address goes here',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
  },
  theme: {
    primaryColor: '#10b981',
    fontFamily: 'Inter',
    templateVariant: 'signature',
  },
  legal: {
    privacyPolicy: {
      title: 'Privacy Policy',
      lastUpdated: 'March 22, 2026',
      body: [
        'Ndovera collects and uses personal information only to operate the school platform, deliver services, support users, and meet legal or regulatory obligations.',
        'We may process student, parent, staff, and school administrator data that is provided directly by the school, entered by an authorized user, or generated through normal platform activity such as attendance, academic records, billing, communications, and file sharing.',
        'We use administrative, technical, and organizational safeguards designed to protect personal data against unauthorized access, alteration, disclosure, or loss. Access is limited by role, school boundary, and business need.',
        'We do not sell personal information. We may share data with service providers, infrastructure vendors, and authorized school stakeholders only to the extent required to operate the platform or fulfill a legitimate school request.',
        'Schools can start from Ndovera\'s default class hierarchy and then customize display names, aliases, or class arms while keeping the underlying promotion order intact for academic progression and graduation checks.',
        'When a learner is graduated to Alumni, the account may continue to access result records and approved school-wide live engagements, but classroom study spaces remain restricted unless a school-wide event explicitly requires otherwise.',
        'Uploaded media, classroom files, and communication records may be stored, processed, or published using third-party services when the school enables those features. Where a service such as YouTube is used for video publishing, the file may become subject to that provider\'s own policies and terms after upload.',
        'Live meeting capacity, commercial expansion tiers, and internal digital-value settings may be configured by platform administrators. Educational ad rewards and AI usage credits may therefore vary over time based on active system or school settings.',
        'Schools remain responsible for ensuring they have a valid legal basis and the appropriate notices or consents for the personal data they upload or manage through Ndovera. Users should not upload sensitive data unless the school has approved its use.',
        'You may request correction, deletion, export, or restriction of personal data where applicable law and school policy allow it. Requests can be sent to the school administrator or Ndovera support.',
      ].join('\n\n'),
    },
    termsOfService: {
      title: 'Terms of Service',
      lastUpdated: 'March 22, 2026',
      body: [
        'These Terms of Service govern access to and use of the Ndovera platform, including public website pages, school dashboards, classroom tools, media publishing, messaging, and related services.',
        'By using Ndovera, you agree to comply with these Terms, the policies of your school or organization, and all applicable laws. If you use the platform on behalf of a school, you confirm that you are authorized to do so.',
        'Accounts, roles, and permissions are role-based. Users must keep login credentials secure and must not attempt to bypass access controls, impersonate another user, or interfere with platform integrity.',
        'Schools may adopt the default class ladder supplied by Ndovera, including optional stages such as Grade 6 where applicable, and may customize class aliases or arms without changing the underlying promotion hierarchy used by the platform.',
        'Alumni access is intentionally narrower than active student access. Unless a school-wide or alumni-approved live event is opened for them, alumni accounts are limited to result visibility and other alumni-specific functions rather than the full classroom workspace.',
        'Schools are responsible for the accuracy, lawfulness, and appropriateness of the content they upload, publish, or distribute through the platform, including lesson materials, files, announcements, media, and website content.',
        'Video uploads and live class recordings may be published through YouTube when those features are enabled. Once content is uploaded to a third-party provider, that provider may apply its own processing rules, privacy settings, and terms.',
        'Live meeting participant limits, upgrade pricing bands, and internal Keyu conversion rules are set administratively and may be revised without code deployment. Host access to expanded live capacity may depend on an active platform-approved upgrade tier.',
        'Keyu is Ndovera\'s internal digital-value unit for selected AI and reward flows. Exchange settings, AI consumption rates, ad-impression rewards, and settlement rules are determined by platform administration and are not guaranteed to remain fixed.',
        'Ndovera may suspend or restrict access where misuse, security risk, abuse, or policy violations are detected. The platform may also make reasonable changes to improve stability, security, or compliance.',
        'The platform is provided on an "as available" and "as is" basis to the extent permitted by law. Except where prohibited, Ndovera disclaims warranties and limits liability for indirect or consequential damages arising from use of the service.',
        'These Terms can be updated from time to time. The most recent version posted on the website template will govern continued use of the platform.',
      ].join('\n\n'),
    },
  },
  pages: [
    ...createCorePublicPages(),
  ]
};

type PageImportDraft = {
  fileName: string;
  sourcePage: SupportedPageImportPage;
  replacementPage: WebsitePage;
};

export const WebsiteBuilder = () => {
  const [website, setWebsite] = useState<SchoolWebsite>(DEFAULT_WEBSITE);
  const [activePageId, setActivePageId] = useState<string>(DEFAULT_WEBSITE.pages[0].id);
  const [activeTab, setActiveTab] = useState<'content' | 'layout' | 'theme' | 'pages' | 'events' | 'faq' | 'carousel' | 'testimonials' | 'vacancies' | 'legal'>('content');
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
  const [pageImportTargetId, setPageImportTargetId] = useState<string>(DEFAULT_WEBSITE.pages[0].id);
  const [pageImportFile, setPageImportFile] = useState<File | null>(null);
  const [pageImportErrors, setPageImportErrors] = useState<string[]>([]);
  const [pageImportDraft, setPageImportDraft] = useState<PageImportDraft | null>(null);
  const [pageImportPreviewing, setPageImportPreviewing] = useState(false);

  const websitePages = ensureCorePublicPages(website.pages);
  const orderedWebsitePages = PUBLIC_NAV_PAGE_ORDER
    .map((pageId) => websitePages.find((page) => page.id === pageId))
    .filter((page): page is WebsitePage => Boolean(page))
    .concat(websitePages.filter((page) => !PUBLIC_NAV_PAGE_ORDER.includes(page.id as (typeof PUBLIC_NAV_PAGE_ORDER)[number])));
  const targetPageForImport = orderedWebsitePages.find((page) => page.id === pageImportTargetId) || orderedWebsitePages[0];
  const effectiveWebsitePages = pageImportPreviewing && pageImportDraft
    ? orderedWebsitePages.map((page) => page.id === pageImportTargetId ? pageImportDraft.replacementPage : page)
    : orderedWebsitePages;
  const visibleWebsitePages = effectiveWebsitePages.filter((page) => !page.isHidden);
  const activePage = effectiveWebsitePages.find((page) => page.id === activePageId) || effectiveWebsitePages[0];
  const [events, setEvents] = useState<any[]>([]);
  const [eventForm, setEventForm] = useState<{ title: string; date: string; description: string; image?: File | null }>({ title: '', date: '', description: '', image: null });
  const [faqs, setFaqs] = useState<any[]>([]);
  const [faqForm, setFaqForm] = useState<{ question: string; answer: string }>({ question: '', answer: '' });
  const [contactForm, setContactForm] = useState<{ name: string; email: string; message: string }>({ name: '', email: '', message: '' });
  const [carouselItems, setCarouselItems] = useState<string[]>((website as any)?.carousel || [] as string[]);
  const [testimonialsList, setTestimonialsList] = useState<any[]>([]);
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [legalDraft, setLegalDraft] = useState(() => ({
    privacyPolicy: website.legal?.privacyPolicy || DEFAULT_WEBSITE.legal!.privacyPolicy!,
    termsOfService: website.legal?.termsOfService || DEFAULT_WEBSITE.legal!.termsOfService!,
  }));
  const [pageVersionHistory, setPageVersionHistory] = useState<Record<string, WebsitePage[]>>({});

  const updateWebsitePages = (updater: (pages: WebsitePage[]) => WebsitePage[]) => {
    setWebsite((current) => ({
      ...current,
      pages: updater(ensureCorePublicPages(current.pages)),
    }));
  };

  const updatePage = (pageId: string, updater: (page: WebsitePage) => WebsitePage) => {
    updateWebsitePages((pages) => pages.map((page) => page.id === pageId ? updater(page) : page));
  };

  const updatePageField = (pageId: string, field: 'title' | 'slug' | 'isHidden', value: string | boolean) => {
    updatePage(pageId, (page) => ({ ...page, [field]: value }));
  };

  const updateSectionContentField = (pageId: string, sectionId: string, field: string, value: unknown) => {
    updatePage(pageId, (page) => ({
      ...page,
      sections: page.sections.map((section) => section.id === sectionId
        ? { ...section, content: { ...(section.content || {}), [field]: value } }
        : section),
    }));
  };

  const replaceSectionContent = (pageId: string, sectionId: string, nextContent: Record<string, unknown>) => {
    updatePage(pageId, (page) => ({
      ...page,
      sections: page.sections.map((section) => section.id === sectionId
        ? { ...section, content: nextContent }
        : section),
    }));
  };

  const deleteSection = (pageId: string, sectionId: string) => {
    updatePage(pageId, (page) => ({
      ...page,
      sections: page.sections.filter((section) => section.id !== sectionId),
    }));
  };

  const addPage = () => {
    const newPage: WebsitePage = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Page',
      slug: 'new-page',
      isHidden: false,
      sections: []
    };
    updateWebsitePages((pages) => [...pages, newPage]);
    setActivePageId(newPage.id);
  };

  const deletePage = (id: string) => {
    if (isCorePublicPageId(id) || orderedWebsitePages.length <= 1) return;
    const newPages = orderedWebsitePages.filter(p => p.id !== id);
    setWebsite({ ...website, pages: newPages });
    if (activePageId === id) setActivePageId(newPages[0].id);
  };

  const addSection = (type: WebsiteSection['type']) => {
    const newSection: WebsiteSection = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: { title: 'New Section', subtitle: 'Edit this content' }
    };
    const newPages = orderedWebsitePages.map(p => {
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
      await fetchWithAuth('/api/schools/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: website.schoolId,
          website_config: { ...website, pages: orderedWebsitePages },
          primary_color: website.theme.primaryColor,
          logo_url: website.theme.logoUrl || null
        })
      });
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
          fetch(resolveApiUrl(`/api/schools/${website.schoolId}/events`)),
          fetch(resolveApiUrl(`/api/schools/${website.schoolId}/vacancies`)),
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
        const fresp = await fetch(resolveApiUrl(`/api/schools/${fid}/faqs`));
        if (fresp.ok) { const fd = await fresp.json(); setFaqs(fd.faqs || []); }
        const tresp = await fetch(resolveApiUrl(`/api/schools/${fid}/testimonials`));
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
    setWebsite((current) => {
      const nextPages = ensureCorePublicPages(current.pages);
      const pagesChanged = nextPages.length !== current.pages.length || nextPages.some((page, index) => page.id !== current.pages[index]?.id);
      return pagesChanged ? { ...current, pages: nextPages } : current;
    });
  }, []);

  useEffect(() => {
    setLegalDraft({
      privacyPolicy: website.legal?.privacyPolicy || DEFAULT_WEBSITE.legal!.privacyPolicy!,
      termsOfService: website.legal?.termsOfService || DEFAULT_WEBSITE.legal!.termsOfService!,
    });
  }, [website.legal]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const previewPages = [
    ...visibleWebsitePages,
    ...(!visibleWebsitePages.some((page) => isVacancyPageSlug(page.slug) || isVacancyPageSlug(page.title)) && vacancies.length ? [{ id: 'vacancies_public', title: 'Opportunities', slug: 'opportunities', sections: [] }] : []),
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
                  {(Array.isArray(section.content?.cards) && section.content.cards.length ? section.content.cards : [{ title: 'Feature 1', body: 'Add feature details here.' }, { title: 'Feature 2', body: 'Add feature details here.' }, { title: 'Feature 3', body: 'Add feature details here.' }]).map((card: any, index: number) => (
                    <div key={index} className="p-8 bg-zinc-50 rounded-3xl space-y-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: brandSoft, color: brandColor }}>
                        <LayoutIcon size={24} />
                      </div>
                      <h3 className="font-bold text-lg">{card.title || `Feature ${index + 1}`}</h3>
                      <p className="text-sm text-zinc-500">{card.body || 'High-quality educational programs designed for modern learning.'}</p>
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
                    {(website.contactInfo?.email || website.contactInfo?.phone || website.contactInfo?.address) ? (
                      <div className="grid grid-cols-1 gap-3 text-sm text-zinc-300 md:grid-cols-2">
                        {website.contactInfo?.email ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Email</div>
                            <div className="mt-2 break-all font-semibold text-white">{website.contactInfo.email}</div>
                          </div>
                        ) : null}
                        {website.contactInfo?.phone ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Phone</div>
                            <div className="mt-2 break-all font-semibold text-white">{website.contactInfo.phone}</div>
                          </div>
                        ) : null}
                        {website.contactInfo?.address ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Address</div>
                            <div className="mt-2 text-white">{website.contactInfo.address}</div>
                            <div className="mt-2 text-xs text-zinc-400">{[website.contactInfo?.city, website.contactInfo?.state, website.contactInfo?.country].filter(Boolean).join(', ')}</div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
                          await fetchWithAuth('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: contactForm.name, email: contactForm.email, message: contactForm.message, school_id: website.schoolId }) });
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
          <h2 className="text-xl font-bold text-white">School Website Template</h2>
          <p className="text-zinc-500 text-xs">Edit the current public website template without changing its core structure.</p>
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
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Template Tools</h3>
            <div className="space-y-1">
              {[
                { id: 'pages', label: 'Pages', icon: <Globe size={16} /> },
                { id: 'content', label: 'Template Content', icon: <Type size={16} /> },
                { id: 'layout', label: 'Template Sections', icon: <LayoutIcon size={16} /> },
                { id: 'theme', label: 'Branding', icon: <Palette size={16} /> },
                  { id: 'vacancies', label: 'Vacancies Page', icon: <Briefcase size={16} /> },
                { id: 'events', label: 'Events', icon: <Calendar size={16} /> },
                { id: 'faq', label: 'FAQ', icon: <MessageSquare size={16} /> },
                { id: 'carousel', label: 'Carousel', icon: <ImageIcon size={16} /> },
                { id: 'testimonials', label: 'Testimonials', icon: <MessageSquare size={16} /> },
                { id: 'legal', label: 'Legal Pages', icon: <ShieldCheck size={16} /> },
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
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Website Template</label>
                      <select
                        value={website.theme.templateVariant || 'signature'}
                        onChange={(e) => setWebsite((current) => ({ ...current, theme: { ...current.theme, templateVariant: e.target.value as 'signature' | 'bright-future' } }))}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                      >
                        <option value="signature">Signature Template</option>
                        <option value="bright-future">Bright Future Template</option>
                      </select>
                      <p className="text-[10px] text-zinc-500">`Signature` keeps the existing Ndovera presentation. `Bright Future` uses the new bright multi-page layout.</p>
                    </div>
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
                            const data = await fetchWithAuth('/api/uploads/logo', { method: 'POST', body: fd });
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
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Template Pages</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Core structure locked</span>
              </div>
              <div className="space-y-2">
                {orderedWebsitePages.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => setActivePageId(p.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                      activePageId === p.id ? 'bg-white/5 border border-white/5' : 'hover:bg-white/5'
                    }`}
                  >
                    <div>
                      <div className="text-xs text-zinc-300">{p.title}</div>
                      <div className="text-[10px] text-zinc-500">/{p.slug}{p.isHidden ? ' • hidden' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!p.isHidden}
                          onChange={(e) => updatePageField(p.id, 'isHidden', !e.target.checked)}
                        />
                        Show
                      </label>
                    </div>
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
                      const data = await fetchWithAuth(`/api/schools/${website.schoolId}/faqs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: faqForm.question, answer: faqForm.answer }) });
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
                      const data = await fetchWithAuth(`/api/schools/${website.schoolId}/events`, { method: 'POST', body: fd });
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
                      const d = await fetchWithAuth('/api/uploads/media', { method: 'POST', body: fd });
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
                    <textarea id="t-quote" aria-label="Testimonial quote" className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm mb-2" placeholder="Original user remark or the excerpt you want featured" />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="t-photo">Profile photo URL</label>
                    <input id="t-photo" aria-label="Profile photo URL" className="w-full bg-transparent border border-white/5 rounded px-3 py-2 text-sm mb-2" placeholder="User profile photo URL" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      const author = (document.getElementById('t-author') as HTMLInputElement).value;
                      const role = (document.getElementById('t-role') as HTMLInputElement).value;
                      const quote = (document.getElementById('t-quote') as HTMLTextAreaElement).value;
                      const profilePhotoUrl = (document.getElementById('t-photo') as HTMLInputElement).value;
                      if (!quote) return alert('quote required');
                      try {
                        const d = await fetchWithAuth(`/api/schools/${website.schoolId}/testimonials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ author, role, quote, originalComment: quote, profilePhotoUrl, featured: false, sourceType: 'user-remark' }) });
                        setTestimonialsList(prev => [d.testimonial, ...prev]);
                        setToast({ message: 'Testimonial added', type: 'success' });
                        (document.getElementById('t-author') as HTMLInputElement).value = '';
                        (document.getElementById('t-role') as HTMLInputElement).value = '';
                        (document.getElementById('t-quote') as HTMLTextAreaElement).value = '';
                        (document.getElementById('t-photo') as HTMLInputElement).value = '';
                      } catch (err) { console.error(err); alert('Failed to add'); }
                    }} className="bg-emerald-600 text-white px-3 py-1 rounded">Add</button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs text-zinc-400 uppercase mb-2">Manage Testimonials</h4>
                  <div className="space-y-2">
                    {testimonialsList.map(t => (
                      <div key={t.id} className="flex items-center justify-between rounded bg-white/2 p-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-emerald-600/15 text-[11px] font-bold text-emerald-200">
                            {t.profilePhotoUrl ? <img src={t.profilePhotoUrl} alt={t.author || 'User'} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : String(t.author || 'NU').split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]?.toUpperCase() || '').join('')}
                          </div>
                          <div>
                          <div className="font-bold text-sm text-white">{t.author} {t.role ? `— ${t.role}` : ''}</div>
                          <div className="text-xs text-zinc-400">{t.originalComment || t.quote}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-400 mr-2">Feature</label>
                          <input type="checkbox" checked={!!t.featured} onChange={async (e) => {
                            try {
                              const d = await fetchWithAuth(`/api/schools/${website.schoolId}/testimonials/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: e.target.checked }) });
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

          {activeTab === 'legal' && (
            <div className="card-compact animate-in fade-in slide-in-from-left-2 duration-300 space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Legal Pages</h3>
                <p className="text-sm text-zinc-500">Edit the public Privacy Policy and Terms of Service here. These are saved with the website config so they can be updated later without touching code.</p>
              </div>

              <div className="space-y-3 rounded-3xl border border-white/5 bg-white/2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">Privacy Policy</p>
                    <p className="text-xs text-zinc-500">Last updated and public-facing policy copy.</p>
                  </div>
                  <input
                    value={legalDraft.privacyPolicy.lastUpdated}
                    onChange={(e) => setLegalDraft((current) => ({ ...current, privacyPolicy: { ...current.privacyPolicy, lastUpdated: e.target.value } }))}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none"
                    placeholder="Last updated"
                  />
                </div>
                <input
                  value={legalDraft.privacyPolicy.title}
                  onChange={(e) => setLegalDraft((current) => ({ ...current, privacyPolicy: { ...current.privacyPolicy, title: e.target.value } }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Policy title"
                />
                <textarea
                  value={legalDraft.privacyPolicy.body}
                  onChange={(e) => setLegalDraft((current) => ({ ...current, privacyPolicy: { ...current.privacyPolicy, body: e.target.value } }))}
                  className="min-h-72 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white outline-none"
                  placeholder="Write the privacy policy body here..."
                />
              </div>

              <div className="space-y-3 rounded-3xl border border-white/5 bg-white/2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">Terms of Service</p>
                    <p className="text-xs text-zinc-500">Last updated and public-facing terms copy.</p>
                  </div>
                  <input
                    value={legalDraft.termsOfService.lastUpdated}
                    onChange={(e) => setLegalDraft((current) => ({ ...current, termsOfService: { ...current.termsOfService, lastUpdated: e.target.value } }))}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none"
                    placeholder="Last updated"
                  />
                </div>
                <input
                  value={legalDraft.termsOfService.title}
                  onChange={(e) => setLegalDraft((current) => ({ ...current, termsOfService: { ...current.termsOfService, title: e.target.value } }))}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Terms title"
                />
                <textarea
                  value={legalDraft.termsOfService.body}
                  onChange={(e) => setLegalDraft((current) => ({ ...current, termsOfService: { ...current.termsOfService, body: e.target.value } }))}
                  className="min-h-72 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white outline-none"
                  placeholder="Write the terms of service body here..."
                />
              </div>

              <button
                onClick={() => {
                  setWebsite((current) => ({
                    ...current,
                    legal: {
                      privacyPolicy: legalDraft.privacyPolicy,
                      termsOfService: legalDraft.termsOfService,
                    },
                  }));
                  setToast({ message: 'Legal pages updated locally. Save changes to publish.', type: 'success' });
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
              >
                Update Legal Pages
              </button>
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
                    const d = await fetchWithAuth(`/api/schools/${website.schoolId}/website/pages/${activePage.id}/images`, { method: 'POST', body: fd });
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

            <div className="mb-6 grid gap-4 rounded-2xl border border-white/5 bg-black/10 p-4 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Page Title</label>
                <input
                  value={activePage.title}
                  onChange={(e) => {
                    const nextTitle = e.target.value;
                    updatePageField(activePage.id, 'title', nextTitle);
                    if (activePage.slug === normalizePageSlug(activePage.title)) {
                      updatePageField(activePage.id, 'slug', normalizePageSlug(nextTitle));
                    }
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Page Slug</label>
                <input
                  value={activePage.slug}
                  onChange={(e) => updatePageField(activePage.id, 'slug', normalizePageSlug(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <label className="flex items-center gap-2 self-end rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                <input
                  type="checkbox"
                  checked={!activePage.isHidden}
                  onChange={(e) => updatePageField(activePage.id, 'isHidden', !e.target.checked)}
                />
                Show on website
              </label>
            </div>

            <div className="space-y-4">
              {activePage.sections.length > 0 ? (
                activePage.sections.map((section, idx) => (
                  <div key={section.id} className="group relative rounded-2xl border border-white/5 bg-white/2 p-6 transition-all hover:border-emerald-500/30">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">
                          {section.type}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Template section</span>
                    </div>

                    {section.type === 'hero' && (
                      <div className="space-y-4">
                        <input 
                          type="text" 
                          value={String(section.content?.title || '')}
                          onChange={(e) => updateSectionContentField(activePage.id, section.id, 'title', e.target.value)}
                          className="w-full bg-transparent text-xl font-bold text-white outline-none border-b border-transparent focus:border-emerald-500/30 pb-1"
                        />
                        <textarea 
                          value={String(section.content?.subtitle || '')}
                          onChange={(e) => updateSectionContentField(activePage.id, section.id, 'subtitle', e.target.value)}
                          className="w-full bg-transparent text-sm text-zinc-500 outline-none border-b border-transparent focus:border-emerald-500/30 resize-none h-12"
                        />
                      </div>
                    )}

                    {section.type === 'about' && (
                      <div className="space-y-4">
                        <textarea 
                          value={String(section.content?.text || '')}
                          onChange={(e) => updateSectionContentField(activePage.id, section.id, 'text', e.target.value)}
                          className="w-full bg-transparent text-sm text-zinc-500 outline-none border-b border-transparent focus:border-emerald-500/30 resize-none h-24"
                        />
                      </div>
                    )}

                    {(section.type === 'features' || section.type === 'news' || section.type === 'admissions' || section.type === 'contact') && (
                      <div className="space-y-4">
                        {'title' in (section.content || {}) ? (
                          <input
                            type="text"
                            value={String(section.content?.title || '')}
                            onChange={(e) => updateSectionContentField(activePage.id, section.id, 'title', e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                            placeholder="Section title"
                          />
                        ) : null}
                        {'subtitle' in (section.content || {}) ? (
                          <textarea
                            value={String(section.content?.subtitle || '')}
                            onChange={(e) => updateSectionContentField(activePage.id, section.id, 'subtitle', e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300 outline-none"
                            placeholder="Section subtitle"
                          />
                        ) : null}
                        {'text' in (section.content || {}) ? (
                          <textarea
                            value={String(section.content?.text || '')}
                            onChange={(e) => updateSectionContentField(activePage.id, section.id, 'text', e.target.value)}
                            className="min-h-32 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300 outline-none"
                            placeholder="Section text"
                          />
                        ) : null}
                        {Array.isArray(section.content?.cards) ? (
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Feature Cards JSON</label>
                            <textarea
                              defaultValue={JSON.stringify(section.content.cards, null, 2)}
                              onBlur={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  updateSectionContentField(activePage.id, section.id, 'cards', parsed);
                                  setToast({ message: 'Feature cards updated', type: 'success' });
                                } catch {
                                  setToast({ message: 'Cards JSON is invalid', type: 'error' });
                                  e.target.value = JSON.stringify(section.content.cards, null, 2);
                                }
                              }}
                              className="min-h-40 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-zinc-300 outline-none"
                            />
                          </div>
                        ) : null}
                        {!('title' in (section.content || {})) && !('subtitle' in (section.content || {})) && !('text' in (section.content || {})) && !Array.isArray(section.content?.cards) ? (
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Section Content JSON</label>
                            <textarea
                              defaultValue={JSON.stringify(section.content || {}, null, 2)}
                              onBlur={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  replaceSectionContent(activePage.id, section.id, parsed);
                                  setToast({ message: 'Section content updated', type: 'success' });
                                } catch {
                                  setToast({ message: 'Section JSON is invalid', type: 'error' });
                                  e.target.value = JSON.stringify(section.content || {}, null, 2);
                                }
                              }}
                              className="min-h-40 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-zinc-300 outline-none"
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-700 mb-4">
                    <Plus size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-400">No editable sections on this page</h4>
                  <p className="text-xs text-zinc-600 mt-1">This template page is published as-is until sections are added centrally.</p>
                </div>
              )}
            </div>

            <div className="mt-12 pt-12 border-t border-white/5">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Template Structure</h4>
              <div className="rounded-2xl border border-white/5 bg-black/10 p-4 text-sm text-zinc-400">
                This website now uses a fixed template. You can update content, branding, legal copy, events, testimonials, and published opportunities without adding or removing pages and sections here.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
