import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SchoolClassResults } from '../../features/results-engine';
import RoleLibrary from '../RoleLibrary';
import HoSOverview from './hos/HoSOverview';
import HoSTeacherReview from './hos/HoSTeacherReview';
import TimetableBoard from '../../features/school/components/TimetableBoard';
import HoSDiscipline from './hos/HoSDiscipline';
import HoSExams from './hos/HoSExams';
import HoSApprovals from './hos/HoSApprovals';
import HoSReports from './hos/HoSReports';
import HoSMessaging from './hos/HoSMessaging';
// HOS can do everything the Owner can except close the school or appoint an HOS,
// so it uses the Owner's settings and finance screens (the server enforces both exceptions).
import OwnerSettings from './owner/OwnerSettings';
import OwnerFinance from './owner/OwnerFinance';
import HoSPayroll from './hos/HoSPayroll';
import OwnerAttendance from './owner/OwnerAttendance';
import OwnerPeople from './owner/OwnerPeople';
import TeacherClassroom from '../../features/classroom/TeacherClassroom';
import AdmissionsManagementBoard from '../../features/school/components/AdmissionsManagementBoard';
import SchoolAuditTrailPage from '../../features/school/components/SchoolAuditTrailPage';
import SchoolNewsroomPage from '../../features/school/components/SchoolNewsroomPage';
import StaffAiAssistantPage from '../../features/ai/components/StaffAiAssistantPage';
import UpcomingEventsCard from '../../features/school/components/UpcomingEventsCard';
import { PunctualityWinnerBanner } from '../../features/attendance/punctuality/PunctualityPages';
import ComplianceCentre from '../../features/compliance/ComplianceCentre';

export default function HoSDashboard({ auth = null }) {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';

  switch (sectionKey) {
    case 'overview': return <><div className="mx-auto max-w-7xl space-y-4 px-4 pt-4 sm:px-8"><PunctualityWinnerBanner /><UpcomingEventsCard /></div><HoSOverview auth={auth} /></>;
    case 'academics': return <SchoolClassResults analyticsMode="hos" roleTitle="Head of School Dashboard" />;
    case 'attendance': return <OwnerAttendance auth={auth} />;
    case 'admissions': return <AdmissionsManagementBoard audience="hos" title="Admissions Review" subtitle="Review applicants, coordinate placement, and prepare downstream teams for onboarding." />;
    case 'classroom': return <TeacherClassroom initialTab="stream" dashboardLabel="HoS Dashboard" watermarkText="HoS Dashboard" />;
    case 'newsroom': return <SchoolNewsroomPage viewerRole="hos" dashboardLabel="HoS Dashboard" />;
    case 'teacher-review': return <HoSTeacherReview auth={auth} />;
    case 'compliance': return <ComplianceCentre dashboardLabel="Head of School" />;
    case 'ai-assistant': return <StaffAiAssistantPage roleKey="hos" roleTitle="Head of School Dashboard" />;
    case 'timetable': return <TimetableBoard />;
    case 'discipline': return <HoSDiscipline auth={auth} />;
    case 'audits': return <SchoolAuditTrailPage roleLabel="HoS dashboard" title="Live School Audit Trail" subtitle="Watch critical school actions in real time so leadership can trace who did what and when." />;
    case 'exams': return <HoSExams auth={auth} />;
    case 'approvals': return <HoSApprovals auth={auth} />;
    case 'reports': return <HoSReports auth={auth} />;
    case 'messaging': return <HoSMessaging auth={auth} />;
    case 'settings': return <OwnerSettings auth={auth} />;
    case 'finance': return <OwnerFinance auth={auth} />;
    case 'payroll': return <HoSPayroll auth={auth} />;
    case 'library': return <RoleLibrary />;
    case 'people': return <OwnerPeople />;
    default: return <Navigate to="/roles/hos" replace />;
  }
}
