import React, { useMemo, useState } from 'react';
import {
  BarChart2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  LoaderCircle,
  PlayCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { useData } from '../hooks/useData';
import { fetchWithAuth } from '../services/apiClient';
import { Role } from '../types';

type AptitudeQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation?: string;
  points: number;
};

type AptitudeTestRecord = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  duration_minutes: number;
  candidate_count: number;
  status: 'Draft' | 'Scheduled' | 'Active' | 'Completed';
  scheduled_for?: string | null;
  average_score?: number | null;
  success_rate?: number | null;
  created_at: string;
  questions: AptitudeQuestion[];
};

type AptitudeResponse = {
  tests: AptitudeTestRecord[];
  allowedCategories: string[];
};

type AptitudeTestsProps = {
  role: Role;
  searchQuery?: string;
};

const EMPTY_QUESTION = (): AptitudeQuestion => ({
  id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  prompt: '',
  options: ['', '', '', ''],
  answer: '',
  explanation: '',
  points: 1,
});

export function AptitudeTests({ role, searchQuery }: AptitudeTestsProps) {
  const { data, loading, error, refetch } = useData<AptitudeResponse>('/api/aptitude-tests');
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [draft, setDraft] = useState({
    title: '',
    category: 'Admission',
    description: '',
    duration_minutes: 45,
    candidate_count: 20,
    status: 'Draft' as AptitudeTestRecord['status'],
    scheduled_for: '',
    questions: [EMPTY_QUESTION()],
  });

  const tests = data?.tests || [];
  const allowedCategories = data?.allowedCategories?.length ? data.allowedCategories : ['Admission', 'Scholarship'];
  const canManage = ['Teacher', 'HoS', 'HOS', 'School Admin', 'Owner', 'ICT Manager'].includes(role);

  const categories = useMemo(() => ['All', ...Array.from(new Set([...allowedCategories, ...tests.map((test) => test.category)]))], [allowedCategories, tests]);

  const filteredTests = useMemo(() => tests.filter((test) => {
    const matchesSearch = !searchQuery || [test.title, test.category, test.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || test.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || test.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  }), [categoryFilter, searchQuery, statusFilter, tests]);

  const stats = useMemo(() => {
    const active = tests.filter((test) => test.status === 'Active').length;
    const candidates = tests.reduce((sum, test) => sum + Number(test.candidate_count || 0), 0);
    const completed = tests.filter((test) => test.status === 'Completed');
    const avgScore = completed.length
      ? Math.round(completed.reduce((sum, test) => sum + Number(test.average_score || 0), 0) / completed.length)
      : 0;
    const successRate = completed.length
      ? Math.round(completed.reduce((sum, test) => sum + Number(test.success_rate || 0), 0) / completed.length)
      : 0;
    const questionCount = tests.reduce((sum, test) => sum + (Array.isArray(test.questions) ? test.questions.length : 0), 0);
    return { active, candidates, avgScore, successRate, questionCount };
  }, [tests]);

  const topCategories = useMemo(() => {
    const totals = filteredTests.reduce<Record<string, { count: number; totalScore: number }>>((acc, test) => {
      if (!acc[test.category]) acc[test.category] = { count: 0, totalScore: 0 };
      acc[test.category].count += 1;
      acc[test.category].totalScore += Number(test.average_score || 0);
      return acc;
    }, {});

    return Object.entries(totals).map(([label, value]) => ({
      label,
      score: value.count ? Math.round(value.totalScore / value.count) : 0,
    }));
  }, [filteredTests]);

  const nextTest = useMemo(() => [...tests]
    .filter((test) => test.status === 'Scheduled' || test.status === 'Active')
    .sort((left, right) => String(left.scheduled_for || left.created_at).localeCompare(String(right.scheduled_for || right.created_at)))[0] || null, [tests]);

  const updateQuestion = (questionId: string, updater: (question: AptitudeQuestion) => AptitudeQuestion) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) => question.id === questionId ? updater(question) : question),
    }));
  };

  const addQuestion = () => {
    setDraft((current) => ({ ...current, questions: [...current.questions, EMPTY_QUESTION()] }));
  };

  const removeQuestion = (questionId: string) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.length === 1 ? current.questions : current.questions.filter((question) => question.id !== questionId),
    }));
  };

  const resetDraft = () => {
    setDraft({
      title: '',
      category: allowedCategories[0] || 'Admission',
      description: '',
      duration_minutes: 45,
      candidate_count: 20,
      status: 'Draft',
      scheduled_for: '',
      questions: [EMPTY_QUESTION()],
    });
  };

  const createTest = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      await fetchWithAuth('/api/aptitude-tests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          questions: draft.questions.filter((question) => question.prompt.trim() && question.options.filter((option) => option.trim()).length >= 2 && question.answer.trim()),
        }),
      });
      resetDraft();
      setIsCreating(false);
      await refetch();
    } finally {
      setSaving(false);
    }
  };

  const moveStatus = async (test: AptitudeTestRecord, status: AptitudeTestRecord['status']) => {
    setBusyId(test.id);
    try {
      await fetchWithAuth(`/api/aptitude-tests/${test.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status,
          title: test.title,
          category: test.category,
          description: test.description,
          duration_minutes: test.duration_minutes,
          candidate_count: test.candidate_count,
          average_score: status === 'Completed' ? Number(test.average_score || 72) : Number(test.average_score || 0),
          success_rate: status === 'Completed' ? Number(test.success_rate || 68) : Number(test.success_rate || 0),
          scheduled_for: test.scheduled_for,
          questions: test.questions,
        }),
      });
      await refetch();
    } finally {
      setBusyId(null);
    }
  };

  const statusTone: Record<AptitudeTestRecord['status'], string> = {
    Draft: 'bg-zinc-500/10 text-zinc-400',
    Scheduled: 'bg-blue-500/10 text-blue-400',
    Active: 'bg-emerald-500/10 text-emerald-400',
    Completed: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Aptitude Tests</h2>
          <p className="text-xs text-zinc-500">Create admission, scholarship, placement, recruitment, and evaluation tests with role-aware category access and built-in question authoring.</p>
        </div>
        {canManage ? (
          <button onClick={() => setIsCreating((current) => !current)} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/20 transition-colors hover:bg-emerald-500">
            <Plus size={16} /> {isCreating ? 'Close Builder' : 'Create New Test'}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-5">
          <div className="card-mini flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><ClipboardList size={16} /></div>
            <div><p className="text-[9px] font-bold uppercase text-zinc-500">Active Tests</p><p className="text-base font-mono font-bold text-white">{stats.active}</p></div>
          </div>
          <div className="card-mini flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><Users size={16} /></div>
            <div><p className="text-[9px] font-bold uppercase text-zinc-500">Candidates</p><p className="text-base font-mono font-bold text-white">{stats.candidates}</p></div>
          </div>
          <div className="card-mini flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500"><CheckCircle2 size={16} /></div>
            <div><p className="text-[9px] font-bold uppercase text-zinc-500">Avg. Score</p><p className="text-base font-mono font-bold text-white">{stats.avgScore}%</p></div>
          </div>
          <div className="card-mini flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500"><BarChart2 size={16} /></div>
            <div><p className="text-[9px] font-bold uppercase text-zinc-500">Success Rate</p><p className="text-base font-mono font-bold text-white">{stats.successRate}%</p></div>
          </div>
          <div className="card-mini flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400"><Sparkles size={16} /></div>
            <div><p className="text-[9px] font-bold uppercase text-zinc-500">Questions</p><p className="text-base font-mono font-bold text-white">{stats.questionCount}</p></div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-1">
          <div className="card-compact">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Performance Insights</h3>
            <div className="space-y-4">
              {topCategories.length ? topCategories.map((item, index) => {
                const tones = ['bg-emerald-500', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500'];
                return (
                  <div key={item.label}>
                    <div className="mb-1.5 flex justify-between text-[10px]"><span className="text-zinc-500">{item.label}</span><span className="font-bold text-white">{item.score}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className={`h-full ${tones[index % tones.length]}`} style={{ width: `${Math.max(8, item.score)}%` }}></div></div>
                  </div>
                );
              }) : <div className="text-xs text-zinc-500">Performance insights will appear as soon as tests are created.</div>}
            </div>
          </div>

          <div className="card-compact border-emerald-500/10 bg-emerald-600/5">
            <p className="mb-2 text-[10px] font-bold uppercase text-emerald-500">Next Test</p>
            {nextTest ? (
              <>
                <p className="text-xs font-bold text-white">{nextTest.title}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-zinc-500"><CalendarDays size={12} /> {new Date(nextTest.scheduled_for || nextTest.created_at).toLocaleString()} • {nextTest.candidate_count} candidates</p>
                <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-emerald-500">
                  <PlayCircle size={14} /> Open test flow
                </button>
              </>
            ) : <p className="mt-1 text-[10px] text-zinc-500">No scheduled aptitude test yet.</p>}
          </div>

          <div className="card-compact">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Role guardrails</h3>
            <p className="text-xs leading-6 text-zinc-500">Teachers can create only Admission and Scholarship tests. HOS, ICT Manager, School Admin, and Owner roles can access the extended categories.</p>
          </div>
        </div>
      </div>

      {isCreating ? (
        <div className="card-compact space-y-4 border border-emerald-500/20 bg-emerald-500/5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Test title" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
            <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
              {allowedCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
            <input type="number" min="10" value={draft.duration_minutes} onChange={(event) => setDraft((current) => ({ ...current, duration_minutes: Number(event.target.value) || 30 }))} placeholder="Duration (minutes)" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
            <input type="number" min="0" value={draft.candidate_count} onChange={(event) => setDraft((current) => ({ ...current, candidate_count: Number(event.target.value) || 0 }))} placeholder="Candidate count" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
            <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AptitudeTestRecord['status'] }))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
              <option value="Draft">Draft</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
            </select>
            <input type="datetime-local" value={draft.scheduled_for} onChange={(event) => setDraft((current) => ({ ...current, scheduled_for: event.target.value }))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
            <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Purpose, audience, instructions, or notes..." className="min-h-30 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-white">Question Builder</p>
                <p className="text-xs text-zinc-500">Add objective questions directly before publishing the test.</p>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {draft.questions.map((question, index) => (
                <div key={question.id} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Question {index + 1}</p>
                    <button onClick={() => removeQuestion(question.id)} className="rounded-xl border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">Remove</button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <textarea value={question.prompt} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, prompt: event.target.value }))} placeholder="Question prompt" className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
                    {question.options.map((option, optionIndex) => (
                      <input key={`${question.id}_${optionIndex}`} value={option} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === optionIndex ? event.target.value : item) }))} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                    ))}
                    <input value={question.answer} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, answer: event.target.value }))} placeholder="Correct answer (must match one option)" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                    <input type="number" min="1" value={question.points} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, points: Number(event.target.value) || 1 }))} placeholder="Points" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                    <textarea value={question.explanation || ''} onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, explanation: event.target.value }))} placeholder="Explanation (optional)" className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
                  </div>
                  {index === draft.questions.length - 1 ? (
                    <div className="mt-4 flex justify-end">
                      <button onClick={addQuestion} className="rounded-xl bg-white/8 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200 hover:bg-white/12">Add question</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setIsCreating(false)} className="rounded-xl border border-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-300">Cancel</button>
            <button onClick={() => void createTest()} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Test'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white outline-none">
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white outline-none">
          {['All', 'Draft', 'Scheduled', 'Active', 'Completed'].map((status) => <option key={status}>{status}</option>)}
        </select>
        {loading ? <div className="inline-flex items-center gap-2 text-xs text-zinc-400"><LoaderCircle size={14} className="animate-spin" /> Loading tests...</div> : null}
        {error ? <div className="text-xs text-amber-300">Unable to load aptitude tests right now.</div> : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-3">
            {filteredTests.map((test) => (
              <div key={test.id} className="card-compact group cursor-pointer">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-emerald-500 transition-all group-hover:bg-emerald-600 group-hover:text-white">
                      <ClipboardList size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">{test.title}</h4>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-[9px] font-bold uppercase text-zinc-500">{test.category}</span>
                        <span className="h-1 w-1 rounded-full bg-zinc-700"></span>
                        <span className="text-[9px] font-mono text-zinc-500">{new Date(test.scheduled_for || test.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-500">{test.description || 'No description provided yet.'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden text-right sm:block">
                      <p className="text-[10px] font-bold uppercase text-zinc-500">Questions</p>
                      <p className="text-xs font-mono text-white">{test.questions?.length || 0}</p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${statusTone[test.status]}`}>{test.status}</span>
                    <ChevronRight size={16} className="text-zinc-600 transition-colors group-hover:text-white" />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4 text-[11px] text-zinc-400">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1"><Clock size={12} /> {test.duration_minutes} mins</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1"><Users size={12} /> {test.candidate_count} candidates</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1"><ShieldCheck size={12} /> {test.questions?.length || 0} questions</span>
                  {test.status === 'Completed' ? <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-3 py-1 text-purple-300"><BarChart2 size={12} /> {Math.round(Number(test.average_score || 0))}% avg</span> : null}
                  {canManage ? (
                    <div className="ml-auto flex gap-2">
                      {test.status !== 'Active' ? <button disabled={busyId === test.id} onClick={() => void moveStatus(test, 'Active')} className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60">Start</button> : null}
                      {test.status !== 'Scheduled' ? <button disabled={busyId === test.id} onClick={() => void moveStatus(test, 'Scheduled')} className="rounded-full bg-blue-500/10 px-3 py-1 text-blue-300 hover:bg-blue-500/20 disabled:opacity-60">Schedule</button> : null}
                      {test.status !== 'Completed' ? <button disabled={busyId === test.id} onClick={() => void moveStatus(test, 'Completed')} className="rounded-full bg-purple-500/10 px-3 py-1 text-purple-300 hover:bg-purple-500/20 disabled:opacity-60">Complete</button> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {!filteredTests.length && !loading ? <div className="card-compact text-sm text-zinc-500">No aptitude tests match the current filters.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AptitudeTests;
