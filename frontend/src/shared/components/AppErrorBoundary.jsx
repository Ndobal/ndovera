import React from 'react';

/**
 * The last line of defence against a white screen.
 *
 * React unmounts the whole tree when a render throws, so without this the school
 * sees an empty page and has nothing to report but "it went blank". This keeps
 * the error on screen, in words, with a way out.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept for the browser console: schools send screenshots, and the stack is
    // what makes one actionable.
    console.error('NDOVERA crashed while rendering:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#b5e3f4] px-4 py-10 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-3xl border border-[#c9a96e]/40 bg-[#fff4df] p-6 dark:border-white/10 dark:bg-slate-900/60">
          <h1 className="text-xl font-black text-[#800000] dark:text-slate-100">Something broke on this page</h1>
          <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-slate-300">
            The rest of your work is safe. Reload to carry on — if this page keeps breaking,
            send the school a screenshot of the message below.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-2xl bg-white/70 p-3 text-left text-xs text-[#800020] dark:bg-slate-950/60 dark:text-rose-300">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#b5e3f4]"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => window.location.replace('/')}
              className="rounded-2xl border border-[#c9a96e]/50 px-4 py-2 text-sm font-bold text-[#14215b] dark:border-white/20 dark:text-slate-200"
            >
              Go to the home page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
