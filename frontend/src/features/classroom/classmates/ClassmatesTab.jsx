import React, { useEffect, useState } from 'react';
import { getClassMembers } from '../classroomService';

export default function ClassmatesTab({ classId = '' }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    getClassMembers(classId)
      .then(d => {
        const all = d?.members || [];
        setStudents(all.filter(m => ['student', 'pupil'].includes(String(m.role || '').toLowerCase())));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId]);

  return (
    <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#800020] mb-4">Classmates ({students.length})</p>
      {loading ? (
        <p className="text-sm font-semibold text-[#191970]">Loading classmates...</p>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#c9a96e]/40 bg-[#ade1f4] p-5 text-center">
          <p className="text-xs font-bold uppercase text-[#800020]">No classmates listed</p>
          <p className="mt-1 text-sm font-semibold text-[#191970]">Students enrolled in this class will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {students.map((item, i) => (
            <div key={item.id || item.name || i} className="rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4] p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[#191970]">{item.name || item.email || 'Student'}</p>
                {item.admissionNumber && <p className="text-xs font-semibold text-[#800020] mt-0.5">Adm: {item.admissionNumber}</p>}
              </div>
              <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-[10px] font-bold uppercase text-[#b5e3f4]">Student</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

