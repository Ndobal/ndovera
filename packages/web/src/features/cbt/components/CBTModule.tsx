import React, { useState } from 'react';
import api from '../../../services/api';

export default function CBTModule({ role }: { role?: string }) {
  const [resp, setResp] = useState<any>(null);
  return (
    <div>
      <h2 className="text-2xl font-bold text-white">CBT Exams</h2>
      <p className="text-sm text-slate-400">Computer-based testing module — lightweight placeholder.</p>
      <div className="mt-4 p-4 bg-slate-900 rounded-lg">CBT stub: create exams, review attempts.</div>
      <div className="mt-4">
        <button onClick={async ()=>setResp(await api.createExam({ title: 'Frontend Smoke Exam', total_marks: 30 }))} className="px-3 py-2 bg-emerald-600 rounded">Create Exam</button>
        <pre className="mt-2 text-xs">{resp ? JSON.stringify(resp,null,2) : 'No response yet'}</pre>
      </div>
    </div>
  );
}
