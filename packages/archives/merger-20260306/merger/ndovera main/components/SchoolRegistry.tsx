
import React, { useState, useMemo } from 'react';
import { 
    Search, Database, X, RefreshCw, CheckCircle2, XCircle, MoreVertical, 
    Check, Info, ShieldAlert, Users, UserCheck, ChevronLeft, ChevronRight, Globe, Shield, UserPlus, CreditCard, Landmark, DollarSign
} from 'lucide-react';
import { SchoolSection, Student, TransferStatus, StaffMember } from '../types';

const OnboardStaffModal: React.FC<{ onClose: () => void; onSave: (staff: StaffMember) => void }> = ({ onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<StaffMember>>({
        name: '', role: 'Teacher', section: SchoolSection.PRIMARY, gender: 'FEMALE',
        department: 'General', baseSalary: 150000, bankName: '', accountNumber: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.bankName || !formData.accountNumber) return alert("Financial details are mandatory for institutional compliance.");
        onSave({ ...formData, id: `st-${Date.now()}`, status: 'ACTIVE', currentSchoolId: 'current', employmentType: 'FULL_TIME' } as StaffMember);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="bg-white rounded-[4rem] w-full max-w-2xl overflow-hidden shadow-3xl animate-scale-in border border-slate-100">
                <div className="p-10 bg-indigo-600 text-white flex justify-between items-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-3xl font-black italic uppercase tracking-tight">Institutional Onboarding</h3>
                        <p className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest mt-2">Authenticated Faculty Registration</p>
                    </div>
                    <button onClick={onClose} className="relative z-10 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-8 h-8"/></button>
                    <UserPlus className="absolute right-[-20px] bottom-[-20px] w-64 h-64 opacity-10 rotate-12"/>
                </div>
                <form onSubmit={handleSubmit} className="p-12 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Legal Name</label>
                            <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Institutional Role</label>
                            <input required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 font-bold outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Base Salary (₦)</label>
                            <input type="number" required value={formData.baseSalary} onChange={e => setFormData({...formData, baseSalary: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 font-black outline-none" />
                        </div>
                    </div>

                    <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100 space-y-6">
                        <h4 className="text-xs font-black uppercase text-amber-900 flex items-center gap-2 tracking-widest"><CreditCard className="w-4 h-4"/> Financial Disbursement Registry</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black uppercase text-amber-700 block mb-1">Bank Name</label>
                                <input required value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} className="w-full bg-white p-3 rounded-xl border border-amber-200 font-bold outline-none" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase text-amber-700 block mb-1">Account Number</label>
                                <input required value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} className="w-full bg-white p-3 rounded-xl border border-amber-200 font-bold outline-none" />
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-black transition-all">Authenticate & Hire Staff</button>
                </form>
            </div>
        </div>
    );
};

export const SchoolRegistry: React.FC<{ isAdminMode?: boolean }> = ({ isAdminMode }) => {
    const [view, setView] = useState<'STAFF' | 'STUDENTS'>('STAFF');
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnboardModal, setShowOnboardModal] = useState(false);

    const [staffList, setStaffList] = useState<StaffMember[]>(Array.from({ length: 20 }, (_, i) => ({
        id: `st-${i}`, name: `Staff Member ${i+1}`, role: 'Teacher', section: SchoolSection.PRIMARY, gender: 'FEMALE',
        department: 'General', phone: '0800', email: `staff${i}@school.edu`, status: 'ACTIVE', currentSchoolId: 'lagoon',
        employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789'
    })));

    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return staffList.filter(s => s.name.toLowerCase().includes(query)).sort((a,b) => a.name.localeCompare(b.name));
    }, [staffList, searchQuery]);

    return (
        <div className="space-y-6 flex flex-col h-full animate-fade-in">
            {showOnboardModal && <OnboardStaffModal onClose={() => setShowOnboardModal(false)} onSave={(s) => setStaffList([s, ...staffList])} />}
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    {(['STAFF', 'STUDENTS'] as const).map(t => (
                        <button key={t} onClick={() => setView(t)} className={`px-6 py-2 rounded-md text-xs font-black uppercase transition-all ${view === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{t} REGISTER</button>
                    ))}
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {view === 'STAFF' && isAdminMode && (
                        <button onClick={() => setShowOnboardModal(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2 shadow-md">
                            <UserPlus className="w-4 h-4"/> Onboard Staff
                        </button>
                    )}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name..." className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none" />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            <tr>
                                <th className="p-5">Name</th>
                                <th className="p-5">Role</th>
                                <th className="p-5">Financial Status</th>
                                <th className="p-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredItems.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-5 flex items-center gap-4">
                                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-black text-xs">{s.name[0]}</div>
                                        <span className="font-bold text-slate-900 text-sm">{s.name}</span>
                                    </td>
                                    <td className="p-5 text-xs font-bold text-slate-500 uppercase">{s.role}</td>
                                    <td className="p-5">
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${s.bankName ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                            {s.bankName ? 'Financials Locked' : 'Pending Bank Details'}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right"><button className="text-slate-300 hover:text-indigo-600"><MoreVertical className="w-4 h-4"/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
