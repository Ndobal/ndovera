# Older browser compatibility

This change adds a compatibility build targeting Android 4.4 (including Chromium
30-era engines), Safari/iOS 9+, and the previously targeted newer browsers. These
are engineering targets, not a claim that every old handset has passed testing.
The previously discussed iPad running iOS 9.3.5 falls within the test target.

## Implementation

- Production Browserslist targets include older engines, while keeping all newer
  versions. CRA compiles application and dependency JavaScript for those targets.
- The entry point loads Promise/fetch/Headers/Request/Response, stable language and
  URL APIs, and UTF-8 encoding APIs before React or the router is evaluated.
- React Router's webpack-ignored dynamic imports are redirected at build time to
  a native-import bridge in a separate module script. Modern engines retain native
  imports without eval. Old engines skip that script and reject optional framework
  module requests explicitly. Ndovera's existing BrowserRouter pages do not use
  framework module loading. Application lazy imports remain handled by webpack.
- Old engines receive stacked grid layouts; homepage content is revealed immediately
  if IntersectionObserver is missing. Native implementations remain in newer browsers.
- A hashed static stylesheet is generated for engines missing CSS variables or
  modern RGB syntax. Shared defaults and rule-local variables are resolved, and
  colour functions are converted to older syntax. Modern CSS stays intact.
- The stylesheet fallback deliberately does not emulate arbitrary cross-selector
  variable inheritance or JavaScript-written custom properties. Glass effects use
  paired opaque colours on engines without variables. Complex layouts and theme
  combinations need device QA; this is a functional fallback, not visual parity.
- Production builds fail if any webpack JavaScript chunk cannot parse as ES5.
  The separate native-import module is intentionally excluded from that ES5 check.

## Validation

Commands from `frontend`:

```
GENERATE_SOURCEMAP=false npm run build
node --test scripts/compatibility.test.cjs
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/shared/compatibility/polyfills.test.js src/shared/testing/contrast.test.jsx
```

Automated checks cover missing browser APIs, URL parsing, UTF-8 encoding, ES5
bootstrap syntax, feature detection, router import rewriting, and existing contrast
checks. The production artifact check includes dependency and lazy chunks.
These checks do not simulate old WebKit rendering or real device certificate stores.

## Device acceptance checklist (pending)

Run the production build against a staging backend with test accounts. Do not use
CRA's development server as proof of legacy compatibility.

| Device/browser | Required checks | Status |
| --- | --- | --- |
| Android 4.4 stock browser / Chromium 30-era browser | HTTPS, school website, login/logout, deep links, role dashboard, forms, tables, materials, assignments, results, fees/receipts | Pending device test |
| iOS 9.3.5 Safari, including the older iPad | Same checks; portrait/landscape; both themes; scrolling and keyboard | Pending device test |
| Current Android Chrome and iPhone Safari | Same checks; confirm native layouts, navigation and supported PWA behaviour | Pending regression test |
| Current desktop Chrome, Firefox, Safari and Edge | Same checks; keyboard navigation, downloads and responsive layouts | Pending regression test |

Use capability checks for optional camera/face attendance, push notifications,
speech, installation and offline functions; these cannot all be added through
JavaScript polyfills. Existing Android service-worker policy is preserved.

Retain HTTPS, authentication and tenant permissions. If an old device cannot
establish HTTPS because of its certificate store or TLS capabilities, frontend
code cannot repair that. Check the actual school domain on each target device.
Android versions before 4.4, iOS before 9, Internet Explorer and proxy-only browsers
are outside this change's acceptance target.

This branch has not been published. Device acceptance is required before describing
Android 4.4 / iOS 9 support as verified.
