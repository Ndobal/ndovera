import React from 'react';
import { TYPE_LABELS } from './assessmentsApi';
import { PART_LABELS, PART_TYPES, describeSection, structureTotals } from './paperStructure';

// The teacher sets the paper: e.g. Section A — 60 multiple choice, 1 mark each;
// Section B — 5 essays in parts (a)–(c), 10 marks each, Question 1 compulsory,
// answer any 3 others. The instruction line writes itself and can be edited.

const CELL = 'rounded-lg border border-[#c9a96e]/45 bg-white p-1.5 text-sm text-[#191970]';
const TH = 'p-1.5 text-left text-[11px] font-bold uppercase text-[#800020]';

export default function PaperStructureEditor({ sections, onChange }) {
  const set = (index, patch) => onChange(sections.map((section, i) => {
    if (i !== index) return section;
    const next = { ...section, ...patch };
    next.questions = Math.max(1, Math.min(120, Number(next.questions) || 1));
    next.attempt = Math.max(1, Math.min(next.questions, Number(next.attempt) || next.questions));
    if (!next.instructionsEdited) next.instructions = describeSection(next);
    return next;
  }));
  const totals = structureTotals(sections);
  const addSection = () => onChange([...sections, { name: String.fromCharCode(65 + sections.length), type: 'essay', questions: 4, attempt: 2, marksPerQuestion: 10, parts: 3, compulsory: '', instructions: '', instructionsEdited: false }].map(section => (section.instructionsEdited ? section : { ...section, instructions: describeSection(section) })));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm text-[#191970]">
          <thead>
            <tr><th className={TH}>Section</th><th className={TH}>Question type</th><th className={TH}>Questions</th><th className={TH}>Answer</th><th className={TH}>Marks each</th><th className={TH}>Parts</th><th className={TH}>Compulsory Q.</th><th className={TH}>Instruction on the paper</th><th /></tr>
          </thead>
          <tbody>
            {sections.map((section, index) => {
              const allowsParts = PART_TYPES.has(section.type);
              return (
                <tr key={index} className="border-t border-[#c9a96e]/30 align-top">
                  <td className="p-1"><input aria-label="Section name" className={`${CELL} w-12`} value={section.name} onChange={event => set(index, { name: event.target.value.slice(0, 3) })} /></td>
                  <td className="p-1"><select aria-label="Question type" className={CELL} value={section.type} onChange={event => set(index, { type: event.target.value, parts: PART_TYPES.has(event.target.value) ? section.parts : 0 })}>{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td>
                  <td className="p-1"><input aria-label="Number of questions" type="number" min="1" max="120" className={`${CELL} w-20`} value={section.questions} onChange={event => set(index, { questions: event.target.value, attempt: Number(section.attempt) >= Number(section.questions) ? event.target.value : section.attempt })} /></td>
                  <td className="p-1 whitespace-nowrap">
                    <select aria-label="How many to answer" className={CELL} value={Number(section.attempt) >= Number(section.questions) ? 'all' : section.attempt} onChange={event => set(index, { attempt: event.target.value === 'all' ? section.questions : event.target.value })}>
                      <option value="all">All</option>
                      {Array.from({ length: Math.max(0, Number(section.questions) - 1) }, (_, i) => i + 1).map(n => <option key={n} value={n}>Any {n}</option>)}
                    </select>
                  </td>
                  <td className="p-1"><input aria-label="Marks per question" type="number" min="1" max="100" className={`${CELL} w-20`} value={section.marksPerQuestion} onChange={event => set(index, { marksPerQuestion: event.target.value })} /></td>
                  <td className="p-1">
                    <select aria-label="Parts per question" className={CELL} disabled={!allowsParts} value={allowsParts ? section.parts : 0} onChange={event => set(index, { parts: Number(event.target.value) })}>
                      <option value={0}>None</option>
                      {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>(a)–({PART_LABELS[n - 1]})</option>)}
                    </select>
                  </td>
                  <td className="p-1"><input aria-label="Compulsory questions" className={`${CELL} w-24`} placeholder="e.g. 1" disabled={Number(section.attempt) >= Number(section.questions)} value={section.compulsory} onChange={event => set(index, { compulsory: event.target.value.replace(/[^\d,\s]/g, '') })} /></td>
                  <td className="p-1">
                    <input aria-label="Instruction" className={`${CELL} w-full min-w-[16rem]`} value={section.instructions || describeSection(section)} onChange={event => set(index, { instructions: event.target.value, instructionsEdited: true })} />
                    {section.instructionsEdited && <button type="button" className="mt-0.5 text-[11px] font-bold text-[#800020] underline" onClick={() => set(index, { instructionsEdited: false })}>Write it for me</button>}
                  </td>
                  <td className="p-1"><button type="button" className="text-xs font-bold text-rose-700 underline disabled:opacity-40" disabled={sections.length === 1} onClick={() => onChange(sections.filter((_, i) => i !== index))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="rounded-xl border border-[#c9a96e]/50 bg-white px-3 py-1.5 text-sm font-bold text-[#800020]" onClick={addSection}>+ Section</button>
        <p className="text-sm font-bold text-[#191970]">{totals.questions} questions written · marked out of {totals.marks}</p>
      </div>
    </div>
  );
}
