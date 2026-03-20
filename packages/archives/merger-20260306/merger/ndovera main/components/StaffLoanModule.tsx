
import React, { useState, useMemo } from 'react';
import { 
    Banknote, FileText, Send, CheckCircle, Clock, 
    X, AlertTriangle, ShieldCheck, History, Edit3, 
    ArrowRight, Calculator, Download, UserCheck, Landmark
} from 'lucide-react';
import { StaffLoan, UserRole, LoanStatus, LoanAudit } from '../types';

interface Props {
  role: UserRole;
  staffName?: string;
  staffId?: string;
  loans: StaffLoan[];
  onUpdateLoans: (loans: StaffLoan[]) => void;
}

export const StaffLoanModule: React.FC<Props> = ({ role, staffName = "Mr. Staff", staffId = "st_001", loans, onUpdateLoans }) => {
  const [view, setView] = useState<'LIST' | 'APPLY' | 'REVIEW' | 'LETTER'>('LIST');
  const [selectedLoan, setSelectedLoan] = useState<StaffLoan | null>(null);
  
  // Application State
  const [amount, setAmount] = useState<number>(0);
  const [months, setMonths] = useState<number>(1);
  const [startMonth, setStartMonth] = useState('January 2026');
  const [hosDeductionOverride, setHosDeductionOverride] = useState<number>(0);

  const monthlyDeduction = useMemo(() => Math.ceil(amount / months), [amount, months]);

  const letterTemplate = (name: string, amt: number, m: number, d: number, s: string) => `
TO: THE MANAGEMENT, LAGOON ACADEMY
FROM: ${name} (Staff ID: ${staffId})
DATE: ${new Date().toLocaleDateString()}

SUBJECT: APPLICATION FOR INSTITUTIONAL STAFF LOAN

I, ${name}, hereby formally apply for an institutional staff loan of ₦${amt.toLocaleString()} to be repaid over a period of ${m} months. 

I agree to a monthly salary deduction of ₦${d.toLocaleString()} starting from the payroll cycle of ${s}, until the principal is fully recovered. I understand that this agreement is binding and will be cryptographically logged on the Ndovera Institutional Ledger.

Signed,
${name}
`;

  const handleApply = () => {
    if (amount <= 0) return;
    const newLoan: StaffLoan = {
      id: `LN-${Date.now()}`,
      staffId,
      staffName,
      amount,
      monthlyDeduction,
      totalMonths: months,
      startMonth,
      repaidAmount: 0,
      status: 'REQUESTED',
      letterText: letterTemplate(staffName, amount, months, monthlyDeduction, startMonth),
      auditTrail: [{
        status: 'REQUESTED',
        timestamp: new Date().toLocaleString(),
        note: 'Initial application submitted by staff.',
        actorName: staffName
      }]
    };
    onUpdateLoans([newLoan, ...loans]);
    setView('LIST');
    setAmount(0); setMonths(1);
  };

  const updateStatus = (loan: StaffLoan, status: LoanStatus, note: string) => {
    const audit: LoanAudit = { status, timestamp: new Date().toLocaleString(), note, actorName: role === UserRole.TEACHER ? staffName : 'Administrator' };
    const updated: StaffLoan = { 
        ...loan, 
        status, 
        auditTrail: [...loan.auditTrail, audit],
        monthlyDeduction: status === 'HOS_ADJUSTED' ? hosDeductionOverride : loan.monthlyDeduction,
        // Regenerate letter text if adjusted
        letterText: status === 'HOS_ADJUSTED' ? letterTemplate(loan.staffName, loan.amount, loan.totalMonths, hosDeductionOverride, loan.startMonth) : loan.letterText
    };
    onUpdateLoans(loans.map(l => l.id === loan.id ? updated : l));
    setSelectedLoan(null);
    setView('LIST');
  };

  const isStaff = role === UserRole.TEACHER;
  const isHOS = role === UserRole.SCHOOL_OWNER || role === UserRole.SCHOOL_ADMIN;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-amber-400">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
          <div>
            <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Loan Sanctuary</h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Staff Welfare & Capital Disbursement Hub</p>
          </div>
          {isStaff && (
            <button onClick={() => setView('APPLY')} className="bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-3">
              <Banknote className="w-5 h-5 text-indigo-600"/> New Loan Request
            </button>
          )}
        </div>
        <Landmark className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
      </div>

      {view === 'APPLY' && (
        <div className="max-w-4xl mx-auto bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl space-y-10 animate-scale-in">
          <div className="flex justify-between items-center">
            <h3 className="text-3xl font-black italic uppercase tracking-tight">Loan Initiation</h3>
            <button onClick={() => setView('LIST')} className="p-3 text-slate-300 hover:text-red-500"><X className="w-8 h-8"/></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Principal Amount (₦)</label>
                  <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 font-black text-2xl outline-none focus:border-indigo-500"/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Duration (Months)</label>
                    <select value={months} onChange={e => setMonths(Number(e.target.value))} className="w-full bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 font-bold outline-none">
                      {[1,2,3,4,5,6,12].map(m => <option key={m} value={m}>{m} Months</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Monthly Deduction</label>
                    <div className="w-full bg-indigo-50 p-6 rounded-3xl border-2 border-indigo-100 font-black text-indigo-600">₦{monthlyDeduction.toLocaleString()}</div>
                  </div>
                </div>
            </div>

            <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 flex flex-col justify-center items-center text-center space-y-4">
                <FileText className="w-16 h-16 text-indigo-200" />
                <p className="text-slate-500 font-medium leading-relaxed italic">"Repayment will start from <b>{startMonth}</b> and be automatically recovered from your payroll cycle."</p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-10 rounded-[3rem] space-y-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Institutional Agreement Preview</p>
            <pre className="text-sm font-medium italic opacity-80 whitespace-pre-wrap leading-relaxed">{letterTemplate(staffName, amount, months, monthlyDeduction, startMonth)}</pre>
            <button onClick={handleApply} className="w-full bg-amber-400 text-slate-900 py-8 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:scale-105 transition-all">Agree & Submit for HOS Acknowledgment</button>
          </div>
        </div>
      )}

      {view === 'LIST' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loans.map(loan => (
            <div key={loan.id} className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-xl space-y-8 group hover:shadow-2xl transition-all relative overflow-hidden">
                <div className="flex justify-between items-start">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${
                        loan.status === 'DISBURSED' ? 'bg-green-50 text-green-600 border-green-100' : 
                        loan.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>{loan.status.replace('_', ' ')}</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase">{loan.id}</span>
                </div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Principal Asset</p>
                    <h4 className="text-4xl font-black italic tracking-tighter text-slate-900">₦{loan.amount.toLocaleString()}</h4>
                    {isHOS && <p className="text-xs font-bold text-indigo-600 mt-2">Staff: {loan.staffName}</p>}
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                        <span>Recovery</span>
                        <span className="text-slate-900">₦{loan.monthlyDeduction.toLocaleString()}/mo</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                        <span>Duration</span>
                        <span className="text-slate-900">{loan.totalMonths} Months</span>
                    </div>
                </div>

                {isHOS && loan.status === 'REQUESTED' && (
                  <button onClick={() => { setSelectedLoan(loan); setHosDeductionOverride(loan.monthlyDeduction); setView('REVIEW'); }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Acknowledge & Review</button>
                )}

                {isStaff && loan.status === 'HOS_ADJUSTED' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-[10px] font-bold text-amber-900 text-center italic">HOS adjusted repayment to ₦{loan.monthlyDeduction.toLocaleString()}</div>
                    <button onClick={() => updateStatus(loan, 'STAFF_REVERIFIED', 'Staff accepted HOS adjustments.')} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest">Verify New Terms</button>
                  </div>
                )}

                {isStaff && loan.status === 'OWNER_APPROVED' && (
                  <button onClick={() => updateStatus(loan, 'DISBURSED', 'Staff verified receipt of loan funds.')} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest">I have received funds</button>
                )}
            </div>
          ))}
          {loans.length === 0 && (
            <div className="col-span-full p-20 text-center text-slate-300 italic uppercase font-black tracking-widest border-4 border-dashed border-slate-50 rounded-[4rem]">No active loan sessions.</div>
          )}
        </div>
      )}

      {view === 'REVIEW' && selectedLoan && (
        <div className="max-w-3xl mx-auto bg-white p-12 rounded-[4rem] shadow-2xl animate-scale-in space-y-10 border border-slate-100">
            <div className="flex justify-between items-center">
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">HOS Desk Audit</h3>
                <button onClick={() => setView('LIST')} className="p-2"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="p-10 bg-slate-900 text-white rounded-[3rem] space-y-6">
                <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Current Agreement Letter</p>
                <pre className="text-sm font-medium italic opacity-70 whitespace-pre-wrap leading-relaxed">{selectedLoan.letterText}</pre>
            </div>

            <div className="space-y-6">
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Adjust Monthly Repayment (Optional)</label>
                <div className="flex items-center gap-4">
                    <input type="number" value={hosDeductionOverride} onChange={e => setHosDeductionOverride(Number(e.target.value))} className="flex-1 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 font-black text-2xl outline-none" />
                    <button onClick={() => updateStatus(selectedLoan, 'HOS_ADJUSTED', `Repayment adjusted from ₦${selectedLoan.monthlyDeduction} to ₦${hosDeductionOverride}`)} className="bg-indigo-600 text-white px-8 py-6 rounded-3xl font-black text-xs uppercase tracking-widest">Save & Send to Staff</button>
                </div>
                <p className="text-[10px] text-slate-400 font-bold italic">"If you adjust the repayment amount, the staff must re-verify the contract before escalation."</p>
            </div>

            {selectedLoan.status === 'REQUESTED' && hosDeductionOverride === selectedLoan.monthlyDeduction && (
                <button onClick={() => updateStatus(selectedLoan, 'HOS_FILED', 'HOS acknowledged and filed for owner review.')} className="w-full bg-slate-900 text-white py-8 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3">
                    <Send className="w-5 h-5" /> File & Escalate to Owner
                </button>
            )}
        </div>
      )}
    </div>
  );
};
