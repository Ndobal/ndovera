import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

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

const OwnerBulkResults: React.FC = () => {
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
    <div className="dashboard-page">
      <GlassCard title="Bulk Results + PDF Tagging">
        <p className="text-muted">
          OCR-backed tagging, bulk uploads, and retroactive publishing with audit-grade tracking.
        </p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Upload Pipeline</h3>
          <ul className="card-list">
            <li>Total uploads: {stats.uploads}</li>
            <li>Queued for tagging: {stats.queued}</li>
            <li>Pending review: {stats.pending_review}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Tagging Engine</h3>
          <ul className="card-list">
            <li>Tagged records: {stats.tagged}</li>
            <li>Confidence scoring: Active</li>
            <li>Error resolution: Enabled</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Publishing</h3>
          <ul className="card-list">
            <li>Published batches: {stats.published}</li>
            <li>Audit trail: Locked</li>
            <li>Time-stamped releases</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Bulk Uploads" endpoint="/results-bulk/uploads" />
        <TableCard title="Tagging Queue" endpoint="/results-bulk/tags?status=pending" />
        <TableCard title="Audit Log" endpoint="/results-bulk/audit" />
      </div>
    </div>
  );
};

export default OwnerBulkResults;
