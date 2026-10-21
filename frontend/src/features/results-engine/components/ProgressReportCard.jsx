import React from 'react';
import { SchoolSeal, ratingValue } from './ResultReportCard';

// The Nursery, Primary and Secondary report cards (templates in resultTemplates.ts), laid out
// like the schools' own: letterhead, details grid, academic table with class figures, behaviour,
// physical development, summary, comments and seal; page 2 (Nursery/Primary) is the school's
// skills checklist or performance-level rating. Every figure comes from the C.A. score sheet.
// Printed paper: fixed colours in both themes.

const LINE = 'border border-[#1e1b4b]/70';
const CELL = `${LINE} px-1.5 py-1`;
const HEAD = `${LINE} px-1 py-1 text-[10px] font-black uppercase leading-tight text-[#1e1b4b]`;
const RATING_KEY = [[5, 'Excellent Degree'], [4, 'High Degree'], [3, 'Acceptance Level'], [2, 'Poor Level'], [1, 'Indifferent']];
const SECONDARY_SCALE = ['5. Excellent Degree of Observable Trait', '4. Good Level of Observable Trait', '3. Fair But Acceptable Level of Observable Trait', '2. Poor Level of Observable Trait', '1. No Observable Trait'];

const fmt = value => {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number * 100) / 100) : String(value);
};

function gradeKey(scale = []) {
  const sorted = [...scale].filter(row => row?.grade).sort((a, b) => Number(b.minScore) - Number(a.minScore));
  return sorted.map((row, index) => {
    const top = index === 0 ? 100 : Number(sorted[index - 1].minScore) - 1;
    const range = Number(row.minScore) <= 0 ? `below ${sorted[index - 1]?.minScore ?? 40}%` : `${row.minScore}%–${top}%`;
    return `${row.grade} – ${String(row.remark || '').toUpperCase()} ${range}`;
  });
}

function Letterhead({ branding, title, record }) {
  const words = String(branding.schoolName || 'School').split(' ');
  const middle = words.length >= 3 ? Math.floor(words.length / 2) : -1;
  return (
    <header className="flex items-center gap-3 border-b-2 pb-2" style={{ borderColor: branding.primaryColor }}>
      {branding.logoUrl ? <img src={branding.logoUrl} alt="" className="h-20 w-20 shrink-0 object-contain" /> : <div className="h-20 w-20 shrink-0" />}
      <div className="min-w-0 flex-1 text-center">
        <h1 className="text-xl font-black uppercase leading-tight tracking-tight sm:text-3xl" style={{ fontFamily: 'Georgia, serif' }}>
          {words.map((word, index) => <span key={index} style={{ color: index === middle ? branding.accentColor : '#0f172a' }}>{word} </span>)}
        </h1>
        {branding.address ? <p className="text-xs font-bold sm:text-sm" style={{ color: branding.accentColor }}>{branding.address}</p> : null}
        {branding.website ? <p className="text-xs font-semibold text-[#1e3a8a]">{branding.website}</p> : null}
        <p className="mt-1 text-base font-black uppercase tracking-wide text-[#b91c1c]" style={{ fontFamily: 'Georgia, serif' }}>{title}</p>
      </div>
      {record.student?.photoUrl ? <img src={record.student.photoUrl} alt="" className="h-24 w-20 shrink-0 rounded object-cover" /> : <div className="h-20 w-20 shrink-0" />}
    </header>
  );
}

