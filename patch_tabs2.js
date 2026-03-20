const fs = require('fs');
let detail = fs.readFileSync('packages/web/src/features/classroom/subject/components/SubjectDetail.tsx', 'utf8');

detail = detail.replace(
  `    ...(canSeeLive ? [{ id: 'live' as TabType, label: 'Live', icon: <Video className="w-3 h-3" />, count: subject.unreadCounts?.live }] : []),\n  ];`,
  `    ...(canSeeLive ? [{ id: 'live' as TabType, label: 'Live', icon: <Video className="w-3 h-3" />, count: subject.unreadCounts?.live }] : []),\n  ];\n\n  const isParent = role === 'parent' || role === 'Parent';\n  const tabs = isParent ? allTabs.filter(t => t.id !== 'stream') : allTabs;`
);

fs.writeFileSync('packages/web/src/features/classroom/subject/components/SubjectDetail.tsx', detail);
console.log('done 2');
