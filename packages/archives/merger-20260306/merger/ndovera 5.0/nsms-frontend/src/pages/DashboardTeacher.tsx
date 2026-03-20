import React from 'react';
import GlassCard from '../components/GlassCard';
import { useI18n } from '../context/I18nContext';

const DashboardTeacher: React.FC = () => {
  const { t } = useI18n();

  return (
    <>
      <GlassCard title={t('dashboard')}>
        <p>{t('welcomeTeacher')}</p>
        <p className="text-muted">Teacher view: attendance, grades, assignments, and notifications.</p>
      </GlassCard>
      <div className="card-grid-2">
        <GlassCard title="Attendance">
          <p className="text-muted">List of today&apos;s classes and offline-capable marking UI.</p>
        </GlassCard>
        <GlassCard title="Grades & Assignments">
          <p className="text-muted">Recent assessments and assignment status.</p>
        </GlassCard>
      </div>
    </>
  );
};

export default DashboardTeacher;
