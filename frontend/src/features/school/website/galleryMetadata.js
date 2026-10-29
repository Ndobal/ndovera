/**
 * Tenant website gallery metadata. Keep mediaUrls for compatibility with the
 * existing public Worker renderer; richer records are optional enhancements.
 */
export function normalizeGalleryItems(metadata = {}, primaryUrl = '') {
  const raw = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const legacy = [primaryUrl, ...(Array.isArray(raw.mediaUrls) ? raw.mediaUrls : [])];
  const detailed = Array.isArray(raw.galleryItems) ? raw.galleryItems : [];
  const byUrl = new Map();
  for (const item of detailed) {
    const url = typeof item?.url === 'string' ? item.url.trim() : '';
    if (!url || byUrl.has(url)) continue;
    byUrl.set(url, { url, caption: String(item.caption || ''), album: String(item.album || '') });
  }
  const order = [...legacy, ...byUrl.keys()].map(url => String(url || '').trim()).filter(Boolean);
  return [...new Set(order)].map(url => byUrl.get(url) || { url, caption: '', album: '' });
}

export function saveGalleryItems(metadata, items) {
  const current = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const normalized = [];
  const seen = new Set();
  for (const item of items || []) {
    const url = String(item?.url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    normalized.push({ url, caption: String(item.caption || '').trim(), album: String(item.album || '').trim() });
  }
  return { ...current, mediaUrls: normalized.map(item => item.url), galleryItems: normalized };
}

export function filterGalleryItems(items, album) {
  return album ? items.filter(item => item.album === album) : items;
}
