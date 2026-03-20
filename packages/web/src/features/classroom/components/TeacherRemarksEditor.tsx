import React, { useState } from 'react';
import { Sparkles, Check, ChevronDown, Edit3 } from 'lucide-react';
import { behavioralComments, academicComments } from '../data/commentBank';

type TeacherRemarksEditorProps = {
  studentName?: string;
  isSectionalHead?: boolean;
};

// Dummy "Aura" AI function to turn negative comments to positive
const reframeToPositive = (text: string) => {
  let positiveText = text;
  const negativePhrases = [
    { bad: /is lazy/gi, good: 'needs more encouragement to engage actively' },
    { bad: /is disruptive/gi, good: 'has high energy that can be channeled more productively' },
    { bad: /talks too much/gi, good: 'is very expressive and enthusiastic in communicating' },
    { bad: /fails to/gi, good: 'is working towards' },
    { bad: /poor/gi, good: 'developing' },
    { bad: /terrible/gi, good: 'improving' },
    { bad: /bad at/gi, good: 'needs extra support with' },
    { bad: /struggles/gi, good: 'is making an effort to grasp' },
    { bad: /does not listen/gi, good: 'is learning to improve their focus and attention' },
    { bad: /stubborn/gi, good: 'determined and strong-willed' },
    { bad: /slow/gi, good: 'takes their time to process information' },
    { bad: /careless/gi, good: 'needs to double-check their work more consistently' },
    { bad: /distracted/gi, good: 'is learning to stay focused on the task at hand' }
  ];

  negativePhrases.forEach(mapping => {
    positiveText = positiveText.replace(mapping.bad, mapping.good);
  });

  return positiveText;
};

export function TeacherRemarksEditor({ studentName = 'the student', isSectionalHead = false }: TeacherRemarksEditorProps) {
  const [remark, setRemark] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [category, setCategory] = useState<'behavioral' | 'academic'>(isSectionalHead ? 'academic' : 'behavioral');

  const commentsList = category === 'behavioral' ? behavioralComments : academicComments;

  const handleSelectComment = (comment: string) => {
    setRemark(comment);
    setShowSuggestions(false);
  };

  const handleAuraPolish = () => {
    const polished = reframeToPositive(remark);
    setRemark(polished);
  };

  return (
    <div className="mt-8 rounded-2xl border border-sky-200 bg-white p-6 shadow-sm dark:border-sky-800 dark:bg-slate-900 print:hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-sky-500" />
            Result Remarks Editor
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Provide personalized feedback for {studentName}.
          </p>
        </div>
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setCategory('behavioral')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              category === 'behavioral' ? 'bg-white shadow text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Class Teacher (Behavioral)
          </button>
          <button
            onClick={() => setCategory('academic')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              category === 'academic' ? 'bg-white shadow text-purple-700 dark:bg-slate-700 dark:text-purple-300' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Sectional Head (Academic)
          </button>
        </div>
      </div>

      <div className="relative">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          {category === 'behavioral' ? "Teacher's Remark" : "Sectional Head's Remark"}
        </label>
        
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder={`Enter your ${category} remark here...`}
          className="w-full min-h-[100px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
        />

        {/* Aura AI Reframing Button */}
        <div className="absolute right-3 bottom-14 flex items-center justify-end">
           <button
             onClick={handleAuraPolish}
             title="Use Aura to Auto-Correct Negative Tones to Positive"
             className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-sky-400 to-indigo-500 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
           >
             <Sparkles className="w-3 h-3" />
             Aura Polish
           </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="relative">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
              Browse {category === 'behavioral' ? '100 Behavioral' : '50 Academic'} Suggestions
            </button>

            {showSuggestions && (
              <div className="absolute z-50 mt-1 max-h-64 w-[400px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <div className="sticky top-0 bg-slate-50 border-b border-slate-100 p-2 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-900 dark:border-slate-800 z-10">
                  Select a comment to apply
                </div>
                <div className="p-1">
                  {commentsList.map((cmt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectComment(cmt)}
                      className="w-full text-left p-2 text-xs text-slate-700 hover:bg-sky-50 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg mb-0.5 border border-transparent hover:border-sky-100 dark:hover:border-slate-600 transition-colors"
                    >
                      {cmt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors">
            <Check className="w-4 h-4" />
            Save Remark
          </button>
        </div>
      </div>
    </div>
  );
}