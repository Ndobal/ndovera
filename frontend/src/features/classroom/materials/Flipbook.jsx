import React, { useCallback, useEffect, useRef, useState } from 'react';

// Realistic page-flip reader for PDFs (DearFlip-style). The PDF pages are rendered to images with
// pdf.js and animated with StPageFlip. Both libraries are loaded from a CDN on demand so they never
// bloat the main bundle; if anything fails to load/render, the parent falls back to a plain reader.

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const PAGEFLIP_JS = 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js';
const PAGEFLIP_CSS = 'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/css/page-flip.css';
const MAX_PAGES = 120;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-flip="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') { resolve(); return; }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const element = document.createElement('script');
    element.src = src;
    element.async = true;
    element.dataset.flip = src;
    element.addEventListener('load', () => { element.dataset.loaded = 'true'; resolve(); });
    element.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(element);
  });
}

function loadCss(href) {
  if (document.querySelector(`link[data-flip="${href}"]`)) return;
  const element = document.createElement('link');
  element.rel = 'stylesheet';
  element.href = href;
  element.dataset.flip = href;
  document.head.appendChild(element);
}

const CTRL_BTN = 'flex h-9 w-9 items-center justify-center rounded-full border border-[#c9a96e]/40 bg-white/85 text-sm font-bold text-[#800020] shadow transition hover:bg-white';

