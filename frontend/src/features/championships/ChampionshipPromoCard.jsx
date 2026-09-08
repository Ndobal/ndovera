import React from 'react';
import { Link } from 'react-router-dom';
import { getPromotedChampionship } from './services/championshipApi';

/**
 * The championship promo surface (championship.md §11) built to §12's rules.
 *
 * §12 is a hard engineering requirement, not a preference, so this component is deliberately
 * boring:
 *   - It is an inline, dismissible card in the normal document flow. It is NOT a modal, so it
 *     can never cover navigation, trap focus, or stop a student reaching a lesson.
 *   - The image is lazy-loaded and optional. If it 404s or the network is dead, the image is
 *     dropped and the text card still renders.
 *   - Every failure path — fetch, JSON, storage, render — resolves to rendering nothing.
 *   - Dismissal is persisted per championship, and the card self-expires after a short window,
 *     so it cannot loop or nag.
 *   - Ami can switch it off entirely per championship (promo_enabled), which is the feature flag.
 */

const STORAGE_PREFIX = 'ndovera:champ-promo:';
const DEFAULT_WINDOW_HOURS = 3;

function readState(id) {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    // Private browsing, disabled storage, or corrupt JSON. Treat as "never seen".
    return null;
  }
}

function writeState(id, state) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(state));
  } catch {
    // Storage being unavailable must not stop the card working for this page view.
  }
}

// A render error inside the promo must never take the dashboard down with it.
class PromoBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Intentionally silent: promotional content is decorative.
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function PromoCardInner() {
  const [promo, setPromo] = React.useState(null);
  const [visible, setVisible] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    getPromotedChampionship()
      .then(data => {
        if (cancelled) return;
        const championship = data?.promo?.championship;
        if (!championship?.id || !championship?.slug) return;

        const windowHours = Number(data?.promo?.windowHours) > 0 ? Number(data.promo.windowHours) : DEFAULT_WINDOW_HOURS;
        const state = readState(championship.id);

        if (state?.dismissed) return;

        const firstSeenAt = state?.firstSeenAt || Date.now();
        // The promo lives for a short window from the first time this browser saw it, which is
        // "first login after publishing" in practice, without nagging on every navigation.
        if (Date.now() - firstSeenAt > windowHours * 60 * 60 * 1000) return;

        if (!state?.firstSeenAt) writeState(championship.id, { firstSeenAt });

        setPromo(championship);
        setVisible(true);
      })
      .catch(() => {
        // No promo. The dashboard renders exactly as it would have.
      });

    return () => { cancelled = true; };
  }, []);

  if (!visible || !promo) return null;

  const dismiss = () => {
    setVisible(false);
    writeState(promo.id, { firstSeenAt: Date.now(), dismissed: true });
  };

  const artwork = !imageFailed ? (promo.flyerUrl || promo.coverUrl || '') : '';

  return (
    <section
      aria-label="Championship announcement"
      className="mx-auto mb-4 max-w-6xl overflow-hidden rounded-3xl border border-[#c9a96e]/50 bg-[#191970] text-white shadow-[0_18px_40px_rgba(25,25,112,0.18)]"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        {artwork ? (
          <img
            src={artwork}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-28 w-full shrink-0 rounded-2xl object-cover sm:h-24 sm:w-40"
          />
        ) : (
          <div aria-hidden="true" className="flex h-28 w-full shrink-0 items-center justify-center rounded-2xl bg-white/10 text-4xl sm:h-24 sm:w-40">
            🏆
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#e3c98b]">NDOVERA Championships</p>
          <h2 className="mt-1 break-words text-lg font-black leading-tight text-white sm:text-xl">{promo.name}</h2>
          {promo.summary ? (
            <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-white/80">{promo.summary}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to={`/championships/${promo.slug}`}
            className="rounded-full bg-[#e3c98b] px-5 py-2.5 text-sm font-bold text-[#191970] transition hover:bg-white"
          >
            View championship
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss championship announcement"
            className="rounded-full border border-white/30 px-4 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}

export default function ChampionshipPromoCard() {
  return (
    <PromoBoundary>
      <PromoCardInner />
    </PromoBoundary>
  );
}
