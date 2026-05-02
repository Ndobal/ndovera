import React, { useState } from 'react';
import StudentSectionShell from './StudentSectionShell';

const modes = ['Explain Mode', 'Practice Mode', 'Weak Area Mode', 'Exam Review Mode'];

// lightweight client-side social filter for demo
function isSocialQuery(text) {
  if (!text) return false;
  const s = text.toLowerCase();
  const social = ['how are you', 'what is up', "what's up", 'tell me a joke', 'gossip', 'who are you', 'say something about my life', 'chat'];
  return social.some(k => s.includes(k));
}

export default function StudentProfessorAura() {
  const [input, setInput] = useState('');
  const [reply, setReply] = useState(null);

  const ask = () => {
    if (!input.trim()) return;
    if (isSocialQuery(input)) {
      setReply({ type: 'error', text: 'Professor Vera responds only to academic questions. Please ask about a subject topic, problem, or exam review.' });
      return;
    }

    // placeholder academic response (would call AI in production)
    setReply({ type: 'answer', text: `Academic explanation for: "${input.trim()}" — (demo content)` });
  };

  return (
    <StudentSectionShell title="Professor Vera" subtitle="Academic-only assistant: ask about lessons, exams, or topics.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
        {modes.map(mode => (
          <div key={mode} className="glass-surface rounded-xl p-3 flex flex-col items-start gap-1">
            <p className="text-sm font-semibold command-title neon-title">{mode}</p>
            <p className="neon-subtle text-xs">Focused, academic support only.</p>
          </div>
        ))}

        <div className="col-span-2 sm:col-span-4 glass-surface rounded-xl p-3">
          <p className="text-slate-200 mb-1 text-sm">Ask Professor Vera (academic topics only)</p>
          <textarea value={input} onChange={e => setInput(e.target.value)} className="w-full rounded-lg bg-slate-900/40 border border-white/10 px-2 py-1 text-sm text-slate-100" rows={2} />
          <div className="mt-2 flex gap-2">
            <button onClick={ask} className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-sm">Ask</button>
            <button onClick={() => { setInput(''); setReply(null); }} className="px-2 py-1 rounded-lg bg-slate-700 text-white text-sm">Clear</button>
          </div>

          {reply && (
            <div className={`mt-3 p-2 rounded-md ${reply.type === 'error' ? 'bg-rose-800/40' : 'bg-slate-800/40'}`}>
              <div className="text-slate-100 text-sm">{reply.text}</div>
            </div>
          )}
        </div>
      </div>
    </StudentSectionShell>
  );
}
