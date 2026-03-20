import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSClasses: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Classes & Sections">
        <p className="text-muted">Manage classes, sections, and staffing allocations.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-1">
          <h3 className="card-title">Class Capacity</h3>
          <ul className="card-list">
            <li>JSS1: 120/140</li>
            <li>JSS2: 112/140</li>
            <li>SS1: 96/120</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Section Assignments</h3>
          <p className="text-muted">Section heads and class teachers overview.</p>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Timetable Status</h3>
          <ul className="card-list">
            <li>Timetable compliance: 98%</li>
            <li>Pending adjustments: 3</li>
            <li>Next review: Monday</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSClasses;
