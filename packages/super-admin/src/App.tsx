import React, { useEffect, useMemo, useState } from 'react'
import { IdentityOperationsPanel } from './components/IdentityOperationsPanel'
import { ChampionshipControlPanel } from './components/ChampionshipControlPanel'
import { PublicInboxPanel, type GrowthPartnerApplication, type PublicContactInquiry, type PublicInboxStatus } from './components/PublicInboxPanel'
import { WebsiteExperiencePanel } from './components/WebsiteExperiencePanel'

type TabKey = 'schools' | 'website' | 'plans' | 'onboarding' | 'publicInbox' | 'ai' | 'identity' | 'championships'

type SchoolCounts = { students: number; staff: number; parents: number; admins: number; total: number }
type SchoolRecord = { id: string; name: string; subdomain: string; logoUrl?: string; primaryColor?: string; liveClassQuota: number; pageCount: number; website: Record<string, any> | null; createdAt: string; counts?: SchoolCounts; inactiveUsers?: number }
type PricingPlan = { id: string; name: string; description: string; priceCents: number; billingInterval: string; features: string[] }
type SchoolPricingTier = { key: string; label: string; minStudents: number; maxStudents: number | null; oneTimeSetupNaira: number; perStudentPerTermNaira: number; pricing?: { oneTimeSetupNaira: number; perStudentPerTermNaira: number; discountPercent: number } }
type MonetizationSettings = any
type LiveCapacityOption = { participantLimit: number; priceNaira: number; label: string }
type PlatformSettings = {
  liveMeetings: {
    defaultParticipantLimit: number
    schoolConcurrentLimit: number
    upgradeOptions: LiveCapacityOption[]
  }
  economy: {
    currencyName: string
    currencyPlural: string
    currencySymbol: string
    aiUnitsPerNaira: number
    cashoutNairaPerUnit: number
    adRewardPerImpression: number
  }
}
type AiFeature = { featureKey: string; label: string; category: 'student' | 'teacher' | 'staff'; audience: string; description: string; enabled: boolean; keyuCost: number; freeTierLimit: number; requiresSuperApproval: boolean; usageCount: number; totalKeyuSpent: number; lastUsedAt?: string | null }
type OnboardingRequest = { id: string; school_name: string; subdomain: string; owner_name: string; owner_ndovera_email: string; status: string; payment_status: string; created_at: string; updated_at: string }
type AiSummary = { features: number; enabledFeatures: number; usageCount: number; keyuSpent: number }
type SystemMetrics = { schools: Array<{ id: string; name: string; subdomain: string; counts: SchoolCounts; inactiveUsers: number }>; totals: SchoolCounts; inactiveUsers: number; transfers: number }
type SuperAdminUser = { id: string; name?: string; email?: string; roles: string[]; activeRole?: string }
type PublicInboxResponse = { contactInquiries: PublicContactInquiry[]; growthApplications: GrowthPartnerApplication[] }
type GeneratedInvoice = {
  id: string
  invoiceType: string
  academicYear: string | null
  termKey: string | null
  totalNaira: number
  balanceNaira: number
  status: string
  metadata?: Record<string, unknown> | null
  items?: Array<{ id: string; label: string; quantity: number; unitAmountNaira: number; totalAmountNaira: number; itemType: string }>
}
type InvoiceRequestFeedback = { tone: 'success' | 'error'; text: string }

const env = ((import.meta as any)?.env || {}) as Record<string, string | undefined>
const API_BASE = (env.VITE_SUPER_ADMIN_API_URL || '').replace(/\/$/, '')
const PUBLIC_ASSET_BASE = (env.VITE_PUBLIC_ASSET_BASE_URL || API_BASE).replace(/\/$/, '')
let csrfTokenPromise: Promise<string> | null = null

function resolveAppUrl(path: string) {
  if (!path) return '#'
  if (/^https?:\/\//i.test(path)) return path
  const base = PUBLIC_ASSET_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  const method = String(options.method || 'GET').toUpperCase()
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfTokenPromise) {
      csrfTokenPromise = fetch(`${API_BASE}/csrf-token`, { credentials: 'include' })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || !payload?.csrfToken) throw new Error(payload?.error || 'Unable to load CSRF token')
          return String(payload.csrfToken)
        })
        .catch((error) => {
          csrfTokenPromise = null
          throw error
        })
    }
    headers.set('X-CSRF-Token', await csrfTokenPromise)
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Request failed')
  return payload as T
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div>{sub ? <div className="muted" style={{ marginTop: 4 }}>{sub}</div> : null}</div>
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2><p className="muted" style={{ marginTop: 8, maxWidth: 900 }}>{subtitle}</p></div>
}

