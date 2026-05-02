# NDOVERA Practice Area - Adaptive Intelligence Engine

## Overview

The NDOVERA Practice Area implements a sophisticated adaptive intelligence engine that:

- ✅ **Uses only verified & active questions** (no generation by default)
- ✅ **Adapts topic, difficulty, and pacing** automatically
- ✅ **Tracks silent performance signals** (accuracy, speed, consistency, recency)
- ✅ **Prevents teacher manipulation** with strict data validation
- ✅ **Offers AI assistance** as a paid fallback option
- ✅ **Maintains exam-grade security** and fairness

## Architecture

### Core Components

1. **Adaptive Intelligence Engine** (`service/practiceAdaptiveEngine.js`)
   - Calculates topic strength scores (0-100)
   - Implements question selection logic with adaptive difficulty
   - Enforces anti-repetition rules
   - Auto-calibrates difficulty based on class performance
   - Validates question integrity

2. **Practice Hook** (`hooks/usePracticeEngine.js`)
   - Manages session lifecycle
   - Tracks performance signals in real-time
   - Orchestrates engine logic
   - Provides analytics methods

3. **UI Components**
   - `PracticeDashboard.jsx` - Shows overall readiness and categorized topics
   - `PracticeSession.jsx` - Question answering interface (pixel-perfect)
   - `SessionSummary.jsx` - Post-practice feedback and recommendations

4. **Main Container** (`PracticeTab.jsx`)
   - Orchestrates entire practice flow
   - Integrates AI assistance (optional)
   - Manages view states (dashboard → session → summary)

## Topic Strength Score Formula

```
Score = (Accuracy × 0.5) + (Speed × 0.2) + (Consistency × 0.2) + (Recent Trend × 0.1)
```

### Status Bands
- 🔴 **Weak** (0–49): Focus on fundamentals
- 🟠 **Average** (50–74): Build mastery
- 🟢 **Strong** (75–100): Challenge yourself

## Question Selection Logic

### Selection Flow
1. Identify weakest topic from performance map
2. Filter eligible questions:
   - Must be active
   - Not seen in last 2 sessions
   - Correct difficulty for topic status
3. Balance difficulty based on topic status:
   - **Weak**: 50% Easy, 50% Medium
   - **Average**: 20% Easy, 60% Medium, 20% Hard
   - **Strong**: 40% Medium, 60% Hard
4. Apply anti-repetition penalty
5. Select via weighted random choice

### Anti-Repetition Rules
- Questions blocked if seen within last 2 sessions
- Questions blocked if mastered (≥90% accuracy + fast speed)
- Decay function gradually reintroduces questions

## Performance Signals Tracked

Per student × topic:

| Signal | Meaning |
|--------|---------|
| **Accuracy %** | Percentage of correct answers |
| **Avg Time** | Average speed per question (seconds) |
| **Attempts** | Total questions attempted |
| **Recency** | Last attempt timestamp |
| **Difficulty Faced** | Current question difficulty level |
| **Exam vs Practice Gap** | Risk indicator for exam |

## Auto Difficulty Calibration

The system evaluates class-wide performance and auto-adjusts:
- If success rate < 50% → Difficulty ↓
- If success rate > 80% → Difficulty ↑
- Target: ~65% success rate (optimal learning)

**Note**: Teachers cannot manually tune difficulty in practice mode.

## AI Fallback (Paid Feature)

AI assistance is offered ONLY when:
- ✅ No eligible question exists in pool
- ✅ Student explicitly taps "Need more practice"
- ✅ Student requests explanation help

**AI Rules:**
- Clearly labeled "AI-Assisted"
- Confidence score shown
- Never enters core question pool
- Payment required (micro-credit)

## Data Security & Fairness

### Practice Integrity
- ✅ Questions are watermarked internally
- ✅ Rate-limited to prevent abuse
- ✅ Screenshot discouraged (optional blur overlay)

### Performance Isolation
- ✅ Practice performance never alters exam records
- ✅ Never affects grading
- ✅ Logged for analytics only

### Offline Practice
- ✅ Cached securely
- ✅ Sync validates hashes
- ✅ Tamper detection (discard session if tampered)

## UX Principles

### Design Feel
- ✅ Calm and focused (glassmorphism/studio design)
- ✅ No clutter or pressure
- ✅ Non-destructive feedback
- ✅ Academic and professional

### Weak Area Enforcement
- Students cannot ignore weak areas
- Weak topics presented first
- Only after improvement do strong topics unlock

### Feedback Philosophy
- ✅ No shaming or red explosions
- ✅ Supportive explanations included
- ✅ Hints offered for incorrect answers
- ✅ Positive reinforcement for progress

## Usage Example

```jsx
import PracticeTab from '@features/classroom/practice';
import { practice } from '@features/classroom/data/classroomData';

export function StudentClassroom() {
  const [auraBalance, setAuraBalance] = useState(100);

  return (
    <PracticeTab 
      auraBalance={auraBalance}
      setAuraBalance={setAuraBalance}
    />
  );
}
```

## State Management

### Session State
```javascript
{
  sessionActive: boolean,
  currentTopic: string,
  currentQuestion: object,
  questionIndex: number,
  showFeedback: boolean,
  feedbackData: object,
  sessionSummary: object
}
```

### Performance Map
```javascript
{
  [topic]: {
    attempts: number,
    correctAttempts: number,
    accuracy: number,
    avgTimePerQuestion: number,
    consistency: number,
    recentTrend: number,
    sessionCount: number,
    strengthScore: number,
    status: object
  }
}
```

## Verified Question Pool

All questions in `classroomData.questions` are:
- ✅ Verified for accuracy
- ✅ Exam-grade quality
- ✅ Marked as active/inactive
- ✅ Tracked with metadata (difficulty, topic, etc.)

### Question Structure
```javascript
{
  id: string,              // Unique identifier
  topic: string,           // Topic classification
  subject: string,         // Subject area
  difficulty: string,      // 'easy' | 'medium' | 'hard'
  active: boolean,         // Active in pool
  text: string,            // Question prompt
  options: string[],       // Multiple choice options
  correctAnswer: number,   // Index of correct answer
  explanation: string,     // Educational explanation
  hint: string,            // Helpful hint
  flagged: boolean,        // Flagged for review
  downgraded: boolean,     // Downgraded from pool
  lastSeenSession: number  // Session number last seen
}
```

## Extensibility

The system is designed to scale:
- Add more questions to `practice.questions` array
- New topics automatically tracked
- Performance signals extensible
- AI fallback integrates with any LLM service

## Monitoring & Analytics

Track these metrics per student:
- Overall readiness percentage
- Weak/average/strong area distribution
- Accuracy trends per topic
- Time-on-question trends
- Anti-repetition effectiveness
- AI fallback usage rate

## Error Handling

- Invalid question selections → Fallback to random
- Missing performance data → Initialize with defaults
- No eligible questions → Offer AI fallback
- Tampered offline session → Discard and re-fetch

---

**Last Updated**: March 1, 2026  
**Version**: 1.0.0
