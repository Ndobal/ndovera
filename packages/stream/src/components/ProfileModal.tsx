import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Flag, ShieldAlert } from 'lucide-react';
import { Author } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  author: Author | null;
  isAdmin: boolean;
}

export function ProfileModal({ isOpen, onClose, author, isAdmin }: ProfileModalProps) {
  if (!author) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900/95 dark:backdrop-blur-2xl z-50 rounded-t-3xl border-t border-slate-200 dark:border-white/10 p-5 flex flex-col items-center shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)]"
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
              <X size={16} className="text-slate-500" />
            </button>

            <img src={author.avatar} alt={author.name} className="w-16 h-16 rounded-full object-cover shadow-md mb-3 ring-2 ring-white dark:ring-white/10" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{author.name}</h2>
            <p className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 mb-5">{author.position || 'Member'}</p>

            <div className="w-full max-w-sm flex flex-col gap-2 pb-4">
              <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-medium transition-colors">
                <MessageSquare size={12} />
                Send Direct Message
              </button>
              <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-medium transition-colors">
                <Flag size={12} />
                Report User
              </button>
              {isAdmin && (
                <button className="flex items-center justify-center gap-2 w-full py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-medium transition-colors border border-rose-100 dark:border-rose-500/20">
                  <ShieldAlert size={12} />
                  Block User (Admin)
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
