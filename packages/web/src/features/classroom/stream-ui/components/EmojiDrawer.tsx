import { motion, AnimatePresence } from 'motion/react';
import { EMOJIS } from '../constants/emojis';
import { X } from 'lucide-react';

interface EmojiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export function EmojiDrawer({ isOpen, onClose, onSelect }: EmojiDrawerProps) {
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
            className="fixed bottom-0 left-0 right-0 h-[35vh] bg-white dark:bg-slate-900/90 dark:backdrop-blur-2xl z-50 rounded-t-2xl border-t border-slate-200 dark:border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-white/5">
              <h2 className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 ml-1">Reactions</h2>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <X size={14} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 pb-8">
              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-12 gap-0.5 max-w-4xl mx-auto">
                {EMOJIS.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => onSelect(emoji.char)}
                    className="flex flex-col items-center justify-center p-0.5 h-10 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all active:scale-95"
                  >
                    <span className="text-lg mb-0.5 drop-shadow-sm">{emoji.char}</span>
                    <span className="text-[6px] leading-tight text-center text-slate-500 dark:text-slate-400 line-clamp-2 w-full px-0.5">
                      {emoji.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
