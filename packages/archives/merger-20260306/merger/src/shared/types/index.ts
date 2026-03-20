import { 
  Shield, 
  User, 
  BookOpen, 
  Users, 
  GraduationCap, 
  Wallet, 
  Settings, 
  MessageSquare, 
  Calendar, 
  Trophy, 
  Layout, 
  Activity,
  UserCheck,
  Briefcase
} from 'lucide-react';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PROPRIETOR = 'PROPRIETOR',
  HOS = 'HOS',
  PRINCIPAL = 'PRINCIPAL',
  HEAD_TEACHER = 'HEAD_TEACHER',
  NURSERY_HEAD = 'NURSERY_HEAD',
  VICE_PRINCIPAL = 'VICE_PRINCIPAL',
  BURSAR = 'BURSAR',
  ICT_MANAGER = 'ICT_MANAGER',
  ADMIN_OFFICER = 'ADMIN_OFFICER',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
  STAFF = 'STAFF',
  ALUMNI = 'ALUMNI'
}

export const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: any; allowedModules: string[] }> = {
  [UserRole.SUPER_ADMIN]: { label: 'Super Admin (Ndovera)', color: 'bg-black', icon: Shield, allowedModules: ['dashboard', 'academics', 'finance', 'attendance', 'school-farm', 'rewards', 'tutorials', 'communication', 'tests', 'results', 'events', 'website', 'settings', 'alumni'] },
  [UserRole.PROPRIETOR]: { label: 'Proprietor', color: 'bg-emerald-600', icon: Shield, allowedModules: ['dashboard', 'academics', 'finance', 'attendance', 'school-farm', 'rewards', 'tutorials', 'communication', 'tests', 'results', 'events', 'website', 'settings', 'alumni'] },
  [UserRole.HOS]: { label: 'Head of School', color: 'bg-blue-600', icon: Shield, allowedModules: ['dashboard', 'academics', 'finance', 'attendance', 'school-farm', 'rewards', 'tutorials', 'communication', 'tests', 'results', 'events', 'website', 'settings', 'alumni'] },
  [UserRole.PRINCIPAL]: { label: 'Principal', color: 'bg-indigo-600', icon: GraduationCap, allowedModules: ['dashboard', 'academics', 'attendance', 'communication', 'tests', 'results', 'events'] },
  [UserRole.HEAD_TEACHER]: { label: 'Head Teacher', color: 'bg-violet-600', icon: GraduationCap, allowedModules: ['dashboard', 'academics', 'attendance', 'communication', 'results', 'events'] },
  [UserRole.NURSERY_HEAD]: { label: 'Nursery Head', color: 'bg-pink-600', icon: GraduationCap, allowedModules: ['dashboard', 'academics', 'attendance', 'communication', 'results', 'events'] },
  [UserRole.VICE_PRINCIPAL]: { label: 'Vice Principal', color: 'bg-cyan-600', icon: GraduationCap, allowedModules: ['dashboard', 'academics', 'attendance', 'communication', 'results', 'events'] },
  [UserRole.BURSAR]: { label: 'Bursar', color: 'bg-amber-600', icon: Wallet, allowedModules: ['dashboard', 'finance'] },
  [UserRole.ICT_MANAGER]: { label: 'ICT Manager', color: 'bg-slate-700', icon: Settings, allowedModules: ['dashboard', 'website', 'settings', 'tests', 'communication', 'alumni'] },
  [UserRole.ADMIN_OFFICER]: { label: 'Admin Officer', color: 'bg-slate-600', icon: Briefcase, allowedModules: ['dashboard', 'communication', 'events'] },
  [UserRole.TEACHER]: { label: 'Teacher', color: 'bg-emerald-500', icon: BookOpen, allowedModules: ['dashboard', 'academics', 'attendance', 'results', 'tutorials', 'school-farm'] },
  [UserRole.STUDENT]: { label: 'Student', color: 'bg-blue-500', icon: User, allowedModules: ['dashboard', 'academics', 'attendance', 'results', 'tutorials', 'rewards', 'school-farm'] },
  [UserRole.PARENT]: { label: 'Parent', color: 'bg-purple-500', icon: Users, allowedModules: ['dashboard', 'finance', 'results', 'attendance', 'events'] },
  [UserRole.STAFF]: { label: 'Staff', color: 'bg-slate-500', icon: UserCheck, allowedModules: ['dashboard', 'attendance', 'events', 'rewards'] },
  [UserRole.ALUMNI]: { label: 'Alumni', color: 'bg-sky-600', icon: GraduationCap, allowedModules: ['dashboard', 'alumni', 'events', 'tutorials'] },
};

export interface User {
  id: string;
  name: string;
  role: UserRole;
  section?: 'Secondary' | 'Primary' | 'Nursery';
  birthday?: string;
  email?: string;
  phone?: string;
  // Aura & Farming Mode
  auras: number;
  farmingEnabled: boolean;
  educativeIncentive?: number; // "Educentive" (Naira amount)
  lastAuraReset: string;
  lastCashout?: string;
  qualifiesForAppreciation?: boolean;
}

