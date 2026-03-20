import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  History, 
  Download, 
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Plus
} from 'lucide-react';
import { Role } from '../types';
import { SchoolGuard } from '../components/SchoolGuard';

export const FinanceView = ({ role }: { role: Role }) => {
  if (role && ['Ami','Super Admin','Owner'].includes(role)) return <SchoolGuard role={role} />
  const [feeManagedBy, setFeeManagedBy] = useState('HOS');
  const [salaryManagedBy, setSalaryManagedBy] = useState('Finance Officer');
  const isFinanceOfficer = role === 'Finance Officer' || role === 'School Admin' || role === 'Super Admin' || role === 'HOS' || role === 'Tenant School Owner';
  const isReadOnlyFee = (role === 'Finance Officer' && feeManagedBy === 'HOS') || (role === 'HOS' && feeManagedBy === 'Finance Officer');
  const isReadOnlySalary = (role === 'Finance Officer' && salaryManagedBy === 'HOS') || (role === 'HOS' && salaryManagedBy === 'Finance Officer');
  const isParent = role === 'Parent';
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'reports'>(isFinanceOfficer ? 'reports' : 'overview');

  const payments = [
    { id: 'PAY-001', date: '2026-01-15', amount: '₦150,000', type: 'Tuition Fee', status: 'Completed' },
    { id: 'PAY-002', date: '2026-01-20', amount: '₦25,000', type: 'Lab Fee', status: 'Completed' },
    { id: 'PAY-003', date: '2026-02-05', amount: '₦15,000', type: 'Sports Fee', status: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            {isFinanceOfficer ? 'Financial Management' : 'Fees & Payments'}
          </h2>
          <p className="text-zinc-500 text-xs">
            {isFinanceOfficer ? 'Manage school-wide finances, track payments, and generate reports.' : 'Manage your school fees and view transaction history.'}
          </p>
        </div>
        <div className="flex gap-2">
          {isFinanceOfficer && (
            <button className="bg-white/5 border border-white/5 text-zinc-400 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-white/10 transition-all">
              <Download size={14} /> Financial Report
            </button>
          )}
          <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2">
            <Plus size={16} /> {isFinanceOfficer ? (isReadOnlyFee ? '(Read Only) View Payment' : 'Record Payment') : 'Make Payment'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Balance Card */}
          <div className={`relative overflow-hidden ${isFinanceOfficer ? 'bg-blue-600' : 'bg-emerald-600'} rounded-3xl p-8 text-white shadow-2xl shadow-emerald-900/20`}>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                    {isFinanceOfficer ? 'Total School Revenue (Term 2)' : 'Total Outstanding Balance'}
                  </p>
                  <h3 className="text-4xl font-mono font-bold mt-1">
                    {isFinanceOfficer ? '₦14.2M' : '₦45,000'}
                  </h3>
                </div>
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                  <Wallet size={24} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase">
                  Term 2, 2026
                </div>
                <p className="text-[10px] font-medium opacity-80">
                  {isFinanceOfficer ? '85% Collection Rate' : 'Due by March 30, 2026'}
                </p>
              </div>
            </div>
            {/* Decorative circles */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-black/10 rounded-full blur-3xl"></div>
          </div>

          {/* Payment History */}
          <div className="card-compact">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent Transactions</h3>
              <button className="text-[10px] font-bold text-emerald-500 hover:underline">View All</button>
            </div>
            <div className="space-y-3">
              {payments.map((pay) => (
                <div key={pay.id} className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-emerald-500">
                      <ArrowUpRight size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-200">{pay.type}</p>
                      <p className="text-[9px] text-zinc-500 font-mono">{pay.id} &bull; {pay.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-white">{pay.amount}</p>
                      <p className="text-[8px] font-bold text-emerald-500 uppercase">{pay.status}</p>
                    </div>
                    <button className="p-2 text-zinc-600 hover:text-white transition-colors">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Methods */}
          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Saved Methods</h3>
            <div className="space-y-3">
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-200">Visa **** 4242</p>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold">Expires 12/28</p>
                </div>
              </div>
              <button className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[10px] font-bold text-zinc-500 hover:text-white hover:border-white/20 transition-all">
                + Add New Method
              </button>
            </div>
          </div>

          {/* Quick Info */}
          <div className="card-compact bg-orange-500/5 border-orange-500/10">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={16} className="text-orange-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500">Payment Notice</h3>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Please ensure all Term 2 fees are cleared before the examination period starts on April 5th to avoid any disruption.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
