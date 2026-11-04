# Ndovera — rules for code in this repo

## Cost rule: every new feature is built to save cost

Ndovera runs on Cloudflare's Workers Free plan. Past the daily limits, features stop working until
00:00 UTC: 5M D1 rows read, 100k rows written, 100k requests, 10k AI neurons. A request gets 10 ms of
CPU and 50 D1 queries. Build every feature to stay well inside them, and to stay cheap on a paid plan.

- **Database:** every everyday query uses an index and reads only the rows it needs. Check the plan
  with `EXPLAIN QUERY PLAN` (a query plan is the proof; an index existing is not). Never count or list
  a whole table on a page load or a poll: keep a summary or cache it. Lists are bounded with `LIMIT`.
- **Background work:** cron and night jobs have a daily cap, stop when the work is done, and leave the
  day's limits for people using the app. No new polling without a shared change signal.
- **AI:** use the smallest model that does the job well, and only where plain code cannot. Every AI job
  has a limit on calls and tokens. Say what a new AI job costs before adding it.
- **Before finishing:** state the feature's cost in reads, writes, requests and AI calls, and add a test
  for any heavy query (`frontend/backend/test/read-costs.test.mjs`). After deploying, check the real
  numbers with `npx wrangler d1 insights ndovera-db --timePeriod 1d --sort-type sum --sort-by reads`.

## Colour rule: text never clashes with its background

Text that clashes with what is behind it (white on white, navy on navy, pale grey on a light
canvas) is never good code, however it looks in one theme.

- Every text colour is paired with the background it sits on, in **both** light and dark mode.
  If you set `bg-*` with no `dark:bg-*`, the text on it must be readable on that same colour in
  dark mode too; if you set `text-*`, add the matching `dark:text-*`.
- Minimum contrast is WCAG AA: 4.5:1 for normal text, 3:1 for large text (`text-xl` and up).
  `text-slate-500` on the command-centre canvas (`#eef1f6`) is 4.2:1 — use `text-slate-600`.
- `.dark` sits on `<html>`. Light-only CSS must be written `:root:not(.dark) …`; a bare
  `:not(.dark) …` also matches `<body>` and fires in dark mode.
- The command-centre sidebar (Ami, shareholders) is navy `#0b1f3a`: text there is white,
  `slate-300` or gold `#c9a96e`, never `slate-500`–`slate-900`.

Enforced by `frontend/src/shared/testing/contrast.test.jsx` (uses `findContrastProblems` from
`contrast.js`). Add every new page or panel to that test; a failing contrast test blocks the change.
