import React from 'react';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Swallow implementation details in the UI.
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.assign(window.location.pathname);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-4xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="rounded-2xl bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-300">
            Workspace recovery
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">This section could not be opened.</h3>
            <p className="mt-2 text-sm text-zinc-400">Refresh the workspace and try again. Technical details are hidden to protect the app.</p>
          </div>
          <button onClick={this.handleReset} className="rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white hover:bg-emerald-500">
            Reload section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
