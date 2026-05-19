import React, { useEffect, useState } from 'react';
import {
  getLearningStudents,
  getMe,
  getUserProfile,
  updateUserProfile,
} from '../../school/services/schoolApi';

const PANEL = 'rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-[#191970] shadow-sm dark:border-[#00ffff]/20 dark:bg-[#800000]/25 dark:text-[#39ff14] dark:backdrop-blur-xl';
const SECTION = 'rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 dark:border-[#00ffff]/20 dark:bg-[#330014]/70';
const INPUT = 'mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-white/80 px-4 py-3 text-sm text-[#191970] outline-none transition focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/10 dark:border-[#00ffff]/20 dark:bg-[#120014]/80 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20';
const LABEL = 'text-sm font-semibold uppercase tracking-[0.12em] text-[#800020] dark:text-[#bf00ff]';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7df9ff]';
const NOTICE = 'rounded-2xl border border-[#1a5c38]/20 bg-[#e4f4e6] px-4 py-3 text-sm text-[#1a5c38] dark:border-[#00ffff]/20 dark:bg-[#03181a] dark:text-[#7df9ff]';
const ERROR = 'rounded-2xl border border-[#800000]/20 bg-[#fff2ef] px-4 py-3 text-sm text-[#800000] dark:border-rose-300/20 dark:bg-[#24000d] dark:text-rose-200';

function createEmptyProfile() {
  return {
    id: '',
    name: '',
    email: '',
    avatar: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    relationship: '',
    nationality: '',
    stateOfOrigin: '',
    religion: '',
    bloodGroup: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    previousSchool: '',
    strengths: '',
    allergies: '',
    conditions: '',
    medicalNotes: '',
    senNeeds: '',
    talents: '',
    transportRequired: false,
    transportArea: '',
    hostelRequired: false,
    hostelNotes: '',
    registrationPlan: '',
    preferredExamDate: '',
  };
}

function buildProfileState(user = {}) {
  const profile = user?.profile || {};
  return {
    ...createEmptyProfile(),
    id: user?.id || profile?.id || '',
    name: user?.name || profile?.name || '',
    email: user?.email || profile?.email || '',
    avatar: user?.avatar || profile?.avatar || '',
    phone: user?.phone || profile?.phone || '',
    dateOfBirth: user?.dateOfBirth || profile?.dateOfBirth || '',
    gender: user?.gender || profile?.gender || '',
    address: user?.address || profile?.address || '',
    relationship: user?.relationship || profile?.relationship || '',
    nationality: profile?.nationality || '',
    stateOfOrigin: profile?.stateOfOrigin || '',
    religion: profile?.religion || '',
    bloodGroup: profile?.bloodGroup || '',
    parentName: profile?.parentName || '',
    parentEmail: profile?.parentEmail || '',
    parentPhone: profile?.parentPhone || '',
    emergencyContactName: profile?.emergencyContactName || '',
    emergencyContactPhone: profile?.emergencyContactPhone || '',
    previousSchool: profile?.previousSchool || '',
    strengths: profile?.strengths || '',
    allergies: profile?.allergies || '',
    conditions: profile?.conditions || '',
    medicalNotes: profile?.medicalNotes || '',
    senNeeds: profile?.senNeeds || '',
    talents: profile?.talents || '',
    transportRequired: Boolean(profile?.transportRequired),
    transportArea: profile?.transportArea || '',
    hostelRequired: Boolean(profile?.hostelRequired),
    hostelNotes: profile?.hostelNotes || '',
    registrationPlan: profile?.registrationPlan || '',
    preferredExamDate: profile?.preferredExamDate || '',
  };
}

function buildTargetLabel(target) {
  if (target.kind === 'parent') return 'My parent profile';
  if (target.kind === 'student' && target.isSelf) return 'My student profile';
  return `${target.name || 'Linked learner'}${target.className ? ` • ${target.className}` : ''}`;
}

function InputField({ label, value, onChange, type = 'text', readOnly = false, placeholder = '' }) {
  return (
    <label className={LABEL}>
      {label}
      <input type={type} value={value} onChange={onChange} readOnly={readOnly} placeholder={placeholder} className={INPUT} />
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows = 3, placeholder = '' }) {
  return (
    <label className={LABEL}>
      {label}
      <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder} className={`${INPUT} min-h-[104px] resize-y`} />
    </label>
  );
}

