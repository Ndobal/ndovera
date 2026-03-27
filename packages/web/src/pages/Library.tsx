import React, { Suspense, lazy, useMemo, useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  BrainCircuit,
  Clock3,
  Coins,
  Download,
  Eye,
  FileCheck2,
  HandCoins,
  Library as LibraryIcon,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Wallet,
  X,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Book,
} from 'lucide-react';

import { Role } from '../types';
import { useData } from '../hooks/useData';
import { fetchWithAuth } from '../services/apiClient';

const NdoveraDocsCreator = lazy(() => import('../components/docs/NdoveraDocsCreator').then((module) => ({ default: module.NdoveraDocsCreator })));

type LibraryBook = {
  id: string;
  title: string;
  author: string;
  category: string;
  mode: 'Physical' | 'Digital' | 'User Upload' | 'Shared';
  library: 'School Library' | 'Global Library' | 'Contributor Library';
  access: 'Free' | 'Premium' | 'Borrow';
  nairaPrice: number;
  auraPrice: number;
  approval: 'Approved' | 'In Review' | 'Flagged';
  owner: string;
  qualityScore: string;
  shelf?: string;
  format: string;
  summary: string;
  visibility: string;
};

type LibraryTab = 'discover' | 'physical' | 'reader' | 'submissions' | 'history' | 'earnings' | 'analytics' | 'moderation';

type LibrarySubmission = {
  id: string;
  title: string;
  owner: string;
  stage: 'Published' | 'AI Review' | 'Flagged';
  ai: string;
  compliance: string;
  createdAt?: string;
};

type LibraryHistoryItem = {
  id: string;
  user: string;
  title: string;
  activity: string;
  timestamp: string;
  status?: string;
};

type LibraryBorrowRecord = {
  id: string;
  borrower: string;
  userType: string;
  book: string;
  dueDate: string;
  status: string;
  offline: string;
};

type LibraryDashboardResponse = {
  roleState: {
    role: string;
    canManagePhysical: boolean;
    canModerate: boolean;
    canUpload: boolean;
    canSeeAnalytics: boolean;
    showParentHistory: boolean;
  };
  books: Array<LibraryBook & {
    createdAt?: string;
    ownerUserId?: string | null;
    recommendationCount: number;
    recommendedByMe: boolean;
  }>;
  myBooks: LibrarySubmission[];
  history: LibraryHistoryItem[];
  myBorrowedBooks: Array<{ id: string; title: string; borrow_date: string; due_date: string; status: string }>;
  physicalRecords: LibraryBorrowRecord[];
  earnings: Array<{ label: string; value: string; note: string }>;
  analytics: Array<{ label: string; value: string; note: string }>;
  recommendations: Array<{ book_id: string; created_at: string; title: string }>;
  stats: {
    modesCount: number;
    approvedTitles: number;
    historyVisibility: string;
    drmProtection: string;
  };
};

const BOOKS: LibraryBook[] = [
  {
    id: 'LIB-001',
    title: 'Senior Secondary Mathematics Companion',
    author: 'Ndovera Press',
    category: 'Textbook',
    mode: 'Digital',
    library: 'School Library',
    access: 'Free',
    nairaPrice: 0,
    auraPrice: 0,
    approval: 'Approved',
    owner: 'School Library Unit',
    qualityScore: 'AI 96%',
    format: 'Encrypted PDF',
    summary: 'Core senior-secondary maths guide with exam drills and worked examples.',
    visibility: 'School only',
  },
  {
    id: 'LIB-002',
    title: 'WAEC Biology Past Questions 2019-2025',
    author: 'Exam Unit',
    category: 'Past Questions',
    mode: 'Shared',
    library: 'Global Library',
    access: 'Premium',
    nairaPrice: 2500,
    auraPrice: 125,
    approval: 'Approved',
    owner: 'Ndovera Global Library',
    qualityScore: 'AI 93%',
    format: 'Encrypted PDF',
    summary: 'Cross-school revision pack with analytics-ready answer trends.',
    visibility: 'Multi-school shared',
  },
  {
    id: 'LIB-003',
    title: 'Things Fall Apart',
    author: 'Chinua Achebe',
    category: 'Novel',
    mode: 'Physical',
    library: 'School Library',
    access: 'Borrow',
    nairaPrice: 0,
    auraPrice: 0,
    approval: 'Approved',
    owner: 'Main Campus Shelf',
    qualityScore: 'Verified classic',
    shelf: 'B-04',
    format: 'Hard copy',
    summary: 'Physical borrowing item with librarian-controlled return workflow.',
    visibility: 'School circulation',
  },
  {
    id: 'LIB-004',
    title: 'Creative Writing for Teens',
    author: 'Mary Afolabi',
    category: 'Storybook',
    mode: 'User Upload',
    library: 'Contributor Library',
    access: 'Premium',
    nairaPrice: 1800,
    auraPrice: 90,
    approval: 'Approved',
    owner: 'Contributor wallet: Mary Afolabi',
    qualityScore: 'AI 89%',
    format: 'Protected EPUB',
    summary: 'User-submitted creative guide earning revenue per read, not per upload.',
    visibility: 'Approved for tenant schools',
  },
  {
    id: 'LIB-005',
    title: 'African Climate & Agriculture Research Notes',
    author: 'Samuel Okoro',
    category: 'Research',
    mode: 'User Upload',
    library: 'Contributor Library',
    access: 'Free',
    nairaPrice: 0,
    auraPrice: 0,
    approval: 'In Review',
    owner: 'Teacher contributor: Samuel Okoro',
    qualityScore: 'AI review pending',
    format: 'PDF + slides',
    summary: 'Teacher-submitted research notes awaiting manual admin approval.',
    visibility: 'Pending moderation',
  },
  {
    id: 'LIB-006',
    title: 'Global SAT Quantitative Study Guide',
    author: 'Ndovera Global Library',
    category: 'Revision Guide',
    mode: 'Shared',
    library: 'Global Library',
    access: 'Premium',
    nairaPrice: 3200,
    auraPrice: 160,
    approval: 'Approved',
    owner: 'Ndovera Global Library',
    qualityScore: 'AI 94%',
    format: 'Encrypted PDF',
    summary: 'Premium multi-school study guide with watermark-protected reading.',
    visibility: 'Optional global content',
  },
  {
    id: 'LIB-007',
    title: 'The Yam and the Goat',
    author: 'Ndovera',
    category: 'Storybook',
    mode: 'Shared',
    library: 'Global Library',
    access: 'Premium',
    nairaPrice: 0,
    auraPrice: 5,
    approval: 'Approved',
    owner: 'Ndovera Global Library',
    qualityScore: 'Protected global title',
    format: 'Protected EPUB',
    summary: 'A globally available Ndovera storybook priced at 5 Auras and retained as a protected showcase title.',
    visibility: 'Global access • Super admin deletion only',
  },
];

