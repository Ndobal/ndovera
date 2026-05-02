import { useState, useCallback } from 'react';
import {
  calculateTopicStrengthScore,
  getTopicStatus,
  updatePerformanceSignals,
  selectNextQuestion,
  shouldOfferAIFallback,
} from '../service/practiceAdaptiveEngine';

/**
 * Custom hook for managing practice engine state and session lifecycle
 */
export const usePracticeEngine = (initialQuestionPool = [], initialTopicMap = {}) => {
  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [currentTopic, setCurrentTopic] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  // sessionQuestions intentionally omitted for now (not used)

  // Performance tracking
  const [topicPerformanceMap, setTopicPerformanceMap] = useState(initialTopicMap);
  const [sessionPerformance, setSessionPerformance] = useState({
    correctCount: 0,
    incorrectCount: 0,
    answers: [],
    startTime: null,
    endTime: null,
  });

  // Question pool
  const [questionPool, setQuestionPool] = useState(initialQuestionPool);

  // UI state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);

  /**
   * Initialize practice session
   */
  /**
   * Load next question from pool
   */
  const loadNextQuestion = useCallback(
    (topic = null) => {
      const topicToUse = topic || currentTopic;

      // If topic is specified, filter questions by that topic
      const availableQuestions = topicToUse
        ? questionPool.filter(q => q.topic === topicToUse && q.active)
        : questionPool.filter(q => q.active);

      if (availableQuestions.length === 0) {
        setCurrentQuestion(null);
        return;
      }

      // Use adaptive engine to select next question
      const nextQuestion = selectNextQuestion(
        topicPerformanceMap,
        availableQuestions,
        { sessionNumber: (topicPerformanceMap[topicToUse]?.sessionCount || 0) + 1 },
      );

      if (nextQuestion) {
        setCurrentQuestion(nextQuestion);
        setQuestionIndex(prev => prev + 1);
      } else {
        // Fallback: random selection
        const randomQuestion = availableQuestions[
          Math.floor(Math.random() * availableQuestions.length)
        ];
        setCurrentQuestion(randomQuestion);
        setQuestionIndex(prev => prev + 1);
      }
    },
    [questionPool, topicPerformanceMap, currentTopic],
  );

  /**
   * Initialize practice session
   */
  const startPracticeSession = useCallback((topic = null) => {
    setSessionActive(true);
    setCurrentTopic(topic);
    setQuestionIndex(0);
    setSessionPerformance({
      correctCount: 0,
      incorrectCount: 0,
      answers: [],
      startTime: new Date(),
      endTime: null,
    });
    setShowFeedback(false);
    setFeedbackData(null);
    setSessionSummary(null);

    // Load first question
    loadNextQuestion(topic);
  }, [loadNextQuestion]);

  /**
   * Handle answer submission
   */
  const submitAnswer = useCallback(
    (selectedOption, timeSpent) => {
      if (!currentQuestion) return;

      const isCorrect = selectedOption === currentQuestion.correctAnswer;

      // Update performance signals
      const updatedPerformance = updatePerformanceSignals(
        topicPerformanceMap[currentQuestion.topic] || {},
        {
          isCorrect,
          timeSpent,
          attemptNumber: (topicPerformanceMap[currentQuestion.topic]?.attempts || 0) + 1,
          difficulty: currentQuestion.difficulty,
        },
      );

      // Update topic performance map
      setTopicPerformanceMap(prev => ({
        ...prev,
        [currentQuestion.topic]: {
          ...updatedPerformance,
          strengthScore: calculateTopicStrengthScore(updatedPerformance),
          status: getTopicStatus(
            calculateTopicStrengthScore(updatedPerformance),
          ),
        },
      }));

      // Update session performance
      setSessionPerformance(prev => ({
        ...prev,
        correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
        incorrectCount: !isCorrect ? prev.incorrectCount + 1 : prev.incorrectCount,
        answers: [
          ...prev.answers,
          {
            questionId: currentQuestion.id,
            selected: selectedOption,
            correct: currentQuestion.correctAnswer,
            isCorrect,
            timeSpent,
            topic: currentQuestion.topic,
          },
        ],
      }));

      // Show feedback
      setFeedbackData({
        isCorrect,
        explanation: currentQuestion.explanation,
        hint: currentQuestion.hint,
        timeSpent,
      });
      setShowFeedback(true);

      // Mark question as seen
      setQuestionPool(prev =>
        prev.map(q =>
          q.id === currentQuestion.id
            ? {
              ...q,
              lastSeenSession: (topicPerformanceMap[currentQuestion.topic]?.sessionCount || 0) + 1,
            }
            : q,
        ),
      );

      return {
        isCorrect,
        feedback: currentQuestion.explanation || (isCorrect ? '✔ Correct' : '✖ Incorrect'),
      };
    },
    [currentQuestion, topicPerformanceMap],
  );

  /**
   * Move to next question after feedback
   */
  const continueToNextQuestion = useCallback(() => {
    setShowFeedback(false);
    setFeedbackData(null);
    loadNextQuestion();
  }, [loadNextQuestion]);

  /**
   * Skip current question
   */
  const skipQuestion = useCallback(() => {
    if (!currentQuestion) return;

    // Log skip as a signal (counts as incorrect signal for attempt tracking)
    setSessionPerformance(prev => ({
      ...prev,
      answers: [
        ...prev.answers,
        {
          questionId: currentQuestion.id,
          selected: null,
          correct: currentQuestion.correctAnswer,
          isCorrect: false,
          timeSpent: 0,
          skipped: true,
          topic: currentQuestion.topic,
        },
      ],
    }));

    loadNextQuestion();
  }, [currentQuestion, loadNextQuestion]);

  /**
   * End practice session and generate summary
   */
  const endSession = useCallback(() => {
    const endTime = new Date();
    const totalTime = endTime - sessionPerformance.startTime;

    // Calculate session accuracy
    const accuracy =
      sessionPerformance.correctCount +
        sessionPerformance.incorrectCount ===
      0
        ? 0
        : Math.round(
          (sessionPerformance.correctCount /
            (sessionPerformance.correctCount +
              sessionPerformance.incorrectCount)) *
          100,
        );

    // Calculate average time per question
    const totalTimeSpent = sessionPerformance.answers.reduce(
      (sum, ans) => sum + (ans.timeSpent || 0),
      0,
    );
    const avgTimePerQuestion = sessionPerformance.answers.length
      ? Math.round(totalTimeSpent / sessionPerformance.answers.length / 1000)
      : 0;

    const summary = {
      topic: currentTopic,
      accuracy,
      totalQuestions: sessionPerformance.answers.length,
      correctCount: sessionPerformance.correctCount,
      totalTime: Math.round(totalTime / 1000),
      avgTimePerQuestion,
      performanceData: sessionPerformance,
      topicStatus: topicPerformanceMap[currentTopic]?.status || null,
      strengthScore: topicPerformanceMap[currentTopic]?.strengthScore || 0,
      recommendation: generateRecommendation(
        accuracy,
        topicPerformanceMap[currentTopic]?.status,
      ),
    };

    setSessionSummary(summary);
    setSessionActive(false);

    return summary;
  }, [currentTopic, sessionPerformance, topicPerformanceMap]);

  /**
   * Generate recommendation based on performance
   */
  const generateRecommendation = (accuracy, status) => {
    if (accuracy >= 80) {
      return `Great work! Up your practice difficulty or move to the next topic.`;
    }
    if (accuracy >= 60) {
      return `Good progress. Practice again tomorrow to reinforce these concepts.`;
    }
    return `Keep practicing. Focus on understanding the fundamentals before moving forward.`;
  };

  /**
   * Get overall readiness across all topics
   */
  const getOverallReadiness = useCallback(() => {
    if (Object.keys(topicPerformanceMap).length === 0) return 0;

    const scores = Object.values(topicPerformanceMap).map(data => data.strengthScore || 0);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [topicPerformanceMap]);

  /**
   * Get weak areas
   */
  const getWeakAreas = useCallback(() => {
    return Object.entries(topicPerformanceMap)
      .filter(([, data]) => data.status?.status === 'weak')
      .map(([topic, data]) => ({
        topic,
        score: data.strengthScore,
        ...data.status,
      }))
      .sort((a, b) => a.score - b.score);
  }, [topicPerformanceMap]);

  /**
   * Get average areas
   */
  const getAverageAreas = useCallback(() => {
    return Object.entries(topicPerformanceMap)
      .filter(([, data]) => data.status?.status === 'average')
      .map(([topic, data]) => ({
        topic,
        score: data.strengthScore,
        ...data.status,
      }))
      .sort((a, b) => b.score - a.score);
  }, [topicPerformanceMap]);

  /**
   * Get strong areas
   */
  const getStrongAreas = useCallback(() => {
    return Object.entries(topicPerformanceMap)
      .filter(([, data]) => data.status?.status === 'strong')
      .map(([topic, data]) => ({
        topic,
        score: data.strengthScore,
        ...data.status,
      }))
      .sort((a, b) => b.score - a.score);
  }, [topicPerformanceMap]);

  /**
   * Check if AI fallback should be offered
   */
  const checkAIFallback = useCallback(() => {
    const shouldOffer = shouldOfferAIFallback(currentQuestion);
    return {
      shouldOffer,
      reason: shouldOffer ? 'No eligible questions available' : null,
    };
  }, [currentQuestion]);

  return {
    // Session control
    sessionActive,
    startPracticeSession,
    endSession,

    // Question management
    currentQuestion,
    currentTopic,
    questionIndex,
    loadNextQuestion,
    submitAnswer,
    continueToNextQuestion,
    skipQuestion,

    // Performance data
    topicPerformanceMap,
    sessionPerformance,
    sessionSummary,

    // Feedback state
    showFeedback,
    feedbackData,

    // Analytics
    getOverallReadiness,
    getWeakAreas,
    getAverageAreas,
    getStrongAreas,
    checkAIFallback,
  };
};

export default usePracticeEngine;
