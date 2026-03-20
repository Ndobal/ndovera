
import React, { useState } from 'react';
import { 
    ShieldCheck, QrCode, Search, Plus, 
    X, CheckCircle, Clock, User, 
    Trash2, Save, Printer, Smartphone, 
    Fingerprint, Lock, ShieldAlert
} from 'lucide-react';
import { GatePass, UserRole } from '../types';

const MOCK_PASSES: GatePass[] = [
    { id: 'GP-1029', visitorName: 'Okon Sunday', purpose: 'Home Tutor', hostId: 'p1', hostName: 'Mr. Adeyemi', hostRole: UserRole.PARENT, status: 'APPROVED', validUntil: '2024-12-05 18:00', createdAt: '2024-11-28 09:00' },
    { id: 'GP-3342', visitorName: 'Ngozi Bello', purpose: 'Pick-up', hostId: 'p1', hostName: 'Mr. Adeyemi', hostRole: UserRole.PARENT, status: 'EXPIRED', validUntil: '2024-11-27 15:00', createdAt: '2024-11-27 10:00' },
];

export const SecurityPassModule: React.FC<{ role: UserRole; userName: string }> = ({ role, userName }) => {
    const [view, setView] = useState<'MY_PASSES' | 'CHECKPOINT' | 'ISSUE'>('MY_PASSES');
    const [passes, setPasses] = useState<GatePass[]>(MOCK_PASSES);
    const [searchQuery, setSearchQuery] = useState('');
    const [newPass, setNewPass] = useState<Partial<GatePass>>({ visitorName: '', purpose: '', validUntil: '' });

    const isSecurity = role === UserRole.SCHOOL_ADMIN || role === UserRole.SUPER_ADMIN || role === UserRole.SCHOOL_OWNER;

    const handleIssuePass = () => {
        if (!newPass.visitorName || !newPass.validUntil) return;
        const pass: GatePass = {
            id: `GP-${Math.floor(1000 + Math.random() * 9000)}`,
            visitorName: newPass.visitorName,
            purpose: newPass.purpose || 'General Visit',
            hostId: 'current-user',
            hostName: userName,
            hostRole: role,
            status: 'APPROVED',
            validUntil: newPass.validUntil,
            createdAt: new Date().toLocaleString()
        };
        setPasses([pass, ...passes]);
        setView('MY_PASSES');
        setNewPass({ visitorName: '', purpose: '', validUntil: '' });
    };

    const verifyPass = (id: string) => {
        setPasses(prev => prev.map(p => p.id === id ? { ...p, status: 'USED' } : p));
        alert("Pass Verified & Authenticated for Entry.");
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-indigo-600">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Sanctuary Gate</h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Authorized Perimeter Access Control</p>
                    </div>
                    <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <button onClick={() => setView('MY_PASSES')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'MY_PASSES' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Pass Ledger</button>
                        {isSecurity && (
                            <button onClick={() => setView('CHECKPOINT')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'CHECKPOINT' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Checkpoint</button>
                        )}
                        <button onClick={() => setView('ISSUE')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'ISSUE' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>Issue Pass</button>
                    </div>
                </div>
                <QrCode className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            {view === 'MY_PASSES' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {passes.map(pass => (
                        <div key={pass.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="flex justify-between items-center">
                                    <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase border ${
                                        pass.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-100' : 
                                        pass.status === 'EXPIRED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400'
                                    }`}>{pass.status}</span>
                                    <span className="font-black text-indigo-600 text-sm">{pass.id}</span>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visitor Identity</p>
                                    <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">{pass.visitorName}</h4>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Lock className="w-3 h-3"/> Purpose: {pass.purpose}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Clock className="w-3 h-3"/> Valid Until: {pass.validUntil}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl"><Printer className="w-4 h-4"/> Get PDF</button>
                                    <button className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100"><Smartphone className="w-5 h-5"/></button>
                                </div>
                            </div>
                            <QrCode className="absolute right-[-10px] bottom-[-10px] w-24 h-24 opacity-[0.03] rotate-12"/>
                        </div>
                    ))}
                </div>
            )}

            {view === 'ISSUE' && (
                <div className="max-w-3xl mx-auto bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl space-y-10 animate-scale-in">
                    <div className="text-center space-y-2">
                        <h3 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900">Pass Identification</h3>
                        <p className="text-slate-400 font-medium italic text-sm">Create an authorized visitor credential for campus entry.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Legal Name of Visitor</label>
                            <input value={newPass.visitorName} onChange={e => setNewPass({...newPass, visitorName: e.target.value})} placeholder="e.g. John Doe" className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-bold outline-none focus:ring-4 ring-indigo-50" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Reason for Entry</label>
                            <input value={newPass.purpose} onChange={e => setNewPass({...newPass, purpose: e.target.value})} placeholder="e.g. Private Tutoring" className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-bold outline-none focus:ring-4 ring-indigo-50" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Validity Horizon</label>
                            <input type="datetime-local" value={newPass.validUntil} onChange={e => setNewPass({...newPass, validUntil: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-black outline-none focus:ring-4 ring-indigo-50" />
                        </div>
                    </div>

                    <button onClick={handleIssuePass} className="w-full bg-indigo-600 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                        <ShieldCheck className="w-6 h-6"/> Authenticate & Issue
                    </button>
                </div>
            )}

            {view === 'CHECKPOINT' && isSecurity && (
                <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl space-y-12 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div>
                            <h3 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">Security Checkpoint</h3>
                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">Active Protocol: Identity Verification</p>
                        </div>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Enter Pass ID or Visitor Name..." className="w-full bg-slate-50 p-6 pl-16 rounded-[2rem] outline-none border border-slate-100 font-bold" />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">
                                <tr>
                                    <th className="p-8">Fleet ID</th>
                                    <th className="p-8">Visitor</th>
                                    <th className="p-8">Host (Issuer)</th>
                                    <th className="p-8">Protocol Status</th>
                                    <th className="p-8 text-right">Verification</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {passes.map(pass => (
                                    <tr key={pass.id} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="p-8 font-black text-indigo-600">{pass.id}</td>
                                        <td className="p-8 font-bold text-slate-900 uppercase text-xs">{pass.visitorName}</td>
                                        <td className="p-8">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 text-xs uppercase">{pass.hostName}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{pass.hostRole}</span>
                                            </div>
                                        </td>
                                        <td className="p-8">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${
                                                pass.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-100' : 
                                                pass.status === 'EXPIRED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-100 text-slate-400'
                                            }`}>{pass.status}</span>
                                        </td>
                                        <td className="p-8 text-right">
                                            {pass.status === 'APPROVED' ? (
                                                <button onClick={() => verifyPass(pass.id)} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-600">Approve Entry</button>
                                            ) : (
                                                <button disabled className="bg-slate-100 text-slate-400 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest">Locked</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
