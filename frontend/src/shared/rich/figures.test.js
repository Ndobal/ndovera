import { FIGURE_TEMPLATES, compileExpression, figureToSvg } from './figures';

test('every figure template draws an SVG', () => {
  for (const [name, spec] of FIGURE_TEMPLATES) {
    const { svg, error } = figureToSvg(spec);
    expect(error ? `${name}: ${error}` : '').toBe('');
    expect(svg).toMatch(/^<svg[\s>]/);
  }
});

test('expressions handle implicit multiplication, powers and functions — and nothing else', () => {
  expect(compileExpression('x^2 - 2x - 3')(3)).toBe(0);
  expect(compileExpression('2(x+1)')(2)).toBe(6);
  expect(compileExpression('sin(0) + sqrt(16)')(0)).toBe(4);
  expect(() => compileExpression('alert(1)')).toThrow();
  expect(() => compileExpression('(x+1')).toThrow();
});

test('a broken figure says what is wrong instead of drawing', () => {
  expect(figureToSvg({ type: 'spaceship' }).error).toBeTruthy();
  expect(figureToSvg('{ not json').error).toBeTruthy();
});

test('two figures on one page never share marker ids', () => {
  const ids = svg => [...svg.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  const circuit = FIGURE_TEMPLATES.find(([name]) => name === 'Electric circuit')[1];
  const first = ids(figureToSvg(circuit).svg);
  const second = ids(figureToSvg(circuit).svg);
  expect(first.filter(id => second.includes(id))).toEqual([]);
});
