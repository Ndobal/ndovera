

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, Users, Search, RefreshCw, 
  BarChart3, Clock, AlertTriangle, 
  ChevronRight, ChevronLeft, ShieldCheck, 
  UserCheck, Bell, Info, Filter,
  BookOpen, Heart, Sparkles, Wand2, Edit3, Save, X
} from 'lucide-react';
import { DutyRosterEntry, UserRole, RosterType, SchoolSection, StaffMember } from '../types';

// Mock Institutional Staff Registry
// Added currentSchoolId, employmentType, baseSalary, bankName, and accountNumber to satisfy StaffMember interface requirements
const INSTITUTIONAL_STAFF: StaffMember[] = [
  { id: '1', name: 'Mrs. Florence O.', role: 'Senior Teacher', section: SchoolSection.PRIMARY, gender: 'FEMALE', department: 'Arts', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '2', name: 'Mrs. Musa Priscilla', role: 'Teacher', section: SchoolSection.JSS, gender: 'FEMALE', department: 'Science', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '3', name: 'Mrs. Glory Ohiemi', role: 'Teacher', section: SchoolSection.SSS, gender: 'FEMALE', department: 'Socials', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '4', name: 'Mrs. Nzekwe Angela', role: 'Teacher', section: SchoolSection.PRIMARY, gender: 'FEMALE', department: 'English', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '5', name: 'Mr. Ibeke George', role: 'HOD', section: SchoolSection.SSS, gender: 'MALE', department: 'Math', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '6', name: 'Miss. Afangide Peace', role: 'Asst Teacher', section: SchoolSection.NURSERY, gender: 'FEMALE', department: 'Preschool', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '7', name: 'Mrs. Enenu Christiana', role: 'Teacher', section: SchoolSection.NURSERY, gender: 'FEMALE', department: 'Preschool', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '8', name: 'Mr. Michael Wankyo', role: 'Sports Coord', section: SchoolSection.JSS, gender: 'MALE', department: 'P.H.E', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '9', name: 'Miss. Anna Obi', role: 'Teacher', section: SchoolSection.PRIMARY, gender: 'FEMALE', department: 'Home Ec', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '10', name: 'Miss. Happiness E.', role: 'Asst Teacher', section: SchoolSection.PRIMARY, gender: 'FEMALE', department: 'General', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '11', name: 'Mr. Marvelous D.', role: 'Teacher', section: SchoolSection.SSS, gender: 'MALE', department: 'Science', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
  { id: '12', name: 'Mr. Chibuike', role: 'Teacher', section: SchoolSection.JSS, gender: 'MALE', department: 'Math', phone: '', email: '', status: 'ACTIVE', currentSchoolId: 'sch_001', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
];

export const DutyRoster: React.FC<{ role: UserRole }> = ({ role }) => {
    const [activeRoster, setActiveRoster] = useState<RosterType>(RosterType.MORNING_ASSEMBLY);
    const [activeSection, setActiveSection] = useState<SchoolSection>(SchoolSection.PRIMARY);
    const [rosterEntries, setRosterEntries] = useState<DutyRosterEntry[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

    const isHOS = role === UserRole.SCHOOL_OWNER || role === UserRole.SCHOOL_ADMIN;

    // Helper to generate term dates (Mocking a term from Jan to April 2026)
    const generateTermDates = () => {
        const dates: { date: string, day: string }[] = [];
        let curr = new Date(2026, 0, 12); // Start Monday Jan 12
        const end = new Date(2026, 3, 5); // End April
        
        while (curr <= end) {
            const dayNum = curr.getDay();
            if (dayNum !== 0 && dayNum !== 6) { // Weekdays only
                dates.push({
                    date: curr.toLocaleDateString('en-GB').replace(/\//g, '-'),
                    day: curr.toLocaleDateString('en-GB', { weekday: 'short' })
                });
            }
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
    };

    const autoGenerateRoster = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const dates = generateTermDates();
            const newEntries: DutyRosterEntry[] = [];
            
            // Logic for Assembly (All staff rotation)
            if (activeRoster === RosterType.MORNING_ASSEMBLY) {
                dates.forEach((d, i) => {
                    const staff = INSTITUTIONAL_STAFF[i % INSTITUTIONAL_STAFF.length];
                    newEntries.push({
                        id: `ma-${i}`,
                        type: RosterType.MORNING_ASSEMBLY,
                        date: d.date,
                        day: d.day,
                        assignedStaffId: staff.id,
                        assignedStaffName: staff.name,
                        topic: 'Morning Standard Protocol'
                    });
                });
            } 
            // Logic for Fellowships (Section-specific rotation)
            else if (activeRoster === RosterType.STUDENT_FELLOWSHIP) {
                const sectionStaff = INSTITUTIONAL_STAFF.filter(s => s.section === activeSection);
                dates.filter(d => d.day === 'Fri').forEach((d, i) => { // Fellowships on Fridays
                    const staff = sectionStaff[i % sectionStaff.length] || sectionStaff[0];
                    newEntries.push({
                        id: `sf-${activeSection}-${i}`,
                        type: RosterType.STUDENT_FELLOWSHIP,
                        section: activeSection,
                        date: d.date,
                        day: d.day,
                        assignedStaffId: staff.id,
                        assignedStaffName: staff.name,
                        topic: 'Spiritual Growth Session'
                    });
                });
            }
            // Logic for Gender Assembly (Wednesday Gender-Specific)
            else if (activeRoster === RosterType.GENDER_ASSEMBLY) {
                dates.filter(d => d.day === 'Wed').forEach((d, i) => {
                    const maleStaff = INSTITUTIONAL_STAFF.filter(s => s.gender === 'MALE');
                    const femaleStaff = INSTITUTIONAL_STAFF.filter(s => s.gender === 'FEMALE');
                    const m = maleStaff[i % maleStaff.length];
                    const f = femaleStaff[i % femaleStaff.length];
                    newEntries.push({
                        id: `ga-${i}`,
                        type: RosterType.GENDER_ASSEMBLY,
                        date: d.date,
                        day: d.day,
                        assignedStaffId: f.id,
                        assignedStaffName: `Girls: ${f.name}`,
                        assistantStaffId: m.id,
                        assistantStaffName: `Boys: ${m.name}`,
                        topic: 'Gender Empowerment Series'
                    });
                });
            }
            // Logic for Staff Fellowship (Wednesdays)
            else if (activeRoster === RosterType.STAFF_FELLOWSHIP) {
                dates.filter(d => d.day === 'Wed').forEach((d, i) => {
                    const staff = INSTITUTIONAL_STAFF[i % INSTITUTIONAL_STAFF.length];
                    newEntries.push({
                        id: `stf-${i}`,
                        type: RosterType.STAFF_FELLOWSHIP,
                        date: d.date,
                        day: d.day,
                        assignedStaffId: staff.id,
                        assignedStaffName: staff.name,
                        topic: 'Faculty Devotional'
                    });
                });
            }

            setRosterEntries(newEntries);
            setIsGenerating(false);
        }, 1000);
    };

    const handleEditEntry = (id: string, staffName: string) => {
        if (!isHOS) return;
        setRosterEntries(prev => prev.map(e => e.id === id ? { ...e, assignedStaffName: staffName } : e));
        setEditingEntryId(null);
    };

    const filteredEntries = useMemo(() => {
        return rosterEntries.filter(e => {
            const matchesSearch = e.assignedStaffName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 e.topic?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [rosterEntries, searchQuery]);

    const rosterTabs = [
        { id: RosterType.MORNING_ASSEMBLY, label: 'Morning Assembly', icon: SunIcon },
        { id: RosterType.GENDER_ASSEMBLY, label: 'Gender Assembly', icon: Heart },
        { id: RosterType.STAFF_FELLOWSHIP, label: 'Staff Fellowship', icon: Users },
        { id: RosterType.STUDENT_FELLOWSHIP, label: 'Student Fellowship', icon: BookOpen },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Contextual Header */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full text-indigo-600 font-black text-[9px] uppercase tracking-widest mb-4">
                            <Clock className="w-3.5 h-3.5"/> Second Term Session 2026
                        </div>
                        <h2 className="text-4xl font-black tracking-tighter italic uppercase text-slate-900">Roster Intelligence.</h2>
                        <p className="text-slate-400 font-medium mt-1">Sectional rotation & institutional coordination hub.</p>
                    </div>
                    
                    {isHOS && (
                        <button 
                            onClick={autoGenerateRoster} 
                            disabled={isGenerating}
                            className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all disabled:opacity-50"
                        >
                            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
                            Auto-Gen Termly Roster
                        </button>
                    )}
                </div>
                <Calendar className="absolute right-[-40px] bottom-[-40px] w-64 h-64 opacity-5 rotate-12"/>
            </div>

            {/* Roster Navigation Tabs */}
            <div className="flex flex-wrap gap-3">
                {rosterTabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => { setActiveRoster(tab.id); setRosterEntries([]); }}
                        className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all ${activeRoster === tab.id ? 'bg-slate-900 text-white shadow-2xl' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeRoster === tab.id ? 'text-indigo-400' : 'text-slate-300'}`}/>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Viewport */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Section Switcher (Conditional) */}
                    {activeRoster === RosterType.STUDENT_FELLOWSHIP && (
                        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex gap-2">
                             {Object.values(SchoolSection).map(s => (
                                <button 
                                    key={s} 
                                    onClick={() => { setActiveSection(s); setRosterEntries([]); }}
                                    className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeSection === s ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}
                                >
                                    {s} SECTION
                                </button>
                             ))}
                        </div>
                    )}

                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                                <input 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Find assignment..." 
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 ring-indigo-500/20 font-bold text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <Filter className="w-4 h-4 text-indigo-600"/> {filteredEntries.length} Assignments Generated
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                                    <tr>
                                        <th className="p-6">Timeline</th>
                                        <th className="p-6">Lead Conductor</th>
                                        <th className="p-6">Focus / Session Topic</th>
                                        {activeRoster === RosterType.GENDER_ASSEMBLY && <th className="p-6">Assistant</th>}
                                        {isHOS && <th className="p-6 text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredEntries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="p-6">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900">{entry.day}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entry.date}</span>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                {editingEntryId === entry.id ? (
                                                    <select 
                                                        onChange={(e) => handleEditEntry(entry.id, e.target.value)}
                                                        className="bg-white border border-indigo-600 rounded-lg p-2 font-bold text-sm outline-none"
                                                    >
                                                        {INSTITUTIONAL_STAFF.map(s => <option key={s.id}>{s.name}</option>)}
                                                    </select>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><UserCheck className="w-4 h-4"/></div>
                                                        <span className="font-bold text-slate-800">{entry.assignedStaffName}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-500 text-sm">{entry.topic}</span>
                                                    {entry.section && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">{entry.section} EXCLUSIVE</span>}
                                                </div>
                                            </td>
                                            {activeRoster === RosterType.GENDER_ASSEMBLY && (
                                                <td className="p-6 font-bold text-slate-400 text-sm italic">{entry.assistantStaffName}</td>
                                            )}
                                            {isHOS && (
                                                <td className="p-6 text-right">
                                                    <button 
                                                        onClick={() => setEditingEntryId(entry.id)}
                                                        className="p-3 text-slate-300 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <Edit3 className="w-4 h-4"/>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {rosterEntries.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-32 text-center">
                                                <div className="max-w-xs mx-auto space-y-6">
                                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300"><Calendar className="w-10 h-10"/></div>
                                                    <h4 className="text-xl font-black italic text-slate-300 uppercase tracking-tighter">Ready for Sync</h4>
                                                    <p className="text-slate-400 text-sm font-medium">No schedule has been generated for this module yet. HOS must initiate the auto-rotation engine.</p>
                                                    {isHOS && (
                                                        <button onClick={autoGenerateRoster} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:underline">Initiate Generation Now</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Side Stats & Institutional Alerts */}
                <div className="space-y-8">
                    <div className="bg-slate-900 rounded-[3rem] p-10 text-white space-y-8 shadow-xl">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xl font-black italic tracking-tighter uppercase">Duty Analytics</h4>
                            <BarChart3 className="w-5 h-5 text-indigo-400"/>
                        </div>
                        <div className="space-y-6">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Leadership Frequency</p>
                            {INSTITUTIONAL_STAFF.slice(0, 4).map((s, i) => (
                                <div key={s.id} className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                                        <span className="text-xs font-bold truncate max-w-[120px]">{s.name}</span>
                                    </div>
                                    <span className="bg-indigo-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">{10 - i} sessions</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10 space-y-6">
                            <Bell className="w-8 h-8 text-amber-400 fill-current animate-bounce"/>
                            <h4 className="text-xl font-black italic tracking-tighter uppercase">Pulse Alert</h4>
                            <p className="text-xs text-indigo-100 font-medium leading-relaxed opacity-80 italic">"Assemblies must begin strictly by 07:45 AM. Ensure the sound system is verified 10 mins prior."</p>
                            <div className="flex gap-2 pt-4">
                                <button className="flex-1 bg-white text-indigo-600 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl">Protocols</button>
                                <button className="flex-1 bg-indigo-500 border border-white/20 text-white py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest">Help Hub</button>
                            </div>
                        </div>
                        <ShieldCheck className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-10 rotate-12"/>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SunIcon = ({ className }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>;
