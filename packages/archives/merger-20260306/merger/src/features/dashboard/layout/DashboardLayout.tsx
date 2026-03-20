import React from "react";

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

// Glassmorphism + scrollable sidebar + scrollable main content
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, children }) => {
  return (
    <div className="flex h-dvh bg-slate-50 dark:bg-linear-to-br dark:from-[#1a1a2e] dark:via-[#23234a] dark:to-[#0f3460]">
      {/* Sidebar */}
      <aside className="shrink-0 w-64 h-full overflow-y-scroll custom-sidebar-scrollbar glass-card border-r border-white/10 shadow-lg">
        {sidebar}
      </aside>
      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-scroll px-6 py-8 glass-card">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
