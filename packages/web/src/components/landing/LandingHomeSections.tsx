import React, { useEffect, useMemo, useState } from 'react'
import { BarChart3, Globe, ShieldCheck, Smartphone, Sprout, Zap } from 'lucide-react'

type ShowcaseSchool = {
  id: string
  name: string
  subdomain?: string
  logoUrl?: string | null
  primaryColor?: string | null
  location?: string | null
}

type TestimonialRecord = {
  id?: string
  author?: string
  role?: string
  quote?: string
  originalComment?: string
  profilePhotoUrl?: string
}

type PricingTier = {
	key: string
	label: string
	minStudents: number
	maxStudents: number | null
	oneTimeSetupNaira: number
	perStudentPerTermNaira: number
  oneTimeSetupDiscountNaira?: number
  perStudentPerTermDiscountNaira?: number
  pricing?: {
    oneTimeSetupNaira: number
    perStudentPerTermNaira: number
    discountPercent: number
  }
}

type Props = {
  brandColor: string
  brandSoft: string
  brandBorder: string
  brandText: string
  heroImages: string[]
  showcaseSchools: ShowcaseSchool[]
  testimonials: TestimonialRecord[]
  pricingTiers: PricingTier[]
  resolveAssetUrl: (value: string) => string
  onShowRegister: () => void
  onContact: () => void
  onGrowth: () => void
  onOpenPricing: () => void
}

function formatNaira(value: number) {
	return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)
}

function formatRange(minStudents: number, maxStudents: number | null) {
	return maxStudents === null ? `${minStudents}+ learners` : `${minStudents} to ${maxStudents} learners`
}

function planLabel(tier: PricingTier) {
  if (tier.key === 'growth') return 'Fast self-serve onboarding'
  if (tier.key === 'pro') return 'Best for larger school rollouts'
  if (tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0)) return 'Tailored quote with the Ndovera team'
  return formatRange(tier.minStudents, tier.maxStudents)
}

function planFeatures(tier: PricingTier) {
  if (tier.key === 'growth') return ['One-time setup to get live', 'Term billing begins from second term', 'Best fit for schools launching quickly']
  if (tier.key === 'pro') return ['Higher-touch onboarding for bigger schools', 'Lower per-student term rate from second term', 'Built for larger operations and fuller rollout']
  if (tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0)) return ['Manual scoping with Ndovera', 'Custom rollout and support plan', 'Pricing agreed before billing starts']
  return ['One-time setup to get live', 'Term billing begins from second term', 'Optional discount codes during checkout']
}

