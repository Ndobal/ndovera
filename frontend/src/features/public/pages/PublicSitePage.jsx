import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  AcademicCapIcon,
  ArrowRightIcon,
  Bars3Icon,
  BookOpenIcon,
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  CpuChipIcon,
  GlobeAltIcon,
  HandRaisedIcon,
  LightBulbIcon,
  NewspaperIcon,
  PhotoIcon,
  RocketLaunchIcon,
  SparklesIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getPublicPlatformSite, getPublicOpportunities, submitGrowthPartnerApplication } from '../services/publicSiteApi';
import { getTenantPricing } from '../../tenants/services/tenantApi';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Mission', path: '/mission' },
  { label: 'Vision', path: '/vision' },
  { label: 'Growth Partners', path: '/growth-partners' },
  { label: 'Tutor', path: '/tutor' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Opportunities', path: '/opportunities' },
  { label: 'Events', path: '/events' },
  { label: 'Gallery', path: '/gallery' },
];

const IMPACT_METRICS = [
  { label: 'School owners', value: 'Clear view' },
  { label: 'Parents', value: 'Better updates' },
  { label: 'Teachers', value: 'Less stress' },
  { label: 'Growth', value: 'Stronger base' },
];

const HOME_STRANDS = [
  {
    title: 'Leadership Control',
    description: 'Give school owners a clearer picture of daily work, progress, and what needs attention next.',
    icon: ChartBarIcon,
    path: '/about',
  },
  {
    title: 'Parent Confidence',
    description: 'Help families feel informed, respected, and closer to the life of the school.',
    icon: AcademicCapIcon,
    path: '/tutor',
  },
  {
    title: 'Better Learning Support',
    description: 'Support teachers and students with tools that keep learning clear and steady.',
    icon: GlobeAltIcon,
    path: '/growth-partners',
  },
  {
    title: 'A Stronger School Brand',
    description: 'Show the school well in public while improving how the school runs inside.',
    icon: PhotoIcon,
    path: '/events',
  },
];

const ABOUT_PILLARS = [
  {
    title: 'For School Owners',
    description: 'See the school more clearly, lead with more confidence, and make better decisions faster.',
  },
  {
    title: 'For Parents',
    description: 'Create communication that is easier to trust and easier to understand.',
  },
  {
    title: 'For Real Growth',
    description: 'Build a stronger school image while improving the daily systems behind it.',
  },
];

const MISSION_PILLARS = [
  {
    title: 'Help owners lead well',
    description: 'Give school leaders better visibility and fewer blind spots in daily operations.',
  },
  {
    title: 'Help parents stay informed',
    description: 'Make school communication clearer, calmer, and easier to trust.',
  },
  {
    title: 'Help teaching stay strong',
    description: 'Support teachers and students with tools that keep learning focused and moving forward.',
  },
];

const VISION_HORIZONS = [
  {
    title: 'Confident leadership',
    description: 'School owners should be able to see what matters and act early with confidence.',
  },
  {
    title: 'Trusted parent communication',
    description: 'Families should not be left guessing about school life or student progress.',
  },
  {
    title: 'Better supported learning',
    description: 'Students should have stronger guidance without losing effort, care, or human support.',
  },
];

const PARTNER_TRACKS = [
  {
    title: 'School Groups',
    description: 'Work with NDOVERA to help more schools move into stronger, more trusted systems.',
  },
  {
    title: 'Rollout Partners',
    description: 'Help schools launch well, train teams, and keep adoption strong after go-live.',
  },
  {
    title: 'Education Supporters And Investors',
    description: 'Back practical tools and services that help schools improve in visible ways.',
  },
];

const TUTOR_MODES = [
  {
    title: 'Homework Help',
    description: 'Students get clear guidance when they are stuck, without losing the chance to think for themselves.',
    icon: BookOpenIcon,
  },
  {
    title: 'Lesson Support',
    description: 'Hard topics are explained in simpler language so students can understand with more confidence.',
    icon: LightBulbIcon,
  },
  {
    title: 'Exam Revision',
    description: 'Students can revise with better focus, stronger recall, and support that feels useful and safe.',
    icon: CpuChipIcon,
  },
];

const OPPORTUNITY_TRACKS = [
  {
    title: 'School Onboarding',
    description: 'Support schools that are ready to strengthen their systems and public presence.',
    icon: BuildingOffice2Icon,
  },
  {
    title: 'Training & Deployment',
    description: 'Help teams learn the platform, settle in well, and stay confident after launch.',
    icon: UserGroupIcon,
  },
  {
    title: 'Education Partners',
    description: 'Work with NDOVERA on programmes, content, and support that help schools grow.',
    icon: NewspaperIcon,
  },
  {
    title: 'Product And Growth',
    description: 'Back better workflows, stronger delivery, and practical school innovation.',
    icon: RocketLaunchIcon,
  },
];

const PRICING_TRACKS = [
  {
    title: 'Pay Onboarding First',
    description: 'Start with a single onboarding fee that reserves your school domain and opens the launch process.',
    icon: BuildingOffice2Icon,
  },
  {
    title: 'Move To Live-User Billing',
    description: 'From the next term, billing follows active users so growing schools can plan with less guesswork.',
    icon: UserGroupIcon,
  },
  {
    title: 'Choose Growth Or Custom',
    description: 'Pick the standard NDOVERA rollout or a custom launch that Ami reviews with you before approval.',
    icon: RocketLaunchIcon,
  },
];

const EVENT_ITEMS = [
  {
    month: 'Jun 2026',
    title: 'School Owner Growth Briefing',
    description: 'A live session for school owners and leadership teams exploring stronger structure for admissions, reporting, and parent communication.',
  },
  {
    month: 'Jul 2026',
    title: 'Parent Trust And Tutor Demo',
    description: 'A focused session showing how simple learning support and clearer school updates can build confidence for families.',
  },
  {
    month: 'Aug 2026',
    title: 'Partner And Investor Roundtable',
    description: 'A conversation with growth partners, education supporters, and backers who want practical school progress.',
  },
];

const GALLERY_ITEMS = [
  {
    title: 'Leadership And Planning',
    description: 'Scenes that reflect direction, decision-making, and confident school management.',
  },
  {
    title: 'Parents And Communication',
    description: 'Moments that show trust, visibility, and stronger family connection.',
  },
  {
    title: 'Learning Support In Motion',
    description: 'Visuals that capture focus, support, and student progress.',
  },
  {
    title: 'Partners And Progress',
    description: 'A look at how NDOVERA grows through collaboration, demos, and real working days.',
  },
];

