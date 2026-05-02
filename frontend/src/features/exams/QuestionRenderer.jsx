import React, {useState} from 'react'
import CrossMatching from './CrossMatching'

// Lightweight QuestionRenderer using a factory/switch pattern
export default function QuestionRenderer({question, onChange}){
  const [local, setLocal] = useState(question || {})

  function update(patch){
    const next = {...local, ...patch}
    setLocal(next)
    onChange && onChange(next)
  }

  switch((local.type || question.type).toLowerCase()){
    case 'mcq':
      return (
        <div className="space-y-2">
          <div className="font-medium">{local.prompt || question.prompt}</div>
          {(local.options||question.options||[]).map((opt, i)=> (
            <label key={i} className="flex items-center gap-3">
              <input type="radio" name={question.id} className="form-radio" />
              <span className="truncate">{opt}</span>
            </label>
          ))}
          <button type="button" className="text-sm text-slate-500" onClick={()=>{
            const opts = [...(local.options||question.options||[]),'']
            update({options: opts})
          }}>+ Add option</button>
        </div>
      )

    case 'shortanswer':
      return (
        <div>
          <div className="font-medium">{local.prompt || question.prompt}</div>
          <input
            className="mt-2 w-full border rounded px-3 py-2"
            value={local.answer||''}
            placeholder="Short answer"
            onChange={e=>update({answer: e.target.value})}
          />
        </div>
      )

    case 'fillgaps':
      // prompt contains bracketed tokens: "The [cat] sat on the [mat]."
      const raw = local.prompt || question.prompt || ''
      const parts = raw.split(/(\[[^\]]+\])/g)
      return (
        <div>
          <div className="font-medium">Fill the gaps</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {parts.map((p, idx)=> p.startsWith('[') ? (
              <input key={idx} className="border rounded px-2 py-1" placeholder={p.replace(/\[|\]/g,'')} />
            ) : (
              <span key={idx}>{p}</span>
            ))}
          </div>
        </div>
      )

    case 'truefalse':
      return (
        <div>
          <div className="font-medium">{local.prompt || question.prompt}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={()=>update({answer: true})} className={`px-3 py-1 rounded ${local.answer===true?'bg-amber-400/80':''}`}>True</button>
            <button onClick={()=>update({answer: false})} className={`px-3 py-1 rounded ${local.answer===false?'bg-amber-400/80':''}`}>False</button>
          </div>
        </div>
      )

    case 'crossmatching':
      return (
        <div>
          <div className="font-medium">{local.prompt || question.prompt}</div>
          <CrossMatching
            left={local.left||question.left||[]}
            right={local.right||question.right||[]}
            pairs={local.pairs||question.pairs||[]}
            onChange={pairs=>update({pairs})}
          />
        </div>
      )

    case 'picture':
      return (
        <div>
          <div className="font-medium">{local.prompt || question.prompt}</div>
          <input type="file" accept="image/*" className="mt-2" onChange={e=>{
            const file = e.target.files && e.target.files[0]
            if(!file) return
            const url = URL.createObjectURL(file)
            update({image: url, imageName: file.name})
          }}/>
          {local.image && <img src={local.image} alt="preview" className="mt-2 max-h-40 object-contain"/>}
          <input placeholder="Caption" className="mt-2 w-full border rounded px-2 py-1" onChange={e=>update({caption:e.target.value})} />
        </div>
      )

    case 'essay':
      return (
        <div>
          <div className="font-medium">{local.prompt || question.prompt}</div>
          <textarea className="mt-2 w-full h-40 border rounded p-2" value={local.text||''} onChange={e=>{
            update({text: e.target.value})
          }} />
          <div className="text-sm text-slate-400">{(local.text||'').split(/\s+/).filter(Boolean).length} words</div>
        </div>
      )

    default:
      return <div>Unknown question type: {(local.type||question.type)}</div>
  }
}
