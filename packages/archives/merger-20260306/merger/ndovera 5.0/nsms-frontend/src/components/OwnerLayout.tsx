import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const OwnerLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="owner-layout">
      <Sidebar collapsed={collapsed} />
      <div className="owner-main">
        <TopBar onToggleSidebar={() => setCollapsed((prev) => !prev)} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default OwnerLayout;