const AVAILABLE_PHYSICAL_BOOKS = [
  { id: 'APB-01', title: 'The Yam and the Goat', author: 'Ndovera', category: 'Ndovera Book', uploadType: 'ndovera' },
  { id: 'APB-02', title: 'Things Fall Apart', author: 'Chinua Achebe', category: 'Storybook', uploadType: 'physical' },
  { id: 'APB-03', title: 'Physics for Schools', author: 'Mrs. Adeyemi', category: 'Textbook', uploadType: 'female' },
  { id: 'APB-04', title: 'African Climate Research', author: 'Samuel Okoro', category: 'Notes', uploadType: 'male' },
];

const PHYSICAL_RECORDS = [
  { id: 'BR-101', borrower: 'Alice Johnson', userType: 'Student', book: 'Things Fall Apart', dueDate: '2026-03-18', status: 'On Time', offline: 'Synced' },
  { id: 'BR-102', borrower: 'Mrs. Adeyemi', userType: 'Teacher', book: 'Modern Physics for Schools', dueDate: '2026-03-08', status: 'Overdue', offline: 'Logged offline' },
  { id: 'BR-103', borrower: 'Bob Williams', userType: 'Student', book: 'World History', dueDate: '2026-03-21', status: 'Awaiting Return', offline: 'Synced' },
];

const SUBMISSIONS = [
  { id: 'SB-00', title: 'Library Shelf Starter Stories', owner: 'School Library Unit', stage: 'Published', ai: 'Catalog summary and reading tags completed', compliance: 'Stored in school librarian pipeline' },
  { id: 'SB-01', title: 'Creative Writing for Teens', owner: 'Mary Afolabi', stage: 'Published', ai: 'Summary + tags completed • price fixed by the owner', compliance: 'Approved manually' },
  { id: 'SB-02', title: 'African Climate & Agriculture Research Notes', owner: 'Samuel Okoro', stage: 'AI Review', ai: 'Checking readability, structure, and relevance', compliance: 'Awaiting admin review' },
  { id: 'SB-03', title: 'Foundations of Civic Responsibility', owner: 'Parent Collective', stage: 'Flagged', ai: 'Similarity check triggered', compliance: 'Returned for correction' },
];

const HISTORY = [
  { id: 'H-01', user: 'Student / Parent View', title: 'Senior Secondary Mathematics Companion', activity: 'Read 34 pages • bookmarked chapter 4', timestamp: 'Today • 08:15 AM' },
  { id: 'H-02', user: 'Student / Parent View', title: 'Things Fall Apart', activity: 'Borrowed physically • return due in 4 days', timestamp: 'Yesterday • 03:10 PM' },
  { id: 'H-03', user: 'Contributor View', title: 'Creative Writing for Teens', activity: '12 paid reads • wallet updated', timestamp: 'This week' },
];

const EARNINGS = [
  { label: 'Contributor Wallet', value: '₦18,400', note: 'Available for withdrawal after review window.' },
  { label: 'Aura Balance', value: '920 Auras', note: 'Aura equivalent follows the owner-set selling price.' },
  { label: 'Revenue Split', value: '80% / 20%', note: 'Owner share vs Ndovera share per read or borrow.' },
];

const ANALYTICS = [
  { label: 'Most Borrowed', value: 'Things Fall Apart', note: '27 physical borrows this month' },
  { label: 'Student Reading Trend', value: '+18%', note: 'Longer daily reading sessions across SS classes' },
  { label: 'Revenue Performance', value: '₦126,000', note: 'Paid digital reads across shared library' },
  { label: 'Quality Scores', value: '92% avg', note: 'AI content quality across approved uploads' },
];

