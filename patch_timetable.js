const fs = require('fs');

let c = fs.readFileSync('packages/web/src/features/classroom/components/TimetableStudio.tsx', 'utf8');

c = c.replace(
  "import { Printer, Sparkles, AlertTriangle, ShieldCheck, Settings, BookOpen, Clock, User, RefreshCw, Wrench, Plus, Trash2 } from 'lucide-react';",
  "import { Printer, Sparkles, AlertTriangle, ShieldCheck, Settings, BookOpen, Clock, User, RefreshCw, Wrench, Plus, Trash2, Lock, Unlock } from 'lucide-react';"
);

c = c.replace(
  "const [clashCount, setClashCount] = useState(0);",
  "const [clashCount, setClashCount] = useState(0);\n  const [isLocked, setIsLocked] = useState(false);"
);

// We need to inject the Lock/Unlock button and disable generation when locked.
// The button area looks like this:
const searchString = `                  <button
                    onClick={() => autoGenerateTimetable(1500)}
                    disabled={isGenerating}`;

const replacementString = `                  {role === 'HOS' && (
                    <button
                      onClick={() => setIsLocked(!isLocked)}
                      className={\`inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold text-white shadow-sm \${isLocked ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}\`}
                    >
                      {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      {isLocked ? 'Locked' : 'Lock Timetable'}
                    </button>
                  )}

                  <button
                    onClick={() => autoGenerateTimetable(1500)}
                    disabled={isGenerating || isLocked}`;

c = c.replace(searchString, replacementString);

// also for autofix clashes button: disabled={isGenerating || isLocked}
c = c.replace(
  "onClick={() => autoGenerateTimetable(1500)}\n                      disabled={isGenerating}\n                      className=\"inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50\"",
  "onClick={() => autoGenerateTimetable(1500)}\n                      disabled={isGenerating || isLocked}\n                      className=\"inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50\""
);

fs.writeFileSync('packages/web/src/features/classroom/components/TimetableStudio.tsx', c);
