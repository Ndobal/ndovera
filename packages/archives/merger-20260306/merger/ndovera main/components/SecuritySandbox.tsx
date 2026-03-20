
import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Activity, Terminal, AlertTriangle, Eye, Lock, Unlock, Zap, Server, Globe, Cpu, RefreshCw, X } from 'lucide-react';

interface ThreatLog {
    id: string;
    type: 'CROSS_SCHOOL_ATTEMPT' | 'AD_FARM_FRAUD' | 'LAMS_ABUSE' | 'AUTH_ANOMALY';
    schoolId: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    timestamp: string;
    status: 'FLAGGED' | 'RESOLVED' | 'PENDING';
}

export const SecuritySandbox: React.FC = () => {
    const [logs, setLogs] = useState<ThreatLog[]>([
        { id: '1', type: 'CROSS_SCHOOL_ATTEMPT', schoolId: 'SCH_82', description: 'User tried to access result sheets of SCH_12 via ID manipulation.', severity: 'CRITICAL', timestamp: '2 mins ago', status: 'FLAGGED' },
        { id: '2', type: 'AD_FARM_FRAUD', schoolId: 'SCH_04', description: 'Bot behavior detected in rewarded ad loop. Same device, 400 requests/hr.', severity: 'HIGH', timestamp: '15 mins ago', status: 'PENDING' },
        { id: '3', type: 'LAMS_ABUSE', schoolId: 'SCH_99', description: 'Abnormal accumulation of 5,000 Lams in <1 hour for user U_44.', severity: 'MEDIUM', timestamp: '1 hr ago', status: 'RESOLVED' }
    ]);

    const [isScanning, setIsScanning] = useState(false);

    const runAIScan = () => {
        setIsScanning(true);
        setTimeout(() => setIsScanning(false), 2000);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-slate-950 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-red-600">
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Cyber Sandbox</h2>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Advanced AI Threat Detection & Data Isolation Engine</p>
                    </div>
                    <button onClick={runAIScan} disabled={isScanning} className="bg-red-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-3">
                        {isScanning ? <RefreshCw className="w-5 h-5 animate-spin"/> : <ShieldAlert className="w-5 h-5"/>}
                        Execute System Audit
                    </button>
                </div>
                <Server className="absolute right-[-40px] bottom-[-40px] w-96 h-96 opacity-5 rotate-12"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Live Threat Logs */}
                <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Real-Time Threat Flux</h3>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"/>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Monitor Active</span>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1">
                        {logs.map(log => (
                            <div key={log.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-2xl transition-all">
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                                        log.severity === 'CRITICAL' ? 'bg-red-100 text-red-600' : 
                                        log.severity === 'HIGH' ? 'bg-orange-100 text-orange-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                        <AlertTriangle className="w-6 h-6"/>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <p className="font-black text-slate-900 text-sm">{log.type}</p>
                                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[8px] font-black uppercase">{log.schoolId}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium italic mt-1">"{log.description}"</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{log.timestamp}</span>
                                    <button className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border transition-all ${
                                        log.status === 'FLAGGED' ? 'bg-red-600 text-white border-red-600 shadow-lg' : 
                                        log.status === 'PENDING' ? 'bg-white text-slate-400 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    }`}>
                                        {log.status}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Metrics & Sandbox Info */}
                <div className="space-y-8">
                    <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white space-y-8 shadow-3xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="text-xl font-black italic tracking-tighter uppercase mb-6 flex items-center gap-3"><Terminal className="text-red-500 w-5 h-5"/> Sandbox Metrics</h4>
                            <div className="space-y-8">
                                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Schools</span>
                                    <span className="text-3xl font-black italic">1,402</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Isolation Integrity</span>
                                    <span className="text-3xl font-black italic text-emerald-400">99.9%</span>
                                </div>
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">AI Neural Load</span>
                                        <Zap className="w-4 h-4 text-amber-400"/>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 w-[65%]"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl space-y-6">
                        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-inner"><Lock className="w-8 h-8"/></div>
                        <h4 className="text-lg font-black uppercase text-slate-900 tracking-tight">Security Sandbox Rules</h4>
                        <ul className="space-y-3">
                            {[
                                'Read-only log synchronization.',
                                'Shadow school access detection.',
                                'Lams economy fraud monitoring.',
                                'Multi-device session isolation.'
                            ].map((rule, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-slate-500 font-medium italic">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0"/> {rule}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