const MODERATION = [
  { title: 'AI readability + plagiarism', note: 'AI assists with summary, tags, and structure checks, while the book owner fixes the selling price.', icon: <BrainCircuit className="h-4 w-4" /> },
  { title: 'Manual review gate', note: 'No book publishes until an admin reviews and approves the analysis output.', icon: <ShieldCheck className="h-4 w-4" /> },
  { title: 'Immutable revenue logs', note: 'Every pricing edit, approval, and payout trace stays visible for audit and compliance.', icon: <FileCheck2 className="h-4 w-4" /> },
];

function formatMoney(value: number) {
  return value === 0 ? '₦0' : `₦${value.toLocaleString()}`;
}

export const LibraryView = ({ role, searchQuery }: { role: Role; searchQuery?: string }) => {
  const { data, loading, error, refetch } = useData<LibraryDashboardResponse>('/api/library/dashboard');
  const [readingBook, setReadingBook] = useState<LibraryBook | null>(null);
  const [readingPage, setReadingPage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSubmittingBook, setIsSubmittingBook] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [composerTitle, setComposerTitle] = useState('');
  const [composerCategory, setComposerCategory] = useState('Storybook');
  const [composerSummary, setComposerSummary] = useState('');
  const [composerFormat, setComposerFormat] = useState('Draft Manuscript');

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  const handleReadBook = async (book: LibraryBook) => {
    setLibraryError(null);
    try {
      await fetchWithAuth(`/api/library/books/${book.id}/open`, { method: 'POST' });
      await refetch();
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Unable to open the book right now.');
    }
    setReadingBook(book);
    setReadingPage(0);
    setIsPlaying(false);
  };

  const closeReader = () => {
    if (synthRef.current) synthRef.current.cancel();
    setReadingBook(null);
    setIsPlaying(false);
  };

  const sampleBookContent = [
    "Chapter 1: The Beginning. In the heart of the village, there lived a very special goat...",
    "Chapter 2: The Discovery. One sunny morning, the goat found a giant yam buried in the soil...",
    "Chapter 3: The Feast. The entire village gathered to celebrate the grand harvest...",
    "Chapter 4: The Legacy. Thus, the story of the yam and the goat was passed down generations...",
  ];

  const toggleTTS = () => {
    if (!synthRef.current) return;
    if (isPlaying) {
      synthRef.current.cancel();
      setIsPlaying(false);
    } else {
      const textToRead = sampleBookContent[readingPage];
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.onend = () => setIsPlaying(false);
      synthRef.current.speak(utterance);
      setIsPlaying(true);
    }
  };

  const normalizedRole = data?.roleState.role || role || 'Student';
  const isReader = true;
  const canUpload = data?.roleState.canUpload ?? ['Student', 'Parent', 'Teacher', 'Librarian', 'HoS', 'Head Teacher', 'Principal', 'Class Teacher', 'HOD'].includes(normalizedRole);
  const canManagePhysical = data?.roleState.canManagePhysical ?? ['Librarian', 'HoS', 'Head Teacher', 'Principal'].includes(normalizedRole);
  const canModerate = data?.roleState.canModerate ?? ['Owner', 'Ami', 'Librarian', 'HoS', 'Head Teacher', 'Principal'].includes(normalizedRole);
  const canSeeAnalytics = data?.roleState.canSeeAnalytics ?? ['Librarian', 'HoS', 'Head Teacher', 'Principal', 'Owner', 'Ami'].includes(normalizedRole);
  const canSeeEarnings = canUpload || canModerate;
  const showParentHistory = data?.roleState.showParentHistory ?? normalizedRole === 'Parent';

  const initialTab: LibraryTab = canManagePhysical ? 'physical' : 'discover';
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [isBookComposerOpen, setIsBookComposerOpen] = useState(false);
  const [isDocsCreatorOpen, setIsDocsCreatorOpen] = useState(false);
  const [activePhysicalAction, setActivePhysicalAction] = useState<'catalog' | 'copies' | 'returns' | 'removal'>('catalog');
  const [composerNairaPrice, setComposerNairaPrice] = useState('0');

  const composerAuraPrice = useMemo(() => {
    const nairaValue = Number.parseFloat(composerNairaPrice || '0');
    if (!Number.isFinite(nairaValue) || nairaValue <= 0) return 0;
    return Math.max(1, Math.round(nairaValue / 20));
  }, [composerNairaPrice]);

  useEffect(() => {
    if (activeTab === 'physical' && !canManagePhysical) {
      setActiveTab('discover');
    }
  }, [activeTab, canManagePhysical]);

  useEffect(() => {
    setLibraryNotice(null);
    setLibraryError(null);
  }, [activeTab]);

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: LibraryTab; label: string }> = [
      { id: 'discover', label: 'Discover' },
      { id: 'reader', label: 'Digital Reading' },
      { id: 'history', label: showParentHistory ? 'Child History' : 'History' },
    ];
    if (canManagePhysical) tabs.splice(1, 0, { id: 'physical', label: 'Physical Borrowing' });
    if (canUpload) tabs.push({ id: 'submissions', label: 'MY BOOKS' });
    if (canSeeEarnings) tabs.push({ id: 'earnings', label: 'Earnings' });
    if (canSeeAnalytics) tabs.push({ id: 'analytics', label: 'Analytics' });
    if (canModerate) tabs.push({ id: 'moderation', label: 'Moderation' });
    return tabs;
  }, [canManagePhysical, canModerate, canSeeAnalytics, canSeeEarnings, canUpload, showParentHistory]);

  const mySubmissions = useMemo(() => data?.myBooks || [], [data?.myBooks]);

  const discoverBooks = useMemo(() => {
    const query = (searchQuery || '').trim().toLowerCase();
    const availableBooks = data?.books || [];
    const readerFriendlyBooks = isReader ? availableBooks : availableBooks.filter((book) => book.mode !== 'Shared');
    return readerFriendlyBooks.filter((book) => {
      if (!query) return true;
      return [book.title, book.author, book.category, book.library, book.mode].some((value) => value.toLowerCase().includes(query));
    });
  }, [data?.books, isReader, searchQuery]);

  const availablePhysicalBooks = useMemo(() => discoverBooks.filter((book) => book.mode === 'Physical'), [discoverBooks]);
  const physicalRecords = useMemo(() => data?.physicalRecords || [], [data?.physicalRecords]);
  const historyEntries = useMemo(() => data?.history || [], [data?.history]);
  const readerShelf = useMemo(() => data?.myBorrowedBooks || [], [data?.myBorrowedBooks]);
  const earningsCards = useMemo(() => data?.earnings || EARNINGS, [data?.earnings]);
  const analyticsCards = useMemo(() => data?.analytics || ANALYTICS, [data?.analytics]);

  const statCards = useMemo(() => {
    const cards = [
      { label: 'Library Modes', value: String(data?.stats.modesCount || 0), icon: <LibraryIcon size={16} />, tone: 'bg-emerald-500/10 text-emerald-400' },
      { label: 'Approved Titles', value: String(data?.stats.approvedTitles || 0), icon: <BookOpen size={16} />, tone: 'bg-blue-500/10 text-blue-400' },
      { label: 'Borrow / Read History', value: data?.stats.historyVisibility || (showParentHistory ? 'Child view' : 'Visible'), icon: <Eye size={16} />, tone: 'bg-purple-500/10 text-purple-400' },
      { label: 'DRM Protection', value: data?.stats.drmProtection || 'Active', icon: <Lock size={16} />, tone: 'bg-orange-500/10 text-orange-400' },
    ];
    if (canManagePhysical) cards[2] = { label: 'Offline Borrow Sync', value: 'Ready', icon: <Download size={16} />, tone: 'bg-amber-500/10 text-amber-300' };
    if (canSeeAnalytics) cards[3] = { label: 'Revenue Split', value: '80 / 20', icon: <HandCoins size={16} />, tone: 'bg-fuchsia-500/10 text-fuchsia-300' };
    return cards;
  }, [canManagePhysical, canSeeAnalytics, data?.stats, showParentHistory]);

  const handleRecommend = async (book: LibraryBook) => {
    setActionBusyId(`recommend_${book.id}`);
    setLibraryError(null);
    setLibraryNotice(null);
    try {
      const result = await fetchWithAuth(`/api/library/books/${book.id}/recommend`, { method: 'POST' });
      setLibraryNotice(result?.recommended ? `${book.title} added to your recommendations.` : `${book.title} removed from your recommendations.`);
      await refetch();
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Unable to update recommendation right now.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleBorrowBook = async (book: LibraryBook) => {
    setActionBusyId(`borrow_${book.id}`);
    setLibraryError(null);
    setLibraryNotice(null);
    try {
      const result = await fetchWithAuth(`/api/library/books/${book.id}/borrow`, { method: 'POST' });
      setLibraryNotice(result?.alreadyBorrowed ? `${book.title} is already on your borrowing record.` : `${book.title} added to your borrowing history.`);
      await refetch();
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Unable to borrow this book right now.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCreateSubmission = async () => {
    if (!composerTitle.trim()) {
      setLibraryError('Book title is required.');
      return;
    }

    setIsSubmittingBook(true);
    setLibraryError(null);
    setLibraryNotice(null);
    try {
      await fetchWithAuth('/api/library/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: composerTitle,
          category: composerCategory,
          summary: composerSummary,
          nairaPrice: Number(composerNairaPrice || 0),
          format: composerFormat,
          contentSource: isDocsCreatorOpen ? 'doc_creator' : 'composer',
        }),
      });
      setLibraryNotice('Book added to your submission pipeline.');
      setComposerTitle('');
      setComposerCategory('Storybook');
      setComposerSummary('');
      setComposerFormat('Draft Manuscript');
      setComposerNairaPrice('0');
      setIsBookComposerOpen(false);
      await refetch();
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Unable to save your submission right now.');
    } finally {
      setIsSubmittingBook(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card-compact space-y-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/6 pb-3">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition ${activeTab === tab.id ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {loading ? <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-400">Loading library data...</div> : null}
          {error ? <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-amber-200">Unable to load some library data.</div> : null}
          {libraryNotice ? <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">{libraryNotice}</div> : null}
          {libraryError ? <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-200">{libraryError}</div> : null}
        </div>

        {activeTab === 'earnings' ? (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">Payments & contributor earnings</h3>
            <div className="grid gap-3 md:grid-cols-3 md:place-items-center">
              {earningsCards.map((item, index) => (
                <div
                  key={item.label}
                  className={`mx-auto w-full max-w-50 rounded-3xl border p-2.5 text-center ${[
                    'border-orange-300/70 bg-linear-to-br from-orange-200 via-amber-100 to-rose-100 text-slate-900 dark:border-orange-400/35 dark:bg-linear-to-br dark:from-orange-500/25 dark:via-amber-400/18 dark:to-rose-500/18 dark:text-slate-50',
                    'border-amber-300/70 bg-linear-to-br from-amber-200 via-yellow-100 to-orange-100 text-slate-900 dark:border-amber-400/35 dark:bg-linear-to-br dark:from-amber-500/25 dark:via-yellow-400/18 dark:to-orange-500/18 dark:text-slate-50',
                    'border-rose-300/70 bg-linear-to-br from-rose-200 via-amber-100 to-orange-100 text-slate-900 dark:border-rose-400/35 dark:bg-linear-to-br dark:from-rose-500/25 dark:via-orange-400/18 dark:to-amber-500/18 dark:text-slate-50',
                  ][index]}`}
                >
                  <div className="flex items-center justify-center gap-2 font-bold text-black dark:text-black">
                    {item.label.includes('Wallet') ? <Wallet className="h-3.5 w-3.5" /> : item.label.includes('Aura') ? <Coins className="h-3.5 w-3.5" /> : <HandCoins className="h-3.5 w-3.5" />}
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-black dark:text-black">{item.label}</p>
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-black dark:text-black">{item.value}</p>
                  <p className="mx-auto mt-1 max-w-44 text-[10px] font-bold leading-4 text-black dark:text-black">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {canManagePhysical ? (
        <section className="card-compact space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Librarian tools</h3>
              <p className="mt-1 text-sm text-zinc-400">Manage only this school's physical shelf, circulation records, and protected removal requests.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'catalog', label: 'Add books' },
                { id: 'copies', label: 'Register copies' },
                { id: 'returns', label: 'Manage returns' },
                { id: 'removal', label: 'Removal requests' },
              ].map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => setActivePhysicalAction(action.id as 'catalog' | 'copies' | 'returns' | 'removal')}
                  className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] ${activePhysicalAction === action.id ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {activePhysicalAction === 'catalog' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm text-zinc-200">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">Title</span>
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" placeholder="Add physical title" />
              </label>
              <label className="space-y-2 text-sm text-zinc-200">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">Author</span>
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" placeholder="Author name" />
              </label>
              <label className="space-y-2 text-sm text-zinc-200">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">Shelf code</span>
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" placeholder="B-14" />
              </label>
              <label className="space-y-2 text-sm text-zinc-200">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">Copies</span>
                <input className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" placeholder="6" />
              </label>
            </div>
          ) : null}

          {activePhysicalAction === 'copies' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">Create school-owned copies for locally catalogued titles and assign each copy to a shelf.</div>
              <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">Mark damaged or lost copies as inactive without deleting the master record.</div>
              <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">Track copy counts per shelf so circulation reports stay accurate for this school only.</div>
            </div>
          ) : null}

          {activePhysicalAction === 'returns' ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">Check books in by borrower ID, confirm return condition, and clear overdue alerts.</div>
              <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">Offline intake stays allowed and syncs back into this school's circulation ledger.</div>
              <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">Only this librarian's school records appear here, never another school's pipeline.</div>
            </div>
          ) : null}

          {activePhysicalAction === 'removal' ? (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-4">
              <p className="text-sm font-bold text-amber-200">Protected removal policy</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/90">Librarians can retire damaged school copies and raise removal requests, but protected global titles like “The Yam and the Goat” cannot be deleted here. Only Super Admins or a database reset can remove them.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card-compact overflow-hidden">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,0.85fr))] xl:items-stretch">
          <div className="rounded-3xl border border-white/8 bg-white/3 p-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              <LibraryIcon className="h-3.5 w-3.5" />
              Ndovera Library System
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:contents">
            {statCards.map((card) => (
              <div key={card.label} className="rounded-3xl border border-white/8 bg-white/3 p-4 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${card.tone}`}>{card.icon}</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{card.label}</p>
                    <p className="mt-1 text-base font-bold text-white">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card-compact">
        {activeTab === 'discover' ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Discovery shelf</h3>
                <p className="mt-1 text-sm text-zinc-500">Browse textbooks, storybooks, revision guides, past questions, research, and novels.</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/3 px-3 py-2 text-sm text-zinc-400">
                <Search className="h-4 w-4" />
                {searchQuery?.trim() ? `Filtering by “${searchQuery.trim()}”` : 'Search from the top bar to filter books'}
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {discoverBooks.map((book) => (
                <article key={`${book.id}-${book.library}`} className="rounded-4xl border border-white/8 bg-black/10 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">{book.mode}</span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">{book.category}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${book.approval === 'Approved' ? 'bg-blue-500/10 text-blue-300' : book.approval === 'In Review' ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'}`}>{book.approval}</span>
                      </div>
                      <h4 className="mt-3 text-lg font-bold text-white">{book.title}</h4>
                      <p className="mt-1 text-sm text-zinc-400">by {book.author}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-right">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Pricing</p>
                      <p className="mt-1 text-sm font-semibold text-white">{book.access === 'Borrow' ? 'Physical borrow' : formatMoney(book.nairaPrice)}</p>
                      <p className="text-xs text-zinc-500">{book.access === 'Borrow' ? book.shelf || 'School shelf' : `${book.auraPrice} Auras`}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-zinc-400">{book.summary}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/4 px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Format</p>
                      <p className="mt-1 text-sm text-white">{book.format}</p>
                    </div>
                    <div className="rounded-2xl bg-white/4 px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Owner</p>
                      <p className="mt-1 text-sm text-white">{book.owner}</p>
                    </div>
                    <div className="rounded-2xl bg-white/4 px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Visibility</p>
                      <p className="mt-1 text-sm text-white">{book.visibility}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Sparkles className="h-4 w-4 text-emerald-300" />
                      <span>{book.qualityScore}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-xl bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300">{book.recommendationCount} recommends</span>
                      {book.access === 'Borrow' ? (
                        <button
                          type="button"
                          disabled={actionBusyId === `borrow_${book.id}`}
                          onClick={() => void handleBorrowBook(book)}
                          className="rounded-xl bg-blue-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionBusyId === `borrow_${book.id}` ? 'Borrowing...' : 'Borrow book'}
                        </button>
                      ) : null}
                      {book.access !== 'Borrow' ? (
                        <button
                          type="button"
                          onClick={() => void handleReadBook(book)}
                          className="rounded-xl bg-emerald-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                        >
                          Read in app
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={actionBusyId === `recommend_${book.id}`}
                        onClick={() => void handleRecommend(book)}
                        className={`rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-60 ${book.recommendedByMe ? 'bg-purple-500/25 text-purple-200' : 'bg-purple-500/15 text-purple-300'}`}
                      >
                        {actionBusyId === `recommend_${book.id}` ? 'Saving...' : book.recommendedByMe ? 'Recommended' : 'Recommend'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!discoverBooks.length ? <div className="rounded-4xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-zinc-400">No books match the current search.</div> : null}
            </div>
          </div>
        ) : null}

        {activeTab === 'physical' ? (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-4xl border border-white/8 bg-black/10 p-5">
                <h3 className="text-lg font-bold text-white">Available Physical Books</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {availablePhysicalBooks.map((book, index) => {
                    const palettes = [
                      { bgClass: 'bg-[#87ceeb]', textClass: 'text-slate-900' },
                      { bgClass: 'bg-[#ffc0cb]', textClass: 'text-slate-900' },
                      { bgClass: 'bg-[#c8a2c8]', textClass: 'text-slate-900' },
                      { bgClass: 'bg-[#984c56]', textClass: 'text-white' },
                    ];
                    const { bgClass, textClass } = palettes[index % palettes.length];

                    return (
                      <div key={book.id} className={`rounded-2xl p-4 flex flex-col justify-between ${bgClass}`}>
                        <div>
                          <p className={`text-sm font-bold ${textClass}`}>{book.title}</p>
                          <p className={`mt-1 text-xs font-semibold ${textClass} opacity-80`}>{book.author}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${textClass} opacity-90`}>{book.category}</span>
                        </div>
                      </div>
                    );
                  })}
                  {!availablePhysicalBooks.length ? <div className="col-span-2 rounded-2xl border border-dashed border-white/10 bg-white/3 p-4 text-sm text-zinc-400">No physical books are available yet.</div> : null}
                </div>
              </div>
              <div className="rounded-4xl border border-white/8 bg-black/10 p-5">
                <h3 className="text-lg font-bold text-white">Current circulation</h3>
                <div className="mt-4 space-y-3">
                  {physicalRecords.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-white/8 bg-white/3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{record.book}</p>
                          <p className="mt-1 text-xs text-zinc-500">{record.borrower} • {record.userType} • {record.id}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${record.status === 'Overdue' ? 'bg-rose-500/10 text-rose-300' : record.status === 'Awaiting Return' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{record.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                        <span>Due {record.dueDate}</span>
                        <span>{record.offline}</span>
                      </div>
                    </div>
                  ))}
                  {!physicalRecords.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-4 text-sm text-zinc-400">No circulation records yet.</div> : null}
                </div>
              </div>
            </div>

          </div>
        ) : null}

        {activeTab === 'reader' ? (
          <div className="space-y-4">
            <div className="rounded-4xl border border-white/8 bg-black/10 p-5">
              <h3 className="text-lg font-bold text-white">Your reading shelf</h3>
              <div className="mt-4 space-y-3">
                {readerShelf.map((book) => (
                  <div key={book.id} className="rounded-2xl border border-white/8 bg-white/3 p-4">
                    <p className="text-sm font-semibold text-white">{book.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">Borrowed {new Date(book.borrow_date).toLocaleDateString()} • Due {new Date(book.due_date).toLocaleDateString()}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] ${book.status === 'On Time' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{book.status}</span>
                      <button type="button" onClick={() => setActiveTab('history')} className="rounded-xl bg-white/8 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-200">Open history</button>
                    </div>
                  </div>
                ))}
                {!readerShelf.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-4 text-sm text-zinc-400">No borrowing record yet for this account.</div> : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'submissions' ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">My books</h3>
                <p className="mt-1 text-sm text-zinc-500">Only your own book pipeline appears here, from draft preparation to approval.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBookComposerOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-emerald-900/20"
              >
                <Plus className="h-4 w-4" />
                Write a book
              </button>
            </div>

            {isBookComposerOpen ? (
              <div className="rounded-4xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h4 className="text-base font-bold text-white">Write a book</h4>
                    <p className="mt-1 text-sm text-emerald-50/85">Start a draft with title, category, owner-set price, and a quick summary before sending it into review.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBookComposerOpen(false)}
                    className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-zinc-200">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">Book title</span>
                    <input value={composerTitle} onChange={(event) => setComposerTitle(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" placeholder="Enter title" />
                  </label>
                  <label className="space-y-2 text-sm text-zinc-200">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">Category</span>
                    <select value={composerCategory} onChange={(event) => setComposerCategory(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none">
                      <option>Storybook</option>
                      <option>Textbook</option>
                      <option>Research</option>
                      <option>Revision Guide</option>
                      <option>Past Questions</option>
                      <option>Novel</option>
                      <option>Biography</option>
                      <option>Anthology</option>
                      <option>Poetry</option>
                      <option>Journal</option>
                      <option>Dictionary</option>
                      <option>Encyclopedia</option>
                      <option>Comics</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-zinc-200 md:col-span-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">Summary</span>
                    <textarea value={composerSummary} onChange={(event) => setComposerSummary(event.target.value)} className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" placeholder="Describe your story, audience, and why it should be published." />
                  </label>
                  <label className="space-y-2 text-sm text-zinc-200">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">Book price (₦)</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={composerNairaPrice}
                      onChange={(event) => setComposerNairaPrice(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
                      placeholder="Owner fixes the Naira price"
                    />
                  </label>
                  <div className="space-y-2 text-sm text-zinc-200">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">Aura equivalent</span>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white">
                      {composerAuraPrice} Auras
                    </div>
                    <p className="text-xs text-zinc-500">The system derives the Aura equivalent from the owner-fixed Naira price.</p>
                  </div>
                  <label className="space-y-2 text-sm text-zinc-200 md:col-span-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">Format label</span>
                    <input value={composerFormat} onChange={(event) => setComposerFormat(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none" placeholder="Draft Manuscript" />
                  </label>
                  <div className="md:col-span-2 space-y-3">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">Book Content</span>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-center">
                        <Upload className="mx-auto h-6 w-6 text-zinc-400 mb-2" />
                        <label className="cursor-pointer block">
                          <span className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">Upload PDF / EPUB</span>
                          <input type="file" className="hidden" accept=".pdf,.epub,.txt" />
                          <p className="mt-1 text-xs text-zinc-500">Max file size: 200MB</p>
                        </label>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-center flex flex-col items-center justify-center cursor-pointer hover:bg-slate-950/50 transition-colors" onClick={() => setIsDocsCreatorOpen(true)}>
                        <FileCheck2 className="mx-auto h-6 w-6 text-emerald-400 mb-2" />
                        <button type="button" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                          Open Ndovera Full Doc Creator
                        </button>
                        <p className="mt-1 text-xs text-zinc-400">Write your book directly in the app</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">AI summary</span>
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Owner-set price</span>
                    <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Manual review</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateSubmission()}
                    disabled={isSubmittingBook}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100 hover:bg-emerald-500/30 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmittingBook ? 'Saving...' : 'Add to Library'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: 'Readability + structure', icon: <BrainCircuit className="h-4 w-4" /> },
                { label: 'Summary + tags + owner pricing', icon: <Sparkles className="h-4 w-4" /> },
                { label: 'Human approval mandatory', icon: <ShieldCheck className="h-4 w-4" /> },
              ].map((step) => (
                <div key={step.label} className="rounded-2xl border border-white/8 bg-white/3 p-4 text-sm text-zinc-300">
                  <div className="flex items-center gap-2 text-emerald-300">{step.icon}<span className="font-semibold text-white">{step.label}</span></div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {mySubmissions.length ? mySubmissions.map((submission) => (
                <div key={submission.id} className="rounded-4xl border border-white/8 bg-black/10 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{submission.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">{submission.owner}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${submission.stage === 'Published' ? 'bg-emerald-500/10 text-emerald-300' : submission.stage === 'AI Review' ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'}`}>{submission.stage}</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">{submission.ai}</div>
                    <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">{submission.compliance}</div>
                  </div>
                </div>
              )) : (
                <div className="rounded-4xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
                  <p className="text-base font-semibold text-white">No books yet</p>
                  <p className="mt-2 text-sm text-zinc-400">Use Write a book to start your first draft. Only your own submissions show in this tab.</p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'history' ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-4xl border border-white/8 bg-black/10 p-5">
              <h3 className="text-lg font-bold text-white">History & transparency</h3>
              <div className="mt-4 space-y-3">
                {historyEntries.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/8 bg-white/3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{item.user}</p>
                    <p className="mt-3 text-sm text-zinc-300">{item.activity}</p>
                  </div>
                ))}
                {!historyEntries.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-4 text-sm text-zinc-400">No reading or borrowing history is available yet.</div> : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'earnings' ? (
          <div className="space-y-4">
            <div className="rounded-4xl border border-white/8 bg-white/3 p-5 text-sm text-zinc-300">
              Revenue is tracked per read or borrow, not per upload. Personal digital-book earnings remain attached to each contributor, while 20% of each sale goes to Ndovera.
            </div>
          </div>
        ) : null}

        {activeTab === 'analytics' ? (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Library analytics dashboard</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {analyticsCards.map((item) => (
                <div key={item.label} className="rounded-4xl border border-white/8 bg-black/10 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
                  <p className="mt-3 text-lg font-bold text-white">{item.value}</p>
                  <p className="mt-2 text-sm text-zinc-400">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'moderation' ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Moderation, audit, and compliance</h3>
                <p className="mt-1 text-sm text-zinc-500">AI only assists with analysis. The book owner fixes the price, and human approval remains mandatory before publishing any book.</p>
              </div>
              <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-200 transition hover:bg-white/10">
                <Download className="h-4 w-4" />
                Export audit report
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {MODERATION.map((item) => (
                <div key={item.title} className="rounded-4xl border border-white/8 bg-black/10 p-5">
                  <div className="flex items-center gap-2 text-emerald-300">{item.icon}<p className="font-semibold text-white">{item.title}</p></div>
                  <p className="mt-3 text-sm text-zinc-400">{item.note}</p>
                </div>
              ))}
            </div>
            <div className="rounded-4xl border border-white/8 bg-white/3 p-5 text-sm text-zinc-300">
              Core schema coverage from the reference material includes <span className="font-semibold text-white">library_books</span>, <span className="font-semibold text-white">book_versions</span>, <span className="font-semibold text-white">book_pricing</span>, <span className="font-semibold text-white">physical_borrows</span>, <span className="font-semibold text-white">digital_reads</span>, <span className="font-semibold text-white">library_transactions</span>, <span className="font-semibold text-white">earnings_split</span>, <span className="font-semibold text-white">ai_analysis_reports</span>, and <span className="font-semibold text-white">admin_reviews</span>.
            </div>
          </div>
        ) : null}
      </section>

      {isDocsCreatorOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 text-sm text-zinc-200">Loading document studio...</div>}>
          <NdoveraDocsCreator onClose={() => setIsDocsCreatorOpen(false)} />
        </Suspense>
      )}

      {readingBook ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative h-[80vh] w-full max-w-4xl overflow-hidden rounded-r-2xl rounded-l-md bg-[#f4e4bc] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45),inset_15px_0_20px_rgba(0,0,0,0.2)] flex flex-col">
            <div className="flex items-center justify-between bg-[#8b4513] text-white p-3 shadow-md z-10">
              <div className="flex items-center gap-3">
                <Book className="h-5 w-5" />
                <h2 className="text-lg font-bold">{readingBook.title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleTTS}
                  className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-white/30 transition"
                  title="Read Aloud"
                >
                  {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <Volume2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={closeReader}
                  className="rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12 text-slate-800 text-lg leading-relaxed font-serif relative">
              <div className="absolute top-0 bottom-0 left-0 w-8 bg-linear-to-r from-black/10 to-transparent pointer-events-none"></div>
              
              <div className="max-w-2xl mx-auto space-y-6 min-h-full flex flex-col justify-center">
                {readingPage === 0 && (
                  <div className="mb-12 text-center space-y-4">
                    <h1 className="text-4xl font-bold text-[#5c2e0b] mb-2">{readingBook.title}</h1>
                    <p className="text-xl text-[#8b4513] italic">by {readingBook.author}</p>
                    <div className="w-24 h-1 bg-[#8b4513]/30 mx-auto my-8 rounded-full"></div>
                  </div>
                )}
                
                <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-[#8b4513] first-letter:mr-1 first-letter:float-left first-line:uppercase first-line:tracking-widest">
                  {sampleBookContent[readingPage]}
                </p>
                
                {readingPage === sampleBookContent.length - 1 && (
                  <div className="mt-12 text-center text-[#8b4513] italic">
                    The End
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between bg-[#eaddb4] p-4 shadow-[0_-4px_6px_rgba(0,0,0,0.05)] text-[#5c2e0b]">
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-[#8b4513]/10 px-4 py-2 font-bold uppercase tracking-wider hover:bg-[#8b4513]/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                disabled={readingPage === 0}
                onClick={() => {
                  setReadingPage(p => Math.max(0, p - 1));
                  setIsPlaying(false);
                  if (synthRef.current) synthRef.current.cancel();
                }}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              
              <span className="font-semibold text-sm">
                Page {readingPage + 1} of {sampleBookContent.length}
              </span>

              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-[#8b4513]/10 px-4 py-2 font-bold uppercase tracking-wider hover:bg-[#8b4513]/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                disabled={readingPage === sampleBookContent.length - 1}
                onClick={() => {
                  setReadingPage(p => Math.min(sampleBookContent.length - 1, p + 1));
                  setIsPlaying(false);
                  if (synthRef.current) synthRef.current.cancel();
                }}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
