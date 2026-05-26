const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'build');
const sourcePath = path.join(buildDir, 'index.html');
const fallbackPath = path.join(buildDir, '404.html');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Cannot create SPA fallback because ${sourcePath} does not exist.`);
}

fs.copyFileSync(sourcePath, fallbackPath);
console.log(`Wrote SPA fallback to ${fallbackPath}`);