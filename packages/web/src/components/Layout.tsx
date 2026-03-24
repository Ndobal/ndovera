import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Role } from '../types';
import { AdBanner } from './AdBanner';
import { useData } from '../hooks/useData';
import { EvaluationModal } from '../features/evaluation/components/EvaluationModal';
import { AdPlacement } from '../services/adsApi';

interface LayoutProps {
  children: React.ReactNode;
  currentRole: Role;
  activeTab: string;
  activeSubView?: string | null;
  setActiveTab: (tab: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentRole,
  activeTab,
  activeSubView,
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
  const [adSessionKey] = useState(() => {
    try {
      const existing = localStorage.getItem('ndovera_ad_session_key');
      if (existing) return existing;
      const next = `ad_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;
      localStorage.setItem('ndovera_ad_session_key', next);
      return next;
    } catch {
      return `ad_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
  });

  const adPageKey = (() => {
    const normalized = (activeSubView || '').toLowerCase();
    if (normalized === 'create-lesson-plan' || normalized === 'upload-lesson-plan') return 'classwork';
    if (activeTab === 'aptitude') return 'exams';
    if (activeTab === 'scoresheet' || activeTab === 'evaluations') return 'results';
    return activeTab;
  })();

  const { data: adSettings } = useData<any>('/api/ads/settings');
  const shouldFetchAd = Boolean(adSettings?.enabled) && !['exams', 'classwork', 'results'].includes(adPageKey);
  const adPlacementUrl = shouldFetchAd ? `/api/ads/serve?page=${encodeURIComponent(adPageKey)}&placement=layout&sessionKey=${encodeURIComponent(adSessionKey)}` : '';
  const { data: adPlacement } = useData<AdPlacement>(adPlacementUrl, { enabled: shouldFetchAd });

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
        tenantBrand={tenantBrand}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar 
          currentRole={currentRole} 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setActiveTab={setActiveTab}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          tenantBrand={tenantBrand}
        />
        {/* Ad Banner */}
        <div className={shouldFetchAd ? 'transition-all duration-300' : ''}>
          <AdBanner
            visible={shouldFetchAd}
            pageKey={adPageKey}
            placementKey="layout"
            sessionKey={adSessionKey}
            placement={adPlacement}
          />
        </div>
        {/* Scrollable Content Area */}
        <main className={`flex-1 overflow-y-auto p-3 lg:p-4 scroll-area app-content ${shouldFetchAd ? 'max-w-5xl mx-auto' : 'max-w-7xl mx-auto'}`}> 
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
