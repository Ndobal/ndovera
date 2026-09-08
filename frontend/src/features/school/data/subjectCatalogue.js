/**
 * The subjects NDOVERA offers a school to pick from.
 *
 * Nigerian curriculum, grouped the way a school thinks about it rather than
 * alphabetically, so an owner setting up JSS 1 is not reading past Further
 * Mathematics to find Basic Science. It is a starting point, never a
 * restriction: a school adds anything else by typing it, and whatever it adds
 * joins its own list for next time.
 */
const SUBJECT_CATALOGUE = [
  {
    group: 'Early Years',
    subjects: [
      'Numeracy', 'Literacy', 'Phonics', 'Rhymes and Songs', 'Colouring and Drawing',
      'Health Habits', 'Practical Life', 'Show and Tell', 'Story Time',
    ],
  },
  {
    group: 'Primary',
    subjects: [
      'Mathematics', 'English Studies', 'Basic Science and Technology', 'National Values Education',
      'Cultural and Creative Arts', 'Nigerian Language', 'Religious Studies', 'Verbal Reasoning',
      'Quantitative Reasoning', 'Handwriting', 'Physical and Health Education',
      'Computer Studies', 'Agricultural Science', 'Home Economics',
    ],
  },
  {
    group: 'Junior Secondary',
    subjects: [
      'Mathematics', 'English Language', 'Basic Science', 'Basic Technology',
      'Social Studies', 'Civic Education', 'Business Studies', 'Agricultural Science',
      'Home Economics', 'Computer Studies', 'Cultural and Creative Arts',
      'Christian Religious Studies', 'Islamic Religious Studies', 'French',
      'Nigerian Language', 'Physical and Health Education', 'Security Education',
      'History', 'Music',
    ],
  },
  {
    group: 'Senior Secondary — Core',
    subjects: [
      'Mathematics', 'English Language', 'Civic Education', 'Computer Studies',
      'Physical and Health Education', 'Christian Religious Studies',
      'Islamic Religious Studies', 'French', 'Nigerian Language', 'Data Processing',
    ],
  },
  {
    group: 'Senior Secondary — Science',
    subjects: [
      'Physics', 'Chemistry', 'Biology', 'Further Mathematics', 'Agricultural Science',
      'Technical Drawing', 'Health Education', 'Geography', 'Basic Electronics',
    ],
  },
  {
    group: 'Senior Secondary — Arts',
    subjects: [
      'Literature in English', 'Government', 'History', 'Christian Religious Knowledge',
      'Islamic Studies', 'Visual Arts', 'Music', 'Geography', 'Economics',
    ],
  },
  {
    group: 'Senior Secondary — Commercial',
    subjects: [
      'Economics', 'Financial Accounting', 'Commerce', 'Office Practice',
      'Store Management', 'Insurance', 'Marketing', 'Book Keeping',
    ],
  },
];

/** Every catalogue subject once, for de-duplicating against a school's own list. */
export const CATALOGUE_SUBJECT_NAMES = Array.from(new Set(
  SUBJECT_CATALOGUE.flatMap(section => section.subjects),
));

export default SUBJECT_CATALOGUE;
