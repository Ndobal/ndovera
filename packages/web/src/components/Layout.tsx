import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Role } from '../types';
import { AdBanner } from './AdBanner';
import { useData } from '../hooks/useData';
import { EvaluationModal } from '../features/evaluation/components/EvaluationModal';

interface LayoutProps {
  children: React.ReactNode;
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onRoleChange?: (role: Role) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentRole,
  setCurrentRole,
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  searchQuery,
  setSearchQuery,
  themeMode,
  setThemeMode,
}) => {
  const { data: currentUser } = useData<any>('/api/users/me');
  const tenantBrand = currentUser?.school ? {
    name: currentUser.school.name || 'School Workspace',
    logoUrl: currentUser.school.logoUrl || null,
    websiteUrl: currentUser.school.websiteUrl || null,
    primaryColor: currentUser.school.primaryColor || '#10b981',
  } : undefined;
  // Ad config from localStorage (simulate API)
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [pageAds, setPageAds] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ndovera_ads_config');
      if (raw) {
        const cfg = JSON.parse(raw);
        setAdsEnabled(cfg.enabled);
        setPageAds(cfg.pages || {});
      }
    } catch {}
  }, [activeTab]);

  // Shrink content if ads are visible
  const showAd = adsEnabled && pageAds[activeTab];

    const { data: evalStatus } = useData<{ active: boolean; completed: boolean; evaluation_id: string }>('/api/evaluation/status');
  const [hideEval, setHideEval] = useState(false);
  
  return (
    <div className={`app-shell h-screen flex overflow-hidden font-sans selection:bg-emerald-500/30 ${themeMode === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <Sidebar 
        currentRole={currentRole} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onRoleChange={setCurrentRole}
        tenantBrand={tenantBrand}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar 
          currentRole={currentRole} 
          setRole={setCurrentRole} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setActiveTab={setActiveTab}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          tenantBrand={tenantBrand}
        />
        {/* Ad Banner */}
        <div className={showAd ? 'transition-all duration-300' : ''}>
          <AdBanner visible={showAd} />
        </div>
        {/* Scrollable Content Area */}
        <main className={`flex-1 overflow-y-auto p-3 lg:p-4 scroll-area app-content ${showAd ? 'max-w-5xl mx-auto' : 'max-w-7xl mx-auto'}`}> 
          <motion.div
            key={activeTab + currentRole}
            initial={{ opacity: 0.92, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className=""
          >
            {React.cloneElement(children as React.ReactElement, { searchQuery })}
          </motion.div>
          <footer className="mt-0.5 pb-0.5 text-center">
            <p className="text-[7px] leading-none tracking-[0.14em] font-bold uppercase app-footer-note opacity-75">
              {(tenantBrand?.name || 'School Workspace')} &bull; v3.0.0
            </p>
          </footer>
        </main>
      </div>
      {evalStatus?.active && !evalStatus?.completed && !hideEval && currentRole !== 'Super Admin' && (
        <EvaluationModal evaluationId={evalStatus.evaluation_id} onClose={() => setHideEval(true)} />
      )}
    </div>
  );
};
