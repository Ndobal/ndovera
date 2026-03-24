import { AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type BillingLockBannerProps = {
  invoiceId?: string | null;
  onDismiss?: () => void;
  dismissible?: boolean;
  compact?: boolean;
};

export function BillingLockBanner({ invoiceId, onDismiss, dismissible = true, compact = false }: BillingLockBannerProps) {
  const navigate = useNavigate();

  return (
    <div className={`rounded-3xl border border-red-400/20 bg-red-500/10 ${compact ? 'p-4' : 'p-5'} text-red-50`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/15 text-red-200">
            <AlertCircle size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-red-100">Payment Required</h3>
            <p className="mt-2 text-sm text-red-100/85">Your school’s term fee is overdue. Some features are limited until payment is made.</p>
            {invoiceId ? <p className="mt-2 text-[11px] font-mono uppercase tracking-[0.18em] text-red-100/60">Invoice {invoiceId}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => navigate('/finance')} className="rounded-2xl bg-red-500 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-red-400">
                Pay Now
              </button>
              <button onClick={() => navigate('/marketplace')} className="rounded-2xl border border-red-200/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-red-50 transition hover:bg-white/10">
                Open Marketplace
              </button>
            </div>
          </div>
        </div>
        {dismissible && onDismiss ? (
          <button onClick={onDismiss} className="rounded-full p-2 text-red-100/60 transition hover:bg-white/5 hover:text-red-50" aria-label="Close payment notice">
            <X size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
