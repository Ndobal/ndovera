import React, { useEffect, useState } from 'react';
import { getPeople, getPayroll, updatePayrollStaff, submitPayroll, getPayrollHistory, getPayrollSettings, savePayrollSettings, getBranding } from '../../../features/school/services/schoolApi';

const TABS = ['Payroll Sheet', 'Payslips', 'History', 'Settings'];
const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors';

function PayslipModal({ staff, month, branding, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`${CARD} w-full max-w-md`}>
        <div className="text-center mb-4"><h2 className="text-lg font-bold text-[#800000]">{branding?.schoolName || 'School'}</h2><p className="text-xs text-[#191970]">Staff Payslip — {month}</p></div>
        <div className={`${INNER} mb-3`}><p className="text-xs text-[#800020] font-semibold">Staff Name</p><p className="text-[#191970] font-bold">{staff.name}</p><p className="text-xs text-[#800020] font-semibold mt-2">Staff ID</p><p className="text-[#191970]">{staff.displayId || staff.id}</p><p className="text-xs text-[#800020] font-semibold mt-2">Role</p><p className="text-[#191970]">{staff.role}</p></div>
        <div className={`${INNER} mb-3`}><p className="text-xs text-[#800020] font-semibold mb-2">Earnings</p><div className="flex justify-between text-sm text-[#191970]"><span>Basic Salary</span><span>₦{((staff.gross || 0) * 0.8).toLocaleString()}</span></div><div className="flex justify-between text-sm text-[#191970]"><span>Allowances</span><span>₦{((staff.gross || 0) * 0.2).toLocaleString()}</span></div><div className="flex justify-between text-sm font-bold text-[#800000] border-t border-[#c9a96e]/40 mt-2 pt-2"><span>Gross Pay</span><span>₦{(staff.gross || 0).toLocaleString()}</span></div></div>
        <div className={`${INNER} mb-3`}><p className="text-xs text-[#800020] font-semibold mb-2">Deductions</p><div className="flex justify-between text-sm text-[#191970]"><span>Tax</span><span>₦{((staff.deductions || 0) * 0.6).toLocaleString()}</span></div><div className="flex justify-between text-sm text-[#191970]"><span>Pension</span><span>₦{((staff.deductions || 0) * 0.3).toLocaleString()}</span></div><div className="flex justify-between text-sm font-bold text-red-700 border-t border-[#c9a96e]/40 mt-2 pt-2"><span>Total Deductions</span><span>₦{(staff.deductions || 0).toLocaleString()}</span></div></div>
        <div className={`${INNER} mb-4 flex justify-between items-center`}><span className="text-[#800020] font-bold">NET PAY</span><span className="text-2xl font-bold text-[#1a5c38]">₦{((staff.gross || 0) - (staff.deductions || 0)).toLocaleString()}</span></div>
        <div className="flex gap-3"><button onClick={() => window.print()} className={BTN}>Print Payslip</button><button onClick={onClose} className="text-[#800020] font-semibold px-4 py-2 text-sm">Close</button></div>
      </div>
    </div>
  );
}

