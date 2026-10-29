import { resolveCorporateDesign, publishCorporateDesignMetadata } from './corporateDesign';

describe('corporate website design publishing', () => {
  test('defaults to executive for missing or unknown saved design', () => {
    expect(resolveCorporateDesign(undefined, null)).toBe('executive');
    expect(resolveCorporateDesign('unknown', 'unknown')).toBe('executive');
  });

  test('a valid preview overrides the published design without changing it', () => {
    expect(resolveCorporateDesign('executive', 'future')).toBe('future');
    expect(resolveCorporateDesign('future', 'executive')).toBe('executive');
    expect(resolveCorporateDesign('future', 'invalid')).toBe('future');
  });

  test('publishing preserves homepage content metadata and supports rollback', () => {
    const original = { cards: [{ title: 'Feature' }], mediaUrls: ['image.jpg'], corporateDesign: 'executive' };
    const published = publishCorporateDesignMetadata(original, 'future');
    expect(published).toEqual({ ...original, corporateDesign: 'future' });
    expect(original.corporateDesign).toBe('executive');
    expect(publishCorporateDesignMetadata(published, 'executive').corporateDesign).toBe('executive');
  });

  test('rejects invalid designs', () => {
    expect(() => publishCorporateDesignMetadata({}, 'malicious')).toThrow('Invalid corporate design');
  });
});
