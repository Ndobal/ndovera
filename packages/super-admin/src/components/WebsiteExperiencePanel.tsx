import React, { useEffect, useMemo, useState } from 'react'

type WebsiteSectionType = 'hero' | 'about' | 'admissions' | 'news' | 'contact' | 'features'
type WebsiteSection = { id: string; type: WebsiteSectionType; content: Record<string, any> }
type WebsitePage = { id: string; title: string; slug: string; sections: WebsiteSection[] }
type SchoolWebsite = {
  schoolId: string
  theme: { primaryColor: string; fontFamily: string; logoUrl?: string }
  publicUrl?: string
  contactInfo?: { email?: string; phone?: string; address?: string; city?: string; state?: string; country?: string }
  legal?: {
    privacyPolicy?: { title?: string; body?: string; lastUpdated?: string }
    termsOfService?: { title?: string; body?: string; lastUpdated?: string }
  }
  socialLinks?: { facebook?: string; instagram?: string; linkedin?: string; youtube?: string }
  marketing?: { heroCarouselImages?: string[] }
  pages: WebsitePage[]
}

type SchoolContext = {
  id: string
  name: string
  subdomain: string
  logoUrl?: string
  primaryColor?: string
}

type Props = {
  selectedSchool: SchoolContext
  request: <T>(path: string, options?: RequestInit) => Promise<T>
  resolveAssetUrl: (path: string) => string
  onMessage: (message: string) => void
  onError: (message: string) => void
}

