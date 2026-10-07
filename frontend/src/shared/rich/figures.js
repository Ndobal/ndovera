// Ndovera figures: graphs, charts, geometry, circuits and number lines drawn
// exactly from a small JSON spec (written by Ndovera AI or a teacher) as SVG —
// sharp on screen, in print and in Word. The spec shapes match the backend's
// figureSpecError (assessmentEngine.ts). Nothing in a spec is ever executed:
// function graphs use the expression parser below, and every label is escaped.

const INK = '#111827';
const SERIES = ['#1d4ed8', '#b91c1c', '#047857', '#7c3aed', '#b45309', '#0f766e'];
const DASHES = ['', '6 4', '2 3', '10 3 2 3', '1 3', '8 2'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmt = value => {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 1000) / 1000;
  return Math.abs(rounded) >= 10000 ? rounded.toExponential(1) : String(rounded);
};
const text = (x, y, value, { anchor = 'middle', size = 12, weight = 'normal', baseline = 'middle', fill = INK } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="${fill}" font-family="Arial, Helvetica, sans-serif">${esc(value)}</text>`;
const svgOpen = (width, height, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title || 'Figure')}" style="max-width:100%;height:auto;background:#fff">`;

// ─── Safe expression parser (x, numbers, + - * / ^, brackets, functions) ─────

const FUNCTIONS = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs, log: Math.log10, ln: Math.log, exp: Math.exp };
const CONSTANTS = { pi: Math.PI, e: Math.E };

export function compileExpression(source) {
  const tokens = String(source || '').replace(/\s+/g, '').match(/\d+\.?\d*|\.\d+|[a-zA-Z_]+|[-+*/^(),]/g) || [];
  // Implicit multiplication: 2x, 3(x+1), x(x-1), (x+1)(x-1), 2pi.
  const withTimes = [];
  tokens.forEach((token, index) => {
    const previous = tokens[index - 1];
    const prevIsValue = previous && (/^[\d.]/.test(previous) || previous === ')' || (/^[a-zA-Z_]+$/.test(previous) && !FUNCTIONS[previous.toLowerCase()]));
    const isValueStart = /^[\d.]/.test(token) || token === '(' || /^[a-zA-Z_]+$/.test(token);
    if (prevIsValue && isValueStart) withTimes.push('*');
    withTimes.push(token);
  });
  let position = 0;
  const peek = () => withTimes[position];
  const take = () => withTimes[position++];
  function expression() {
    let node = term();
    while (peek() === '+' || peek() === '-') { const op = take(); const right = term(); const left = node; node = op === '+' ? x => left(x) + right(x) : x => left(x) - right(x); }
    return node;
  }
  function term() {
    let node = unary();
    while (peek() === '*' || peek() === '/') { const op = take(); const right = unary(); const left = node; node = op === '*' ? x => left(x) * right(x) : x => left(x) / right(x); }
    return node;
  }
  function unary() {
    if (peek() === '-') { take(); const inner = unary(); return x => -inner(x); }
    if (peek() === '+') { take(); return unary(); }
    return power();
  }
  function power() {
    const base = atom();
    if (peek() === '^') { take(); const exponent = unary(); return x => Math.pow(base(x), exponent(x)); }
    return base;
  }
  function atom() {
    const token = take();
    if (token === undefined) throw new Error('Expression ended early');
    if (token === '(') { const inner = expression(); if (take() !== ')') throw new Error('Missing )'); return inner; }
    if (/^[\d.]/.test(token)) { const value = Number(token); return () => value; }
    const name = token.toLowerCase();
    if (name === 'x') return x => x;
    if (CONSTANTS[name] !== undefined) { const value = CONSTANTS[name]; return () => value; }
    if (FUNCTIONS[name]) {
      if (take() !== '(') throw new Error(`${name} needs brackets`);
      const inner = expression();
      if (take() !== ')') throw new Error('Missing )');
      const fn = FUNCTIONS[name];
      return x => fn(inner(x));
    }
    throw new Error(`Unknown name "${token}"`);
  }
  const compiled = expression();
  if (position < withTimes.length) throw new Error(`Unexpected "${withTimes[position]}"`);
  return x => { const value = compiled(x); return Number.isFinite(value) ? value : NaN; };
}

/** Round axis steps to 1, 2 or 5 × a power of ten. */
function niceStep(range, target = 8) {
  const raw = range / target;
  const power = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const scaled = raw / power;
  return (scaled < 1.5 ? 1 : scaled < 3 ? 2 : scaled < 7 ? 5 : 10) * power;
}

