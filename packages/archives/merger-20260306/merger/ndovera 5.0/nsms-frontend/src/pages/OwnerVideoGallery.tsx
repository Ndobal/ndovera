import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

interface VideoStats {
  total: number;
  private: number;
  unlisted: number;
  published: number;
}

const fallbackStats: VideoStats = {
  total: 0,
  private: 0,
  unlisted: 0,
  published: 0,
};

const OwnerVideoGallery: React.FC = () => {
  const [stats, setStats] = useState<VideoStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<VideoStats>('/video-gallery/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="dashboard-page">
      <GlassCard title="Private Video Gallery">
        <p className="text-muted">
          Secure YouTube-backed gallery with role-based access, tagging, and analytics.
        </p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Library Overview</h3>
          <ul className="card-list">
            <li>Total videos: {stats.total}</li>
            <li>Private: {stats.private}</li>
            <li>Unlisted: {stats.unlisted}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Publishing</h3>
          <ul className="card-list">
            <li>Published: {stats.published}</li>
            <li>Role-based access: Enabled</li>
            <li>Tagging engine: Active</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Compliance</h3>
          <ul className="card-list">
            <li>Audit trail locked</li>
            <li>Content approvals required</li>
            <li>Analytics enabled</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Video Library" endpoint="/video-gallery/videos" />
        <TableCard title="Private Videos" endpoint="/video-gallery/videos?visibility=private" />
        <TableCard title="Audit Log" endpoint="/video-gallery/audit" />
      </div>
    </div>
  );
};

export default OwnerVideoGallery;
