import React from 'react';

const LINE_COUNT = 160;
const REPEATS_PER_LINE = 14;

/**
 * The security background of a result sheet: the school's name written line
 * after line in light grey across the whole page, and above it the school's
 * logo as a faint watermark. It is real text and an image rather than a CSS
 * background, so it survives printing and "Save as PDF". The page's content
 * sits above it (give that content `relative z-10`).
 */
export default function ResultPaperBackdrop({ schoolName = '', logoUrl = '' }) {
  const name = String(schoolName || '').trim().toUpperCase() || 'OFFICIAL RESULT';
  const line = Array.from({ length: REPEATS_PER_LINE }, () => name).join('   ·   ');

  return (
    <div aria-hidden="true" className="result-paper-backdrop pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div className="absolute inset-0">
        {Array.from({ length: LINE_COUNT }, (_, index) => (
          <div
            key={index}
            className="whitespace-nowrap text-[10px] font-semibold leading-[18px] tracking-[0.18em] text-[#e3e5ea]"
            // Every other line is shifted so the names sit like brickwork.
            style={{ marginLeft: index % 2 ? '-6em' : '-1em' }}
          >
            {line}
          </div>
        ))}
      </div>
      {logoUrl ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <img src={logoUrl} alt="" className="w-[70%] max-w-[460px] object-contain opacity-[0.07]" />
        </div>
      ) : null}
    </div>
  );
}
