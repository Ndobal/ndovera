
import React from 'react';
import { ResultSheet, GradingConfig, School } from '../types';
import { Award, Check, User, Crown } from 'lucide-react';

interface TemplateProps {
  data: ResultSheet;
  school: School;
  grading: GradingConfig[];
  variant: 'classic' | 'modern' | 'colored' | 'british' | 'executive';
}

const getGrade = (score: number, grading: GradingConfig[]) => {
  const cfg = grading.find(g => score >= g.min && score <= g.max);
  return cfg ? cfg.grade : 'F';
};

const getRemark = (score: number, grading: GradingConfig[]) => {
  const cfg = grading.find(g => score >= g.min && score <= g.max);
  return cfg ? cfg.remark : 'Fail';
};

const RatingStars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <div 
        key={star} 
        className={`w-3 h-3 rounded-full border ${star <= rating ? 'bg-slate-800 border-slate-800' : 'bg-transparent border-slate-300'}`}
      />
    ))}
  </div>
);

const CheckBoxRating = ({ rating, variant }: { rating: number, variant: string }) => {
    return (
        <div className="flex justify-between w-full px-2">
            {[5, 4, 3, 2, 1].map((val) => (
                <div key={val} className="flex justify-center w-8">
                    {val === rating ? (
                       variant === 'executive' ? <Award className="w-4 h-4 text-amber-600" /> : <Check className="w-4 h-4 font-bold" />
                    ) : null}
                </div>
            ))}
        </div>
    )
}

