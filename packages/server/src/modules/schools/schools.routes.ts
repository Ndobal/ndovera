import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';

import { getSchoolProfile, upsertSchoolProfile } from './schoolProfile.store.js';
import { loadIdentityState } from '../../../../../identity-state.js';

export const schoolsRouter = Router();

const saveWebsiteSchema = z.object({
  school_id: z.string().trim().min(1).optional(),
  website_config: z.record(z.unknown()),
  primary_color: z.string().trim().min(4).max(32).optional().nullable(),
  logo_url: z.string().trim().min(1).optional().nullable(),
  website_url: z.string().trim().min(1).optional().nullable(),
});

const testimonialBaseSchema = z.object({
  author: z.string().trim().min(1).max(120).optional().or(z.literal('')),
  role: z.string().trim().max(120).optional().or(z.literal('')),
  quote: z.string().trim().max(600).optional().or(z.literal('')),
  originalComment: z.string().trim().max(2000).optional().or(z.literal('')),
  profilePhotoUrl: z.string().trim().max(1024).optional().or(z.literal('')),
  featured: z.boolean().optional(),
  sourceUserId: z.string().trim().max(120).optional().or(z.literal('')),
  sourceType: z.enum(['manual', 'user-remark']).optional(),
});

const testimonialSchema = testimonialBaseSchema.refine((value) => Boolean(String(value.quote || '').trim() || String(value.originalComment || '').trim()), {
  message: 'quote or originalComment is required',
  path: ['quote'],
});

const testimonialUpdateSchema = testimonialBaseSchema.partial().extend({
  featured: z.boolean().optional(),
});

type WebsiteTestimonialRecord = {
  id: string;
  author: string;
  role: string | null;
  quote: string;
  originalComment: string | null;
  profilePhotoUrl: string | null;
  featured: boolean;
  sourceUserId: string | null;
  sourceType: 'manual' | 'user-remark';
  createdAt: string;
  updatedAt: string;
};

type PublicVacancyRecord = {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string;
  salary: string | null;
  schoolName: string | null;
};

const DEFAULT_PRIVACY_POLICY = `Ndovera keeps only the information needed to help schools manage learning, messages, reports, fees, and public pages.

We ask schools to keep their details correct and to use the platform in a fair and careful way.

If a parent, student, or staff member wants to check, correct, or remove personal details, they should contact the school first. If more help is needed, the school can ask Ndovera support.

We aim to be clear, careful, and respectful.

For privacy questions, contact support@ndovera.com.`;

const DEFAULT_TERMS_OF_SERVICE = `Ndovera provides clear tools for school work, public pages, communication, and support.

Each school is responsible for the details it shares, the users it adds, and the way it runs its daily work in its own account.

Public forms and applications sent through this website may be reviewed before action is taken.

Restricted areas are only for approved users.

If you need help after using the public website or assistant, contact support@ndovera.com.`;

function nowIso() {
  return new Date().toISOString();
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function buildFeaturedQuote(originalComment: string | null, quote: string | null) {
  const original = normalizeOptionalText(originalComment);
  if (original) {
    return original.length <= 220 ? original : `${original.slice(0, 217).trimEnd()}...`;
  }
  return normalizeOptionalText(quote) || '';
}

function readTestimonialsFromWebsiteConfig(websiteConfig: Record<string, unknown> | null | undefined) {
  const list = (websiteConfig as { testimonials?: unknown } | null | undefined)?.testimonials;
  if (!Array.isArray(list)) return [] as WebsiteTestimonialRecord[];
  return list
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const originalComment = normalizeOptionalText(record.originalComment);
      const quote = buildFeaturedQuote(originalComment, normalizeOptionalText(record.quote));
      if (!quote) return null;
      return {
        id: normalizeOptionalText(record.id) || `testimonial_${crypto.randomUUID()}`,
        author: normalizeOptionalText(record.author) || 'Ndovera user',
        role: normalizeOptionalText(record.role),
        quote,
        originalComment,
        profilePhotoUrl: normalizeOptionalText(record.profilePhotoUrl),
        featured: Boolean(record.featured),
        sourceUserId: normalizeOptionalText(record.sourceUserId),
        sourceType: record.sourceType === 'user-remark' ? 'user-remark' : 'manual',
        createdAt: normalizeOptionalText(record.createdAt) || nowIso(),
        updatedAt: normalizeOptionalText(record.updatedAt) || nowIso(),
      };
    })
    .filter((entry): entry is WebsiteTestimonialRecord => Boolean(entry));
}

