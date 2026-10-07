const fs = require('fs');
const path = require('path');

// Older Chromium (and older Android WebViews) throw "RangeError: maximumFractionDigits
// value is out of range" when a currency formatter lowers maximumFractionDigits below the
// currency's default minimum (2 for NGN) without also lowering minimumFractionDigits.
// These formatters are created when a file first loads, so the throw happens before React
// starts and the whole app shows a blank page. Every currency formatter must therefore
// set minimumFractionDigits alongside maximumFractionDigits.

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

test('every currency formatter that caps decimals also sets a minimum, so older browsers do not crash', () => {
  const offenders = [];
  for (const file of sourceFiles(path.join(__dirname, '..'))) {
    const text = fs.readFileSync(file, 'utf8');
    // Each formatter's options object: from "{" up to the matching "}" (they are flat).
    for (const match of text.matchAll(/\{[^{}]*currency:[^{}]*maximumFractionDigits[^{}]*\}/g)) {
      if (!/minimumFractionDigits/.test(match[0])) {
        const line = text.slice(0, match.index).split('\n').length;
        offenders.push(`${path.relative(path.join(__dirname, '..', '..'), file)}:${line}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});

test('the corrected options really are accepted', () => {
  const format = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  expect(format.format(1500.6)).toMatch(/1,501/);
});
