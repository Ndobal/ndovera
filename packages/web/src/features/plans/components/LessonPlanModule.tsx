import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, LayoutList, MoreVertical, Plus, Search, Sparkles, Upload, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';

const StatusPill = ({ status }: { status: string }) => {
    const styles: Record<string,string> = {
        'Published': 'bg-emerald-500/10 text-emerald-400',
        'Draft': 'bg-amber-500/10 text-amber-400',
    };
    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
            {status}
        </span>
    );
};

export default function LessonPlanModule() {
  const navigate = useNavigate();
  const [lessonPlans, setLessonPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchLessonPlans = async () => {
      try {
        const data = await api.getLessonPlans();
        setLessonPlans(data);
      } catch (err) {
        setError('Failed to fetch lesson plans');
      } finally {
        setLoading(false);
      }
    };

    fetchLessonPlans();
  }, []);

  const filteredPlans = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return lessonPlans;

    return lessonPlans.filter((plan) =>
      [plan.topic, plan.subject, String(plan.week), plan.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [lessonPlans, query]);

  const publishedCount = lessonPlans.filter((plan) => plan.status === 'Published').length;
  const draftCount = lessonPlans.filter((plan) => plan.status === 'Draft').length;
  const liveLinkedCount = lessonPlans.filter((plan) => plan.liveClass).length;

  return (
    <div className="space-y-6 h-[calc(100vh-200px)] overflow-y-auto pr-1 custom-scrollbar">
      <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(14,165,233,0.08),rgba(15,23,42,0.92))] p-6 shadow-xl shadow-emerald-950/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-emerald-300">Lesson planning studio</p>
            <h1 className="mt-3 text-3xl font-black text-white">Create, schedule, and attach lesson plans to classroom delivery</h1>
            <p className="mt-3 text-sm text-slate-300">
              Build plans by subject, topic, and week, prepare class objectives and materials, and connect them to live classes for pre-read or post-class follow-up.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/classroom/create-lesson-plan')}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              New Lesson Plan
            </button>
            <button
              type="button"
              onClick={() => navigate('/classroom/upload-lesson-plan')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100 transition hover:bg-white/10"
            >
              <Upload className="h-4 w-4" />
              Upload Material
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <LayoutList className="h-4 w-4" />
              <p className="text-[11px] font-black uppercase tracking-[0.28em]">Total plans</p>
            </div>
            <p className="mt-3 text-3xl font-black text-white">{lessonPlans.length}</p>
            <p className="mt-1 text-xs text-slate-300">Plans already prepared for the classroom workspace.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-amber-300">
              <CalendarClock className="h-4 w-4" />
              <p className="text-[11px] font-black uppercase tracking-[0.28em]">Draft vs live</p>
            </div>
            <p className="mt-3 text-3xl font-black text-white">{draftCount} / {publishedCount}</p>
            <p className="mt-1 text-xs text-slate-300">Draft plans stay editable until they are ready for delivery.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sky-300">
              <Sparkles className="h-4 w-4" />
              <p className="text-[11px] font-black uppercase tracking-[0.28em]">Live class links</p>
            </div>
            <p className="mt-3 text-3xl font-black text-white">{liveLinkedCount}</p>
            <p className="mt-1 text-xs text-slate-300">Plans linked to live sessions can power pre-read and follow-up workflows.</p>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search lesson plans"
              placeholder="Search by topic, subject, week, or status"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-200 outline-none transition focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
            <span className="rounded-full bg-slate-800 px-3 py-1">Rich planning fields</span>
            <span className="rounded-full bg-slate-800 px-3 py-1">Visibility controls</span>
            <span className="rounded-full bg-slate-800 px-3 py-1">Live class attachment</span>
          </div>
        </div>
        {loading && <div className="p-4 text-center text-slate-400">Loading...</div>}
        {error && <div className="p-4 text-center text-red-500">{error}</div>}
        {!loading && !error && filteredPlans.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-lg font-semibold text-slate-100">No lesson plans found</p>
            <p className="mt-2 text-sm text-slate-400">Create a new plan or adjust the search term to find an existing one.</p>
          </div>
        )}
        {!loading && !error && filteredPlans.length > 0 && (
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Topic</th>
                <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Subject</th>
                <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Week</th>
                <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Live Class</th>
                <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredPlans.map((plan) => (
                <tr key={plan.id}>
                  <td className="p-4 text-sm font-medium text-slate-200">{plan.topic}</td>
                  <td className="p-4 text-sm text-slate-400">{plan.subject}</td>
                  <td className="p-4 text-sm text-center font-mono text-slate-400">{plan.week}</td>
                  <td className="p-4 text-center"><StatusPill status={plan.status} /></td>
                  <td className="p-4 text-sm text-slate-400">
                      <div className="flex items-center justify-center">
                          {plan.liveClass ? <Video className="w-4 h-4 text-emerald-400" /> : <span className="text-slate-600">-</span>}
                      </div>
                  </td>
                  <td className="p-4 text-right">
                    <button className="p-2 rounded-md hover:bg-slate-800 text-slate-500">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
