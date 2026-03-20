import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

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

const HOSDataMigration: React.FC = () => {
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
    <div className="hos-page">
      <GlassCard title="HOS Migration Approval">
        <p className="text-muted">Review, approve, and lock migrated records before they become official.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Approval Queue</h3>
          <ul className="card-list">
            <li>Pending approvals: {stats.pending_approval}</li>
            <li>Datasets: {stats.datasets}</li>
            <li>Records: {stats.records}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Validation</h3>
          <ul className="card-list">
            <li>Duplicate detection active</li>
            <li>Schema mapping enforced</li>
            <li>Rollback points: {stats.rollbacks}</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Compliance</h3>
          <ul className="card-list">
            <li>Audit log locked</li>
            <li>Version history preserved</li>
            <li>Approval signatures required</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Import Batches" endpoint="/nme/batches" />
        <HOSTable title="Audit Log" endpoint="/nme/audit" />
        <HOSTable title="Pending Approvals" endpoint="/nme/batches?status=pending" />
      </div>
    </div>
  );
};

export default HOSDataMigration;
