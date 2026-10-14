import React, { useCallback, useEffect, useRef, useState } from 'react';

// Read a page out loud with the device's own text-to-speech (the Web Speech API).
// Nothing is sent anywhere and nothing is paid for. Voices installed on the device
// ("local" voices) work with no internet, so saved notes can be listened to offline;
// network voices are only offered while online.

const RATES = [0.75, 1, 1.25, 1.5];
const MAX_CHUNK = 220;

const speech = () => (typeof window !== 'undefined' && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null);

/**
 * Split text into short pieces at sentence (then comma, then word) breaks. Browsers
 * stop long utterances part-way, and short pieces let reading resume where it was.
 */
export function splitForSpeech(text, max = MAX_CHUNK) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g) || [clean];
  const out = [];
  for (const raw of sentences) {
    let sentence = raw.trim();
    while (sentence.length > max) {
      const window = sentence.slice(0, max);
      const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '));
      const at = cut > max / 3 ? cut + 1 : (window.lastIndexOf(' ') > max / 3 ? window.lastIndexOf(' ') : max);
      out.push(sentence.slice(0, at).trim());
      sentence = sentence.slice(at).trim();
    }
    if (sentence) out.push(sentence);
  }
  return out;
}

/** Voices this device can use now: installed ones first; network ones only when online. */
export function usableVoices(voices, online = true) {
  const list = (voices || []).filter(voice => online || voice.localService);
  return list.sort((a, b) => Number(b.localService) - Number(a.localService)
    || Number(/^en/i.test(b.lang)) - Number(/^en/i.test(a.lang))
    || a.name.localeCompare(b.name));
}

/**
 * Listen controls for some text. Pass `getText` (called when reading starts, e.g.
 * reading a rendered article's innerText) or `text`.
 */
export default function ReadAloud({ text, getText, label = 'Listen' }) {
  const synth = speech();
  const [state, setState] = useState('idle'); // idle | playing | paused
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState(() => { try { return localStorage.getItem('ndovera:readAloudVoice') || ''; } catch { return ''; } });
  const [rate, setRate] = useState(() => { try { return Number(localStorage.getItem('ndovera:readAloudRate')) || 1; } catch { return 1; } });
  const [progress, setProgress] = useState({ at: 0, of: 0 });
  const chunks = useRef([]);
  const index = useRef(0);
  const run = useRef(0);
  // Read when each piece starts, so a new voice or speed applies from the current piece.
  const settings = useRef({ voiceName, rate, voices });
  settings.current = { voiceName, rate, voices };

  useEffect(() => {
    if (!synth) return undefined;
    const load = () => setVoices(usableVoices(synth.getVoices(), navigator.onLine !== false));
    load();
    synth.addEventListener?.('voiceschanged', load);
    window.addEventListener('online', load);
    window.addEventListener('offline', load);
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      window.removeEventListener('online', load);
      window.removeEventListener('offline', load);
    };
  }, [synth]);

  // Leaving the page stops the reading.
  useEffect(() => () => { run.current += 1; synth?.cancel(); }, [synth]);

  const speakFrom = useCallback((start) => {
    if (!synth) return;
    const token = ++run.current;
    synth.cancel();
    const next = (at) => {
      if (token !== run.current) return;
      if (at >= chunks.current.length) { setState('idle'); setProgress({ at: 0, of: chunks.current.length }); index.current = 0; return; }
      index.current = at;
      setProgress({ at: at + 1, of: chunks.current.length });
      const { voiceName: chosen, rate: speed, voices: list } = settings.current;
      const voice = list.find(item => item.name === chosen) || list[0] || null;
      const utterance = new window.SpeechSynthesisUtterance(chunks.current[at]);
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
      utterance.rate = speed;
      utterance.onend = () => next(at + 1);
      utterance.onerror = event => { if (token === run.current && event.error !== 'interrupted' && event.error !== 'canceled') next(at + 1); };
      synth.speak(utterance);
    };
    setState('playing');
    next(start);
  }, [synth]);

  if (!synth) return <p className="text-xs text-slate-500">Reading aloud is not available in this browser.</p>;

  const play = () => {
    if (state === 'paused') { synth.resume(); setState('playing'); return; }
    chunks.current = splitForSpeech(getText ? getText() : text);
    if (!chunks.current.length) return;
    speakFrom(0);
  };
  const pause = () => { synth.pause(); setState('paused'); };
  const stop = () => { run.current += 1; synth.cancel(); setState('idle'); index.current = 0; setProgress({ at: 0, of: 0 }); };
  // A new voice or speed takes effect from the current piece.
  const restartHere = (change) => { settings.current = { ...settings.current, ...change }; if (state !== 'idle') speakFrom(index.current); };
  const BTN = 'rounded-xl px-3 py-1.5 text-sm font-bold';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5" role="group" aria-label="Read aloud">
      {state === 'playing'
        ? <button type="button" className={`${BTN} bg-indigo-600 text-white`} onClick={pause}>⏸ Pause</button>
        : <button type="button" className={`${BTN} bg-indigo-600 text-white`} onClick={play}>{state === 'paused' ? '▶ Resume' : `🔊 ${label}`}</button>}
      {state !== 'idle' && <button type="button" className={`${BTN} border border-indigo-200 bg-white text-indigo-700 dark:border-white/20 dark:bg-transparent dark:text-indigo-200`} onClick={stop}>⏹ Stop</button>}
      <select aria-label="Reading speed" className="rounded-xl border border-indigo-200 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100" value={rate}
        onChange={event => { const value = Number(event.target.value); setRate(value); try { localStorage.setItem('ndovera:readAloudRate', String(value)); } catch {} restartHere({ rate: value }); }}>
        {RATES.map(value => <option key={value} value={value}>{value}×</option>)}
      </select>
      {voices.length > 1 && (
        <select aria-label="Voice" className="max-w-[12rem] rounded-xl border border-indigo-200 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100" value={voiceName}
          onChange={event => { setVoiceName(event.target.value); try { localStorage.setItem('ndovera:readAloudVoice', event.target.value); } catch {} restartHere({ voiceName: event.target.value }); }}>
          <option value="">Default voice</option>
          {voices.map(voice => <option key={voice.name} value={voice.name}>{voice.name}{voice.localService ? '' : ' (online)'}</option>)}
        </select>
      )}
      {progress.of > 0 && state !== 'idle' && <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{progress.at} / {progress.of}</span>}
    </div>
  );
}
