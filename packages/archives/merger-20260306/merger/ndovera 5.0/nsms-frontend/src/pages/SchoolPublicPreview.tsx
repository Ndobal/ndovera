import React from 'react';
import GlassCard from '../components/GlassCard';

const SchoolPublicPreview: React.FC = () => {
  return (
    <>
      <GlassCard title="School Public Website Preview">
        <p className="text-muted">
          This panel will render the selected no-code template (Home, About, Staff, Events, Gallery, Contact)
          for the school public site.
        </p>
      </GlassCard>
      <GlassCard title="Enrollment Form (Preview)">
        <p className="text-muted">
          A public enrollment form will post submissions into the HOS dashboard for approval. This is a
          static placeholder for now.
        </p>
      </GlassCard>
    </>
  );
};

export default SchoolPublicPreview;
