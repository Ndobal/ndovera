import { blocksMatchText, detectStructure, hasMeaningfulStructure } from './materialStructure';

test('a pasted plain-text note is read as topic, definition and list without changing a word', () => {
  const text = 'photosynthesis\nmeaning\nphotosynthesis is the process by which green plants make food.\nfactors affecting photosynthesis\n1 sunlight\n2 water';
  const blocks = detectStructure(text);
  expect(blocks.map(block => block.type)).toEqual(['topic', 'subheading', 'definition', 'list']);
  expect(blocks[2].text).toBe('photosynthesis is the process by which green plants make food.');
  expect(blocks[3]).toMatchObject({ text: 'factors affecting photosynthesis', items: ['sunlight', 'water'], ordered: true });
  expect(hasMeaningfulStructure(blocks)).toBe(true);
  expect(blocksMatchText(blocks, text)).toBe(true);
});

test('examples, notes, exercises and assignments are recognised from their cues', () => {
  const blocks = detectStructure('Fractions\n\nExample: 3/4 is proper.\n\nNote: never divide by zero.\n\nExercise\n1. Write two fractions.\n\nHomework\nFind five fractions at home.');
  expect(blocks.map(block => block.type)).toEqual(['topic', 'example', 'note', 'exercise', 'assignment', 'assignment']);
  expect(blocks[3].items).toEqual(['Write two fractions.']);
});

test('ordinary prose stays a paragraph and is not offered as structure', () => {
  const blocks = detectStructure('We will revise last week\'s work tomorrow. Bring your notebooks.');
  expect(blocks.map(block => block.type)).toEqual(['paragraph']);
  expect(hasMeaningfulStructure(blocks)).toBe(false);
});

test('AI-style notes keep tables, formulas and Markdown headings whole, word for word', () => {
  const text = [
    '# Price Index',
    'A price index compares prices with a base year.',
    '',
    '| Year | Price (₦) | Price Index |',
    '|---|---|---|',
    '| 2024 | 2,000 | 100 |',
    '| 2025 | 2,500 | 125 |',
    '',
    '$$',
    '\frac{300}{1200}\times100',
    '$$',
    '',
    '> Key definition: the base year index is always 100.',
  ].join('\n');
  const blocks = detectStructure(text);
  const table = blocks.find(block => block.text.startsWith('| Year'));
  expect(table.type).toBe('paragraph');
  expect(table.text.split('\n')).toHaveLength(4);
  expect(blocks.find(block => block.text.startsWith('$$')).text).toBe('$$\n\frac{300}{1200}\times100\n$$');
  expect(blocks.some(block => block.text.startsWith('> Key definition'))).toBe(true);
  expect(blocks[0]).toMatchObject({ type: 'topic', text: '# Price Index' });
  expect(blocksMatchText(blocks, text)).toBe(true);
});
