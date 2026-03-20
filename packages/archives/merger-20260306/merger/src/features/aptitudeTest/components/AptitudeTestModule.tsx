import React from 'react';
import { FileText, CheckCircle, Clock, Plus, Search, Filter, Play, BarChart2, UserPlus } from 'lucide-react';
import { UserRole } from '../../../shared/types';

export default function AptitudeTestModule({ role }: { role: UserRole }) {
  const isAdmin = [UserRole.SUPER_ADMIN, UserRole.PROPRIETOR, UserRole.HOS, UserRole.PRINCIPAL].includes(role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Online Aptitude Tests</h2>
          <p className="text-slate-500">Manage recruitment tests for staff and admission tests for students.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => alert('Opening Test Creator...')}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Test
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100">Active Tests</h4>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">8</p>
          <p className="text-xs text-slate-400 mt-1">4 Staff • 4 Student</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100">Submissions</h4>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">156</p>
          <p className="text-xs text-slate-400 mt-1">This month</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-500/10 text-purple-600 rounded-lg">
              <BarChart2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100">Avg. Score</h4>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">72%</p>
          <p className="text-xs text-slate-400 mt-1">Across all tests</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Test Management</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-medium">All</button>
            <button className="px-3 py-1 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-xs font-medium">Staff Recruitment</button>
            <button className="px-3 py-1 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-xs font-medium">Student Admission</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Test Title</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Questions</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {[
                { title: 'Senior Mathematics Teacher Recruitment', type: 'Staff', questions: 50, duration: '60m', status: 'Active' },
                { title: 'JSS1 Admission Entrance Exam', type: 'Student', questions: 100, duration: '120m', status: 'Active' },
                { title: 'Administrative Officer Test', type: 'Staff', questions: 40, duration: '45m', status: 'Draft' },
                { title: 'Primary 1 Readiness Test', type: 'Student', questions: 20, duration: '30m', status: 'Active' },
                { title: 'ICT Manager Technical Test', type: 'Staff', questions: 30, duration: '90m', status: 'Archived' },
              ].map((test, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{test.title}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${test.type === 'Staff' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {test.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{test.questions} Qs</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{test.duration}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      test.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                      test.status === 'Draft' ? 'bg-amber-100 text-amber-700' : 
                      'bg-slate-100 dark:bg-slate-800 text-slate-600'
                    }`}>
                      {test.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3">
                      <button className="text-emerald-600 font-bold hover:underline">Edit</button>
                      <button className="text-slate-400 font-bold hover:text-slate-600">Results</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Recent Applicant Results</h3>
          <div className="space-y-4">
            {[
              { name: 'Samuel Adebayo', test: 'Math Teacher', score: '88%', status: 'Qualified' },
              { name: 'Janet Okafor', test: 'Admin Officer', score: '62%', status: 'Review' },
              { name: 'Daniel Obi', test: 'JSS1 Admission', score: '94%', status: 'Qualified' },
            ].map((res, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{res.name}</p>
                    <p className="text-xs text-slate-500">{res.test}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{res.score}</p>
                  <span className={`text-[10px] font-bold uppercase ${res.status === 'Qualified' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {res.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-black p-8 rounded-2xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-4">Adaptive Testing Mode</h3>
            <p className="text-slate-400 text-sm mb-6">Enable adaptive testing to automatically adjust question difficulty based on applicant performance. This provides a more accurate assessment of skills.</p>
            <div className="flex items-center gap-4">
              <button className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors">
                Configure Adaptive
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>Currently Enabled</span>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 -right-8 opacity-10">
            <Play className="w-48 h-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
