import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

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

const OwnerDropbox: React.FC = () => {
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
    <div className="dashboard-page">
      <GlassCard title="Staff Dropbox Governance">
        <p className="text-muted">
          Secure institutional storage with role-based access, approvals, and immutable audit trails.
        </p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Storage Overview</h3>
          <ul className="card-list">
            <li>Total items: {stats.total}</li>
            <li>Folders: {stats.folders}</li>
            <li>Locked files: {stats.locked}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Approvals & Compliance</h3>
          <ul className="card-list">
            <li>Pending approvals: {stats.approvals}</li>
            <li>Watermarking: Enabled</li>
            <li>Encryption at rest: Enabled</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Permissions</h3>
          <ul className="card-list">
            <li>HOS restricted folders</li>
            <li>Role-based access</li>
            <li>File history tracking</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Academic Files" endpoint="/dropbox/items?type=folder" />
        <TableCard title="Locked Files" endpoint="/dropbox/items?status=pending" />
        <TableCard title="Audit Log" endpoint="/dropbox/audit" />
      </div>
    </div>
  );
};

export default OwnerDropbox;
