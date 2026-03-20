const fs = require('fs');
let code = fs.readFileSync('packages/web/src/features/attendance/components/AttendanceModule.tsx', 'utf8');

if (!code.includes('import StaffAttendance')) {
  // Replace the default export to named
  code = code.replace(/export default function AttendanceModule/g, "function StudentAttendance");

  // Add the wrapper at the bottom
  const wrapperCode = \`
export default function AttendanceModule({ role }: { role?: string }) {
  const [activeTab, setActiveTab] = useState('student');

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b border-slate-700/50">
        <button
          onClick={() => setActiveTab('student')}
          className={\`pb-2 px-1 \${activeTab === 'student' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}
        >
          Student Attendance
        </button>
        {role !== 'Student' && role !== 'Parent' && (
          <>
            <button
              onClick={() => setActiveTab('staff')}
              className={\`pb-2 px-1 \${activeTab === 'staff' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}
            >
              Staff Attendance
            </button>
            <button
              onClick={() => setActiveTab('parent')}
              className={\`pb-2 px-1 \${activeTab === 'parent' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}
            >
              Parent Attendance
            </button>
          </>
        )}
      </div>

      {activeTab === 'student' && <StudentAttendance role={role} />}
      {activeTab === 'staff' && <StaffAttendance />}
      {activeTab === 'parent' && <ParentAttendance />}
    </div>
  );
}
\`;

  code = code + '\\n' + wrapperCode;

  // Add imports at top
  const importCode = \`import StaffAttendance from './StaffAttendance';\\nimport ParentAttendance from './ParentAttendance';\\n\`;
  code = importCode + code;

  fs.writeFileSync('packages/web/src/features/attendance/components/AttendanceModule.tsx', code);
  console.log('Successfully patched AttendanceModule.tsx');
} else {
  console.log('Already patched.');
}
