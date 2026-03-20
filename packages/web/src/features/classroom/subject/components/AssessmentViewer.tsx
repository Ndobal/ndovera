import React, { useState, useRef, useEffect } from 'react';
import { Question, AssignmentAnswer } from '../types';
import { CheckCircle2, XCircle, Circle, CheckSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MatchingProps {
  question: Question;
  value: Record<string, string>;
  onChange: (val: Record<string, string>) => void;
  readonly: boolean;
  isDarkMode: boolean;
}

function MatchingQuestion({ question, value, onChange, readonly, isDarkMode }: MatchingProps) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string }[]>([]);

  // Shuffle right items only once
  const [rightItems] = useState(() => {
    const items = question.matchingPairs?.map(p => p.right) || [];
    return items.sort(() => Math.random() - 0.5);
  });

  const updateLines = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines = [];

    for (const [left, right] of Object.entries(value)) {
      const leftEl = leftRefs.current[left];
      const rightEl = rightRefs.current[right];

      if (leftEl && rightEl) {
        const lRect = leftEl.getBoundingClientRect();
        const rRect = rightEl.getBoundingClientRect();

        newLines.push({
          x1: lRect.right - containerRect.left,
          y1: lRect.top + lRect.height / 2 - containerRect.top,
          x2: rRect.left - containerRect.left,
          y2: rRect.top + rRect.height / 2 - containerRect.top,
          color: isDarkMode ? '#10b981' : '#059669', // Emerald
        });
      }
    }
    setLines(newLines);
  };

  useEffect(() => {
    updateLines();
    window.addEventListener('resize', updateLines);
    return () => window.removeEventListener('resize', updateLines);
  }, [value, isDarkMode]);

  const handleLeftClick = (left: string) => {
    if (readonly) return;
    if (selectedLeft === left) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(left);
    }
  };

  const handleRightClick = (right: string) => {
    if (readonly || !selectedLeft) return;
    
    const newValue = { ...value };
    // If this right item is already matched, remove its previous match
    for (const key in newValue) {
      if (newValue[key] === right) {
        delete newValue[key];
      }
    }
    
    newValue[selectedLeft] = right;
    onChange(newValue);
    setSelectedLeft(null);
  };

  return (
    <div className="relative mt-4" ref={containerRef}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        {lines.map((line, i) => (
          <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={line.color} strokeWidth="2" strokeLinecap="round" />
        ))}
      </svg>

      <div className="flex justify-between gap-12 relative z-10">
        <div className="flex-1 space-y-3">
          {question.matchingPairs?.map((pair, i) => (
            <div
              key={`l-${i}`}
              ref={el => { leftRefs.current[pair.left] = el; }}
              onClick={() => handleLeftClick(pair.left)}
              className={`p-3 rounded-lg border text-xs cursor-pointer transition-all prose dark:prose-invert max-w-none prose-p:my-0 prose-sm ${
                selectedLeft === pair.left
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-100 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]'
                  : value[pair.left]
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                    : isDarkMode ? 'bg-amber-50/10 border-amber-200/20 text-amber-50 hover:bg-amber-50/15' : 'bg-white border-stone-200 hover:bg-stone-50'
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {pair.left}
              </ReactMarkdown>
            </div>
          ))}
        </div>
        <div className="flex-1 space-y-3">
          {rightItems.map((right, i) => {
            const isMatched = Object.values(value).includes(right);
            return (
              <div
                key={`r-${i}`}
                ref={el => { rightRefs.current[right] = el; }}
                onClick={() => handleRightClick(right)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all prose dark:prose-invert max-w-none prose-p:my-0 prose-sm ${
                  isMatched
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                    : selectedLeft
                          ? 'border-amber-500 border-dashed hover:bg-amber-50 dark:hover:bg-amber-500/10'
                          : isDarkMode ? 'bg-amber-50/10 border-amber-200/20 text-amber-50' : 'bg-white border-stone-200'
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {right}
                </ReactMarkdown>
              </div>
            );
          })}
        </div>
      </div>
      {!readonly && <p className="mt-2 text-center text-[10px] italic text-stone-500 dark:text-amber-100/70">Click an item on the left, then click its match on the right to draw a line.</p>}
    </div>
  );
}

interface ViewerProps {
  questions: Question[];
  answers: Record<string, any>;
  onChange?: (questionId: string, value: any) => void;
  readonly?: boolean;
  isDarkMode: boolean;
  showGrading?: boolean;
  variant?: 'default' | 'assignment' | 'classwork';
}

export function AssessmentViewer({ questions, answers, onChange, readonly = false, isDarkMode, showGrading = false, variant = 'default' }: ViewerProps) {
  const isAssignmentVariant = variant === 'assignment';
  
  const renderQuestionInput = (q: Question) => {
    const val = answers[q.id];
    
    switch (q.type) {
      case 'short_answer':
        return (
          <input 
            type="text" 
            value={(val as string) || ''} 
            onChange={e => onChange?.(q.id, e.target.value)}
            readOnly={readonly}
            placeholder="Short answer text"
            className={`w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-1 transition-all ${
              isDarkMode
                ? isAssignmentVariant
                  ? 'border border-sky-300/20 bg-sky-500/10 text-[16px] font-bold text-sky-300 placeholder:text-sky-200/60'
                  : 'border border-amber-200/20 bg-amber-50/10 text-white placeholder:text-white/45'
                : 'bg-stone-50 border border-stone-200 text-stone-900'
            } ${readonly ? 'opacity-80 cursor-default' : ''}`}
          />
        );
      case 'paragraph':
        return (
          <textarea 
            value={(val as string) || ''} 
            onChange={e => onChange?.(q.id, e.target.value)}
            readOnly={readonly}
            placeholder="Long answer text"
            rows={4}
            className={`w-full rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-1 transition-all resize-none ${
              isDarkMode
                ? isAssignmentVariant
                  ? 'border border-sky-300/20 bg-sky-500/10 text-[16px] font-bold text-sky-300 placeholder:text-sky-200/60'
                  : 'border border-amber-200/20 bg-amber-50/10 text-white placeholder:text-white/45'
                : 'bg-stone-50 border border-stone-200 text-stone-900'
            } ${readonly ? 'opacity-80 cursor-default' : ''}`}
          />
        );
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {q.options?.map(opt => (
              <label key={opt} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${readonly ? 'cursor-default' : 'cursor-pointer'} ${
                isDarkMode
                  ? isAssignmentVariant
                    ? val === opt
                      ? 'border-sky-300/70 bg-sky-400/15 text-sky-300 shadow-[0_0_0_1px_rgba(125,211,252,0.28)]'
                      : 'border-sky-300/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15'
                    : val === opt
                      ? 'border-amber-300/70 bg-amber-200/15 text-white shadow-[0_0_0_1px_rgba(252,211,77,0.25)]'
                      : 'border-amber-200/20 bg-amber-50/10 text-white hover:bg-amber-50/15'
                  : val === opt
                    ? 'border-amber-300 bg-amber-50 text-stone-900'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}>
                <input 
                  type="radio" 
                  name={`q-${q.id}`} 
                  checked={val === opt} 
                  onChange={() => onChange?.(q.id, opt)}
                  disabled={readonly}
                  className="mt-0.5 h-4 w-4 accent-amber-500"
                />
                <span className={`prose max-w-none leading-7 prose-p:my-0 prose-sm dark:prose-invert ${isDarkMode && isAssignmentVariant ? 'text-[16px] font-bold text-sky-300' : 'text-base'}`}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {opt}
                  </ReactMarkdown>
                </span>
              </label>
            ))}
          </div>
        );
      case 'checkboxes':
        const arrVal = (val as string[]) || [];
        return (
          <div className="space-y-3">
            {q.options?.map(opt => (
              <label key={opt} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${readonly ? 'cursor-default' : 'cursor-pointer'} ${
                isDarkMode
                  ? isAssignmentVariant
                    ? arrVal.includes(opt)
                      ? 'border-sky-300/70 bg-sky-400/15 text-sky-300 shadow-[0_0_0_1px_rgba(125,211,252,0.28)]'
                      : 'border-sky-300/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15'
                    : arrVal.includes(opt)
                      ? 'border-amber-300/70 bg-amber-200/15 text-white shadow-[0_0_0_1px_rgba(252,211,77,0.25)]'
                      : 'border-amber-200/20 bg-amber-50/10 text-white hover:bg-amber-50/15'
                  : arrVal.includes(opt)
                    ? 'border-amber-300 bg-amber-50 text-stone-900'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}>
                <input 
                  type="checkbox" 
                  checked={arrVal.includes(opt)} 
                  onChange={(e) => {
                    if (readonly) return;
                    if (e.target.checked) onChange?.(q.id, [...arrVal, opt]);
                    else onChange?.(q.id, arrVal.filter(v => v !== opt));
                  }}
                  disabled={readonly}
                  className="mt-0.5 h-4 w-4 rounded-sm accent-amber-500"
                />
                <span className={`prose max-w-none leading-7 prose-p:my-0 prose-sm dark:prose-invert ${isDarkMode && isAssignmentVariant ? 'text-[16px] font-bold text-sky-300' : 'text-base'}`}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {opt}
                  </ReactMarkdown>
                </span>
              </label>
            ))}
          </div>
        );
      case 'true_false':
        return (
          <div className="flex flex-wrap gap-4">
            <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${readonly ? 'cursor-default' : 'cursor-pointer'} ${
              isDarkMode
                ? isAssignmentVariant
                  ? val === 'True'
                    ? 'border-sky-300/70 bg-sky-400/15 text-sky-300'
                    : 'border-sky-300/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15'
                  : val === 'True'
                    ? 'border-amber-300/70 bg-amber-200/15 text-white'
                    : 'border-amber-200/20 bg-amber-50/10 text-white hover:bg-amber-50/15'
                : val === 'True'
                  ? 'border-amber-300 bg-amber-50 text-stone-900'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}>
              <input 
                type="radio" 
                name={`q-${q.id}`} 
                checked={val === 'True'} 
                onChange={() => onChange?.(q.id, 'True')}
                disabled={readonly}
                className="h-4 w-4 accent-amber-500"
              />
              <span className={`${isDarkMode && isAssignmentVariant ? 'text-[16px] font-bold text-sky-300' : 'font-bold'}`}>True</span>
            </label>
            <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${readonly ? 'cursor-default' : 'cursor-pointer'} ${
              isDarkMode
                ? isAssignmentVariant
                  ? val === 'False'
                    ? 'border-sky-300/70 bg-sky-400/15 text-sky-300'
                    : 'border-sky-300/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15'
                  : val === 'False'
                    ? 'border-amber-300/70 bg-amber-200/15 text-white'
                    : 'border-amber-200/20 bg-amber-50/10 text-white hover:bg-amber-50/15'
                : val === 'False'
                  ? 'border-amber-300 bg-amber-50 text-stone-900'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}>
              <input 
                type="radio" 
                name={`q-${q.id}`} 
                checked={val === 'False'} 
                onChange={() => onChange?.(q.id, 'False')}
                disabled={readonly}
                className="h-4 w-4 accent-amber-500"
              />
              <span className={`${isDarkMode && isAssignmentVariant ? 'text-[16px] font-bold text-sky-300' : 'font-bold'}`}>False</span>
            </label>
          </div>
        );
      case 'matching':
        return (
          <MatchingQuestion 
            question={q} 
            value={(val as Record<string, string>) || {}} 
            onChange={(newVal) => onChange?.(q.id, newVal)} 
            readonly={readonly} 
            isDarkMode={isDarkMode} 
          />
        );
    }
  };

  const getGradingStatus = (q: Question, val: any) => {
    if (!showGrading || !q.correctAnswer) return null;
    
    let isCorrect = false;
    if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'short_answer') {
      isCorrect = String(val).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim();
    } else if (q.type === 'checkboxes') {
      const correctArr = (q.correctAnswer as string[]) || [];
      const valArr = (val as string[]) || [];
      isCorrect = correctArr.length === valArr.length && correctArr.every(c => valArr.includes(c));
    } else if (q.type === 'matching') {
      const valObj = (val as Record<string, string>) || {};
      isCorrect = q.matchingPairs?.every(p => valObj[p.left] === p.right) ?? false;
    }

    return isCorrect;
  };

  return (
    <div className="space-y-6">
      {questions.map((q, index) => {
        const val = answers[q.id];
        const isCorrect = getGradingStatus(q, val);
        
        return (
          <div key={q.id} className={`space-y-4 rounded-2xl border p-5 ${
            showGrading && isCorrect !== null
              ? isCorrect 
                ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-500/5' 
                : 'border-red-500/50 bg-red-50/30 dark:bg-red-500/5'
              : isDarkMode
                ? 'border-amber-200/15 bg-white/3'
                : 'border-stone-200 bg-white shadow-sm'
          }`}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase tracking-[0.18em] text-stone-500 ${isDarkMode ? (isAssignmentVariant ? 'text-[16px] text-sky-300' : 'dark:text-amber-100/70') : ''}`}>Question {index + 1}</span>
                  {showGrading && isCorrect !== null && (
                    isCorrect 
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 
                      : <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div className={`rounded-xl bg-white text-stone-800 prose max-w-none px-1 prose-p:my-1 prose-sm dark:bg-transparent dark:prose-invert ${isDarkMode && isAssignmentVariant ? 'text-[16px] font-bold leading-8 dark:text-sky-300' : 'text-base font-medium leading-8 dark:text-white'}`}>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {q.prompt}
                  </ReactMarkdown>
                </div>
              </div>
              <span className={`whitespace-nowrap rounded border px-2 py-1 ${isDarkMode && isAssignmentVariant ? 'border-sky-300/20 bg-sky-500/10 text-[16px] font-bold text-sky-300' : 'text-[10px] font-bold text-stone-500 bg-white dark:bg-white/10 border-stone-200 dark:border-white/10'}`}>
                {q.points} pts
              </span>
            </div>
            
            {q.imageUrl && (
              <img src={q.imageUrl} alt="Question attachment" className="max-h-64 rounded-lg border border-stone-200 dark:border-white/10" />
            )}

            <div className="pt-2">
              {renderQuestionInput(q)}
            </div>
            
            {showGrading && isCorrect === false && q.correctAnswer && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                <p className="text-[10px] font-bold text-red-800 dark:text-red-300 mb-1 uppercase tracking-wider">Correct Answer:</p>
                <div className="text-xs text-red-700 dark:text-red-200">
                  {q.type === 'checkboxes' 
                    ? (q.correctAnswer as string[]).join(', ')
                    : q.type === 'matching'
                      ? q.matchingPairs?.map(p => `${p.left} → ${p.right}`).join(' | ')
                      : String(q.correctAnswer)
                  }
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
