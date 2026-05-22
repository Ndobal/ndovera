import React, { useState, useEffect } from 'react';

function emptyResponseForQuestion(question) {
  const type = String(question?.type || question?.responseType || 'mcq').trim().toLowerCase();
  if (type === 'crossmatching') return [];
  if (type === 'shortanswer' || type === 'fillgaps') return '';
  return null;
}

function isResponseEmpty(question, response) {
  const type = String(question?.type || question?.responseType || 'mcq').trim().toLowerCase();
  if (type === 'crossmatching') return !Array.isArray(response) || response.length === 0;
  return response === null || response === undefined || String(response).trim() === '';
}

function updateCrossMatchAnswer(currentAnswer, leftItem, rightItem) {
  const next = Array.isArray(currentAnswer) ? currentAnswer.filter(pair => pair.left !== leftItem) : [];
  if (rightItem) {
    next.push({ left: leftItem, right: rightItem });
  }
  return next;
}

function formatExpectedAnswer(question, expectedAnswer) {
  const type = String(question?.type || question?.responseType || 'mcq').trim().toLowerCase();

  if (type === 'crossmatching') {
    return (Array.isArray(expectedAnswer) ? expectedAnswer : [])
      .map(pair => `${pair?.left || ''} -> ${pair?.right || ''}`)
      .join(', ');
  }

  if (Array.isArray(expectedAnswer)) {
    return expectedAnswer.join(', ');
  }

  if (type === 'mcq' || type === 'truefalse') {
    const answerIndex = Number(expectedAnswer);
    if (Number.isInteger(answerIndex) && Array.isArray(question?.options)) {
      return question.options[answerIndex] || '';
    }
  }

  return String(expectedAnswer || '');
}

/**
 * PracticeSession - Main question answering interface
 * Pixel-perfect, calm, exam-grade discipline
 */
