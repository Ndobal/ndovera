const fs = require('fs');
let code = fs.readFileSync('packages/web/src/features/attendance/components/AttendanceModule.tsx', 'utf8');

// Replace standard exports to make it a sub-component, and inject the tab wrapper at the top or bottom
code = code.replace(/export default function AttendanceModule\(/g, "function StudentAttendance(");

const wrapperCode = \`
import StaffAttendance from './StaffAttendance';
import ParentAttendance from './ParentAttendance';

export default function AttendanceModule({ role }: { role?: string }) {
  const [activeTab, setActiveTab] = React.useState('student');

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

// Actually we need to prepend the imports or append the wrapper. Let's just append the wrapper to the end of the file.
code = code + '\\n' + wrapperCode;

fs.writeFileSync('packages/web/src/features/attendance/components/AttendanceModule.tsx', code);
console.log('Successfully patched AttendanceModule.tsx');
