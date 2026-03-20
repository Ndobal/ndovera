import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSChart from '../../components/hos/HOSChart';

const HOSPerformance: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Performance Analytics">
        <p className="text-muted">Track academic performance trends, mastery gaps, and cohort insights.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-1">
          <h3 className="card-title">Top Performing Cohorts</h3>
          <ul className="card-list">
            <li>SS2 Science — 82% avg</li>
            <li>JSS3 — 78% avg</li>
            <li>Primary 6 — 76% avg</li>
          </ul>
        </div>
        <div className="card card-tone-5">
          <h3 className="card-title">Intervention Watch</h3>
          <ul className="card-list">
            <li>Math remediation: 24 students</li>
            <li>Reading support: 18 students</li>
            <li>Attendance intervention: 9 students</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Academic Targets</h3>
          <p className="text-muted">Targets aligned to next term objectives.</p>
        </div>
      </div>
      <div className="hos-charts">
        <HOSChart title="C.A. Performance Trend" endpoint="/hos/analytics/ca" />
        <HOSChart title="Exam Performance Trend" endpoint="/hos/analytics/exams" />
        <HOSChart title="Promotion Outcomes" endpoint="/hos/analytics/promotions" />
      </div>
    </div>
  );
};

export default HOSPerformance;
