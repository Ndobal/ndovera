import { ArrowRight, LoaderCircle, Search, X } from 'lucide-react';

import type { NdoveraMessagingContact } from '../services/ndoveraMessagingApi';

type MessagingContactLookupProps = {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	loading: boolean;
	message: string | null;
	results: NdoveraMessagingContact[];
	onOpenContact: (contact: NdoveraMessagingContact) => void;
	onClearResults: () => void;
};

function getInitials(name: string) {
	return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'NU';
}

function getAvailabilityTone(availability?: 'available' | 'busy' | 'away' | 'offline') {
	switch (availability) {
		case 'busy':
			return 'bg-rose-400';
		case 'away':
			return 'bg-amber-400';
		case 'offline':
			return 'bg-slate-500';
		default:
			return 'bg-emerald-400';
	}
}

function formatLastSeen(lastSeenAt?: string | null) {
	if (!lastSeenAt) return '';
	const parsed = new Date(lastSeenAt);
	if (Number.isNaN(parsed.getTime())) return '';
	return parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function MessagingContactLookup({ value, onChange, onSubmit, loading, message, results, onOpenContact, onClearResults }: MessagingContactLookupProps) {
	return (
		<div className="mt-3 rounded-2xl border border-white/8 bg-white/4 p-3">
			<p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Find by name, NDOvera ID, or email</p>
			<p className="mt-1 text-xs text-slate-400">Results update automatically as you type.</p>
			<div className="mt-2 flex gap-2">
				<label className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
					<Search className="h-4 w-4 text-slate-500" />
					<input
						value={value}
						onChange={(event) => onChange(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								onSubmit();
							}
						}}
						placeholder="Search by name, NDOvera ID, or email"
						className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
					/>
				</label>
				<button
					type="button"
					onClick={onSubmit}
					disabled={loading || !value.trim()}
					className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Search'}
				</button>
			</div>
			{message ? <p className="mt-2 text-xs text-slate-400">{message}</p> : null}
			{results.length > 0 ? (
				<div className="mt-3 space-y-3">
					{results.map((contact) => (
						<div key={contact.id} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
							<div className="flex items-start gap-3">
								<div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-sm font-bold text-white">
									{contact.avatarUrl ? <img src={contact.avatarUrl} alt={contact.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : getInitials(contact.name)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<div className="truncate text-sm font-semibold text-white">{contact.name}</div>
										<span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAvailabilityTone(contact.statusAvailability)}`} />
									</div>
									<div className="mt-1 text-xs text-slate-300">{contact.role}{contact.contextLabel ? ` • ${contact.contextLabel}` : ''}</div>
									<div className="mt-1 text-[11px] text-slate-400">{contact.isOnline ? 'Online now' : contact.lastSeenAt ? `Last seen ${formatLastSeen(contact.lastSeenAt)}` : 'Offline'}</div>
									{contact.statusText ? <div className="mt-2 text-xs text-emerald-100/90">{contact.statusText}</div> : null}
									<div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
										{contact.identifier ? <span className="rounded-full bg-black/20 px-2.5 py-1">{contact.identifier}</span> : null}
										<span className="rounded-full bg-black/20 px-2.5 py-1">{contact.kind}</span>
									</div>
								</div>
							</div>
							<div className="mt-3 flex gap-2">
								<button type="button" onClick={() => onOpenContact(contact)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
									Open chat <ArrowRight className="h-3.5 w-3.5" />
								</button>
								<button type="button" onClick={onClearResults} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
									<X className="h-3.5 w-3.5" /> Clear
								</button>
							</div>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
