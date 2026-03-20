import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

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

const OwnerIdentity: React.FC = () => {
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
    <div className="dashboard-page">
      <GlassCard title="Identity Engine">
        <p className="text-muted">Hierarchy-aware identity, device binding, signatures, and trust scoring.</p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Identity Registry</h3>
          <ul className="card-list">
            <li>Identities: {stats.identities}</li>
            <li>Active sessions: {stats.active_sessions}</li>
            <li>Device bindings: {stats.device_bindings}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Trust & Security</h3>
          <ul className="card-list">
            <li>Trust alerts: {stats.trust_alerts}</li>
            <li>Signature coverage: {stats.signatures}</li>
            <li>Zero-trust mode: Enabled</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Audit</h3>
          <ul className="card-list">
            <li>Immutable logs</li>
            <li>Authority resolution</li>
            <li>Consent enforcement</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Identities" endpoint="/identity/identities" />
        <TableCard title="Audit Log" endpoint="/identity/audit" />
        <TableCard title="Trust Alerts" endpoint="/identity/audit" />
      </div>
    </div>
  );
};

export default OwnerIdentity;