function ticks(min, max, step) {
  const out = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) out.push(Math.round(value / step) * step);
  return out;
}

// ─── Plots on axes (function graphs, line and scatter charts) ────────────────

function axesFrame({ xMin, xMax, yMin, yMax, xLabel, yLabel, title, grid = true, width = 560, height = 400, xTickLabels = true }) {
  const margin = { left: 56, right: 20, top: title ? 34 : 16, bottom: 46 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const sx = x => margin.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = y => margin.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;
  const xStep = niceStep(xMax - xMin, 10);
  const yStep = niceStep(yMax - yMin, 8);
  const parts = [];
  if (title) parts.push(text(width / 2, 16, title, { weight: 'bold', size: 14 }));
  if (grid) {
    for (const x of ticks(xMin, xMax, xStep / 2)) parts.push(`<line x1="${sx(x)}" y1="${margin.top}" x2="${sx(x)}" y2="${margin.top + plotH}" stroke="#e5e7eb" stroke-width="0.6"/>`);
    for (const y of ticks(yMin, yMax, yStep / 2)) parts.push(`<line x1="${margin.left}" y1="${sy(y)}" x2="${margin.left + plotW}" y2="${sy(y)}" stroke="#e5e7eb" stroke-width="0.6"/>`);
    for (const x of ticks(xMin, xMax, xStep)) parts.push(`<line x1="${sx(x)}" y1="${margin.top}" x2="${sx(x)}" y2="${margin.top + plotH}" stroke="#cbd5e1" stroke-width="0.8"/>`);
    for (const y of ticks(yMin, yMax, yStep)) parts.push(`<line x1="${margin.left}" y1="${sy(y)}" x2="${margin.left + plotW}" y2="${sy(y)}" stroke="#cbd5e1" stroke-width="0.8"/>`);
  }
  // Axes cross at zero when zero is in range, otherwise along the edges.
  const axisY = yMin <= 0 && yMax >= 0 ? sy(0) : margin.top + plotH;
  const axisX = xMin <= 0 && xMax >= 0 ? sx(0) : margin.left;
  parts.push(`<line x1="${margin.left}" y1="${axisY}" x2="${margin.left + plotW + 6}" y2="${axisY}" stroke="${INK}" stroke-width="1.4" marker-end="url(#ndv-arrow)"/>`);
  parts.push(`<line x1="${axisX}" y1="${margin.top + plotH}" x2="${axisX}" y2="${margin.top - 6}" stroke="${INK}" stroke-width="1.4" marker-end="url(#ndv-arrow)"/>`);
  for (const x of ticks(xMin, xMax, xStep)) {
    parts.push(`<line x1="${sx(x)}" y1="${axisY - 3}" x2="${sx(x)}" y2="${axisY + 3}" stroke="${INK}"/>`);
    if (xTickLabels && (Math.abs(x) > 1e-9 || axisX === margin.left)) parts.push(text(sx(x), axisY + 14, fmt(x), { size: 11 }));
  }
  for (const y of ticks(yMin, yMax, yStep)) {
    parts.push(`<line x1="${axisX - 3}" y1="${sy(y)}" x2="${axisX + 3}" y2="${sy(y)}" stroke="${INK}"/>`);
    if (Math.abs(y) > 1e-9 || axisY === margin.top + plotH) parts.push(text(axisX - 6, sy(y), fmt(y), { size: 11, anchor: 'end' }));
  }
  if (xLabel) parts.push(text(margin.left + plotW, height - 10, xLabel, { anchor: 'end', size: 12, weight: 'bold' }));
  if (yLabel) parts.push(`<text x="14" y="${margin.top + plotH / 2}" font-size="12" font-weight="bold" text-anchor="middle" transform="rotate(-90 14 ${margin.top + plotH / 2})" fill="${INK}" font-family="Arial, Helvetica, sans-serif">${esc(yLabel)}</text>`);
  const defs = `<defs><marker id="ndv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker>
    <clipPath id="ndv-plot"><rect x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}"/></clipPath></defs>`;
  return { parts, defs, sx, sy, margin, plotW, plotH };
}

function legend(items, x, y) {
  return items.map((item, index) => `<g transform="translate(${x},${y + index * 18})"><line x1="0" y1="0" x2="22" y2="0" stroke="${item.color}" stroke-width="2.5" stroke-dasharray="${item.dash || ''}"/>${text(28, 0, item.label, { anchor: 'start', size: 11 })}</g>`).join('');
}

function functionGraph(spec) {
  const [xMin, xMax] = spec.xRange;
  const fns = spec.functions.map(fn => ({ ...fn, f: compileExpression(fn.expr) }));
  const samples = 400;
  const curves = fns.map(fn => Array.from({ length: samples + 1 }, (_, i) => { const x = xMin + ((xMax - xMin) * i) / samples; return [x, fn.f(x)]; }));
  let [yMin, yMax] = Array.isArray(spec.yRange) && spec.yRange.length === 2 ? spec.yRange : [Infinity, -Infinity];
  if (!Array.isArray(spec.yRange)) {
    for (const curve of curves) for (const [, y] of curve) if (Number.isFinite(y)) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); }
    for (const point of spec.points || []) { yMin = Math.min(yMin, point.y); yMax = Math.max(yMax, point.y); }
    if (!Number.isFinite(yMin)) { yMin = -1; yMax = 1; }
    const pad = (yMax - yMin || 2) * 0.1;
    yMin -= pad; yMax += pad;
  }
  const frame = axesFrame({ xMin, xMax, yMin, yMax, xLabel: spec.xLabel || 'x', yLabel: spec.yLabel || 'y', title: spec.title, grid: spec.grid !== false });
  const lines = curves.map((curve, index) => {
    // Break the line where it leaves the range or jumps (asymptotes).
    const segments = [];
    let current = [];
    curve.forEach(([x, y], i) => {
      const previous = curve[i - 1];
      const jump = previous && Number.isFinite(previous[1]) && Math.abs(y - previous[1]) > (yMax - yMin) * 2;
      if (!Number.isFinite(y) || jump) { if (current.length > 1) segments.push(current); current = []; if (!Number.isFinite(y)) return; }
      current.push(`${frame.sx(x).toFixed(1)},${frame.sy(y).toFixed(1)}`);
    });
    if (current.length > 1) segments.push(current);
    return segments.map(points => `<polyline points="${points.join(' ')}" fill="none" stroke="${SERIES[index % SERIES.length]}" stroke-width="2.2" stroke-dasharray="${DASHES[index % DASHES.length]}" clip-path="url(#ndv-plot)"/>`).join('');
  }).join('');
  const points = (spec.points || []).map(point => `<circle cx="${frame.sx(point.x)}" cy="${frame.sy(point.y)}" r="3.5" fill="${INK}"/>${point.label ? text(frame.sx(point.x) + 7, frame.sy(point.y) - 9, point.label, { anchor: 'start', weight: 'bold' }) : ''}`).join('');
  const labelled = fns.filter(fn => fn.label).map((fn, index) => ({ label: fn.label, color: SERIES[index % SERIES.length], dash: DASHES[index % DASHES.length] }));
  return `${svgOpen(560, 400, spec.title)}${frame.defs}${frame.parts.join('')}${lines}${points}${labelled.length ? legend(labelled, frame.margin.left + 10, frame.margin.top + 12) : ''}</svg>`;
}

