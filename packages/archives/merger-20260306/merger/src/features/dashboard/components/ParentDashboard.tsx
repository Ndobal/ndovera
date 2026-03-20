import React, { useRef, useState } from 'react';
import {
	BarChart2, BookOpen, FileText, Book, User, ShoppingCart, Sparkles, MessageSquare, Settings, QrCode, Bell, Layers, Activity
} from 'lucide-react';

interface SidebarSection {
	key: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

const sidebarSections: SidebarSection[] = [
	{ key: 'dashboard', label: 'Dashboard', icon: BarChart2 },
	{ key: 'classroom', label: 'Classroom', icon: BookOpen },
	{ key: 'exams', label: 'Exams', icon: FileText },
	{ key: 'results', label: 'Results', icon: Layers },
	{ key: 'attendance', label: 'Attendance', icon: User },
	{ key: 'library', label: 'Library', icon: Book },
	{ key: 'tuckshop', label: 'Tuck Shop', icon: ShoppingCart },
	{ key: 'professor-aura', label: 'Professor Aura', icon: Sparkles },
	{ key: 'messaging', label: 'Messaging', icon: MessageSquare },
	{ key: 'settings', label: 'Settings', icon: Settings },
];

const sectionTitles: Record<string, string> = {
	dashboard: 'Dashboard Overview',
	classroom: 'Classroom',
	exams: 'Exams',
	results: 'Results',
	attendance: 'Attendance',
	library: 'Library',
	tuckshop: 'Tuck Shop',
	'professor-aura': 'Professor Aura',
	messaging: 'Messaging',
	settings: 'Settings',
};

export default function ParentDashboard() {
	const [isDarkMode, setIsDarkMode] = useState(true);
	const [activeSection, setActiveSection] = useState('dashboard');
	const sectionRefs = {
		dashboard: useRef<HTMLDivElement>(null),
		classroom: useRef<HTMLDivElement>(null),
		exams: useRef<HTMLDivElement>(null),
		results: useRef<HTMLDivElement>(null),
		attendance: useRef<HTMLDivElement>(null),
		library: useRef<HTMLDivElement>(null),
		tuckshop: useRef<HTMLDivElement>(null),
		'professor-aura': useRef<HTMLDivElement>(null),
		messaging: useRef<HTMLDivElement>(null),
		settings: useRef<HTMLDivElement>(null),
	};

	const handleSidebarClick = (key: string) => {
		setActiveSection(key);
		const ref = sectionRefs[key];
		if (ref && ref.current) {
			ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	};

	return (
		<div className={isDarkMode ? 'dark flex h-screen bg-gradient-to-br from-slate-900/80 to-slate-800/90' : 'flex h-screen bg-gradient-to-br from-white to-slate-100'}>
			{/* Sidebar */}
			<aside className="w-64 h-full overflow-y-auto glass-card dark:glass-card p-6 flex flex-col gap-4 fixed left-0 top-0 bottom-0 z-20 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
				<div className="mb-8">
					<h1 className="text-2xl font-extrabold text-emerald-500 tracking-tight">Ndovera</h1>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Parent Dashboard</p>
				</div>
				<nav className="flex-1 flex flex-col gap-1">
					{sidebarSections.map(({ key, label, icon: Icon }) => (
						<button
							key={key}
							className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === key ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10'}`}
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
			<main className="flex-1 ml-64 h-full overflow-y-auto p-10 space-y-16">
				{/* Section blocks */}
				{sidebarSections.map(({ key }) => (
					<section
						key={key}
						ref={sectionRefs[key]}
						className="scroll-mt-24"
					>
						<div className="mb-6 flex items-center gap-3">
							{React.createElement(sidebarSections.find(s => s.key === key)!.icon, { className: 'w-6 h-6 text-emerald-500' })}
							<h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{sectionTitles[key]}</h2>
						</div>
						<div className="rounded-2xl glass-card dark:glass-card p-8 border border-slate-200 dark:border-slate-800 shadow-lg">
							{/* Section content placeholder */}
							<p className="text-slate-600 dark:text-slate-300 text-base">
								{key === 'dashboard' && 'Welcome to your Parent Dashboard. See a summary of your children’s progress, notifications, and quick actions.'}
								{key === 'classroom' && 'Access assignments, lesson notes, and practice tools for your child.'}
								{key === 'exams' && 'View upcoming exams, schedules, and exam history.'}
								{key === 'results' && 'See academic results, analytics, and progression graphs.'}
								{key === 'attendance' && 'Track daily attendance, late markers, and absence reasons.'}
								{key === 'library' && 'Browse the school and global library. Download encrypted materials.'}
								{key === 'tuckshop' && 'Monitor tuck shop transactions and spending history.'}
								{key === 'professor-aura' && 'Use Professor Aura, the AI-powered learning companion.'}
								{key === 'messaging' && 'Message teachers, admins, or support. All messages are logged and secure.'}
								{key === 'settings' && 'Manage your account, preferences, and security settings.'}
							</p>
						</div>
					</section>
				))}
			</main>
		</div>
	);
}
