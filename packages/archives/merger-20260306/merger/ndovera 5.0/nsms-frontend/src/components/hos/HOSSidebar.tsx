import React from 'react';
import { NavLink } from 'react-router-dom';

const hosItems = [
  { name: 'Dashboard', route: '/hos/dashboard' },
  { name: 'Staff Management', route: '/hos/staff' },
  { name: 'Teachers', route: '/hos/teachers' },
  { name: 'Students', route: '/hos/students' },
  { name: 'Classes & Sections', route: '/hos/classes' },
  { name: 'Academics', route: '/hos/academics' },
  { name: 'Lesson Notes', route: '/hos/lesson-notes' },
  { name: 'C.A. Sheets', route: '/hos/ca-sheets' },
  { name: 'Exams', route: '/hos/exams' },
  { name: 'Results', route: '/hos/results' },
  { name: 'Promotions', route: '/hos/promotions' },
  { name: 'Performance Analytics', route: '/hos/performance-analytics' },
  { name: 'School Calendar', route: '/hos/calendar' },
  { name: 'Holidays', route: '/hos/holidays' },
  { name: 'Digital Signatures', route: '/hos/signatures' },
  { name: 'Academic Audit Log', route: '/hos/academic-audit' },
  { name: 'Hostel', route: '/hos/hostel' },
  { name: 'Transport', route: '/hos/transport' },
  { name: 'Tuck Shop', route: '/hos/tuck-shop' },
  { name: 'Store', route: '/hos/store' },
  { name: 'Sanitation', route: '/hos/sanitation' },
  { name: 'Security', route: '/hos/security' },
  { name: 'Finance', route: '/hos/finance' },
  { name: 'LAMS', route: '/hos/lams' },
  { name: 'Analytics', route: '/hos/analytics' },
  { name: 'School Website', route: '/hos/website' },
  { name: 'Media & Blog', route: '/hos/media' },
  { name: 'Staff Dropbox', route: '/hos/dropbox' },
  { name: 'Question Bank', route: '/hos/question-bank' },
  { name: 'Bulk Results', route: '/hos/bulk-results' },
  { name: 'Messaging', route: '/hos/messaging' },
  { name: 'Live Events', route: '/hos/live-events' },
  { name: 'Video Gallery', route: '/hos/video-gallery' },
  { name: 'Data Migration', route: '/hos/data-migration' },
  { name: 'Identity Engine', route: '/hos/identity' },
  { name: 'Event Bus', route: '/hos/event-bus' },
  { name: 'Approvals', route: '/hos/approvals' },
  { name: 'Settings', route: '/hos/settings' },
];

interface HOSSidebarProps {
  collapsed?: boolean;
}

const HOSSidebar: React.FC<HOSSidebarProps> = ({ collapsed }) => {
  return (
    <aside className={`hos-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="hos-sidebar-brand">HOS Console</div>
      <nav className="hos-sidebar-nav">
        {hosItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.route}
            className={({ isActive }) => `hos-sidebar-link ${isActive ? 'hos-sidebar-link-active' : ''}`}
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default HOSSidebar;