function initialsForName(value?: string) {
  return String(value || 'Ndovera User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'NU'
}

export function LandingHomeSections({
  brandColor,
  brandSoft,
  brandBorder,
  brandText,
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
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    if (heroImages.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroImages.length)
    }, 12000)
    return () => window.clearInterval(timer)
  }, [heroImages.length])

  const repeatedSchools = useMemo(() => [...showcaseSchools, ...showcaseSchools], [showcaseSchools])
  const repeatedTestimonials = useMemo(() => [...testimonials, ...testimonials], [testimonials])

  return (
    <>
      <style>{`
        @keyframes ndoveraMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes ndoveraHeroPan {
          0% { transform: scale(1.03) translate3d(0, 0, 0); }
          50% { transform: scale(1.08) translate3d(-1.5%, -1%, 0); }
          100% { transform: scale(1.03) translate3d(0, 0, 0); }
        }
      `}</style>

      <section className="relative mx-auto max-w-7xl overflow-hidden rounded-[3rem] border border-white/5 px-6 py-20 text-center lg:px-20 lg:py-32">
        <div className="absolute inset-0">
          {heroImages.map((image, index) => (
            <div
              key={`${index}_${image.slice(0, 24)}`}
              className="absolute inset-0 transition-opacity duration-2000"
              style={{
                opacity: index === heroIndex ? 1 : 0,
                backgroundImage: `linear-gradient(135deg, rgba(4, 14, 9, 0.84), rgba(4, 14, 9, 0.62)), linear-gradient(135deg, rgba(13, 28, 20, 0.48), rgba(13, 28, 20, 0.3)), url(${resolveAssetUrl(image)})`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                animation: 'ndoveraHeroPan 20s ease-in-out infinite',
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="relative z-10">
          <div className="mx-auto mb-8 inline-flex items-center gap-3 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: brandSoft, borderColor: brandBorder, color: brandText }}>
            <Zap size={14} /> School Management Made Clear
          </div>
          <h1 className="mb-8 text-5xl font-bold tracking-tight text-white lg:text-7xl">
            Run your school from one
            <br />
            <span className="inline-block rounded-2xl px-4 py-2 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)]" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)' }}>
              simple, trusted place
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-lg leading-relaxed text-zinc-100/85">
            Ndovera helps schools manage lessons, fees, updates, reports, public pages, and parent communication in one clear system.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button onClick={onShowRegister} className="rounded-2xl bg-[#066a3e] px-8 py-4 text-lg font-bold text-white">Start with your school</button>
            <button onClick={onContact} className="rounded-2xl bg-white/10 px-8 py-4 text-lg font-bold text-white backdrop-blur">Speak to our team</button>
            <button onClick={onGrowth} className="rounded-2xl px-8 py-4 text-lg font-bold text-white backdrop-blur" style={{ background: brandSoft, border: `1px solid ${brandBorder}` }}>Join the growth team</button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-20">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-white">Schools using Ndovera</h3>
            <p className="mt-2 text-sm text-zinc-400">Schools growing with Ndovera.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-4xl border border-white/5 bg-[#101214] py-4">
          <div style={{ display: 'flex', width: 'max-content', animation: 'ndoveraMarquee 120s linear infinite' }}>
            {repeatedSchools.map((school, index) => (
              <div key={`${school.id}_${index}`} className="mx-3 flex items-center gap-4 rounded-3xl border border-white/5 bg-white/5 px-5 py-4" style={{ minWidth: 260 }}>
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-sm font-bold text-white">
                  {school.logoUrl ? <img src={resolveAssetUrl(school.logoUrl)} alt={school.name} className="h-full w-full object-cover" /> : initialsForName(school.name)}
                </div>
                <div className="min-w-0 text-left">
                  <div className="truncate text-sm font-bold text-white">{school.name}</div>
                  <div className="truncate text-xs text-zinc-400">{school.location || `${school.subdomain || 'school'}.ndovera.com`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-white">Simple plans for school launch and term billing</h3>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">Pay the setup fee first, then move to per-student billing from the second term. Growth and Pro are self-serve. Custom starts with a guided quote.</p>
          </div>
          <button onClick={onOpenPricing} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
            View pricing page
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <div key={tier.key} className="rounded-4xl border border-white/10 bg-[#101214] p-6 shadow-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: brandText }}>{tier.label}</p>
              <h4 className="mt-3 text-2xl font-black text-white">{planLabel(tier)}</h4>
              {Number(tier.pricing?.discountPercent || 0) > 0 ? <div className="mt-3 inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">Save {tier.pricing?.discountPercent}%</div> : null}
              <div className="mt-5 space-y-3 text-sm text-zinc-300">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Set-up</div>
                  <div className="mt-2 flex items-end gap-2"><div className="text-lg font-bold text-white">{formatNaira(Number(tier.pricing?.oneTimeSetupNaira ?? tier.oneTimeSetupNaira))}</div>{Number(tier.pricing?.discountPercent || 0) > 0 ? <div className="text-sm text-zinc-500 line-through">{formatNaira(tier.oneTimeSetupNaira)}</div> : null}</div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Per learner, from second term</div>
                  <div className="mt-2 flex items-end gap-2"><div className="text-lg font-bold text-white">{formatNaira(Number(tier.pricing?.perStudentPerTermNaira ?? tier.perStudentPerTermNaira))}</div>{Number(tier.pricing?.discountPercent || 0) > 0 ? <div className="text-sm text-zinc-500 line-through">{formatNaira(tier.perStudentPerTermNaira)}</div> : null}</div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Plan highlights</div>
                  <ul className="mt-3 space-y-2 leading-7">
                    {planFeatures(tier).map((feature) => <li key={`${tier.key}_${feature}`}>{feature}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-3 lg:px-20">
        {[
          { title: 'Clear roles for every user', desc: 'Students, teachers, parents, finance teams, and leaders each get the right space.', icon: <ShieldCheck size={32} /> },
          { title: 'Public school pages', desc: 'Show your school online with pages for news, contact details, events, and opportunities.', icon: <Globe size={32} /> },
          { title: 'Simple reports', desc: 'See attendance, fees, and school activity in a way that is easy to follow.', icon: <BarChart3 size={32} /> },
          { title: 'Works well on phones', desc: 'Families and staff can keep up even when they are away from a desk.', icon: <Smartphone size={32} /> },
          { title: 'Fee tracking', desc: 'Keep fee records tidy and follow payments with less stress.', icon: <Zap size={32} /> },
          { title: 'Support for learning', desc: 'Teachers and students get help with school work, tasks, and steady progress.', icon: <Sprout size={32} /> },
        ].map((feature) => (
          <div key={feature.title} className="rounded-3xl border border-white/5 bg-[#151619] p-8">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: brandSoft, color: brandColor }}>{feature.icon}</div>
            <h3 className="mb-4 text-xl font-bold text-white">{feature.title}</h3>
            <p className="leading-relaxed text-zinc-400">{feature.desc}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-20">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-white">What schools say about Ndovera</h3>
            <p className="mt-2 text-sm text-zinc-400">Real words from schools and families.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-4xl border border-white/5 bg-[#101214] py-4">
          <div style={{ display: 'flex', width: 'max-content', animation: 'ndoveraMarquee 140s linear infinite' }}>
            {repeatedTestimonials.map((testimonial, index) => (
              <div key={`${testimonial.id || testimonial.author || index}_${index}`} className="mx-3 w-[320px] rounded-[1.9rem] border border-white/5 bg-white/5 p-6 text-left">
                <div className="text-sm leading-7 text-zinc-200">“{testimonial.originalComment || testimonial.quote}”</div>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-emerald-600/15 text-xs font-bold text-emerald-200">
                    {testimonial.profilePhotoUrl ? <img src={resolveAssetUrl(testimonial.profilePhotoUrl)} alt={testimonial.author || 'User'} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initialsForName(testimonial.author)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{testimonial.author || 'Ndovera user'}</div>
                    <div className="text-sm text-zinc-500">{testimonial.role || 'Ndovera user'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-20">
        <div className="grid gap-6 rounded-[3rem] border p-8 lg:grid-cols-[1.4fr_0.9fr]" style={{ borderColor: brandBorder, background: `linear-gradient(135deg, ${brandSoft}, rgba(21,22,25,0.96))` }}>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]" style={{ background: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.22)' }}><Sprout size={14} /> Growth Partner Access</div>
            <h3 className="mt-5 text-3xl font-black text-white">A safe route for approved growth partners</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">Approved partners can help more schools discover Ndovera and support first steps after sign-up.</p>
          </div>
          <div className="flex flex-col justify-center gap-3">
            <button onClick={onGrowth} className="rounded-2xl px-6 py-4 text-sm font-bold text-white" style={{ background: brandColor }}>Apply as a growth partner</button>
            <button onClick={onContact} className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-bold text-white">Ask about onboarding</button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 lg:px-20">
        <div className="rounded-[3rem] p-12 text-center text-white" style={{ background: `linear-gradient(135deg, ${brandColor}, rgba(16,185,129,0.55))` }}>
          <h2 className="mb-8 text-4xl font-black lg:text-6xl">Ready to move your school forward?</h2>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button onClick={onShowRegister} className="rounded-2xl bg-white px-10 py-4 text-lg font-bold" style={{ color: brandColor }}>Register your school</button>
            <button onClick={onContact} className="rounded-2xl border border-white/10 bg-black/20 px-10 py-4 text-lg font-bold text-white">Talk to Ndovera</button>
          </div>
        </div>
      </section>
    </>
  )
}