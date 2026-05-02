import React, {useState} from 'react'
import QuestionRenderer from './QuestionRenderer'
import WorkflowControls from './WorkflowControls'

const sampleQuestions = [
  {id:'q1', type:'mcq', prompt:'What is 2+2?', options:['1','2','3','4']},
  {id:'q2', type:'shortanswer', prompt:'Name the capital of France.'},
  {id:'q3', type:'crossmatching', prompt:'Match country to capital', left:['France','Nigeria','India'], right:['Paris','Abuja','New Delhi'], pairs:[]},
  {id:'q4', type:'essay', prompt:'Discuss climate change.'}
]

export default function ExamCreator(){
  const [questions, setQuestions] = useState(sampleQuestions)
  const [status, setStatus] = useState('editing')
  const [mode, setMode] = useState('light')

  function updateQuestion(idx, q){
    const copy = [...questions]
    copy[idx] = {...copy[idx], ...q}
    setQuestions(copy)
  }

  async function saveDraft(){
    setStatus('saving')
    // simulate API save
    await new Promise(r=>setTimeout(r,600))
    setStatus('draft')
    console.log('Saved draft', questions)
  }

  async function submitForReview(){
    setStatus('submitting')
    // simulate API submit, sets status to pending_sectional_head
    await new Promise(r=>setTimeout(r,700))
    setStatus('pending_sectional_head')
    console.log('Submitted for review', questions)
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
      </div>

      <WorkflowControls mode={mode} onSaveDraft={saveDraft} onSubmit={submitForReview} />

      <div className="mt-3 text-sm text-slate-500">Status: {status}</div>
    </div>
  )
}
