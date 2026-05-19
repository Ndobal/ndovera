import React, { useEffect, useMemo, useState } from 'react';
import { getAdmissionsQueue, reviewAdmissionApplication } from '../services/schoolApi';

const SURFACE = 'rounded-3xl border border-[#c9a96e]/45 bg-[#f5deb3] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]';
const SUB_SURFACE = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/35 dark:bg-black/20';
const LABEL = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]';
const TITLE = 'text-2xl font-black text-[#800000] dark:text-[#ffffff]';
const BODY = 'text-sm text-[#191970] dark:text-[#39ff14]';
const INPUT = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-4 py-3 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff] dark:focus:ring-[#00ffff]';
const PRIMARY_BUTTON = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]';
const SECONDARY_BUTTON = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-4 py-2 text-sm font-semibold text-[#191970] transition-colors hover:bg-[#f2e1bf] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff] dark:hover:bg-[#800000]/85';

const STATUS_OPTIONS = ['', 'pending', 'reviewing', 'approved', 'waitlisted', 'rejected'];

function prettifyStatus(value) {
  const normalized = String(value || 'pending').trim().toLowerCase();
  if (!normalized) return 'Pending';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDateTime(value) {
  if (!value) return 'Now';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function buildServiceFlags(flags = {}) {
  return Object.entries(flags)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));
}

function readSummary(application) {
  const payload = application?.payload || {};
  return {
    studentName: payload?.student?.name || application?.applicantName || 'Applicant',
    desiredClass: payload?.student?.desiredClass || application?.desiredClass || 'Not set',
    parentName: payload?.parent?.name || 'Parent/Guardian',
    parentEmail: payload?.parent?.email || application?.applicantEmail || '',
    parentPhone: payload?.parent?.phone || application?.applicantPhone || '',
    previousSchool: payload?.academic?.previousSchool || '',
    strengths: payload?.academic?.strengths || '',
    medicalNotes: payload?.medical?.notes || '',
    allergies: payload?.medical?.allergies || '',
    conditions: payload?.medical?.conditions || '',
    supportNeeds: payload?.sen?.needs || '',
    talents: payload?.sen?.talents || '',
    transportArea: payload?.transport?.area || '',
    hostelNotes: payload?.hostel?.notes || '',
    examDate: payload?.exam?.preferredDate || '',
    registrationPlan: payload?.payment?.registrationPlan || '',
  };
}

export default function AdmissionsManagementBoard({
  audience = 'owner',
  title = 'Admissions Pipeline',
  subtitle = 'Review and route admission requests.',
}) {
  const [applications, setApplications] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isOperationalAudience = ['transport', 'hostel', 'clinic'].includes(audience);
  const canReview = !isOperationalAudience;
  const channel = isOperationalAudience ? audience : '';

  useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      setLoading(true);
      setError('');
      try {
        const response = await getAdmissionsQueue({ status: statusFilter, channel });
        if (cancelled) return;
        setApplications(response?.applications || []);
      } catch (loadError) {
        if (!cancelled) {
          setApplications([]);
          setError(loadError instanceof Error ? loadError.message : 'Could not load admissions right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadApplications();
    return () => { cancelled = true; };
  }, [channel, statusFilter]);

  const summary = useMemo(() => ({
    total: applications.length,
    approved: applications.filter(application => application.status === 'approved').length,
    pending: applications.filter(application => application.status === 'pending').length,
    needsSupport: applications.filter(application => buildServiceFlags(application.serviceFlags).length > 0).length,
  }), [applications]);

  async function handleReview(application, nextStatus) {
    const reviewNotes = window.prompt('Add review notes for this admission application.', application.reviewNotes || '');
    if (reviewNotes === null) return;

    setError('');
    setMessage('');

    try {
      const response = await reviewAdmissionApplication(application.id, {
        status: nextStatus,
        reviewNotes,
      });

      if (!response?.success) {
        setError(response?.message || 'Could not update this admission application.');
        return;
      }

      setApplications(currentApplications => currentApplications.map(currentApplication => (
        currentApplication.id === application.id ? response.application : currentApplication
      )));
      setMessage(`Marked ${readSummary(application).studentName} as ${prettifyStatus(nextStatus)}.`);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not update this admission application.');
    }
  }

  return (
    <div className="space-y-4">
      <section className={SURFACE}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={LABEL}>{isOperationalAudience ? `${audience} intake queue` : 'admissions'}</p>
            <h2 className={TITLE}>{title}</h2>
            <p className={`${BODY} mt-2 max-w-3xl`}>{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className={INPUT}>
              {STATUS_OPTIONS.map(option => (
                <option key={option || 'all'} value={option}>{option ? prettifyStatus(option) : 'All statuses'}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className={SUB_SURFACE}><p className={LABEL}>Applications</p><p className="mt-2 text-2xl font-black text-[#191970] dark:text-[#39ff14]">{summary.total}</p></div>
          <div className={SUB_SURFACE}><p className={LABEL}>Pending</p><p className="mt-2 text-2xl font-black text-[#191970] dark:text-[#39ff14]">{summary.pending}</p></div>
          <div className={SUB_SURFACE}><p className={LABEL}>Approved</p><p className="mt-2 text-2xl font-black text-[#191970] dark:text-[#39ff14]">{summary.approved}</p></div>
          <div className={SUB_SURFACE}><p className={LABEL}>Operational Needs</p><p className="mt-2 text-2xl font-black text-[#191970] dark:text-[#39ff14]">{summary.needsSupport}</p></div>
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{error}</div>}
        {message && <div className="mt-4 rounded-2xl border border-[#1a5c38]/35 bg-[#edf8f1] px-4 py-3 text-sm text-[#1a5c38] dark:border-[#00ffff]/35 dark:bg-[#002b2c] dark:text-[#00ffff]">{message}</div>}
      </section>

      {loading ? (
        <section className={SURFACE}><p className={BODY}>Loading admission applications...</p></section>
      ) : applications.length === 0 ? (
        <section className={SURFACE}><p className={BODY}>No admission applications match the current filter.</p></section>
      ) : (
        applications.map(application => {
          const details = readSummary(application);
          const serviceFlags = buildServiceFlags(application.serviceFlags);

          return (
            <article key={application.id} className={SURFACE}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className={LABEL}>Admission Application</p>
                  <h3 className="mt-1 text-xl font-bold text-[#800000] dark:text-[#ffffff]">{details.studentName}</h3>
                  <p className={`${BODY} mt-2`}>Desired class: <strong>{details.desiredClass}</strong></p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-[#f5deb3] dark:bg-[#00ffff] dark:text-[#000000]">{prettifyStatus(application.status)}</span>
                  <span className="rounded-full border border-[#c9a96e]/45 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">{formatDateTime(application.createdAt)}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={SUB_SURFACE}>
                  <p className={LABEL}>Family Contact</p>
                  <p className={`${BODY} mt-2`}><strong>{details.parentName}</strong></p>
                  {details.parentEmail && <p className={`${BODY} mt-1`}>{details.parentEmail}</p>}
                  {details.parentPhone && <p className={`${BODY} mt-1`}>{details.parentPhone}</p>}
                  {details.previousSchool && <p className={`${BODY} mt-3`}>Previous school: <strong>{details.previousSchool}</strong></p>}
                  {details.strengths && <p className={`${BODY} mt-1`}>Strengths: {details.strengths}</p>}
                </div>

                <div className={SUB_SURFACE}>
                  <p className={LABEL}>Support Routing</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {serviceFlags.length > 0 ? serviceFlags.map(flag => (
                      <span key={flag} className="rounded-full border border-[#c9a96e]/45 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">{flag}</span>
                    )) : <span className={BODY}>No downstream routing flags yet.</span>}
                  </div>
                  {details.transportArea && <p className={`${BODY} mt-3`}>Transport area: {details.transportArea}</p>}
                  {details.hostelNotes && <p className={`${BODY} mt-1`}>Hostel notes: {details.hostelNotes}</p>}
                  {(details.allergies || details.conditions || details.medicalNotes) && (
                    <p className={`${BODY} mt-1`}>Clinic notes: {[details.allergies, details.conditions, details.medicalNotes].filter(Boolean).join(' | ')}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={SUB_SURFACE}>
                  <p className={LABEL}>Learner Profile</p>
                  {details.supportNeeds && <p className={`${BODY} mt-2`}>Support needs: {details.supportNeeds}</p>}
                  {details.talents && <p className={`${BODY} mt-1`}>Talents: {details.talents}</p>}
                  {details.registrationPlan && <p className={`${BODY} mt-1`}>Registration plan: {details.registrationPlan}</p>}
                  {details.examDate && <p className={`${BODY} mt-1`}>Preferred exam date: {formatDateTime(details.examDate)}</p>}
                </div>

                <div className={SUB_SURFACE}>
                  <p className={LABEL}>Review Notes</p>
                  <p className={`${BODY} mt-2`}>{application.reviewNotes || 'No review notes yet.'}</p>
                  {application.reviewedBy && <p className={`${BODY} mt-2`}>Last reviewed by <strong>{application.reviewedBy}</strong>{application.reviewedAt ? ` on ${formatDateTime(application.reviewedAt)}` : ''}</p>}
                </div>
              </div>

              {canReview && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleReview(application, 'reviewing')} className={SECONDARY_BUTTON}>Mark Reviewing</button>
                  <button type="button" onClick={() => handleReview(application, 'approved')} className={PRIMARY_BUTTON}>Approve</button>
                  <button type="button" onClick={() => handleReview(application, 'waitlisted')} className={SECONDARY_BUTTON}>Waitlist</button>
                  <button type="button" onClick={() => handleReview(application, 'rejected')} className={SECONDARY_BUTTON}>Reject</button>
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}