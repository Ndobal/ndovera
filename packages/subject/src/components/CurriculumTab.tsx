import React, { useState } from 'react';
import { Subject, Role, Topic } from '../types';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  subject: Subject;
  role: Role;
  onUpdate: (subject: Subject) => void;
  isDarkMode: boolean;
}

type Term = 'term1' | 'term2' | 'term3';

export function CurriculumTab({ subject, role, onUpdate, isDarkMode }: Props) {
  const [activeTerm, setActiveTerm] = useState<Term>('term1');
  const [newTopicTitle, setNewTopicTitle] = useState('');

  const canEdit = role === 'teacher';

  const terms: { id: Term; label: string }[] = [
    { id: 'term1', label: '1st Term' },
    { id: 'term2', label: '2nd Term' },
    { id: 'term3', label: '3rd Term' },
  ];

  const currentTopics = subject.curriculum[activeTerm];

  const handleToggleTreated = (topicId: string) => {
    if (!canEdit) return;

    const updatedTopics = currentTopics.map(t =>
      t.id === topicId ? { ...t, isTreated: !t.isTreated } : t
    );

    onUpdate({
      ...subject,
      curriculum: {
        ...subject.curriculum,
        [activeTerm]: updatedTopics
      }
    });
  };

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim() || !canEdit) return;

    const newTopic: Topic = {
      id: Date.now().toString(),
      title: newTopicTitle.trim(),
      isTreated: false
    };

    onUpdate({
      ...subject,
      curriculum: {
        ...subject.curriculum,
        [activeTerm]: [...currentTopics, newTopic]
      }
    });
    setNewTopicTitle('');
  };

  const handleDeleteTopic = (topicId: string) => {
    if (!canEdit) return;

    const updatedTopics = currentTopics.filter(t => t.id !== topicId);

    onUpdate({
      ...subject,
      curriculum: {
        ...subject.curriculum,
        [activeTerm]: updatedTopics
      }
    });
  };

  const treatedCount = currentTopics.filter(t => t.isTreated).length;
  const totalCount = currentTopics.length;
  const progress = totalCount === 0 ? 0 : Math.round((treatedCount / totalCount) * 100);

  return (
    <div className="space-y-3">
      {/* Term Selector */}
      <div className="flex gap-1 p-1 bg-stone-200/50 dark:bg-white/5 rounded-lg w-fit">
        {terms.map(term => (
          <button
            key={term.id}
            onClick={() => setActiveTerm(term.id)}
            className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-200 ${
              activeTerm === term.id
                ? isDarkMode
                  ? 'bg-[#333] text-white shadow-sm border border-white/10'
                  : 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            {term.label}
          </button>
        ))}
      </div>

      {/* Add Topic Form - Moved to top before progress */}
      {canEdit && (
        <form onSubmit={handleAddTopic} className="glass-panel rounded-xl p-3 flex gap-2 items-center">
          <input
            type="text"
            value={newTopicTitle}
            onChange={(e) => setNewTopicTitle(e.target.value)}
            placeholder="Enter a new topic..."
            className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-medium focus:outline-none focus:ring-1 transition-all ${
              isDarkMode
                ? 'bg-white/5 border border-white/10 focus:border-transparent text-white placeholder-stone-500 focus:ring-white/20'
                : 'bg-stone-50 border border-stone-200 focus:border-transparent text-stone-900 placeholder-stone-400 focus:ring-amber-500/50'
            }`}
          />
          <button
            type="submit"
            disabled={!newTopicTitle.trim()}
            className={`px-4 py-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all ${
              !newTopicTitle.trim()
                ? 'opacity-50 cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-white/5 dark:text-stone-500'
                : isDarkMode
                  ? 'bg-white text-black hover:bg-stone-200 shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                  : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
            }`}
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </form>
      )}

      {/* Progress Bar */}
      <div className="glass-panel rounded-xl p-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-[9px] mb-1">
            <span className="font-medium text-stone-600 dark:text-stone-300">Term Progress</span>
            <span className="font-bold text-stone-900 dark:text-white">{progress}%</span>
          </div>
          <div className="h-1.5 bg-stone-200 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: isDarkMode
                  ? `linear-gradient(90deg, ${subject.neonColor}, ${subject.neonColor}dd)`
                  : 'linear-gradient(90deg, #f59e0b, #d97706)'
              }}
            />
          </div>
        </div>
        <div className="text-[9px] font-medium text-stone-500 dark:text-stone-400 text-right leading-tight min-w-[50px]">
          {treatedCount} / {totalCount}<br/>Treated
        </div>
      </div>

      {/* Topics List */}
      <div className="glass-panel rounded-xl p-3">
        <h3 className="text-[11px] font-semibold mb-3 flex items-center gap-1.5">
          Topics for {terms.find(t => t.id === activeTerm)?.label}
        </h3>

        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {currentTopics.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-6 text-[10px] text-stone-500 dark:text-stone-400 border border-dashed border-stone-200 dark:border-white/10 rounded-lg"
              >
                No topics added for this term yet.
              </motion.div>
            ) : (
              currentTopics.map(topic => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={topic.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg transition-all duration-200 ${
                    isDarkMode
                      ? 'bg-white/5 hover:bg-white/10 border border-white/5'
                      : 'bg-stone-50 hover:bg-stone-100 border border-stone-100'
                  }`}
                >
                  <button
                    onClick={() => handleToggleTreated(topic.id)}
                    disabled={!canEdit}
                    className={`flex-shrink-0 transition-colors ${
                      !canEdit ? 'cursor-default' : 'cursor-pointer hover:scale-110'
                    }`}
                  >
                    {topic.isTreated ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-stone-300 dark:text-stone-600" />
                    )}
                  </button>

                  <span className={`flex-1 text-[10px] font-medium transition-all duration-200 ${
                    topic.isTreated
                      ? 'line-through text-stone-400 dark:text-stone-500'
                      : 'text-stone-700 dark:text-stone-200'
                  }`}>
                    {topic.title}
                  </span>

                  {canEdit && (
                    <button
                      onClick={() => handleDeleteTopic(topic.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all rounded hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
