/**
 * Presentation-only definitions for the premium school website themes.
 * School text and media remain in the existing website section records.
 * These definitions intentionally contain no sample school content.
 */
export const PREMIUM_SCHOOL_TEMPLATES = Object.freeze([
  {
    id: 'aurora-academy',
    name: 'Aurora Academy',
    description: 'Editorial elegance for international and secondary schools.',
    palette: { primary: '#102A43', accent: '#D9A441', background: '#F7F4EB', surface: '#FFFFFF', text: '#102A43' },
    layout: 'editorial',
  },
  {
    id: 'bloom-campus',
    name: 'Bloom Campus',
    description: 'Colourful, welcoming design for early years and primary schools.',
    palette: { primary: '#087F8C', accent: '#FF725E', background: '#F9F8F3', surface: '#FFFFFF', text: '#183747' },
    layout: 'playful',
  },
  {
    id: 'evergreen-scholars',
    name: 'Evergreen Scholars',
    description: 'Calm, refined design with a nature-inspired aesthetic.',
    palette: { primary: '#174C3C', accent: '#B77848', background: '#F5F0E6', surface: '#FFFFFF', text: '#173A30' },
    layout: 'organic',
  },
  {
    id: 'royal-crest-academy',
    name: 'Royal Crest Academy',
    description: 'Timeless burgundy and champagne-gold academic prestige.',
    palette: { primary: '#681D36', accent: '#C9A45C', background: '#FFF9F0', surface: '#FFFFFF', text: '#361524' },
    layout: 'heritage',
  },
]);

export const PREMIUM_SCHOOL_TEMPLATE_IDS = Object.freeze(PREMIUM_SCHOOL_TEMPLATES.map(template => template.id));

export function getPremiumSchoolTemplate(id) {
  return PREMIUM_SCHOOL_TEMPLATES.find(template => template.id === id) || null;
}

/** Do not mutate, clone or re-key school content when selecting a presentation. */
export function selectWebsitePresentation(sectionRecords, templateId) {
  return {
    template: getPremiumSchoolTemplate(templateId),
    sections: sectionRecords,
  };
}