function PayrollSheetTab() {
  const [staff, setStaff] = useState([]);
  const [payroll, setPayroll] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  useEffect(() => {
    Promise.all([getPeople(), getPayroll()]).then(([p, pay]) => {
      setStaff((p?.people || []).filter(u => !['student', 'parent'].includes(u.role)));
      const m = {}; (pay?.payroll || []).forEach(e => { m[e.staffId || e.id] = e; }); setPayroll(m);
      setSubmitted(pay?.submitted === true);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  async function handleBlur(staffId, field, value) { try { await updatePayrollStaff(staffId, { [field]: Number(value) }); } catch {} }
  async function handleSubmit() {
    if (!window.confirm('Submit payroll for owner approval?')) return;
    try { await submitPayroll(); setSubmitted(true); showToast('Submitted for owner approval!'); } catch (e) { showToast(e.message); }
  }
  const net = (id) => { const e = payroll[id] || {}; return (e.gross || 0) - (e.deductions || 0); };
  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}
      {submitted && <div className={`${CARD} flex items-center gap-3`}><span className="text-amber-600 font-bold text-sm">⏳ Pending Owner Approval</span></div>}
      <div className={CARD}>
        {loading ? <p className="text-[#800020] text-sm">Loading...</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40"><th className="pb-2 pr-3">SN</th><th className="pb-2 pr-3">Staff ID</th><th className="pb-2 pr-3">Name</th><th className="pb-2 pr-3">Role</th><th className="pb-2 pr-3">Gross (₦)</th><th className="pb-2 pr-3">Deductions (₦)</th><th className="pb-2 pr-3">Net (₦)</th><th className="pb-2">Status</th></tr></thead>
            <tbody>{staff.map((s, i) => { const e = payroll[s.id] || {}; return (<tr key={s.id} className="border-b border-[#c9a96e]/20"><td className="py-2 pr-3 text-[#191970]">{i + 1}</td><td className="py-2 pr-3 text-[#191970]">{s.displayId || '—'}</td><td className="py-2 pr-3 text-[#191970] font-medium">{s.name}</td><td className="py-2 pr-3 text-[#191970]">{s.role}</td><td className="py-2 pr-3"><input type="number" disabled={submitted} defaultValue={e.gross || 0} onBlur={ev => handleBlur(s.id, 'gross', ev.target.value)} className="w-24 rounded-lg border border-[#c9a96e]/40 p-1 text-[#191970] disabled:opacity-60" /></td><td className="py-2 pr-3"><input type="number" disabled={submitted} defaultValue={e.deductions || 0} onBlur={ev => handleBlur(s.id, 'deductions', ev.target.value)} className="w-24 rounded-lg border border-[#c9a96e]/40 p-1 text-[#191970] disabled:opacity-60" /></td><td className="py-2 pr-3 font-semibold text-[#1a5c38]">₦{net(s.id).toLocaleString()}</td><td className="py-2"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${e.status === 'Hold' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{e.status || 'Ready'}</span></td></tr>); })}</tbody>
          </table></div>}
      </div>
      <button onClick={handleSubmit} disabled={submitted} className={`w-full py-3 rounded-2xl text-base font-bold transition-colors ${submitted ? 'bg-amber-500 text-white cursor-default' : 'bg-[#1a5c38] text-[#f5deb3] hover:bg-[#154a2e]'}`}>
        {submitted ? '⏳ Pending Owner Approval' : 'Submit for Owner Approval'}
      </button>
    </div>
  );
}

function PayslipsTab() {
  const [staff, setStaff] = useState([]);
  const [payroll, setPayroll] = useState({});
  const [branding, setBranding] = useState(null);
  const [selected, setSelected] = useState(null);
  const [month] = useState(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
  useEffect(() => {
    Promise.all([getPeople(), getPayroll(), getBranding()]).then(([p, pay, b]) => {
      setStaff((p?.people || []).filter(u => !['student', 'parent'].includes(u.role)));
      const m = {}; (pay?.payroll || []).forEach(e => { m[e.staffId || e.id] = e; }); setPayroll(m);
      setBranding(b?.branding || null);
    }).catch(() => {});
  }, []);
  return (
    <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-4">Staff Payslips — {month}</h2>
      <div className="space-y-2">{staff.map(s => (<div key={s.id} className={`${INNER} flex items-center justify-between`}><div><p className="text-[#191970] font-medium">{s.name}</p><p className="text-xs text-[#800020]">{s.role} · {s.displayId || s.id}</p></div><button onClick={() => setSelected({...s, ...(payroll[s.id] || {})})} className="text-xs bg-[#800020] text-[#f5deb3] font-bold px-3 py-1.5 rounded-xl">View Payslip</button></div>))}</div>
      {selected && <PayslipModal staff={selected} month={month} branding={branding} onClose={() => setSelected(null)} />}
    </div>
  );
}

function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getPayrollHistory().then(d => setHistory(d?.history || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-4">Payroll History</h2>
      {loading ? <p className="text-[#800020] text-sm">Loading...</p> : history.length === 0 ? <p className="text-[#800020] text-sm">No payroll history yet.</p> :
        <div className="space-y-2">{history.map((h, i) => (<div key={h.id || i} className={`${INNER} flex items-center justify-between`}><div><p className="text-[#191970] font-medium">{h.period || h.month || '—'}</p><p className="text-xs text-[#800020]">Total Net: ₦{(h.totalNet || 0).toLocaleString()}</p></div><span className={`text-xs font-semibold px-2 py-1 rounded-full ${h.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{h.status || 'draft'}</span></div>))}</div>}
    </div>
  );
}

function SettingsTab() {
  const [form, setForm] = useState({ housingAllowance: 0, transportAllowance: 0, taxRate: 0, pensionRate: 0 });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  useEffect(() => { getPayrollSettings().then(d => { if (d?.settings) setForm(f => ({...f, ...d.settings})); }).catch(() => {}); }, []);
  async function handleSave() { setSaving(true); try { await savePayrollSettings(form); showToast('Settings saved!'); } catch (e) { showToast(e.message); } finally { setSaving(false); } }
  return (
    <div className={CARD}>
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}
      <h2 className="text-lg font-bold text-[#800000] mb-4">Payroll Settings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">{[['Housing Allowance (₦)', 'housingAllowance'], ['Transport Allowance (₦)', 'transportAllowance'], ['Tax Rate (%)', 'taxRate'], ['Pension Rate (%)', 'pensionRate']].map(([label, key]) => (<div key={key}><label className="text-xs font-semibold text-[#800020]">{label}</label><input type="number" value={form[key]} onChange={e => setForm(f => ({...f, [key]: Number(e.target.value)}))} className="w-full mt-1 rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970]" /></div>))}</div>
      <button onClick={handleSave} disabled={saving} className={BTN}>{saving ? 'Saving…' : 'Save Settings'}</button>
    </div>
  );
}

export default function HoSPayroll({ auth }) {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40"><h1 className="text-2xl font-bold text-[#800000]">Payroll</h1><p className="text-[#191970] mt-1 text-sm">Review payroll and submit for owner approval.</p></div>
      <div className="flex flex-wrap gap-2">{TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`px-5 py-2 rounded-2xl text-sm font-semibold transition-colors ${tab === i ? 'bg-[#800020] text-[#f5deb3]' : 'bg-[#f5deb3] text-[#800020] border border-[#c9a96e]/40 hover:bg-[#f0d090]'}`}>{t}</button>)}</div>
      {tab === 0 && <PayrollSheetTab />}
      {tab === 1 && <PayslipsTab />}
      {tab === 2 && <HistoryTab />}
      {tab === 3 && <SettingsTab />}
    </div>
  );
}
