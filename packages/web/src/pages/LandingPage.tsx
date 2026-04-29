import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, ChevronDown, ChevronRight, Facebook, Globe, Instagram, Linkedin, Menu, MessageCircle, ShieldCheck, Sparkles, Sprout, X, Youtube, Zap } from 'lucide-react';
import { fetchWithAuth, resolveApiUrl } from '../services/apiClient';
import { LandingHomeSections } from '../components/landing/LandingHomeSections';
import { BrightFutureHomeSections } from '../components/landing/BrightFutureHomeSections';
import type { WebsitePage } from '../types';
import { ABOUT_US_CONTENT, CORE_PUBLIC_PAGE_ORDER, LEGAL_PUBLIC_PAGE_ORDER, MISSION_CONTENT, VISION_CONTENT, ensureCorePublicPages } from './publicSiteDefaults';
import { fetchPublicBrandingContext, resolveTemplateVariant } from '../services/publicSiteBranding';

type PublicPage = WebsitePage;
type PricingTier = { key: string; label: string; minStudents: number; maxStudents: number | null; oneTimeSetupNaira: number; perStudentPerTermNaira: number; oneTimeSetupDiscountNaira?: number; perStudentPerTermDiscountNaira?: number; pricing?: { oneTimeSetupNaira: number; perStudentPerTermNaira: number; discountPercent: number } };
type SchoolWebsite = { schoolId: string; theme?: { primaryColor?: string; fontFamily?: string; logoUrl?: string; templateVariant?: 'signature' | 'bright-future' }; pages?: PublicPage[]; publicUrl?: string; contactInfo?: { email?: string; phone?: string; address?: string; city?: string; state?: string; country?: string }; socialLinks?: { facebook?: string; instagram?: string; linkedin?: string; youtube?: string; whatsapp?: string }; marketing?: { heroCarouselImages?: string[]; eventGalleryItems?: Array<{ id: string; title?: string; caption?: string; mediaType?: string; url: string }> }; legal?: { privacyPolicy?: { title?: string; body?: string; lastUpdated?: string }, termsOfService?: { title?: string; body?: string; lastUpdated?: string } } };
type ChatMessage = { from: 'user' | 'bot'; text: string; contactPageLink?: boolean };
type ChatMode = 'verified' | 'public';
type ChatStage = 'welcome' | 'awaiting-identifier' | 'awaiting-description' | 'ready';
type VerifiedChatUser = { id?: string; name?: string; schoolName?: string; activeRole?: string; roles?: string[] } | null;
type ShowcaseSchool = { id: string; name: string; subdomain?: string; logoUrl?: string | null; primaryColor?: string | null; location?: string | null };
type OpportunityApplicationRecord = { id: string; applicationCode: string; vacancyId: string; vacancyTitle: string; name: string; email: string; phone: string; status: string; assessment?: { required: boolean; status: string; score: number | null } };
type TutorDashboardRecord = { id: string; displayName: string; email: string; specialty: string; headline?: string | null; accessKey: string; mode: 'independent' | 'school'; classes: Array<{ id: string; title: string; subject: string; level: string; schedule: string; delivery: string; summary: string; studentCount: number }>; students: Array<{ id: string; name: string; stage?: string | null; email?: string | null }>; subscription: { status: 'inactive' | 'pending' | 'trial' | 'active'; monthlyFeeNaira: number; includedStudents: number; extraStudentFeeNaira: number; premiumToolsEnabled: boolean; extraStudentCount: number; extraStudentDeficitNaira: number; trialStartedAt?: string; trialEndsAt?: string; paymentPhase?: 'trial' | 'upfront' | 'active'; paymentRequiredNow?: boolean } };

const NDOVERA_ADMIN_EMAIL = 'admin@ndovera.com';
const NDOVERA_SUPPORT_EMAIL = 'support@ndovera.com';
const NDOVERA_PUBLIC_URL = 'https://www.ndovera.com';
const NDOVERA_LOGO_PATH = '/ndovera.png';
const PUBLIC_SCHOOL_ID = 'school-1';
const ABOUT_MENU_PAGE_IDS = ['about-us', 'vision-values', 'mission'] as const;
const PRIMARY_PUBLIC_NAV_IDS = ['home', 'pricing', 'events-gallery', 'vacancies', 'growth-partners', 'contact-us'] as const;
const RETAINED_PUBLIC_PAGE_IDS = new Set<string>([
  ...PRIMARY_PUBLIC_NAV_IDS,
  ...ABOUT_MENU_PAGE_IDS,
  ...LEGAL_PUBLIC_PAGE_ORDER,
]);
const FAQ_IDENTIFIER_PROMPT = 'What is your name, or please enter your name, email, phone number, or user ID.';
function createHeroBackdrop(title: string, accent: string, shade: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#07120d"/><stop offset="50%" stop-color="${accent}"/><stop offset="100%" stop-color="#0c1712"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1320" cy="170" r="150" fill="rgba(255,255,255,0.18)"/><path d="M0 720 C260 610 460 770 700 690 C930 620 1180 520 1600 740 L1600 900 L0 900 Z" fill="${shade}"/><rect x="240" y="330" width="210" height="220" rx="18" fill="rgba(255,255,255,0.16)"/><rect x="500" y="265" width="300" height="285" rx="24" fill="rgba(255,255,255,0.18)"/><rect x="870" y="340" width="230" height="210" rx="20" fill="rgba(255,255,255,0.14)"/><rect x="1150" y="285" width="220" height="265" rx="20" fill="rgba(255,255,255,0.17)"/><text x="120" y="160" fill="rgba(255,255,255,0.92)" font-size="50" font-family="Verdana, Arial, sans-serif" font-weight="700">${title}</text><text x="120" y="220" fill="rgba(255,255,255,0.7)" font-size="24" font-family="Verdana, Arial, sans-serif">A calm school scene for the Ndovera homepage</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
const DEFAULT_HERO_IMAGES = [
  createHeroBackdrop('School life made clear', '#1f8a70', 'rgba(10, 43, 31, 0.92)'),
  createHeroBackdrop('Parents, staff, and learners in step', '#2563eb', 'rgba(11, 30, 67, 0.92)'),
  createHeroBackdrop('One trusted place for school work', '#d97706', 'rgba(58, 33, 9, 0.92)'),
];
const DEFAULT_EVENT_GALLERY = [
  { id: 'event_1', title: 'School launch days', note: 'New schools meet the Ndovera team, see a calm live guide, and learn the first simple steps for a smooth start.', accent: 'linear-gradient(135deg, rgba(5, 150, 105, 0.35), rgba(16, 185, 129, 0.12))' },
  { id: 'event_2', title: 'Parent and student open sessions', note: 'Families ask clear questions, see the public school pages, and learn how school updates will reach them.', accent: 'linear-gradient(135deg, rgba(14, 165, 233, 0.35), rgba(59, 130, 246, 0.12))' },
  { id: 'event_3', title: 'Growth partner roadshows', note: 'Approved partners help more schools discover Ndovera in an honest and easy-to-understand way.', accent: 'linear-gradient(135deg, rgba(217, 119, 6, 0.35), rgba(251, 191, 36, 0.12))' },
  { id: 'event_4', title: 'Staff training clinics', note: 'School teams get simple help with attendance, fees, reports, messages, and public page updates.', accent: 'linear-gradient(135deg, rgba(124, 58, 237, 0.35), rgba(168, 85, 247, 0.12))' },
];
const DEFAULT_PUBLIC_OPPORTUNITIES = [
  { id: 'opp_1', title: 'Growth Partner', description: 'Help schools learn about Ndovera, support first conversations, and pass clear leads to the main team.', type: 'Flexible', category: 'Partnerships', salary: 'Commission based', assessmentRequired: false },
  { id: 'opp_2', title: 'School Onboarding Guide', description: 'Support new schools after sign-up, help them prepare their details, and keep the early steps calm and organised.', type: 'Contract', category: 'Onboarding', salary: 'Paid per project', assessmentRequired: true },
  { id: 'opp_3', title: 'Community Events Support', description: 'Assist with school visits, launch days, and simple public events that help families understand the platform.', type: 'Part-time', category: 'Events', salary: 'Rate shared during review', assessmentRequired: false },
  { id: 'opp_4', title: 'Family Success Support', description: 'Help schools keep parent communication clear and make public support messages easy to follow.', type: 'Part-time', category: 'Support', salary: 'Shared during review', assessmentRequired: false },
];
const DEFAULT_SHOWCASE_SCHOOLS: ShowcaseSchool[] = [
  { id: 'showcase_1', name: 'Ndovera Academy', subdomain: 'ndovera', location: 'Lagos, Nigeria' },
  { id: 'showcase_2', name: 'Greenfield College', subdomain: 'greenfield', location: 'Abuja, Nigeria' },
  { id: 'showcase_3', name: 'Riverside Schools', subdomain: 'riverside', location: 'Port Harcourt, Nigeria' },
  { id: 'showcase_4', name: 'Bright Future High', subdomain: 'brightfuture', location: 'Ibadan, Nigeria' },
];

function hexToRgba(value: string | undefined, alpha: number) {
  const hex = String(value || '#10b981').replace('#', '').trim();
  const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex.padEnd(6, '0').slice(0, 6);
  const numeric = Number.parseInt(normalized, 16);
  return `rgba(${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}, ${alpha})`;
}

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPricingRange(tier: PricingTier) {
  if (tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0)) return 'Custom quote';
  return tier.maxStudents === null ? `${tier.minStudents}+ learners` : `${tier.minStudents} to ${tier.maxStudents} learners`;
}

function pricingPlanSummary(tier: PricingTier | null) {
  if (!tier) return 'Choose a plan to see the current setup and term pricing.';
  if (tier.key === 'growth') return 'Growth is the quickest self-serve launch path. You pay setup first, then pay per student from the second term.';
  if (tier.key === 'pro') return 'Pro keeps a higher setup fee but lowers the term rate for larger school rollouts.';
  if (tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0)) return 'Custom pricing is handled directly with the Ndovera team before any invoice is raised.';
  return 'Pay setup first, then move to per-student billing from the second term.';
}

function pricingPlanFeatures(tier: PricingTier) {
  if (tier.key === 'growth') return ['Setup fee only at onboarding', 'Per-student billing starts from second term', 'Best for schools that want a quick launch'];
  if (tier.key === 'pro') return ['Higher-touch setup for bigger schools', 'Lower per-student term billing after launch', 'Good fit for larger or faster-scaling schools'];
  if (tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0)) return ['Tailored quote and rollout plan', 'Manual billing agreement with Ndovera', 'Best for enterprise or multi-campus needs'];
  return ['Setup fee only at onboarding', 'Per-student billing starts from second term', 'Optional discount code support'];
}

function aboutMenuDescription(pageId: string) {
  if (pageId === 'about-us') return 'See what Ndovera is building for schools, families, and staff.';
  if (pageId === 'vision-values') return 'Read the principles guiding product, service, and school support.';
  if (pageId === 'mission') return 'Understand the day-to-day mission behind the platform rollout.';
  return 'Open this page to learn more about Ndovera.';
}

function brightFuturePageLabel(page: PublicPage | undefined) {
  if (!page) return 'Page';
  if (page.id === 'mission') return 'Our Promise';
  if (page.id === 'vision-values') return 'Vision';
  if (page.id === 'growth-partners') return 'Partners';
  if (page.id === 'events-gallery') return 'Events';
  if (page.id === 'vacancies') return 'Opportunities';
  if (page.id === 'contact-us') return 'Contact';
  if (page.id === 'about-us') return 'About';
  return page.title;
}

function pricingPagePlanContent(tier: PricingTier) {
  if (tier.key === 'growth') {
    return {
      ctaText: 'Get Started',
      selfServeCheckout: true,
      features: [
        'Parent access portal',
        'Advanced analytics & performance tracking',
        'AI-powered teaching tools',
      ],
    };
  }
  if (tier.key === 'pro') {
    return {
      ctaText: 'Get Started',
      selfServeCheckout: true,
      features: [
        'Parent access portal',
        'Advanced analytics & performance tracking',
        'AI-powered teaching tools',
        'Custom domain',
        'Mobile app',
        'Priority support',
      ],
    };
  }
  return {
    ctaText: 'Request a Quote',
    selfServeCheckout: false,
    quoteLink: '/contact',
    features: [
      'Parent access portal',
      'Advanced analytics & performance tracking',
      'AI-powered teaching tools',
      'Enterprise solutions for multi-school management',
    ],
  };
}

