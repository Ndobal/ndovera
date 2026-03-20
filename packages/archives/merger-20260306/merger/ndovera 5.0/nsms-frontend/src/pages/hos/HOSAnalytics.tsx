import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSAnalytics: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Analytics">
        <p className="text-muted">Operational KPIs, performance trends, and insights.</p>
      </GlassCard>
      <div className="hos-charts">
        <div className="card card-tone-2">
          <h3 className="card-title">Attendance Trend</h3>
          <p className="text-muted">Daily attendance averages and variance.</p>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Fee Collection Trend</h3>
          <p className="text-muted">Week-over-week fee collections.</p>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">LAMS Engagement</h3>
          <p className="text-muted">Active users and redemption volumes.</p>
        </div>
      </div>
    </div>
  );
};

export default HOSAnalytics;
