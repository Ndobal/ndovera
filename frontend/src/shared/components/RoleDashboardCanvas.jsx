import React from 'react';

export default function RoleDashboardCanvas({
  roleTitle,
  metrics = [],
  priorities = [],
  activity = [],
  loading,
}) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="glass-surface rounded-3xl p-8 mb-6">
        <p className="micro-label neon-subtle mb-2">Overview</p>
        <h1 className="text-3xl command-title neon-title mb-3">{roleTitle}</h1>
      </div>

      <div id="metrics" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {metrics.map(metric => (
          <div key={metric.label} className="glass-surface rounded-3xl p-5">
            <p className="micro-label neon-subtle mb-1">{metric.label}</p>
            <p className={`text-3xl command-title mono-metric ${metric.accent}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section id="priority" className="glass-surface rounded-3xl p-6">
          <h2 className="text-xl command-title neon-title mb-4">Priority Queue</h2>
          <div className="space-y-3">
            {priorities.map(priority => (
              <div key={priority.title} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                <p className="text-slate-100 font-semibold">{priority.title}</p>
                <p className={`micro-label mt-2 ${priority.stateAccent}`}>{priority.state}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="activity" className="glass-surface rounded-3xl p-6">
          <h2 className="text-xl command-title neon-title mb-4">Operational Activity</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="micro-label py-2 pr-4">Item</th>
                  <th className="micro-label py-2 pr-4">Status</th>
                  <th className="micro-label py-2 pr-4">Owner</th>
                  <th className="micro-label py-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {activity.map(row => (
                  <tr key={`${row.item}-${row.owner}`} className="border-t border-white/10">
                    <td className="py-3 pr-4 text-slate-100">{row.item}</td>
                    <td className="py-3 pr-4 neon-subtle">{row.status}</td>
                    <td className="py-3 pr-4 neon-subtle">{row.owner}</td>
                    <td className="py-3 mono-metric text-slate-100">{row.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {loading && (
        <div className="mt-6 glass-surface rounded-2xl p-4 flex items-center gap-3">
          <span className="live-dot" />
          <span className="micro-label accent-rose">Synchronizing role node...</span>
        </div>
      )}
    </div>
  );
}
