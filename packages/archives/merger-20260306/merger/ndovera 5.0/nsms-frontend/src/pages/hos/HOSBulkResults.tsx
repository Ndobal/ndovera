import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

interface BulkStats {
  uploads: number;
  queued: number;
  tagged: number;
  pending_review: number;
  published: number;
}

const fallbackStats: BulkStats = {
  uploads: 0,
  queued: 0,
  tagged: 0,
  pending_review: 0,
  published: 0,
};

const HOSBulkResults: React.FC = () => {
  const [stats, setStats] = useState<BulkStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<BulkStats>('/results-bulk/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="hos-page">
      <GlassCard title="HOS Bulk Results Approval">
        <p className="text-muted">Approve tagged results before publication and lock audit trail.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Review Queue</h3>
          <ul className="card-list">
            <li>Queued uploads: {stats.queued}</li>
            <li>Pending review: {stats.pending_review}</li>
            <li>Tagged records: {stats.tagged}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Publishing Control</h3>
          <ul className="card-list">
            <li>Published batches: {stats.published}</li>
            <li>Retroactive releases allowed</li>
            <li>Audit locked</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Quality Assurance</h3>
          <ul className="card-list">
            <li>Confidence scoring: Active</li>
            <li>Error resolution: Enabled</li>
            <li>Manual overrides: Enabled</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Bulk Uploads" endpoint="/results-bulk/uploads" />
        <HOSTable title="Tagging Queue" endpoint="/results-bulk/tags?status=pending" />
        <HOSTable title="Audit Log" endpoint="/results-bulk/audit" />
      </div>
    </div>
  );
};

export default HOSBulkResults;
