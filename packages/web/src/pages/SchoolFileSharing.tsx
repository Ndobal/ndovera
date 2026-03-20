import React, { useMemo, useState } from 'react';
import { ExternalLink, FolderOpen, Globe2, Link2, Plus, School, Sparkles, Tag, ChevronDown, ChevronRight, FileText } from 'lucide-react';

import { useData } from '../hooks/useData';
import { fetchWithAuth } from '../services/apiClient';
import { Role } from '../types';

type SharedFileRecord = {
  id: string;
  title: string;
  description: string;
  resourceUrl: string;
  scope: 'school' | 'tenant' | 'ndovera';
  sourceType: 'tenant' | 'ndovera';
  fileType: string;
  createdBy: string;
  createdAt: string;
  tags?: string;
  classGroup?: string;
  subject?: string;
};

type SharedFileResponse = {
  files: SharedFileRecord[];
};

const MANAGER_ROLES = ['Teacher', 'School Admin', 'HoS', 'HOS', 'ICT Manager', 'Owner', 'Super Admin', 'Ami', 'Librarian', 'Exam Officer'];

export function SchoolFileSharingView({ role }: { role: Role }) {
  if (['Student', 'Parent'].includes(role)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-black/20 p-8 text-center shadow-xl">
          <FolderOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-2xl font-bold text-white">File Sharing Hidden</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Students and parents do not have access to the school-wide file sharing workspace.
          </p>
        </div>
      </div>
    );
  }

  const { data, loading, error, refetch } = useData<SharedFileResponse>('/api/shared-files');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    resourceUrl: '',
    scope: 'school',
    fileType: 'Link',
    tags: 'General',
    classGroup: '',
    subject: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'exams'>('general');
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  const isExamPrivileged = ['Exam Officer', 'HOS', 'HoS', 'Owner', 'Super Admin', 'School Admin'].includes(role);

  const toggleClass = (cls: string) => {
    setExpandedClasses(prev => ({ ...prev, [cls]: !prev[cls] }));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title || (!draft.resourceUrl && !uploadFile)) {
      alert('Please provide a title and a link or file.');
      return;
    }

    setSubmitting(true);
    try {
      let finalUrl = draft.resourceUrl;
      if (uploadFile) {
        finalUrl = URL.createObjectURL(uploadFile);
      }
      
      const payload: Partial<SharedFileRecord> = {
          title: draft.title,
          description: draft.description,
          resourceUrl: finalUrl,
          scope: draft.scope as any,
          fileType: uploadFile ? 'Document' : draft.fileType,
          tags: draft.tags,
          classGroup: draft.classGroup,
          subject: draft.subject
      };

      await fetchWithAuth('/api/shared-files', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setDraft({ title: '', description: '', resourceUrl: '', scope: 'school', fileType: 'Link', tags: 'General', classGroup: '', subject: '' });
      setUploadFile(null);
      refetch();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const allFiles = data?.files || [];
  
  const generalFiles = allFiles.filter(f => f.tags !== 'Exam Question');
  const examFiles = allFiles.filter(f => f.tags === 'Exam Question');

  // Compute stats for exams per class
  const classStats = useMemo(() => {
    const stats: Record<string, { total: number, submitted: number, subjects: string[] }> = {};
    const EXPECTED_PER_CLASS = 10;
    
    examFiles.forEach(f => {
      if (!f.classGroup) return;
      if (!stats[f.classGroup]) {
        stats[f.classGroup] = { total: EXPECTED_PER_CLASS, submitted: 0, subjects: [] };
      }
      if (f.subject && !stats[f.classGroup].subjects.includes(f.subject)) {
         stats[f.classGroup].subjects.push(f.subject);
         stats[f.classGroup].submitted += 1;
      }
    });
    return stats;
  }, [examFiles]);

  const viewData = activeTab === 'general' ? generalFiles : examFiles;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderOpen className="text-emerald-500" />
            School File Sharing
          </h1>
          <p className="mt-1 text-sm text-slate-400">Share resources, documents, and exam queries securely.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 shadow-lg"
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Upload Resource'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="card-glass mb-8 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-400">Resource Title</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white placeholder-white/30 outline-none focus:border-emerald-500/50"
                placeholder="e.g. Term 1 Lesson Notes"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-400">Description</label>
              <textarea
                className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white placeholder-white/30 outline-none focus:border-emerald-500/50"
                placeholder="Brief details..."
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-400 flex items-center gap-1"><Tag size={12}/> Tag / Category</label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white"
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                >
                  <option value="General">General Resource</option>
                  <option value="Policy">School Policy</option>
                  {isExamPrivileged && <option value="Exam Question">Exam Question (Secure)</option>}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-400">Visibility</label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white"
                  value={draft.scope}
                  onChange={(e) => setDraft({ ...draft, scope: e.target.value as any })}
                >
                  <option value="school">My School Only</option>
                  <option value="tenant">Network Wide</option>
                </select>
              </div>
            </div>

            {draft.tags === 'Exam Question' && (
              <div className="grid grid-cols-2 gap-4 bg-purple-500/10 p-3 rounded-lg border border-purple-500/20">
                 <div>
                    <label className="mb-1 block text-xs font-bold text-purple-300">Class Group</label>
                    <input className="w-full rounded border-none bg-black/30 p-2 text-white text-sm" placeholder="e.g. JSS 1" value={draft.classGroup} onChange={e=>setDraft({...draft, classGroup: e.target.value})} />
                 </div>
                 <div>
                    <label className="mb-1 block text-xs font-bold text-purple-300">Subject</label>
                    <input className="w-full rounded border-none bg-black/30 p-2 text-white text-sm" placeholder="e.g. Mathematics" value={draft.subject} onChange={e=>setDraft({...draft, subject: e.target.value})} />
                 </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-400">File or Link</label>
              {(MANAGER_ROLES.includes(role)) ? (
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    className="w-full block text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <span className="text-slate-500 text-xs font-bold">OR</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-white outline-none"
                    placeholder="Paste URL..."
                    value={draft.resourceUrl}
                    onChange={(e) => setDraft({ ...draft, resourceUrl: e.target.value })}
                  />
                </div>
              ) : (
                <input
                  className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white outline-none"
                  placeholder="Paste URL..."
                  value={draft.resourceUrl}
                  onChange={(e) => setDraft({ ...draft, resourceUrl: e.target.value })}
                />
              )}
            </div>
            
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-white text-black py-3 font-bold hover:bg-slate-200 transition disabled:opacity-50"
            >
              {submitting ? 'Uploading...' : 'Publish'}
            </button>
          </div>
        </form>
      )}

      {isExamPrivileged ? (
        <div className="flex gap-4 mb-6">
           <button onClick={() => setActiveTab('general')} className={`pb-2 px-1 text-sm font-bold ${activeTab === 'general' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>General Resources</button>
           <button onClick={() => setActiveTab('exams')} className={`pb-2 px-1 text-sm font-bold ${activeTab === 'exams' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-slate-300'}`}>Exam Questions Vault <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-[10px] rounded-full">{examFiles.length}</span></button>
        </div>
      ) : (
        <div className="mb-6"><h2 className="text-xl font-bold text-white">General Resources</h2></div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 animate-pulse">Loading files...</div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'exams' && Object.keys(classStats).length > 0 && (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {Object.entries(classStats).map(([cls, stat]) => (
                  <div key={cls} className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-4 cursor-pointer hover:bg-purple-900/20 transition-colors" onClick={() => toggleClass(cls)}>
                     <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-white flex items-center gap-2">
                          {expandedClasses[cls] ? <ChevronDown size={16} className="text-purple-400"/> : <ChevronRight size={16} className="text-purple-400"/>}
                          {cls}
                        </div>
                        <div className="text-xs font-mono px-2 py-1 rounded bg-black/40 text-purple-300">
                           {stat.submitted} / {stat.total}
                        </div>
                     </div>
                     <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mb-3">
                        <div className="bg-purple-500 h-full" style={{ width: `${(stat.submitted/stat.total)*100}%` }}></div>
                     </div>
                     {expandedClasses[cls] && (
                        <div className="mt-4 space-y-2 border-t border-purple-500/20 pt-3">
                          <p className="text-[10px] uppercase text-purple-400 font-bold mb-2">Submitted Subjects:</p>
                          {stat.subjects.map(s => (
                             <div key={s} className="flex items-center gap-2 text-xs text-slate-300 bg-black/20 p-1.5 rounded">
                                <FileText size={12} className="text-emerald-400"/> {s}
                             </div>
                          ))}
                        </div>
                     )}
                  </div>
                ))}
             </div>
          )}

          {viewData.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
              <FolderOpen className="mx-auto h-12 w-12 text-slate-600 mb-3" />
              <h3 className="text-lg font-medium text-slate-400">No matching files found</h3>
              <p className="text-sm text-slate-500">Check back later or upload a new resource.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {viewData.map((f) => (
                <div key={f.id} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/5 bg-[#1A1C21] p-5 transition-all hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-2xl">
                  {f.sourceType === 'ndovera' && (
                    <div className="absolute right-0 top-0 rounded-bl-xl bg-orange-500/10 px-3 py-1 flex items-center gap-1 border-b border-l border-orange-500/20">
                       <Sparkles size={10} className="text-orange-400" />
                       <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400">Ndovera</span>
                    </div>
                  )}
                  {f.tags === 'Exam Question' && (
                    <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                       SECURE EXAM
                    </div>
                  )}
                  
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.tags === 'Exam Question' ? 'bg-purple-500/10 text-purple-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {f.fileType === 'Document' ? <FolderOpen size={20} /> : <Link2 size={20} />}
                      </div>
                      <div>
                        {f.tags && <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-slate-400 mb-1 inline-block">{f.tags}</span>}
                        <h3 className="text-sm font-bold text-white line-clamp-1">{f.title}</h3>
                      </div>
                    </div>
                    
                    <p className="mb-4 text-xs leading-relaxed text-slate-400 line-clamp-2">
                      {f.description || 'No description provided.'}
                    </p>
                    
                    {f.tags === 'Exam Question' && f.classGroup && (
                       <div className="mb-4 flex gap-2">
                          <span className="text-[10px] bg-purple-900/40 text-purple-300 px-2 py-1 rounded border border-purple-500/20">{f.classGroup}</span>
                          <span className="text-[10px] bg-purple-900/40 text-purple-300 px-2 py-1 rounded border border-purple-500/20">{f.subject}</span>
                       </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      {f.scope === 'school' ? <School size={12} /> : <Globe2 size={12} />}
                      <span className="uppercase tracking-wider font-medium">{f.scope}</span>
                    </div>
                    <a
                      href={f.resourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${f.tags === 'Exam Question' ? 'bg-purple-500 hover:bg-purple-400 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                    >
                      Open <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
