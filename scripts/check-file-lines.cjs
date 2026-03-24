const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAX_LINES = 500;
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.turbo', '.vite']);
const EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.css', '.html', '.yml', '.yaml', '.ps1'
]);

function shouldSkip(filePath) {
  const rel = path.relative(ROOT, filePath);
  const parts = rel.split(path.sep);
  if (parts.some((part) => IGNORE_DIRS.has(part))) return true;
  if (rel.endsWith('package-lock.json')) return true;
  if (rel.endsWith('.db')) return true;
  return rel.startsWith('packages' + path.sep + 'web' + path.sep + 'dist');
}

function countLines(content) {
  if (content.length === 0) return 0;
  return content.split(/\r\n|\r|\n/).length;
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walk(fullPath, files);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    if (shouldSkip(fullPath)) continue;
    files.push(fullPath);
  }
}

const files = [];
walk(ROOT, files);

const violations = [];
for (const file of files) {
  const lines = countLines(fs.readFileSync(file, 'utf8'));
  if (lines > MAX_LINES) {
    violations.push({ file: path.relative(ROOT, file), lines });
  }
}

if (violations.length) {
  console.error(`Files exceeding ${MAX_LINES} lines:`);
  for (const v of violations) {
    console.error(`- ${v.file} (${v.lines} lines)`);
  }
  process.exitCode = 1;
} else {
  console.log(`OK: no tracked file exceeds ${MAX_LINES} lines.`);
}