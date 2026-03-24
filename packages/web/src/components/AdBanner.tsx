// Server-driven ad banner for display
import React, { useEffect, useMemo, useRef } from 'react';
import { AdPlacement, recordAdClick, recordAdImpression } from '../services/adsApi';

type AdBannerProps = {
  visible: boolean;
  pageKey: string;
  placementKey: string;
  sessionKey: string;
  placement?: AdPlacement | null;
};

export function AdBanner({ visible, pageKey, placementKey, sessionKey, placement }: AdBannerProps) {
  const trackedRef = useRef<string>('');
  const [isMobileView, setIsMobileView] = React.useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  const campaign = placement?.campaign;
  const fallback = placement?.fallback || {
    title: 'Ndovera Ads',
    description: 'Sponsored learning tools and school partners can appear here.',
    ctaLabel: 'Explore',
    destinationUrl: '/growth',
  };
  const isMobileHidden = Boolean(placement?.settings && !placement.settings.mobileBannerEnabled && isMobileView);

  const trackingKey = useMemo(() => {
    if (!campaign?.id) return '';
    return `${campaign.id}:${pageKey}:${placementKey}:${sessionKey}`;
  }, [campaign?.id, pageKey, placementKey, sessionKey]);

  useEffect(() => {
    if (!visible || !campaign?.id || !trackingKey || trackedRef.current === trackingKey) return;
    trackedRef.current = trackingKey;
    recordAdImpression({
      campaignId: campaign.id,
      pageKey,
      placementKey,
      sessionKey,
    }).catch(() => {});
  }, [campaign?.id, pageKey, placementKey, sessionKey, trackingKey, visible]);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!visible || isMobileHidden) return null;

  const title = campaign?.title || fallback.title;
  const description = campaign?.description || fallback.description;
  const ctaLabel = campaign?.cta_label || fallback.ctaLabel;
  const destinationUrl = campaign?.destination_url || fallback.destinationUrl;

  const handleClick = () => {
    if (campaign?.id) {
      recordAdClick({ campaignId: campaign.id }).catch(() => {});
    }
    if (destinationUrl) {
      if (/^https?:\/\//i.test(destinationUrl)) {
        window.open(destinationUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = destinationUrl;
      }
    }
  };

  return (
    <div className="w-full px-3 pb-3 md:px-4 md:pb-4">
      <div className="rounded-2xl border border-amber-300/70 bg-linear-to-r from-amber-50 via-yellow-50 to-orange-50 px-4 py-3 text-amber-950 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
              Sponsored
              {placement?.freeViewsRemaining !== undefined && (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[9px] tracking-normal text-amber-900">
                  {placement.freeViewsRemaining} free views left
                </span>
              )}
            </div>
            <h3 className="text-sm font-extrabold md:text-base">{title}</h3>
            <p className="max-w-3xl text-xs leading-relaxed text-amber-900/80 md:text-sm">{description}</p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={handleClick}
              className="rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-500"
            >
              {ctaLabel}
            </button>
          </div>
        </div>
        {campaign?.media_url && (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/60 bg-white/70">
            {campaign.media_type === 'video' ? (
              <video src={campaign.media_url} controls className="h-44 w-full object-cover" />
            ) : (
              <img src={campaign.media_url} alt={title} className="h-44 w-full object-cover" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
