import React, { useEffect, useMemo, useRef, useState } from 'react';
import usePracticeEngine from './hooks/usePracticeEngine';
import PracticeDashboard from './components/PracticeDashboard';
import PracticeSession from './components/PracticeSession';
import SessionSummary from './components/SessionSummary';
import { getPracticeQuestions } from '../../school/services/schoolApi';
import { askAiTutor } from '../../ai/services/aiTutorApi';
import { readChatSession, writeChatSession } from '../../ai/services/chatSessionStorage';
import useFeatureFlags from '../../../shared/hooks/useFeatureFlags';

const PRACTICE_CHAT_SESSION_KEY = 'practice-study-chat';

function normalizePracticeAnswerIndex(question, options) {
  const normalizedAnswer = String(question.answer ?? '').trim().toLowerCase();
  if (!normalizedAnswer) return -1;

  return options.findIndex((option, index) => {
    const optionText = String(option || '').trim().toLowerCase();
    const optionLabel = String.fromCharCode(65 + index).toLowerCase();
    return optionText === normalizedAnswer || optionLabel === normalizedAnswer || String(index) === normalizedAnswer;
  });
}

function normalizeAcceptedAnswers(question) {
  if (Array.isArray(question.answer)) {
    return question.answer.map(answer => String(answer || '').trim()).filter(Boolean);
  }

  const rawAcceptedAnswers = question.acceptedAnswers ?? question.answer ?? '';
  return String(rawAcceptedAnswers || '')
    .split(/[\n,;]+/)
    .map(answer => String(answer || '').trim())
    .filter(Boolean);
}

function getPracticeSubjectLabel(question) {
  return String(question?.subjectName || question?.subject || question?.topic || 'General Studies').trim() || 'General Studies';
}

function getPracticeSubjectKey(question) {
  const subjectId = String(question?.subjectId || '').trim();
  if (subjectId) return `subject:${subjectId}`;
  return `subject:${getPracticeSubjectLabel(question).toLowerCase()}`;
}

function normalizePracticeQuestion(question) {
  const type = String(question.type || 'mcq').trim().toLowerCase();
  const subjectName = getPracticeSubjectLabel(question);
  const baseQuestion = {
    id: question.id,
    subjectId: String(question.subjectId || '').trim(),
    subjectName,
    subjectKey: getPracticeSubjectKey(question),
    topic: question.topic || subjectName || 'General',
    difficulty: question.metadata?.difficulty || question.difficulty || 'standard',
    text: question.prompt || question.text || '',
    explanation: question.explanation || '',
    hint: question.metadata?.hint || '',
    active: true,
    imageUrl: question.imageUrl || '',
    type,
    passage: question.passage || question.metadata?.passage || '',
  };

  if (['mcq', 'truefalse'].includes(type)) {
    const options = Array.isArray(question.options) ? question.options : Array.isArray(question.choices) ? question.choices : [];
    const correctAnswer = normalizePracticeAnswerIndex(question, options);
    if (!options.length || correctAnswer < 0) return null;

    return {
      ...baseQuestion,
      responseType: 'choice',
      options,
      correctAnswer,
    };
  }

  if (['shortanswer', 'fillgaps'].includes(type)) {
    const acceptedAnswers = normalizeAcceptedAnswers(question);
    if (!acceptedAnswers.length) return null;

    return {
      ...baseQuestion,
      responseType: 'text',
      acceptedAnswers,
      answer: acceptedAnswers,
    };
  }

  if (type === 'crossmatching') {
    const pairs = Array.isArray(question.pairs) ? question.pairs : Array.isArray(question.answer) ? question.answer : [];
    const left = Array.isArray(question.left) ? question.left : pairs.map(pair => String(pair?.left || '').trim()).filter(Boolean);
    const right = Array.isArray(question.right) ? question.right : pairs.map(pair => String(pair?.right || '').trim()).filter(Boolean);
    if (!pairs.length || !left.length || !right.length) return null;

    return {
      ...baseQuestion,
      responseType: 'crossmatching',
      pairs,
      left,
      right,
      answer: pairs,
    };
  }

  return null;
}

function formatPracticeLoadError(error) {
  if (!error) return 'Failed to load live practice questions.';
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) return error.message;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  if (error?.message && typeof error.message === 'object') {
    return Object.values(error.message).map(value => String(value || '').trim()).filter(Boolean).join(', ') || 'Failed to load live practice questions.';
  }
  return 'Failed to load live practice questions.';
}

