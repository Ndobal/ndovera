import { fetchWithAuth } from '../../../services/apiClient';

export type ResultSectionId = 'pre-school' | 'primary' | 'junior-secondary' | 'senior-secondary';

export type ResultGradeBand = {
  id: string;
  min: number;
  max: number;
  label: string;
  grade: string;
};

export type ResultSectionConfig = {
  caCount: number;
  caLabels: string[];
  caWeights: number[];
  useMidTerm: boolean;
  midTermWeight: number;
  midTermOver100: boolean;
  examWeight: number;
  gradingKey: ResultGradeBand[];
  templateId: string;
  applyPage2: boolean;
  sectionHeadTitle: string;
};

export type ResultManagementConfig = Record<ResultSectionId, ResultSectionConfig>;

export type ResultSectionMeta = {
  id: ResultSectionId;
  label: string;
  helper: string;
};

export type ResultTemplateMeta = {
  id: string;
  name: string;
  desc: string;
  appliesTo: ResultSectionId[];
};

const defaultGradingKey: ResultGradeBand[] = [
  { id: '1', min: 70, max: 100, label: 'Excellent', grade: 'A' },
  { id: '2', min: 60, max: 69, label: 'Very Good', grade: 'B' },
  { id: '3', min: 50, max: 59, label: 'Credit', grade: 'C' },
  { id: '4', min: 40, max: 49, label: 'Pass', grade: 'D' },
  { id: '5', min: 0, max: 39, label: 'Fail', grade: 'E' },
];

export const resultSections: ResultSectionMeta[] = [
  { id: 'pre-school', label: 'Preschool / Nursery', helper: 'Includes Early Explorers, Reception, Pre-School 1, and Pre-School 2.' },
  { id: 'primary', label: 'Primary / Grade', helper: 'Covers Primary or Grade 1 up to the highest grade configured by the school.' },
  { id: 'junior-secondary', label: 'Junior Secondary', helper: 'Class names remain customizable while staying within the junior secondary section.' },
  { id: 'senior-secondary', label: 'Senior Secondary', helper: 'Class names remain customizable while staying within the senior secondary section.' },
];

export const resultTemplates: ResultTemplateMeta[] = [
  { id: 'tpl-1', name: 'Classic Grid', desc: 'Standard spreadsheet-style format shared from Reception to Senior Secondary.', appliesTo: ['pre-school', 'primary', 'junior-secondary', 'senior-secondary'] },
  { id: 'tpl-2', name: 'Formal Ledger', desc: 'Traditional official layout for schools that prefer a stricter result-card presentation.', appliesTo: ['pre-school', 'primary', 'junior-secondary', 'senior-secondary'] },
  { id: 'tpl-3', name: 'Comprehensive Review', desc: 'Main result template with wider summary and remarks space.', appliesTo: ['pre-school', 'primary', 'junior-secondary', 'senior-secondary'] },
];

export function getSectionLabel(sectionId: ResultSectionId) {
  return resultSections.find((section) => section.id === sectionId)?.label || sectionId;
}

export function getSectionHelper(sectionId: ResultSectionId) {
  return resultSections.find((section) => section.id === sectionId)?.helper || '';
}

export function getSectionBadgeTone(sectionId: ResultSectionId) {
  if (sectionId === 'pre-school') return 'bg-pink-500/20 text-pink-400';
  if (sectionId === 'primary') return 'bg-orange-500/20 text-orange-400';
  return 'bg-blue-500/20 text-blue-400';
}

export function getDefaultSectionHeadTitle(sectionId: ResultSectionId) {
  if (sectionId === 'pre-school') return 'Nursery Head';
  if (sectionId === 'primary') return 'Head Teacher';
  if (sectionId === 'junior-secondary') return 'Junior School Principal';
  return 'Principal';
}

export function getPageTwoLabel(sectionId: ResultSectionId) {
  if (sectionId === 'pre-school') return 'Progress Report';
  if (sectionId === 'primary') return 'Cognitive Report';
  return 'No special page 2 override';
}

export function createDefaultResultManagementConfig(): ResultManagementConfig {
  return resultSections.reduce((accumulator, section) => {
    accumulator[section.id] = {
      caCount: 2,
      caLabels: ['CA 1', 'CA 2'],
      caWeights: [10, 10],
      useMidTerm: true,
      midTermWeight: 20,
      midTermOver100: true,
      examWeight: 60,
      gradingKey: defaultGradingKey.map((entry) => ({ ...entry })),
      templateId: resultTemplates.find((template) => template.appliesTo.includes(section.id))?.id || 'tpl-1',
      applyPage2: section.id === 'pre-school' || section.id === 'primary',
      sectionHeadTitle: getDefaultSectionHeadTitle(section.id),
    };
    return accumulator;
  }, {} as ResultManagementConfig);
}

function normalizeGradeBand(raw: unknown, fallback: ResultGradeBand): ResultGradeBand {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id : fallback.id,
    min: typeof source.min === 'number' && Number.isFinite(source.min) ? source.min : fallback.min,
    max: typeof source.max === 'number' && Number.isFinite(source.max) ? source.max : fallback.max,
    label: typeof source.label === 'string' && source.label.trim() ? source.label : fallback.label,
    grade: typeof source.grade === 'string' && source.grade.trim() ? source.grade : fallback.grade,
  };
}

function normalizeStringArray(raw: unknown, fallback: string[]) {
  if (!Array.isArray(raw)) return [...fallback];
  const filtered = raw.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
  return filtered.length ? filtered : [...fallback];
}

