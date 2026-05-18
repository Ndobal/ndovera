import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import parentConfig from './config/parentConfig';
import { ParentResultView } from '../../features/results-engine';
import { ParentFarmingMode } from '../../features/auras';
import ParentMaterialsPage from '../../features/classroom/ParentMaterialsPage';
import LessonPlanViewerPage from '../../features/lesson-plans/LessonPlanViewerPage';
import useFeatureFlags from '../../shared/hooks/useFeatureFlags';

export default function ParentDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = parentConfig.sections[sectionKey];
  const { featureFlags } = useFeatureFlags();

  if (!section) {
    return <Navigate to="/roles/parent" replace />;
  }

  if (sectionKey === 'results') {
    return <ParentResultView />;
  }

  if (sectionKey === 'materials') {
    return <ParentMaterialsPage />;
  }

  if (sectionKey === 'lesson-plans') {
    return (
      <LessonPlanViewerPage
        dashboardLabel="Parent Dashboard"
        title="Lesson Plans"
        subtitle="Review approved lesson plans that teachers have shared for your child."
        watermarkText="Parent Lesson Plans"
        emptyMessage="Approved lesson plans shared with parents will appear here automatically."
      />
    );
  }

  if (sectionKey === 'auras' && !featureFlags.aurasEnabled) {
    return (
      <RoleSectionPage
        roleTitle={parentConfig.roleTitle}
        sectionTitle="Auras Wallet"
        sectionSubtitle="Auras is currently disabled by AMI governance for this school."
        watermark={parentConfig.watermark}
        metricCards={[]}
        infoCards={[{ title: 'Feature Disabled', items: [{ text: 'AMI must enable Auras before parents can access the wallet.' }] }]}
      />
    );
  }

  if (sectionKey === 'farmingmode') {
    if (!featureFlags.farmingModeEnabled) {
      return (
        <RoleSectionPage
          roleTitle={parentConfig.roleTitle}
          sectionTitle="Farming Mode"
          sectionSubtitle="Farming mode is currently disabled by AMI governance for this school."
          watermark={parentConfig.watermark}
          metricCards={[]}
          infoCards={[{ title: 'Feature Disabled', items: [{ text: 'AMI must enable farming mode before parents can use it.' }] }]}
        />
      );
    }
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
