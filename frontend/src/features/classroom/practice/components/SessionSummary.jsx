import React from 'react';

/**
 * SessionSummary - Post-practice feedback and recommendations
 * Non-destructive, supportive feedback
 */
export default function SessionSummary({
  summary,
  onContinue,
  onStop,
}) {
  if (!summary) return null;

  const getStatusColor = (status) => {
    if (status === 'strong') return 'text-emerald-400';
    if (status === 'average') return 'text-amber-400';
    return 'text-red-400';
  };

  const getStatusEmoji = (status) => {
    if (status === 'strong') return '🟢';
    if (status === 'average') return '🟠';
    return '🔴';
  };

  return (
    <div className="space-y-6">
      {/* Main Summary Card */}
      <div className="glass-surface rounded-3xl p-6 space-y-6">
        {/* Topic & Accuracy */}
        <div>
          <p className="text-sm text-slate-400 uppercase tracking-wider mb-3">Session Summary</p>
          <h2 className="text-2xl font-semibold text-slate-100 mb-4">{summary.topic}</h2>

          {/* Accuracy Highlight */}
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Your Accuracy</p>
            <div className="flex items-end gap-4">
              <div>
                <p className={`text-5xl font-bold ${getStatusColor(summary.topicStatus?.status)}`}>
                  {summary.accuracy}%
                </p>
              </div>
              <p className="text-3xl mb-1">{getStatusEmoji(summary.topicStatus?.status)}</p>
            </div>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden mt-3">
              <div
                className={`h-full transition-all ${
                  summary.accuracy >= 75
                    ? 'bg-emerald-500'
                    : summary.accuracy >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${summary.accuracy}%` }}
              />
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-900/20 border border-white/10 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Questions Answered</p>
            <p className="text-2xl font-semibold text-slate-100">
              {summary.correctCount}/{summary.totalQuestions}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {summary.correctCount} correct
            </p>
          </div>

          <div className="rounded-xl bg-slate-900/20 border border-white/10 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Avg. Speed</p>
            <p className="text-2xl font-semibold text-slate-100">
              {summary.avgTimePerQuestion}s
            </p>
            <p className="text-xs text-slate-400 mt-1">
              per question
            </p>
          </div>
        </div>

        {/* Status Transition (if applicable) */}
        {summary.strengthScore && (
          <div className="rounded-xl bg-slate-900/20 border border-white/10 p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Topic Strength</p>
            <p className="text-2xl font-semibold text-slate-100 mb-2">
              {summary.strengthScore}/100
            </p>
            <p className="text-xs text-slate-300">
              Status: {summary.topicStatus?.label || 'Calculating...'}
            </p>
          </div>
        )}
      </div>

      {/* Recommendation Card */}
      <div className="glass-surface rounded-3xl p-6 space-y-4 border border-indigo-400/20 bg-indigo-500/5">
        <div>
          <p className="text-sm text-slate-400 uppercase tracking-wider mb-2">Recommendation</p>
          <p className="text-base text-slate-100 leading-relaxed">
            {summary.recommendation}
          </p>
        </div>

        {/* Additional Tips */}
        {summary.accuracy < 60 && (
          <div className="pt-3 border-t border-indigo-400/10">
            <p className="text-xs text-slate-400 mb-2">💡 Tips:</p>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
              <li>Review the fundamentals of this topic</li>
              <li>Take note of questions you struggled with</li>
              <li>Try practice again after reviewing the material</li>
            </ul>
          </div>
        )}

        {summary.accuracy >= 75 && (
          <div className="pt-3 border-t border-indigo-400/10">
            <p className="text-xs text-slate-400 mb-2">⭐ Next Steps:</p>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
              <li>Challenge yourself with harder topics</li>
              <li>Review similar concepts</li>
              <li>Prepare for exams with this foundation</li>
            </ul>
          </div>
        )}
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
        <div className="rounded-xl bg-slate-900/20 border border-white/10 p-3 text-center">
          <p className="text-xs uppercase tracking-wider mb-1">Total Time</p>
          <p className="text-lg font-semibold text-slate-100">
            {Math.floor(summary.totalTime / 60)}:{String(summary.totalTime % 60).padStart(2, '0')}
          </p>
        </div>
        <div className="rounded-xl bg-slate-900/20 border border-white/10 p-3 text-center">
          <p className="text-xs uppercase tracking-wider mb-1">Session Type</p>
          <p className="text-lg font-semibold text-slate-100">Practice</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onStop}
          className="flex-1 px-6 py-3 rounded-xl border border-white/10 bg-slate-900/30 text-slate-300 hover:bg-slate-900/50 transition-colors font-medium"
        >
          Stop
        </button>
        <button
          onClick={onContinue}
          className="flex-1 px-6 py-3 rounded-xl bg-indigo-500/40 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/50 transition-colors font-medium"
        >
          Continue Practice
        </button>
      </div>

      {/* Privacy Notice */}
      <p className="text-xs text-slate-500 text-center">
        ✓ Practice performance does not affect grades or exam records
      </p>
    </div>
  );
}
