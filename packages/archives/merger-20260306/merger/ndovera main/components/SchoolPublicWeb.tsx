
import React, { useState } from 'react';
import { 
    MapPin, Phone, Mail, GraduationCap, Users, 
    ArrowRight, X, Image as ImageIcon, PlayCircle, 
    BookOpen, Heart, Facebook, Twitter, Instagram, 
    ChevronRight, Timer, AlertOctagon, Landmark, 
    Target, History, Award, Book, UserCheck, ShieldCheck,
    Globe, EyeOff, HandHeart, CheckCircle, Sparkles, MessageSquare, Newspaper,
    Lock, UserCircle, LogIn, Calendar
} from 'lucide-react';
import { WebsiteContent, CSRImpactProject } from '../types';

interface Props {
  content: WebsiteContent;
  onExit?: () => void;
  onLogin?: () => void;
}

type Page = 'home' | 'about' | 'academics' | 'blog' | 'humanity' | 'contact' | 'admissions';

const DonationModal: React.FC<{ onClose: () => void; schoolName: string }> = ({ onClose, schoolName }) => {
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [donorInfo, setDonorInfo] = useState({ name: '', email: '', password: '' });

    const handleIdentification = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggedIn(true);
        setStep(2);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center p-6">
            <div className="bg-white rounded-[4rem] w-full max-w-xl overflow-hidden shadow-2xl animate-scale-in border border-slate-100">
                <div className="bg-emerald-600 p-12 text-white relative">
                    <button onClick={onClose} className="absolute top-10 right-10 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-6 h-6"/></button>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mb-6 shadow-xl"><HandHeart className="w-8 h-8"/></div>
                        <h2 className="text-4xl font-black tracking-tighter italic uppercase">Support {schoolName}</h2>
                        <p className="text-emerald-100 font-medium mt-2">Create an identity to track your humanity contributions.</p>
                    </div>
                </div>
                
                <div className="p-12 space-y-8">
                    {step === 0 ? ( 
                        <form onSubmit={handleIdentification} className="space-y-6 animate-fade-in">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Donor Identification Required</p>
                            <input required placeholder="Full Name" value={donorInfo.name} onChange={e => setDonorInfo({...donorInfo, name: e.target.value})} className="w-full bg-slate-50 p-6 rounded-3xl outline-none border border-slate-100 font-bold"/>
                            <input required type="email" placeholder="Email Address" value={donorInfo.email} onChange={e => setDonorInfo({...donorInfo, email: e.target.value})} className="w-full bg-slate-50 p-6 rounded-3xl outline-none border border-slate-100 font-bold"/>
                            <input required type="password" placeholder="Create Passcode" className="w-full bg-slate-50 p-6 rounded-3xl outline-none border border-slate-100 font-bold"/>
                            <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl">Verify Identity</button>
                        </form>
                    ) : step === 1 ? (
                        <div className="space-y-6 animate-fade-in">
                            {isLoggedIn && (
                                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identified As:</span>
                                    <span className="text-xs font-black text-emerald-600 uppercase">{donorInfo.name || 'John Donor'}</span>
                                </div>
                            )}
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Select Contribution Amount</p>
                            <div className="grid grid-cols-3 gap-3">
                                {['5000', '25000', '100000'].map(val => (
                                    <button key={val} onClick={() => setAmount(val)} className={`py-5 rounded-2xl font-black text-sm border-2 transition-all ${amount === val ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>₦{parseInt(val).toLocaleString()}</button>
                                ))}
                            </div>
                            <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400">₦</span>
                                <input type="number" placeholder="Enter Custom Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 p-6 rounded-3xl outline-none border border-slate-100 focus:ring-4 ring-emerald-50 font-black text-xl pl-12" />
                            </div>
                            <button onClick={() => !isLoggedIn ? setStep(0) : setStep(2)} disabled={!amount} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {!isLoggedIn ? 'Identify to Continue' : 'Review Contribution'} <ArrowRight className="w-4 h-4"/>
                            </button>
                        </div>
                    ) : step === 2 ? (
                        <div className="space-y-6 animate-fade-in text-center">
                            <h3 className="text-2xl font-black tracking-tight">Confirm Your Support</h3>
                            <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100">
                                <p className="text-6xl font-black text-slate-900 tracking-tighter mb-2">₦{parseInt(amount).toLocaleString()}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Humanity Support</p>
                            </div>
                            <button onClick={() => setStep(3)} className="w-full bg-emerald-600 text-white py-8 rounded-[2.5rem] font-black text-lg uppercase tracking-widest shadow-xl">Complete Payment</button>
                        </div>
                    ) : (
                        <div className="text-center space-y-8 animate-fade-in py-10">
                            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mx-auto border-4 border-emerald-100"><CheckCircle className="w-10 h-10"/></div>
                            <h3 className="text-3xl font-black italic tracking-tighter uppercase">Contribution Received.</h3>
                            <button onClick={onClose} className="bg-slate-900 text-white px-12 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl">Return to Site</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SchoolPublicWeb: React.FC<Props> = ({ content, onExit, onLogin }) => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [showDonationModal, setShowDonationModal] = useState(false);

  const style = { font: 'font-sans', primary: content.brandColor, bg: 'bg-white', rounded: 'rounded-[3rem]' };

  const renderHome = () => (
      <div className="animate-fade-in">
          <div className="relative h-[850px] flex items-center overflow-hidden">
              <img src={content.home.heroImage} className="absolute inset-0 w-full h-full object-cover scale-105" />
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
              <div className="relative max-w-7xl mx-auto px-6 text-center text-white">
                  <h1 className="text-7xl md:text-[10rem] font-black mb-8 tracking-tighter leading-[0.85]" dangerouslySetInnerHTML={{ __html: content.home.headline }}></h1>
                  <p className="text-2xl mb-14 max-w-3xl mx-auto font-medium opacity-90">{content.home.subheadline}</p>
                  <div className="flex flex-col md:flex-row gap-6 justify-center">
                    <button onClick={() => setCurrentPage('admissions')} className="px-14 py-6 rounded-full font-black text-xl hover:scale-110 transition-transform shadow-2xl" style={{ backgroundColor: style.primary }}>Join the Legacy</button>
                    <button onClick={() => setCurrentPage('blog')} className="bg-white/10 backdrop-blur-xl border border-white/20 text-white px-14 py-6 rounded-full font-black text-xl hover:bg-white/20 transition-all">Read Our Blog</button>
                  </div>
              </div>
          </div>
          
          <div className="py-32 max-w-7xl mx-auto px-6">
            <h3 className="text-5xl font-black tracking-tighter uppercase italic text-center mb-20">Insights & Excellence.</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {content.bulletins.slice(0, 3).map((news, i) => (
                    <div key={i} className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-xl hover:translate-y-[-10px] transition-all group">
                         <div className="flex justify-between items-center mb-8">
                             <span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-[9px] font-black uppercase">{news.category}</span>
                             <div className="text-slate-300"><Calendar className="w-5 h-5"/></div>
                         </div>
                         <h4 className="text-3xl font-black italic tracking-tighter group-hover:text-indigo-600 transition-colors mb-6">{news.title}</h4>
                         <p className="text-slate-500 font-medium italic mb-10 leading-relaxed">"{news.content.slice(0, 120)}..."</p>
                         <button onClick={() => setCurrentPage('blog')} className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">Read Full Story <ArrowRight className="w-4 h-4"/></button>
                    </div>
                ))}
            </div>
          </div>
      </div>
  );

  const renderBlog = () => (
    <div className="py-32 max-w-7xl mx-auto px-6 animate-fade-in space-y-16">
        <div className="text-center space-y-4">
            <h2 className="text-8xl font-black italic tracking-tighter">Institutional Blog.</h2>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Official Voice of {content.schoolName}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {content.bulletins.map((news, i) => (
                <div key={i} className="bg-white p-16 rounded-[5rem] border border-slate-100 shadow-2xl flex flex-col justify-between group hover:border-indigo-100 transition-all">
                    <div className="space-y-8">
                        <div className="flex justify-between items-center">
                            <span className="bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{news.category}</span>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{news.date}</span>
                        </div>
                        <h4 className="text-5xl font-black italic tracking-tighter group-hover:text-indigo-600 transition-colors">{news.title}</h4>
                        <div className="h-1 w-20 bg-indigo-600 rounded-full"/>
                        <p className="text-slate-500 text-2xl font-medium leading-relaxed italic opacity-80">"{news.content}"</p>
                    </div>
                    <div className="mt-16 pt-10 border-t border-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center"><UserCircle className="w-6 h-6 text-slate-400"/></div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400">Published by</p>
                                <p className="text-sm font-black italic uppercase">{news.author}</p>
                            </div>
                        </div>
                        <button className="p-5 bg-indigo-50 text-indigo-600 rounded-[2rem] hover:bg-indigo-600 hover:text-white transition-all shadow-xl">
                            <ArrowRight className="w-8 h-8"/>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${style.font} ${style.bg} relative`}>
      {onExit && <button onClick={onExit} className="fixed bottom-10 right-10 z-[100] bg-slate-900 text-white px-10 py-5 rounded-full shadow-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 border-4 border-white transition-transform hover:scale-110"><X className="w-4 h-4" /> Exit Site</button>}
      {showDonationModal && <DonationModal onClose={() => setShowDonationModal(false)} schoolName={content.schoolName} />}

      <nav className="bg-white/90 backdrop-blur-3xl border-b border-slate-50 sticky top-0 z-50 h-24 flex items-center shadow-sm">
          <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
              <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setCurrentPage('home')}>
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl group-hover:rotate-6 transition-all"><GraduationCap className="text-white w-8 h-8"/></div>
                  <span className="font-black text-3xl tracking-tighter uppercase italic text-slate-900">{content.schoolName}</span>
              </div>
              <div className="hidden lg:flex gap-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {['Home', 'About', 'Academics', 'Blog', 'Humanity', 'Contact'].map(p => (
                      <button key={p} onClick={() => setCurrentPage(p.toLowerCase() as any)} className={`transition-colors relative pb-1 ${currentPage === p.toLowerCase() ? 'text-indigo-600' : 'hover:text-slate-900'}`}>
                        {p}
                        {currentPage === p.toLowerCase() && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full"/>}
                      </button>
                  ))}
              </div>
              <div className="flex items-center gap-4">
                  <button onClick={onLogin} className="hidden md:block text-slate-400 font-black text-[9px] uppercase tracking-[0.3em] hover:text-indigo-600 transition-colors">Portal Login</button>
                  <button onClick={() => setShowDonationModal(true)} className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-emerald-600 border-2 border-emerald-100 bg-emerald-50 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 shadow-sm">
                      <HandHeart className="w-4 h-4"/> Donate
                  </button>
              </div>
          </div>
      </nav>

      <main>
          {currentPage === 'home' && renderHome()}
          {currentPage === 'blog' && renderBlog()}
          {currentPage === 'about' && <div className="py-20 text-center">About Content</div>}
          {currentPage === 'academics' && <div className="py-20 text-center">Academics Content</div>}
          {currentPage === 'humanity' && <div className="py-20 text-center">Humanity Content</div>}
          {currentPage === 'contact' && <div className="py-20 text-center">Contact Content</div>}
      </main>

      <footer className="bg-slate-950 py-32 text-white text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-700">© 2026 {content.schoolName} Global. Powered by Ndovera OS.</p>
      </footer>
    </div>
  );
};
