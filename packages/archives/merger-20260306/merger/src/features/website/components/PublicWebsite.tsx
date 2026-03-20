import React from 'react';
import { 
  BookOpen, 
  Users, 
  GraduationCap, 
  ArrowRight, 
  CheckCircle2, 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Instagram,
  ChevronRight,
  Zap,
  ShieldCheck,
  Star
} from 'lucide-react';
import { motion } from 'motion/react';
import LoginRegisterPage from './LoginRegisterPage';
import EventsGalleryPage from './EventsGalleryPage';

export default function PublicWebsite({ onBack }: { onBack: () => void }) {
  const [view, setView] = React.useState<'main' | 'login' | 'events'>('main');
  
  if (view === 'login') {
    return <LoginRegisterPage onLogin={() => setView('main')} />;
  }
  if (view === 'events') {
    return <EventsGalleryPage />;
  }
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-200">
              N
            </div>
            <span className="font-black text-2xl tracking-tighter text-slate-900">NDOVERA</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600 uppercase tracking-widest">
            <a href="#home" className="hover:text-emerald-600 transition-colors">Home</a>
            <a href="#about" className="hover:text-emerald-600 transition-colors">About</a>
            <a href="#academics" className="hover:text-emerald-600 transition-colors">Academics</a>
            <a href="#admissions" className="hover:text-emerald-600 transition-colors">Admissions</a>
            <a href="#contact" className="hover:text-emerald-600 transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Back to Portal
            </button>
            <button 
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              onClick={() => setView('login')}
            >
              Login/Register
            </button>
            <button 
              className="bg-emerald-500 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              onClick={() => setView('events')}
            >
              Events Gallery
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-32 pb-20 md:pt-48 md:pb-40 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-250 h-150 bg-emerald-50 rounded-full blur-[120px] opacity-50 -z-10"></div>
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
              <Zap className="w-3 h-3" />
              Admissions Open for 2026/2027
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[0.9] mb-8 tracking-tighter">
              Nurturing <span className="text-emerald-600">Leaders</span>, Building Futures.
            </h1>
            <p className="text-xl text-slate-500 mb-10 leading-relaxed max-w-lg">
              At NDOVERA Academy, we combine academic excellence with character development to prepare students for a globalized world.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-3 group shadow-xl">
                Start Admission
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="bg-white text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all">
                Virtual Tour
              </button>
              <button 
                className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-3 group shadow-xl"
                onClick={() => setView('events')}
              >
                Events Gallery
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-4/5 rounded-[3rem] overflow-hidden shadow-2xl relative">
              <img 
                src="https://picsum.photos/seed/school-hero/800/1000" 
                alt="Students" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent"></div>
              <div className="absolute bottom-8 left-8 right-8 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white">
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
                    ))}
                  </div>
                  <p className="text-sm font-bold">Join 500+ Happy Students</p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                  ))}
                  <span className="text-xs font-medium ml-2">4.9/5 Rating from Parents</span>
                </div>
              </div>
            </div>
            
            {/* Floating Stats */}
            <div className="absolute -top-8 -right-8 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 hidden md:block">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">100%</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WAEC Success</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Programs Section */}
      <section id="academics" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-xs font-black text-emerald-600 uppercase tracking-[0.3em] mb-4">Our Programs</h2>
            <h3 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">Excellence at Every Stage</h3>
            <p className="text-slate-500 text-lg">We offer a comprehensive curriculum designed to inspire curiosity and foster lifelong learning.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Nursery School', desc: 'A nurturing environment where children discover the joy of learning through play and exploration.', icon: Users },
              { title: 'Primary School', desc: 'Building a solid foundation in core subjects while developing critical thinking and social skills.', icon: BookOpen },
              { title: 'Secondary School', desc: 'Preparing students for higher education and beyond with a rigorous academic program.', icon: GraduationCap },
            ].map((program, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10 }}
                className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:border-emerald-100 transition-all group"
              >
                <div className="w-16 h-16 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <program.icon className="w-8 h-8" />
                </div>
                <h4 className="text-2xl font-black text-slate-900 mb-4">{program.title}</h4>
                <p className="text-slate-500 leading-relaxed mb-8">{program.desc}</p>
                <button className="text-emerald-600 font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                  Learn More
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <img src="https://picsum.photos/seed/school1/400/500" className="rounded-3xl w-full aspect-3/4 object-cover" alt="" referrerPolicy="no-referrer" />
                <img src="https://picsum.photos/seed/school2/400/300" className="rounded-3xl w-full aspect-square object-cover" alt="" referrerPolicy="no-referrer" />
              </div>
              <div className="space-y-4 pt-12">
                <img src="https://picsum.photos/seed/school3/400/300" className="rounded-3xl w-full aspect-square object-cover" alt="" referrerPolicy="no-referrer" />
                <img src="https://picsum.photos/seed/school4/400/500" className="rounded-3xl w-full aspect-3/4 object-cover" alt="" referrerPolicy="no-referrer" />
              </div>
            </div>
            <div className="absolute inset-0 bg-linear-to-r from-white via-transparent to-white pointer-events-none lg:hidden"></div>
          </div>

          <div>
            <h2 className="text-xs font-black text-emerald-600 uppercase tracking-[0.3em] mb-4">Why NDOVERA?</h2>
            <h3 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 tracking-tight">A Tradition of Excellence</h3>
            <div className="space-y-8">
              {[
                { title: 'Modern Facilities', desc: 'State-of-the-art laboratories, libraries, and sports complexes.', icon: ShieldCheck },
                { title: 'Expert Educators', desc: 'Highly qualified and passionate teachers dedicated to student success.', icon: Star },
                { title: 'Holistic Development', desc: 'Focus on character, leadership, and extracurricular activities.', icon: CheckCircle2 },
              ].map((item, i) => (
                <div key={i} className="flex gap-6">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-12 bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl">
              Discover Our Story
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
            <div className="col-span-1 lg:col-span-1">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                  N
                </div>
                <span className="font-black text-2xl tracking-tighter">NDOVERA</span>
              </div>
              <p className="text-slate-400 leading-relaxed mb-8">
                Empowering students with the knowledge and character to lead in a globalized world.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-8">Quick Links</h4>
              <ul className="space-y-4 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Admissions</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Academic Calendar</a></li>
                <li><a href="#" className="hover:text-white transition-colors">School Fees</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><button className="hover:text-white transition-colors" style={{background:'none',border:'none',padding:0}} onClick={() => setView('events')}>Events Gallery</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-8">Contact Us</h4>
              <ul className="space-y-6 text-slate-400 text-sm">
                <li className="flex gap-4">
                  <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>123 School Road, Victoria Island, Lagos, Nigeria</span>
                </li>
                <li className="flex gap-4">
                  <Phone className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>+234 800 NDOVERA</span>
                </li>
                <li className="flex gap-4">
                  <Mail className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>info@ndovera.edu.ng</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-8">Newsletter</h4>
              <p className="text-slate-400 text-sm mb-6">Stay updated with the latest news and events from NDOVERA.</p>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Your email" 
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm flex-1 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button className="bg-emerald-600 p-3 rounded-xl hover:bg-emerald-700 transition-colors">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-slate-500 font-bold uppercase tracking-widest">
            <p>© 2026 NDOVERA ACADEMY. ALL RIGHTS RESERVED.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
