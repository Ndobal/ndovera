# Ad-Free Zones System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   User Navigation Event                      │
│               (Route Change / Page Load)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  AdPlacement Component     │
        │  Initializes & Mounts      │
        └────────────┬───────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────────┐       ┌──────────────────┐
    │ Check Zone  │       │ Check Current    │
    │ Parameter   │       │ Path (pathname)  │
    └─────┬───────┘       └────────┬─────────┘
          │                        │
          └────────────┬───────────┘
                       │
                       ▼
        ┌─────────────────────────────────────┐
        │  isAdFreeZone() + isCurrentPathAdFree()
        │  Query DEFAULT_AD_FREE_ZONES Array   │
        └─────────────┬───────────────────────┘
                      │
          ┌───────────┴──────────┐
          │                      │
     YES (Ad-Free)         NO (Ad-Enabled)
          │                      │
          ▼                      ▼
    ┌──────────────┐      ┌──────────────────┐
    │ Return null  │      │ Check farmingMode│
    │ Hide ads     │      │ & adsVisible     │
    └──────────────┘      └────────┬─────────┘
                                   │
                          ┌────────┴────────┐
                          │                 │
                       YES                NO
                          │                 │
                          ▼                 ▼
                     ┌─────────┐      ┌──────────┐
                     │ Render  │      │ Hide     │
                     │ Ads     │      │ Ads      │
                     └─────────┘      └──────────┘
```

## Component Hierarchy

```
src/
├── pages/
│   ├── DashboardStudent.tsx
│   │   └── Imports: isCurrentPathAdFree
│   ├── DashboardTeacher.tsx
│   ├── ExamsPage.tsx
│   │   └── AdPlacement will auto-hide (exams = ad-free)
│   └── ...
│
├── components/
│   ├── AdPlacement.tsx ⭐
│   │   ├── Props: zone, farmingModeActive, position
│   │   ├── Uses: isCurrentPathAdFree(), isAdFreeZone()
│   │   └── Returns: Ads or null
│   │
│   └── AdFreeZonesInfo.tsx ⭐
│       ├── AdFreeZonesInfo: Summary display
│       └── AdZonesOverviewTable: Admin table
│
└── utils/
    └── adUtils.ts ⭐
        ├── isAdFreeZone(zone)
        ├── isCurrentPathAdFree(pathname)
        ├── getAdFreeZonesList()
        └── formatZoneName(zone)
```

## Backend Architecture

```
backend/
├── controllers/
│   └── settingsController.js ⭐
│       ├── DEFAULT_AD_FREE_ZONES: string[]
│       ├── getAdsConfig()
│       ├── updateAdsConfig()
│       ├── getAdFreeZones() ⭐ NEW
│       └── isAdFreeZone(zone) ⭐ NEW
│
└── routes/
    └── settings.js ⭐
        ├── GET /api/settings/ads
        ├── POST /api/settings/ads
        └── GET /api/settings/ad-free-zones ⭐ NEW
```

## Data Flow for Ad Rendering

```
┌──────────────────────────────────────────────────┐
│ DashboardStudent Component Mounts                 │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
     ┌──────────────────────────┐
     │ Call useEffect hooks:    │
     ├──────────────────────────┤
     │ 1. Fetch ads_count from  │
     │    /api/settings/ads     │
     │                          │
     │ 2. Setup 15-min interval │
     │    to toggle visibility  │
     └────────────┬─────────────┘
                  │
                  ▼
     ┌──────────────────────────┐
     │ Calculate adsToShow:     │
     │ • Repeat ads library     │
     │ • Filter by adsCount     │
     │ • Create ad cards        │
     └────────────┬─────────────┘
                  │
                  ▼
     ┌──────────────────────────────────────┐
     │ Render Decision (Critical!)           │
     │ farmingModeActive &&                  │
     │ adsVisible &&                         │
     │ !isCurrentPathAdFree(pathname)  ⭐    │
     └────────────┬─────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
    If TRUE             If FALSE
        │                    │
        ▼                    ▼
  ┌──────────┐          ┌──────────┐
  │ Render   │          │ Return   │
  │ Ads JSX  │          │ null     │
  └──────────┘          └──────────┘
```

## Protected Zone Categories

```
🎓 LEARNING & ASSESSMENT (6 zones)
├── cbt
├── exams
├── practice-corner
├── ai-study
├── assignments
└── library-reading

📊 EVALUATION (1 zone)
└── results

💬 COMMUNICATION (3 zones)
├── messaging
├── voting
└── civic-centre

🎥 MEDIA (1 zone)
└── video-streams

