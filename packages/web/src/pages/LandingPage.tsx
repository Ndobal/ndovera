import React, { useState, useEffect } from 'react';
import { 
  Briefcase,
  Sprout, 
  ShieldCheck, 
  Globe, 
  Zap, 
  BarChart3, 
  MapPin,
  Smartphone,
  ChevronRight,
  X
} from 'lucide-react';

function isVacancySlug(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['opportunities', 'opportunity', 'vacancies', 'vacancy', 'careers', 'jobs'].includes(normalized);
}

function hexToRgba(value: string | undefined, alpha: number) {
  const hex = String(value || '#10b981').replace('#', '').trim();
  const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex.padEnd(6, '0').slice(0, 6);
  const numeric = Number.parseInt(normalized, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export const LandingPage = ({ onLogin }: { onLogin: () => void }) => {
  const API_BASE = (import.meta.env.VITE_API_BASE as string) ?? '';

  const [showRegister, setShowRegister] = useState(false);
  const [registerStep, setRegisterStep] = useState<'details' | 'payment' | 'waiting' | 'approved'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [schoolSubdomain, setSchoolSubdomain] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [waitToken, setWaitToken] = useState('');
  const [ownerNdoveraEmail, setOwnerNdoveraEmail] = useState('');
  const [onboardingStatus, setOnboardingStatus] = useState<string>('Awaiting Payment');
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);
    const [carouselImages, setCarouselImages] = useState([
      '/carousel-1.png',
      '/carousel-2.png',
      '/carousel-3.png',
      '/carousel-4.png',
      '/carousel-5.png',
    ]);
    const [website, setWebsite] = useState<any | null>(null);
    const [vacancies, setVacancies] = useState<any[]>([]);
    const [testimonials, setTestimonials] = useState<any[]>([]);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [selectedPublicPageId, setSelectedPublicPageId] = useState('home');
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<Array<{ from: 'user' | 'bot'; text: string }>>([]);
    const [chatInput, setChatInput] = useState('');
    const [showGrowthSignup, setShowGrowthSignup] = useState(false);
    const [growthSubmitting, setGrowthSubmitting] = useState(false);
    const [growthSuccess, setGrowthSuccess] = useState(false);
    const [growthForm, setGrowthForm] = useState({ name: '', email: '', phone: '', city: '', notes: '' });
  
    const resetRegisterFlow = () => {
      setRegisterStep('details');
      setIsSubmitting(false);
      setRegisterError(null);
      setSchoolName('');
      setOwnerName('');
      setAdminEmail('');
      setPhoneNumber('');
      setSchoolSubdomain('');
      setOwnerPassword('');
      setPaymentReference('');
      setPaymentProofFile(null);
      setPaymentProofUrl('');
      setWaitToken('');
      setOwnerNdoveraEmail('');
      setOnboardingStatus('Awaiting Payment');
    };

    const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setRegisterError(null);
      try {
        const resp = await fetch(`${API_BASE}/api/onboarding/register-school`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolName,
            ownerName,
            alternateEmail: adminEmail,
            phone: phoneNumber,
            password: ownerPassword,
            subdomain: schoolSubdomain,
          }),
        });
        const d = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(d?.error || 'Registration failed');
        setWaitToken(d.waitToken || '');
        setOwnerNdoveraEmail(d.ownerNdoveraEmail || '');
        setOnboardingStatus('Awaiting Payment');
        setRegisterStep('payment');
      } catch (err) {
        console.error('Registration failed', err);
        setRegisterError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsSubmitting(false);
      }
    };

    const handlePaymentConfirmation = async (event: React.FormEvent) => {
      event.preventDefault();
      if (!waitToken) return;
      setIsSubmitting(true);
      setRegisterError(null);
      try {
        let uploadedProofUrl = paymentProofUrl;
        if (paymentProofFile) {
          const formData = new FormData();
          formData.append('proof', paymentProofFile);
          formData.append('waitToken', waitToken);
          const uploadResp = await fetch(`${API_BASE}/api/uploads/payment-proof`, {
            method: 'POST',
            body: formData,
          });
          const uploadPayload = await uploadResp.json().catch(() => ({}));
          if (!uploadResp.ok) throw new Error(uploadPayload?.error || 'Payment proof upload failed');
          uploadedProofUrl = uploadPayload.url || '';
          setPaymentProofUrl(uploadedProofUrl);
        }

        const resp = await fetch(`${API_BASE}/api/onboarding/${waitToken}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentReference, paymentProofUrl: uploadedProofUrl }),
        });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(payload?.error || 'Payment acknowledgement failed');
        setOnboardingStatus(payload.status || 'Awaiting Approval');
        setRegisterStep('waiting');
      } catch (err) {
        console.error('Payment confirmation failed', err);
        setRegisterError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsSubmitting(false);
      }
    };
  
    const sendChat = async (q: string) => {
      if (!q) return;
      setChatMessages(m => [...m, { from: 'user', text: q }]);
      setChatInput('');
      try {
        const resp = await fetch(`${API_BASE}/api/faq/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: 'school_1', question: q }) });
        const d = await resp.json();
        if (resp.ok) {
          setChatMessages(m => [...m, { from: 'bot', text: d.answer }]);
        } else {
          setChatMessages(m => [...m, { from: 'bot', text: 'Sorry, I could not answer that right now.' }]);
        }
      } catch (err) {
        console.error(err);
        setChatMessages(m => [...m, { from: 'bot', text: 'Error contacting the assistant.' }]);
      }
    };

    React.useEffect(() => {
      if (!toast) return;
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }, [toast]);

    React.useEffect(() => {
      if (!showRegister || registerStep !== 'waiting' || !waitToken) return;

      let cancelled = false;
      const poll = async () => {
        try {
          const response = await fetch(`${API_BASE}/api/onboarding/${waitToken}/status`);
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || cancelled) return;
          const status = payload?.request?.status || 'Awaiting Approval';
          setOnboardingStatus(status);
          if (status === 'Approved') {
            setRegisterStep('approved');
          }
        } catch (err) {
          console.error('Onboarding status polling failed', err);
        }
      };

      poll();
      const timer = window.setInterval(poll, 8000);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }, [API_BASE, registerStep, showRegister, waitToken]);

    React.useEffect(() => {
      const fetchLandingData = async () => {
        try {
          const [websiteResp, testimonialsResp, vacanciesResp] = await Promise.all([
            fetch(`${API_BASE}/api/schools/school_1/website`),
            fetch(`${API_BASE}/api/schools/school_1/testimonials`),
            fetch(`${API_BASE}/api/schools/school_1/vacancies`),
          ]);

          if (websiteResp.ok) {
            const websiteData = await websiteResp.json();
            setWebsite(websiteData?.website || null);
          }

          if (testimonialsResp.ok) {
            const testimonialData = await testimonialsResp.json();
            setTestimonials(Array.isArray(testimonialData) ? testimonialData : testimonialData?.testimonials || []);
          }

          if (vacanciesResp.ok) {
            const vacancyData = await vacanciesResp.json();
            setVacancies(Array.isArray(vacancyData?.vacancies) ? vacancyData.vacancies : []);
          }
        } catch (err) {
          console.error('Failed to load landing page data', err);
        }
      };

      fetchLandingData();
    }, [API_BASE]);

  const landingTestimonials = testimonials.length ? testimonials.slice(0, 6) : sampleTestimonials();
  const websitePages = Array.isArray(website?.pages) ? website.pages : [];
  const hasDedicatedVacancyPage = websitePages.some((page: any) => isVacancySlug(page?.slug) || isVacancySlug(page?.title));
  const publicPages = [
    { id: 'home', title: 'Home', slug: 'home', sections: [] },
    ...websitePages,
    ...(!hasDedicatedVacancyPage && vacancies.length ? [{ id: 'vacancies_public', title: 'Opportunities', slug: 'opportunities', sections: [] }] : []),
  ];
  const selectedPublicPage = publicPages.find((page: any) => page.id === selectedPublicPageId) || publicPages[0];
  const isHomePage = selectedPublicPage?.id === 'home' || isVacancySlug(selectedPublicPage?.slug) === false && isVacancySlug(selectedPublicPage?.title) === false && selectedPublicPageId === 'home';
  const isVacancyPage = isVacancySlug(selectedPublicPage?.slug) || isVacancySlug(selectedPublicPage?.title) || selectedPublicPage?.id === 'vacancies_public';
  const brandColor = website?.theme?.primaryColor || '#10b981';
  const brandGlow = hexToRgba(brandColor, 0.16);
  const brandSoft = hexToRgba(brandColor, 0.12);
  const brandBorder = hexToRgba(brandColor, 0.28);
  const brandText = hexToRgba(brandColor, 0.92);

  useEffect(() => {
    if (!publicPages.some((page: any) => page.id === selectedPublicPageId)) {
      setSelectedPublicPageId('home');
    }
  }, [selectedPublicPageId, vacancies.length, website]);

  const handleGrowthSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setGrowthSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/growth-partners/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...growthForm,
          school_id: 'school_1',
          source: 'website',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Application failed');
      setGrowthSuccess(true);
      setGrowthForm({ name: '', email: '', phone: '', city: '', notes: '' });
      setTimeout(() => {
        setGrowthSuccess(false);
        setShowGrowthSignup(false);
      }, 2200);
    } catch (err) {
      console.error('Growth signup failed', err);
      alert(`Application failed: ${String(err)}`);
    } finally {
      setGrowthSubmitting(false);
    }
  };

  const renderPublicPageSection = (section: any) => {
    if (section.type === 'hero') {
      return (
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-black tracking-tight text-white lg:text-6xl">{section.content.title}</h1>
          <p className="mx-auto max-w-3xl text-lg text-zinc-400">{section.content.subtitle}</p>
        </div>
      );
    }

    if (section.type === 'about') {
      return (
        <div className="mx-auto max-w-4xl rounded-4xl border border-white/5 bg-white/3 p-8 text-left">
          <h2 className="mb-4 text-3xl font-bold text-white">About</h2>
          <p className="leading-8 text-zinc-300">{section.content.text}</p>
        </div>
      );
    }

    if (section.type === 'features') {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rounded-4xl border border-white/5 bg-white/3 p-8 text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <Globe size={22} />
              </div>
              <h3 className="text-xl font-bold text-white">{section.content.title || `Highlight ${item}`}</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">{section.content.subtitle || 'This page was published from the school website builder and is now visible to the public.'}</p>
            </div>
          ))}
        </div>
      );
    }

    if (section.type === 'contact') {
      return (
        <div className="mx-auto max-w-3xl rounded-4xl border border-white/5 bg-[#151619] p-8 text-left">
          <h2 className="text-3xl font-bold text-white">Contact this school</h2>
          <p className="mt-2 text-sm text-zinc-400">Send a direct public enquiry to the school team.</p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
            <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="Message" className="md:col-span-2 h-36 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
            <button onClick={async () => {
              if (!contactEmail || !contactMessage) return alert('Email and message required');
              try {
                const resp = await fetch(`${API_BASE}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage, school_id: 'school_1' }) });
                const d = await resp.json();
                if (!resp.ok) throw new Error(d?.error || 'send failed');
                setToast({ message: 'Message sent', type: 'success' });
                setContactName('');
                setContactEmail('');
                setContactMessage('');
              } catch (err) {
                console.error(err);
                alert('Send failed');
              }
            }} className="md:col-span-2 rounded-2xl bg-[#066a3e] px-6 py-4 text-sm font-bold text-white transition-all hover:bg-[#085f39]">Send Message</button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-zinc-300 font-sans selection:bg-emerald-500/30">
      {/* Registration Modal */}
      {showRegister && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#151619] border border-white/10 rounded-4xl w-full max-w-lg p-8 relative shadow-2xl">
            <button 
              onClick={() => {
                setShowRegister(false);
                resetRegisterFlow();
              }}
              className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            
            {registerStep === 'approved' ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
                  <ShieldCheck size={40} />
                </div>
                <h3 className="text-2xl font-bold text-white">School Approved</h3>
                <p className="text-zinc-400">Your owner identity is ready. Sign in with <span className="text-white font-bold">{ownerNdoveraEmail}</span> after closing this dialog.</p>
                <button onClick={() => { setShowRegister(false); resetRegisterFlow(); }} className="mx-auto rounded-2xl bg-[#066a3e] px-6 py-3 font-bold text-white">Close</button>
              </div>
            ) : registerStep === 'payment' ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">Make payment and upload proof</h3>
                  <p className="text-zinc-500 text-sm mt-1">Transfer to the account below, then click <span className="text-white font-semibold">I have paid</span>.</p>
                </div>

                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-zinc-200 space-y-2">
                  <div><span className="text-zinc-400">Account number:</span> <span className="font-bold text-white">8064252542</span></div>
                  <div><span className="text-zinc-400">Account name:</span> <span className="font-bold text-white">Williams James</span></div>
                  <div><span className="text-zinc-400">Bank:</span> <span className="font-bold text-white">Opay Bank</span></div>
                  <div><span className="text-zinc-400">Reserved owner sign-in:</span> <span className="font-bold text-white">{ownerNdoveraEmail}</span></div>
                </div>

                <form onSubmit={handlePaymentConfirmation} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Payment reference</label>
                    <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" placeholder="Transaction ID / transfer note" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Payment proof</label>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" />
                  </div>
                  {registerError ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{registerError}</div> : null}
                  <button disabled={isSubmitting} className="w-full bg-[#066a3e] hover:bg-[#085f39] text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50">
                    {isSubmitting ? 'Submitting payment...' : 'I have paid'}
                  </button>
                </form>
              </div>
            ) : registerStep === 'waiting' ? (
              <div className="space-y-6 text-center py-8">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto animate-pulse">
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Waiting for approval</h3>
                  <p className="text-zinc-400 mt-2">Keep this screen open. It refreshes automatically while super admin reviews your payment.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left text-sm text-zinc-300 space-y-2">
                  <div><span className="text-zinc-500">Status:</span> <span className="font-bold text-white">{onboardingStatus}</span></div>
                  <div><span className="text-zinc-500">Owner Ndovera email:</span> <span className="font-bold text-white">{ownerNdoveraEmail}</span></div>
                  <div><span className="text-zinc-500">Alternate email:</span> <span className="font-bold text-white">{adminEmail}</span></div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">Register Your School</h3>
                  <p className="text-zinc-500 text-sm mt-1">Create the owner identity, pay, then wait for approval.</p>
                </div>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">School Name</label>
                    <input required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} aria-label="School name" type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Owner Name</label>
                    <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} aria-label="Owner name" type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Alternate / Google Email</label>
                    <input required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} aria-label="Administrator email" type="email" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Phone Number</label>
                      <input required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} aria-label="Phone number" type="tel" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Preferred subdomain</label>
                      <input value={schoolSubdomain} onChange={(e) => setSchoolSubdomain(e.target.value)} aria-label="Subdomain" type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" placeholder="brightstarscollege" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Secure Password</label>
                    <input required minLength={12} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} aria-label="Owner password" type="password" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 transition-all" placeholder="Minimum 12 characters" />
                  </div>
                  {registerError ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{registerError}</div> : null}
                  <button 
                    disabled={isSubmitting}
                    className="w-full bg-[#066a3e] hover:bg-[#085f39] text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating request...' : 'Continue to payment'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {showGrowthSignup && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-4xl border border-white/10 bg-[#151619] p-8 shadow-2xl">
            <button onClick={() => setShowGrowthSignup(false)} className="absolute right-6 top-6 text-zinc-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
            {growthSuccess ? (
              <div className="space-y-4 py-12 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                  <ShieldCheck size={40} />
                </div>
                <h3 className="text-2xl font-bold text-white">Application Received</h3>
                <p className="text-sm text-zinc-400">Approved growth partners get a limited growth-only workspace, not the full admin dashboard.</p>
              </div>
            ) : (
              <form onSubmit={handleGrowthSignup} className="space-y-5">
                <div>
                  <h3 className="text-2xl font-bold text-white">Join the Growth Team</h3>
                  <p className="mt-1 text-sm text-zinc-400">Apply from the website. Once approved, you work inside a restricted growth portal with no school-admin risk.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input required value={growthForm.name} onChange={(event) => setGrowthForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white outline-none" />
                  <input required type="email" value={growthForm.email} onChange={(event) => setGrowthForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white outline-none" />
                  <input required value={growthForm.phone} onChange={(event) => setGrowthForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white outline-none" />
                  <input value={growthForm.city} onChange={(event) => setGrowthForm((current) => ({ ...current, city: event.target.value }))} placeholder="City / region" className="rounded-xl border border-white/10 bg-white/5 p-4 text-white outline-none" />
                  <textarea value={growthForm.notes} onChange={(event) => setGrowthForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Why do you want to join the growth team?" className="h-32 rounded-xl border border-white/10 bg-white/5 p-4 text-white outline-none md:col-span-2" />
                </div>
                <div className="rounded-2xl border px-4 py-4 text-sm text-zinc-300" style={{ borderColor: brandBorder, background: brandSoft }}>
                  Approved partners can refer schools, support onboarding, and manage growth tasks without access to sensitive admin controls.
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={growthSubmitting} className="rounded-2xl px-6 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-60" style={{ background: brandColor }}>
                    {growthSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                  <button type="button" onClick={() => setShowGrowthSignup(false)} className="rounded-2xl bg-white/5 px-6 py-3 text-sm font-bold text-white">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="h-24 flex items-center justify-between px-6 lg:px-20 sticky top-0 z-50" style={{ background: '#40a829' }}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl flex items-center justify-center shadow-lg overflow-hidden logo-white">
            <img src="/logo.png" alt="Ndovera" className="w-full h-full object-contain logo-rotate" />
          </div>
          <span className="font-extrabold text-4xl tracking-tight text-white">Ndovera School</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-black">
          {publicPages.slice(0, 6).map((p: any) => (
            <button key={p.id || p.slug} onClick={() => setSelectedPublicPageId(p.id)} className={`transition-opacity hover:opacity-80 ${selectedPublicPageId === p.id ? 'underline underline-offset-4' : ''}`}>{p.title}</button>
          ))}
        </div>

        <button className="md:hidden" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h16M4 18h16" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {mobileOpen && (
          <div className="absolute top-24 left-0 right-0 bg-white/95 text-black p-4 md:hidden z-40">
            <div className="flex flex-col gap-3">
              {publicPages.map((p: any) => (
                <button key={p.id || p.slug} onClick={() => { setSelectedPublicPageId(p.id); setMobileOpen(false); }} className="block rounded py-2 px-3 text-left hover:bg-white/10">{p.title}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button 
            onClick={onLogin}
            className="text-sm font-bold text-black hover:opacity-80 transition-opacity"
          >
            Sign In
          </button>
          <button 
            onClick={() => setShowRegister(true)}
            className="bg-[#066a3e] hover:bg-[#085f39] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg"
          >
            Register School
          </button>
          <button
            onClick={() => setShowGrowthSignup(true)}
            className="hidden rounded-xl border border-black/10 bg-white/20 px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-80 lg:block"
          >
            Growth Team Signup
          </button>
        </div>
      </nav>

      {isHomePage ? (
      <>
      {/* Hero Section */}
      <section className="py-20 lg:py-32 px-6 lg:px-20 max-w-7xl mx-auto text-center">
        <div className="mb-8 inline-flex items-center gap-3 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: brandSoft, borderColor: brandBorder, color: brandText }}>
          <img src="/logo.png" alt="Ndovera" className="w-6 h-6 object-contain" />
          <span className="flex items-center gap-2"><Zap size={14} /> The Ultimate School SaaS</span>
        </div>
        <h1 className="text-5xl lg:text-7xl font-bold text-white mb-8 tracking-tight leading-[1.1]">
          Empower Your School with <br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(90deg, ${brandColor}, ${hexToRgba(brandColor, 0.7)})` }}>
            Intelligent Management
          </span>
        </h1>
        <p className="text-lg lg:text-xl text-zinc-500 max-w-3xl mx-auto mb-12 leading-relaxed">
          Ndovera is a world-class multi-tenant SaaS platform designed to streamline academics, 
          finance, and institutional operations for modern schools.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => setShowRegister(true)} className="w-full sm:w-auto bg-[#066a3e] hover:bg-[#085f39] text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-2">
            Get Started Free <ChevronRight size={20} />
          </button>
          <button onClick={() => setContactOpen(true)} className="w-full sm:w-auto bg-white/5 border border-white/10 hover:bg-white/10 text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all">
            Contact Sales
          </button>
          <button onClick={() => setShowGrowthSignup(true)} className="w-full sm:w-auto border px-8 py-4 rounded-2xl text-lg font-bold transition-all" style={{ borderColor: brandBorder, background: brandSoft, color: '#fff' }}>
            Join Growth Team
          </button>
        </div>
      </section>

      {/* Contact Sales Modal */}
      {contactOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#151619] border border-white/10 rounded-4xl w-full max-w-lg p-8 relative shadow-2xl">
            <button 
              onClick={() => setContactOpen(false)}
              className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-white">Contact Sales</h3>
              <p className="text-zinc-500 text-sm">Send us a message and our sales team will get back to you within one business day.</p>
              <div className="space-y-3 mt-4">
                <div>
                  <label className="sr-only">Your Name</label>
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} aria-label="Your name" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="sr-only">Email</label>
                  <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} aria-label="Email" type="email" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="sr-only">Message</label>
                  <textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} aria-label="Message" className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-emerald-500 h-36" />
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!contactEmail || !contactMessage) return alert('Email and message required');
                    try {
                      const resp = await fetch(`${API_BASE}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage, school_id: null }) });
                      const d = await resp.json(); if (!resp.ok) throw new Error(d?.error || 'send failed');
                          setToast({ message: 'Message sent', type: 'success' });
                      setContactName(''); setContactEmail(''); setContactMessage(''); setContactOpen(false);
                    } catch (err) { console.error(err); alert('Send failed'); }
                  }} className="bg-emerald-600 text-white px-4 py-2 rounded">Send</button>
                  <button onClick={() => setContactOpen(false)} className="bg-white/5 text-white px-4 py-2 rounded">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carousel Section */}
      <section className="py-8 px-6 lg:px-20 max-w-7xl mx-auto">
        <div className="carousel-rows">
          <div className="carousel-track">
            <div className="carousel-loop-right">
              {carouselImages.map((src, i) => (
                <div key={`top-${i}`} className="carousel-item">
                  <img src={src} alt={`slide-${i}`} className="carousel-img" />
                </div>
              ))}
              {carouselImages.map((src, i) => (
                <div key={`top-dup-${i}`} className="carousel-item">
                  <img src={src} alt={`slide-${i}`} className="carousel-img" />
                </div>
              ))}
            </div>
          </div>

          <div className="carousel-track">
            <div className="carousel-loop-left">
              {carouselImages.map((src, i) => (
                <div key={`bot-${i}`} className="carousel-item">
                  <img src={src} alt={`slide-b-${i}`} className="carousel-img" />
                </div>
              ))}
              {carouselImages.map((src, i) => (
                <div key={`bot-dup-${i}`} className="carousel-item">
                  <img src={src} alt={`slide-b-${i}`} className="carousel-img" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 px-6 lg:px-20 max-w-7xl mx-auto">
        <h3 className="text-2xl font-bold text-white mb-6 text-center">What people say about Ndovera</h3>
        <div className="carousel-rows">
          <div className="carousel-track">
            <div className="carousel-loop-right">
              {sampleTestimonials().map((t: any) => (
                <div key={t.id || t.quote} className="testimonial-card" style={{width: 400}}>
                  <div className="testimonial-quote">“{t.quote}”</div>
                  <div className="mt-3 testimonial-author">— {t.author}{t.role ? `, ${t.role}` : ''}</div>
                </div>
              ))}
               {sampleTestimonials().map((t: any) => (
                <div key={t.id || t.quote} className="testimonial-card" style={{width: 400}}>
                  <div className="testimonial-quote">“{t.quote}”</div>
                  <div className="mt-3 testimonial-author">— {t.author}{t.role ? `, ${t.role}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="carousel-track">
            <div className="carousel-loop-left">
              {sampleTestimonials().slice(2).concat(sampleTestimonials().slice(0,2)).map((t: any) => (
                <div key={t.id || t.quote} className="testimonial-card" style={{width: 400}}>
                  <div className="testimonial-quote">“{t.quote}”</div>
                  <div className="mt-3 testimonial-author">— {t.author}{t.role ? `, ${t.role}` : ''}</div>
                </div>
              ))}
              {sampleTestimonials().slice(2).concat(sampleTestimonials().slice(0,2)).map((t: any) => (
                <div key={t.id || t.quote} className="testimonial-card" style={{width: 400}}>
                  <div className="testimonial-quote">“{t.quote}”</div>
                  <div className="mt-3 testimonial-author">— {t.author}{t.role ? `, ${t.role}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 px-6 lg:px-20 max-w-7xl mx-auto">
        <h3 className="text-2xl font-bold text-white mb-6">What people say about Ndovera</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {landingTestimonials.map((t: any) => (
            <div key={t.id || t.quote} className="testimonial-card">
              <div className="testimonial-quote">“{t.quote}”</div>
              <div className="mt-3 testimonial-author">— {t.author}{t.role ? `, ${t.role}` : ''}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 lg:px-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">Powerful Features</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto">Everything you need to run a modern educational institution in one place.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'Multi-Tenant Isolation', desc: 'Each school operates in a completely isolated secure environment.', icon: <ShieldCheck size={32} /> },
            { title: 'Website Builder', desc: 'Automatically generate and customize a professional website for your school.', icon: <Globe size={32} /> },
            { title: 'Advanced Analytics', desc: 'Gain deep insights into student performance and financial health.', icon: <BarChart3 size={32} /> },
            { title: 'Mobile First', desc: 'Access everything from any device with our responsive, touch-friendly UI.', icon: <Smartphone size={32} /> },
            { title: 'Smart Finance', desc: 'Automated fee tracking, receipt generation, and financial reporting.', icon: <Zap size={32} /> },
            { title: 'Academic Excellence', desc: 'Manage curriculum, lesson plans, and results with ease.', icon: <Sprout size={32} /> },
          ].map((feature, i) => (
            <div key={i} className="p-8 bg-[#151619] border border-white/5 rounded-3xl hover:border-emerald-500/30 transition-all group">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl transition-all group-hover:text-white" style={{ background: brandSoft, color: brandColor }}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-zinc-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 lg:px-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto">Choose the plan that fits your school's size and needs.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: 'Starter', price: '₦50,000', period: '/term', desc: 'Perfect for small schools.', features: ['Up to 100 Students', 'Basic Analytics', 'Website Builder', 'Email Support'] },
            { name: 'Professional', price: '₦150,000', period: '/term', desc: 'For growing institutions.', features: ['Up to 500 Students', 'Advanced Analytics', 'Custom Domain', 'Priority Support'], popular: true },
            { name: 'Enterprise', price: 'Custom', period: '', desc: 'For large school networks.', features: ['Unlimited Students', 'Full API Access', 'Dedicated Manager', '24/7 Support'] },
          ].map((plan, i) => (
            <div key={i} className={`p-10 rounded-3xl border ${plan.popular ? 'bg-emerald-600/5 border-emerald-500/30' : 'bg-[#151619] border-white/5'} flex flex-col`}>
              {plan.popular && <span className="text-[10px] font-bold text-[#066a3e] uppercase tracking-widest mb-4">Most Popular</span>}
              <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
              <p className="text-zinc-500 text-sm mb-8">{plan.desc}</p>
              <div className="mb-8">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-zinc-500 text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-sm text-zinc-400">
                    <ShieldCheck size={16} className="text-emerald-500" /> {f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-4 rounded-2xl font-bold transition-all ${plan.popular ? 'bg-[#066a3e] text-white hover:bg-[#085f39]' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-8 lg:px-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 gap-6 rounded-4xl border p-8 lg:grid-cols-[1.4fr_0.9fr]" style={{ borderColor: brandBorder, background: `linear-gradient(135deg, ${hexToRgba(brandColor, 0.16)}, rgba(21,22,25,0.96))` }}>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em]" style={{ background: brandSoft, color: brandText }}>
              <Sprout size={14} /> Growth Partner Access
            </div>
            <h3 className="mt-5 text-3xl font-black text-white">Safe public signup for growth partners</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">Growth team members can apply directly from this website. After approval, they receive a restricted growth-only workspace for referrals, missions, onboarding support, and Aura tracking without exposing sensitive school-admin controls.</p>
          </div>
          <div className="flex flex-col justify-center gap-3">
            <button onClick={() => setShowGrowthSignup(true)} className="rounded-2xl px-6 py-4 text-sm font-bold text-white" style={{ background: brandColor, boxShadow: `0 18px 40px ${brandGlow}` }}>
              Apply as Growth Partner
            </button>
            <button onClick={() => setContactOpen(true)} className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-bold text-white hover:bg-white/10">
              Ask about partner onboarding
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 lg:px-20 max-w-5xl mx-auto">
        <div className="rounded-[3rem] p-12 text-center text-white shadow-2xl lg:p-20" style={{ background: `linear-gradient(135deg, ${brandColor}, ${hexToRgba(brandColor, 0.65)})`, boxShadow: `0 30px 80px ${brandGlow}` }}>
          <h2 className="text-4xl lg:text-6xl font-black mb-8 tracking-tight">Ready to Transform Your School?</h2>
          <p className="mx-auto mb-12 max-w-2xl text-xl text-white/85">Join hundreds of schools already using Ndovera to deliver excellence.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => setShowRegister(true)} className="w-full sm:w-auto bg-white px-10 py-4 rounded-2xl text-lg font-bold hover:opacity-90 transition-all" style={{ color: brandColor }}>
              Register Your School
            </button>
            <button onClick={() => setContactOpen(true)} className="w-full sm:w-auto border border-white/10 bg-black/20 px-10 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:bg-black/30">
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center">
        <p className="text-sm text-zinc-600 font-medium">
          Terms
        </p>
      </footer>
      </>
      ) : (
        <>
          <section className="px-6 py-16 lg:px-20">
            <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-white/5 bg-[#111315] p-8 lg:p-12">
              <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                <button onClick={() => setSelectedPublicPageId('home')} className="rounded-full bg-white/5 px-4 py-2 hover:bg-white/10">Home</button>
                <ChevronRight size={16} />
                <span className="rounded-full px-4 py-2" style={{ background: brandSoft, color: brandText }}>{selectedPublicPage?.title || 'Page'}</span>
              </div>

              {isVacancyPage ? (
                <div id="public-opportunities" className="space-y-8">
                  <div className="max-w-3xl space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.25em]" style={{ borderColor: brandBorder, background: brandSoft, color: brandText }}>
                      <Briefcase size={14} /> Careers & Opportunities
                    </div>
                    <h1 className="text-4xl font-black text-white lg:text-5xl">Join this school</h1>
                    <p className="text-lg leading-8 text-zinc-400">All published school vacancies appear here automatically. Teachers see school-only vacancies in-app, and the same school opportunities can now be shown publicly on this website page.</p>
                  </div>

                  {vacancies.length ? (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {vacancies.map((vacancy) => (
                        <div key={vacancy.id} className="rounded-4xl border border-white/5 bg-white/3 p-8">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ background: brandSoft, color: brandText }}>{vacancy.category}</span>
                            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-zinc-400">{vacancy.type}</span>
                          </div>
                          <h2 className="mt-5 text-2xl font-bold text-white">{vacancy.title}</h2>
                          <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                            <MapPin size={15} /> {vacancy.schoolName}
                          </div>
                          <p className="mt-4 text-sm leading-7 text-zinc-300">{vacancy.description}</p>
                          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/5 pt-5">
                            <div>
                              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Salary</div>
                              <div className="text-sm font-semibold text-white">{vacancy.salary || 'Competitive'}</div>
                            </div>
                            <button onClick={() => setContactOpen(true)} className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ background: brandColor, boxShadow: `0 12px 32px ${brandGlow}` }}>Apply / Enquire</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-4xl border border-dashed border-white/10 bg-white/2 px-8 py-16 text-center text-zinc-500">
                      No open vacancies have been published yet.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-10">
                  {(selectedPublicPage?.sections || []).map((section: any) => (
                    <div key={section.id}>{renderPublicPageSection(section)}</div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <footer className="py-12 border-t border-white/5 text-center">
            <p className="text-sm text-zinc-600 font-medium">Terms</p>
          </footer>
        </>
      )}

      {/* Chat Widget */}
      <div className="fixed bottom-6 right-6 z-60">
        {!chatOpen ? (
          <button onClick={() => setChatOpen(true)} className="bg-[#40a829] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg">💬</button>
        ) : (
          <div className="w-80 bg-[#07100a] border border-white/5 rounded-2xl shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-white">Ndovera Assistant</div>
              <button onClick={() => setChatOpen(false)} className="text-zinc-400">✕</button>
            </div>
            <div className="h-56 overflow-y-auto bg-transparent p-2 space-y-2" id="chat-window">
              {chatMessages.map((m, i) => (
                <div key={i} className={`p-2 rounded ${m.from === 'user' ? 'bg-white/5 text-white self-end' : 'bg-white/8 text-zinc-100'}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <label htmlFor="landing-chat" className="sr-only">Ask about Ndovera</label>
              <input id="landing-chat" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat(chatInput); }} aria-label="Ask about Ndovera" className="flex-1 bg-white/5 rounded px-3 py-2 outline-none text-white" />
              <button onClick={() => sendChat(chatInput)} className="bg-[#40a829] text-white px-3 py-2 rounded">Send</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// helpers
function sampleTestimonials() {
  return [
    { id: 't_sample_1', author: 'Mrs. Adebayo', role: 'School Owner', quote: 'Ndovera transformed our fee collection and communication.' },
    { id: 't_sample_2', author: 'Mr. Okonkwo', role: 'Teacher', quote: 'Posting assignments is effortless and students engage more.' },
    { id: 't_sample_3', author: 'Jane Doe', role: 'Student', quote: 'I love the simple layout and quick updates.' },
    { id: 't_sample_4', author: 'Dr. Eze', role: 'Parent', quote: 'I can now track my child\'s performance in real-time.'},
    { id: 't_sample_5', author: 'Mr. Ali', role: 'Accountant', quote: 'Financial reporting has never been this easy and accurate.'}
  ];
}
