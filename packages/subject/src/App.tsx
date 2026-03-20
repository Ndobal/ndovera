import React, { useState, useEffect } from 'react';
import { Role, Subject } from './types';
import { initialSubjects } from './data';
import { SubjectCard } from './components/SubjectCard';
import { SubjectDetail } from './components/SubjectDetail';
import { Moon, Sun, Plus, BookOpen } from 'lucide-react';

export default function App() {
  const [role, setRole] = useState<Role>('student');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const canCreateSubject = ['hos', 'owner', 'ict'].includes(role);

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  const handleUpdateSubject = (updatedSubject: Subject) => {
    setSubjects(subjects.map(s => s.id === updatedSubject.id ? updatedSubject : s));
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-[10px]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-stone-200 dark:border-white/10 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedSubjectId(null)}>
          <div className="p-1.5 bg-amber-500 dark:bg-amber-500/20 dark:text-amber-400 rounded-lg text-white">
            <BookOpen className="w-4 h-4" />
          </div>
          <h1 className="text-xs font-bold tracking-tight">EduStream</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-medium text-stone-500 dark:text-stone-400">View as:</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-transparent border border-stone-300 dark:border-white/20 rounded-md px-2 py-1 text-[9px] focus:outline-none focus:ring-1 focus:ring-amber-500 dark:bg-[#1a1a1a]"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="hos">Head of School</option>
              <option value="sectional_head">Sectional Head</option>
              <option value="owner">Owner</option>
              <option value="ict">ICT Manager</option>
            </select>
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-white/10 transition-colors"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-stone-600" />}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        {selectedSubject ? (
          <SubjectDetail
            subject={selectedSubject}
            role={role}
            onBack={() => setSelectedSubjectId(null)}
            onUpdate={handleUpdateSubject}
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Classes</h2>
              {canCreateSubject && (
                <button className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors shadow-sm dark:shadow-[0_0_10px_rgba(245,158,11,0.3)] text-[10px]">
                  <Plus className="w-3 h-3" />
                  Create Subject
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {subjects.map(subject => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  onClick={() => setSelectedSubjectId(subject.id)}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
