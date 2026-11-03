const fs = require('fs');
const path = require('path');
const apiBase = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');
const file = path.join(__dirname, '../build/compat/config.js');
if (!fs.existsSync(path.dirname(file))) throw new Error('Compatibility assets are missing from the production build.');
fs.writeFileSync(file, 'window.NDOVERA_COMPAT_CONFIG = ' + JSON.stringify({ apiBase }).replace(/</g, '\\u003c') + ';\n');
