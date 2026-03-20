# Ad-Free Zones - Quick Reference

## TL;DR

Ads are **disabled on these 15 pages/features:**

```
❌ CBT
❌ Exams
❌ Voting (Civic Centre)
❌ Results pages
❌ Messaging
❌ Video streams
❌ Library reading
❌ Practice corner
❌ AI study sessions
❌ Assignments
❌ Profile editing
❌ Payments
❌ Cashouts
❌ Financial pages
```

## For Component Developers

### Add Ads to a Page

```tsx
import { AdPlacement } from '../components/AdPlacement';

export const MyPage = () => {
  return (
    <div>
      <main>{/* content */}</main>
      <AdPlacement position="sidebar" farmingModeActive={true} />
    </div>
  );
};
```

### Check if Current Page is Ad-Free

```tsx
import { isCurrentPathAdFree } from '../utils/adUtils';

const MyComponent = () => {
  const isAdFree = isCurrentPathAdFree(window.location.pathname);
  
  return (
    <div>
      {!isAdFree && <AdvertisingSection />}
    </div>
  );
};
```

### Check Specific Zone

```tsx
import { isAdFreeZone } from '../utils/adUtils';

if (isAdFreeZone('exams')) {
  console.log('Exams are protected from ads');
}
```

## For Backend Developers

### Get Protected Zones

```javascript
const { isAdFreeZone } = require('../controllers/settingsController');

if (isAdFreeZone('payments')) {
  // Don't serve ads for payments
}
```

### API Endpoint

```
GET /api/settings/ad-free-zones
→ Returns list of all protected zones
```

## For Admin

### View Protected Zones

```tsx
import { AdFreeZonesInfo, AdZonesOverviewTable } from '../components/AdFreeZonesInfo';

<AdminSettings>
  <AdFreeZonesInfo />
  <AdZonesOverviewTable />
</AdminSettings>
```

## Files Changed

| File | Change |
|------|--------|
| `backend/controllers/settingsController.js` | Added `getAdFreeZones()`, `isAdFreeZone()` |
| `backend/routes/settings.js` | Added `GET /api/settings/ad-free-zones` |
| `nsms-frontend/src/utils/adUtils.ts` | New utility with 4 helper functions |
| `nsms-frontend/src/components/AdPlacement.tsx` | New reusable ad component |
| `nsms-frontend/src/components/AdFreeZonesInfo.tsx` | New admin info component |
| `nsms-frontend/src/pages/DashboardStudent.tsx` | Updated to check `isCurrentPathAdFree()` |
| `nsms-frontend/src/styles.css` | Added 200+ lines of ad-free zone styles |

## Testing the System

### Test Ads are Visible
```
Navigate to: http://localhost:3000/student
Expected: Ads column appears on right (farming mode active)
```

### Test Ads are Hidden
```
Navigate to: http://localhost:3000/exams
Expected: No ads appear
```

### Test Info Display
```
Navigate to: Settings → Ad-Free Zones
Expected: See list of 15 protected zones
```

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Ads still showing in exams | Clear cache, hard refresh: `Ctrl+Shift+R` |
| Zone not recognized | Check spelling (case-insensitive) |
| Component not rendering | Verify `farmingModeActive={true}` |

## Zone Names (Exact Match)

```
cbt
exams
voting
civic-centre
results
messaging
video-streams
library-reading
practice-corner
ai-study
assignments
profile-editing
payments
cashouts
financial-pages
```

---

**Status:** ✅ Fully Implemented & Live
**Coverage:** 15 protected zones
**Last Updated:** 2026-02-10
