import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSStudents: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Students">
        <p className="text-muted">Admissions, attendance, discipline, and welfare overview.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-4">
          <h3 className="card-title">Admissions Pipeline</h3>
          <ul className="card-list">
            <li>18 applications in review</li>
            <li>5 interviews scheduled</li>
            <li>2 scholarships pending</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Attendance Monitor</h3>
          <p className="text-muted">Daily attendance and late arrivals by class.</p>
        </div>
        <div className="card card-tone-7">
          <h3 className="card-title">Welfare & Discipline</h3>
          <ul className="card-list">
            <li>3 counseling sessions this week</li>
            <li>1 discipline review meeting</li>
            <li>0 open safety incidents</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSStudents;
