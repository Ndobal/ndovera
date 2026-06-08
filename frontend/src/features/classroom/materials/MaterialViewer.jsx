import React, { useEffect, useState } from 'react';

// In-app reader for class materials. PDFs, images, video, audio and Office files open and are
// readable inside the app (no forced download), with an explicit Download button as well.

function getMaterialKind(material) {
  const url = String(material?.url || '').trim();
  const type = String(material?.type || '').toLowerCase();
  const source = `${url} ${material?.fileName || ''} ${material?.title || ''}`.toLowerCase();
  if (!url) return 'note';
  if (type === 'video' || /\.(mp4|webm|ogv|mov|m4v)(\?|$)/.test(source)) return 'video';
  if (type === 'audio' || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/.test(source)) return 'audio';
  if (type === 'image' || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(source)) return 'image';
  if (type === 'pdf' || /\.pdf(\?|$)/.test(source)) return 'pdf';
  if (/\.(docx?|pptx?|xlsx?|csv|txt)(\?|$)/.test(source)) return 'office';
  if (type === 'link') return 'link';
  return 'embed';
}

const TOOLBAR_BTN = 'rounded-xl border border-[#c9a96e]/40 bg-white/80 px-3 py-1.5 text-xs font-bold text-[#800020] transition hover:bg-white disabled:opacity-50';

export default function MaterialViewer({ material, onClose }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  // Reset zoom whenever a different material is opened.
  useEffect(() => { setScale(1); }, [material?.id, material?.url]);

  if (!material) return null;

  const url = String(material.url || '').trim();
  const kind = getMaterialKind(material);
  const title = material.title || material.fileName || 'Material';
  const downloadName = material.fileName || `${title}`;
  const officeSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  function renderBody() {
    if (kind === 'note') {
      return (
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-sm leading-7 text-[#191970] whitespace-pre-wrap shadow">
          {material.description || 'No note content was added.'}
        </div>
      );
    }

    if (kind === 'image') {
      return (
        <div className="flex h-full w-full items-start justify-center overflow-auto p-3">
          <img
            src={url}
            alt={title}
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
            className="max-w-full select-none rounded-lg shadow-lg transition-transform"
          />
        </div>
      );
    }

    if (kind === 'video') {
      return (
        <div className="flex h-full w-full items-center justify-center p-3">
          <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg shadow-lg">
            Your browser does not support video playback.
          </video>
        </div>
      );
    }

    if (kind === 'audio') {
      return (
        <div className="flex h-full w-full items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow">
            <p className="mb-3 text-center text-sm font-bold text-[#191970]">{title}</p>
            <audio src={url} controls autoPlay className="w-full">
              Your browser does not support audio playback.
            </audio>
          </div>
        </div>
      );
    }

    if (kind === 'pdf') {
      // The browser's native PDF viewer gives zoom, page navigation, print and download controls.
      return (
        <iframe
          title={title}
          src={`${url}#toolbar=1&navpanes=1&view=FitH`}
          className="h-full w-full border-0 bg-white"
        />
      );
    }

    if (kind === 'office') {
      return (
        <iframe
          title={title}
          src={officeSrc}
          className="h-full w-full border-0 bg-white"
        />
      );
    }

    // Generic webpage / link / unknown file — embed it; some sites block embedding, so offer a fallback.
    return (
      <div className="relative h-full w-full">
        <iframe title={title} src={url} className="h-full w-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-white">
          If nothing loads, this page blocks embedding — use “Open in new tab”.
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#191970]/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#c9a96e]/30 bg-[#f5deb3] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#800000]">{title}</p>
          {material.subjectName ? <p className="truncate text-[11px] font-semibold text-[#800020]">{material.subjectName}</p> : null}
        </div>

        {kind === 'image' ? (
          <div className="flex items-center gap-1">
            <button type="button" className={TOOLBAR_BTN} onClick={() => setScale(value => Math.max(0.25, value - 0.25))} aria-label="Zoom out">−</button>
            <span className="px-1 text-xs font-bold text-[#191970]">{Math.round(scale * 100)}%</span>
            <button type="button" className={TOOLBAR_BTN} onClick={() => setScale(value => Math.min(4, value + 0.25))} aria-label="Zoom in">+</button>
            <button type="button" className={TOOLBAR_BTN} onClick={() => setScale(1)}>Fit</button>
          </div>
        ) : null}

        {url ? (
          <>
            <a href={url} target="_blank" rel="noopener noreferrer" className={TOOLBAR_BTN}>Open in new tab</a>
            <a
              href={url}
              download={downloadName}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-[#f5deb3] transition hover:bg-[#154a2e]"
            >
              Download
            </a>
          </>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-[#800020] px-3 py-1.5 text-xs font-bold text-[#f5deb3] transition hover:bg-[#5a0016]"
        >
          Close
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden bg-[#e9dcc0]">
        {renderBody()}
      </div>
    </div>
  );
}