const PAGE_CONTENT = {
  home: {
    eyebrow: 'For School Owners, Parents, And Growth Partners',
    title: 'School owners get control, parents get clarity, and students get better support.',
    description: 'NDOVERA helps schools run daily work, support learning, and keep parents informed from one place. It gives school owners a clearer view, helps teachers stay organised, and helps families feel included.',
  },
  about: {
    eyebrow: 'About NDOVERA',
    title: 'NDOVERA helps schools look professional and run with confidence.',
    description: 'A good school needs clear systems, trusted communication, and a strong public presence. NDOVERA brings these together in one steady platform.',
  },
  mission: {
    eyebrow: 'Our Mission',
    title: 'Our mission is to make school management simpler, clearer, and more trusted.',
    description: 'We help schools reduce confusion, improve communication, and support learning with tools people can actually use.',
  },
  vision: {
    eyebrow: 'Our Vision',
    title: 'Our vision is a future where every school can grow on a stronger digital foundation.',
    description: 'We want school owners to have a clearer view of progress, parents to feel informed, and students to learn in better supported environments.',
  },
  partners: {
    eyebrow: 'Growth Partners',
    title: 'We welcome growth partners who want better results for schools.',
    description: 'NDOVERA is open to school groups, rollout teams, education supporters, and investors who believe practical school improvement matters.',
  },
  tutor: {
    eyebrow: 'NDOVERA Tutor',
    title: 'NDOVERA Tutor helps students learn with more confidence.',
    description: 'It gives students help in clear English, supports revision, and makes it easier for parents and teachers to trust the learning support.',
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Simple pricing for schools that want a strong start with NDOVERA.',
    description: 'Choose a standard rollout or a custom launch. Pay the onboarding fee now, then move to live-user billing from the next term based on active users in your school.',
  },
  opportunities: {
    eyebrow: 'Opportunities',
    title: 'There are real opportunities to build, support, and grow with NDOVERA.',
    description: 'If you work with schools, support education, or want to back practical tools that help schools improve, there may be a place for you here.',
  },
  events: {
    eyebrow: 'Events',
    title: 'NDOVERA events bring school owners, parents, partners, and supporters into useful conversation.',
    description: 'Each event is designed to share clear ideas, practical lessons, and next steps that help schools grow.',
  },
  gallery: {
    eyebrow: 'Gallery',
    title: 'See how NDOVERA supports school growth in real life.',
    description: 'The gallery helps visitors feel the work, the care, and the direction behind NDOVERA.',
  },
};

const DEFAULT_SECTION_DATA = {
  home: {
    ...PAGE_CONTENT.home,
    metadata: {
      buttonLabel: 'Discover NDOVERA',
      buttonUrl: '/about',
      secondaryButtonLabel: 'See Tutor Layer',
      secondaryButtonUrl: '/tutor',
      stats: IMPACT_METRICS,
      cards: HOME_STRANDS,
      spotlightEyebrow: 'Built For Real School Life',
      spotlightTitle: 'When a school runs well, everyone feels it.',
      spotlightDescription: 'Owners see what needs attention. Parents get updates they can understand. Teachers and students work in a calmer system that is easier to trust.',
    },
  },
  about: {
    ...PAGE_CONTENT.about,
    metadata: {
      cards: ABOUT_PILLARS,
      spotlightEyebrow: 'Clear By Design',
      spotlightTitle: 'Schools deserve one strong system for both the office and the classroom.',
      spotlightDescription: 'NDOVERA was shaped around real school life. It gives owners, teachers, parents, and students a shared system that feels useful from day one.',
    },
  },
  mission: {
    ...PAGE_CONTENT.mission,
    metadata: {
      cards: MISSION_PILLARS,
      spotlightEyebrow: 'What Drives Us',
      spotlightTitle: 'Good schools move faster when the system behind them is strong.',
      spotlightDescription: 'We want owners to lead with confidence, parents to stay informed, and teachers to spend more time helping students succeed.',
    },
  },
  vision: {
    ...PAGE_CONTENT.vision,
    metadata: {
      cards: VISION_HORIZONS,
      spotlightEyebrow: 'Looking Ahead',
      spotlightTitle: 'Every school deserves tools that help people move with confidence.',
      spotlightDescription: 'We see a future where leadership is clearer, parent trust is stronger, and student support is built into the daily life of the school.',
    },
  },
  partners: {
    ...PAGE_CONTENT.partners,
    metadata: {
      cards: PARTNER_TRACKS,
      spotlightEyebrow: 'Built Through Collaboration',
      spotlightTitle: 'The best partnerships help schools grow faster and with less waste.',
      spotlightDescription: 'We are interested in partners who want real outcomes for schools, stronger rollout, and long-term value that people can actually see.',
    },
  },
  tutor: {
    ...PAGE_CONTENT.tutor,
    metadata: {
      cards: TUTOR_MODES,
      spotlightEyebrow: 'Student Support',
      spotlightTitle: 'Parents want support they can trust. Students need help they can understand.',
      spotlightDescription: 'NDOVERA Tutor is designed to explain, guide, and support practice in a way that still respects the learner, the teacher, and the parent.',
      mediaEyebrow: 'Learning Support',
      mediaTitle: 'Simple explanations, steady revision, and support that feels safe and useful.',
      mediaDescription: 'The tutor helps students break down hard topics, prepare with more confidence, and keep learning moving forward in plain English.',
    },
  },
  pricing: {
    ...PAGE_CONTENT.pricing,
    metadata: {
      buttonLabel: 'Register A School',
      buttonUrl: '/register-school',
      secondaryButtonLabel: 'Talk To Growth Team',
      secondaryButtonUrl: '/growth-partners',
      cards: PRICING_TRACKS,
      spotlightEyebrow: 'Clear Billing',
      spotlightTitle: 'Only the onboarding fee is paid now. Live-user billing starts later.',
      spotlightDescription: 'NDOVERA keeps the first payment simple, then moves to term billing based on actual active users instead of rough guesses.',
      mediaEyebrow: 'How Billing Works',
      mediaTitle: 'Growth gives schools a standard launch. Custom supports schools that need extra rollout planning.',
      mediaDescription: 'The pricing page helps owners understand what is paid now, what starts next term, and where custom rollout support fits in.',
    },
  },
  opportunities: {
    ...PAGE_CONTENT.opportunities,
    metadata: {
      cards: OPPORTUNITY_TRACKS,
      spotlightEyebrow: 'Grow With Purpose',
      spotlightTitle: 'Real opportunity starts where useful work meets real school needs.',
      spotlightDescription: 'We are open to schools, partners, operators, and backers who want to help schools become more organised, more trusted, and more ready for growth.',
    },
  },
  events: {
    ...PAGE_CONTENT.events,
    metadata: {
      cards: EVENT_ITEMS.map(item => ({ eyebrow: item.month, title: item.title, description: item.description })),
      spotlightEyebrow: 'Useful Conversations',
      spotlightTitle: 'Our events are built around clarity, connection, and practical action.',
      spotlightDescription: 'We want every briefing, demo, and roundtable to give people real insight, not just a nice poster and a short speech.',
    },
  },
  gallery: {
    ...PAGE_CONTENT.gallery,
    metadata: {
      cards: GALLERY_ITEMS,
      spotlightEyebrow: 'In Motion',
      spotlightTitle: 'The gallery exists to show real platform life.',
      spotlightDescription: 'This gallery gives visitors a clearer feel for the people, sessions, and progress behind the platform.',
    },
  },
};

