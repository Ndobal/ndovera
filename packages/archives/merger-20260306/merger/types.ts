
export enum UserRole {
  GUEST = 'GUEST',
  SUPER_ADMIN = 'SUPER_ADMIN',
  SCHOOL_OWNER = 'SCHOOL_OWNER',
  SCHOOL_ADMIN = 'SCHOOL_ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
  ACCOUNTANT = 'ACCOUNTANT',
  NURSE = 'NURSE',
  TUCKSHOP_MANAGER = 'TUCKSHOP_MANAGER'
}

export enum ViewState {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  ONBOARDING = 'ONBOARDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  SCHOOL_PUBLIC = 'SCHOOL_PUBLIC',
  DASHBOARD = 'DASHBOARD'
}

export enum SchoolSection {
  NURSERY = 'NURSERY',
  PRIMARY = 'PRIMARY',
  JSS = 'JSS',
  SSS = 'SSS'
}

export type LoanStatus = 'REQUESTED' | 'HOS_ADJUSTED' | 'STAFF_REVERIFIED' | 'HOS_FILED' | 'OWNER_APPROVED' | 'DISBURSED' | 'REJECTED';

export interface LoanAudit {
  status: LoanStatus;
  timestamp: string;
  note: string;
  actorName: string;
}

export interface StaffLoan {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  monthlyDeduction: number;
  totalMonths: number;
  startMonth: string;
  repaidAmount: number;
  status: LoanStatus;
  letterText: string;
  auditTrail: LoanAudit[];
}

// --- TRANSIT TRACKER ---
export interface BusRoute {
  id: string;
  name: string;
  driverName: string;
  driverPhone: string;
  currentLat: number;
  currentLng: number;
  stops: string[];
  etaMinutes: number;
}

// --- WELLNESS WATCH ---
export interface HealthMetric {
  id: string;
  studentId: string;
  type: 'SLEEP' | 'NUTRITION' | 'ACTIVITY' | 'MOOD';
  value: number;
  label: string;
  timestamp: string;
}

// --- SKILL FORGE ---
export interface MasterySkill {
  id: string;
  title: string;
  category: 'TECH' | 'ARTS' | 'CIVIC' | 'LIFE';
  progress: number;
  isUnlocked: boolean;
  badges: string[];
}

// --- INNOVATION GALLERY ---
export interface CreativeAsset {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  description: string;
  type: 'ART' | 'WRITING' | 'SCIENCE' | 'CODE';
  url: string;
  verifiedBy?: string;
  likes: number;
}

// --- CIVIC CIRCLE ---
export interface CivicProposal {
  id: string;
  title: string;
  description: string;
  proposerName: string;
  votesFor: number;
  votesAgainst: number;
  status: 'VOTING' | 'APPROVED' | 'IMPLEMENTED';
  deadline: string;
}

// --- HONOR HALL ---
export interface HonorRecord {
  id: string;
  studentId: string;
  studentName: string;
  trait: 'LEADERSHIP' | 'KINDNESS' | 'HONESTY' | 'PUNCTUALITY' | 'DISCIPLINE';
  type: 'MERIT' | 'DEMERIT';
  points: number;
  reason: string;
  issuerName: string;
  timestamp: string;
}

// --- HERITAGE PORTAL ---
export interface HeritageProfile {
  id: string;
  name: string;
  graduationYear: number;
  profession: string;
  bio: string;
  img: string;
  isMentor: boolean;
}

export interface ScholarshipFund {
  id: string;
  title: string;
  donorName: string;
  amount: number;
  criteria: string;
}

// --- CURRICULUM VAULT ---
export interface CurriculumResource {
  id: string;
  title: string;
  subject: string;
  section: SchoolSection;
  type: 'LESSON_PLAN' | 'SLIDES' | 'EXAM_PREP' | 'RESOURCE';
  isVerified: boolean;
  author: string;
  term: number;
}

// --- SUPPLY SANCTUARY ---
export interface SupplyItem {
  id: string;
  name: string;
  category: 'LAB' | 'SPORTS' | 'IT' | 'OFFICE';
  status: 'AVAILABLE' | 'IN_USE' | 'DAMAGED';
  currentHolder?: string;
  returnDeadline?: string;
  lastCheckedAt: string;
}

// --- DETAILED LEDGER ---
export interface FeeComponent {
  id: string;
  label: string;
  amount: number;
  status: 'PAID' | 'PENDING';
}

export interface InstitutionalLedger {
  studentId: string;
  session: string;
  term: string;
  components: FeeComponent[];
  totalBalance: number;
}

// --- VISITOR SECURITY ---
export interface GatePass {
  id: string;
  visitorName: string;
  purpose: string;
  hostId: string;
  hostName: string;
  hostRole: UserRole;
  status: 'PENDING' | 'APPROVED' | 'EXPIRED' | 'USED';
  validUntil: string;
  createdAt: string;
}

