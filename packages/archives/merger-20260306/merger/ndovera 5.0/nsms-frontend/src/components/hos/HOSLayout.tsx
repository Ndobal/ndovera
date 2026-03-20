import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import HOSSidebar from './HOSSidebar';
import HOSTopBar from './HOSTopBar';

const HOSLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`hos-layout ${collapsed ? 'hos-sidebar-hidden' : ''}`}>
      <HOSSidebar collapsed={collapsed} />
      <div className="hos-main">
        <HOSTopBar onToggleSidebar={() => setCollapsed((prev) => !prev)} />
        <main className="hos-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default HOSLayout;
