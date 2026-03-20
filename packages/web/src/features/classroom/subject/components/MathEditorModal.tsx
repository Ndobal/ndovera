import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import 'mathlive';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
  isDarkMode: boolean;
}

export function MathEditorModal({ isOpen, onClose, onInsert, isDarkMode }: Props) {
  const mfRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && mfRef.current) {
      // Focus the math field when opened
      setTimeout(() => mfRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInsert = () => {
    if (mfRef.current) {
      const latex = mfRef.current.value;
      if (latex) {
        onInsert(`$${latex}$`);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-stone-900 border border-white/10' : 'bg-white border border-stone-200'}`}>
        <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-white/10">
          <h3 className="text-lg font-bold text-stone-900 dark:text-white">Insert Math Formula</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 text-stone-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Use the virtual keyboard or type LaTeX commands (e.g., \frac) to create your formula.
          </p>
          
          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-stone-50 border-stone-200'}`}>
            {React.createElement('math-field', {
              ref: mfRef,
              style: { 
                width: '100%', 
                fontSize: '24px', 
                backgroundColor: 'transparent', 
                color: isDarkMode ? 'white' : 'black',
                border: 'none',
                outline: 'none'
              }
            })}
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 p-4 border-t border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              isDarkMode
                ? 'bg-white text-black hover:bg-stone-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
            }`}
          >
            Insert Formula
          </button>
        </div>
      </div>
    </div>
  );
}
