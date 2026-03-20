import React, { useState, useMemo } from 'react';
import { SlidersHorizontal, Download, Upload } from 'lucide-react';

const mockStudents = [
  { id: 'stu_01', name: 'Adekunle Gold' },
  { id: 'stu_02', name: 'Bisi Adebayo' },
  { id: 'stu_03', name: 'Chinedu Okoro' },
  { id: 'stu_04', name: 'Damilola Adeyemi' },
  { id: 'stu_05', name: 'Emeka Nwosu' },
  { id: 'stu_06', name: 'Fatima Bello' },
];

export default function SubjectScoresModule() {
  const [weights, setWeights] = useState({ ca1: 20, ca2: 20, exam: 60 });
  const [scores, setScores] = useState({});

  const handleScoreChange = (studentId, type, value) => {
    const newScores = { ...scores };
    if (!newScores[studentId]) newScores[studentId] = {};
    newScores[studentId][type] = value;
    setScores(newScores);
  };

  const totalWeight = useMemo(() => Object.values(weights).reduce((a, b) => a + b, 0), [weights]);

  const calculateTotal = (studentId) => {
    if (!scores[studentId] || totalWeight === 0) return 0;
    const studentScores = scores[studentId];
    const total = 
        ((studentScores.ca1 || 0) * weights.ca1 / 100) + 
        ((studentScores.ca2 || 0) * weights.ca2 / 100) + 
        ((studentScores.exam || 0) * weights.exam / 100);
    return total.toFixed(1);
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Subject CA Score Entry</h1>
          <p className="text-sm text-slate-400">SS3, Second Term - Mathematics</p>
        </div>
        <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
                <Download className="w-4 h-4" />
                Download Template
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                <Upload className="w-4 h-4" />
                Upload Scoresheet
            </button>
        </div>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-indigo-400" /> CA Weighting</h3>
        <div className="grid grid-cols-4 gap-4 items-center">
            {['ca1', 'ca2', 'exam'].map(type => (
                <div key={type}>
                    <label className="text-xs font-bold text-slate-400 uppercase">{type}</label>
                    <input 
                        type="number" 
                        value={weights[type]}
                        onChange={(e) => setWeights({...weights, [type]: parseInt(e.target.value) || 0})}
                        className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200"
                    />
                </div>
            ))}
            <div className="text-center pt-5">
                <p className={`text-2xl font-bold ${totalWeight !== 100 ? 'text-rose-400' : 'text-emerald-400'}`}>{totalWeight}%</p>
                <p className="text-xs font-bold text-slate-400 uppercase">Total Weight</p>
            </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl">
        <table className="w-full">
            <thead className="border-b border-slate-800">
                <tr>
                    <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Student Name</th>
                    <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">CA1 ({weights.ca1}%)</th>
                    <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">CA2 ({weights.ca2}%)</th>
                    <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Exam ({weights.exam}%)</th>
                    <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">Total</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {mockStudents.map(student => (
                    <tr key={student.id}>
                        <td className="p-2 text-sm font-medium text-slate-200 pl-4">{student.name}</td>
                        {['ca1', 'ca2', 'exam'].map(type => (
                            <td key={type} className="p-2">
                                <input 
                                    type="number" 
                                    max="100" 
                                    min="0"
                                    onChange={(e) => handleScoreChange(student.id, type, parseInt(e.target.value))}
                                    className="w-24 mx-auto bg-slate-800 border-none rounded-lg text-sm text-center focus:ring-2 focus:ring-emerald-500 text-slate-200"
                                />
                            </td>
                        ))}
                        <td className="p-2 text-center font-bold text-emerald-400">
                            {calculateTotal(student.id)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
