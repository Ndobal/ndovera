import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

interface BlogStats {
  drafts: number;
  pending_endorsement: number;
  pending_approval: number;
  published: number;
  rejected: number;
  queued_channels: number;
}

const fallbackStats: BlogStats = {
  drafts: 0,
  pending_endorsement: 0,
  pending_approval: 0,
  published: 0,
  rejected: 0,
  queued_channels: 0,
};

const HOSMedia: React.FC = () => {
  const [stats, setStats] = useState<BlogStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<BlogStats>('/blog/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="hos-page">
      <GlassCard title="HOS Editorial Approval Center">
        <p className="text-muted">
          Final approval authority for all academic and public-facing school media content.
        </p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Approval Queue</h3>
          <ul className="card-list">
            <li>Pending endorsement: {stats.pending_endorsement}</li>
            <li>Pending approval: {stats.pending_approval}</li>
            <li>Queued publish targets: {stats.queued_channels}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Publishing Control</h3>
          <ul className="card-list">
            <li>Published: {stats.published}</li>
            <li>Rejected: {stats.rejected}</li>
            <li>Drafts: {stats.drafts}</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Governance Guardrails</h3>
          <ul className="card-list">
            <li>Role-based workflow enforced</li>
            <li>Audit log locked</li>
            <li>Signature verification enabled</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Drafts" endpoint="/blog/posts?status=draft" />
        <HOSTable title="Submitted" endpoint="/blog/posts?status=submitted" />
        <HOSTable title="Approved & Published" endpoint="/blog/posts?status=published" />
      </div>
    </div>
  );
};

export default HOSMedia;