type WebsiteResponse = {
  website: SchoolWebsite | null
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function svgSceneDataUri(title: string, accent: string, depth: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#081018" />
          <stop offset="50%" stop-color="${accent}" />
          <stop offset="100%" stop-color="#10261b" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" />
      <circle cx="1320" cy="160" r="140" fill="rgba(255,255,255,0.18)" />
      <path d="M0 700 C220 610 420 760 620 700 C830 640 1020 520 1260 610 C1390 660 1500 720 1600 760 L1600 900 L0 900 Z" fill="${depth}" />
      <rect x="210" y="320" width="210" height="250" rx="20" fill="rgba(255,255,255,0.16)" />
      <rect x="460" y="260" width="270" height="310" rx="24" fill="rgba(255,255,255,0.2)" />
      <rect x="770" y="340" width="200" height="230" rx="20" fill="rgba(255,255,255,0.15)" />
      <rect x="1010" y="280" width="320" height="290" rx="22" fill="rgba(255,255,255,0.18)" />
      <g fill="rgba(255,255,255,0.42)">
        <rect x="250" y="360" width="36" height="36" rx="8" /><rect x="306" y="360" width="36" height="36" rx="8" /><rect x="250" y="416" width="36" height="36" rx="8" /><rect x="306" y="416" width="36" height="36" rx="8" />
        <rect x="520" y="318" width="42" height="42" rx="8" /><rect x="585" y="318" width="42" height="42" rx="8" /><rect x="650" y="318" width="42" height="42" rx="8" /><rect x="520" y="385" width="42" height="42" rx="8" /><rect x="585" y="385" width="42" height="42" rx="8" /><rect x="650" y="385" width="42" height="42" rx="8" />
        <rect x="1065" y="338" width="42" height="42" rx="8" /><rect x="1130" y="338" width="42" height="42" rx="8" /><rect x="1195" y="338" width="42" height="42" rx="8" /><rect x="1260" y="338" width="42" height="42" rx="8" /><rect x="1065" y="405" width="42" height="42" rx="8" /><rect x="1130" y="405" width="42" height="42" rx="8" /><rect x="1195" y="405" width="42" height="42" rx="8" /><rect x="1260" y="405" width="42" height="42" rx="8" />
      </g>
      <text x="120" y="160" fill="rgba(255,255,255,0.92)" font-size="48" font-family="Verdana, Arial, sans-serif" font-weight="700">${title}</text>
      <text x="120" y="220" fill="rgba(255,255,255,0.68)" font-size="24" font-family="Verdana, Arial, sans-serif">Calm school scenes for the Ndovera home banner</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const ABOUT_US_TEXT = `At Ndovera, we believe every student deserves a fair chance to succeed.

We know that learning is not always easy. Some students feel left behind. Some try their best but still struggle. Others simply need a little more time, support, or encouragement.

Ndovera was created for them and for everyone who believes education should work for all.

Ndovera is more than just a platform. It is a helping hand. We built Ndovera to support students, teachers, and schools in a simple and meaningful way. It helps teachers track progress, guide their students better, and stay organised. It helps students stay focused, practise more, and grow with confidence.

But beyond the technology, Ndovera is about people. It is about the student who stays up late trying to understand a topic. It is about the teacher who wants to do more but has limited tools. It is about the quiet effort, the small improvements, and the big dreams.

We understand that behind every result is a story of effort, hope, and determination. That is why Ndovera is designed to be simple, fair, and supportive. No confusion. No pressure. Just clear tools to help learning happen better.

We are building a future where:
Every student feels seen.
Every teacher feels supported.
Every school can do more with less.

Ndovera is not perfect. But it is honest. And it is built with care.

Because in the end, education is not just about scores. It is about growth, confidence, and believing in what is possible.

That is what Ndovera stands for.`

const VISION_VALUES_TEXT = `Vision Statement
To create a world where every student, no matter their background, has the support, confidence, and opportunity to succeed in learning and in life.

Mission Statement
Our mission is to make learning simpler, fairer, and more supportive by providing tools that help students grow with confidence and help teachers guide with clarity and care.

We aim to remove barriers in education, encourage steady progress, and make every learner feel seen, supported, and capable.

Core Values
1. Care
We believe learning should feel human. Every student and teacher matters, and we design with empathy and understanding.

2. Simplicity
We keep things clear and easy to use, so no one feels confused or overwhelmed.

3. Fairness
Every student deserves a fair chance to succeed, regardless of their starting point.

4. Growth
We value progress over perfection. Small steps forward matter.

5. Support
We stand by both students and teachers, giving them the tools and confidence to do their best.

6. Integrity
We are honest, transparent, and committed to doing what is right.

Tagline
Helping every learner grow

Motto
Learn better. Grow stronger.

Our Promise
We promise to always build with students and teachers in mind.
We promise to keep things simple, honest, and helpful.
And we promise to never forget that behind every screen is a real person trying to learn, improve, and succeed.`

const DEFAULT_PRIVACY_TEXT = `Ndovera keeps only the information needed to help schools manage learning, messages, reports, fees, and public pages.

We ask schools to keep their details correct and to use the platform in a fair and careful way.

If a parent, student, or staff member wants to check, correct, or remove personal details, they should contact the school first. If more help is needed, the school can ask Ndovera support.

We do not aim to confuse anyone with long legal words. We aim to be clear, careful, and respectful.

For privacy questions, contact support@ndovera.com.`

const DEFAULT_TERMS_TEXT = `Ndovera provides clear tools for school work, public pages, communication, and support.

Each school is responsible for the details it shares, the users it adds, and the way it runs its daily work in its own account.

Public forms and applications sent through the website may be reviewed before action is taken.

Restricted areas are only for approved users.

If you need help after using the public website or assistant, contact support@ndovera.com.`

function createDefaultWebsite(school: SchoolContext): SchoolWebsite {
  return {
    schoolId: school.id,
    theme: {
      primaryColor: school.primaryColor || '#10b981',
      fontFamily: 'Verdana',
      logoUrl: school.logoUrl,
    },
    publicUrl: `https://${school.subdomain}.ndovera.com`,
    contactInfo: {
      email: 'support@ndovera.com',
      phone: '+234 800 000 0000',
      city: 'Lagos',
      country: 'Nigeria',
    },
    socialLinks: {
      facebook: '',
      instagram: '',
      linkedin: '',
      youtube: '',
    },
    marketing: {
      heroCarouselImages: [
        svgSceneDataUri('School life, made clearer', '#1f8a70', 'rgba(16, 46, 35, 0.92)'),
        svgSceneDataUri('Parents, staff, and students in step', '#2563eb', 'rgba(16, 30, 60, 0.9)'),
        svgSceneDataUri('One calm place for daily school work', '#d97706', 'rgba(52, 29, 8, 0.92)'),
      ],
    },
    legal: {
      privacyPolicy: { title: 'Privacy Policy', body: DEFAULT_PRIVACY_TEXT, lastUpdated: new Date().toISOString() },
      termsOfService: { title: 'Terms of Service', body: DEFAULT_TERMS_TEXT, lastUpdated: new Date().toISOString() },
    },
    pages: [
      { id: 'home', title: 'Home', slug: 'home', sections: [{ id: makeId('section'), type: 'hero', content: { title: 'School Management Made Clear', subtitle: 'Run your school from one simple, trusted place' } }] },
      { id: 'about-us', title: 'About Us', slug: 'about-us', sections: [{ id: makeId('section'), type: 'about', content: { text: ABOUT_US_TEXT } }] },
      { id: 'vision-values', title: 'Vision & Values', slug: 'vision-values', sections: [{ id: makeId('section'), type: 'about', content: { text: VISION_VALUES_TEXT } }] },
      { id: 'opportunities', title: 'Opportunities', slug: 'opportunities', sections: [] },
      { id: 'events-gallery', title: 'Events Gallery', slug: 'events-gallery', sections: [] },
      { id: 'growth-partners', title: 'Growth Partners', slug: 'growth-partners', sections: [] },
      { id: 'contact-us', title: 'Contact Us', slug: 'contact-us', sections: [] },
      { id: 'privacy-policy', title: 'Privacy Policy', slug: 'privacy-policy', sections: [] },
      { id: 'terms-of-service', title: 'Terms of Service', slug: 'terms-of-service', sections: [] },
    ],
  }
}

function getPageText(website: SchoolWebsite, pageId: string, fallback: string) {
  const page = website.pages.find((entry) => entry.id === pageId || entry.slug === pageId)
  const firstSection = page?.sections?.find((entry) => entry.type === 'about')
  return String(firstSection?.content?.text || fallback)
}

function setPageText(website: SchoolWebsite, pageId: string, text: string) {
  return {
    ...website,
    pages: website.pages.map((page) => {
      if (page.id !== pageId && page.slug !== pageId) return page
      const sectionIndex = page.sections.findIndex((entry) => entry.type === 'about')
      if (sectionIndex < 0) {
        return {
          ...page,
          sections: [...page.sections, { id: makeId('section'), type: 'about', content: { text } }],
        }
      }
      return {
        ...page,
        sections: page.sections.map((section, index) => index === sectionIndex ? { ...section, content: { ...section.content, text } } : section),
      }
    }),
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Image upload failed.'))
    reader.readAsDataURL(file)
  })
}

export function WebsiteExperiencePanel({ selectedSchool, request, resolveAssetUrl, onMessage, onError }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<SchoolWebsite | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    request<WebsiteResponse>(`/api/super/schools/${selectedSchool.id}/website`)
      .then((response) => {
        if (!active) return
        setDraft(response.website || createDefaultWebsite(selectedSchool))
      })
      .catch((error) => {
        if (!active) return
        onError(error instanceof Error ? error.message : 'Could not load website settings.')
        setDraft(createDefaultWebsite(selectedSchool))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [onError, request, selectedSchool])

  const aboutText = useMemo(() => draft ? getPageText(draft, 'about-us', ABOUT_US_TEXT) : ABOUT_US_TEXT, [draft])
  const visionText = useMemo(() => draft ? getPageText(draft, 'vision-values', VISION_VALUES_TEXT) : VISION_VALUES_TEXT, [draft])

  const saveWebsite = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await request(`/api/super/schools/${selectedSchool.id}/website`, {
        method: 'PUT',
        body: JSON.stringify({
          website_config: draft,
          primary_color: draft.theme.primaryColor,
          logo_url: draft.theme.logoUrl || null,
          website_url: draft.publicUrl || null,
        }),
      })
      onMessage('Website settings saved.')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save website settings.')
    } finally {
      setSaving(false)
    }
  }

  const onHeroImagesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'))
    if (!files.length || !draft) return
    try {
      const images = await Promise.all(files.map((file) => fileToDataUrl(file)))
      setDraft({
        ...draft,
        marketing: {
          ...draft.marketing,
          heroCarouselImages: [...(draft.marketing?.heroCarouselImages || []), ...images].slice(0, 8),
        },
      })
      onMessage('Images added to the homepage banner.')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not add images.')
    } finally {
      event.target.value = ''
    }
  }

  if (loading || !draft) {
    return <div className="panel" style={{ padding: 22 }}>Loading website settings…</div>
  }

  const heroImages = draft.marketing?.heroCarouselImages || []

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="panel" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Website experience</h2>
            <p className="muted" style={{ marginTop: 8, maxWidth: 860 }}>
              Update the live public pages, homepage banner images, social links, and clear site wording from one place.
            </p>
          </div>
          <button className="btn btn-primary" onClick={saveWebsite} disabled={saving}>{saving ? 'Saving…' : 'Save website'}</button>
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Brand and contact</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
          <input className="field" value={draft.theme.primaryColor} onChange={(event) => setDraft({ ...draft, theme: { ...draft.theme, primaryColor: event.target.value } })} placeholder="Brand colour" />
          <input className="field" value={draft.theme.fontFamily} onChange={(event) => setDraft({ ...draft, theme: { ...draft.theme, fontFamily: event.target.value } })} placeholder="Font family" />
          <input className="field" value={draft.theme.logoUrl || ''} onChange={(event) => setDraft({ ...draft, theme: { ...draft.theme, logoUrl: event.target.value } })} placeholder="Logo URL" />
          <input className="field" value={draft.contactInfo?.email || ''} onChange={(event) => setDraft({ ...draft, contactInfo: { ...draft.contactInfo, email: event.target.value } })} placeholder="Public email" />
          <input className="field" value={draft.contactInfo?.phone || ''} onChange={(event) => setDraft({ ...draft, contactInfo: { ...draft.contactInfo, phone: event.target.value } })} placeholder="Public phone" />
          <input className="field" value={draft.publicUrl || ''} onChange={(event) => setDraft({ ...draft, publicUrl: event.target.value })} placeholder="Public website URL" />
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Homepage banner images</h3>
            <p className="muted" style={{ marginTop: 8 }}>Upload calm banner images. The live site adds a dark overlay so the main words stay easy to read.</p>
          </div>
          <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Add images
            <input type="file" accept="image/*" multiple onChange={onHeroImagesSelected} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
          {heroImages.map((image, index) => (
            <div key={`${index}_${image.slice(0, 24)}`} className="panel" style={{ padding: 12, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ aspectRatio: '16 / 10', borderRadius: 16, overflow: 'hidden', background: '#0f172a' }}>
                <img src={resolveAssetUrl(image)} alt={`Banner ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 12 }}>Slide {index + 1}</span>
                <button className="btn" onClick={() => setDraft({ ...draft, marketing: { ...draft.marketing, heroCarouselImages: heroImages.filter((_, imageIndex) => imageIndex !== index) } })} style={{ background: 'rgba(239,68,68,0.18)', color: '#fecaca' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Footer social links</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
          <input className="field" value={draft.socialLinks?.facebook || ''} onChange={(event) => setDraft({ ...draft, socialLinks: { ...draft.socialLinks, facebook: event.target.value } })} placeholder="Facebook link" />
          <input className="field" value={draft.socialLinks?.instagram || ''} onChange={(event) => setDraft({ ...draft, socialLinks: { ...draft.socialLinks, instagram: event.target.value } })} placeholder="Instagram link" />
          <input className="field" value={draft.socialLinks?.linkedin || ''} onChange={(event) => setDraft({ ...draft, socialLinks: { ...draft.socialLinks, linkedin: event.target.value } })} placeholder="LinkedIn link" />
          <input className="field" value={draft.socialLinks?.youtube || ''} onChange={(event) => setDraft({ ...draft, socialLinks: { ...draft.socialLinks, youtube: event.target.value } })} placeholder="YouTube link" />
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>About page</h3>
        <textarea className="textarea" value={aboutText} onChange={(event) => setDraft((current) => current ? setPageText(current, 'about-us', event.target.value) : current)} style={{ marginTop: 18, minHeight: 300 }} />
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Vision, values, motto, and promise</h3>
        <textarea className="textarea" value={visionText} onChange={(event) => setDraft((current) => current ? setPageText(current, 'vision-values', event.target.value) : current)} style={{ marginTop: 18, minHeight: 340 }} />
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Legal pages</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
          <textarea className="textarea" value={draft.legal?.privacyPolicy?.body || DEFAULT_PRIVACY_TEXT} onChange={(event) => setDraft({ ...draft, legal: { ...draft.legal, privacyPolicy: { ...(draft.legal?.privacyPolicy || {}), title: 'Privacy Policy', body: event.target.value, lastUpdated: new Date().toISOString() } } })} style={{ minHeight: 240 }} />
          <textarea className="textarea" value={draft.legal?.termsOfService?.body || DEFAULT_TERMS_TEXT} onChange={(event) => setDraft({ ...draft, legal: { ...draft.legal, termsOfService: { ...(draft.legal?.termsOfService || {}), title: 'Terms of Service', body: event.target.value, lastUpdated: new Date().toISOString() } } })} style={{ minHeight: 240 }} />
        </div>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Public page list</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          {draft.pages.map((page) => <span key={page.id} className="pill">{page.title}</span>)}
        </div>
      </div>
    </div>
  )
}