export const ResultTemplate: React.FC<TemplateProps> = ({ data, school, grading, variant }) => {
  
  // Calculate Totals
  const totalScore = data.scores.filter(s => s.isOffered).reduce((acc, curr) => acc + (curr.ca1 || 0) + (curr.ca2 || 0) + (curr.exam || 0), 0);
  const subjectCount = data.scores.filter(s => s.isOffered).length;
  const average = subjectCount > 0 ? (totalScore / subjectCount).toFixed(1) : '0';

  // --- DESIGN 1: CLASSIC BLUE ACADEMIC ---
  if (variant === 'classic') {
    return (
      <div className="bg-white p-8 w-full max-w-[210mm] mx-auto min-h-[297mm] relative font-serif text-slate-900 border-4 border-double border-slate-800 print:w-full print:h-full print:border-none print:shadow-none shadow-xl">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
            <img src={school.logo} alt="" className="w-96 h-96 grayscale" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-6 border-b-2 border-slate-800 pb-6 mb-6">
            <img src={school.logo} className="w-24 h-24" alt="Logo" />
            <div className="text-center flex-1">
                <h1 className="text-3xl font-bold uppercase text-blue-900 tracking-wider">{school.name}</h1>
                <p className="text-sm font-medium mt-1">{school.address || "123 Education Street, Academic City"}</p>
                <p className="text-sm mt-1">{school.email} | {school.phone}</p>
                <div className="mt-3 inline-block bg-blue-900 text-white px-6 py-1 rounded-sm text-sm uppercase font-bold tracking-widest">Termly Report Sheet</div>
            </div>
            <div className="w-24 h-24 border border-slate-300 flex items-center justify-center bg-slate-50">
                <User className="w-12 h-12 text-slate-300" />
            </div>
        </div>

        {/* Student Info Grid */}
        <div className="grid grid-cols-4 gap-4 text-sm border border-slate-300 p-4 mb-6 bg-blue-50">
            <div><span className="font-bold text-blue-900">Name:</span> {data.studentName}</div>
            <div><span className="font-bold text-blue-900">ID:</span> {data.admissionNumber}</div>
            <div><span className="font-bold text-blue-900">Class:</span> {data.class}</div>
            <div><span className="font-bold text-blue-900">Session:</span> {data.session}</div>
            <div><span className="font-bold text-blue-900">Term:</span> {data.term}</div>
            <div><span className="font-bold text-blue-900">Attendance:</span> {data.attendance} / {data.daysOpened}</div>
            <div><span className="font-bold text-blue-900">Average:</span> {average}%</div>
            <div><span className="font-bold text-blue-900">Total:</span> {totalScore}</div>
        </div>

        {/* Cognitive Table */}
        <table className="w-full text-sm border-collapse border border-slate-400 mb-6">
            <thead className="bg-blue-900 text-white">
                <tr>
                    <th className="border border-slate-400 p-2 text-left">Subject</th>
                    <th className="border border-slate-400 p-2 w-12 text-center">CA1 (20)</th>
                    <th className="border border-slate-400 p-2 w-12 text-center">CA2 (20)</th>
                    <th className="border border-slate-400 p-2 w-12 text-center">Exam (60)</th>
                    <th className="border border-slate-400 p-2 w-12 text-center">Total (100)</th>
                    <th className="border border-slate-400 p-2 w-12 text-center">Grade</th>
                    <th className="border border-slate-400 p-2 text-left">Remark</th>
                </tr>
            </thead>
            <tbody>
                {data.scores.filter(s => s.isOffered).map((score, i) => {
                    const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                    return (
                        <tr key={i} className="even:bg-blue-50/50">
                            <td className="border border-slate-400 p-2 font-medium">{score.subjectName}</td>
                            <td className="border border-slate-400 p-2 text-center text-slate-600">{score.ca1}</td>
                            <td className="border border-slate-400 p-2 text-center text-slate-600">{score.ca2}</td>
                            <td className="border border-slate-400 p-2 text-center text-slate-600">{score.exam}</td>
                            <td className="border border-slate-400 p-2 text-center font-bold">{total}</td>
                            <td className="border border-slate-400 p-2 text-center font-bold text-blue-900">{getGrade(total, grading)}</td>
                            <td className="border border-slate-400 p-2 text-xs uppercase">{getRemark(total, grading)}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>

        {/* Domains */}
        <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="border border-slate-400">
                <div className="bg-slate-200 p-2 font-bold text-center border-b border-slate-400">Affective Domain</div>
                <div className="p-2 space-y-1">
                    <div className="flex justify-end text-[10px] text-slate-500 font-bold px-2 gap-4">
                        <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
                    </div>
                    {data.affective.map(trait => (
                        <div key={trait.id} className="flex justify-between items-center text-xs border-b border-slate-200 pb-1">
                            <span>{trait.label}</span>
                            <div className="w-24"><CheckBoxRating rating={trait.rating} variant="classic" /></div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="border border-slate-400">
                <div className="bg-slate-200 p-2 font-bold text-center border-b border-slate-400">Psychomotor Domain</div>
                <div className="p-2 space-y-1">
                     <div className="flex justify-end text-[10px] text-slate-500 font-bold px-2 gap-4">
                        <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>
                    </div>
                    {data.psychomotor.map(trait => (
                        <div key={trait.id} className="flex justify-between items-center text-xs border-b border-slate-200 pb-1">
                            <span>{trait.label}</span>
                            <div className="w-24"><CheckBoxRating rating={trait.rating} variant="classic" /></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Remarks & Signatures */}
        <div className="space-y-4 border-t-2 border-slate-800 pt-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                    <span className="font-bold block mb-1">Class Teacher:</span>
                    <span className="border-b border-dotted border-slate-400 block min-h-[20px] italic">{data.teacherComment}</span>
                    {data.teacherSignature && <img src={data.teacherSignature} className="h-8 mt-1" alt="Sig" />}
                </div>
                <div>
                     <span className="font-bold block mb-1">Head of Section:</span>
                     <span className="border-b border-dotted border-slate-400 block min-h-[20px] italic">{data.headTeacherComment}</span>
                     {data.headSignature && <img src={data.headSignature} className="h-8 mt-1" alt="Sig" />}
                </div>
                <div>
                     <span className="font-bold block mb-1">Principal:</span>
                     <span className="border-b border-dotted border-slate-400 block min-h-[20px] italic">{data.principalComment}</span>
                     {data.principalSignature && <img src={data.principalSignature} className="h-8 mt-1" alt="Sig" />}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- DESIGN 2: MODERN CLEAN ---
  if (variant === 'modern') {
      return (
        <div className="bg-white p-10 w-full max-w-[210mm] mx-auto min-h-[297mm] font-sans text-slate-800 print:w-full print:h-full print:shadow-none shadow-xl">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-4xl font-extrabold text-indigo-600 tracking-tight mb-2">{school.name}</h1>
                    <p className="text-slate-500 text-sm">Excellence • Integrity • Service</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-light text-slate-400 uppercase">Student Report</h2>
                    <p className="font-medium text-slate-900">{data.term}, {data.session}</p>
                </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 mb-8 flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-slate-900">{data.studentName}</h3>
                    <p className="text-slate-500">{data.class} • {data.admissionNumber}</p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-slate-500">Overall Average</div>
                    <div className="text-4xl font-bold text-indigo-600">{average}%</div>
                </div>
            </div>

            <table className="w-full mb-8">
                <thead className="text-xs text-slate-400 uppercase border-b border-slate-100">
                    <tr>
                        <th className="py-3 text-left">Subject</th>
                        <th className="py-3 text-center">CA</th>
                        <th className="py-3 text-center">Exam</th>
                        <th className="py-3 text-center">Total</th>
                        <th className="py-3 text-center">Grade</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {data.scores.filter(s => s.isOffered).map((score, i) => {
                        const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                        return (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="py-3 font-medium">{score.subjectName}</td>
                                <td className="py-3 text-center text-slate-500">{score.ca1 + score.ca2}</td>
                                <td className="py-3 text-center text-slate-500">{score.exam}</td>
                                <td className="py-3 text-center font-bold text-slate-900">{total}</td>
                                <td className="py-3 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${total >= 70 ? 'bg-green-100 text-green-700' : total >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                        {getGrade(total, grading)}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-50 rounded-xl p-5">
                    <h4 className="font-bold text-slate-900 mb-3 text-sm uppercase">Affective Traits</h4>
                    <div className="space-y-2">
                        {data.affective.map(t => (
                            <div key={t.id} className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">{t.label}</span>
                                <RatingStars rating={t.rating} />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5">
                    <h4 className="font-bold text-slate-900 mb-3 text-sm uppercase">Psychomotor Skills</h4>
                    <div className="space-y-2">
                        {data.psychomotor.map(t => (
                            <div key={t.id} className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">{t.label}</span>
                                <RatingStars rating={t.rating} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
                <div className="grid grid-cols-3 gap-6">
                    <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Class Teacher</p>
                        {data.teacherSignature && <img src={data.teacherSignature} className="h-10 opacity-80 mb-1" alt="Sign" />}
                        <p className="text-slate-800 font-medium text-sm">{data.teacherComment || "No remark"}</p>
                    </div>
                    <div>
                         <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Head of Section</p>
                         {data.headSignature && <img src={data.headSignature} className="h-10 opacity-80 mb-1" alt="Sign" />}
                         <p className="text-slate-800 font-medium text-sm">{data.headTeacherComment || "No remark"}</p>
                    </div>
                    <div>
                         <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Principal</p>
                         {data.principalSignature && <img src={data.principalSignature} className="h-10 opacity-80 mb-1" alt="Sign" />}
                         <p className="text-slate-800 font-medium text-sm">{data.principalComment || "No remark"}</p>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- DESIGN 3: COLOUR BLOCKED (KIDS) ---
  if (variant === 'colored') {
      return (
          <div className="bg-white p-6 w-full max-w-[210mm] mx-auto min-h-[297mm] font-sans relative overflow-hidden print:w-full print:h-full print:shadow-none shadow-xl">
              <div className="absolute inset-0 bg-orange-50 z-0"></div>
              <div className="relative z-10">
                  <div className="bg-orange-500 rounded-3xl p-6 text-white mb-6 shadow-lg">
                      <div className="flex items-center gap-4">
                          <div className="bg-white p-2 rounded-full w-20 h-20 flex items-center justify-center">
                              <img src={school.logo} alt="Logo" className="w-16 h-16" />
                          </div>
                          <div>
                              <h1 className="text-3xl font-black">{school.name}</h1>
                              <p className="opacity-90">My Report Card</p>
                          </div>
                      </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-orange-200 mb-6 grid grid-cols-2 gap-4">
                      <div><span className="text-orange-400 text-xs font-bold uppercase">Name</span><p className="font-bold text-lg">{data.studentName}</p></div>
                      <div><span className="text-orange-400 text-xs font-bold uppercase">Class</span><p className="font-bold text-lg">{data.class}</p></div>
                  </div>

                  <div className="space-y-2 mb-6">
                      {data.scores.filter(s => s.isOffered).map((score, i) => {
                          const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                          const colors = ['bg-blue-100 border-blue-200', 'bg-green-100 border-green-200', 'bg-purple-100 border-purple-200', 'bg-pink-100 border-pink-200'];
                          return (
                              <div key={i} className={`${colors[i % 4]} border-2 rounded-xl p-3 flex justify-between items-center`}>
                                  <span className="font-bold text-slate-700">{score.subjectName}</span>
                                  <div className="flex items-center gap-4">
                                      <div className="text-right">
                                          <span className="block text-xs opacity-60">Score</span>
                                          <span className="font-black text-xl">{total}</span>
                                      </div>
                                      <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center font-black shadow-sm">
                                          {getGrade(total, grading)}
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>

                  <div className="bg-yellow-100 rounded-2xl p-6 border-2 border-yellow-200">
                      <h3 className="font-bold text-yellow-800 mb-4 flex items-center gap-2"><Award className="w-5 h-5"/> How I Behaved</h3>
                      <div className="grid grid-cols-2 gap-4">
                          {data.affective.map(t => (
                              <div key={t.id} className="bg-white rounded-lg p-2 flex justify-between items-center text-sm shadow-sm">
                                  <span>{t.label}</span>
                                  <div className="flex gap-1">{[...Array(t.rating)].map((_,i) => <span key={i} className="text-yellow-500">★</span>)}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )
  }

  // --- DESIGN 4: BRITISH / INTERNATIONAL ---
  if (variant === 'british') {
    return (
        <div className="bg-white p-8 w-full max-w-[210mm] mx-auto min-h-[297mm] font-serif text-slate-900 border-2 border-slate-900 print:w-full print:h-full print:shadow-none shadow-xl">
            {/* Header */}
            <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                <div className="flex items-center gap-4">
                    <img src={school.logo} className="w-20 h-20 object-contain grayscale" alt="Logo" />
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-widest">{school.name}</h1>
                        <p className="text-sm italic text-slate-600">Excellence in every lesson</p>
                    </div>
                </div>
                <div className="text-right text-sm">
                    <p className="font-bold">{school.address}</p>
                    <p>{school.email}</p>
                    <p>{school.phone}</p>
                </div>
            </div>

            <div className="flex gap-8 mb-8">
                {/* Side Strip */}
                <div className="w-1/3 bg-slate-50 p-4 border border-slate-300 text-sm space-y-3 h-fit">
                    <div className="border-b border-slate-200 pb-2 mb-2">
                        <span className="block text-xs uppercase text-slate-500 font-bold">Student Name</span>
                        <span className="font-bold text-lg">{data.studentName}</span>
                    </div>
                    <div>
                         <span className="block text-xs uppercase text-slate-500 font-bold">Admission No.</span>
                         <span>{data.admissionNumber}</span>
                    </div>
                    <div>
                         <span className="block text-xs uppercase text-slate-500 font-bold">Class</span>
                         <span>{data.class}</span>
                    </div>
                    <div>
                         <span className="block text-xs uppercase text-slate-500 font-bold">Session / Term</span>
                         <span>{data.session} - {data.term}</span>
                    </div>
                    <div>
                         <span className="block text-xs uppercase text-slate-500 font-bold">Attendance</span>
                         <span>{data.attendance} / {data.daysOpened} Days</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="w-2/3">
                    <h3 className="font-bold uppercase border-b-2 border-slate-900 mb-4 pb-1">Academic Performance</h3>
                    <table className="w-full text-sm mb-8 border-collapse">
                        <thead>
                            <tr className="border-b-2 border-slate-900 text-xs uppercase">
                                <th className="text-left py-2">Subject</th>
                                <th className="text-center py-2">Total</th>
                                <th className="text-center py-2">Grade</th>
                                <th className="text-left py-2 pl-4">Tutor's Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.scores.filter(s => s.isOffered).map((score, i) => {
                                const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                                return (
                                    <tr key={i} className="border-b border-slate-200">
                                        <td className="py-2 font-semibold">{score.subjectName}</td>
                                        <td className="py-2 text-center font-bold">{total}</td>
                                        <td className="py-2 text-center">{getGrade(total, grading)}</td>
                                        <td className="py-2 pl-4 italic text-slate-600 text-xs">{getRemark(total, grading)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    <h3 className="font-bold uppercase border-b-2 border-slate-900 mb-4 pb-1">Comments & Signatures</h3>
                    <div className="space-y-4 text-sm">
                        <div className="bg-slate-50 p-3 border border-slate-200">
                             <p className="text-xs uppercase font-bold text-slate-500 mb-1">Class Teacher</p>
                             <p className="italic mb-2">"{data.teacherComment}"</p>
                             {data.teacherSignature && <img src={data.teacherSignature} className="h-6 opacity-70" alt="Sig" />}
                        </div>
                        <div className="bg-slate-50 p-3 border border-slate-200">
                             <p className="text-xs uppercase font-bold text-slate-500 mb-1">Head of School</p>
                             <p className="italic mb-2">"{data.principalComment}"</p>
                             {data.principalSignature && <img src={data.principalSignature} className="h-6 opacity-70" alt="Sig" />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
  }

  // --- DESIGN 5: EXECUTIVE GOLD ---
  if (variant === 'executive') {
      return (
          <div className="bg-white p-12 w-full max-w-[210mm] mx-auto min-h-[297mm] font-serif text-slate-900 border-8 border-double border-amber-600 print:w-full print:h-full print:shadow-none shadow-xl">
              <div className="text-center mb-10 border-b-2 border-amber-600 pb-6">
                  <h1 className="text-4xl font-bold text-slate-900 uppercase tracking-widest">{school.name}</h1>
                  <p className="text-amber-700 font-bold text-sm tracking-[0.3em] mt-2">OFFICIAL TRANSCRIPT</p>
              </div>

              <div className="flex justify-between mb-10 font-medium">
                  <div className="space-y-1">
                      <p>STUDENT: <span className="font-bold">{data.studentName}</span></p>
                      <p>ID NUMBER: <span className="font-bold">{data.admissionNumber}</span></p>
                  </div>
                  <div className="space-y-1 text-right">
                      <p>SESSION: <span className="font-bold">{data.session}</span></p>
                      <p>TERM: <span className="font-bold">{data.term}</span></p>
                  </div>
              </div>

              <table className="w-full mb-10 border-collapse">
                  <thead className="bg-slate-900 text-amber-500 uppercase text-xs tracking-wider">
                      <tr>
                          <th className="p-3 text-left">Subject Course</th>
                          <th className="p-3 text-center">Score</th>
                          <th className="p-3 text-center">Grade</th>
                          <th className="p-3 text-left">Remark</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                      {data.scores.filter(s => s.isOffered).map((score, i) => {
                          const total = (score.ca1 || 0) + (score.ca2 || 0) + (score.exam || 0);
                          return (
                              <tr key={i}>
                                  <td className="p-3 font-bold">{score.subjectName}</td>
                                  <td className="p-3 text-center">{total}</td>
                                  <td className="p-3 text-center font-bold text-amber-700">{getGrade(total, grading)}</td>
                                  <td className="p-3 text-sm italic">{getRemark(total, grading)}</td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>

              <div className="border-t-2 border-amber-600 pt-8 flex justify-between items-end mt-auto">
                  <div className="w-64">
                      <div className="h-16 border-b border-slate-900 mb-2 flex items-end">
                          {data.principalSignature && <img src={data.principalSignature} className="h-12 mx-auto" alt="Sig" />}
                      </div>
                      <p className="text-center text-xs uppercase font-bold tracking-widest">Registrar / Principal</p>
                  </div>
                  <div className="w-24 h-24 rounded-full border-4 border-amber-600 flex items-center justify-center opacity-30">
                      <span className="text-[10px] font-bold uppercase text-center rotate-[-15deg]">Official<br/>Seal</span>
                  </div>
              </div>
          </div>
      )
  }

  // Fallback to Classic
  return null;
};
