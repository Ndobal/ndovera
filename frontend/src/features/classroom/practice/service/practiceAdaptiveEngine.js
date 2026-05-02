/**
 * NDOVERA Practice Adaptive Intelligence Engine
 * Core logic for adaptive question selection, performance tracking, and difficulty calibration
 */

/**
 * Calculates topic strength score (0-100)
 * Score = (Accuracy × 0.5) + (Speed × 0.2) + (Consistency × 0.2) + (Recent Trend × 0.1)
 */
export const calculateTopicStrengthScore = (performanceData) => {
  const {
    accuracy = 0,        // Percentage (0-100)
    speed = 0,           // Normalized speed score (0-100)
    consistency = 0,     // Normalized consistency (0-100)
    recentTrend = 0,    // Trend score (0-100)
  } = performanceData;

  const score =
    accuracy * 0.5 +
    speed * 0.2 +
    consistency * 0.2 +
    recentTrend * 0.1;

  return Math.min(100, Math.max(0, Math.round(score)));
};

/**
 * Determines topic status based on strength score
 */
export const getTopicStatus = (strengthScore) => {
  if (strengthScore >= 75) return { status: 'strong', color: 'green', label: '🟢 Strong' };
  if (strengthScore >= 50) return { status: 'average', color: 'amber', label: '🟠 Average' };
  return { status: 'weak', color: 'red', label: '🔴 Weak' };
};

/**
 * Generates difficulty bias based on topic status
 * Returns object with difficulty distribution percentages
 */
export const getDifficultyBias = (topicStatus) => {
  const biasMap = {
    weak: { easy: 0.5, medium: 0.5, hard: 0.0 },
    average: { easy: 0.2, medium: 0.6, hard: 0.2 },
    strong: { easy: 0.0, medium: 0.4, hard: 0.6 },
  };
  return biasMap[topicStatus] || biasMap.average;
};

/**
 * Tracks performance signals for a student × topic
 */
export const updatePerformanceSignals = (existingSignals, newAttempt) => {
  const {
    isCorrect,
    timeSpent,      // milliseconds
    difficulty,
  } = newAttempt;

  const updated = { ...existingSignals };

  // Update accuracy (running average)
  const previousAttempts = updated.attempts || 0;
  const previousCorrect = updated.correctAttempts || 0;
  const newCorrect = isCorrect ? previousCorrect + 1 : previousCorrect;
  updated.attempts = previousAttempts + 1;
  updated.correctAttempts = newCorrect;
  updated.accuracy = Math.round((newCorrect / updated.attempts) * 100);

  // Update speed (track average time per question)
  const previousTotalTime = (updated.totalTimeSpent || 0);
  updated.totalTimeSpent = previousTotalTime + timeSpent;
  updated.avgTimePerQuestion = Math.round(updated.totalTimeSpent / updated.attempts);

  // Track recency (last attempt timestamp)
  updated.lastAttemptTime = new Date().toISOString();
  updated.sessionCount = (updated.sessionCount || 0) + 1;

  // Calculate consistency (variance in performance)
  updated.recentAttempts = [
    ...(updated.recentAttempts || []),
    isCorrect ? 1 : 0,
  ].slice(-10); // Keep last 10 attempts
  updated.consistency = calculateConsistency(updated.recentAttempts);

  // Calculate recent trend (improvement or decline)
  updated.recentTrend = calculateRecentTrend(updated.recentAttempts);

  // Track difficulty faced
  updated.difficultyFaced = difficulty;

  // Calculate exam vs practice gap (if exam data is available)
  updated.examVsPracticeGap = updated.examScore
    ? Math.abs(updated.examScore - updated.accuracy)
    : null;

  return updated;
};

/**
 * Calculates consistency score based on recent attempts
 */
