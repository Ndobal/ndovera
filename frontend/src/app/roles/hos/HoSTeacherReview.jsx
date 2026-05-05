import React, { useEffect, useState } from 'react';
import { getPeople } from '../../../features/school/services/schoolApi';

export default function HoSTeacherReview({ auth }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getPeople()
      .then((data) => {
        const all = data?.people || [];
        setTeachers(all.filter((p) => (p.role || '').toLowerCase() === 'teacher'));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Teacher Review</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          Review all enrolled teachers in your school.
        </p>
      </div>

      {loading ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        </div>
      ) : teachers.length === 0 ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800020] dark:text-slate-400">No teachers enrolled yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {teachers.map((t) => (
            <div
              key={t.id}
              className="rounded-3xl p-5 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10"
            >
              <p className="font-bold text-[#800000] dark:text-slate-100">{t.name || '—'}</p>
              <p className="text-[#191970] dark:text-slate-300 text-sm mt-1">{t.email || '—'}</p>
              <p className="text-xs text-[#800020] dark:text-slate-400 mt-1 capitalize">{t.role}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
