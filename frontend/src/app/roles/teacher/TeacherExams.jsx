import React, { useState, useEffect } from 'react';
import TeacherSectionShell from './TeacherSectionShell';
import { fetchExamList, fetchExamById, createExam, updateExam, deleteExam } from '../../../features/exams/service/examService';
import QuestionRenderer from '../../../features/exams/QuestionRenderer';
import ErrorPanel from '../../../shared/components/ErrorPanel';

export default function TeacherExams() {
  const [exams, setExams] = useState([]);
  const [title, setTitle] = useState('');
  const [window, setWindow] = useState('');
  const [questions, setQuestions] = useState([{ type: 'mcq', prompt: '', options: ['',''], answer: '' }]);// one question to start
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      const list = await fetchExamList();
      setExams(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, []);

  const addQuestion = (type = 'mcq') => {
    const tmpl = {
      mcq: { type: 'mcq', prompt: '', options: ['',''], answer: '' },
      shortanswer: { type: 'shortanswer', prompt: '', answer: '' },
      fillgaps: { type: 'fillgaps', prompt: 'The [ ] jumped over the [ ]' },
      truefalse: { type: 'truefalse', prompt: '', answer: null },
      crossmatching: { type: 'crossmatching', prompt: '', left: ['A','B'], right: ['1','2'], pairs: [] },
      picture: { type: 'picture', prompt: '', image: null, caption: '' },
      essay: { type: 'essay', prompt: '', text: '' },
    }[type] || { type: 'mcq', prompt: '', options: ['',''], answer: '' };
    setQuestions(prev => [...prev, tmpl]);
  };

  const handleSubmit = async () => {
    try {
      const payload = { title, window, questions };
      if (editingId) {
        await updateExam(editingId, payload);
        setMessage('Exam updated');
      } else {
        await createExam(payload);
        setMessage('Exam created');
      }
      setTitle(''); setWindow(''); setQuestions([{ text: '', choices: ['','','',''], answer: '' }]);
      setEditingId(null);
      load();
    } catch (err) {
      console.error(err);
      setMessage('Failed to save exam: ' + (err.message || err));
    }
  };

  const handleEdit = async (exam) => {
    try {
      const full = await fetchExamById(exam.id);
      setEditingId(full.id);
      setTitle(full.title || '');
      setWindow(full.window || '');
      if (full.questions && full.questions.length) {
        // normalize to our editor shapes
        setQuestions(full.questions.map(q => ({ ...q })));
      } else {
        setQuestions([{ type: 'mcq', prompt: '', options: ['',''], answer: '' }]);
      }
      window.scrollTo(0,0);
    } catch (err) {
      console.error('Failed to load exam for editing', err);
      setMessage('Failed to load exam for editing');
    }
  };

  const handleDelete = async (examId) => {
    if (!window.confirm('Delete this exam?')) return;
    try {
      await deleteExam(examId);
      setMessage('Exam deleted');
      load();
    } catch (err) {
      console.error(err);
      setMessage('Failed to delete: ' + (err.message || err));
    }
  };

  return (
    <TeacherSectionShell title="CBT Exams" subtitle="Create and schedule computer-based tests.">
      {message && <div className="mb-4 text-green-400">{message}</div>}
      {message && message.toLowerCase().startsWith('failed') && (
        <ErrorPanel title="Operation failed" message={message} onClose={() => setMessage(null)} />
      )}
      <div className="space-y-4">
        <div>
          <input placeholder="Exam title" value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200" />
        </div>
        <div>
          <input placeholder="Window description" value={window} onChange={e=>setWindow(e.target.value)} className="w-full rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200" />
        </div>
        {questions.map((q,i)=> (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-3">
              <select value={q.type} onChange={e=>{
                const t=e.target.value; setQuestions(prev=>{ const arr=[...prev]; arr[i] = { ...arr[i], type: t }; return arr;});
              }} className="rounded p-1 bg-slate-900/20">
                <option value="mcq">MCQ</option>
                <option value="shortanswer">Short Answer</option>
                <option value="fillgaps">Fill in the Gaps</option>
                <option value="truefalse">True / False</option>
                <option value="crossmatching">Cross Matching</option>
                <option value="picture">Picture</option>
                <option value="essay">Essay</option>
              </select>
              <button onClick={()=> setQuestions(prev=> prev.filter((_,idx)=> idx!==i)) } className="text-sm text-rose-400">Remove</button>
            </div>
            <QuestionRenderer question={q} onChange={(next)=>{
              setQuestions(prev=>{ const arr=[...prev]; arr[i] = next; return arr;});
            }} />
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={()=>addQuestion('mcq')} className="px-3 py-1 rounded-lg bg-emerald-500/30 text-emerald-100">Add MCQ</button>
          <button onClick={()=>addQuestion('shortanswer')} className="px-3 py-1 rounded-lg bg-sky-500/30 text-sky-100">Add Short Answer</button>
          <button onClick={()=>addQuestion('crossmatching')} className="px-3 py-1 rounded-lg bg-indigo-500/30 text-indigo-100">Add Cross Matching</button>
          <button onClick={()=>addQuestion('essay')} className="px-3 py-1 rounded-lg bg-pink-500/30 text-pink-100">Add Essay</button>
        </div>
        <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100">Save Exam</button>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold">Existing Exams</h3>
        <ul className="list-disc list-inside mt-2 text-slate-200">
          {exams.map(e=> (
            <li key={e.id} className="flex items-center justify-between">
              <span>{e.title} ({e.window})</span>
              <span className="space-x-2">
                <button onClick={()=>handleEdit(e)} className="px-2 py-1 text-sm bg-yellow-600/20 rounded">Edit</button>
                <button onClick={()=>handleDelete(e.id)} className="px-2 py-1 text-sm bg-rose-600/20 rounded">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </TeacherSectionShell>
  );
}