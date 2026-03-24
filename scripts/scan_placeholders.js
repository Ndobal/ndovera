#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'placeholder_report.json');
const EXCLUDE_NAMES = new Set(['node_modules', '.git']);
const EXCLUDE_PATHS = [
  'packages/archives',
  'packages/web/src/legacy_archive',
];
const RE = /TODO|FIXME|PLACEHOLDER|placeholder|href=\"#\"/g;

function normalizeRelative(target) {
  return path.relative(ROOT, target).replace(/\\/g, '/');
}

function shouldExclude(fullPath, entryName) {
  if (EXCLUDE_NAMES.has(entryName)) return true;

  const rel = normalizeRelative(fullPath);
  return EXCLUDE_PATHS.some((excludedPath) => rel === excludedPath || rel.startsWith(`${excludedPath}/`));
}

async function scanDir(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (shouldExclude(full, ent.name)) continue;
    if (ent.isDirectory()) {
      results = results.concat(await scanDir(full));
      continue;
    }
    if (full === OUT) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.html', '.css'].includes(ext)) continue;
    try {
      const txt = await fs.readFile(full, 'utf8');
      const lines = txt.split(/\r?\n/);
      const matches = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (RE.test(line)) {
          matches.push({ line: i + 1, text: line.trim() });
        }
        RE.lastIndex = 0;
      }
      if (matches.length) results.push({ file: path.relative(ROOT, full).replace(/\\/g, '/'), matches });
    } catch (e) {
      // ignore binary or unreadable
    }
  }
  return results;
}

async function runOnce() {
  const report = await scanDir(ROOT);
  await fs.writeFile(OUT, JSON.stringify({ generated_at: new Date().toISOString(), report }, null, 2), 'utf8');
  console.log(`Scan complete — ${report.length} files with placeholders. Report: ${OUT}`);
}

async function main() {
  const arg = process.argv.slice(2).find(a => a.startsWith('--interval=') || a === '--watch');
  if (!arg) {
    await runOnce();
    return;
  }
  let interval = 300000; // default 5 minutes
  if (arg.startsWith('--interval=')) {
    const parsed = parseInt(arg.split('=')[1], 10);
    if (!isNaN(parsed)) interval = parsed;
  }
  console.log(`Starting placeholder scanner — interval ${interval}ms. Press Ctrl-C to stop.`);
  await runOnce();
  setInterval(async () => {
    try { await runOnce(); } catch (e) { console.error('Scan error', e); }
  }, interval);
}

main().catch(e => { console.error(e); process.exit(1); });
