import React, { useEffect, useMemo, useState } from 'react';
import { Save, UserRound, ShieldCheck } from 'lucide-react';
import { fetchWithAuth } from '../services/apiClient';

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
	const [status, setStatus] = useState<string | null>(null);
	const [template, setTemplate] = useState<any>(null);
	const [form, setForm] = useState<any>({
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
			const payload = await fetchWithAuth('/api/profile/me') as ProfilePayload;
			setTemplate(payload.template || null);
			setForm({
				ndoveraEmail: payload.profile?.ndovera_email || payload.user?.email || '',
				alternateEmail: payload.profile?.alternate_email || payload.user?.alternate_email || '',
				phone: payload.profile?.phone || payload.user?.phone || '',
				gender: payload.profile?.gender || '',
				dateOfBirth: payload.profile?.date_of_birth || '',
				address: payload.profile?.address || '',
				city: payload.profile?.city || '',
				state: payload.profile?.state || '',
				country: payload.profile?.country || '',
				nationality: payload.profile?.nationality || '',
				bio: payload.profile?.bio || '',
				emergencyContactName: payload.profile?.emergency_contact_name || '',
				emergencyContactPhone: payload.profile?.emergency_contact_phone || '',
				occupation: payload.profile?.occupation || '',
				department: payload.profile?.department || '',
				employeeId: payload.profile?.employee_id || '',
				admissionNumber: payload.profile?.admission_number || '',
				className: payload.profile?.class_name || '',
				guardianName: payload.profile?.guardian_name || '',
				guardianPhone: payload.profile?.guardian_phone || '',
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

	const saveProfile = async () => {
		setSaving(true);
		setStatus(null);
		try {
			await fetchWithAuth('/api/profile/me', {
				method: 'PUT',
				body: JSON.stringify({
					...form,
					skills: String(form.skills || '').split(',').map((item) => item.trim()).filter(Boolean),
					preferences: { googleSigninEnabled: Boolean(form.alternateEmail) },
				}),
			});
			setStatus('Profile saved successfully.');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'Unable to save your profile.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-xl font-bold text-white">Profile Manager</h2>
					<p className="text-xs text-zinc-400">Capture robust user identity data, alternate contact email, and school-relevant records.</p>
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