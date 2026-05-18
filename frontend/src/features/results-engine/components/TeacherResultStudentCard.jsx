import React from 'react';

export default function TeacherResultStudentCard({
  student,
  settings,
  permissions,
  onScoreChange,
  onProfileFieldChange,
  onProfileMapChange,
}) {
  const affectiveDomains = Array.isArray(settings?.affectiveDomains) ? settings.affectiveDomains : [];
  const ratingDomains = Array.isArray(settings?.metadata?.ratingDomains) ? settings.metadata.ratingDomains : [];

  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-slate-100 font-semibold">{student.name} {student.displayId ? `• ${student.displayId}` : ''}</p>
          <p className="text-xs text-slate-300 mt-1">Average: {student.average}% • Grade: {student.grade || '—'}</p>
        </div>
        <div className="text-right">
          <p className="micro-label accent-indigo">Class</p>
          <p className="text-slate-200 text-sm mt-1">{student.className || 'Current class'}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left">
              <th className="micro-label py-2 pr-4">Subject</th>
              <th className="micro-label py-2 pr-4">CA (40)</th>
              <th className="micro-label py-2 pr-4">Exam (60)</th>
              <th className="micro-label py-2 pr-4">Total</th>
              <th className="micro-label py-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {student.rows.map(row => (
              <tr key={`${student.id}-${row.subjectId}`} className="border-t border-white/10">
                <td className="py-2 pr-4 text-slate-100">{row.subjectName}</td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={row.ca}
                    onChange={event => onScoreChange(student.id, row.subjectId, 'ca', event.target.value)}
                    className="w-20 rounded-xl bg-slate-900/50 border border-white/10 px-2 py-1 text-slate-100"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={row.exam}
                    onChange={event => onScoreChange(student.id, row.subjectId, 'exam', event.target.value)}
                    className="w-20 rounded-xl bg-slate-900/50 border border-white/10 px-2 py-1 text-slate-100"
                  />
                </td>
                <td className="py-2 pr-4 mono-metric text-slate-100">{row.total}</td>
                <td className="py-2 command-title accent-emerald">{row.grade || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {permissions?.canManageProfiles && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/20 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="micro-label accent-amber">Attendance %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={student.profile?.attendanceRate ?? 0}
                onChange={event => onProfileFieldChange(student.id, 'attendanceRate', event.target.value)}
                className="mt-2 w-full rounded-xl bg-slate-900/50 border border-white/10 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="micro-label accent-indigo">Promotion Status</span>
              <input
                type="text"
                value={student.profile?.promotionStatus || ''}
                onChange={event => onProfileFieldChange(student.id, 'promotionStatus', event.target.value)}
                className="mt-2 w-full rounded-xl bg-slate-900/50 border border-white/10 px-3 py-2 text-slate-100"
              />
            </label>
          </div>

          {affectiveDomains.length > 0 && (
            <div>
              <p className="micro-label accent-rose mb-3">Affective Areas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {affectiveDomains.map(domain => (
                  <label key={`${student.id}-${domain.key}`} className="block">
                    <span className="text-xs text-slate-300">{domain.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={student.profile?.affective?.[domain.key] ?? ''}
                      onChange={event => onProfileMapChange(student.id, 'affective', domain.key, event.target.value)}
                      className="mt-2 w-full rounded-xl bg-slate-900/50 border border-white/10 px-3 py-2 text-slate-100"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {ratingDomains.length > 0 && (
            <div>
              <p className="micro-label accent-emerald mb-3">Ratings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {ratingDomains.map(domain => (
                  <label key={`${student.id}-${domain.key}`} className="block">
                    <span className="text-xs text-slate-300">{domain.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={student.profile?.ratings?.[domain.key] ?? ''}
                      onChange={event => onProfileMapChange(student.id, 'ratings', domain.key, event.target.value)}
                      className="mt-2 w-full rounded-xl bg-slate-900/50 border border-white/10 px-3 py-2 text-slate-100"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="micro-label accent-indigo">Teacher Remark</span>
              <textarea
                rows={3}
                value={student.profile?.teacherRemark || ''}
                onChange={event => onProfileFieldChange(student.id, 'teacherRemark', event.target.value)}
                className="mt-2 w-full rounded-xl bg-slate-900/50 border border-white/10 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="block">
              <span className="micro-label accent-amber">Principal / HoS Remark</span>
              <textarea
                rows={3}
                value={student.profile?.principalRemark || ''}
                onChange={event => onProfileFieldChange(student.id, 'principalRemark', event.target.value)}
                className="mt-2 w-full rounded-xl bg-slate-900/50 border border-white/10 px-3 py-2 text-slate-100"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}