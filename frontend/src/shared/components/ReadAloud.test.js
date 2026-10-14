import { splitForSpeech, usableVoices } from './ReadAloud';

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
