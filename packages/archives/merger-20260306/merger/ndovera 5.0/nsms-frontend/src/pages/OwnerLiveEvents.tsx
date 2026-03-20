import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

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

const OwnerLiveEvents: React.FC = () => {
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
    <div className="dashboard-page">
      <GlassCard title="Live Events (YouTube Integration)">
        <p className="text-muted">Schedule, broadcast, and audit live events across school channels.</p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Event Pipeline</h3>
          <ul className="card-list">
            <li>Scheduled: {stats.scheduled}</li>
            <li>Live now: {stats.live}</li>
            <li>Completed: {stats.completed}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Engagement</h3>
          <ul className="card-list">
            <li>Reminders queued: {stats.reminders}</li>
            <li>Live chat enabled</li>
            <li>Auto-sync active</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Compliance</h3>
          <ul className="card-list">
            <li>Moderation enforced</li>
            <li>Audit trail locked</li>
            <li>Replay archive enabled</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Scheduled Events" endpoint="/live-events/events?status=scheduled" />
        <TableCard title="Live Now" endpoint="/live-events/events?status=live" />
        <TableCard title="Audit Log" endpoint="/live-events/audit" />
      </div>
    </div>
  );
};

export default OwnerLiveEvents;
