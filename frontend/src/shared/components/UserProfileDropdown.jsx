import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UserProfileDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="glass-chip flex items-center gap-2 px-4 py-2 rounded-full text-indigo-700 dark:text-indigo-200 font-semibold shadow-sm hover:shadow-md transition-all"
        onClick={() => setOpen(!open)}
      >
        <span className="w-8 h-8 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center text-lg overflow-hidden">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="avatar" className="w-full h-full object-cover" />
        </span>
        <span>John Doe</span>
        <motion.svg 
          animate={{ rotate: open ? 180 : 0 }}
          width="16" height="16" fill="currentColor" className="ml-1"
        >
          <path d="M4 6l4 4 4-4"/>
        </motion.svg>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-3 w-56 bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/80 dark:border-cyan-300/20 rounded-3xl shadow-xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">John Doe</p>
              <p className="text-xs micro-label text-slate-500 dark:text-slate-400">Student • Grade 10</p>
            </div>
            <ul className="py-2">
              <li className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-700/25 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors flex items-center gap-2">
                <span className="opacity-70">👤</span> Profile
              </li>
              <li className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-700/25 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors flex items-center gap-2">
                <span className="opacity-70">⚙️</span> Settings
              </li>
              <li className="px-4 py-2 text-sm text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-700/25 hover:text-red-700 dark:hover:text-white cursor-pointer transition-colors flex items-center gap-2 mt-1 border-t border-slate-50 dark:border-slate-800 pt-3">
                <span className="opacity-70">🚪</span> Logout
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