export default function PracticeSession({
  question,
  questionIndex,
  onSubmit,
  onSkip,
  onFeedback,
  feedbackData,
  showFeedback,
}) {
  const [response, setResponse] = useState(emptyResponseForQuestion(question));
  const [timeSpent, setTimeSpent] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!showFeedback) {
      setResponse(emptyResponseForQuestion(question));
      setSubmitted(false);
      setTimeSpent(0);
    }
  }, [question, showFeedback]);

  useEffect(() => {
    if (submitted || showFeedback) return;

    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 100);
    }, 100);

    return () => clearInterval(timer);
  }, [submitted, showFeedback]);

  const handleSubmit = () => {
    if (isResponseEmpty(question, response)) return;
    setSubmitted(true);
    onSubmit(response, timeSpent);
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (!question) {
    return (
      <div className="glass-surface rounded-3xl p-8 text-center space-y-4">
        <p className="text-slate-300">No more questions available.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-300"
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="space-y-1">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            {question.topic} • {question.difficulty}
          </p>
          <p className="text-sm text-slate-300">
            Question <span className="font-semibold">{questionIndex}</span>
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-slate-400">Time spent</p>
          <p className="text-lg font-mono text-slate-100">{formatTime(timeSpent)}</p>
        </div>
      </div>

      {/* Question Container */}
      <div className="glass-surface rounded-3xl p-6 space-y-6">
        {/* Question Text */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-slate-100 leading-relaxed">
            {question.text}
          </h2>

          {/* Question Image (if available) */}
          {question.imageUrl && (
            <img
              src={question.imageUrl}
              alt="Question"
              className="max-w-full h-auto rounded-xl border border-white/10"
            />
          )}

          {question.passage && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Passage</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">{question.passage}</p>
            </div>
          )}
        </div>

        {/* Answer Options */}
        {!showFeedback ? (
          <div className="space-y-3">
            {(question.responseType === 'choice') && question.options?.map((option, idx) => {
              const labels = ['A', 'B', 'C', 'D', 'E'];
              const label = labels[idx] || String.fromCharCode(65 + idx);

              return (
                <label
                  key={idx}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    response === idx
                      ? 'border-indigo-400/60 bg-indigo-500/10'
                      : 'border-white/10 bg-slate-900/20 hover:border-white/20 hover:bg-slate-900/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    checked={response === idx}
                    onChange={() => setResponse(idx)}
                    className="mt-1 w-5 h-5 cursor-pointer"
                  />
                  <span className="flex-1">
                    <span className="font-semibold text-slate-200">{label}</span>
                    <span className="ml-3 text-slate-100">{option}</span>
                  </span>
                </label>
              );
            })}

            {(question.responseType === 'text' && question.type === 'shortanswer') && (
              <input
                value={String(response || '')}
                onChange={(event) => setResponse(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-100 outline-none focus:border-indigo-400/60"
                placeholder="Type your answer"
              />
            )}

            {(question.responseType === 'text' && question.type === 'fillgaps') && (
              <textarea
                value={String(response || '')}
                onChange={(event) => setResponse(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-100 outline-none focus:border-indigo-400/60"
                placeholder="Enter each answer in order, separated by commas."
              />
            )}

            {question.responseType === 'crossmatching' && (
              <div className="space-y-3">
                {(question.left || []).map(leftItem => {
                  const selectedAnswer = (Array.isArray(response) ? response : []).find(pair => pair.left === leftItem)?.right || '';
                  return (
                    <label key={leftItem} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-slate-100">{leftItem}</span>
                      <select
                        value={selectedAnswer}
                        onChange={(event) => setResponse(updateCrossMatchAnswer(response, leftItem, event.target.value))}
                        className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-slate-100"
                      >
                        <option value="">Select match</option>
                        {(question.right || []).map(rightItem => (
                          <option key={rightItem} value={rightItem}>{rightItem}</option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Feedback Display
          <div className="space-y-3">
            {(question.responseType === 'choice') && question.options?.map((option, idx) => {
              const labels = ['A', 'B', 'C', 'D', 'E'];
              const label = labels[idx] || String.fromCharCode(65 + idx);
              const isCorrect = idx === question.correctAnswer;
              const wasSelected = idx === response;

              let bgColor = 'border-white/10 bg-slate-900/20';
              let textColor = 'text-slate-100';

              if (isCorrect) {
                bgColor = 'border-emerald-400/60 bg-emerald-500/10';
                textColor = 'text-emerald-100';
              } else if (wasSelected && !isCorrect) {
                bgColor = 'border-red-400/60 bg-red-500/10';
                textColor = 'text-red-100';
              }

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 ${bgColor}`}
                >
                  <span className="flex-shrink-0">
                    {isCorrect && <span className="text-emerald-400">✔</span>}
                    {wasSelected && !isCorrect && <span className="text-red-400">✖</span>}
                  </span>
                  <span className="flex-1">
                    <span className={`font-semibold ${textColor}`}>{label}</span>
                    <span className={`ml-3 ${textColor}`}>{option}</span>
                  </span>
                </div>
              );
            })}

            {question.responseType !== 'choice' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-slate-900/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Your answer</p>
                  <p className="mt-2 whitespace-pre-wrap text-slate-100">
                    {question.responseType === 'crossmatching'
                      ? formatExpectedAnswer(question, feedbackData?.submittedAnswer || response)
                      : String((feedbackData?.submittedAnswer ?? response) || 'No answer')}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-emerald-300">Expected answer</p>
                  <p className="mt-2 whitespace-pre-wrap text-emerald-100">
                    {formatExpectedAnswer(question, feedbackData?.expectedAnswer)}
                  </p>
                </div>
              </div>
            )}

            {/* Explanation */}
            {feedbackData?.explanation && (
              <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-white/10">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Explanation</p>
                <p className="text-sm text-slate-200">{feedbackData.explanation}</p>
              </div>
            )}

            {/* Hint */}
            {feedbackData?.hint && !feedbackData?.isCorrect && (
              <div className="mt-4 p-4 rounded-xl bg-blue-900/20 border border-blue-400/20">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Hint</p>
                <p className="text-sm text-blue-200">{feedbackData.hint}</p>
              </div>
            )}
          </div>
        )}

        {/* Feedback Summary */}
        {showFeedback && (
          <div
            className={`p-4 rounded-xl ${
              feedbackData?.isCorrect
                ? 'bg-emerald-500/10 border border-emerald-400/30'
                : 'bg-red-500/10 border border-red-400/30'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                feedbackData?.isCorrect ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {feedbackData?.isCorrect
                ? '✔ Correct'
                : '✖ Incorrect'}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!showFeedback ? (
          <>
            <button
              onClick={onSkip}
              className="px-6 py-3 rounded-xl border border-white/10 bg-slate-900/30 text-slate-300 hover:bg-slate-900/50 transition-colors"
            >
              Skip Question
            </button>
            <button
              onClick={handleSubmit}
              disabled={isResponseEmpty(question, response)}
              className="flex-1 px-6 py-3 rounded-xl bg-indigo-500/40 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Submit Answer
            </button>
          </>
        ) : (
          <button
            onClick={onFeedback}
            className="flex-1 px-6 py-3 rounded-xl bg-indigo-500/40 border border-indigo-400/40 text-indigo-100 hover:bg-indigo-500/50 transition-colors font-medium"
          >
            Next Question →
          </button>
        )}
      </div>

      {/* Auto-blur for screenshot prevention (optional visual hint) */}
      {process.env.NODE_ENV === 'production' && (
        <p className="text-xs text-slate-500 text-center">
          This session is being recorded for integrity verification.
        </p>
      )}
    </div>
  );
}
