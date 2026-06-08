import React, { useEffect, useRef, useState } from 'react';

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

export default function Flipbook({ url, onFallback }) {
  const containerRef = useRef(null);
  const flipRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let flip = null;

    async function build() {
      try {
        setStatus('loading');
        setProgress({ done: 0, total: 0 });
        loadCss(PAGEFLIP_CSS);
        await Promise.all([loadScript(PDFJS_SRC), loadScript(PAGEFLIP_JS)]);
        if (cancelled) return;

        const pdfjsLib = window.pdfjsLib;
        const PageFlipCtor = window.St?.PageFlip || window.PageFlip;
        if (!pdfjsLib || !PageFlipCtor) throw new Error('Flipbook engine unavailable');
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

        const pdf = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;
        const total = Math.min(pdf.numPages, MAX_PAGES);
        setProgress({ done: 0, total });

        const images = [];
        let ratio = 1 / Math.SQRT2; // A4 portrait width/height fallback
        for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
          if (cancelled) return;
          // eslint-disable-next-line no-await-in-loop
          const pdfPage = await pdf.getPage(pageNumber);
          const viewport = pdfPage.getViewport({ scale: 1.5 });
          if (pageNumber === 1 && viewport.height > 0) ratio = viewport.width / viewport.height;
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          // eslint-disable-next-line no-await-in-loop
          await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.82));
          setProgress({ done: pageNumber, total });
        }
        if (cancelled || !containerRef.current) return;

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
          showCover: false,
          maxShadowOpacity: 0.5,
          mobileScrollSupport: true,
        });
        flip.loadFromImages(images);
        flip.on('flip', event => setPage(Number(event.data) || 0));
        flipRef.current = flip;
        setPageCount(images.length);
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

  if (status === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[#191970]">
        <p>Could not open this file as a flipbook.</p>
        <button type="button" onClick={onFallback} className="rounded-xl bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#f5deb3]">Open standard reader</button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#e9dcc0] text-sm text-[#191970]">
          <p className="font-semibold">Preparing flipbook…</p>
          {progress.total > 0 ? <p className="text-xs">{progress.done} / {progress.total} pages</p> : <p className="text-xs">Loading reader…</p>}
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {status === 'ready' && (
        <div className="flex items-center justify-center gap-3 border-t border-[#c9a96e]/30 bg-[#f5deb3] px-4 py-2">
          <button type="button" onClick={() => flipRef.current?.flipPrev?.()} className="rounded-xl border border-[#c9a96e]/40 bg-white/80 px-4 py-1.5 text-xs font-bold text-[#800020] transition hover:bg-white">‹ Prev</button>
          <span className="text-xs font-semibold text-[#191970]">Page {Math.min(page + 1, pageCount)} / {pageCount}</span>
          <button type="button" onClick={() => flipRef.current?.flipNext?.()} className="rounded-xl border border-[#c9a96e]/40 bg-white/80 px-4 py-1.5 text-xs font-bold text-[#800020] transition hover:bg-white">Next ›</button>
        </div>
      )}
    </div>
  );
}
