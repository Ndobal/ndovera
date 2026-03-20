import React, { useEffect, useState } from 'react';

// Simulate ad config state (would be replaced by API/backend in production)
type PageAdConfig = {
  classroom: boolean;
  dashboard: boolean;
  aurabooster: boolean;
  practicearena: boolean;
  // Add more pages as needed
  [key: string]: boolean;
};

type AdConfig = {
  enabled: boolean;
  pages: PageAdConfig;
};

const initialAdConfig: AdConfig = {
  enabled: false,
  pages: {
    classroom: false,
    dashboard: false,
    aurabooster: false,
    practicearena: false,
  }
};

import { Role } from '../types';

export default function AdsManagement() {
  const [adConfig, setAdConfig] = useState<AdConfig>(initialAdConfig);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ndovera_user');
      if (raw) {
        const u = JSON.parse(raw);
        setRole(u.activeRole);
      }
    } catch {}
  }, []);

  if (role !== 'Super Admin') {
    return (
      <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow border border-slate-200 mt-8 text-center">
        <h2 className="text-xl font-bold mb-4">Access Restricted</h2>
        <p className="text-slate-600">Only Super Admin can manage ads. Please contact Ndovera HQ for access.</p>
      </div>
    );
  }

  const toggleGlobalAds = () => {
    setAdConfig(cfg => {
      const updated = { ...cfg, enabled: !cfg.enabled };
      localStorage.setItem('ndovera_ads_config', JSON.stringify(updated));
      return updated;
    });
  };

  const togglePageAd = (page: keyof PageAdConfig) => {
    setAdConfig(cfg => {
      const updated = {
        ...cfg,
        pages: {
          ...cfg.pages,
          [page]: !cfg.pages[page]
        }
      };
      localStorage.setItem('ndovera_ads_config', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow border border-slate-200 mt-8">
      <h2 className="text-xl font-bold mb-4">Ads Management</h2>
      <div className="mb-6">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={adConfig.enabled} onChange={toggleGlobalAds} />
          <span className="font-medium">Enable Ads Globally</span>
        </label>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">Page-specific Ads</h3>
        <ul className="space-y-2">
          {Object.keys(adConfig.pages).map(page => (
            <li key={page} className="flex items-center gap-3">
              <span className="capitalize text-slate-700">{page}</span>
              <input type="checkbox" checked={!!adConfig.pages[page]} onChange={() => togglePageAd(page as keyof PageAdConfig)} disabled={!adConfig.enabled} />
              <span className="text-xs text-slate-400">{adConfig.pages[page] ? 'On' : 'Off'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
