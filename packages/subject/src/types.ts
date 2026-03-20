export type Role = 'student' | 'teacher' | 'hos' | 'sectional_head' | 'owner' | 'ict';

export interface Topic {
  id: string;
  title: string;
  isTreated: boolean;
}

export interface TermCurriculum {
  term1: Topic[];
  term2: Topic[];
  term3: Topic[];
}

export type QuestionType = 'short_answer' | 'paragraph' | 'multiple_choice' | 'checkboxes' | 'true_false' | 'matching';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  points: number;
  correctAnswer?: string | string[] | boolean | Record<string, string>;
  imageUrl?: string;
  matchingPairs?: { left: string; right: string }[];
}

export interface AssignmentAnswer {
  questionId: string;
  value: string | string[] | boolean | Record<string, string>;
  isCorrect?: boolean;
  score?: number;
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  content?: string;
  answers?: AssignmentAnswer[];
  submittedAt: string;
  totalScore?: number;
}

export interface Classwork {
  id: string;
  title: string;
  description: string;
  date: string;
  questions?: Question[];
  submissions?: Submission[];
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  points: number;
  questions: Question[];
  submissions?: Submission[];
}

export interface LiveClass {
  id: string;
  title: string;
  startTime: string;
  status: 'scheduled' | 'live' | 'ended';
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  teacherName: string;
  color: string;
  pattern: string;
  neonColor: string;
  curriculum: TermCurriculum;
  classworks: Classwork[];
  assignments: Assignment[];
  liveClasses: LiveClass[];
  unreadCounts?: {
    stream?: number;
    curriculum?: number;
    classwork?: number;
    assignment?: number;
    live?: number;
  };
}
