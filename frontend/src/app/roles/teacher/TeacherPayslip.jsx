import React, { useEffect, useState } from 'react';

const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors';

export default function TeacherPayslip({ auth }) {
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    import('../../../features/school/services/schoolApi').then(({ req: _req, getMyPayslip }) => {
      if (typeof getMyPayslip === 'function') {
        getMyPayslip().then(d => setPayslip(d?.payslip || d)).catch(e => setError(e.message)).finally(() => setLoading(false));
      } else {
        // fallback: call directly
        fetch('/api/school/payroll/my-payslip', {
          headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('ndovera_auth') || '{}')?.token || ''}` }
        }).then(r => r.json()).then(d => setPayslip(d?.payslip || d)).catch(e => setError(e.message)).finally(() => setLoading(false));
      }
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 max-w-3xl mx-auto"><div className={CARD}><p className="text-[#800020]">Loading payslip…</p></div></div>;
  if (error) return <div className="p-8 max-w-3xl mx-auto"><div className={CARD}><p className="text-[#800000] text-sm">{error}</p></div></div>;

  const p = payslip || {};
  const gross = p.gross || 0;
  const deductions = p.deductions || 0;
  const net = gross - deductions;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className={CARD}><h1 className="text-2xl font-bold text-[#800000]">My Payslip</h1><p className="text-[#191970] mt-1 text-sm">{month}</p></div>
      <div className={CARD} id="payslip-print">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-[#800000]">{p.schoolName || 'School'}</h2>
          <p className="text-sm text-[#191970]">Staff Payslip — {month}</p>
        </div>
        <div className={`${INNER} mb-4`}>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-[#800020] uppercase font-semibold">Name</p><p className="text-[#191970] font-bold">{p.name || auth?.user?.name || '—'}</p></div>
            <div><p className="text-xs text-[#800020] uppercase font-semibold">Staff ID</p><p className="text-[#191970]">{p.displayId || p.staffId || '—'}</p></div>
            <div><p className="text-xs text-[#800020] uppercase font-semibold">Role</p><p className="text-[#191970]">{p.role || auth?.user?.role || 'teacher'}</p></div>
            <div><p className="text-xs text-[#800020] uppercase font-semibold">Period</p><p className="text-[#191970]">{p.period || month}</p></div>
          </div>
        </div>
        <div className={`${INNER} mb-4`}>
          <p className="text-xs text-[#800020] uppercase font-semibold mb-3">Earnings</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-[#191970]"><span>Basic Salary</span><span>₦{(gross * 0.8).toLocaleString()}</span></div>
            <div className="flex justify-between text-sm text-[#191970]"><span>Housing Allowance</span><span>₦{(gross * 0.12).toLocaleString()}</span></div>
            <div className="flex justify-between text-sm text-[#191970]"><span>Transport Allowance</span><span>₦{(gross * 0.08).toLocaleString()}</span></div>
            <div className="flex justify-between text-sm font-bold text-[#800000] border-t border-[#c9a96e]/40 pt-2 mt-2"><span>Gross Pay</span><span>₦{gross.toLocaleString()}</span></div>
          </div>
        </div>
        <div className={`${INNER} mb-4`}>
          <p className="text-xs text-[#800020] uppercase font-semibold mb-3">Deductions</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-[#191970]"><span>Income Tax</span><span>₦{(deductions * 0.6).toLocaleString()}</span></div>
            <div className="flex justify-between text-sm text-[#191970]"><span>Pension</span><span>₦{(deductions * 0.3).toLocaleString()}</span></div>
            <div className="flex justify-between text-sm text-[#191970]"><span>Other</span><span>₦{(deductions * 0.1).toLocaleString()}</span></div>
            <div className="flex justify-between text-sm font-bold text-red-700 border-t border-[#c9a96e]/40 pt-2 mt-2"><span>Total Deductions</span><span>₦{deductions.toLocaleString()}</span></div>
          </div>
        </div>
        <div className={`${INNER} flex items-center justify-between`}>
          <span className="text-lg font-bold text-[#800020]">NET PAY</span>
          <span className="text-3xl font-bold text-[#1a5c38]">₦{net.toLocaleString()}</span>
        </div>
      </div>
      <button onClick={() => window.print()} className={BTN}>Print Payslip</button>
    </div>
  );
}