const calculateConsistency = (recentAttempts) => {
  if (recentAttempts.length < 2) return 50;
  
  const average = recentAttempts.reduce((a, b) => a + b, 0) / recentAttempts.length;
  const variance = recentAttempts.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / recentAttempts.length;
  const stdDev = Math.sqrt(variance);
  
  // Convert std dev to consistency score (lower variance = higher consistency)
  return Math.max(0, Math.round(100 - stdDev * 100));
};

/**
 * Calculates recent trend (positive = improving, negative = declining)
 */
const calculateRecentTrend = (recentAttempts) => {
  if (recentAttempts.length < 3) return 50;
  
  const recentHalf = recentAttempts.slice(-Math.ceil(recentAttempts.length / 2));
  const olderHalf = recentAttempts.slice(0, Math.floor(recentAttempts.length / 2));
  
  const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
  const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
  
  const trend = recentAvg - olderAvg;
  return Math.round(50 + trend * 50); // Normalize to 0-100
};

/**
 * Determines if a question is blocked from selection
 */
export const isQuestionBlocked = (question, performanceData) => {
  const {
    seenInLastNSessions = 2,
    masteryThreshold = 90,
    masterySpeedThreshold = 30, // seconds
  } = performanceData.blockingRules || {};

  // Check if seen recently
  if (question.lastSeenSession && performanceData.sessionCount) {
    const sessionsDiff = performanceData.sessionCount - question.lastSeenSession;
    if (sessionsDiff <= seenInLastNSessions) {
      return { blocked: true, reason: 'Seen recently' };
    }
  }

  // Check if mastered (≥90% accuracy + fast)
  if (
    performanceData.accuracy >= masteryThreshold &&
    performanceData.avgTimePerQuestion <= masterySpeedThreshold * 1000
  ) {
    return { blocked: true, reason: 'Mastered' };
  }

  // Check if flagged or downgraded
  if (question.flagged || question.downgraded) {
    return { blocked: true, reason: 'Flagged or downgraded' };
  }

  return { blocked: false };
};

/**
 * Main question selection logic
 * Returns next question to serve to student
 */
export const selectNextQuestion = (
  topicPerformanceMap,
  questionPool,
  studentProfile,
) => {
  // 1. Identify weakest topic
  const weakestTopic = identifyWeakestTopic(topicPerformanceMap);
  
  if (!weakestTopic) {
    return null; // No data available
  }

  // 2. Get performance data for weakest topic
  const topicPerformance = topicPerformanceMap[weakestTopic];
  const topicStatus = getTopicStatus(topicPerformance.strengthScore);

  // 3. Filter eligible questions
  const eligibleQuestions = questionPool.filter(q => {
    // Must be active
    if (!q.active) return false;
    
    // Must belong to weakest topic
    if (q.topic !== weakestTopic) return false;
    
    // Must not be blocked
    const blockCheck = isQuestionBlocked(q, topicPerformance);
    if (blockCheck.blocked) return false;
    
    return true;
  });

  if (eligibleQuestions.length === 0) {
    return null; // No eligible questions
  }

  // 4. Get difficulty bias for this topic status
  const difficultyBias = getDifficultyBias(topicStatus.status);

  // 5. Apply difficulty bias weighting
  const weightedQuestions = eligibleQuestions.map(q => ({
    ...q,
    weight: difficultyBias[q.difficulty] || 0.1,
  }));

  // 6. Apply anti-repetition penalty
  const questionWithPenalty = applyAntiRepetitionPenalty(
    weightedQuestions,
    topicPerformance,
  );

  // 7. Select question based on weighted random
  const selectedQuestion = selectByWeightedRandom(questionWithPenalty);

  return selectedQuestion;
};

/**
 * Identifies weakest topic from performance map
 */
const identifyWeakestTopic = (topicPerformanceMap) => {
  let weakestTopic = null;
  let lowestScore = 100;

  Object.entries(topicPerformanceMap).forEach(([topic, data]) => {
    if (data.strengthScore < lowestScore) {
      lowestScore = data.strengthScore;
      weakestTopic = topic;
    }
  });

  return weakestTopic;
};

