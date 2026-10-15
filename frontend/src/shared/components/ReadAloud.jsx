import React, { useCallback, useEffect, useRef, useState } from 'react';

// Read a page out loud with the device's own text-to-speech (the Web Speech API).
// Nothing is sent anywhere and nothing is paid for. Voices installed on the device
// ("local" voices) work with no internet, so saved notes can be listened to offline;
// network voices are only offered while online.
//
// Given the element that holds the text (`targetRef`), the sentence being read is
// highlighted and kept in view; scrolling away pauses the following (with a way back),
// and tapping a sentence while listening reads from there. The default voice is a British
// English female one where the device has it.

const RATES = [0.75, 1, 1.25, 1.5];
const MAX_CHUNK = 220;
const HIGHLIGHT = 'ndovera-read-aloud';

const speech = () => (typeof window !== 'undefined' && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null);
const canHighlight = () => typeof window !== 'undefined' && typeof window.Highlight === 'function' && Boolean(window.CSS?.highlights);

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

// Voice names devices use (browsers do not say which voices are female).
const UK_FEMALE = /\b(female|libby|sonia|hazel|susan|kate|serena|stephanie|martha|amy|emma|fiona|maisie|bella)\b/i;
const MALE = /\b(male|daniel|george|ryan|thomas|arthur|oliver|james|harry|brian|alfie)\b/i;
const isBritish = voice => /^en[-_]gb/i.test(voice.lang) || /\b(uk|united kingdom|british)\b/i.test(voice.name);

/** The default voice: British English female, else British English, else any English, else the first. */
export function pickDefaultVoice(voices) {
  const list = voices || [];
  return list.find(voice => isBritish(voice) && UK_FEMALE.test(voice.name) && !/\bmale\b/i.test(voice.name.replace(/female/ig, '')))
    || list.find(voice => isBritish(voice) && !MALE.test(voice.name))
    || list.find(isBritish)
    || list.find(voice => /^en/i.test(voice.lang) && !MALE.test(voice.name))
    || list[0] || null;
}

/**
 * The text of an element with a map back to its text nodes: `text` has whitespace runs
 * collapsed (as splitForSpeech reads it), and `at(i)` gives the node and offset of
 * character i, so a piece of text can be turned into a highlightable Range.
 */
export function textMap(root) {
  const BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,div,td,th,blockquote,pre,section,article,figure,figcaption,dt,dd,tr,table,ul,ol';
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, {
    acceptNode: node => (node.parentElement?.closest('script,style,[aria-hidden="true"]') ? 2 : 1),
  });
  let text = '';
  const points = [];
  let lastSpace = true;
  let previous = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue || '';
    if (!value.trim() && !text) continue;
    // A new paragraph, heading or list item: a pause, so a heading does not run into the next line.
    const block = node.parentElement?.closest(BLOCK) || root;
    if (previous && block !== previous.block && text.trim()) {
      const end = [previous.node, (previous.node.nodeValue || '').length];
      if (!/[.!?:;]\s*$/.test(text)) { text = text.replace(/\s+$/, ''); points.length = text.length; text += '.'; points.push(end) }
      if (!lastSpace || !/\s$/.test(text)) { text += ' '; points.push(end) }
      lastSpace = true;
    }
    for (let offset = 0; offset < value.length; offset += 1) {
      const space = /\s/.test(value[offset]);
      if (space && lastSpace) continue;
      text += space ? ' ' : value[offset];
      points.push([node, offset]);
      lastSpace = space;
    }
    previous = { node, block };
  }
  return { text, at: index => points[Math.max(0, Math.min(points.length - 1, index))] || null, length: points.length };
}

/** Where each piece sits in the mapped text (searching forward, so repeats map in order). */
export function locatePieces(text, pieces) {
  let from = 0;
  return pieces.map(piece => {
    const start = text.indexOf(piece, from);
    if (start < 0) return null;
    from = start + piece.length;
    return [start, start + piece.length];
  });
}

// ─── The player: one for the whole app ───────────────────────────────────────
//
// Reading carries on when the student moves to another page or switches away (the
// floating ReadAloudPlayer keeps pause / stop / back-to-note), and stops by itself when
// they open Practice, Assignments or Exams. The note's own control highlights and follows
// while it is on screen.

