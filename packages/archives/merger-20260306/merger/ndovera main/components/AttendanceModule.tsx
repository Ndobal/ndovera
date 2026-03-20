
import React, { useState, useEffect } from 'react';
import { 
    Clock, ShieldCheck, UserCheck, AlertTriangle, 
    Smartphone, Lock, LogIn, CheckCircle, X, 
    Calendar as CalendarIcon, Info, Users, Fingerprint
} from 'lucide-react';
import { StaffMember, AttendanceRecord, LatenessConfig, AuthorizedDevice, Holiday } from '../types';

const MOCK_STAFF: StaffMember[] = [
    { id: 'st1', name: 'Mrs. Florence O.', role: 'Senior Teacher', section: 'PRIMARY' as any, gender: 'FEMALE', department: 'Arts', phone: '0801', email: 'florence@school.edu', status: 'ACTIVE', currentSchoolId: 's1', employmentType: 'FULL_TIME', baseSalary: 150000, bankName: 'Ndovera Bank', accountNumber: '0123456789' },
    { id: 'st2', name: 'Mr. Ibeke George', role: 'HOD Science', section: 'SSS' as any, gender: 'MALE', department: 'Science', phone: '0802', email: 'ibeke@school.edu', status: 'ACTIVE', currentSchoolId: 's1', employmentType: 'FULL_TIME', baseSalary: 185000, bankName: 'Ndovera Bank', accountNumber: '9876543210' },
];

