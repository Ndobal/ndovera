import React, { useRef, useState, useEffect } from 'react';
import { BookOpen, FileText, Layers, User, Sparkles, MessageSquare, Settings, Award, Percent, Video } from 'lucide-react';

const sidebarItems = [
    { key: 'overview', label: 'Overview', icon: Percent },
    { key: 'classroom', label: 'Classroom', icon: BookOpen },
    { key: 'ai_tutor', label: 'AI Tutor', icon: Sparkles },
    { key: 'results', label: 'Results', icon: Layers },
    { key: 'attendance', label: 'Attendance', icon: User },
    { key: 'messages', label: 'Messages', icon: MessageSquare },
    { key: 'settings', label: 'Settings', icon: Settings },
];

const sectionTitles: Record<string, string> = {
    overview: 'Overview',
    classroom: 'Classroom',
    ai_tutor: 'AI Tutor',
    results: 'Results',
    attendance: 'Attendance',
    messages: 'Messages',
    settings: 'Settings',
};

export default function StudentDashboard() {
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const contentRef = useRef<HTMLDivElement>(null);
    const sectionRefs = {
        overview: useRef<HTMLDivElement>(null),
        classroom: useRef<HTMLDivElement>(null),
        ai_tutor: useRef<HTMLDivElement>(null),
        results: useRef<HTMLDivElement>(null),
        attendance: useRef<HTMLDivElement>(null),
        messages: useRef<HTMLDivElement>(null),
        settings: useRef<HTMLDivElement>(null),
    };

    // Scroll to section on sidebar click
    const handleSidebarClick = (key: string) => {
        setActiveTab(key);
        const ref = sectionRefs[key];
        if (ref && ref.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Scroll to top on tab change (for tabbed content)
    useEffect(() => {
        contentRef.current?.scrollTo(0, 0);
    }, [activeTab]);

    return (
        <div className={isDarkMode ? 'dark flex h-screen overflow-hidden bg-linear-to-br from-slate-900/80 to-slate-800/90' : 'flex h-screen overflow-hidden bg-linear-to-br from-white to-slate-100'}>
            {/* Sidebar */}
            <aside className="w-64 h-full overflow-y-auto glass-card dark:glass-card p-6 flex flex-col gap-4 fixed left-0 top-0 bottom-0 z-20 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
                <div className="mb-8">
                    <h1 className="text-2xl font-extrabold text-emerald-500 tracking-tight">Ndovera</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Student Dashboard</p>
                </div>
                <nav className="flex-1 flex flex-col gap-1">
                    {sidebarItems.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === key ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10'}`}
                            onClick={() => handleSidebarClick(key)}
                        >
                            <Icon className="w-5 h-5" />
                            {label}
                        </button>
                    ))}
                </nav>
                <div className="mt-8">
                    <button
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
                        onClick={() => setIsDarkMode((d) => !d)}
                    >
                        {isDarkMode ? 'Light Mode' : 'Night Mode'}
                    </button>
                </div>
            </aside>
            {/* Main Content */}
            <main ref={contentRef} className="flex-1 ml-64 h-full overflow-y-auto p-10 space-y-16">
                {sidebarItems.map(({ key }) => (
                    <section
                        key={key}
                        ref={sectionRefs[key]}
                        className="scroll-mt-24"
                    >
                        <div className="mb-6 flex items-center gap-3">
                            {React.createElement(sidebarItems.find(s => s.key === key)!.icon, { className: 'w-6 h-6 text-emerald-500' })}
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{sectionTitles[key]}</h2>
                        </div>
                        <div className="rounded-2xl glass-card dark:glass-card p-8 border border-slate-200 dark:border-slate-800 shadow-lg">
                            {/* Section content placeholder */}
                            <p className="text-slate-600 dark:text-slate-300 text-base">
                                {key === 'overview' && 'See your academic summary, assignments, and Auras.'}
                                {key === 'classroom' && 'Access assignments, live classes, and resources.'}
                                {key === 'ai_tutor' && 'Ask the AI Tutor for help with homework and concepts.'}
                                {key === 'results' && 'View your results, analytics, and progress.'}
                                {key === 'attendance' && 'Track your attendance and absence records.'}
                                {key === 'messages' && 'Message teachers, admins, or support.'}
                                {key === 'settings' && 'Manage your account and preferences.'}
                            </p>
                        </div>
                    </section>
                ))}
            </main>
        </div>
    );
}
import React, { useState } from 'react';
import { BookOpen, CheckSquare, Calendar, Award, MessageSquare, TrendingUp, FileText, Percent, Clock, Video, Users, Download, Zap, MoreVertical, Send, ArrowLeft, Sparkles } from 'lucide-react';

