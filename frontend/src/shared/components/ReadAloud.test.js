import { locatePieces, pickDefaultVoice, questionSpeech, speakable, splitForSpeech, textMap, usableVoices } from './ReadAloud';

describe('splitForSpeech', () => {
  it('splits at sentence ends and drops extra spaces', () => {
    expect(splitForSpeech('Photosynthesis makes food.   Plants need light!\nWhy? Read on')).toEqual([
      'Photosynthesis makes food.', 'Plants need light!', 'Why?', 'Read on',
    ]);
  });

  it('breaks long sentences at commas or spaces, never mid-word', () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const pieces = splitForSpeech(long, 80);
    expect(pieces.length).toBeGreaterThan(1);
    pieces.forEach(piece => expect(piece.length).toBeLessThanOrEqual(80));
    expect(pieces.join(' ')).toBe(long);
  });

  it('returns nothing for empty text', () => {
    expect(splitForSpeech('   ')).toEqual([]);
  });
});

describe('usableVoices', () => {
  const voices = [
    { name: 'Google UK English', lang: 'en-GB', localService: false },
    { name: 'Zira', lang: 'en-US', localService: true },
    { name: 'Hortense', lang: 'fr-FR', localService: true },
  ];
  it('puts device voices first and English before others', () => {
    expect(usableVoices([...voices]).map(voice => voice.name)).toEqual(['Zira', 'Hortense', 'Google UK English']);
  });
  it('offers only device voices when offline', () => {
    expect(usableVoices([...voices], false).map(voice => voice.name)).toEqual(['Zira', 'Hortense']);
  });
});

describe('pickDefaultVoice', () => {
  const v = (name, lang, localService = true) => ({ name, lang, localService });
  it('chooses a British English female voice when the device has one', () => {
    expect(pickDefaultVoice([v('Microsoft David', 'en-US'), v('Google UK English Male', 'en-GB'), v('Google UK English Female', 'en-GB')]).name).toBe('Google UK English Female');
    expect(pickDefaultVoice([v('Daniel', 'en-GB'), v('Kate', 'en-GB'), v('Samantha', 'en-US')]).name).toBe('Kate');
    expect(pickDefaultVoice([v('Microsoft George - English (United Kingdom)', 'en-GB'), v('Microsoft Libby Online (Natural) - English (United Kingdom)', 'en-GB')]).name).toMatch(/Libby/);
  });
  it('falls back to British English, then English', () => {
    expect(pickDefaultVoice([v('Daniel', 'en-GB'), v('Zira', 'en-US')]).name).toBe('Daniel');
    expect(pickDefaultVoice([v('Hortense', 'fr-FR'), v('Zira', 'en-US')]).name).toBe('Zira');
    expect(pickDefaultVoice([])).toBe(null);
  });
});

describe('textMap and locatePieces', () => {
  it('reads blocks as sentences, keeps words whole across formatting, and maps pieces back to the page', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h2>Photosynthesis</h2><p>Plants make <strong>fo</strong>od from light. They need <em>water</em> too!</p><span aria-hidden="true">hidden</span>';
    document.body.appendChild(root);
    const map = textMap(root);
    expect(map.text.trim()).toBe('Photosynthesis. Plants make food from light. They need water too!');
    const pieces = splitForSpeech(map.text);
    expect(pieces).toEqual(['Photosynthesis.', 'Plants make food from light.', 'They need water too!']);
    const spans = locatePieces(map.text, pieces);
    const [start, end] = spans[2];
    const first = map.at(start);
    const last = map.at(end - 1);
    expect(first[0].nodeValue.slice(first[1])).toMatch(/^They need/);
    expect(last[0].nodeValue[last[1]]).toBe('!');
    root.remove();
  });
});

describe('questionSpeech', () => {
  it('reads the question, then each option by its letter, and says simple maths in words', () => {
    const pieces = questionSpeech({ type: 'mcq', prompt: 'What is **x** if x^2 = 16?', options: ['4', 'x = 8', '$\\frac{1}{2}$'] });
    expect(pieces.map(piece => piece.text)).toEqual(['What is x if x squared = 16?', 'Option A: 4', 'Option B: x = 8', 'Option C: 1 over 2']);
    expect(pieces.map(piece => piece.option)).toEqual([-1, 0, 1, 2]);
  });
  it('says blanks and true-or-false questions plainly', () => {
    expect(questionSpeech({ type: 'truefalse', prompt: 'The sun is a star.', options: ['True', 'False'] }).map(piece => piece.text)).toEqual(['The sun is a star.', 'True or false?']);
    expect(speakable('Water boils at ____ degrees.')).toBe('Water boils at blank degrees.');
    expect(questionSpeech(null)).toEqual([]);
  });
});
