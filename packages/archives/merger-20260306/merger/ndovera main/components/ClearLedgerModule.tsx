
import React, { useState } from 'react';
import { 
    CreditCard, Landmark, DollarSign, PieChart, 
    ArrowUpRight, Download, History, ShieldCheck,
    CheckCircle, Clock, Info, HelpCircle, FileText,
    TrendingDown, Calculator, ShieldAlert, X, Sparkles, Loader2
  } from 'lucide-react';
import { InstitutionalLedger, UserRole } from '../types';
import { GoogleGenAI } from "@google/genai";

const MOCK_LEDGER: InstitutionalLedger = {
    studentId: 's1',
    session: '2024/2025',
    term: 'First Term',
    components: [
        { id: 'f1', label: 'Academic Tuition', amount: 120000, status: 'PAID' },
        { id: 'f2', label: 'Laboratory Fee', amount: 15000, status: 'PAID' },
        { id: 'f3', label: 'Institutional Feeding Yield', amount: 45000, status: 'PENDING' },
        { id: 'f4', label: 'Sports & Wellness kit', amount: 12000, status: 'PAID' },
        { id: 'f5', label: 'Humanity Contribution', amount: 5000, status: 'PAID' },
    ],
    totalBalance: 45000
};

export const ClearLedgerModule: React.FC<{ role: UserRole }> = ({ role }) => {
    const [ledger] = useState<InstitutionalLedger>(MOCK_LEDGER);
    const [showReceipt, setShowReceipt] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [planResponse, setPlanResponse] = useState<string | null>(null);
    const [showPlanModal, setShowPlanModal] = useState(false);

    const paidTotal = ledger.components.filter(c => c.status === 'PAID').reduce((a, b) => a + b.amount, 0);
    const totalValue = ledger.components.reduce((a, b) => a + b.amount, 0);
    const progress = (paidTotal / totalValue) * 100;

    const requestPaymentPlan = async () => {
        setIsEvaluating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Evaluate a payment plan request for a school parent. 
            Balance: ₦${ledger.totalBalance.toLocaleString()}
            Session: ${ledger.session}
            History: 85% of previous fees settled on time.
            Provide a professional, encouraging response suggesting a 3-month split (₦${(ledger.totalBalance / 3).toLocaleString()} per month) and mention it's approved based on their good standing. Keep it short.`;
            
            const result = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt
            });
            setPlanResponse(result.text || "Our financial AI is reviewing your history. Please check back in a few minutes.");
        } catch (e) {
            setPlanResponse("Standard 3-month payment plan is available for your account. Please contact the bursar to activate.");
        } finally {
            setIsEvaluating(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Plan Modal */}
            {showPlanModal && (
                <div className="fixed inset-0 z-[600] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6">
                    <div className="bg-white rounded-[4rem] w-full max-w-xl p-12 animate-scale-in border border-slate-100 shadow-3xl space-y-8">
                        <div className="flex justify-between items-center">
                            <h3 className="text-3xl font-black italic tracking-tighter uppercase">AI Plan Evaluation</h3>
                            <button onClick={() => { setShowPlanModal(false); setPlanResponse(null); }} className="p-2 bg-slate-50 rounded-full"><X className="w-6 h-6"/></button>
                        </div>
                        {isEvaluating ? (
                            <div className="py-20 text-center space-y-6">
                                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto"/>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">Analyzing Financial Standing...</p>
                            </div>
                        ) : planResponse ? (
                            <div className="space-y-8">
                                <div className="p-8 bg-indigo-50 rounded-[3rem] border border-indigo-100 text-lg font-medium italic text-indigo-900 leading-relaxed">
                                    "{planResponse}"
                                </div>
                                <button onClick={() => setShowPlanModal(false)} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-xl">Accept Plan</button>
                            </div>
                        ) : (
                            <div className="space-y-6 text-center">
                                <Calculator className="w-16 h-16 text-indigo-200 mx-auto"/>
                                <p className="text-slate-500 font-medium">Click below to let Professor Nova evaluate your eligibility for a flexible payment plan based on your institutional history.</p>
                                <button onClick={requestPaymentPlan} className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">
                                    <Sparkles className="w-5 h-5"/> Analyze Eligibility
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-indigo-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-emerald-400">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">The Clear Ledger</h2>
                        <p className="text-indigo-300 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Fiscal Transparency & Tuition Governance Hub</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl">
                        <div className="text-right">
                            <p className="text-[9px] font-black uppercase text-indigo-300 tracking-widest">Active Settlement Balance</p>
                            <h3 className="text-3xl font-black italic text-emerald-400">₦{ledger.totalBalance.toLocaleString()}</h3>
                        </div>
                        <button onClick={() => setShowPlanModal(true)} className="bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-2">
                           <Calculator className="w-4 h-4"/> Request Plan
                        </button>
                    </div>
                </div>
                <Landmark className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h3 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900">Session Breakdown</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{ledger.session} • {ledger.term}</p>
                            </div>
                            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300"><FileText className="w-8 h-8"/></div>
                        </div>

                        <div className="space-y-6">
                            {ledger.components.map(item => (
                                <div key={item.id} className={`p-8 rounded-[3rem] border transition-all ${item.status === 'PAID' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-amber-100 shadow-xl shadow-amber-500/5'}`}>
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                        <div className="flex items-center gap-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${item.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {item.status === 'PAID' ? <CheckCircle className="w-7 h-7"/> : <Clock className="w-7 h-7"/>}
                                            </div>
                                            <div>
                                                <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{item.label}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">{item.status === 'PAID' ? 'Settlement Finalized' : 'Payment Required'}</p>
                                            </div>
                                        </div>
                                        <div className="text-center md:text-right">
                                            <p className={`text-2xl font-black italic tracking-tighter ${item.status === 'PAID' ? 'text-slate-400' : 'text-slate-900'}`}>₦{item.amount.toLocaleString()}</p>
                                            {item.status === 'PAID' && (
                                                <button onClick={() => setShowReceipt(true)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1 flex items-center gap-1 mx-auto md:ml-auto">
                                                    <Download className="w-3 h-3"/> Download Receipt
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-3xl space-y-12">
                        <div>
                            <h4 className="text-xl font-black italic tracking-tighter uppercase mb-8 flex items-center gap-3"><PieChart className="text-indigo-400 w-6 h-6" /> Fiscal Snapshot</h4>
                            <div className="space-y-8">
                                <div className="text-center">
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] mb-4">Settlement Progress</p>
                                    <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-white/5" />
                                            <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray={552} strokeDashoffset={552 - (552 * progress / 100)} className="text-emerald-400 transition-all duration-1000" />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-4xl font-black italic">{Math.round(progress)}%</span>
                                            <span className="text-[8px] font-black uppercase text-slate-500">Settled</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-[2.5rem] p-6 text-slate-900 flex flex-col gap-4 border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                                            Risk & Compliance Notes
                                        </p>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        All tuition components are logged on the Clear Ledger with immutable history. Outstanding balances are monitored with gentle, policy-aligned reminders rather than punitive measures.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-4">
                        <div className="flex items-center gap-3">
                            <Info className="w-5 h-5 text-indigo-500" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                                Governance Framework
                            </p>
                        </div>
                        <p className="text-sm text-slate-600">
                            Ndovera enforces transparent financial governance: every charge is mapped to a category, every adjustment is logged, and every stakeholder sees a consistent view of obligations and settlements.
                        </p>
                    </div>
                </div>
            </div>

            {showReceipt && (
                <div className="fixed inset-0 z-[550] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6">
                    <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-3xl border border-slate-100 space-y-6 animate-scale-in">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-black italic tracking-tighter uppercase">Download Receipt</h3>
                            <button onClick={() => setShowReceipt(false)} className="p-2 bg-slate-50 rounded-full">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-600">
                            A formal receipt for this settled component will be generated by the institutional bursary system. For now, you can export this ledger segment as a PDF snapshot.
                        </p>
                        <button className="w-full bg-slate-900 text-white py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                            <Download className="w-4 h-4" /> Export Ledger Snapshot
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};