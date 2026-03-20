const fs = require('fs');

const code = `import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../services/apiClient';
import { loadUser } from '../../services/authLocal';
import { Save, AlertCircle, FileText, CheckCircle, Mic, Sparkles } from 'lucide-react';

const SECTIONS = [
  { id: 'morning_arrival', label: 'Morning Arrival & Entry' },
  { id: 'break_times', label: 'Break & Lunch Times' },
  { id: 'dismissal', label: 'Dismissal & Buses' },
  { id: 'incidents', label: 'Incidents & Interventions' }
];

export default function DutyReport() {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [auras, setAuras] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  
  const user = loadUser();
  const isHoS = user?.role === 'hos' || user?.role === 'owner';

  useEffect(() => {
    fetchReports();
    fetchAuras();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetchWithAuth('/api/duty-report');
      if (res && res.reports) setReports(res.reports);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuras = async () => {
    try {
      const res = await fetchWithAuth('/api/auras/balance');
      if (res && res.balance !== undefined) setAuras(res.balance);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTextChange = (sectionId: string, value: string) => {
    setFormData(prev => ({ ...prev, [sectionId]: value }));
  };

  const handleVoiceToText = async (sectionId: string) => {
    try {
      // Deduct 5 AURAS
      const res = await fetch('/api/auras/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${localStorage.getItem('token')}\` },
        body: JSON.stringify({ amount: 5, reason: 'Voice to Text' })
      }).then(r => r.json());
      
      if (res.error) {
        alert('Not enough AURAS! Needs 5 AURAS.');
        return;
      }
      setAuras(res.new_balance);
      
      // Mock Voice to Text
      handleTextChange(sectionId, (formData[sectionId] || '') + ' [Transcribed Voice Note] All students arrived safely without any major incidents in this area.');
    } catch(e) {
      console.error(e);
    }
  };
  
  const handleAIReview = async () => {
    try {
      const res = await fetch('/api/duty-report/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${localStorage.getItem('token')}\` },
        body: JSON.stringify({ report_data: formData })
      }).then(r => r.json());
      
      if (res.error) {
        alert(res.error);
        return;
      }
      setAuras(res.new_balance);
      setAiAnalysis(res.analysis);
      alert('AI Review Complete. See feedback at the top of the form.');
    } catch(e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        await fetchWithAuth('/api/duty-report', {
        method: 'POST',
        body: JSON.stringify({ report_data: JSON.stringify(formData), ai_analysis: JSON.stringify(aiAnalysis) }),
      });
      setSuccess('Duty report submitted successfully.');
      setFormData({});
      setAiAnalysis(null);
      fetchReports();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-indigo-50 dark:bg-slate-800 p-4 rounded-xl border border-indigo-100 dark:border-slate-700">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="text-indigo-500" /> Duty Reports (V2)
        </h1>
        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm font-mono text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200">
          <Sparkles size={18} /> {auras} AURAS
        </div>
      </div>

      {!isHoS && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          
          <div className="flex justify-between items-center border-b pb-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Smart Duty Form</h2>
            <button type="button" onClick={handleAIReview} className="px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
              <Sparkles size={16}/> AI Review (10 AURAS)
            </button>
          </div>

          {aiAnalysis && (
            <div className="p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
              <h3 className="font-bold flex items-center gap-2 mb-2"><CheckCircle size={16} /> AI Feedback</h3>
              <p className="text-sm">{aiAnalysis.feedback}</p>
              <div className="mt-2 bg-white/50 dark:bg-black/20 p-2 rounded text-xs">Tone: {aiAnalysis.tone} | Coverage: {aiAnalysis.coverage_score}/10</div>
            </div>
          )}

          <div className="space-y-6">
            {SECTIONS.map(sec => (
              <div key={sec.id} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <label className="font-medium text-slate-700 dark:text-slate-200">{sec.label}</label>
                  <button type="button" onClick={() => handleVoiceToText(sec.id)} className="text-xs flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-md hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors dark:text-slate-300">
                    <Mic size={14}/> Voice to Text (5 AURAS)
                  </button>
                </div>
                <textarea
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 min-h-[80px] text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                  placeholder="Optional details..."
                  value={formData[sec.id] || ''}
                  onChange={(e) => handleTextChange(sec.id, e.target.value)}
                />
              </div>
            ))}
          </div>

          {success && <p className="text-emerald-500 text-sm flex items-center gap-1"><CheckCircle size={16}/> {success}</p>}
          
          <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium">
            <Save size={18} /> {loading ? 'Submitting...' : 'Submit Smart Report'}
          </button>
        </form>
      )}

      {/* History List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mt-8">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-semibold bg-slate-50 dark:bg-slate-800/50 flex align-center justify-between text-slate-900 dark:text-white">
          <span>Recent Duty Reports</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {reports.length === 0 ? (
            <p className="p-8 text-slate-500 text-center text-sm">No reports found.</p>
          ) : (
            reports.map((r: any) => {
              let data: any = {};
              try {
                data = typeof r.report_data === 'string' ? JSON.parse(r.report_data) : (r.report_data || {});
              } catch(e){}
              
              let ai: any = null;
              try {
                ai = typeof r.ai_analysis === 'string' ? JSON.parse(r.ai_analysis) : (r.ai_analysis || null);
              } catch(e){}
              
              return (
              <div key={r.id} className="p-5 flex flex-col gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex justify-between text-sm text-slate-500">
                  <span className="font-bold text-slate-900 dark:text-white">{r.staff_name}</span>
                  <span>{new Date(r.date).toLocaleDateString()}</span>
                </div>
                
                <div className="space-y-3 mt-2 text-sm">
                  {Object.entries(data).map(([k, v]: any) => (
                    v ? <div key={k}><strong className="text-slate-700 dark:text-slate-300">{k}:</strong> <span className="text-slate-600 dark:text-slate-400">{v}</span></div> : null
                  ))}
                  {typeof data !== 'object' && <div className="text-slate-600">{r.report_text}</div>}
                </div>

                {ai && (
                  <div className="mt-2 bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-xs text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800/30">
                    <strong>AI Analysis:</strong> {ai.feedback} (Score: {ai.coverage_score}/10)
                  </div>
                )}

                <div className="flex justify-between items-center mt-4 border-t pt-4 dark:border-slate-700">
                  <span className={\`text-xs font-bold px-3 py-1 rounded-full \${r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}\`}>
                    {r.status.toUpperCase()}
                  </span>
                  {isHoS && r.status === 'pending' && (
                    <button className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-medium shadow-sm">Review & Approve</button>
                  )}
                </div>
              </div>
            )})
          )}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('packages/web/src/features/reports/components/DutyReport.tsx', code);
console.log('Component written successfully.');
