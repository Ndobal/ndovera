export type SubjectSectionOption = {
  id: string;
  label: string;
  subjects: string[];
};

const uniqueSubjects = (subjects: string[]) => Array.from(new Set(subjects.map((subject) => subject.trim()).filter(Boolean)));

export const subjectSectionOptions: SubjectSectionOption[] = [
  {
    id: 'pre-school',
    label: 'Pre-School (Nursery)',
    subjects: uniqueSubjects([
      'English Language',
      'Phonics',
      'Literacy',
      'Letter Work',
      'Numeracy',
      'Number Work',
      'Colouring',
      'Drawing & Painting',
      'Arts and Crafts',
      'Social Habits',
      'Religious Knowledge',
      'Christian Religious Knowledge (CRK)',
      'Islamic Religious Knowledge (IRK)',
      'Physical and Health Education (PHE)',
      'Games / Outdoor Play',
      'Handwriting (Pre-writing skills)',
      'Cutting and Pasting',
      'Puzzle / Problem Solving',
      'My Environment',
      'Basic Technology Exposure',
      'Computer Awareness',
      'Etiquette / Manners',
      'Music and Dance',
      'Speech and Drama',
      'Montessori Activities',
      'Sensory Play',
    ]),
  },
  {
    id: 'primary',
    label: 'Primary (Grade) Section',
    subjects: uniqueSubjects([
      'English Language',
      'Mathematics',
      'Basic Science',
      'Basic Technology',
      'Civic Education',
      'Social Studies',
      'Cultural and Creative Arts (CCA)',
      'Computer Studies / ICT',
      'Agricultural Science',
      'Physical and Health Education (PHE)',
      'Security Education',
      'Home Economics',
      'Religious Studies',
      'Christian Religious Studies (CRS)',
      'Islamic Religious Studies (IRS)',
      'Nigerian Languages',
      'Hausa',
      'Igbo',
      'Yoruba',
      'Local Language',
      'Verbal Reasoning',
      'Quantitative Reasoning',
      'Handwriting',
      'Phonics / Reading',
      'Coding',
      'French',
      'History',
      'Geography',
    ]),
  },
  {
    id: 'junior-secondary',
    label: 'Junior Secondary (Junior High) 1–3',
    subjects: uniqueSubjects([
      'English Language',
      'Mathematics',
      'Basic Science',
      'Basic Technology',
      'Social Studies',
      'Civic Education',
      'Agricultural Science',
      'Home Economics',
      'Business Studies',
      'Computer Studies / ICT',
      'Cultural and Creative Arts (CCA)',
      'Music',
      'Fine Art',
      'Drama',
      'Christian Religious Studies (CRS)',
      'Islamic Religious Studies (IRS)',
      'French',
      'Nigerian Language (Hausa / Igbo / Yoruba)',
      'Physical and Health Education (PHE)',
      'History',
      'Security Education',
    ]),
  },
  {
    id: 'senior-secondary',
    label: 'Senior Secondary (Senior High)',
    subjects: uniqueSubjects([
      'English Language',
      'Mathematics',
      'Civic Education',
      'Physics',
      'Chemistry',
      'Biology',
      'Further Mathematics',
      'Agricultural Science',
      'Computer Science',
      'Technical Drawing',
      'Geography',
      'Accounting',
      'Commerce',
      'Economics',
      'Business Studies / Business Management',
      'Government',
      'Marketing',
      'Office Practice',
      'Literature in English',
      'Christian Religious Studies (CRS)',
      'Islamic Religious Studies (IRS)',
      'History',
      'French',
      'Yoruba / Igbo / Hausa',
      'Music',
      'Fine Art',
      'Catering Craft Practice',
      'Fashion Design',
      'Photography',
      'Data Processing',
      'Fisheries',
      'Animal Husbandry',
      'GSM Maintenance',
      'Carpentry & Joinery',
      'Auto Mechanics',
      'Painting & Decoration',
      'Coding',
      'Artificial Intelligence',
    ]),
  },
];

export const subjectCatalogBySection = Object.fromEntries(
  subjectSectionOptions.map((section) => [section.id, section.subjects]),
) as Record<string, string[]>;

export function getSectionLabel(sectionId: string | undefined | null) {
  return subjectSectionOptions.find((section) => section.id === sectionId)?.label || 'General';
}

export function buildSubjectCode(name: string) {
  const compact = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Za-z0-9/ ]+/g, ' ')
    .split(/[\s/]+/)
    .filter(Boolean);

  if (!compact.length) return '';
  if (compact.length === 1) return compact[0].slice(0, 3).toUpperCase();
  return compact.slice(0, 4).map((part) => part[0]).join('').toUpperCase();
}
