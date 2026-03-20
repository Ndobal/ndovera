import React, { useEffect, useMemo, useState } from 'react'

type WebsiteSectionType = 'hero' | 'about' | 'admissions' | 'news' | 'contact' | 'features'

type WebsiteSection = {
  id: string
  type: WebsiteSectionType
  content: Record<string, any>
}

type WebsitePage = {
  id: string
  title: string
  slug: string
  sections: WebsiteSection[]
}

type SchoolWebsite = {
  schoolId: string
  theme: {
    primaryColor: string
    fontFamily: string
    logoUrl?: string
  }
  pages: WebsitePage[]
}

type SchoolRecord = {
  id: string
  name: string
  subdomain: string
  logoUrl?: string
  primaryColor?: string
  liveClassQuota: number
  pageCount: number
  website: SchoolWebsite | null
  createdAt: string
}

type PricingPlan = {
  id: string
  name: string
  description: string
  priceCents: number
  billingInterval: string
  features: string[]
}

const API_BASE = (import.meta as any)?.env?.VITE_SUPER_ADMIN_API_URL || 'http://localhost:5001'

const makeId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`

const createDefaultWebsite = (school: Pick<SchoolRecord, 'id' | 'name' | 'primaryColor' | 'logoUrl'>): SchoolWebsite => ({
  schoolId: school.id,
  theme: {
    primaryColor: school.primaryColor || '#10b981',
    fontFamily: 'Inter',
    logoUrl: school.logoUrl,
  },
  pages: [
    {
      id: makeId('page'),
      title: 'Home',
      slug: 'home',
      sections: [
        {
          id: makeId('section'),
          type: 'hero',
          content: {
            title: `Welcome to ${school.name}`,
            subtitle: 'A modern school website that can be edited without code.',
            cta: 'Apply now',
          },
        },
        {
          id: makeId('section'),
          type: 'about',
          content: {
            text: `${school.name} can now manage admissions messaging, school highlights, and public-facing content from the super-admin workspace.`,
          },
        },
      ],
    },
  ],
})

const ensureWebsite = (school: SchoolRecord | null): SchoolWebsite | null => {
  if (!school) return null
  return school.website || createDefaultWebsite(school)
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const storedId = localStorage.getItem('ndovera_super_admin_id') || 'sa_1'
  const storedRole = localStorage.getItem('ndovera_super_admin_role') || 'Super Admin'
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json')
  headers.set('x-super-user-id', storedId)
  headers.set('x-super-user-roles', storedRole)
  headers.set('x-super-active-role', storedRole)

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Request failed')
  return payload as T
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'schools' | 'website' | 'plans'>('schools')
  const [schools, setSchools] = useState<SchoolRecord[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [quotaDraft, setQuotaDraft] = useState<number>(5)
  const [websiteDraft, setWebsiteDraft] = useState<SchoolWebsite | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string>('')
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [planForm, setPlanForm] = useState({ name: '', description: '', priceCents: '0', billingInterval: 'monthly', features: '5 live classrooms\nWebsite builder\nCore operations' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedSchool = useMemo(() => schools.find((school) => school.id === selectedSchoolId) || null, [schools, selectedSchoolId])
  const activePage = useMemo(() => websiteDraft?.pages.find((page) => page.id === selectedPageId) || websiteDraft?.pages[0] || null, [selectedPageId, websiteDraft])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [schoolsResp, plansResp] = await Promise.all([
        api<{ schools: SchoolRecord[] }>('/api/super/schools'),
        api<{ plans: PricingPlan[] }>('/api/super/pricing-plans'),
      ])
      setSchools(schoolsResp.schools)
      setPlans(plansResp.plans)
      const firstSchoolId = schoolsResp.schools[0]?.id || ''
      setSelectedSchoolId((current) => current || firstSchoolId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!selectedSchool) return
    setQuotaDraft(selectedSchool.liveClassQuota || 5)
    const website = ensureWebsite(selectedSchool)
    setWebsiteDraft(website)
    setSelectedPageId(website?.pages[0]?.id || '')
  }, [selectedSchool])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 3000)
    return () => window.clearTimeout(timer)
  }, [message])

  const updateWebsite = (updater: (current: SchoolWebsite) => SchoolWebsite) => {
    setWebsiteDraft((current) => current ? updater(current) : current)
  }

  const addPage = () => {
    if (!websiteDraft) return
    const page: WebsitePage = { id: makeId('page'), title: 'New Page', slug: 'new-page', sections: [] }
    updateWebsite((current) => ({ ...current, pages: [...current.pages, page] }))
    setSelectedPageId(page.id)
  }

  const deletePage = (pageId: string) => {
    if (!websiteDraft || websiteDraft.pages.length <= 1) return
    const nextPages = websiteDraft.pages.filter((page) => page.id !== pageId)
    updateWebsite((current) => ({ ...current, pages: nextPages }))
    setSelectedPageId(nextPages[0]?.id || '')
  }

  const addSection = (type: WebsiteSectionType) => {
    if (!activePage) return
    const section: WebsiteSection = {
      id: makeId('section'),
      type,
      content: type === 'about' ? { text: 'Add a concise description here.' } : { title: 'Section title', subtitle: 'Section subtitle', text: 'Section body' },
    }
    updateWebsite((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? { ...page, sections: [...page.sections, section] } : page),
    }))
  }

  const updateSection = (sectionId: string, key: string, value: string) => {
    if (!activePage) return
    updateWebsite((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? {
        ...page,
        sections: page.sections.map((section) => section.id === sectionId ? { ...section, content: { ...section.content, [key]: value } } : section),
      } : page),
    }))
  }

  const removeSection = (sectionId: string) => {
    if (!activePage) return
    updateWebsite((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === activePage.id ? { ...page, sections: page.sections.filter((section) => section.id !== sectionId) } : page),
    }))
  }

  const saveQuota = async () => {
    if (!selectedSchool) return
    setSaving('quota')
    setError('')
    try {
      await api(`/api/super/schools/${selectedSchool.id}/live-settings`, { method: 'PATCH', body: JSON.stringify({ liveClassQuota: quotaDraft }) })
      setSchools((current) => current.map((school) => school.id === selectedSchool.id ? { ...school, liveClassQuota: quotaDraft } : school))
      setMessage('Live classroom quota updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save live classroom quota.')
    } finally {
      setSaving(null)
    }
  }

  const saveWebsite = async () => {
    if (!selectedSchool || !websiteDraft) return
    setSaving('website')
    setError('')
    try {
      await api(`/api/super/schools/${selectedSchool.id}/website`, {
        method: 'PUT',
        body: JSON.stringify({ website: websiteDraft, primaryColor: websiteDraft.theme.primaryColor, logoUrl: websiteDraft.theme.logoUrl || null }),
      })
      setSchools((current) => current.map((school) => school.id === selectedSchool.id ? { ...school, primaryColor: websiteDraft.theme.primaryColor, logoUrl: websiteDraft.theme.logoUrl, website: websiteDraft, pageCount: websiteDraft.pages.length } : school))
      setMessage('Website builder changes saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save website.')
    } finally {
      setSaving(null)
    }
  }

  const createPlan = async () => {
    setSaving('plan')
    setError('')
    try {
      await api('/api/super/pricing-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: planForm.name,
          description: planForm.description,
          priceCents: Number(planForm.priceCents),
          billingInterval: planForm.billingInterval,
          features: planForm.features.split('\n').map((item) => item.trim()).filter(Boolean),
        }),
      })
      setPlanForm({ name: '', description: '', priceCents: '0', billingInterval: 'monthly', features: '' })
      const refreshed = await api<{ plans: PricingPlan[] }>('/api/super/pricing-plans')
      setPlans(refreshed.plans)
      setMessage('Pricing plan created.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create pricing plan.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#081018', color: '#e5eef6', fontFamily: 'Inter, Segoe UI, sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        button, input, select, textarea { font: inherit; }
        .panel { background: rgba(15, 23, 42, 0.88); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.18); }
        .muted { color: #94a3b8; }
        .pill { padding: 6px 10px; border-radius: 999px; background: rgba(148, 163, 184, 0.12); color: #cbd5e1; font-size: 12px; font-weight: 700; }
        .field, .textarea, .select { width: 100%; border-radius: 14px; border: 1px solid rgba(148,163,184,0.2); background: rgba(15, 23, 42, 0.9); color: white; padding: 12px 14px; }
        .textarea { min-height: 92px; resize: vertical; }
        .btn { border: 0; border-radius: 14px; padding: 12px 16px; font-weight: 800; cursor: pointer; }
        .btn-primary { background: linear-gradient(135deg, #10b981, #06b6d4); color: white; }
        .btn-secondary { background: rgba(255,255,255,0.06); color: white; }
        .btn-danger { background: rgba(239,68,68,0.15); color: #fecaca; }
      `}</style>

      <div style={{ maxWidth: 1500, margin: '0 auto', padding: 24 }}>
        <div className="panel" style={{ padding: 24, marginBottom: 20, background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.12), rgba(15,23,42,0.95))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>Super Admin Control Center</h1>
              <p className="muted" style={{ marginTop: 8, maxWidth: 760 }}>
                Manage per-school live classroom quotas, create new subscription plans, and run a no-code website builder for any tenant school without touching source files.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <span className="pill">Tenant live quota control</span>
                <span className="pill">No-code website editing</span>
                <span className="pill">Pricing plan creation</span>
              </div>
            </div>
            <div style={{ minWidth: 280, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div className="panel" style={{ padding: 16 }}>
                <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Schools</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{schools.length}</div>
              </div>
              <div className="panel" style={{ padding: 16 }}>
                <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Plans</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{plans.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            ['schools', 'School controls'],
            ['website', 'Website builder'],
            ['plans', 'Pricing plans'],
          ].map(([key, label]) => (
            <button key={key} className="btn" style={{ background: activeTab === key ? '#10b981' : 'rgba(255,255,255,0.06)', color: 'white' }} onClick={() => setActiveTab(key as 'schools' | 'website' | 'plans')}>
              {label}
            </button>
          ))}
          <button className="btn btn-secondary" onClick={loadData}>Refresh</button>
        </div>

        {message ? <div className="panel" style={{ padding: 14, marginBottom: 12, borderColor: 'rgba(16,185,129,0.45)', color: '#bbf7d0' }}>{message}</div> : null}
        {error ? <div className="panel" style={{ padding: 14, marginBottom: 12, borderColor: 'rgba(239,68,68,0.45)', color: '#fecaca' }}>{error}</div> : null}

        {loading ? <div className="panel" style={{ padding: 24 }}>Loading super-admin workspace…</div> : null}

        {!loading && (
          <div style={{ display: 'grid', gap: 18, gridTemplateColumns: activeTab === 'plans' ? '1fr' : '320px 1fr' }}>
            {activeTab !== 'plans' && (
              <div className="panel" style={{ padding: 18, alignSelf: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Tenant Schools</h2>
                  <span className="pill">{schools.length}</span>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {schools.map((school) => (
                    <button key={school.id} className="btn" onClick={() => setSelectedSchoolId(school.id)} style={{ textAlign: 'left', background: selectedSchoolId === school.id ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.03)', color: 'white', padding: 14 }}>
                      <div style={{ fontWeight: 800 }}>{school.name}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{school.subdomain}.ndovera.com</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <span className="pill">Quota: {school.liveClassQuota}</span>
                        <span className="pill">Pages: {school.pageCount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'schools' && selectedSchool && (
              <div className="panel" style={{ padding: 22 }}>
                <h2 style={{ marginTop: 0 }}>{selectedSchool.name}</h2>
                <p className="muted">Set per-school live classroom limits without code. This quota is now used by the school backend when teachers create live rooms.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 18 }}>
                  <div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Subdomain</div><div style={{ fontWeight: 800, marginTop: 8 }}>{selectedSchool.subdomain}</div></div>
                  <div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Current quota</div><div style={{ fontWeight: 800, marginTop: 8 }}>{selectedSchool.liveClassQuota} live rooms</div></div>
                  <div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Website pages</div><div style={{ fontWeight: 800, marginTop: 8 }}>{selectedSchool.pageCount}</div></div>
                </div>

                <div className="panel" style={{ padding: 18, marginTop: 18 }}>
                  <h3 style={{ marginTop: 0 }}>Live classroom quota</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 12, alignItems: 'center' }}>
                    <input className="field" type="number" min={1} max={100} value={quotaDraft} onChange={(event) => setQuotaDraft(Number(event.target.value))} />
                    <p className="muted" style={{ margin: 0 }}>Increase or reduce the tenant-wide number of simultaneous live classrooms. This supports plan-based scaling for thousands of schools.</p>
                    <button className="btn btn-primary" onClick={saveQuota} disabled={saving === 'quota'}>{saving === 'quota' ? 'Saving…' : 'Save quota'}</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'website' && selectedSchool && websiteDraft && (
              <div style={{ display: 'grid', gap: 18 }}>
                <div className="panel" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <div>
                      <h2 style={{ marginTop: 0, marginBottom: 8 }}>No-code Website Builder</h2>
                      <p className="muted" style={{ margin: 0 }}>The super admin or assigned publishing role can update branding, pages, and sections without touching code.</p>
                    </div>
                    <button className="btn btn-primary" onClick={saveWebsite} disabled={saving === 'website'}>{saving === 'website' ? 'Saving…' : 'Save website'}</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
                    <input className="field" value={websiteDraft.theme.primaryColor} onChange={(event) => updateWebsite((current) => ({ ...current, theme: { ...current.theme, primaryColor: event.target.value } }))} placeholder="#10b981" />
                    <input className="field" value={websiteDraft.theme.fontFamily} onChange={(event) => updateWebsite((current) => ({ ...current, theme: { ...current.theme, fontFamily: event.target.value } }))} placeholder="Inter" />
                    <input className="field" value={websiteDraft.theme.logoUrl || ''} onChange={(event) => updateWebsite((current) => ({ ...current, theme: { ...current.theme, logoUrl: event.target.value } }))} placeholder="Logo URL" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr 1fr', gap: 18 }}>
                  <div className="panel" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <h3 style={{ margin: 0 }}>Pages</h3>
                      <button className="btn btn-secondary" onClick={addPage}>Add page</button>
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {websiteDraft.pages.map((page) => (
                        <div key={page.id} className="panel" style={{ padding: 12, borderColor: selectedPageId === page.id ? 'rgba(16,185,129,0.45)' : 'rgba(148,163,184,0.15)' }}>
                          <button className="btn" onClick={() => setSelectedPageId(page.id)} style={{ width: '100%', textAlign: 'left', background: 'transparent', color: 'white', padding: 0 }}>
                            <div style={{ fontWeight: 800 }}>{page.title}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>/{page.slug}</div>
                          </button>
                          <button className="btn btn-danger" style={{ marginTop: 10, width: '100%' }} onClick={() => deletePage(page.id)}>Delete page</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="panel" style={{ padding: 18 }}>
                    <h3 style={{ marginTop: 0 }}>Page setup</h3>
                    {activePage ? (
                      <>
                        <label className="muted">Page title</label>
                        <input className="field" value={activePage.title} onChange={(event) => updateWebsite((current) => ({ ...current, pages: current.pages.map((page) => page.id === activePage.id ? { ...page, title: event.target.value } : page) }))} />
                        <label className="muted" style={{ display: 'block', marginTop: 12 }}>Page slug</label>
                        <input className="field" value={activePage.slug} onChange={(event) => updateWebsite((current) => ({ ...current, pages: current.pages.map((page) => page.id === activePage.id ? { ...page, slug: event.target.value } : page) }))} />

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                          {(['hero', 'about', 'features', 'admissions', 'news', 'contact'] as WebsiteSectionType[]).map((type) => (
                            <button key={type} className="btn btn-secondary" onClick={() => addSection(type)}>Add {type}</button>
                          ))}
                        </div>

                        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                          {activePage.sections.map((section) => (
                            <div key={section.id} className="panel" style={{ padding: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <strong style={{ textTransform: 'capitalize' }}>{section.type} section</strong>
                                <button className="btn btn-danger" onClick={() => removeSection(section.id)}>Remove</button>
                              </div>
                              <input className="field" value={section.content.title || ''} onChange={(event) => updateSection(section.id, 'title', event.target.value)} placeholder="Title" />
                              <input className="field" style={{ marginTop: 8 }} value={section.content.subtitle || ''} onChange={(event) => updateSection(section.id, 'subtitle', event.target.value)} placeholder="Subtitle" />
                              <textarea className="textarea" style={{ marginTop: 8 }} value={section.content.text || ''} onChange={(event) => updateSection(section.id, 'text', event.target.value)} placeholder="Section text / content" />
                              <input className="field" style={{ marginTop: 8 }} value={section.content.cta || ''} onChange={(event) => updateSection(section.id, 'cta', event.target.value)} placeholder="CTA label" />
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <p className="muted">Select a page to edit it.</p>}
                  </div>

                  <div className="panel" style={{ padding: 18 }}>
                    <h3 style={{ marginTop: 0 }}>Live preview data</h3>
                    <div style={{ borderRadius: 18, padding: 18, background: '#ffffff', color: '#0f172a', minHeight: 520 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 20 }}>
                        <div style={{ fontWeight: 900, color: websiteDraft.theme.primaryColor }}>{selectedSchool.name}</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {websiteDraft.pages.map((page) => (
                            <span key={page.id} style={{ fontWeight: activePage?.id === page.id ? 800 : 500, color: activePage?.id === page.id ? websiteDraft.theme.primaryColor : '#64748b' }}>{page.title}</span>
                          ))}
                        </div>
                      </div>
                      {activePage?.sections.map((section) => (
                        <div key={section.id} style={{ marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.18em', color: websiteDraft.theme.primaryColor, marginBottom: 6 }}>{section.type}</div>
                          {section.content.title ? <h4 style={{ margin: '0 0 8px 0', fontSize: 24 }}>{section.content.title}</h4> : null}
                          {section.content.subtitle ? <p style={{ margin: '0 0 8px 0', color: '#475569', fontWeight: 600 }}>{section.content.subtitle}</p> : null}
                          {section.content.text ? <p style={{ margin: 0, color: '#334155', lineHeight: 1.7 }}>{section.content.text}</p> : null}
                          {section.content.cta ? <button className="btn" style={{ marginTop: 12, background: websiteDraft.theme.primaryColor, color: 'white' }}>{section.content.cta}</button> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'plans' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18 }}>
                <div className="panel" style={{ padding: 22 }}>
                  <h2 style={{ marginTop: 0 }}>Subscription plans</h2>
                  <p className="muted">Create plans from the dashboard instead of changing code. These can later drive quota presets and feature bundles.</p>
                  <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                    {plans.map((plan) => (
                      <div key={plan.id} className="panel" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 18 }}>{plan.name}</div>
                            <div className="muted" style={{ marginTop: 6 }}>{plan.description}</div>
                          </div>
                          <div style={{ fontWeight: 900, fontSize: 18 }}>₦{(plan.priceCents / 100).toLocaleString()}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                          {plan.features.map((feature) => <span key={feature} className="pill">{feature}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" style={{ padding: 22 }}>
                  <h2 style={{ marginTop: 0 }}>Create a new plan</h2>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <input className="field" placeholder="Plan name" value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} />
                    <textarea className="textarea" placeholder="Description" value={planForm.description} onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))} />
                    <input className="field" type="number" placeholder="Price in kobo / cents" value={planForm.priceCents} onChange={(event) => setPlanForm((current) => ({ ...current, priceCents: event.target.value }))} />
                    <select className="select" value={planForm.billingInterval} onChange={(event) => setPlanForm((current) => ({ ...current, billingInterval: event.target.value }))}>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                    <textarea className="textarea" placeholder="One feature per line" value={planForm.features} onChange={(event) => setPlanForm((current) => ({ ...current, features: event.target.value }))} />
                    <button className="btn btn-primary" onClick={createPlan} disabled={saving === 'plan'}>{saving === 'plan' ? 'Creating…' : 'Create plan'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
