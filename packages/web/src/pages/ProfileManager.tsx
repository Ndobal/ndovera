import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Save, ShieldCheck, Upload, UserRound } from 'lucide-react';
import { fetchWithAuth } from '../services/apiClient';
import { saveUser } from '../services/authLocal';

type ProfilePayload = {
	profile?: any;
	user?: any;
	template?: any;
};

const inputClass = 'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500';
const textAreaClass = `${inputClass} min-h-[110px]`;

export const ProfileManagerView = () => {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [uploadingAvatar, setUploadingAvatar] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [template, setTemplate] = useState<any>(null);
	const [ndoveraId, setNdoveraId] = useState('');
	const [schoolId, setSchoolId] = useState('');
	const [form, setForm] = useState<any>({
		avatarUrl: '',
		statusText: '',
		statusAvailability: 'available',
		ndoveraEmail: '',
		alternateEmail: '',
		phone: '',
		gender: '',
		dateOfBirth: '',
		address: '',
		city: '',
		state: '',
		country: '',
		nationality: '',
		bio: '',
		emergencyContactName: '',
		emergencyContactPhone: '',
		occupation: '',
		department: '',
		employeeId: '',
		admissionNumber: '',
		className: '',
		guardianName: '',
		guardianPhone: '',
		skills: '',
	});

	const loadProfile = async () => {
		setLoading(true);
		try {
			const payload = await fetchWithAuth('/api/users/me/profile') as ProfilePayload;
			setTemplate(payload.template || null);
			setNdoveraId(payload.user?.ndoveraId || '');
			setSchoolId(payload.user?.schoolId || '');
			setForm({
				avatarUrl: payload.profile?.avatarUrl || payload.user?.avatarUrl || '',
				statusText: payload.profile?.statusText || payload.user?.statusText || '',
				statusAvailability: payload.profile?.statusAvailability || payload.user?.statusAvailability || 'available',
				ndoveraEmail: payload.profile?.ndoveraEmail || payload.user?.email || '',
				alternateEmail: payload.profile?.alternateEmail || payload.user?.alternateEmail || '',
				phone: payload.profile?.phone || payload.user?.phone || '',
				gender: payload.profile?.gender || '',
				dateOfBirth: payload.profile?.dateOfBirth || '',
				address: payload.profile?.address || '',
				city: payload.profile?.city || '',
				state: payload.profile?.state || '',
				country: payload.profile?.country || '',
				nationality: payload.profile?.nationality || '',
				bio: payload.profile?.bio || '',
				emergencyContactName: payload.profile?.emergencyContactName || '',
				emergencyContactPhone: payload.profile?.emergencyContactPhone || '',
				occupation: payload.profile?.occupation || '',
				department: payload.profile?.department || '',
				employeeId: payload.profile?.employeeId || '',
				admissionNumber: payload.profile?.admissionNumber || '',
				className: payload.profile?.className || '',
				guardianName: payload.profile?.guardianName || '',
				guardianPhone: payload.profile?.guardianPhone || '',
				skills: Array.isArray(payload.profile?.skills) ? payload.profile.skills.join(', ') : '',
			});
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'Unable to load your profile.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadProfile();
	}, []);

	const recommendedFields = useMemo(() => {
		const recommendedKey = template?.recommended;
		return Array.isArray(template?.[recommendedKey]) ? template[recommendedKey] : [];
	}, [template]);

	const availabilityLabel = useMemo(() => {
		switch (form.statusAvailability) {
			case 'busy':
				return 'Busy';
			case 'away':
				return 'Away';
			case 'offline':
				return 'Offline';
			default:
				return 'Available';
		}
	}, [form.statusAvailability]);

	const refreshStoredUser = async () => {
		const user = await fetchWithAuth('/api/users/me');
		saveUser(user as any);
	};

	const copyNdoveraId = async () => {
		if (!ndoveraId) return;
		try {
			await navigator.clipboard.writeText(ndoveraId);
			setStatus('NDOvera ID copied.');
		} catch {
			setStatus('Unable to copy the NDOvera ID on this device.');
		}
	};

	const saveProfile = async () => {
		setSaving(true);
		setStatus(null);
		try {
			await fetchWithAuth('/api/users/me/profile', {
				method: 'PUT',
				body: JSON.stringify({
					...form,
					skills: String(form.skills || '').split(',').map((item) => item.trim()).filter(Boolean),
					preferences: { googleSigninEnabled: Boolean(form.alternateEmail) },
				}),
			});
			await refreshStoredUser();
			setStatus('Profile saved successfully.');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'Unable to save your profile.');
		} finally {
			setSaving(false);
		}
	};

	const uploadAvatar = async (file: File | null) => {
		if (!file || !schoolId) return;
		setUploadingAvatar(true);
		setStatus(null);
		try {
			const formData = new FormData();
			formData.append('avatar', file);
			formData.append('school_id', schoolId);
			const upload = await fetchWithAuth('/api/uploads/user-avatar', { method: 'POST', body: formData }) as { url: string };
			await fetchWithAuth('/api/users/me/profile', {
				method: 'PUT',
				body: JSON.stringify({ avatarUrl: upload.url }),
			});
			setForm((current: any) => ({ ...current, avatarUrl: upload.url }));
			await refreshStoredUser();
			setStatus('Profile picture uploaded successfully.');
		} catch (error) {
			setStatus(error instanceof Error ? error.message : 'Unable to upload your profile picture.');
		} finally {
			setUploadingAvatar(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-bold text-white">Profile Manager</h2>
					<p className="text-xs text-zinc-400">Upload a profile picture, publish a visible status, and keep your school identity data current.</p>
				</div>
				<button onClick={saveProfile} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
					<Save size={16} /> {saving ? 'Saving…' : 'Save profile'}
				</button>
			</div>

			{status ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">{status}</div> : null}

			<div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
				<div className="rounded-3xl border border-white/10 bg-[#151619] p-6">
					{loading ? <div className="text-sm text-zinc-400">Loading profile…</div> : (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="md:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-5">
								<div className="flex flex-col gap-5 md:flex-row md:items-center">
									<div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-emerald-500/10 text-2xl font-bold text-emerald-100">
										{form.avatarUrl ? <img src={form.avatarUrl} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : String(form.ndoveraEmail || 'NU').slice(0, 2).toUpperCase()}
									</div>
									<div className="flex-1 space-y-3">
										<div>
											<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">NDOvera ID</p>
											<div className="mt-1 flex items-center gap-2">
												<p className="text-sm text-zinc-200">{ndoveraId || 'Will appear after your session refreshes.'}</p>
												<button type="button" onClick={() => void copyNdoveraId()} disabled={!ndoveraId} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 disabled:opacity-50">
													<Copy size={12} /> Copy
												</button>
											</div>
										</div>
										<label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">
											<Upload size={16} /> {uploadingAvatar ? 'Uploading…' : 'Upload profile picture'}
											<input type="file" accept="image/*" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0] || null)} />
										</label>
									</div>
								</div>
							</div>
							<label className="md:col-span-2">
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Status update visible to contacts</span>
								<textarea className={textAreaClass} value={form.statusText} onChange={(event) => setForm((current: any) => ({ ...current, statusText: event.target.value }))} placeholder="Available for admissions questions until 4pm." />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Status availability</span>
								<select className={inputClass} value={form.statusAvailability} onChange={(event) => setForm((current: any) => ({ ...current, statusAvailability: event.target.value }))}>
									<option value="available">Available</option>
									<option value="busy">Busy</option>
									<option value="away">Away</option>
									<option value="offline">Offline</option>
								</select>
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Ndovera sign-in email</span>
								<input className={inputClass} value={form.ndoveraEmail} onChange={(event) => setForm((current: any) => ({ ...current, ndoveraEmail: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Alternate / Google email</span>
								<input className={inputClass} value={form.alternateEmail} onChange={(event) => setForm((current: any) => ({ ...current, alternateEmail: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Phone number</span>
								<input className={inputClass} value={form.phone} onChange={(event) => setForm((current: any) => ({ ...current, phone: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Gender</span>
								<input className={inputClass} value={form.gender} onChange={(event) => setForm((current: any) => ({ ...current, gender: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Date of birth</span>
								<input type="date" className={inputClass} value={form.dateOfBirth} onChange={(event) => setForm((current: any) => ({ ...current, dateOfBirth: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Nationality</span>
								<input className={inputClass} value={form.nationality} onChange={(event) => setForm((current: any) => ({ ...current, nationality: event.target.value }))} />
							</label>
							<label className="md:col-span-2">
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Address</span>
								<input className={inputClass} value={form.address} onChange={(event) => setForm((current: any) => ({ ...current, address: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">City</span>
								<input className={inputClass} value={form.city} onChange={(event) => setForm((current: any) => ({ ...current, city: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">State</span>
								<input className={inputClass} value={form.state} onChange={(event) => setForm((current: any) => ({ ...current, state: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Country</span>
								<input className={inputClass} value={form.country} onChange={(event) => setForm((current: any) => ({ ...current, country: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Occupation / role detail</span>
								<input className={inputClass} value={form.occupation} onChange={(event) => setForm((current: any) => ({ ...current, occupation: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Department</span>
								<input className={inputClass} value={form.department} onChange={(event) => setForm((current: any) => ({ ...current, department: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Employee ID</span>
								<input className={inputClass} value={form.employeeId} onChange={(event) => setForm((current: any) => ({ ...current, employeeId: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Admission number</span>
								<input className={inputClass} value={form.admissionNumber} onChange={(event) => setForm((current: any) => ({ ...current, admissionNumber: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Class name</span>
								<input className={inputClass} value={form.className} onChange={(event) => setForm((current: any) => ({ ...current, className: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Guardian name</span>
								<input className={inputClass} value={form.guardianName} onChange={(event) => setForm((current: any) => ({ ...current, guardianName: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Guardian phone</span>
								<input className={inputClass} value={form.guardianPhone} onChange={(event) => setForm((current: any) => ({ ...current, guardianPhone: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Emergency contact name</span>
								<input className={inputClass} value={form.emergencyContactName} onChange={(event) => setForm((current: any) => ({ ...current, emergencyContactName: event.target.value }))} />
							</label>
							<label>
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Emergency contact phone</span>
								<input className={inputClass} value={form.emergencyContactPhone} onChange={(event) => setForm((current: any) => ({ ...current, emergencyContactPhone: event.target.value }))} />
							</label>
							<label className="md:col-span-2">
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Professional skills / tags</span>
								<input className={inputClass} value={form.skills} onChange={(event) => setForm((current: any) => ({ ...current, skills: event.target.value }))} placeholder="Mathematics, counselling, spreadsheet analysis" />
							</label>
							<label className="md:col-span-2">
								<span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Biography / useful notes</span>
								<textarea className={textAreaClass} value={form.bio} onChange={(event) => setForm((current: any) => ({ ...current, bio: event.target.value }))} />
							</label>
						</div>
					)}
				</div>

				<div className="space-y-6">
					<div className="rounded-3xl border border-white/10 bg-[#151619] p-6">
						<div className="flex items-center gap-3 text-white">
							<UserRound size={18} />
							<h3 className="text-sm font-bold uppercase tracking-[0.18em]">Profile preview</h3>
						</div>
						<div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
							<div className="flex items-start gap-4">
								<div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-emerald-500/10 text-lg font-bold text-emerald-100">
									{form.avatarUrl ? <img src={form.avatarUrl} alt="Profile preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : String(ndoveraId || 'NU').slice(0, 2).toUpperCase()}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="text-sm font-semibold text-white">{ndoveraId || 'NDOvera user'}</p>
										<span className={`h-2.5 w-2.5 rounded-full ${form.statusAvailability === 'busy' ? 'bg-rose-400' : form.statusAvailability === 'away' ? 'bg-amber-400' : form.statusAvailability === 'offline' ? 'bg-slate-500' : 'bg-emerald-400'}`} />
									</div>
									<p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{availabilityLabel}</p>
									<p className="mt-3 text-sm leading-6 text-zinc-300">{form.statusText || 'No status update yet. Add one so your contacts can see what you are available for.'}</p>
								</div>
							</div>
						</div>
					</div>

					<div className="rounded-3xl border border-white/10 bg-[#151619] p-6">
						<div className="flex items-center gap-3 text-white">
							<UserRound size={18} />
							<h3 className="text-sm font-bold uppercase tracking-[0.18em]">Recommended capture fields</h3>
						</div>
						<div className="mt-4 space-y-2 text-sm text-zinc-300">
							{recommendedFields.map((field: string) => (
								<div key={field} className="rounded-2xl bg-white/5 px-3 py-2">{field}</div>
							))}
						</div>
					</div>

					<div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-sm text-emerald-100">
						<div className="flex items-center gap-3 font-bold uppercase tracking-[0.18em]">
							<ShieldCheck size={18} /> Identity policy
						</div>
						<ul className="mt-4 space-y-2 leading-6 text-emerald-50/90">
							<li>• Your profile picture and status update appear in NDOvera chat contacts.</li>
							<li>• Keep the `Ndovera email` as the secure sign-in identity.</li>
							<li>• Use the alternate email for outbound mail delivery and future Google sign-in.</li>
							<li>• Capture emergency contacts for every staff, student, and parent profile.</li>
							<li>• Record department, class, guardian, and skill data for school operations.</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ProfileManagerView;