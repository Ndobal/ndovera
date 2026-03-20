import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSSecurity: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Security">
        <p className="text-muted">Security staffing, incidents, and safety protocols.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-5">
          <h3 className="card-title">Incident Watch</h3>
          <ul className="card-list">
            <li>Current alerts: 0</li>
            <li>Last drill: 14 days ago</li>
            <li>Next review: Friday</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Guard Roster</h3>
          <p className="text-muted">Shift assignments and attendance.</p>
        </div>
        <div className="card card-tone-7">
          <h3 className="card-title">Safety Protocols</h3>
          <ul className="card-list">
            <li>Gate checks: compliant</li>
            <li>Visitor log: up to date</li>
            <li>CCTV uptime: 99%</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSSecurity;
