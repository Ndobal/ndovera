
import React, { useState, useMemo, useEffect } from 'react';
import {
    Map, Bus, User, Bed, Stethoscope, Package, UserCheck, Gavel, 
    Utensils, FileText, Upload, Network, Star, Calendar, 
    Clock, Wand2, RefreshCw, Printer, Search, Info, AlertTriangle, 
    ChevronDown, Layout, Users, BookOpen, Layers, Settings, Save, X, Edit2, Plus, Sparkles
} from 'lucide-react';
import { 
    TimetableSlot, TimetableEntry, SubjectAllocation, 
    UserRole, SchoolSection, StaffMember 
} from '../types';
// Imported SponsoredSearchUnit from FarmingMode where it now resides
import { SponsoredSearchUnit } from './FarmingMode';

// Standard Time Slots from Provided Image
const TIMETABLE_SLOTS: TimetableSlot[] = [
    { id: 's1', startTime: '07:30', endTime: '08:00', isFixed: true, fixedTitle: 'MORNING ASSEMBLY' },
    { id: 's2', startTime: '08:00', endTime: '08:10', isFixed: true, fixedTitle: 'ROLL CALL' },
    { id: 's3', startTime: '08:10', endTime: '08:50' },
    { id: 's4', startTime: '08:50', endTime: '09:30' },
    { id: 's5', startTime: '09:30', endTime: '10:10' },
    { id: 's6', startTime: '10:10', endTime: '10:40', isBreak: true, fixedTitle: 'LONG BREAK' },
    { id: 's7', startTime: '10:40', endTime: '11:20' },
    { id: 's8', startTime: '11:20', endTime: '12:00' },
    { id: 's9', startTime: '12:00', endTime: '12:40' },
    { id: 's10', startTime: '12:40', endTime: '12:55', isBreak: true, fixedTitle: 'SHORT BREAK' },
    { id: 's11', startTime: '12:55', endTime: '13:35' },
    { id: 's12', startTime: '01:35', endTime: '02:15' },
    { id: 's13', startTime: '02:15', endTime: '02:45', isFixed: true, fixedTitle: 'AFTERNOON ACTIVITY' }
];

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const CLASSES = ['JHS 1', 'JHS 2', 'JHS 3', 'SH 1', 'SH 2', 'SH 3'];

const MOCK_TEACHERS = [
    { id: 't1', name: 'Mrs. Florence O.' },
    { id: 't2', name: 'Mrs. Musa Priscilla' },
    { id: 't3', name: 'Mrs. Glory Ohiemi' },
    { id: 't4', name: 'Mr. Ibeke George' },
    { id: 't5', name: 'Mr. Michael Wankyo' },
    { id: 't6', name: 'Miss. Anna Obi' }
];

const MOCK_ALLOCATIONS: SubjectAllocation[] = [
    { id: 'a1', subjectName: 'Mathematics', teacherId: 't4', teacherName: 'Mr. Ibeke George', targetWeeklyCount: 5 },
    { id: 'a2', subjectName: 'English Language', teacherId: 't1', teacherName: 'Mrs. Florence O.', targetWeeklyCount: 5 },
    { id: 'a3', subjectName: 'Basic Science', teacherId: 't2', teacherName: 'Mrs. Musa Priscilla', targetWeeklyCount: 3 },
    { id: 'a4', subjectName: 'Social Studies', teacherId: 't3', teacherName: 'Mrs. Glory Ohiemi', targetWeeklyCount: 3 },
    { id: 'a5', subjectName: 'ICT', teacherId: 't5', teacherName: 'Mr. Michael Wankyo', targetWeeklyCount: 2 },
    { id: 'a6', subjectName: 'Agric Science', teacherId: 't6', teacherName: 'Miss. Anna Obi', targetWeeklyCount: 2 },
];