function withTestimonials(websiteConfig: Record<string, unknown> | null | undefined, testimonials: WebsiteTestimonialRecord[]) {
  const current = websiteConfig && typeof websiteConfig === 'object' ? websiteConfig : {};
  return {
    ...current,
    testimonials,
  };
}

function toWebsiteConfigObject(websiteConfig: Record<string, unknown> | null | undefined) {
  return websiteConfig && typeof websiteConfig === 'object' ? websiteConfig : {};
}

function normalizeWebsitePages(websiteConfig: Record<string, unknown>) {
  return Array.isArray(websiteConfig.pages) ? websiteConfig.pages : [];
}

function normalizeWebsiteContactInfo(websiteConfig: Record<string, unknown>) {
  const contactInfo = websiteConfig.contactInfo;
  return contactInfo && typeof contactInfo === 'object' ? contactInfo : {};
}

function normalizeWebsiteSocialLinks(websiteConfig: Record<string, unknown>) {
  const socialLinks = websiteConfig.socialLinks;
  return socialLinks && typeof socialLinks === 'object' ? socialLinks : {};
}

function normalizeWebsiteMarketing(websiteConfig: Record<string, unknown>) {
  const marketing = websiteConfig.marketing && typeof websiteConfig.marketing === 'object' ? websiteConfig.marketing as Record<string, unknown> : {};
  return {
    heroCarouselImages: Array.isArray(marketing.heroCarouselImages)
      ? marketing.heroCarouselImages.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
      : [],
    eventGalleryItems: Array.isArray(marketing.eventGalleryItems)
      ? marketing.eventGalleryItems
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map((entry) => ({
          id: normalizeOptionalText(entry.id) || `gallery_${crypto.randomUUID()}`,
          title: normalizeOptionalText(entry.title) || 'Ndovera event',
          caption: normalizeOptionalText(entry.caption),
          mediaType: normalizeOptionalText(entry.mediaType) || 'image',
          url: normalizeOptionalText(entry.url) || '',
        }))
        .filter((entry) => Boolean(entry.url))
      : [],
  };
}

function normalizeWebsiteLegal(websiteConfig: Record<string, unknown>) {
  const legal = websiteConfig.legal && typeof websiteConfig.legal === 'object' ? websiteConfig.legal as Record<string, unknown> : {};
  const privacyPolicy = legal.privacyPolicy && typeof legal.privacyPolicy === 'object' ? legal.privacyPolicy as Record<string, unknown> : {};
  const termsOfService = legal.termsOfService && typeof legal.termsOfService === 'object' ? legal.termsOfService as Record<string, unknown> : {};
  return {
    privacyPolicy: {
      title: normalizeOptionalText(privacyPolicy.title) || 'Privacy Policy',
      body: normalizeOptionalText(privacyPolicy.body) || DEFAULT_PRIVACY_POLICY,
      lastUpdated: normalizeOptionalText(privacyPolicy.lastUpdated) || nowIso(),
    },
    termsOfService: {
      title: normalizeOptionalText(termsOfService.title) || 'Terms of Service',
      body: normalizeOptionalText(termsOfService.body) || DEFAULT_TERMS_OF_SERVICE,
      lastUpdated: normalizeOptionalText(termsOfService.lastUpdated) || nowIso(),
    },
  };
}

function readVacanciesFromWebsiteConfig(websiteConfig: Record<string, unknown> | null | undefined) {
  const config = toWebsiteConfigObject(websiteConfig);
  const list = Array.isArray(config.vacancies) ? config.vacancies : [];
  return list
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const title = normalizeOptionalText(record.title);
      const description = normalizeOptionalText(record.description);
      if (!title || !description) return null;
      return {
        id: normalizeOptionalText(record.id) || `vacancy_${crypto.randomUUID()}`,
        title,
        description,
        type: normalizeOptionalText(record.type) || 'Open',
        category: normalizeOptionalText(record.category) || 'General',
        salary: normalizeOptionalText(record.salary) || null,
        schoolName: normalizeOptionalText(record.schoolName) || null,
      } satisfies PublicVacancyRecord;
    })
    .filter((entry): entry is PublicVacancyRecord => Boolean(entry));
}

