import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSWebsite: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="School Website">
        <p className="text-muted">Manage templates, content approvals, and publishing.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-1">
          <h3 className="card-title">Template Control</h3>
          <ul className="card-list">
            <li>Active template: Horizon</li>
            <li>Pending changes: 2</li>
            <li>Next publish window: Today</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Content Approvals</h3>
          <p className="text-muted">Gallery uploads and announcements awaiting approval.</p>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Admissions Portal</h3>
          <ul className="card-list">
            <li>Form status: Live</li>
            <li>Language packs: 2 active</li>
            <li>Pending submissions: 18</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSWebsite;
