import React, {useState} from 'react'
import QuestionRenderer from './QuestionRenderer'
import WorkflowControls from './WorkflowControls'

export default function ExamCreator(){
  const [questions, setQuestions] = useState([])
  const [status, setStatus] = useState('idle')
  const [mode, setMode] = useState('light')

  function updateQuestion(idx, q){
    const copy = [...questions]
    copy[idx] = {...copy[idx], ...q}
    setQuestions(copy)
  }

  async function saveDraft(){
    setStatus(questions.length ? 'draft-ready' : 'no-content')
  }

  async function submitForReview(){
    setStatus(questions.length ? 'review-pending' : 'no-content')
  }

  return (
    <div className={`p-6 ${mode==='dark'?'bg-slate-900 text-white':'bg-white text-slate-800'}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Exam Builder</h2>
        <div>
          <button onClick={()=>setMode(mode==='light'?'dark':'light')} className="text-sm px-2 py-1 border rounded">Toggle Mode</button>
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {questions.map((q,idx)=> (
          <div key={q.id} className="p-4 border rounded bg-white/70 dark:bg-slate-800/60">
            <QuestionRenderer question={q} onChange={(next)=>updateQuestion(idx,next)} />
          </div>
        ))}
        {questions.length === 0 && (
          <div className="p-4 border rounded bg-white/70 dark:bg-slate-800/60 text-sm">
            No live exam questions are loaded. Connect this builder to a real exam source before publishing to production.
          </div>
        )}
      </div>

      <WorkflowControls mode={mode} onSaveDraft={saveDraft} onSubmit={submitForReview} />

      <div className="mt-3 text-sm text-slate-500">Status: {status}</div>
    </div>
  )
}
