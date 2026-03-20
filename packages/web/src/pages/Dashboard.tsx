import React from 'react';
import {  
  Users, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  BookOpen,
  Megaphone,
  Cake,
  RefreshCw,
  Video,
  Wallet,
  Calendar,
  CheckSquare,
  FileText,
  Mail,
  Activity
, Folder } from 'lucide-react';
import { Role } from '../types';
import { SchoolGuard } from '../components/SchoolGuard';
import { ResultsTabs } from '../features/evaluation/components/ResultsTabs';
import { useData } from '../hooks/useData';
import { studentDashboardFeed } from '../features/student/data/studentPortalFixtures';
import { classroomDashboardMoments, liveClasses } from '../features/classroom/data/classroomExperience';
import { teacherDashboardFeed } from '../features/teacher/data/teacherDashboardFixtures';
import { parentDashboardFeed } from '../features/parent/data/parentDashboardFixtures';
import type { LiveClassSession } from '../features/classroom/services/classroomApi';

export const DashboardHome = ({ role, setActiveTab }: { role: Role; setActiveTab?: (tab: string) => void }) => {
  const { data: currentUser } = useData<any>('/api/users/me');
  if (role && ['Super Admin'].includes(role)) return <SchoolGuard role={role} />
  const { data: dashboardSummary } = useData<any>('/api/dashboard/summary');
  const { data: students } = useData<any[]>('/api/students');
  const { data: announcements } = useData<any[]>('/api/announcements');
  const { data: financeStats } = useData<any>('/api/finance/stats');
  const { data: teachers } = useData<any[]>('/api/teachers');
  const { data: children } = useData<any[]>('/api/parents/me/children');
  const { data: liveClassData } = useData<LiveClassSession[]>('/api/classroom/live-classes');

  const isStudent = role === 'Student';
  const isParent = role === 'Parent';
  const isTeacher = role === 'Teacher';
  
  const isAdministration = ['HOS', 'HoS', 'Owner', 'Tenant School Owner', 'Principal', 'Head Teacher', 'Nursery Head', 'HOD', 'Ami'].includes(role);
  const isFrontDesk = role === 'School Admin';
  const isFinance = role === 'Accountant' || role === 'Bursar';
  const isOperations = ['Librarian', 'Tuckshop Manager', 'Transport Manager', 'Clinic Officer'].includes(role);
  const studentSummary = dashboardSummary?.student;
  const teacherSummary = dashboardSummary?.teacher;
  const genericSummary = dashboardSummary?.generic;
  const nextLiveClass = studentSummary?.liveClasses?.[0] || teacherSummary?.liveClasses?.[0] || liveClassData?.[0] || liveClasses[0];
  const studentAssignments = studentSummary?.assignments || [];
  const teacherAssignments = teacherSummary?.assignments || [];
  const teacherSubjects = teacherSummary?.subjects || [];
  const dashboardAnnouncements = studentSummary?.announcements || teacherSummary?.announcements || genericSummary?.announcements || announcements || [];

  const getStats = () => {
    if (isStudent) return [
      { label: 'Latest Average', value: studentSummary?.stats?.latestAverage || '—', change: `${studentSummary?.stats?.subjectCount || 0} subjects`, icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Live Classes', value: String(studentSummary?.stats?.liveClassCount || 0), change: 'Ready', icon: <Clock size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Assignments', value: `${studentSummary?.stats?.pendingAssignments || 0} Due`, change: `${studentSummary?.stats?.submittedAssignments || 0} Submitted`, icon: <Users size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Updates', value: String(dashboardAnnouncements.length), change: 'School feed', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
    ];

    if (isTeacher) return [
      { label: 'My Subjects', value: String(teacherSummary?.stats?.subjectCount || 0), change: `${teacherSummary?.stats?.classCount || 0} classes`, icon: <BookOpen size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Assignments', value: String(teacherSummary?.stats?.assignmentCount || 0), change: `${teacherSummary?.stats?.pendingGrading || 0} to review`, icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Lesson Plans', value: String(teacherSummary?.stats?.lessonPlanCount || 0), change: 'Planner live', icon: <Clock size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Live Rooms', value: String(teacherSummary?.stats?.liveClassCount || 0), change: 'Connected', icon: <Video size={16} />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    ];

    if (isAdministration) return [
      { label: 'Total Collections', value: financeStats ? `₦${(financeStats.totalCollected / 1000000).toFixed(1)}M` : '...', change: financeStats ? `₦${(financeStats.outstanding / 1000000).toFixed(1)}M due` : '...', icon: <Wallet size={16} />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
      { label: 'Active Students', value: students?.length || '...', change: '+5% this term', icon: <TrendingUp size={16} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
      { label: 'Total Staff', value: teachers?.length || '...', change: 'Stable', icon: <Users size={16} />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' },
      { label: 'Active Subjects', value: teacherSummary?.stats?.subjectCount || genericSummary?.stats?.subjectCount || 0, change: `${teacherSummary?.stats?.classCount || 0} Classes`, icon: <BookOpen size={16} />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/10' },
    ];

    if (isParent) return [
      { label: 'Children', value: children?.length || 0, change: 'Active', icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Avg. Grade', value: 'B+', change: '+5%', icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Attendance', value: '98%', change: 'Good', icon: <Clock size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Fees Paid', value: '₦120k', change: '₦15k Bal', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
    ];

    if (isFrontDesk) return [
      { label: 'Check-ins Today', value: '184', change: '+12', icon: <Users size={16} />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
      { label: 'Active Inquiries', value: '12', change: '-3', icon: <AlertCircle size={16} />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/10' },
      { label: 'Announcements', value: '3', change: 'Live', icon: <Megaphone size={16} />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
      { label: 'Pending Approvals', value: '8', change: 'Urgent', icon: <Clock size={16} />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/10' },
    ];

    if (isFinance) return [
      { label: 'Total Collections', value: '₦12.5M', change: '+15%', icon: <Wallet size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Outstanding Balance', value: '₦2.1M', change: '-5%', icon: <AlertCircle size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Daily Inflow', value: '₦450k', change: '+2%', icon: <TrendingUp size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Pending Invoices', value: '34', change: '-12', icon: <Clock size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
    ];

    if (role === 'Librarian') return [
      { label: 'Total Books', value: '4,250', change: '+15', icon: <BookOpen size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Borrowed', value: '128', change: '+8', icon: <Clock size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Overdue', value: '12', change: '-2', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
      { label: 'Members', value: '850', change: '+5', icon: <Users size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    ];

    if (role === 'Tuckshop Manager') return [
      { label: 'Today Sales', value: '₦42k', change: '+12%', icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Orders', value: '128', change: '+15', icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Low Stock Items', value: '5', change: '-1', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
      { label: 'Inventory Value', value: '₦1.2M', change: 'Stable', icon: <Wallet size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    ];

    if (role === 'Transport Manager') return [
      { label: 'Active Trips', value: '14', change: 'On Time', icon: <Clock size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Fleet Status', value: 'Good', change: '95%', icon: <TrendingUp size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Routes Delayed', value: '1', change: 'Minor', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
      { label: 'Total Passengers', value: '342', change: '+12', icon: <Users size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    ];

    if (['Clinic Officer'].includes(role)) return [
      { label: 'Visits Today', value: '18', change: '+3', icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Active Cases', value: '5', change: '-1', icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Critical', value: '0', change: 'Stable', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
      { label: 'Supplies Health', value: 'Good', change: '92%', icon: <RefreshCw size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    ];

    if (isOperations) return [
      { label: 'Active Tasks', value: '24', change: '+3', icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Pending Requests', value: '12', change: '-2', icon: <Clock size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Issues Reported', value: '5', change: 'Stable', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
      { label: 'Training Left', value: String(genericSummary?.stats?.pendingTraining || 0), change: 'Compliance', icon: <RefreshCw size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    ];

    return [
      { label: 'Total Students', value: students?.length || '...', change: '+12%', icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Avg. Attendance', value: '94%', change: '+2%', icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Active Staff', value: teachers?.length || '...', change: '0%', icon: <Clock size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Pending Fees', value: financeStats ? `₦${(financeStats.outstanding / 1000000).toFixed(1)}M` : '...', change: '-5%', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
    ];
  };

  const stats = getStats();

  if (isStudent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome back, {currentUser?.name || 'Student'}
            </h1>
            <p className="text-zinc-500 text-sm">
              Your dashboard now follows the reference brief: assignment countdown, exam window, recent scores, attendance, notifications, farming rewards, and quick access.
            </p>
          </div>
          <div className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Term 2, Week 6
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-6">
          <div className="card-compact bg-linear-to-br from-emerald-600/10 via-white/2 to-transparent border-emerald-500/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500 mb-3">Student Intelligence Screen</p>
            <h3 className="text-2xl font-bold text-white mb-2">{studentDashboardFeed.upcomingAssignment.title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">{studentAssignments[0]?.title ? `${studentAssignments[0].title} is the next active assignment from your live backend queue.` : studentDashboardFeed.upcomingAssignment.note}</p>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card-mini">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Assignment Countdown</p>
                <p className="text-xl font-bold text-orange-400 mt-2">{studentAssignments[0]?.due || studentDashboardFeed.upcomingAssignment.countdown}</p>
              </div>
              <div className="card-mini">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Next Exam</p>
                <p className="text-xl font-bold text-blue-400 mt-2">{studentSummary?.stats?.latestAverage || studentDashboardFeed.nextExam.countdown}</p>
              </div>
              <div className="card-mini">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Attendance</p>
                <p className="text-xl font-bold text-emerald-400 mt-2">96%</p>
              </div>
              <div className="card-mini">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Farming Rewards</p>
                <p className="text-xl font-bold text-purple-400 mt-2">{studentSummary?.stats?.submittedAssignments || studentDashboardFeed.farmingEarnings.value}</p>
              </div>
            </div>
          </div>

          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Quick access</h3>
            <div className="grid grid-cols-2 gap-3">
              {studentDashboardFeed.quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => setActiveTab?.(action.id)}
                  className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/20 text-left transition-all"
                >
                  <p className="text-xs font-bold text-white">{action.label}</p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">Open</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Classroom intelligence moved here</h3>
                <button onClick={() => setActiveTab?.('classroom')} className="text-[10px] font-bold text-emerald-500 hover:underline">Open Classroom</button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {classroomDashboardMoments.map((moment) => (
                  <div key={moment.id} className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">{moment.tag}</p>
                    <h4 className="mt-2 text-sm font-bold text-white">{moment.title}</h4>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{moment.detail}</p>
                    <button onClick={() => setActiveTab?.('classroom')} className="mt-4 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:text-emerald-400">
                      {moment.action}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent scores</h3>
                <button onClick={() => setActiveTab?.('results')} className="text-[10px] font-bold text-emerald-500 hover:underline">Open Results</button>
              </div>
              <div className="space-y-3">
                {(studentAssignments.length ? studentAssignments : studentDashboardFeed.recentScores).map((score: any) => (
                  <div key={score.title} className="flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white">{score.title}</p>
                      <p className="text-[10px] font-bold uppercase text-zinc-500">{score.subject || score.status || 'Active item'}</p>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-400">{score.score || score.due || 'Open'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Notifications</h3>
                <button onClick={() => setActiveTab?.('notifications')} className="text-[10px] font-bold text-emerald-500 hover:underline">View all</button>
              </div>
              <div className="space-y-3">
                {(dashboardAnnouncements.length ? dashboardAnnouncements : studentDashboardFeed.notifications).map((note: any) => (
                  <div key={typeof note === 'string' ? note : note.id || note.title} className="p-3 rounded-xl bg-white/2 border border-white/5 text-xs text-zinc-300 leading-relaxed">
                    {typeof note === 'string' ? note : `${note.title}${note.detail ? ` • ${note.detail}` : ''}`}
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Study access panel</h3>
                <button onClick={() => setActiveTab?.('classroom')} className="text-[10px] font-bold text-emerald-500 hover:underline">Jump in</button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <button onClick={() => setActiveTab?.('classroom')} className="rounded-2xl border border-white/5 bg-white/3 p-4 text-left transition-all hover:border-emerald-500/30">
                  <BookOpen size={16} className="text-blue-400" />
                  <p className="mt-3 text-sm font-bold text-white">Lesson notes</p>
                  <p className="mt-1 text-xs text-zinc-400">Read secure notes with version tracking and AI summaries.</p>
                </button>
                <button onClick={() => setActiveTab?.('classroom')} className="rounded-2xl border border-white/5 bg-white/3 p-4 text-left transition-all hover:border-emerald-500/30">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <p className="mt-3 text-sm font-bold text-white">Practice loops</p>
                  <p className="mt-1 text-xs text-zinc-400">Open adaptive drills tied to your weak areas and Aura rewards.</p>
                </button>
                <button onClick={() => setActiveTab?.('classroom')} className="rounded-2xl border border-white/5 bg-white/3 p-4 text-left transition-all hover:border-emerald-500/30">
                  <Video size={16} className="text-violet-400" />
                  <p className="mt-3 text-sm font-bold text-white">Live class</p>
                  <p className="mt-1 text-xs text-zinc-400">Join the next session with raise-hand, chat, and replay tools.</p>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Upcoming exam</h3>
              <p className="text-lg font-bold text-white">{studentAssignments[0]?.title || studentDashboardFeed.nextExam.title}</p>
              <p className="text-xs text-zinc-400 mt-2">Assignments, live classes, and result summaries now come from the backend summary feed.</p>
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Window</p>
                <p className="text-sm font-bold text-blue-400 mt-1">{studentAssignments[0]?.due || studentDashboardFeed.nextExam.window}</p>
              </div>
            </div>

            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Next live class</h3>
              <p className="text-lg font-bold text-white">{nextLiveClass.title}</p>
              <p className="text-xs text-zinc-400 mt-2">{nextLiveClass.schedule} • {nextLiveClass.attendees}/{nextLiveClass.limit} joined</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {nextLiveClass.tools.slice(0, 4).map((tool) => (
                  <span key={tool} className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {tool}
                  </span>
                ))}
              </div>
              <button onClick={() => setActiveTab?.('classroom')} className="mt-4 w-full rounded-xl bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-emerald-600">
                Open Live Class
              </button>
            </div>

            {studentDashboardFeed.farmingEarnings.enabled && (
              <div className="card-compact bg-emerald-600/5 border-emerald-500/10">
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">Farming Mode Rewards</h3>
                <p className="text-2xl font-bold text-white">{studentSummary?.stats?.submittedAssignments || studentDashboardFeed.farmingEarnings.value}</p>
                <p className="text-xs text-zinc-400 mt-2">Assignments submitted successfully in your current backend record.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isTeacher) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome back, {currentUser?.name || 'Instructor'}
            </h1>
            <p className="text-zinc-500 text-sm">
              Your teaching command center. View upcoming classes, pending grading, and classroom analytics perfectly tailored for your everyday workflows.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Term 2, Week 6
            </div>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="card-mini flex items-center gap-3">
              <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-mono font-bold text-white">{stat.value}</span>
                  <span className={`text-[8px] font-bold ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6 mt-6">
          <div className="space-y-6">
            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Action Items</h3>
                <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full">{teacherAssignments.length || teacherDashboardFeed.actionItems.length} Pending</span>
              </div>
              <div className="space-y-3">
                {(teacherAssignments.length ? teacherAssignments : teacherDashboardFeed.actionItems).map((item: any, i: number) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/20 transition-all gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                      <p className="text-xs text-zinc-400 mt-1">{item.course || `${item.subject || 'Subject'} • ${item.className || 'Classroom'}`}</p>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
                      <span className="text-[10px] text-zinc-500">{item.deadline || item.due || `${item.submitted || 0}/${item.submissions || 0} submitted`}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                        item.priority === 'High' || Number(item.submissions || 0) === 0 ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 
                        item.priority === 'Medium' || Number(item.submitted || 0) < Number(item.submissions || 0) ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20' : 
                        'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                      }`}>
                        {item.priority || (Number(item.submissions || 0) === 0 ? 'High' : Number(item.submitted || 0) < Number(item.submissions || 0) ? 'Medium' : 'Tracked')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {teacherDashboardFeed.quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => setActiveTab?.(action.id)}
                  className="card-mini hover:bg-white/10 transition-colors flex flex-col justify-center items-center text-center p-6 border-white/5 disabled:opacity-50"
                >
                  <p className="text-sm font-bold text-white">{action.label}</p>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-500 mt-2 font-bold">Launch</p>
                </button>
              ))}
            </div>

            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent Submissions</h3>
                <button onClick={() => setActiveTab?.('assignments')} className="text-[10px] font-bold text-emerald-500 hover:underline">View All</button>
              </div>
              <div className="space-y-2">
                {(teacherAssignments.length ? teacherAssignments : teacherDashboardFeed.recentSubmissions).map((sub: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/2 hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-bold">
                        {(sub.student || sub.subject || 'CL').split(' ').map((n: string)=>n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{sub.student || sub.title}</p>
                        <p className="text-[10px] text-zinc-500">{sub.assignment || `${sub.subject || 'Subject'} • ${sub.className || 'Classroom'}`}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-mono font-bold text-emerald-400">{sub.score || `${sub.submitted || 0}/${sub.submissions || 0}`}</span>
                      <span className="text-[9px] text-zinc-600 mt-1">{sub.time || sub.due || 'Backend tracked'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-compact bg-linear-to-b from-blue-900/10 to-transparent border-blue-500/10">
              <div className="flex items-center gap-2 mb-4">
                <Video size={16} className="text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">Today's Schedule</h3>
              </div>
                <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-2.75 before:w-px before:bg-white/10">
                {((teacherSummary?.liveClasses?.length ? teacherSummary.liveClasses : teacherDashboardFeed.upcomingClasses) || []).map((cls: any, i: number) => (
                  <div key={cls.id} className="relative flex gap-4 pl-6">
                      <div className="absolute left-0 top-1.5 w-5.75 h-5.75 rounded-full bg-[#0a0a0a] border-2 border-blue-500 flex items-center justify-center -mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                    <div className="flex-1 bg-white/5 border border-white/5 rounded-xl p-3 hover:border-blue-500/30 transition-all cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded">{cls.time || cls.schedule}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{cls.type || cls.mode}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{cls.subject || cls.title}</h4>
                      <p className="text-[11px] text-zinc-400 mt-1">{cls.topic || `${cls.attendees || 0}/${cls.limit || 300} joined`} • {cls.class || 'Live room'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Class Analytics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5">
                    <span className="text-zinc-500">Average Attendance</span>
                    <span className="text-emerald-400">{teacherSummary?.stats?.subjectCount ? Math.min(100, 70 + teacherSummary.stats.subjectCount * 5) : teacherDashboardFeed.analytics.averageAttendance}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${teacherSummary?.stats?.subjectCount ? Math.min(100, 70 + teacherSummary.stats.subjectCount * 5) : teacherDashboardFeed.analytics.averageAttendance}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5">
                    <span className="text-zinc-500">Assignment Completion</span>
                    <span className="text-blue-400">{teacherSummary?.stats?.assignmentCount ? Math.min(100, 50 + teacherSummary.stats.assignmentCount * 8) : teacherDashboardFeed.analytics.completionRate}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${teacherSummary?.stats?.assignmentCount ? Math.min(100, 50 + teacherSummary.stats.assignmentCount * 8) : teacherDashboardFeed.analytics.completionRate}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5">
                    <span className="text-zinc-500">Avg. Performance Grade</span>
                    <span className="text-orange-400">{teacherSubjects.length ? Math.min(100, 60 + teacherSubjects.length * 6) : teacherDashboardFeed.analytics.classPerformanceAvg}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: `${teacherSubjects.length ? Math.min(100, 60 + teacherSubjects.length * 6) : teacherDashboardFeed.analytics.classPerformanceAvg}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isParent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome back, {currentUser?.name || 'Parent/Guardian'}
            </h1>
            <p className="text-zinc-500 text-sm">
              Your comprehensive view of your children's progression, attendance, recent alerts, and school announcements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Term 2, Week 6
            </div>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="card-mini flex items-center gap-3">
              <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-mono font-bold text-white">{stat.value}</span>
                  <span className={`text-[8px] font-bold ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Children In Focus</h3>
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">{parentDashboardFeed.children.length} Active</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parentDashboardFeed.children.map((child) => (
                  <div key={child.id} onClick={() => window.dispatchEvent(new CustomEvent('child-selected', { detail: child.id }))} className="p-4 bg-white/2 rounded-2xl border border-white/5 hover:border-emerald-500 transition-all flex flex-col h-full cursor-pointer hover:bg-white/5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-linear-to-tr from-emerald-500 to-blue-500 text-white flex items-center justify-center font-bold text-sm shadow-lg">
                          {child.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{child.name}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase">{child.grade}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">GPA</p>
                        <p className="text-lg font-mono font-bold text-emerald-400">{child.gpa}</p>
                      </div>
                    </div>

                    <div className="bg-[#0a0a0a] rounded-xl p-3 border border-white/5 mb-4 grow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Live Status</span>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1.5 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          {child.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-white/5">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">Attendance</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${child.attendance}%` }} />
                          </div>
                          <span className="text-[10px] text-white font-bold">{child.attendance}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {child.alerts.map((alert, idx) => (
                        <div key={idx} className={`p-2 text-[10px] flex items-center gap-2 rounded-lg border leading-tight ${
                          alert.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                          alert.type === 'warning' ? 'bg-orange-500/10 text-orange-300 border-orange-500/20' :
                          'bg-blue-500/10 text-blue-300 border-blue-500/20'
                        }`}>
                          {alert.type === 'success' ? <TrendingUp size={12} /> : alert.type === 'warning' ? <AlertCircle size={12} /> : <Users size={12} />}
                          {alert.message}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact">
              <div className="flex items-center justify-between px-1 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">School Announcements</h3>
                <button onClick={() => setActiveTab?.('notices')} className="text-[10px] font-bold text-emerald-500 hover:underline">View All</button>
              </div>
              <div className="grid gap-3">
                {parentDashboardFeed.announcements.map((ann) => (
                  <div key={ann.id} className="group flex items-center gap-4 bg-white/2 hover:bg-white/5 border border-white/5 p-3 rounded-xl cursor-pointer transition-all">
                    <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                      <Megaphone size={16} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{ann.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-zinc-400">{ann.date}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 bg-white/5 px-2 py-0.5 rounded">{ann.type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-compact bg-linear-to-b from-orange-500/10 to-transparent border-orange-500/20">
              <div className="flex items-center gap-2 mb-4">
                <Wallet size={16} className="text-orange-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-orange-400">Financial Summary</h3>
              </div>
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Outstanding Balance</p>
                <h4 className="text-3xl font-bold text-white">{parentDashboardFeed.financialSummary.outstanding}</h4>
                <p className="text-xs text-orange-400 mt-1">Next due: {parentDashboardFeed.financialSummary.nextDue}</p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Total Paid (Term 2)</span>
                  <span className="font-bold text-emerald-400">{parentDashboardFeed.financialSummary.totalPaid}</span>
                </div>
              </div>
              <button className="mt-6 w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-orange-900/20">
                Process Payment
              </button>
            </div>

            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Quick Links</h3>
              <div className="grid grid-cols-2 gap-3">
                {parentDashboardFeed.quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => setActiveTab?.(action.id)}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/30 text-left transition-all group"
                  >
                    <p className="text-xs font-bold text-white group-hover:text-emerald-400">{action.label}</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 mt-2">Open →</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isFrontDesk) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Front Desk Command Center
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm">
              Manage communications, attendance, records, and access from your central dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider">
              Term 2, Week 6
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20">
              <RefreshCw size={14} /> Refetch
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="card-mini flex items-center gap-3">
              <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-mono font-bold text-slate-900 dark:text-white">{stat.value}</span>
                  <span className={`text-[8px] font-bold ${stat.change === 'Urgent' || stat.change.startsWith('-') ? 'text-red-500' : 'text-emerald-500'}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Main Area */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Digital First Point of Contact / Comm Management */}
              <div className="card-compact border-t-2 border-t-emerald-500">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Megaphone size={16} className="text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Communications</h3>
                  </div>
                  <button onClick={() => setActiveTab && setActiveTab('communication')} className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded hover:bg-emerald-500/20">New Broadcast</button>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5 hover:border-emerald-500/30 transition-all text-sm">
                    <p className="font-bold text-slate-900 dark:text-white">General Assembly Announcement</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Target: All Parents & Students • Sent 2h ago</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5 hover:border-emerald-500/30 transition-all text-sm">
                    <p className="font-bold text-slate-900 dark:text-white">Urgent: Weather delay notice</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Target: Staff • Sent 4h ago</p>
                  </div>
                  <button onClick={() => setActiveTab && setActiveTab('communication')} className="w-full text-center text-xs text-emerald-500 hover:text-emerald-600 font-medium py-2 transition-colors">View Communication Details</button>
                </div>
              </div>

              {/* Student Activity Handling */}
              <div className="card-compact border-t-2 border-t-blue-500">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-blue-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Activity & Attendance</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Late Arrivals Logs</span>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">12 students logged</span>
                    </div>
                    <button className="text-[10px] font-bold text-blue-500 border border-blue-500/30 px-2 py-1 rounded">View</button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Early Dismissals</span>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400">3 students pending pickup</span>
                    </div>
                    <button className="text-[10px] font-bold text-blue-500 border border-blue-500/30 px-2 py-1 rounded">Process</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Operations Hub Quick Links */}
            <div className="card-compact mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-4">Operations Hub</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button onClick={() => setActiveTab?.('finance')} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-emerald-500/30 text-left transition-all group">
                  <p className="text-xs font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-500">Finance</p>
                  <p className="text-[9px] text-slate-500 dark:text-zinc-400">Fees & Payments</p>
                </button>
                <button onClick={() => setActiveTab?.('tuckshop')} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-orange-500/30 text-left transition-all group">
                  <p className="text-xs font-bold text-slate-900 dark:text-white mb-1 group-hover:text-orange-500">Tuckshop</p>
                  <p className="text-[9px] text-slate-500 dark:text-zinc-400">Inventory & Sales</p>
                </button>
                <button onClick={() => setActiveTab?.('hostel')} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 text-left transition-all group">
                  <p className="text-xs font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-500">Hostel</p>
                  <p className="text-[9px] text-slate-500 dark:text-zinc-400">Rooms & Boarding</p>
                </button>
                <button onClick={() => setActiveTab?.('clinic')} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-red-500/30 text-left transition-all group">
                  <p className="text-xs font-bold text-slate-900 dark:text-white mb-1 group-hover:text-red-500">Clinic</p>
                  <p className="text-[9px] text-slate-500 dark:text-zinc-400">Health Records</p>
                </button>
              </div>
            </div>

            {/* Workflow & Quick Links */}
            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-4">Workflow Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { title: "Inbox", desc: "Manage emails & queries", icon: <Megaphone />, color: 'blue' },
                  { title: "Broadcast", desc: "Send school wide alerts", icon: <AlertCircle />, color: 'emerald' },
                  { title: "Records", desc: "Update student details", icon: <BookOpen />, color: 'purple' },
                  { title: "Clearance", desc: "Approve visitor logs", icon: <Clock />, color: 'orange' },
                ].map((item, i) => (
                  <button key={i} className={`p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-${item.color}-500/30 text-left transition-all group`}>
                    <div className={`p-2 rounded-lg bg-${item.color}-500/10 text-${item.color}-500 w-max mb-3`}>
                      {item.icon}
                    </div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-500">{item.title}</p>
                    <p className="text-[9px] text-slate-500 dark:text-zinc-400">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Sidebar: Access Control & Admin Support */}
          <div className="space-y-6">
            <div className="card-compact bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/10">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-red-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Access Control & Approvals</h3>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-white dark:bg-black/20 rounded-lg shadow-sm">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Mr. James Olu</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mb-2">Visitor Request • Appointment w/ Principal</p>
                  <div className="flex gap-2">
                    <button className="flex-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 py-1.5 rounded">Approve</button>
                    <button className="flex-1 text-[10px] font-bold text-red-500 bg-red-500/10 py-1.5 rounded">Deny</button>
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-black/20 rounded-lg shadow-sm">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Staff Credential Reset</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 mb-2">Role updates requested for 2 new joiners</p>
                  <button className="w-full text-[10px] font-bold text-blue-500 border border-blue-500/20 py-1.5 rounded hover:bg-blue-500/10">Review Request</button>
                </div>
              </div>
            </div>

            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-4">Admin Support & Scheduling</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 relative before:absolute before:left-3 before:top-6 before:bottom-0 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-zinc-400 z-10">10</div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Sort incoming mail & inquiries</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Assign emails to corresponding departments</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 relative before:absolute before:left-3 before:top-6 before:bottom-0 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-zinc-400 z-10">11</div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">HoS Calendar Review</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Confirm meetings for Principal</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-zinc-400 z-10">13</div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Facility Maintenance Logs</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">Update reports from janitorial staff</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAdministration) {
      return (
        <div className="space-y-6">
          <div className="mb-6"><ResultsTabs /></div>
          {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Welcome to the Command Center, {currentUser?.name || 'Head of School'}
            </h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm">
              Here is your immediate overview of academic, financial, and operational health.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider">
              Term 2, Week 6
            </div>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="card-mini flex items-center gap-3">
              <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-mono font-bold text-slate-900 dark:text-white">{stat.value}</span>
                  <span className={`text-[8px] font-bold ${stat.change.startsWith('+') || stat.change === 'Stable' || stat.change === '100%' ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr_1fr] gap-6 mt-6">
          {/* Quick Actions (Left sidebar) */}
          <div className="space-y-6">
            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-4">Command Actions</h3>
              <div className="grid gap-3">
                <button onClick={() => setActiveTab?.('approvals')} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-emerald-500/30 text-left transition-all">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-500"><TrendingUp size={16}/></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Authorise Results</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 mt-0.5">3 Pending</p>
                  </div>
                </button>
                <button onClick={() => setActiveTab?.('announcements')} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 text-left transition-all">
                  <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-500"><Megaphone size={16}/></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Broadcast Notice</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 mt-0.5">All Staff & Parents</p>
                  </div>
                </button>
                <button onClick={() => setActiveTab?.('staff')} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-purple-500/30 text-left transition-all">
                  <div className="p-2 bg-purple-100 dark:bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-500"><Users size={16}/></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Staff Management</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 mt-0.5">Review Leaves</p>
                  </div>
                </button>
                <button onClick={() => setActiveTab?.('duty-report')} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-orange-500/30 text-left transition-all">
                  <div className="p-2 bg-orange-100 dark:bg-orange-500/10 rounded-lg text-orange-600 dark:text-orange-500"><BookOpen size={16}/></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Academic Reports</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 mt-0.5">Generate / Export</p>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Health Snapshot */}
            <div className="card-compact bg-emerald-50 dark:bg-emerald-600/5 border-emerald-200 dark:border-emerald-500/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-500 mb-3">System Health</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-emerald-800 dark:text-emerald-400/80">Server Status</span>
                  <span className="text-emerald-600 dark:text-emerald-500 font-bold">OPTIMAL</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-emerald-800 dark:text-emerald-400/80">Database Sync</span>
                  <span className="text-emerald-600 dark:text-emerald-500 font-bold">ACTIVE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Central Feed / Performance */}
          <div className="space-y-6">
            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-4">Live Performance Overview</h3>
              <div className="space-y-5">
                {[
                  { label: 'Classes Created', value: teacherSummary?.stats?.classCount ? Math.min(100, teacherSummary.stats.classCount * 10) : 88, color: 'bg-emerald-500' },
                  { label: 'Financial Target (Term 2)', value: financeStats ? Math.min(100, Math.round((financeStats.totalCollected / Math.max(1, financeStats.totalCollected + financeStats.outstanding)) * 100)) : 75, color: 'bg-blue-500' },
                  { label: 'Student Engagement', value: students?.length ? Math.min(100, 70 + students.length * 2) : 92, color: 'bg-orange-500' },
                  { label: 'Subjects Active', value: teacherSummary?.stats?.subjectCount ? Math.min(100, teacherSummary.stats.subjectCount * 15) : 96, color: 'bg-purple-500' },
                ].map((metric, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-slate-600 dark:text-zinc-400">{metric.label}</span>
                      <span className="text-slate-900 dark:text-white font-mono">{metric.value ? metric.value + (i === 1 ? '%' : i === 0 || i === 3 ? ' / 100' : '%') : '0%'}</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${metric.color} transition-all duration-1000`} style={{ width: `${metric.value || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Critical Alerts & Approvals</h3>
                <button className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 hover:underline">See All</button>
              </div>
              <div className="space-y-3">
                {[
                  ...(teacherSummary?.stats?.pendingGrading ? [{ text: `${teacherSummary.stats.pendingGrading} assignments require your grading / approval`, time: 'Now', type: 'urgent' as const }] : []),
                  ...(financeStats && financeStats.outstanding > 1000000 ? [{ text: `High outstanding fee balance: ₦${financeStats.outstanding.toLocaleString()}`, time: 'Today', type: 'warning' as const }] : []),
                  ...((teacherSummary?.assignments || []).slice(0, 1).map((a) => ({ text: `Recent assignment: "${a.title}" (${a.className})`, time: 'Today', type: 'info' as const }))),
                  ...(liveClassData && liveClassData.length > 0 ? [{ text: `${liveClassData.length} scheduled live class(es) pending or active.`, time: 'Now', type: 'info' as const }] : []),
                  { text: 'Mr. Adebayo requests 2 days emergency leave.', time: '1 hr ago', type: 'pending' as const },
                  { text: 'End of month staff payroll review required.', time: '5 hrs ago', type: 'pending' as const },
                ].slice(0, 5).map((alert, i) => (
                  <div key={i} className="flex justify-between items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-emerald-200 dark:hover:border-white/10 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <AlertCircle
                        size={14}
                        className={
                          alert.type === 'urgent'
                            ? 'text-red-500'
                            : alert.type === 'warning'
                              ? 'text-amber-500'
                              : alert.type === 'info'
                                ? 'text-blue-500'
                                : 'text-orange-500'
                        }
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{alert.text}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 whitespace-nowrap">{alert.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Recent Announcements & Logs</h3>
                <button className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 hover:underline">View History</button>
              </div>
              <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2.5 before:w-px before:bg-slate-200 dark:before:bg-white/10">
                {((dashboardAnnouncements || []).length > 0
                  ? dashboardAnnouncements.slice(0, 3).map((item: any) => ({
                      time: new Date(item.created_at || item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      role: 'Admin Notice',
                      action: item.title,
                      detail: item.content || item.detail || 'Announcement published.',
                      success: true,
                    }))
                  : [
                      { time: '09:45 AM', role: 'System', action: 'System Backup Complete', detail: 'Automated termly data snapshot confirmed.', success: true },
                      { time: '08:30 AM', role: 'System', action: 'Data Check', detail: 'Verified active records.', success: true },
                    ]).map((log, i) => (
                  <div key={i} className="relative flex gap-4 pl-6">
                    <div className="absolute left-0 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-500 bg-slate-100 dark:bg-[#0a0a0a]">
                      <div className={`h-1.5 w-1.5 rounded-full ${log.success ? 'bg-emerald-500' : 'bg-slate-500 dark:bg-slate-400'}`} />
                    </div>
                    <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all hover:border-emerald-500/30 dark:border-white/5 dark:bg-white/5">
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200">{log.action}</span>
                        <span className="text-[9px] font-mono text-slate-500 dark:text-zinc-500 whitespace-nowrap">{log.time}</span>
                      </div>
                      <p className="mb-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{log.role}</p>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">{log.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Analytics/Events */}
          <div className="space-y-6">
            <div className="card-compact">
              <div className="flex items-center gap-2 mb-4">
                <Video size={16} className="text-violet-600 dark:text-violet-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Classrooms Airspace</h3>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{liveClassData?.length || 0} Scheduled Live Classes</p>
              <p className="text-[10px] text-slate-600 dark:text-zinc-400 mb-4">Monitoring {liveClassData?.reduce((acc, c) => acc + (c.attendees || 0), 0) || 0} student connections.</p>
            </div>

            <div className="card-compact">
              <div className="flex items-center gap-2 mb-4">
                <Cake size={16} className="text-pink-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Birthdays This Week</h3>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Chidi Okoro', role: 'Student (JSS 3)', img: 'CO' },
                  { name: 'Mrs. Adebayo', role: 'Teacher', img: 'MA' },
                  { name: 'Aisha Bello', role: 'Student (SS 1)', img: 'AB' },
                ].map((bday, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-white/5 flex items-center justify-center text-pink-600 dark:text-emerald-500 text-[10px] font-bold border border-pink-200 dark:border-white/5 shadow-sm">
                      {bday.img}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-200">{bday.name}</p>
                      <p className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase font-bold">{bday.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-compact">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">School Calendar</h3>
              </div>
              <div className="space-y-3">
                {[
                  { event: 'Inter-House Sports', date: 'Next Friday, 10:00 AM' },
                  { event: 'Mid-Term Break', date: 'In 2 Weeks' },
                  { event: 'Board of Governors Mtg', date: 'Oct 15, 2:00 PM' }
                ].map((ev, i) => (
                  <div key={i} className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">{ev.event}</p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">{ev.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, {currentUser?.name || role}
          </h1>
          <p className="text-zinc-500 text-sm">Here's what's happening at Ndovera Academy today.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Term 2, Week 6
          </div>
          <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="card-mini flex items-center gap-3">
            <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-mono font-bold text-white">{stat.value}</span>
                <span className={`text-[8px] font-bold ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stat.change}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Content */}
        <div className="lg:col-span-2 space-y-6">
          {isFinance && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-compact">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Pending Invoices</h3>
                <div className="space-y-3">
                  {[
                    { id: 'INV-2026-001', student: 'Sarah Johnson', amount: '₦45,000', status: 'Overdue' },
                    { id: 'INV-2026-002', student: 'Michael Obi', amount: '₦120,000', status: 'Pending' },
                  ].map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                      <div>
                        <p className="text-sm font-bold text-white">{inv.student}</p>
                        <p className="text-[10px] text-zinc-400">{inv.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-emerald-400">{inv.amount}</p>
                        <p className={`text-[9px] font-bold uppercase ${inv.status === 'Overdue' ? 'text-red-400' : 'text-orange-400'}`}>{inv.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-compact bg-orange-500/5 border-orange-500/10">
                <h3 className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button onClick={() => setActiveTab?.('finance')} className="w-full text-left p-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/20 transition-colors text-white text-sm font-bold">Generate Fee Invoices</button>
                  <button onClick={() => setActiveTab?.('finance')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Record Manual Payment</button>
                  <button onClick={() => setActiveTab?.('finance')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">View Financial Report</button>
                </div>
              </div>
            </div>
          )}

          {isOperations && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-compact bg-orange-500/5 border-orange-500/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button onClick={() => setActiveTab?.(role === 'Tuckshop Manager' ? 'tuckshop' : role === 'Hostel Manager' ? 'hostel' : role === 'Librarian' ? 'library' : 'clinic')} className="w-full text-left p-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/20 transition-colors text-white text-sm font-bold">Open Operations Workspace</button>
                <button onClick={() => setActiveTab?.(role === 'Tuckshop Manager' ? 'tuckshop' : role === 'Hostel Manager' ? 'hostel' : role === 'Librarian' ? 'library' : 'clinic')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Manage Inventory & Logs</button>
              </div>
            </div>
            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Recent Operations Log</h3>
              <div className="space-y-3">
                {[
                  { time: '10:42 AM', action: 'System Request', detail: 'New resources allocated for Term 2', status: 'Completed' },
                  { time: '09:15 AM', action: 'Inventory Alert', detail: 'Stock running low in requested area', status: 'Warning' },
                  { time: '08:30 AM', action: 'Daily Sync', detail: 'Morning routine check finalized', status: 'Completed' },
                ].map((log, i) => (
                  <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                    <div>
                      <span className="text-[10px] text-zinc-500">{log.time}</span>
                      <p className="text-sm font-bold text-white mt-0.5">{log.action}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">{log.detail}</p>
                      <p className={`text-[9px] font-bold uppercase mt-1 ${log.status === 'Warning' ? 'text-orange-400' : 'text-emerald-400'}`}>{log.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent Announcements</h3>
            <button className="text-[10px] font-bold text-emerald-500 hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {announcements?.slice(0, 3).map((ann, i) => (
              <div key={i} className="card-compact group cursor-pointer">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <Megaphone size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-zinc-200">{ann.title}</h4>
                      <span className="text-[9px] font-mono text-zinc-600">
                        {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                </div>
              </div>
            )) || <div className="text-center py-8 text-zinc-600">Loading announcements...</div>}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Birthdays */}
          <div className="card-compact">
            <div className="flex items-center gap-2 mb-4">
              <Cake size={16} className="text-pink-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Birthdays Today</h3>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Chidi Okoro', role: 'Student (JSS3)', img: 'CO' },
                { name: 'Mrs. Adebayo', role: 'Teacher', img: 'MA' },
              ].map((bday, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-emerald-500 text-[10px] font-bold border border-white/5">
                    {bday.img}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-200">{bday.name}</p>
                    <p className="text-[9px] text-zinc-500 uppercase font-bold">{bday.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card-compact bg-emerald-600/5 border-emerald-500/10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">System Health</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500">Server Status</span>
                <span className="text-emerald-500 font-bold">OPTIMAL</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500">Database Sync</span>
                <span className="text-emerald-500 font-bold">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
