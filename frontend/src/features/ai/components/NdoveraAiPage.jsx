import React, { useEffect, useState } from 'react';
import StaffAiAssistantPage from './StaffAiAssistantPage';
import AiAssessmentStudio from '../../assessments/AiAssessmentStudio';

// Ndovera AI for teachers: the chat, and Ndovera AI Assessment (quizzes,
// assignments, tests and exams written from the teacher's own topics).
// ?tab=assessment opens the assessment builder directly (the topic hub links here).

const TABS = [['chat', '✨ Chat'], ['assessment', '📝 Ndovera AI Assessment']];

function readTab() {
  try { return new URLSearchParams(window.location.search).get('tab') === 'assessment' ? 'assessment' : 'chat'; } catch { return 'chat'; }
}

export default function NdoveraAiPage({ roleKey = 'teacher', roleTitle }) {
  const [tab, setTab] = useState(readTab);
  useEffect(() => {
    const onPop = () => setTab(readTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function choose(next) {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      if (next === 'assessment') url.searchParams.set('tab', 'assessment');
      else { url.search = ''; }
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
    } catch { /* the tab still switches */ }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav className="ndv-no-print mx-auto flex w-full max-w-7xl gap-2 px-3 pt-3 sm:px-4 lg:px-6" aria-label="Ndovera AI">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => choose(key)} aria-pressed={tab === key}
            className={`rounded-2xl px-4 py-2 text-sm font-bold transition-colors ${tab === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white/80 text-[#800020] hover:bg-white'}`}>
            {label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1">
        {tab === 'chat' ? <StaffAiAssistantPage roleKey={roleKey} roleTitle={roleTitle} /> : <AiAssessmentStudio />}
      </div>
    </div>
  );
}
