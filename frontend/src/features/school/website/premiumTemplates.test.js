import { PREMIUM_SCHOOL_TEMPLATES, getPremiumSchoolTemplate, selectWebsitePresentation } from './premiumTemplates';

describe('premium school website presentation definitions', () => {
  test('has four unique, distinct premium themes', () => {
    expect(PREMIUM_SCHOOL_TEMPLATES).toHaveLength(4);
    expect(new Set(PREMIUM_SCHOOL_TEMPLATES.map(t => t.id)).size).toBe(4);
    expect(getPremiumSchoolTemplate('royal-crest-academy').name).toBe('Royal Crest Academy');
    expect(getPremiumSchoolTemplate('not-a-template')).toBeNull();
  });

  test('keeps existing tenant section records unchanged', () => {
    const sections = [{ section_key: 'hero', title: 'Our School', metadata: { mediaUrls: ['photo.jpg'] } }];
    const before = JSON.stringify(sections);
    const result = selectWebsitePresentation(sections, 'bloom-campus');
    expect(result.sections).toBe(sections);
    expect(JSON.stringify(sections)).toBe(before);
    expect(result.template.id).toBe('bloom-campus');
  });
});
