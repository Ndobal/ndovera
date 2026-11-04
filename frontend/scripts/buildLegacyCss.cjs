// Leave CRA's modern CSS intact; only browsers without custom properties load
// the static fallback. No third-party CDN or runtime stylesheet rewriting.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const variables = require('postcss-css-variables');

async function buildLegacyCss() {
  const build = path.resolve(__dirname, '../build');
  const manifest = JSON.parse(fs.readFileSync(path.join(build, 'asset-manifest.json'), 'utf8'));
  const styles = Object.values(manifest.files).filter(file => /\.css$/.test(file));
  const input = styles.map(file => fs.readFileSync(path.join(build, file.replace(/^\//, '')), 'utf8')).join('\n');
  // Resolve each rule against shared defaults and its own declarations. Processing
  // the complete Tailwind selector graph generates a combinatorial explosion of
  // synthetic selectors; this bounded fallback intentionally omits that inference.
  const root = postcss.parse(input);
  const defaults = {};
  root.walkRules(rule => {
    if (rule.selector === ':root' || rule.selector.split(',').some(selector => selector.trim() === '*')) {
      rule.walkDecls(/^--/, declaration => { defaults[declaration.prop] = declaration.value; });
    }
  });
  const rules = [];
  root.walkRules(rule => { rules.push(rule); });
  for (const rule of rules) {
    if (!rule.nodes.some(node => node.type === 'decl' && /var\(/.test(node.value))) continue;
    const local = await postcss([variables({ variables: defaults, preserve: false, preserveInjectedVariables: false })])
      .process(rule.toString(), { from: undefined, map: false });
    rule.replaceWith(...postcss.parse(local.css).nodes);
  }
  root.walkDecls(/^--/, declaration => declaration.remove());
  // Variable-dependent colour functions can only be converted after resolution.
  const result = await postcss([
    require('postcss-color-functional-notation')({ preserve: false }),
    require('postcss-color-hex-alpha')({ preserve: false }),
  ]).process(root, { from: undefined, map: false });
  const hash = crypto.createHash('sha256').update(result.css).digest('hex').slice(0, 12);
  const file = `static/css/legacy.${hash}.css`;
  fs.writeFileSync(path.join(build, file), result.css);
  const indexPath = path.join(build, 'index.html');
  const index = fs.readFileSync(indexPath, 'utf8');
  // The class check also works on engines without CSS.supports.
  const loader = `<script>(function(){if(document.documentElement.className.indexOf('ndv-legacy-styles')!==-1){var link=document.createElement('link');link.rel='stylesheet';link.href='/${file}';document.head.appendChild(link);}})();</script>`;
  const marker = /<meta[^>]+name=["']ndovera-legacy-css["'][^>]*>/;
  if (!marker.test(index)) throw new Error('Missing legacy stylesheet insertion point');
  fs.writeFileSync(indexPath, index.replace(marker, loader));
  console.log(`Built ${file}`);
}

buildLegacyCss().catch(error => { console.error(error); process.exitCode = 1; });
