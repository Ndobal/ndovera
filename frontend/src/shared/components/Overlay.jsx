import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

// A full-screen dialog drawn on <body>, so no animated or blurred panel above it in the page
// can pin it to the top of the page (it always opens on the screen, on phones too). Locks the
// page behind it from scrolling, closes on Escape, and is a bottom sheet on small screens.
export default function Overlay({ onClose, label, children, size = 'max-w-3xl', sheet = true }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = event => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return createPortal(
    <div className={`fixed inset-0 z-[90] flex justify-center bg-slate-950/55 backdrop-blur-[2px] ${sheet ? 'items-end sm:items-center sm:p-4' : 'items-center p-3 sm:p-4'}`} role="dialog" aria-modal="true" aria-label={label} onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className={`flex max-h-[100dvh] w-full ${size} flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 ${sheet ? 'rounded-t-3xl sm:max-h-[92vh] sm:rounded-3xl' : 'max-h-[92vh] rounded-3xl'}`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
