const fs = require('fs');

let content = fs.readFileSync('packages/web/src/App.tsx', 'utf8');

// 1. Change default tab for Parent
content = content.replace(
  `const getDefaultTabForRole = (role: Role) => role === 'Student' || role === 'Parent' ? 'classroom' : role === 'Growth Partner' ? 'growth' : 'dashboard';`,
  `const getDefaultTabForRole = (role: Role) => role === 'Student' ? 'classroom' : role === 'Parent' ? 'dashboard' : role === 'Growth Partner' ? 'growth' : 'dashboard';`
);

// 2. Stop Parent from redirecting out of dashboard
content = content.replace(
  `if (currentRole === 'Student' || currentRole === 'Parent') {`,
  `if (currentRole === 'Student') {`
);

// 3. Add activeChild state and floating button
// We need to inject at the top of App()
content = content.replace(
  `export default function App() {`,
  `export default function App() {\n  const [activeChildId, setActiveChildId] = useState<string | null>(() => localStorage.getItem('activeChildId') || null);\n  useEffect(() => {\n    const handleChildSelected = (e: any) => {\n      setActiveChildId(e.detail);\n      localStorage.setItem('activeChildId', e.detail);\n      window.location.href = '/classroom';\n    };\n    window.addEventListener('child-selected', handleChildSelected);\n    return () => window.removeEventListener('child-selected', handleChildSelected);\n  }, []);`
);

// The render should include the floating button
content = content.replace(
  `      <Layout\n        currentRole={currentRole}`,
  `      {currentRole === 'Parent' && activeChildId && (\n        <button\n          onClick={() => {\n            setActiveChildId(null);\n            localStorage.removeItem('activeChildId');\n            window.location.href = '/dashboard';\n          }}\n          className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white rounded-full p-4 shadow-xl flex items-center justify-center hover:bg-emerald-500 transition-all"\n        >\n          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"> <path d="m12 19-7-7 7-7"/> <path d="M19 12H5"/> </svg>\n          <span className="ml-2 font-bold whitespace-nowrap">Back to Wards</span>\n        </button>\n      )}\n      <Layout\n        currentRole={currentRole}`
);

fs.writeFileSync('packages/web/src/App.tsx', content);
console.log('App patched');

let dashboard = fs.readFileSync('packages/web/src/pages/Dashboard.tsx', 'utf8');

// Add onClick to children cards
dashboard = dashboard.replace(
  `                  <div key={child.id} className="p-4 bg-white/2 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all flex flex-col h-full">`,
  `                  <div key={child.id} onClick={() => window.dispatchEvent(new CustomEvent('child-selected', { detail: child.id }))} className="p-4 bg-white/2 rounded-2xl border border-white/5 hover:border-emerald-500 transition-all flex flex-col h-full cursor-pointer hover:bg-white/5">`
);

fs.writeFileSync('packages/web/src/pages/Dashboard.tsx', dashboard);
console.log('Dashboard patched');
