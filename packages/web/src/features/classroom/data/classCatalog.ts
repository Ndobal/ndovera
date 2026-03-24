export type ClassCatalogEntry = {
  id: string;
  label: string;
  level: string;
  name: string;
  aliases?: string[];
  hierarchyTag?: string;
  hierarchyIndex?: number;
  nextHierarchyTag?: string;
  isOptional?: boolean;
  graduatesToAlumniWhenFinal?: boolean;
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
    label: 'Pre-School Section',
    entries: uniqueEntries([
      { id: 'creche', level: 'Creche', name: 'Creche', label: 'Creche', hierarchyTag: 'creche', hierarchyIndex: 1, nextHierarchyTag: 'explorers', aliases: ['Daycare', 'Early Years'], note: 'Promotes to Explorers' },
      { id: 'explorers', level: 'Explorers', name: 'Explorers', label: 'Explorers', hierarchyTag: 'explorers', hierarchyIndex: 2, nextHierarchyTag: 'reception', aliases: ['Early Explorers'], note: 'Promotes to Reception' },
      { id: 'reception', level: 'Reception', name: 'Reception', label: 'Reception', hierarchyTag: 'reception', hierarchyIndex: 3, nextHierarchyTag: 'pre-school-1', aliases: ['Wright Brothers'], note: 'Promotes to Pre-School 1 / Nursery 1' },
      { id: 'pre-school-1', level: 'Pre-School 1', name: 'Pre-School 1', label: 'Pre-School 1', hierarchyTag: 'pre-school-1', hierarchyIndex: 4, nextHierarchyTag: 'pre-school-2', aliases: ['Nursery 1'], note: 'Promotes to Pre-School 2 / Nursery 2' },
      { id: 'pre-school-2', level: 'Pre-School 2', name: 'Pre-School 2', label: 'Pre-School 2', hierarchyTag: 'pre-school-2', hierarchyIndex: 5, nextHierarchyTag: 'grade-1', aliases: ['Nursery 2'], note: 'Promotes to Grade 1 / Primary 1' },
    ]),
  },
  {
    id: 'primary',
    label: 'Primary Section',
    entries: uniqueEntries([
      { id: 'grade-1', level: 'Grade 1', name: 'Grade 1', label: 'Grade 1', hierarchyTag: 'grade-1', hierarchyIndex: 6, nextHierarchyTag: 'grade-2', aliases: ['Primary 1'], note: 'Promotes to Grade 2 / Primary 2' },
      { id: 'grade-2', level: 'Grade 2', name: 'Grade 2', label: 'Grade 2', hierarchyTag: 'grade-2', hierarchyIndex: 7, nextHierarchyTag: 'grade-3', aliases: ['Primary 2'], note: 'Promotes to Grade 3 / Primary 3' },
      { id: 'grade-3', level: 'Grade 3', name: 'Grade 3', label: 'Grade 3', hierarchyTag: 'grade-3', hierarchyIndex: 8, nextHierarchyTag: 'grade-4', aliases: ['Primary 3'], note: 'Promotes to Grade 4 / Primary 4' },
      { id: 'grade-4', level: 'Grade 4', name: 'Grade 4', label: 'Grade 4', hierarchyTag: 'grade-4', hierarchyIndex: 9, nextHierarchyTag: 'grade-5', aliases: ['Primary 4'], note: 'Promotes to Grade 5 / Primary 5' },
      { id: 'grade-5', level: 'Grade 5', name: 'Grade 5', label: 'Grade 5', hierarchyTag: 'grade-5', hierarchyIndex: 10, nextHierarchyTag: 'grade-6', aliases: ['Primary 5', 'Apollos'], graduatesToAlumniWhenFinal: true, note: 'Promotes to Grade 6 where used, otherwise can graduate to Alumni' },
      { id: 'grade-6', level: 'Grade 6', name: 'Grade 6', label: 'Grade 6', hierarchyTag: 'grade-6', hierarchyIndex: 11, nextHierarchyTag: 'jhs-1', aliases: ['Primary 6'], isOptional: true, graduatesToAlumniWhenFinal: true, note: 'Optional final primary class and Alumni graduation point' },
    ]),
  },
  {
    id: 'junior-secondary',
    label: 'Junior High School',
    entries: uniqueEntries([
      { id: 'jhs-1', level: 'JHS 1', name: 'JHS 1', label: 'JHS 1', hierarchyTag: 'jhs-1', hierarchyIndex: 12, nextHierarchyTag: 'jhs-2', aliases: ['JSS 1', 'Junior Secondary School 1'], note: 'Promotes to JHS 2 / JSS 2' },
      { id: 'jhs-2', level: 'JHS 2', name: 'JHS 2', label: 'JHS 2', hierarchyTag: 'jhs-2', hierarchyIndex: 13, nextHierarchyTag: 'jhs-3', aliases: ['JSS 2', 'Junior Secondary School 2'], note: 'Promotes to JHS 3 / JSS 3' },
      { id: 'jhs-3', level: 'JHS 3', name: 'JHS 3', label: 'JHS 3', hierarchyTag: 'jhs-3', hierarchyIndex: 14, nextHierarchyTag: 'shs-1', aliases: ['JSS 3', 'Junior Secondary School 3'], graduatesToAlumniWhenFinal: true, note: 'Can graduate to Alumni or transition to SHS 1 depending on school progression' },
    ]),
  },
  {
    id: 'senior-secondary',
    label: 'Senior High School',
    entries: uniqueEntries([
      { id: 'shs-1', level: 'SHS 1', name: 'SHS 1', label: 'SHS 1', hierarchyTag: 'shs-1', hierarchyIndex: 15, nextHierarchyTag: 'shs-2', aliases: ['SS 1', 'SSS 1', 'Senior Secondary School 1'], note: 'Promotes to SHS 2 / SS 2' },
      { id: 'shs-2', level: 'SHS 2', name: 'SHS 2', label: 'SHS 2', hierarchyTag: 'shs-2', hierarchyIndex: 16, nextHierarchyTag: 'shs-3', aliases: ['SS 2', 'SSS 2', 'Senior Secondary School 2'], note: 'Promotes to SHS 3 / SS 3' },
      { id: 'shs-3', level: 'SHS 3', name: 'SHS 3', label: 'SHS 3', hierarchyTag: 'shs-3', hierarchyIndex: 17, aliases: ['SS 3', 'SSS 3', 'Senior Secondary School 3'], graduatesToAlumniWhenFinal: true, note: 'Final senior class and Alumni graduation point' },
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
  const normalizedLevel = String(level || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim().toLowerCase();
  if (normalizedLevel && normalizedLevel === normalizedName) return String(level || '').trim();
  return [level, name].filter(Boolean).join(' ').trim();
}
