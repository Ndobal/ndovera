import React, { useState } from 'react';
import BrandLogo from '../../../shared/BrandLogo';

export default function LoginRegisterPage({ onLogin }: { onLogin?: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  // For demo: handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-emerald-50 via-white to-emerald-100">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        {/* Left: Image & Branding */}
        <div className="md:w-1/2 p-10 flex flex-col items-center justify-center bg-emerald-50 relative">
          <BrandLogo size={60} text={true} className="mb-8" />
          <div className="w-full h-80 rounded-2xl overflow-hidden relative mb-6">
            {image ? (
              <img src={image} alt="Login Visual" className="w-full h-full object-cover" style={{ filter: 'brightness(0.8) blur(0px)' }} />
            ) : (
              <img src="/ndovera logo.png" alt="Default Visual" className="w-full h-full object-cover" style={{ filter: 'brightness(0.8) blur(0px)' }} />
            )}
            <div className="absolute inset-0 bg-emerald-600/30"></div>
          </div>
          <label className="block text-xs font-bold text-emerald-700 mb-2">Super Admin: Upload Login Image</label>
          <input type="file" accept="image/*" onChange={handleImageUpload} className="mb-4" />
        </div>
        {/* Right: Form */}
        <div className="md:w-1/2 p-10 flex flex-col justify-center">
          <h2 className="text-2xl font-black text-emerald-700 mb-6">{isRegister ? 'Register' : 'Login'} to Ndovera</h2>
          <form 
            className="space-y-6"
            onSubmit={e => {
              e.preventDefault();
              if (onLogin) onLogin();
            }}
          >
            {isRegister && (
              <input type="text" placeholder="Full Name" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" />
            )}
            <input type="email" placeholder="Email" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" />
            <input type="password" placeholder="Password" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" />
            {isRegister && (
              <input type="password" placeholder="Confirm Password" className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" />
            )}
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-all shadow-lg">
              {isRegister ? 'Register' : 'Login'}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-500">
            {isRegister ? (
              <span>Already have an account? <button className="text-emerald-600 font-bold" onClick={() => setIsRegister(false)}>Login</button></span>
            ) : (
              <span>Don’t have an account? <button className="text-emerald-600 font-bold" onClick={() => setIsRegister(true)}>Register</button></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
