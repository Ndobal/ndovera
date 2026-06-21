import React, { useEffect, useState } from 'react';
import { getClassMembers } from '../classroomService';

export default function TeachersTab({ classId = '' }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    getClassMembers(classId)
      .then(d => {
        const all = d?.members || [];
        setTeachers(all.filter(m => ['teacher', 'classteacher', 'ict', 'ict_manager'].includes(String(m.role || '').toLowerCase())));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId]);

  return (
    <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#800020] mb-4">Your Teachers ({teachers.length})</p>
      {loading ? (
        <p className="text-sm font-bold text-[#191970]">Loading teachers...</p>
      ) : teachers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#c9a96e]/40 bg-[#ade1f4] p-5 text-center">
          <p className="text-xs font-bold uppercase text-[#800020]">No teachers listed</p>
          <p className="mt-1 text-sm font-bold text-[#191970]">Teachers assigned to this class will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teachers.map((item, i) => (
            <div key={item.id || item.name || i} className="rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4] p-4 flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-bold text-[#191970]">{item.name || item.email || 'Teacher'}</p>
                {item.subjectName && <p className="text-sm font-bold text-[#191970] mt-0.5">Subject: {item.subjectName}</p>}
                {item.email && <p className="text-xs font-semibold text-[#800020] mt-0.5">{item.email}</p>}
              </div>
              <span className="rounded-full bg-[#800020] px-3 py-1 text-[10px] font-bold uppercase text-[#b5e3f4] h-fit self-center">
                {item.role === 'classteacher' ? 'Class Teacher' : 'Teacher'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