const loadSetting = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const IDLE = { status: 'idle', title: '', source: '', href: '', at: 0, of: 0, current: '', inPlace: false };
let player = { ...IDLE };
let pieces = [];
let runToken = 0;
const listeners = new Set();
const settings = { voiceName: loadSetting('ndovera:readAloudVoice', ''), rate: Number(loadSetting('ndovera:readAloudRate', 1)) || 1, voices: [] };
let onPiece = null; // the on-screen note's highlighter, while it is mounted
const onScreen = new Map(); // read-aloud controls on screen now, by source

function emit(patch) {
  player = { ...player, ...patch };
  listeners.forEach(listener => listener(player));
}

export function useReadAloudPlayer() {
  const [state, setState] = useState(player);
  useEffect(() => { listeners.add(setState); setState(player); return () => { listeners.delete(setState); }; }, []);
  return state;
}

function speakFrom(start) {
  const synth = speech();
  if (!synth) return;
  const token = ++runToken;
  synth.cancel();
  const next = (at) => {
    if (token !== runToken) return;
    if (at >= pieces.length) { emit({ ...IDLE }); onPiece?.(-1); return; }
    emit({ status: 'playing', at, of: pieces.length, current: pieces[at] });
    onPiece?.(at);
    const voice = settings.voices.find(item => item.name === settings.voiceName) || pickDefaultVoice(settings.voices);
    const utterance = new window.SpeechSynthesisUtterance(pieces[at]);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = 'en-GB';
    utterance.rate = settings.rate;
    utterance.onend = () => next(at + 1);
    utterance.onerror = event => { if (token === runToken && event.error !== 'interrupted' && event.error !== 'canceled') next(at + 1); };
    synth.speak(utterance);
  };
  next(start);
}

export const readAloud = {
  /** `inPlace`: read where the student is (a quiz question) — allowed in Practice, never carried away. */
  start({ chunks, title, source, href, inPlace = false }) {
    pieces = chunks;
    emit({ ...IDLE, status: 'playing', title: title || 'Reading', source: source || '', href: href || '', of: chunks.length, inPlace });
    speakFrom(0);
  },
  jump(at) { if (pieces.length) speakFrom(Math.max(0, Math.min(pieces.length - 1, at))); },
  pause() { speech()?.pause(); emit({ status: 'paused' }); },
  resume() { speech()?.resume(); emit({ status: 'playing' }); },
  stop() { runToken += 1; speech()?.cancel(); pieces = []; emit({ ...IDLE }); onPiece?.(-1); },
  /** A new voice or speed applies from the current piece. */
  set(change) {
    Object.assign(settings, change);
    if (change.voiceName !== undefined) { try { localStorage.setItem('ndovera:readAloudVoice', change.voiceName); } catch { /* ignore */ } }
    if (change.rate !== undefined) { try { localStorage.setItem('ndovera:readAloudRate', String(change.rate)); } catch { /* ignore */ } }
    if (player.status !== 'idle' && (change.voiceName !== undefined || change.rate !== undefined)) speakFrom(player.at);
  },
  get settings() { return settings; },
};

/**
 * Text as it should sound: formatting marks dropped, simple maths said in words,
 * blanks said as "blank".
 */