export default function Flipbook({ url, onFallback }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const flipRef = useRef(null);
  const thumbStripRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState(0);
  const [showThumbs, setShowThumbs] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let flip = null;

    async function build() {
      try {
        setStatus('loading');
        setProgress({ done: 0, total: 0 });
        setPages([]);
        loadCss(PAGEFLIP_CSS);
        await Promise.all([loadScript(PDFJS_SRC), loadScript(PAGEFLIP_JS)]);
        if (cancelled) return;

        const pdfjsLib = window.pdfjsLib;
        const PageFlipCtor = window.St?.PageFlip || window.PageFlip;
        if (!pdfjsLib || !PageFlipCtor) throw new Error('Flipbook engine unavailable');
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

        // Lower-end phones have far less memory, so render smaller/lighter pages there.
        const isMobile = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 700;
        const renderScale = isMobile ? 1.1 : 1.6;
        const jpegQuality = isMobile ? 0.72 : 0.82;
        const pageCap = isMobile ? 80 : MAX_PAGES;

        const pdf = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;
        const total = Math.min(pdf.numPages, pageCap);
        setProgress({ done: 0, total });

        const images = [];
        let ratio = 1 / Math.SQRT2; // A4 portrait width/height fallback
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          if (cancelled) return;
          // eslint-disable-next-line no-await-in-loop
          const pdfPage = await pdf.getPage(pageNumber);
          const viewport = pdfPage.getViewport({ scale: renderScale });
          if (pageNumber === 1 && viewport.height > 0) ratio = viewport.width / viewport.height;
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          // eslint-disable-next-line no-await-in-loop
          await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          images.push(canvas.toDataURL('image/jpeg', jpegQuality));
          setProgress({ done: pageNumber, total });
        }
        if (cancelled || !containerRef.current) return;
        setPages(images);

        // Let the modal settle so the flip engine measures a real container size.
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (cancelled || !containerRef.current) return;

        const baseWidth = 460;
        const baseHeight = Math.round(baseWidth / (ratio || (1 / Math.SQRT2)));
        flip = new PageFlipCtor(containerRef.current, {
          width: baseWidth,
          height: baseHeight,
          size: 'stretch',
          minWidth: 240,
          maxWidth: 1400,
          minHeight: 340,
          maxHeight: 2000,
          drawShadow: true,
          flippingTime: 700,
          usePortrait: true,
          showCover: true, // first page opens as a single right-hand cover, like a real book
          maxShadowOpacity: 0.5,
          mobileScrollSupport: true,
        });
        flip.loadFromImages(images);
        flip.on('flip', event => setPage(Number(event.data) || 0));
        flipRef.current = flip;
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    build();
    return () => {
      cancelled = true;
      try { flip?.destroy?.(); } catch {}
      flipRef.current = null;
    };
  }, [url]);

  // Track fullscreen state and nudge the flip engine to re-measure when it changes.
  useEffect(() => {
    function onFsChange() {
      const active = document.fullscreenElement === wrapperRef.current;
      setIsFullscreen(Boolean(document.fullscreenElement) && active);
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Keep the active thumbnail in view.
  useEffect(() => {
    if (!showThumbs || !thumbStripRef.current) return;
    const active = thumbStripRef.current.querySelector(`[data-thumb="${page}"]`);
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [page, showThumbs]);

  const toggleFullscreen = useCallback(() => {
    const element = wrapperRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      element.requestFullscreen?.();
    }
  }, []);

  function jumpToPage(index) {
    try { flipRef.current?.flip?.(index); } catch {}
  }

  // Keyboard shortcuts: ← / → flip pages, F toggles fullscreen.
  useEffect(() => {
    if (status !== 'ready') return undefined;
    function onKey(event) {
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target?.isContentEditable) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); flipRef.current?.flipNext?.(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); flipRef.current?.flipPrev?.(); }
      else if (event.key === 'f' || event.key === 'F') { event.preventDefault(); toggleFullscreen(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, toggleFullscreen]);

  if (status === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[#191970]">
        <p>Could not open this file as a flipbook.</p>
        <button type="button" onClick={onFallback} className="rounded-xl bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#b5e3f4]">Open standard reader</button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative flex h-full w-full flex-col bg-[#e9dcc0]">
      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#e9dcc0] text-sm text-[#191970]">
          <p className="font-semibold">Preparing flipbook…</p>
          {progress.total > 0 ? <p className="text-xs">{progress.done} / {progress.total} pages</p> : <p className="text-xs">Loading reader…</p>}
        </div>
      )}

      {/* Floating controls (also available in fullscreen) */}
      {status === 'ready' && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          <button type="button" className={CTRL_BTN} onClick={() => setShowThumbs(value => !value)} title="Toggle page thumbnails" aria-label="Toggle thumbnails">▦</button>
          <button type="button" className={CTRL_BTN} onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} aria-label="Toggle fullscreen">{isFullscreen ? '✕' : '⛶'}</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Thumbnail strip */}
      {status === 'ready' && showThumbs && (
        <div ref={thumbStripRef} className="flex max-h-28 shrink-0 items-center gap-2 overflow-x-auto border-t border-[#c9a96e]/30 bg-[#b5e3f4]/95 px-3 py-2">
          {pages.map((src, index) => (
            <button
              key={index}
              type="button"
              data-thumb={index}
              onClick={() => jumpToPage(index)}
              className={`relative shrink-0 overflow-hidden rounded-md border-2 transition ${index === page ? 'border-[#1a5c38]' : 'border-transparent hover:border-[#c9a96e]'}`}
              title={`Page ${index + 1}`}
            >
              <img src={src} alt={`Page ${index + 1}`} className="h-20 w-auto" loading="lazy" />
              <span className="absolute bottom-0 right-0 bg-black/55 px-1 text-[9px] font-bold text-white">{index + 1}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bottom navigation */}
      {status === 'ready' && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-[#c9a96e]/30 bg-[#b5e3f4] px-4 py-2">
          <button type="button" onClick={() => flipRef.current?.flipPrev?.()} className="rounded-xl border border-[#c9a96e]/40 bg-white/80 px-4 py-1.5 text-xs font-bold text-[#800020] transition hover:bg-white">‹ Prev</button>
          <span className="text-xs font-semibold text-[#191970]">Page {Math.min(page + 1, pages.length)} / {pages.length}</span>
          <button type="button" onClick={() => flipRef.current?.flipNext?.()} className="rounded-xl border border-[#c9a96e]/40 bg-white/80 px-4 py-1.5 text-xs font-bold text-[#800020] transition hover:bg-white">Next ›</button>
          <span className="ml-2 hidden text-[10px] text-[#800020]/70 sm:inline">← → flip · F fullscreen</span>
        </div>
      )}
    </div>
  );
}