function xyChart(spec) {
  const series = spec.series;
  const categories = Array.isArray(spec.categories) ? spec.categories : null;
  const asPoints = series.map(item => (Array.isArray(item.points) ? item.points : (item.values || []).map((value, index) => [index, value])));
  const all = asPoints.flat();
  let xMin = Math.min(...all.map(point => point[0]));
  let xMax = Math.max(...all.map(point => point[0]));
  if (categories) { xMin = -0.5; xMax = categories.length - 0.5; }
  if (xMin === xMax) { xMin -= 1; xMax += 1; }
  let yMin = Math.min(0, ...all.map(point => point[1]));
  let yMax = Math.max(...all.map(point => point[1]));
  if (Array.isArray(spec.yRange) && spec.yRange.length === 2) [yMin, yMax] = spec.yRange;
  else yMax += (yMax - yMin || 1) * 0.12;
  // Category names replace the numeric x ticks.
  const frame = axesFrame({ xMin, xMax, yMin, yMax, xLabel: spec.xLabel, yLabel: spec.yLabel, title: spec.title, grid: spec.grid !== false, xTickLabels: !categories });
  const parts = [...frame.parts];
  if (categories) categories.forEach((name, index) => parts.push(text(frame.sx(index), frame.margin.top + frame.plotH + 16, name, { size: 11 })));
  const body = [];
  if (spec.type === 'bar') {
    const groupWidth = (frame.plotW / (categories ? categories.length : Math.max(1, xMax - xMin))) * 0.7;
    const barWidth = groupWidth / series.length;
    asPoints.forEach((points, s) => points.forEach(([x, y]) => {
      const left = frame.sx(x) - groupWidth / 2 + s * barWidth;
      const top = frame.sy(Math.max(0, y));
      const height = Math.abs(frame.sy(y) - frame.sy(0));
      body.push(`<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${(barWidth - 2).toFixed(1)}" height="${height.toFixed(1)}" fill="${SERIES[s % SERIES.length]}" fill-opacity="${0.85 - s * 0.15}" stroke="${INK}" stroke-width="0.8"/>`);
      if (spec.showValues !== false) body.push(text(left + (barWidth - 2) / 2, top - 7, fmt(y), { size: 10 }));
    }));
  } else {
    asPoints.forEach((points, s) => {
      const color = SERIES[s % SERIES.length];
      const path = points.map(([x, y]) => `${frame.sx(x).toFixed(1)},${frame.sy(y).toFixed(1)}`).join(' ');
      if (spec.type === 'line') body.push(`<polyline points="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-dasharray="${DASHES[s % DASHES.length]}"/>`);
      points.forEach(([x, y]) => body.push(spec.type === 'scatter'
        ? `<path d="M${frame.sx(x) - 4},${frame.sy(y) - 4} L${frame.sx(x) + 4},${frame.sy(y) + 4} M${frame.sx(x) - 4},${frame.sy(y) + 4} L${frame.sx(x) + 4},${frame.sy(y) - 4}" stroke="${color}" stroke-width="2"/>`
        : `<circle cx="${frame.sx(x)}" cy="${frame.sy(y)}" r="3" fill="${color}"/>`));
    });
  }
  const named = series.filter(item => item.name).map((item, index) => ({ label: item.name, color: SERIES[index % SERIES.length], dash: spec.type === 'line' ? DASHES[index % DASHES.length] : '' }));
  return `${svgOpen(560, 400, spec.title)}${frame.defs}${parts.join('')}${body.join('')}${named.length > 1 ? legend(named, frame.margin.left + 10, frame.margin.top + 12) : ''}</svg>`;
}

