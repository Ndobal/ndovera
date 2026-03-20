
import React, { useState, useMemo } from 'react';
import { 
    Landmark, Plus, Save, Trash2, Printer, Search, Download, 
    CreditCard, ShieldCheck, UserCheck, Calculator, FileText, 
    ChevronRight, Eye, Lock, Unlock, History, AlertTriangle, 
    X, CheckCircle, RefreshCw, BarChart3, TrendingUp, Clock, Banknote
} from 'lucide-react';
import { SalaryMonth, SalaryRecord, SalaryColumn, StaffMember, UserRole, SalaryStatus, SalaryRevision, AttendanceRecord, StaffLoan } from '../types';

const MOCK_STAFF: StaffMember[] = [
    { id: 'st1', name: 'Mrs. Florence O.', role: 'Senior Teacher', section: 'PRIMARY' as any, gender: 'FEMALE', department: 'Arts', phone: '0801', email: 'florence@school.edu', status: 'ACTIVE', currentSchoolId: 's1', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
    { id: 'st2', name: 'Mr. Ibeke George', role: 'HOD Science', section: 'SSS' as any, gender: 'MALE', department: 'Science', phone: '0802', email: 'ibeke@school.edu', status: 'ACTIVE', currentSchoolId: 's1', employmentType: 'FULL_TIME', baseSalary: 185000, bankName: 'Ndovera Bank', accountNumber: '9876543210' },
    { id: 'st3', name: 'Miss. Anna Obi', role: 'Teacher', section: 'PRIMARY' as any, gender: 'FEMALE', department: 'General', phone: '0803', email: 'anna@school.edu', status: 'ACTIVE', currentSchoolId: 's1', employmentType: 'FULL_TIME', baseSalary: 120000, bankName: 'Ndovera Bank', accountNumber: '1122334455' },
];

const MOCK_ATTENDANCE: AttendanceRecord[] = [
    { id: 'a1', staffId: 'st2', staffName: 'Mr. Ibeke George', date: '10/11/2024', clockInTime: '08:45 AM', deviceId: 'KIOSK', isLate: true, fineAmount: 500 },
];

export const AccountantModule: React.FC<{ role: UserRole; schoolName: string; logo: string; activeLoans?: StaffLoan[] }> = ({ role, schoolName, logo, activeLoans = [] }) => {
    const [view, setView] = useState<'DASHBOARD' | 'PREPARE'>('DASHBOARD');
    const [activeSalaryMonth, setActiveSalaryMonth] = useState<SalaryMonth | null>(null);
    const [selMonth, setSelMonth] = useState('January');
    const [selYear, setSelYear] = useState(2026);

    const initNewMonth = () => {
        const newMonth: SalaryMonth = {
            id: `${selMonth}-${selYear}`,
            month: selMonth,
            year: selYear,
            status: 'DRAFT',
            columns: [
                { id: 'c1', label: 'Welfare Bonus', type: 'ADDITION' },
                { id: 'c3', label: 'Lateness Deduction', type: 'DEDUCTION' },
                { id: 'c5', label: 'Loan Repayment', type: 'DEDUCTION' }
            ],
            records: MOCK_STAFF.map(s => {
                const lateFines = MOCK_ATTENDANCE.filter(a => a.staffId === s.id && a.isLate).reduce((sum, a) => sum + a.fineAmount, 0);
                
                // Scan for active disbursed loans for this staff and this month
                const activeLoan = activeLoans.find(l => l.staffId === s.id && l.status === 'DISBURSED');
                const loanDeduction = activeLoan ? activeLoan.monthlyDeduction : 0;

                const deductions = { 
                    'Lateness Deduction': lateFines, 
                    'Pension': Math.round(s.baseSalary * 0.08),
                    'Loan Repayment': loanDeduction
                };
                
                const gross = s.baseSalary;
                const totalDeductions = Object.values(deductions).reduce<number>((a, b) => a + b, 0);
                const net = gross - totalDeductions;

                return {
                    staffId: s.id, staffName: s.name, role: s.role,
                    baseSalary: s.baseSalary, additions: {}, deductions,
                    gross, net, bankName: s.bankName, accountNumber: s.accountNumber
                };
            }),
            createdBy: 'Accountant Admin',
            revisions: []
        };
        setActiveSalaryMonth(newMonth);
        setView('PREPARE');
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-slate-950 p-12 rounded-[4rem] text-white shadow-xl relative overflow-hidden border-b-8 border-indigo-600">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Financial Vault</h2>
                        <p className="text-indigo-200 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Automated Payroll & Loan Recovery Engine</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl">
                        <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-3 font-bold text-xs outline-none">
                            {["January", "February", "March", "November", "December"].map(m => <option key={m}>{m}</option>)}
                        </select>
                        <button onClick={initNewMonth} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-indigo-600"/> Open Payroll Cycle
                        </button>
                    </div>
                </div>
            </div>

            {view === 'PREPARE' && activeSalaryMonth && (
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl space-y-8 animate-scale-in">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-black italic uppercase">{activeSalaryMonth.month} {activeSalaryMonth.year} Payroll</h3>
                        <div className="flex gap-2">
                             <span className="px-4 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase border border-amber-100">Draft Status</span>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                                <tr>
                                    <th className="p-6">Staff Member</th>
                                    <th className="p-6">Base Salary</th>
                                    <th className="p-6 text-indigo-600">Additions</th>
                                    <th className="p-6 text-red-600">Deductions</th>
                                    <th className="p-6 font-black">Net Pay</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeSalaryMonth.records.map(record => (
                                    <tr key={record.staffId} className="hover:bg-slate-50">
                                        <td className="p-6">
                                            <p className="font-bold text-slate-900">{record.staffName}</p>
                                            <p className="text-[9px] text-slate-400 uppercase font-black">{record.role}</p>
                                        </td>
                                        <td className="p-6 font-black">₦{record.baseSalary.toLocaleString()}</td>
                                        <td className="p-6">
                                            {Object.keys(record.additions).length === 0 && <span className="text-slate-300">--</span>}
                                        </td>
                                        <td className="p-6">
                                            {Object.entries(record.deductions).map(([l, v]) => (v as number) > 0 && (
                                                <div key={l} className="flex items-center gap-2 mb-1">
                                                    {l === 'Loan Repayment' && <Banknote className="w-3 h-3 text-amber-500"/>}
                                                    <span className="text-[9px] font-bold uppercase text-red-500">{l}: ₦{(v as number).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </td>
                                        <td className="p-6 font-black text-xl italic text-slate-900">₦{record.net.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3">
                         <ShieldCheck className="w-5 h-5"/> Authenticate & Publish Payroll
                    </button>
                </div>
            )}
        </div>
    );
};
