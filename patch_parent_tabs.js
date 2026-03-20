const fs = require('fs');

let content = fs.readFileSync('packages/web/src/pages/Academics.tsx', 'utf8');
content = content.replace(
  `const getDefaultTab = (role: Role): ClassroomTab => {`,
  `const getDefaultTab = (role: Role): ClassroomTab => {\n  if (role === 'Parent' || role === 'parent') return 'subjects';`
);
content = content.replace(
  `const studentTabs = [\n    { id: 'stream', label: 'Stream', icon: <Sparkles size={14} /> },\n    { id: 'subjects', label: 'Subjects', icon: <BookOpen size={14} /> },\n    { id: 'assignments', label: 'Assignments', icon: <FileText size={14} /> },\n    { id: 'lesson-notes', label: 'Materials', icon: <BookOpen size={14} /> },\n    { id: 'practice', label: 'Practice', icon: <Sparkles size={14} /> },\n    { id: 'results', label: 'Results', icon: <Trophy size={14} /> },\n  ] as const;`,
  `const allStudentTabs = [\n    { id: 'stream', label: 'Stream', icon: <Sparkles size={14} /> },\n    { id: 'subjects', label: 'Subjects', icon: <BookOpen size={14} /> },\n    { id: 'assignments', label: 'Assignments', icon: <FileText size={14} /> },\n    { id: 'lesson-notes', label: 'Materials', icon: <BookOpen size={14} /> },\n    { id: 'practice', label: 'Practice', icon: <Sparkles size={14} /> },\n    { id: 'results', label: 'Results', icon: <Trophy size={14} /> },\n  ] as const;\n  const studentTabs = isParent ? allStudentTabs.filter(t => t.id !== 'stream' && t.id !== 'practice') : allStudentTabs;`
);
fs.writeFileSync('packages/web/src/pages/Academics.tsx', content);

let detail = fs.readFileSync('packages/web/src/features/classroom/subject/components/SubjectDetail.tsx', 'utf8');
detail = detail.replace(
  `const [activeTab, setActiveTab] = useState<TabType>('stream');`,
  `const [activeTab, setActiveTab] = useState<TabType>(role === 'parent' || role === 'Parent' ? 'curriculum' : 'stream');`
);
detail = detail.replace(
  `const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [`,
  `const allTabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [`
);
detail = detail.replace(
  `    ...(canSeeLive ? [{ id: 'live' as TabType, label: 'Live', icon: <Video className="w-3 h-3" /> }] : [])\n  ];`,
  `    ...(canSeeLive ? [{ id: 'live' as TabType, label: 'Live', icon: <Video className="w-3 h-3" /> }] : [])\n  ];\n  const isParent = role === 'parent' || role === 'Parent';\n  const tabs = isParent ? allTabs.filter(t => t.id !== 'stream') : allTabs;`
);
fs.writeFileSync('packages/web/src/features/classroom/subject/components/SubjectDetail.tsx', detail);

console.log('done');
