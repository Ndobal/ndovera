import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

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

const roleLabels = {
  student: 'Student Dashboard',
  parent: 'Parent Dashboard',
  teacher: 'Teacher Dashboard',
  hos: 'HoS Dashboard',
  accountant: 'Accountant Dashboard',
  owner: 'Owner Dashboard',
  librarian: 'Librarian Dashboard',
  sanitation: 'Sanitation Dashboard',
  tuckshopmanager: 'Tuck Shop Dashboard',
  storekeeper: 'Store Dashboard',
  transport: 'Transport Dashboard',
  hostel: 'Hostel Dashboard',
  cafeteria: 'Cafeteria Dashboard',
  clinic: 'Clinic Dashboard',
  ict: 'ICT Dashboard',
  classteacher: 'Class Teacher Dashboard',
  hod: 'HOD Dashboard',
  hodassistant: 'HOD Assistant Dashboard',
  principal: 'Principal Dashboard',
  headteacher: 'Head Teacher Dashboard',
  nurseryhead: 'Nursery Head Dashboard',
  examofficer: 'Exam Officer Dashboard',
  sportsmaster: 'Sports Master Dashboard',
  ami: 'Ami Dashboard',
};

function getRoleSidebarItems(roleKey) {
  // library entry lives inside each role context
  const libEntry = { name: 'Library', path: `/roles/${roleKey}/library` };

  if (roleKey === 'student') {
    return [
      { name: 'Overview', path: '/roles/student' },
      { name: 'Classroom', path: '/roles/student/classroom' },
      { name: 'Assignments', path: '/roles/student/assignments' },
      { name: 'Materials', path: '/roles/student/materials' },
      { name: 'Practice', path: '/roles/student/practice' },
      { name: 'Exams', path: '/roles/student/exams' },
      { name: 'Results', path: '/roles/student/results' },
      { name: 'Attendance', path: '/roles/student/attendance' },
      { name: 'Tuck Shop', path: '/roles/student/tuck-shop' },
      { name: 'Professor Vera', path: '/roles/student/professor-vera' },
      { name: 'Messaging', path: '/roles/student/messaging' },
      { name: 'Settings', path: '/roles/student/settings' },
      libEntry,
    ];
  }

  if (roleKey === 'parent') {
    return [
      { name: 'Overview', path: '/roles/parent' },
      { name: 'Classroom', path: '/roles/parent/classroom' },
      { name: 'Materials', path: '/roles/parent/materials' },
      { name: 'Practice', path: '/roles/parent/practice' },
      { name: 'Live', path: '/roles/parent/live' },
      { name: 'Children', path: '/roles/parent/children' },
      { name: 'Performance', path: '/roles/parent/performance' },
      { name: 'Exams', path: '/roles/parent/exams' },
      { name: 'Results', path: '/roles/parent/results' },
      { name: 'Assignments', path: '/roles/parent/assignments' },
      { name: 'Attendance', path: '/roles/parent/attendance' },
      { name: 'Fees & Receipts', path: '/roles/parent/fees' },
      { name: 'Tuck Shop', path: '/roles/parent/tuck-shop' },
      { name: 'Professor Vera', path: '/roles/parent/professor-vera' },
      { name: 'PTA Attendance', path: '/roles/parent/pta' },
      { name: 'Messaging', path: '/roles/parent/messaging' },
      { name: 'Auras Wallet', path: '/roles/parent/auras' },
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
      libEntry,
    ];
  }

  if (roleKey === 'hos') {
    return [
      { name: 'Overview', path: '/roles/hos' },
      { name: 'Academics', path: '/roles/hos/academics' },
      { name: 'Attendance', path: '/roles/hos/attendance' },
      { name: 'Teacher Review', path: '/roles/hos/teacher-review' },
      { name: 'Timetable', path: '/roles/hos/timetable' },
      { name: 'Discipline', path: '/roles/hos/discipline' },
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
      { name: 'Academics', path: '/roles/owner/academics' },
      { name: 'People', path: '/roles/owner/people' },
      { name: 'Compliance', path: '/roles/owner/compliance' },
      { name: 'Approvals', path: '/roles/owner/approvals' },
      { name: 'Reports', path: '/roles/owner/reports' },
      { name: 'Settings', path: '/roles/owner/settings' },
      libEntry,
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
      libEntry,
    ];
  }

  if (roleKey === 'transport') {
    return [
      { name: 'Overview', path: '/roles/transport' },
      { name: 'Routes', path: '/roles/transport/routes' },
      { name: 'Attendance', path: '/roles/transport/attendance' },
      { name: 'Fleet', path: '/roles/transport/fleet' },
      { name: 'Incidents', path: '/roles/transport/incidents' },
      { name: 'Reports', path: '/roles/transport/reports' },
      { name: 'Settings', path: '/roles/transport/settings' },
      libEntry,
    ];
  }

  if (roleKey === 'hostel') {
    return [
      { name: 'Overview', path: '/roles/hostel' },
      { name: 'Rooms', path: '/roles/hostel/rooms' },
      { name: 'Attendance', path: '/roles/hostel/attendance' },
      { name: 'Welfare', path: '/roles/hostel/welfare' },
      { name: 'Incidents', path: '/roles/hostel/incidents' },
      { name: 'Reports', path: '/roles/hostel/reports' },
      { name: 'Settings', path: '/roles/hostel/settings' },
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
      libEntry,
    ];
  }

  if (roleKey === 'clinic') {
    return [
      { name: 'Overview', path: '/roles/clinic' },
      { name: 'Patients', path: '/roles/clinic/patients' },
      { name: 'Visits', path: '/roles/clinic/visits' },
      { name: 'Medication', path: '/roles/clinic/medication' },
      { name: 'Emergencies', path: '/roles/clinic/emergencies' },
      { name: 'Reports', path: '/roles/clinic/reports' },
      { name: 'Settings', path: '/roles/clinic/settings' },
      libEntry,
    ];
  }

  if (roleKey === 'ict') {
    return [
      { name: 'Overview', path: '/roles/ict' },
      { name: 'Support', path: '/roles/ict/support' },
      { name: 'Systems', path: '/roles/ict/systems' },
      { name: 'Access', path: '/roles/ict/access' },
      { name: 'Assets', path: '/roles/ict/assets' },
      { name: 'Reports', path: '/roles/ict/reports' },
      { name: 'Settings', path: '/roles/ict/settings' },
      libEntry,
    ];
  }

  if (roleKey === 'classteacher') {
    return [
      { name: 'Overview', path: '/roles/classteacher' },
      { name: 'Attendance', path: '/roles/classteacher/attendance' },
      { name: 'Behavior', path: '/roles/classteacher/behavior' },
      { name: 'Assignments', path: '/roles/classteacher/assignments' },
      { name: 'Messaging', path: '/roles/classteacher/messaging' },
      { name: 'Reports', path: '/roles/classteacher/reports' },
      { name: 'Settings', path: '/roles/classteacher/settings' },
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
      libEntry,
    ];
  }

  if (roleKey === 'ami') {
    return [
      { name: 'Overview', path: '/roles/ami' },
      { name: 'Tenants', path: '/roles/ami/tenants' },
      { name: 'Security', path: '/roles/ami/security' },
      { name: 'Policies', path: '/roles/ami/policies' },
      { name: 'Audits', path: '/roles/ami/audits' },
      { name: 'Reports', path: '/roles/ami/reports' },
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

export default function Sidebar() {
  const location = useLocation();
  const inRoleMode = location.pathname.startsWith('/roles/');
  const roleKey = inRoleMode ? location.pathname.split('/')[2] : null;
  const sidebarItemsRaw = inRoleMode && roleKey ? getRoleSidebarItems(roleKey) : defaultSidebarItems;
  const adminEntry = { name: 'Library Admin', path: '/library/admin' };
  const adminRoles = new Set(['hos', 'owner', 'admin', 'librarian', 'teacher']);
  const sidebarItems = (roleKey && adminRoles.has(roleKey)) ? [...sidebarItemsRaw, adminEntry] : sidebarItemsRaw;
  const nodeTitle = inRoleMode && roleKey ? roleLabels[roleKey] || 'Role Dashboard' : 'Institution Dashboard';

  return (
    <aside className="w-64 h-full overflow-y-auto bg-white border-r border-slate-200 dark:border-indigo-500/20 frost-panel">
      <div className="p-6">
        <p className="micro-label text-slate-500 neon-subtle mb-2">{nodeTitle}</p>
        <div className="font-black tracking-tighter text-xl text-indigo-700 dark:text-indigo-300">NDOVERA</div>
      </div>
      <ul>
        {sidebarItems.map(item => (
          <li key={item.path}>
            {item.path.includes('#') ? (
              <a
                href={item.path}
                className={`block px-6 py-3 rounded-2xl text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-slate-900 dark:hover:bg-indigo-500/20 dark:hover:text-white transition-colors${item.name === 'Overview' ? ' sidebar-overview' : ''}`}
              >
                {item.name}
              </a>
            ) : (
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  isActive
                    ? `sidebar-item-active block px-6 py-3 rounded-2xl font-semibold${item.name === 'Overview' ? ' sidebar-overview' : ''}`
                    : `block px-6 py-3 rounded-2xl text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-slate-900 dark:hover:bg-indigo-500/20 dark:hover:text-white transition-colors${item.name === 'Overview' ? ' sidebar-overview' : ''}`
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
  );
}
