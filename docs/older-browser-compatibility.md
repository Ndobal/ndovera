# Older-browser compatibility: first implementation

Ndovera Lite is a separate web entry at `/compat/index.html` (`/compat` redirects
there). The standard React app, browser targets and native Flutter application
are retained. This is a limited web interface, not full legacy-device certification.

## Available in Lite

- Account-ID/email/phone sign-in through the existing authentication endpoint.
- Required password changes, password-reset requests and reset-link completion.
- Current assigned-class listing and role selection using existing server checks.
- Reading materials, topics, class updates and assignment instructions/status.
- Attachment links with unsafe schemes rejected; rich content is rendered as text.
- Sign-out, token refresh and session-expiry handling.

Older Android (<5) and iOS (<12) user agents, or browsers lacking essential modern
APIs, are redirected before the standard bundle executes. Modern browsers retain
the standard interface. The public Lite link allows manual selection; the standard
link provides an explicit override. Detection is a routing aid, not proof of support.

Lite uses ES5 syntax, XMLHttpRequest and simple block CSS. Sign-in is tab-scoped
with an in-memory fallback when sessionStorage is unavailable. No credentials or
learning data are deliberately persisted by Lite. Its assets and API requests
bypass the standard service worker's offline shell/data caches. Existing API
permissions, tenant resolution and selected-role validation remain authoritative.
Pages responses use no-store, noindex, a restrictive CSP and no-referrer. The same
build-time API-base settings as the standard frontend are written to Lite config.

## Explicitly unfinished

Timed exams, assignment submissions/uploads, fees/payments, attendance capture,
results editing, administration and live/video features still require the standard
interface. Lite does not claim parity for these features. Do not lower Flutter
minimum versions to advertise native Android 4.4 or iOS 9 support.

Real Android 4.4 WebView/Chrome and iOS 9.3.5 Safari testing is outstanding. ES5
parsing and simulated missing-API/storage tests cannot verify an old rendering
engine, memory limits, certificates, TLS negotiation, cookies or deployed WAF
behaviour. If a device cannot establish HTTPS, frontend code cannot fix that;
retain secure transport and test the actual deployment configuration separately.

## Verification and release

From `frontend`: `npm ci`, `npm run test:compat`, `npm run build`.
The integration test uses jsdom with fixture API responses, not a production login.
The tests cover automatic/manual routing, modern-path preservation, reset-token
routing, no-store/private asset handling, missing assets, ES5 parsing, XHR login,
authorised class reads, blocked storage, unsafe links/content and sign-out.
No production deployment or database change is part of this branch.
