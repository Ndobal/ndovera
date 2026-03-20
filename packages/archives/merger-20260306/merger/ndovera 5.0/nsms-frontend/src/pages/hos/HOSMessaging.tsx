import React, { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';
import api from '../../api/backend';

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

const HOSMessaging: React.FC = () => {
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
    <div className="hos-page">
      <GlassCard title="HOS Messaging Control">
        <p className="text-muted">
          Final authority for school-wide broadcasts, moderation, and compliance overrides.
        </p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Conversation Health</h3>
          <ul className="card-list">
            <li>Active threads: {stats.active_threads}</li>
            <li>Unread queue: {stats.unread}</li>
            <li>Messages today: {stats.messages_today}</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Broadcast Control</h3>
          <ul className="card-list">
            <li>Broadcasts: {stats.broadcasts}</li>
            <li>PTA channel: Active</li>
            <li>School alerts: 2 queued</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Compliance Mode</h3>
          <ul className="card-list">
            <li>Encrypted logs</li>
            <li>Legal access layer enabled</li>
            <li>Warrant verification: Required</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Active Threads" endpoint="/messaging/threads" />
        <HOSTable title="Latest Messages" endpoint="/messaging/messages" />
        <HOSTable title="Audit Log" endpoint="/messaging/audit" />
      </div>
    </div>
  );
};

export default HOSMessaging;
