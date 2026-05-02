import React from 'react';
import { PlusIcon } from '@heroicons/react/24/solid';

const actions = [
  { label: 'Add Assignment', href: '/assignments' },
  { label: 'Join Class', href: '/classroom' },
];

export default function QuickActions() {
  return (
    <div className="relative group">
      <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-2xl font-semibold transition-all shadow-sm border border-indigo-400/30">
        <PlusIcon className="w-5 h-5 transition-transform duration-200 group-hover:scale-125" />
        <span>New</span>
      </button>
      
      {/* Dropdown menu */}
      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-100 dark:border-indigo-500/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="py-1">
          {actions.map(action => (
            <a
              key={action.label}
              href={action.href}
              className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-500/20 hover:text-slate-900 dark:hover:text-white"
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
