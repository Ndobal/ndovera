import { looksRich, markdownToTable, normalizeTables, renderRichText, tableToMarkdown } from './richText';

const text = html => html.replace(/<[^>]+>/g, '');

test('Markdown marks become real formatting, not raw characters', () => {
  const html = renderRichText('### Price Index\n\nThe **base year** is *2024*.\n\n- one\n- two\n\n> A definition');
  expect(html).toContain('<h3>Price Index</h3>');
  expect(html).toContain('<strong>base year</strong>');
  expect(html).toContain('<em>2024</em>');
  expect(html).toContain('<ul>');
  expect(html).toContain('<blockquote>');
  expect(html).not.toContain('**');
  expect(html).not.toContain('###');
});

test('a Markdown table becomes a real, scrollable table', () => {
  const html = renderRichText('| Year | Price (₦) | Price Index |\n|---|---:|---|\n| 2024 | 2,000 | 100 |\n| 2025 | 2,500 | 125 |');
  expect(html).toContain('<div class="ndv-table"><table>');
  expect(html).toContain('<th>Year</th>');
  expect(html).toContain('<td align="right">2,500</td>');
  expect(html).not.toContain('|---|');
});

test('a table pasted with tabs becomes a table', () => {
  const html = renderRichText('Year\tPrice (₦)\tPrice Index\n2024\t2,000\t100\n2025\t2,500\t125\n2026\t3,000\t150');
  expect(html).toContain('<th>Price (₦)</th>');
  expect(html).toContain('<td>150</td>');
});

test('formulas are typeset: fractions stack, LaTeX never shows raw', () => {
  for (const source of [
    '\\[\\text{Percentage Change} = \\frac{\\text{New Value}-\\text{Old Value}}{\\text{Old Value}} \\times 100\\]',
    'The index is \\(\\frac{300}{1200}\\times100\\) for that year.',
    '$$\\sum_{i=1}^{n} x_i$$',
    '\\frac{300}{1200}\\times100',
  ]) {
    const html = renderRichText(source);
    expect(html).toContain('katex');
    expect(text(html)).not.toContain('\\frac');
  }
  expect(renderRichText('\\(\\frac{a}{b}\\)')).toContain('mfrac');
  expect(renderRichText('$$x^2$$')).toContain('katex-display');
});

test('money with dollar signs is left alone', () => {
  const html = renderRichText('It costs $5 and $10.');
  expect(html).not.toContain('katex');
  expect(text(html)).toContain('$5 and $10');
});

test('symbols, superscript and subscript survive', () => {
  const html = renderRichText('Σ Δ % × ÷ ≤ ≥ ° √ and X<sup>2</sup>, CO<sub>2</sub>, \\(x^{2}\\)');
  expect(html).toContain('Σ Δ % × ÷ ≤ ≥ ° √');
  expect(html).toContain('<sup>2</sup>');
  expect(html).toContain('<sub>2</sub>');
});

test('scripts and handlers are stripped', () => {
  const html = renderRichText('<script>alert(1)</script><img src=x onerror="alert(1)"> safe');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('onerror');
});

test('tables round-trip through the table editor format', () => {
  const markdown = tableToMarkdown([['Year', 'Index'], ['2024', '100'], ['a|b', '']], ['', 'right']);
  expect(markdownToTable(markdown)).toEqual({ rows: [['Year', 'Index'], ['2024', '100'], ['a|b', '']], align: ['', 'right'] });
  expect(markdownToTable('not a table')).toBeNull();
});

test('looksRich spots formatting worth rendering', () => {
  expect(looksRich('## Heading')).toBe(true);
  expect(looksRich('| a | b |\n|---|---|')).toBe(true);
  expect(looksRich('\\frac{1}{2}')).toBe(true);
  expect(looksRich('Just a plain sentence.')).toBe(false);
});

test('merged cells: written as an HTML table, rendered safely, and read back for editing', () => {
  const { htmlToTable, tableToHtml } = require('./richText');
  const html = tableToHtml([['Sector', 'Output', ''], ['Agriculture', 'Crops', 'Livestock'], ['Total', '\\(x^{2}\\)', '']], ['', 'center'], { '0,1': { colspan: 2, rowspan: 1 }, '2,1': { colspan: 2, rowspan: 1 } });
  expect(html).toContain('<th colspan="2" align="center">Output</th>');
  const rendered = renderRichText(`Before\n\n${html}\n\nAfter`);
  expect(rendered).toContain('colspan="2"');
  expect(rendered).toContain('katex');
  expect(rendered).toContain('<div class="ndv-table"><table>');
  const back = htmlToTable(html);
  expect(back.spans).toEqual({ '0,1': { colspan: 2, rowspan: 1 }, '2,1': { colspan: 2, rowspan: 1 } });
  expect(back.rows[1]).toEqual(['Agriculture', 'Crops', 'Livestock']);
  expect(back.rows[2][1]).toBe('\\(x^{2}\\)');
  expect(back.hasHeader).toBe(true);
});

