import React, { useState } from 'react';
import { Percent, FileText, CheckCircle2, ChevronDown, Award } from 'lucide-react';

type Section = 'Reception' | 'Nursery' | 'Primary' | 'Junior Secondary' | 'Senior Secondary';

interface SectionConfig {
  caCount: number;
  caLabels: string[];
  caWeights: number[];
  useMidTerm: boolean;
  midTermWeight: number;
  midTermOver100: boolean;
  examWeight: number;
  gradingKey: { id: string; min: number; max: number; label: string; grade: string }[];
  templateId: string;
  applyPage2: boolean;
}

const defaultGradingKey = [
  { id: '1', min: 70, max: 100, label: 'Excellent', grade: 'A' },
  { id: '2', min: 60, max: 69, label: 'Very Good', grade: 'B' },
  { id: '3', min: 50, max: 59, label: 'Credit', grade: 'C' },
  { id: '4', min: 40, max: 49, label: 'Pass', grade: 'D' },
  { id: '5', min: 0, max: 39, label: 'Fail', grade: 'E' },
];

const templates = [
  { id: 'tpl-1', name: 'Classic Grid', desc: 'Standard spreadsheet-style format.', appliesTo: ['Primary', 'Junior Secondary', 'Senior Secondary'] },
  { id: 'tpl-2', name: 'Early Years Playful', desc: 'Visual & softer format for young learners.', appliesTo: ['Reception', 'Nursery'] },
  { id: 'tpl-3', name: 'Modern Analytical', desc: 'Includes charts and performance graphs.', appliesTo: ['Primary', 'Junior Secondary', 'Senior Secondary'] },
  { id: 'tpl-4', name: 'Compact Summary', desc: 'Detailed but concise single-page feel.', appliesTo: ['Junior Secondary', 'Senior Secondary'] },
  { id: 'tpl-5', name: 'Comprehensive Review', desc: 'Deep dive with extensive comment sections.', appliesTo: ['Reception', 'Nursery', 'Primary', 'Junior Secondary', 'Senior Secondary'] },
];

export const ResultManagementSettings = () => {
  const [activeTab, setActiveTab] = useState<'weights' | 'grading' | 'templates'>('weights');
  const [activeSection, setActiveSection] = useState<Section>('Senior Secondary');

  const sections: Section[] = ['Reception', 'Nursery', 'Primary', 'Junior Secondary', 'Senior Secondary'];
  
  const [configs, setConfigs] = useState<Record<Section, SectionConfig>>(
    sections.reduce((acc, section) => {
      acc[section] = {
        caCount: 2,
        caLabels: ['CA 1', 'CA 2'],
        caWeights: [10, 10],
        useMidTerm: true,
        midTermWeight: 20,
        midTermOver100: true,
        examWeight: 60,
        gradingKey: [...defaultGradingKey],
        templateId: templates.find(t => t.appliesTo.includes(section))?.id || 'tpl-1',
        applyPage2: false,
      };
      return acc;
    }, {} as Record<Section, SectionConfig>)
  );

  const currentConfig = configs[activeSection];
  const updateConfig = (updates: Partial<SectionConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [activeSection]: { ...prev[activeSection], ...updates }
    }));
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
            {section}
          </button>
        ))}
      </div>

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
                  <p className="text-xs text-zinc-500">Configure continuous assessments, mid-term, and exam max scores for {activeSection}.</p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                  totalPercentage === 100 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  Total: {totalPercentage}% {totalPercentage !== 100 && '(Must be 100%)'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
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
                 <button className="bg-white text-[#0A0A0A] hover:bg-zinc-200 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">Save Weights Configuration</button>
              </div>
            </div>
          )}

          {activeTab === 'grading' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Grading Key</h3>
                <p className="text-xs text-zinc-500">Define the grading key and remarks for the {activeSection} section.</p>
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
                      <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
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
                 <button className="bg-white text-[#0A0A0A] hover:bg-zinc-200 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">Save Grading Key</button>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Result Template Selection</h3>
                  <p className="text-xs text-zinc-500">Choose the official report card template for the {activeSection} section.</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 px-4 py-2 rounded-xl group hover:border-emerald-500/30 transition-all">
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">Apply Page 2 (Comments & Extracurricular)</span>
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
                  {templates.filter(t => t.appliesTo.includes(activeSection)).map(template => (
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
                            className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              sec === activeSection 
                                ? (sec.includes('Secondary') ? 'bg-blue-500/20 text-blue-400' : sec.includes('Primary') ? 'bg-orange-500/20 text-orange-400' : 'bg-pink-500/20 text-pink-400')
                                : 'bg-white/5 text-zinc-600'
                            }`}
                          >
                            {sec.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {templates.filter(t => !t.appliesTo.includes(activeSection)).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-2">Not recommended for {activeSection}</p>
                      {templates.filter(t => !t.appliesTo.includes(activeSection)).map(template => (
                        <div key={template.id} className="p-3 mb-2 rounded-xl bg-[#111] border border-white/5 opacity-50 pointer-events-none grayscale">
                          <h4 className="text-xs font-bold text-zinc-400">{template.name}</h4>
                          <p className="text-[10px] text-zinc-600">{template.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 bg-[#111] rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center min-h-[400px]">
                   <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Template Preview: {templates.find(t=>t.id === currentConfig.templateId)?.name}</p>
                   
                   <div className="w-full max-w-xl flex overflow-hidden rounded-xl border border-white/10 shadow-2xl relative bg-white aspect-[1/1.2] transition-all">
                      {/* Page 1 Mockup */}
                      <div className={`absolute inset-0 p-8 flex flex-col transition-transform duration-500 ${currentConfig.applyPage2 ? 'w-1/2 border-r border-gray-200 pointer-events-none' : 'w-full'}`}>
                         <div className="text-center pb-4 border-b-2 border-gray-800 mb-6">
                            <h2 className="text-base font-bold text-gray-900">Ndovera International School</h2>
                            <p className="text-[10px] text-gray-500">Term 2 Student Academic Report • {activeSection}</p>
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
                            <h2 className="text-xs font-bold text-gray-900 mb-1">Behavior & Remarks</h2>
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
                     <button className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/20">Set as Default for {activeSection}</button>
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