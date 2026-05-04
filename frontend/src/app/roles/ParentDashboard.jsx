import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import parentConfig from './config/parentConfig';
import { ParentResultView } from '../../features/results-engine';
import { ParentFarmingMode } from '../../features/auras';

export default function ParentDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = parentConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/parent" replace />;
  }

  if (sectionKey === 'results') {
    return <ParentResultView />;
  }


  if (sectionKey === 'farmingmode') {
    return <ParentFarmingMode />;
  }

  return (
    <RoleSectionPage
      roleTitle={parentConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={parentConfig.watermark}
      metricCards={[]}
      infoCards={section.panels || []}
    />
  );
}
