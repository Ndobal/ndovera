import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/nsmsApi';
import { isCurrentPathAdFree, isAdFreeZone } from '../utils/adUtils';

interface AdContent {
  title: string;
  type: 'Sponsored' | 'Featured' | 'Announcement';
}

interface AdPlacementProps {
  zone?: string; // Optional zone override for checking ad-free status
  farmingModeActive?: boolean; // Show farming mode ads
  position?: 'sidebar' | 'inline' | 'banner'; // Ad position/layout
  className?: string;
  onClose?: () => void;
}

const AdsLibrary: AdContent[] = [
  {
    title: 'Science trivia: 5 quick facts to boost your scores.',
    type: 'Sponsored',
  },
  {
    title: 'Practice corner bundle: 3 sessions for 80 Lams.',
    type: 'Sponsored',
  },
  {
    title: 'Math challenge: Daily drills for faster mastery.',
    type: 'Sponsored',
  },
];

/**
 * AdPlacement Component
 * Renders ads with respect to global ad-free zones
 * Automatically disables ads in CBT, exams, messaging, results, etc.
 */
export const AdPlacement: React.FC<AdPlacementProps> = ({
  zone,
  farmingModeActive = true,
  position = 'sidebar',
  className = '',
  onClose,
}) => {
  const [adsVisible, setAdsVisible] = useState(true);
  const [adsCount, setAdsCount] = useState(2);

  // Check if current path is ad-free
  const isPathAdFree = isCurrentPathAdFree(window.location.pathname);
  // Check if specified zone is ad-free
  const isZoneAdFree = zone ? isAdFreeZone(zone) : false;
  // Overall decision: don't show ads if either path or zone is ad-free
  const shouldShowAds = farmingModeActive && adsVisible && !isPathAdFree && !isZoneAdFree;

  // Fetch admin-configured ads count
  useEffect(() => {
    let mounted = true;
    api
      .get('/settings/ads')
      .then((data: any) => mounted && setAdsCount(data.ads_count ?? 2))
      .catch(() => mounted && setAdsCount(2));
    return () => {
      mounted = false;
    };
  }, []);

  // Reset ads visibility every 15 minutes
  useEffect(() => {
    if (!farmingModeActive) {
      setAdsVisible(false);
      return;
    }

    setAdsVisible(true);
    const intervalId = window.setInterval(() => {
      setAdsVisible(true);
    }, 15 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [farmingModeActive]);

  const adsToShow = useMemo(() => {
    const total = Math.max(1, adsCount || 1);
    const extraCount = Math.max(0, total - 1);
    return Array.from(
      { length: extraCount },
      (_, index) => AdsLibrary[index % AdsLibrary.length],
    );
  }, [adsCount]);

  if (!shouldShowAds) {
    return null;
  }

  const handleClose = () => {
    setAdsVisible(false);
    onClose?.();
  };

  // Sidebar position (vertical ads column)
  if (position === 'sidebar') {
    return (
      <aside className={`student-ads ${className}`}>
        <div className="student-ads-card">
          <div className="student-ads-header">
            <p className="student-ads-label">Farming Mode Ads</p>
            <button type="button" className="student-ads-close" onClick={handleClose}>
              Close
            </button>
          </div>
          <h4>Earn Lams by viewing sponsored learning tips.</h4>
          <button type="button">Start earning</button>
        </div>
        {adsToShow.map((ad, index) => (
          <div key={`${ad.title}-${index}`} className="student-ads-card muted">
            <p className="student-ads-label">{ad.type}</p>
            <p>{ad.title}</p>
          </div>
        ))}
      </aside>
    );
  }

  // Inline ads (within content)
  if (position === 'inline') {
    return (
      <div className={`ad-placement ad-inline ${className}`}>
        {adsToShow.map((ad, index) => (
          <div key={`${ad.title}-${index}`} className="ad-card inline">
            <p className="ad-label">{ad.type}</p>
            <p>{ad.title}</p>
            <button type="button" onClick={handleClose}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    );
  }

  // Banner position (horizontal ads)
  if (position === 'banner') {
    return (
      <div className={`ad-placement ad-banner ${className}`}>
        <div className="ad-card banner">
          <p className="ad-label">Featured</p>
          <p>{adsToShow[0]?.title || 'Check out our latest offerings!'}</p>
          <button type="button" onClick={handleClose}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AdPlacement;