function DetailsGrid({ record, extra, summary, secondary }) {
  const student = record.student || {};
  const pairs = [
    ['Name', student.name], [secondary ? 'Academic session' : 'School year', record.sessionName],
    ['Class', student.className], ['Term', record.termName],
    ['Admission number', student.displayId], ['No. of times school opened', extra.timesOpened],
    [secondary ? 'No. of students' : 'No. of pupils in class', summary.classSize], ['Attendance', extra.daysPresent],
    ['Age', extra.age], ['Days absent', extra.daysAbsent],
    ...(secondary ? [] : [['Resumption date', extra.resumptionDate]]),
  ];
  return (
    <table className="mt-2 w-full border-collapse text-[11px] sm:text-xs">
      <tbody>
        {Array.from({ length: Math.ceil(pairs.length / 2) }, (_, row) => (
          <tr key={row}>
            {pairs.slice(row * 2, row * 2 + 2).map(([label, value]) => (
              <React.Fragment key={label}>
                <td className="border-2 border-[#7c3aed] px-1.5 py-0.5 font-bold uppercase text-[#1e3a8a]">{label}:</td>
                <td className={`border-2 border-[#7c3aed] px-1.5 py-0.5 font-black uppercase ${label === 'Resumption date' ? 'text-[#b91c1c]' : 'text-[#0f172a]'}`}>{value ?? ''}</td>
              </React.Fragment>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AcademicTable({ record, layout, scoreModel, primary }) {
  const rows = record.subjects || [];
  const components = rows[0]?.caComponents?.length ? rows[0].caComponents : [];
  const cumulative = layout.cumulative;
  const secondary = layout.level === 'secondary';
  // Columns: [label, maximum, value(row)]
  const columns = cumulative
    ? [
      ['1st term', 100, row => row.firstTerm], ['2nd term', 100, row => row.secondTerm],
      [secondary ? '3rd term C.A.' : 'C.A. test', scoreModel.caMaxScore, row => row.caScore], ['Examination', scoreModel.examMaxScore, row => row.examScore],
      ['3rd term total', 100, row => row.total], [secondary ? 'Session average' : 'Cumulative average', 100, row => row.cumulative, true],
    ]
    : [
      ...components.map(component => [component.label || 'C.A.', component.maxScore, row => row.caComponents?.find(item => item.key === component.key)?.score]),
      ...(components.length > 1 || secondary ? [[secondary ? 'C.A. total' : 'C.A. test', scoreModel.caMaxScore, row => row.caScore]] : []),
      ['Examination', scoreModel.examMaxScore, row => row.examScore], ['Total', scoreModel.totalMaxScore, row => row.total, true],
    ];
  const stats = [
    ...(secondary ? [['Position', row => row.position]] : []),
    ['Class highest mark', row => row.classHighest], ['Class lowest mark', row => row.classLowest], ['Class average', row => row.classAverage],
  ];
  const totalOf = getter => rows.reduce((sum, row) => sum + (Number(getter(row)) || 0), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[11px] sm:text-xs">
        <thead>
          <tr>
            <th className={`${HEAD} w-[26%] text-left`} style={{ background: `${primary}14` }}>Subject</th>
            {columns.map(([label]) => <th key={label} className={`${HEAD} h-24 align-bottom`}><span className="inline-block [writing-mode:vertical-rl] rotate-180">{label}</span></th>)}
            {stats.map(([label]) => <th key={label} className={`${HEAD} h-24 align-bottom`}><span className="inline-block [writing-mode:vertical-rl] rotate-180">{label}</span></th>)}
            <th className={`${HEAD} h-24 align-bottom`}><span className="inline-block [writing-mode:vertical-rl] rotate-180">Grade</span></th>
            <th className={`${HEAD} align-bottom`}>{secondary ? 'Comment' : 'Remark'}</th>
          </tr>
          <tr className="text-[10px] font-black text-[#b91c1c]">
            <td className={`${CELL} bg-[#fee2e2]`}>MARKS OBTAINABLE</td>
            {columns.map(([label, max]) => <td key={label} className={`${CELL} text-center`}>{max}</td>)}
            {stats.map(([label]) => <td key={label} className={CELL} />)}
            <td className={CELL} /><td className={CELL} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.subjectId || row.subjectName}-${index}`} className={index % 2 ? 'bg-[#f8fafc]' : 'bg-white'}>
              <td className={`${CELL} font-bold text-[#0f172a]`} style={secondary ? { background: '#fed7aa' } : undefined}>{row.subjectName}</td>
              {columns.map(([label, , get, strong]) => <td key={label} className={`${CELL} text-center font-mono ${strong ? 'bg-[#fef9c3] font-black' : 'font-semibold'}`}>{fmt(get(row))}</td>)}
              {stats.map(([label, get]) => <td key={label} className={`${CELL} text-center font-mono`}>{fmt(get(row))}</td>)}
              <td className={`${CELL} text-center font-black italic text-[#1e1b4b]`}>{row.grade}</td>
              <td className={`${CELL} text-center font-bold`} style={secondary ? { background: '#a7f3d0', color: '#1e1b4b' } : undefined}>{row.remark}</td>
            </tr>
          ))}
          {!secondary ? (
            <>
              <tr><td className={`${CELL} text-right font-black`}>Total</td>{columns.map(([label, , get, strong]) => <td key={label} className={`${CELL} text-center font-black text-[#b91c1c]`}>{strong ? fmt(totalOf(get)) : ''}</td>)}<td className={CELL} colSpan={stats.length + 2} /></tr>
              <tr><td className={`${CELL} text-right font-black`}>Average</td>{columns.map(([label, , get, strong]) => <td key={label} className={`${CELL} text-center font-black`}>{strong && rows.length ? fmt(totalOf(get) / rows.length) : ''}</td>)}<td className={CELL} colSpan={stats.length + 2} /></tr>
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TickTable({ title, items, color }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr><th colSpan={6} className="px-2 py-1 text-center text-sm font-black" style={{ background: '#fef3c7', color }}>{title}</th></tr>
        <tr><th className={`${HEAD} text-left`}>Ratings</th>{RATING_KEY.map(([value]) => <th key={value} className={`${HEAD} w-6 text-center`}>{value}</th>)}</tr>
      </thead>
      <tbody>
        {items.map(item => {
          const value = ratingValue(item.score);
          return (
            <tr key={item.key || item.label}>
              <td className={`${CELL} font-bold text-[#1e3a8a]`}>{item.label}</td>
              {RATING_KEY.map(([rate]) => <td key={rate} className={`${CELL} text-center font-black`}>{value === rate ? '✔' : ''}</td>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NumberTable({ title, items, tone }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead><tr><th className={`${HEAD} text-left text-white`} style={{ background: '#1e3a5f' }}>{title}</th><th className={`${HEAD} text-white`} style={{ background: '#1e3a5f' }}>Rating</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.key || item.label}><td className={`${CELL} font-bold uppercase`} style={{ background: tone }}>{item.label}</td><td className={`${CELL} text-center font-black`}>{item.score ?? ''}</td></tr>)}</tbody>
    </table>
  );
}

function PhysicalDevelopment({ extra }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr><th colSpan={4} className={`${HEAD} text-center text-[#b91c1c]`}>Physical Development</th></tr>
        <tr className="text-[#b91c1c]"><th className={HEAD}>Height</th><th className={HEAD}>cm</th><th className={HEAD}>Weight</th><th className={HEAD}>kg</th></tr>
      </thead>
      <tbody>
        <tr><td className={`${CELL} text-[#1e3a8a]`}>Beginning</td><td className={`${CELL} text-center font-bold text-[#b91c1c]`}>{extra.heightStart || ''}</td><td className={`${CELL} text-[#1e3a8a]`}>Beginning</td><td className={`${CELL} text-center font-bold text-[#b91c1c]`}>{extra.weightStart || ''}</td></tr>
        <tr><td className={`${CELL} text-[#1e3a8a]`}>Ending</td><td className={`${CELL} text-center font-bold text-[#b91c1c]`}>{extra.heightEnd || ''}</td><td className={`${CELL} text-[#1e3a8a]`}>Ending</td><td className={`${CELL} text-center font-bold text-[#b91c1c]`}>{extra.weightEnd || ''}</td></tr>
      </tbody>
    </table>
  );
}

function SummaryBox({ summary, cumulative }) {
  const total = cumulative ? summary.cumulativeTotal : summary.totalScore;
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {[['Total score', fmt(total)], ['Average score', fmt(summary.average)], ['Grade', summary.grade]].map(([label, value]) => (
          <tr key={label}><td className={`${CELL} font-black uppercase text-[#0f172a]`}>{label}</td><td className={`${CELL} text-center text-lg font-black text-[#dc2626]`}>{value}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function Comments({ summary, record, branding, secondary, extra }) {
  const date = record.publishedAt ? new Date(record.publishedAt).toLocaleDateString('en-GB') : '';
  const comment = (label, text, color) => (
    <div className="grid grid-cols-[9rem_1fr] items-start gap-2 sm:grid-cols-[11rem_1fr]">
      <p className="text-xs font-black text-[#0f172a]">{label}</p>
      <p className="min-h-[2.5rem] text-sm font-semibold italic" style={{ color, fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}>{text || ''}</p>
    </div>
  );
  return (
    <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
      <div className="space-y-2">
        {secondary ? <p className="text-xs font-black uppercase">Next term begins: <span className="ml-2 text-base text-[#dc2626]">{extra.resumptionDate || ''}</span></p> : null}
        {comment(secondary ? "Form teacher's comment:" : "Class teacher's comment:", summary.teacherRemark, '#1d4ed8')}
        <p className="text-right text-[11px] text-[#475569]">Signature: ____________ {date ? `Date: ${date}` : ''}</p>
        {comment(secondary ? "Principal's comment:" : "Head teacher's comment:", summary.principalRemark, secondary ? '#1e3a8a' : '#15803d')}
        <p className="text-xs font-black text-[#0f172a]">Parent's signature &amp; date: ______________________</p>
      </div>
      <div className="flex items-end justify-center">
        <SchoolSeal schoolName={branding.schoolName} sealUrl={branding.sealUrl} color="#dc2626" size={104} />
      </div>
    </section>
  );
}

function Page2({ record, page2, branding }) {
  const answers = page2.answers || {};
  const rating = page2.mode === 'rating';
  return (
    <section className="report-page relative mt-6 rounded-xl border border-[#d4d4d8] bg-white p-4 sm:p-6" aria-label="Page 2">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 text-xs font-black uppercase">
        <span>Name: {record.student?.name || ''}</span>
        <span>{record.student?.className || ''}</span>
        <span style={{ color: branding.primaryColor }}>{page2.title}</span>
      </div>
      {rating ? (
        <table className="mb-3 ml-auto border-collapse text-xs">
          <thead><tr><th colSpan={2} className={`${HEAD} text-center`}>Performance level rating</th></tr></thead>
          <tbody>{page2.scale.map(option => <tr key={option.value}><td className={`${CELL} w-8 text-center font-bold`}>{option.value}</td><td className={`${CELL} uppercase`}>{option.label}</td></tr>)}</tbody>
        </table>
      ) : null}
      <div className="space-y-3">
        {page2.sections.map((section, sectionIndex) => (
          <table key={section.key} className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {!rating ? <th className={`${HEAD} w-8`}>{String.fromCharCode(65 + sectionIndex)}</th> : null}
                <th className={`${HEAD} text-center underline`} colSpan={rating ? 2 : 1}>{section.title}</th>
                {!rating ? page2.scale.map(option => <th key={option.value} className={`${HEAD} w-24 text-center`}>{option.label}</th>) : null}
              </tr>
            </thead>
            <tbody>
              {section.items.map((item, itemIndex) => (
                <tr key={item.key}>
                  {!rating ? <td className={`${CELL} text-center`}>{itemIndex + 1}</td> : null}
                  <td className={`${CELL} uppercase`}>{item.label}</td>
                  {rating
                    ? <td className={`${CELL} w-12 text-right font-bold`}>{answers[item.key] || ''}</td>
                    : page2.scale.map(option => <td key={option.value} className={`${CELL} text-center font-black`}>{answers[item.key] === option.value ? '✔' : ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}

export default function ProgressReportCard({ record, branding, scoreModel, qrDataUrl = '', isPreview = false, isPractice = false }) {
  const layout = record.payload?.templateLayout || { level: 'primary', cumulative: false, title: 'End of Term Report' };
  const summary = record.summary || {};
  const extra = record.payload?.extra || {};
  const page2 = record.payload?.page2;
  const secondary = layout.level === 'secondary';
  const grading = gradeKey(record.payload?.settingsSnapshot?.gradingScale || []);
  const title = secondary ? `${record.termName || ''} ${record.sessionName || ''} ${layout.title}`.trim() : layout.title;

  return (
    <div className="result-paper result-record-print-gradient text-[#0f172a]">
      <style>{`@media print { .report-page { break-after: page; page-break-after: always; border: none !important; } .report-page:last-child { break-after: auto; } }`}</style>
      {(isPractice || isPreview) && (
        <div className={`result-record-print-hide mb-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${isPractice ? 'border-[#f59e0b] bg-[#fffbeb] text-[#92400e]' : 'border-[#60a5fa] bg-[#eff6ff] text-[#1e3a8a]'}`}>
          {isPractice ? 'PRACTICE RESULT — for training only; never sent to students or parents.' : 'PREVIEW — exactly what students and parents see once results are published.'}
        </div>
      )}
      <section className="report-page relative overflow-hidden rounded-xl border border-[#d4d4d8] bg-white p-3 sm:p-6" aria-label="Page 1">
        {branding.logoUrl ? <img src={branding.logoUrl} alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-2/3 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" /> : null}
        <div className="relative">
          <Letterhead branding={branding} title={title} record={record} />
          {secondary ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_14rem]">
              <DetailsGrid record={record} extra={extra} summary={summary} secondary />
              <SummaryBox summary={summary} cumulative={layout.cumulative} />
            </div>
          ) : <DetailsGrid record={record} extra={extra} summary={summary} />}

          <div className={`mt-3 grid grid-cols-1 gap-3 ${secondary ? '' : 'lg:grid-cols-[1fr_15rem]'}`}>
            <div>
              <p className="mb-1 text-center text-xs font-black uppercase" style={secondary ? { background: '#1e3a5f', color: '#fff' } : undefined}>{secondary ? 'Cognitive domain' : 'Academic performance'}</p>
              {grading.length ? (
                <div className="mb-1 flex flex-wrap gap-x-3 gap-y-0.5 rounded px-2 py-1 text-[10px] font-bold" style={{ background: secondary ? '#ecfccb' : '#bbf7d0' }}>
                  <span className="font-black underline">KEY TO GRADING:</span>{grading.map(line => <span key={line}>{line}</span>)}
                </div>
              ) : null}
              <AcademicTable record={record} layout={layout} scoreModel={scoreModel} primary={branding.primaryColor} />
            </div>
            {!secondary ? (
              <aside className="space-y-3">
                {record.affective?.length ? <TickTable title="Behaviour/Personality" items={record.affective} color="#1e1b4b" /> : null}
                <div className="rounded bg-[#bbf7d0] px-3 py-2 text-xs">
                  <p className="font-black underline">Key to Ratings</p>
                  {RATING_KEY.map(([value, label]) => <p key={value}>{value}. {label}</p>)}
                </div>
                <PhysicalDevelopment extra={extra} />
                <SummaryBox summary={summary} cumulative={layout.cumulative} />
              </aside>
            ) : null}
          </div>

          {secondary ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {record.ratings?.length ? <NumberTable title="Psychomotor" items={record.ratings} tone="#fef9c3" /> : <div />}
              <div className="rounded bg-[#bfdbfe] px-3 py-2 text-[11px] font-bold">
                <p className="mb-1 bg-[#1e3a5f] text-center text-white">SCALE</p>
                {SECONDARY_SCALE.map(line => <p key={line}>{line}</p>)}
              </div>
              {record.affective?.length ? <NumberTable title="Affective domain" items={record.affective} tone="#fecaca" /> : <div />}
            </div>
          ) : null}

          {summary.subjectBadges?.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-[#fffbeb] px-3 py-2">
              <span className="text-xs font-black uppercase text-[#92400e]">Subject awards:</span>
              {summary.subjectBadges.map(badge => (
                <span key={badge.subjectName} className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-bold text-[#0f172a]">{['🥇', '🥈', '🥉'][badge.place - 1]} {badge.place === 1 ? 'Best' : badge.place === 2 ? '2nd' : '3rd'} in {badge.subjectName}</span>
              ))}
            </div>
          ) : null}
          <Comments summary={summary} record={record} branding={branding} secondary={secondary} extra={extra} />
          {qrDataUrl ? (
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="text-[10px] font-bold uppercase text-[#475569]">{isPreview ? 'Sample code' : 'Scan to verify'}</span>
              <img src={qrDataUrl} alt={isPreview ? 'Sample verification QR code' : 'Result verification QR code'} className="h-16 w-16" />
            </div>
          ) : null}
        </div>
      </section>
      {page2?.sections?.length ? <Page2 record={record} page2={page2} branding={branding} /> : null}
    </div>
  );
}