function pieChart(spec) {
  const total = spec.slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const cx = 200;
  const cy = (spec.title ? 34 : 16) + 150;
  const r = 140;
  let angle = -Math.PI / 2;
  const parts = [spec.title ? text(280, 16, spec.title, { weight: 'bold', size: 14 }) : ''];
  spec.slices.forEach((slice, index) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const end = angle + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const [x1, y1, x2, y2] = [cx + r * Math.cos(angle), cy + r * Math.sin(angle), cx + r * Math.cos(end), cy + r * Math.sin(end)];
    parts.push(spec.slices.length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SERIES[0]}" fill-opacity="0.75" stroke="${INK}"/>` : `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${SERIES[index % SERIES.length]}" fill-opacity="0.78" stroke="#fff" stroke-width="2"/>`);
    const mid = angle + sweep / 2;
    const percent = Math.round((slice.value / total) * 1000) / 10;
    if (sweep > 0.25) parts.push(text(cx + r * 0.62 * Math.cos(mid), cy + r * 0.62 * Math.sin(mid), `${percent}%`, { weight: 'bold', fill: '#fff', size: 12 }));
    parts.push(`<rect x="370" y="${(spec.title ? 40 : 22) + index * 22}" width="14" height="14" fill="${SERIES[index % SERIES.length]}" fill-opacity="0.78"/>`);
    parts.push(text(390, (spec.title ? 47 : 29) + index * 22, `${slice.label || `Item ${index + 1}`} (${fmt(slice.value)})`, { anchor: 'start', size: 12 }));
    angle = end;
  });
  return `${svgOpen(560, (spec.title ? 34 : 16) + 310, spec.title)}${parts.join('')}</svg>`;
}

// ─── Geometry ────────────────────────────────────────────────────────────────

function geometry(spec) {
  const points = spec.points || {};
  const resolve = value => (typeof value === 'string' ? points[value] : value);
  const xs = [];
  const ys = [];
  Object.values(points).forEach(([x, y]) => { xs.push(x); ys.push(y); });
  (spec.circles || []).forEach(circle => { const [x, y] = resolve(circle.center); xs.push(x - circle.radius, x + circle.radius); ys.push(y - circle.radius, y + circle.radius); });
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const width = 480;
  const height = 360;
  const pad = 46;
  const titleSpace = spec.title ? 24 : 0;
  const drawHeight = height - titleSpace;
  // One scale for both axes, so shapes keep their true proportions; centred in the box.
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1), (drawHeight - pad * 2) / (maxY - minY || 1));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (drawHeight - (maxY - minY) * scale) / 2;
  const sx = x => offsetX + (x - minX) * scale;
  const sy = y => titleSpace + drawHeight - offsetY - (y - minY) * scale;
  const centre = [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
  const parts = [spec.title ? text(width / 2, 16, spec.title, { weight: 'bold', size: 14 }) : ''];
  (spec.polygons || []).forEach(polygon => parts.push(`<polygon points="${polygon.map(name => `${sx(points[name][0]).toFixed(1)},${sy(points[name][1]).toFixed(1)}`).join(' ')}" fill="${spec.shade ? '#dbeafe' : 'none'}" stroke="${INK}" stroke-width="2"/>`));
  (spec.circles || []).forEach(circle => {
    const [x, y] = resolve(circle.center);
    parts.push(`<circle cx="${sx(x)}" cy="${sy(y)}" r="${(circle.radius * scale).toFixed(1)}" fill="none" stroke="${INK}" stroke-width="2"/>`);
    if (circle.label) parts.push(text(sx(x) + circle.radius * scale * 0.72, sy(y) - circle.radius * scale * 0.72 - 8, circle.label, { anchor: 'start' }));
  });
  (spec.segments || []).forEach(segment => {
    const [a, b, label, style] = segment;
    const [x1, y1] = points[a];
    const [x2, y2] = points[b];
    parts.push(`<line x1="${sx(x1)}" y1="${sy(y1)}" x2="${sx(x2)}" y2="${sy(y2)}" stroke="${INK}" stroke-width="2" stroke-dasharray="${style === 'dashed' ? '6 4' : ''}"/>`);
    if (label) {
      // Side labels sit just outside the figure, away from its centre.
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      let nx = -(y2 - y1);
      let ny = x2 - x1;
      const length = Math.hypot(nx, ny) || 1;
      nx /= length; ny /= length;
      if ((mx - centre[0]) * nx + (my - centre[1]) * ny < 0) { nx = -nx; ny = -ny; }
      parts.push(text(sx(mx) + nx * 16, sy(my) - ny * 16, label, { size: 12, weight: 'bold' }));
    }
  });
  (spec.angles || []).forEach(angle => {
    const [vx, vy] = points[angle.at];
    const a1 = Math.atan2(points[angle.from][1] - vy, points[angle.from][0] - vx);
    const a2 = Math.atan2(points[angle.to][1] - vy, points[angle.to][0] - vx);
    const radius = 22;
    if (angle.right) {
      const ux = [Math.cos(a1), Math.sin(a1)];
      const uy = [Math.cos(a2), Math.sin(a2)];
      const k = 12 / scale;
      const p1 = [vx + ux[0] * k, vy + ux[1] * k];
      const p2 = [vx + (ux[0] + uy[0]) * k, vy + (ux[1] + uy[1]) * k];
      const p3 = [vx + uy[0] * k, vy + uy[1] * k];
      parts.push(`<polyline points="${sx(p1[0])},${sy(p1[1])} ${sx(p2[0])},${sy(p2[1])} ${sx(p3[0])},${sy(p3[1])}" fill="none" stroke="${INK}" stroke-width="1.4"/>`);
    } else {
      let start = a1;
      let end = a2;
      let sweep = end - start;
      while (sweep <= -Math.PI) sweep += Math.PI * 2;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      end = start + sweep;
      const point = t => [sx(vx) + radius * Math.cos(t), sy(vy) - radius * Math.sin(t)];
      const [x1, y1] = point(start);
      const [x2, y2] = point(end);
      parts.push(`<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${radius},${radius} 0 0 ${sweep > 0 ? 0 : 1} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1.4"/>`);
      if (angle.label) { const mid = start + sweep / 2; parts.push(text(sx(vx) + (radius + 13) * Math.cos(mid), sy(vy) - (radius + 13) * Math.sin(mid), angle.label, { size: 12 })); }
    }
  });
  Object.entries(points).forEach(([name, [x, y]]) => {
    if (spec.hideLabels?.includes?.(name)) return;
    let dx = x - centre[0];
    let dy = y - centre[1];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    parts.push(`<circle cx="${sx(x)}" cy="${sy(y)}" r="2.6" fill="${INK}"/>`);
    parts.push(text(sx(x) + dx * 15, sy(y) - dy * 15, name, { weight: 'bold', size: 14 }));
  });
  return `${svgOpen(width, height, spec.title)}${parts.join('')}</svg>`;
}

