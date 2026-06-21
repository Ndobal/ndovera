import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { XMarkIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import useFeatureFlags from '../hooks/useFeatureFlags';
import { getTenantPwaInfo } from '../hooks/useTenantPwaManifest';
import StaffSubmissionPanel from '../../features/submissions/StaffSubmissionPanel';

const noop = () => {};

const defaultSidebarItems = [
  { name: 'Dashboard', path: '/' },
  { name: 'Classroom', path: '/classroom' },
  { name: 'Assignments', path: '/assignments' },
  { name: 'Exams', path: '/exams' },
  { name: 'AI Tutor', path: '/ai-tutor' },
  { name: 'Attendance', path: '/attendance' },
  { name: 'Rewards', path: '/rewards' },
  { name: 'Teacher Tuck Shop', path: '/roles/teacher/tuck-shop' },
  { name: 'Class Teacher Tuck Shop', path: '/roles/classteacher/tuck-shop' },
  { name: 'Settings', path: '/settings' },
];

const staffAiEligibleRoles = new Set([
  'hos',
  'accountant',
  'teacher',
  'librarian',
  'sanitation',
  'tuckshopmanager',
  'storekeeper',
  'transport',
  'hostel',
  'cafeteria',
  'clinic',
  'ict',
  'ict_manager',
  'classteacher',
  'hod',
  'hodassistant',
  'principal',
  'headteacher',
  'nurseryhead',
  'examofficer',
  'sportsmaster',
]);

// Staff roles that can submit work (documents, PDFs, audios, exam questions).
const SUBMISSION_ROLES = new Set([
  'teacher', 'hos', 'owner', 'admin', 'accountant', 'librarian', 'ict', 'ict_manager',
  'classteacher', 'hod', 'hodassistant', 'principal', 'headteacher', 'nurseryhead', 'examofficer', 'sportsmaster',
]);

export function getRoleSidebarItems(roleKey) {
  const items = buildRoleSidebarItems(roleKey);
  if (SUBMISSION_ROLES.has(roleKey) && !items.some(item => item.path === '#submit-work')) {
    const settingsIndex = items.findIndex(item => String(item.path || '').endsWith('/settings'));
    const insertAt = settingsIndex >= 0 ? settingsIndex : items.length;
    return [...items.slice(0, insertAt), { name: 'Submit Work', path: '#submit-work' }, ...items.slice(insertAt)];
  }
  return items;
}

function buildRoleSidebarItems(roleKey) {
  // library entry lives inside each role context
  const libEntry = { name: 'Library', path: `/roles/${roleKey}/library` };

  if (roleKey === 'admin') {
    return [
      { name: 'Overview', path: '/roles/admin' },
      { name: 'Library Admin', path: '/library/admin' },
    ];
  }

  if (roleKey === 'student') {
    return [
      { name: 'Overview', path: '/roles/student' },
      { name: 'Classroom', path: '/roles/student/classroom' },
      { name: 'Assignments', path: '/roles/student/assignments' },
      { name: 'Materials', path: '/roles/student/materials' },
      { name: 'Lesson Plans', path: '/roles/student/lesson-plans' },
      { name: 'Practice', path: '/roles/student/practice' },
      { name: 'Exams', path: '/roles/student/exams' },
      { name: 'Results', path: '/roles/student/results' },
      { name: 'Timetable', path: '/roles/student/timetable' },
      { name: 'Attendance', path: '/roles/student/attendance' },
      { name: 'Tuck Shop', path: '/roles/student/tuck-shop' },
      { name: 'Ndovera AI', path: '/roles/student/professor-vera' },
      { name: 'Messaging', path: '/roles/student/messaging' },
      { name: 'Settings', path: '/roles/student/settings' },
      libEntry,
    ];
  }

  if (roleKey === 'parent') {
    return [
      { name: 'Overview', path: '/roles/parent' },
      { name: 'Children', path: '/roles/parent/children' },
      { name: 'Classroom', path: '/roles/parent/classroom' },
      { name: 'Materials', path: '/roles/parent/materials' },
      { name: 'Live', path: '/roles/parent/live' },
      { name: 'Exams', path: '/roles/parent/exams' },
      { name: 'Results', path: '/roles/parent/results' },
      { name: 'Assignments', path: '/roles/parent/assignments' },
      { name: 'Attendance', path: '/roles/parent/attendance' },
      { name: 'Fees & Receipts', path: '/roles/parent/fees' },
      { name: 'Tuck Shop', path: '/roles/parent/tuck-shop' },
      { name: 'Ndovera AI', path: '/roles/parent/professor-vera' },
      { name: 'PTA Attendance', path: '/roles/parent/pta' },
      { name: 'Messaging', path: '/roles/parent/messaging' },
      { name: 'Newsroom', path: '/roles/parent/newsroom' },
      { name: 'Settings', path: '/roles/parent/settings' },
      libEntry,
    ];
  }

  if (roleKey === 'teacher') {
    return [
      { name: 'Overview', path: '/roles/teacher' },
      { name: 'Classroom', path: '/roles/teacher/classroom' },
      { name: 'Materials', path: '/roles/teacher/materials' },
      { name: 'Practice', path: '/roles/teacher/practice' },
      { name: 'Assignments', path: '/roles/teacher/assignments' },
      { name: 'Live', path: '/roles/teacher/live' },
      { name: 'Timetable', path: '/roles/teacher/timetable' },
      { name: 'Attendance', path: '/roles/teacher/attendance' },
      { name: 'Subject Scores', path: '/roles/teacher/scores' },
      { name: 'Offline CA', path: '/roles/teacher/offline-ca' },
      { name: 'Lesson Notes', path: '/roles/teacher/lesson-notes' },
      { name: 'Lesson Plan', path: '/roles/teacher/lesson-plan' },
      { name: 'Exams', path: '/roles/teacher/exams' },
      { name: 'Auras', path: '/roles/teacher/auras' },
      { name: 'AI Assistant', path: '/roles/teacher/ai-assistant' },
      { name: 'Messaging', path: '/roles/teacher/messaging' },
      { name: 'Farming Mode', path: '/roles/teacher/farming' },
      { name: 'Reports', path: '/roles/teacher/reports' },
      { name: 'Settings', path: '/roles/teacher/settings' },
      { name: 'Payslip', path: '/roles/teacher/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'hos') {
    return [
      { name: 'Overview', path: '/roles/hos' },
      { name: 'People', path: '/roles/hos/people' },
      { name: 'Academics', path: '/roles/hos/academics' },
      { name: 'Admissions', path: '/roles/hos/admissions' },
      { name: 'Classroom', path: '/roles/hos/classroom' },
      { name: 'Attendance', path: '/roles/hos/attendance' },
      { name: 'Payroll', path: '/roles/hos/payroll' },
      { name: 'Teacher Review', path: '/roles/hos/teacher-review' },
      { name: 'Timetable', path: '/roles/hos/timetable' },
      { name: 'Discipline', path: '/roles/hos/discipline' },
      { name: 'Audit Trail', path: '/roles/hos/audits' },
      { name: 'Exams', path: '/roles/hos/exams' },
      { name: 'Approvals', path: '/roles/hos/approvals' },
      { name: 'Reports', path: '/roles/hos/reports' },
      { name: 'Messaging', path: '/roles/hos/messaging' },
      { name: 'Settings', path: '/roles/hos/settings' },
      libEntry,
    ];
  }

  if (roleKey === 'accountant') {
    return [
      { name: 'Overview', path: '/roles/accountant' },
      { name: 'Fees', path: '/roles/accountant/fees' },
      { name: 'Receipts', path: '/roles/accountant/receipts' },
      { name: 'Expenses', path: '/roles/accountant/expenses' },
      { name: 'Payroll', path: '/roles/accountant/payroll' },
      { name: 'Reconciliation', path: '/roles/accountant/reconciliation' },
      { name: 'Tuck Shop', path: '/roles/accountant/tuck-shop' },
      { name: 'Auras', path: '/roles/accountant/auras' },
      { name: 'Reports', path: '/roles/accountant/reports' },
      { name: 'Settings', path: '/roles/accountant/settings' },
      libEntry,
    ];
  }

  if (roleKey === 'owner') {
    return [
      { name: 'Overview', path: '/roles/owner' },
      { name: 'Schools', path: '/roles/owner/schools' },
      { name: 'Finance', path: '/roles/owner/finance' },
      { name: 'Payroll', path: '/roles/owner/payroll' },
      { name: 'Admissions', path: '/roles/owner/admissions' },
      { name: 'Classroom', path: '/roles/owner/classroom' },
      { name: 'Attendance', path: '/roles/owner/attendance' },
      { name: 'Academics', path: '/roles/owner/academics' },
      { name: 'People', path: '/roles/owner/people' },
      { name: 'Messaging', path: '/roles/owner/messaging' },
      { name: 'Compliance', path: '/roles/owner/compliance' },
      { name: 'Audit Trail', path: '/roles/owner/audits' },
      { name: 'Approvals', path: '/roles/owner/approvals' },
      { name: 'Reports', path: '/roles/owner/reports' },
      { name: 'Settings', path: '/roles/owner/settings' },
      { name: 'Library Admin', path: '/roles/owner/library-admin' },
    ];
  }

  if (roleKey === 'librarian') {
    return [
      { name: 'Overview', path: '/roles/librarian' },
      { name: 'Catalogue', path: '/roles/librarian/catalogue' },
      { name: 'Borrowing', path: '/roles/librarian/borrowing' },
      { name: 'Returns', path: '/roles/librarian/returns' },
      { name: 'Digital Library', path: '/roles/librarian/digital-library' },
      { name: 'Reports', path: '/roles/librarian/reports' },
      { name: 'Settings', path: '/roles/librarian/settings' },
      { name: 'Payslip', path: '/roles/librarian/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'sanitation') {
    return [
      { name: 'Overview', path: '/roles/sanitation' },
      { name: 'Inspections', path: '/roles/sanitation/inspections' },
      { name: 'Schedule', path: '/roles/sanitation/schedule' },
      { name: 'Incidents', path: '/roles/sanitation/incidents' },
      { name: 'Reports', path: '/roles/sanitation/reports' },
      { name: 'Settings', path: '/roles/sanitation/settings' },
      { name: 'Payslip', path: '/roles/sanitation/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'tuckshopmanager') {
    return [
      { name: 'Overview', path: '/roles/tuckshopmanager' },
      { name: 'Orders', path: '/roles/tuckshopmanager/orders' },
      { name: 'Inventory', path: '/roles/tuckshopmanager/inventory' },
      { name: 'Pricing', path: '/roles/tuckshopmanager/pricing' },
      { name: 'Sales', path: '/roles/tuckshopmanager/sales' },
      { name: 'Reports', path: '/roles/tuckshopmanager/reports' },
      { name: 'Settings', path: '/roles/tuckshopmanager/settings' },
      { name: 'Payslip', path: '/roles/tuckshopmanager/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'storekeeper') {
    return [
      { name: 'Overview', path: '/roles/storekeeper' },
      { name: 'Receiving', path: '/roles/storekeeper/receiving' },
      { name: 'Requisitions', path: '/roles/storekeeper/requisitions' },
      { name: 'Inventory', path: '/roles/storekeeper/inventory' },
      { name: 'Audits', path: '/roles/storekeeper/audits' },
      { name: 'Reports', path: '/roles/storekeeper/reports' },
      { name: 'Settings', path: '/roles/storekeeper/settings' },
      { name: 'Payslip', path: '/roles/storekeeper/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'transport') {
    return [
      { name: 'Overview', path: '/roles/transport' },
      { name: 'Admissions', path: '/roles/transport/admissions' },
      { name: 'Routes', path: '/roles/transport/routes' },
      { name: 'Attendance', path: '/roles/transport/attendance' },
      { name: 'Fleet', path: '/roles/transport/fleet' },
      { name: 'Incidents', path: '/roles/transport/incidents' },
      { name: 'Reports', path: '/roles/transport/reports' },
      { name: 'Settings', path: '/roles/transport/settings' },
      { name: 'Payslip', path: '/roles/transport/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'hostel') {
    return [
      { name: 'Overview', path: '/roles/hostel' },
      { name: 'Admissions', path: '/roles/hostel/admissions' },
      { name: 'Rooms', path: '/roles/hostel/rooms' },
      { name: 'Attendance', path: '/roles/hostel/attendance' },
      { name: 'Welfare', path: '/roles/hostel/welfare' },
      { name: 'Incidents', path: '/roles/hostel/incidents' },
      { name: 'Reports', path: '/roles/hostel/reports' },
      { name: 'Settings', path: '/roles/hostel/settings' },
      { name: 'Payslip', path: '/roles/hostel/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'cafeteria') {
    return [
      { name: 'Overview', path: '/roles/cafeteria' },
      { name: 'Menu', path: '/roles/cafeteria/menu' },
      { name: 'Service', path: '/roles/cafeteria/service' },
      { name: 'Inventory', path: '/roles/cafeteria/inventory' },
      { name: 'Hygiene', path: '/roles/cafeteria/hygiene' },
      { name: 'Reports', path: '/roles/cafeteria/reports' },
      { name: 'Settings', path: '/roles/cafeteria/settings' },
      { name: 'Payslip', path: '/roles/cafeteria/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'clinic') {
    return [
      { name: 'Overview', path: '/roles/clinic' },
      { name: 'Admissions', path: '/roles/clinic/admissions' },
      { name: 'Patients', path: '/roles/clinic/patients' },
      { name: 'Visits', path: '/roles/clinic/visits' },
      { name: 'Medication', path: '/roles/clinic/medication' },
      { name: 'Emergencies', path: '/roles/clinic/emergencies' },
      { name: 'Reports', path: '/roles/clinic/reports' },
      { name: 'Settings', path: '/roles/clinic/settings' },
      { name: 'Payslip', path: '/roles/clinic/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'ict' || roleKey === 'ict_manager') {
    return [
      { name: 'Overview', path: `/roles/${roleKey}` },
      { name: 'Results', path: `/roles/${roleKey}/results` },
      { name: 'People', path: `/roles/${roleKey}/people` },
      { name: 'Support', path: `/roles/${roleKey}/support` },
      { name: 'Systems', path: `/roles/${roleKey}/systems` },
      { name: 'Access', path: `/roles/${roleKey}/access` },
      { name: 'Assets', path: `/roles/${roleKey}/assets` },
      { name: 'Reports', path: `/roles/${roleKey}/reports` },
      { name: 'Settings', path: `/roles/${roleKey}/settings` },
      { name: 'Payslip', path: `/roles/${roleKey}/payslip` },
      libEntry,
    ];
  }

  if (roleKey === 'classteacher') {
    return [
      { name: 'Overview', path: '/roles/classteacher' },
      { name: 'Results', path: '/roles/classteacher/results' },
      { name: 'Attendance', path: '/roles/classteacher/attendance' },
      { name: 'Behavior', path: '/roles/classteacher/behavior' },
      { name: 'Assignments', path: '/roles/classteacher/assignments' },
      { name: 'Messaging', path: '/roles/classteacher/messaging' },
      { name: 'Reports', path: '/roles/classteacher/reports' },
      { name: 'Settings', path: '/roles/classteacher/settings' },
      { name: 'Payslip', path: '/roles/classteacher/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'hod') {
    return [
      { name: 'Overview', path: '/roles/hod' },
      { name: 'Lesson Plans', path: '/roles/hod/lessons' },
      { name: 'Assessments', path: '/roles/hod/assessments' },
      { name: 'Teachers', path: '/roles/hod/teachers' },
      { name: 'Analytics', path: '/roles/hod/analytics' },
      { name: 'Reports', path: '/roles/hod/reports' },
      { name: 'Settings', path: '/roles/hod/settings' },
      { name: 'Payslip', path: '/roles/hod/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'hodassistant') {
    return [
      { name: 'Overview', path: '/roles/hodassistant' },
      { name: 'Coordination', path: '/roles/hodassistant/coordination' },
      { name: 'Quality', path: '/roles/hodassistant/quality' },
      { name: 'Communication', path: '/roles/hodassistant/communication' },
      { name: 'Reports', path: '/roles/hodassistant/reports' },
      { name: 'Settings', path: '/roles/hodassistant/settings' },
      { name: 'Payslip', path: '/roles/hodassistant/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'principal') {
    return [
      { name: 'Overview', path: '/roles/principal' },
      { name: 'Academics', path: '/roles/principal/academics' },
      { name: 'Discipline', path: '/roles/principal/discipline' },
      { name: 'Staff', path: '/roles/principal/staff' },
      { name: 'Messaging', path: '/roles/principal/messaging' },
      { name: 'Reports', path: '/roles/principal/reports' },
      { name: 'Settings', path: '/roles/principal/settings' },
      { name: 'Payslip', path: '/roles/principal/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'headteacher') {
    return [
      { name: 'Overview', path: '/roles/headteacher' },
      { name: 'Classes', path: '/roles/headteacher/classes' },
      { name: 'Staff', path: '/roles/headteacher/staff' },
      { name: 'Welfare', path: '/roles/headteacher/welfare' },
      { name: 'Reports', path: '/roles/headteacher/reports' },
      { name: 'Settings', path: '/roles/headteacher/settings' },
      { name: 'Payslip', path: '/roles/headteacher/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'nurseryhead') {
    return [
      { name: 'Overview', path: '/roles/nurseryhead' },
      { name: 'Classes', path: '/roles/nurseryhead/classes' },
      { name: 'Welfare', path: '/roles/nurseryhead/welfare' },
      { name: 'Communication', path: '/roles/nurseryhead/communication' },
      { name: 'Reports', path: '/roles/nurseryhead/reports' },
      { name: 'Settings', path: '/roles/nurseryhead/settings' },
      { name: 'Payslip', path: '/roles/nurseryhead/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'examofficer') {
    return [
      { name: 'Overview', path: '/roles/examofficer' },
      { name: 'Timetable', path: '/roles/examofficer/timetable' },
      { name: 'Question Bank', path: '/roles/examofficer/questionbank' },
      { name: 'Invigilation', path: '/roles/examofficer/invigilation' },
      { name: 'Integrity', path: '/roles/examofficer/integrity' },
      { name: 'Reports', path: '/roles/examofficer/reports' },
      { name: 'Settings', path: '/roles/examofficer/settings' },
      { name: 'Payslip', path: '/roles/examofficer/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'sportsmaster') {
    return [
      { name: 'Overview', path: '/roles/sportsmaster' },
      { name: 'Teams', path: '/roles/sportsmaster/teams' },
      { name: 'Training', path: '/roles/sportsmaster/training' },
      { name: 'Events', path: '/roles/sportsmaster/events' },
      { name: 'Welfare', path: '/roles/sportsmaster/welfare' },
      { name: 'Reports', path: '/roles/sportsmaster/reports' },
      { name: 'Settings', path: '/roles/sportsmaster/settings' },
      { name: 'Payslip', path: '/roles/sportsmaster/payslip' },
      libEntry,
    ];
  }

  if (roleKey === 'ami') {
    return [
      { name: 'Overview', path: '/roles/ami' },
      { name: 'Tenants', path: '/roles/ami/tenants' },
      { name: 'Website', path: '/roles/ami/website' },
      { name: 'Question Bank', path: '/roles/ami/question-bank' },
      { name: 'Security', path: '/roles/ami/security' },
      { name: 'Policies', path: '/roles/ami/policies' },
      { name: 'Audits', path: '/roles/ami/audits' },
      { name: 'Reports', path: '/roles/ami/reports' },
      { name: 'Inbox', path: '/roles/ami/messaging' },
      { name: 'Settings', path: '/roles/ami/settings' },
      libEntry,
    ];
  }

  return [
    { name: 'Overview', path: `/roles/${roleKey}` },
    { name: 'Settings', path: `/roles/${roleKey}/settings` },
    libEntry,
  ];
}

export default function Sidebar({ auth = null, mobileOpen = false, onClose = noop }) {
  const location = useLocation();
  const inRoleMode = location.pathname.startsWith('/roles/');
  const roleKey = inRoleMode ? location.pathname.split('/')[2] : null;
  const { featureFlags } = useFeatureFlags();
  const [tenantBranding, setTenantBranding] = useState(() => (
    auth?.user?.tenantId && auth?.user?.role !== 'ami' ? getTenantPwaInfo() : null
  ));
  const sidebarItemsRaw = inRoleMode && roleKey ? getRoleSidebarItems(roleKey) : defaultSidebarItems;
  const sidebarItemsWithAiAssistant = roleKey && staffAiEligibleRoles.has(roleKey) && !sidebarItemsRaw.some(item => item.path === `/roles/${roleKey}/ai-assistant`)
    ? (() => {
        const aiEntry = { name: 'AI Assistant', path: `/roles/${roleKey}/ai-assistant` };
        const settingsIndex = sidebarItemsRaw.findIndex(item => String(item.path || '').endsWith('/settings'));
        const insertAt = settingsIndex >= 0 ? settingsIndex : sidebarItemsRaw.length;
        return [...sidebarItemsRaw.slice(0, insertAt), aiEntry, ...sidebarItemsRaw.slice(insertAt)];
      })()
    : sidebarItemsRaw;
  const newsroomEligibleRoles = new Set([
    'student',
    'parent',
    'teacher',
    'hos',
    'accountant',
    'owner',
    'librarian',
    'sanitation',
    'tuckshopmanager',
    'storekeeper',
    'transport',
    'hostel',
    'cafeteria',
    'clinic',
    'ict',
    'ict_manager',
    'classteacher',
    'hod',
    'hodassistant',
    'principal',
    'headteacher',
    'nurseryhead',
    'examofficer',
    'sportsmaster',
  ]);
  const sidebarItemsWithNewsroom = roleKey && newsroomEligibleRoles.has(roleKey) && !sidebarItemsWithAiAssistant.some(item => item.path === `/roles/${roleKey}/newsroom`)
    ? (() => {
        const newsroomEntry = { name: 'Newsroom', path: `/roles/${roleKey}/newsroom` };
        const settingsIndex = sidebarItemsWithAiAssistant.findIndex(item => String(item.path || '').endsWith('/settings'));
        const insertAt = settingsIndex >= 0 ? settingsIndex : sidebarItemsWithAiAssistant.length;
        return [...sidebarItemsWithAiAssistant.slice(0, insertAt), newsroomEntry, ...sidebarItemsWithAiAssistant.slice(insertAt)];
      })()
    : sidebarItemsWithAiAssistant;
  const adminEntry = { name: 'Library Admin', path: '/library/admin' };
  const adminRoles = new Set(['hos', 'admin', 'librarian', 'teacher']);
  const sidebarItems = ((roleKey && adminRoles.has(roleKey)) ? [...sidebarItemsWithNewsroom, adminEntry] : sidebarItemsWithNewsroom)
    .filter(item => {
      const normalizedPath = String(item.path || '').toLowerCase();
      if (!featureFlags.aurasEnabled && normalizedPath.includes('/auras')) return false;
      if (!featureFlags.farmingModeEnabled && (normalizedPath.includes('/farming') || normalizedPath.includes('/cashout'))) return false;
      return true;
    });
  const schoolName = tenantBranding?.schoolName || auth?.user?.schoolName || auth?.user?.tenantName || 'NDOVERA';
  const schoolLogoUrl = tenantBranding?.logoUrl || auth?.user?.logoUrl || '';
  const tenantSubdomain = tenantBranding?.subdomain || auth?.user?.subdomain || '';
  const schoolWebsiteUrl = tenantSubdomain ? `https://${tenantSubdomain}.ndovera.com` : '';
  const [submitOpen, setSubmitOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem('ndovera:sidebarCollapsed') === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed((prev) => {
    const next = !prev;
    try { window.localStorage.setItem('ndovera:sidebarCollapsed', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });

  useEffect(() => {
    if (!auth?.user?.tenantId || auth?.user?.role === 'ami') {
      setTenantBranding(null);
      return undefined;
    }

    const syncTenantBranding = () => {
      setTenantBranding(getTenantPwaInfo());
    };

    syncTenantBranding();
    window.addEventListener('storage', syncTenantBranding);
    window.addEventListener('ndovera:tenant-pwa-updated', syncTenantBranding);

    return () => {
      window.removeEventListener('storage', syncTenantBranding);
      window.removeEventListener('ndovera:tenant-pwa-updated', syncTenantBranding);
    };
  }, [auth?.user?.role, auth?.user?.tenantId]);

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1.5px] transition-opacity duration-300 md:hidden ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!mobileOpen}
      />

      {collapsed ? (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden md:flex fixed left-0 top-24 z-50 items-center rounded-r-xl border border-l-0 border-slate-200/60 bg-white/90 p-2 text-slate-700 shadow-md transition-colors hover:bg-white dark:border-indigo-500/25 dark:bg-slate-900/90 dark:text-[#f5deb3]"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <ChevronDoubleRightIcon className="h-5 w-5" />
        </button>
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[84vw] overflow-y-auto border-r border-slate-200/60 dark:border-indigo-500/20 frost-panel dashboard-bg dark:bg-transparent transform transition-all duration-300 md:static md:z-auto md:max-w-none md:translate-x-0 ${
          collapsed ? 'md:w-0 md:min-w-0 md:overflow-hidden md:border-0 md:opacity-0 md:pointer-events-none' : 'md:w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            {(() => {
              const brandInner = (
                <>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 p-1.5 dark:border-indigo-500/25 dark:bg-slate-950/40">
                    {schoolLogoUrl ? (
                      <img src={schoolLogoUrl} alt={`${schoolName} logo`} className="h-full w-full animate-[spin_18s_linear_infinite] object-contain" />
                    ) : (
                      <span className="text-lg font-black text-indigo-700 dark:text-[#f5deb3]">{String(schoolName).charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="font-black tracking-tighter text-xl text-indigo-700 dark:text-[#f5deb3]">{schoolName}</div>
                </>
              );
              return schoolWebsiteUrl ? (
                <a href={schoolWebsiteUrl} target="_blank" rel="noopener noreferrer" title={`Visit ${schoolName} website`} className="flex items-center gap-3 transition-opacity hover:opacity-80">
                  {brandInner}
                </a>
              ) : (
                <div className="flex items-center gap-3">{brandInner}</div>
              );
            })()}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden md:flex glass-chip p-2 rounded-xl text-slate-700 dark:text-[#f5deb3] hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronDoubleLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="md:hidden glass-chip p-2 rounded-xl text-slate-700 dark:text-[#f5deb3] hover:bg-white/70 dark:hover:bg-slate-700/60 transition-colors"
              aria-label="Close menu"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <ul className="pb-4">
          {sidebarItems.map(item => (
            <li key={item.path}>
              {item.path === '#submit-work' ? (
                <button
                  type="button"
                  onClick={() => { onClose(); setSubmitOpen(true); }}
                  className="block w-full text-left px-6 py-3 rounded-2xl font-semibold text-[#2447d8] dark:text-white dark:font-bold hover:bg-blue-50 dark:hover:bg-indigo-500/20 transition-colors"
                >
                  📤 {item.name}
                </button>
              ) : item.path.includes('#') ? (
                <a
                  href={item.path}
                  onClick={onClose}
                  className={`block px-6 py-3 rounded-2xl text-slate-700 dark:text-white dark:font-bold hover:bg-emerald-50 hover:text-slate-900 dark:hover:bg-indigo-500/20 dark:hover:text-white transition-colors${item.name === 'Overview' ? ' sidebar-overview' : ''}`}
                >
                  {item.name}
                </a>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    isActive
                      ? `sidebar-item-active block px-6 py-3 rounded-2xl font-semibold dark:font-bold dark:text-white${item.name === 'Overview' ? ' sidebar-overview' : ''}`
                      : `block px-6 py-3 rounded-2xl text-slate-700 dark:text-white dark:font-bold hover:bg-emerald-50 hover:text-slate-900 dark:hover:bg-indigo-500/20 dark:hover:text-white transition-colors${item.name === 'Overview' ? ' sidebar-overview' : ''}`
                  }
                  end
                >
                  {item.name}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </aside>

      {submitOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-0 sm:items-center sm:p-4" onClick={() => setSubmitOpen(false)} role="presentation">
          <div className="w-full max-w-lg" onClick={event => event.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setSubmitOpen(false)} className="rounded-full bg-white/90 p-2 text-[#191970] shadow">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <StaffSubmissionPanel role={roleKey} />
          </div>
        </div>
      ) : null}
    </>
  );
}
