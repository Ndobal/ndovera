import React, { useState } from 'react';
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

// The behaviour section (attendance, affective areas, ratings, remarks) folds away; the choice
// is remembered on the device so it stays folded from student to student.
const BEHAVIOUR_OPEN_KEY = 'ndovera:ca-behaviour-open';
function behaviourOpenSaved() {
  try { return localStorage.getItem(BEHAVIOUR_OPEN_KEY) !== '0'; } catch { return true; }
}

export default function TeacherResultStudentCard({
  index,
  student,
  settings,
  permissions,
  profileLocked = false,
  onCaComponentChange,
  onScoreChange,
  onProfileFieldChange,
  onProfileMapChange,
  reportCard = null,
  onProfileExtraChange = () => {},
}) {
  const [behaviourOpen, setBehaviourOpen] = useState(behaviourOpenSaved);
  const toggleBehaviour = () => setBehaviourOpen(current => {
    try { localStorage.setItem(BEHAVIOUR_OPEN_KEY, current ? '0' : '1'); } catch { /* private mode */ }
    return !current;
  });
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
                <td className={`py-3 px-3 font-semibold ${RESULT_HEADING}`}>
                  {row.subjectName}
                  {row.override && (
                    <span
                      title={`Overridden by ${row.override.name || 'staff'}${row.override.at ? ` on ${new Date(row.override.at).toLocaleString()}` : ''}`}
                      className="ml-2 inline-block rounded-full border border-amber-400/60 bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                    >
                      {row.override.rank >= 2 ? 'HoS override' : 'Class teacher override'}
                    </span>
                  )}
                  {row.missing && row.editable !== false && (
                    <span className="block text-[10px] font-semibold text-amber-700">Not entered yet</span>
                  )}
                  {row.lockedByHandIn && (
                    <span className={`block text-[10px] font-normal ${RESULT_BODY}`}>Handed in</span>
                  )}
                  {row.editable === false && !row.heldAbove && !row.lockedByHandIn && (
                    <span className={`block text-[10px] font-normal ${RESULT_BODY}`}>View only</span>
                  )}
                  {row.heldAbove && (
                    <span className={`block text-[10px] font-normal ${RESULT_BODY}`}>Locked by a higher override</span>
                  )}
                </td>
                {caComponentDefinitions.map(component => (
                  <td key={`${row.subjectId}-${component.key}`} className="py-3 px-3">
                    <input
                      type="number"
                      min={0}
                      max={component.maxScore}
                      value={row.caComponents?.[component.key] ?? ''}
                      onChange={event => onCaComponentChange(student.id, row.subjectId, component.key, event.target.value)}
                      disabled={row.editable === false || (row.frozenKeys || []).includes(component.key) || (row.frozenKeys || []).includes('all')}
                      title={(row.frozenKeys || []).includes(component.key) || (row.frozenKeys || []).includes('all') ? 'Handed in — locked until it is returned' : undefined}
                      className={`${RESULT_INPUT} disabled:cursor-not-allowed disabled:opacity-60`}
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
                    disabled={row.editable === false}
                    className={`${RESULT_INPUT} disabled:cursor-not-allowed disabled:opacity-60`}
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
        <section className={`${RESULT_INNER_SURFACE} p-4`}>
          <button type="button" onClick={toggleBehaviour} aria-expanded={behaviourOpen} className="flex w-full items-center justify-between gap-3 text-left">
            <span>
              <span className={`micro-label block ${RESULT_LABEL}`}>Behaviour &amp; remarks</span>
              <span className={`mt-1 block text-sm ${RESULT_BODY}`}>Attendance, affective areas, ratings and remarks for the report card.</span>
            </span>
            <span className={`shrink-0 rounded-full border border-[#2447d8]/40 px-3 py-1 text-xs font-bold text-[#2447d8]`}>{behaviourOpen ? 'Hide ▲' : 'Show ▼'}</span>
          </button>
        {behaviourOpen && (
        <fieldset disabled={profileLocked} className="mt-4 space-y-4 disabled:opacity-70">
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

          {reportCard?.layout ? (
            // The report card's extra details: attendance figures, age, resumption date and physical development.
            <div>
              <p className={`micro-label mb-3 ${RESULT_LABEL}`}>Report card details</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['timesOpened', 'Times school opened', 'numeric'], ['daysPresent', 'Attendance (days)', 'numeric'], ['daysAbsent', 'Days absent', 'numeric'], ['age', 'Age', 'text'],
                  ...(reportCard.layout !== 'secondary' ? [['heightStart', 'Height at start (cm)', 'decimal'], ['heightEnd', 'Height at end (cm)', 'decimal'], ['weightStart', 'Weight at start (kg)', 'decimal'], ['weightEnd', 'Weight at end (kg)', 'decimal']] : []),
                  ['resumptionDate', 'Next term begins', 'text'],
                ].map(([key, label, mode]) => (
                  <label key={key} className={key === 'resumptionDate' ? 'col-span-2 block' : 'block'}>
                    <span className={`text-xs ${RESULT_BODY}`}>{label}</span>
                    <input type="text" inputMode={mode} maxLength={key === 'resumptionDate' ? 40 : 16} value={student.profile?.extra?.[key] ?? ''}
                      placeholder={key === 'resumptionDate' ? 'e.g. Monday, 27th April, 2026' : ''}
                      onChange={event => onProfileExtraChange(student.id, key, event.target.value)} className={`mt-1 ${RESULT_INPUT}`} />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {reportCard?.page2?.sections?.length ? (
            <div>
              <p className={`micro-label mb-1 ${RESULT_LABEL}`}>Page 2 · {reportCard.page2.title}</p>
              <p className={`mb-3 text-xs ${RESULT_BODY}`}>{reportCard.page2.mode === 'rating' ? 'Rate each skill 5 (excellent) to 1 (poor).' : 'Tick where the child is for each skill.'}</p>
              <div className="space-y-3">
                {reportCard.page2.sections.map(section => (
                  <div key={section.key} className="overflow-hidden rounded-xl border border-[#c9a96e]/35 dark:border-white/10">
                    <p className="bg-[#191970]/5 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#191970] dark:bg-white/5 dark:text-slate-100">{section.title}</p>
                    <ul className="divide-y divide-[#c9a96e]/20 dark:divide-white/10">
                      {section.items.map(item => {
                        const answer = String(student.profile?.extra?.page2?.[item.key] ?? '');
                        return (
                          <li key={item.key} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                            <span className={`min-w-[12rem] flex-1 text-sm ${RESULT_BODY}`}>{item.label}</span>
                            <div className="flex gap-1" role="radiogroup" aria-label={item.label}>
                              {reportCard.page2.scale.map(option => (
                                <button key={option.value} type="button" role="radio" aria-checked={answer === option.value} title={option.label}
                                  onClick={() => onProfileExtraChange(student.id, item.key, answer === option.value ? '' : option.value, true)}
                                  className={`rounded-lg border px-2 py-1 text-xs font-bold ${answer === option.value ? 'border-[#2447d8] bg-[#2447d8] text-white' : 'border-slate-300 bg-white text-slate-700 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200'}`}>
                                  {reportCard.page2.mode === 'rating' ? option.value : option.label}
                                </button>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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
        </fieldset>
        )}
        </section>
      )}
    </div>
  );
}