function parseMeta(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function isExternalLink(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

function isVideoFile(url) {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(String(url || ''));
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

function mergeDecoratedItems(items, fallbackItems = []) {
  const source = Array.isArray(items) && items.length ? items : fallbackItems;
  return source.map((item, index) => ({ ...(fallbackItems[index] || {}), ...(item || {}) }));
}

function normalizeSection(sectionKey, rawSection) {
  const fallback = DEFAULT_SECTION_DATA[sectionKey] || DEFAULT_SECTION_DATA.home;
  const metadata = parseMeta(rawSection?.metadata);
  const fallbackMetadata = fallback.metadata || {};

  return {
    key: sectionKey,
    eyebrow: metadata.eyebrow || fallback.eyebrow,
    title: rawSection?.title || fallback.title,
    description: rawSection?.content || fallback.description,
    imageUrl: rawSection?.image_url || fallback.imageUrl || '',
    metadata: {
      ...fallbackMetadata,
      ...metadata,
      cards: mergeDecoratedItems(metadata.cards, fallbackMetadata.cards || []),
      stats: Array.isArray(metadata.stats) && metadata.stats.length ? metadata.stats : fallbackMetadata.stats || [],
      mediaUrls: Array.isArray(metadata.mediaUrls) && metadata.mediaUrls.length ? metadata.mediaUrls : fallbackMetadata.mediaUrls || [],
      youtubeUrl: metadata.youtubeUrl || metadata.videoUrl || fallbackMetadata.youtubeUrl || '',
      buttonLabel: metadata.buttonLabel || fallbackMetadata.buttonLabel || '',
      buttonUrl: metadata.buttonUrl || fallbackMetadata.buttonUrl || '',
      secondaryButtonLabel: metadata.secondaryButtonLabel || fallbackMetadata.secondaryButtonLabel || '',
      secondaryButtonUrl: metadata.secondaryButtonUrl || fallbackMetadata.secondaryButtonUrl || '',
      spotlightEyebrow: metadata.spotlightEyebrow || fallbackMetadata.spotlightEyebrow || '',
      spotlightTitle: metadata.spotlightTitle || fallbackMetadata.spotlightTitle || '',
      spotlightDescription: metadata.spotlightDescription || fallbackMetadata.spotlightDescription || '',
      mediaEyebrow: metadata.mediaEyebrow || fallbackMetadata.mediaEyebrow || '',
      mediaTitle: metadata.mediaTitle || fallbackMetadata.mediaTitle || '',
      mediaDescription: metadata.mediaDescription || fallbackMetadata.mediaDescription || '',
    },
  };
}

function getSectionMedia(section) {
  const urls = [
    section?.imageUrl,
    ...(Array.isArray(section?.metadata?.mediaUrls) ? section.metadata.mediaUrls : []),
    section?.metadata?.youtubeUrl,
  ].filter(Boolean);
  return [...new Set(urls)];
}

function ActionLink({ to, className, children }) {
  if (!to) return null;
  if (isExternalLink(to)) {
    return <a href={to} target="_blank" rel="noreferrer" className={className}>{children}</a>;
  }
  return <Link to={to} className={className}>{children}</Link>;
}

function Reveal({ as: Tag = 'div', className = '', delay = 0, children }) {
  const revealClassName = ['public-reveal', className].filter(Boolean).join(' ');

  return (
    <Tag data-reveal data-reveal-delay={delay} className={revealClassName}>
      {children}
    </Tag>
  );
}

function SectionHeading({ eyebrow, title, description, tone = 'default' }) {
  const isInverse = tone === 'inverse';

  return (
    <div className="max-w-3xl space-y-3">
      <p className={`text-xs font-semibold uppercase tracking-[0.34em] ${isInverse ? 'text-[#b5e3f4]' : 'text-[#800020]'}`}>{eyebrow}</p>
      <h2 className={`text-3xl font-black tracking-tight sm:text-4xl ${isInverse ? 'text-[#f8f3eb]' : 'text-[#191970]'}`}>{title}</h2>
      {description ? <p className={`text-sm leading-7 sm:text-base ${isInverse ? 'text-[#e4ddcf]' : 'text-[#31416f]'}`}>{description}</p> : null}
    </div>
  );
}

function PublicCard({ title, description, icon: Icon, to, revealDelay = 0 }) {
  const content = (
    <article data-reveal data-reveal-delay={revealDelay} className="public-reveal group flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-5 shadow-[0_18px_36px_rgba(128,0,0,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_42px_rgba(25,25,112,0.14)] sm:p-6">
      {Icon ? (
        <div className="inline-flex rounded-2xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-3 text-[#800020]">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <h3 className="mt-4 break-words text-xl font-bold leading-tight text-[#191970]">{title}</h3>
      <p className="mt-3 break-words text-sm leading-7 text-[#31416f]">{description}</p>
      {to ? (
        <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-[#1a5c38]">
          Explore
          <ArrowRightIcon className="h-4 w-4" />
        </span>
      ) : null}
    </article>
  );

  if (!to) return content;
  if (isExternalLink(to)) {
    return <a href={to} target="_blank" rel="noreferrer">{content}</a>;
  }
  return <Link to={to}>{content}</Link>;
}

function MediaFrame({ url, title, className = 'h-full w-full object-cover rounded-[1.4rem]' }) {
  const youtubeUrl = getYouTubeEmbedUrl(url);

  if (youtubeUrl) {
    return (
      <iframe
        src={youtubeUrl}
        title={title}
        className={className}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  if (isVideoFile(url)) {
    return <video src={url} controls className={className} />;
  }

  return <img src={url} alt={title} className={className} />;
}

function MediaGallery({ section, eyebrow, title, description, tone = 'light' }) {
  const media = getSectionMedia(section);
  if (!media.length) return null;

  const isDark = tone === 'dark';

  return (
    <Reveal as="section" className={`rounded-[2rem] border border-[#c9a96e]/45 p-5 shadow-[0_18px_40px_rgba(25,25,112,0.08)] sm:p-6 ${isDark ? 'bg-[#191970]' : 'bg-[#fff8ef]'}`}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} tone={isDark ? 'inverse' : 'default'} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {media.map((url, index) => (
          <article
            key={`${url}-${index}`}
            data-reveal
            data-reveal-delay={(index % 4) + 1}
            className={`public-reveal overflow-hidden rounded-[1.5rem] border border-[#c9a96e]/35 p-2 sm:p-3 ${isDark ? 'bg-white/5' : 'bg-[#b5e3f4]/45'}`}
          >
            <MediaFrame url={url} title={`${section.title} media ${index + 1}`} className="h-52 w-full rounded-[1.1rem] object-cover sm:h-56" />
          </article>
        ))}
      </div>
    </Reveal>
  );
}

// First-visit advert/flier popup (once per browser session). Ami manages it via
// the "Flier / Advert Popup" section; shows 1-3 images that crossfade, with a CTA.
function FlierPopup({ flier }) {
  const media = getSectionMedia(flier).slice(0, 3);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!media.length) return undefined;
    try { if (sessionStorage.getItem('ndoveraFlierClosed') === '1') return undefined; } catch (e) { /* ignore */ }
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [media.length]);

  useEffect(() => {
    if (!open || media.length < 2) return undefined;
    const t = setInterval(() => setIdx(i => (i + 1) % media.length), 3000);
    return () => clearInterval(t);
  }, [open, media.length]);

  if (!open || !media.length) return null;

  const ctaUrl = flier?.metadata?.buttonUrl || '';
  const ctaLabel = flier?.metadata?.buttonLabel || 'Learn More';
  function close() { setOpen(false); try { sessionStorage.setItem('ndoveraFlierClosed', '1'); } catch (e) { /* ignore */ } }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 motion-safe:animate-[heroIn_.4s_ease-out]" onClick={close}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-xl font-bold text-white hover:bg-black/75">×</button>
        <div className="relative aspect-[4/5] w-full bg-[#04190d] sm:aspect-[4/3]">
          {media.map((url, i) => (
            <MediaFrame key={url} url={url} title={`NDOVERA flier ${i + 1}`} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0'}`} />
          ))}
        </div>
        {ctaUrl ? (
          <div className="p-4 text-center">
            <ActionLink to={ctaUrl} className="inline-block rounded-full bg-[#191970] px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#2447d8]">{ctaLabel}</ActionLink>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Hero background carousel: images slide to the left, auto-advancing. The image
// is held at ~30% visibility over a dark-green base so white hero text stays bold.
function HeroSlides({ media }) {
  const slides = Array.isArray(media) ? media.slice(0, 6) : [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = setInterval(() => setIndex(i => (i + 1) % slides.length), 6500);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div
        className="flex h-full w-full transition-transform duration-[2200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((url, i) => (
          <div key={`${url}-${i}`} className="relative h-full w-full shrink-0 grow-0 basis-full">
            <MediaFrame
              url={url}
              title={`NDOVERA hero ${i + 1}`}
              className={`absolute inset-0 h-full w-full object-cover opacity-30 transition-transform duration-[6000ms] ease-out ${i === index ? 'scale-110' : 'scale-100'}`}
            />
          </div>
        ))}
      </div>
      {slides.length > 1 ? (
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((url, i) => (
            <span key={`dot-${url}-${i}`} className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-7 bg-[#e3c98b]' : 'w-1.5 bg-white/45'}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PublicShell({ section, notice, children, flier }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const heroStats = Array.isArray(section.metadata.stats) ? section.metadata.stats : [];
  const heroPreviewCards = Array.isArray(section.metadata.cards) ? section.metadata.cards.slice(0, 2) : [];
  const heroMedia = getSectionMedia(section);
  const footerSplitIndex = Math.ceil(NAV_ITEMS.length / 2);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#191970]">
      <FlierPopup flier={flier} />
      {/* Utility bar */}
      <div className="hidden bg-[#10133a] text-white lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-1.5 text-[11px] tracking-wide">
          <span className="text-white/60">A modern website, school platform &amp; learning network</span>
          <div className="flex items-center gap-5">
            <Link to="/opportunities" className="text-white/75 transition hover:text-[#e3c98b]">Opportunities</Link>
            <Link to="/events" className="text-white/75 transition hover:text-[#e3c98b]">Events</Link>
            <Link to="/login" className="font-semibold text-[#e3c98b] transition hover:text-white">Portal Login →</Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:gap-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#191970] text-sm font-black tracking-[0.16em] text-white ring-2 ring-[#c9a96e]/60">
              ND
            </div>
            <div>
              <p className="font-serif text-xl font-black leading-none tracking-tight text-[#191970]">NDOVERA</p>
              <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c9a96e] sm:block">Learn · Lead · Grow</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 xl:flex">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `rounded-md px-3 py-2 text-[13px] font-semibold uppercase tracking-wide transition ${isActive ? 'text-[#2447d8]' : 'text-[#191970] hover:text-[#2447d8]'}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/login" className="rounded-full border border-[#191970]/25 px-4 py-2 text-sm font-semibold text-[#191970] transition hover:border-[#2447d8] hover:text-[#2447d8]">
              Portal Login
            </Link>
            <Link to="/register-school" className="rounded-full bg-[#191970] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2447d8]">
              Register School
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(open => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#191970] transition hover:border-[#2447d8] hover:text-[#2447d8] xl:hidden"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
          </button>
        </div>

        {isMobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg sm:px-6 xl:hidden">
            <div className="mx-auto max-w-7xl space-y-4">
              <nav className="grid gap-2 sm:grid-cols-2">
                {NAV_ITEMS.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `rounded-xl border px-4 py-3 text-sm font-semibold uppercase tracking-wide transition ${isActive ? 'border-[#191970] bg-[#191970] text-white' : 'border-slate-200 text-[#191970] hover:border-[#2447d8] hover:text-[#2447d8]'}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link to="/login" className="rounded-full border border-[#191970]/25 px-5 py-3 text-center text-sm font-semibold text-[#191970] transition hover:border-[#2447d8] hover:text-[#2447d8]">
                  Portal Login
                </Link>
                <Link to="/register-school" className="rounded-full bg-[#191970] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2447d8]">
                  Register School
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* Full-bleed hero with sliding background carousel */}
      <section className="relative isolate overflow-hidden bg-[#04190d]">
        <HeroSlides media={heroMedia} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#010804]/72 via-[#04190d]/60 to-[#072214]/50" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-t from-[#010804]/72 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="max-w-3xl motion-safe:animate-[heroIn_.7s_ease-out]">
            <p className="inline-flex rounded-full border border-[#ffd84a]/55 bg-black/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#ffd84a]">
              {section.eyebrow}
            </p>
            <h1 className="mt-5 font-serif text-4xl font-black leading-[1.05] tracking-tight !text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.75)] sm:text-5xl lg:text-[4rem]">
              {section.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#ffeca6] [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
              {section.description}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionLink to="/register-school" className="rounded-full bg-[#e3c98b] px-7 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-[#191970] transition hover:bg-white">
                Register School
              </ActionLink>
              <ActionLink to="/login" className="rounded-full border border-white/40 px-7 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white/10">
                Login
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      {/* Stats / preview strip */}
      {heroStats.length ? (
        <section className="border-b border-slate-200 bg-[#f7f9ff]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
            {heroStats.slice(0, 4).map((metric, index) => (
              <div key={`${metric.label}-${index}`} className="border-b border-slate-200 px-4 py-7 text-center md:border-b-0 md:border-l md:first:border-l-0">
                <p className="font-serif text-3xl font-black text-[#191970] sm:text-4xl">{metric.value}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c9a96e]">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>
      ) : heroPreviewCards.length ? (
        <section className="border-b border-slate-200 bg-[#f7f9ff]">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:px-8">
            {heroPreviewCards.map(item => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c9a96e]">{item.eyebrow || 'NDOVERA'}</p>
                <p className="mt-2 font-serif text-lg font-black text-[#191970]">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#31416f]">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="space-y-12">
          {notice ? (
            <Reveal as="section" className="rounded-[1.6rem] border border-[#c9a96e]/45 bg-[#fff8ef] px-5 py-4 text-sm leading-7 text-[#31416f] shadow-[0_12px_28px_rgba(25,25,112,0.06)]">
              {notice}
            </Reveal>
          ) : null}

          {children}

          <Reveal as="section" className="rounded-[2.2rem] border border-[#c9a96e]/45 bg-[#191970] px-5 py-8 text-[#f8f3eb] shadow-[0_30px_80px_rgba(25,25,112,0.24)] sm:px-8 lg:px-10">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#b5e3f4]">Stay In Motion</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight !text-white">Move from public website to meaningful action.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e4ddcf] sm:text-base">
                  Read the story, explore the pages, open the portal, or start school registration. The website should be a real public front door, not a dead-end splash screen.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Link to="/login" className="rounded-full bg-[#b5e3f4] px-5 py-3 text-sm font-semibold text-[#191970] transition hover:bg-[#f8e5c3]">
                  Open Portal Login
                </Link>
                <Link to="/register-school" className="rounded-full border border-[#b5e3f4]/35 px-5 py-3 text-sm font-semibold text-[#b5e3f4] transition hover:bg-white/10">
                  Register A School
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </main>

      <footer className="bg-[#10133a] text-white/75">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-sm font-black tracking-[0.16em] text-white ring-2 ring-[#c9a96e]/50">ND</div>
              <p className="font-serif text-2xl font-black text-white">NDOVERA</p>
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/65">
              A modern website, school platform, and learning-support network designed to help schools operate with more structure and visible progress.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/register-school" className="rounded-full bg-[#e3c98b] px-5 py-2.5 text-sm font-bold text-[#191970] transition hover:bg-white">Register School</Link>
              <Link to="/login" className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">Portal Login</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e3c98b]">Explore</p>
            <div className="mt-4 flex flex-col gap-2.5 text-sm">
              {NAV_ITEMS.slice(0, footerSplitIndex).map(item => (
                <Link key={item.path} to={item.path} className="text-white/70 transition hover:text-white">{item.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e3c98b]">Access</p>
            <div className="mt-4 flex flex-col gap-2.5 text-sm">
              {NAV_ITEMS.slice(footerSplitIndex).map(item => (
                <Link key={item.path} to={item.path} className="text-white/70 transition hover:text-white">{item.label}</Link>
              ))}
              <Link to="/login" className="text-white/70 transition hover:text-white">Portal Login</Link>
              <Link to="/register-school" className="text-white/70 transition hover:text-white">Register School</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/45 sm:flex-row sm:px-6 lg:px-8">
            <span>© {new Date().getFullYear()} Ndovera. All rights reserved.</span>
            <span className="uppercase tracking-[0.2em]">Learn · Lead · Grow</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HomePageBody({ section }) {
  const strands = section.metadata.cards;

  return (
    <div className="space-y-10">
      <section className="grid gap-4 lg:grid-cols-4">
        {strands.map((item, index) => (
          <PublicCard key={item.title} title={item.title} description={item.description} icon={item.icon} to={item.path} revealDelay={(index % 4) + 1} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Reveal className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)]" delay={1}>
          <SectionHeading
            eyebrow={section.metadata.spotlightEyebrow}
            title={section.metadata.spotlightTitle}
            description={section.metadata.spotlightDescription}
          />
        </Reveal>
        <Reveal className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#800020] p-6 text-[#f8f3eb] shadow-[0_24px_60px_rgba(128,0,32,0.18)]" delay={2}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b5e3f4]">Public Website Structure</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {NAV_ITEMS.map((item, index) => (
              <Link key={item.path} to={item.path} data-reveal data-reveal-delay={(index % 4) + 1} className="public-reveal rounded-2xl border border-[#b5e3f4]/20 bg-white/5 px-4 py-3 text-sm font-semibold transition hover:bg-white/10">
                {item.label}
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Reveal className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#b5e3f4] p-6" delay={1}>
          <SectionHeading
            eyebrow="Platform Coverage"
            title="From public trust to internal execution."
            description="NDOVERA is not just a school dashboard. It is a layered system that can speak clearly in public and then execute deeply inside the platform."
          />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          <PublicCard title="Story & Identity" description="Explain who NDOVERA is, what it stands for, and why the platform exists." icon={SparklesIcon} to="/about" revealDelay={1} />
          <PublicCard title="Mission & Vision" description="State the commitments and long horizon clearly, without flattening them into marketing filler." icon={RocketLaunchIcon} to="/mission" revealDelay={2} />
          <PublicCard title="Partners & Opportunities" description="Make collaboration paths visible for growth partners, schools, and implementation teams." icon={HandRaisedIcon} to="/growth-partners" revealDelay={3} />
          <PublicCard title="Events & Gallery" description="Show movement, people, proof, and the public life of the NDOVERA ecosystem." icon={CalendarDaysIcon} to="/events" revealDelay={4} />
        </div>
      </section>

      <MediaGallery
        section={section}
        eyebrow="Public Media"
        title="Website media that visitors can actually explore inside the site."
        description="AMI can upload photos to R2 and add YouTube links so the NDOVERA website feels active, visual, and current without sending visitors away."
      />
    </div>
  );
}

function AboutPageBody({ section }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-3">
        {section.metadata.cards.map((item, index) => (
          <PublicCard key={item.title} title={item.title} description={item.description} icon={BuildingLibraryIcon} revealDelay={(index % 4) + 1} />
        ))}
      </section>

      <Reveal as="section" className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)]">
        <SectionHeading
          eyebrow={section.metadata.spotlightEyebrow}
          title={section.metadata.spotlightTitle}
          description={section.metadata.spotlightDescription}
        />
      </Reveal>

      <MediaGallery
        section={section}
        eyebrow="About In View"
        title="Use images and video to strengthen the public story."
        description="The About page can now carry R2-hosted visuals and YouTube embeds without giving up the existing NDOVERA page layout."
      />
    </div>
  );
}

function MissionPageBody({ section }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-3">
        {section.metadata.cards.map((item, index) => (
          <PublicCard key={item.title} title={item.title} description={item.description} icon={LightBulbIcon} revealDelay={(index % 4) + 1} />
        ))}
      </section>

      <Reveal as="section" className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#800020] p-6 text-[#f8f3eb] shadow-[0_24px_60px_rgba(128,0,32,0.18)]">
        <SectionHeading
          eyebrow={section.metadata.spotlightEyebrow}
          title={section.metadata.spotlightTitle}
          description={section.metadata.spotlightDescription}
          tone="inverse"
        />
      </Reveal>

      <MediaGallery
        section={section}
        eyebrow="Mission Media"
        title="Document the mission with proof, not placeholders."
        description="Uploaded visuals and embedded video can reinforce the mission page when NDOVERA wants to show real projects, briefings, or school transformation work."
      />
    </div>
  );
}

function VisionPageBody({ section }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-3">
        {section.metadata.cards.map((item, index) => (
          <PublicCard key={item.title} title={item.title} description={item.description} icon={GlobeAltIcon} revealDelay={(index % 4) + 1} />
        ))}
      </section>

      <Reveal as="section" className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)]">
        <SectionHeading
          eyebrow={section.metadata.spotlightEyebrow}
          title={section.metadata.spotlightTitle}
          description={section.metadata.spotlightDescription}
        />
      </Reveal>

      <MediaGallery
        section={section}
        eyebrow="Vision Media"
        title="Use visual direction to support the long-horizon message."
        description="The public vision page can now carry launch visuals, event media, or YouTube explainers without needing a separate embed-only page."
      />
    </div>
  );
}

function PartnersPageBody({ section }) {
  const heroImage = getSectionMedia(section)[0] || 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=70';
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', audience: '', motivation: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const field = 'mt-1 w-full rounded-xl border border-[#c9a96e]/50 bg-white px-3.5 py-2.5 text-sm text-[#191970] outline-none focus:border-[#191970] focus:ring-2 focus:ring-[#191970]/20';
  const lbl = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]';

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) { setError('Please add your name, email, and phone.'); return; }
    setSubmitting(true); setError(''); setDone('');
    try {
      const data = await submitGrowthPartnerApplication(form);
      setDone(data.message || 'Application received. We will reach out to you.');
      setForm({ name: '', email: '', phone: '', location: '', audience: '', motivation: '' });
    } catch (submitError) {
      setError(submitError.message || 'Could not submit your application.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      {/* Brief explanation + image */}
      <Reveal className="space-y-5">
        <img src={heroImage} alt="Become an NDOVERA Growth Partner" className="h-56 w-full rounded-[1.6rem] object-cover shadow-[0_18px_40px_rgba(25,25,112,0.18)]" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#c9a96e]">Growth Partners</p>
          <h2 className="mt-2 font-serif text-3xl font-black text-[#191970]">Introduce schools to NDOVERA and earn.</h2>
          <p className="mt-3 text-sm leading-7 text-[#31416f]">
            Growth Partners are marketers who introduce NDOVERA to schools and organisations. You get a personal referral
            code and link — when a school registers through you, you earn commission, plus a share of what each referred
            school pays per term. You also get discount codes to share.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[#31416f]">
            <li>• <b>30%</b> commission for your first 10 schools, <b>50%</b> after 10.</li>
            <li>• <b>5%</b> of what each referred school pays per term.</li>
            <li>• Track referrals &amp; earnings, and withdraw to your account.</li>
          </ul>
          <p className="mt-4 text-xs text-[#800020]">Apply below — the NDOVERA team reviews your application and activates your partner account.</p>
        </div>
      </Reveal>

      {/* Application form */}
      <Reveal as="form" onSubmit={handleSubmit} className="rounded-[1.8rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)] sm:p-8" delay={1}>
        <h3 className="font-serif text-2xl font-black text-[#191970]">Become a Growth Partner</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={lbl}>Full name</label><input className={field} value={form.name} onChange={e => setForm(c => ({ ...c, name: e.target.value }))} /></div>
          <div><label className={lbl}>Email</label><input type="email" className={field} value={form.email} onChange={e => setForm(c => ({ ...c, email: e.target.value }))} /></div>
          <div><label className={lbl}>Phone</label><input className={field} value={form.phone} onChange={e => setForm(c => ({ ...c, phone: e.target.value }))} /></div>
          <div><label className={lbl}>Location</label><input className={field} value={form.location} onChange={e => setForm(c => ({ ...c, location: e.target.value }))} /></div>
          <div><label className={lbl}>Your audience / network</label><input className={field} value={form.audience} onChange={e => setForm(c => ({ ...c, audience: e.target.value }))} placeholder="e.g. school owners in Lagos" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Why do you want to partner?</label><textarea rows={4} className={`${field} resize-none`} value={form.motivation} onChange={e => setForm(c => ({ ...c, motivation: e.target.value }))} /></div>
        </div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {done ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{done}</p> : null}
        <button type="submit" disabled={submitting} className="mt-5 w-full rounded-full bg-[#191970] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#2447d8] disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit Application'}
        </button>
      </Reveal>
    </section>
  );
}

function TutorPageBody({ section }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-3">
        {section.metadata.cards.map((item, index) => (
          <PublicCard key={item.title} title={item.title} description={item.description} icon={item.icon} revealDelay={(index % 4) + 1} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Reveal className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)]" delay={1}>
          <SectionHeading
            eyebrow={section.metadata.spotlightEyebrow}
            title={section.metadata.spotlightTitle}
            description={section.metadata.spotlightDescription}
          />
        </Reveal>
        <Reveal className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#191970] p-6 text-[#f8f3eb] shadow-[0_24px_60px_rgba(25,25,112,0.18)]" delay={2}>
          <SectionHeading
            eyebrow={section.metadata.mediaEyebrow || 'Tutor Outcomes'}
            title={section.metadata.mediaTitle || 'A tutor page can now carry video demonstrations and proof of use.'}
            description={section.metadata.mediaDescription || 'Homework support that still teaches reasoning. Lesson explanation that helps recovery after confusion. Exam preparation that keeps revision disciplined and focused.'}
            tone="inverse"
          />
        </Reveal>
      </section>

      <MediaGallery
        section={section}
        eyebrow="Tutor Media"
        title="Embedded explainer video and uploaded screenshots live directly on the page."
        description="Use YouTube and R2-hosted media to show how NDOVERA Tutor works without forcing visitors to leave the site."
        tone="dark"
      />
    </div>
  );
}

function PricingPageBody({ section, pricing, pricingError, isPricingLoading }) {
  const plans = Array.isArray(pricing?.plans) ? pricing.plans : [];

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-3">
        {section.metadata.cards.map((item, index) => (
          <PublicCard key={item.title} title={item.title} description={item.description} icon={item.icon} revealDelay={(index % 4) + 1} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Reveal className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)]" delay={1}>
          <SectionHeading
            eyebrow={section.metadata.spotlightEyebrow}
            title={section.metadata.spotlightTitle}
            description={section.metadata.spotlightDescription}
          />
        </Reveal>

        <Reveal className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#191970] p-6 text-[#f8f3eb] shadow-[0_24px_60px_rgba(25,25,112,0.18)]" delay={2}>
          <SectionHeading
            eyebrow={section.metadata.mediaEyebrow || 'How Billing Works'}
            title={section.metadata.mediaTitle || 'Pricing stays clear before and after onboarding.'}
            description={section.metadata.mediaDescription || 'Pay the onboarding fee first. From the next term, NDOVERA bills by active users so growth stays easier to understand.'}
            tone="inverse"
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b5e3f4]">Due Now</p>
              <p className="mt-3 text-xl font-black text-white">Onboarding fee only</p>
              <p className="mt-2 text-sm leading-6 text-[#d9e3ff]">Reserve the domain, create the owner account, and begin launch approval.</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b5e3f4]">Subsequent Term</p>
              <p className="mt-3 text-xl font-black text-white">Live-user billing</p>
              <p className="mt-2 text-sm leading-6 text-[#d9e3ff]">The system uses active users so schools pay from real usage, not inflated estimates.</p>
            </div>
          </div>
        </Reveal>
      </section>

      {pricingError ? (
        <Reveal as="section" className="rounded-[1.6rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-7 text-rose-700">
          {pricingError}
        </Reveal>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        {plans.map((plan, index) => (
          <Reveal
            key={plan.key}
            as="article"
            className={`rounded-[2rem] border p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)] ${plan.manualPricing ? 'border-[#1a5c38]/35 bg-[#f1f8f1]' : 'border-[#c9a96e]/45 bg-[#fff8ef]'}`}
            delay={(index % 4) + 1}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#800020]">{plan.label}</p>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-[#191970]">{plan.manualPricing ? 'Custom rollout plan' : 'Standard school launch plan'}</h3>
                <p className="mt-3 text-sm leading-7 text-[#31416f]">{plan.description}</p>
              </div>
              {plan.manualPricing ? (
                <span className="rounded-full border border-[#1a5c38]/25 bg-[#1a5c38] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#b5e3f4]">
                  Ami Priced
                </span>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[#c9a96e]/35 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">Onboarding Fee Due Now</p>
                <p className="mt-3 text-2xl font-black text-[#191970]">{currencyFormatter.format(plan.setupFee || 0)}</p>
              </div>
              <div className="rounded-[1.5rem] border border-[#c9a96e]/35 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]">User Fee / Subsequent Term</p>
                <p className="mt-3 text-2xl font-black text-[#191970]">{currencyFormatter.format(plan.studentFeePerTerm || 0)}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {(Array.isArray(plan.features) ? plan.features : []).map(feature => (
                <div key={feature} className="flex items-start gap-3 rounded-[1.25rem] border border-[#c9a96e]/25 bg-white/60 px-4 py-3 text-sm leading-6 text-[#31416f]">
                  <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-[#1a5c38]" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <ActionLink to="/register-school" className="rounded-full bg-[#800020] px-5 py-3 text-sm font-semibold text-[#b5e3f4] transition hover:bg-[#670019]">
                Start Registration
              </ActionLink>
              <ActionLink to={plan.manualPricing ? '/growth-partners' : '/login'} className="rounded-full border border-[#c9a96e]/45 bg-white/70 px-5 py-3 text-sm font-semibold text-[#191970] transition hover:border-[#1a5c38] hover:text-[#1a5c38]">
                {plan.manualPricing ? 'Talk To Ami' : 'Open Portal'}
              </ActionLink>
            </div>
          </Reveal>
        ))}

        {isPricingLoading && !plans.length ? (
          [1, 2].map(index => (
            <Reveal key={`pricing-loading-${index}`} as="article" className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)]" delay={index}>
              <p className="text-sm font-semibold text-[#800020]">Loading live pricing...</p>
              <div className="mt-5 space-y-3">
                <div className="h-6 rounded-full bg-[#ead7b6]" />
                <div className="h-20 rounded-[1.5rem] bg-[#b5e3f4]/65" />
                <div className="h-20 rounded-[1.5rem] bg-[#b5e3f4]/45" />
              </div>
            </Reveal>
          ))
        ) : null}
      </section>

      {!isPricingLoading && !plans.length && !pricingError ? (
        <Reveal as="section" className="rounded-[1.8rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 text-sm leading-7 text-[#31416f] shadow-[0_18px_40px_rgba(25,25,112,0.08)]">
          Live pricing will appear here as soon as the pricing service responds.
        </Reveal>
      ) : null}

      <MediaGallery
        section={section}
        eyebrow="Pricing Media"
        title="Use visuals and video to explain onboarding and rollout clearly."
        description="AMI can keep the pricing page current with rollout screenshots, plan explainers, and short videos hosted directly on the site."
      />
    </div>
  );
}

function VacancyCard({ vacancy }) {
  const apply = vacancy.applyUrl || (vacancy.applyEmail ? `mailto:${vacancy.applyEmail}` : '');
  return (
    <article data-reveal className="public-reveal flex flex-col rounded-[1.6rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_36px_rgba(25,25,112,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#191970] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">{vacancy.schoolName || 'NDOVERA'}</span>
        {vacancy.employmentType ? <span className="rounded-full border border-[#191970]/25 px-3 py-1 text-[11px] font-semibold text-[#191970]">{vacancy.employmentType}</span> : null}
        {vacancy.location ? <span className="text-xs font-semibold text-[#31416f]">📍 {vacancy.location}</span> : null}
      </div>
      <h3 className="mt-3 font-serif text-xl font-black leading-tight text-[#191970]">{vacancy.title}</h3>
      {vacancy.department ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#c9a96e]">{vacancy.department}</p> : null}
      {vacancy.description ? <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#31416f] line-clamp-6">{vacancy.description}</p> : null}
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        {vacancy.deadline ? <span className="text-xs font-semibold text-[#800020]">Apply by {vacancy.deadline}</span> : <span />}
        {apply ? (
          <a href={apply} target="_blank" rel="noreferrer" className="rounded-full bg-[#e3c98b] px-5 py-2 text-xs font-bold uppercase tracking-wide text-[#191970] transition hover:bg-[#191970] hover:text-white">Apply</a>
        ) : null}
      </div>
    </article>
  );
}

function OpportunitiesPageBody() {
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPublicOpportunities()
      .then(data => { if (!cancelled) setVacancies(Array.isArray(data?.vacancies) ? data.vacancies : []); })
      .catch(() => { if (!cancelled) setVacancies([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Open Positions"
        title="Current vacancies across NDOVERA and member schools"
        description="Every open role posted by NDOVERA and the schools on our network. Apply directly from here."
      />

      {loading ? (
        <p className="text-sm text-[#31416f]">Loading vacancies…</p>
      ) : vacancies.length ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {vacancies.map(vacancy => <VacancyCard key={vacancy.id} vacancy={vacancy} />)}
        </section>
      ) : (
        <Reveal as="section" className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-10 text-center">
          <p className="font-serif text-2xl font-black text-[#191970]">No open vacancies right now</p>
          <p className="mt-3 text-sm leading-7 text-[#31416f]">There are no positions open at the moment. Please check back soon — new roles from NDOVERA and member schools appear here as they open.</p>
        </Reveal>
      )}
    </div>
  );
}

function EventsPageBody({ section }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-3">
        {section.metadata.cards.map((item, index) => (
          <article key={item.title} data-reveal data-reveal-delay={(index % 4) + 1} className="public-reveal rounded-[1.8rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-5 shadow-[0_18px_36px_rgba(25,25,112,0.08)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#800020]">{item.eyebrow || item.month || 'Event'}</p>
            <h3 className="mt-4 break-words text-xl font-bold leading-tight text-[#191970]">{item.title}</h3>
            <p className="mt-3 break-words text-sm leading-7 text-[#31416f]">{item.description}</p>
          </article>
        ))}
      </section>

      <Reveal as="section" className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#b5e3f4] p-6">
        <SectionHeading
          eyebrow={section.metadata.spotlightEyebrow}
          title={section.metadata.spotlightTitle}
          description={section.metadata.spotlightDescription}
        />
      </Reveal>

      <MediaGallery
        section={section}
        eyebrow="Event Media"
        title="Event photos, short videos, and YouTube recaps stay inside the website."
        description="AMI can upload event pictures to R2 and add YouTube clips so visitors can browse public moments without leaving ndovera.com."
      />
    </div>
  );
}

function GalleryPageBody({ section }) {
  return (
    <div className="space-y-8">
      <MediaGallery
        section={section}
        eyebrow="Events Gallery"
        title="Uploaded NDOVERA media now lives in a real website gallery."
        description="Gallery uploads go to R2 and YouTube links render as embedded video, so this page can hold both photos and playable video inside the site."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {section.metadata.cards.map((item, index) => (
          <article key={item.title} data-reveal data-reveal-delay={(index % 4) + 1} className={`public-reveal overflow-hidden rounded-[1.8rem] border border-[#c9a96e]/45 p-5 shadow-[0_18px_36px_rgba(25,25,112,0.08)] sm:p-6 ${index % 2 === 0 ? 'bg-[#fff8ef]' : 'bg-[#b5e3f4]'}`}>
            <div className="h-28 rounded-[1.3rem] bg-[linear-gradient(135deg,rgba(128,0,32,0.14),rgba(25,25,112,0.08),rgba(26,92,56,0.14))] sm:h-32" />
            <h3 className="mt-4 break-words text-xl font-bold leading-tight text-[#191970]">{item.title}</h3>
            <p className="mt-3 break-words text-sm leading-7 text-[#31416f]">{item.description}</p>
          </article>
        ))}
      </section>

      <Reveal as="section" className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#191970] p-6 text-[#f8f3eb] shadow-[0_24px_60px_rgba(25,25,112,0.18)]">
        <SectionHeading
          eyebrow={section.metadata.spotlightEyebrow}
          title={section.metadata.spotlightTitle}
          description={section.metadata.spotlightDescription}
          tone="inverse"
        />
      </Reveal>
    </div>
  );
}

export default function PublicSitePage({ pageKey = 'home' }) {
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const [pricing, setPricing] = useState({ plans: [], pricingConfig: null });
  const [pricingError, setPricingError] = useState('');
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPublicPlatformSite()
      .then(data => {
        if (!cancelled) {
          setSections(data?.sections || []);
          setError('');
        }
      })
      .catch(loadError => {
        if (!cancelled) {
          setError(loadError.message || 'Could not load live website content. Showing default website copy instead.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pageKey !== 'pricing') return undefined;

    let cancelled = false;
    setIsPricingLoading(true);

    getTenantPricing()
      .then(data => {
        if (!cancelled) {
          setPricing({
            plans: Array.isArray(data?.plans) ? data.plans : [],
            pricingConfig: data?.pricingConfig || null,
          });
          setPricingError('');
        }
      })
      .catch(loadError => {
        if (!cancelled) {
          setPricing({ plans: [], pricingConfig: null });
          setPricingError(loadError.message || 'Could not load live pricing right now.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPricingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!nodes.length) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(node => node.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    nodes.forEach(node => {
      const top = node.getBoundingClientRect().top;
      if (top <= window.innerHeight * 0.92) {
        node.classList.add('is-visible');
        return;
      }

      observer.observe(node);
    });

    return () => {
      observer.disconnect();
    };
  }, [pageKey, sections, pricing]);

  const sectionsByKey = useMemo(() => Object.fromEntries((sections || []).map(section => [section.section_key, section])), [sections]);
  const section = normalizeSection(pageKey, sectionsByKey[pageKey]);

  useEffect(() => {
    document.title = pageKey === 'home'
      ? 'NDOVERA | School platform and learning network'
      : `NDOVERA | ${section.title}`;
  }, [pageKey, section.title]);

  let body = <HomePageBody section={section} />;

  if (pageKey === 'about') body = <AboutPageBody section={section} />;
  if (pageKey === 'mission') body = <MissionPageBody section={section} />;
  if (pageKey === 'vision') body = <VisionPageBody section={section} />;
  if (pageKey === 'partners') body = <PartnersPageBody section={section} />;
  if (pageKey === 'tutor') body = <TutorPageBody section={section} />;
  if (pageKey === 'pricing') body = <PricingPageBody section={section} pricing={pricing} pricingError={pricingError} isPricingLoading={isPricingLoading} />;
  if (pageKey === 'opportunities') body = <OpportunitiesPageBody section={section} />;
  if (pageKey === 'events') body = <EventsPageBody section={section} />;
  if (pageKey === 'gallery') body = <GalleryPageBody section={section} />;

  return <PublicShell section={section} notice={error} flier={normalizeSection('flier', sectionsByKey.flier)}>{body}</PublicShell>;
}