export function speakable(value) {
  return String(value ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, ' $1 over $2 ')
    .replace(/\\sqrt\{([^{}]+)\}/g, ' the square root of $1 ')
    .replace(/\\(times|cdot)/g, ' times ').replace(/\\div/g, ' divided by ').replace(/\\pm/g, ' plus or minus ')
    .replace(/\\(leq?|le)\b/g, ' less than or equal to ').replace(/\\(geq?|ge)\b/g, ' greater than or equal to ').replace(/\\neq?\b/g, ' not equal to ')
    .replace(/\\pi\b/g, ' pi ').replace(/\\theta\b/g, ' theta ').replace(/\\degree|\^\{?\\circ\}?|°/g, ' degrees ')
    .replace(/\^\{?2\}?(?!\d)/g, ' squared ').replace(/\^\{?3\}?(?!\d)/g, ' cubed ').replace(/\^\{([^{}]+)\}|\^(\w+)/g, ' to the power $1$2 ')
    .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}$]/g, ' ')
    .replace(/_{3,}|\.{4,}|…{2,}/g, ' blank ')
    .replace(/[*_#>`~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What a quiz question sounds like: the passage when asked for, the question, then each
 * option as "Option A: …". `option` on each piece says which option it is (-1 for none),
 * so the option being read can be shown.
 */
export function questionSpeech(question, { withPassage = false } = {}) {
  if (!question) return [];
  const out = [];
  const add = (text, option = -1) => splitForSpeech(speakable(text)).forEach(piece => out.push({ text: piece, option }));
  if (withPassage && question.passage) add(question.passage);
  add(question.prompt);
  const options = question.options || [];
  if (question.type === 'truefalse') add('True or false?');
  else if (options.length) options.forEach((option, index) => add(`Option ${'ABCDEFGH'[index]}: ${option}`, index));
  else if (question.type === 'crossmatching' && question.pairs?.length) {
    add(`Match each of these: ${question.pairs.map(pair => pair.left).join('; ')}.`);
    add(`With one of these: ${[...question.pairs.map(pair => pair.right)].sort().join('; ')}.`);
  } else if (question.type === 'fillgaps') add('Fill in the blank.');
  return out;
}

/** Where reading stops by itself: practice, assignments and exams need the student's full attention. */
export function isQuietPlace(pathname = '', search = '') {
  return /\/(practice|practice-arena|assignments?|exams?|exam-readiness|cbt|mock)(\/|$)/i.test(pathname)
    || /[?&](tab|view)=(assignments?|quiz|quizzes|exams?|practice)(&|$)/i.test(search);
}

/**
 * Listen controls for some text: `targetRef` (the element holding it — highlighted and
 * followed while reading), or `getText` / `text`. `sourceId` names it, so coming back to
 * the same note picks up the highlight where the reading is.
 */
export default function ReadAloud({ text, getText, targetRef, label = 'Listen', title = '', sourceId = '' }) {
  const synth = speech();
  const now = useReadAloudPlayer();
  const [voices, setVoices] = useState(settings.voices);
  const [voiceName, setVoiceName] = useState(settings.voiceName);
  const [rate, setRate] = useState(settings.rate);
  const [following, setFollowing] = useState(true);
  const source = sourceId || title || label;
  const mine = now.status !== 'idle' && now.source === source;
  const map = useRef(null);
  const spans = useRef([]);
  const followRef = useRef(true);
  const programmaticScroll = useRef(0);

  // This note's control is on screen: the floating player steps aside for it.
  useEffect(() => {
    onScreen.set(source, (onScreen.get(source) || 0) + 1);
    emit({});
    return () => {
      const left = (onScreen.get(source) || 1) - 1;
      if (left) onScreen.set(source, left); else onScreen.delete(source);
      emit({});
    };
  }, [source]);

  useEffect(() => {
    if (!synth) return undefined;
    const load = () => { const list = usableVoices(synth.getVoices(), navigator.onLine !== false); settings.voices = list; setVoices(list); };
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

  // The highlight colour, once per page.
  useEffect(() => {
    if (!canHighlight() || document.getElementById('ndovera-read-aloud-style')) return;
    const style = document.createElement('style');
    style.id = 'ndovera-read-aloud-style';
    style.textContent = `::highlight(${HIGHLIGHT}) { background-color: rgba(253, 224, 71, 0.65); color: inherit; }`;
    document.head.appendChild(style);
  }, []);

  /** Highlight piece `at` (−1 clears) and, while following, bring it to the middle of the screen. */
  const showPiece = useCallback((at) => {
    if (at < 0) { if (canHighlight()) window.CSS.highlights.delete(HIGHLIGHT); return; }
    const span = spans.current[at];
    if (!span || !map.current) return;
    const start = map.current.at(span[0]);
    const end = map.current.at(span[1] - 1);
    if (!start || !end || !start[0].isConnected) return;
    const range = document.createRange();
    try {
      range.setStart(start[0], start[1]);
      range.setEnd(end[0], Math.min((end[0].nodeValue || '').length, end[1] + 1));
    } catch { return; }
    if (canHighlight()) window.CSS.highlights.set(HIGHLIGHT, new window.Highlight(range));
    if (!followRef.current) return;
    const box = range.getBoundingClientRect();
    const viewport = window.innerHeight || 0;
    if (box.height && (box.top < viewport * 0.25 || box.bottom > viewport * 0.75)) {
      programmaticScroll.current = Date.now();
      window.scrollBy({ top: box.top - viewport / 2 + box.height / 2, behavior: 'smooth' });
    }
  }, []);

  /** Map this note's text to the page (for highlighting and tapping). */
  const mapPage = useCallback(() => {
    const element = targetRef?.current;
    if (!element) { map.current = null; spans.current = []; return null; }
    map.current = textMap(element);
    const chunks = splitForSpeech(map.current.text);
    spans.current = locatePieces(map.current.text, chunks);
    return chunks;
  }, [targetRef]);

  // While this note is on screen and being read: highlight it. Leaving the page keeps the
  // reading going (the floating player takes over); only the highlight stops.
  useEffect(() => {
    if (!mine || !targetRef) return undefined;
    if (!map.current) mapPage();
    onPiece = showPiece;
    showPiece(player.at);
    return () => { if (onPiece === showPiece) onPiece = null; if (canHighlight()) window.CSS.highlights.delete(HIGHLIGHT); };
  }, [mine, targetRef, mapPage, showPiece]);

  // While reading: the reader scrolling away stops the following; tapping a sentence reads from there.
  useEffect(() => {
    if (!mine) return undefined;
    const stopFollowing = () => {
      if (Date.now() - programmaticScroll.current < 900) return;
      followRef.current = false;
      setFollowing(false);
    };
    const onKey = event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key) && event.target === document.body) stopFollowing(); };
    const target = targetRef?.current;
    const onTap = event => {
      if (!map.current || event.target.closest?.('a,button,input,select,textarea,summary')) return;
      const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
      const range = caret ? null : document.caretRangeFromPoint?.(event.clientX, event.clientY);
      const node = caret ? caret.offsetNode : range?.startContainer;
      const offset = caret ? caret.offset : range?.startOffset;
      if (!node || node.nodeType !== 3) return;
      let index = -1;
      for (let i = 0; i < map.current.length; i += 1) {
        const point = map.current.at(i);
        if (point[0] === node && point[1] >= offset) { index = i; break; }
      }
      if (index < 0) return;
      const piece = spans.current.findIndex(span => span && span[0] <= index && index < span[1]);
      if (piece < 0) return;
      followRef.current = true;
      setFollowing(true);
      readAloud.jump(piece);
    };
    window.addEventListener('wheel', stopFollowing, { passive: true });
    window.addEventListener('touchmove', stopFollowing, { passive: true });
    window.addEventListener('keydown', onKey);
    target?.addEventListener('click', onTap);
    return () => {
      window.removeEventListener('wheel', stopFollowing);
      window.removeEventListener('touchmove', stopFollowing);
      window.removeEventListener('keydown', onKey);
      target?.removeEventListener('click', onTap);
    };
  }, [mine, targetRef]);

  if (!synth) return <p className="text-xs text-slate-500">Reading aloud is not available in this browser.</p>;

  const play = () => {
    if (mine && now.status === 'paused') { readAloud.resume(); return; }
    const chunks = targetRef?.current ? mapPage() : splitForSpeech(getText ? getText() : text);
    if (!chunks?.length) return;
    followRef.current = true;
    setFollowing(true);
    readAloud.start({ chunks, title: title || label, source, href: `${window.location.pathname}${window.location.search}` });
  };
  const backToReading = () => { followRef.current = true; setFollowing(true); showPiece(player.at); };
  const BTN = 'rounded-xl px-3 py-1.5 text-sm font-bold';
  const defaultVoice = pickDefaultVoice(voices);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/5" role="group" aria-label="Read aloud">
        {mine && now.status === 'playing'
          ? <button type="button" className={`${BTN} bg-indigo-600 text-white`} onClick={() => readAloud.pause()}>⏸ Pause</button>
          : <button type="button" className={`${BTN} bg-indigo-600 text-white`} onClick={play}>{mine && now.status === 'paused' ? '▶ Resume' : `🔊 ${label}`}</button>}
        {mine && <button type="button" className={`${BTN} border border-indigo-200 bg-white text-indigo-700 dark:border-white/20 dark:bg-transparent dark:text-indigo-200`} onClick={() => readAloud.stop()}>⏹ Stop</button>}
        <select aria-label="Reading speed" className="rounded-xl border border-indigo-200 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100" value={rate}
          onChange={event => { const value = Number(event.target.value); setRate(value); readAloud.set({ rate: value }); }}>
          {RATES.map(value => <option key={value} value={value}>{value}×</option>)}
        </select>
        {voices.length > 1 && (
          <select aria-label="Voice" className="max-w-[12rem] rounded-xl border border-indigo-200 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100" value={voiceName}
            onChange={event => { setVoiceName(event.target.value); readAloud.set({ voiceName: event.target.value }); }}>
            <option value="">{defaultVoice ? `Default — ${defaultVoice.name}` : 'Default voice'}</option>
            {voices.map(voice => <option key={voice.name} value={voice.name}>{voice.name}{voice.localService ? '' : ' (online)'}</option>)}
          </select>
        )}
        {mine && now.of > 0 && <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{now.at + 1} / {now.of}</span>}
        {mine && !following && targetRef ? <button type="button" className={`${BTN} border border-amber-300 bg-amber-50 text-amber-900`} onClick={backToReading}>↧ Back to reading</button> : null}
      </div>
      {/* Where the page cannot be highlighted (older browsers), the sentence being read shows here. */}
      {mine && now.current && (!targetRef || !canHighlight()) ? (
        <p aria-live="off" className="sticky top-16 z-10 rounded-2xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 shadow dark:bg-amber-400/20 dark:text-amber-50">{now.current}</p>
      ) : null}
      {mine && targetRef ? <p className="text-xs text-slate-500 dark:text-slate-400">Tap any sentence to read from there. Reading carries on if you open another page (not Practice, Assignments or Exams).</p> : null}
    </div>
  );
}