describe('tables written the way AI models and pasted text often write them still draw', () => {
  const cells = html => (html.match(/<t[hd][\s>]/g) || []).length;
  test('glued to the sentence above, with no |---| line', () => {
    const html = renderRichText('Study the table below and answer.\n| Year | Price (₦) |\n| 2023 | 4,000 |\n| 2024 | 6,000 |\nWhat was the rise?');
    expect(html).toContain('<table>');
    expect(cells(html)).toBe(6);
    expect(html).toMatch(/What was the rise\?/);
    expect(html).not.toMatch(/<td>What was/);
  });
  test('rows joined by a literal \\n', () => {
    const html = renderRichText('Use the data:\\n| Good | Qty |\\n|---|---|\\n| Rice | 5 |\\nFind the total.');
    expect(html).toContain('<table>');
    expect(cells(html)).toBe(4);
  });
  test('a proper table and LaTeX such as \\nu are left alone', () => {
    expect(normalizeTables('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(normalizeTables('frequency \\(\\nu\\) is high')).toBe('frequency \\(\\nu\\) is high');
  });
});

test('a table written on one line inside an exam question becomes a real table, with the question kept around it', () => {
  const question = 'The government of a country implements a fiscal policy to stimulate economic growth. The following data shows the impact of the policy on different macroeconomic variables: | Variable | Before Policy | After Policy | | --- | --- | --- | | GDP | 100 | 120 | | Inflation | 2% | 4% | | Unemployment | 5% | 4% | What can be inferred about the effectiveness of the fiscal policy?';
  expect(normalizeTables(question)).toBe([
    'The government of a country implements a fiscal policy to stimulate economic growth. The following data shows the impact of the policy on different macroeconomic variables:',
    '',
    '| Variable | Before Policy | After Policy |',
    '| --- | --- | --- |',
    '| GDP | 100 | 120 |',
    '| Inflation | 2% | 4% |',
    '| Unemployment | 5% | 4% |',
    '',
    'What can be inferred about the effectiveness of the fiscal policy?',
  ].join('\n'));
  const html = renderRichText(question);
  expect(html).toMatch(/<table>/);
  expect((html.match(/<tr>/g) || []).length).toBe(4);
  expect(html).toMatch(/<td>Unemployment<\/td>/);
  expect(html).toMatch(/What can be inferred/);
  expect(html).not.toMatch(/\| --- \|/);
});

test('one-line tables without spaces, and ordinary multi-line tables, are both left drawing correctly', () => {
  expect(normalizeTables('Table:|A|B||---|---||1|2|')).toBe('Table:\n\n|A|B|\n| --- | --- |\n| 1 | 2 |');
  const multi = 'Intro\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
  expect(normalizeTables(multi)).toBe(multi);
});

// N16 follow-up: the fiscal-policy question still showed pipes. Every way a model writes such a table must draw,
// with the question text before and after it kept.
describe('exam-question tables in every shape the AI writes them', () => {
  const before = 'The following data shows the impact of the policy on different macroeconomic variables:';
  const after = 'What can be inferred about the effectiveness of the fiscal policy?';
  const BS = String.fromCharCode(92);
  const shapes = {
    'one line with a rule row': '| Variable | Before Policy | After Policy | | --- | --- | --- | | GDP | 100 | 120 | | Inflation | 2% | 4% |',
    'one line, two-dash rule': '| Variable | Before Policy | After Policy | | -- | -- | -- | | GDP | 100 | 120 | | Inflation | 2% | 4% |',
    'one line, no rule row': '| Variable | Before Policy | After Policy | | GDP | 100 | 120 | | Inflation | 2% | 4% |',
    'rows joined by a literal backslash-n': ['| Variable | Before Policy | After Policy |', '| --- | --- | --- |', '| GDP | 100 | 120 |', '| Inflation | 2% | 4% |'].join(`${BS}n`),
    'lines glued to the sentences': ['| Variable | Before Policy | After Policy |', '| --- | --- | --- |', '| GDP | 100 | 120 |', '| Inflation | 2% | 4% |'].join('\n'),
  };
  for (const [shape, table] of Object.entries(shapes)) {
    test(shape, () => {
      const html = renderRichText(`${before} ${table} ${after}`);
      expect(html).toContain('<th>Before Policy</th>');
      expect((html.match(/<tr>/g) || []).length).toBe(3);
      expect(html).toContain('<td>Inflation</td>');
      expect(html).toContain(before);
      expect(html).toContain(after);
      expect(html).not.toMatch(/\| *GDP/);
    });
  }

  test('an option holding a table draws it even when rendered inline', () => {
    expect(renderRichText(`See: ${shapes['one line with a rule row']}`, { inline: true })).toContain('<table>');
  });

  test('an empty cell in a real multi-line table and a stray pipe in prose are left alone', () => {
    expect((renderRichText('| a | b | c |\n| --- | --- | --- |\n| 1 | | 3 |').match(/<td>/g) || []).length).toBe(3);
    expect(renderRichText('Use a | b | | c | d for OR.')).not.toContain('<table>');
  });
});
