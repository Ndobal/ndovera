import React, { useState } from 'react';
import { 
  Globe, 
  Layout, 
  Image as ImageIcon, 
  Settings, 
  Eye, 
  Save, 
  Plus, 
  Monitor, 
  Smartphone, 
  Tablet as TabletIcon,
  ChevronRight,
  GripVertical,
  Type,
  Search,
  Zap,
  ShieldCheck,
  FileText,
  Trash2,
  Copy
} from 'lucide-react';
import { UserRole } from '../../../shared/types';
import { motion, AnimatePresence } from 'motion/react';

const PAGES = [
  { id: '1', name: 'Home', slug: '/', status: 'Published', lastEdit: '2 hours ago' },
  { id: '2', name: 'About Us', slug: '/about', status: 'Published', lastEdit: 'Yesterday' },
  { id: '3', name: 'Admissions', slug: '/admissions', status: 'Draft', lastEdit: '3 days ago' },
  { id: '4', name: 'Academics', slug: '/academics', status: 'Published', lastEdit: '1 week ago' },
  { id: '5', name: 'Blog', slug: '/blog', status: 'Published', lastEdit: 'Locked', locked: true },
];

const SECTIONS = [
  { id: 's1', type: 'Hero', style: 'Split Layout', icon: Layout },
  { id: 's2', type: 'About School', style: 'Text + Image', icon: Type },
  { id: 's3', type: 'Programs', style: 'Grid Cards', icon: Layout },
  { id: 's4', type: 'Blog', style: 'Mandatory Feed', icon: FileText, locked: true },
  { id: 's5', type: 'CTA', style: 'Admissions Banner', icon: Zap },
];

type ViewMode = 'desktop' | 'tablet' | 'mobile';
type EditorTab = 'pages' | 'sections' | 'theme' | 'seo' | 'settings';

export default function WebsiteBuilderModule({ role }: { role: UserRole }) {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [activeTab, setActiveTab] = useState<EditorTab>('sections');
  const [selectedPage, setSelectedPage] = useState(PAGES[0]);

  const getPreviewWidth = () => {
    switch (viewMode) {
      case 'mobile': return 'max-w-[375px]';
      case 'tablet': return 'max-w-[768px]';
      default: return 'max-w-full';
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col gap-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">Website Editor</h2>
            <p className="text-xs text-slate-500">Editing: <span className="font-semibold text-emerald-600">{selectedPage.name}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode('desktop')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'desktop' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('tablet')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'tablet' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <TabletIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('mobile')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'mobile' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SEO: Excellent</span>
          </div>
          <button 
            onClick={() => alert('Website Published Successfully!')}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Publish
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Panel - Controls */}
        <div className="w-80 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden shrink-0">
          <div className="flex border-b border-slate-100 dark:border-slate-800">
            {(['pages', 'sections', 'seo'] as EditorTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all relative ${
                  activeTab === tab ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {activeTab === 'pages' && (
                <motion.div 
                  key="pages"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-2"
                >
                  {PAGES.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => setSelectedPage(page)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
                        selectedPage.id === page.id 
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4" />
                        <div className="text-left">
                          <p className="text-sm font-semibold">{page.name}</p>
                          <p className="text-[10px] opacity-60">{page.slug}</p>
                        </div>
                      </div>
                      {page.locked ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
                      ) : (
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  ))}
                  <button className="w-full mt-4 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl text-slate-400 hover:border-emerald-200 hover:text-emerald-600 transition-all">
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-bold">Add New Page</span>
                  </button>
                </motion.div>
              )}

              {activeTab === 'sections' && (
                <motion.div 
                  key="sections"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Page Sections</h4>
                    <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-emerald-600">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {SECTIONS.map((section) => (
                    <div 
                      key={section.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group cursor-move"
                    >
                      <GripVertical className="w-4 h-4 text-slate-300" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{section.type}</p>
                          {section.locked && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                        </div>
                        <p className="text-[10px] text-slate-500">{section.style}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-emerald-600">
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        {!section.locked && (
                          <button className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'seo' && (
                <motion.div 
                  key="seo"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">SEO Health</h4>
                      <span className="text-xs font-bold text-emerald-600">98/100</span>
                    </div>
                    <div className="w-full h-1.5 bg-emerald-200 dark:bg-emerald-500/20 rounded-full overflow-hidden">
                      <div className="w-[98%] h-full bg-emerald-500"></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Meta Title</label>
                      <input 
                        type="text" 
                        defaultValue={`${selectedPage.name} | NDOVERA International School`}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 dark:text-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Meta Description</label>
                      <textarea 
                        rows={3}
                        defaultValue="Welcome to NDOVERA, where we nurture the leaders of tomorrow through excellence in academics and character building."
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 dark:text-slate-200 resize-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              <span>Performance</span>
              <Zap className="w-3 h-3 text-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <p className="text-[8px] text-slate-400 mb-1">Load Time</p>
                <p className="text-xs font-bold text-emerald-600">0.8s</p>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <p className="text-[8px] text-slate-400 mb-1">Page Size</p>
                <p className="text-xs font-bold text-emerald-600">1.2MB</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="flex-1 bg-slate-200 dark:bg-slate-950 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-hidden flex flex-col relative">
          {/* Preview Header */}
          <div className="h-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
            </div>
            <div className="flex-1 max-w-md mx-4">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md text-[10px] text-slate-500 flex items-center gap-2">
                <Globe className="w-3 h-3" />
                https://ndovera-school.edu.ng{selectedPage.slug}
              </div>
            </div>
            <div className="w-20"></div>
          </div>

          {/* Preview Content Area */}
          <div className="flex-1 overflow-auto p-8 flex justify-center bg-slate-100 dark:bg-slate-900/50">
            <motion.div 
              layout
              className={`bg-white dark:bg-slate-900 shadow-2xl rounded-lg overflow-hidden transition-all duration-500 ${getPreviewWidth()} w-full h-fit min-h-full`}
            >
              {/* Mock Website Content */}
              <div className="w-full">
                {/* Nav */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                    <span className="font-bold text-slate-800 dark:text-slate-100">NDOVERA</span>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>Home</span>
                    <span>About</span>
                    <span>Admissions</span>
                    <span>Academics</span>
                    <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">Apply Now</button>
                  </div>
                  <div className="md:hidden p-2">
                    <Layout className="w-5 h-5 text-slate-400" />
                  </div>
                </div>

                {/* Hero */}
                <div className="relative h-100 bg-slate-900 flex items-center px-12 overflow-hidden">
                  <img 
                    src="https://picsum.photos/seed/school/1200/800" 
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                    alt="Hero"
                  />
(remaining...)