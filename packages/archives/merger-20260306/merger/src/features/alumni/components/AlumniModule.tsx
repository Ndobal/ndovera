import React, { useState } from 'react';
import { GraduationCap, Briefcase, Users, Calendar, Gift, Search, Check, X, Printer, AlertTriangle, UserPlus, Edit, Save, Key, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { UserRole, Student, Alumni } from '../../../shared/types';
import { motion, AnimatePresence } from 'motion/react';

// Mock Data
const MOCK_GRADUATED_STUDENTS: Student[] = [
  { id: 's101', name: 'Grace Johnson', class: 'SS3 2025', status: 'Graduated' },
  { id: 's102', name: 'David Wilson', class: 'SS3 2025', status: 'Graduated' },
  { id: 's103', name: 'Mary Davis', class: 'SS3 2025', status: 'Graduated' },
];

const MOCK_ALUMNI: Alumni[] = [
  { id: 'NA-NDV-000001', originalStudentId: 's98', name: 'Peter Jones', graduationYear: 2024, email: 'pe***@alumni.ndovera.com', currentRole: 'Software Engineer', company: 'Google', profilePublic: true },
  { id: 'NA-NDV-000002', originalStudentId: 's99', name: 'Aisha Bello', graduationYear: 2024, email: 'ai***@alumni.ndovera.com', currentRole: 'Doctor', company: 'General Hospital', profilePublic: true },
];

export default function AlumniModule({ role }: { role: UserRole }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'onboarding' | 'directory'>('dashboard');
  const [students, setStudents] = useState<Student[]>(MOCK_GRADUATED_STUDENTS);
  const [alumni, setAlumni] = useState<Alumni[]>(MOCK_ALUMNI);
  const [showPrintModal, setShowPrintModal] = useState<Alumni | null>(null);

  const isAlumniAdmin = [UserRole.SUPER_ADMIN, UserRole.PROPRIETOR, UserRole.HOS, UserRole.ICT_MANAGER].includes(role);
  const isAlumnus = role === UserRole.ALUMNI;

  const convertToAlumni = (student: Student) => {
    const newAlumni: Alumni = {
      id: `NA-NDV-${(alumni.length + 1).toString().padStart(6, '0')}`,
      originalStudentId: student.id,
      name: student.name,
      graduationYear: new Date().getFullYear(),
      email: `${student.name.split(' ')[0].toLowerCase().slice(0, 2)}***@alumni.ndovera.com`,
      profilePublic: false,
    };
    setAlumni(prev => [newAlumni, ...prev]);
    setStudents(prev => prev.filter(s => s.id !== student.id));
    setShowPrintModal(newAlumni);
  };

  if (isAlumnus) {
    return <AlumniPortalView alumniProfile={alumni[0]} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Alumni Network</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Connect with past students and manage the alumni community.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit overflow-x-auto">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </button>
        {isAlumniAdmin && (
          <button 
            onClick={() => setActiveTab('onboarding')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'onboarding' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Onboarding
          </button>
        )}
        <button 
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'directory' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Users className="w-3.5 h-3.5" />
          Directory
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'onboarding' && isAlumniAdmin && <OnboardingView students={students} onConvert={convertToAlumni} />}
          {activeTab === 'directory' && <DirectoryView alumni={alumni} />}
        </motion.div>
      </AnimatePresence>

      {/* Print Modal */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Print Login Details</h2>
                <p className="text-slate-500 mt-2">Printing generates a temporary, one-time password. This action is logged for security.</p>
                
                <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alumni ID</p>
                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{showPrintModal.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Email</p>
                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{showPrintModal.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Temporary Password</p>
                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">********** (auto-generated)</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center gap-3 text-amber-700 dark:text-amber-300 text-xs">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Ensure this document is handed securely to the alumnus. The temporary password expires after first login.</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button onClick={() => setShowPrintModal(null)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">
                  Cancel
                </button>
                <button onClick={() => { alert('Printing...'); setShowPrintModal(null); }} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Print (A4)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components for different views ---

const DashboardView = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <StatCard icon={Users} title="Total Alumni" value="4,582" color="bg-sky-500" />
    <StatCard icon={Calendar} title="Upcoming Events" value="3" color="bg-emerald-500" />
    <StatCard icon={Gift} title="Donations (Year)" value="₦1.8M" color="bg-amber-500" />
    <StatCard icon={Briefcase} title="Job Board Postings" value="12" color="bg-indigo-500" />
  </div>
);

const OnboardingView = ({ students, onConvert }: { students: Student[], onConvert: (student: Student) => void }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
      <h3 className="font-bold text-slate-800 dark:text-slate-100">Graduated Student Onboarding</h3>
      <p className="text-xs text-slate-500">Convert recently graduated students into alumni to grant them access to the network.</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider">
          <tr>
            <th className="px-6 py-4">Student Name</th>
            <th className="px-6 py-4">Last Class</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {students.map((student) => (
            <tr key={student.id}>
              <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{student.name}</td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{student.class}</td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">{student.status}</span>
              </td>
              <td className="px-6 py-4 text-right">
                <button onClick={() => onConvert(student)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all">
                  Convert to Alumni
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const DirectoryView = ({ alumni }: { alumni: Alumni[] }) => (
  <div className="space-y-6">
    <div className="relative">
      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
      <input type="text" placeholder="Search alumni by name, year, or company..." className="pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm w-full focus:ring-2 focus:ring-emerald-500 transition-all" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {alumni.map(alum => (
        <div key={alum.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-slate-400" />
          </div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{alum.name}</p>
          <p className="text-xs text-slate-500">Class of {alum.graduationYear}</p>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2 text-left">
            <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Briefcase className="w-3.5 h-3.5 text-slate-400" /> {alum.currentRole} at {alum.company}</p>
            <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400"><Users className="w-3.5 h-3.5 text-slate-400" /> Profile is {alum.profilePublic ? 'Public' : 'Private'}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AlumniPortalView = ({ alumniProfile }: { alumniProfile: Alumni }) => {
  const [profile, setProfile] = useState(alumniProfile);
  const [isEditing, setIsEditing] = useState(false);

  const handleUpdate = (field: keyof Alumni, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-lg">
          <GraduationCap className="w-12 h-12 text-sky-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Welcome, {profile.name}</h1>
          <p className="text-slate-500 dark:text-slate-400">Class of {profile.graduationYear} • Member ID: {profile.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">My Profile</h3>
              <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${isEditing ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                {isEditing ? <><Save className="w-3.5 h-3.5" /> Save Changes</> : <><Edit className="w-3.5 h-3.5" /> Edit Profile</>}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <InputField label="Current Role / Job Title" value={profile.currentRole || ''} onChange={(e) => handleUpdate('currentRole', e.target.value)} disabled={!isEditing} />
              <InputField label="Company / Organization" value={profile.company || ''} onChange={(e) => handleUpdate('company', e.target.value)} disabled={!isEditing} />
              <InputField label="Contact Phone" value={profile.phone || ''} onChange={(e) => handleUpdate('phone', e.target.value)} disabled={!isEditing} />
              <InputField label="System Email" value={profile.email} disabled={true} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Security</h3>
            <div className="space-y-4 text-sm">
              <InputField label="New Password" type="password" placeholder="••••••••" />
              <InputField label="Confirm New Password" type="password" placeholder="••••••••" />
              <button className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-all flex items-center gap-2">
                <Key className="w-3.5 h-3.5" />
                Update Password
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Profile Visibility</h3>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <p className="text-sm text-slate-600 dark:text-slate-300">Visible in Directory</p>
              <button onClick={() => handleUpdate('profilePublic', !profile.profilePublic)} className={`w-12 h-6 rounded-full flex items-center transition-colors p-1 ${profile.profilePublic ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <motion.div layout className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${profile.profilePublic ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-3">If enabled, other alumni can see your name, graduation year, and professional details.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const InputField = ({ label, ...props }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
    <input {...props} className="mt-1 w-full p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50" />
  </div>
);

const StatCard = ({ icon: Icon, title, value, color }: { icon: any, title: string, value: string, color: string }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  </div>
);