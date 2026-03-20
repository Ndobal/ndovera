
import React, { useState, useMemo } from 'react';
import { 
    Scoresheet, SubjectScore, UserRole, SchoolSection 
} from '../types';
import { 
    Send, ChevronLeft, Search, X, Loader2
} from 'lucide-react';

const SURNAMES = ["ADEYEMI", "OKORO", "BELLO", "CHUKWUMA", "MUSA", "EZE", "BALOGUN", "IDRIS", "IBRAHIM", "NWOSU"];
const FIRSTNAMES = ["David", "Grace", "Samuel", "Chioma", "Aisha", "John", "Fatima", "Okon", "Blessing", "Emeka"];

const MOCK_STUDENTS = Array.from({ length: 50 }, (_, i) => ({
    id: `S${(i + 1).toString().padStart(3, '0')}`,
    name: `${SURNAMES[i % 10]} ${FIRSTNAMES[(i + 7) % 10]}`,
    adNo: `ADM/${i % 2 === 0 ? 'PRI' : 'SEC'}/${(i + 1).toString().padStart(4, '0')}`,
    level: (i % 2 === 0 ? 'PRIMARY' : 'SECONDARY') as 'PRIMARY' | 'SECONDARY'
})).sort((a, b) => a.name.localeCompare(b.name));

const MOCK_SUBJECTS = ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education'];

export const ScoresheetManager: React.FC<{ 
    role: UserRole; 
    schoolName: string; 
    logo: string;
    onProcessResult?: (sheet: Scoresheet) => void;
}> = ({ role, schoolName, onProcessResult }) => {
    const [view, setView] = useState<'LIST' | 'SHEET'>('LIST');
    const [activeSheet, setActiveSheet] = useState<Scoresheet | null>(null);
    const [sheets, setSheets] = useState<Record<string, Scoresheet>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState<'ALL' | 'PRIMARY' | 'SECONDARY'>('ALL');

    const filteredStudents = useMemo(() => {
        return MOCK_STUDENTS.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 s.adNo.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesLevel = filterLevel === 'ALL' || s.level === filterLevel;
            return matchesSearch && matchesLevel;
        });
    }, [searchQuery, filterLevel]);

    const handleOpenSheet = (student: typeof MOCK_STUDENTS[0]) => {
        if (!sheets[student.id]) {
            const newSheet: Scoresheet = {
                id: `sheet_${student.id}`,
                studentId: student.id,
                studentName: student.name,
                admissionNumber: student.adNo,
                schoolName: schoolName,
                class: student.level === 'PRIMARY' ? 'Primary 4' : 'JSS 2',
                section: student.level === 'PRIMARY' ? SchoolSection.PRIMARY : SchoolSection.JSS,
                session: '2024/2025',
                term: 'First Term',
                level: student.level,
                status: 'DRAFT',
                isLocked: false,
                scores: MOCK_SUBJECTS.map((s, i) => ({
                    subjectId: `sub_${i}`,
                    subjectName: s,
                    ca1: 0, ca2: 0, ca3: 0, ca4: 0, exam: 0,
                    isOffered: true
                }))
            };
            setSheets(prev => ({ ...prev, [student.id]: newSheet }));
            setActiveSheet(newSheet);
        } else {
            setActiveSheet(sheets[student.id]);
        }
        setView('SHEET');
    };

    const updateScore = (field: keyof SubjectScore, value: number, index: number) => {
        if (!activeSheet || activeSheet.isLocked) return;
        const newScores = [...activeSheet.scores];
        const clampedValue = Math.min(Math.max(0, value), field === 'exam' ? 60 : 20);
        newScores[index] = { ...newScores[index], [field]: clampedValue };
        setActiveSheet({ ...activeSheet, scores: newScores });
    };

    if (view === 'LIST') {
        return (
            <div className="flex flex-col h-full space-y-4 animate-fade-in">
                {/* Responsive Header */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Academic Records</h2>
                        <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">Session 2024/25</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name..." className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none" />
                        </div>
                        <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value as any)} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none shadow-sm">
                            <option value="ALL">All Sections</option>
                            <option value="PRIMARY">Primary Only</option>
                            <option value="SECONDARY">Secondary Only</option>
                        </select>
                    </div>
                </div>

                {/* Table Container with Swipe for Mobile */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
                    <div className="overflow-x-auto relative scrollbar-hide">
                        <table className="w-full text-left min-w-[600px]">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider sticky top-0">
                                <tr>
                                    <th className="p-4 pl-6">Student Name</th>
                                    <th className="p-4">Admission ID</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right pr-6">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 text-sm">{student.name}</span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{student.level} Section</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs font-bold text-slate-500">{student.adNo}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${sheets[student.id]?.status === 'SUBMITTED' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                {sheets[student.id]?.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <button onClick={() => handleOpenSheet(student)} className="text-xs font-black uppercase text-indigo-600 hover:underline">Enter Scores</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile Swipe Hint */}
                    <div className="p-3 bg-indigo-50/50 flex items-center justify-center gap-2 lg:hidden border-t border-indigo-100">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping"/>
                        <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Swipe table to see more columns</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!activeSheet) return null;

    return (
        <div className="flex flex-col h-full space-y-6 animate-fade-in pb-10">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-xs uppercase tracking-widest">
                    <ChevronLeft className="w-4 h-4"/> Back
                </button>
                <button onClick={() => { setSheets(prev => ({ ...prev, [activeSheet.studentId]: { ...activeSheet, status: 'SUBMITTED', isLocked: true } })); alert("Records Submitted!"); setView('LIST'); }} className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase shadow-md flex items-center gap-2">
                    <Send className="w-4 h-4"/> Submit Records
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden flex flex-col">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">{activeSheet.studentName}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{activeSheet.class} • {activeSheet.admissionNumber}</p>
                    </div>
                </div>

                <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left min-w-[500px]">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            <tr>
                                <th className="p-4 pl-6">Subject</th>
                                <th className="p-4 text-center">CA 1 (20)</th>
                                <th className="p-4 text-center">CA 2 (20)</th>
                                <th className="p-4 text-center">Exam (60)</th>
                                <th className="p-4 text-center">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeSheet.scores.map((score, i) => {
                                const total = score.ca1 + score.ca2 + score.exam;
                                return (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 pl-6 font-bold text-slate-700 text-sm">{score.subjectName}</td>
                                        <td className="p-4 text-center"><input type="number" value={score.ca1 || ''} onChange={(e) => updateScore('ca1', Number(e.target.value), i)} className="w-14 bg-white border border-slate-200 rounded-lg p-1.5 text-center font-bold text-sm outline-none focus:ring-2 ring-indigo-500/20" /></td>
                                        <td className="p-4 text-center"><input type="number" value={score.ca2 || ''} onChange={(e) => updateScore('ca2', Number(e.target.value), i)} className="w-14 bg-white border border-slate-200 rounded-lg p-1.5 text-center font-bold text-sm outline-none focus:ring-2 ring-indigo-500/20" /></td>
                                        <td className="p-4 text-center"><input type="number" value={score.exam || ''} onChange={(e) => updateScore('exam', Number(e.target.value), i)} className="w-14 bg-white border border-slate-200 rounded-lg p-1.5 text-center font-bold text-sm outline-none focus:ring-2 ring-indigo-500/20" /></td>
                                        <td className="p-4 text-center"><span className={`text-sm font-black ${total >= 70 ? 'text-emerald-600' : 'text-slate-900'}`}>{total}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
