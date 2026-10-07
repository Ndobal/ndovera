import { aiAnswerToPlainText, parseAiAnswer, parseInline } from './aiContent';

test('raw Markdown becomes headings, lists and cards — never visible symbols', () => {
  const blocks = parseAiAnswer([
    '# Photosynthesis',
    '**Meaning**',
    'Definition: Photosynthesis is the process through which green plants use **light energy** to make food.',
    '## What plants need',
    '- ☀️ Sunlight',
    '* 💧 Water',
    '## How it happens',
    '1. Light is absorbed',
    '2. Water is split',
    'Practice question 1: Name two things plants need.',
    '- Sunlight',
    '- Soil',
  ].join('\n'));

  expect(blocks.map(block => block.type)).toEqual(['heading', 'heading', 'card', 'heading', 'list', 'heading', 'list', 'card']);
  expect(blocks[0]).toMatchObject({ level: 1, text: 'Photosynthesis' });
  expect(blocks[1]).toMatchObject({ level: 3, text: 'Meaning' });
  expect(blocks[2]).toMatchObject({ kind: 'definition' });
  expect(blocks[4].items).toEqual(['☀️ Sunlight', '💧 Water']);
  expect(blocks[6]).toMatchObject({ ordered: true, start: 1, items: ['Light is absorbed', 'Water is split'] });
  expect(blocks[7]).toMatchObject({ kind: 'question', text: 'Name two things plants need.', items: ['Sunlight', 'Soil'] });

  const plain = aiAnswerToPlainText(blocks);
  expect(plain).not.toMatch(/\*\*|###|^\* /m);
});

test('tables, formulas and code become their own blocks', () => {
  const blocks = parseAiAnswer('| Part | Job |\n|---|---|\n| Leaf | Makes food |\n\n$$6CO_2 + 6H_2O$$\n\n```\nprint(1)\n```');
  expect(blocks[0]).toMatchObject({ type: 'table', header: ['Part', 'Job'], rows: [['Leaf', 'Makes food']] });
  expect(blocks[1]).toMatchObject({ type: 'formula', text: '6CO_2 + 6H_2O' });
  expect(blocks[2]).toMatchObject({ type: 'code', text: 'print(1)' });
});

test('a blank line closes a card so the next paragraph stands alone', () => {
  const blocks = parseAiAnswer('Example: 3/4 is a fraction.\n\nFractions are parts of a whole.');
  expect(blocks.map(block => block.type)).toEqual(['card', 'paragraph']);
});

test('inline emphasis is parsed without touching money or ordinary words', () => {
  expect(parseInline('**Bold** and *italic* and `x` and $a^2$')).toEqual([
    { type: 'strong', text: 'Bold' }, { type: 'text', text: ' and ' },
    { type: 'em', text: 'italic' }, { type: 'text', text: ' and ' },
    { type: 'code', text: 'x' }, { type: 'text', text: ' and ' },
    { type: 'math', text: 'a^2' },
  ]);
  expect(parseInline('It costs $5 and $10 today').map(token => token.type)).toEqual(['text']);
  expect(parseInline('snake_case_name stays').map(token => token.type)).toEqual(['text']);
});
