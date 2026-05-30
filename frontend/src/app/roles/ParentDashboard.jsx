import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import parentConfig from './config/parentConfig';
import { ParentResultView } from '../../features/results-engine';
import { ParentFarmingMode } from '../../features/auras';
import ParentMaterialsPage from '../../features/classroom/ParentMaterialsPage';
import ParentLearningBoard from '../../features/classroom/ParentLearningBoard';
import ParentFeesReceiptsPage from '../../features/school/components/ParentFeesReceiptsPage';
import ParentSettings from './parent/ParentSettings';
import useFeatureFlags from '../../shared/hooks/useFeatureFlags';
import StudentProfessorAura from './student/StudentProfessorAura';
import StudentTuckShop from './student/StudentTuckShop';
import StudentMessaging from './student/StudentMessaging';
import SchoolNewsroomPage from '../../features/school/components/SchoolNewsroomPage';
import {
  ParentAttendancePage,
  ParentChildrenPage,
  ParentClassroomPage,
  ParentExamSchedulePage,
  ParentLivePage,
  ParentOverviewPage,
  ParentPtaPage,
} from './parent/ParentWorkspacePages';

export default function ParentDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const { featureFlags } = useFeatureFlags();

  if (sectionKey === 'newsroom') {
    return <SchoolNewsroomPage viewerRole="parent" dashboardLabel="Parent Dashboard" />;
  }

  if (sectionKey === 'library') {
    return <Navigate to="/roles/parent/library" replace />;
  }

  if (sectionKey === 'performance' || sectionKey === 'practice' || sectionKey === 'lesson-plans' || sectionKey === 'auras') {
    return <Navigate to="/roles/parent" replace />;
  }

  const section = parentConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/parent" replace />;
  }

  if (sectionKey === 'overview') {
    return <ParentOverviewPage />;
  }

  if (sectionKey === 'children') {
    return <ParentChildrenPage />;
  }

  if (sectionKey === 'classroom') {
    return <ParentClassroomPage />;
  }

  if (sectionKey === 'live') {
    return <ParentLivePage />;
  }

  if (sectionKey === 'exams') {
    return <ParentExamSchedulePage />;
  }

  if (sectionKey === 'attendance') {
    return <ParentAttendancePage />;
  }

  if (sectionKey === 'results') {
    return <ParentResultView />;
  }

  if (sectionKey === 'materials') {
    return <ParentMaterialsPage />;
  }

  if (sectionKey === 'assignments') {
    return <ParentLearningBoard mode="assignments" />;
  }

  if (sectionKey === 'fees') {
    return <ParentFeesReceiptsPage />;
  }

  if (sectionKey === 'tuck-shop') {
    return (
      <StudentTuckShop
        viewerRole="parent"
        title="Tuck Shop"
        subtitle="Buy meals and added learning services from the parent account."
        dashboardLabel="Parent Dashboard"
      />
    );
  }

  if (sectionKey === 'professor-vera') {
    return (
      <StudentProfessorAura
        viewerRole="parent"
        dashboardLabel="Parent Dashboard"
        homePath="/roles/parent"
        tuckShopPath="/roles/parent/tuck-shop"
      />
    );
  }

  if (sectionKey === 'settings') {
    return <ParentSettings />;
  }

  if (sectionKey === 'messaging') {
    return (
      <StudentMessaging
        viewerRole="parent"
        dashboardLabel="Parent Dashboard"
        title="Messaging"
        subtitle="Message teachers, school admins, and helpdesk from one safe parent workspace."
      />
    );
  }

  if (sectionKey === 'pta') {
    return <ParentPtaPage />;
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
