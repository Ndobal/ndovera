import React from 'react';
import { ArrowRight, BookOpen, Building2, Calendar, Globe, MessageSquare, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';

type ShowcaseSchool = {
  id: string;
  name: string;
  subdomain?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  location?: string | null;
};

type TestimonialRecord = {
  id: string;
  author: string;
  role?: string | null;
  quote: string;
  profilePhotoUrl?: string | null;
};

type PricingTier = {
  key: string;
  label: string;
  minStudents: number;
  maxStudents: number | null;
  oneTimeSetupNaira: number;
  perStudentPerTermNaira: number;
  pricing?: { oneTimeSetupNaira: number; perStudentPerTermNaira: number; discountPercent: number };
};

type Props = {
  siteName: string;
  siteLogoUrl?: string | null;
  brandColor: string;
  accentColor: string;
  heroImages: string[];
  showcaseSchools: ShowcaseSchool[];
  testimonials: TestimonialRecord[];
  pricingTiers: PricingTier[];
  resolveAssetUrl: (value: string) => string;
  onShowRegister: () => void;
  onContact: () => void;
  onGrowth: () => void;
  onOpenPricing: () => void;
};

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatRange(tier: PricingTier) {
  if (tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0)) return 'Custom rollout';
  return tier.maxStudents === null ? `${tier.minStudents}+ learners` : `${tier.minStudents}-${tier.maxStudents} learners`;
}

export function BrightFutureHomeSections({
  siteName,
  siteLogoUrl,
  brandColor,
  accentColor,
  heroImages,
  showcaseSchools,
  testimonials,
  pricingTiers,
  resolveAssetUrl,
  onShowRegister,
  onContact,
  onGrowth,
  onOpenPricing,
}: Props) {
  const [primaryHero, secondaryHero, tertiaryHero] = heroImages;
  const displayPricing = pricingTiers.length ? pricingTiers.slice(0, 3) : [];

  return (
    <div className="bg-white text-slate-900" style={{ fontFamily: '"Space Grotesk", "Segoe UI", sans-serif' }}>
      <section className="px-6 pb-20 pt-10 lg:px-20 lg:pt-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-600 shadow-sm">
              <Sparkles size={14} style={{ color: brandColor }} />
              Bright Future Template
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.04em] lg:text-7xl" style={{ color: brandColor }}>
              The operating system for schools that want to grow without friction.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {siteName} brings together teaching, operations, finance, communication, public pages, and parent engagement in one clear system.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button onClick={onShowRegister} className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold text-white shadow-[0_18px_40px_rgba(79,70,229,0.18)] transition hover:-translate-y-0.5" style={{ background: brandColor }}>
                Get Started <ArrowRight size={16} />
              </button>
              <button onClick={onContact} className="rounded-2xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                Book Demo
              </button>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Tenant-safe operations', icon: <ShieldCheck size={18} />, note: 'School-by-school isolation with role-based access.' },
                { label: 'Public pages that convert', icon: <Globe size={18} />, note: 'Events, pricing, opportunities, and contact in one flow.' },
                { label: 'Growth-first workflows', icon: <TrendingUp size={18} />, note: 'Built for owners managing one school or many.' },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-1">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: accentColor }}>{item.icon}</div>
                  <h3 className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-slate-900">{item.label}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
              <img src={resolveAssetUrl(primaryHero || '/website-images/pages/home/hero-01.jpg')} alt={`${siteName} hero`} className="h-[360px] w-full object-cover" />
            </div>
            {[secondaryHero, tertiaryHero].map((image, index) => (
              <div key={`${image || 'fallback'}_${index}`} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-100 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <img src={resolveAssetUrl(image || `/website-images/pages/home/hero-0${index + 2}.jpg`)} alt={`${siteName} scene ${index + 2}`} className="h-[220px] w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-6 py-16 lg:px-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Trusted by schools</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-900 lg:text-4xl">Modern school teams need software that feels calm, fast, and reliable.</h2>
            </div>
            <button onClick={onGrowth} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: accentColor }}>Become a Growth Partner</button>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {showcaseSchools.slice(0, 4).map((school) => (
              <div key={school.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                    {school.logoUrl ? <img src={resolveAssetUrl(school.logoUrl)} alt={school.name} className="h-full w-full object-cover" /> : <Building2 size={22} style={{ color: school.primaryColor || brandColor }} />}
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900">{school.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{school.location || `${school.subdomain || 'school'}.ndovera.com`}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Platform highlights</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-slate-900">Everything a school website and operations layer needs, without the usual clutter.</h2>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {[
              { title: 'Academic workflows', body: 'Lessons, attendance, results, and classroom activity stay linked to the same school context.', icon: <BookOpen size={20} /> },
              { title: 'Events and media', body: 'Publish events, gallery updates, and school moments without rebuilding the site.', icon: <Calendar size={20} /> },
              { title: 'Enquiries and conversion', body: 'Public contact, opportunities, and partner forms route to the right team quickly.', icon: <MessageSquare size={20} /> },
            ].map((card, index) => (
              <div key={card.title} className="rounded-[2rem] p-8 text-white shadow-[0_22px_60px_rgba(15,23,42,0.12)]" style={{ background: index === 1 ? accentColor : brandColor }}>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">{card.icon}</div>
                <h3 className="mt-6 text-2xl font-black tracking-[-0.02em]">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/85">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-20 lg:px-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Pricing</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.03em] text-slate-900">Clear plans for different stages of school growth.</h2>
            </div>
            <button onClick={onOpenPricing} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
              Open pricing page
            </button>
          </div>
          <div className="mt-10 grid gap-5 xl:grid-cols-3">
            {displayPricing.map((tier, index) => {
              const setup = Number(tier.pricing?.oneTimeSetupNaira ?? tier.oneTimeSetupNaira ?? 0);
              const perStudent = Number(tier.pricing?.perStudentPerTermNaira ?? tier.perStudentPerTermNaira ?? 0);
              const discount = Number(tier.pricing?.discountPercent || 0);
              return (
                <div key={tier.key} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-black text-slate-900">{tier.label}</div>
                    {discount > 0 ? <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white" style={{ background: accentColor }}>-{discount}%</span> : null}
                  </div>
                  <div className="mt-4 text-sm text-slate-500">{formatRange(tier)}</div>
                  <div className="mt-6 text-3xl font-black" style={{ color: brandColor }}>{formatNaira(setup)}</div>
                  <div className="mt-2 text-sm text-slate-500">One-time setup</div>
                  <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    {formatNaira(perStudent)} per learner from the second term.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-20">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-slate-900 px-8 py-10 text-white shadow-[0_28px_80px_rgba(15,23,42,0.18)] lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Testimonials</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.03em]">What schools and users are already saying.</h2>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
              <Zap size={14} style={{ color: accentColor }} /> Live feedback
            </div>
          </div>
          <div className="mt-10 grid gap-5 xl:grid-cols-3">
            {testimonials.slice(0, 3).map((entry, index) => (
              <div key={entry.id || `${entry.author}_${index}`} className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-base leading-8 text-slate-200">“{entry.quote}”</p>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                    {entry.profilePhotoUrl ? <img src={resolveAssetUrl(entry.profilePhotoUrl)} alt={entry.author} className="h-full w-full object-cover" /> : <span className="text-sm font-black">{entry.author?.slice(0, 1) || 'N'}</span>}
                  </div>
                  <div>
                    <div className="text-sm font-black text-white">{entry.author}</div>
                    <div className="text-xs text-slate-400">{entry.role || 'Ndovera community'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
