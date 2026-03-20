import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

interface LiveStats {
  scheduled: number;
  live: number;
  completed: number;
  reminders: number;
}

const fallbackStats: LiveStats = {
  scheduled: 0,
  live: 0,
  completed: 0,
  reminders: 0,
};

const HOSLiveEvents: React.FC = () => {
  const [stats, setStats] = useState<LiveStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<LiveStats>('/live-events/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="hos-page">
      <GlassCard title="HOS Live Events Control">
        <p className="text-muted">Approve live broadcasts and manage school-wide event moderation.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Live Queue</h3>
          <ul className="card-list">
            <li>Scheduled: {stats.scheduled}</li>
            <li>Live now: {stats.live}</li>
            <li>Reminders: {stats.reminders}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Engagement Controls</h3>
          <ul className="card-list">
            <li>Live chat moderation</li>
            <li>Comment approval enabled</li>
            <li>Replay archive on</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Compliance</h3>
          <ul className="card-list">
            <li>HOS approval required</li>
            <li>Audit trail locked</li>
            <li>Policy enforcement active</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Scheduled Events" endpoint="/live-events/events?status=scheduled" />
        <HOSTable title="Live Now" endpoint="/live-events/events?status=live" />
        <HOSTable title="Audit Log" endpoint="/live-events/audit" />
      </div>
    </div>
  );
};

export default HOSLiveEvents;
