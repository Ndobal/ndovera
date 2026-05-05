import React, { useEffect, useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { getStudentDashboard } from '../../../services/roleDashboardService';
import { getStoredAuth } from '../../../features/auth/services/authApi';

export default function StudentOverview() {
  const storedAuth = getStoredAuth();
  const storedName = storedAuth?.user?.name || storedAuth?.user?.email || 'Student';

  const [data, setData] = useState({
    studentName: storedName,
    roleWatermark: 'STUDENT',
    metrics: [],
    quickLinks: [
      { name: 'Classroom', path: '/roles/student/classroom' },
      { name: 'Practice', path: '/roles/student/practice' },
      { name: 'Assignments', path: '/roles/student/assignments' },
      { name: 'Materials', path: '/roles/student/materials' },
      { name: 'Results', path: '/roles/student/results' },
    ],
    notices: [],
    classId: null,
    className: null,
    displayId: null,
  });

  useEffect(() => {
    let mounted = true;
    getStudentDashboard().then(result => {
      if (mounted && result) setData(prev => ({ ...prev, ...result }));
    }).catch(() => {/* use defaults */});
    return () => { mounted = false; };
  }, []);

  return (
    <StudentSectionShell
      title={`Welcome, ${data.studentName}`}
      subtitle={data.className ? `Class: ${data.className}` : 'Here is your dashboard.'}
    >
      {data.displayId && (
        <div className="mb-4 flex items-center gap-3">
          <span style={{ background: '#f5deb3', color: '#800020', fontWeight: 700, borderRadius: 8, padding: '2px 14px', fontSize: 13 }}>
            ID: {data.displayId}
          </span>
          {data.className && (
            <span style={{ background: '#f5deb3', color: '#191970', fontWeight: 600, borderRadius: 8, padding: '2px 14px', fontSize: 13 }}>
              {data.className}
            </span>
          )}
        </div>
      )}

      <div className="relative mb-6">
        {data.metrics.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {data.metrics.map(metric => (
                <div key={metric.label} style={{ background: '#f5deb3', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                  <p style={{ color: '#800020', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{metric.label}</p>
                  <p style={{ color: '#191970', fontSize: 24, fontWeight: 800 }}>{metric.value}</p>
                </div>
              ))}
            </div>
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl md:text-7xl font-black tracking-[0.6rem] text-white/5 select-none">
              {data.roleWatermark}
            </p>
          </>
        ) : (
          <div style={{ background: '#f5deb3', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <p style={{ color: '#800000', fontWeight: 700, marginBottom: 8 }}>No metrics yet</p>
            <p style={{ color: '#191970', fontSize: 14 }}>Attendance, scores and assignment metrics will appear here once your teacher starts recording them.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section style={{ background: '#f5deb3', borderRadius: 16, padding: 24 }}>
          <h2 style={{ color: '#800000', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Quick Links</h2>
          <div className="grid grid-cols-2 gap-3">
            {data.quickLinks.map(link => (
              <a
                key={link.name}
                href={link.path}
                style={{ background: '#1a5c38', color: '#f5deb3', fontWeight: 700, borderRadius: 10, padding: '12px 16px', textDecoration: 'none', textAlign: 'center', display: 'block' }}
              >
                {link.name}
              </a>
            ))}
          </div>
        </section>

        <section style={{ background: '#f5deb3', borderRadius: 16, padding: 24 }}>
          <h2 style={{ color: '#800000', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Notices</h2>
          {data.notices.length > 0 ? (
            <div className="space-y-3">
              {data.notices.map((note, i) => (
                <div key={i} style={{ background: '#fff8f0', borderRadius: 10, padding: 14, borderLeft: '4px solid #800020' }}>
                  <p style={{ color: '#191970' }}>{note.text}</p>
                  <p style={{ color: '#800020', fontSize: 12, marginTop: 4 }}>{note.time}</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#191970', fontSize: 14 }}>No notices from your school yet. Check back later.</p>
          )}
        </section>
      </div>
    </StudentSectionShell>
  );
}
