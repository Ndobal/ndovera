import React, { useMemo, useState } from 'react';
import { 
  Plus, 
  MapPin, 
  Clock, 
  Building2, 
  FileText, 
  Send,
  Sparkles,
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { useData } from '../hooks/useData';
import { fetchWithAuth } from '../services/apiClient';
import { loadUser } from '../services/authLocal';
import { Role, Vacancy, Resume } from '../types';

const OFFICIAL_VACANCIES: Vacancy[] = [
  {
    id: 'v2',
    schoolId: 'ndovera',
    schoolName: 'Ndovera Official',
    title: 'Regional Growth Manager',
    description: 'Expand the Ndovera network across Lagos state.',
    type: 'Full-time',
    category: 'Administrative',
    salary: '₦300k + Commission',
    postedAt: '2026-03-04',
    isNdoveraOfficial: true
  }
];

export const OpportunitiesView = ({ role, searchQuery }: { role: Role, searchQuery?: string }) => {
  const currentUser = loadUser();
  const schoolId = currentUser?.schoolId || 'school_1';
  const [activeTab, setActiveTab] = useState<'browse' | 'resume' | 'my-postings'>(['HOS', 'HoS', 'School Admin', 'Owner', 'ICT Manager'].includes(role) ? 'my-postings' : 'browse');
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftVacancy, setDraftVacancy] = useState({
    title: '',
    description: '',
    type: 'Full-time' as Vacancy['type'],
    category: 'Teaching' as Vacancy['category'],
    salary: '',
  });
  const { data: schoolVacancyData, loading, refetch } = useData<{ vacancies: Vacancy[] }>(`/api/schools/${schoolId}/vacancies`, { enabled: Boolean(schoolId) });

  const isHOS = ['HOS', 'HoS', 'School Admin', 'Owner', 'ICT Manager'].includes(role);
  const schoolVacancies = schoolVacancyData?.vacancies || [];
  const isSchoolStaff = currentUser?.roles?.some(r => ['Teacher', 'Staff', 'Bursar', 'Librarian', 'Security', 'Cleaner', 'Driver', 'Student', 'Parent'].includes(r));
  const browseVacancies = (isSchoolStaff || role === 'Teacher' || role === 'Staff') ? schoolVacancies : [...schoolVacancies, ...OFFICIAL_VACANCIES];

  const filteredVacancies = useMemo(() => {
    if (!searchQuery) return browseVacancies;
    return browseVacancies.filter(vacancy => vacancy.title.toLowerCase().includes(searchQuery.toLowerCase()) || vacancy.schoolName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [browseVacancies, searchQuery]);

  const handleCreateVacancy = async () => {
    if (!draftVacancy.title.trim() || !draftVacancy.description.trim()) return;
    setIsSubmitting(true);
    try {
      await fetchWithAuth(`/api/schools/${schoolId}/vacancies`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draftVacancy),
      });
      setDraftVacancy({ title: '', description: '', type: 'Full-time', category: 'Teaching', salary: '' });
      setIsCreating(false);
      await refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Opportunities & Careers</h2>
          <p className="text-zinc-500 text-xs">Find your next role or build your professional profile.</p>
          {role === 'Teacher' ? <p className="mt-2 text-[11px] font-medium text-emerald-400">Teachers only see vacancies from their own school here.</p> : null}
        </div>
        <div className="flex gap-2">
          {isHOS && (
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              <Plus size={16} /> Post Vacancy
            </button>
          )}
          <button 
            onClick={() => setActiveTab('resume')}
            className="bg-white/5 border border-white/5 text-zinc-400 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-white/10 transition-all"
          >
            <FileText size={14} /> {role === 'Student' ? 'Build Portfolio' : 'Resume Builder'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'browse' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Browse Vacancies
        </button>
        <button
          onClick={() => setActiveTab('resume')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'resume' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          My Resume
        </button>
        {isHOS && (
          <button
            onClick={() => setActiveTab('my-postings')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'my-postings' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            My Postings
          </button>
        )}
      </div>

      {activeTab === 'browse' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Filters</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Category</label>
                  <select className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500/50">
                    <option>All Categories</option>
                    <option>Teaching</option>
                    <option>Administrative</option>
                    <option>ICT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Job Type</label>
                  <div className="space-y-2">
                    {['Full-time', 'Part-time', 'Contract'].map(type => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-600 focus:ring-emerald-500/50" />
                        <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card-compact bg-emerald-600/5 border-emerald-500/10">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500">AI Matching</h3>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Our AI automatically matches your resume to relevant vacancies in the Ndovera network.
              </p>
              <button className="mt-4 w-full bg-emerald-600/20 text-emerald-500 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-600/30 transition-all">
                Enable Auto-Match
              </button>
            </div>
          </div>

          {/* Vacancies List */}
          <div className="lg:col-span-3 space-y-4">
            {loading ? <div className="card-compact text-sm text-zinc-400">Loading vacancies...</div> : null}
            <div className="space-y-3">
              {filteredVacancies.map((vacancy) => (
                <div key={vacancy.id} className={`card-compact group hover:border-emerald-500/30 transition-all ${vacancy.isNdoveraOfficial ? 'border-emerald-500/20 bg-emerald-500/5' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${vacancy.isNdoveraOfficial ? 'bg-emerald-600 text-white' : 'bg-white/5 text-zinc-400'}`}>
                        {vacancy.isNdoveraOfficial ? <Sparkles size={24} /> : <Building2 size={24} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-white">{vacancy.title}</h4>
                          {vacancy.isNdoveraOfficial && (
                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-bold uppercase rounded-full">Official</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Building2 size={12} /> {vacancy.schoolName}
                        </p>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="flex items-center gap-1 text-[10px] text-zinc-600 font-medium">
                            <Clock size={12} /> {vacancy.type}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-zinc-600 font-medium">
                            <MapPin size={12} /> Remote / Lagos
                          </span>
                          <span className="text-[10px] text-emerald-500 font-bold">{vacancy.salary}</span>
                        </div>
                      </div>
                    </div>
                    <button className="bg-white/5 hover:bg-emerald-600 text-zinc-400 hover:text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                      Apply Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'resume' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="card-compact p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-600/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
              <FileText size={40} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Professional Resume Builder</h3>
              <p className="text-zinc-500 max-w-md mx-auto mt-2">
                Create a professional profile that schools in the Ndovera network can find.
              </p>
            </div>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Full Name</label>
                <input aria-label="Full name" type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Phone Number</label>
                <input aria-label="Phone number" type="tel" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Professional Summary</label>
                <textarea aria-label="Professional summary" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all h-32"></textarea>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Skills (Comma separated)</label>
                <input aria-label="Skills" type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" />
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-900/30">
                Save Profile
              </button>
              <button className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl font-bold hover:bg-white/10 transition-all">
                Download PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card-compact flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Profile Status</p>
                <p className="text-sm font-bold text-white">85% Complete</p>
              </div>
            </div>
            <div className="card-compact flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <UserPlus size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Profile Views</p>
                <p className="text-sm font-bold text-white">12 Schools</p>
              </div>
            </div>
            <div className="card-compact flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
                <Send size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Applications</p>
                <p className="text-sm font-bold text-white">4 Sent</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-postings' && isHOS && (
        <div className="space-y-4">
          {isCreating ? (
            <div className="card-compact space-y-4 border border-emerald-500/20 bg-emerald-500/5">
              <div>
                <h3 className="text-sm font-bold text-white">Post a Vacancy</h3>
                <p className="mt-1 text-xs text-zinc-500">This vacancy will appear inside your school dashboard and on your tenant website opportunities feed.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input value={draftVacancy.title} onChange={(event) => setDraftVacancy((current) => ({ ...current, title: event.target.value }))} placeholder="Role title" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                <input value={draftVacancy.salary} onChange={(event) => setDraftVacancy((current) => ({ ...current, salary: event.target.value }))} placeholder="Salary band" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                <select value={draftVacancy.type} onChange={(event) => setDraftVacancy((current) => ({ ...current, type: event.target.value as Vacancy['type'] }))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                </select>
                <select value={draftVacancy.category} onChange={(event) => setDraftVacancy((current) => ({ ...current, category: event.target.value as Vacancy['category'] }))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
                  <option value="Teaching">Teaching</option>
                  <option value="Administrative">Administrative</option>
                  <option value="Support">Support</option>
                  <option value="ICT">ICT</option>
                </select>
                <textarea value={draftVacancy.description} onChange={(event) => setDraftVacancy((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the opportunity" className="md:col-span-2 min-h-30 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setIsCreating(false)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-300">Cancel</button>
                <button onClick={() => void handleCreateVacancy()} disabled={isSubmitting} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50">
                  {isSubmitting ? 'Publishing...' : 'Publish Vacancy'}
                </button>
              </div>
            </div>
          ) : null}
          <div className="card-compact">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-white">Active Vacancies</h3>
              <span className="text-xs text-zinc-500">{schoolVacancies.length} Active Posting{schoolVacancies.length === 1 ? '' : 's'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="pb-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Role</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Type</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Applicants</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Posted</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolVacancies.length ? schoolVacancies.map((vacancy) => (
                    <tr key={vacancy.id} className="border-b border-white/5 last:border-0">
                      <td className="py-4">
                        <p className="text-sm font-bold text-white">{vacancy.title}</p>
                        <p className="text-[10px] text-zinc-500">{vacancy.category} Department</p>
                      </td>
                      <td className="py-4">
                        <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded">{vacancy.type}</span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">0</span>
                          <span className="text-[10px] text-zinc-500 font-bold">website + dashboard</span>
                        </div>
                      </td>
                      <td className="py-4 text-xs text-zinc-500">{new Date(vacancy.postedAt).toLocaleDateString()}</td>
                      <td className="py-4 text-right">
                        <button className="text-emerald-500 hover:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Published</button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-zinc-500">No school vacancy has been posted yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
