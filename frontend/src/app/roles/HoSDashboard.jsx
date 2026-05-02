import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import hosConfig from './config/hosConfig';
import { HoSResultAnalytics } from '../../features/results-engine';

export default function HoSDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = hosConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/hos" replace />;
  }

  if (sectionKey === 'academics' || sectionKey === 'exams' || sectionKey === 'reports') {
    return <HoSResultAnalytics />;
  }

  return (
    <RoleSectionPage
      roleTitle={hosConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={hosConfig.watermark}
      metricCards={section.cards || []}
      infoCards={section.panels || []}
    />
  );
}