export const AttendanceModule: React.FC<{ config: LatenessConfig; holidays: Holiday[] }> = ({ config, holidays }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [staffId, setStaffId] = useState('');
    const [pin, setPin] = useState('');
    const [isAuthorizedDevice, setIsAuthorizedDevice] = useState(false);
    const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [lastRecord, setLastRecord] = useState<AttendanceRecord | null>(null);

    // Device Whitelisting Simulation
    useEffect(() => {
        const deviceId = localStorage.getItem('NDOVERA_DEVICE_ID');
        if (deviceId === 'ND-772-KIOSK') setIsAuthorizedDevice(true);
        
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleClockIn = (e: React.FormEvent) => {
        e.preventDefault();
        const staff = MOCK_STAFF.find(s => s.id === staffId || s.phone === staffId);
        
        if (!staff) {
            setStatus('ERROR');
            setTimeout(() => setStatus('IDLE'), 3000);
            return;
        }

        // Calculation Logic
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const isHoliday = holidays.some(h => h.date === todayStr);

        const [h, m] = config.resumptionTime.split(':').map(Number);
        const deadline = new Date();
        deadline.setHours(h, m + config.gracePeriodMinutes, 0, 0);

        // Lateness = 0 if Holiday or system disabled
        const isLate = !isHoliday && config.isEnabled && now > deadline;
        const fine = isLate ? config.finePerDay : 0;

        const record: AttendanceRecord = {
            id: Date.now().toString(),
            staffId: staff.id,
            staffName: staff.name,
            date: now.toLocaleDateString(),
            clockInTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            deviceId: 'ND-772-KIOSK',
            isLate,
            fineAmount: fine
        };

        setLastRecord(record);
        setStatus('SUCCESS');
        setStaffId('');
        setPin('');
        
        setTimeout(() => setStatus('IDLE'), 4000);
    };

    if (!isAuthorizedDevice) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-10 animate-fade-in">
                    <div className="w-24 h-24 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/30">
                        <Lock className="w-12 h-12"/>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Security Gate.</h2>
                        <p className="text-slate-400 font-medium">This device is not registered for attendance. Access is restricted to authorized school tablets only.</p>
                    </div>
                    <button 
                        onClick={() => {
                            localStorage.setItem('NDOVERA_DEVICE_ID', 'ND-772-KIOSK');
                            window.location.reload();
                        }}
                        className="bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-2xl"
                    >
                        Register Kiosk Identity
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-4xl bg-white rounded-[4rem] shadow-3xl overflow-hidden border border-slate-100 flex flex-col md:flex-row">
                {/* Left: Info Panel */}
                <div className="w-full md:w-[400px] bg-indigo-900 p-16 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10 space-y-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner"><Clock className="w-6 h-6"/></div>
                            <div>
                                <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Clock-In</h3>
                                <p className="text-indigo-400 font-bold uppercase text-[9px] tracking-widest mt-2">Institutional Kiosk ND-772</p>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-5xl font-black italic tracking-tighter">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                            <p className="text-indigo-400 font-black uppercase text-[10px] tracking-widest">{currentTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-indigo-300">
                                <span>Resumption</span>
                                <span className="text-white">{config.resumptionTime} AM</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-indigo-300">
                                <span>Grace Period</span>
                                <span className="text-white">{config.gracePeriodMinutes} MINS</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="relative z-10 flex items-center gap-3 text-[9px] font-black uppercase text-indigo-400 tracking-widest">
                        <ShieldCheck className="w-4 h-4"/> Authorized Campus Device
                    </div>
                    <Smartphone className="absolute right-[-40px] bottom-[-40px] w-80 h-80 opacity-5 rotate-12"/>
                </div>

                {/* Right: Interaction Panel */}
                <div className="flex-1 p-16 flex flex-col justify-center">
                    {status === 'SUCCESS' && lastRecord ? (
                        <div className="text-center space-y-8 animate-scale-in">
                            <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle className="w-12 h-12"/></div>
                            <div>
                                <h4 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">Morning, {lastRecord.staffName.split(' ')[0]}!</h4>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-3">Clock-In Registered at {lastRecord.clockInTime}</p>
                            </div>
                            {lastRecord.isLate ? (
                                <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2rem] flex flex-col items-center">
                                    <AlertTriangle className="text-red-500 w-6 h-6 mb-2"/>
                                    <p className="text-red-900 font-black text-xs uppercase tracking-widest">Lateness Flag Detected</p>
                                    <p className="text-red-600 text-[9px] font-bold uppercase mt-1">Automatic Fine: ₦{lastRecord.fineAmount}</p>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border-2 border-emerald-100 p-6 rounded-[2rem] flex flex-col items-center">
                                    <UserCheck className="text-emerald-500 w-6 h-6 mb-2"/>
                                    <p className="text-emerald-900 font-black text-xs uppercase tracking-widest">Perfect Punctuality</p>
                                    <p className="text-emerald-600 text-[9px] font-bold uppercase mt-1">Institutional record verified.</p>
                                </div>
                            )}
                        </div>
                    ) : status === 'ERROR' ? (
                        <div className="text-center space-y-8 animate-scale-in">
                            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><X className="w-12 h-12"/></div>
                            <div>
                                <h4 className="text-3xl font-black italic uppercase tracking-tight text-slate-900">Verification Failed</h4>
                                <p className="text-slate-500 font-medium mt-2 italic">No staff found with that ID or Phone. Please re-enter.</p>
                            </div>
                            <button onClick={() => setStatus('IDLE')} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:underline">Try Again</button>
                        </div>
                    ) : (
                        <form onSubmit={handleClockIn} className="space-y-10 animate-fade-in">
                            <div>
                                <h4 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Identify to Proceed</h4>
                                <p className="text-slate-400 font-medium mt-2 italic">"Enter your Staff ID or registered phone number."</p>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="relative">
                                    <Users className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                                    <input 
                                        required
                                        value={staffId}
                                        onChange={e => setStaffId(e.target.value)}
                                        placeholder="Staff ID / Phone" 
                                        className="w-full bg-slate-50 border-2 border-slate-100 p-6 pl-16 rounded-3xl outline-none focus:ring-4 ring-indigo-50 font-black text-lg transition-all"
                                    />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                                    <input 
                                        required
                                        type="password"
                                        value={pin}
                                        onChange={e => setPin(e.target.value)}
                                        placeholder="Security PIN" 
                                        className="w-full bg-slate-50 border-2 border-slate-100 p-6 pl-16 rounded-3xl outline-none focus:ring-4 ring-indigo-50 font-black text-lg transition-all"
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95">
                                <LogIn className="w-5 h-5"/> Verify & Clock-In
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
