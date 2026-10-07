import React, { useEffect, useState } from 'react';
import { getTenantPwaInfo } from '../hooks/useTenantPwaManifest';
import './Loader.css';

// Layers cut from the real logo (ndovera_app/tool/split_logo.py). They share one
// canvas, so once every piece lands the assembled logo is the logo exactly.
const LAYER_DIR = `${process.env.PUBLIC_URL || ''}/branding/ndovera`;

// Where each piece starts (as a fraction of the logo's size), its starting turn
// and when it sets off. The shield arrives as two halves.
const NDOVERA_PIECES = [
  { src: `${LAYER_DIR}/shield.png`, x: -1.3, y: -1.1, turn: -32, delay: 0, half: 'left' },
  { src: `${LAYER_DIR}/shield.png`, x: 1.3, y: -1.1, turn: 32, delay: 100, half: 'right' },
  { src: `${LAYER_DIR}/letter_n.png`, x: -1.6, y: 0.05, turn: -20, delay: 250 },
  { src: `${LAYER_DIR}/gold_curve.png`, x: 1.6, y: 0.05, turn: 23, delay: 400 },
  { src: `${LAYER_DIR}/torch.png`, x: 0, y: -1.5, turn: 9, delay: 550 },
  { src: `${LAYER_DIR}/graduation_cap.png`, x: 1.2, y: -1.2, turn: 52, delay: 700 },
  { src: `${LAYER_DIR}/swoosh.png`, x: 0, y: 1.4, turn: -12, delay: 800 },
];

// Longest the loader waits for its images before animating anyway.
const IMAGE_WAIT_MS = 600;

/**
 * The app's loading screen. On a school's own install it shows that school's
 * logo and name; everywhere else the Ndovera logo assembles from its pieces.
 * Either way the logo then turns and settles with a soft glow, looping until
 * the app is ready.
 */
const Loader = () => {
  const [school] = useState(() => {
    const info = getTenantPwaInfo();
    return info?.logoUrl ? { logoUrl: String(info.logoUrl), name: String(info.schoolName || '').trim() } : null;
  });
  // A school's logo rises into place as one piece; Ndovera's assembles.
  const pieces = school
    ? [{ src: school.logoUrl, x: 0, y: 0.35, turn: -8, delay: 0, solo: true }]
    : NDOVERA_PIECES;

  // Wait for the images so no piece pops in late, but never for long.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const done = () => { if (!cancelled) setReady(true); };
    const timer = setTimeout(done, IMAGE_WAIT_MS);
    const sources = Array.from(new Set(pieces.map(piece => piece.src)));
    Promise.all(sources.map(src => new Promise(resolve => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = src;
    }))).then(done);
    return () => { cancelled = true; clearTimeout(timer); };
    // The pieces are fixed for the life of the loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = school?.name || 'Ndovera';

  return (
    <div className={`ndv-loader${ready ? ' is-ready' : ''}${school ? ' ndv-loader-school' : ''}`} role="status" aria-live="polite">
      <span className="ndv-loader-sr">{`Loading ${label}…`}</span>
      <div className="ndv-loader-stage" aria-hidden="true">
        <div className="ndv-loader-glow" />
        <div className="ndv-loader-logo">
          {pieces.map((piece, index) => (
            <img
              key={index}
              src={piece.src}
              alt=""
              draggable="false"
              className={`ndv-loader-piece${piece.half ? ` ndv-loader-half-${piece.half}` : ''}`}
              style={{
                '--ndv-x': piece.x,
                '--ndv-y': piece.y,
                '--ndv-turn': `${piece.turn}deg`,
                animationDelay: `${piece.delay}ms`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="ndv-loader-words" aria-hidden="true">
        {school ? (
          <>
            {school.name && <p className="ndv-loader-name ndv-loader-name-school">{school.name}</p>}
            <p className="ndv-loader-tagline">Powered by NDOVERA</p>
          </>
        ) : (
          <>
            <p className="ndv-loader-name">NDOVERA</p>
            <p className="ndv-loader-tagline">Learn • Grow • Excel</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Loader;
