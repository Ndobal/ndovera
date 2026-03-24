import React, { useEffect, useMemo, useState } from 'react';
import { loadUser } from '../services/authLocal';
import {
  AD_PAGE_OPTIONS,
  AdCampaign,
  AdDashboardStats,
  AdSettings,
  createAdCampaign,
  getAdSettings,
  getAdCampaigns,
  updateAdCampaign,
  updateAdSettings,
} from '../services/adsApi';

const DEFAULT_SETTINGS: AdSettings = {
  schoolId: 'school_1',
  enabled: false,
  allowedPages: ['dashboard', 'classroom', 'communication', 'growth', 'library', 'finance', 'management', 'website', 'reports', 'teacher', 'farming'],
  excludedPages: ['exams', 'classwork', 'results'],
  rewardFreeViews: 2,
  rewardAuraPerView: 1,
  maxAdsPerSession: 6,
  mobileBannerEnabled: true,
  updatedAt: null,
  updatedBy: null,
};

const EMPTY_CAMPAIGN_FORM = {
  title: '',
  advertiserName: '',
  description: '',
  destinationUrl: '',
  mediaUrl: '',
  mediaType: 'image',
  ctaLabel: 'Learn More',
  priority: 1,
  status: 'active',
  targetPages: ['dashboard'],
  startAt: '',
  endAt: '',
};

