import React from 'react';
import { getTenantPwaInfo } from '../hooks/useTenantPwaManifest';
import './Loader.css';

const Loader = () => {
  const pwaInfo = getTenantPwaInfo();
  const logoUrl = pwaInfo?.logoUrl || '';
  const initial = (pwaInfo?.schoolName || 'N').charAt(0).toUpperCase();

  return (
    <div className="loader-container">
      <div className="spinner spinner-merged">
        {logoUrl ? (
          <img src={logoUrl} className="loader-logo loader-logo-center" alt="School Logo" style={{ borderRadius: '50%', objectFit: 'contain' }} />
        ) : (
          <div className="loader-logo loader-logo-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#800000', borderRadius: '50%' }}>
            <span style={{ color: '#f5deb3', fontWeight: 900, fontSize: '28px', lineHeight: 1 }}>{initial}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Loader;
