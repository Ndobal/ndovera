/**
 * Ad-Free Zones Utility
 * Manages global rules for ad-free pages and features
 */

// Default ad-free zones
const AD_FREE_ZONES = [
  'cbt',
  'exams',
  'voting',
  'civic-centre',
  'results',
  'messaging',
  'video-streams',
  'library-reading',
  'practice-corner',
  'ai-study',
  'assignments',
  'profile-editing',
  'payments',
  'cashouts',
  'financial-pages',
];

/**
 * Check if a given zone is ad-free
 * @param zone - The zone/feature name to check
 * @returns true if ads are disabled in this zone
 */
export function isAdFreeZone(zone: string | null | undefined): boolean {
  if (!zone) return false;
  const normalized = String(zone).toLowerCase().trim();
  return AD_FREE_ZONES.includes(normalized);
}

/**
 * Check if current route is ad-free based on path
 * @param pathname - Current window.location.pathname
 * @returns true if ads should be disabled on this route
 */
export function isCurrentPathAdFree(pathname: string): boolean {
  // Extract the main route from pathname
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;

  // Map routes to zone names
  const routeZoneMap: Record<string, string> = {
    cbt: 'cbt',
    exams: 'exams',
    'online-exams': 'exams',
    'civic-centre': 'civic-centre',
    voting: 'voting',
    results: 'results',
    messaging: 'messaging',
    messages: 'messaging',
    'video-streams': 'video-streams',
    videos: 'video-streams',
    library: 'library-reading',
    'practice-corner': 'practice-corner',
    practice: 'practice-corner',
    'ai-study': 'ai-study',
    assignments: 'assignments',
    profile: 'profile-editing',
    settings: 'profile-editing',
    payments: 'payments',
    cashouts: 'cashouts',
    'financial-pages': 'financial-pages',
  };

  const normalizedSegments = segments.map((segment) => segment.toLowerCase());
  const zoneKey = normalizedSegments.find((segment) => Boolean(routeZoneMap[segment]));
  const zone = zoneKey ? routeZoneMap[zoneKey] : null;
  return zone ? isAdFreeZone(zone) : false;
}

/**
 * Get list of all ad-free zones
 */
export function getAdFreeZonesList(): string[] {
  return [...AD_FREE_ZONES];
}

/**
 * Format zone names for display
 * @param zone - Zone name (e.g., 'practice-corner')
 * @returns Formatted display name (e.g., 'Practice Corner')
 */
export function formatZoneName(zone: string): string {
  return zone
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