function normalizeNumberArray(raw: unknown, fallback: number[], desiredLength: number) {
  if (!Array.isArray(raw)) return fallback.slice(0, desiredLength);
  const normalized = raw
    .map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? entry : Number.NaN))
    .filter((entry) => Number.isFinite(entry));
  if (!normalized.length) return fallback.slice(0, desiredLength);
  const next = normalized.slice(0, desiredLength);
  while (next.length < desiredLength) next.push(fallback[next.length] ?? 0);
  return next;
}

export function normalizeResultManagementConfig(raw: unknown): ResultManagementConfig {
  const defaults = createDefaultResultManagementConfig();
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};

  return resultSections.reduce((accumulator, section) => {
    const fallback = defaults[section.id];
    const rawSection = source[section.id];
    const sectionSource = rawSection && typeof rawSection === 'object' ? rawSection as Record<string, unknown> : {};
    const caCount = typeof sectionSource.caCount === 'number' && Number.isFinite(sectionSource.caCount)
      ? Math.max(1, Math.min(4, Math.round(sectionSource.caCount)))
      : fallback.caCount;
    const gradingFallback = fallback.gradingKey;
    const gradingSource = Array.isArray(sectionSource.gradingKey) ? sectionSource.gradingKey : [];

    accumulator[section.id] = {
      caCount,
      caLabels: normalizeStringArray(sectionSource.caLabels, fallback.caLabels).slice(0, caCount),
      caWeights: normalizeNumberArray(sectionSource.caWeights, fallback.caWeights, caCount),
      useMidTerm: typeof sectionSource.useMidTerm === 'boolean' ? sectionSource.useMidTerm : fallback.useMidTerm,
      midTermWeight: typeof sectionSource.midTermWeight === 'number' && Number.isFinite(sectionSource.midTermWeight) ? sectionSource.midTermWeight : fallback.midTermWeight,
      midTermOver100: typeof sectionSource.midTermOver100 === 'boolean' ? sectionSource.midTermOver100 : fallback.midTermOver100,
      examWeight: typeof sectionSource.examWeight === 'number' && Number.isFinite(sectionSource.examWeight) ? sectionSource.examWeight : fallback.examWeight,
      gradingKey: (gradingSource.length ? gradingSource : gradingFallback).map((entry, index) => normalizeGradeBand(entry, gradingFallback[index] || gradingFallback[gradingFallback.length - 1])),
      templateId: typeof sectionSource.templateId === 'string' && sectionSource.templateId.trim() ? sectionSource.templateId : fallback.templateId,
      applyPage2: typeof sectionSource.applyPage2 === 'boolean' ? sectionSource.applyPage2 : fallback.applyPage2,
      sectionHeadTitle: typeof sectionSource.sectionHeadTitle === 'string' && sectionSource.sectionHeadTitle.trim() ? sectionSource.sectionHeadTitle.trim() : fallback.sectionHeadTitle,
    };

    if (accumulator[section.id].caLabels.length < caCount) {
      while (accumulator[section.id].caLabels.length < caCount) {
        accumulator[section.id].caLabels.push(`CA ${accumulator[section.id].caLabels.length + 1}`);
      }
    }

    return accumulator;
  }, {} as ResultManagementConfig);
}

export function serializeResultManagementConfig(config: ResultManagementConfig) {
  return resultSections.reduce((accumulator, section) => {
    const entry = config[section.id];
    accumulator[section.id] = {
      ...entry,
      caLabels: entry.caLabels.slice(0, entry.caCount),
      caWeights: entry.caWeights.slice(0, entry.caCount),
      gradingKey: entry.gradingKey.map((gradeBand) => ({ ...gradeBand })),
    };
    return accumulator;
  }, {} as Record<ResultSectionId, ResultSectionConfig>);
}

export function getStoredResultManagementSettings(websiteConfig: unknown) {
  if (!websiteConfig || typeof websiteConfig !== 'object') return createDefaultResultManagementConfig();
  const website = websiteConfig as Record<string, unknown>;
  const candidate = website.resultManagement;
  if (candidate && typeof candidate === 'object' && 'sections' in (candidate as Record<string, unknown>)) {
    return normalizeResultManagementConfig((candidate as Record<string, unknown>).sections);
  }
  return normalizeResultManagementConfig(candidate);
}

export function formatRatingScale(gradingKey: ResultGradeBand[]) {
  return gradingKey
    .slice()
    .sort((left, right) => right.max - left.max)
    .map((entry) => `${entry.grade}: ${entry.min}-${entry.max} (${entry.label})`)
    .join(' | ');
}

export function getResultPageTwoVariant(sectionId: ResultSectionId, applyPage2: boolean) {
  if (!applyPage2) return 'none' as const;
  if (sectionId === 'pre-school') return 'progress' as const;
  if (sectionId === 'primary') return 'cognitive' as const;
  return 'none' as const;
}

export async function loadSchoolWebsiteConfig() {
  return fetchWithAuth('/api/schools/website') as Promise<{ ok: boolean; website?: Record<string, unknown> | null }>;
}

export async function saveResultManagementSettings(config: ResultManagementConfig, websiteConfig: Record<string, unknown> | null | undefined) {
  const nextWebsiteConfig: Record<string, unknown> = {
    ...((websiteConfig && typeof websiteConfig === 'object') ? websiteConfig : {}),
    resultManagement: {
      sections: serializeResultManagementConfig(config),
      updatedAt: new Date().toISOString(),
    },
  };

  return fetchWithAuth('/api/schools/website', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      website_config: nextWebsiteConfig,
    }),
  }) as Promise<{ ok: boolean; website?: Record<string, unknown> | null }>;
}