export type ClassCatalogEntry = {
  id: string;
  label: string;
  level: string;
  name: string;
  note?: string;
};

export type ClassCatalogSection = {
  id: string;
  label: string;
  entries: ClassCatalogEntry[];
};

const uniqueEntries = (entries: ClassCatalogEntry[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.level}__${entry.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const classCatalogSections: ClassCatalogSection[] = [
  {
    id: 'pre-school',
    label: 'Preschool (Nursery Section)',
    entries: uniqueEntries([
      { id: 'preschool_explorers', level: '1.6 – 2+', name: 'Explorers', label: 'Explorers', note: 'Early discovery class' },
      { id: 'preschool_discoverers', level: '3 – 4', name: 'Discoverers', label: 'Discoverers', note: 'Nursery discovery class' },
      { id: 'preschool_adventurers', level: '4 – 5', name: 'Adventurers', label: 'Adventurers', note: 'Curious learners class' },
      { id: 'preschool_trailblazers', level: '5 – 6', name: 'Trailblazers', label: 'Trailblazers', note: 'School-readiness class' },
    ]),
  },
  {
    id: 'primary',
    label: 'Primary Section',
    entries: uniqueEntries([
      { id: 'primary_grade1_pathfinders', level: 'Grade 1', name: 'Pathfinders', label: 'Pathfinders' },
      { id: 'primary_grade2_voyagers', level: 'Grade 2', name: 'Voyagers', label: 'Voyagers' },
      { id: 'primary_grade3_pioneers', level: 'Grade 3', name: 'Pioneers', label: 'Pioneers' },
      { id: 'primary_grade4_innovators', level: 'Grade 4', name: 'Innovators', label: 'Innovators' },
      { id: 'primary_grade5_scholars', level: 'Grade 5', name: 'Scholars', label: 'Scholars', note: 'Some schools end primary here' },
      { id: 'primary_grade6_leaders', level: 'Grade 6', name: 'Leaders', label: 'Leaders' },
    ]),
  },
  {
    id: 'junior-secondary',
    label: 'Junior High School',
    entries: uniqueEntries([
      { id: 'jhs1_thinkers', level: 'JHS 1', name: 'Thinkers', label: 'Thinkers' },
      { id: 'jhs2_strategists', level: 'JHS 2', name: 'Strategists', label: 'Strategists' },
      { id: 'jhs3_achievers', level: 'JHS 3', name: 'Achievers', label: 'Achievers' },
    ]),
  },
  {
    id: 'senior-secondary',
    label: 'Senior High School',
    entries: uniqueEntries([
      { id: 'shs1_visionaries', level: 'SHS 1', name: 'Visionaries', label: 'Visionaries' },
      { id: 'shs2_trailmasters', level: 'SHS 2', name: 'Trailmasters', label: 'Trailmasters' },
      { id: 'shs3_legends', level: 'SHS 3', name: 'Legends', label: 'Legends' },
    ]),
  },
];

export const classCatalogBySection = Object.fromEntries(
  classCatalogSections.map((section) => [section.id, section.entries]),
) as Record<string, ClassCatalogEntry[]>;

export function getClassSectionLabel(sectionId: string | undefined | null) {
  return classCatalogSections.find((section) => section.id === sectionId)?.label || 'General';
}

export function buildClassDisplayName(level: string | undefined | null, name: string | undefined | null) {
  return [level, name].filter(Boolean).join(' ').trim();
}
