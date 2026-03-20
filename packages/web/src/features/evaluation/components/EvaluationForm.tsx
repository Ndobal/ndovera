import React, { useState } from "react";

export const EvaluationForm = ({ target, onSubmit }: { target: any, onSubmit: (rating: number, comment: string) => void }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center font-bold text-lg">
          {target?.name?.charAt(0) || '?'}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Evaluate {target?.name || 'Staff Member'}</h3>
          <p className="text-xs text-zinc-500">Provide anonymous feedback</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase font-bold mb-2 block tracking-widest">Rate Performance</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(num => (
              <button
                key={num}
                onClick={() => setRating(num)}
                className={`flex-1 py-3 border rounded-xl text-sm font-bold transition-all ${rating === num ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-transparent text-zinc-400 border-white/10 hover:border-emerald-500/50'}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-zinc-500 uppercase font-bold mb-2 block tracking-widest">Additional Feedback</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Write constructive feedback here... (Anonymous)"
            className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-emerald-500 outline-none resize-none h-32"
          />
        </div>

        <button 
          onClick={() => onSubmit(rating, comment)}
          disabled={rating === 0}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
        >
          Save & Continue
        </button>
      </div>
    </div>
  );
};