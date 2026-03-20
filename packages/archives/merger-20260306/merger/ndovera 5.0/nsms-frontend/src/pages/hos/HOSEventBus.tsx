import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

interface EventBusStats {
  queued: number;
  processed: number;
  failed: number;
  audit_locked: boolean;
}

const fallbackStats: EventBusStats = {
  queued: 0,
  processed: 0,
  failed: 0,
  audit_locked: false,
};

const HOSEventBus: React.FC = () => {
  const [stats, setStats] = useState<EventBusStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<EventBusStats>('/event-bus/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="hos-page">
      <GlassCard title="HOS Event Bus Control">
        <p className="text-muted">Monitor approvals, sync events, and system-wide audit queues.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Event Queue</h3>
          <ul className="card-list">
            <li>Queued: {stats.queued}</li>
            <li>Processed: {stats.processed}</li>
            <li>Failed: {stats.failed}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Audit State</h3>
          <ul className="card-list">
            <li>Audit locked: {stats.audit_locked ? 'Yes' : 'No'}</li>
            <li>Immutable logs enabled</li>
            <li>Retention: 10 years</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Integration</h3>
          <ul className="card-list">
            <li>Sync engine</li>
            <li>Approval engine</li>
            <li>Notification engine</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Event Stream" endpoint="/event-bus/events" />
        <HOSTable title="Queued Events" endpoint="/event-bus/events?status=queued" />
        <HOSTable title="Audit Snapshot" endpoint="/event-bus/events" />
      </div>
    </div>
  );
};

export default HOSEventBus;
