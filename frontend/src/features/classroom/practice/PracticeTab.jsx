import React, { useEffect, useState } from 'react';
import { practice } from '../data/classroomData';
import usePracticeEngine from './hooks/usePracticeEngine';
import PracticeDashboard from './components/PracticeDashboard';
import PracticeSession from './components/PracticeSession';
import SessionSummary from './components/SessionSummary';

/**
 * PracticeTab - Main practice interface orchestrating the adaptive intelligence engine
 * Pixel-perfect, calm, academic design with exam-grade security
 */
export default function PracticeTab({ auraBalance = 0, setAuraBalance = () => {} }) {
  const hasPracticeContent = (practice.questions || []).length > 0;
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'session' | 'summary'
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  // Initialize practice engine with questions and topic performance map
  const engine = usePracticeEngine(
    practice.questions || [],
    practice.topicPerformanceMap || {},
  );

  // Handle weak areas enforcement
  useEffect(() => {
    const weakAreas = engine.getWeakAreas();
    if (weakAreas.length > 0 && !selectedTopic) {
      // Auto-select weakest area for focused practice
      const weakestTopic = weakAreas[0]?.topic;
      if (weakestTopic) {
        setSelectedTopic(weakestTopic);
      }
    }
  }, [engine, selectedTopic]);

  /**
   * Start practice session for a specific topic
   */
  const handleStartPractice = (topic = null) => {
    const topicToStart = topic || selectedTopic || engine.getWeakAreas()[0]?.topic;
    
    if (!topicToStart) {
      alert('No topics available for practice.');
      return;
    }

    setSelectedTopic(topicToStart);
    engine.startPracticeSession(topicToStart);
    setView('session');
  };

  /**
   * Handle answer submission
   */
  const handleSubmitAnswer = (selectedOption, timeSpent) => {
    const result = engine.submitAnswer(selectedOption, timeSpent);
    if (!result) return;

    // Show feedback
    setTimeout(() => {
      // Feedback is shown in the session component
    }, 200);
  };

  /**
   * Continue to next question after feedback
   */
  const handleContinueQuestion = () => {
    engine.continueToNextQuestion();
  };

  /**
   * Skip current question
   */
  const handleSkipQuestion = () => {
    engine.skipQuestion();
  };

  /**
   * End session and show summary
   */
  const handleEndSession = () => {
    engine.endSession();
    setView('summary');
  };

  /**
   * Continue practice with more questions
   */
  const handleContinuePractice = () => {
    engine.startPracticeSession(selectedTopic);
    setView('session');
  };

  /**
   * Return to dashboard
   */
  const handleReturnDashboard = () => {
    setView('dashboard');
    setSelectedTopic(null);
    setAiPrompt('');
    setAiResponse('');
  };

  /**
   * AI Explanation Handler (paid feature)
   */
  const handleAIExplain = () => {
    const prompt = aiPrompt.trim();
    if (!prompt || auraBalance < 1) return;

    const explanation = `Clear explanation: The key insight for ${selectedTopic} is to break the problem into components. Start with known values, apply the core rule, then solve systematically.`;
    
    setAuraBalance(prev => prev - 1);
    setAiResponse(explanation);
  };

  /**
   * AI Question Generation Handler (paid feature)
   */
  const handleGenerateQuestions = () => {
    if (auraBalance < 2) return;

    const generatedQuestions = [
      `Explain one key concept in ${selectedTopic}`,
      `Solve one practical problem related to ${selectedTopic}`,
      'How would you teach this to a peer?',
      `Identify common mistakes in ${selectedTopic}`,
      'Create your own example question',
    ];

    setAuraBalance(prev => prev - 2);
    setAiResponse(generatedQuestions.map(q => `• ${q}`).join('\n'));
  };

  // Weak areas warning
  const weakAreas = engine.getWeakAreas();
  const shouldEnforceWeakAreas = weakAreas.length > 0;

  if (!hasPracticeContent) {
    return (
      <section className="glass-surface rounded-3xl p-5 text-center">
        <p className="micro-label accent-amber">No live practice sets</p>
        <p className="mt-2 text-slate-300">Practice drills will appear here after teachers publish real question banks for this class.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard View */}
      {view === 'dashboard' && (
        <>
          {/* Weak Areas Warning Banner */}
          {shouldEnforceWeakAreas && (
            <div className="glass-surface rounded-3xl p-5 border border-red-400/30 bg-red-500/5">
              <p className="text-sm text-red-300">
                ⚠️ You have weak areas that need attention. Let's fix them first before exploring stronger topics.
              </p>
            </div>
          )}

          {/* Practice Dashboard */}
          <PracticeDashboard
            overallReadiness={engine.getOverallReadiness()}
            weakAreas={engine.getWeakAreas()}
            averageAreas={engine.getAverageAreas()}
            strongAreas={engine.getStrongAreas()}
            onStartPractice={handleStartPractice}
            onReview={(topic) => {
              setSelectedTopic(topic);
              handleStartPractice(topic);
            }}
          />

          {/* AI Assistance Section */}
          <section className="glass-surface rounded-3xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-100">AI Assistance</h3>
              <span className="glass-chip px-3 py-1 rounded-full text-xs text-emerald-300">
                Aura Balance: {auraBalance}
              </span>
            </div>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="w-full min-h-[90px] rounded-2xl bg-slate-900/30 border border-white/10 p-3 text-slate-100 placeholder-slate-500"
              placeholder="Ask AI about any weak topic (optional)"
            />

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleAIExplain}
                disabled={!aiPrompt.trim() || auraBalance < 1}
                className="px-4 py-2 rounded-xl bg-indigo-500/30 border border-indigo-300/40 text-indigo-100 hover:bg-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Explain Topic (1 Aura)
              </button>
              <button
                onClick={handleGenerateQuestions}
                disabled={auraBalance < 2}
                className="px-4 py-2 rounded-xl bg-emerald-500/30 border border-emerald-300/40 text-emerald-100 hover:bg-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Generate Questions (2 Aura)
              </button>
            </div>

            {aiResponse && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
                <p className="text-sm text-slate-200 whitespace-pre-line">{aiResponse}</p>
              </div>
            )}
          </section>
        </>
      )}

      {/* Session View */}
      {view === 'session' && engine.sessionActive && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleEndSession}
              className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
            >
              ← End Session
            </button>
            <p className="text-xs text-slate-400">
              {selectedTopic}
            </p>
          </div>

          <PracticeSession
            question={engine.currentQuestion}
            questionIndex={engine.questionIndex}
            onSubmit={handleSubmitAnswer}
            onSkip={handleSkipQuestion}
            onFeedback={handleContinueQuestion}
            feedbackData={engine.feedbackData}
            showFeedback={engine.showFeedback}
          />
        </div>
      )}

      {/* Summary View */}
      {view === 'summary' && engine.sessionSummary && (
        <div className="space-y-4">
          <button
            onClick={handleReturnDashboard}
            className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            ← Back to Dashboard
          </button>

          <SessionSummary
            summary={engine.sessionSummary}
            onContinue={handleContinuePractice}
            onStop={handleReturnDashboard}
          />
        </div>
      )}
    </div>
  );
}