function formatDateLabel(value?: string) {
  if (!value) return 'Not scheduled';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function deriveChatVisitorName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 'there';
  const emailMatch = trimmed.match(/^([^@s]+)@/);
  if (emailMatch?.[1]) return emailMatch[1];
  const normalized = trimmed.replace(/[^a-zA-Z0-9s'-]/g, ' ').replace(/s+/g, ' ').trim();
  if (!normalized) return 'there';
  const looksLikePhone = normalized.replace(/D+/g, '').length >= 7 && !/[a-zA-Z]/.test(normalized);
  if (looksLikePhone) return 'there';
  return normalized.split(' ').slice(0, 2).join(' ');
}

const isVacancySlug = (value?: string) => ['opportunities', 'opportunity', 'vacancies', 'vacancy', 'careers', 'jobs'].includes(String(value || '').trim().toLowerCase());
const isAboutSlug = (value?: string) => ['about', 'about-us', 'about us', 'who-we-are'].includes(String(value || '').trim().toLowerCase());
const isVisionSlug = (value?: string) => ['vision-values', 'vision', 'values', 'our-vision'].includes(String(value || '').trim().toLowerCase());
const isMissionSlug = (value?: string) => ['mission', 'our-mission'].includes(String(value || '').trim().toLowerCase());
const isContactSlug = (value?: string) => ['contact', 'contact-us', 'contact us', 'get-in-touch'].includes(String(value || '').trim().toLowerCase());
const isEventsSlug = (value?: string) => ['events', 'event', 'gallery', 'events-gallery', 'gallery-events'].includes(String(value || '').trim().toLowerCase());
const isGrowthSlug = (value?: string) => ['growth', 'growth-partners', 'growth partners', 'partners'].includes(String(value || '').trim().toLowerCase());
const isPricingSlug = (value?: string) => ['pricing', 'plans', 'fees'].includes(String(value || '').trim().toLowerCase());
const isTutorSlug = (value?: string) => ['become-a-tutor', 'become tutor', 'tutor', 'tutors'].includes(String(value || '').trim().toLowerCase());
const formatTenantLocation = (info?: { city?: string | null; state?: string | null; country?: string | null }) => [info?.city, info?.state, info?.country].filter(Boolean).join(', ');
const sampleTestimonials = () => ([
  { id: 't1', author: 'Mrs. Adebayo', role: 'School Owner', quote: 'Ndovera transformed our fee collection and communication.', profilePhotoUrl: '' },
  { id: 't2', author: 'Mr. Okonkwo', role: 'Teacher', quote: 'Posting assignments is effortless and students engage more.', profilePhotoUrl: '' },
  { id: 't3', author: 'Jane Doe', role: 'Student', quote: 'I love the simple layout and quick updates.', profilePhotoUrl: '' },
]);

export const LandingPage = ({ onLogin, initialPublicPageId }: { onLogin: () => void; initialPublicPageId?: string }) => {
  const [showRegister, setShowRegister] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showGrowthSignup, setShowGrowthSignup] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);
  const [website, setWebsite] = useState<SchoolWebsite | null>(null);
  const [publicBranding, setPublicBranding] = useState({
    schoolId: PUBLIC_SCHOOL_ID,
    schoolName: 'Ndovera',
    subdomain: 'ndovera',
    isTenant: false,
    logoUrl: NDOVERA_LOGO_PATH,
    primaryColor: '#4F46E5',
    templateVariant: 'bright-future' as 'signature' | 'bright-future',
  });
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [showcaseSchools, setShowcaseSchools] = useState<ShowcaseSchool[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [selectedPublicPageId, setSelectedPublicPageId] = useState(initialPublicPageId || 'home');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState<ChatMode>('public');
  const [chatStage, setChatStage] = useState<ChatStage>('welcome');
  const [verifiedChatUser, setVerifiedChatUser] = useState<VerifiedChatUser>(null);
  const [chatVisitorName, setChatVisitorName] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [growthSubmitting, setGrowthSubmitting] = useState(true);
  const [growthSuccess, setGrowthSuccess] = useState(false);
  const [growthForm, setGrowthForm] = useState({ name: '', email: '', phone: '', city: '', notes: '' });
  const [schoolName, setSchoolName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registerStep, setRegisterStep] = useState<'details' | 'payment' | 'waiting' | 'approved'>('details');
  const [ownerNdoveraEmail, setOwnerNdoveraEmail] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [waitToken, setWaitToken] = useState('');
  const [checkoutTxRef, setCheckoutTxRef] = useState('');
  const [selectedPricingTierKey, setSelectedPricingTierKey] = useState('');
  const [requestedStudentCount, setRequestedStudentCount] = useState('150');
  const [registerDiscountCode, setRegisterDiscountCode] = useState('');
  const [validatedDiscount, setValidatedDiscount] = useState<{ code: string; percentageOff: number; discountedSubtotalNaira: number; discountAmountNaira: number; finalAmountNaira: number } | null>(null);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [activeOpportunity, setActiveOpportunity] = useState<any | null>(null);
  const [applicationLookupEmail, setApplicationLookupEmail] = useState('');
  const [applicationLookupCode, setApplicationLookupCode] = useState('');
  const [applicationResults, setApplicationResults] = useState<OpportunityApplicationRecord[]>([]);
  const [applicationSubmitting, setApplicationSubmitting] = useState(false);
  const [opportunityForm, setOpportunityForm] = useState({ name: '', email: '', phone: '', hasExistingAccount: false, resumeFullName: '', resumeEmail: '', resumePhone: '', experience: '', education: '', skills: '', fileUrl: '' });
  const [tutorDashboard, setTutorDashboard] = useState<TutorDashboardRecord | null>(null);
  const [tutorSubmitting, setTutorSubmitting] = useState(false);
  const [tutorForm, setTutorForm] = useState({ displayName: '', email: '', specialty: 'Mathematics', headline: '', phone: '' });

  const templateVariant = resolveTemplateVariant(website?.theme?.templateVariant || publicBranding.templateVariant);
  const isBrightFutureTemplate = templateVariant === 'bright-future';
  const brandColor = website?.theme?.primaryColor || publicBranding.primaryColor || '#10b981';
  const accentColor = isBrightFutureTemplate ? '#22C55E' : '#10b981';
  const brandSoft = hexToRgba(brandColor, 0.12);
  const brandBorder = hexToRgba(brandColor, 0.28);
  const brandText = hexToRgba(brandColor, 0.92);
  const tenantLocation = formatTenantLocation(website?.contactInfo);
  const primaryContactEmail = website?.contactInfo?.email || NDOVERA_SUPPORT_EMAIL;
  const secondaryContactEmail = publicBranding.isTenant ? null : NDOVERA_ADMIN_EMAIL;
  const publicSiteHref = publicBranding.isTenant
    ? website?.publicUrl || (typeof window !== 'undefined' ? window.location.origin : NDOVERA_PUBLIC_URL)
    : NDOVERA_PUBLIC_URL;
  const publicSiteLabel = publicBranding.isTenant
    ? (publicSiteHref.replace(/^https?:\/\//, '') || `${publicBranding.subdomain || 'school'}.ndovera.com`)
    : 'www.ndovera.com';
  const assistantTitle = publicBranding.isTenant ? `${publicBranding.schoolName} Assistant` : 'Ndovera Assistant';
  const assistantPrompt = publicBranding.isTenant ? `Ask about ${publicBranding.schoolName}` : 'Ask about Ndovera';
  const contactModalTitle = publicBranding.isTenant ? `Contact ${publicBranding.schoolName}` : 'Contact Ndovera';
  const contactFallbackMessage = `I could not find a direct answer for that here. Please contact ${primaryContactEmail} or use the Contact Us page.`;
  const privacyFallbackBody = [
    `${publicBranding.schoolName} respects the privacy of every family, learner, staff member, and partner who interacts with this public website.`,
    'Information submitted through enquiry forms, admissions forms, newsletters, and other public website journeys is used only to respond to requests, manage school communications, and improve service delivery.',
    `If you need help with privacy, data access, corrections, or removal requests, contact ${primaryContactEmail}.${tenantLocation ? ` You may also reach the school at ${tenantLocation}.` : ''}`,
    `This notice applies to activity on ${publicSiteHref}.`,
  ].join('\n\n');
  const termsFallbackBody = [
    `These terms govern access to the public website, enquiry channels, admissions content, and community information published by ${publicBranding.schoolName}.`,
    'By using this site, you agree to provide accurate information, avoid misuse of any school service, and respect all school communications, intellectual property, and safeguarding expectations shared here.',
    `${publicBranding.schoolName} may update public website content, admissions information, event details, pricing information, or contact routes when operational needs change.`,
    `Questions about these terms should be sent to ${primaryContactEmail}.${tenantLocation ? ` The main public contact location is ${tenantLocation}.` : ''}`,
  ].join('\n\n');
  const welcomeChatMessages: ChatMessage[] = [
    { from: 'bot', text: `Hi! welcome to ${publicBranding.schoolName}! How may I be of help?` },
  ];
  const footerContacts = [
    { id: 'primary-email', href: `mailto:${primaryContactEmail}`, label: primaryContactEmail },
    secondaryContactEmail ? { id: 'secondary-email', href: `mailto:${secondaryContactEmail}`, label: secondaryContactEmail } : null,
    publicBranding.isTenant && website?.contactInfo?.phone ? { id: 'phone', href: `tel:${website.contactInfo.phone}`, label: website.contactInfo.phone } : null,
    { id: 'public-url', href: publicSiteHref, label: publicSiteLabel },
  ].filter((item): item is { id: string; href: string; label: string } => Boolean(item));
  const legalContent = useMemo(() => ({
	privacyPolicy: {
		title: website?.legal?.privacyPolicy?.title || 'Privacy Policy',
    body: website?.legal?.privacyPolicy?.body || privacyFallbackBody,
		lastUpdated: website?.legal?.privacyPolicy?.lastUpdated || 'recently',
	},
	termsOfService: {
		title: website?.legal?.termsOfService?.title || 'Terms of Service',
    body: website?.legal?.termsOfService?.body || termsFallbackBody,
		lastUpdated: website?.legal?.termsOfService?.lastUpdated || 'recently',
	},
  }), [privacyFallbackBody, termsFallbackBody, website]);

  const publicPages = useMemo(() => {
    const basePages = ensureCorePublicPages(website?.pages || []).map((page) => {
      if (page.id === 'privacy-policy') return { ...page, title: legalContent.privacyPolicy.title };
      if (page.id === 'terms-of-service') return { ...page, title: legalContent.termsOfService.title };
      return page;
    });
    const pagesById = new Map(basePages.map((page) => [page.id, page]));
    const orderedCorePages = CORE_PUBLIC_PAGE_ORDER
      .map((pageId) => pagesById.get(pageId))
      .filter((page): page is PublicPage => Boolean(page));
    const orderedLegalPages = LEGAL_PUBLIC_PAGE_ORDER
      .map((pageId) => pagesById.get(pageId))
      .filter((page): page is PublicPage => Boolean(page));
    const customPages = basePages.filter((page) => !CORE_PUBLIC_PAGE_ORDER.includes(page.id as (typeof CORE_PUBLIC_PAGE_ORDER)[number]) && !LEGAL_PUBLIC_PAGE_ORDER.includes(page.id as (typeof LEGAL_PUBLIC_PAGE_ORDER)[number]));

    return [
      ...orderedCorePages,
      ...customPages,
      ...orderedLegalPages,
    ];
  }, [legalContent.privacyPolicy.title, legalContent.termsOfService.title, website]);
  const visiblePublicPages = useMemo(() => publicPages.filter((page) => RETAINED_PUBLIC_PAGE_IDS.has(page.id) && !page.isHidden), [publicPages]);
  const visiblePublicPageIds = useMemo(() => new Set(visiblePublicPages.map((page) => page.id)), [visiblePublicPages]);
  const fallbackPublicPageId = visiblePublicPages[0]?.id || publicPages[0]?.id || 'home';
  const navPages = useMemo(() => {
    const pagesById = new Map(visiblePublicPages.map((page) => [page.id, page]));
    return PRIMARY_PUBLIC_NAV_IDS
      .map((pageId) => pagesById.get(pageId))
      .filter((page): page is PublicPage => Boolean(page));
  }, [visiblePublicPages]);
  const homeNavPage = navPages.find((page) => page.id === 'home') || null;
  const secondaryNavPages = navPages.filter((page) => page.id !== 'home');
  const infoMenuPages = useMemo(() => {
    const pagesById = new Map(visiblePublicPages.map((page) => [page.id, page]));
    return ABOUT_MENU_PAGE_IDS.map((pageId) => pagesById.get(pageId)).filter((page): page is PublicPage => Boolean(page));
  }, [visiblePublicPages]);
  const selectedPublicPage = visiblePublicPages.find((page) => page.id === selectedPublicPageId) || visiblePublicPages[0] || publicPages[0];
  const openPublicPage = (pageId: string) => {
    setInfoMenuOpen(false);
    setMobileNavOpen(false);
    setSelectedPublicPageId(visiblePublicPageIds.has(pageId) ? pageId : fallbackPublicPageId);
  };
  const activeLegal = selectedPublicPageId === 'privacy-policy' ? legalContent.privacyPolicy : selectedPublicPageId === 'terms-of-service' ? legalContent.termsOfService : null;
  const infoMenuActive = ABOUT_MENU_PAGE_IDS.includes(selectedPublicPageId as (typeof ABOUT_MENU_PAGE_IDS)[number]);
  const pageIsHome = selectedPublicPageId === 'home';
  const pageIsLegal = Boolean(activeLegal);
  const pageIsVacancy = isVacancySlug(selectedPublicPage?.slug) || isVacancySlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'vacancies';
  const pageIsAbout = isAboutSlug(selectedPublicPage?.slug) || isAboutSlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'about-us';
  const pageIsVision = isVisionSlug(selectedPublicPage?.slug) || isVisionSlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'vision-values';
  const pageIsMission = isMissionSlug(selectedPublicPage?.slug) || isMissionSlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'mission';
  const pageIsContact = isContactSlug(selectedPublicPage?.slug) || isContactSlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'contact-us';
  const pageIsEvents = isEventsSlug(selectedPublicPage?.slug) || isEventsSlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'events-gallery';
  const pageIsGrowth = isGrowthSlug(selectedPublicPage?.slug) || isGrowthSlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'growth-partners';
  const pageIsPricing = isPricingSlug(selectedPublicPage?.slug) || isPricingSlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'pricing';
  const pageIsTutor = isTutorSlug(selectedPublicPage?.slug) || isTutorSlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'become-a-tutor';
  const displayVacancies = vacancies.length ? vacancies : DEFAULT_PUBLIC_OPPORTUNITIES;
  const usingFallbackVacancies = vacancies.length === 0;
  const heroImages = website?.marketing?.heroCarouselImages?.length ? website.marketing.heroCarouselImages : DEFAULT_HERO_IMAGES;
  const displayEventGallery = website?.marketing?.eventGalleryItems?.length ? website.marketing.eventGalleryItems : DEFAULT_EVENT_GALLERY;
  const displayShowcaseSchools = showcaseSchools.length ? showcaseSchools : DEFAULT_SHOWCASE_SCHOOLS;
  const fallbackPricingTiers: PricingTier[] = [{key: 'growth', label: 'Growth', minStudents: 1, maxStudents: 50, oneTimeSetupNaira: 100000, perStudentPerTermNaira: 1000}, {key: 'pro', label: 'Pro', minStudents: 51, maxStudents: null, oneTimeSetupNaira: 150000, perStudentPerTermNaira: 1000}, {key: 'custom', label: 'Custom', minStudents: 0, maxStudents: 0, oneTimeSetupNaira: 0, perStudentPerTermNaira: 0}];
  const displayPricingTiers = pricingTiers.length ? pricingTiers : fallbackPricingTiers;
  const registerablePricingTiers = displayPricingTiers.filter((tier) => tier.key !== 'custom');

  useEffect(() => {
    const load = async () => {
      try {
        const branding = await fetchPublicBrandingContext();
        setPublicBranding({
          schoolId: branding.schoolId,
          schoolName: branding.schoolName,
          subdomain: branding.subdomain || 'ndovera',
          isTenant: branding.isTenant,
          logoUrl: branding.logoUrl || NDOVERA_LOGO_PATH,
          primaryColor: branding.primaryColor,
          templateVariant: branding.templateVariant,
        });
        if (branding.website) setWebsite(branding.website as unknown as SchoolWebsite);
        const [testimonialsResp, vacanciesResp, showcaseResp] = await Promise.all([
          fetch(resolveApiUrl(`/api/schools/${branding.schoolId}/testimonials`)),
          fetch(resolveApiUrl(`/api/schools/${branding.schoolId}/vacancies`)),
          fetch(resolveApiUrl('/api/schools/showcase')),
        ]);
        if (testimonialsResp.ok) {
          const data = await testimonialsResp.json();
          setTestimonials(Array.isArray(data) ? data : data?.testimonials || []);
        }
        if (vacanciesResp.ok) {
          const data = await vacanciesResp.json();
          setVacancies(Array.isArray(data?.vacancies) ? data.vacancies : []);
        }
        if (showcaseResp.ok) {
          const data = await showcaseResp.json();
          setShowcaseSchools(Array.isArray(data?.schools) ? data.schools : []);
        }
        const pricingResp = await fetch(resolveApiUrl('/api/finance/monetization/pricing'));
        if (pricingResp.ok) {
          const data = await pricingResp.json();
          const tiers = Array.isArray(data?.schoolPricing?.tiers) ? data.schoolPricing.tiers : [];
          setPricingTiers(tiers);
          setSelectedPricingTierKey((current) => current || tiers[0]?.key || '');
        }
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    if (chatMessages.length === 0 && chatStage === 'welcome') {
      setChatMessages(welcomeChatMessages);
    }
  }, [chatMessages.length, chatStage, welcomeChatMessages]);

  useEffect(() => {
	const shouldOpen = sessionStorage.getItem('ndovera_open_register_school');
	if (shouldOpen !== '1') return;
	sessionStorage.removeItem('ndovera_open_register_school');
  openPublicPage('pricing');
  setShowRegister(false);
  setRegisterStep('details');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.pathname !== '/onboarding-payment-complete') return;
    const token = String(url.searchParams.get('waitToken') || '').trim();
    const transactionId = String(url.searchParams.get('transaction_id') || url.searchParams.get('transactionId') || '').trim();
    if (!token || !transactionId) return;
    let active = true;
    setShowRegister(true);
    setWaitToken(token);
    setRegisterStep('waiting');
    setRegisterSubmitting(true);
    setRegisterError(null);
    void (async () => {
      try {
        const response = await fetch(resolveApiUrl(`/api/onboarding/${encodeURIComponent(token)}/payment/verify`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Payment verification failed.');
        if (!active) return;
        setPaymentReference(String(data?.request?.payment_reference || transactionId));
        setToast({ message: 'Flutterwave payment verified. AMI can now approve this school.', type: 'success' });
      } catch (error) {
        if (!active) return;
        setRegisterError(error instanceof Error ? error.message : 'Payment verification failed.');
      } finally {
        if (!active) return;
        setRegisterSubmitting(false);
        window.history.replaceState({}, document.title, '/');
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
	if (!tutorForm.email) return;
	let active = true;
	const timer = window.setTimeout(async () => {
		try {
			const response = await fetch(resolveApiUrl(`/api/tutorials/dashboard?email=${encodeURIComponent(tutorForm.email)}`));
			if (!response.ok || !active) return;
			const data = await response.json();
			if (!active) return;
			setTutorDashboard(data?.tutor || null);
		} catch {}
	}, 250);
	return () => { active = false; window.clearTimeout(timer); };
  }, [tutorForm.email]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!visiblePublicPageIds.has(selectedPublicPageId)) setSelectedPublicPageId(fallbackPublicPageId);
  }, [fallbackPublicPageId, selectedPublicPageId, visiblePublicPageIds]);

  useEffect(() => {
    setInfoMenuOpen(false);
  }, [selectedPublicPageId]);

  useEffect(() => {
	if (!chatOpen) return;
  setChatMessages((current) => current.length ? current : welcomeChatMessages);
  }, [chatOpen, welcomeChatMessages]);

  const submitContact = async () => {
    if (!contactEmail || !contactMessage) return alert('Email and message required');
    const response = await fetchWithAuth('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage, school_id: website?.schoolId || PUBLIC_SCHOOL_ID }) });
    setToast({ message: response?.message || `Message sent and routed to ${response?.inquiry?.primaryResponsibleRole || 'support'}.`, type: 'success' });
    setContactOpen(false); setContactName(''); setContactEmail(''); setContactMessage('');
  };

  const selectedPricingTier = displayPricingTiers.find((tier) => tier.key === selectedPricingTierKey) || displayPricingTiers[0] || null;
  const requestedStudents = Math.max(0, Number(requestedStudentCount || 0));
  const extraStudents = selectedPricingTier && selectedPricingTier.maxStudents !== null && selectedPricingTier.maxStudents > 0 && requestedStudents > selectedPricingTier.maxStudents
  ? requestedStudents - selectedPricingTier.maxStudents
  : 0;
  const perStudentTermAmount = Number(selectedPricingTier?.pricing?.perStudentPerTermNaira ?? selectedPricingTier?.perStudentPerTermNaira ?? 0);
  const oneTimeSetupAmount = Number(selectedPricingTier?.pricing?.oneTimeSetupNaira ?? selectedPricingTier?.oneTimeSetupNaira ?? 0);
  const pricingDiscountPercent = Number(selectedPricingTier?.pricing?.discountPercent || 0);
  const extraStudentDeficit = selectedPricingTier ? extraStudents * perStudentTermAmount : 0;
  const onboardingSubtotal = selectedPricingTier ? oneTimeSetupAmount : 0;
  const onboardingDiscountAmount = Number(validatedDiscount?.discountAmountNaira || 0);
  const onboardingTotal = Math.max(0, Number(validatedDiscount?.finalAmountNaira ?? onboardingSubtotal));
  const tutorPaymentRequired = Boolean(tutorDashboard?.subscription?.paymentRequiredNow);
  const tutorTrialEndsLabel = formatDateLabel(tutorDashboard?.subscription?.trialEndsAt);

  const resetRegisterFlow = () => {
  setShowRegister(false);
  setRegisterStep('details');
  setRegisterError(null);
  setPaymentReference('');
  setCheckoutTxRef('');
  setWaitToken('');
  setRegisterDiscountCode('');
  setValidatedDiscount(null);
  };

  const startSchoolRegistration = () => {
  resetRegisterFlow();
  openPublicPage('pricing');
  };

  const validateRegisterDiscount = async () => {
  if (!waitToken || !registerDiscountCode.trim()) {
    setValidatedDiscount(null);
    return;
  }
  setRegisterSubmitting(true);
  setRegisterError(null);
  try {
    const response = await fetch(resolveApiUrl('/api/onboarding/discount-code/validate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      waitToken,
      discountCode: registerDiscountCode.trim(),
      pricingTierKey: selectedPricingTier?.key,
      requestedStudentCount: requestedStudents || undefined,
    }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Discount code could not be applied.');
    setValidatedDiscount({
    code: String(data?.discountCode?.code || registerDiscountCode.trim()).toUpperCase(),
    percentageOff: Number(data?.discountCode?.percentageOff || 0),
    discountedSubtotalNaira: Number(data?.pricing?.subtotalNaira || 0),
    discountAmountNaira: Number(data?.pricing?.discountAmountNaira || 0),
    finalAmountNaira: Number(data?.pricing?.finalAmountNaira || 0),
    });
    setToast({ message: 'Discount code applied to this registration.', type: 'success' });
  } catch (error) {
    setValidatedDiscount(null);
    setRegisterError(error instanceof Error ? error.message : 'Discount code could not be applied.');
  } finally {
    setRegisterSubmitting(false);
  }
  };

  const submitRegisterSchool = async () => {
  if (!schoolName.trim() || !ownerName.trim() || !adminEmail.trim()) {
    setRegisterError('Add the school name, owner name, and email first.');
    return;
  }
  setRegisterSubmitting(true);
  setRegisterError(null);
  try {
    const response = await fetch(resolveApiUrl('/api/onboarding/register-school'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolName,
        ownerName,
        ownerNdoveraEmail: ownerNdoveraEmail || adminEmail,
        adminEmail,
        phoneNumber,
        pricingTierKey: selectedPricingTier?.key,
        requestedStudentCount: requestedStudents || undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'School sign-up failed.');
    setWaitToken(String(data?.waitToken || ''));
    setValidatedDiscount(null);
    setRegisterDiscountCode('');
    setRegisterStep('payment');
    setToast({ message: 'School sign-up received. Continue to Flutterwave checkout.', type: 'success' });
  } catch (error) {
    setRegisterError(error instanceof Error ? error.message : 'School sign-up failed.');
  } finally {
    setRegisterSubmitting(false);
  }
  };

  const submitRegisterPayment = async () => {
  if (!waitToken) return;
  setRegisterSubmitting(true);
  setRegisterError(null);
  try {
    const checkoutResponse = await fetch(resolveApiUrl(`/api/onboarding/${encodeURIComponent(waitToken)}/checkout`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountCode: registerDiscountCode.trim() || undefined }),
    });
    const checkoutData = await checkoutResponse.json().catch(() => ({}));
    if (!checkoutResponse.ok) throw new Error(checkoutData?.error || 'Checkout could not be started.');
    setCheckoutTxRef(String(checkoutData?.txRef || ''));
    const savedReference = String(checkoutData?.txRef || paymentReference || '').trim();
    setPaymentReference(savedReference);
    if (checkoutData?.checkoutUrl) {
      window.open(String(checkoutData.checkoutUrl), '_blank', 'noopener,noreferrer');
    }
    const response = await fetch(resolveApiUrl(`/api/onboarding/${encodeURIComponent(waitToken)}/payment`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentReference: savedReference, discountCode: registerDiscountCode.trim() || undefined }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Payment record could not be saved.');
    setRegisterStep('waiting');
    setToast({ message: 'Flutterwave checkout opened. Complete payment there, then AMI can approve the school after verification.', type: 'success' });
  } catch (error) {
    setRegisterError(error instanceof Error ? error.message : 'Checkout could not be started.');
  } finally {
  setRegisterSubmitting(false);
  }
  };

  const lookupApplications = async () => {
  if (!applicationLookupEmail.trim() && !applicationLookupCode.trim()) return;
  try {
    const response = await fetch(resolveApiUrl(`/api/opportunities/applications/lookup?email=${encodeURIComponent(applicationLookupEmail.trim())}&applicationCode=${encodeURIComponent(applicationLookupCode.trim())}`));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Application lookup failed.');
    setApplicationResults(Array.isArray(data?.applications) ? data.applications : []);
  } catch (error) {
    setToast({ message: error instanceof Error ? error.message : 'Application lookup failed.', type: 'error' });
  }
  };

  const submitOpportunityApplication = async (vacancy: any) => {
  if (!vacancy) return;
  if (!opportunityForm.name.trim() || !opportunityForm.email.trim() || !opportunityForm.phone.trim()) {
    setToast({ message: 'Add your name, email, and phone number first.', type: 'error' });
    return;
  }
  if (!opportunityForm.hasExistingAccount && !opportunityForm.resumeFullName.trim()) {
    setToast({ message: 'Build your resume before you apply.', type: 'error' });
    return;
  }
  setApplicationSubmitting(true);
  try {
    const response = await fetch(resolveApiUrl('/api/opportunities/apply'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vacancyId: vacancy.id,
        vacancyTitle: vacancy.title,
        name: opportunityForm.name,
        email: opportunityForm.email,
        phone: opportunityForm.phone,
        hasExistingAccount: opportunityForm.hasExistingAccount,
        resume: opportunityForm.hasExistingAccount ? undefined : {
          fullName: opportunityForm.resumeFullName || opportunityForm.name,
          email: opportunityForm.resumeEmail || opportunityForm.email,
          phone: opportunityForm.resumePhone || opportunityForm.phone,
          experience: opportunityForm.experience,
          education: opportunityForm.education,
          skills: opportunityForm.skills.split(',').map((entry) => entry.trim()).filter(Boolean),
          fileUrl: opportunityForm.fileUrl,
        },
        assessment: {
          required: Boolean(vacancy.assessmentRequired),
          status: vacancy.assessmentRequired ? 'pending' : 'not-required',
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Application failed.');
    setApplicationResults((current) => [data.application, ...current.filter((entry) => entry.id !== data.application?.id)]);
    setApplicationLookupEmail(opportunityForm.email);
    setApplicationLookupCode(String(data?.application?.applicationCode || ''));
    setActiveOpportunity(null);
    setOpportunityForm({ name: '', email: '', phone: '', hasExistingAccount: false, resumeFullName: '', resumeEmail: '', resumePhone: '', experience: '', education: '', skills: '', fileUrl: '' });
    setToast({ message: data?.message || 'Application received.', type: 'success' });
  } catch (error) {
    setToast({ message: error instanceof Error ? error.message : 'Application failed.', type: 'error' });
  } finally {
    setApplicationSubmitting(false);
  }
  };

  const submitTutorRegistration = async () => {
  if (!tutorForm.displayName.trim() || !tutorForm.email.trim()) {
    setToast({ message: 'Add your name and email first.', type: 'error' });
    return;
  }
  setTutorSubmitting(true);
  try {
    const response = await fetch(resolveApiUrl('/api/tutorials/register-tutor'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tutorForm),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Tutor registration failed.');
    setTutorDashboard(data?.tutor || null);
    setToast({ message: 'Tutor dashboard created. You can now manage your tutorial work from one place.', type: 'success' });
  } catch (error) {
    setToast({ message: error instanceof Error ? error.message : 'Tutor registration failed.', type: 'error' });
  } finally {
    setTutorSubmitting(false);
  }
  };

  const resetChatVerification = () => {
  setChatMode('public');
  setChatStage('welcome');
  setVerifiedChatUser(null);
  setChatVisitorName('');
  setChatMessages(welcomeChatMessages);
  setChatInput('');
  };

  const sendChat = async (q: string) => {
    const question = q.trim();
    if (!question) return;
    setChatMessages((m) => [...m, { from: 'user', text: question }]);
    setChatInput('');

    if (chatStage === 'welcome') {
      setChatStage('awaiting-identifier');
      setChatMessages((m) => [...m, { from: 'bot', text: FAQ_IDENTIFIER_PROMPT }]);
      return;
    }

    setChatLoading(true);
    try {
    let nextMode: ChatMode = chatMode;
    let nextVerifiedUser = verifiedChatUser;

    if (chatStage === 'awaiting-identifier') {
      const verifyResponse = await fetchWithAuth('/api/faq/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: question }),
      });

      if (verifyResponse.matched) {
        nextMode = 'verified';
        nextVerifiedUser = verifyResponse.user || null;
        setChatMode('verified');
        setChatStage('ready');
        setVerifiedChatUser(nextVerifiedUser);
        setChatMessages((m) => [...m, { from: 'bot', text: verifyResponse.message || `Welcome back ${nextVerifiedUser?.name || ''}. Please continue.`.trim() }]);
        return;
      }

      nextMode = 'public';
      nextVerifiedUser = null;
      setChatMode('public');
      setChatStage('awaiting-description');
      setVerifiedChatUser(null);
      setChatVisitorName(deriveChatVisitorName(question));
      setChatMessages((m) => [...m, { from: 'bot', text: `Hello ${deriveChatVisitorName(question)}, kindly describe what you want.` }]);
      return;
    }

    const d = await fetchWithAuth('/api/faq/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        mode: nextMode === 'verified' ? 'verified' : 'public',
        verifiedUser: nextVerifiedUser,
      }),
    });
    setChatStage('ready');
    if (d.matched) {
      setChatMessages((m) => [...m, { from: 'bot', text: d.answer || `I could not answer that here. Contact ${primaryContactEmail}.` }]);
      return;
    }
    setChatMessages((m) => [...m, { from: 'bot', text: contactFallbackMessage, contactPageLink: true }]);
    } catch {
    setChatMessages((m) => [...m, { from: 'bot', text: `I could not complete that request here. Contact ${primaryContactEmail}.` }]);
    } finally {
    setChatLoading(false);
    }
  };

  const renderSection = (section: any) => {
    if (section.type === 'hero') return <div className="text-center space-y-6"><h1 className="text-5xl font-black tracking-tight text-white lg:text-6xl">{section.content.title}</h1><p className="mx-auto max-w-3xl text-lg text-zinc-400">{section.content.subtitle}</p></div>;
      if (section.type === 'about') return <div className="mx-auto max-w-4xl rounded-4xl border border-white/5 bg-white/3 p-8"><h2 className="mb-4 text-3xl font-bold text-white">About</h2><p className="leading-8 text-zinc-300">{section.content.text}</p></div>;
    if (section.type === 'legal' && activeLegal) return <div className="mx-auto max-w-4xl rounded-4xl border border-white/5 bg-white/3 p-8 text-left"><h2 className="mb-4 text-3xl font-bold text-white">{activeLegal.title}</h2><p className="mb-6 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">Updated {activeLegal.lastUpdated || 'recently'}</p><div className="space-y-5 whitespace-pre-line leading-8 text-zinc-300">{String(activeLegal.body || '').trim()}</div></div>;
    if (section.type === 'contact') return <div className="mx-auto max-w-3xl rounded-4xl border border-white/5 bg-[#151619] p-8 text-left"><h2 className="text-3xl font-bold text-white">Contact this school</h2><p className="mt-2 text-sm text-zinc-400">Send a direct public enquiry to the school team.</p>{website?.contactInfo ? <div className="mt-6 grid grid-cols-1 gap-3 text-sm text-zinc-300 md:grid-cols-2">{website.contactInfo.email ? <a href={`mailto:${website.contactInfo.email}`} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Email</div><div className="mt-2 font-semibold text-white">{website.contactInfo.email}</div></a> : null}{website.contactInfo.phone ? <a href={`tel:${website.contactInfo.phone}`} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Phone</div><div className="mt-2 font-semibold text-white">{website.contactInfo.phone}</div></a> : null}{website.contactInfo.address ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Address</div><div className="mt-2 text-white">{website.contactInfo.address}</div>{tenantLocation ? <div className="mt-2 text-xs text-zinc-400">{tenantLocation}</div> : null}</div> : null}</div> : null}<div className="mt-6 grid gap-4 md:grid-cols-2"><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" /><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" /><textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="Message" className="md:col-span-2 h-36 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white" /><button onClick={submitContact} className="md:col-span-2 rounded-2xl bg-[#066a3e] px-6 py-4 text-sm font-bold text-white">Send Message</button></div></div>;
    if (section.type === 'features') return <div className="grid grid-cols-1 gap-6 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="rounded-4xl border border-white/5 bg-white/3 p-8"><div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400"><Globe size={22} /></div><h3 className="text-xl font-bold text-white">{section.content.title || `Highlight ${item}`}</h3><p className="mt-3 text-sm leading-7 text-zinc-400">{section.content.subtitle || 'Published from the school website template.'}</p></div>)}</div>;
    return null;
  };

  const renderPageIdentity = (label: string) => (
    <div className="mb-8 flex items-center gap-4 rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="logo-white flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-black/20">
        <img src={publicBranding.logoUrl || NDOVERA_LOGO_PATH} alt={publicBranding.schoolName} className="logo-rotate h-12 w-12 object-contain" />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: brandText }}>{label}</p>
        <p className="mt-2 text-sm text-zinc-400">{publicBranding.schoolName} Website</p>
      </div>
    </div>
  );

  const renderBrightFuturePageIdentity = (label: string) => (
    <div className="mb-8 flex items-center gap-4 rounded-4xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {publicBranding.logoUrl ? <img src={publicBranding.logoUrl} alt={publicBranding.schoolName} className="h-full w-full object-contain" /> : <img src={NDOVERA_LOGO_PATH} alt="Ndovera" className="h-12 w-12 object-contain" />}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <p className="mt-2 text-sm text-slate-600">{publicBranding.schoolName}</p>
      </div>
    </div>
  );

  const renderBrightFutureSection = (section: any) => {
    const imageBase = `/website-images/pages/${selectedPublicPage?.id || 'home'}`;
    const primaryAction = pageIsPricing
      ? startSchoolRegistration
      : pageIsGrowth
        ? () => setShowGrowthSignup(true)
        : () => setContactOpen(true);
    const primaryActionLabel = pageIsPricing ? 'Get Started' : pageIsGrowth ? 'Join Now' : 'Talk to us';
    if (section.type === 'hero') {
      return (
        <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] lg:grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-8 lg:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
              <Sparkles size={14} style={{ color: brandColor }} /> {brightFuturePageLabel(selectedPublicPage)}
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-[-0.03em] text-slate-900 lg:text-6xl">{section.content.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{section.content.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={primaryAction} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: brandColor }}>{primaryActionLabel}</button>
              <button onClick={() => setContactOpen(true)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700">Book Demo</button>
            </div>
          </div>
          <div className="min-h-70 bg-slate-100">
            <img src={resolveApiUrl(`${imageBase}/cover-01.jpg`)} alt={section.content.title || brightFuturePageLabel(selectedPublicPage)} className="h-full w-full object-cover" />
          </div>
        </div>
      );
    }
    if (section.type === 'about') {
      return (
        <div className="rounded-[2.25rem] border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:grid lg:grid-cols-[1fr_0.85fr] lg:gap-8 lg:p-10">
          <div>
            <h2 className="text-3xl font-black tracking-[-0.03em] text-slate-900">{brightFuturePageLabel(selectedPublicPage)}</h2>
            <p className="mt-5 whitespace-pre-line text-base leading-8 text-slate-600">{section.content.text}</p>
          </div>
          <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-100 lg:mt-0">
            <img src={resolveApiUrl(`${imageBase}/about-01.jpg`)} alt={brightFuturePageLabel(selectedPublicPage)} className="h-full w-full object-cover" />
          </div>
        </div>
      );
    }
    if (section.type === 'features') {
      const cards = Array.isArray(section.content?.cards) && section.content.cards.length ? section.content.cards : [{ title: brightFuturePageLabel(selectedPublicPage), body: section.content?.subtitle || 'Structured content for your public site.' }];
      return (
        <div className="grid gap-5 lg:grid-cols-3">
          {cards.map((card: any, index: number) => (
            <div key={`${card.title || 'card'}_${index}`} className="rounded-4xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: index % 2 === 0 ? brandColor : accentColor }}><Globe size={18} /></div>
              <h3 className="mt-5 text-2xl font-black tracking-[-0.02em] text-slate-900">{card.title || `Highlight ${index + 1}`}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{card.body || card.subtitle || section.content?.subtitle || 'Editable template content.'}</p>
            </div>
          ))}
        </div>
      );
    }
    if (section.type === 'contact') {
      return (
        <div className="rounded-4xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <h2 className="text-3xl font-black tracking-[-0.03em] text-slate-900">Contact Us</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Reach the right school or platform team from this page.</p>
          {website?.contactInfo ? <div className="mt-6 grid gap-3 md:grid-cols-2">{website.contactInfo.email ? <a href={`mailto:${website.contactInfo.email}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Email</div><div className="mt-2 font-semibold text-slate-900">{website.contactInfo.email}</div></a> : null}{website.contactInfo.phone ? <a href={`tel:${website.contactInfo.phone}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Phone</div><div className="mt-2 font-semibold text-slate-900">{website.contactInfo.phone}</div></a> : null}{website.contactInfo.address ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Address</div><div className="mt-2 text-slate-900">{website.contactInfo.address}</div>{tenantLocation ? <div className="mt-2 text-xs text-slate-500">{tenantLocation}</div> : null}</div> : null}</div> : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900" />
            <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="Message" className="h-36 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 md:col-span-2" />
            <button onClick={submitContact} className="rounded-2xl px-6 py-4 text-sm font-bold text-white md:col-span-2" style={{ background: brandColor }}>Send</button>
          </div>
        </div>
      );
    }
    return renderSection(section);
  };

  const submitGrowth = async (event: React.FormEvent) => {
    event.preventDefault();
    setGrowthSubmitting(true);
    try {
      const response = await fetchWithAuth('/api/growth-partners/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...growthForm, school_id: publicBranding.schoolId || PUBLIC_SCHOOL_ID, source: 'website' }) });
      setGrowthSuccess(true);
      setToast({ message: response?.message || 'Growth partner application received.', type: 'success' });
      setTimeout(() => { setGrowthSuccess(false); setShowGrowthSignup(false); }, 1800);
    } finally { setGrowthSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-zinc-300 font-sans selection:bg-emerald-500/30">
      {toast ? <div className="fixed right-6 top-6 z-50 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{toast.message}</div> : null}
      {showRegister ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"><div className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-4xl border border-white/10 bg-[#151619] p-5 sm:p-6 lg:p-8"><div className="mb-6 flex items-start justify-between gap-6"><div><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-300/70">School onboarding</p><h3 className="mt-2 text-3xl font-bold text-white">Register your school</h3><p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">Choose a plan, confirm your school details, then pay with Flutterwave. Your first payment is the setup fee only. Per-student term billing starts from the second term of usage.</p></div><button onClick={resetRegisterFlow} className="rounded-full border border-white/10 p-2 text-zinc-300 transition hover:bg-white/5"><X /></button></div><div className="mb-6 grid gap-3 md:grid-cols-4">{[
        { id: 'details', label: 'School details' },
        { id: 'payment', label: 'Payment' },
        { id: 'waiting', label: 'Review queue' },
        { id: 'approved', label: 'Approval' },
      ].map((step, index) => {
        const active = registerStep === step.id;
        const complete = ['details', 'payment', 'waiting', 'approved'].indexOf(registerStep) > index;
        return <div key={step.id} className="rounded-2xl border px-4 py-3" style={active ? { borderColor: brandBorder, background: brandSoft } : { borderColor: 'rgba(255,255,255,0.08)', background: complete ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)' }}><div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: active ? brandText : complete ? '#86efac' : '#71717a' }}>Step {index + 1}</div><div className="mt-2 text-sm font-semibold text-white">{step.label}</div></div>;
      })}</div>{registerError ? <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{registerError}</div> : null}{registerStep === 'details' ? <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"><div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="School name" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner name" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Admin email" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input value={ownerNdoveraEmail} onChange={(e) => setOwnerNdoveraEmail(e.target.value)} placeholder="Owner Ndovera email (optional)" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input value={requestedStudentCount} onChange={(e) => setRequestedStudentCount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Expected learners" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /></div><div className="rounded-3xl border border-white/10 bg-black/20 p-5"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Review or switch your plan</p><div className="mt-4 grid gap-3">{registerablePricingTiers.map((tier) => {
            const tierSetup = Number(tier.pricing?.oneTimeSetupNaira ?? tier.oneTimeSetupNaira ?? 0);
            const tierPerStudent = Number(tier.pricing?.perStudentPerTermNaira ?? tier.perStudentPerTermNaira ?? 0);
            const tierDiscount = Number(tier.pricing?.discountPercent || 0);
        return <button key={tier.key} type="button" onClick={() => setSelectedPricingTierKey(tier.key)} className="rounded-2xl border px-4 py-4 text-left transition" style={selectedPricingTierKey === tier.key ? { borderColor: brandBorder, background: brandSoft } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold text-white">{tier.label}</div><div className="mt-1 text-xs text-zinc-400">{formatPricingRange(tier)}</div></div>{tierDiscount > 0 ? <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200">-{tierDiscount}% launch pricing</span> : null}</div><div className="mt-3 flex flex-wrap gap-4 text-sm"><div><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Setup</div><div className="mt-1 text-white">{formatNaira(tierSetup)}</div></div><div><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Per learner / term</div><div className="mt-1 text-white">{formatNaira(tierPerStudent)}</div></div></div></button>;
          })}</div></div></div><div className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">Estimate</p><h4 className="mt-3 text-2xl font-bold text-white">{selectedPricingTier?.label || 'Select a plan'}</h4><p className="mt-3 text-sm leading-7 text-zinc-400">{pricingPlanSummary(selectedPricingTier)}</p><div className="mt-5 space-y-4 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-zinc-400">One-time setup</span><span className="font-semibold text-white">{formatNaira(oneTimeSetupAmount)}</span></div>{extraStudents > 0 ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-6 text-amber-100">You entered {requestedStudents} learners, which is {extraStudents} above this plan guide. The extra learner difference of {formatNaira(extraStudentDeficit)} is not charged at onboarding and can be handled during later billing.</div> : null}<div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4"><span className="text-zinc-300">Amount due now</span><span className="text-xl font-bold text-white">{formatNaira(onboardingSubtotal)}</span></div></div><div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-zinc-400"><p>Approval starts after payment evidence is submitted.</p><p>After payment is confirmed, the owner account is cleared for dashboard access.</p></div><div className="mt-6 flex gap-3"><button disabled={registerSubmitting || !selectedPricingTier} className="rounded-2xl bg-[#066a3e] px-5 py-3 font-bold text-white disabled:opacity-60" onClick={submitRegisterSchool}>Continue to payment</button><button className="rounded-2xl bg-white/5 px-5 py-3 font-bold text-white" onClick={resetRegisterFlow}>Cancel</button></div></div></div> : registerStep === 'payment' ? <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]"><div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"><div><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Payment step</p><h4 className="mt-2 text-2xl font-bold text-white">Add your payment reference</h4><p className="mt-2 text-sm leading-7 text-zinc-400">Use the wait token below for support, then submit the transaction reference used for your school onboarding payment. Once confirmed, the dashboard is opened for the owner account.</p></div><div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Wait token</div><div className="mt-2 font-mono text-white">{waitToken || 'Pending'}</div></div><div className="grid gap-3"><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Bank transfer or payment reference" className="rounded-xl border border-white/10 bg-black/20 p-4 text-white" /><div className="grid gap-3 md:grid-cols-[1fr_auto]"><input value={registerDiscountCode} onChange={(e) => setRegisterDiscountCode(e.target.value.toUpperCase())} placeholder="Discount code (optional)" className="rounded-xl border border-white/10 bg-black/20 p-4 text-white" /><button type="button" disabled={registerSubmitting || !registerDiscountCode.trim()} onClick={validateRegisterDiscount} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">Apply code</button></div>{validatedDiscount ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{validatedDiscount.code} applied. You saved {formatNaira(validatedDiscount.discountAmountNaira)}.</div> : null}</div><div className="flex gap-3 pt-2"><button disabled={registerSubmitting || !paymentReference.trim()} onClick={submitRegisterPayment} className="rounded-2xl bg-[#066a3e] px-5 py-3 font-bold text-white disabled:opacity-60">Submit for review</button><button type="button" onClick={() => setRegisterStep('details')} className="rounded-2xl bg-white/5 px-5 py-3 font-bold text-white">Back</button></div></div><div className="rounded-3xl border border-white/10 bg-black/20 p-6"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Payment summary</p><div className="mt-5 space-y-4 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-zinc-400">Plan</span><span className="font-semibold text-white">{selectedPricingTier?.label || 'Custom plan'}</span></div><div className="flex items-center justify-between gap-4"><span className="text-zinc-400">Learners for later billing</span><span className="font-semibold text-white">{requestedStudents}</span></div><div className="flex items-center justify-between gap-4"><span className="text-zinc-400">Subtotal</span><span className="font-semibold text-white">{formatNaira(validatedDiscount?.discountedSubtotalNaira ?? onboardingSubtotal)}</span></div>{onboardingDiscountAmount > 0 ? <div className="flex items-center justify-between gap-4"><span className="text-zinc-400">Code discount</span><span className="font-semibold text-emerald-200">-{formatNaira(onboardingDiscountAmount)}</span></div> : null}<div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4"><span className="text-zinc-300">Amount to pay</span><span className="text-xl font-bold text-white">{formatNaira(onboardingTotal)}</span></div></div><div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-zinc-400"><p>Discount codes only work while active and within their validity window.</p><p>Expired or discontinued codes are rejected before submission.</p></div></div></div> : registerStep === 'waiting' ? <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-200"><ShieldCheck /></div><h4 className="mt-5 text-2xl font-bold text-white">Your school request is waiting for review</h4><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-emerald-50/85">We have your school details and payment reference. The onboarding team will verify the payment and approve access for the owner account so the dashboard can be used.</p><div className="mt-6 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Wait token</div><div className="mt-2 font-mono text-white">{waitToken}</div></div><div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Reference</div><div className="mt-2 font-semibold text-white">{paymentReference || 'Submitted'}</div></div></div><div className="mt-6 flex justify-center gap-3"><button onClick={() => setSelectedPublicPageId('contact-us')} className="rounded-2xl bg-white/5 px-5 py-3 font-bold text-white">Contact onboarding</button><button onClick={resetRegisterFlow} className="rounded-2xl bg-[#066a3e] px-5 py-3 font-bold text-white">Close</button></div></div> : <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">Approval updates will appear here after the onboarding team finishes review.</div>}</div></div> : null}
      {contactOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"><div className="w-full max-w-lg rounded-4xl border border-white/10 bg-[#151619] p-8"><div className="flex items-center justify-between gap-4"><div><h3 className="text-2xl font-bold text-white">{contactModalTitle}</h3><p className="mt-2 text-sm text-zinc-400">Reach the right team through {primaryContactEmail} or send a message below.</p></div><button onClick={() => setContactOpen(false)}><X /></button></div><div className="mt-4 grid gap-3"><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="Message" className="h-32 rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><button onClick={submitContact} className="rounded-2xl bg-[#066a3e] px-5 py-3 font-bold text-white">Send</button></div></div></div> : null}
      {showGrowthSignup ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"><div className="w-full max-w-xl rounded-4xl border border-white/10 bg-[#151619] p-8">{growthSuccess ? <div className="py-10 text-center text-white"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500"><ShieldCheck /></div><h3 className="text-2xl font-bold">Application Received</h3></div> : <form onSubmit={submitGrowth} className="space-y-4"><div className="flex items-center justify-between"><h3 className="text-2xl font-bold text-white">Join the Growth Team</h3><button type="button" onClick={() => setShowGrowthSignup(false)}><X /></button></div><div className="grid gap-3 md:grid-cols-2"><input required value={growthForm.name} onChange={(e) => setGrowthForm((c) => ({ ...c, name: e.target.value }))} placeholder="Full name" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input required value={growthForm.email} onChange={(e) => setGrowthForm((c) => ({ ...c, email: e.target.value }))} placeholder="Email" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input required value={growthForm.phone} onChange={(e) => setGrowthForm((c) => ({ ...c, phone: e.target.value }))} placeholder="Phone" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><input value={growthForm.city} onChange={(e) => setGrowthForm((c) => ({ ...c, city: e.target.value }))} placeholder="City" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" /><textarea value={growthForm.notes} onChange={(e) => setGrowthForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Why join?" className="h-28 rounded-xl border border-white/10 bg-white/5 p-4 text-white md:col-span-2" /></div><div className="flex gap-3"><button type="submit" disabled={growthSubmitting} className="rounded-2xl px-5 py-3 font-bold text-white" style={{ background: brandColor }}>Submit</button><button type="button" onClick={() => setShowGrowthSignup(false)} className="rounded-2xl bg-white/5 px-5 py-3 font-bold text-white">Cancel</button></div></form>}</div></div> : null}

      <nav className={`sticky top-0 z-40 flex h-24 items-center justify-between px-6 lg:px-20 ${isBrightFutureTemplate ? 'border-b border-slate-200 bg-white text-slate-900 shadow-sm' : 'text-zinc-300'}`} style={isBrightFutureTemplate ? undefined : { background: '#40a829' }}>
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl ${isBrightFutureTemplate ? 'border border-slate-200 bg-slate-50' : 'logo-white'}`}>
            <img src={publicBranding.logoUrl || NDOVERA_LOGO_PATH} alt={publicBranding.schoolName} className={`${isBrightFutureTemplate ? 'h-full w-full object-contain' : 'logo-rotate h-12 w-12 object-contain'}`} />
          </div>
          <span className={`text-3xl font-extrabold ${isBrightFutureTemplate ? 'text-slate-900' : 'text-white'}`}>{publicBranding.schoolName}</span>
        </div>
        <div className="hidden flex-1 justify-center px-8 md:flex">
          <div className={`flex max-w-6xl flex-wrap items-center justify-center gap-2 text-sm font-semibold ${isBrightFutureTemplate ? 'text-slate-700' : 'text-black'}`}>
            {homeNavPage ? <button key={homeNavPage.id} onClick={() => openPublicPage(homeNavPage.id)} className="shrink-0 rounded-full border px-4 py-2.5 transition-all duration-300 hover:opacity-95" style={isBrightFutureTemplate ? (selectedPublicPageId === homeNavPage.id ? { background: brandColor, color: '#ffffff', borderColor: brandColor } : { background: '#ffffff', color: '#334155', borderColor: '#e2e8f0' }) : (selectedPublicPageId === homeNavPage.id ? { background: 'rgba(255,255,255,0.22)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.28)', boxShadow: '0 0 24px rgba(255,255,255,0.18)' } : { background: 'rgba(6,38,14,0.08)', color: '#06260e', borderColor: 'rgba(6,38,14,0.08)' })}>{isBrightFutureTemplate ? 'Home' : homeNavPage.title}</button> : null}
            <div className="relative">
              <button onClick={() => setInfoMenuOpen((current) => !current)} className="shrink-0 rounded-full border px-4 py-2.5 transition-all duration-300 hover:opacity-95" style={isBrightFutureTemplate ? (infoMenuActive || infoMenuOpen ? { background: '#eef2ff', color: brandColor, borderColor: '#c7d2fe' } : { background: '#ffffff', color: '#334155', borderColor: '#e2e8f0' }) : (infoMenuActive || infoMenuOpen ? { background: 'rgba(255,255,255,0.22)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.28)', boxShadow: '0 0 24px rgba(255,255,255,0.18)' } : { background: 'rgba(6,38,14,0.08)', color: '#06260e', borderColor: 'rgba(6,38,14,0.08)' })}>{isBrightFutureTemplate ? 'About' : 'About Us'} <ChevronDown className="ml-2 inline-block" size={16} /></button>
              {infoMenuOpen ? <div className={`absolute left-1/2 top-full z-30 mt-3 w-80 -translate-x-1/2 overflow-hidden rounded-[1.75rem] p-3 shadow-2xl shadow-black/20 ${isBrightFutureTemplate ? 'border border-slate-200 bg-white text-slate-900' : 'border border-emerald-950/10 bg-[rgba(248,250,252,0.96)] text-slate-900 backdrop-blur-xl'}`}>{infoMenuPages.map((page) => <button key={page.id} onClick={() => openPublicPage(page.id)} className={`flex w-full items-start justify-between gap-4 rounded-2xl px-4 py-3 text-left transition ${isBrightFutureTemplate ? 'hover:bg-slate-50' : 'hover:bg-emerald-50'}`}><div><div className="text-sm font-extrabold text-slate-900">{isBrightFutureTemplate ? brightFuturePageLabel(page) : page.title}</div><div className="mt-1 text-xs leading-5 text-slate-600">{aboutMenuDescription(page.id)}</div></div><ChevronRight size={16} className="mt-1 shrink-0 text-slate-400" /></button>)}</div> : null}
            </div>
            {secondaryNavPages.map((page) => <button key={page.id} onClick={() => openPublicPage(page.id)} className="shrink-0 rounded-full border px-4 py-2.5 transition-all duration-300 hover:opacity-95" style={isBrightFutureTemplate ? (selectedPublicPageId === page.id ? { background: '#eef2ff', color: brandColor, borderColor: '#c7d2fe' } : { background: '#ffffff', color: '#334155', borderColor: '#e2e8f0' }) : (selectedPublicPageId === page.id ? { background: 'rgba(255,255,255,0.22)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.28)', boxShadow: '0 0 24px rgba(255,255,255,0.18)' } : { background: 'rgba(6,38,14,0.08)', color: '#06260e', borderColor: 'rgba(6,38,14,0.08)' })}>{isBrightFutureTemplate ? brightFuturePageLabel(page) : page.title}</button>)}
          </div>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <button onClick={onLogin} className={`text-sm font-bold ${isBrightFutureTemplate ? 'text-slate-700' : 'text-black'}`}>Sign In</button>
          {!publicBranding.isTenant ? <button onClick={startSchoolRegistration} className="rounded-xl px-5 py-2.5 font-bold text-white" style={{ background: isBrightFutureTemplate ? brandColor : '#066a3e' }}>Register School</button> : null}
        </div>
        <div className="relative flex items-center md:hidden">
          <button onClick={() => setMobileNavOpen((current) => !current)} className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-lg ${isBrightFutureTemplate ? 'border-slate-200 bg-white text-slate-700 shadow-slate-200/60' : 'border-white/20 bg-white/10 text-white shadow-black/20'}`}>
            {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          {mobileNavOpen ? (
            <div className={`absolute right-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.75rem] shadow-2xl ${isBrightFutureTemplate ? 'border border-slate-200 bg-white' : 'border border-white/10 bg-[#0A0B0D]/95 backdrop-blur-xl'}`}>
              <div className={`max-h-[70vh] overflow-y-auto px-4 py-4 text-sm font-semibold ${isBrightFutureTemplate ? 'text-slate-700' : 'text-zinc-200'}`}>
                {homeNavPage ? <button key={`mobile_${homeNavPage.id}`} onClick={() => openPublicPage(homeNavPage.id)} className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left" style={isBrightFutureTemplate ? (selectedPublicPageId === homeNavPage.id ? { borderColor: '#c7d2fe', background: '#eef2ff', color: brandColor } : { borderColor: '#e2e8f0', background: '#ffffff', color: '#334155' }) : (selectedPublicPageId === homeNavPage.id ? { borderColor: 'rgba(64,168,41,0.35)', background: 'rgba(64,168,41,0.18)', color: '#ffffff' } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e4e4e7' })}><span>{isBrightFutureTemplate ? 'Home' : homeNavPage.title}</span><ChevronRight size={16} className="text-zinc-500" /></button> : null}
                <div className={`mt-3 rounded-3xl p-3 ${isBrightFutureTemplate ? 'border border-slate-200 bg-slate-50' : 'border border-white/10 bg-white/5'}`}>
                  <button onClick={() => setInfoMenuOpen((current) => !current)} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left" style={isBrightFutureTemplate ? (infoMenuActive || infoMenuOpen ? { background: '#eef2ff', color: brandColor } : { color: '#334155' }) : (infoMenuActive || infoMenuOpen ? { background: 'rgba(64,168,41,0.18)', color: '#ffffff' } : { color: '#e4e4e7' })}><span>{isBrightFutureTemplate ? 'About' : 'About Us'}</span><ChevronDown size={16} className={infoMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>
                  {infoMenuOpen ? <div className="mt-2 grid gap-2">{infoMenuPages.map((page) => <button key={`mobile_info_${page.id}`} onClick={() => openPublicPage(page.id)} className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold ${isBrightFutureTemplate ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-black/20 text-zinc-200'}`}><div><div className={`text-sm font-bold ${isBrightFutureTemplate ? 'text-slate-900' : 'text-white'}`}>{isBrightFutureTemplate ? brightFuturePageLabel(page) : page.title}</div><div className={`mt-1 text-xs leading-5 ${isBrightFutureTemplate ? 'text-slate-500' : 'text-zinc-400'}`}>{aboutMenuDescription(page.id)}</div></div><ChevronRight size={16} className="mt-1 shrink-0 text-zinc-500" /></button>)}</div> : null}
                </div>
                <div className="mt-3 grid gap-3">
                  {secondaryNavPages.map((page) => <button key={`mobile_${page.id}`} onClick={() => openPublicPage(page.id)} className="flex items-center justify-between rounded-2xl border px-4 py-3 text-left" style={isBrightFutureTemplate ? (selectedPublicPageId === page.id ? { borderColor: '#c7d2fe', background: '#eef2ff', color: brandColor } : { borderColor: '#e2e8f0', background: '#ffffff', color: '#334155' }) : (selectedPublicPageId === page.id ? { borderColor: 'rgba(64,168,41,0.35)', background: 'rgba(64,168,41,0.18)', color: '#ffffff' } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e4e4e7' })}><span>{isBrightFutureTemplate ? brightFuturePageLabel(page) : page.title}</span><ChevronRight size={16} className="text-zinc-500" /></button>)}
                </div>
                <div className={`mt-4 grid gap-3 pt-4 ${isBrightFutureTemplate ? 'border-t border-slate-200' : 'border-t border-white/10'}`}>
                  <button onClick={() => { setMobileNavOpen(false); onLogin(); }} className={`rounded-2xl px-4 py-3 ${isBrightFutureTemplate ? 'border border-slate-200 bg-white text-slate-900' : 'border border-white/10 bg-white/5 text-white'}`}>Sign In</button>
                  {!publicBranding.isTenant ? <button onClick={() => { startSchoolRegistration(); }} className="rounded-2xl px-4 py-3 text-white" style={{ background: isBrightFutureTemplate ? brandColor : '#066a3e' }}>Register School</button> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </nav>

      {isBrightFutureTemplate ? (
        pageIsHome ? (
          <BrightFutureHomeSections
            siteName={publicBranding.schoolName}
            siteLogoUrl={publicBranding.logoUrl}
            brandColor={brandColor}
            accentColor={accentColor}
            heroImages={heroImages}
            showcaseSchools={displayShowcaseSchools}
            testimonials={testimonials.length ? testimonials : sampleTestimonials()}
            pricingTiers={pricingTiers}
            resolveAssetUrl={resolveApiUrl}
            onShowRegister={startSchoolRegistration}
            onContact={() => setContactOpen(true)}
            onGrowth={() => setShowGrowthSignup(true)}
            onOpenPricing={() => setSelectedPublicPageId('pricing')}
          />
        ) : pageIsPricing ? (
          <section className="bg-slate-50 px-6 py-16 lg:px-20">
            <div className="mx-auto max-w-7xl">
              <div className="grid gap-5 xl:grid-cols-3">
                {displayPricingTiers.map((tier) => {
                  const setupFee = Number(tier.pricing?.oneTimeSetupNaira ?? tier.oneTimeSetupNaira ?? 0);
                  const currentBilledRate = Number(tier.pricing?.perStudentPerTermNaira ?? tier.perStudentPerTermNaira ?? 0);
                  const isCustom = tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0);
                  const isSelected = selectedPricingTierKey === tier.key;
                  return (
                    <div
                      key={tier.key}
                      onClick={() => setSelectedPricingTierKey(tier.key)}
                      className="rounded-4xl border bg-white p-8 text-left shadow-[0_20px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-1"
                      style={isSelected ? { borderColor: brandColor, boxShadow: `0 20px 50px rgba(15,23,42,0.08), 0 0 0 1px ${brandColor} inset` } : { borderColor: '#e2e8f0' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Tier name</div>
                          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900">{tier.label}</h2>
                        </div>
                        {isSelected ? <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white" style={{ background: brandColor }}>Selected</span> : null}
                      </div>
                      <div className="mt-6 rounded-3xl bg-slate-50 p-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Setup fee</div>
                        <div className="mt-3 text-4xl font-black" style={{ color: brandColor }}>{isCustom ? 'Custom quote' : formatNaira(setupFee)}</div>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-3xl bg-slate-50 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Learner range</div>
                          <div className="mt-3 text-lg font-bold text-slate-900">{formatPricingRange(tier)}</div>
                        </div>
                        <div className="rounded-3xl bg-slate-50 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Per-learner term price</div>
                          <div className="mt-3 text-lg font-bold text-slate-900">{isCustom ? 'Custom quote' : formatNaira(currentBilledRate)}</div>
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end">
                        <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedPricingTierKey(tier.key); if (isCustom) { openPublicPage('contact-us'); return; } setShowRegister(true); setRegisterStep('payment'); }} className="rounded-2xl px-4 py-3 text-sm font-bold text-white" style={{ background: isSelected ? brandColor : accentColor }}>{isCustom ? 'Request quote' : 'Proceed to pay'}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : pageIsEvents ? (
          <section className="bg-slate-50 px-6 py-16 lg:px-20">
            <div className="mx-auto max-w-7xl">
              {renderBrightFuturePageIdentity('Events Page')}
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {displayEventGallery.map((event) => {
                  const eventCaption = 'caption' in event ? event['caption'] : undefined;
                  const eventNote = 'note' in event ? event['note'] : undefined;

                  return (
                  <div key={event.id} className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="aspect-16/10 bg-slate-100">
                      {'url' in event && event.url ? <img src={resolveApiUrl(event.url)} alt={String(event.title || eventCaption || 'School event')} className="h-full w-full object-cover" /> : <img src={resolveApiUrl('/website-images/pages/events-gallery/gallery-01.jpg')} alt="Events" className="h-full w-full object-cover" />}
                    </div>
                    <div className="p-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Events</p>
                      <h2 className="mt-3 text-2xl font-black text-slate-900">{event.title || 'School event'}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{eventCaption || eventNote || 'Moments from school life and community events.'}</p>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          </section>
        ) : pageIsLegal ? (
          <section className="bg-slate-50 px-6 py-16 lg:px-20">
            <div className="mx-auto max-w-5xl rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)] lg:p-12">
              {renderBrightFuturePageIdentity('Legal Page')}
              <div className="space-y-8 text-center">
                <h1 className="text-4xl font-black tracking-[-0.03em] text-slate-900 lg:text-5xl">{activeLegal?.title}</h1>
                <p className="mx-auto max-w-3xl text-base leading-8 text-slate-600">These pages explain, in simple words, how {publicBranding.schoolName} handles fair use, privacy, and public forms.</p>
                <div className="rounded-4xl bg-slate-50 p-8 text-left whitespace-pre-line leading-8 text-slate-700">{activeLegal?.body}</div>
              </div>
            </div>
          </section>
        ) : pageIsVacancy ? (
          <section className="bg-slate-50 px-6 py-16 lg:px-20">
            <div className="mx-auto max-w-7xl">
              {renderBrightFuturePageIdentity('Opportunities Page')}
              <div className="grid gap-5 lg:grid-cols-2">
                {displayVacancies.map((vacancy) => (
                  <div key={vacancy.id} className="rounded-4xl border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white" style={{ background: brandColor }}>{vacancy.category}</span>
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{vacancy.type}</span>
                    </div>
                    <h2 className="mt-5 text-3xl font-black tracking-[-0.03em] text-slate-900">{vacancy.title}</h2>
                    <p className="mt-4 text-sm leading-7 text-slate-600">{vacancy.description}</p>
                    <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200 pt-5">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Pay</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{vacancy.salary || 'Shared during review'}</div>
                      </div>
                      <button onClick={() => setContactOpen(true)} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: accentColor }}>Apply or Ask</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-slate-50 px-6 py-16 lg:px-20">
            <div className="mx-auto max-w-7xl">
              {renderBrightFuturePageIdentity(brightFuturePageLabel(selectedPublicPage))}
              <div className="space-y-8">{(selectedPublicPage?.sections || []).map((section) => <div key={section.id}>{renderBrightFutureSection(section)}</div>)}</div>
            </div>
          </section>
        )
      ) : pageIsHome ? (
        <LandingHomeSections
          brandColor={brandColor}
          brandSoft={brandSoft}
          brandBorder={brandBorder}
          brandText={brandText}
          heroImages={heroImages}
          showcaseSchools={displayShowcaseSchools}
          testimonials={testimonials.length ? testimonials : sampleTestimonials()}
          pricingTiers={pricingTiers}
          resolveAssetUrl={resolveApiUrl}
          onShowRegister={startSchoolRegistration}
          onContact={() => setContactOpen(true)}
          onGrowth={() => setShowGrowthSignup(true)}
          onOpenPricing={() => setSelectedPublicPageId('pricing')}
        />
      ) : pageIsPricing ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            <div className="mt-12 grid gap-6 xl:grid-cols-3">
              {displayPricingTiers.map((tier) => {
                const setupFee = Number(tier.pricing?.oneTimeSetupNaira ?? tier.oneTimeSetupNaira ?? 0);
                const currentBilledRate = Number(tier.pricing?.perStudentPerTermNaira ?? tier.perStudentPerTermNaira ?? 0);
                const isCustom = tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0);
                const isSelected = selectedPricingTierKey === tier.key;

                return (
                  <div
                    key={tier.key}
                    onClick={() => setSelectedPricingTierKey(tier.key)}
                    className="rounded-4xl border bg-[#0d0f10] p-7 text-left shadow-[0_24px_60px_rgba(0,0,0,0.22)] transition hover:-translate-y-1"
                    style={isSelected ? { borderColor: brandColor, boxShadow: `0 24px 60px rgba(0,0,0,0.22), 0 0 0 1px ${brandColor} inset` } : { borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Tier name</p>
                        <h2 className="mt-3 text-3xl font-black text-white">{tier.label}</h2>
                      </div>
                      {isSelected ? <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white" style={{ background: brandColor }}>Selected</span> : null}
                    </div>

                    <div className="mt-8 space-y-4">
                      <div className="rounded-3xl border border-white/5 bg-white/5 p-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Setup fee</div>
                        <div className="mt-3 text-3xl font-black text-white">{isCustom ? 'Manual quote' : formatNaira(setupFee)}</div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-3xl border border-white/5 bg-white/5 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Learner range</div>
                          <div className="mt-3 text-xl font-bold text-white">{formatPricingRange(tier)}</div>
                        </div>
                        <div className="rounded-3xl border border-white/5 bg-white/5 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Per-learner term price</div>
                          <div className="mt-3 text-xl font-bold text-white">{isCustom ? 'Manual quote' : formatNaira(currentBilledRate)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedPricingTierKey(tier.key); if (isCustom) { openPublicPage('contact-us'); return; } setShowRegister(true); setRegisterStep('payment'); }} className="rounded-2xl px-4 py-3 text-sm font-bold text-white" style={{ background: isSelected ? brandColor : '#066a3e' }}>{isCustom ? 'Request quote' : 'Proceed to pay'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : pageIsTutor ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity('Tutor Page')}
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}><Sprout size={14} /> Become a Tutor</div>
                <h1 className="text-4xl font-black text-white lg:text-5xl">Start with a 7-day trial, then move to upfront access</h1>
                <p className="text-lg leading-8 text-zinc-400">Independent tutors can register, test the workspace for one week, then keep creating classes and students after payment is activated.</p>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Tutor billing policy</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Monthly access</div><div className="mt-2 text-xl font-bold text-white">{formatNaira(Number(tutorDashboard?.subscription?.monthlyFeeNaira || 5000))}</div></div>
                    <div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Included students</div><div className="mt-2 text-xl font-bold text-white">{Number(tutorDashboard?.subscription?.includedStudents || 5)}</div></div>
                    <div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Extra student fee</div><div className="mt-2 text-xl font-bold text-white">{formatNaira(Number(tutorDashboard?.subscription?.extraStudentFeeNaira || 500))}</div></div>
                  </div>
                </div>
                {tutorDashboard ? <div className="rounded-3xl border px-5 py-5" style={tutorPaymentRequired ? { borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(127,29,29,0.22)' } : { borderColor: brandBorder, background: brandSoft }}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: tutorPaymentRequired ? '#fecaca' : brandText }}>Tutor dashboard</div><div className="mt-2 text-lg font-bold text-white">{tutorDashboard.displayName}</div></div><div className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]" style={tutorPaymentRequired ? { background: 'rgba(239,68,68,0.14)', color: '#fecaca' } : { background: 'rgba(16,185,129,0.14)', color: '#bbf7d0' }}>{tutorDashboard.subscription.paymentPhase || tutorDashboard.subscription.status}</div></div><div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-zinc-200"><div className="rounded-2xl bg-black/20 px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Trial ends</div><div className="mt-2">{tutorTrialEndsLabel}</div></div><div className="rounded-2xl bg-black/20 px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Current access</div><div className="mt-2">{tutorPaymentRequired ? 'Payment required before new classes or students can be created.' : 'Premium tutor tools are available.'}</div></div></div></div> : null}
              </div>
              <div className="rounded-4xl border border-white/10 bg-[#0d0f10] p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Tutor registration</p>
                <div className="mt-5 grid gap-3">
                  <input value={tutorForm.displayName} onChange={(e) => setTutorForm((current) => ({ ...current, displayName: e.target.value }))} placeholder="Your full name" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" />
                  <input value={tutorForm.email} onChange={(e) => setTutorForm((current) => ({ ...current, email: e.target.value }))} placeholder="Email address" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" />
                  <input value={tutorForm.phone} onChange={(e) => setTutorForm((current) => ({ ...current, phone: e.target.value }))} placeholder="Phone" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" />
                  <input value={tutorForm.specialty} onChange={(e) => setTutorForm((current) => ({ ...current, specialty: e.target.value }))} placeholder="Specialty" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white" />
                  <textarea value={tutorForm.headline} onChange={(e) => setTutorForm((current) => ({ ...current, headline: e.target.value }))} placeholder="Short teaching headline" className="h-28 rounded-xl border border-white/10 bg-white/5 p-4 text-white" />
                  <button disabled={tutorSubmitting} onClick={submitTutorRegistration} className="rounded-2xl bg-[#066a3e] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">Create tutor workspace</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : pageIsAbout ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            <div className="space-y-10">
              {renderPageIdentity('About Us')}
              <div className="max-w-4xl space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}><Globe size={14} /> About Us</div>
                <h1 className="text-4xl font-black text-white lg:text-5xl">Built with care for students, teachers, and schools</h1>
                <div className="whitespace-pre-line text-lg leading-8 text-zinc-400">{ABOUT_US_CONTENT}</div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button onClick={() => openPublicPage('vision-values')} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: brandColor }}>Open Vision</button>
                  <button onClick={() => openPublicPage('mission')} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white">Open Mission</button>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { title: 'For teaching', body: 'Share class work, track progress, and help every learner move forward.' },
                  { title: 'For operations', body: 'Handle attendance, records, and updates without confusion.' },
                  { title: 'For finance', body: 'Keep fees, payment records, and follow-up work neat and easy to check.' },
                  { title: 'For families', body: 'Give parents and students clear updates, notices, and public school information.' },
                ].map((item) => (
                  <div key={item.title} className="rounded-3xl border border-white/5 bg-white/3 p-6">
                    <p className="text-sm font-bold uppercase tracking-[0.22em] text-zinc-500">Ndovera</p>
                    <h3 className="mt-3 text-xl font-bold text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-zinc-400">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : pageIsVision ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-5xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity('Vision Page')}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}><ShieldCheck size={14} /> Vision</div>
              <h1 className="text-4xl font-black text-white lg:text-5xl">The vision guiding Ndovera</h1>
              <div className="whitespace-pre-line text-lg leading-8 text-zinc-300">{VISION_CONTENT}</div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => openPublicPage('mission')} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: brandColor }}>Open Mission</button>
                <button onClick={() => openPublicPage('about-us')} className="rounded-2xl bg-white/5 px-5 py-3 text-sm font-bold text-white">Back to About Us</button>
              </div>
            </div>
          </div>
        </section>
      ) : pageIsMission ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-5xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity('Mission Page')}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}><ShieldCheck size={14} /> Mission</div>
              <h1 className="text-4xl font-black text-white lg:text-5xl">The mission behind everyday work</h1>
              <div className="whitespace-pre-line text-lg leading-8 text-zinc-300">{MISSION_CONTENT}</div>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => openPublicPage('vision-values')} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: brandColor }}>Open Vision</button>
                <button onClick={() => openPublicPage('about-us')} className="rounded-2xl bg-white/5 px-5 py-3 text-sm font-bold text-white">Back to About Us</button>
              </div>
            </div>
          </div>
        </section>
      ) : pageIsGrowth ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity('Growth Partners Page')}
            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.9fr]">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}><Sprout size={14} /> Growth Partners</div>
                <h1 className="text-4xl font-black text-white lg:text-5xl">Growth partner applications are open</h1>
                <p className="text-lg leading-8 text-zinc-400">If you help schools discover useful tools, you can apply here. Approved partners get a limited workspace for referrals and onboarding support only.</p>
                <div className="rounded-3xl border border-white/5 bg-white/3 p-6 text-sm leading-7 text-zinc-300">Every application goes to the main growth team for review before any access is given.</div>
              </div>
              <div className="space-y-4 rounded-3xl border border-white/5 bg-white/3 p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">What partners do</p>
                <ul className="space-y-3 text-sm text-zinc-300">
                  <li>Introduce schools to Ndovera in a clear and honest way.</li>
                  <li>Help new schools understand the first steps after sign-up.</li>
                  <li>Support public events and growth activity when invited.</li>
                </ul>
                <div className="flex flex-col gap-3 pt-4">
                  <button onClick={() => setShowGrowthSignup(true)} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: brandColor }}>Apply now</button>
                  <button onClick={() => setContactOpen(true)} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white">Ask a question first</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : pageIsContact ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-5xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity('Contact Page')}
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}><ShieldCheck size={14} /> Contact Us</div>
                <h1 className="text-4xl font-black text-white lg:text-5xl">Get help from the right Ndovera team</h1>
                <p className="text-lg leading-8 text-zinc-400">Send your message here. We sort it to the right team so you do not have to guess who should handle it.</p>
                <div className="rounded-3xl border border-white/5 bg-white/3 p-6 text-sm text-zinc-300">
                  <p className="font-bold text-white">What this can help with</p>
                  <p className="mt-3 leading-7">School sign-up, growth partnerships, events, billing questions, privacy questions, and general support.</p>
                </div>
              </div>
              <div>{renderSection({ id: 'contact_us_page', type: 'contact', content: {} })}</div>
            </div>
          </div>
        </section>
      ) : pageIsEvents ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-6xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity('Events Page')}
            <div className="max-w-4xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}><Zap size={14} /> Events Gallery</div>
              <h1 className="text-4xl font-black text-white lg:text-5xl">Events that show school life and support in action</h1>
              <p className="text-lg leading-8 text-zinc-400">From school launch days to family sessions, this page shows the kind of public events Ndovera supports.</p>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {displayEventGallery.map((event) => 'accent' in event ? (
                <div key={event.id} className="rounded-4xl border border-white/5 p-7" style={{ background: event.accent }}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-200">Ndovera Events</p>
                  <h2 className="mt-4 text-2xl font-bold text-white">{event.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-100/85">{event.note}</p>
                </div>
              ) : (
                <div key={event.id} className="overflow-hidden rounded-4xl border border-white/5 bg-black/20">
                  <div className="aspect-16/10 w-full bg-black/30">
                    <img src={resolveApiUrl(event.url)} alt={event.title || event.caption || 'School event'} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">Ndovera Events</p>
                    <h2 className="mt-3 text-xl font-bold text-white">{event.title || 'School event'}</h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-400">{event.caption || 'Moments from school life and community events.'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : pageIsLegal ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-4xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity('Legal Page')}
            <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <button onClick={() => openPublicPage('home')} className="rounded-full bg-white/5 px-4 py-2">Home</button>
              <ChevronRight size={16} />
              <span className="rounded-full px-4 py-2" style={{ background: brandSoft, color: brandText }}>{activeLegal?.title}</span>
            </div>
            <div className="space-y-8 text-center">
              <h1 className="text-4xl font-black text-white lg:text-5xl">{activeLegal?.title}</h1>
              <p className="mx-auto max-w-3xl text-base leading-8 text-zinc-400">These pages explain, in simple words, how Ndovera handles fair use, privacy, and public forms.</p>
              <div className="rounded-4xl border border-white/5 bg-white/3 p-8 text-left whitespace-pre-line leading-8 text-zinc-300">{activeLegal?.body}</div>
            </div>
          </div>
        </section>
      ) : pageIsVacancy ? (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity('Opportunities Page')}
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}><Briefcase size={14} /> Careers & Opportunities</div>
              <h1 className="text-4xl font-black text-white lg:text-5xl">Opportunities to work with Ndovera</h1>
              <p className="text-lg leading-8 text-zinc-400">This page shares current openings and other ways to work with the Ndovera team.</p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {displayVacancies.map((vacancy) => (
                <div key={vacancy.id} className="rounded-4xl border border-white/5 bg-white/3 p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ background: brandSoft, color: brandText }}>{vacancy.category}</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-400">{vacancy.type}</span>
                    {usingFallbackVacancies ? <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-400">Example opening</span> : null}
                  </div>
                  <h2 className="mt-5 text-2xl font-bold text-white">{vacancy.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-zinc-300">{vacancy.description}</p>
                  <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/5 pt-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Pay</div>
                      <div className="text-sm font-semibold text-white">{vacancy.salary || 'Shared during review'}</div>
                    </div>
                    <button onClick={() => setContactOpen(true)} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: brandColor }}>Apply or ask</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="px-6 py-16 lg:px-20">
          <div className="mx-auto max-w-4xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
            {renderPageIdentity(selectedPublicPage?.title || 'Website Page')}
            <div className="space-y-8">{(selectedPublicPage?.sections || []).map((section) => <div key={section.id}>{renderSection(section)}</div>)}</div>
          </div>
        </section>
      )}

      <footer className="border-t border-white/5 py-12 text-center"><div className="space-y-5"><div className="flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-400">{footerContacts.map((item, index) => <React.Fragment key={item.id}><a href={item.href} target={item.id === 'public-url' ? '_blank' : undefined} rel={item.id === 'public-url' ? 'noreferrer' : undefined}>{item.label}</a>{index < footerContacts.length - 1 ? <span>|</span> : null}</React.Fragment>)}</div><div className="flex items-center justify-center gap-3">{[
        { id: 'facebook', icon: <Facebook size={18} />, href: website?.socialLinks?.facebook || '' },
        { id: 'instagram', icon: <Instagram size={18} />, href: website?.socialLinks?.instagram || '' },
        { id: 'linkedin', icon: <Linkedin size={18} />, href: website?.socialLinks?.linkedin || '' },
        { id: 'youtube', icon: <Youtube size={18} />, href: website?.socialLinks?.youtube || '' },
      ].map((item) => item.href ? <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:border-white/20 hover:text-white">{item.icon}</a> : <button key={item.id} onClick={() => setSelectedPublicPageId('contact-us')} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:border-white/20 hover:text-white">{item.icon}</button>)}</div><div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-zinc-500"><button onClick={() => setSelectedPublicPageId('privacy-policy')}>Privacy Policy</button><button onClick={() => setSelectedPublicPageId('terms-of-service')}>Terms of Service</button></div></div></footer>

      {chatOpen ? <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-white/5 bg-[#07100a] p-3 shadow-xl"><div className="mb-2 flex items-center justify-between"><div><div className="font-bold text-white">{assistantTitle}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">Ready to help</div></div><button onClick={() => setChatOpen(false)} className="text-zinc-400" aria-label="Close assistant"><X size={16} /></button></div><div className="mb-2 flex gap-2"><button onClick={resetChatVerification} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">Start new chat</button>{chatMode === 'public' && !publicBranding.isTenant ? <button onClick={startSchoolRegistration} className="rounded-lg bg-[#066a3e] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Register school</button> : null}</div><div className="h-56 space-y-2 overflow-y-auto p-2">{chatMessages.map((m, i) => <div key={i} className={`rounded p-2 whitespace-pre-line ${m.from === 'user' ? 'bg-white/5 text-white' : 'bg-white/10 text-zinc-100'}`}>{m.text}{m.contactPageLink ? <div className="mt-2"><a href="/contact-us" onClick={(event) => { event.preventDefault(); setSelectedPublicPageId('contact-us'); setChatOpen(false); }} className="text-sm font-semibold text-emerald-300 underline underline-offset-2">Open Contact Us</a></div> : null}</div>)}</div><div className="mt-2 flex gap-2"><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) sendChat(chatInput); }} placeholder={chatStage === 'awaiting-identifier' ? 'Name, email, phone number, or user ID' : chatStage === 'awaiting-description' ? `Describe what you want${chatVisitorName ? `, ${chatVisitorName}` : ''}` : assistantPrompt} className="flex-1 rounded bg-white/5 px-3 py-2 text-white outline-none" /><button onClick={() => sendChat(chatInput)} disabled={chatLoading} className="rounded bg-[#40a829] px-3 py-2 text-white disabled:opacity-60">{chatLoading ? '...' : 'Send'}</button></div></div> : <button onClick={() => setChatOpen(true)} className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#40a829] text-white shadow-lg" aria-label="Open assistant"><MessageCircle size={22} /></button>}
    </div>
  );
};
