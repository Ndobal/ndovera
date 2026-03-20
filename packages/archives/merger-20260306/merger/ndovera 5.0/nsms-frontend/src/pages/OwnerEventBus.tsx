import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

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

const OwnerEventBus: React.FC = () => {
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
    <div className="dashboard-page">
      <GlassCard title="Event Bus + Audit Layer">
        <p className="text-muted">Immutable event stream for sync, approvals, and system-wide audit trail.</p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Event Flow</h3>
          <ul className="card-list">
            <li>Queued: {stats.queued}</li>
            <li>Processed: {stats.processed}</li>
            <li>Failed: {stats.failed}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Audit State</h3>
          <ul className="card-list">
            <li>Audit locked: {stats.audit_locked ? 'Yes' : 'No'}</li>
            <li>Immutable logs enabled</li>
            <li>Retention: 10 years</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Integrations</h3>
          <ul className="card-list">
            <li>Sync engine</li>
            <li>Approval engine</li>
            <li>Notification engine</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Event Stream" endpoint="/event-bus/events" />
        <TableCard title="Queued Events" endpoint="/event-bus/events?status=queued" />
        <TableCard title="Audit Snapshot" endpoint="/event-bus/events" />
      </div>
    </div>
  );
};

export default OwnerEventBus;
