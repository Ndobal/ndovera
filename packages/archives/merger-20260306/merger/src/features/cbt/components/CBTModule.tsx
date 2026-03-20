import React from 'react';
import { Plus, Library, Search, MoreVertical } from 'lucide-react';

const mockExams = [
  { id: 'exam_01', title: 'Mid-Term Mathematics Exam', subject: 'Mathematics', class: 'SS3', questions: 50, duration: 90, status: 'Published' },
  { id: 'exam_02', title: 'Biology Practical Test', subject: 'Biology', class: 'SS3', questions: 20, duration: 60, status: 'Draft' },
  { id: 'exam_03', title: 'End of Term History Exam', subject: 'History', class: 'SS3', questions: 100, duration: 120, status: 'Archived' },
];

const StatusPill = ({ status }) => {
    const styles = {
        'Published': 'bg-emerald-500/10 text-emerald-400',
        'Draft': 'bg-amber-500/10 text-amber-400',
        'Archived': 'bg-slate-500/10 text-slate-400',
    };
    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
            {status}
        </span>
    );
};

export default function CBTModule() {
  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">CBT and Exams</h1>
          <p className="text-sm text-slate-400">Create, manage, and administer online exams.</p>
        </div>
        <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
                <Library className="w-4 h-4" />
                Manage Question Bank
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                <Plus className="w-4 h-4" />
                Create New Exam
            </button>
        </div>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                        type="text"
                        placeholder="Search exams..."
                        className="pl-10 pr-4 py-2 bg-slate-800 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-emerald-500 transition-all text-slate-200"
                    />
                </div>
            </div>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Exam Title</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Subject</th>
              <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Class</th>
              <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Questions</th>
              <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Duration (Mins)</th>
              <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
              <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {mockExams.map(exam => (
              <tr key={exam.id}>
                <td className="p-4 text-sm font-medium text-slate-200">{exam.title}</td>
                <td className="p-4 text-sm text-slate-400">{exam.subject}</td>
                <td className="p-4 text-sm text-center font-mono text-slate-400">{exam.class}</td>
                <td className="p-4 text-sm text-center font-mono text-slate-400">{exam.questions}</td>
                <td className="p-4 text-sm text-center font-mono text-slate-400">{exam.duration}</td>
                <td className="p-4 text-center"><StatusPill status={exam.status} /></td>
                <td className="p-4 text-right">
                  <button className="p-2 rounded-md hover:bg-slate-800 text-slate-500">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
