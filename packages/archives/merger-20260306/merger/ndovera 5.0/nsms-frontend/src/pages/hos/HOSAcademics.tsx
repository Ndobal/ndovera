import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSAcademics: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Academics">
        <p className="text-muted">Curriculum, exams, results approval, and quality control.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Curriculum Compliance</h3>
          <ul className="card-list">
            <li>Lesson coverage: 92%</li>
            <li>Notes awaiting endorsement: 8</li>
            <li>Quality checks: 3 pending</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Exam Readiness</h3>
          <ul className="card-list">
            <li>Exam papers: 12 submitted</li>
            <li>Moderation: 5 pending</li>
            <li>Compilation window: 7 days</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Result Governance</h3>
          <ul className="card-list">
            <li>Pending approvals: 4</li>
            <li>Endorsements due: 6</li>
            <li>Revisions requested: 2</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSAcademics;
