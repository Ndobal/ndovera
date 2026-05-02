import React, {useState, useRef, useEffect} from 'react'

// Simple cross-matching component using SVG overlay lines
export default function CrossMatching({left=[], right=[], pairs=[], onChange}){
  const [current, setCurrent] = useState(null)
  const [lines, setLines] = useState(pairs||[])
  const containerRef = useRef(null)

  useEffect(()=> setLines(pairs||[]),[pairs])

  function itemCenter(el){
    const r = el.getBoundingClientRect()
    const c = containerRef.current.getBoundingClientRect()
    return {x: r.left - c.left + r.width/2, y: r.top - c.top + r.height/2}
  }

  function startMatch(e, idx){
    const el = e.currentTarget
    setCurrent({from: idx, startEl: el})
  }

  function endMatch(e, idx){
    if(!current) return
    const pair = {a: current.from, b: idx}
    const next = [...lines, pair]
    setLines(next)
    onChange && onChange(next)
    setCurrent(null)
  }

  function removePair(i){
    const next = lines.filter((_,j)=>j!==i)
    setLines(next)
    onChange && onChange(next)
  }

  return (
    <div ref={containerRef} className="relative border rounded p-3 bg-white/40 dark:bg-slate-800/30">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {left.map((t, i)=>(
            <div key={i} onMouseDown={(e)=>startMatch(e,i)} className="p-2 border rounded cursor-pointer bg-slate-50 dark:bg-slate-700">{t}</div>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((t, i)=>(
            <div key={i} onMouseUp={(e)=>endMatch(e,i)} className="p-2 border rounded cursor-pointer bg-slate-50 dark:bg-slate-700">{t}</div>
          ))}
        </div>
      </div>

      <svg className="absolute inset-0 pointer-events-none">
        {lines.map((ln,i)=>{
          const aEl = containerRef.current.querySelectorAll('[data-left]')[ln.a]
          const bEl = containerRef.current.querySelectorAll('[data-right]')[ln.b]
          let ax=10, ay=10, bx=20, by=20
          if(aEl && bEl){
            const ac = itemCenter(aEl)
            const bc = itemCenter(bEl)
            ax = ac.x; ay = ac.y; bx = bc.x; by = bc.y
          }
          return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke="#60A5FA" strokeWidth={2} />
        })}
      </svg>

      <div className="mt-3 space-y-1 text-sm">
        {lines.map((p,i)=> (
          <div key={i} className="flex items-center justify-between">
            <div>{left[p.a]} ↔ {right[p.b]}</div>
            <button onClick={()=>removePair(i)} className="text-xs text-red-500">Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}