// --- LIBRARY MODULE ---
export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  category: 'SCIENCE' | 'LITERATURE' | 'EXAM_PREP' | 'HISTORY' | 'GENERAL';
  isDigital: boolean;
  coverUrl: string;
  availableCopies: number;
  lamsReward: number;
}

export interface BorrowRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  userId: string;
  dueDate: string;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
}

// --- TUCK SHOP ---
export type TuckShopCategory = 'SNACKS' | 'STATIONERY' | 'UNIFORM' | 'DRINKS' | 'FOOD';

export interface TuckShopItem {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  category: TuckShopCategory;
  isAvailable: boolean;
  stock: number;
}

export interface TuckShopOrder {
  id: string;
  itemId: string;
  itemName: string;
  itemPrice: number;
  userId: string;
  userName: string;
  userRole: UserRole;
  location: string;
  timestamp: string;
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED';
  isProvision: boolean;
}

export interface BankAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface TuckShopTreasury {
  schoolAccount: BankAccount;
  provisionsAccount: BankAccount;
}

// --- REST RETAINED ---
export interface AuthorizedDevice { id: string; name: string; location: string; registeredAt: string; }
export interface AttendanceRecord { id: string; staffId: string; staffName: string; date: string; clockInTime: string; deviceId: string; isLate: boolean; fineAmount: number; }
export interface LatenessConfig { resumptionTime: string; gracePeriodMinutes: number; finePerDay: number; isEnabled: boolean; }
export interface Holiday { id: string; date: string; name: string; }
export interface SalaryColumn { id: string; label: string; type: 'ADDITION' | 'DEDUCTION'; }
export type SalaryStatus = 'DRAFT' | 'PUBLISHED' | 'REVISED';
export interface SalaryRevision { id: string; revisedBy: string; revisedAt: string; notes: string; }
export interface SalaryMonth { id: string; month: string; year: number; status: SalaryStatus; columns: SalaryColumn[]; records: SalaryRecord[]; createdBy: string; publishedAt?: string; revisions: SalaryRevision[]; }
export interface SalaryRecord { staffId: string; staffName: string; role: string; baseSalary: number; additions: Record<string, number>; deductions: Record<string, number>; gross: number; net: number; bankName: string; accountNumber: string; }
export interface WebsiteContent { slug: string; customDomain?: string; activeTemplateId: string; maintenanceMode: { isUnderMaintenance: boolean; nextSwitchAt?: string; requestedTemplateId?: string; }; schoolName: string; motto?: string; foundingYear?: string; logo: string; brandColor: string; features: FeatureToggles; attendanceConfig: LatenessConfig; holidays: Holiday[]; home: { headline: string; subheadline: string; heroImage: string; features: {title: string, desc: string}[] }; about: { philosophy: string; history: string; mission: string; vision: string }; academics: { curriculum: string; levels: { name: string; desc: string }[] }; admissions: { steps: string[]; policy: string; deadline: string }; gallery: any[]; contact: { address: string; phone: string; email: string; mapsUrl?: string }; blogPosts: any[]; bulletins: any[]; }
export interface FeatureToggles { boarding: boolean; transport: boolean; hostel: boolean; sports: boolean; aiSummaries: boolean; vacancies: boolean; financialPortal: boolean; }
export enum MessageStatus { SENT = 'SENT', DELIVERED = 'DELIVERED', READ = 'READ' }
export enum MessageType { TEXT = 'TEXT', IMAGE = 'IMAGE', FILE = 'FILE', VOICE = 'VOICE' }
export interface ChatMessage { id: string; senderId: string; senderName: string; text: string; timestamp: Date; status: MessageStatus; type: MessageType; mediaUrl?: string; role: 'user' | 'model'; isForwarded?: boolean; }
export interface ChatThread { id: string; participants: { id: string; name: string; role: string; img: string; online?: boolean; lastSeen?: string }[]; lastMessage: string; timestamp: Date; unread: number; isPinned?: boolean; category?: string; isGroup?: boolean; }
export interface CSRImpactProject { id: string; title: string; description: string; imageUrl: string; amountSpent: number; date: string; }
export interface BlogPost { id: string; title: string; content: string; author: string; authorRole: string; date: string; image: string; status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED'; }
export interface Bulletin { id: string; title: string; date: string; category: 'COMMUNITY' | 'ACADEMICS' | 'SPORTS' | 'GENERAL'; content: string; status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED'; author: string; }
export interface SubjectScore { subjectId: string; subjectName: string; ca1: number; ca2: number; ca3: number; ca4: number; exam: number; isOffered: boolean; }
export type ApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED_HOS' | 'APPROVED_PRINCIPAL' | 'PUBLISHED' | 'LOCKED';
export interface Scoresheet { id: string; studentId: string; studentName: string; admissionNumber: string; schoolName: string; class: string; section: SchoolSection; session: string; term: string; level: 'PRIMARY' | 'SECONDARY'; scores: SubjectScore[]; status: ApprovalStatus; isLocked: boolean; }
export interface PsychomotorTrait { id: string; label: string; rating: 1 | 2 | 3 | 4 | 5; }
export interface AffectiveTrait { id: string; label: string; rating: 1 | 2 | 3 | 4 | 5; }
export interface ResultSheet { id: string; studentId: string; studentName: string; admissionNumber: string; class: string; session: string; term: string; attendance: number; daysOpened: number; startHeight?: number; endHeight?: number; startWeight?: number; endWeight?: number; scores: SubjectScore[]; psychomotor: PsychomotorTrait[]; affective: AffectiveTrait[]; teacherComment: string; headTeacherComment: string; principalComment: string; status: ApprovalStatus; resultType: 'TEMPLATE'; aiComment?: string; teacherSignature?: string; headSignature?: string; principalSignature?: string; publishedAt?: string; }
export interface StaffMember { id: string; name: string; role: string; section: SchoolSection; gender: 'MALE' | 'FEMALE'; department: string; phone: string; email: string; status: 'ACTIVE' | 'INACTIVE'; currentSchoolId: string; employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT'; canManageWeb?: boolean; baseSalary: number; bankName: string; accountNumber: string; }
export interface Student { id: string; globalId: string; name: string; adNo: string; section: SchoolSection; isProfileInitialized: boolean; dob?: string; previousInstitutionalHandle?: string; transferStatus?: TransferStatus; }
export enum TransferStatus { NOT_REQUESTED = 'NOT_REQUESTED', PENDING = 'PENDING', APPROVED_RELEASED = 'APPROVED_RELEASED', REJECTED = 'REJECTED' }
export interface LamsWallet { balance: number; isFarmingActive: boolean; lifetimeEarned: number; pendingWithdrawal: number; }
export interface Quest { id: string; title: string; description: string; reward: number; category: 'DAILY' | 'WEEKLY' | 'ACHIEVEMENT'; status: 'AVAILABLE' | 'CLAIMABLE' | 'COMPLETED'; progress: number; target: number; }
export interface MarketItem { id: string; name: string; description: string; price: number; category: 'TOOLS' | 'ACADEMIC' | 'BOOSTS'; iconName: 'zap' | 'book' | 'star' | 'flame'; }
export interface CampusStory { id: string; authorName: string; authorImg: string; timestamp: Date; isSeen: boolean; type: 'WELFARE' | 'EVENT' | 'ACADEMIC'; contentUrl: string; caption: string; }
export enum RosterType { MORNING_ASSEMBLY = 'MORNING_ASSEMBLY', GENDER_ASSEMBLY = 'GENDER_ASSEMBLY', STAFF_FELLOWSHIP = 'STAFF_FELLOWSHIP', STUDENT_FELLOWSHIP = 'STUDENT_FELLOWSHIP' }
export interface DutyRosterEntry { id: string; type: RosterType; date: string; day: string; assignedStaffId: string; assignedStaffName: string; assistantStaffId?: string; assistantStaffName?: string; topic?: string; section?: SchoolSection; }
export enum MeetingCategory { STAFF = 'STAFF', PTA = 'PTA', WELFARE = 'WELFARE' }
export interface Meeting { id: string; title: string; category: MeetingCategory; startTime: string; status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED'; host: string; }
export interface MeetingParticipant { id: string; name: string; role: UserRole; isAudioOn: boolean; isVideoOn: boolean; isSharingScreen: boolean; deviceId: string; }
export interface GradingConfig { grade: string; min: number; max: number; remark: string; color: string; }
export interface School { id: string; name: string; logo: string; address?: string; email?: string; phone?: string; }
export interface TimetableSlot { id: string; startTime: string; endTime: string; isFixed?: boolean; fixedTitle?: string; isBreak?: boolean; }
export interface TimetableEntry { id: string; day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'; slotId: string; classId: string; subjectId: string; subjectName: string; teacherId: string; teacherName: string; }
export interface SubjectAllocation { id: string; subjectName: string; teacherId: string; teacherName: string; targetWeeklyCount: number; }
export interface TransferRequest { id: string; studentId: string; studentName: string; oldSchoolName: string; oldSchoolId: string; requestingParentId: string; targetSchoolName: string; status: TransferStatus; withdrawalReason: string; timestamp: string; }
export interface ClinicVisit { id: string; studentId: string; studentName: string; className: string; timestamp: string; complaint: string; diagnosis?: string; treatment: string; outcome: 'RETURNED_TO_CLASS' | 'SENT_HOME' | 'ADMITTED' | 'REFERRED'; recordedBy: string; }
export interface Room { id: string; number: string; capacity: number; occupants: string[]; gender: 'MALE' | 'FEMALE'; }
export interface Hostel { id: string; name: string; rooms: Room[]; }
export interface House { id: string; name: string; color: string; master: string; studentIds: string[]; }
