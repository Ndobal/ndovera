import { fetchWithAuth } from './apiClient';

export type AdSettings = {
  schoolId: string;
  enabled: boolean;
  allowedPages: string[];
  excludedPages: string[];
  rewardFreeViews: number;
  rewardAuraPerView: number;
  maxAdsPerSession: number;
  mobileBannerEnabled: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export type AdCampaign = {
  id: string;
  school_id: string;
  title: string;
  advertiser_name: string;
  description: string | null;
  destination_url: string | null;
  media_url: string | null;
  media_type: string | null;
  cta_label: string | null;
  target_pages_json: string | null;
  targetPages?: string[];
  priority: number;
  status: string;
  impressions: number;
  clicks: number;
  start_at: string | null;
  end_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at?: string;
  updated_at?: string | null;
};

export type AdDashboardStats = {
  campaignCount: number;
  activeCampaigns: number;
  impressions: number;
  clicks: number;
  rewards: number;
  ctr: number;
  campaigns: AdCampaign[];
  topCampaigns: Array<AdCampaign & { clickThroughRate: number }>;
  topPages: Array<{ page_key: string; impressions: number; rewards: number }>;
  recentImpressions: Array<Record<string, any>>;
};

export type AdPlacement = {
  enabled: boolean;
  shouldShow: boolean;
  pageKey: string;
  placementKey: string;
  sessionKey: string;
  settings: AdSettings;
  campaign: AdCampaign | null;
  freeViewsRemaining: number;
  impressionsUsed: number;
  rewardAuraPerView: number;
  fallback: {
    title: string;
    description: string;
    ctaLabel: string;
    destinationUrl: string;
  };
};

export type AdCampaignPayload = {
  title: string;
  advertiserName: string;
  description?: string;
  destinationUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  ctaLabel?: string;
  targetPages?: string[];
  priority?: number;
  status?: string;
  startAt?: string;
  endAt?: string;
};

export const AD_PAGE_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'classroom', label: 'Classroom' },
  { key: 'classwork', label: 'Classwork' },
  { key: 'communication', label: 'Communication' },
  { key: 'growth', label: 'Growth' },
  { key: 'library', label: 'Library' },
  { key: 'finance', label: 'Finance' },
  { key: 'management', label: 'Management' },
  { key: 'website', label: 'Website Builder' },
  { key: 'reports', label: 'Reports' },
  { key: 'teacher', label: 'Teacher Tools' },
  { key: 'farming', label: 'Farming' },
  { key: 'aurabooster', label: 'Aura Booster' },
  { key: 'exams', label: 'Exams' },
  { key: 'results', label: 'Results' },
];

export async function getAdSettings() {
  return fetchWithAuth('/api/ads/settings') as Promise<AdSettings>;
}

export async function updateAdSettings(payload: Partial<AdSettings> & { pages?: string[] }) {
  return fetchWithAuth('/api/ads/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<AdSettings>;
}

export async function getAdCampaigns() {
  return fetchWithAuth('/api/ads/campaigns') as Promise<{ campaigns: AdCampaign[]; stats: AdDashboardStats }>;
}

export async function getAdDashboard() {
  return fetchWithAuth('/api/ads/dashboard') as Promise<AdDashboardStats>;
}

export async function createAdCampaign(payload: AdCampaignPayload) {
  return fetchWithAuth('/api/ads/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ campaign: AdCampaign }>;
}

export async function updateAdCampaign(id: string, payload: Partial<AdCampaignPayload> & { pages?: string[] }) {
  return fetchWithAuth(`/api/ads/campaigns/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ campaign: AdCampaign }>;
}

export async function getAdPlacement(pageKey: string, placementKey: string, sessionKey: string) {
  const url = `/api/ads/serve?page=${encodeURIComponent(pageKey)}&placement=${encodeURIComponent(placementKey)}&sessionKey=${encodeURIComponent(sessionKey)}`;
  return fetchWithAuth(url) as Promise<AdPlacement>;
}

export async function recordAdImpression(payload: {
  campaignId: string;
  pageKey: string;
  placementKey?: string;
  sessionKey: string;
}) {
  return fetchWithAuth('/api/ads/impressions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; impressionId: string | null; rewarded: boolean; rewardAura: number; impressionsUsed: number; capped?: boolean }>;
}

export async function recordAdClick(payload: {
  campaignId: string;
  impressionId?: string;
}) {
  return fetchWithAuth('/api/ads/clicks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>;
}