function buildPublicWebsitePayload(schoolId: string, profile: Awaited<ReturnType<typeof getSchoolProfile>>) {
  const websiteConfig = toWebsiteConfigObject(profile?.websiteConfig);
  const theme = websiteConfig.theme && typeof websiteConfig.theme === 'object' ? websiteConfig.theme as Record<string, unknown> : {};
  return {
    schoolId,
    theme: {
      primaryColor: normalizeOptionalText(theme.primaryColor) || profile?.primaryColor || '#10b981',
      fontFamily: normalizeOptionalText(theme.fontFamily) || 'Inter',
      logoUrl: normalizeOptionalText(theme.logoUrl) || profile?.logoUrl || null,
      templateVariant: normalizeOptionalText(theme.templateVariant) || 'signature',
    },
    publicUrl: normalizeOptionalText(websiteConfig.publicUrl) || profile?.websiteUrl || null,
    pages: normalizeWebsitePages(websiteConfig),
    contactInfo: normalizeWebsiteContactInfo(websiteConfig),
    socialLinks: normalizeWebsiteSocialLinks(websiteConfig),
    marketing: normalizeWebsiteMarketing(websiteConfig),
    legal: normalizeWebsiteLegal(websiteConfig),
  };
}

function buildShowcaseLocation(contactInfo: Record<string, unknown>) {
	return [
		normalizeOptionalText(contactInfo.city),
		normalizeOptionalText(contactInfo.state),
		normalizeOptionalText(contactInfo.country),
	].filter(Boolean).join(', ');
}

schoolsRouter.get('/website', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const schoolId = String(req.query.school_id || user.school_id || '').trim();
  if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
  if (schoolId !== String(user.school_id || '').trim()) return res.status(403).json({ error: 'Forbidden' });

  const profile = await getSchoolProfile(schoolId);
  return res.json({
    ok: true,
    schoolId,
    profile,
    website: profile?.websiteConfig || null,
  });
});

schoolsRouter.post('/website', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const parsed = saveWebsiteSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid website payload.' });

  const schoolId = String(parsed.data.school_id || user.school_id || '').trim();
  if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
  if (schoolId !== String(user.school_id || '').trim()) return res.status(403).json({ error: 'Forbidden' });

  const profile = await upsertSchoolProfile({
    schoolId,
    websiteConfig: parsed.data.website_config,
    primaryColor: parsed.data.primary_color,
    logoUrl: parsed.data.logo_url,
    websiteUrl: parsed.data.website_url,
  });

  return res.json({
    ok: true,
    schoolId,
    profile,
    website: profile.websiteConfig,
  });
});

schoolsRouter.get('/showcase', async (_req, res) => {
  const state = await loadIdentityState();
  const schools = await Promise.all(state.schools.map(async (school) => {
    const profile = await getSchoolProfile(school.id);
    const website = buildPublicWebsitePayload(school.id, profile);
    return {
      id: school.id,
      name: school.name,
      subdomain: school.subdomain,
      logoUrl: website.theme.logoUrl,
      primaryColor: website.theme.primaryColor,
      location: buildShowcaseLocation(website.contactInfo as Record<string, unknown>),
    };
  }));
  return res.json({ ok: true, schools });
});

schoolsRouter.get('/by-subdomain/:subdomain/website', async (req, res) => {
  const subdomain = String(req.params.subdomain || '').trim().toLowerCase();
  if (!subdomain) return res.status(400).json({ error: 'subdomain is required' });
  const state = await loadIdentityState();
  const school = state.schools.find((entry) => entry.subdomain.trim().toLowerCase() === subdomain) || null;
  if (!school) return res.status(404).json({ error: 'School not found for subdomain.' });
  const profile = await getSchoolProfile(school.id);
  return res.json({
    ok: true,
    schoolId: school.id,
    school: {
      id: school.id,
      name: school.name,
      subdomain: school.subdomain,
    },
    website: buildPublicWebsitePayload(school.id, profile),
  });
});

schoolsRouter.get('/:schoolId/website', async (req, res) => {
  const schoolId = String(req.params.schoolId || '').trim();
  if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
  const profile = await getSchoolProfile(schoolId);
  return res.json({
    ok: true,
    schoolId,
    website: buildPublicWebsitePayload(schoolId, profile),
  });
});

schoolsRouter.get('/:schoolId/vacancies', async (req, res) => {
  const schoolId = String(req.params.schoolId || '').trim();
  if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
  const profile = await getSchoolProfile(schoolId);
  return res.json({
    ok: true,
    schoolId,
    vacancies: readVacanciesFromWebsiteConfig(profile?.websiteConfig),
  });
});

