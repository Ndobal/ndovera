import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

interface IdentityStats {
  identities: number;
  active_sessions: number;
  device_bindings: number;
  trust_alerts: number;
  signatures: number;
}

const fallbackStats: IdentityStats = {
  identities: 0,
  active_sessions: 0,
  device_bindings: 0,
  trust_alerts: 0,
  signatures: 0,
};

const HOSIdentity: React.FC = () => {
  const [stats, setStats] = useState<IdentityStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<IdentityStats>('/identity/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="hos-page">
      <GlassCard title="HOS Identity Governance">
        <p className="text-muted">Review identity trust alerts, signature coverage, and device bindings.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Trust Alerts</h3>
          <ul className="card-list">
            <li>Trust alerts: {stats.trust_alerts}</li>
            <li>Device bindings: {stats.device_bindings}</li>
            <li>Active sessions: {stats.active_sessions}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Signature Coverage</h3>
          <ul className="card-list">
            <li>Signatures: {stats.signatures}</li>
            <li>Role compliance: Enabled</li>
            <li>Consent enforcement: Active</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Audit</h3>
          <ul className="card-list">
            <li>Immutable logs</li>
            <li>HOS override tracked</li>
            <li>Risk scoring active</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Identities" endpoint="/identity/identities" />
        <HOSTable title="Audit Log" endpoint="/identity/audit" />
        <HOSTable title="Trust Alerts" endpoint="/identity/audit" />
      </div>
    </div>
  );
};

export default HOSIdentity;