/**
 * Applies anti-repetition penalty to questions
 */
const applyAntiRepetitionPenalty = (questions, topicPerformance) => {
  const decayFactor = 0.5; // Questions fade back in gradually

  return questions.map(q => {
    let penaltyMultiplier = 1;

    if (q.lastSeenSession) {
      const sessionsSinceLastSee = (topicPerformance.sessionCount || 0) - q.lastSeenSession;
      if (sessionsSinceLastSee < 2) {
        penaltyMultiplier = 0; // Block completely
      } else {
        // Decay factor: older = higher probability of selection
        penaltyMultiplier = Math.min(1, decayFactor * (sessionsSinceLastSee - 2));
      }
    }

    return {
      ...q,
      weight: q.weight * penaltyMultiplier,
    };
  });
};

/**
 * Selects question using weighted random selection
 */
const selectByWeightedRandom = (weightedQuestions) => {
  const totalWeight = weightedQuestions.reduce((sum, q) => sum + q.weight, 0);
  
  if (totalWeight <= 0) {
    return weightedQuestions[Math.floor(Math.random() * weightedQuestions.length)];
  }

  let random = Math.random() * totalWeight;
  for (const q of weightedQuestions) {
    random -= q.weight;
    if (random <= 0) {
      return q;
    }
  }

  return weightedQuestions[weightedQuestions.length - 1];
};

/**
 * Auto-calibrates difficulty based on class-wide performance
 */
export const calibrateDifficulty = (questionId, classPerformanceData) => {
  const {
    totalAttempts = 0,
    successRate = 0,  // Percentage
    currentDifficulty = 'medium',
  } = classPerformanceData;

  if (totalAttempts < 5) {
    return currentDifficulty; // Need minimum data
  }

  const rate = successRate / 100;

  // If many students fail (< 50% success) → difficulty ↑
  if (rate < 0.5) {
    const difficultyMap = { easy: 'easy', medium: 'hard', hard: 'hard' };
    return difficultyMap[currentDifficulty];
  }

  // If many succeed quickly (> 80% success) → difficulty ↓
  if (rate > 0.8) {
    const difficultyMap = { easy: 'easy', medium: 'easy', hard: 'medium' };
    return difficultyMap[currentDifficulty];
  }

  return currentDifficulty;
};

/**
 * Determines if AI fallback should be offered
 */
export const shouldOfferAIFallback = (questionSelectionResult) => {
  // Offer AI only if:
  // 1. No eligible question exists
  // 2. Student explicitly requests it (handled in UI)
  // 3. Student requests explanation help (handled in UI)
  return questionSelectionResult === null;
};

/**
 * Validates question integrity and tamper detection
 */
export const validateQuestionIntegrity = (question, hashRecord) => {
  // In production, perform hash verification
  if (!hashRecord) {
    return { valid: false, reason: 'No hash record' };
  }

  // Verify question hash hasn't been altered
  const computedHash = computeQuestionHash(question);
  if (computedHash !== hashRecord.hash) {
    return { valid: false, reason: 'Hash mismatch - possible tampering' };
  }

  return { valid: true };
};

/**
 * Computes hash for question integrity
 */
const computeQuestionHash = (question) => {
  // Simplified hash - in production use cryptographic hash
  const content = JSON.stringify({
    id: question.id,
    text: question.text,
    options: question.options,
    answer: question.answer,
  });
  
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

const practiceAdaptiveEngine = {
  calculateTopicStrengthScore,
  getTopicStatus,
  getDifficultyBias,
  updatePerformanceSignals,
  isQuestionBlocked,
  selectNextQuestion,
  calibrateDifficulty,
  shouldOfferAIFallback,
  validateQuestionIntegrity,
};

export default practiceAdaptiveEngine;
