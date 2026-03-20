import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSTeachers: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Teachers">
        <p className="text-muted">Monitor staffing, workload, and classroom performance.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-2">
          <h3 className="card-title">Coverage Status</h3>
          <ul className="card-list">
            <li>64 active teachers</li>
            <li>3 subject gaps</li>
            <li>2 substitutes on standby</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Workload Balance</h3>
          <p className="text-muted">Track weekly teaching hours and class distribution.</p>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Performance Watch</h3>
          <ul className="card-list">
            <li>5 lesson notes pending</li>
            <li>2 CA sheets overdue</li>
            <li>Next review cycle: 7 days</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSTeachers;
