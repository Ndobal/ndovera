import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSSanitation: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Sanitation">
        <p className="text-muted">Hygiene checks, cleaning schedules, and incident logs.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-2">
          <h3 className="card-title">Daily Hygiene Checks</h3>
          <ul className="card-list">
            <li>Inspection completed: 98%</li>
            <li>Open issues: 2</li>
            <li>Reinspection: 4pm</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Cleaning Schedule</h3>
          <p className="text-muted">Track tasks by zone and supervisor.</p>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Incident Log</h3>
          <ul className="card-list">
            <li>Water issue: resolved</li>
            <li>Waste pickup: pending</li>
            <li>Supply request: 3 items</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSSanitation;
