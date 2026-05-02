import React from 'react'

export default function WorkflowControls({mode='light', onSaveDraft, onSubmit}){
  const isDark = mode === 'dark'
  return (
    <div className="flex gap-3 justify-end mt-6">
      <button
        onClick={onSaveDraft}
        className={
          `px-4 py-2 rounded border ${isDark? 'bg-slate-800/50 border-white/5 text-white' : 'bg-white border-slate-200 text-slate-800'} hover:shadow-sm`
      }>
        Save as Draft
      </button>

      <button
        onClick={onSubmit}
        className={`px-4 py-2 rounded text-white ${isDark? 'bg-emerald-600/80 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
        Submit for Review
      </button>
    </div>
  )
}
