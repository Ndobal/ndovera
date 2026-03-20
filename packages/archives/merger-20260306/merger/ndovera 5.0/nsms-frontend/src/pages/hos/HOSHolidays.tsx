import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSHolidays: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Holiday Control">
        <p className="text-muted">Set holiday windows and emergency closures. System auto-adjusts timelines.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-4">
          <h3 className="card-title">Holiday Schedule</h3>
          <ul className="card-list">
            <li>Next holiday: 2026-04-06</li>
            <li>Duration: 10 days</li>
            <li>Resumption: 2026-04-16</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Emergency Controls</h3>
          <p className="text-muted">Manage emergency closures and reopenings.</p>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Timeline Impact</h3>
          <ul className="card-list">
            <li>Exam dates auto-shifted</li>
            <li>Result window updated</li>
            <li>Promotion date pending</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Holiday Schedule" endpoint="/hos/holidays" />
        <HOSTable title="Emergency Closures" endpoint="/hos/holidays/emergency" />
        <HOSTable title="Resumption Timeline" endpoint="/hos/holidays/resumption" />
      </div>
    </div>
  );
};

export default HOSHolidays;
