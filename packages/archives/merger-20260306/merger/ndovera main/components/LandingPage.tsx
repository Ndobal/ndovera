import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  LogIn,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  Users,
  School,
  BookOpen,
  LineChart,
  Wallet,
  Globe,
  CheckCircle,
  Network,
  Layers,
  Brain,
  Search,
  Sparkles
} from 'lucide-react';

interface Props {
  onStartOnboarding: () => void;
  onLogin: () => void;
  onSignup: () => void;
}

export const LandingPage: React.FC<Props> = ({ onStartOnboarding, onLogin, onSignup }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const NavLink = ({ target, label }: { target: string; label: string }) => (
    <button
      onClick={() => scrollToSection(target)}
      className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 hover:text-indigo-400 transition-colors py-2"
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      {/* HEADER */}
      <header
        className={`fixed top-0 w-full z-[100] transition-all duration-500 h-24 flex items-center ${
          scrolled ? 'bg-slate-950/95 shadow-2xl backdrop-blur-xl' : 'bg-slate-950/90 backdrop-blur-md'
        } border-b border-white/5`}
      >
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
          {/* Left: Logo */}
          <button
            className="flex items-center gap-4 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center text-slate-950 shadow-xl group-hover:rotate-12 transition-transform overflow-hidden">
              <GraduationCap className="w-7 h-7 md:w-8 md:h-8" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-black text-2xl md:text-3xl text-white tracking-tighter italic uppercase">
                NDO<span className="text-indigo-400">VERA</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.35em] text-slate-400 font-black">
                Smart Minds. Grow Here.
              </span>
            </div>
          </button>

          {/* Center: Navigation */}
          <nav className="hidden xl:flex items-center gap-8">
            <NavLink target="hero" label="Home" />
            <NavLink target="platform" label="Platform" />
            <NavLink target="solutions" label="Solutions" />
            <NavLink target="ecosystem" label="Ecosystem" />
            <NavLink target="schools" label="Schools" />
            <NavLink target="about" label="About" />
            <NavLink target="resources" label="Resources" />
          </nav>

          {/* Right: CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <button
              onClick={onLogin}
              className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Login
            </button>
            <button
              onClick={onStartOnboarding}
              className="bg-white text-slate-950 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all shadow-xl"
            >
              Get Started
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl"
            >
              Book Demo
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-3 bg-white/10 rounded-2xl text-white"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu className="w-7 h-7" />
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-80 bg-slate-950 shadow-3xl flex flex-col p-8 space-y-8 border-l border-white/5">
            <div className="flex justify-between items-center">
              <span className="font-black text-indigo-400 tracking-widest uppercase text-xs">
                Ndovera Navigation
              </span>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 bg-white/5 rounded-xl text-white"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
            <div className="flex flex-col gap-5 pt-6 text-white text-left font-black text-lg uppercase tracking-tight">
              {[
                { id: 'hero', label: 'Home' },
                { id: 'platform', label: 'Platform' },
                { id: 'solutions', label: 'Solutions' },
                { id: 'ecosystem', label: 'Ecosystem' },
                { id: 'schools', label: 'Schools' },
                { id: 'about', label: 'About' },
                { id: 'resources', label: 'Resources' },
                { id: 'contact', label: 'Contact' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setIsMenuOpen(false);
                    scrollToSection(item.id);
                  }}
                  className="border-b border-white/5 pb-3 text-left"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-auto space-y-4">
              <button
                onClick={onLogin}
                className="w-full py-4 rounded-2xl bg-white/5 text-white font-black uppercase text-xs tracking-widest"
              >
                Login
              </button>
              <button
                onClick={onStartOnboarding}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase text-xs tracking-widest shadow-xl"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="bg-white pt-24">
        {/* HERO */}
        <section
          id="hero"
          className="w-full pt-24 pb-24 md:pt-40 md:pb-40 bg-white relative overflow-hidden flex flex-col items-center justify-center text-center"
        >
          <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center gap-3 px-6 py-2 bg-indigo-50 rounded-full text-indigo-600 font-black text-[10px] uppercase tracking-[0.3em] mb-10 shadow-sm border border-indigo-100">
              <Sparkles className="w-4 h-4" /> Digital Education Infrastructure
            </div>
            <h1 className="text-4xl md:text-7xl lg:text-[5.5rem] font-black text-slate-950 mb-8 tracking-tighter leading-[0.9] uppercase italic text-center drop-shadow-sm">
              Smart Minds. <span className="text-indigo-600">Grow Here.</span>
            </h1>
            <p className="text-lg md:text-2xl text-slate-500 mb-10 max-w-3xl leading-relaxed font-medium px-4 mx-auto text-center opacity-90">
              Standardizing education through simple management, clear English, and a secure reward economy for every child.
            </p>
            <div className="flex flex-row flex-wrap justify-center items-center w-full gap-3 px-4 mb-10">
              <button
                onClick={onStartOnboarding}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] shadow-[0_14px_30px_-12px_rgba(79,70,229,0.4)] hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
              >
                Join Ndovera
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] hover:bg-black transition-all"
              >
                Book a Demo
              </button>
              <button
                onClick={() => scrollToSection('platform')}
                className="bg-slate-100 text-slate-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" /> Explore Platform
              </button>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Zero-trust. Encrypted. Audit-ready.
            </p>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] bg-indigo-100/40 blur-[160px] rounded-full" />
        </section>

        {/* TRUST INDICATORS */}
        <section className="w-full bg-white border-y border-slate-100 py-16">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center items-center">
            {[
              'Partner Schools',
              'Education Boards',
              'Secure Infrastructure',
              'Compliance Ready'
            ].map(label => (
              <div key={label} className="flex flex-col items-center justify-center text-center">
                <p className="text-3xl md:text-4xl font-black text-slate-950 mb-2 tracking-tighter leading-none italic">
                  <ShieldCheck className="w-8 h-8 text-emerald-500" />
                </p>
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.35em] leading-tight">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CORE PILLARS / PLATFORM OVERVIEW */}
        <section id="platform" className="py-24 md:py-32 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-600">
                Platform Pillars
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-950 uppercase italic">
                One infrastructure. Multiple intelligent layers.
              </h2>
              <p className="text-slate-500 font-medium text-base md:text-lg">
                Ndovera unifies school management, learning, identity, rewards, and analytics into a secure, API-first digital backbone.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
              {[
                {
                  title: 'Smart School Management',
                  desc: 'Timetables, records, finance, staff, and governance inside a single operating system.',
                  icon: School
                },
                {
                  title: 'Learning Systems',
                  desc: 'Structured curriculum, content vaults, and AI assistance across subjects and levels.',
                  icon: BookOpen
                },
                {
                  title: 'Progress Tracking',
                  desc: 'Continuous assessment, growth analytics, and clear English reporting for every child.',
                  icon: LineChart
                },
                {
                  title: 'Secure Reward Economy',
                  desc: 'Encrypted student wallets with ethical rewards for effort, consistency, and behavior.',
                  icon: Wallet
                },
                {
                  title: 'Transparency',
                  desc: 'Clear logs, audit trails, and parent visibility baked into every workflow.',
                  icon: Globe
                },
                {
                  title: 'Digital Bridge',
                  desc: 'Connects schools, parents, students, teachers, and regulators across one infrastructure.',
                  icon: Network
                }
              ].map(card => (
                <div
                  key={card.title}
                  className="p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all flex flex-col gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                    <card.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-950">
                    {card.title}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="solutions" className="py-24 md:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-4">
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.4em] text-indigo-600">
                How It Works
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-950 uppercase italic">
                From onboarding to intelligent outcomes.
              </h2>
              <p className="text-slate-500 font-medium text-base md:text-lg">
                Ndovera digitizes the full academic lifecycle – from school registration and classroom activity to analytics and rewards – under one secure infrastructure.
              </p>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                'Schools onboard',
                'Systems digitized',
                'Students registered',
                'Learning structured',
                'Progress tracked',
                'Rewards activated',
                'Parents connected',
                'Analytics generated'
              ].map((step, index) => (
                <li
                  key={step}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-black text-sm uppercase tracking-[0.2em] text-slate-900">
                      {step}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ECOSYSTEM OVERVIEW */}
        <section id="ecosystem" className="py-24 md:py-32 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-600">
                Ecosystem
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-950 uppercase italic">
                A connected education infrastructure.
              </h2>
              <p className="text-slate-500 font-medium text-base md:text-lg">
                Every module talks to the next – via secure APIs, event streams, and analytics pipelines.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                'School Management System',
                'Learning Platform',
                'Student Wallet',
                'Reward Economy',
                'Analytics Engine',
                'Parent Portal',
                'Teacher Portal',
                'Admin Console',
                'API Infrastructure'
              ].map(item => (
                <div
                  key={item}
                  className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-md flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-sm text-slate-800">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* STAKEHOLDER SECTIONS */}
        <section id="schools" className="py-24 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-600">
                For Schools
              </p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-950 uppercase italic">
                Digital transformation for real schools.
              </h2>
              <p className="text-slate-500 font-medium text-base md:text-lg">
                Ndovera helps schools move from paper and spreadsheets to structured, observable, and audit-ready digital systems.
              </p>
              <ul className="mt-4 space-y-3">
                {['Digital transformation', 'Operational efficiency', 'Transparency', 'Data intelligence'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 mt-6">
                <button
                  onClick={onStartOnboarding}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
                >
                  Register School
                </button>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="bg-slate-100 text-slate-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Schedule Demo
                </button>
              </div>
            </div>
            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
              <h3 className="font-black text-sm uppercase tracking-[0.3em] text-slate-500 mb-4">
                School Operations Stack
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                {[
                  'Operations',
                  'Finance',
                  'Academics',
                  'Staff',
                  'Communication',
                  'Governance'
                ].map(item => (
                  <div
                    key={item}
                    className="p-4 rounded-2xl bg-white border border-slate-100 flex items-center gap-3"
                  >
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-xs text-slate-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Parents and Students sections reserved for future private portals; hidden from public site */}

        {/* IMPACT */}
        <section id="impact" className="py-24 md:py-32 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
            <div className="space-y-4 lg:col-span-1">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-600">
                Impact
              </p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-950 uppercase italic">
                Designed for long-term trust.
              </h2>
              <p className="text-slate-500 font-medium text-base md:text-lg">
                Ndovera is architected for regulators, investors, and communities who demand security, clarity, and measurable outcomes.
              </p>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Student success metrics',
                  desc: 'Measure mastery, growth, and consistency per learner.',
                  icon: Brain
                },
                {
                  title: 'Teacher efficiency',
                  desc: 'Automate low-value tasks so teachers can teach.',
                  icon: Users
                },
                {
                  title: 'Parent trust',
                  desc: 'Clear, real-time information builds durable confidence.',
                  icon: ShieldCheck
                },
                {
                  title: 'Institution transparency',
                  desc: 'Every action is logged, structured, and reportable.',
                  icon: Globe
                }
              ].map(card => (
                <div
                  key={card.title}
                  className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-md flex flex-col gap-3"
                >
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <card.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-[0.2em] text-slate-900">
                    {card.title}
                  </h3>
                  <p className="text-sm text-slate-600">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RESOURCES / INVESTORS / LEGAL PREVIEW */}
        <section id="resources" className="py-24 md:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-6 space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-600">
                Resources & Governance
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-950 uppercase italic">
                Clarity for every stakeholder.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-3">
                <h3 className="font-black text-sm uppercase tracking-[0.25em] text-slate-900">
                  Resources
                </h3>
                <p className="text-sm text-slate-600">
                  Blog, research, whitepapers, news, media kits, and documentation outlining how Ndovera operates.
                </p>
              </div>
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-3">
                <h3 className="font-black text-sm uppercase tracking-[0.25em] text-slate-900">
                  Investors
                </h3>
                <p className="text-sm text-slate-600">
                  Market opportunity, business model, revenue streams, and ESG impact – prepared for due diligence.
                </p>
              </div>
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-3">
                <h3 className="font-black text-sm uppercase tracking-[0.25em] text-slate-900">
                  Legal & Compliance
                </h3>
                <p className="text-sm text-slate-600">
                  Privacy, data protection, child safety, security, ethics, and terms – designed for global standards.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* GLOBAL CTA */}
        <section id="about" className="py-24 md:py-32 bg-slate-950 text-white">
          <div className="max-w-6xl mx-auto px-6 text-center space-y-8">
            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-300">
              Join the Future of Education
            </p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase italic">
              Ndovera is not a website.
              <br />
              It is digital education infrastructure.
            </h2>
            <p className="text-slate-300 max-w-3xl mx-auto text-sm md:text-base">
              Built to be audited by enterprise clients, governments, regulators, and international education boards. Security, scalability, and reliability are default – not configuration options.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-4">
              <button
                onClick={onStartOnboarding}
                className="bg-white text-slate-950 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all shadow-xl"
              >
                Register School
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl"
              >
                Partner With Us
              </button>
            </div>
          </div>
        </section>

        {/* CONTACT / DEMO */}
        <section id="contact" className="py-24 md:py-28 bg-slate-900 text-white">
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
            <div className="space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-300">
                Contact
              </p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase italic">
                Book a live walkthrough.
              </h2>
              <p className="text-slate-300 text-sm md:text-base">
                Share your institution type, scale, and objectives. Our team will respond with a tailored demonstration of the Ndovera infrastructure.
              </p>
            </div>
            <div className="bg-slate-950 border border-white/10 rounded-[2.5rem] p-6 flex flex-col gap-3">
              <input
                placeholder="Institution / Organization Name"
                className="w-full p-3 rounded-xl bg-slate-900 text-sm text-white border border-slate-700 outline-none mb-1"
              />
              <input
                placeholder="Work Email"
                className="w-full p-3 rounded-xl bg-slate-900 text-sm text-white border border-slate-700 outline-none mb-1"
              />
              <textarea
                placeholder="Tell us about your requirements, regions of operation, and timelines."
                rows={4}
                className="w-full p-3 rounded-xl bg-slate-900 text-sm text-white border border-slate-700 outline-none mb-2"
              />
              <button className="mt-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all">
                Submit Request
              </button>
              <p className="text-[10px] text-slate-500 mt-2">
                By submitting, you agree that Ndovera may contact you regarding institutional onboarding, in line with our privacy and data protection standards.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="py-16 bg-slate-950 text-white border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 text-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-slate-950 shadow-xl">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="font-black text-lg tracking-tight uppercase italic">Ndovera</span>
              </div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400 font-black">
                Smart Minds. Grow Here.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-3">
                Platform
              </p>
              <div className="flex flex-col gap-2 text-[13px] text-slate-300">
                <button onClick={() => scrollToSection('platform')} className="text-left hover:text-indigo-400">Platform</button>
                <button onClick={() => scrollToSection('solutions')} className="text-left hover:text-indigo-400">Solutions</button>
                <button onClick={() => scrollToSection('ecosystem')} className="text-left hover:text-indigo-400">Ecosystem</button>
                <button className="text-left text-slate-500">Security</button>
                <button className="text-left text-slate-500">Integrations</button>
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-3">
                Community
              </p>
              <div className="flex flex-col gap-2 text-[13px] text-slate-300">
                <button onClick={() => scrollToSection('schools')} className="text-left hover:text-indigo-400">Schools</button>
                <button className="text-left text-slate-500">Teachers</button>
                <button className="text-left text-slate-500">Partners</button>
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-3">
                Company
              </p>
              <div className="flex flex-col gap-2 text-[13px] text-slate-300">
                <button onClick={() => scrollToSection('about')} className="text-left hover:text-indigo-400">About</button>
                <button className="text-left text-slate-500">Careers</button>
                <button className="text-left text-slate-500">Investors</button>
                <button className="text-left text-slate-500">News</button>
                <button onClick={() => scrollToSection('contact')} className="text-left hover:text-indigo-400">Contact</button>
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-3">
                Legal
              </p>
              <div className="flex flex-col gap-2 text-[13px] text-slate-300">
                <button className="text-left text-slate-500">Privacy</button>
                <button className="text-left text-slate-500">Terms</button>
                <button className="text-left text-slate-500">Compliance</button>
                <button className="text-left text-slate-500">Data Protection</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-white/10">
            <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.35em] text-center md:text-left">
              © 2026 Ndovera. All Rights Reserved.
            </p>
            <div className="flex items-center gap-4 text-slate-500 text-xs">
              <span className="uppercase tracking-[0.3em] font-black text-[10px]">Follow</span>
              <div className="flex gap-3">
                <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                  <Globe className="w-4 h-4" />
                </button>
                <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                  <Users className="w-4 h-4" />
                </button>
                <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
                  <Brain className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