💰 FINANCIAL (3 zones)
├── payments
├── cashouts
└── financial-pages

👤 ACCOUNT (1 zone)
└── profile-editing

Total: 15 Protected Zones
```

## Route to Zone Mapping

```
Route                 → Zone Mapped            → Protected?
────────────────────────────────────────────────────────
/cbt                  → cbt                    → ✅ YES
/exams                → exams                  → ✅ YES
/online-exams         → exams                  → ✅ YES
/civic-centre         → civic-centre           → ✅ YES
/voting               → voting                 → ✅ YES
/results              → results                → ✅ YES
/messaging            → messaging              → ✅ YES
/messages             → messaging              → ✅ YES
/library              → library-reading        → ✅ YES
/practice-corner      → practice-corner        → ✅ YES
/practice             → practice-corner        → ✅ YES
/ai-study             → ai-study               → ✅ YES
/assignments          → assignments            → ✅ YES
/profile              → profile-editing        → ✅ YES
/settings             → profile-editing        → ✅ YES
/payments             → payments               → ✅ YES
/cashouts             → cashouts               → ✅ YES
/financial-pages      → financial-pages        → ✅ YES
/video-streams        → video-streams          → ✅ YES
/student              → (no match)             → ❌ NO (ads allowed)
/dashboard            → (no match)             → ❌ NO (ads allowed)
```

## State Management

```
DashboardStudent Component State:
├── farmingModeActive: boolean = true
│   └── Controls whether farming mode is enabled
│
├── adsCount: number
│   └── Fetched from /api/settings/ads (default: 2)
│
├── adsVisible: boolean
│   └── Toggled by user or 15-minute interval
│
└── isAdFreeRoute: boolean (calculated)
    └── Derived from isCurrentPathAdFree(pathname)

AdPlacement Component State:
├── adsVisible: boolean
│   └── Internal visibility toggle
│
└── adsCount: number
    └── Fetched from /api/settings/ads (default: 2)
```

## API Contract

### Endpoint: Get Ad-Free Zones
```http
GET /api/settings/ad-free-zones
Authorization: Bearer {token} (optional)

Response (200 OK):
{
  "ad_free_zones": [
    "cbt",
    "exams",
    "voting",
    "civic-centre",
    "results",
    "messaging",
    "video-streams",
    "library-reading",
    "practice-corner",
    "ai-study",
    "assignments",
    "profile-editing",
    "payments",
    "cashouts",
    "financial-pages"
  ],
  "description": "Ad-free zones where ads are disabled globally"
}
```

### Endpoint: Get Ads Configuration
```http
GET /api/settings/ads
Authorization: Bearer {token}

Response (200 OK):
{
  "ads_count": 2
}
```

### Endpoint: Update Ads Configuration
```http
POST /api/settings/ads
Content-Type: application/json
Authorization: Bearer {token}

Body:
{
  "ads_count": 3,
  "updated_by": "admin@ndovera.com"
}

Response (200 OK):
{
  "ads_count": 3
}
```

## CSS Class Hierarchy

```
.ad-free-zones-info
├── .info-header
│   ├── h3
│   └── .info-subtitle
├── .zones-summary
│   ├── .zone-count
│   └── .toggle-details
├── .zones-list
│   └── .zone-item
│       ├── .zone-icon
│       └── .zone-name
└── .info-notes
    └── .note

.ad-zones-table
├── h3
├── table
│   ├── thead > tr > th
│   └── tbody > tr
│       ├── td (category)
│       ├── td (zone name)
│       └── td > .status-badge.protected

.ad-placement
├── .ad-card
│   ├── .ad-label
│   ├── p
│   └── button
├── .ad-card.inline
└── .ad-card.banner
```

## Testing Matrix

```
Test Case                          Expected        Actual
────────────────────────────────────────────────────────
Dashboard (/student)              Ads show         ✓
Exams (/exams)                    No ads           ✓
Results (/results)                No ads           ✓
Messaging (/messaging)            No ads           ✓
CBT (/cbt)                        No ads           ✓
Practice (/practice-corner)       No ads           ✓
Profile (/profile)                No ads           ✓
Payments (/payments)              No ads           ✓
Cashouts (/cashouts)              No ads           ✓
AdFreeZonesInfo renders           15 zones shown   ✓
AdZonesOverviewTable renders      Table visible    ✓
Ads toggle every 15 minutes       Visible → Hide   ✓
User can close ads                Ads hide         ✓
Admin can set ads count           1-10 range       ✓
```

---

**Architecture Version:** 1.0  
**Last Updated:** 2026-02-10  
**Status:** ✅ Production Ready
