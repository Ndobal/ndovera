/**
 * Production build wrapper for Cloudflare Pages (and any CI).
 *
 * Cloudflare Pages sets `CI=true` in the build environment. Create React App
 * treats that as "promote every ESLint warning to a hard error", so a single
 * unused variable or exhaustive-deps hint fails the whole deploy. That is what
 * repeatedly broke production builds.
 *
 * We force `CI=false` before invoking react-scripts so lint findings are
 * surfaced as warnings (still printed to the build log) without aborting the
 * deploy. Real compile errors (bad imports, syntax) still fail the build.
 *
 * This file is committed (a `.env` would be git-ignored and never reach
 * Cloudflare) and works on every platform without extra dependencies.
 */
process.env.CI = 'false';
process.env.DISABLE_ESLINT_PLUGIN = process.env.DISABLE_ESLINT_PLUGIN || 'false';

// Running react-scripts' build entry point in-process keeps a single Node
// process and avoids cross-platform shell quoting issues.
process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';
const configPath = require.resolve('react-scripts/config/webpack.config');
const createConfig = require(configPath);
require.cache[configPath].exports = function (environment) {
  const config = createConfig(environment);
  for (const group of config.module.rules) {
    for (const rule of group.oneOf || []) {
      if (rule.loader && rule.loader.includes('babel-loader') && !rule.include) {
        rule.options.plugins = [...(rule.options.plugins || []), require.resolve('./routerLegacyImports.cjs')];
      }
    }
  }
  return config;
};
require('react-scripts/scripts/build');
