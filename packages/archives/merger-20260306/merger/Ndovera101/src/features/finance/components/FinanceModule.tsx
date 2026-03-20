import React, { useState } from 'react';
import { Wallet, TrendingUp, AlertCircle, Download, Plus, Sparkles, Gift, ArrowRight, FileText, PieChart, CreditCard, History, Search, Filter } from 'lucide-react';
import { UserRole, SystemConfig, FeeStructure, StudentInvoice } from '../../../shared/types';

const MOCK_STRUCTURES: FeeStructure[] = [
  {
    id: 'fs1',
    classLevel: 'SS3',
    term: 'Second Term',
    session: '2025/2026',
    createdBy: 'Bursar',
    items: [
      { name: 'Tuition Fee', amount: 35000, compulsory: true },
      { name: 'Development Levy', amount: 5000, compulsory: true },
      { name: 'PTA Levy', amount: 2000, compulsory: true },
      { name: 'CBT Fee', amount: 3000, compulsory: true },
    ]
  },
  {
    id: 'fs2',
    classLevel: 'JSS1',
    term: 'Second Term',
    session: '2025/2026',
    createdBy: 'Bursar',
    items: [
      { name: 'Tuition Fee', amount: 25000, compulsory: true },
      { name: 'Development Levy', amount: 5000, compulsory: true },
      { name: 'Activity Fee', amount: 5000, compulsory: false },
    ]
  }
];

const MOCK_INVOICES: StudentInvoice[] = [
  { 
    id: 'inv1', 
    studentId: 's1', 
    studentName: 'Alice Johnson', 
    classLevel: 'SS3', 
    feeStructureId: 'fs1', 
    totalAmount: 45000, 
    paidAmount: 45000, 
    balance: 0, 
    status: 'Paid', 
    dueDate: '2026-03-15',
    installments: [{ date: '2026-02-24', amount: 45000, method: 'Bank Transfer' }]
  },
  { 
    id: 'inv2', 
    studentId: 's2', 
    studentName: 'Bob Wilson', 
    classLevel: 'SS3', 
    feeStructureId: 'fs1', 
    totalAmount: 45000, 
    paidAmount: 15000, 
    balance: 30000, 
    status: 'Partial', 
    dueDate: '2026-03-15',
    installments: [{ date: '2026-02-25', amount: 15000, method: 'POS' }]
  },
  { 
    id: 'inv3', 
    studentId: 's3', 
    studentName: 'Charlie Davis', 
    classLevel: 'JSS1', 
    feeStructureId: 'fs2', 
    totalAmount: 35000, 
    paidAmount: 0, 
    balance: 35000, 
    status: 'Unpaid', 
    dueDate: '2026-03-15',
    installments: []
  },
];

type FinanceTab = 'overview' | 'billing' | 'structures' | 'history' | 'appreciation';

