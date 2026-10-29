import { normalizeGalleryItems, saveGalleryItems, filterGalleryItems } from './galleryMetadata';

describe('tenant gallery compatibility', () => {
  test('loads existing primary and legacy media URLs without losing order', () => {
    expect(normalizeGalleryItems({ mediaUrls: ['one.jpg', 'two.jpg', 'one.jpg'] }, 'cover.jpg').map(item => item.url))
      .toEqual(['cover.jpg', 'one.jpg', 'two.jpg']);
  });

  test('preserves legacy media when detailed items are present', () => {
    const items = normalizeGalleryItems({
      mediaUrls: ['one.jpg'],
      galleryItems: [{ url: 'one.jpg', caption: 'School day', album: 'Events' }, { url: 'two.jpg', caption: 'Library', album: 'Campus' }],
    });
    expect(items).toEqual([
      { url: 'one.jpg', caption: 'School day', album: 'Events' },
      { url: 'two.jpg', caption: 'Library', album: 'Campus' },
    ]);
  });

  test('saves captions and albums alongside backward-compatible mediaUrls', () => {
    const metadata = saveGalleryItems({ customSetting: true }, [
      { url: 'a.jpg', caption: ' Assembly ', album: 'Events' },
      { url: 'a.jpg', caption: 'duplicate' },
      { url: 'b.jpg', album: 'Sports' },
    ]);
    expect(metadata.customSetting).toBe(true);
    expect(metadata.mediaUrls).toEqual(['a.jpg', 'b.jpg']);
    expect(metadata.galleryItems[0].caption).toBe('Assembly');
    expect(filterGalleryItems(metadata.galleryItems, 'Sports')).toHaveLength(1);
  });

  test('empty galleries do not invent content', () => {
    expect(normalizeGalleryItems({})).toEqual([]);
    expect(saveGalleryItems({}, []).mediaUrls).toEqual([]);
  });
});
