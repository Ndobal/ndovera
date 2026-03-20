import React from 'react';
import { NavLink } from 'react-router-dom';

const sidebarItems = [
  { name: 'Dashboard', route: '/owner/dashboard' },
  { name: 'Schools', route: '/owner/schools' },
  { name: 'HOS', route: '/owner/hos' },
  { name: 'Teachers', route: '/owner/teachers' },
  { name: 'Staff', route: '/owner/staff' },
  { name: 'Students', route: '/owner/students' },
  { name: 'LAMS', route: '/owner/lams' },
  { name: 'Payments', route: '/owner/payments' },
  { name: 'Analytics', route: '/owner/analytics' },
  { name: 'School Website', route: '/owner/website' },
  { name: 'Media & Blog', route: '/owner/media' },
  { name: 'Staff Dropbox', route: '/owner/dropbox' },
  { name: 'Question Bank', route: '/owner/question-bank' },
  { name: 'Bulk Results', route: '/owner/bulk-results' },
  { name: 'Messaging', route: '/owner/messaging' },
  { name: 'Live Events', route: '/owner/live-events' },
  { name: 'Video Gallery', route: '/owner/video-gallery' },
  { name: 'Data Migration', route: '/owner/data-migration' },
  { name: 'Identity Engine', route: '/owner/identity' },
  { name: 'Event Bus', route: '/owner/event-bus' },
  { name: 'Settings', route: '/owner/settings' },
];

interface SidebarProps {
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">Ndovera</div>
      <nav className="sidebar-nav">
        {sidebarItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.route}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
