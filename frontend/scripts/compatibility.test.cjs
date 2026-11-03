const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
const detection = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('ndv-no-grid'));

function classes(css) {
  const document = { documentElement: { className: 'dark' } };
  vm.runInNewContext(detection, { window: { CSS: css }, document });
  return document.documentElement.className;
}
test('the bootstrap parses as ES5 and handles Android engines without CSS.supports', () => {
  acorn.parse(detection, { ecmaVersion: 5 });
  assert.match(classes(undefined), /dark ndv-no-grid ndv-no-css-vars/);
});
test('modern browsers retain native layouts and styles', () => {
  assert.equal(classes({ supports: () => true }), 'dark');
});
test('older Safari can receive the grid fallback independently of CSS variables', () => {
  assert.equal(classes({ supports: (property, value) => property === 'color' && value.indexOf('var(') === 0 }), 'dark ndv-no-grid ndv-legacy-styles');
});

test('router dependency imports move to a callable bridge without eval', () => {
  const babel = require('@babel/core');
  const source = 'function load(url) { return import(/* webpackIgnore: true */ url); }';
  const options = { configFile: false, babelrc: false, plugins: [require('./routerLegacyImports.cjs')] };
  const legacy = babel.transformSync(source, { ...options, filename: '/project/node_modules/react-router/dist/index.js' }).code;
  assert.match(legacy, /window\.__ndoveraImportModule/);
  acorn.parse(legacy, { ecmaVersion: 5 });
  const application = babel.transformSync(source, { ...options, filename: '/project/src/App.js' }).code;
  assert.match(application, /import\(/);
});

test('legacy browsers reject optional framework modules with a clear message', async () => {
  const bridge = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(script => script.includes('__ndoveraPendingImports'));
  acorn.parse(bridge, { ecmaVersion: 5 });
  const window = {};
  vm.runInNewContext(bridge, { window, Promise, document: { createElement: () => ({}) } });
  await assert.rejects(window.__ndoveraImportModule('/module.js'), /requires a newer browser/);
});
