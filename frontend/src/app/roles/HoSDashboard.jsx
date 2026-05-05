import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { HoSResultAnalytics } from '../../features/results-engine';
import RoleLibrary from '../RoleLibrary';
import HoSOverview from './hos/HoSOverview';
import HoSTeacherReview from './hos/HoSTeacherReview';
import HoSTimetable from './hos/HoSTimetable';
import HoSDiscipline from './hos/HoSDiscipline';
import HoSExams from './hos/HoSExams';
import HoSApprovals from './hos/HoSApprovals';
import HoSReports from './hos/HoSReports';
import HoSMessaging from './hos/HoSMessaging';
import HoSSettings from './hos/HoSSettings';
import HoSPayroll from './hos/HoSPayroll';
import OwnerAttendance from './owner/OwnerAttendance';

export default function HoSDashboard({ auth = null }) {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';

  switch (sectionKey) {
    case 'overview': return <HoSOverview auth={auth} />;
    case 'academics': return <HoSResultAnalytics />;
    case 'attendance': return <OwnerAttendance auth={auth} />;
    case 'teacher-review': return <HoSTeacherReview auth={auth} />;
    case 'timetable': return <HoSTimetable />;
    case 'discipline': return <HoSDiscipline auth={auth} />;
    case 'exams': return <HoSExams auth={auth} />;
    case 'approvals': return <HoSApprovals auth={auth} />;
    case 'reports': return <HoSReports auth={auth} />;
    case 'messaging': return <HoSMessaging auth={auth} />;
    case 'settings': return <HoSSettings auth={auth} />;
    case 'payroll': return <HoSPayroll auth={auth} />;
    case 'library': return <RoleLibrary />;
    default: return <Navigate to="/roles/hos" replace />;
  }
}
