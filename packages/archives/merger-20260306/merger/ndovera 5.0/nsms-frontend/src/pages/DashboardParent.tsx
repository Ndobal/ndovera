import React from 'react';
import GlassCard from '../components/GlassCard';
import { useI18n } from '../context/I18nContext';

const DashboardParent: React.FC = () => {
  const { t } = useI18n();

  return (
    <>
      <GlassCard title={t('dashboard')}>
        <p>{t('welcomeParent')}</p>
        <p className="text-muted">Parent view: child attendance, grades, and school notices.</p>
      </GlassCard>
      <div className="card-grid-2">
        <GlassCard title="Attendance & Grades">
          <p className="text-muted">Recent performance overview.</p>
        </GlassCard>
        <GlassCard title="Messages">
          <p className="text-muted">School notifications and announcements.</p>
        </GlassCard>
      </div>
    </>
  );
};

export default DashboardParent;
