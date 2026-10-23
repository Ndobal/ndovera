# Ndovera — rules for code in this repo

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
