import React from 'react';

interface DashboardLayoutProps {
  sidebar?: React.ReactNode;
  main: React.ReactNode;
  ads?: React.ReactNode;
  showAds?: boolean;
  className?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  sidebar,
  main,
  ads,
  showAds = false,
  className = '',
}) => {
  return (
    <div className={`dashboard-shell ${showAds ? 'dashboard-shell-ads' : ''} ${className}`.trim()}>
      {sidebar && <aside className="dashboard-sidebar">{sidebar}</aside>}
      <section className="dashboard-main">{main}</section>
      {showAds && ads && <aside className="dashboard-ads">{ads}</aside>}
    </div>
  );
};

export default DashboardLayout;