// ─── Circuits ────────────────────────────────────────────────────────────────

/** One component drawn horizontally in a 60-unit cell centred on (0, 0). */
function symbol(part) {
  const label = part.label ? text(0, -22, part.label, { size: 11, weight: 'bold' }) : '';
  const wire = (from, to) => `<line x1="${from}" y1="0" x2="${to}" y2="0" stroke="${INK}" stroke-width="2"/>`;
  const meter = letter => `${wire(-30, -12)}${wire(12, 30)}<circle cx="0" cy="0" r="12" fill="#fff" stroke="${INK}" stroke-width="2"/>${text(0, 1, letter, { weight: 'bold', size: 13 })}`;
  switch (part.type) {
    case 'cell': return `${wire(-30, -4)}${wire(4, 30)}<line x1="-4" y1="-14" x2="-4" y2="14" stroke="${INK}" stroke-width="2"/><line x1="4" y1="-7" x2="4" y2="7" stroke="${INK}" stroke-width="4"/>${label}`;
    case 'battery': return `${wire(-30, -12)}${wire(12, 30)}${[-12, 0].map(x => `<line x1="${x}" y1="-14" x2="${x}" y2="14" stroke="${INK}" stroke-width="2"/><line x1="${x + 6}" y1="-7" x2="${x + 6}" y2="7" stroke="${INK}" stroke-width="4"/>`).join('')}<line x1="12" y1="0" x2="12" y2="0" stroke="${INK}"/>${label}`;
    case 'resistor': return `${wire(-30, -18)}${wire(18, 30)}<polyline points="-18,0 -15,-8 -9,8 -3,-8 3,8 9,-8 15,8 18,0" fill="none" stroke="${INK}" stroke-width="2"/>${label}`;
    case 'rheostat': return `${wire(-30, -18)}${wire(18, 30)}<polyline points="-18,0 -15,-8 -9,8 -3,-8 3,8 9,-8 15,8 18,0" fill="none" stroke="${INK}" stroke-width="2"/><line x1="-14" y1="14" x2="14" y2="-14" stroke="${INK}" stroke-width="1.6" marker-end="url(#ndv-arrow)"/>${label}`;
    case 'bulb':
    case 'lamp': return `${wire(-30, -11)}${wire(11, 30)}<circle cx="0" cy="0" r="11" fill="#fff" stroke="${INK}" stroke-width="2"/><line x1="-8" y1="-8" x2="8" y2="8" stroke="${INK}" stroke-width="1.6"/><line x1="-8" y1="8" x2="8" y2="-8" stroke="${INK}" stroke-width="1.6"/>${label}`;
    case 'switch': return `${wire(-30, -12)}${wire(12, 30)}<circle cx="-12" cy="0" r="2.5" fill="${INK}"/><circle cx="12" cy="0" r="2.5" fill="${INK}"/><line x1="-12" y1="0" x2="10" y2="-12" stroke="${INK}" stroke-width="2"/>${label}`;
    case 'ammeter': return `${meter('A')}${label}`;
    case 'voltmeter': return `${meter('V')}${label}`;
    case 'capacitor': return `${wire(-30, -4)}${wire(4, 30)}<line x1="-4" y1="-12" x2="-4" y2="12" stroke="${INK}" stroke-width="2.4"/><line x1="4" y1="-12" x2="4" y2="12" stroke="${INK}" stroke-width="2.4"/>${label}`;
    case 'diode': return `${wire(-30, -9)}${wire(9, 30)}<path d="M-9,-9 L-9,9 L7,0 Z" fill="${INK}"/><line x1="9" y1="-9" x2="9" y2="9" stroke="${INK}" stroke-width="2"/>${label}`;
    case 'fuse': return `${wire(-30, 30)}<rect x="-14" y="-6" width="28" height="12" fill="#fff" stroke="${INK}" stroke-width="2"/><line x1="-14" y1="0" x2="14" y2="0" stroke="${INK}" stroke-width="1.4"/>${label}`;
    default: return `${wire(-30, 30)}${label}`;
  }
}