function formatPracticeAiError(error) {
  if (!error) return 'Practice AI could not complete that request.';
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) return error.message;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return 'Practice AI could not complete that request.';
}

function buildPracticeChatPrompt(subjectName, prompt) {
  const normalizedSubject = String(subjectName || '').trim() || 'the selected subject';
  const normalizedPrompt = String(prompt || '').trim();
  if (!normalizedPrompt) return '';

  return [
    `Subject focus: ${normalizedSubject}.`,
    'Respond only with educational help for this subject.',
    'If the learner asks for anything outside study support, refuse briefly and redirect them back to the subject.',
    `Student question: ${normalizedPrompt}`,
  ].join('\n');
}

function PracticeAiChatPanel({
  subjectName,
  auraBalance,
  aiPrompt,
  aiLoading,
  aiError,
  messages,
  onPromptChange,
  onSend,
}) {
  const transcriptRef = useRef(null);

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, aiLoading]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <section className="glass-surface overflow-hidden rounded-3xl border border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/20 px-5 py-4">
        <div className="space-y-1">
          <p className="micro-label accent-amber">AI Study Chat</p>
          <h3 className="text-xl font-semibold text-slate-100">{subjectName}</h3>
          <p className="text-sm text-slate-300">Ask about concepts, revision, examples, or exam prep. Ndovera AI stays on educational content only.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="glass-chip rounded-full px-3 py-1 text-emerald-300">Aura Balance: {auraBalance}</span>
          <span className="rounded-full border border-indigo-300/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">1 Aura per reply</span>
        </div>
      </div>

      <div ref={transcriptRef} className="min-h-[20rem] max-h-[28rem] space-y-4 overflow-y-auto bg-slate-950/10 px-4 py-4">
        {!messages.length && !aiLoading && (
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-white/10 bg-slate-950/20 p-6 text-center">
            <p className="text-sm font-medium text-slate-100">Start with a real study question in {subjectName}.</p>
            <p className="mt-2 text-sm text-slate-400">You can ask for explanations, worked examples, quick revision drills, or exam-focused guidance.</p>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <div key={`${message.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${isUser ? 'border border-indigo-300/30 bg-indigo-500/20 text-indigo-50' : 'border border-white/10 bg-slate-900/40 text-slate-100'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          );
        })}

        {aiLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-3xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
              Thinking through the subject...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-slate-950/20 px-4 py-4">
        {aiError && (
          <div className="mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
            <p className="text-sm whitespace-pre-line text-rose-100">{aiError}</p>
          </div>
        )}

        <textarea
          value={aiPrompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          className="min-h-[110px] w-full rounded-3xl border border-white/10 bg-slate-900/40 p-4 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-400/60"
          placeholder={`Ask about ${subjectName}. Shift + Enter adds a new line.`}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">Educational questions only. Personal, social, or unrelated requests are rejected.</p>
          <button
            onClick={onSend}
            disabled={!aiPrompt.trim() || auraBalance < 1 || aiLoading}
            className="rounded-2xl border border-indigo-300/40 bg-indigo-500/30 px-5 py-2.5 text-sm font-medium text-indigo-50 transition-colors hover:bg-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiLoading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * PracticeTab - Main practice interface orchestrating the adaptive intelligence engine
 * Pixel-perfect, calm, academic design with exam-grade security
 */
export default function PracticeTab({ auraBalance = 0, setAuraBalance = () => {} }) {
  const persistedPracticeChat = readChatSession(PRACTICE_CHAT_SESSION_KEY, {
    selectedSubjectKey: '',
    activeSubjectTab: 'questions',
    aiChatsBySubject: {},
  });
  const { featureFlags } = useFeatureFlags();
  const [practiceData, setPracticeData] = useState({ questions: [], topicPerformanceMap: {} });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'session' | 'summary'
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState(() => String(persistedPracticeChat.selectedSubjectKey || '').trim());
  const [activeSubjectTab, setActiveSubjectTab] = useState(() => persistedPracticeChat.activeSubjectTab === 'chat' ? 'chat' : 'questions');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChatsBySubject, setAiChatsBySubject] = useState(() => (
    persistedPracticeChat.aiChatsBySubject && typeof persistedPracticeChat.aiChatsBySubject === 'object'
      ? persistedPracticeChat.aiChatsBySubject
      : {}
  ));
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const aiMessages = useMemo(
    () => (selectedSubjectKey ? aiChatsBySubject[selectedSubjectKey] || [] : []),
    [aiChatsBySubject, selectedSubjectKey],
  );

  useEffect(() => {
    writeChatSession(PRACTICE_CHAT_SESSION_KEY, {
      selectedSubjectKey,
      activeSubjectTab,
      aiChatsBySubject,
    });
  }, [activeSubjectTab, aiChatsBySubject, selectedSubjectKey]);

  const subjects = useMemo(() => {
    const subjectMap = new Map();

    practiceData.questions.forEach((question) => {
      const key = String(question.subjectKey || getPracticeSubjectKey(question)).trim();
      const label = getPracticeSubjectLabel(question);
      const existing = subjectMap.get(key) || {
        key,
        label,
        questionCount: 0,
        topics: new Set(),
      };

      existing.questionCount += 1;
      existing.topics.add(String(question.topic || label).trim() || label);
      subjectMap.set(key, existing);
    });

    return Array.from(subjectMap.values())
      .map((subject) => ({
        key: subject.key,
        label: subject.label,
        questionCount: subject.questionCount,
        topicCount: subject.topics.size,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [practiceData.questions]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.key === selectedSubjectKey) || null,
    [selectedSubjectKey, subjects],
  );

  const filteredQuestions = useMemo(() => {
    if (!selectedSubjectKey) return [];
    return practiceData.questions.filter((question) => question.subjectKey === selectedSubjectKey);
  }, [practiceData.questions, selectedSubjectKey]);

  const filteredTopicPerformanceMap = useMemo(() => {
    if (!selectedSubjectKey) return {};

    const visibleTopics = new Set(
      filteredQuestions
        .map((question) => String(question.topic || '').trim())
        .filter(Boolean),
    );

    return Object.entries(practiceData.topicPerformanceMap || {}).reduce((accumulator, [topic, value]) => {
      if (!visibleTopics.has(String(topic || '').trim())) return accumulator;
      accumulator[topic] = value;
      return accumulator;
    }, {});
  }, [filteredQuestions, practiceData.topicPerformanceMap, selectedSubjectKey]);

  // Initialize practice engine with questions and topic performance map
  const engine = usePracticeEngine(
    filteredQuestions,
    filteredTopicPerformanceMap,
  );

  useEffect(() => {
    let active = true;

    async function loadPractice() {
      setLoading(true);
      setLoadError('');
      try {
        const classId = window.localStorage.getItem('classroomId') || '';
        const data = await getPracticeQuestions(classId ? { classId } : {});
        if (!active) return;

        const liveQuestions = (Array.isArray(data.questions) ? data.questions : [])
          .map(normalizePracticeQuestion)
          .filter(Boolean);

        setPracticeData({
          questions: liveQuestions,
          topicPerformanceMap: data.topicPerformanceMap || {},
        });
      } catch (error) {
        if (!active) return;
        setLoadError(formatPracticeLoadError(error));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPractice();
    return () => {
      active = false;
    };
  }, []);

  const hasPracticeContent = practiceData.questions.length > 0;

  useEffect(() => {
    const hasValidSelection = subjects.some((subject) => subject.key === selectedSubjectKey);
    if (hasValidSelection) return;

    if (!subjects.length) {
      if (selectedSubjectKey) setSelectedSubjectKey('');
      return;
    }

    if (subjects.length === 1) {
      setSelectedSubjectKey(subjects[0].key);
      return;
    }

    if (selectedSubjectKey) {
      setSelectedSubjectKey('');
    }
  }, [selectedSubjectKey, subjects]);

  // Handle weak areas enforcement
  useEffect(() => {
    if (!selectedSubject) return;

    const weakAreas = engine.getWeakAreas();
    if (weakAreas.length > 0 && !selectedTopic) {
      // Auto-select weakest area for focused practice
      const weakestTopic = weakAreas[0]?.topic;
      if (weakestTopic) {
        setSelectedTopic(weakestTopic);
      }
    }
  }, [engine, selectedSubject, selectedTopic]);

  const handleSelectSubject = (subjectKey) => {
    if (subjectKey === selectedSubjectKey) return;
    setSelectedSubjectKey(subjectKey);
    setSelectedTopic(null);
    setView('dashboard');
    setActiveSubjectTab('questions');
    setAiPrompt('');
    setAiError('');
  };

  const handleStartMixedPractice = () => {
    if (!filteredQuestions.length) {
      alert('No questions are available for this subject yet.');
      return;
    }

    setSelectedTopic(null);
    engine.startPracticeSession(null);
    setView('session');
  };

  /**
   * Start practice session for a specific topic
   */
  const handleStartPractice = (topic = null) => {
    const normalizedTopic = typeof topic === 'string' && topic.trim() ? topic : '';
    const topicToStart = normalizedTopic || selectedTopic || engine.getWeakAreas()[0]?.topic || engine.getAverageAreas()[0]?.topic || null;

    if (!filteredQuestions.length) {
      alert('No topics available for practice.');
      return;
    }

    setSelectedTopic(topicToStart || null);
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
    engine.startPracticeSession(selectedTopic || null);
    setView('session');
  };

  /**
   * Return to dashboard
   */
  const handleReturnDashboard = () => {
    setView('dashboard');
    setSelectedTopic(null);
    setActiveSubjectTab('questions');
    setAiError('');
  };

  /**
   * Practice AI request handler
   */
  const requestPracticeAi = async ({ prompt, mode, auraCost, messages = [] }) => {
    if (!prompt || aiLoading) return;

    setAiLoading(true);
    setAiError('');

    try {
      const data = await askAiTutor({ prompt, mode, messages, surface: 'practice' });
      const updatedBalance = Number(data?.access?.usage?.remainingFreeRequests || 0) + Number(data?.access?.wallet?.availableCredits || 0);
      if (Number.isFinite(updatedBalance) && updatedBalance >= 0) {
        setAuraBalance(updatedBalance);
      } else {
        setAuraBalance(prev => Math.max(0, prev - auraCost));
      }
      return String(data?.answer || '').trim();
    } catch (error) {
      setAiError(formatPracticeAiError(error));
      return '';
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendPracticeChat = async () => {
    if (!selectedSubject) return;

    const prompt = aiPrompt.trim();
    if (!prompt || auraBalance < 1 || aiLoading) return;

    const currentMessages = aiChatsBySubject[selectedSubject.key] || [];
    const history = currentMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setAiChatsBySubject((current) => ({
      ...current,
      [selectedSubject.key]: [...(current[selectedSubject.key] || []), { role: 'user', content: prompt }],
    }));
    setAiPrompt('');

    const answer = await requestPracticeAi({
      prompt: buildPracticeChatPrompt(selectedSubject.label, prompt),
      mode: `${selectedSubject.label} Study Chat`,
      messages: history,
      auraCost: 1,
    });

    if (answer) {
      setAiChatsBySubject((current) => ({
        ...current,
        [selectedSubject.key]: [...(current[selectedSubject.key] || []), { role: 'assistant', content: answer }],
      }));
    }
  };

  // Weak areas warning
  const weakAreas = engine.getWeakAreas();
  const shouldEnforceWeakAreas = Boolean(selectedSubject) && weakAreas.length > 0;
  const summaryPayload = engine.sessionSummary
    ? {
        ...engine.sessionSummary,
        topic: engine.sessionSummary.topic || (selectedSubject ? `${selectedSubject.label} mixed practice` : 'Mixed practice'),
      }
    : null;

  if (loading) {
    return (
      <section className="glass-surface rounded-3xl p-5 text-center">
        <p className="micro-label accent-amber">Loading live practice</p>
        <p className="mt-2 text-slate-300">Fetching the latest subject questions for this learner.</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="glass-surface rounded-3xl p-5 text-center">
        <p className="micro-label accent-rose">Practice unavailable</p>
        <p className="mt-2 text-slate-300">{loadError}</p>
      </section>
    );
  }

  if (!hasPracticeContent) {
    return (
      <section className="glass-surface rounded-3xl p-5 text-center">
        <p className="micro-label accent-amber">No live practice sets</p>
        <p className="mt-2 text-slate-300">Practice questions will appear here once this class has live subject material ready.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard View */}
      {view === 'dashboard' && (
        <>
          <section className="glass-surface rounded-3xl p-5 space-y-4">
            <div className="space-y-1">
              <p className="micro-label accent-amber">Choose a subject</p>
              <h3 className="text-2xl font-semibold text-slate-100">Open a subject workspace</h3>
              <p className="text-sm text-slate-300">Each subject opens blended practice questions and, when enabled, a dedicated study chat.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {subjects.map((subject) => {
                const isActive = subject.key === selectedSubjectKey;
                return (
                  <button
                    key={subject.key}
                    onClick={() => handleSelectSubject(subject.key)}
                    className={`rounded-3xl border p-4 text-left transition-colors ${isActive ? 'border-indigo-300/50 bg-indigo-500/15' : 'border-white/10 bg-slate-900/20 hover:border-white/20 hover:bg-slate-900/35'}`}
                  >
                    <p className="text-lg font-semibold text-slate-100">{subject.label}</p>
                    <p className="mt-2 text-sm text-slate-400">{subject.questionCount} questions across {subject.topicCount} topics</p>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedSubject ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveSubjectTab('questions')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeSubjectTab === 'questions' ? 'border border-indigo-300/40 bg-indigo-500/25 text-indigo-50' : 'border border-white/10 bg-slate-900/25 text-slate-300 hover:bg-slate-900/35'}`}
                >
                  Questions
                </button>
                {featureFlags.aurasEnabled && (
                  <button
                    onClick={() => setActiveSubjectTab('chat')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeSubjectTab === 'chat' ? 'border border-indigo-300/40 bg-indigo-500/25 text-indigo-50' : 'border border-white/10 bg-slate-900/25 text-slate-300 hover:bg-slate-900/35'}`}
                  >
                    AI Study Chat
                  </button>
                )}
              </div>

              {activeSubjectTab === 'questions' && (
                <div className="space-y-6">
                  <section className="glass-surface rounded-3xl p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="space-y-1">
                        <p className="micro-label accent-amber">Question Practice</p>
                        <h3 className="text-2xl font-semibold text-slate-100">{selectedSubject.label}</h3>
                        <p className="text-sm text-slate-300">Work through a blended stream of individual questions for this subject, then drill into any topic that needs more attention.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-4">
                          <p className="text-xs uppercase tracking-wider text-slate-400">Questions</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-100">{selectedSubject.questionCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-4">
                          <p className="text-xs uppercase tracking-wider text-slate-400">Topics</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-100">{selectedSubject.topicCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={handleStartMixedPractice}
                        className="rounded-2xl border border-indigo-300/40 bg-indigo-500/30 px-5 py-3 text-sm font-medium text-indigo-50 transition-colors hover:bg-indigo-500/40"
                      >
                        Start Mixed Questions
                      </button>
                      {weakAreas[0]?.topic && (
                        <button
                          onClick={() => handleStartPractice(weakAreas[0].topic)}
                          className="rounded-2xl border border-red-300/30 bg-red-500/10 px-5 py-3 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/20"
                        >
                          Focus Weakest Topic
                        </button>
                      )}
                    </div>
                  </section>

                  {shouldEnforceWeakAreas && (
                    <div className="glass-surface rounded-3xl border border-red-400/30 bg-red-500/5 p-5">
                      <p className="text-sm text-red-300">⚠️ You have weak areas in this subject. Prioritize them before you move to stronger topics.</p>
                    </div>
                  )}

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
                </div>
              )}

              {activeSubjectTab === 'chat' && featureFlags.aurasEnabled && (
                <PracticeAiChatPanel
                  subjectName={selectedSubject.label}
                  auraBalance={auraBalance}
                  aiPrompt={aiPrompt}
                  aiLoading={aiLoading}
                  aiError={aiError}
                  messages={aiMessages}
                  onPromptChange={(value) => {
                    setAiPrompt(value);
                    if (aiError) setAiError('');
                  }}
                  onSend={handleSendPracticeChat}
                />
              )}
            </>
          ) : (
            <section className="glass-surface rounded-3xl p-5 text-center">
              <p className="micro-label accent-amber">Select a subject</p>
              <p className="mt-2 text-slate-300">Choose one subject to open its question tab and study chat.</p>
            </section>
          )}
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
              {selectedTopic || `${selectedSubject?.label || 'Subject'} mixed practice`}
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
      {view === 'summary' && summaryPayload && (
        <div className="space-y-4">
          <button
            onClick={handleReturnDashboard}
            className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            ← Back to Practice
          </button>

          <SessionSummary
            summary={summaryPayload}
            onContinue={handleContinuePractice}
            onStop={handleReturnDashboard}
          />
        </div>
      )}
    </div>
  );
}