export default function FinanceModule({ role, auras, config }: { role: UserRole; auras: number; config: SystemConfig }) {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const isFinanceAdmin = [UserRole.SUPER_ADMIN, UserRole.PROPRIETOR, UserRole.HOS, UserRole.BURSAR].includes(role);
  const isStaff = [UserRole.SUPER_ADMIN, UserRole.TEACHER, UserRole.HOS, UserRole.PRINCIPAL, UserRole.HEAD_TEACHER, UserRole.NURSERY_HEAD, UserRole.VICE_PRINCIPAL, UserRole.BURSAR, UserRole.ICT_MANAGER, UserRole.ADMIN_OFFICER, UserRole.STAFF].includes(role);
  const isParent = role === UserRole.PARENT;
  const [hasCashedOut, setHasCashedOut] = useState(false);

  // Mock staff data for appreciation
  const staffAppreciation = {
    auras: auras,
    amount: auras * config.auraToNairaRate,
    qualified: auras >= 1000,
    cycle: 'Jan - Feb 2026',
    cashoutAvailable: true 
  };

  if (!isFinanceAdmin && !isStaff && !isParent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Access Restricted</h3>
        <p className="text-slate-500 max-w-xs">Only school staff, management, and parents can access financial records.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit overflow-x-auto">
        {isFinanceAdmin && (
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <PieChart className="w-3.5 h-3.5" />
            Overview
          </button>
        )}
        <button 
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'billing' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          {isParent ? 'My Invoices' : 'Student Billing'}
        </button>
        {isFinanceAdmin && (
          <button 
            onClick={() => setActiveTab('structures')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'structures' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <FileText className="w-3.5 h-3.5" />
            Fee Structures
          </button>
        )}
        {isStaff && (
          <button 
            onClick={() => setActiveTab('appreciation')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'appreciation' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Gift className="w-3.5 h-3.5" />
            Appreciation
          </button>
        )}
        <button 
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <History className="w-3.5 h-3.5" />
          Payment History
        </button>
      </div>

      {activeTab === 'overview' && isFinanceAdmin && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">Total Expected Revenue</p>
              <div className="flex items-end justify-between mt-2">
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">₦12.4M</p>
                <div className="flex items-center text-emerald-600 text-xs font-bold">
                  <TrendingUp className="w-3 h-3 mr-1" /> +8.4%
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">Total Paid</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">₦10.3M</p>
              <p className="text-xs text-slate-400 mt-1">83% Collection Rate</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">Outstanding Balances</p>
              <p className="text-3xl font-bold text-rose-600 mt-2">₦2.1M</p>
              <p className="text-xs text-slate-400 mt-1">From 142 students</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Class-by-Class Breakdown</h3>
            <div className="space-y-4">
              {['SS3', 'SS2', 'SS1', 'JSS3', 'JSS2', 'JSS1'].map((cls) => (
                <div key={cls} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-400">{cls}</span>
                    <span className="text-slate-900 dark:text-slate-100">₦1.2M / ₦1.5M</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '80%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'billing' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{isParent ? 'My Invoices' : 'Student Billing'}</h3>
            {!isParent && (
              <div className="flex gap-2">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <Search className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Invoice ID</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Paid</th>
                  <th className="px-6 py-4">Balance</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {MOCK_INVOICES.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">#{inv.id}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{inv.studentName}</p>
                      <p className="text-[10px] text-slate-400">{inv.classLevel}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">₦{inv.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-emerald-600 font-medium">₦{inv.paidAmount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-rose-600 font-medium">₦{inv.balance.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                        inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                        inv.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-emerald-600 font-bold hover:underline">{isParent ? 'Pay Now' : 'Manage'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'structures' && isFinanceAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MOCK_STRUCTURES.map((struct) => (
            <div key={struct.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100">{struct.classLevel} Structure</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">{struct.term} • {struct.session}</p>
                </div>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-emerald-600">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                {struct.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">₦{item.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Total</span>
                  <span className="text-sm font-bold text-emerald-600">₦{struct.items.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
          <button className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-200 hover:text-emerald-600 transition-all">
            <Plus className="w-8 h-8" />
            <span className="text-sm font-bold">Create New Structure</span>
          </button>
        </div>
      )}

      {activeTab === 'appreciation' && isStaff && (
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Gift className="w-48 h-48" />
          </div>
          
          <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                  <Sparkles className="w-6 h-6 text-amber-300" />
                </div>
                <h3 className="text-xl font-bold">Educentive (Educators' Incentive)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <p className="text-emerald-100 text-sm mb-2">Accumulated Auras ({staffAppreciation.cycle})</p>
                  <p className="text-4xl font-bold mb-4">{staffAppreciation.auras.toLocaleString()} ✨</p>
                  
                  {staffAppreciation.qualified && !hasCashedOut ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                        <p className="text-xs text-emerald-100 uppercase font-bold mb-1">Educentive Fund</p>
                        <p className="text-2xl font-bold">₦{staffAppreciation.amount.toLocaleString()}</p>
                      </div>
                      <button 
                        onClick={() => setHasCashedOut(true)}
                        className="bg-white text-emerald-700 px-8 py-3 rounded-2xl font-bold hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-lg"
                      >
                        Cashout Educentive
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <p className="text-[10px] text-emerald-200 italic">"Only the brave are Educators. Ndovera values your sacrifice."</p>
                    </div>
                  ) : hasCashedOut ? (
                    <div className="p-4 bg-emerald-500/30 backdrop-blur-md rounded-2xl border border-emerald-400/30 flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Educentive Disbursed!</p>
                        <p className="text-xs text-emerald-100">Funds have been sent to your linked bank account.</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-100">Keep farming! You will qualify for Educentive at 1,000 Auras.</p>
                  )}
                </div>

                <div className="hidden md:block p-6 bg-black/10 backdrop-blur-sm rounded-3xl border border-white/5">
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Educentive Rules
                  </h4>
                  <ul className="space-y-3 text-xs text-emerald-50">
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1 shrink-0"></span>
                      Accumulate Auras via Farming Mode in your personal workspace.
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1 shrink-0"></span>
                      Conversion rate: 1 Aura = ₦{config.auraToNairaRate} (Set by Ndovera Platform).
                    </li>
                    <li className="flex gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1 shrink-0"></span>
                      Minimum cashout: 1,000 Auras.
                    </li>
                  </ul>
                </div>
              </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {MOCK_INVOICES.flatMap(inv => inv.installments.map((inst, i) => ({ ...inst, studentName: inv.studentName, id: inv.id + i }))).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{tx.date}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{tx.studentName}</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">₦{tx.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{tx.method}</td>
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400 uppercase">REF-{Math.random().toString(36).substr(2, 9).toUpperCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