export default function AdsManagement() {
  const [role, setRole] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdSettings>(DEFAULT_SETTINGS);
  const [dashboard, setDashboard] = useState<AdDashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN_FORM);

  useEffect(() => {
    const user = loadUser();
    setRole(user?.activeRole || null);
  }, []);

  const refresh = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [settingsResult, campaignsResult] = await Promise.all([getAdSettings(), getAdCampaigns()]);
      setSettings(settingsResult || DEFAULT_SETTINGS);
      setCampaigns(campaignsResult.campaigns || []);
      setDashboard(campaignsResult.stats || null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to load ad data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const allowedPageKeys = useMemo(() => new Set(settings.allowedPages || []), [settings.allowedPages]);

  const toggleAllowedPage = (pageKey: string) => {
    setSettings((current) => {
      const nextPages = allowedPageKeys.has(pageKey)
        ? current.allowedPages.filter((item) => item !== pageKey)
        : [...current.allowedPages, pageKey];
      return { ...current, allowedPages: nextPages };
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateAdSettings({
        enabled: settings.enabled,
        allowedPages: settings.allowedPages,
        excludedPages: settings.excludedPages,
        rewardFreeViews: settings.rewardFreeViews,
        rewardAuraPerView: settings.rewardAuraPerView,
        maxAdsPerSession: settings.maxAdsPerSession,
        mobileBannerEnabled: settings.mobileBannerEnabled,
      });
      setSettings(updated);
      setMessage('Ad settings saved.');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const createCampaign = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (!campaignForm.title.trim()) throw new Error('Campaign title is required.');
      if (!campaignForm.advertiserName.trim()) throw new Error('Advertiser name is required.');
      const result = await createAdCampaign({
        title: campaignForm.title,
        advertiserName: campaignForm.advertiserName,
        description: campaignForm.description || undefined,
        destinationUrl: campaignForm.destinationUrl || undefined,
        mediaUrl: campaignForm.mediaUrl || undefined,
        mediaType: campaignForm.mediaType,
        ctaLabel: campaignForm.ctaLabel || 'Learn More',
        priority: Number(campaignForm.priority || 1),
        status: campaignForm.status,
        targetPages: campaignForm.targetPages,
        startAt: campaignForm.startAt || undefined,
        endAt: campaignForm.endAt || undefined,
      });
      setCampaigns((current) => [result.campaign, ...current]);
      setCampaignForm(EMPTY_CAMPAIGN_FORM);
      setMessage('Campaign created.');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create campaign.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCampaignStatus = async (campaign: AdCampaign) => {
    setSaving(true);
    setMessage(null);
    try {
      const nextStatus = campaign.status === 'active' ? 'paused' : 'active';
      const result = await updateAdCampaign(campaign.id, { status: nextStatus, pages: campaign.targetPages || [] });
      setCampaigns((current) => current.map((item) => (item.id === campaign.id ? result.campaign : item)));
      setMessage(`Campaign ${nextStatus}.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to update campaign.');
    } finally {
      setSaving(false);
    }
  };

  if (role !== 'Super Admin') {
    return (
      <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-lg">
        <h2 className="mb-3 text-xl font-bold text-white">Access Restricted</h2>
        <p className="text-sm text-zinc-300">Only Super Admin can manage ads. Please contact Ndovera HQ for access.</p>
      </div>
    );
  }

  const stats = [
    { label: 'Campaigns', value: dashboard?.campaignCount ?? campaigns.length },
    { label: 'Active', value: dashboard?.activeCampaigns ?? campaigns.filter((item) => item.status === 'active').length },
    { label: 'Impressions', value: dashboard?.impressions ?? 0 },
    { label: 'Clicks', value: dashboard?.clicks ?? 0 },
    { label: 'Rewards', value: dashboard?.rewards ?? 0 },
    { label: 'CTR %', value: dashboard?.ctr ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
      <div className="rounded-3xl border border-white/10 bg-linear-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-300/80">Ndovera Ads System</p>
            <h1 className="mt-2 text-3xl font-black text-white">Ad control room</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-300">
              Manage rotation, eligibility, rewards, and campaign delivery from one server-backed dashboard.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <div className="font-semibold">Reward rule</div>
            <div>First 2 ads are free. Ad 3 and beyond earn Aura automatically.</div>
          </div>
        </div>
        {message && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">{message}</div>}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">{stat.label}</div>
            <div className="mt-2 text-2xl font-black text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Ad settings</h2>
              <p className="text-sm text-zinc-400">Enable or disable ads, configure eligible pages, and tune rewards.</p>
            </div>
            <button
              onClick={saveSettings}
              disabled={saving || loading}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={() => setSettings((current) => ({ ...current, enabled: !current.enabled }))}
                className="h-4 w-4"
              />
              <div>
                <div className="font-semibold text-white">Enable ads globally</div>
                <div className="text-xs text-zinc-400">Turn the rotation engine on for the current school.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <input
                type="checkbox"
                checked={settings.mobileBannerEnabled}
                onChange={() => setSettings((current) => ({ ...current, mobileBannerEnabled: !current.mobileBannerEnabled }))}
                className="h-4 w-4"
              />
              <div>
                <div className="font-semibold text-white">Show banner on mobile</div>
                <div className="text-xs text-zinc-400">Useful for compact campaigns and sponsor placements.</div>
              </div>
            </label>

            <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Free views before reward</div>
              <input
                type="number"
                min={0}
                value={settings.rewardFreeViews}
                onChange={(e) => setSettings((current) => ({ ...current, rewardFreeViews: Number(e.target.value || 0) }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
              />
            </label>

            <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Aura per rewarded view</div>
              <input
                type="number"
                min={0}
                value={settings.rewardAuraPerView}
                onChange={(e) => setSettings((current) => ({ ...current, rewardAuraPerView: Number(e.target.value || 0) }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
              />
            </label>

            <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Max ads per session</div>
              <input
                type="number"
                min={1}
                value={settings.maxAdsPerSession}
                onChange={(e) => setSettings((current) => ({ ...current, maxAdsPerSession: Number(e.target.value || 1) }))}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Excluded pages</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
                {settings.excludedPages.map((page) => (
                  <span key={page} className="rounded-full bg-white/10 px-3 py-1">{page}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 text-sm font-semibold text-white">Eligible pages</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AD_PAGE_OPTIONS.map((page) => {
                const checked = allowedPageKeys.has(page.key);
                const isExcluded = settings.excludedPages.includes(page.key);
                return (
                  <label key={page.key} className={`flex items-center gap-3 rounded-2xl border p-3 ${checked ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAllowedPage(page.key)}
                      className="h-4 w-4"
                    />
                    <div>
                      <div className="text-sm font-semibold text-white">{page.label}</div>
                      <div className="text-[11px] text-zinc-400">{isExcluded ? 'Excluded by policy' : 'Eligible for rotation'}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <h2 className="text-lg font-bold text-white">Create campaign</h2>
          <p className="text-sm text-zinc-400">Upload a sponsor card, set the CTA, and choose the pages where it can rotate.</p>

          <div className="mt-4 space-y-3">
            <input value={campaignForm.title} onChange={(e) => setCampaignForm((current) => ({ ...current, title: e.target.value }))} placeholder="Campaign title" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />
            <input value={campaignForm.advertiserName} onChange={(e) => setCampaignForm((current) => ({ ...current, advertiserName: e.target.value }))} placeholder="Advertiser name" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />
            <textarea value={campaignForm.description} onChange={(e) => setCampaignForm((current) => ({ ...current, description: e.target.value }))} placeholder="Campaign description" rows={3} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />
            <input value={campaignForm.destinationUrl} onChange={(e) => setCampaignForm((current) => ({ ...current, destinationUrl: e.target.value }))} placeholder="Destination URL" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />
            <input value={campaignForm.mediaUrl} onChange={(e) => setCampaignForm((current) => ({ ...current, mediaUrl: e.target.value }))} placeholder="Image or video URL" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />

            <div className="grid gap-3 md:grid-cols-2">
              <select value={campaignForm.mediaType} onChange={(e) => setCampaignForm((current) => ({ ...current, mediaType: e.target.value }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none">
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="text">Text only</option>
              </select>
              <input value={campaignForm.ctaLabel} onChange={(e) => setCampaignForm((current) => ({ ...current, ctaLabel: e.target.value }))} placeholder="CTA label" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />
              <input type="number" min={1} value={campaignForm.priority} onChange={(e) => setCampaignForm((current) => ({ ...current, priority: Number(e.target.value || 1) }))} placeholder="Priority" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />
              <select value={campaignForm.status} onChange={(e) => setCampaignForm((current) => ({ ...current, status: e.target.value }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input value={campaignForm.startAt} onChange={(e) => setCampaignForm((current) => ({ ...current, startAt: e.target.value }))} type="datetime-local" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />
              <input value={campaignForm.endAt} onChange={(e) => setCampaignForm((current) => ({ ...current, endAt: e.target.value }))} type="datetime-local" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Target pages</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {AD_PAGE_OPTIONS.map((page) => {
                  const checked = campaignForm.targetPages.includes(page.key);
                  return (
                    <label key={page.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${checked ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setCampaignForm((current) => ({
                          ...current,
                          targetPages: checked
                            ? current.targetPages.filter((item) => item !== page.key)
                            : [...current.targetPages, page.key],
                        }))}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-white">{page.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              onClick={createCampaign}
              disabled={saving}
              className="w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? 'Processing…' : 'Create campaign'}
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Campaign vault</h2>
            <p className="text-sm text-zinc-400">Review delivery, impressions, clicks, and live status.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {campaigns.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-sm text-zinc-400">
              No campaigns yet. Create the first sponsor card to start serving ads.
            </div>
          )}
          {campaigns.map((campaign) => (
            <article key={campaign.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-white">{campaign.title}</div>
                  <div className="text-sm text-zinc-400">{campaign.advertiser_name}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${campaign.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : campaign.status === 'paused' ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-500/20 text-zinc-300'}`}>
                  {campaign.status}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{campaign.description || 'No description provided.'}</p>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-zinc-400">
                <div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-black text-white">{campaign.impressions}</div>Impressions</div>
                <div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-black text-white">{campaign.clicks}</div>Clicks</div>
                <div className="rounded-xl bg-white/5 p-3"><div className="text-lg font-black text-white">{campaign.priority}</div>Priority</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                {(campaign.targetPages || []).slice(0, 6).map((page) => (
                  <span key={page} className="rounded-full bg-white/10 px-2.5 py-1">{page}</span>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => toggleCampaignStatus(campaign)} disabled={saving} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60">
                  {campaign.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                {campaign.destination_url && (
                  <a href={campaign.destination_url} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                    Open link
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
