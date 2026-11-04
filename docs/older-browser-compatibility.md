# Older-browser compatibility

Ndovera Lite is a separate build for old phones, at `/compat/index.html`. It looks like the main app (same colours, menu and
bottom buttons) but uses ES5, XMLHttpRequest and plain CSS. The main app cannot start on these engines: tested in a real Chromium 32, it
stops at once because the engine refuses a regular expression with the u flag.

Who goes to Lite: Android below 5, iOS below 10, and any browser missing the u flag, Promise, fetch, Map, Set or URLSearchParams.
Android 5 to 7 and iOS 10 to 12 try the main app first, and go to Lite if it fails to start or nothing has appeared after 45 seconds.
`?ndovera-view=standard` and `?ndovera-view=lite` override this.

Lite and the main app share one sign-in (`token`, `authUser` and `selectedRole` in localStorage), so moving between them never logs anyone out.
Do not lower Flutter minimum versions to advertise native Android 4.4 or iOS 9 support.

## Available in Lite

- Everyone: overview, classes, notifications, timetable, settings, password change and reset, feedback.
- Teachers: upload a material as a file, post class updates, give written assignments, read and mark answers, take the class register, see payslips.
- Students: answer assignments (objective, written, matching, timed), practise with the question bank, buy passes, see results, attendance, the school bus.
- Parents: children, correcting a child's name once, results, attendance, timetable, fees and payment notices, passes, the school bus.
- School office: search people and see their details, payslip, classes, notifications.
- Anyone with a link: invoices, parent invitations, payment links and bank transfer.

Menu items Lite does not have stay in the menu and say they need a newer phone or a computer, so the menu reads like the main app.

Payments go to Flutterwave's page. Lite shows the payment link as well as the button,
so it can be opened on another phone if Flutterwave's page does not load on this one.
A payment needs a connection. Ndovera settles it when Flutterwave confirms it,
including by webhook if the phone never comes back to Lite.

## Offline

These browsers have no service worker, so:

- `lite.appcache` keeps the Lite files on the phone. The page must have been opened
  once online, and is reopened at `/compat/index.html`: tell users to bookmark it.
  The build stamps the manifest, and that is what makes phones fetch new files.
- `localStorage` keeps the session, classes opened, answers as they are typed, and an
  outbox. Work handed in with no connection is sent by itself when the connection is
  back, carries its submit time (Ndovera accepts it up to 72 hours back) and counts once.
- "Save this class for offline" stores a class's text. Attached files need a connection.
- A refusal (closed, attempts used) stays under "Waiting to send" with its reason.

Unlike the first version, Lite now persists learning data and the sign-in on the
device, because offline use needs it. Signing out removes that person's copies, and
warns first if work is unsent. People on shared phones must sign out. Lite's own
files are served `no-cache` instead of `no-store` so they can be kept; they hold no
private data.

## Not in Lite

C.A. score entry and class reports, live lessons and video, staff attendance, exams and multiple-choice assignment writing, AI, messaging, adding or editing people, and school administration such as fees set-up, payroll and the website.

## Device acceptance (pending)

Automated tests use jsdom with a fake network. They prove the logic, not the phone: they
cannot exercise an old engine, its memory, certificates, TLS, cookies, application cache
or the deployed firewall. Do not describe these devices as supported until this passes on
the live site with test accounts.

| Check | Android 4.4 browser | Android 4.4 Chrome-based | iOS 9.3.5 Safari | iOS 10–11 Safari |
| --- | --- | --- | --- | --- |
|`https://ndovera.com` opens with no certificate warning, and redirects to Lite | Pending | Pending | Pending | Pending |
| Sign in; stays signed in after closing the browser | Pending | Pending | Pending | Pending |
| Open a class, save it, airplane mode, close, reopen from bookmark: it still opens | Pending | Pending | Pending | Pending |
| Answer an assignment in airplane mode, hand in, reconnect: teacher sees one submission | Pending | Pending | Pending | Pending |
| Timed work: the clock runs, and hands in by itself at the end | Pending | Pending | Pending | Pending |
| Buy a pass: Flutterwave's page loads and takes a real card or transfer | Pending | Pending | Pending | Pending |
| After paying: back in Lite, signed in, pass shown | Pending | Pending | Pending | Pending |
| Use a pass code; a parent's fee notice reaches the school | Pending | Pending | Pending | Pending |

iOS 12 and later use the standard app, so check iPhone 5s and iPhone 6 (iOS 12.5) on it too.
If a device cannot make an HTTPS connection, frontend code cannot fix that.

## Verification

From `frontend`: `npm run test:compat`, `npm run build`, and
`CI=true npx react-scripts test --watchAll=false src/shared/compatibility`.
