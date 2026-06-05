// Dark-mode variants here intentionally mirror the rest of the dashboard
// (slate surfaces + white/slate text) so the Academic Result Console matches
// every other page instead of using a separate maroon/neon palette.

export const RESULT_SURFACE = 'rounded-3xl border border-[#c9a96e]/45 bg-[#f5deb3] shadow-[0_16px_40px_rgba(128,0,0,0.08)] dark:border-white/10 dark:bg-slate-900/70 dark:backdrop-blur-xl dark:shadow-[0_22px_60px_rgba(0,0,0,0.45)]';

export const RESULT_INNER_SURFACE = 'rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ef] dark:border-white/10 dark:bg-slate-800/50';

export const RESULT_HEADING = 'text-[#800000] dark:text-white';

export const RESULT_BODY = 'text-[#191970] dark:text-slate-200';

export const RESULT_LABEL = 'text-[#800020] dark:text-slate-400';

export const RESULT_BUTTON = 'rounded-2xl border border-[#15482d] bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition disabled:opacity-50 dark:border-[#1a5c38] dark:bg-[#1a5c38] dark:text-[#f5deb3] dark:hover:bg-[#1f6e43]';

export const RESULT_SECONDARY_BUTTON = 'rounded-2xl border border-[#c9a96e]/50 bg-[#fff8ef] px-4 py-2 text-sm font-semibold text-[#191970] transition disabled:opacity-50 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';

export const RESULT_INPUT = 'w-full rounded-xl border border-[#c9a96e]/45 bg-[#fffef9] px-3 py-2 text-[#191970] outline-none transition focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/15 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[#c9a96e] dark:focus:ring-[#c9a96e]/25';

export const RESULT_TABLE_HEAD = 'bg-[#f0d090] text-[#800020] dark:bg-slate-800 dark:text-slate-300';

export const RESULT_TABLE_ROW = 'border-t border-[#c9a96e]/35 dark:border-white/10';

export function getBatchTone(state) {
  switch (String(state || '').toLowerCase()) {
    case 'published':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
    case 'submitted':
      return 'border-amber-500/35 bg-amber-500/15 text-[#800020] dark:text-amber-300';
    default:
      return 'border-[#c9a96e]/45 bg-[#f0d090] text-[#800020] dark:border-white/10 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function getWorkflowTone(state) {
  switch (state) {
    case 'done':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
    case 'active':
      return 'border-amber-500/35 bg-amber-500/15 text-[#800020] dark:text-amber-300';
    default:
      return 'border-[#c9a96e]/35 bg-[#fff8ef] text-[#191970] dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-200';
  }
}
