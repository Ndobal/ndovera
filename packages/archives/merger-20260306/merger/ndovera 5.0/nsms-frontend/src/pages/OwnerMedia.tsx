import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

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

const OwnerMedia: React.FC = () => {
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
    <div className="dashboard-page">
      <GlassCard title="School Media Governance">
        <p className="text-muted">
          Production-grade editorial system with HOS final approval, audit trail, and multi-platform publishing.
        </p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Editorial Governance</h3>
          <ul className="card-list">
            <li>Drafts: {stats.drafts}</li>
            <li>Pending endorsement: {stats.pending_endorsement}</li>
            <li>Pending HOS approval: {stats.pending_approval}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Publishing Status</h3>
          <ul className="card-list">
            <li>Published: {stats.published}</li>
            <li>Rejected: {stats.rejected}</li>
            <li>Queued channels: {stats.queued_channels}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Security & Audit</h3>
          <ul className="card-list">
            <li>Role-based approvals</li>
            <li>Immutable audit log</li>
            <li>Digital signatures</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Drafts" endpoint="/blog/posts?status=draft" />
        <TableCard title="Pending Endorsements" endpoint="/blog/posts?status=submitted" />
        <TableCard title="Published" endpoint="/blog/posts?status=published" />
      </div>
    </div>
  );
};

export default OwnerMedia;
