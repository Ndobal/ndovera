import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type SchoolProfileRecord = {
  schoolId: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  primaryColor: string | null;
  websiteConfig: Record<string, unknown> | null;
  updatedAt: string;
};

type SchoolProfilesState = {
  profiles: SchoolProfileRecord[];
};

type UpsertSchoolProfileInput = {
  schoolId: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  primaryColor?: string | null;
  websiteConfig?: Record<string, unknown> | null;
};

function nowIso() {
  return new Date().toISOString();
}

function defaultState(): SchoolProfilesState {
  return { profiles: [] };
}

async function readState() { return readDocument<SchoolProfilesState>('school-profiles', GLOBAL_SCOPE, defaultState); }
async function writeState(state: SchoolProfilesState) { return writeDocument('school-profiles', GLOBAL_SCOPE, state); }

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function extractThemeField(websiteConfig: Record<string, unknown> | null | undefined, field: 'primaryColor' | 'logoUrl') {
  const theme = websiteConfig?.theme;
  if (!theme || typeof theme !== 'object') return null;
  return normalizeOptionalString((theme as Record<string, unknown>)[field]);
}

function extractWebsiteUrl(websiteConfig: Record<string, unknown> | null | undefined) {
  return normalizeOptionalString(websiteConfig?.publicUrl);
}

export async function getSchoolProfile(schoolId: string) {
  const normalizedSchoolId = schoolId.trim();
  if (!normalizedSchoolId) return null;
  const state = await readState();
  return state.profiles.find((profile) => profile.schoolId === normalizedSchoolId) || null;
}

export async function upsertSchoolProfile(input: UpsertSchoolProfileInput) {
  const schoolId = input.schoolId.trim();
  if (!schoolId) {
    throw new Error('schoolId is required');
  }

  const state = await readState();
  const profileIndex = state.profiles.findIndex((profile) => profile.schoolId === schoolId);
  const current = profileIndex >= 0 ? state.profiles[profileIndex] : null;

  const nextWebsiteConfig = input.websiteConfig !== undefined
    ? input.websiteConfig
    : current?.websiteConfig || null;

  const nextProfile: SchoolProfileRecord = {
    schoolId,
    logoUrl: input.logoUrl !== undefined
      ? normalizeOptionalString(input.logoUrl)
      : extractThemeField(nextWebsiteConfig, 'logoUrl') || current?.logoUrl || null,
    websiteUrl: input.websiteUrl !== undefined
      ? normalizeOptionalString(input.websiteUrl)
      : extractWebsiteUrl(nextWebsiteConfig) || current?.websiteUrl || null,
    primaryColor: input.primaryColor !== undefined
      ? normalizeOptionalString(input.primaryColor)
      : extractThemeField(nextWebsiteConfig, 'primaryColor') || current?.primaryColor || null,
    websiteConfig: nextWebsiteConfig,
    updatedAt: nowIso(),
  };

  if (profileIndex >= 0) {
    state.profiles[profileIndex] = nextProfile;
  } else {
    state.profiles.push(nextProfile);
  }

  await writeState(state);
  return nextProfile;
}