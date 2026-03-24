import React, { useEffect, useState } from 'react';
import { Percent, FileText, CheckCircle2, Award } from 'lucide-react';

import { useData } from '../../../hooks/useData';
import {
  createDefaultResultManagementConfig,
  getPageTwoLabel,
  getSectionBadgeTone,
  getSectionHelper,
  getSectionLabel,
  getStoredResultManagementSettings,
  resultSections,
  resultTemplates,
  saveResultManagementSettings,
  type ResultManagementConfig,
  type ResultSectionConfig,
  type ResultSectionId,
} from '../services/resultManagement';

export const ResultManagementSettings = () => {
  const [activeTab, setActiveTab] = useState<'weights' | 'grading' | 'templates'>('weights');
  const [activeSection, setActiveSection] = useState<ResultSectionId>('senior-secondary');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedInitialConfig, setHasLoadedInitialConfig] = useState(false);

  const { data: websiteResponse, loading: isLoadingSettings, error: settingsError, refetch } = useData<{ website?: Record<string, unknown> | null }>('/api/schools/website');

  const sections: ResultSectionId[] = resultSections.map((section) => section.id);
  
  const [configs, setConfigs] = useState<ResultManagementConfig>(() => createDefaultResultManagementConfig());

  useEffect(() => {
    if (hasLoadedInitialConfig || isLoadingSettings) return;
    setConfigs(getStoredResultManagementSettings(websiteResponse?.website));
    setHasLoadedInitialConfig(true);
  }, [hasLoadedInitialConfig, isLoadingSettings, websiteResponse]);

  const currentConfig = configs[activeSection];
  const updateConfig = (updates: Partial<ResultSectionConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [activeSection]: { ...prev[activeSection], ...updates }
    }));
    setSaveMessage(null);
    setSaveError(null);
  };

  const handleSaveSettings = async (successMessage: string) => {
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      await saveResultManagementSettings(configs, websiteResponse?.website);
      setSaveMessage(successMessage);
      await refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save result management settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCAChange = (index: number, weight: number) => {
    const newWeights = [...currentConfig.caWeights];
    newWeights[index] = weight;
    updateConfig({ caWeights: newWeights });
  };

  const handleCALabelChange = (index: number, label: string) => {
    const newLabels = [...currentConfig.caLabels];
    newLabels[index] = label;
    updateConfig({ caLabels: newLabels });
  };

  const handleCaCountChange = (count: number) => {
    const newWeights = Array(count).fill(Math.floor(20 / count));
    const newLabels = Array(count).fill(0).map((_, i) => `CA ${i + 1}`);
    updateConfig({ caCount: count, caWeights: newWeights, caLabels: newLabels });
  };

  const totalPercentage = 
    currentConfig.caWeights.reduce((a, b) => a + b, 0) + 
    (currentConfig.useMidTerm ? currentConfig.midTermWeight : 0) + 
    currentConfig.examWeight;

  return (
    <div className="space-y-6">
      {/* Section Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {sections.map(section => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeSection === section 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {getSectionLabel(section)}
          </button>
        ))}
      </div>

      {isLoadingSettings && !hasLoadedInitialConfig ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-zinc-400">
          Loading saved result settings for this school.
        </div>
      ) : null}

      {settingsError ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Unable to load saved result settings. Defaults are shown until the school settings endpoint responds again.
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {saveError}
        </div>
      ) : null}

      {saveMessage ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          {saveMessage}
        </div>
      ) : null}

      {/* Main Content */}
      <div className="card-compact p-0 overflow-hidden bg-[#0A0A0A] border-white/5">
        <div className="flex border-b border-white/5 bg-white/2">
          {[
            { id: 'weights', label: 'Assesment Weights', icon: <Percent size={14} /> },
            { id: 'grading', label: 'Grading Key', icon: <Award size={14} /> },
            { id: 'templates', label: 'Result Templates', icon: <FileText size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-4 flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                activeTab === tab.id 
                  ? 'text-emerald-500 bg-emerald-500/5 border-b-2 border-emerald-500' 
                  : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'weights' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Assessment Weight Configuration</h3>
                  <p className="text-xs text-zinc-500">Configure continuous assessments, mid-term, and exam max scores for {getSectionLabel(activeSection)}.</p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                  totalPercentage === 100 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  Total: {totalPercentage}% {totalPercentage !== 100 && '(Must be 100%)'}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="space-y-4 col-span-1 md:col-span-2 lg:col-span-4 border-b border-white/5 pb-6">
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Continuous Assessment</span>
                     <select 
                        value={currentConfig.caCount}
                        onChange={(e) => handleCaCountChange(Number(e.target.value))}
                        className="bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-300 px-2 py-1 outline-none focus:border-emerald-500/50"
                     >
                        <option value={1}>1 CA</option>
                        <option value={2}>2 CAs</option>
                        <option value={3}>3 CAs</option>
                        <option value={4}>4 CAs</option>
                     </select>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: currentConfig.caCount }).map((_, i) => (
                      <div key={`ca-${i}`} className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-3">
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">CA {i + 1} Heading</label>
                          <input 
                            type="text" 
                            value={currentConfig.caLabels[i]} 
                            onChange={(e) => handleCALabelChange(i, e.target.value)}
                            className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Max Score</label>
                          <input 
                            type="number" 
                            value={currentConfig.caWeights[i]} 
                            onChange={(e) => handleCAChange(i, Number(e.target.value))}
                            className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white/2 border border-white/5 space-y-4 lg:col-span-2 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">Mid-Term Max</h4>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Mid-term exam settings</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={currentConfig.useMidTerm} onChange={(e) => updateConfig({ useMidTerm: e.target.checked })} />
                      <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  
                  {currentConfig.useMidTerm ? (
                    <>
                      <div className="pt-2">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 flex justify-between">
                          <span>Max Score</span>
                          <span className="text-emerald-400">Total: {currentConfig.midTermWeight}</span>
                        </label>
                        <input 
                          type="number" 
                          value={currentConfig.midTermWeight} 
                          onChange={(e) => updateConfig({ midTermWeight: Number(e.target.value) })}
                          className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-lg font-bold text-white focus:border-emerald-500 transition-colors"
                        />
                      </div>
                      <div className="pt-2 border-t border-white/5">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={currentConfig.midTermOver100} 
                            onChange={(e) => updateConfig({ midTermOver100: e.target.checked })}
                            className="rounded border-white/10 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900 bg-black"
                          />
                          <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">Over 100%? (Input out of 100, converted to {currentConfig.midTermWeight})</span>
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-10 border border-white/5">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Mid-term disabled</p>
                    </div>
                  )}
                </div>

                <div className="p-5 rounded-xl bg-white/2 border border-white/5 space-y-4 lg:col-span-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">Exam Max Score</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Final examination weight</p>
                  </div>
                  <div className="pt-2 h-full">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Max Score</label>
                    <input 
                      type="number" 
                      value={currentConfig.examWeight} 
                      onChange={(e) => updateConfig({ examWeight: Number(e.target.value) })}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-lg font-bold text-white focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                 <button type="button" onClick={() => handleSaveSettings(`Assessment weights saved for ${getSectionLabel(activeSection)}.`)} disabled={isSaving} className="bg-white text-[#0A0A0A] hover:bg-zinc-200 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Weights Configuration'}</button>
              </div>
            </div>
          )}

          {activeTab === 'grading' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Grading Key</h3>
                <p className="text-xs text-zinc-500">Define the grading key and remarks for {getSectionLabel(activeSection)}.</p>
              </div>

              <div className="bg-white/2 rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#111] border-b border-white/5">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Grade</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Min %</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Max %</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Remark (Label)</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentConfig.gradingKey.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.grade} 
                            onChange={(e) => {
                              const newKey = [...currentConfig.gradingKey];
                              newKey[idx].grade = e.target.value;
                              updateConfig({ gradingKey: newKey });
                            }}
                            className="bg-transparent border border-white/10 rounded px-2 py-1 w-16 text-sm font-bold text-center text-emerald-400 focus:border-emerald-500 outline-none"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            value={row.min} 
                            onChange={(e) => {
                              const newKey = [...currentConfig.gradingKey];
                              newKey[idx].min = Number(e.target.value);
                              updateConfig({ gradingKey: newKey });
                            }}
                            className="bg-transparent border border-white/10 rounded px-2 py-1 w-20 text-sm focus:border-emerald-500 outline-none text-white"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            value={row.max}
                            onChange={(e) => {
                              const newKey = [...currentConfig.gradingKey];
                              newKey[idx].max = Number(e.target.value);
                              updateConfig({ gradingKey: newKey });
                            }}
                            className="bg-transparent border border-white/10 rounded px-2 py-1 w-20 text-sm focus:border-emerald-500 outline-none text-white"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.label}
                            onChange={(e) => {
                              const newKey = [...currentConfig.gradingKey];
                              newKey[idx].label = e.target.value;
                              updateConfig({ gradingKey: newKey });
                            }}
                            className="bg-transparent border border-white/10 rounded px-3 py-1 w-full text-sm focus:border-emerald-500 outline-none text-white"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            className="text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
                            onClick={() => {
                              if (currentConfig.gradingKey.length > 1) {
                                const newKey = currentConfig.gradingKey.filter((_, i) => i !== idx);
                                updateConfig({ gradingKey: newKey });
                              }
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-3 bg-[#111] border-t border-white/5 flex gap-3 items-center">
                  <button 
                    onClick={() => {
                      updateConfig({ 
                        gradingKey: [...currentConfig.gradingKey, { id: Date.now().toString(), grade: 'F', min: 0, max: 0, label: 'New Label' }] 
                      });
                    }}
                    className="text-xs font-bold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors border border-emerald-500/20"
                  >
                    + Add Grade Row
                  </button>
                  <p className="text-[10px] text-zinc-500 italic">Ensure min and max values do not overlap for accurate automated grading.</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                  <button type="button" onClick={() => handleSaveSettings(`Grading key saved for ${getSectionLabel(activeSection)}.`)} disabled={isSaving} className="bg-white text-[#0A0A0A] hover:bg-zinc-200 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Grading Key'}</button>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Result Template Selection</h3>
                  <p className="text-xs text-zinc-500">Choose the official report-card template for {getSectionLabel(activeSection)}. {getSectionHelper(activeSection)}</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 px-4 py-2 rounded-xl group hover:border-emerald-500/30 transition-all">
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">Apply Page 2 ({getPageTwoLabel(activeSection)})</span>
                  <input 
                    type="checkbox" 
                    checked={currentConfig.applyPage2} 
                    onChange={(e) => updateConfig({ applyPage2: e.target.checked })}
                    className="rounded border-white/10 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900 bg-black w-4 h-4"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Section Head Title</label>
                    <input
                      type="text"
                      value={currentConfig.sectionHeadTitle}
                      onChange={(event) => updateConfig({ sectionHeadTitle: event.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white focus:border-emerald-500 transition-colors"
                      placeholder="Enter the title that signs this section's result"
                    />
                    <p className="mt-2 text-[11px] text-zinc-500">This title appears on the live result remarks and signature line for {getSectionLabel(activeSection)}.</p>
                  </div>

                  {resultTemplates.filter(t => t.appliesTo.includes(activeSection)).map(template => (
                    <div 
                      key={template.id}
                      onClick={() => updateConfig({ templateId: template.id })}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        currentConfig.templateId === template.id
                          ? 'bg-emerald-600/10 border-emerald-500/50'
                          : 'bg-white/2 border-white/5 hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className={`text-sm font-bold ${currentConfig.templateId === template.id ? 'text-emerald-400' : 'text-zinc-200'}`}>
                          {template.name}
                        </h4>
                        {currentConfig.templateId === template.id && <CheckCircle2 size={16} className="text-emerald-500" />}
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed mb-3">{template.desc}</p>
                      
                      {/* Color-coded tags just to show it respects section styling */}
                      <div className="flex flex-wrap gap-1">
                        {template.appliesTo.map(sec => (
                          <span 
                            key={sec} 
                            className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${sec === activeSection ? getSectionBadgeTone(sec) : 'bg-white/5 text-zinc-600'}`}
                          >
                            {getSectionLabel(sec).split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {resultTemplates.filter(t => !t.appliesTo.includes(activeSection)).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-2">Not recommended for {getSectionLabel(activeSection)}</p>
                      {resultTemplates.filter(t => !t.appliesTo.includes(activeSection)).map(template => (
                        <div key={template.id} className="p-3 mb-2 rounded-xl bg-[#111] border border-white/5 opacity-50 pointer-events-none grayscale">
                          <h4 className="text-xs font-bold text-zinc-400">{template.name}</h4>
                          <p className="text-[10px] text-zinc-600">{template.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 bg-[#111] rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center min-h-100">
                   <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Template Preview: {resultTemplates.find(t=>t.id === currentConfig.templateId)?.name}</p>
                   <p className="mb-4 text-[11px] text-zinc-500">Page 2 rule: Preschool/Nursery uses Progress Report, Primary/Grade uses Cognitive Report, and Secondary does not add a special page 2.</p>
                   <p className="mb-4 text-[11px] text-zinc-500">Section signatory: {currentConfig.sectionHeadTitle}</p>
                   
                   <div className="w-full max-w-xl flex overflow-hidden rounded-xl border border-white/10 shadow-2xl relative bg-white aspect-[1/1.2] transition-all">
                      {/* Page 1 Mockup */}
                      <div className={`absolute inset-0 p-8 flex flex-col transition-transform duration-500 ${currentConfig.applyPage2 ? 'w-1/2 border-r border-gray-200 pointer-events-none' : 'w-full'}`}>
                         <div className="text-center pb-4 border-b-2 border-gray-800 mb-6">
                            <h2 className="text-base font-bold text-gray-900">Ndovera International School</h2>
                           <p className="text-[10px] text-gray-500">Term 2 Student Academic Report • {getSectionLabel(activeSection)}</p>
                         </div>
                         <div className="space-y-4">
                           <div className="h-6 bg-gray-100 rounded w-1/3 mb-2" />
                           <div className="space-y-2">
                             <div className="h-4 bg-gray-50 rounded" />
                             <div className="h-4 bg-gray-50 rounded w-5/6" />
                             <div className="h-4 bg-gray-50 rounded w-4/6" />
                             <div className="h-4 bg-gray-50 rounded" />
                           </div>
                           <div className="mt-8 grid grid-cols-4 gap-2 border-t pt-4">
                             <div className="h-20 bg-gray-100 rounded" />
                             <div className="h-20 bg-gray-100 rounded" />
                             <div className="h-20 bg-gray-100 rounded" />
                             <div className="h-20 bg-gray-100 rounded" />
                           </div>
                         </div>
                         <div className="absolute bottom-4 left-0 w-full text-center text-[8px] font-bold text-gray-300">Page 1</div>
                      </div>

                       {/* Page 2 Mockup */}
                       <div className={`absolute inset-y-0 right-0 p-8 flex flex-col bg-gray-50/50 transition-all duration-500 w-1/2 ${!currentConfig.applyPage2 ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}>
                         <div className="pb-4 border-b border-gray-200 mb-4">
                         <h2 className="text-xs font-bold text-gray-900 mb-1">{getPageTwoLabel(activeSection)}</h2>
                         </div>
                         <div className="space-y-6">
                            <div>
                               <div className="h-3 bg-gray-200 w-1/3 mb-2 rounded" />
                               <div className="h-12 bg-gray-100 rounded" />
                            </div>
                            <div>
                               <div className="h-3 bg-gray-200 w-1/4 mb-2 rounded" />
                               <div className="h-8 bg-gray-100 rounded" />
                               <div className="h-8 bg-gray-100 rounded mt-2" />
                            </div>
                         </div>
                         <div className="absolute bottom-4 left-0 w-full text-center text-[8px] font-bold text-gray-300">Page 2</div>
                      </div>
                   </div>
                   
                   <div className="flex gap-2 mt-6">
                     <button type="button" onClick={() => handleSaveSettings(`Template settings saved for ${getSectionLabel(activeSection)}.`)} disabled={isSaving} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50">{isSaving ? 'Saving...' : `Set as Default for ${getSectionLabel(activeSection)}`}</button>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};