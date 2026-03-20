import React from 'react';
import GlassCard from '../components/GlassCard';
import { useI18n } from '../context/I18nContext';

const DashboardStaff: React.FC = () => {
  const { t } = useI18n();

  return (
    <>
      <GlassCard title={t('dashboard')}>
        <p>{t('welcomeStaff')}</p>
        <p className="text-muted">Staff view: hostel, transport, tuckshop, or admin operations.</p>
      </GlassCard>
      <div className="card-grid-2">
        <GlassCard title="Operations">
          <p className="text-muted">Configure per staff role. Offline events will be queued here.</p>
        </GlassCard>
        <GlassCard title="Notifications">
          <p className="text-muted">Operational notifications and tasks.</p>
        </GlassCard>
      </div>
    </>
  );
};

export default DashboardStaff;
