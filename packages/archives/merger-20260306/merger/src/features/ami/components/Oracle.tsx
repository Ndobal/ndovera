import React from 'react';
import { BrainCircuit, ToggleLeft, ToggleRight, CheckCircle, AlertTriangle, Eye } from 'lucide-react';

const mockFlaggedContent = [
  { id: 'fc_01', content: '"...inappropriate language used in essay..."', source: 'AI Tutor Chat', user: 'student_123', action: 'Review' },
  { id: 'fc_02', content: '"...plagiarized paragraph detected..."', source: 'Assignment Submission', user: 'student_456', action: 'Review' },
];

export default function Oracle() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Oracle / AI Systems</h1>
        <p className="text-sm text-slate-400">Monitor, configure, and govern all AI-powered features on the platform.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* AI Settings & Status */}
        <div className="space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Global AI Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">AI Tutor</p>
                <button><ToggleRight className="w-10 h-10 text-emerald-500" /></button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">Automated Grading</p>
                <button><ToggleRight className="w-10 h-10 text-emerald-500" /></button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">Content Moderation</p>
                <button><ToggleLeft className="w-10 h-10 text-slate-600" /></button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-100 mb-4">AI Model Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">Gemini Pro (Core Model)</p>
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Operational</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">Aura Calculation Engine</p>
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Moderation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Content Moderation Queue</h2>
          <table className="w-full">
            <thead className="border-b border-slate-800">
                <tr>
                    <th className="p-2 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Content Snippet</th>
                    <th className="p-2 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Source</th>
                    <th className="p-2 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {mockFlaggedContent.map(item => (
                    <tr key={item.id}>
                        <td className="p-2 text-sm text-slate-400 font-mono">{item.content}</td>
                        <td className="p-2 text-sm text-slate-300">{item.source}</td>
                        <td className="p-2 text-right">
                            <button className="flex items-center gap-2 ml-auto px-3 py-1 bg-slate-800 rounded-lg text-sm text-slate-200 hover:bg-slate-700">
                                <Eye className="w-3 h-3" />
                                {item.action}
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
