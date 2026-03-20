import React, { useState, useRef } from 'react';
import { Question, QuestionType } from '../types';
import { Plus, Trash2, Image as ImageIcon, Type, AlignLeft, CheckSquare, Circle, ToggleLeft, X, Link as LinkIcon, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MathEditorModal } from './MathEditorModal';

interface Props {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  isDarkMode: boolean;
}

export function AssessmentBuilder({ questions, onChange, isDarkMode }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [mathTarget, setMathTarget] = useState<{ qId: string, optIdx?: number, isLeft?: boolean, isRight?: boolean } | null>(null);

  const handleAddQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      type,
      prompt: '',
      points: 10,
    };

    if (['multiple_choice', 'checkboxes'].includes(type)) {
      newQuestion.options = ['Option 1', 'Option 2'];
      newQuestion.correctAnswer = type === 'multiple_choice' ? 'Option 1' : ['Option 1'];
    } else if (type === 'true_false') {
      newQuestion.correctAnswer = 'True';
    } else if (type === 'matching') {
      newQuestion.matchingPairs = [{ left: 'Item 1', right: 'Match 1' }];
    }

    onChange([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter(q => q.id !== id));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, qId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('image', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        updateQuestion(qId, { imageUrl: data.url });
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image. Please try again.');
      }
    }
  };

  const handleInsertMath = (latex: string) => {
    if (mathTarget) {
      const q = questions.find(q => q.id === mathTarget.qId);
      if (q) {
        if (mathTarget.isLeft !== undefined && mathTarget.optIdx !== undefined) {
          // It's a matching pair
          const newPairs = [...(q.matchingPairs || [])];
          if (mathTarget.isLeft) {
            newPairs[mathTarget.optIdx].left = newPairs[mathTarget.optIdx].left + ' ' + latex;
          } else {
            newPairs[mathTarget.optIdx].right = newPairs[mathTarget.optIdx].right + ' ' + latex;
          }
          updateQuestion(mathTarget.qId, { matchingPairs: newPairs });
        } else if (mathTarget.optIdx !== undefined) {
          // It's an option
          const newOptions = [...(q.options || [])];
          newOptions[mathTarget.optIdx] = newOptions[mathTarget.optIdx] + ' ' + latex;
          
          let newCorrect = q.correctAnswer;
          if (q.type === 'multiple_choice' && q.correctAnswer === q.options?.[mathTarget.optIdx]) {
            newCorrect = newOptions[mathTarget.optIdx];
          } else if (q.type === 'checkboxes' && Array.isArray(q.correctAnswer)) {
            newCorrect = q.correctAnswer.map(c => c === q.options?.[mathTarget.optIdx] ? newOptions[mathTarget.optIdx] : c);
          }
          
          updateQuestion(mathTarget.qId, { options: newOptions, correctAnswer: newCorrect });
        } else {
          // It's the prompt
          updateQuestion(mathTarget.qId, { prompt: q.prompt + ' ' + latex });
        }
      }
    }
    setIsMathModalOpen(false);
    setMathTarget(null);
  };

  const renderQuestionEditor = (q: Question, index: number) => {
    return (
      <motion.div key={q.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, height: 0 }} className="glass-panel rounded-xl p-4 relative group mb-4">
        <div className="flex gap-3 items-start mb-3">
          <span className="text-xs font-bold text-stone-400 mt-2">{index + 1}.</span>
          <div className="flex-1 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <textarea 
                    value={q.prompt} 
                    onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })} 
                    placeholder="Question prompt... (Supports Markdown & LaTeX e.g. $\frac{1}{2}$)"
                    rows={2}
                    className={`w-full px-3 py-2 pr-10 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 transition-all resize-none ${
                      isDarkMode ? 'bg-white/5 border border-white/10 text-white' : 'bg-stone-50 border border-stone-200 text-stone-900'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMathTargetId(q.id);
                      setIsMathModalOpen(true);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-md text-stone-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                    title="Insert Math Formula"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                </div>
                {q.prompt && (
                  <div className={`p-3 rounded-lg text-xs ${isDarkMode ? 'bg-black/20 text-stone-300' : 'bg-white border border-stone-200 text-stone-700'}`}>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-stone-500 mb-1 block">Preview:</span>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {q.prompt}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={q.points} 
                    onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) || 0 })} 
                    className={`w-16 px-2 py-2 rounded-lg text-xs font-medium text-center focus:outline-none focus:ring-1 transition-all ${
                      isDarkMode ? 'bg-white/5 border border-white/10 text-white' : 'bg-stone-50 border border-stone-200 text-stone-900'
                    }`}
                    min="0"
                  />
                  <span className="text-[10px] font-bold text-stone-500">pts</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveQuestionId(q.id);
                    fileInputRef.current?.click();
                  }}
                  className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                    isDarkMode ? 'bg-white/5 hover:bg-white/10 text-stone-300' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                  title="Upload Image"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {q.imageUrl && (
              <div className="relative inline-block">
                <img src={q.imageUrl} alt="Question attachment" className="max-h-40 rounded-lg border border-stone-200 dark:border-white/10" />
                <button type="button" onClick={() => updateQuestion(q.id, { imageUrl: undefined })} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Options Editor based on type */}
            {['multiple_choice', 'checkboxes'].includes(q.type) && (
              <div className="space-y-2 pl-2 border-l-2 border-stone-200 dark:border-white/10">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 block mb-2">Options & Correct Answer</span>
                {q.options?.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <input
                      type={q.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                      name={`correct-${q.id}`}
                      checked={q.type === 'multiple_choice' ? q.correctAnswer === opt : (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt))}
                      onChange={(e) => {
                        if (q.type === 'multiple_choice') {
                          updateQuestion(q.id, { correctAnswer: opt });
                        } else {
                          const current = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
                          if (e.target.checked) {
                            updateQuestion(q.id, { correctAnswer: [...current, opt] });
                          } else {
                            updateQuestion(q.id, { correctAnswer: current.filter(c => c !== opt) });
                          }
                        }
                      }}
                      className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                      title="Mark as correct answer"
                    />
                    <div className="flex-1 relative">
                      <input 
                        value={opt} 
                        onChange={(e) => {
                          const newOptions = [...(q.options || [])];
                          const oldVal = newOptions[optIdx];
                          newOptions[optIdx] = e.target.value;
                          
                          // Update correct answer if it was this option
                          let newCorrect = q.correctAnswer;
                          if (q.type === 'multiple_choice' && q.correctAnswer === oldVal) {
                            newCorrect = e.target.value;
                          } else if (q.type === 'checkboxes' && Array.isArray(q.correctAnswer)) {
                            newCorrect = q.correctAnswer.map(c => c === oldVal ? e.target.value : c);
                          }
                          
                          updateQuestion(q.id, { options: newOptions, correctAnswer: newCorrect });
                        }} 
                        className={`w-full px-2 py-1 pr-8 rounded text-[11px] focus:outline-none focus:ring-1 transition-all ${
                          isDarkMode ? 'bg-white/5 border border-white/10 text-white' : 'bg-stone-50 border border-stone-200 text-stone-900'
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMathTarget({ qId: q.id, optIdx });
                          setIsMathModalOpen(true);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded text-stone-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                        title="Insert Math Formula"
                      >
                        <Calculator className="w-3 h-3" />
                      </button>
                    </div>
                    <button type="button" onClick={() => {
                      const newOptions = q.options?.filter((_, i) => i !== optIdx);
                      updateQuestion(q.id, { options: newOptions });
                    }} className="p-1 text-stone-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => updateQuestion(q.id, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] })} className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 mt-1">
                  <Plus className="w-3 h-3" /> Add Option
                </button>
              </div>
            )}

            {q.type === 'true_false' && (
              <div className="space-y-2 pl-2 border-l-2 border-stone-200 dark:border-white/10">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 block mb-2">Correct Answer</span>
                <div className="flex gap-4">
                  {['True', 'False'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctAnswer === opt}
                        onChange={() => updateQuestion(q.id, { correctAnswer: opt })}
                        className="w-3.5 h-3.5 accent-emerald-500"
                      />
                      <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {q.type === 'matching' && (
              <div className="space-y-2 pl-2 border-l-2 border-stone-200 dark:border-white/10">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 block mb-2">Matching Pairs (Left matches Right)</span>
                {q.matchingPairs?.map((pair, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input 
                        value={pair.left} 
                        onChange={(e) => {
                          const newPairs = [...(q.matchingPairs || [])];
                          newPairs[pIdx].left = e.target.value;
                          updateQuestion(q.id, { matchingPairs: newPairs });
                        }} 
                        placeholder="Left item"
                        className={`w-full px-2 py-1 pr-8 rounded text-[11px] focus:outline-none focus:ring-1 transition-all ${
                          isDarkMode ? 'bg-white/5 border border-white/10 text-white' : 'bg-stone-50 border border-stone-200 text-stone-900'
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMathTarget({ qId: q.id, optIdx: pIdx, isLeft: true });
                          setIsMathModalOpen(true);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded text-stone-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                        title="Insert Math Formula"
                      >
                        <Calculator className="w-3 h-3" />
                      </button>
                    </div>
                    <LinkIcon className="w-3 h-3 text-stone-400" />
                    <div className="flex-1 relative">
                      <input 
                        value={pair.right} 
                        onChange={(e) => {
                          const newPairs = [...(q.matchingPairs || [])];
                          newPairs[pIdx].right = e.target.value;
                          updateQuestion(q.id, { matchingPairs: newPairs });
                        }} 
                        placeholder="Right item (Match)"
                        className={`w-full px-2 py-1 pr-8 rounded text-[11px] focus:outline-none focus:ring-1 transition-all ${
                          isDarkMode ? 'bg-white/5 border border-white/10 text-white' : 'bg-stone-50 border border-stone-200 text-stone-900'
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMathTarget({ qId: q.id, optIdx: pIdx, isLeft: false });
                          setIsMathModalOpen(true);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded text-stone-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                        title="Insert Math Formula"
                      >
                        <Calculator className="w-3 h-3" />
                      </button>
                    </div>
                    <button type="button" onClick={() => {
                      const newPairs = q.matchingPairs?.filter((_, i) => i !== pIdx);
                      updateQuestion(q.id, { matchingPairs: newPairs });
                    }} className="p-1 text-stone-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => updateQuestion(q.id, { matchingPairs: [...(q.matchingPairs || []), { left: `Item ${(q.matchingPairs?.length || 0) + 1}`, right: `Match ${(q.matchingPairs?.length || 0) + 1}` }] })} className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 mt-1">
                  <Plus className="w-3 h-3" /> Add Pair
                </button>
              </div>
            )}

            {['short_answer', 'paragraph'].includes(q.type) && (
              <div className="space-y-2 pl-2 border-l-2 border-stone-200 dark:border-white/10">
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500 block mb-2">Correct Answer (Optional, for auto-grading exact match)</span>
                <input 
                  value={(q.correctAnswer as string) || ''} 
                  onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })} 
                  placeholder="Exact answer text..."
                  className={`w-full px-2 py-1 rounded text-[11px] focus:outline-none focus:ring-1 transition-all ${
                    isDarkMode ? 'bg-white/5 border border-white/10 text-white' : 'bg-stone-50 border border-stone-200 text-stone-900'
                  }`}
                />
              </div>
            )}
          </div>
        </div>
        
        <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 dark:bg-white/10 px-2 py-1 rounded">
            {q.type.replace('_', ' ')}
          </span>
          <button type="button" onClick={() => removeQuestion(q.id)} className="p-1.5 text-stone-400 hover:text-red-500 bg-stone-100 dark:bg-white/10 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-md transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-3">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={(e) => activeQuestionId && handleImageUpload(e, activeQuestionId)} 
      />
      
      <h3 className="text-sm font-bold flex items-center gap-2">Questions</h3>
      
      <AnimatePresence>
        {questions.map((q, index) => renderQuestionEditor(q, index))}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 pt-2">
        <button type="button" onClick={() => handleAddQuestion('short_answer')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}><Type className="w-3 h-3" /> Short Answer</button>
        <button type="button" onClick={() => handleAddQuestion('paragraph')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}><AlignLeft className="w-3 h-3" /> Paragraph</button>
        <button type="button" onClick={() => handleAddQuestion('multiple_choice')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}><Circle className="w-3 h-3" /> Multiple Choice</button>
        <button type="button" onClick={() => handleAddQuestion('checkboxes')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}><CheckSquare className="w-3 h-3" /> Checkboxes</button>
        <button type="button" onClick={() => handleAddQuestion('true_false')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}><ToggleLeft className="w-3 h-3" /> True/False</button>
        <button type="button" onClick={() => handleAddQuestion('matching')} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 border border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5 transition-colors ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}><LinkIcon className="w-3 h-3" /> Matching</button>
      </div>

      <MathEditorModal
        isOpen={isMathModalOpen}
        onClose={() => {
          setIsMathModalOpen(false);
          setMathTargetId(null);
        }}
        onInsert={handleInsertMath}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
