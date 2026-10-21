import React from 'react';
import ResultPaperBackdrop from './ResultPaperBackdrop';

// The report card itself, exactly as students and parents see it (and as the preview shows it):
// letterhead with logo, student details, statistics, subjects, behaviour rated 5–1 with a key,
// remarks, signatures, the school seal and the verification QR. Printed paper stays white with
// dark text in both themes, so colours are fixed here.

const LABEL = 'text-[10px] font-bold uppercase tracking-widest text-[#475569]';

// Behaviour ratings: 5 Excellent … 1 Poor. Letters A–E read as 5–1.
export const BEHAVIOUR_KEY = [
  [5, 'Excellent'], [4, 'Very good'], [3, 'Good'], [2, 'Fair'], [1, 'Poor'],
];
export function ratingValue(score) {
  const text = String(score ?? '').trim().toUpperCase();
  if (!text) return 0;
  const letter = 'EDCBA'.indexOf(text.charAt(0));
  if (/^[A-E][+-]?$/.test(text) && letter >= 0) return letter + 1;
  const number = Number(text);
  if (Number.isFinite(number) && number >= 1 && number <= 5) return Math.round(number);
  const word = BEHAVIOUR_KEY.find(([, label]) => label.toLowerCase() === text.toLowerCase());
  return word ? word[0] : 0;
}

function gradeTone(grade) {
  const letter = String(grade || '').trim().charAt(0).toUpperCase();
  if (letter === 'A') return 'bg-[#dcfce7] text-[#14532d]';
  if (letter === 'B') return 'bg-[#dbeafe] text-[#1e3a8a]';
  if (letter === 'C') return 'bg-[#fef3c7] text-[#78350f]';
  if (letter === 'D' || letter === 'P') return 'bg-[#ffedd5] text-[#7c2d12]';
  if (letter) return 'bg-[#fee2e2] text-[#7f1d1d]';
  return 'text-[#0f172a]';
}

function ordinal(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '—';
  const tail = number % 100 >= 11 && number % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th');
  return `${number}${tail}`;
}

/** The school's seal: its own image when uploaded, otherwise a drawn round seal with its name. */
export function SchoolSeal({ schoolName = '', sealUrl = '', color = '#800000', size = 112 }) {
  if (sealUrl) return <img src={sealUrl} alt={`${schoolName || 'School'} seal`} style={{ width: size, height: size }} className="object-contain" />;
  const name = (schoolName || 'Official School Seal').toUpperCase().slice(0, 42);
  const id = `seal-${name.replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'school'}`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={`${schoolName || 'School'} seal`} style={{ opacity: 0.85 }}>
      <defs><path id={id} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke={color} strokeWidth="3" />
      <circle cx="60" cy="60" r="34" fill="none" stroke={color} strokeWidth="1.5" />
      <text fill={color} fontSize="9.5" fontWeight="700" letterSpacing="1.2"><textPath href={`#${id}`} startOffset="0">{name} • OFFICIAL •</textPath></text>
      <text x="60" y="56" textAnchor="middle" fill={color} fontSize="10" fontWeight="800">★ SEAL ★</text>
      <text x="60" y="70" textAnchor="middle" fill={color} fontSize="7.5" fontWeight="700">{new Date().getFullYear()}</text>
    </svg>
  );
}

