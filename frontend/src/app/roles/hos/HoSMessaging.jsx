import React from 'react';
import StudentMessaging from '../student/StudentMessaging';

export default function HoSMessaging({ auth }) {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Messaging</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          Send and receive messages with staff, parents, and teachers.
        </p>
      </div>
      <StudentMessaging />
    </div>
  );
}