export default function ProfileEditor({ viewerRole = 'student', allowLinkedStudents = false }) {
  const [targets, setTargets] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [profile, setProfile] = useState(createEmptyProfile());
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadTargets() {
      setLoadingTargets(true);
      setError('');

      try {
        const meResult = await getMe();
        const currentUser = meResult?.user || meResult || {};
        const linkedStudentsResult = allowLinkedStudents ? await getLearningStudents() : { students: [] };
        const linkedStudents = Array.isArray(linkedStudentsResult?.students) ? linkedStudentsResult.students : [];

        const nextTargets = [
          {
            id: String(currentUser?.id || ''),
            name: currentUser?.name || '',
            className: currentUser?.className || '',
            kind: viewerRole === 'parent' ? 'parent' : 'student',
            isSelf: true,
          },
          ...linkedStudents.map(student => ({
            id: String(student?.id || ''),
            name: student?.name || '',
            className: student?.className || '',
            kind: 'student',
            isSelf: false,
          })),
        ].filter(target => target.id);

        if (!cancelled) {
          setTargets(nextTargets);
          setSelectedTargetId(current => (nextTargets.some(target => target.id === current) ? current : String(nextTargets[0]?.id || '')));
        }
      } catch (loadError) {
        if (!cancelled) {
          setTargets([]);
          setSelectedTargetId('');
          setError(loadError instanceof Error ? loadError.message : 'Could not load your profile records.');
        }
      } finally {
        if (!cancelled) {
          setLoadingTargets(false);
        }
      }
    }

    loadTargets();

    return () => {
      cancelled = true;
    };
  }, [allowLinkedStudents, viewerRole]);

  useEffect(() => {
    if (!selectedTargetId) {
      setProfile(createEmptyProfile());
      return undefined;
    }

    let cancelled = false;
    setLoadingProfile(true);
    setError('');

    getUserProfile(selectedTargetId)
      .then(result => {
        if (!cancelled) {
          setProfile(buildProfileState(result?.user || {}));
        }
      })
      .catch(loadError => {
        if (!cancelled) {
          setProfile(createEmptyProfile());
          setError(loadError instanceof Error ? loadError.message : 'Could not load that profile.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTargetId]);

  const selectedTarget = targets.find(target => target.id === selectedTargetId) || null;
  const isStudentRecord = selectedTarget?.kind === 'student';

  function updateField(field, value) {
    setProfile(current => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (!selectedTargetId) return;
    setSaving(true);
    setNotice('');
    setError('');

    try {
      await updateUserProfile(selectedTargetId, {
        name: profile.name,
        avatar: profile.avatar,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        address: profile.address,
        relationship: profile.relationship,
        nationality: profile.nationality,
        stateOfOrigin: profile.stateOfOrigin,
        religion: profile.religion,
        bloodGroup: profile.bloodGroup,
        parentName: profile.parentName,
        parentEmail: profile.parentEmail,
        parentPhone: profile.parentPhone,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
        previousSchool: profile.previousSchool,
        strengths: profile.strengths,
        allergies: profile.allergies,
        conditions: profile.conditions,
        medicalNotes: profile.medicalNotes,
        senNeeds: profile.senNeeds,
        talents: profile.talents,
        transportRequired: profile.transportRequired,
        transportArea: profile.transportArea,
        hostelRequired: profile.hostelRequired,
        hostelNotes: profile.hostelNotes,
        registrationPlan: profile.registrationPlan,
        preferredExamDate: profile.preferredExamDate,
      });

      const refreshed = await getUserProfile(selectedTargetId);
      const refreshedUser = refreshed?.user || {};
      setProfile(buildProfileState(refreshedUser));
      setTargets(current => current.map(target => (
        target.id === selectedTargetId
          ? { ...target, name: refreshedUser?.name || profile.name, className: refreshedUser?.className || target.className }
          : target
      )));
      setNotice(selectedTarget?.kind === 'student' ? 'Student record updated.' : 'Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingTargets) {
    return <div className={PANEL}>Loading profile records...</div>;
  }

  return (
    <div className="space-y-6">
      {error ? <div className={ERROR}>{error}</div> : null}
      {notice ? <div className={NOTICE}>{notice}</div> : null}

      <section className={PANEL}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#800020] dark:text-[#bf00ff]">Admission Profile</p>
            <h2 className="mt-2 text-2xl font-bold text-[#800000] dark:text-[#0000ff]">Keep school records current</h2>
            <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Update birthdays, guardian contacts, medical notes, transport and hostel details from the same authenticated profile record.</p>
          </div>

          {targets.length > 1 ? (
            <label className={LABEL}>
              Record
              <select value={selectedTargetId} onChange={event => setSelectedTargetId(event.target.value)} className={INPUT}>
                {targets.map(target => (
                  <option key={target.id} value={target.id}>{buildTargetLabel(target)}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      <section className={PANEL}>
        {loadingProfile ? <p className="text-sm text-[#800020] dark:text-[#bf00ff]">Loading selected record...</p> : null}

        {!loadingProfile && selectedTarget ? (
          <div className="space-y-5">
            <div className={SECTION}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InputField label="Full Name" value={profile.name} onChange={event => updateField('name', event.target.value)} />
                <InputField label="Email" value={profile.email} onChange={() => {}} readOnly />
                <InputField label="Phone" value={profile.phone} onChange={event => updateField('phone', event.target.value)} />
                <InputField label="Birthday" type="date" value={profile.dateOfBirth} onChange={event => updateField('dateOfBirth', event.target.value)} />
                <InputField label="Gender" value={profile.gender} onChange={event => updateField('gender', event.target.value)} placeholder="Female, Male, Prefer not to say" />
                <InputField label="Relationship" value={profile.relationship} onChange={event => updateField('relationship', event.target.value)} placeholder="Parent, guardian, self" />
                <InputField label="Avatar Url" value={profile.avatar} onChange={event => updateField('avatar', event.target.value)} placeholder="https://..." />
                <InputField label="Nationality" value={profile.nationality} onChange={event => updateField('nationality', event.target.value)} />
                <InputField label="State Of Origin" value={profile.stateOfOrigin} onChange={event => updateField('stateOfOrigin', event.target.value)} />
                <InputField label="Religion" value={profile.religion} onChange={event => updateField('religion', event.target.value)} />
                <InputField label="Blood Group" value={profile.bloodGroup} onChange={event => updateField('bloodGroup', event.target.value)} />
              </div>
              <div className="mt-4">
                <TextAreaField label="Address" value={profile.address} onChange={event => updateField('address', event.target.value)} rows={3} />
              </div>
            </div>

            {isStudentRecord ? (
              <>
                <div className={SECTION}>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <InputField label="Parent Name" value={profile.parentName} onChange={event => updateField('parentName', event.target.value)} />
                    <InputField label="Parent Email" value={profile.parentEmail} onChange={event => updateField('parentEmail', event.target.value)} />
                    <InputField label="Parent Phone" value={profile.parentPhone} onChange={event => updateField('parentPhone', event.target.value)} />
                    <InputField label="Emergency Contact" value={profile.emergencyContactName} onChange={event => updateField('emergencyContactName', event.target.value)} />
                    <InputField label="Emergency Contact Phone" value={profile.emergencyContactPhone} onChange={event => updateField('emergencyContactPhone', event.target.value)} />
                    <InputField label="Previous School" value={profile.previousSchool} onChange={event => updateField('previousSchool', event.target.value)} />
                    <InputField label="Registration Plan" value={profile.registrationPlan} onChange={event => updateField('registrationPlan', event.target.value)} placeholder="Day, boarding, termly" />
                    <InputField label="Preferred Exam Date" type="date" value={profile.preferredExamDate} onChange={event => updateField('preferredExamDate', event.target.value)} />
                  </div>
                </div>

                <div className={SECTION}>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <TextAreaField label="Strengths" value={profile.strengths} onChange={event => updateField('strengths', event.target.value)} />
                    <TextAreaField label="Talents" value={profile.talents} onChange={event => updateField('talents', event.target.value)} />
                    <TextAreaField label="Allergies" value={profile.allergies} onChange={event => updateField('allergies', event.target.value)} />
                    <TextAreaField label="Medical Conditions" value={profile.conditions} onChange={event => updateField('conditions', event.target.value)} />
                    <TextAreaField label="Medical Notes" value={profile.medicalNotes} onChange={event => updateField('medicalNotes', event.target.value)} />
                    <TextAreaField label="SEN Needs" value={profile.senNeeds} onChange={event => updateField('senNeeds', event.target.value)} />
                  </div>
                </div>

                <div className={SECTION}>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className={LABEL}>
                      Transport Required
                      <select value={profile.transportRequired ? 'yes' : 'no'} onChange={event => updateField('transportRequired', event.target.value === 'yes')} className={INPUT}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>
                    <InputField label="Transport Area" value={profile.transportArea} onChange={event => updateField('transportArea', event.target.value)} />
                    <label className={LABEL}>
                      Hostel Required
                      <select value={profile.hostelRequired ? 'yes' : 'no'} onChange={event => updateField('hostelRequired', event.target.value === 'yes')} className={INPUT}>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-4">
                    <TextAreaField label="Hostel Notes" value={profile.hostelNotes} onChange={event => updateField('hostelNotes', event.target.value)} />
                  </div>
                </div>
              </>
            ) : null}

            <div className="flex justify-end">
              <button type="button" onClick={handleSave} disabled={saving || loadingProfile} className={BTN}>
                {saving ? 'Saving...' : selectedTarget?.kind === 'student' ? 'Save Learner Record' : 'Save Profile'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#800020] dark:text-[#bf00ff]">No editable profile is available yet.</p>
        )}
      </section>
    </div>
  );
}
