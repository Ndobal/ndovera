import React from 'react';
import {
  RESULT_BODY,
  RESULT_HEADING,
  RESULT_INNER_SURFACE,
  RESULT_INPUT,
  RESULT_LABEL,
  RESULT_TABLE_HEAD,
  RESULT_TABLE_ROW,
  getBatchTone,
} from './resultSheetTheme';
import { normalizeCaComponentDefinitions, resolveResultScoreModel } from '../utils/resultEngineTransforms';

export default function TeacherResultStudentCard({
  index,
  student,
  settings,
  permissions,
  onCaComponentChange,
  onScoreChange,
  onProfileFieldChange,
  onProfileMapChange,
}) {
  const affectiveDomains = Array.isArray(settings?.affectiveDomains) ? settings.affectiveDomains : [];
  const ratingDomains = Array.isArray(settings?.metadata?.ratingDomains) ? settings.metadata.ratingDomains : [];
  const scoreModel = resolveResultScoreModel(settings);
  const caComponentDefinitions = normalizeCaComponentDefinitions(settings);
  const componentTableWidth = 560 + (caComponentDefinitions.length * 120);

  return (
    <div className={`${RESULT_INNER_SURFACE} p-4 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getBatchTone(student.status === 'active' ? 'published' : 'draft')}`}>
              S/N {Number(index) + 1}
            </span>
            <span className={`text-xs font-semibold ${RESULT_LABEL}`}>Student Row</span>
          </div>
          <p className={`mt-2 text-lg font-semibold ${RESULT_HEADING}`}>{student.name} {student.displayId ? `• ${student.displayId}` : ''}</p>
          <p className={`text-xs mt-1 ${RESULT_BODY}`}>Average: {student.average}% • Grade: {student.grade || '—'} • Subject rows: {student.rows.length}</p>
        </div>
        <div className="text-right">
          <p className={`micro-label ${RESULT_LABEL}`}>Class</p>
          <p className={`text-sm mt-1 ${RESULT_BODY}`}>{student.className || 'Current class'}</p>
        </div>
      </div>

      <div className={`${RESULT_INNER_SURFACE} p-4 grid gap-3 md:grid-cols-4`}>
        <div>
          <p className={`micro-label ${RESULT_LABEL}`}>Student</p>
          <p className={`mt-2 text-sm font-semibold ${RESULT_HEADING}`}>{student.name}</p>
        </div>
        <div>
          <p className={`micro-label ${RESULT_LABEL}`}>Attendance</p>
          <p className={`mt-2 text-sm font-semibold ${RESULT_BODY}`}>{student.profile?.attendanceRate ?? 0}%</p>
        </div>
        <div>
          <p className={`micro-label ${RESULT_LABEL}`}>Promotion</p>
          <p className={`mt-2 text-sm font-semibold ${RESULT_BODY}`}>{student.profile?.promotionStatus || 'Pending'}</p>
        </div>
        <div>
          <p className={`micro-label ${RESULT_LABEL}`}>Result Status</p>
          <p className={`mt-2 text-sm font-semibold ${RESULT_BODY}`}>{student.status || 'active'}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: `${componentTableWidth}px` }}>
          <thead className={RESULT_TABLE_HEAD}>
            <tr className="text-left">
              <th className="micro-label py-3 px-3">Subject</th>
              {caComponentDefinitions.map(component => (
                <th key={component.key} className="micro-label py-3 px-3">{component.label} ({component.maxScore})</th>
              ))}
              <th className="micro-label py-3 px-3">CA Total ({scoreModel.caMaxScore})</th>
              <th className="micro-label py-3 px-3">Exam ({scoreModel.examMaxScore})</th>
              <th className="micro-label py-3 px-3">Total ({scoreModel.totalMaxScore})</th>
              <th className="micro-label py-3 px-3">Grade</th>
              <th className="micro-label py-3 px-3">Remark</th>
            </tr>
          </thead>
          <tbody>
            {student.rows.map(row => (
              <tr key={`${student.id}-${row.subjectId}`} className={RESULT_TABLE_ROW}>
                <td className={`py-3 px-3 font-semibold ${RESULT_HEADING}`}>{row.subjectName}</td>
                {caComponentDefinitions.map(component => (
                  <td key={`${row.subjectId}-${component.key}`} className="py-3 px-3">
                    <input
                      type="number"
                      min={0}
                      max={component.maxScore}
                      value={row.caComponents?.[component.key] ?? ''}
                      onChange={event => onCaComponentChange(student.id, row.subjectId, component.key, event.target.value)}
                      className={RESULT_INPUT}
                    />
                  </td>
                ))}
                <td className={`py-3 px-3 font-semibold ${RESULT_BODY}`}>{row.ca}</td>
                <td className="py-3 px-3">
                  <input
                    type="number"
                    min={0}
                    max={scoreModel.examMaxScore}
                    value={row.exam}
                    onChange={event => onScoreChange(student.id, row.subjectId, 'exam', event.target.value)}
                    className={RESULT_INPUT}
                  />
                </td>
                <td className={`py-3 px-3 font-semibold ${RESULT_BODY}`}>{row.total}</td>
                <td className={`py-3 px-3 font-black ${RESULT_HEADING}`}>{row.grade || '—'}</td>
                <td className={`py-3 px-3 ${RESULT_BODY}`}>{row.remark || 'Pending'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {permissions?.canManageProfiles && (
        <div className={`${RESULT_INNER_SURFACE} p-4 space-y-4`}>
          <div>
            <p className={`micro-label ${RESULT_LABEL}`}>Review Fields</p>
            <p className={`mt-2 text-sm ${RESULT_BODY}`}>Attendance, affective areas, ratings, and remarks support the approval flow that sits on top of the CA sheet.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Attendance %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={student.profile?.attendanceRate ?? 0}
                onChange={event => onProfileFieldChange(student.id, 'attendanceRate', event.target.value)}
                className={`mt-2 ${RESULT_INPUT}`}
              />
            </label>
            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Promotion Status</span>
              <input
                type="text"
                value={student.profile?.promotionStatus || ''}
                onChange={event => onProfileFieldChange(student.id, 'promotionStatus', event.target.value)}
                className={`mt-2 ${RESULT_INPUT}`}
              />
            </label>
          </div>

          {affectiveDomains.length > 0 && (
            <div>
              <p className={`micro-label mb-3 ${RESULT_LABEL}`}>Affective Areas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {affectiveDomains.map(domain => (
                  <label key={`${student.id}-${domain.key}`} className="block">
                    <span className={`text-xs ${RESULT_BODY}`}>{domain.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={student.profile?.affective?.[domain.key] ?? ''}
                      onChange={event => onProfileMapChange(student.id, 'affective', domain.key, event.target.value)}
                      className={`mt-2 ${RESULT_INPUT}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {ratingDomains.length > 0 && (
            <div>
              <p className={`micro-label mb-3 ${RESULT_LABEL}`}>Ratings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {ratingDomains.map(domain => (
                  <label key={`${student.id}-${domain.key}`} className="block">
                    <span className={`text-xs ${RESULT_BODY}`}>{domain.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={student.profile?.ratings?.[domain.key] ?? ''}
                      onChange={event => onProfileMapChange(student.id, 'ratings', domain.key, event.target.value)}
                      className={`mt-2 ${RESULT_INPUT}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Teacher Remark</span>
              <textarea
                rows={3}
                value={student.profile?.teacherRemark || ''}
                onChange={event => onProfileFieldChange(student.id, 'teacherRemark', event.target.value)}
                className={`mt-2 ${RESULT_INPUT}`}
              />
            </label>
            <label className="block">
              <span className={`micro-label ${RESULT_LABEL}`}>Principal / HoS Remark</span>
              <textarea
                rows={3}
                value={student.profile?.principalRemark || ''}
                onChange={event => onProfileFieldChange(student.id, 'principalRemark', event.target.value)}
                className={`mt-2 ${RESULT_INPUT}`}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}