schoolsRouter.get('/:schoolId/testimonials', async (req, res) => {
  const schoolId = String(req.params.schoolId || '').trim();
  if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
  const profile = await getSchoolProfile(schoolId);
  const testimonials = readTestimonialsFromWebsiteConfig(profile?.websiteConfig);
  return res.json({ testimonials });
});

schoolsRouter.post('/:schoolId/testimonials', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });
  const schoolId = String(req.params.schoolId || '').trim();
  if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
  if (schoolId !== String(user.school_id || '').trim()) return res.status(403).json({ error: 'Forbidden' });
  const parsed = testimonialSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid testimonial payload.' });

  const profile = await getSchoolProfile(schoolId);
  const testimonials = readTestimonialsFromWebsiteConfig(profile?.websiteConfig);
  const originalComment = normalizeOptionalText(parsed.data.originalComment);
  const testimonial: WebsiteTestimonialRecord = {
    id: `testimonial_${crypto.randomUUID()}`,
    author: normalizeOptionalText(parsed.data.author) || String(user.name || user.email || 'Ndovera user').trim(),
    role: normalizeOptionalText(parsed.data.role),
    quote: buildFeaturedQuote(originalComment, normalizeOptionalText(parsed.data.quote)),
    originalComment,
    profilePhotoUrl: normalizeOptionalText(parsed.data.profilePhotoUrl),
    featured: Boolean(parsed.data.featured),
    sourceUserId: normalizeOptionalText(parsed.data.sourceUserId),
    sourceType: parsed.data.sourceType === 'user-remark' || originalComment || parsed.data.profilePhotoUrl ? 'user-remark' : 'manual',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const nextTestimonials = [testimonial, ...testimonials];
  const nextWebsiteConfig = withTestimonials(profile?.websiteConfig, nextTestimonials);
  await upsertSchoolProfile({ schoolId, websiteConfig: nextWebsiteConfig });
  return res.status(201).json({ testimonial, testimonials: nextTestimonials });
});

schoolsRouter.patch('/:schoolId/testimonials/:testimonialId', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });
  const schoolId = String(req.params.schoolId || '').trim();
  const testimonialId = String(req.params.testimonialId || '').trim();
  if (!schoolId || !testimonialId) return res.status(400).json({ error: 'schoolId and testimonialId are required' });
  if (schoolId !== String(user.school_id || '').trim()) return res.status(403).json({ error: 'Forbidden' });
  const parsed = testimonialUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid testimonial update payload.' });

  const profile = await getSchoolProfile(schoolId);
  const testimonials = readTestimonialsFromWebsiteConfig(profile?.websiteConfig);
  const index = testimonials.findIndex((entry) => entry.id === testimonialId);
  if (index < 0) return res.status(404).json({ error: 'Testimonial not found.' });

  const current = testimonials[index];
  const originalComment = parsed.data.originalComment !== undefined ? normalizeOptionalText(parsed.data.originalComment) : current.originalComment;
  const quote = buildFeaturedQuote(originalComment, parsed.data.quote !== undefined ? normalizeOptionalText(parsed.data.quote) : current.quote);
  const testimonial: WebsiteTestimonialRecord = {
    ...current,
    author: parsed.data.author !== undefined ? (normalizeOptionalText(parsed.data.author) || current.author) : current.author,
    role: parsed.data.role !== undefined ? normalizeOptionalText(parsed.data.role) : current.role,
    quote,
    originalComment,
    profilePhotoUrl: parsed.data.profilePhotoUrl !== undefined ? normalizeOptionalText(parsed.data.profilePhotoUrl) : current.profilePhotoUrl,
    featured: parsed.data.featured !== undefined ? parsed.data.featured : current.featured,
    sourceUserId: parsed.data.sourceUserId !== undefined ? normalizeOptionalText(parsed.data.sourceUserId) : current.sourceUserId,
    sourceType: parsed.data.sourceType || current.sourceType,
    updatedAt: nowIso(),
  };

  testimonials[index] = testimonial;
  const nextWebsiteConfig = withTestimonials(profile?.websiteConfig, testimonials);
  await upsertSchoolProfile({ schoolId, websiteConfig: nextWebsiteConfig });
  return res.json({ testimonial, testimonials });
});