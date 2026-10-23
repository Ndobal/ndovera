// The colour rule: text must always stand out from what is behind it, in light and dark mode.
// Text clashing with its background (white on white, navy on navy) never passes as good code.
//
// findContrastProblems(container, mode) walks every piece of visible text in a rendered tree,
// works out its colour and the colour behind it from the Tailwind classes (and the few theme
// classes in shared/styles/theme.css), and returns every place below WCAG AA: 4.5:1 for normal
// text, 3:1 for large text (text-xl and up). Tests call it on rendered pages in both modes.
//
// What it reads: text-* / bg-* colour utilities (palette, white/black, [#hex], /opacity),
// their dark: variants in dark mode, and glass-surface / glass-chip / dashboard-bg. Hover,
// focus and other state variants are ignored (the resting state is what people read).

const palette = require('tailwindcss/colors');

const LIGHT_PAGE = '#ffffff';
const DARK_PAGE = '#020617';
const LIGHT_TEXT = '#0f172a';
const DARK_TEXT = '#f1f5f9';

// Theme classes that paint a background (shared/styles/theme.css).
const THEME_BACKGROUNDS = {
  light: { 'glass-surface': [255, 255, 255, 0.85], 'glass-chip': [255, 255, 255, 0.7], 'dashboard-bg': [255, 255, 255, 1] },
  dark: { 'glass-surface': [2, 6, 23, 0.8], 'glass-chip': [30, 41, 59, 0.45], 'dashboard-bg': [2, 6, 23, 1] },
};
// theme.css "light-mode readability rescue": pale slate text inside glass cards turns dark.
const LIGHT_RESCUE = { 'text-slate-100': '#14215b', 'text-slate-200': '#14215b', 'text-slate-300': '#47557a', 'text-slate-400': '#47557a' };

function hexToRgb(hex) {
  let value = String(hex).replace('#', '');
  if (value.length === 3) value = value.split('').map(char => char + char).join('');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/** "slate-500" | "white" | "[#0b1f3a]", with an optional "/55" → [r, g, b, a] or null. */
function parseColour(spec) {
  const [name, alphaText] = String(spec).split('/');
  const alpha = alphaText === undefined ? 1 : Number(alphaText.replace(/[[\]]/g, '')) / (alphaText.includes('.') ? 1 : 100);
  if (!Number.isFinite(alpha)) return null;
  let rgb = null;
  if (name === 'white') rgb = [255, 255, 255];
  else if (name === 'black') rgb = [0, 0, 0];
  else if (name === 'transparent') return [0, 0, 0, 0];
  else if (/^\[#[0-9a-f]{3,6}\]$/i.test(name)) rgb = hexToRgb(name.slice(1, -1));
  else {
    const match = name.match(/^([a-z]+)-(\d{2,3})$/);
    const hex = match && palette[match[1]] && typeof palette[match[1]] === 'object' ? palette[match[1]][match[2]] : null;
    rgb = hex ? hexToRgb(hex) : null;
  }
  return rgb ? [...rgb, alpha] : null;
}

/** The colour utility of `kind` ("text" | "bg") that applies in `mode`, from a class list. */
function utilityColour(classes, kind, mode) {
  let base = null;
  let dark = null;
  for (const token of classes) {
    const parts = token.split(':');
    const utility = parts.pop();
    const variants = parts;
    if (!utility.startsWith(`${kind}-`)) continue;
    if (variants.some(variant => variant !== 'dark')) continue;
    const colour = parseColour(utility.slice(kind.length + 1));
    if (!colour) continue;
    if (variants.includes('dark')) dark = { colour, token: utility };
    else base = { colour, token: utility };
  }
  return mode === 'dark' ? (dark || base) : base;
}

const blend = (top, bottom) => {
  const alpha = top[3];
  return [0, 1, 2].map(index => top[index] * alpha + bottom[index] * (1 - alpha)).concat(1);
};

function luminance([r, g, b]) {
  const channel = value => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const classesOf = element => String(element.getAttribute?.('class') || '').split(/\s+/).filter(Boolean);

function backgroundBehind(element, mode) {
  const layers = [];
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const classes = classesOf(node);
    const found = utilityColour(classes, 'bg', mode);
    const theme = classes.map(name => THEME_BACKGROUNDS[mode][name]).find(Boolean);
    const layer = found ? found.colour : theme || null;
    if (layer && layer[3] > 0) {
      layers.push(layer);
      if (layer[3] >= 1) break;
    }
  }
  let colour = [...hexToRgb(mode === 'dark' ? DARK_PAGE : LIGHT_PAGE), 1];
  for (const layer of layers.reverse()) colour = blend(layer, colour);
  return colour;
}

function textColour(element, mode) {
  let insideGlass = false;
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) if (/(^|\s)(glass-surface|glass-chip)(\s|$)/.test(node.getAttribute('class') || '')) insideGlass = true;
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const found = utilityColour(classesOf(node), 'text', mode);
    if (!found) continue;
    if (mode === 'light' && insideGlass && LIGHT_RESCUE[found.token] && !classesOf(node).includes('keep-pale-text')) return [...hexToRgb(LIGHT_RESCUE[found.token]), 1];
    return found.colour;
  }
  return [...hexToRgb(mode === 'dark' ? DARK_TEXT : LIGHT_TEXT), 1];
}

function skipped(element) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const classes = classesOf(node);
    const hidden = classes.includes('hidden') && !classes.some(name => /^(sm|md|lg|xl):(flex|block|inline|inline-flex|grid)$/.test(name));
    if (classes.includes('sr-only') || hidden || node.getAttribute('aria-hidden') === 'true') return true;
    if (['svg', 'option', 'script', 'style'].includes(node.tagName.toLowerCase())) return true;
    if (node.hasAttribute('disabled') || classes.some(name => /^opacity-(0|[1-5]0)$/.test(name))) return true;
  }
  return false;
}

const LARGE = /^(text-(xl|[2-9]xl))$/;

/** Every visible text below AA contrast in `mode` ("light" | "dark"): [{ text, ratio, needed, element }]. */
export function findContrastProblems(container, mode = 'light') {
  const problems = [];
  const elements = [container, ...container.querySelectorAll('*')];
  for (const element of elements) {
    const ownText = [...element.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim();
    const isField = ['input', 'textarea', 'select'].includes(element.tagName.toLowerCase()) && String(element.value || '').trim();
    if (!ownText && !isField) continue;
    if (skipped(element)) continue;
    const background = backgroundBehind(element, mode);
    const text = blend(textColour(element, mode), background);
    const ratio = contrastRatio(text, background);
    let large = false;
    for (let node = element; node && node.nodeType === 1 && !large; node = node.parentElement) large = classesOf(node).some(name => LARGE.test(name));
    const needed = large ? 3 : 4.5;
    if (ratio < needed) problems.push({ text: (ownText || element.value).slice(0, 60), ratio: Math.round(ratio * 100) / 100, needed, element });
  }
  return problems;
}

/** A readable list for a failing test. */
export function describeProblems(problems) {
  return problems.map(problem => `"${problem.text}" — ${problem.ratio}:1 (needs ${problem.needed}:1) · ${String(problem.element.getAttribute('class') || '').slice(0, 120)}`).join('\n');
}