function SidebarLink({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
	return <button className="btn" onClick={onClick} style={{ textAlign: 'left', background: active ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.18))' : 'rgba(255,255,255,0.03)', color: 'white', padding: 14, width: '100%' }}>{label}</button>
}

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function readMetadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function formatInvoiceBillingMode(invoice: GeneratedInvoice) {
  const pricingMode = readMetadataText(invoice.metadata, 'pricingMode')
  if (pricingMode === 'onboarding-only') return 'Onboarding setup only'
  if (pricingMode === 'termly-only') return 'Term billing only'
  if (invoice.invoiceType === 'onboarding') return 'Onboarding setup only'
  if (invoice.invoiceType === 'term-billing') return 'Term billing only'
  return 'Not specified'
}

function formatInvoicePlanLabel(invoice: GeneratedInvoice, tiers: SchoolPricingTier[]) {
  const pricingTierKey = readMetadataText(invoice.metadata, 'pricingTierKey')
  if (!pricingTierKey) return 'Not specified'
  return tiers.find((tier) => tier.key === pricingTierKey)?.label || pricingTierKey
}

function defaultAcademicYear() {
  const now = new Date()
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}/${year + 1}`
}

function defaultTermKey() {
  const month = new Date().getMonth()
  if (month <= 3) return 'term-2'
  if (month <= 7) return 'term-3'
  return 'term-1'
}

function formatBillingMode(value: string | null | undefined) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'onboarding-only') return 'Onboarding only'
  if (normalized === 'termly-only') return 'Term billing only'
  if (normalized === 'onboarding') return 'Onboarding only'
  if (normalized === 'term-billing') return 'Term billing only'
  return 'Standard billing'
}

export default function App() {
  const [sessionUser, setSessionUser] = useState<SuperAdminUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginSubmitting, setLoginSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('schools')
  const [schools, setSchools] = useState<SchoolRecord[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [monetizationSettings, setMonetizationSettings] = useState<MonetizationSettings | null>(null)
  const [onboardingRequests, setOnboardingRequests] = useState<OnboardingRequest[]>([])
  const [contactInquiries, setContactInquiries] = useState<PublicContactInquiry[]>([])
  const [growthApplications, setGrowthApplications] = useState<GrowthPartnerApplication[]>([])
  const [aiFeatures, setAiFeatures] = useState<AiFeature[]>([])
  const [aiSummary, setAiSummary] = useState<AiSummary>({ features: 0, enabledFeatures: 0, usageCount: 0, keyuSpent: 0 })
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null)
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({ schools: [], totals: { students: 0, staff: 0, parents: 0, admins: 0, total: 0 }, inactiveUsers: 0, transfers: 0 })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [invoiceAcademicYear, setInvoiceAcademicYear] = useState(defaultAcademicYear())
  const [invoiceTermKey, setInvoiceTermKey] = useState(defaultTermKey())
  const [invoiceStudentCount, setInvoiceStudentCount] = useState('0')
  const [invoiceIncludeSetupFee, setInvoiceIncludeSetupFee] = useState(false)
  const [invoicePricingTierKey, setInvoicePricingTierKey] = useState('')
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false)
  const [generatedInvoice, setGeneratedInvoice] = useState<GeneratedInvoice | null>(null)
  const [invoiceFeedback, setInvoiceFeedback] = useState<InvoiceRequestFeedback | null>(null)
  const [approvingOnboardingId, setApprovingOnboardingId] = useState('')

  const loadWorkspace = async () => {
    const [schoolsResp, plansResp, onboardingResp, publicInboxResp, aiFeaturesResp, aiSummaryResp, platformSettingsResp, systemMetricsResp, monetizationResp] = await Promise.all([
      api<{ schools: SchoolRecord[] }>('/api/super/schools'),
      api<{ plans: PricingPlan[] }>('/api/super/pricing-plans'),
      api<{ requests: OnboardingRequest[] }>('/api/super/onboarding/requests'),
      api<PublicInboxResponse>('/api/super/public-inbox'),
      api<{ features: AiFeature[] }>('/api/super/ai/features'),
      api<AiSummary>('/api/super/ai/summary'),
      api<{ settings: PlatformSettings }>('/api/super/platform-settings'),
      api<SystemMetrics>('/api/super/metrics'),
      api<{ settings: MonetizationSettings }>('/api/super/monetization/settings'),
    ])
    setSchools(schoolsResp.schools || [])
    setPlans(plansResp.plans || [])
    setOnboardingRequests(onboardingResp.requests || [])
    setContactInquiries(publicInboxResp.contactInquiries || [])
    setGrowthApplications(publicInboxResp.growthApplications || [])
    setAiFeatures(aiFeaturesResp.features || [])
    setAiSummary(aiSummaryResp)
    setPlatformSettings(platformSettingsResp.settings || null)
    setMonetizationSettings(monetizationResp.settings || null)
    setSystemMetrics({
      schools: systemMetricsResp.schools || [],
      totals: systemMetricsResp.totals || { students: 0, staff: 0, parents: 0, admins: 0, total: 0 },
      inactiveUsers: systemMetricsResp.inactiveUsers || 0,
      transfers: systemMetricsResp.transfers || 0,
    })
    setSelectedSchoolId((current) => current || schoolsResp.schools?.[0]?.id || '')
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/super/auth/me`, { credentials: 'include' })
        const payload = await response.json().catch(() => ({}))
        if (!mounted) return
        if (!response.ok) {
          setSessionUser(null)
        } else {
          setSessionUser(payload?.user || null)
        }
      } finally {
        if (mounted) setAuthLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!sessionUser) {
      setLoading(false)
      return
    }
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadWorkspace()
        if (!mounted) return
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [sessionUser])

  const selectedSchool = useMemo(() => schools.find((school) => school.id === selectedSchoolId) || null, [schools, selectedSchoolId])
  const schoolPricingTiers = useMemo<SchoolPricingTier[]>(() => monetizationSettings?.schoolPricing?.tiers || [], [monetizationSettings])
  const invoicePlanOptions = useMemo(() => schoolPricingTiers.filter((tier) => tier.key !== 'custom'), [schoolPricingTiers])
  const selectedInvoicePlan = useMemo(() => schoolPricingTiers.find((tier) => tier.key === invoicePricingTierKey) || null, [invoicePricingTierKey, schoolPricingTiers])

  useEffect(() => {
    setInvoiceStudentCount(String(selectedSchool?.counts?.students || 0))
    setGeneratedInvoice(null)
    setInvoiceFeedback(null)
  }, [selectedSchool?.counts?.students, selectedSchoolId])

  useEffect(() => {
    if (!invoicePlanOptions.length) return
    setInvoicePricingTierKey((current) => current || invoicePlanOptions[0].key)
  }, [invoicePlanOptions])

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'schools', label: 'School controls' },
    { key: 'website', label: 'Website template' },
    { key: 'plans', label: 'Pricing plans' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'publicInbox', label: 'Public inbox' },
    { key: 'ai', label: 'AI governance' },
    { key: 'championships', label: 'Championships' },
    { key: 'identity', label: 'Identity' },
  ]

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoginSubmitting(true)
    setLoginError('')
    try {
      const response = await fetch(`${API_BASE}/api/super/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Unable to sign in.')
      setSessionUser(payload?.user || null)
      setLoginPassword('')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to sign in.')
    } finally {
      setLoginSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/super/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    setSessionUser(null)
    setSchools([])
    setPlans([])
    setMonetizationSettings(null)
    setOnboardingRequests([])
    setContactInquiries([])
    setGrowthApplications([])
    setAiFeatures([])
    setAiSummary({ features: 0, enabledFeatures: 0, usageCount: 0, keyuSpent: 0 })
    setPlatformSettings(null)
    setLoading(false)
  }

  const savePricingPlans = async () => {
    try {
      const response = await api<{ plans: PricingPlan[] }>('/api/super/pricing-plans', {
        method: 'PUT',
        body: JSON.stringify({ plans }),
      })
      setPlans(response.plans || [])
      setMessage('Pricing plans updated.')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save pricing plans.')
    }
  }

  const savePlatformSettings = async () => {
    if (!platformSettings) return
    try {
      const response = await api<{ settings: PlatformSettings }>('/api/super/platform-settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: platformSettings }),
      })
      setPlatformSettings(response.settings)
      setMessage('Platform settings updated.')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save platform settings.')
    }
  }

  const saveMonetizationSettings = async () => {
    if (!monetizationSettings) return
    try {
      const response = await api<{ settings: MonetizationSettings }>('/api/super/monetization/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: monetizationSettings }),
      })
      setMonetizationSettings(response.settings || null)
      setMessage('Monetization settings updated.')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save monetization settings.')
    }
  }

  const patchMonetizationSettings = (updater: (current: MonetizationSettings) => MonetizationSettings) => {
    setMonetizationSettings((current: MonetizationSettings | null) => current ? updater(current) : current)
  }

  const appendGeneratedDiscountCode = (scope: 'school-onboarding' | 'marketplace' | 'all') => {
    const timestamp = new Date().toISOString()
    const randomCode = `NDO-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`
    patchMonetizationSettings((current) => ({
      ...current,
      marketplace: {
        ...current.marketplace,
        discountCodes: [
          ...(current.marketplace?.discountCodes || []),
          {
            id: `code_${Date.now()}`,
            code: randomCode,
            description: scope === 'school-onboarding' ? 'School onboarding discount' : scope === 'marketplace' ? 'Marketplace discount' : 'Global discount',
            percentageOff: 10,
            scope,
            active: true,
            validFrom: timestamp,
            expiresAt: null,
            maxUses: null,
            usedCount: 0,
            discontinuedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
    }))
    setMessage(`Generated ${scope} code ${randomCode}. Save monetization settings to publish it.`)
    setError('')
  }

  const updatePublicInboxStatus = async (kind: 'contact' | 'growth', itemId: string, status: PublicInboxStatus) => {
    try {
      const response = await api<{ inquiry?: PublicContactInquiry; application?: GrowthPartnerApplication }>(`/api/super/public-inbox/${kind}/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (kind === 'contact' && response.inquiry) {
        setContactInquiries((current) => current.map((item) => item.id === itemId ? response.inquiry as PublicContactInquiry : item))
        setMessage(`Contact enquiry marked as ${status}.`)
      }
      if (kind === 'growth' && response.application) {
        setGrowthApplications((current) => current.map((item) => item.id === itemId ? response.application as GrowthPartnerApplication : item))
        setMessage(`Growth application marked as ${status}.`)
      }
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update inbox item.')
    }
  }

  const approveOnboardingRequest = async (requestId: string) => {
    setApprovingOnboardingId(requestId)
    try {
      await api(`/api/super/onboarding/requests/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST',
      })
      await loadWorkspace()
      setMessage('School approved and owner account provisioned.')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve onboarding request.')
    } finally {
      setApprovingOnboardingId('')
    }
  }

  const generateSchoolInvoice = async () => {
    if (!selectedSchoolId) {
      setError('Select a school first.')
      return
    }
    setInvoiceSubmitting(true)
    setInvoiceFeedback(null)
    try {
      const response = await api<{ invoice: GeneratedInvoice }>('/api/super/monetization/invoices/generate', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          academicYear: invoiceAcademicYear.trim(),
          termKey: invoiceTermKey.trim(),
          studentCount: Math.max(0, Number(invoiceStudentCount || 0)),
          includeSetupFee: invoiceIncludeSetupFee,
          pricingTierKey: invoicePricingTierKey || undefined,
        }),
      })
      setGeneratedInvoice(response.invoice || null)
      const appliedPlan = selectedInvoicePlan?.label || invoicePricingTierKey || 'Auto'
      const billingMode = formatBillingMode(response.invoice?.invoiceType || (invoiceIncludeSetupFee ? 'onboarding' : 'term-billing'))
      setInvoiceFeedback({ tone: 'success', text: `Draft created with ${appliedPlan} pricing and ${billingMode.toLowerCase()}.` })
      setMessage(`Invoice ${response.invoice?.id || ''} generated for ${selectedSchool?.name || 'the selected school'}.`)
      setError('')
    } catch (err) {
      const appliedPlan = selectedInvoicePlan?.label || invoicePricingTierKey || 'the selected plan'
      const billingMode = formatBillingMode(invoiceIncludeSetupFee ? 'onboarding' : 'term-billing')
      setGeneratedInvoice(null)
      setInvoiceFeedback({ tone: 'error', text: `Invoice generation failed while using ${appliedPlan} pricing and ${billingMode.toLowerCase()}.` })
      setError(err instanceof Error ? err.message : 'Unable to generate invoice.')
    } finally {
      setInvoiceSubmitting(false)
    }
  }

  if (authLoading) {
    return <div className="min-h-screen bg-[#081018] text-white flex items-center justify-center">Checking super-admin session…</div>
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-[#081018] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#151619] p-8 shadow-2xl shadow-black/40">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black">SA</div>
            <h1 className="text-3xl font-black">Super Admin Sign In</h1>
            <p className="mt-2 text-sm text-zinc-400">Use the server-provisioned super-admin credentials.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} type="email" placeholder="Administrator email" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
            <input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} type="password" placeholder="Administrator password" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
            {loginError ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{loginError}</div> : null}
            <button type="submit" disabled={loginSubmitting} className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60">{loginSubmitting ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#081018', color: '#e5eef6', fontFamily: 'Inter, Segoe UI, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        button, input, select, textarea { font: inherit; }
        .panel { background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.18); }
        .muted { color: #94a3b8; }
        .pill { padding: 6px 10px; border-radius: 999px; background: rgba(148, 163, 184, 0.12); color: #cbd5e1; font-size: 12px; font-weight: 700; }
        .pill-warn { background: rgba(245, 158, 11, 0.18); color: #fde68a; }
        .pill-danger { background: rgba(244, 63, 94, 0.18); color: #fecdd3; }
        .field, .textarea, .select { width: 100%; border-radius: 14px; border: 1px solid rgba(148,163,184,0.2); background: rgba(15, 23, 42, 0.9); color: white; padding: 12px 14px; }
        .textarea { min-height: 92px; resize: vertical; }
        .btn { border: 0; border-radius: 14px; padding: 12px 16px; font-weight: 800; cursor: pointer; }
        .btn-primary { background: linear-gradient(135deg, #10b981, #06b6d4); color: white; }
        .btn-secondary { background: rgba(255,255,255,0.06); color: white; }
      `}</style>

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24 }}>
        <div className="panel" style={{ padding: 24, marginBottom: 20, background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.12), rgba(15,23,42,0.95))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>Super Admin Control Center</h1>
              <p className="muted" style={{ marginTop: 8, maxWidth: 760 }}>Manage per-school quotas, onboarding, pricing plans, website previews, and AI governance from a single workspace.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <span className="pill">Tenant controls</span>
                <span className="pill">Website preview</span>
                <span className="pill">AI governance</span>
              </div>
            </div>
            <div style={{ minWidth: 280, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <Stat label="Schools" value={schools.length} />
              <Stat label="Plans" value={plans.length} />
            </div>
          </div>
        </div>

        {message ? <div className="panel" style={{ padding: 14, marginBottom: 12, borderColor: 'rgba(16,185,129,0.45)', color: '#bbf7d0' }}>{message}</div> : null}
        {error ? <div className="panel" style={{ padding: 14, marginBottom: 12, borderColor: 'rgba(239,68,68,0.45)', color: '#fecaca' }}>{error}</div> : null}
        {loading ? <div className="panel" style={{ padding: 24 }}>Loading super-admin workspace…</div> : null}

        {!loading && (
          <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '280px 1fr' }}>
            <aside className="panel" style={{ padding: 18, alignSelf: 'start', position: 'sticky', top: 24 }}>
              <div style={{ display: 'grid', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#94a3b8' }}>Workspace</div>
                  <div style={{ fontSize: 24, fontWeight: 900, marginTop: 10 }}>Super Admin</div>
                  <p className="muted" style={{ marginTop: 8 }}>Use the left sidebar to move between platform controls.</p>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {tabs.map((tab) => <SidebarLink key={tab.key} active={activeTab === tab.key} label={tab.label} onClick={() => setActiveTab(tab.key)} />)}
                  <button className="btn btn-secondary" onClick={() => window.location.reload()}>Refresh workspace</button>
                </div>
                <div>
                  <SectionTitle title="Tenant Schools" subtitle="Choose a school context for tenant-scoped actions." />
                  <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    {schools.map((school) => (
                      <button key={school.id} className="btn" onClick={() => setSelectedSchoolId(school.id)} style={{ textAlign: 'left', background: selectedSchoolId === school.id ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.03)', color: 'white', padding: 14 }}>
                        <div style={{ fontWeight: 800 }}>{school.name}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{school.subdomain}.ndovera.com</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          <span className="pill">Quota: {school.liveClassQuota}</span>
                          <span className="pill">Pages: {school.pageCount}</span>
                          <span className={school.inactiveUsers ? 'pill pill-warn' : 'pill'}>Inactive: {school.inactiveUsers || 0}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <div style={{ display: 'grid', gap: 18 }}>
              {activeTab === 'schools' && selectedSchool ? (
                <div className="panel" style={{ padding: 22 }}>
                  <SectionTitle title={selectedSchool.name} subtitle="Read-only control overview for the selected tenant." />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 18 }}>
                    <Stat label="Subdomain" value={selectedSchool.subdomain} />
                    <Stat label="Current quota" value={`${selectedSchool.liveClassQuota} live rooms`} />
                      <Stat label="Website pages" value={selectedSchool.pageCount} />
                  </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <span className="pill">Active users: {selectedSchool.counts?.total || 0}</span>
                      <span className={(selectedSchool.inactiveUsers || 0) > 0 ? 'pill pill-warn' : 'pill'}>Inactive users: {selectedSchool.inactiveUsers || 0}</span>
                    </div>

                    <div className="panel" style={{ padding: 18, marginTop: 18 }}>
                      <SectionTitle title="Generate invoice" subtitle="Create a draft onboarding or term invoice for the selected school with an explicit pricing plan." />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Academic year</div>
                          <input className="field" value={invoiceAcademicYear} onChange={(event) => setInvoiceAcademicYear(event.target.value)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Term key</div>
                          <input className="field" value={invoiceTermKey} onChange={(event) => setInvoiceTermKey(event.target.value)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Student count</div>
                          <input className="field" type="number" min={0} value={invoiceStudentCount} onChange={(event) => setInvoiceStudentCount(event.target.value)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Pricing plan</div>
                          <select className="select" value={invoicePricingTierKey} onChange={(event) => setInvoicePricingTierKey(event.target.value)}>
                            {invoicePlanOptions.map((tier) => <option key={tier.key} value={tier.key}>{tier.label}</option>)}
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div className="muted" style={{ marginBottom: 6 }}>Billing mode</div>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={invoiceIncludeSetupFee} onChange={(event) => setInvoiceIncludeSetupFee(event.target.checked)} /> <span>{invoiceIncludeSetupFee ? 'Onboarding setup invoice' : 'Term billing invoice'}</span></label>
                        </label>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                        <div className="muted">The selected pricing plan is sent as pricingTierKey so the billing engine uses the intended Growth or Pro plan instead of only inferring from headcount.</div>
                        <button className="btn btn-primary" onClick={generateSchoolInvoice} disabled={invoiceSubmitting || !invoicePricingTierKey}>{invoiceSubmitting ? 'Generating…' : 'Generate draft invoice'}</button>
                      </div>
                      {invoiceFeedback ? (
                        <div
                          className="panel"
                          style={{
                            padding: 12,
                            marginTop: 14,
                            borderColor: invoiceFeedback.tone === 'success' ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.45)',
                            background: invoiceFeedback.tone === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                            color: invoiceFeedback.tone === 'success' ? '#bbf7d0' : '#fecaca',
                          }}
                        >
                          {invoiceFeedback.text}
                        </div>
                      ) : null}
                      {generatedInvoice ? (
                        <div className="panel" style={{ padding: 16, marginTop: 16 }}>
                          {(() => {
                            const metadata = (generatedInvoice.metadata || {}) as Record<string, unknown>
                            const appliedTierKey = String(metadata.pricingTierKey || '')
                            const appliedTierLabel = schoolPricingTiers.find((tier) => tier.key === appliedTierKey)?.label || appliedTierKey || 'Auto'
                            const pricingMode = formatBillingMode(String(metadata.pricingMode || generatedInvoice.invoiceType || ''))
                            const includeSetupFee = Boolean(metadata.includeSetupFee)
                            return (
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                                <span className="pill">Applied plan: {appliedTierLabel}</span>
                                <span className="pill">Billing mode: {pricingMode}</span>
                                <span className="pill">Setup fee: {includeSetupFee ? 'included' : 'not included'}</span>
                              </div>
                            )
                          })()}
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 800 }}>Invoice {generatedInvoice.id}</div>
                              <div className="muted" style={{ marginTop: 4 }}>{generatedInvoice.invoiceType} • {generatedInvoice.academicYear || '—'} • {generatedInvoice.termKey || '—'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="pill">{generatedInvoice.status}</div>
                              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 10 }}>{formatNaira(generatedInvoice.totalNaira)}</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                            <div className="panel" style={{ padding: 12 }}>
                              <div className="muted" style={{ fontSize: 12 }}>Applied plan</div>
                              <div style={{ fontWeight: 800, marginTop: 6 }}>{formatInvoicePlanLabel(generatedInvoice, schoolPricingTiers)}</div>
                            </div>
                            <div className="panel" style={{ padding: 12 }}>
                              <div className="muted" style={{ fontSize: 12 }}>Billing mode</div>
                              <div style={{ fontWeight: 800, marginTop: 6 }}>{formatInvoiceBillingMode(generatedInvoice)}</div>
                            </div>
                            <div className="panel" style={{ padding: 12 }}>
                              <div className="muted" style={{ fontSize: 12 }}>Outstanding balance</div>
                              <div style={{ fontWeight: 800, marginTop: 6 }}>{formatNaira(generatedInvoice.balanceNaira)}</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                            {(generatedInvoice.items || []).map((item) => (
                              <div key={item.id} className="panel" style={{ padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                  <div>
                                    <div style={{ fontWeight: 800 }}>{item.label}</div>
                                    <div className="muted" style={{ marginTop: 4 }}>{item.quantity} × {formatNaira(item.unitAmountNaira)} • {item.itemType}</div>
                                  </div>
                                  <div style={{ fontWeight: 800 }}>{formatNaira(item.totalAmountNaira)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                </div>
              ) : null}

              {activeTab === 'website' && selectedSchool ? (
                <WebsiteExperiencePanel
                  selectedSchool={selectedSchool}
                  request={api}
                  resolveAssetUrl={resolveAppUrl}
                  onMessage={setMessage}
                  onError={setError}
                />
              ) : null}

              {activeTab === 'plans' ? (
                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18 }}>
                    <div className="panel" style={{ padding: 22 }}>
                    <SectionTitle title="Subscription plans" subtitle="Current pricing plans available to tenant schools." />
                    <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                      {plans.map((plan, index) => (
                        <div key={plan.id} className="panel" style={{ padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                            <div>
                              <input className="field" value={plan.name} onChange={(event) => setPlans((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} />
                              <textarea className="textarea" value={plan.description} onChange={(event) => setPlans((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value } : entry))} style={{ marginTop: 10 }} />
                            </div>
                            <div style={{ minWidth: 180 }}>
                              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Price (naira)</div>
                              <input className="field" type="number" min={0} value={Math.round(plan.priceCents / 100)} onChange={(event) => setPlans((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, priceCents: Number(event.target.value || 0) * 100 } : entry))} />
                            </div>
                          </div>
                          <textarea className="textarea" value={plan.features.join('\n')} onChange={(event) => setPlans((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, features: event.target.value.split(/\r?\n/).map((feature) => feature.trim()).filter(Boolean) } : entry))} style={{ marginTop: 12 }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="btn btn-primary" onClick={savePricingPlans}>Save plans</button></div>
                    </div>
                    <div className="panel" style={{ padding: 22 }}>
                    <SectionTitle title="Live meeting caps" subtitle="Default live participant caps and upgrade prices are editable here." />
                    {platformSettings ? (
                      <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Default participant cap</div>
                          <input className="field" type="number" min={1} value={platformSettings.liveMeetings.defaultParticipantLimit} onChange={(event) => setPlatformSettings((current) => current ? { ...current, liveMeetings: { ...current.liveMeetings, defaultParticipantLimit: Number(event.target.value || 1) } } : current)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Concurrent live rooms per school</div>
                          <input className="field" type="number" min={1} value={platformSettings.liveMeetings.schoolConcurrentLimit} onChange={(event) => setPlatformSettings((current) => current ? { ...current, liveMeetings: { ...current.liveMeetings, schoolConcurrentLimit: Number(event.target.value || 1) } } : current)} />
                        </label>
                        {platformSettings.liveMeetings.upgradeOptions.map((option, index) => (
                          <div key={`${option.participantLimit}_${index}`} className="panel" style={{ padding: 14 }}>
                            <div style={{ display: 'grid', gap: 10 }}>
                              <input className="field" value={option.label} onChange={(event) => setPlatformSettings((current) => current ? { ...current, liveMeetings: { ...current.liveMeetings, upgradeOptions: current.liveMeetings.upgradeOptions.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry) } } : current)} />
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <input className="field" type="number" min={1} value={option.participantLimit} onChange={(event) => setPlatformSettings((current) => current ? { ...current, liveMeetings: { ...current.liveMeetings, upgradeOptions: current.liveMeetings.upgradeOptions.map((entry, entryIndex) => entryIndex === index ? { ...entry, participantLimit: Number(event.target.value || 1) } : entry) } } : current)} />
                                <input className="field" type="number" min={0} value={option.priceNaira} onChange={(event) => setPlatformSettings((current) => current ? { ...current, liveMeetings: { ...current.liveMeetings, upgradeOptions: current.liveMeetings.upgradeOptions.map((entry, entryIndex) => entryIndex === index ? { ...entry, priceNaira: Number(event.target.value || 0) } : entry) } } : current)} />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={savePlatformSettings}>Save live settings</button></div>
                      </div>
                    ) : <p className="muted" style={{ marginTop: 16 }}>Platform settings are loading.</p>}
                    </div>
                  </div>

                  <div className="panel" style={{ padding: 22 }}>
                    <SectionTitle title="Monetization settings" subtitle="Edit bundles, discount codes, tutor billing, and price increase notices from structured forms." />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                      <button className="btn btn-secondary" onClick={() => appendGeneratedDiscountCode('school-onboarding')}>Generate onboarding code</button>
                      <button className="btn btn-secondary" onClick={() => appendGeneratedDiscountCode('marketplace')}>Generate marketplace code</button>
                      <button className="btn btn-secondary" onClick={() => appendGeneratedDiscountCode('all')}>Generate global code</button>
                    </div>
                    {monetizationSettings ? (
                      <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
                        <div className="panel" style={{ padding: 16 }}>
                          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8' }}>Tutor billing</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 14 }}>
                            <label><div className="muted" style={{ marginBottom: 6 }}>Trial days</div><input className="field" type="number" min={1} value={monetizationSettings.marketplace.tutorBilling.trialDays} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, tutorBilling: { ...current.marketplace.tutorBilling, trialDays: Number(event.target.value || 1) } } }))} /></label>
                            <label><div className="muted" style={{ marginBottom: 6 }}>Monthly fee</div><input className="field" type="number" min={0} value={monetizationSettings.marketplace.tutorBilling.monthlyFeeNaira} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, tutorBilling: { ...current.marketplace.tutorBilling, monthlyFeeNaira: Number(event.target.value || 0) } } }))} /></label>
                            <label><div className="muted" style={{ marginBottom: 6 }}>Included students</div><input className="field" type="number" min={1} value={monetizationSettings.marketplace.tutorBilling.includedStudents} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, tutorBilling: { ...current.marketplace.tutorBilling, includedStudents: Number(event.target.value || 1) } } }))} /></label>
                            <label><div className="muted" style={{ marginBottom: 6 }}>Extra student fee</div><input className="field" type="number" min={0} value={monetizationSettings.marketplace.tutorBilling.extraStudentFeeNaira} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, tutorBilling: { ...current.marketplace.tutorBilling, extraStudentFeeNaira: Number(event.target.value || 0) } } }))} /></label>
                          </div>
                        </div>

                        <div className="panel" style={{ padding: 16 }}>
                          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8' }}>Marketplace bundles</div>
                          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                            {(monetizationSettings.marketplace?.bundles || []).map((bundle: any, index: number) => (
                              <div key={bundle.id} className="panel" style={{ padding: 14 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 0.9fr', gap: 10 }}>
                                  <input className="field" value={bundle.label} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, bundles: current.marketplace.bundles.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, label: event.target.value, updatedAt: new Date().toISOString() } : entry) } }))} />
                                  <input className="field" type="number" min={0} value={bundle.nairaAmount} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, bundles: current.marketplace.bundles.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, nairaAmount: Number(event.target.value || 0), updatedAt: new Date().toISOString() } : entry) } }))} />
                                  <select className="select" value={bundle.category} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, bundles: current.marketplace.bundles.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, category: event.target.value, updatedAt: new Date().toISOString() } : entry) } }))}>
                                    <option value="ai-credits">AI credits</option>
                                    <option value="keyu">Keyu</option>
                                    <option value="tutor-subscription">Tutor subscription</option>
                                  </select>
                                </div>
                                <textarea className="textarea" value={bundle.description} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, bundles: current.marketplace.bundles.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, description: event.target.value, updatedAt: new Date().toISOString() } : entry) } }))} style={{ marginTop: 10 }} />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="panel" style={{ padding: 16 }}>
                          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8' }}>Discount codes</div>
                          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                            {(monetizationSettings.marketplace?.discountCodes || []).map((code: any, index: number) => (
                              <div key={code.id} className="panel" style={{ padding: 14 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr 0.8fr', gap: 10 }}>
                                  <input className="field" value={code.code} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, discountCodes: current.marketplace.discountCodes.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, code: event.target.value.toUpperCase(), updatedAt: new Date().toISOString() } : entry) } }))} />
                                  <input className="field" value={code.description} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, discountCodes: current.marketplace.discountCodes.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, description: event.target.value, updatedAt: new Date().toISOString() } : entry) } }))} />
                                  <input className="field" type="number" min={0} max={100} value={code.percentageOff} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, discountCodes: current.marketplace.discountCodes.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, percentageOff: Number(event.target.value || 0), updatedAt: new Date().toISOString() } : entry) } }))} />
                                  <select className="select" value={code.scope} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, marketplace: { ...current.marketplace, discountCodes: current.marketplace.discountCodes.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, scope: event.target.value, updatedAt: new Date().toISOString() } : entry) } }))}>
                                    <option value="school-onboarding">Onboarding</option>
                                    <option value="marketplace">Marketplace</option>
                                    <option value="all">Global</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="panel" style={{ padding: 16 }}>
                          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8' }}>Price increase notices</div>
                          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                            {(monetizationSettings.priceIncreaseNotices || []).map((notice: any, index: number) => (
                              <div key={notice.id} className="panel" style={{ padding: 14 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 0.8fr 1fr', gap: 10 }}>
                                  <input className="field" value={notice.title} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, priceIncreaseNotices: current.priceIncreaseNotices.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, title: event.target.value, updatedAt: new Date().toISOString() } : entry) }))} />
                                  <input className="field" type="number" min={0} value={notice.currentAmountNaira} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, priceIncreaseNotices: current.priceIncreaseNotices.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, currentAmountNaira: Number(event.target.value || 0), updatedAt: new Date().toISOString() } : entry) }))} />
                                  <input className="field" type="number" min={0} value={notice.newAmountNaira} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, priceIncreaseNotices: current.priceIncreaseNotices.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, newAmountNaira: Number(event.target.value || 0), updatedAt: new Date().toISOString() } : entry) }))} />
                                  <input className="field" type="datetime-local" value={String(notice.effectiveAt || '').slice(0, 16)} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, priceIncreaseNotices: current.priceIncreaseNotices.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, effectiveAt: new Date(event.target.value).toISOString(), updatedAt: new Date().toISOString() } : entry) }))} />
                                </div>
                                <textarea className="textarea" value={notice.message} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, priceIncreaseNotices: current.priceIncreaseNotices.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, message: event.target.value, updatedAt: new Date().toISOString() } : entry) }))} style={{ marginTop: 10 }} />
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10 }}><input type="checkbox" checked={Boolean(notice.active)} onChange={(event) => patchMonetizationSettings((current) => ({ ...current, priceIncreaseNotices: current.priceIncreaseNotices.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, active: event.target.checked, updatedAt: new Date().toISOString() } : entry) }))} /> <span className="muted">Active notice</span></label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : <div className="muted" style={{ marginTop: 16 }}>Monetization settings are loading.</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                      <div className="muted">This editor saves directly to /api/super/monetization/settings. Codes can still be expired or discontinued by editing their active, expiresAt, or discontinuedAt fields in these structured sections later if you extend them.</div>
                      <button className="btn btn-primary" onClick={saveMonetizationSettings}>Save monetization settings</button>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'onboarding' ? (
                <div className="panel" style={{ padding: 22 }}>
                  <SectionTitle title="Onboarding requests" subtitle="Review currently pending school onboarding applications." />
                  <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                    {onboardingRequests.map((request) => (
                      <div key={request.id} className="panel" style={{ padding: 18 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'start', flexWrap: 'wrap' }}>
                          <div style={{ maxWidth: 760 }}>
                            <div style={{ fontSize: 20, fontWeight: 900 }}>{request.school_name}</div>
                            <div className="muted" style={{ marginTop: 6 }}>{request.subdomain}.ndovera.app | {request.owner_name}</div>
                            <div style={{ display: 'grid', gap: 6, marginTop: 12, fontSize: 14 }}>
                              <div><strong>Ndovera email:</strong> {request.owner_ndovera_email}</div>
                              <div><strong>Status:</strong> {request.status}</div>
                              <div><strong>Payment:</strong> {request.payment_status}</div>
                              <div><strong>Updated:</strong> {new Date(request.updated_at || request.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                          <div style={{ minWidth: 220, display: 'grid', gap: 10 }}>
                            <span className="pill">{request.payment_status}</span>
                            <button
                              className="btn btn-primary"
                              disabled={approvingOnboardingId === request.id || !['received', 'verified'].includes(String(request.payment_status || '').toLowerCase()) || String(request.status || '').toLowerCase() === 'approved'}
                              onClick={() => approveOnboardingRequest(request.id)}
                            >
                              {approvingOnboardingId === request.id ? 'Approving...' : String(request.status || '').toLowerCase() === 'approved' ? 'Approved' : 'Approve school'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === 'publicInbox' ? (
                <PublicInboxPanel
                  contactInquiries={contactInquiries}
                  growthApplications={growthApplications}
                  onUpdateStatus={updatePublicInboxStatus}
                />
              ) : null}

              {activeTab === 'ai' ? (
                <div style={{ display: 'grid', gap: 18 }}>
                  <div className="panel" style={{ padding: 22 }}>
                    <SectionTitle title="AI governance" subtitle="View the current AI feature state and usage summary." />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
                      <Stat label="AI features" value={aiSummary.features} />
                      <Stat label="Enabled" value={aiSummary.enabledFeatures} />
                      <Stat label="Usage events" value={aiSummary.usageCount} />
                      <Stat label="Keyu spent" value={aiSummary.keyuSpent} />
                    </div>
                  </div>

                  {platformSettings ? (
                    <div className="panel" style={{ padding: 22 }}>
                      <SectionTitle title="Keyu economy" subtitle="Internal Keyu rates and ad-impression rewards can be updated here." />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Currency name</div>
                          <input className="field" value={platformSettings.economy.currencyName} onChange={(event) => setPlatformSettings((current) => current ? { ...current, economy: { ...current.economy, currencyName: event.target.value } } : current)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Currency symbol</div>
                          <input className="field" value={platformSettings.economy.currencySymbol} onChange={(event) => setPlatformSettings((current) => current ? { ...current, economy: { ...current.economy, currencySymbol: event.target.value } } : current)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Plural label</div>
                          <input className="field" value={platformSettings.economy.currencyPlural} onChange={(event) => setPlatformSettings((current) => current ? { ...current, economy: { ...current.economy, currencyPlural: event.target.value } } : current)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>AI units per naira</div>
                          <input className="field" type="number" min={0.01} step="0.01" value={platformSettings.economy.aiUnitsPerNaira} onChange={(event) => setPlatformSettings((current) => current ? { ...current, economy: { ...current.economy, aiUnitsPerNaira: Number(event.target.value || 0) } } : current)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Cashout naira per unit</div>
                          <input className="field" type="number" min={0} step="0.01" value={platformSettings.economy.cashoutNairaPerUnit} onChange={(event) => setPlatformSettings((current) => current ? { ...current, economy: { ...current.economy, cashoutNairaPerUnit: Number(event.target.value || 0) } } : current)} />
                        </label>
                        <label>
                          <div className="muted" style={{ marginBottom: 6 }}>Reward per complete ad impression</div>
                          <input className="field" type="number" min={0} step="0.01" value={platformSettings.economy.adRewardPerImpression} onChange={(event) => setPlatformSettings((current) => current ? { ...current, economy: { ...current.economy, adRewardPerImpression: Number(event.target.value || 0) } } : current)} />
                        </label>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button className="btn btn-primary" onClick={savePlatformSettings}>Save Keyu settings</button></div>
                    </div>
                  ) : null}

                  <div className="panel" style={{ padding: 22 }}>
                    <SectionTitle title="Feature list" subtitle="These are currently editable only in-memory in this simplified workspace." />
                    <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                      {aiFeatures.map((feature) => (
                        <div key={feature.featureKey} className="panel" style={{ padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 800 }}>{feature.label}</div>
                              <div className="muted" style={{ marginTop: 4 }}>{feature.audience} • {feature.category} • {feature.keyuCost} Keyu</div>
                            </div>
                            <span className="pill">{feature.enabled ? 'Enabled' : 'Disabled'}</span>
                          </div>
                          <p className="muted" style={{ marginTop: 10 }}>{feature.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'identity' ? (
                <IdentityOperationsPanel
                  schools={schools}
                  selectedSchoolId={selectedSchoolId}
                  onSelectSchool={setSelectedSchoolId}
                  onMessage={setMessage}
                  onError={setError}
                  onSchoolsChanged={loadWorkspace}
                />
              ) : null}

              {activeTab === 'championships' ? (
                <ChampionshipControlPanel
                  apiBase={API_BASE}
                  schools={schools.map((school) => ({ id: school.id, name: school.name, subdomain: school.subdomain }))}
                  selectedSchoolId={selectedSchoolId}
                />
              ) : null}

              <div className="panel" style={{ padding: 18 }}>
                <SectionTitle title="Quick summary" subtitle="Read-only snapshot for the selected school and current governance state." />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  <span className="pill">Selected school: {selectedSchool?.name || '—'}</span>
                  <span className="pill">Requests: {onboardingRequests.length}</span>
                  <span className="pill">Public inbox: {contactInquiries.length + growthApplications.length}</span>
                  <span className="pill">AI features: {aiFeatures.length}</span>
                  <span className="pill">System students: {systemMetrics.totals.students}</span>
                  <span className={systemMetrics.inactiveUsers > 0 ? 'pill pill-danger' : 'pill'}>Inactive users: {systemMetrics.inactiveUsers}</span>
                  <span className="pill">System transfers: {systemMetrics.transfers}</span>
                </div>
                <p className="muted" style={{ marginTop: 12 }}>This reduced version keeps the super-admin workspace under the 500-line limit while preserving the main control surfaces.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
