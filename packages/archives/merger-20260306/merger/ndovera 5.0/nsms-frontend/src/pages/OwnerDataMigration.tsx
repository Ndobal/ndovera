import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

interface MigrationStats {
  batches: number;
  datasets: number;
  records: number;
  pending_approval: number;
  rollbacks: number;
}

const fallbackStats: MigrationStats = {
  batches: 0,
  datasets: 0,
  records: 0,
  pending_approval: 0,
  rollbacks: 0,
};

const OwnerDataMigration: React.FC = () => {
  const [stats, setStats] = useState<MigrationStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<MigrationStats>('/nme/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="dashboard-page">
      <GlassCard title="Historical Data Migration">
        <p className="text-muted">
          Import legacy results, sessions, and student records with mapping, validation, and approval gates.
        </p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Pipeline Status</h3>
          <ul className="card-list">
            <li>Import batches: {stats.batches}</li>
            <li>Datasets: {stats.datasets}</li>
            <li>Records: {stats.records}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Approval Gates</h3>
          <ul className="card-list">
            <li>Pending approvals: {stats.pending_approval}</li>
            <li>Rollback points: {stats.rollbacks}</li>
            <li>Audit trail: Locked</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Mapping & Validation</h3>
          <ul className="card-list">
            <li>Term mapping engine</li>
            <li>Duplicate detection</li>
            <li>Identity resolution</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Import Batches" endpoint="/nme/batches" />
        <TableCard title="Audit Log" endpoint="/nme/audit" />
        <TableCard title="Pending Approvals" endpoint="/nme/batches?status=pending" />
      </div>
    </div>
  );
};

export default OwnerDataMigration;
