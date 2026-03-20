import React, { useEffect, useState } from 'react';
import { CalendarDays, Save, Check, X, Clock3, AlertCircle, QrCode, ClipboardList, Search } from 'lucide-react';
import { fetchWithAuth } from '../../../services/apiClient';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
const statusPalette: Record<string, string> = {
  Present: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Absent: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Late: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Excused: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function ParentAttendance() {
  const [mode, setMode] = useState<'scanner' | 'manual'>('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [date, setDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [parentList, setParentList] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth(`/api/attendance/parent?date=${date}`);
      if (data && data.parents) {
        setParentList(data.parents);
        setRecords(data.records);
        const nextAtt: Record<string, AttendanceStatus> = {};
        data.records.forEach((r: any) => {
          nextAtt[r.parent_id] = r.status;
        });
        setAttendance(nextAtt);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMark = async (id: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [id]: status }));
    try {
      await fetchWithAuth('/api/attendance/parent/mark', {
        method: 'POST',
        body: JSON.stringify({ parent_id: id, status, date }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const calculateStats = () => {
    const total = parentList.length;
    if (total === 0) return { P: 0, A: 0, L: 0, E: 0, Total: 0 };
    const P = Object.values(attendance).filter(v => v === 'Present').length;
    const A = Object.values(attendance).filter(v => v === 'Absent').length;
    const L = Object.values(attendance).filter(v => v === 'Late').length;
    const E = Object.values(attendance).filter(v => v === 'Excused').length;
    return { P, A, L, E, Total: total };
  };

  const stats = calculateStats();

  const filteredParents = parentList.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white">Parent Attendance</h2>
          <p className="text-slate-600 dark:text-slate-500 dark:text-slate-400">Manage and track parent meeting attendance</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-white dark:bg-slate-800/50 rounded-lg p-1 border border-slate-200 dark:border-slate-700/50">
            <button
              onClick={() => setMode('scanner')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${mode === 'scanner' ? 'bg-indigo-500 text-slate-900 dark:text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-900 dark:text-white'}`}
            >
              <QrCode size={16} /> QR / Scanner
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${mode === 'manual' ? 'bg-indigo-500 text-slate-900 dark:text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-900 dark:text-white'}`}
            >
              <ClipboardList size={16} /> ICT Manual Marking
            </button>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
          <p className="text-slate-600 dark:text-slate-500 dark:text-slate-400 text-sm">Total Parents</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-900 dark:text-white mt-1">{stats.Total}</p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-emerald-400 text-sm">Present</p>
          <p className="text-2xl font-semibold text-emerald-400 mt-1">{stats.P}</p>
        </div>
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <p className="text-rose-400 text-sm">Absent</p>
          <p className="text-2xl font-semibold text-rose-400 mt-1">{stats.A}</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-amber-400 text-sm">Late</p>
          <p className="text-2xl font-semibold text-amber-400 mt-1">{stats.L}</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-blue-400 text-sm">Excused</p>
          <p className="text-2xl font-semibold text-blue-400 mt-1">{stats.E}</p>
        </div>
      </div>

      {mode === 'scanner' ? (
        <div className="w-full flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Automated Attendance Scanner</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 text-center">Scan QR code using device camera.</p>
          <QRScanner roleScanned="student" onScanSuccess={(m) => console.log(m)} />
        </div>
      ) : (
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-black" size={18} /> Complete Parent List
          </h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 dark:text-slate-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search parents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        {loading ? (
            <div className="p-8 text-center text-slate-600 dark:text-slate-500 dark:text-slate-400">Loading...</div>
        ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-500 dark:text-slate-400">Parent Name</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-500 dark:text-slate-400">Role</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-500 dark:text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredParents.map((s, idx) => {
              const currentStatus = attendance[s.id];
              return (
              <tr key={s.id} className="border-b border-slate-200 dark:border-slate-700/50 last:border-0 hover:bg-slate-800/80">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900 dark:text-slate-900 dark:text-white">{s.first_name} {s.last_name}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{s.role}</span>
                </td>
                <td className="px-6 py-4">
                  {currentStatus ? (
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusPalette[currentStatus]}`}>
                      {currentStatus}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full border bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600">
                      Not marked
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleMark(s.id, 'Present')} className="p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleMark(s.id, 'Absent')} className="p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleMark(s.id, 'Late')} className="p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors">
                      <Clock3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleMark(s.id, 'Excused')} className="p-2 bg-slate-100 dark:bg-slate-700/50 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors">
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )})}
            {filteredParents.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-600 dark:text-slate-500 dark:text-slate-400">No parents found.</td></tr>
            )}
          </tbody>
        </table>
        )}
      </div>
      )}
    </div>
  );
}
