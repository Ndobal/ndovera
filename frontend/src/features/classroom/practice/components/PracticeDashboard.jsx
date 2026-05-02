import React from 'react';

/**
 * PracticeDashboard - Shows overall readiness and categorized practice areas
 * Pixel-perfect, calm, academic design
 */
export default function PracticeDashboard({
  overallReadiness,
  weakAreas,
  averageAreas,
  strongAreas,
  onStartPractice,
  onReview,
}) {
  const getReadinessColor = (score) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getReadinessLabel = (score) => {
    if (score >= 75) return '🟢';
    if (score >= 50) return '🟠';
    return '🔴';
  };

  const getProgressBarColor = (score) => {
    if (score >= 75) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Overall Readiness Card */}
      <div className="glass-surface rounded-3xl p-6">
        <p className="text-sm text-slate-400 uppercase tracking-wider mb-2">Overall Readiness</p>
        <div className="flex items-baseline gap-3">
          <span className={`text-5xl font-bold ${getReadinessColor(overallReadiness)}`}>
            {overallReadiness}%
          </span>
          <span className="text-3xl">{getReadinessLabel(overallReadiness)}</span>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-700 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${getProgressBarColor(overallReadiness)}`}
            style={{ width: `${overallReadiness}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Based on accuracy, speed, consistency, and recent trends across all topics
        </p>
      </div>

      {/* Weak Areas Section */}
      {weakAreas.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider px-1">
            🔴 Weak Areas - Focus Here First
          </h3>
          <div className="space-y-2">
            {weakAreas.map(area => (
              <div
                key={area.topic}
                className="glass-surface rounded-2xl p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-100">{area.topic}</h4>
                  <span className="text-xs text-red-400 font-semibold">{area.score}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-3">
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${area.score}%` }}
                  />
                </div>
                <button
                  onClick={() => onStartPractice(area.topic)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/30 transition-colors"
                >
                  Practice This Topic
                </button>
              </div>
            ))}
          </div>
          {weakAreas.length > 0 && (
            <p className="text-xs text-amber-400/70 px-1">
              ⚠️ You have weak areas. Let's fix them first before moving to stronger topics.
            </p>
          )}
        </section>
      )}

      {/* Average Areas Section */}
      {averageAreas.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider px-1">
            🟠 Average Areas - Build Mastery
          </h3>
          <div className="space-y-2">
            {averageAreas.map(area => (
              <div
                key={area.topic}
                className="glass-surface rounded-2xl p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-100">{area.topic}</h4>
                  <span className="text-xs text-amber-400 font-semibold">{area.score}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-3">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${area.score}%` }}
                  />
                </div>
                <button
                  onClick={() => onStartPractice(area.topic)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/20 border border-amber-400/30 text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  Practice This Topic
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Strong Areas Section */}
      {strongAreas.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider px-1">
            🟢 Strong Areas - Keep Sharp
          </h3>
          <div className="space-y-2">
            {strongAreas.map(area => (
              <div
                key={area.topic}
                className="glass-surface rounded-2xl p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-100">{area.topic}</h4>
                  <span className="text-xs text-emerald-400 font-semibold">{area.score}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden mb-3">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${area.score}%` }}
                  />
                </div>
                <button
                  onClick={() => onReview(area.topic)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                >
                  Review This Topic
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {weakAreas.length === 0 && averageAreas.length === 0 && strongAreas.length === 0 && (
        <div className="glass-surface rounded-3xl p-8 text-center space-y-3">
          <p className="text-slate-300">Start your first practice session to see your performance analytics.</p>
          <button
            onClick={() => onStartPractice()}
            className="px-6 py-2 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 hover:bg-indigo-500/40 transition-colors"
          >
            Begin Practice
          </button>
        </div>
      )}
    </div>
  );
}
