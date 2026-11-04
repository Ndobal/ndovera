const fs = require('fs');
const path = require('path');
const apiBase = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');
const file = path.join(__dirname, '../build/compat/config.js');
if (!fs.existsSync(path.dirname(file))) throw new Error('Compatibility assets are missing from the production build.');
fs.writeFileSync(file, 'window.NDOVERA_COMPAT_CONFIG = ' + JSON.stringify({ apiBase }).replace(/</g, '\\u003c') + ';\n');
// Old phones keep Lite in an application cache, and only look for new files when this file changes.
const crypto = require('crypto');
const dir = path.dirname(file);
const stamp = crypto.createHash('sha256').update(['index.html', 'app.js', 'config.js', 'style.css'].map(name => fs.readFileSync(path.join(dir, name))).join('')).digest('hex').slice(0, 16);
const manifest = path.join(dir, 'lite.appcache');
fs.writeFileSync(manifest, fs.readFileSync(manifest, 'utf8').replace('# dev', '# ' + stamp));
