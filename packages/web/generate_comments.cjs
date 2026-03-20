const fs = require('fs');
const traits = ['polite', 'cooperative', 'attentive', 'diligent', 'respectful', 'enthusiastic', 'helpful', 'determined', 'punctual', 'reliable', 'creative', 'focused', 'curious', 'friendly', 'sociable', 'responsible', 'observant', 'resilient', 'engaged', 'active', 'dedicated', 'patient', 'tolerant', 'thoughtful', 'independent', 'considerate', 'cheerful', 'articulate', 'confident', 'caring'];
const modifiers = ['always', 'consistently', 'frequently', 'often', 'routinely', 'generally', 'mostly', 'usually'];
const contexts = ['in class', 'during group work', 'with peers', 'towards teachers', 'in their studies', 'during discussions', 'when faced with challenges', 'in daily activities', 'in independent tasks', 'in extra-curriculars'];
const impacts = ['which sets a great example.', 'making them a joy to teach.', 'contributing positively to the class environment.', 'showing great maturity.', 'which is highly commendable.', 'reflecting strong character.', 'which will serve them well.', 'adding value to the classroom.'];

let behavioral = [];
while(behavioral.length < 100) {
  let trait = traits[Math.floor(Math.random() * traits.length)];
  let mod = modifiers[Math.floor(Math.random() * modifiers.length)];
  let ctx = contexts[Math.floor(Math.random() * contexts.length)];
  let imp = impacts[Math.floor(Math.random() * impacts.length)];
  let cmt = `The student is ${mod} ${trait} ${ctx}, ${imp}`;
  if(!behavioral.includes(cmt)) behavioral.push(cmt);
}

const acad_prefixes = ['Demonstrates strong understanding', 'Shows excellent progress', 'Displays great effort', 'Has an excellent grasp', 'Shows remarkable improvement', 'Consistently performs well', 'Has a solid foundation', 'Shows outstanding dedication', 'Produces high-quality work', 'Exhibits deep knowledge'];
const acad_areas = ['in core subjects', 'across all academic areas', 'in analytical tasks', 'in problem-solving', 'in theoretical concepts', 'in practical applications', 'in written assignments', 'in project work', 'in critical thinking', 'in continuous assessments'];
const acad_results = ['leading to excellent grades.', 'resulting in commendable achievements.', 'ensuring academic success.', 'reflecting their hard work.', 'showing clear potential for the future.', 'making steady academic growth.', 'maintaining a high standard.'];

let academic = [];
while(academic.length < 50) {
  let pref = acad_prefixes[Math.floor(Math.random() * acad_prefixes.length)];
  let area = acad_areas[Math.floor(Math.random() * acad_areas.length)];
  let res = acad_results[Math.floor(Math.random() * acad_results.length)];
  let cmt = `${pref} ${area}, ${res}`;
  if(!academic.includes(cmt)) academic.push(cmt);
}

const content = `export const behavioralComments = ${JSON.stringify(behavioral, null, 2)};\n\nexport const academicComments = ${JSON.stringify(academic, null, 2)};\n`;

fs.writeFileSync('src/features/classroom/data/commentBank.ts', content);
console.log('Comment bank created with ' + behavioral.length + ' behavioral and ' + academic.length + ' academic comments.');