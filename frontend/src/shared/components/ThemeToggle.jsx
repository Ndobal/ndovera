import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';

export default function ThemeToggle({ isDark, toggleTheme }) {
  const [localDark, setLocalDark] = useState(document.documentElement.classList.contains('dark'));

  const controlled = typeof isDark === 'boolean' && typeof toggleTheme === 'function';
  const activeDark = controlled ? isDark : localDark;

  const handleToggle = useMemo(() => {
    if (controlled) {
      return toggleTheme;
    }

    return () => {
      const nextDark = !document.documentElement.classList.contains('dark');
      if (nextDark) {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
      }
      setLocalDark(nextDark);
    };
  }, [controlled, toggleTheme]);

  return (
    <button
      onClick={handleToggle}
      className="glass-chip p-2 rounded-full text-slate-500 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors focus:outline-none"
      aria-label="Toggle Dark Mode"
    >
      <motion.div
        initial={false}
        animate={{ rotate: activeDark ? 180 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        {activeDark ? (
          <SunIcon className="w-5 h-5" />
        ) : (
          <MoonIcon className="w-5 h-5" />
        )}
      </motion.div>
    </button>
  );
}
