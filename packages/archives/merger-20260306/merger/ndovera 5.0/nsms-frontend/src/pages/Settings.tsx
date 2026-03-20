import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import api from '../api/backend';

interface AdsConfigResponse {
  ads_count: number;
}

const Settings: React.FC = () => {
  const [adsCount, setAdsCount] = useState(2);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let mounted = true;
    api
      .get<AdsConfigResponse>('/settings/ads')
      .then((data) => mounted && setAdsCount(data.ads_count))
      .catch(() => mounted && setAdsCount(2));
    return () => {
      mounted = false;
    };
  }, []);

  const saveAdsCount = () => {
    setStatus('Saving...');
    api
      .post<AdsConfigResponse>('/settings/ads', { ads_count: adsCount, updated_by: 'ndovera_admin' })
      .then((data) => {
        setAdsCount(data.ads_count);
        setStatus('Saved');
      })
      .catch(() => setStatus('Failed to save'));
  };

  return (
    <div className="dashboard-page">
      <GlassCard title="Settings">
        <p className="text-muted">Owner preferences, integrations, and access controls.</p>
      </GlassCard>

      <div className="card-grid-2" style={{ marginTop: '1rem' }}>
        <div className="card">
          <h3 className="card-title">Farming Mode Ads</h3>
          <p className="text-muted">Set how many ads appear per cycle for students in farming mode.</p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem' }}>
            <input
              type="number"
              min={1}
              value={adsCount}
              onChange={(event) => setAdsCount(Number(event.target.value))}
              className="form-input"
              style={{ width: '120px' }}
            />
            <button type="button" className="quick-action" onClick={saveAdsCount}>
              Save
            </button>
            {status && <span className="text-muted">{status}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