/**
 * The floating player, mounted once in the app: shows while reading carries on away from
 * the note, and stops the reading when the student opens Practice, Assignments or Exams.
 */
export function ReadAloudPlayer({ pathname = '', search = '', onOpen }) {
  const now = useReadAloudPlayer();
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (now.status !== 'idle' && !now.inPlace && isQuietPlace(pathname, search)) {
      readAloud.stop();
      setNotice('Reading stopped — Practice, Assignments and Exams need your full attention.');
    }
  }, [pathname, search, now.status]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const onSourcePage = onScreen.has(now.source);
  if (notice) {
    return <div role="status" className="fixed inset-x-3 bottom-20 z-[150] mx-auto max-w-md rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl">{notice}</div>;
  }
  if (now.status === 'idle' || onSourcePage || now.inPlace) return null;
  const BTN = 'rounded-xl px-3 py-1.5 text-xs font-bold';
  return (
    <div role="region" aria-label="Reading aloud" className="fixed inset-x-3 bottom-20 z-[150] mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-indigo-700 px-3 py-2 text-white shadow-2xl">
      <span className="text-lg" aria-hidden="true">🔊</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{now.title}</span>
        <span className="block text-[11px] text-white/80">{now.at + 1} of {now.of}</span>
      </span>
      {now.status === 'playing'
        ? <button type="button" className={`${BTN} bg-white/20`} onClick={() => readAloud.pause()} aria-label="Pause reading">⏸</button>
        : <button type="button" className={`${BTN} bg-white/20`} onClick={() => readAloud.resume()} aria-label="Resume reading">▶</button>}
      {now.href && onOpen ? <button type="button" className={`${BTN} bg-white text-indigo-700`} onClick={() => onOpen(now.href)}>Open</button> : null}
      <button type="button" className={`${BTN} bg-white/20`} onClick={() => readAloud.stop()} aria-label="Stop reading">⏹</button>
    </div>
  );
}
