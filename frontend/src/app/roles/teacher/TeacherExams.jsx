import React, { useCallback, useEffect, useState } from 'react';
import TeacherSectionShell from './TeacherSectionShell';
import { fetchExamList, fetchExamById, createExam, updateExam, deleteExam, organizeQuestionTopics } from '../../../features/exams/service/examService';
import QuestionRenderer from '../../../features/exams/QuestionRenderer';
import ErrorPanel from '../../../shared/components/ErrorPanel';

function buildEmptyQuestion(type = 'mcq') {
  const templates = {
    mcq: { type: 'mcq', prompt: '', options: ['', ''], answer: '' },
    shortanswer: { type: 'shortanswer', prompt: '', answer: '' },
    fillgaps: { type: 'fillgaps', prompt: 'The [ ] jumped over the [ ]', answer: [] },
    truefalse: { type: 'truefalse', prompt: '', answer: null },
    crossmatching: { type: 'crossmatching', prompt: '', left: ['A', 'B'], right: ['1', '2'], pairs: [] },
    picture: { type: 'picture', prompt: '', image: null, caption: '' },
    essay: { type: 'essay', prompt: '', text: '' },
  };

  return templates[type] || templates.mcq;
}

export default function TeacherExams({
  mode = 'cbt',
  title: sectionTitle = 'CBT Exams',
  subtitle = 'Create and schedule computer-based tests.',
}) {
  const [exams, setExams] = useState([]);
  const [title, setTitle] = useState('');
  const [windowLabel, setWindowLabel] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState([buildEmptyQuestion('mcq')]);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [organizing, setOrganizing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchExamList({ mode });
      setExams(list);
    } catch (err) {
      console.error(err);
      setMessage(`Failed to load ${mode === 'practice' ? 'practice drills' : 'exams'}: ${err.message || err}`);
    }
  }, [mode]);

  useEffect(() => { load(); }, [load]);

  const addQuestion = (type = 'mcq') => {
    setQuestions(prev => [...prev, buildEmptyQuestion(type)]);
  };

  const handleSubmit = async () => {
    try {
      const payload = { title, window: windowLabel, subjectName, topic, questions, mode };
      if (editingId) {
        await updateExam(editingId, payload);
        setMessage(mode === 'practice' ? 'Practice drill updated' : 'Exam updated');
      } else {
        await createExam(payload);
        setMessage(mode === 'practice' ? 'Practice drill created' : 'Exam created');
      }
      setTitle('');
      setWindowLabel('');
      setSubjectName('');
      setTopic('');
      setQuestions([buildEmptyQuestion('mcq')]);
      setEditingId(null);
      load();
    } catch (err) {
      console.error(err);
      setMessage(`Failed to save ${mode === 'practice' ? 'practice drill' : 'exam'}: ${err.message || err}`);
    }
  };

  const handleEdit = async (exam) => {
    try {
      const full = await fetchExamById(exam.id);
      setEditingId(full.id);
      setTitle(full.title || '');
      setWindowLabel(full.window || '');
      setSubjectName(full.subjectName || '');
      setTopic(full.questions?.find(question => question.topic)?.topic || '');
      if (full.questions && full.questions.length) {
        setQuestions(full.questions.map(q => ({ ...q })));
      } else {
        setQuestions([buildEmptyQuestion('mcq')]);
      }
      window.scrollTo(0, 0);
    } catch (err) {
      console.error('Failed to load exam for editing', err);
      setMessage(`Failed to load ${mode === 'practice' ? 'practice drill' : 'exam'} for editing`);
    }
  };

  const handleOrganizeTopics = async () => {
    const usableQuestions = questions.filter(question => String(question?.prompt || question?.text || '').trim());
    if (!usableQuestions.length) {
      setMessage('Add a question before using AI topic organisation.');
      return;
    }
    setOrganizing(true);
    try {
      const data = await organizeQuestionTopics({ questions, subjectName });
      const topicsByIndex = new Map((data?.suggestions || []).map(suggestion => [suggestion.index, suggestion.topic]));
      setQuestions(current => current.map((question, index) => ({ ...question, topic: topicsByIndex.get(index) || question.topic || topic })));
      const firstTopic = (data?.suggestions || [])[0]?.topic;
      if (firstTopic && !topic) setTopic(firstTopic);
      setMessage('AI organised the questions by topic.');
    } catch (err) {
      setMessage(`Could not organise topics: ${err.message || err}`);
    } finally {
      setOrganizing(false);
    }
  };

  const handleDelete = async (examId) => {
    if (!window.confirm(`Delete this ${mode === 'practice' ? 'practice drill' : 'exam'}?`)) return;
    try {
      await deleteExam(examId);
      setMessage(mode === 'practice' ? 'Practice drill deleted' : 'Exam deleted');
      load();
    } catch (err) {
      console.error(err);
      setMessage(`Failed to delete ${mode === 'practice' ? 'practice drill' : 'exam'}: ${err.message || err}`);
    }
  };

  return (
    <TeacherSectionShell title={sectionTitle} subtitle={subtitle}>
      {message && <div className="mb-4 text-green-400">{message}</div>}
      {message && message.toLowerCase().startsWith('failed') && (
        <ErrorPanel title="Operation failed" message={message} onClose={() => setMessage(null)} />
      )}
      <div className="space-y-4">
        <div>
          <input placeholder={mode === 'practice' ? 'Practice title' : 'Exam title'} value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Subject (for question bank)" value={subjectName} onChange={e=>setSubjectName(e.target.value)} className="w-full rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200" />
          <input placeholder="Topic (optional)" value={topic} onChange={e=>setTopic(e.target.value)} className="w-full rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200" />
        </div>
        <div>
          <input placeholder={mode === 'practice' ? 'Practice window or drill label' : 'Window description'} value={windowLabel} onChange={e=>setWindowLabel(e.target.value)} className="w-full rounded-xl p-2 bg-slate-900/20 border border-white/10 text-slate-200" />
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
          <button onClick={handleOrganizeTopics} disabled={organizing} className="px-3 py-1 rounded-lg bg-violet-500/30 text-violet-100 disabled:opacity-60">{organizing ? 'Organising…' : 'AI Organise Topics'}</button>
        </div>
        <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100">Save {mode === 'practice' ? 'Practice Drill' : 'Exam'}</button>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold">Existing {mode === 'practice' ? 'Practice Drills' : 'Exams'}</h3>
        <ul className="list-disc list-inside mt-2 text-slate-200">
          {exams.map(e=> (
            <li key={e.id} className="flex items-center justify-between">
              <span>{e.title} ({e.window || 'No schedule'})</span>
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