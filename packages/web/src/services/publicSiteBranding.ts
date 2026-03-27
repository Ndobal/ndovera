import { resolveApiUrl } from './apiClient';

export type WebsiteTemplateVariant = 'signature' | 'bright-future';

export type PublicWebsiteTheme = {
  primaryColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
  templateVariant?: WebsiteTemplateVariant;
};

export type PublicWebsiteRecord = {
  schoolId: string;
  theme?: PublicWebsiteTheme;
  publicUrl?: string | null;
  pages?: Array<Record<string, unknown>>;
  contactInfo?: Record<string, unknown>;
  socialLinks?: Record<string, unknown>;
  marketing?: Record<string, unknown>;
  legal?: Record<string, unknown>;
};

export type PublicBrandingContext = {
  schoolId: string;
  schoolName: string;
  subdomain: string | null;
  isTenant: boolean;
  logoUrl: string | null;
  primaryColor: string;
  templateVariant: WebsiteTemplateVariant;
  website: PublicWebsiteRecord | null;
};

const ROOT_SUBDOMAIN = 'ndovera';
const ROOT_SCHOOL_ID = 'school-1';
const ROOT_HOSTS = new Set(['localhost', '127.0.0.1', 'ndovera.com', 'www.ndovera.com']);

export function resolveTemplateVariant(value: unknown): WebsiteTemplateVariant {
  return value === 'bright-future' ? 'bright-future' : 'signature';
}

export function resolveTenantSubdomain(hostname?: string) {
  const normalized = String(hostname || (typeof window !== 'undefined' ? window.location.hostname : '')).trim().toLowerCase();
  if (!normalized || ROOT_HOSTS.has(normalized)) return null;
  if (normalized.endsWith('.localhost')) {
    const parts = normalized.split('.');
    return parts.length > 1 ? parts[0] : null;
  }
  if (normalized.endsWith('.ndovera.com')) {
    const remainder = normalized.slice(0, -'.ndovera.com'.length);
    const subdomain = remainder.split('.').filter(Boolean)[0] || null;
    return subdomain && subdomain !== 'www' ? subdomain : null;
  }
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length >= 3) return parts[0] || null;
  return null;
}

function fallbackBrandingContext(): PublicBrandingContext {
  return {
    schoolId: ROOT_SCHOOL_ID,
    schoolName: 'Ndovera',
    subdomain: ROOT_SUBDOMAIN,
    isTenant: false,
    logoUrl: '/ndovera.png',
    primaryColor: '#4F46E5',
    templateVariant: 'bright-future',
    website: null,
  };
}

export async function fetchPublicBrandingContext(): Promise<PublicBrandingContext> {
  const fallback = fallbackBrandingContext();
  const subdomain = resolveTenantSubdomain();
  const requestUrl = subdomain
    ? resolveApiUrl(`/api/schools/by-subdomain/${encodeURIComponent(subdomain)}/website`)
    : resolveApiUrl(`/api/schools/${ROOT_SCHOOL_ID}/website`);

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) return fallback;
    const payload = await response.json().catch(() => ({})) as {
      schoolId?: string;
      school?: { id?: string; name?: string; subdomain?: string };
      website?: PublicWebsiteRecord | null;
    };
    const website = payload.website || null;
    const logoUrl = typeof website?.theme?.logoUrl === 'string' ? website.theme.logoUrl : fallback.logoUrl;
    const primaryColor = typeof website?.theme?.primaryColor === 'string' && website.theme.primaryColor.trim() ? website.theme.primaryColor : fallback.primaryColor;
    const templateVariant = resolveTemplateVariant(website?.theme?.templateVariant);
    const resolvedSubdomain = typeof payload.school?.subdomain === 'string' ? payload.school.subdomain : (subdomain || fallback.subdomain);
    return {
      schoolId: typeof payload.schoolId === 'string' && payload.schoolId.trim() ? payload.schoolId : fallback.schoolId,
      schoolName: typeof payload.school?.name === 'string' && payload.school.name.trim() ? payload.school.name : (resolvedSubdomain === ROOT_SUBDOMAIN ? 'Ndovera' : 'School Portal'),
      subdomain: resolvedSubdomain,
      isTenant: Boolean(resolvedSubdomain && resolvedSubdomain !== ROOT_SUBDOMAIN),
      logoUrl: logoUrl || fallback.logoUrl,
      primaryColor,
      templateVariant,
      website,
    };
  } catch {
    return fallback;
  }
}
