import type { WebsitePage, WebsiteSection } from '../types';

export const SUPPORTED_PAGE_IMPORT_SCHEMA_VERSION = 1;

export const SUPPORTED_PAGE_SECTION_TYPES: WebsiteSection['type'][] = [
  'hero',
  'about',
  'admissions',
  'news',
  'contact',
  'features',
];

export type SupportedPageImportSection = {
  id?: string;
  type: WebsiteSection['type'];
  content: Record<string, unknown>;
};

export type SupportedPageImportPage = {
  title: string;
  slug: string;
  sections: SupportedPageImportSection[];
};

export type SupportedPageImportDocument = {
  schemaVersion: number;
  page: SupportedPageImportPage;
};

export type PageImportValidationResult =
  | {
      ok: true;
      document: SupportedPageImportDocument;
      page: SupportedPageImportPage;
    }
  | {
      ok: false;
      errors: string[];
    };

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSectionId(type: WebsiteSection['type'], index: number, value: unknown) {
  const normalized = normalizeText(value);
  return normalized || `${type}_${index + 1}`;
}

function normalizeContent(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function validatePageImportText(rawText: string): PageImportValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, errors: ['The uploaded file is not valid JSON.'] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['The uploaded JSON must be an object.'] };
  }

  const document = parsed as Record<string, unknown>;
  const errors: string[] = [];
  const schemaVersion = Number(document.schemaVersion);
  if (schemaVersion !== SUPPORTED_PAGE_IMPORT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SUPPORTED_PAGE_IMPORT_SCHEMA_VERSION}.`);
  }

  const pageSource = document.page;
  if (!pageSource || typeof pageSource !== 'object' || Array.isArray(pageSource)) {
    errors.push('page must be an object.');
  }

  if (errors.length > 0) return { ok: false, errors };

  const pageRecord = pageSource as Record<string, unknown>;
  const title = normalizeText(pageRecord.title);
  const slug = slugify(normalizeText(pageRecord.slug) || title);
  const rawSections = Array.isArray(pageRecord.sections) ? pageRecord.sections : null;

  if (!title) errors.push('page.title is required.');
  if (!slug) errors.push('page.slug is required.');
  if (!rawSections) errors.push('page.sections must be an array.');

  const sections: SupportedPageImportSection[] = [];
  if (rawSections) {
    rawSections.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`page.sections[${index}] must be an object.`);
        return;
      }

      const section = entry as Record<string, unknown>;
      const type = normalizeText(section.type) as WebsiteSection['type'];
      const content = normalizeContent(section.content);
      if (!SUPPORTED_PAGE_SECTION_TYPES.includes(type)) {
        errors.push(`page.sections[${index}].type must be one of: ${SUPPORTED_PAGE_SECTION_TYPES.join(', ')}.`);
        return;
      }
      if (!content) {
        errors.push(`page.sections[${index}].content must be an object.`);
        return;
      }

      sections.push({
        id: normalizeSectionId(type, index, section.id),
        type,
        content,
      });
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const normalizedPage: SupportedPageImportPage = {
    title,
    slug,
    sections,
  };

  return {
    ok: true,
    document: {
      schemaVersion: SUPPORTED_PAGE_IMPORT_SCHEMA_VERSION,
      page: normalizedPage,
    },
    page: normalizedPage,
  };
}

export function buildReplacementPage(targetPage: WebsitePage, importedPage: SupportedPageImportPage): WebsitePage {
  return {
    id: targetPage.id,
    title: importedPage.title,
    slug: importedPage.slug,
    isHidden: targetPage.isHidden,
    sections: importedPage.sections.map((section) => ({
      id: section.id || `${section.type}_${Math.random().toString(36).slice(2, 9)}`,
      type: section.type,
      content: section.content,
    })),
  };
}

export const PAGE_IMPORT_EXAMPLE_JSON = JSON.stringify(
  {
    schemaVersion: 1,
    page: {
      title: 'Home',
      slug: 'home',
      sections: [
        {
          id: 'hero_1',
          type: 'hero',
          content: {
            title: 'Run your school from one clear home page',
            subtitle: 'Replace the current public home page with a new hero and updated messaging.',
          },
        },
        {
          id: 'about_1',
          type: 'about',
          content: {
            text: 'This section explains the school story, focus, and public-facing value proposition.',
          },
        },
        {
          id: 'features_1',
          type: 'features',
          content: {
            title: 'Why families choose us',
            cards: [
              { title: 'Clear learning support', body: 'Students and families get one simple digital home.' },
              { title: 'Fast communication', body: 'Announcements, updates, and public contact stay organized.' },
              { title: 'Strong school identity', body: 'Branding, pages, and events stay aligned.' },
            ],
          },
        },
      ],
    },
  },
  null,
  2,
);