const fs = require('fs');
let code = fs.readFileSync('packages/web/src/features/attendance/components/AttendanceModule.tsx', 'utf8');

if (!code.includes('import StaffAttendance')) {
  code = code.replace(/export default function AttendanceModule/g, "function StudentAttendance");

  const wrapperCode = "\nexport default function AttendanceModule({ role }: { role?: string }) {\n  const [activeTab, setActiveTab] = useState('student');\n\n  return (\n    <div className=\"space-y-6\">\n      <div className=\"flex space-x-4 border-b border-slate-700/50\">\n        <button\n          onClick={() => setActiveTab('student')}\n          className={`pb-2 px-1 ${activeTab === 'student' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}\n        >\n          Student Attendance\n        </button>\n        {role !== 'Student' && role !== 'Parent' && (\n          <>\n            <button\n              onClick={() => setActiveTab('staff')}\n              className={`pb-2 px-1 ${activeTab === 'staff' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}\n            >\n              Staff Attendance\n            </button>\n            <button\n              onClick={() => setActiveTab('parent')}\n              className={`pb-2 px-1 ${activeTab === 'parent' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}\n            >\n              Parent Attendance\n            </button>\n          </>\n        )}\n      </div>\n\n      {activeTab === 'student' && <StudentAttendance role={role} />}\n      {activeTab === 'staff' && <StaffAttendance />}\n      {activeTab === 'parent' && <ParentAttendance />}\n    </div>\n  );\n}\n";

  code = code + '\n' + wrapperCode;

  const importCode = "import StaffAttendance from './StaffAttendance';\nimport ParentAttendance from './ParentAttendance';\n";
  code = importCode + code;

  fs.writeFileSync('packages/web/src/features/attendance/components/AttendanceModule.tsx', code);
  console.log('Successfully patched AttendanceModule.tsx');
} else {
  console.log('Already patched.');
}
