import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

interface DropboxStats {
  total: number;
  locked: number;
  folders: number;
  approvals: number;
}

const fallbackStats: DropboxStats = {
  total: 0,
  locked: 0,
  folders: 0,
  approvals: 0,
};

const HOSDropbox: React.FC = () => {
  const [stats, setStats] = useState<DropboxStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<DropboxStats>('/dropbox/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="hos-page">
      <GlassCard title="HOS Dropbox Control">
        <p className="text-muted">Approve, lock, and audit sensitive academic and administrative documents.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Secure Storage</h3>
          <ul className="card-list">
            <li>Total items: {stats.total}</li>
            <li>Locked: {stats.locked}</li>
            <li>Pending approvals: {stats.approvals}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Governance</h3>
          <ul className="card-list">
            <li>Role-based permissions</li>
            <li>Approval-required folders</li>
            <li>Audit log enforced</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Compliance</h3>
          <ul className="card-list">
            <li>Watermarking: Enabled</li>
            <li>Encryption at rest: Enabled</li>
            <li>History & versioning</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Academic Repository" endpoint="/dropbox/items?type=folder" />
        <HOSTable title="Locked & Restricted" endpoint="/dropbox/items?status=pending" />
        <HOSTable title="Audit Log" endpoint="/dropbox/audit" />
      </div>
    </div>
  );
};

export default HOSDropbox;