function circuit(spec) {
  const series = spec.components || [];
  const branches = Array.isArray(spec.parallel) ? spec.parallel.filter(branch => branch.length) : [];
  const cell = 76;
  const top = series.slice(0, Math.ceil(series.length / 2));
  const bottom = series.slice(Math.ceil(series.length / 2));
  const columns = Math.max(top.length, bottom.length, 1);
  const branchWidth = branches.length ? Math.max(...branches.map(branch => branch.length)) * cell + 40 : 0;
  const left = 40;
  const width = left + columns * cell + 40 + branchWidth + 20;
  const branchGap = 70;
  const height = Math.max(200, branches.length * branchGap + 80) + (spec.title ? 22 : 0);
  const y1 = (spec.title ? 22 : 0) + 40;
  const y2 = height - 30;
  const rightX = left + columns * cell + 40;
  const parts = [spec.title ? text(width / 2, 14, spec.title, { weight: 'bold', size: 14 }) : ''];
  const place = (list, y) => list.forEach((part, index) => {
    const x = left + 20 + (index + 0.5) * ((columns * cell) / Math.max(list.length, 1));
    parts.push(`<g transform="translate(${x.toFixed(1)},${y})">${symbol(part)}</g>`);
  });
  // The loop's wires, then the components sitting on them.
  parts.push(`<path d="M${left},${y1} H${rightX} M${left},${y2} H${rightX} M${left},${y1} V${y2}" fill="none" stroke="${INK}" stroke-width="2"/>`);
  place(top, y1);
  place(bottom, y2);
  if (branches.length) {
    // Parallel branches: a ladder between the right-hand junctions.
    const span = (y2 - y1) / (branches.length + 1);
    const branchLeft = rightX;
    const branchRight = rightX + branchWidth;
    parts.push(`<path d="M${branchLeft},${y1} V${y2} M${branchRight},${y1 + span} V${y1 + span * branches.length}" fill="none" stroke="${INK}" stroke-width="2"/>`);
    branches.forEach((branch, b) => {
      const y = y1 + span * (b + 1);
      parts.push(`<line x1="${branchLeft}" y1="${y}" x2="${branchRight}" y2="${y}" stroke="${INK}" stroke-width="2"/>`);
      parts.push(`<circle cx="${branchLeft}" cy="${y}" r="3" fill="${INK}"/><circle cx="${branchRight}" cy="${y}" r="3" fill="${INK}"/>`);
      branch.forEach((part, index) => {
        const x = branchLeft + 20 + (index + 0.5) * ((branchWidth - 40) / branch.length);
        parts.push(`<g transform="translate(${x.toFixed(1)},${y})">${symbol(part)}</g>`);
      });
    });
    parts.push(`<path d="M${branchRight},${y1 + span} V${y1} H${branchLeft} M${branchRight},${y1 + span * branches.length} V${y2} H${branchLeft}" fill="none" stroke="${INK}" stroke-width="2"/>`);
  } else {
    parts.push(`<line x1="${rightX}" y1="${y1}" x2="${rightX}" y2="${y2}" stroke="${INK}" stroke-width="2"/>`);
  }
  const defs = `<defs><marker id="ndv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>`;
  return `${svgOpen(width, height, spec.title)}${defs}${parts.join('')}</svg>`;
}

