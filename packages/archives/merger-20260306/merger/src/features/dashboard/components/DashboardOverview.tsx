import React from 'react';
import { UserRole } from '../../../shared/types';
import ProprietorDashboard from './ProprietorDashboard';
import HosDashboard from './HosDashboard';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import ParentDashboard from './ParentDashboard';

const DashboardOverview = ({ role }: { role: UserRole }) => {
  switch (role) {
    case UserRole.PROPRIETOR:
      return <ProprietorDashboard />;
    case UserRole.HOS:
      return <HosDashboard />;
    case UserRole.TEACHER:
      return <TeacherDashboard />;
    case UserRole.STUDENT:
      return <StudentDashboard />;
    case UserRole.PARENT:
      return <ParentDashboard />;
    default:
      return <div className="p-8">Default Dashboard for {role}</div>;
  }
};

export default DashboardOverview;

