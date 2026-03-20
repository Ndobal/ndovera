import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Copy,
  GraduationCap,
  Layers3,
  Link2,
  Play,
  Plus,
  School,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react';

import { loadUser } from '../services/authLocal';

const TUTORIALS_STORAGE_KEY = 'ndovera_tutorial_hub';
const TUTORIALS_EVENT = 'ndovera:tutorials-updated';

type TutorialClass = {
  id: string;
  title: string;
  subject: string;
  level: string;
  schedule: string;
  delivery: string;
  summary: string;
  students: number;
  tools: string[];
};

type TutorProfile = {
  id: string;
  displayName: string;
  email: string;
  specialty: string;
  headline: string;
  mode: 'independent' | 'school';
  schoolName?: string;
  accessKey: string;
};

type JoinedTutorial = {
  tutorId: string;
  tutorName: string;
  tutorHeadline: string;
  tutorAccessKey: string;
  tutorSchoolName?: string;
  classId: string;
  classTitle: string;
  subject: string;
  level: string;
  schedule: string;
  delivery: string;
};

type TutorialHubState = {
  tutorProfile: TutorProfile | null;
  tutorClasses: TutorialClass[];
  joinedClasses: JoinedTutorial[];
  learnerName: string;
  learnerEmail: string;
  learnerAccessKey: string;
};

type TutorialCatalogEntry = {
  tutorId: string;
  displayName: string;
  headline: string;
  specialty: string;
  accessKey: string;
  schoolName?: string;
  mode: 'independent' | 'school';
  classes: TutorialClass[];
};

type TutorialsViewProps = {
  publicMode?: boolean;
  searchQuery?: string;
};

const TOOL_STACK = ['Live classroom', 'Assignments', 'Whiteboard', 'Resources', 'Chat'];

const REFERENCE_TUTORS: TutorialCatalogEntry[] = [
  {
    tutorId: 'tutor_ref_okoro',
    displayName: 'Dr. Samuel Okoro',
    headline: 'Independent tutor for agriculture, revision coaching, and project-based learning.',
    specialty: 'Agriculture',
    accessKey: 'SAMUEL-OKORO',
    mode: 'independent',
    classes: [
      {
        id: 'okoro_class_1',
        title: 'Sustainable Farming Masterclass',
        subject: 'Agriculture',
        level: 'Senior learners',
        schedule: 'Mon • Wed • Fri • 4:30 PM',
        delivery: 'Live + resources',
        summary: 'Interactive lessons, assignments, and fieldwork prompts without result publishing.',
        students: 18,
        tools: TOOL_STACK,
      },
      {
        id: 'okoro_class_2',
        title: 'Organic Pest Control Clinic',
        subject: 'Agriculture',
        level: 'All levels',
        schedule: 'Saturday • 10:00 AM',
        delivery: 'Workshop',
        summary: 'Practical tutorial lab with notes, live board, and downloadable guides.',
        students: 11,
        tools: TOOL_STACK,
      },
    ],
  },
  {
    tutorId: 'tutor_ref_jane',
    displayName: 'Mrs. Jane Smith',
    headline: 'School-linked finance tutor helping learners join revision and savings classes from one hub.',
    specialty: 'Finance',
    accessKey: 'JANE-SMITH',
    schoolName: 'Ndovera Academy',
    mode: 'school',
    classes: [
      {
        id: 'jane_class_1',
        title: 'Finance Literacy Bootcamp',
        subject: 'Finance',
        level: 'JSS / SSS',
        schedule: 'Tuesday • Thursday • 5:00 PM',
        delivery: 'Tutorial room',
        summary: 'Structured finance tutorials with class notes, classwork, and no school results access.',
        students: 24,
        tools: TOOL_STACK,
      },
      {
        id: 'jane_class_2',
        title: 'Compound Interest Exam Review',
        subject: 'Finance',
        level: 'Exam candidates',
        schedule: 'Sunday • 2:00 PM',
        delivery: 'Timed review',
        summary: 'Focused revision class using one tutorial link and selectable class cards.',
        students: 13,
        tools: TOOL_STACK,
      },
    ],
  },
];

const EMPTY_STATE: TutorialHubState = {
  tutorProfile: null,
  tutorClasses: [],
  joinedClasses: [],
  learnerName: '',
  learnerEmail: '',
  learnerAccessKey: '',
};

function normalizeAccessKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function makeTutorAccessKey(name: string) {
  const base = normalizeAccessKey(name || 'ndovera-tutor');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base || 'NDOVERA-TUTOR'}-${suffix}`;
}

function loadTutorialHubState(): TutorialHubState {
  try {
    const raw = localStorage.getItem(TUTORIALS_STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<TutorialHubState>) };
  } catch {
    return EMPTY_STATE;
  }
}

function saveTutorialHubState(state: TutorialHubState) {
  try {
    localStorage.setItem(TUTORIALS_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(TUTORIALS_EVENT));
  } catch {
    // ignore persistence errors
  }
}

function buildLearnerAccessKey(name: string, email: string) {
  return makeTutorAccessKey(`${name || 'learner'}-${email.split('@')[0] || 'hub'}`);
}

function createTutorialClass(input: {
  title: string;
  subject: string;
  level: string;
  schedule: string;
  delivery: string;
  summary: string;
}): TutorialClass {
  return {
    id: `tutorial_class_${Date.now()}`,
    title: input.title,
    subject: input.subject,
    level: input.level,
    schedule: input.schedule,
    delivery: input.delivery,
    summary: input.summary,
    students: 0,
    tools: TOOL_STACK,
  };
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-zinc-400">{note}</p>
    </div>
  );
}

export const TutorialsView = ({ publicMode = false, searchQuery = '' }: TutorialsViewProps) => {
  const user = loadUser();
  const initialState = useMemo(() => loadTutorialHubState(), []);
  const [hubState, setHubState] = useState<TutorialHubState>(initialState);
  const [registrationForm, setRegistrationForm] = useState({
    displayName: user?.id === 'user_admin' ? 'School Tutor' : '',
    email: '',
    specialty: 'Mathematics',
    headline: '',
  });
  const [classForm, setClassForm] = useState({
    title: '',
    subject: 'Mathematics',
    level: 'JSS 1 - SSS 3',
    schedule: 'Monday • Wednesday • Friday • 5:00 PM',
    delivery: 'Live tutorial room',
    summary: 'Tutorial class with live instruction, notes, assignments, and no result-sheet access.',
  });
  const [joinAccessKey, setJoinAccessKey] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    saveTutorialHubState(hubState);
  }, [hubState]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tutorKey = normalizeAccessKey(params.get('tutor') || '');
    if (tutorKey) {
      setJoinAccessKey(tutorKey);
      setStatusMessage('Tutorial link detected. Choose the class you want to join below.');
    }
  }, []);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timer = window.setTimeout(() => setStatusMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const currentRole = user?.activeRole || '';
  const schoolLinked = Boolean(user?.schoolId);
  const isTutorActivated = Boolean(hubState.tutorProfile);
  const hasJoinedClasses = hubState.joinedClasses.length > 0;
  const learnerAccessKey = hubState.learnerAccessKey || buildLearnerAccessKey(hubState.learnerName || 'Learner', hubState.learnerEmail || 'hub@ndovera.app');

  const tutorialCatalog = useMemo<TutorialCatalogEntry[]>(() => {
    const localTutor = hubState.tutorProfile
      ? [{
          tutorId: hubState.tutorProfile.id,
          displayName: hubState.tutorProfile.displayName,
          headline: hubState.tutorProfile.headline,
          specialty: hubState.tutorProfile.specialty,
          accessKey: hubState.tutorProfile.accessKey,
          schoolName: hubState.tutorProfile.schoolName,
          mode: hubState.tutorProfile.mode,
          classes: hubState.tutorClasses,
        }]
      : [];
    return [...localTutor, ...REFERENCE_TUTORS];
  }, [hubState.tutorClasses, hubState.tutorProfile]);

  const discoverableTutors = useMemo(() => {
    const query = `${searchQuery} ${joinAccessKey}`.trim().toLowerCase();
    if (!query) return tutorialCatalog;
    return tutorialCatalog.filter((entry) => {
      const haystack = `${entry.displayName} ${entry.specialty} ${entry.headline} ${entry.schoolName || ''} ${entry.classes.map((item) => item.title).join(' ')}`.toLowerCase();
      return haystack.includes(query) || entry.accessKey.toLowerCase().includes(query);
    });
  }, [joinAccessKey, searchQuery, tutorialCatalog]);

  const selectedTutor = tutorialCatalog.find((entry) => entry.tutorId === selectedTutorId)
    || tutorialCatalog.find((entry) => entry.accessKey === normalizeAccessKey(joinAccessKey))
    || null;

  const learnerGroups = useMemo(() => {
    return hubState.joinedClasses.reduce<Record<string, JoinedTutorial[]>>((accumulator, current) => {
      const key = current.tutorId;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(current);
      return accumulator;
    }, {});
  }, [hubState.joinedClasses]);

  const totalTutorStudents = hubState.tutorClasses.reduce((sum, item) => sum + item.students, 0);
  const activeClass = hubState.tutorClasses.find((item) => item.id === activeWorkspaceId)
    || hubState.joinedClasses.find((item) => item.classId === activeWorkspaceId)
    || hubState.tutorClasses[0]
    || hubState.joinedClasses[0]
    || null;

  const tutorJoinLink = `${window.location.origin}/tutorials?tutor=${hubState.tutorProfile?.accessKey || ''}`;
  const learnerHubLink = `${window.location.origin}/tutorials?learner=${learnerAccessKey}`;

  const handleBecomeTutor = () => {
    const displayName = registrationForm.displayName.trim();
    const email = registrationForm.email.trim();
    if (!displayName || !email) {
      setStatusMessage('Add a tutor name and email before creating the tutorial dashboard.');
      return;
    }

    const profile: TutorProfile = {
      id: `tutor_${Date.now()}`,
      displayName,
      email,
      specialty: registrationForm.specialty.trim() || 'General studies',
      headline: registrationForm.headline.trim() || 'Tutorial tutor using Ndovera classroom tools without result publishing.',
      mode: schoolLinked ? 'school' : 'independent',
      schoolName: schoolLinked ? 'Current linked school' : undefined,
      accessKey: makeTutorAccessKey(displayName),
    };

    setHubState((current) => ({
      ...current,
      tutorProfile: profile,
      learnerName: current.learnerName || displayName,
      learnerEmail: current.learnerEmail || email,
      learnerAccessKey: current.learnerAccessKey || buildLearnerAccessKey(displayName, email),
    }));
    setStatusMessage(schoolLinked ? 'Tutorial tutor mode activated for your school-linked account.' : 'Independent tutor account created. Your tutorial dashboard is ready.');
  };

  const handleCreateClass = () => {
    if (!classForm.title.trim()) {
      setStatusMessage('Add a class title before creating a tutorial class.');
      return;
    }

    const created = createTutorialClass({
      title: classForm.title.trim(),
      subject: classForm.subject.trim(),
      level: classForm.level.trim(),
      schedule: classForm.schedule.trim(),
      delivery: classForm.delivery.trim(),
      summary: classForm.summary.trim(),
    });

    setHubState((current) => ({ ...current, tutorClasses: [created, ...current.tutorClasses] }));
    setActiveWorkspaceId(created.id);
    setClassForm((current) => ({ ...current, title: '', summary: 'Tutorial class with live instruction, notes, assignments, and no result-sheet access.' }));
    setStatusMessage('Tutorial class created. Students can now use your one join link to choose it.');
  };

  const handleJoinClass = (tutor: TutorialCatalogEntry, tutorialClass: TutorialClass) => {
    setHubState((current) => {
      const exists = current.joinedClasses.some((entry) => entry.classId === tutorialClass.id && entry.tutorId === tutor.tutorId);
      if (exists) return current;
      return {
        ...current,
        learnerName: current.learnerName || registrationForm.displayName || 'Tutorial learner',
        learnerEmail: current.learnerEmail || registrationForm.email || 'learner@ndovera.app',
        learnerAccessKey: current.learnerAccessKey || buildLearnerAccessKey(current.learnerName || registrationForm.displayName || 'Learner', current.learnerEmail || registrationForm.email || 'learner@ndovera.app'),
        joinedClasses: [
          {
            tutorId: tutor.tutorId,
            tutorName: tutor.displayName,
            tutorHeadline: tutor.headline,
            tutorAccessKey: tutor.accessKey,
            tutorSchoolName: tutor.schoolName,
            classId: tutorialClass.id,
            classTitle: tutorialClass.title,
            subject: tutorialClass.subject,
            level: tutorialClass.level,
            schedule: tutorialClass.schedule,
            delivery: tutorialClass.delivery,
          },
          ...current.joinedClasses,
        ],
      };
    });
    setActiveWorkspaceId(tutorialClass.id);
    setStatusMessage(`Joined ${tutorialClass.title}. Your one learner hub link now opens all your tutorial classes.`);
  };

  const handleCopy = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setStatusMessage(success);
    } catch {
      setStatusMessage(value);
    }
  };

  const hubVisible = publicMode || isTutorActivated || hasJoinedClasses || activeWorkspaceId || currentRole === 'Teacher' || currentRole === 'HoS' || currentRole === 'Parent' || currentRole === 'Student';

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-white/10 bg-linear-to-br from-emerald-500/18 via-slate-950 to-sky-500/10 p-6 shadow-2xl">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
              Tutorials rebuilt
            </span>
            <h2 className="mt-4 text-3xl font-bold text-white">Independent tutors and tutorial learners now share one Ndovera tutorial hub.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
              Independent tutors can register from the Ndovera website, create multiple tutorial classes from one account, and invite students with one universal tutorial link.
              School-linked tutors unlock the same workspace without school results, while learners use one hub link to choose among all their joined tutorial classes.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={handleBecomeTutor} className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500">
                Become a tutor
              </button>
              <button onClick={() => setSelectedTutorId(discoverableTutors[0]?.tutorId || null)} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-100 transition hover:bg-white/10">
                Join with tutor link
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="One tutor account" value={isTutorActivated ? String(hubState.tutorClasses.length || 1) : '1'} note="Create many tutorial classes from one tutor dashboard." />
            <StatCard label="One learner link" value={hasJoinedClasses ? String(hubState.joinedClasses.length) : '∞'} note="One learner hub opens every joined tutorial class." />
            <StatCard label="Results access" value="Off" note="Tutorial classrooms keep live tools but remove school result publishing." />
            <StatCard label="Sidebar rule" value="Smart" note="The tutorials link appears after tutoring is activated or a class is joined." />
          </div>
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {statusMessage}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Tutor registration / activation</p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {schoolLinked ? 'Activate tutorial tutoring inside your school account' : 'Register as an independent tutor from Ndovera website'}
              </h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300">
              {schoolLinked ? <School size={14} /> : <GraduationCap size={14} />}
              {schoolLinked ? 'School-linked tutor flow' : 'Independent tutor flow'}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={registrationForm.displayName} onChange={(event) => setRegistrationForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Tutor display name" className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
            <input value={registrationForm.email} onChange={(event) => setRegistrationForm((current) => ({ ...current, email: event.target.value }))} placeholder="Tutor email" className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
            <input value={registrationForm.specialty} onChange={(event) => setRegistrationForm((current) => ({ ...current, specialty: event.target.value }))} placeholder="Specialty" className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
            <input value={registrationForm.headline} onChange={(event) => setRegistrationForm((current) => ({ ...current, headline: event.target.value }))} placeholder="Short headline" className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">If you are not linked to any school</p>
                <p className="mt-2 leading-6">You become an independent tutor and immediately receive a class dashboard with live tools, resources, whiteboard, assignments, and direct invite links.</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">If you already belong to a school</p>
                <p className="mt-2 leading-6">Your tutorial classes stay separate from school results. The tutorials link only stays visible in the sidebar after tutor activation or after joining a tutorial class.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button onClick={handleBecomeTutor} className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500">
              {isTutorActivated ? 'Refresh tutor profile' : 'Create tutorial dashboard'}
            </button>
          </div>
        </div>

        <div className="rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Join with one tutor link</p>
              <h3 className="mt-2 text-xl font-bold text-white">Paste a tutor access key or pick a tutor below.</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300">
              <Link2 size={14} /> One link, many classes
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <input value={joinAccessKey} onChange={(event) => setJoinAccessKey(normalizeAccessKey(event.target.value))} placeholder="Paste tutor access key" className="flex-1 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
            <button onClick={() => setSelectedTutorId(selectedTutor?.tutorId || discoverableTutors[0]?.tutorId || null)} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              Find
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {discoverableTutors.slice(0, 4).map((tutor) => (
              <button key={tutor.tutorId} onClick={() => { setSelectedTutorId(tutor.tutorId); setJoinAccessKey(tutor.accessKey); }} className={`w-full rounded-3xl border p-4 text-left transition ${selectedTutor?.tutorId === tutor.tutorId ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{tutor.displayName}</p>
                    <p className="mt-1 text-xs text-zinc-400">{tutor.headline}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300">{tutor.classes.length} classes</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                  <span className="rounded-full bg-white/5 px-3 py-1">{tutor.specialty}</span>
                  <span className="rounded-full bg-white/5 px-3 py-1">{tutor.mode === 'school' ? tutor.schoolName || 'School-linked tutor' : 'Independent tutor'}</span>
                  <span className="rounded-full bg-white/5 px-3 py-1 font-mono">{tutor.accessKey}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {selectedTutor ? (
        <section className="rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Tutor class picker</p>
              <h3 className="mt-2 text-xl font-bold text-white">{selectedTutor.displayName} tutorial classes</h3>
              <p className="mt-1 text-sm text-zinc-400">Students use the same tutor link, then choose one or more classes from the tutor dashboard below.</p>
            </div>
            <button onClick={() => handleCopy(`${window.location.origin}/tutorials?tutor=${selectedTutor.accessKey}`, 'Tutor link copied. Learners will land directly on this tutor hub.')} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
              <Copy size={14} /> Copy tutor link
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {selectedTutor.classes.map((tutorialClass) => (
              <div key={tutorialClass.id} className="rounded-4xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{tutorialClass.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">{tutorialClass.subject} • {tutorialClass.level}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">{tutorialClass.delivery}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{tutorialClass.summary}</p>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-400">
                  <span>{tutorialClass.schedule}</span>
                  <span>{tutorialClass.students} learners</span>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => handleJoinClass(selectedTutor, tutorialClass)} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500">
                    <UserPlus size={14} /> Join this class
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isTutorActivated ? (
        <section className="space-y-5 rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Tutor dashboard</p>
              <h3 className="mt-2 text-2xl font-bold text-white">{hubState.tutorProfile?.displayName}</h3>
              <p className="mt-1 text-sm text-zinc-400">One account, many tutorial classes, with classroom tools but no results panel.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleCopy(tutorJoinLink, 'Tutor universal link copied.')} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
                <Copy size={14} /> Copy one tutor link
              </button>
              <button onClick={() => handleCopy(learnerHubLink, 'Learner hub link copied.')} className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20">
                <Link2 size={14} /> Copy learner hub link
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tutorial classes" value={String(hubState.tutorClasses.length)} note="Create many classes and choose any card to enter." />
            <StatCard label="Learners reached" value={String(totalTutorStudents)} note="Active learners across your independent or school-linked tutorials." />
            <StatCard label="Universal join key" value={hubState.tutorProfile?.accessKey || '—'} note="One tutor key works across all your classes." />
            <StatCard label="Classroom tools" value="5" note="Live room, notes, assignments, whiteboard, and chat only." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-4xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Create tutorial class</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={classForm.title} onChange={(event) => setClassForm((current) => ({ ...current, title: event.target.value }))} placeholder="Class title" className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 md:col-span-2" />
                <input value={classForm.subject} onChange={(event) => setClassForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
                <input value={classForm.level} onChange={(event) => setClassForm((current) => ({ ...current, level: event.target.value }))} placeholder="Level" className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500" />
                <input value={classForm.schedule} onChange={(event) => setClassForm((current) => ({ ...current, schedule: event.target.value }))} placeholder="Schedule" className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 md:col-span-2" />
                <input value={classForm.delivery} onChange={(event) => setClassForm((current) => ({ ...current, delivery: event.target.value }))} placeholder="Delivery mode" className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 md:col-span-2" />
                <textarea value={classForm.summary} onChange={(event) => setClassForm((current) => ({ ...current, summary: event.target.value }))} className="min-h-28 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 md:col-span-2" placeholder="Short class summary" />
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={handleCreateClass} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500">
                  <Plus size={14} /> Create class
                </button>
              </div>
            </div>

            <div className="rounded-4xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Your tutorial class cards</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {hubState.tutorClasses.length ? hubState.tutorClasses.map((tutorialClass) => (
                  <button key={tutorialClass.id} onClick={() => setActiveWorkspaceId(tutorialClass.id)} className={`rounded-4xl border p-4 text-left transition ${activeWorkspaceId === tutorialClass.id ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}>
                    <p className="text-sm font-bold text-white">{tutorialClass.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">{tutorialClass.subject} • {tutorialClass.level}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-400">
                      <span>{tutorialClass.schedule}</span>
                      <span>{tutorialClass.students} learners</span>
                    </div>
                  </button>
                )) : <div className="rounded-4xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-zinc-400 md:col-span-2">Create the first class to start sending one tutorial link to your students.</div>}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {hasJoinedClasses ? (
        <section className="space-y-5 rounded-4xl border border-white/10 bg-white/5 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Learner hub</p>
              <h3 className="mt-2 text-2xl font-bold text-white">Choose any joined tutorial class from one learner link.</h3>
              <p className="mt-1 text-sm text-zinc-400">You can belong to different tutors, but your one hub still opens every joined class card.</p>
            </div>
            <button onClick={() => handleCopy(learnerHubLink, 'Learner hub link copied.')} className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20">
              <Copy size={14} /> Copy my one learner link
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Joined classes" value={String(hubState.joinedClasses.length)} note="All tutorial classes across all tutors." />
            <StatCard label="Tutors joined" value={String(Object.keys(learnerGroups).length)} note="Every tutor is grouped under one learner dashboard." />
            <StatCard label="Hub key" value={learnerAccessKey} note="One learner access key opens all your tutorial spaces." />
            <StatCard label="Entry flow" value="Cards" note="Choose which class card to open whenever you have multiple tutorial classes." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <div className="rounded-4xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Joined tutors and classes</p>
              <div className="mt-4 space-y-4">
                {Object.entries(learnerGroups).map(([tutorId, items]) => (
                  <div key={tutorId} className="rounded-4xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{items[0]?.tutorName}</p>
                        <p className="mt-1 text-xs text-zinc-400">{items[0]?.tutorHeadline}</p>
                      </div>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-300">{items.length} joined</span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {items.map((item) => (
                        <button key={`${item.tutorId}_${item.classId}`} onClick={() => setActiveWorkspaceId(item.classId)} className={`rounded-4xl border p-4 text-left transition ${activeWorkspaceId === item.classId ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
                          <p className="text-sm font-bold text-white">{item.classTitle}</p>
                          <p className="mt-1 text-xs text-zinc-400">{item.subject} • {item.level}</p>
                          <p className="mt-3 text-xs text-zinc-500">{item.schedule}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-4xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Tutorial workspace</p>
              {activeClass ? (
                <div className="mt-4 rounded-4xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold text-white">{(activeClass as any)?.title ?? (activeClass as any)?.classTitle}</p>
                      <p className="mt-1 text-sm text-emerald-100">{(activeClass as any)?.subject} • {(activeClass as any)?.level}</p>
                    </div>
                    <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-50">
                      <Play size={14} /> Enter class
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {TOOL_STACK.map((tool) => (
                      <div key={tool} className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white">
                        <p className="font-bold">{tool}</p>
                        <p className="mt-2 text-xs text-zinc-300">Tutorial tools are active here, but school result sheets remain disabled.</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-4xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-zinc-400">Select a class card to open its tutorial workspace.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {hubVisible ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-4xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3 text-emerald-300">
              <BookOpen size={18} />
              <p className="text-sm font-bold">Classroom tools without results</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">Tutorial spaces inherit live classroom tools such as notes, chat, assignments, and whiteboard, but leave out school result processing and result sheets.</p>
          </div>
          <div className="rounded-4xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3 text-sky-300">
              <Layers3 size={18} />
              <p className="text-sm font-bold">Many classes, one account</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">Tutors create several tutorial classes from one account, then pick the right class card whenever they want to teach, update materials, or invite students.</p>
          </div>
          <div className="rounded-4xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3 text-violet-300">
              <Sparkles size={18} />
              <p className="text-sm font-bold">One learner link</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">Learners keep a single tutorial hub link. When they join several tutors or multiple classes, they simply choose the right class card from the same dashboard.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
};
