# Ndovera Birthdays — Flutter integration package

This package contains working client code, UI, API contracts, migration and client security tests. It is not a deployed birthday service. No existing Ndovera repository, auth schema, backend or AI credentials were available. Backend handlers and card worker described below must be implemented in your existing services. No mock users or production records are included. Flutter/Dart were unavailable in the build environment; run the checks below before integrating.

## Install
Copy this directory into your Flutter repository as packages/ndovera_birthdays, then add:

```yaml
dependencies:
  ndovera_birthdays:
    path: packages/ndovera_birthdays
```

```dart
import 'package:ndovera_birthdays/ndovera_birthdays.dart';

final birthdays = BirthdayApi(
  baseUrl: Uri.parse(yourApiOriginWithApiPrefix),
  expectedSchoolId: currentVerifiedMembership.schoolId,
  accessToken: () => existingAuth.getFreshAccessToken(),
);
// Dashboard, inside a scrollable parent:
BirthdayFeed(api: birthdays);
// Student/staff own profile tab:
BirthdayFeed(api: birthdays, memories: true, onSaveCard: existingFileSaver);
// Only show for authorised administrators; server must also verify rights:
BirthdaySettingsPage(api: birthdays);
```

`existingFileSaver` accepts PNG bytes and filename and uses your app's existing save/share implementation. It is optional. Create a new API client and rebuild screens keyed by session+school on login/school switch. Dispose the previous client, remove old routes and clear image/UI caches on logout. Do not reuse a screen with a different client. Do not persist wishes or profile data in an unscoped shared cache.

Screens include loading, error, empty and retry states; a personalised card viewer; download callback; suggested wishes; preview and submit; private memories; wish reporting; and administrator settings. Emoji and Unicode are supported as plain text. Rich HTML is deliberately not accepted.

## Mandatory server isolation
Every endpoint authenticates the existing session and obtains `schoolId` from a validated active membership. Reject client-supplied school IDs. Multi-school users must select a school via the existing authenticated membership-switch service. Never infer tenancy from an unverified header or a Flutter field.

All reads/writes and storage lookups include `school_id = session.school_id`. Resolve celebration/wish IDs using composite keys. Return 404 for foreign-school IDs. Same-school membership alone is insufficient: apply student consent, visibility, recipient ownership and moderation permissions. Settings require explicit admin rights. Staff file access does not imply permission to read wishes. Server-issued capability flags control the UI but never replace authorisation.

Card bytes are returned from an authenticated proxy endpoint, not a public bucket URL. Scope object keys to school/celebration and verify ownership before storage reads. Send `X-School-Id` from the verified server context and `Cache-Control: private, no-store` on all responses. Expose X-School-Id in CORS for Flutter web; restrict origins. The client header check is defence in depth, not a security boundary.

## API contract
All routes below are relative to `{baseUrl}/birthdays`. JSON responses require X-School-Id; card responses require it too. Errors use correct HTTP status and no private details. Lists currently require bounded server limits (e.g. 100), with documented UI cap; add cursor pagination before larger schools deploy.

| Method | Route | Response / request |
|---|---|---|
| GET | /today | `{items:[{id,name,displayDate}]}`; school local date, published + consented only |
| GET | /memories | Same envelope, only session user's memories, newest first |
| GET | /{id} | `{id,name,displayDate,message,wishCount,canSendWish,canReadWishes,allowedStyles:["cheerful",...]}` |
| GET | /{id}/card | PNG bytes; proxy original stored card after authorisation |
| GET | /{id}/wishes | `{items:[{id,senderName,message}]}`; recipient or explicitly authorised moderator; approved messages only for recipient |
| POST | /{id}/wishes | `{message,requestId}` → `{status:"approved" or "pending"}` |
| POST | /{id}/suggestions | `{style}` → `{message}`; approved style + minimum profile fields only |
| POST | /{id}/wishes/{wishId}/report | `{reason}` → `{status:"received"}` |
| GET | /settings | `{enabled,students,staff,wishes,aiCards,moderateStudentWishes,timezone,announcementTime,leapDayPolicy,version}` |
| PUT | /settings | Same fields; version compare-and-swap, 409 conflict → refresh |

Always include cheerful in allowedStyles. Faith-based styles only where approved. Do not return birth year, age, DOB, contact information or private file details. GET memories never accepts a user ID. Validate wish length 1–1000, reason 1–500; reject forged sender/recipient/tenant fields. Rate limit suggestions, wishes and reports. Replayed requestId returns the original result; reusing it with changed text returns 409. Use the existing notification system for grouped alerts after approval. Wish counts must count only messages visible to the viewer.

## Backend worker to connect
Scheduled processing belongs on the server: mobile apps cannot reliably run a daily school-wide job. Use the existing scheduler/queue/AI/storage services rather than duplicating them.

1. Start no earlier than school-local 10 October 2026. For every enabled school, calculate date/time in its configured IANA timezone. Select active and consented members whose birthday matches today, with Feb 29 policy. Do not create earlier historical cards.
2. Insert celebration with unique (school,user,year). Queue using that tuple as idempotency key. Retries use lease/compare-and-swap on state to avoid parallel generation. Recover abandoned leases.
3. Fetch original approved portrait inside the trusted compositor. Never send photo to image generation or redraw the face. Ask AI for background artwork and a message using approved name/role only. Compose actual portrait, name, date, logo and text using your existing server rendering service. Escape rendered text.
4. Choose at least 13 distinct design families (strictly over 12 years). Query permanent user history for the current year and preceding 12 calendar years. Exclude used families, compare proposed artwork with stored perceptual fingerprints and reject near-identical layout/imagery even when colours differ. Define/calibrate the similarity threshold against your real design corpus. Save message hash and reject repeated messages. Exact hash matching alone cannot enforce visual uniqueness.
5. If AI fails, choose an unused preapproved family and distinct composition that passes the same validator. If none qualifies, keep queued/failed and alert admin; never silently reuse a design. Retain raw history through promotions, session changes and role changes. Where a user transfers school, a trusted internal identity-history check must prevent reuse without exposing the previous school's celebrations.
6. Write final PNG to private storage once with immutable key, then atomically store history + ready state. Publish only when local announcement time arrives and consent is still valid. Reuse bytes for every viewer. Do not regenerate an already-published annual card. Record admin changes and generation/publication/moderation in existing audit logs.
7. Enforce consent again at read time, including cached thumbnails. Pause/revoke removes dashboard access immediately. Apply school retention/deletion policy and orphan-object cleanup. Photo absence → monogram, never another person's image.

The included migration is additive SQLite/D1 syntax. Map existing school and user foreign keys and run it in staging first. It deliberately contains no fake users or templates. Populate an original approved design collection before enabling service. Admin moderation queue, upcoming birthday preview/pause/regeneration, notifications and AI/card composition are backend integration work, not implemented in this Flutter package.

## Validation before rollout

```sh
flutter pub get
dart format lib test
flutter analyze
flutter test
```

Client tests cover foreign/missing tenancy envelopes, auth headers and denied card access. Required backend acceptance tests: school A cannot list/read/download/send wishes/report/edit settings for school B even with guessed IDs; student consent off hides all content; private wishes remain recipient-only; no duplicate card under concurrent retries; 13 consecutive annual cards have distinct families and pass similarity validation; revoked access blocks downloads; offline clients do not expose previous sessions; leap-day policies and local date boundaries work; moderation approval produces one grouped notification; settings conflicts reject stale updates.

Network implementation follows Flutter's authenticated request guidance: https://docs.flutter.dev/cookbook/networking/authenticated-requests