export const TimetableBuilder: React.FC<{ role?: UserRole }> = ({ role = UserRole.SCHOOL_OWNER }) => {
    const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER' | 'GLOBAL'>('CLASS');
    const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
    const [selectedTeacher, setSelectedTeacher] = useState(MOCK_TEACHERS[0].id);
    const [entries, setEntries] = useState<TimetableEntry[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [editSlot, setEditSlot] = useState<{ day: string, slotId: string, classId: string } | null>(null);

    const isHOS = role === UserRole.SCHOOL_OWNER || role === UserRole.SCHOOL_ADMIN;

    const generateSchedule = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const newEntries: TimetableEntry[] = [];
            const teacherSchedules: Record<string, Set<string>> = {}; 
            
            CLASSES.forEach(classId => {
                const subjectPool: string[] = [];
                MOCK_ALLOCATIONS.forEach(alloc => {
                    for (let i = 0; i < alloc.targetWeeklyCount; i++) {
                        subjectPool.push(alloc.id);
                    }
                });
                
                const pool = subjectPool.sort(() => Math.random() - 0.5);
                let poolIdx = 0;

                DAYS.forEach(day => {
                    TIMETABLE_SLOTS.forEach(slot => {
                        if (slot.isFixed || slot.isBreak) return;

                        const alloc = MOCK_ALLOCATIONS.find(a => a.id === pool[poolIdx]);
                        if (!alloc) return;

                        const clashKey = `${day}-${slot.id}`;
                        if (!teacherSchedules[alloc.teacherId]) teacherSchedules[alloc.teacherId] = new Set();

                        if (!teacherSchedules[alloc.teacherId].has(clashKey)) {
                            newEntries.push({
                                id: `${classId}-${day}-${slot.id}`,
                                day: day,
                                slotId: slot.id,
                                classId: classId,
                                subjectId: alloc.id,
                                subjectName: alloc.subjectName,
                                teacherId: alloc.teacherId,
                                teacherName: alloc.teacherName
                            });
                            teacherSchedules[alloc.teacherId].add(clashKey);
                            poolIdx++;
                        } else {
                            const altIdx = pool.findIndex((id, idx) => {
                                if (idx <= poolIdx) return false;
                                const altAlloc = MOCK_ALLOCATIONS.find(a => a.id === id);
                                return altAlloc && !teacherSchedules[altAlloc.teacherId]?.has(clashKey);
                            });

                            if (altIdx !== -1) {
                                const altAlloc = MOCK_ALLOCATIONS.find(a => a.id === pool[altIdx]);
                                if (altAlloc) {
                                    newEntries.push({
                                        id: `${classId}-${day}-${slot.id}`,
                                        day: day,
                                        slotId: slot.id,
                                        classId: classId,
                                        subjectId: altAlloc.id,
                                        subjectName: altAlloc.subjectName,
                                        teacherId: altAlloc.teacherId,
                                        teacherName: altAlloc.teacherName
                                    });
                                    if (!teacherSchedules[altAlloc.teacherId]) teacherSchedules[altAlloc.teacherId] = new Set();
                                    teacherSchedules[altAlloc.teacherId].add(clashKey);
                                    pool.splice(altIdx, 1);
                                }
                            }
                        }
                    });
                });
            });

            setEntries(newEntries);
            setIsGenerating(false);
            alert("Clash-Free Institutional Schedule Generated!");
        }, 1200);
    };

    const filteredEntries = useMemo(() => {
        if (viewMode === 'CLASS') {
            return entries.filter(e => e.classId === selectedClass);
        } else if (viewMode === 'TEACHER') {
            return entries.filter(e => e.teacherId === selectedTeacher);
        }
        return entries;
    }, [entries, viewMode, selectedClass, selectedTeacher]);

    const getEntry = (day: string, slotId: string) => {
        return filteredEntries.find(e => e.day === day && e.slotId === slotId);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header Control Panel */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full text-indigo-600 font-black text-[9px] uppercase tracking-widest mb-4">
                            <Layers className="w-3.5 h-3.5"/> Institutional Logistics v2.4
                        </div>
                        <h2 className="text-4xl font-black tracking-tighter italic uppercase text-slate-900">Schedule Engine.</h2>
                        <p className="text-slate-400 font-medium mt-1">Clashless master timetable management and distribution.</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {isHOS && (
                            <button 
                                onClick={generateSchedule}
                                disabled={isGenerating}
                                className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3 hover:scale-105 transition-all disabled:opacity-50"
                            >
                                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
                                {entries.length > 0 ? 'Regenerate Clashless' : 'Auto-Gen Master Schedule'}
                            </button>
                        )}
                        <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3 hover:bg-black transition-all">
                            <Printer className="w-4 h-4"/> Export Print View
                        </button>
                    </div>
                </div>
                <Clock className="absolute right-[-40px] bottom-[-40px] w-64 h-64 opacity-5 rotate-12"/>
            </div>

            {/* Simulated AdSense Placement in Logistics */}
            <SponsoredSearchUnit />

            {/* View Selectors */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-2">
                    <button onClick={() => setViewMode('CLASS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'CLASS' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Class Schedule</button>
                    <button onClick={() => setViewMode('TEACHER')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'TEACHER' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>Teacher Load</button>
                </div>

                {viewMode === 'CLASS' && (
                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl overflow-x-auto max-w-[500px] scrollbar-hide">
                        {CLASSES.map(c => (
                            <button key={c} onClick={() => setSelectedClass(c)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${selectedClass === c ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white/50 text-slate-400'}`}>{c}</button>
                        ))}
                    </div>
                )}

                {viewMode === 'TEACHER' && (
                    <select 
                        value={selectedTeacher}
                        onChange={(e) => setSelectedTeacher(e.target.value)}
                        className="bg-white border border-slate-200 rounded-2xl px-6 py-3 font-bold text-sm outline-none focus:ring-2 ring-indigo-500/20"
                    >
                        {MOCK_TEACHERS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                )}

                {isHOS && (
                    <button onClick={() => setShowConfig(!showConfig)} className="ml-auto flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-indigo-600">
                        <Settings className="w-4 h-4"/> Configure Frequencies
                    </button>
                )}
            </div>

            {/* Subject Configuration Modal */}
            {showConfig && (
                <div className="bg-white p-8 rounded-[2.5rem] border-4 border-dashed border-indigo-100 animate-scale-in">
                    <div className="flex justify-between items-center mb-8">
                        <h4 className="text-xl font-black italic uppercase tracking-tight">Weekly Subject Appearance Count</h4>
                        <button onClick={() => setShowConfig(false)}><X className="text-slate-300 w-6 h-6 hover:text-red-500"/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {MOCK_ALLOCATIONS.map(alloc => (
                            <div key={alloc.id} className="p-6 bg-slate-50 rounded-3xl space-y-4">
                                <p className="font-black text-slate-900 text-sm">{alloc.subjectName}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Occurrences:</span>
                                    <div className="flex items-center gap-3">
                                        <button className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center font-black">-</button>
                                        <span className="font-black text-indigo-600">{alloc.targetWeeklyCount}</span>
                                        <button className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center font-black">+</button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest italic">{alloc.teacherName}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MAIN TIMETABLE GRID */}
            <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-x-auto print:border-none print:shadow-none">
                <div className="min-w-[1200px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-[150px_repeat(5,1fr)] bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.3em] text-center border-b border-slate-800">
                        <div className="p-8 border-r border-slate-800">Timeline</div>
                        {DAYS.map(day => <div key={day} className="p-8 border-r border-slate-800">{day}</div>)}
                    </div>

                    {/* Slot Rows */}
                    {TIMETABLE_SLOTS.map(slot => (
                        <div key={slot.id} className="grid grid-cols-[150px_repeat(5,1fr)] border-b border-slate-50 min-h-[100px]">
                            {/* Time Label */}
                            <div className="p-6 bg-slate-50/50 flex flex-col justify-center items-center border-r border-slate-100">
                                <span className="font-black text-slate-900 text-sm">{slot.startTime}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">to {slot.endTime}</span>
                            </div>

                            {/* Activity Cells */}
                            {DAYS.map(day => {
                                const entry = getEntry(day, slot.id);
                                if (slot.isFixed || slot.isBreak) {
                                    return (
                                        <div key={`${day}-${slot.id}`} className={`p-4 flex items-center justify-center border-r border-slate-50 ${slot.isBreak ? 'bg-amber-50/40' : 'bg-slate-100/50'}`}>
                                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 vertical-text">{slot.fixedTitle}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <div 
                                        key={`${day}-${slot.id}`} 
                                        className={`p-4 border-r border-slate-50 transition-all group relative cursor-pointer ${entry ? 'hover:bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}
                                        onClick={() => isHOS && setEditSlot({ day, slotId: slot.id, classId: selectedClass })}
                                    >
                                        {entry ? (
                                            <div className="h-full flex flex-col justify-center animate-fade-in">
                                                <p className="font-black text-slate-900 text-xs leading-tight mb-1">{entry.subjectName}</p>
                                                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{entry.teacherName}</p>
                                                {viewMode === 'TEACHER' && <p className="text-[8px] font-black text-amber-500 uppercase mt-2">Class: {entry.classId}</p>}
                                                {isHOS && <Edit2 className="absolute top-2 right-2 w-3 h-3 text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"/>}
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                {isHOS && <button className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Plus className="w-4 h-4"/></button>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit/Swap Slot Modal */}
            {editSlot && (
                <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="bg-white rounded-[4rem] w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
                        <div className="p-10 bg-indigo-600 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tight">Adjust Slot</h3>
                                <p className="text-indigo-100 font-medium text-xs uppercase tracking-widest">{editSlot.day} • {TIMETABLE_SLOTS.find(s => s.id === editSlot.slotId)?.startTime}</p>
                            </div>
                            <button onClick={() => setEditSlot(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6"/></button>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Select New Subject / Teacher</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {MOCK_ALLOCATIONS.map(alloc => (
                                        <button 
                                            key={alloc.id}
                                            onClick={() => {
                                                const updated = entries.filter(e => !(e.day === editSlot.day && e.slotId === editSlot.slotId && e.classId === editSlot.classId));
                                                updated.push({
                                                    id: `${editSlot.classId}-${editSlot.day}-${editSlot.slotId}`,
                                                    day: editSlot.day as any,
                                                    slotId: editSlot.slotId,
                                                    classId: editSlot.classId,
                                                    subjectId: alloc.id,
                                                    subjectName: alloc.subjectName,
                                                    teacherId: alloc.teacherId,
                                                    teacherName: alloc.teacherName
                                                });
                                                setEntries(updated);
                                                setEditSlot(null);
                                            }}
                                            className="w-full text-left p-5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all group flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-black text-slate-900">{alloc.subjectName}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{alloc.teacherName}</p>
                                            </div>
                                            <ChevronDown className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 -rotate-90"/>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={() => {
                                const cleared = entries.filter(e => !(e.day === editSlot.day && e.slotId === editSlot.slotId && e.classId === editSlot.classId));
                                setEntries(cleared);
                                setEditSlot(null);
                            }} className="w-full py-4 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 rounded-2xl">Clear this Slot</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const TransportTracker: React.FC = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-100 rounded-2xl h-[500px] relative overflow-hidden shadow-lg border border-slate-200 group">
                <div className="absolute inset-0 bg-slate-200 flex items-center justify-center">
                    <Map className="w-20 h-20 text-slate-400 opacity-50"/>
                    <p className="absolute mt-24 text-slate-500 font-medium">Interactive Map Placeholder</p>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-bounce">
                    <div className="bg-yellow-500 p-2 rounded-full shadow-xl border-4 border-white">
                        <Bus className="w-6 h-6 text-slate-900"/>
                    </div>
                    <div className="bg-white px-3 py-1 rounded-full text-xs font-bold shadow-md mt-2">Bus 14</div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg text-slate-800 mb-4">Route Info: Route 4A</h3>
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="w-6 h-6 text-slate-500"/>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Driver</p>
                            <p className="font-bold text-slate-900">Mr. Sunday Okoro</p>
                            <p className="text-xs text-indigo-600 font-bold">+234 800 555 0199</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export const HostelManager: React.FC = () => {
    const rooms = Array.from({length: 8}, (_, i) => ({ id: 101 + i, occupancy: Math.floor(Math.random() * 5), capacity: 4, gender: i < 4 ? 'Male' : 'Female' }));
    return (
        <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {rooms.map(room => (
                    <div key={room.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-500 transition-colors cursor-pointer group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 p-1 px-2 text-[10px] font-bold text-white rounded-bl-lg ${room.gender === 'Male' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                            {room.gender === 'Male' ? 'Boys' : 'Girls'}
                        </div>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-2xl font-bold text-slate-800">{room.id}</span>
                            <Bed className="w-5 h-5 text-slate-400"/>
                        </div>
                        <p className="text-xs text-slate-500">{room.occupancy} / {room.capacity} Students</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const HealthClinic: React.FC = () => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-red-50">
                <div>
                    <h2 className="text-lg font-bold text-red-900 flex items-center gap-2"><Stethoscope className="w-5 h-5"/> Student Health Records</h2>
                    <p className="text-xs text-red-700">Confidential Medical Data</p>
                </div>
                <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700">Log New Visit</button>
            </div>
            <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50">
                    <tr><th className="p-4">Student</th><th className="p-4">Condition</th><th className="p-4">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    <tr><td className="p-4 font-bold">David Okon</td><td className="p-4">Malaria</td><td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Discharged</span></td></tr>
                </tbody>
            </table>
        </div>
    )
}

export const VisitorLog: React.FC = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5"/> Gate Pass Entry</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Visitor Name" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"/>
                    <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700">Generate Pass</button>
                </div>
            </div>
        </div>
    )
}

export const CafeteriaMenu: React.FC = () => {
    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Weekly Menu</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    { day: 'Monday', meal: 'Jollof Rice & Chicken', price: 1200, img: 'bg-orange-100' },
                    { day: 'Friday', meal: 'Fried Rice & Beef', price: 1300, img: 'bg-green-100' },
                ].map((m, i) => (
                    <div key={i} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition-all group">
                        <div className={`h-32 ${m.img} flex items-center justify-center`}>
                            <Utensils className="w-12 h-12 text-slate-400 opacity-50"/>
                        </div>
                        <div className="p-4">
                            <h3 className="font-bold text-lg text-slate-800">{m.day}</h3>
                            <p className="text-slate-500 text-sm mb-4">{m.meal}</p>
                            <button className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors">Pre-order</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