const MOCK_ASSIGNMENTS = [
  { id: 'a1', title: 'Physics Lab Report: Laws of Motion', subject: 'Physics', dueDate: 'Mar 5, 2026', status: 'Pending', points: 100 },
  { id: 'a2', title: 'Calculus Problem Set #5', subject: 'Mathematics', dueDate: 'Mar 2, 2026', status: 'Submitted', points: 100 },
  { id: 'a3', title: 'Essay: The Great Gatsby Symbolism', subject: 'English', dueDate: 'Feb 28, 2026', status: 'Graded', points: 92 },
];

const StatCard = ({ title, value, icon: Icon, color, trend }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {trend && (
        <div className={`flex items-center text-xs font-bold ${trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
          <TrendingUp className="w-3 h-3 mr-1" />
          {trend}
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4">{value}</p>
    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
  </div>
);

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [activeLiveClass, setActiveLiveClass] = useState(null);

  if (activeLiveClass) {
    return <LiveClassView classInfo={activeLiveClass} onExit={() => setActiveLiveClass(null)} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Welcome Back, Student!</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Your academic command center.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit overflow-x-auto">
        <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Overview</button>
        <button onClick={() => setActiveTab('classroom')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'classroom' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Classroom</button>
        <button onClick={() => setActiveTab('ai_tutor')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'ai_tutor' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>AI Tutor</button>
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'classroom' && <ClassroomTab onJoinLiveClass={setActiveLiveClass} />}
      {activeTab === 'ai_tutor' && <AITutorTab />}
    </div>
  );
}

const OverviewTab = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Overall Average" value="82.5%" icon={Percent} color="bg-emerald-500" trend="+1.2%" />
      <StatCard title="Assignments Due" value="3" icon={BookOpen} color="bg-amber-500" />
      <StatCard title="Today's Classes" value="2" icon={Video} color="bg-sky-500" />
      <StatCard title="Auras Earned" value="1,250" icon={Award} color="bg-indigo-500" />
    </div>
    {/* ... other overview widgets ... */}
  </div>
);

const ClassroomTab = ({ onJoinLiveClass }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
    <div className="lg:col-span-2 space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Assignments & Resources</h2>
            <p className="text-xs text-slate-500">Track and submit your coursework here.</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {MOCK_ASSIGNMENTS.map(assignment => <AssignmentCard key={assignment.id} assignment={assignment} />)}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Classroom Feed</h2>
        </div>
        <div className="px-6 pb-6 space-y-6">
            <ClassroomPost type="announcement" author="Mr. John Doe" time="2h ago" content="Reminder: Calculus test on Friday. Make sure to review chapters 3 and 4." />
            <ClassroomPost type="assignment" author="Mrs. Jane Smith" time="1d ago" content="New assignment posted: Physics Lab Report on 'Laws of Motion'. Due next Tuesday." />
        </div>
      </div>
    </div>
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Live Classes</h2>
      <LiveClassCard subject="Mathematics" teacher="Mr. John Doe" status="live" onJoin={onJoinLiveClass} />
      <LiveClassCard subject="Physics" teacher="Mrs. Jane Smith" status="scheduled" startTime="11:30 AM" onJoin={onJoinLiveClass} />
    </div>
  </div>
);

const AITutorTab = () => {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    const handleAsk = () => {
        if (!question.trim()) return;
        setIsThinking(true);
        setAnswer('');
        // Mock AI response
        setTimeout(() => {
            setAnswer(`The Pythagorean theorem states that in a right-angled triangle, the square of the length of the hypotenuse (the side opposite the right angle) is equal to the sum of the squares of the lengths of the other two sides. This is expressed as a² + b² = c².`);
            setIsThinking(false);
        }, 1500);
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">AI Homework Helper</h2>
                <p className="text-slate-500 mt-2 max-w-md mx-auto">Stuck on a problem? Get instant hints, explanations, and practice questions for any subject.</p>
            </div>
            <div className="mt-6 max-w-lg mx-auto">
                <div className="relative">
                    <textarea 
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        className="w-full p-4 pr-24 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 dark:text-slate-200" 
                        rows="3" 
                        placeholder="Type your question here, e.g., 'Explain the Pythagorean theorem.'"
                    />
                    <button onClick={handleAsk} disabled={isThinking} className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400">
                        {isThinking ? 'Thinking...' : 'Ask AI'}
                    </button>
                </div>
            </div>

            {(isThinking || answer) && (
                <div className="mt-6 max-w-lg mx-auto p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {isThinking ? (
                        <div className="flex items-center gap-3 text-slate-500">
                            <Sparkles className="w-5 h-5 animate-pulse text-indigo-400" />
                            <p className="text-sm font-medium">Ndovera AI is thinking...</p>
                        </div>
                    ) : (
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-500" /> AI Response</h3>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{answer}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ClassroomPost = ({ type, author, time, content }) => (
  <div className="flex gap-4">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${type === 'assignment' ? 'bg-amber-100 dark:bg-amber-900' : 'bg-sky-100 dark:bg-sky-900'}`}>
        {type === 'assignment' ? <BookOpen className="w-5 h-5 text-amber-600" /> : <MessageSquare className="w-5 h-5 text-sky-600" />}
    </div>
    <div>
        <p className="text-xs text-slate-500"><span className="font-bold text-slate-700 dark:text-slate-300">{author}</span> posted a new {type} • {time}</p>
        <p className="text-sm text-slate-800 dark:text-slate-200 mt-1">{content}</p>
    </div>
  </div>
);

const AssignmentCard = ({ assignment }) => {
    const statusStyles = {
        'Pending': 'bg-amber-100 text-amber-700',
        'Submitted': 'bg-sky-100 text-sky-700',
        'Graded': 'bg-emerald-100 text-emerald-700',
    };

    return (
        <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                    <FileText className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{assignment.title}</p>
                    <p className="text-xs text-slate-500">Due: {assignment.dueDate}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${statusStyles[assignment.status]}`}>
                    {assignment.status}
                </div>
                {assignment.status === 'Graded' && <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{assignment.points}/100</p>}
                <button className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500">
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const LiveClassCard = ({ subject, teacher, status, startTime, onJoin }) => (
    <div className={`p-6 rounded-2xl border ${status === 'live' ? 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{status === 'live' ? 'Live Now' : 'Upcoming'}</p>
            {status === 'live' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-2">{subject}</h3>
        <p className="text-xs text-slate-500">with {teacher}</p>
        {status === 'live' ? (
            <button onClick={() => onJoin({ subject, teacher })} className="w-full mt-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                <Video className="w-4 h-4" /> Join Live Class
            </button>
        ) : (
            <div className="mt-4 text-center py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300">
                Starts at {startTime}
            </div>
        )}
    </div>
);

const LiveClassView = ({ classInfo, onExit }) => (
    <div className="flex flex-col h-full">
        <header className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{classInfo.subject}</h2>
                <p className="text-xs text-slate-500">with {classInfo.teacher}</p>
            </div>
            <button onClick={onExit} className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-colors flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Leave Class
            </button>
        </header>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 overflow-hidden">
            <div className="lg:col-span-3 bg-black rounded-2xl flex items-center justify-center">
                <p className="text-slate-500">Video stream placeholder</p>
            </div>
            <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <h3 className="p-4 text-sm font-bold border-b border-slate-100 dark:border-slate-800">Chat & Participants</h3>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {/* Chat messages would go here */}
                    <div className="text-xs text-slate-400 text-center">Chat is disabled for this demo.</div>
                </div>
                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="relative">
                        <input type="text" placeholder="Ask a question..." className="w-full pl-4 pr-10 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm" />
                        <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-emerald-500">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
