// A paper's structure as the teacher sets it: sections, how many questions,
// how many to answer, marks each, parts (a)(b)(c), compulsory questions.
// describeSection mirrors the server's wording (assessmentEngine.ts).

export const OBJECTIVE = new Set(['mcq', 'truefalse', 'fill']);
export const PART_TYPES = new Set(['structured', 'essay', 'calculation', 'practical', 'short']);
export const PART_LABELS = 'abcdefgh';

const row = (name, type, questions, marksPerQuestion, extra = {}) => ({ name, type, questions, attempt: extra.attempt ?? questions, marksPerQuestion, parts: extra.parts ?? 0, compulsory: extra.compulsory ?? '', instructions: '', instructionsEdited: false });

/** Starting structures — every number can be changed. */
export function presetStructure(kind, standard) {
  if (kind === 'quiz') return [row('A', 'mcq', 10, 1)];
  if (kind === 'assignment') return [row('A', 'short', 4, 3), row('B', 'essay', 1, 8, { parts: 2 })];
  if (kind === 'test') return [row('A', 'mcq', 20, 1), row('B', 'structured', 4, 5, { parts: 2 })];
  switch (standard) {
    case 'waec': return [row('A', 'mcq', 50, 1), row('B', 'essay', 7, 10, { attempt: 5, parts: 3 })];
    case 'neco': return [row('A', 'mcq', 60, 1), row('B', 'essay', 6, 10, { attempt: 4, parts: 3 })];
    case 'igcse': return [row('A', 'mcq', 40, 1), row('B', 'structured', 4, 15, { parts: 4 })];
    case 'sat': return [row('A', 'mcq', 44, 1)];
    default: return [row('A', 'mcq', 40, 1), row('B', 'essay', 5, 20, { attempt: 3, parts: 3 })];
  }
}

export function compulsoryList(value, questions) {
  return [...new Set(String(value || '').split(/[\s,;]+/).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= questions))].sort((a, b) => a - b);
}

export function describeSection(section) {
  const compulsory = compulsoryList(section.compulsory, section.questions);
  const attempt = Math.max(compulsory.length, Number(section.attempt) || section.questions);
  const others = attempt - compulsory.length;
  if (attempt >= section.questions) return OBJECTIVE.has(section.type) ? 'Answer ALL questions in this section. Choose the correct option for each question.' : 'Answer ALL questions in this section.';
  if (compulsory.length) {
    const list = compulsory.length === 1 ? `Question ${compulsory[0]} is compulsory` : `Questions ${compulsory.slice(0, -1).join(', ')} and ${compulsory[compulsory.length - 1]} are compulsory`;
    return others > 0 ? `${list}. Answer any ${others} other question${others === 1 ? '' : 's'}.` : `${list}.`;
  }
  return `Answer any ${attempt} of the ${section.questions} questions in this section.`;
}

/** What a candidate is marked out of, and how many questions are written. */
export function structureTotals(sections) {
  return sections.reduce((totals, section) => ({
    questions: totals.questions + (Number(section.questions) || 0),
    marks: totals.marks + (Number(section.marksPerQuestion) || 0) * Math.min(Number(section.attempt) || 0, Number(section.questions) || 0),
  }), { questions: 0, marks: 0 });
}

/** The structure as the server expects it. */
export function toBlueprint(sections) {
  return {
    sections: sections.map(section => ({
      name: section.name, type: section.type, questions: Number(section.questions) || 1, attempt: Math.min(Number(section.attempt) || 1, Number(section.questions) || 1),
      marksPerQuestion: Number(section.marksPerQuestion) || 1, parts: PART_TYPES.has(section.type) ? Number(section.parts) || 0 : 0,
      compulsory: compulsoryList(section.compulsory, Number(section.questions) || 1),
      instructions: section.instructionsEdited ? section.instructions : '',
    })),
  };
}
