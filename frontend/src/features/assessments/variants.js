// Number templates in questions, as the server reads them (backend/src/paperVariants.ts):
//   {{d=100..300}}  {{m=0.5..4.5 step 0.5}}  {{d}}  {{= d/t}}  {{= d/t :1}}
// Each student's own numbers come from the server. Here the teacher's preview,
// print and Word file show the master paper: every value at its lowest.

const DEG = Math.PI / 180;
const FUNCTIONS = {
  sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sin: x => Math.sin(x * DEG), cos: x => Math.cos(x * DEG), tan: x => Math.tan(x * DEG),
  asin: x => Math.asin(x) / DEG, acos: x => Math.acos(x) / DEG, atan: x => Math.atan(x) / DEG,
  log: Math.log10, ln: Math.log, exp: Math.exp, min: Math.min, max: Math.max,
};
const CONSTANTS = { pi: Math.PI, e: Math.E };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function evaluate(source, scope) {
  const tokens = String(source).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').match(/\d+\.?\d*(?:e[-+]?\d+)?|\.\d+|[a-zA-Z_][a-zA-Z_0-9]*|[-+*/^(),]|\S/g) || [];
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const expression = () => { let value = term(); while (peek() === '+' || peek() === '-') value = take() === '+' ? value + term() : value - term(); return value; };
  const term = () => {
    let value = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/') { value = take() === '*' ? value * unary() : value / unary(); continue; }
      if (peek() === '(' || /^[a-zA-Z_]/.test(peek() || '')) { value *= unary(); continue; }
      return value;
    }
  };
  const unary = () => { if (peek() === '-') { take(); return -unary(); } if (peek() === '+') { take(); return unary(); } return power(); };
  const power = () => { const base = atom(); if (peek() === '^') { take(); return Math.pow(base, unary()); } return base; };
  const atom = () => {
    const token = take();
    if (token === undefined) throw new Error('The expression ends too early.');
    if (token === '(') { const value = expression(); if (take() !== ')') throw new Error('A bracket is not closed.'); return value; }
    if (/^[\d.]/.test(token)) return Number(token);
    if (/^[a-zA-Z_]/.test(token)) {
      if (own(scope, token)) return scope[token];
      const lower = token.toLowerCase();
      if (own(CONSTANTS, lower)) return CONSTANTS[lower];
      if (own(FUNCTIONS, lower)) {
        if (take() !== '(') throw new Error(`${token} needs brackets.`);
        const args = [expression()];
        while (peek() === ',') { take(); args.push(expression()); }
        if (take() !== ')') throw new Error('A bracket is not closed.');
        return FUNCTIONS[lower](...args);
      }
      throw new Error(`"${token}" is not defined.`);
    }
    throw new Error(`"${token}" is not allowed.`);
  };
  const value = expression();
  if (position < tokens.length) throw new Error(`"${tokens[position]}" is not expected here.`);
  return value;
}

export function formatNumber(value, places) {
  if (!Number.isFinite(value)) return '?';
  const digits = places === undefined ? 2 : Math.max(0, Math.min(6, places));
  const rounded = Number(value.toFixed(digits));
  return places === undefined ? String(rounded) : rounded.toFixed(digits);
}

const TEMPLATE = /\{\{\s*([^{}]+?)\s*\}\}/g;
const DEFINITION = /^([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*(-?\d*\.?\d+)\s*\.\.\s*(-?\d*\.?\d+)(?:\s+step\s+(\d*\.?\d+))?$/;
const SKIP_KEYS = new Set(['id', 'type', 'section', 'topic', 'bloom', 'difficulty', 'source', 'label', 'commandWord', 'imageUrl']);

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(item => strings(item, out));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => { if (!SKIP_KEYS.has(key)) strings(item, out); });
  return out;
}

function mapStrings(value, map) {
  if (typeof value === 'string') return map(value);
  if (Array.isArray(value)) return value.map(item => mapStrings(item, map));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SKIP_KEYS.has(key) ? item : mapStrings(item, map)]));
  return value;
}

export const hasVariables = question => strings(question).some(text => /\{\{[^{}]+\}\}/.test(text));

/** The lowest value of every variable a question defines. */
export function masterValues(question) {
  const values = {};
  strings(question).forEach(text => {
    for (const match of text.matchAll(TEMPLATE)) {
      const definition = DEFINITION.exec(match[1]);
      if (definition && !own(values, definition[1])) values[definition[1]] = Math.min(Number(definition[2]), Number(definition[3]));
    }
  });
  return values;
}

export function fillTemplates(question, values) {
  return mapStrings(question, text => text.replace(TEMPLATE, (whole, body) => {
    const definition = DEFINITION.exec(body);
    if (definition) return formatNumber(own(values, definition[1]) ? values[definition[1]] : Number(definition[2]));
    const places = /:\s*(\d+)\s*$/.exec(body);
    try { return formatNumber(evaluate(body.replace(/^=/, '').replace(/:\s*\d+\s*$/, '').trim(), values), places ? Number(places[1]) : undefined); } catch { return whole; }
  }));
}

/** The master paper: every question with templates filled at the lowest values. */
export const masterQuestions = questions => (questions || []).map(question => (hasVariables(question) ? fillTemplates(question, masterValues(question)) : question));
