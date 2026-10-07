import React, { useState } from 'react';
import * as svc from './classroomService';

// Owner / HOS class picker: "My Supervised Classes | All Classes".
// Joining adds a class to the supervisor's workspace and exiting removes it;
// neither makes them the class's teacher or changes anything in the class.

const TAB = 'rounded-2xl border px-4 py-2 text-sm font-bold transition-colors';
const TAB_ON = 'bg-[#1a5c38] border-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:border-[#00ffff] dark:text-black';
const TAB_OFF = 'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-white';
const ACTION = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-3 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-white';
const PRIMARY = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] hover:bg-[#154a2e] disabled:opacity-50 dark:bg-[#00ffff] dark:text-black';

export default function SupervisionClassPicker({ classes, supervision, onEnter, onClassesChange, onPolicyChange }) {
  const joined = classes.filter(item => item.supervisionJoined);
  const [view, setView] = useState(joined.length ? 'mine' : 'all');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const isOwner = supervision.role === 'owner';
  const shown = view === 'mine' ? joined : classes;

  async function change(classroom, action) {
    setBusyId(classroom.id); setError('');
    const response = await svc.setClassSupervision(classroom.id, action).catch(err => ({ success: false, message: err.message }));
    setBusyId('');
    if (!response?.success) { setError(response?.message || 'Could not update your supervised classes.'); return; }
    onClassesChange(classes.map(item => (item.id === classroom.id ? { ...item, supervisionJoined: action === 'join' } : item)));
    if (action === 'join') onEnter(classroom.id);
  }

  async function changePolicy(event) {
    const response = await svc.setSupervisionPolicy(event.target.value).catch(err => ({ success: false, message: err.message }));
    if (!response?.success) { setError(response?.message || 'Could not change the policy.'); return; }
    onPolicyChange(response.hosMode);
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${TAB} ${view === 'mine' ? TAB_ON : TAB_OFF}`} onClick={() => setView('mine')}>My Supervised Classes ({joined.length})</button>
        <button type="button" className={`${TAB} ${view === 'all' ? TAB_ON : TAB_OFF}`} onClick={() => setView('all')}>All Classes ({classes.length})</button>
        {isOwner && (
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
            Head of School access
            <select value={supervision.hosMode} onChange={changePolicy} className="rounded-xl border border-[#c9a96e]/45 bg-[#fff8f0] p-2 text-sm text-[#191970]">
              <option value="intervene">Academic intervention</option>
              <option value="view">View only</option>
            </select>
          </label>
        )}
      </div>
      <p className="text-sm text-[#191970] dark:text-[#39ff14]">
        Supervising as {supervision.label}{supervision.canIntervene ? '' : ' (view only, by school policy)'}. Joining a class does not make you its teacher, and anything you change there is recorded as a supervisory action.
      </p>
      {error && <p role="alert" className="text-sm font-semibold text-[#800000]">{error}</p>}
      {shown.length === 0 ? (
        <p className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-4 text-sm text-[#191970] dark:bg-[#800000]/70 dark:text-[#39ff14]">
          {view === 'mine' ? 'You are not supervising any class yet. Open All Classes and choose Join Class.' : 'This school has no classes yet.'}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {shown.map(classroom => (
            <li key={classroom.id} className="rounded-3xl border border-[#c9a96e]/50 bg-[#b5e3f4] p-5 dark:border-[#bf00ff]/45 dark:bg-[#800000]/75">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-[#800000] dark:text-white">{classroom.className}</p>
                  <p className="mt-1 text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
                    {classroom.studentCount} students • {classroom.subjectCount} subjects • {classroom.materialCount} materials • {classroom.assignmentCount} assignments
                  </p>
                </div>
                {classroom.supervisionJoined ? (
                  <>
                    <button type="button" className={PRIMARY} onClick={() => onEnter(classroom.id)}>Enter Class</button>
                    <button type="button" className={ACTION} disabled={busyId === classroom.id} onClick={() => change(classroom, 'exit')}>Exit Class</button>
                  </>
                ) : (
                  <button type="button" className={PRIMARY} disabled={busyId === classroom.id} onClick={() => change(classroom, 'join')}>Join Class</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
