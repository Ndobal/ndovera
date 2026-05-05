import React, { useEffect, useState } from 'react';
import { getExams } from '../../../features/school/services/schoolApi';

export default function HoSExams({ auth }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getExams()
      .then((data) => setExams(data?.exams || data?.results || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Exams</h1>
          <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Scheduled and past examinations.</p>
        </div>
        <button
          onClick={() => window.location.assign('/roles/hos/exams/create')}
          className="bg-[#1a5c38] dark:bg-emerald-700 hover:bg-[#154a2e] dark:hover:bg-emerald-600 text-[#f5deb3] font-bold dark:text-white px-5 py-2.5 rounded-2xl text-sm transition-colors whitespace-nowrap"
        >
          Create Exam
        </button>
      </div>

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {loading ? (
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        ) : error ? (
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        ) : exams.length === 0 ? (
          <p className="text-[#800020] dark:text-slate-400">No exams scheduled.</p>
        ) : (
          <div className="space-y-3">
            {exams.map((ex, i) => (
              <div
                key={ex.id || i}
                className="rounded-2xl p-4 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5"
              >
                <p className="font-bold text-[#800000] dark:text-slate-100">{ex.title || ex.name || 'Exam'}</p>
                <div className="flex gap-4 mt-1">
                  {ex.status && <p className="text-xs text-[#800020] dark:text-slate-400 capitalize">{ex.status}</p>}
                  {ex.date && <p className="text-xs text-[#191970] dark:text-slate-300">{ex.date}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
