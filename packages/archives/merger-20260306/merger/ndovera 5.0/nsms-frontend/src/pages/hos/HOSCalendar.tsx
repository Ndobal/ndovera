import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSCalendar: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="School Calendar">
        <p className="text-muted">Control term timelines, exam windows, and academic milestones.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-2">
          <h3 className="card-title">Term Timeline</h3>
          <ul className="card-list">
            <li>Term: Second Term</li>
            <li>Ends: 2026-04-05</li>
            <li>Break: 10 days</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Exam Windows</h3>
          <p className="text-muted">Upcoming exam and compilation windows.</p>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Automation Rules</h3>
          <ul className="card-list">
            <li>Auto term start: Enabled</li>
            <li>Auto term end: Enabled</li>
            <li>Result window: 7 days</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Active Term Schedule" endpoint="/hos/calendar" />
        <HOSTable title="Upcoming Academic Events" endpoint="/hos/calendar/events" />
        <HOSTable title="Session Timeline" endpoint="/hos/calendar/sessions" />
      </div>
    </div>
  );
};

export default HOSCalendar;
