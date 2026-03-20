import React, { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import TableCard from '../components/TableCard';
import api from '../api/backend';

interface MessagingStats {
  active_threads: number;
  messages_today: number;
  group_chats: number;
  unread: number;
  broadcasts: number;
}

const fallbackStats: MessagingStats = {
  active_threads: 0,
  messages_today: 0,
  group_chats: 0,
  unread: 0,
  broadcasts: 0,
};

const OwnerMessaging: React.FC = () => {
  const [stats, setStats] = useState<MessagingStats>(fallbackStats);

  useEffect(() => {
    let mounted = true;
    api
      .get<MessagingStats>('/messaging/dashboard-stats')
      .then((data) => mounted && setStats(data))
      .catch(() => mounted && setStats(fallbackStats));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="dashboard-page">
      <GlassCard title="Unified Messaging (NdoChat)">
        <p className="text-muted">
          Encrypted school-wide communication hub with role-based access, broadcasts, and live presence.
        </p>
      </GlassCard>
      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Live Traffic</h3>
          <ul className="card-list">
            <li>Active threads: {stats.active_threads}</li>
            <li>Messages today: {stats.messages_today}</li>
            <li>Unread queue: {stats.unread}</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Community Spaces</h3>
          <ul className="card-list">
            <li>Group chats: {stats.group_chats}</li>
            <li>Broadcasts: {stats.broadcasts}</li>
            <li>PTA forum: Active</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Security & Compliance</h3>
          <ul className="card-list">
            <li>End-to-end encryption</li>
            <li>Legal compliance mode</li>
            <li>Audit trail locked</li>
          </ul>
        </div>
      </div>
      <div className="tables-row">
        <TableCard title="Active Threads" endpoint="/messaging/threads" />
        <TableCard title="Latest Messages" endpoint="/messaging/messages" />
        <TableCard title="Audit Log" endpoint="/messaging/audit" />
      </div>
    </div>
  );
};

export default OwnerMessaging;