export interface SystemConfig {
  auraToNairaRate: number;
  auraPerImpression: number;
  dailyAuraCapPerUser: number;
  globalDailyAuraCap: number;
}

export interface AdImpression {
  id: string;
  userId: string;
  adId: string;
  timestamp: string;
  aurasEarned: number;
}

export interface EducatorsAppreciationCycle {
  id: string;
  userId: string;
  startMonth: number;
  endMonth: number;
  totalAuras: number;
  nairaEquivalent: number;
  paid: boolean;
  expiryDate: string;
}

export interface StudentResult {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  grade: string;
  term: string;
  session: string;
}

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  paidAmount: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  dueDate: string;
  type: 'Tuition' | 'Bus' | 'Uniform' | 'Books';
}

export interface FarmActivity {
  id: string;
  activity: string;
  date: string;
  yield?: string;
  status: 'Planned' | 'In Progress' | 'Completed';
  participants: string[];
  location: string;
}

export interface FeeItem {
  name: string;
  amount: number;
  compulsory: boolean;
}

export interface FeeStructure {
  id: string;
  classLevel: string;
  term: string;
  session: string;
  items: FeeItem[];
  createdBy: string;
}

export interface StudentInvoice {
  id: string;
  studentId: string;
  studentName: string;
  classLevel: string;
  feeStructureId: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  dueDate: string;
  installments: { date: string; amount: number; method: string }[];
}

export interface LessonNote {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  classLevel: string;
  week: number;
  topic: string;
  subtopic: string;
  content: {
    objectives: string[];
    introduction: string;
    body: string;
    activities: string[];
    assessment: string[];
    summary: string;
    references: string[];
  };
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  approvedBy?: string;
  submissionDate?: string;
}

export interface LessonPlan {
  id: string;
  lessonNoteId: string;
  teacherId: string;
  duration: number; // minutes
  entryBehaviour: string;
  setInduction: string;
  breakdown: { time: number; activity: string }[];
  teachingAids: string[];
  evaluation: string;
  homework: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  module: 'Fees' | 'LessonNote' | 'LessonPlan' | 'Farming' | 'System';
}

export interface AffectiveScore {
  name: string;
  score: number; // 1-5
}

export interface PsychomotorScore {
  name: string;
  score: number; // 1-5
}

export interface ComputedResult {
  studentId: string;
  studentName: string;
  term: string;
  session: string;
  classId: string;
  classLevel: string;

  subjects: {
    subjectId: string;
    subjectName: string;
    scores: {
      ca1: number;
      ca2: number;
      assignment: number;
      exam: number;
      total: number;
    };
    grade: string;
    position: number;
  }[];

  affective: AffectiveScore[];
  psychomotor: PsychomotorScore[];

  comments: {
    classTeacher: string;
    sectionalHead: string;
    hos: string;
  };

  signatures: {
    hos?: string;
    date?: string;
  };

  source: 'CA_SCORESHEET';
  version: number;
  locked: boolean;
  published: boolean;
  overallPosition?: number;
  classAverage?: number;
  attendance?: { present: number; total: number };
}

export interface CASpreadsheetEntry {
  studentId: string;
  studentName: string;
  classId: string;
  session: string;
  term: string;
  subjects: {
    subjectId: string;
    subjectName: string;
    caScores: number[]; // [CA1, CA2, Assignment]
    examScore: number;
    total: number;
  }[];
  grandTotal: number;
  teacherSigned: boolean;
  sectionalHeadApproved: boolean;
  hosApproved: boolean;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Computed';
  signatures: {
    teacher?: string;
    sectionalHead?: string;
    hos?: string;
    timestamp?: string;
  };
}

export interface Reward {
  id: string;
  recipientId: string;
  recipientName: string;
  type: 'Student' | 'Staff';
  reason: string;
  date: string;
  category: 'Academic' | 'Punctuality' | 'Behavior' | 'Sports';
}

export interface AptitudeTest {
  id: string;
  title: string;
  type: 'Staff Recruitment' | 'Student Admission';
  questionsCount: number;
  duration: number; // in minutes
  status: 'Active' | 'Draft' | 'Archived';
}

export interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: 'Open Day' | 'Sports' | 'Academic' | 'Holiday';
  description: string;
}

export interface Student {
  id: string;
  name: string;
  class: string;
  status: 'Active' | 'Graduated' | 'Withdrawn';
}

export interface Alumni {
  id: string; // NA-{SCHOOL_INITIALS}-{000001}
  originalStudentId: string;
  name: string;
  graduationYear: number;
  email: string; // jo***@alumni.schoolname.com
  phone?: string;
  currentRole?: string;
  company?: string;
  profilePublic: boolean;
}
