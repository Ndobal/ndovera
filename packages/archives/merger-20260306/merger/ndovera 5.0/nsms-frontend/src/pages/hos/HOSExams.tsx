import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSExams: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Exam Control Center">
        <p className="text-muted">
          Control exam windows, compilation phases, and scoring locks from the HOS command panel.
        </p>
        <div className="quick-actions" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="quick-action">Start Exam</button>
          <button type="button" className="quick-action">End Exam</button>
          <button type="button" className="quick-action">Start Compilation</button>
          <button type="button" className="quick-action">End Compilation</button>
        </div>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-1">
          <h3 className="card-title">Exam Window</h3>
          <ul className="card-list">
            <li>Status: Ongoing</li>
            <li>Days remaining: 6</li>
            <li>Subjects active: 12</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Compilation Status</h3>
          <ul className="card-list">
            <li>Classes compiling: 5</li>
            <li>Awaiting HOS review: 3</li>
            <li>Locked: 2</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Scoring Compliance</h3>
          <p className="text-muted">Teachers allowed to submit only in active window.</p>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Exam Status" endpoint="/hos/exams" />
        <HOSTable title="Score Input Activity" endpoint="/hos/exams/activity" />
        <HOSTable title="Compilation Queue" endpoint="/hos/exams/compilation" />
      </div>
      <div className="hos-tables">
        <HOSTable title="Online Exams (AI Marking)" endpoint="/online-exams/exams" />
      </div>
    </div>
  );
};

export default HOSExams;
