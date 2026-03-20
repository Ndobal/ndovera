import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

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

const HOSVideoGallery: React.FC = () => {
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
    <div className="hos-page">
      <GlassCard title="HOS Video Gallery Control">
        <p className="text-muted">Approve video content, manage privacy, and enforce access control.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Approval Queue</h3>
          <ul className="card-list">
            <li>Private videos: {stats.private}</li>
            <li>Unlisted videos: {stats.unlisted}</li>
            <li>Published: {stats.published}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Access Control</h3>
          <ul className="card-list">
            <li>Role-based visibility</li>
            <li>Class tagging enabled</li>
            <li>Event tagging enabled</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Compliance</h3>
          <ul className="card-list">
            <li>Audit trail locked</li>
            <li>Approvals required</li>
            <li>Analytics enabled</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Video Library" endpoint="/video-gallery/videos" />
        <HOSTable title="Private Videos" endpoint="/video-gallery/videos?visibility=private" />
        <HOSTable title="Audit Log" endpoint="/video-gallery/audit" />
      </div>
    </div>
  );
};

export default HOSVideoGallery;