// ─── Number line ─────────────────────────────────────────────────────────────

function numberLine(spec) {
  const width = 560;
  const height = 110;
  const left = 30;
  const right = width - 30;
  const y = 60;
  const step = spec.step > 0 ? spec.step : niceStep(spec.max - spec.min, 12);
  const sx = value => left + ((value - spec.min) / (spec.max - spec.min)) * (right - left);
  const parts = [spec.title ? text(width / 2, 14, spec.title, { weight: 'bold', size: 13 }) : ''];
  parts.push(`<line x1="${left - 14}" y1="${y}" x2="${right + 14}" y2="${y}" stroke="${INK}" stroke-width="1.6" marker-start="url(#ndv-arrow)" marker-end="url(#ndv-arrow)"/>`);
  for (const value of ticks(spec.min, spec.max, step)) { parts.push(`<line x1="${sx(value)}" y1="${y - 6}" x2="${sx(value)}" y2="${y + 6}" stroke="${INK}"/>`); parts.push(text(sx(value), y + 20, fmt(value), { size: 11 })); }
  (spec.ranges || []).forEach(range => parts.push(`<line x1="${sx(Math.max(spec.min, range.from))}" y1="${y - 16}" x2="${sx(Math.min(spec.max, range.to))}" y2="${y - 16}" stroke="${SERIES[0]}" stroke-width="4"/>`));
  (spec.points || []).forEach(point => {
    parts.push(`<circle cx="${sx(point.value)}" cy="${y}" r="5.5" fill="${point.open ? '#fff' : INK}" stroke="${INK}" stroke-width="2"/>`);
    if (point.label) parts.push(text(sx(point.value), y - 30, point.label, { weight: 'bold' }));
  });
  const defs = `<defs><marker id="ndv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>`;
  return `${svgOpen(width, height, spec.title)}${defs}${parts.join('')}</svg>`;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const DRAW = { function: functionGraph, line: xyChart, bar: xyChart, scatter: xyChart, pie: pieChart, geometry, circuit, numberline: numberLine };

/** SVG markup for a figure spec (object or JSON text), or a visible note saying why it cannot be drawn. */
export function figureToSvg(input) {
  let spec = input;
  try { if (typeof input === 'string') spec = JSON.parse(input); } catch { return { svg: '', error: 'The figure is not valid JSON.' }; }
  const draw = DRAW[spec?.type];
  if (!draw) return { svg: '', error: `Unknown figure type "${esc(spec?.type)}".` };
  try {
    const svg = draw(spec);
    // Unique marker / clip ids so several figures can share a page.
    const id = Math.random().toString(36).slice(2, 8);
    return { svg: svg.replace(/ndv-(arrow|plot)/g, `ndv-$1-${id}`), error: '' };
  } catch (error) {
    return { svg: '', error: `The figure could not be drawn: ${esc(error.message)}` };
  }
}

/** Ready-made specs for the "Insert figure" dialog. */
export const FIGURE_TEMPLATES = [
  ['Graph of a function', { type: 'function', title: '', xLabel: 'x', yLabel: 'y', xRange: [-3, 5], grid: true, functions: [{ expr: 'x^2 - 2x - 3', label: 'y = x² − 2x − 3' }], points: [] }],
  ['Bar chart', { type: 'bar', title: 'Rainfall (mm)', xLabel: 'Month', yLabel: 'mm', categories: ['Jan', 'Feb', 'Mar', 'Apr'], series: [{ name: 'Rainfall', values: [12, 18, 40, 85] }] }],
  ['Line graph', { type: 'line', title: '', xLabel: 'Time (s)', yLabel: 'Velocity (m/s)', series: [{ name: 'v', points: [[0, 0], [2, 8], [4, 16], [6, 16], [8, 0]] }] }],
  ['Scatter plot', { type: 'scatter', title: '', xLabel: 'x', yLabel: 'y', series: [{ name: 'Data', points: [[1, 2], [2, 4.1], [3, 5.9], [4, 8.2]] }] }],
  ['Pie chart', { type: 'pie', title: 'Household spending', slices: [{ label: 'Food', value: 40 }, { label: 'Rent', value: 25 }, { label: 'Transport', value: 15 }, { label: 'Other', value: 20 }] }],
  ['Right-angled triangle', { type: 'geometry', points: { A: [0, 0], B: [6, 0], C: [0, 4] }, polygons: [['A', 'B', 'C']], segments: [['A', 'B', '6 cm'], ['A', 'C', '4 cm']], angles: [{ at: 'A', from: 'B', to: 'C', right: true }, { at: 'B', from: 'C', to: 'A', label: 'θ' }] }],
  ['Circle with chord', { type: 'geometry', points: { O: [0, 0], A: [-3, 0], B: [2.4, 1.8] }, circles: [{ center: 'O', radius: 3 }], segments: [['A', 'B'], ['O', 'B', '3 cm']] }],
  ['Electric circuit', { type: 'circuit', components: [{ type: 'battery', label: '12 V' }, { type: 'switch' }, { type: 'ammeter' }], parallel: [[{ type: 'resistor', label: '4 Ω' }], [{ type: 'resistor', label: '6 Ω' }]] }],
  ['Number line', { type: 'numberline', min: -5, max: 5, step: 1, points: [{ value: -2, label: '', open: false }, { value: 3, label: '', open: true }], ranges: [{ from: -2, to: 3 }] }],
];