function BehaviourTable({ title, items, color }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#cbd5e1]">
      <div className="px-4 py-2 text-sm font-black uppercase tracking-wide text-white" style={{ background: color }}>{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-[#f8fafc]">
          <tr>
            <th className={`${LABEL} px-3 py-2 text-left`}>Trait</th>
            {BEHAVIOUR_KEY.map(([value]) => <th key={value} className={`${LABEL} w-9 px-1 py-2 text-center`}>{value}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const value = ratingValue(item.score);
            return (
              <tr key={item.key || item.label} className={index % 2 ? 'bg-[#f8fafc]' : 'bg-white'}>
                <td className="px-3 py-1.5 text-[#0f172a]">{item.label}{!value && item.score ? <span className="ml-1 text-xs text-[#475569]">({item.score})</span> : null}</td>
                {BEHAVIOUR_KEY.map(([rate]) => (
                  <td key={rate} className="px-1 py-1.5 text-center font-black" style={{ color }}>{value === rate ? '✓' : ''}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ResultReportCard({ record, branding, scoreModel, qrDataUrl = '', verificationLabel = '', isPreview = false, isPractice = false }) {
  const summary = record.summary || {};
  const student = record.student || {};
  const primary = branding.primaryColor;
  const accent = branding.accentColor;
  const stats = [
    ['Total score', summary.totalScore !== undefined ? `${summary.totalScore}${summary.totalObtainable ? ` / ${summary.totalObtainable}` : ''}` : null],
    ['Average', `${summary.average || 0}%`],
    ['Grade', summary.grade || '—'],
    ['Position', summary.position ? `${ordinal(summary.position)}${summary.classSize ? ` of ${summary.classSize}` : ''}` : null],
    ['Class average', summary.classAverage !== undefined ? `${summary.classAverage}%` : null],
    ['Highest in class', summary.highestAverage !== undefined ? `${summary.highestAverage}%` : null],
    ['Lowest in class', summary.lowestAverage !== undefined ? `${summary.lowestAverage}%` : null],
    ['Attendance', `${summary.attendanceRate || 0}%`],
  ].filter(([, value]) => value !== null);
  const hasClassStats = record.subjects.some(row => row.classHighest !== undefined);
  const details = [
    ['Name', student.name], ['Admission no.', student.displayId], ['Class', student.className],
    ['Term', record.termName], ['Session', record.sessionName], ['Subjects', summary.subjectsTaken || record.subjects.length],
    ['Promotion', summary.promotionStatus],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  return (
    <article className="result-paper result-record-print-gradient relative overflow-hidden rounded-3xl border border-[#d4d4d8] bg-[#ffffff] p-4 text-[#1e293b] shadow-sm md:p-6">
      <ResultPaperBackdrop schoolName={branding.schoolName} logoUrl={branding.logoUrl} />
      <div className="result-record-print-page relative z-10 grid grid-cols-1 gap-4">
        {(isPractice || isPreview) && (
          <div className={`result-record-print-hide rounded-2xl border px-4 py-3 text-sm font-semibold ${isPractice ? 'border-[#f59e0b] bg-[#fffbeb] text-[#92400e]' : 'border-[#60a5fa] bg-[#eff6ff] text-[#1e3a8a]'}`}>
            {isPractice
              ? 'PRACTICE RESULT — for training only. This is not an official result and is never sent to students or parents.'
              : 'PREVIEW — exactly what students and parents see once the HoS publishes these results. The QR code here is a sample; each published result gets its own.'}
          </div>
        )}

        {/* Letterhead */}
        <header className="result-record-print-gradient overflow-hidden rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)` }}>
          <div className="flex flex-col items-center gap-3 px-5 py-5 text-center sm:flex-row sm:text-left">
            {branding.logoUrl ? <img src={branding.logoUrl} alt={branding.schoolName || 'School logo'} className="h-20 w-20 shrink-0 rounded-2xl border border-white/30 bg-white p-1.5 object-contain" /> : null}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black uppercase tracking-tight md:text-3xl">{branding.schoolName || 'School Result'}</h1>
              {branding.motto ? <p className="mt-0.5 text-sm italic text-white/90">“{branding.motto}”</p> : null}
              {branding.address || branding.website ? <p className="mt-1 text-xs text-white/80">{[branding.address, branding.website].filter(Boolean).join(' · ')}</p> : null}
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{branding.reportTitle}</p>
              <p className="text-sm font-black">{record.termName || 'Term'}</p>
              <p className="text-xs text-white/85">{record.sessionName || 'Session'}</p>
            </div>
          </div>
          <div className="h-1.5" style={{ background: `repeating-linear-gradient(90deg, ${accent} 0 24px, #ffffff 24px 30px, ${primary} 30px 54px, #ffffff 54px 60px)` }} />
        </header>

        {/* Student details */}
        <section className="result-record-print-surface grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-[#cbd5e1] bg-white/90 p-4 sm:grid-cols-4" aria-label="Student details">
          {details.map(([label, value]) => (
            <div key={label} className={label === 'Name' ? 'col-span-2' : ''}>
              <p className={LABEL}>{label}</p>
              <p className="font-bold text-[#0f172a]">{value}</p>
            </div>
          ))}
        </section>

        {/* Statistics */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Statistics">
          {stats.map(([label, value], index) => (
            <div key={label} className="result-record-print-gradient rounded-2xl border px-3 py-2" style={{ borderColor: `${index % 2 ? accent : primary}55`, background: `${index % 2 ? accent : primary}10` }}>
              <p className={LABEL}>{label}</p>
              <p className="text-lg font-black" style={{ color: index % 2 ? accent : primary }}>{value}</p>
            </div>
          ))}
        </section>

        {/* Subjects */}
        <div className="result-record-print-surface overflow-x-auto rounded-2xl border border-[#cbd5e1] bg-white/90">
          <table className={`w-full text-sm ${hasClassStats ? 'min-w-[760px]' : 'min-w-[600px]'}`}>
            <thead>
              <tr className="result-record-print-gradient text-left text-white" style={{ background: primary }}>
                {['Subject', `C.A. (${scoreModel.caMaxScore})`, `Exam (${scoreModel.examMaxScore})`, `Total (${scoreModel.totalMaxScore})`, 'Grade',
                  ...(hasClassStats ? ['Class avg', 'Highest', 'Lowest'] : []), 'Remark'].map(head => (
                  <th key={head} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {record.subjects.map((row, index) => (
                <tr key={`${record.id}-${row.subjectId || row.subjectName}`} className={index % 2 ? 'bg-[#f8fafc]' : 'bg-white'}>
                  <td className="px-3 py-2 font-semibold text-[#0f172a]">{row.subjectName}</td>
                  <td className="px-3 py-2 font-mono text-[#0f172a]">{row.caScore}</td>
                  <td className="px-3 py-2 font-mono text-[#0f172a]">{row.examScore}</td>
                  <td className="px-3 py-2 font-mono font-black text-[#0f172a]">{row.total}</td>
                  <td className="px-3 py-2"><span className={`result-record-print-gradient rounded-lg px-2 py-0.5 font-black ${gradeTone(row.grade)}`}>{row.grade || '—'}</span></td>
                  {hasClassStats ? <>
                    <td className="px-3 py-2 font-mono text-[#475569]">{row.classAverage ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-[#475569]">{row.classHighest ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-[#475569]">{row.classLowest ?? '—'}</td>
                  </> : null}
                  <td className="px-3 py-2 text-[#475569]">{row.remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Behaviour */}
        {(record.affective.length > 0 || record.ratings.length > 0) && (
          <section aria-label="Behaviour">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {record.affective.length > 0 ? <BehaviourTable title="Affective domain (behaviour)" items={record.affective} color={primary} /> : null}
              {record.ratings.length > 0 ? <BehaviourTable title="Psychomotor skills" items={record.ratings} color={accent} /> : null}
            </div>
            <p className="mt-2 text-xs text-[#475569]"><b>Key:</b> {BEHAVIOUR_KEY.map(([value, label]) => `${value} = ${label}`).join(' · ')}</p>
          </section>
        )}

        {/* Remarks, signatures, seal and QR */}
        <section className="result-record-print-surface grid grid-cols-1 gap-4 rounded-2xl border border-[#cbd5e1] bg-white/90 p-4 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <p className={LABEL}>Class teacher's remark</p>
            <p className="mt-1 min-h-[2.5rem] text-[#0f172a]">{summary.teacherRemark || '—'}</p>
            <p className="mt-4 border-t border-dashed border-[#94a3b8] pt-1 text-xs text-[#475569]">Class teacher's signature</p>
          </div>
          <div>
            <p className={LABEL}>Principal / Head's remark</p>
            <p className="mt-1 min-h-[2.5rem] text-[#0f172a]">{summary.principalRemark || '—'}</p>
            <p className="mt-4 border-t border-dashed border-[#94a3b8] pt-1 text-xs text-[#475569]">
              Principal's signature{record.payload?.approvals?.approvedBy ? ` · approved by ${record.payload.approvals.approvedBy}` : ''}
              {record.publishedAt ? ` · ${new Date(record.publishedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <SchoolSeal schoolName={branding.schoolName} sealUrl={branding.sealUrl} color={primary} />
            {qrDataUrl ? (
              <figure className="text-center">
                <div className="relative">
                  <img src={qrDataUrl} alt={isPreview ? 'Sample verification QR code' : 'Result verification QR code'} className="result-record-print-qr h-28 w-28 rounded-lg border border-[#cbd5e1] bg-white p-1" />
                  {isPreview ? <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[-12deg] bg-white/85 text-[10px] font-black tracking-widest text-[#b91c1c]">SAMPLE</span> : null}
                </div>
                <figcaption className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#475569]">Scan to verify</figcaption>
              </figure>
            ) : null}
          </div>
        </section>
        {verificationLabel && !isPreview ? <p className="break-all text-center text-[10px] text-[#64748b]">Verify at {verificationLabel}</p> : null}
      </div>
    </article>
  );
}
